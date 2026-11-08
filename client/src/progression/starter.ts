// Starter mode: two 60-card precons, a shared grid of boosters at stake.
//
//   preview (read-only deck) → match (Bo1) → reward → packs → build → match … → done
//
// After each game: the loser picks a colour and gets a random card of that
// colour from The List; the winner spins a wheel of the rarities in the deck
// they played and adds one more copy of a card of that rarity. Then the winner
// opens one booster from the grid, the loser another. When the grid is empty a
// last game is played. Game 1: random starter; later games: the loser chooses.

import { autoBuild } from "./autobuild";
import type { ProgData, ProgPrint, Rarity } from "./data";
import { colorsOf, isLandCard, resolveSupport, wheelRarity } from "./data";
import { engineName, factoryFor, rarityOrder } from "./flow";
import type { Pack, ProductKind } from "./packs";
import { productsFor } from "./packs";
import { makeRng, randomSeed } from "./rng";
import type { Basic, Owned, PlayerState, Reward, Slot } from "./run";
import { STARTER_AUTOSAVE_KEY, decodeCode, emptyBasics, encodeCode, ownedOf } from "./run";
import type { StarterDeck } from "./starterData";
import { deckOwned } from "./starterData";

export type StarterPhase = "preview" | "match" | "reward" | "packs" | "build" | "done";

export interface GridPack {
  set: string;
  kind: ProductKind;
  /** Who took it (null = still in the grid) and in which round. */
  taker: Slot | null;
  round: number | null;
}

export interface StarterRun {
  v: 1;
  kind: "starter";
  id: string;
  seed: string;
  created: number;
  mode: "ai" | "friend";
  difficulty: string;
  startingLife: number | null;
  decks: [string, string];
  grid: GridPack[];
  /** Index of the current / next game (0-based). */
  game: number;
  phase: StarterPhase;
  me: Slot;
  players: [PlayerState, PlayerState];
  history: { game: number; winner: Slot | null }[];
  /** Winner and loser of the last game (pack order, rewards, who chooses the start). */
  lastWinner: Slot | null;
  /** Who starts the next game (chosen by the loser); null = random. */
  nextFirst: Slot | null;
  /** Main-deck size of each starting deck (imported lists can be shorter than 60). */
  startSize?: [number, number];
  pendingGameId: string | null;
  pendingResult: { myWins: number; oppWins: number } | null;
}

export interface StarterSettings {
  mode: "ai" | "friend";
  difficulty: string;
  startingLife: number | null;
  packs: number;
}

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

export const totalGames = (run: StarterRun): number => run.grid.length / 2 + 1;
export const packsLeft = (run: StarterRun): number => run.grid.filter((p) => p.taker === null).length;

function newPlayer(name: string, kind: "human" | "ai", pool: Owned[]): PlayerState {
  return {
    name,
    kind,
    pool,
    main: pool.map((_, i) => i),
    basics: emptyBasics(),
    wins: 0,
    losses: 0,
    opened: [],
    ready: false,
    reward: null,
  };
}

const BASIC_NAMES: Basic[] = ["Plains", "Island", "Swamp", "Mountain", "Forest", "Wastes"];

/**
 * The precon's basic lands go to the deck builder's basic land tray (free,
 * unlimited) instead of sitting in the collection; their printing is kept in
 * `landArt` so the match still shows the deck's own basics.
 */
export function foldBasics(data: ProgData, p: PlayerState): PlayerState {
  const pool = p.pool;
  if (!pool || !pool.some((o) => (BASIC_NAMES as string[]).includes(o.n))) return p;
  const basics = { ...p.basics };
  const landArt = { ...(p.landArt ?? {}) };
  const inMain = new Set(p.main);
  const keep: number[] = [];
  pool.forEach((o, i) => {
    const b = BASIC_NAMES.find((n) => n === o.n);
    if (!b) {
      keep.push(i);
      return;
    }
    if (inMain.has(i)) basics[b] = (basics[b] ?? 0) + 1;
    const id = data.byKey.get(o.k)?.id ?? "";
    if (!landArt[b] && id.length === 32) landArt[b] = `${id.slice(0, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}-${id.slice(16, 20)}-${id.slice(20)}`;
  });
  const remap = new Map(keep.map((old, i) => [old, i]));
  return {
    ...p,
    pool: keep.map((i) => pool[i]),
    main: p.main.filter((i) => remap.has(i)).map((i) => remap.get(i)!),
    basics,
    landArt,
  };
}

