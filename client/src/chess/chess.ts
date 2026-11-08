// Chess — Rogue Forge mode (run state).
//
// Both players pick a deck (a Starter precon or a meta deck). The run is N
// matches; before each one, K boosters per player are opened, each played as a
// Chess minigame whose cards join the collections; then deck building and a
// single game. The winner of a game moves first in the next round of minigames;
// the loser plays first in the next game.

import type { ProgData, ProgSet } from "../progression/data";
import { findPrintByName } from "../progression/data";
import { engineName } from "../progression/flow";
import { makeRng, randomSeed } from "../progression/rng";
import type { Owned, PlayerState, Slot } from "../progression/run";
import { CHESS_RUN_KEY, decodeCode, emptyBasics, encodeCode, ownedOf } from "../progression/run";
import { foldBasics } from "../progression/starter";
import type { StarterDeck } from "../progression/starterData";
import { deckOwned } from "../progression/starterData";
import type { MetaDeck } from "./chessData";
import { chessSets } from "./chessData";
import type { ChessResult } from "./minigame";

export const CHESS_AUTOSAVE_KEY = CHESS_RUN_KEY;

export type BoosterPlan = "each" | "pick" | "one" | "match" | "random";
export const PLAN_LABEL: Record<BoosterPlan, string> = {
  each: "Choose the set of every booster, game by game",
  pick: "Same chosen sets in every game",
  one: "One set for every booster",
  match: "One random set per match",
  random: "Every booster random",
};

export interface ChessDeckRef {
  kind: "starter" | "meta";
  id: string;
  name: string;
  /** Main-deck size (without the commander). */
  size: number;
  format?: string;
  commander?: string;
}

export interface ChessRun {
  v: 1;
  kind: "chess";
  id: string;
  seed: string;
  created: number;
  mode: "ai" | "friend";
  difficulty: string;
  startingLife: number | null;
  matches: number;
  perMatch: number;
  plan: BoosterPlan;
  /** Set codes: plan "each" one per game and booster (game * perMatch + slot), "pick" one per booster slot, "one" a single one. */
  sets: string[];
  decks: [ChessDeckRef, ChessDeckRef];
  me: Slot;
  players: [PlayerState, PlayerState];
  /** Real match being prepared/played (0-based) and minigame within it. */
  match: number;
  slot: number;
  phase: "minigame" | "build" | "match" | "done";
  /** Who moves first in this round's minigames, and who plays first in the next game. */
  miniFirst: Slot;
  nextFirst: Slot | null;
  lastWinner: Slot | null;
  history: { match: number; winner: Slot }[];
  minis: { match: number; slot: number; set: string; winner: Slot }[];
  pendingGameId: string | null;
  pendingResult: { myWins: number; oppWins: number } | null;
}

export interface ChessSettings {
  mode: "ai" | "friend";
  difficulty: string;
  startingLife: number | null;
  matches: number;
  perMatch: number;
  plan: BoosterPlan;
  sets: string[];
}

function metaOwned(data: ProgData, deck: MetaDeck): Owned[] {
  const out: Owned[] = [];
  for (const c of deck.cards) {
    const print = findPrintByName(data, c.name);
    for (let i = 0; i < c.count; i++) out.push(print ? { k: print.key, n: c.name } : { k: `name:${c.name}`, n: c.name });
  }
  return out;
}

function deckPlayer(data: ProgData, name: string, kind: "human" | "ai", pool: Owned[], commanders?: string[]): PlayerState {
  let cards = pool;
  for (const commander of commanders ?? []) {
    // The commander lives in the command zone, not in the deck.
    const at = cards.findIndex((o) => o.n === commander);
    if (at >= 0) cards = cards.filter((_, i) => i !== at);
  }
  const p: PlayerState = { name, kind, pool: cards, main: cards.map((_, i) => i), basics: emptyBasics(), wins: 0, losses: 0, opened: [], ready: false, reward: null, ...(commanders?.length ? { commander: commanders.slice() } : {}) };
  return foldBasics(data, p);
}

