// Block flow helpers: open the sealed, apply match results, prepare rewards.
// Pure functions over RunState (they return a new state); the page stores and
// autosaves whatever comes back.

import { aiPick, autoBuild } from "./autobuild";
import type { ProgData, ProgPrint, Rarity } from "./data";
import { RARITY_ORDER, playableName, resolveSupport } from "./data";
import type { Pack } from "./packs";
import { PackFactory } from "./packs";
import type { HistoryEntry, Owned, PlayerState, Reward, RunState, Slot } from "./run";
import { blockYears, blocksOf, emptyBasics, ownedOf, runRng } from "./run";

let factory: { key: string; f: PackFactory } | null = null;

export function factoryFor(data: ProgData, run: Pick<RunState, "allowPartial">): PackFactory {
  const key = `${data.generated}|${run.allowPartial}`;
  if (!factory || factory.key !== key) factory = { key, f: new PackFactory(data, run.allowPartial) };
  return factory.f;
}

/** Ask the engine which cards of this block (and The List) it can play. */
export async function prepareBlock(data: ProgData, run: RunState): Promise<void> {
  const [from, to] = blockYears(run);
  await resolveSupport([...PackFactory.namesForYears(data, from, to), ...data.list.map((p) => p.card.name)]);
}

export function engineName(print: ProgPrint, run: Pick<RunState, "allowPartial">): string {
  return playableName(print.card.name, run.allowPartial) ?? print.card.name;
}

const clone = (run: RunState): RunState => JSON.parse(JSON.stringify(run)) as RunState;

/** The sealed packs a slot opens this block (deterministic for the run seed). */
export function sealedFor(data: ProgData, run: RunState, slot: Slot): Pack[] {
  const [from, to] = blockYears(run);
  return factoryFor(data, run).openSealed(from, to, run.packs, runRng(run, slot, "sealed"));
}

function addOpened(p: PlayerState, cards: Owned[], cumulative: boolean): void {
  if (!p.pool) p.pool = [];
  if (!cumulative) {
    p.pool = [];
    p.main = [];
    p.basics = emptyBasics();
  }
  p.pool.push(...cards);
  p.opened = cards;
  p.ready = false;
  p.reward = null;
}

/** Put the opened packs into the collection(s) and move to the pool view. The AI opens and builds silently. */
export function applySealed(data: ProgData, run: RunState, myPacks: Pack[]): RunState {
  const next = clone(run);
  const toOwned = (packs: Pack[]) => packs.flatMap((pk) => pk.cards.map((c) => ownedOf(c, engineName(c, run))));
  addOpened(next.players[next.me], toOwned(myPacks), run.cumulative);
  const other = (1 - next.me) as Slot;
  const opp = next.players[other];
  if (opp.kind === "ai") {
    addOpened(opp, toOwned(sealedFor(data, run, other)), run.cumulative);
    const built = autoBuild(opp.pool ?? [], data);
    opp.main = built.main;
    opp.basics = built.basics;
    opp.ready = true;
  }
  next.phase = "pool";
  return next;
}

export function rarityOrder(rs: Iterable<Rarity>): Rarity[] {
  const set = new Set(rs);
  return RARITY_ORDER.filter((r) => set.has(r));
}

function buildReward(data: ProgData, run: RunState, slot: Slot, won: boolean): Reward {
  const p = run.players[slot];
  const f = factoryFor(data, run);
  if (!won) {
    const rng = runRng(run, slot, "the-list");
    const list = rng.shuffle(f.playableList());
    const picked: Owned[] = [];
    const names = new Set<string>();
    for (const c of list) {
      if (names.has(c.card.name)) continue;
      names.add(c.card.name);
      picked.push(ownedOf(c, engineName(c, run)));
      if (picked.length === 3) break;
    }
    return { kind: "list", list: picked, done: false };
  }
  const present = rarityOrder(p.opened.map((o) => data.byKey.get(o.k)?.rarity ?? "c"));
  const wheel = present.length ? present : (["c", "u", "r"] as Rarity[]);
  const rng = runRng(run, slot, "wheel");
  const rarity = wheel[rng.int(wheel.length)];
  const [from, to] = blockYears(run);
  const universe = f.universe(from, to, rarity);
  const choices = rng.shuffle(universe).slice(0, 30).map((c) => c.key);
  return { kind: "wheel", wheel, rarity, choices, spun: false, done: false };
}

/** Record a finished Bo3 and set up both players' rewards (the AI resolves its own at once). */
export function applyResult(data: ProgData, run: RunState, myWins: number, oppWins: number): RunState {
  const next = clone(run);
  const me = next.me;
  const opp = (1 - me) as Slot;
  const iWon = myWins > oppWins;
  const winner: Slot | null = myWins === oppWins ? null : iWon ? me : opp;
  const entry: HistoryEntry = {
    block: next.block,
    years: blockYears(next),
    winner,
    score: `${myWins}-${oppWins}`,
  };
  next.history = next.history.filter((h) => h.block !== next.block).concat(entry);
  if (winner !== null) {
    next.players[winner].wins += 1;
    next.players[(1 - winner) as Slot].losses += 1;
  }
  next.pendingGameId = null;
  next.pendingResult = null;
  next.players[me].reward = buildReward(data, next, me, winner === me);
  const o = next.players[opp];
  if (o.kind === "ai" && o.pool) {
    const r = buildReward(data, next, opp, winner === opp);
    if (r.kind === "list") o.pool.push(...(r.list ?? []));
    else if (r.choices?.length) {
      const built = autoBuild(o.pool, data);
      const key = aiPick(r.choices, data, built.colors);
      const print = data.byKey.get(key);
      if (print) {
        o.pool.push(ownedOf(print, engineName(print, next)));
        o.main.push(o.pool.length - 1);
      }
    }
    o.reward = { ...r, done: true };
  }
  next.phase = "reward";
  return next;
}

/** Finish my reward: wheel pick goes into the collection and the main deck; List cards go to the collection. */
export function claimReward(data: ProgData, run: RunState, pickedKey?: string): RunState {
  const next = clone(run);
  const p = next.players[next.me];
  const r = p.reward;
  if (!r || r.done || !p.pool) return next;
  if (r.kind === "list") p.pool.push(...(r.list ?? []));
  else if (pickedKey) {
    const print = data.byKey.get(pickedKey);
    if (print) {
      p.pool.push(ownedOf(print, engineName(print, next)));
      p.main.push(p.pool.length - 1);
      r.picked = pickedKey;
    }
  }
  r.done = true;
  next.phase = "timeline";
  return next;
}

/** Advance to the next block (or finish the run). */
export function advanceBlock(run: RunState): RunState {
  const next = clone(run);
  const total = blocksOf(next).length;
  for (const p of next.players) {
    p.ready = false;
    p.reward = null;
  }
  if (next.block + 1 >= total) {
    next.phase = "done";
    return next;
  }
  next.block += 1;
  next.phase = "opening";
  return next;
}