/** Runs saved before basics went to the tray: fold them now (null = nothing to do). */
export function foldStarterBasics(data: ProgData, run: StarterRun): StarterRun | null {
  const players = run.players.map((p) => foldBasics(data, p)) as [PlayerState, PlayerState];
  return players[0] === run.players[0] && players[1] === run.players[1] ? null : { ...run, players };
}

/** Random boosters of any set and product, duplicates allowed. */
function makeGrid(data: ProgData, n: number, seed: string): GridPack[] {
  const rng = makeRng(seed, "grid");
  const sets = data.sets.filter((s) => (data.printsBySet.get(s.idx)?.length ?? 0) >= 40);
  const out: GridPack[] = [];
  for (let i = 0; i < n; i++) {
    const set = rng.pick(sets);
    const kinds = productsFor(set);
    // Premium products are rarer than the plain booster.
    const weights = kinds.map((k) => (k === "collector" ? 0.22 : k === "set" ? 0.35 : 1));
    out.push({ set: set.code, kind: kinds[rng.weighted(weights)], taker: null, round: null });
  }
  return out;
}

/** Imported commander lists: the commander(s) go to the command zone (kept out of the pool). */
function withCommander(p: PlayerState, deck: StarterDeck): PlayerState {
  return deck.commanderFormat && deck.commanders?.length ? { ...p, commander: deck.commanders.slice(0, 2) } : p;
}

/** Rules of a Starter game: Commander when both players have a commander, else Limited. */
export function starterFormat(run: StarterRun): "Commander" | "Limited" {
  return run.players[0].commander?.length && run.players[1].commander?.length ? "Commander" : "Limited";
}

export function createStarter(data: ProgData, s: StarterSettings, names: [string, string], decks: [StarterDeck, StarterDeck]): StarterRun {
  const seed = randomSeed();
  const packs = Math.max(2, Math.round(s.packs / 2) * 2);
  return {
    v: 1,
    kind: "starter",
    id: crypto.randomUUID(),
    seed,
    created: Date.now(),
    mode: s.mode,
    difficulty: s.difficulty,
    startingLife: s.startingLife,
    decks: [decks[0].id, decks[1].id],
    grid: makeGrid(data, packs, seed),
    game: 0,
    phase: "preview",
    me: 0,
    players: [
      foldBasics(data, withCommander(newPlayer(names[0], "human", deckOwned(data, decks[0])), decks[0])),
      foldBasics(data, withCommander(newPlayer(names[1], s.mode === "ai" ? "ai" : "human", deckOwned(data, decks[1])), decks[1])),
    ],
    history: [],
    lastWinner: null,
    nextFirst: null,
    pendingGameId: null,
    pendingResult: null,
    startSize: [deckOwned(data, decks[0]).length, deckOwned(data, decks[1]).length],
  };
}

// ── boosters ────────────────────────────────────────────────────────────────

export function gridSet(data: ProgData, pack: GridPack) {
  return data.sets.find((s) => s.code === pack.set) ?? null;
}

/** Contents of grid booster #i (seeded: identical on both devices). */
export async function openGridPack(data: ProgData, run: StarterRun, i: number): Promise<Pack | null> {
  const gp = run.grid[i];
  const set = gp && gridSet(data, gp);
  if (!set) return null;
  await resolveSupport([...(data.printsBySet.get(set.idx) ?? []).map((p) => p.card.name), ...data.list.map((p) => p.card.name)]);
  const f = factoryFor(data, { allowPartial: false });
  return f.openProduct(set, gp.kind, makeRng(run.seed, "pack", i));
}

/** Who picks now in the packs phase: winner first, then loser; null = both done. */
export function picker(run: StarterRun): Slot | null {
  const round = run.game - 1;
  const taken = run.grid.filter((p) => p.round === round);
  const winner = run.lastWinner ?? 0;
  if (taken.length === 0) return winner;
  if (taken.length === 1) return packsLeft(run) > 0 ? ((1 - winner) as Slot) : null;
  return null;
}

/** Record that `slot` took booster #i; its cards join that player's collection (when known here). */
export async function takePack(data: ProgData, run: StarterRun, i: number, slot: Slot): Promise<{ run: StarterRun; pack: Pack | null }> {
  const next = clone(run);
  const gp = next.grid[i];
  if (!gp || gp.taker !== null) return { run: next, pack: null };
  gp.taker = slot;
  gp.round = next.game - 1;
  const pack = await openGridPack(data, next, i);
  const p = next.players[slot];
  if (pack && p.pool) {
    const cards = pack.cards.map((c) => ownedOf(c, engineName(c, { allowPartial: false })));
    p.pool.push(...cards);
    p.opened = cards;
    if (p.kind === "ai") aiUpgrade(data, p, cards);
  }
  return { run: next, pack };
}