/** Commander decks: the listed commander(s) (partners: two), else the first legendary creature of the list. */
export function commanderOf(deck: StarterDeck | MetaDeck, data?: ProgData): string[] | undefined {
  // An imported commander list names its commander(s).
  if (!("format" in deck)) return deck.commanderFormat && deck.commanders?.length ? deck.commanders.slice(0, 2) : undefined;
  if (!deck.commanderFormat) return undefined;
  if (deck.commanders?.length) return deck.commanders.slice(0, 2);
  if (!data) return undefined;
  const c = deck.cards.find((c) => /Legendary.*Creature/.test(data.byName.get(c.name)?.[0]?.card.type ?? ""))?.name;
  return c ? [c] : undefined;
}

export function deckRef(deck: StarterDeck | MetaDeck, data?: ProgData): ChessDeckRef {
  const commanders = commanderOf(deck, data);
  const inMain = "format" in deck && commanders ? commanders.filter((n) => deck.cards.some((c) => c.name === n)).length : 0;
  return "format" in deck
    ? { kind: "meta", id: deck.id, name: deck.year && deck.source === "history" ? `${deck.name} (${deck.format} ${deck.year})` : deck.name, size: deck.size - inMain, format: deck.commanderFormat ?? deck.format, ...(commanders ? { commander: commanders.join(" & ") } : {}) }
    : {
        kind: "starter",
        id: deck.id,
        name: deck.name,
        size: deck.owned ? deck.owned.length : deck.cards.reduce((t, c) => t + c.count, 0),
        ...(commanders ? { format: "Commander", commander: commanders.join(" & ") } : {}),
      };
}

export function createChess(data: ProgData, s: ChessSettings, names: [string, string], decks: [StarterDeck | MetaDeck, StarterDeck | MetaDeck]): ChessRun {
  const seed = randomSeed();
  const pool = (d: StarterDeck | MetaDeck) => ("format" in d ? metaOwned(data, d) : deckOwned(data, d));
  const rng = makeRng(seed, "first");
  return {
    v: 1,
    kind: "chess",
    id: crypto.randomUUID(),
    seed,
    created: Date.now(),
    mode: s.mode,
    difficulty: s.difficulty,
    startingLife: s.startingLife,
    matches: Math.max(1, s.matches),
    perMatch: Math.max(1, s.perMatch),
    plan: s.plan,
    sets: s.sets,
    decks: [deckRef(decks[0], data), deckRef(decks[1], data)],
    me: 0,
    players: [
      deckPlayer(data, names[0], "human", pool(decks[0]), commanderOf(decks[0], data)),
      deckPlayer(data, names[1], s.mode === "ai" ? "ai" : "human", pool(decks[1]), commanderOf(decks[1], data)),
    ],
    match: 0,
    slot: 0,
    phase: "minigame",
    miniFirst: rng.int(2) as Slot,
    nextFirst: null,
    lastWinner: null,
    history: [],
    minis: [],
    pendingGameId: null,
    pendingResult: null,
  };
}

/** The set of booster `slot` of match `match`. */
export function chessSetFor(data: ProgData, run: ChessRun, match = run.match, slot = run.slot): ProgSet {
  const all = chessSets(data);
  const byCode = (code: string | undefined) => (code ? all.find((s) => s.code === code) : undefined);
  let set: ProgSet | undefined;
  if (run.plan === "each") set = byCode(run.sets[match * run.perMatch + slot] ?? run.sets[slot] ?? run.sets[0]);
  else if (run.plan === "pick") set = byCode(run.sets[slot] ?? run.sets[0]);
  else if (run.plan === "one") set = byCode(run.sets[0]);
  else if (run.plan === "match") set = makeRng(run.seed, "set", match).pick(all);
  else set = makeRng(run.seed, "set", match, slot).pick(all);
  return set ?? makeRng(run.seed, "set", match, slot, "fallback").pick(all);
}

