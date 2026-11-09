// Block flow helpers: open the sealed, apply match results, prepare rewards.
// Pure functions over RunState (they return a new state); the page stores and
// autosaves whatever comes back.

import { aiPick, autoBuild } from "./autobuild";
import type { ProgData, ProgPrint, ProgSet, Rarity } from "./data";
import { MAIN_RARITIES, RARITY_ORDER, isMainRarity, playableName, resolveSupport, setsInYears, wheelRarity } from "./data";
import type { Pack } from "./packs";
import { PackFactory } from "./packs";
import type { HistoryEntry, Owned, PlayerState, Reward, RunState, Slot } from "./run";
import { blockSetCodes, blockYears, blocksOf, emptyBasics, ownedOf, runRng, sameSide, sideLead } from "./run";

let factory: { key: string; f: PackFactory } | null = null;

export function factoryFor(data: ProgData, run: Pick<RunState, "allowPartial">): PackFactory {
  const key = `${data.generated}|${run.allowPartial}`;
  if (!factory || factory.key !== key) factory = { key, f: new PackFactory(data, run.allowPartial) };
  return factory.f;
}

/** The booster sets of the current block: its years, or the sets chosen for it. */
export function blockSets(data: ProgData, run: RunState): ProgSet[] {
  const codes = blockSetCodes(run);
  if (codes) {
    const want = new Set(codes.map((c) => c.toLowerCase()));
    return data.sets.filter((s) => want.has(s.code.toLowerCase()) && (data.printsBySet.get(s.idx)?.length ?? 0) > 0);
  }
  const [from, to] = blockYears(run);
  return setsInYears(data, from, to);
}

/** Ask the engine which cards of this block (and The List) it can play. */
export async function prepareBlock(data: ProgData, run: RunState): Promise<void> {
  await resolveSupport([...PackFactory.namesForSets(data, blockSets(data, run)), ...data.list.map((p) => p.card.name)]);
}

export function engineName(print: ProgPrint, run: Pick<RunState, "allowPartial">): string {
  return playableName(print.card.name, run.allowPartial) ?? print.card.name;
}

const clone = (run: RunState): RunState => JSON.parse(JSON.stringify(run)) as RunState;

/** The sealed packs a slot opens this block (deterministic for the run seed). */
export function sealedFor(data: ProgData, run: RunState, slot: Slot): Pack[] {
  return factoryFor(data, run).openSealedFrom(blockSets(data, run), run.packs, runRng(run, slot, "sealed"));
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
  // Every AI seat opens its sealed (seeded: the same on every device) and builds.
  next.players.forEach((opp, other) => {
    if (other === next.me || opp.kind !== "ai") return;
    addOpened(opp, toOwned(sealedFor(data, run, other)), run.cumulative);
    const built = autoBuild(opp.pool ?? [], data);
    opp.main = built.main;
    opp.basics = built.basics;
    opp.ready = true;
  });
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
  // Slices: common / uncommon / rare / mythic present in the opened pool (List and
  // special-sheet cards count as their real rarity), and only rarities the block's
  // years can actually offer.
  const sets = blockSets(data, run);
  const present = rarityOrder(p.opened.map((o) => wheelRarity(data, data.byKey.get(o.k))));
  let wheel = present.filter((r) => f.universeOf(sets, r).length > 0);
  if (!wheel.length) wheel = MAIN_RARITIES.filter((r) => f.universeOf(sets, r).length > 0).slice(0, 3);
  if (!wheel.length) wheel = ["c"];
  const rng = runRng(run, slot, "wheel");
  const rarity = wheel[rng.int(wheel.length)];
  const choices = rng.shuffle(f.universeOf(sets, rarity)).slice(0, 30).map((c) => c.key);
  return { kind: "wheel", wheel, rarity, choices, spun: false, done: false };
}

/** A wheel reward made by an older version (Special slice, no cards to pick) is rebuilt. */
export function rewardNeedsRepair(run: RunState): boolean {
  const r = run.players[run.me].reward;
  if (!r || r.kind !== "wheel" || r.done) return false;
  return !r.choices?.length || !isMainRarity(r.rarity) || (r.wheel ?? []).some((x) => !isMainRarity(x));
}