/** The AI takes a random booster still in the grid. */
export async function aiTakePack(data: ProgData, run: StarterRun): Promise<{ run: StarterRun; index: number; pack: Pack | null }> {
  const free = run.grid.map((p, i) => (p.taker === null ? i : -1)).filter((i) => i >= 0);
  const index = makeRng(run.seed, "ai-pack", run.game).pick(free);
  const res = await takePack(data, run, index, (1 - run.me) as Slot);
  return { ...res, index };
}

/** AI deck tuning: opened rares/mythics in its colours replace its weakest same-colour commons. */
function aiUpgrade(data: ProgData, p: PlayerState, cards: Owned[]): void {
  if (!p.pool) return;
  const pool = p.pool;
  const deckColors = new Set<string>();
  for (const i of p.main) {
    const pr = data.byKey.get(pool[i]?.k ?? "");
    if (pr && !isLandCard(pr.card)) colorsOf(pr.card).forEach((c) => deckColors.add(c));
  }
  const start = pool.length - cards.length;
  for (let j = start; j < pool.length; j++) {
    const pr = data.byKey.get(pool[j].k);
    if (!pr || isLandCard(pr.card) || (pr.rarity !== "r" && pr.rarity !== "m")) continue;
    const cols = colorsOf(pr.card);
    if (cols.some((c) => !deckColors.has(c))) continue;
    const victim = p.main.find((i) => {
      const v = data.byKey.get(pool[i]?.k ?? "");
      return v && !isLandCard(v.card) && v.rarity === "c" && colorsOf(v.card).every((c) => cols.includes(c) || !cols.length);
    });
    if (victim === undefined) continue;
    p.main = p.main.filter((i) => i !== victim).concat(j);
  }
}

// ── results and rewards ─────────────────────────────────────────────────────

export const LIST_COLORS = ["W", "U", "B", "R", "G", "C"] as const;
export const COLOR_LABEL: Record<string, string> = { W: "White", U: "Blue", B: "Black", R: "Red", G: "Green", C: "Colorless" };

/** A random card of `color` that was on The List (seeded per game, player and colour). */
export function listCardFor(data: ProgData, run: StarterRun, slot: Slot, color: string): ProgPrint | null {
  const f = factoryFor(data, { allowPartial: false });
  const pool = f.playableList().filter((p) => {
    const cols = colorsOf(p.card);
    return color === "C" ? cols.length === 0 && !isLandCard(p.card) : cols.length === 1 && cols[0] === color;
  });
  if (!pool.length) return null;
  return makeRng(run.seed, run.game, slot, "list", color).pick(pool);
}

/** The winner's wheel: rarities of the non-basic cards in the deck they played. */
function wheelReward(data: ProgData, run: StarterRun, slot: Slot): Reward {
  const p = run.players[slot];
  const pool = p.pool ?? [];
  const byRarity = new Map<Rarity, string[]>();
  for (const i of p.main) {
    const o = pool[i];
    const pr = o && data.byKey.get(o.k);
    if (!pr || /Basic/.test(pr.card.type)) continue;
    const r = wheelRarity(data, pr);
    const keys = byRarity.get(r) ?? [];
    if (!keys.includes(pr.key)) keys.push(pr.key);
    byRarity.set(r, keys);
  }
  const wheel = rarityOrder(byRarity.keys());
  if (!wheel.length) return { kind: "wheel", wheel: ["c"], rarity: "c", choices: [], spun: false, done: false };
  const rarity = wheel[makeRng(run.seed, run.game, slot, "wheel").int(wheel.length)];
  return { kind: "wheel", wheel, rarity, choices: byRarity.get(rarity) ?? [], spun: false, done: false };
}