/** Minigame over: its cards join the collections. */
export function applyMinigame(data: ProgData, run: ChessRun, res: ChessResult, setCode: string, names?: Map<string, string>): ChessRun {
  const next = JSON.parse(JSON.stringify(run)) as ChessRun;
  for (const slot of [0, 1] as Slot[]) {
    const p = next.players[slot];
    if (!p.pool) continue;
    for (const key of res.pools[slot]) {
      // A printing missing from this device's index (the host opened the booster): by name.
      const nm = names?.get(key);
      const print = data.byKey.get(key) ?? (nm ? findPrintByName(data, nm) : undefined);
      if (print) p.pool.push(ownedOf(print, engineName(print, { allowPartial: false })));
    }
  }
  next.minis.push({ match: next.match, slot: next.slot, set: setCode, winner: res.winner });
  next.slot += 1;
  // Next minigame of the round: the loser of this one moves first.
  next.miniFirst = (1 - res.winner) as Slot;
  if (next.slot >= next.perMatch) next.phase = "build";
  return next;
}

/** A game ended (myWins/oppWins from this device's point of view). */
export function applyChessResult(run: ChessRun, myWins: number, oppWins: number): ChessRun {
  const next = JSON.parse(JSON.stringify(run)) as ChessRun;
  const winner = (myWins > oppWins ? next.me : 1 - next.me) as Slot;
  const loser = (1 - winner) as Slot;
  next.players[winner].wins += 1;
  next.players[loser].losses += 1;
  next.history.push({ match: next.match, winner });
  next.lastWinner = winner;
  next.pendingGameId = null;
  next.pendingResult = null;
  next.match += 1;
  next.slot = 0;
  // The winner moves first in the next minigames; the loser plays first in the next game.
  next.miniFirst = winner;
  next.nextFirst = loser;
  next.phase = next.match >= next.matches ? "done" : "minigame";
  return next;
}

export function deckSizeOf(run: ChessRun, slot: Slot): number {
  return run.decks[slot].size;
}

/**
 * Commander rules when both decks have a commander (Duel Commander when both are Duel
 * Commander lists); otherwise Limited, and a commander goes back into its deck.
 */
export function chessFormat(run: ChessRun): "Commander" | "DuelCommander" | "Limited" {
  if (!run.players[0].commander?.length || !run.players[1].commander?.length) return "Limited";
  return run.decks[0].format === "DuelCommander" && run.decks[1].format === "DuelCommander" ? "DuelCommander" : "Commander";
}

export function forMatch(p: PlayerState, format: "Commander" | "DuelCommander" | "Limited"): PlayerState {
  if (format !== "Limited" || !p.commander?.length || !p.pool) return p;
  const pool = [...p.pool, ...p.commander.map((n) => ({ k: `name:${n}`, n }))];
  return { ...p, commander: undefined, pool, main: [...p.main, ...p.commander.map((_, i) => p.pool!.length + i)] };
}

export function autosaveChess(run: ChessRun | null): void {
  try {
    if (run) localStorage.setItem(CHESS_AUTOSAVE_KEY, JSON.stringify(run));
    else localStorage.removeItem(CHESS_AUTOSAVE_KEY);
  } catch {
    // storage full / blocked
  }
}

export function loadChessAutosave(): ChessRun | null {
  try {
    const run = JSON.parse(localStorage.getItem(CHESS_AUTOSAVE_KEY) ?? "null") as ChessRun | null;
    return run && run.v === 1 && run.kind === "chess" && Array.isArray(run.players) ? run : null;
  } catch {
    return null;
  }
}

export function encodeChess(run: ChessRun): Promise<string> {
  return encodeCode("CHES", { ...run, pendingGameId: null });
}

export async function decodeChess(code: string): Promise<ChessRun> {
  const run = await decodeCode<ChessRun>("CHES", code);
  if (!run || run.kind !== "chess" || !Array.isArray(run.players)) throw new Error("This is not a Chess code.");
  return run;
}