export function repairReward(data: ProgData, run: RunState): RunState {
  const next = clone(run);
  next.players[next.me].reward = buildReward(data, next, next.me, true);
  return next;
}

/** Games a player must win to take the block: best of 1 → 1, of 3 → 2, of 5 → 3. */
export function seriesTarget(run: Pick<RunState, "bestOf">): number {
  return Math.ceil((run.bestOf ?? 3) / 2);
}

/**
 * A game of the block's series ended (`winner` = seat). Until someone reaches
 * the target the block goes on with another game; then the block is recorded
 * and every player's reward is set up (the AIs resolve theirs at once). Results
 * of an older two-player Bo3 played inside one match pass `wholeSeries`.
 */
export function applyResult(data: ProgData, run: RunState, winner: Slot | null, wholeSeries?: { score: string }): RunState {
  const next = clone(run);
  const me = next.me;
  const series = next.players.map((_, i) => next.series?.[i] ?? 0);
  // Team tables: a game won by either player counts for the team (on its first seat).
  if (winner !== null && !wholeSeries) series[sideLead(next, winner)] += 1;
  next.pendingGameId = null;
  next.pendingResult = null;
  const best = Math.max(...series);
  if (!wholeSeries && best < seriesTarget(next)) {
    // Not decided yet: next game of the series.
    next.series = series;
    next.phase = "match";
    return next;
  }
  const blockWinner: Slot | null = wholeSeries ? winner : series.indexOf(best);
  const entry: HistoryEntry = {
    block: next.block,
    years: blockYears(next),
    winner: blockWinner,
    // One number per side (team tables: per team).
    score: wholeSeries ? wholeSeries.score : [...new Set(next.players.map((_, i) => sideLead(next, i)))].map((lead) => series[lead]).join("-"),
  };
  next.history = next.history.filter((h) => h.block !== next.block).concat(entry);
  const won = (slot: Slot) => blockWinner !== null && sameSide(next, slot, blockWinner);
  next.players.forEach((p, i) => {
    if (blockWinner === null) return;
    if (won(i)) p.wins += 1;
    else p.losses += 1;
  });
  next.series = next.players.map(() => 0);
  next.players[me].reward = buildReward(data, next, me, won(me));
  next.players.forEach((o, slot) => {
    if (slot === me || o.kind !== "ai" || !o.pool) return;
    const r = buildReward(data, next, slot, won(slot));
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
  });
  next.phase = "reward";
  return next;
}

/** The seat that won the result the watcher stored (older results: from my wins / their wins). */
export function resultWinner(run: RunState): Slot | null {
  const r = run.pendingResult;
  if (!r) return null;
  if (typeof r.winner === "number" && r.winner >= 0 && r.winner < run.players.length) return r.winner;
  if (r.myWins === r.oppWins) return null;
  return r.myWins > r.oppWins ? run.me : run.players.findIndex((_, i) => i !== run.me);
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

/**
 * Rebuild the opponent's collection on this device (friend games only know
 * their own pool): every sealed pool and List reward is seeded, so it can be
 * regenerated. Wheel picks are choices and cannot be — those cards keep the
 * default art. Used only to show the right printings during the match.
 */
export async function opponentCollection(data: ProgData, run: RunState, opp: Slot = run.players.findIndex((_, i) => i !== run.me)): Promise<Owned[]> {
  const out: Owned[] = [];
  for (let b = run.cumulative ? 0 : run.block; b <= run.block; b++) {
    const at: RunState = { ...run, block: b };
    await prepareBlock(data, at);
    for (const pack of sealedFor(data, at, opp)) for (const c of pack.cards) out.push(ownedOf(c, engineName(c, at)));
    const h = run.history.find((x) => x.block === b);
    if (h && (h.winner === null || !sameSide(run, h.winner, opp))) out.push(...(buildReward(data, at, opp, false).list ?? []));
  }
  return out;
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