/** Record a finished game; set up my reward (the AI settles its own at once). */
export async function applyStarterResult(data: ProgData, run: StarterRun, myWins: number, oppWins: number): Promise<StarterRun> {
  await resolveSupport(data.list.map((p) => p.card.name));
  const next = clone(run);
  const me = next.me;
  const opp = (1 - me) as Slot;
  const winner: Slot | null = myWins === oppWins ? null : myWins > oppWins ? me : opp;
  next.history = next.history.filter((h) => h.game !== next.game).concat({ game: next.game, winner });
  if (winner !== null) {
    next.players[winner].wins += 1;
    next.players[(1 - winner) as Slot].losses += 1;
  }
  next.lastWinner = winner ?? next.lastWinner ?? me;
  next.pendingGameId = null;
  next.pendingResult = null;
  next.nextFirst = null;
  const last = next.game + 1 >= totalGames(next) || packsLeft(next) === 0;
  next.game += 1;
  if (last) {
    next.phase = "done";
    return next;
  }
  next.players[me].reward = winner === me ? wheelReward(data, next, me) : { kind: "list", done: false };
  const o = next.players[opp];
  if (o.kind === "ai" && o.pool) {
    if (winner === opp) {
      const r = wheelReward(data, next, opp);
      const key = r.choices?.length ? makeRng(next.seed, next.game, opp, "ai-wheel").pick(r.choices) : null;
      const print = key ? data.byKey.get(key) : undefined;
      if (print) {
        o.pool.push(ownedOf(print, engineName(print, { allowPartial: false })));
        o.main.push(o.pool.length - 1);
      }
      o.reward = { ...r, picked: key ?? undefined, spun: true, done: true };
    } else {
      const built = autoBuild(o.pool, data);
      const color = built.colors[0] ?? "C";
      const card = listCardFor(data, next, opp, color);
      if (card) o.pool.push(ownedOf(card, engineName(card, { allowPartial: false })));
      o.reward = { kind: "list", color, list: card ? [ownedOf(card, card.card.name)] : [], done: true };
      // The AI lost: it chooses to play first next game.
      next.nextFirst = opp;
    }
  }
  next.phase = "reward";
  return next;
}

/** Loser: take the List card of the chosen colour. Winner: add one more copy of the picked card. */
export function claimStarterReward(data: ProgData, run: StarterRun, choice: string): StarterRun {
  const next = clone(run);
  const p = next.players[next.me];
  const r = p.reward;
  if (!r || r.done || !p.pool) return next;
  if (r.kind === "list") {
    const card = listCardFor(data, next, next.me, choice);
    r.color = choice;
    if (card) {
      const owned = ownedOf(card, engineName(card, { allowPartial: false }));
      p.pool.push(owned);
      r.list = [owned];
    }
  } else {
    const print = data.byKey.get(choice);
    if (print) {
      p.pool.push(ownedOf(print, engineName(print, { allowPartial: false })));
      p.main.push(p.pool.length - 1);
      r.picked = choice;
    }
  }
  r.done = true;
  return next;
}

/**
 * The opponent's cards as far as this device can tell (for in-game art):
 * their deck and the boosters they took (both recorded here), plus every
 * colour's List card they could have received. Wheel picks are extra copies of
 * deck cards, already covered.
 */
export function opponentStandIn(data: ProgData, run: StarterRun): PlayerState {
  const slot = (1 - run.me) as Slot;
  const opp = run.players[slot];
  if (opp.kind === "ai") return opp;
  const extras: Owned[] = [];
  for (let g = 1; g <= run.game; g++) {
    for (const c of LIST_COLORS) {
      const card = listCardFor(data, { ...run, game: g }, slot, c);
      if (card) extras.push(ownedOf(card, card.card.name));
    }
  }
  return { ...opp, pool: [...(opp.pool ?? []), ...extras] };
}

// ── persistence ─────────────────────────────────────────────────────────────

export function autosaveStarter(run: StarterRun | null): void {
  try {
    if (run) localStorage.setItem(STARTER_AUTOSAVE_KEY, JSON.stringify(run));
    else localStorage.removeItem(STARTER_AUTOSAVE_KEY);
  } catch {
    // Storage blocked: the code is the reliable save.
  }
}

export function loadStarterAutosave(): StarterRun | null {
  try {
    const run = JSON.parse(localStorage.getItem(STARTER_AUTOSAVE_KEY) ?? "null") as StarterRun | null;
    return run && run.v === 1 && run.kind === "starter" && Array.isArray(run.players) ? run : null;
  } catch {
    return null;
  }
}

export function encodeStarter(run: StarterRun): Promise<string> {
  return encodeCode("STAR", { ...run, pendingGameId: null });
}

export async function decodeStarter(code: string): Promise<StarterRun> {
  const run = await decodeCode<StarterRun>("STAR", code);
  if (!run || run.v !== 1 || run.kind !== "starter" || !Array.isArray(run.players)) throw new Error("The save code is damaged or from another version.");
  return run;
}
