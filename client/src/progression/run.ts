// Progression run state, transitions and save codes.
//
// A run walks year blocks from `startYear` to `endYear`. For each block:
//   opening → pool → build → match (Bo3) → reward → timeline → next block
// Each device keeps the pools it knows (vs AI: both; vs a friend: its own) and
// can export two things:
//   • the RUN code   (settings, seed, block, phase, records, pools, pending reward)
//   • the LIST       (own main deck + sideboard as a plain decklist)
// Loading a run code asks which player you are, so pools can be re-associated
// with the people in the room.

import type { ProgData, ProgPrint, Rarity } from "./data";
import { makeRng, randomSeed } from "./rng";

export type Basic = "Plains" | "Island" | "Swamp" | "Mountain" | "Forest" | "Wastes";
export const BASICS: Basic[] = ["Plains", "Island", "Swamp", "Mountain", "Forest"];
export type Basics = Record<Basic, number>;
export const emptyBasics = (): Basics => ({ Plains: 0, Island: 0, Swamp: 0, Mountain: 0, Forest: 0, Wastes: 0 });

export type Phase = "opening" | "pool" | "build" | "match" | "reward" | "timeline" | "done";
/** A seat at the table: 0 = the first player (host), up to 3 at tables of 4. */
export type Slot = number;

/** One owned copy: printing key + engine card name (name kept so lists survive data refreshes). */
export interface Owned {
  k: string;
  n: string;
}

export interface Reward {
  kind: "wheel" | "list";
  /** Wheel: rarities on the wheel (present in the block's opened pool). */
  wheel?: Rarity[];
  /** Wheel: the rarity the spin lands on (pre-rolled from the seed). */
  rarity?: Rarity;
  spun?: boolean;
  /** Wheel: printing keys offered (30). */
  choices?: string[];
  /** List: the three cards opened. */
  list?: Owned[];
  done: boolean;
  picked?: string;
  /** Starter: colour chosen for the List card. */
  color?: string;
}

export interface PlayerState {
  name: string;
  kind: "human" | "ai";
  /** Whole collection; null when this device does not hold that player's pool. */
  pool: Owned[] | null;
  /** Indexes into `pool` that are in the main deck. */
  main: number[];
  basics: Basics;
  wins: number;
  losses: number;
  /** Cards opened in the current block's sealed (the wheel reads its rarities). */
  opened: Owned[];
  ready: boolean;
  reward: Reward | null;
  /** Starter: Scryfall id (dashed) of the precon's own printing of each basic land. */
  landArt?: Partial<Record<Basic, string>>;
  /** Commander decks: the commander(s), kept out of the pool (command zone in Commander games). */
  commander?: string[];
  /** Scryfall id (dashed) of the printing of cards outside the pool (a precon's commander). */
  cardArt?: Record<string, string>;
}

export interface HistoryEntry {
  block: number;
  years: [number, number];
  winner: Slot | null;
  score: string;
}

export interface RunSettings {
  mode: "ai" | "friend";
  startYear: number;
  endYear: number;
  blockSize: number;
  packs: number;
  cumulative: boolean;
  allowPartial: boolean;
  difficulty: string;
  startingLife: number | null;
  /** Games per block: best of 1, 3 or 5 (older runs: 3). */
  bestOf?: number;
  /** Tables of 4: two teams (seats 1+2 against 3+4, Two-Headed Giant) instead of everyone for themselves. */
  teams?: boolean;
  /** Boosters chosen by set instead of by year: the sets of each block (one series per block). */
  packBlocks?: PackSetRef[][];
}

/** A booster set picked for a run (code as in the card index). */
export interface PackSetRef {
  code: string;
  name: string;
  year: number;
}

export interface RunState extends RunSettings {
  v: 1;
  id: string;
  seed: string;
  created: number;
  block: number;
  phase: Phase;
  /** Which slot this device plays. */
  me: Slot;
  /** 2 to 4 players: the host first, then the friends, then the AIs. */
  players: PlayerState[];
  history: HistoryEntry[];
  /** Games won by each player in this block's series (best of 1/3/5). */
  series?: number[];
  /** Set while a game is being played (the result watcher matches on it). */
  pendingGameId: string | null;
  /** Result written by the watcher (or by hand) and not yet applied; `winner` = the winner's seat. */
  pendingResult: { myWins: number; oppWins: number; winner?: number } | null;
}

type BlockSettings = Pick<RunSettings, "startYear" | "endYear" | "blockSize" | "packBlocks">;

/** Whether the run's boosters are chosen by set. */
export const bySets = (s: Pick<RunSettings, "packBlocks">): boolean => !!s.packBlocks?.length;

/** The chosen sets of each block (runs by set). */
export function setChunks(s: BlockSettings): PackSetRef[][] {
  return s.packBlocks ?? [];
}

/** The years of every block (runs by set: the release years of each block's sets). */
export function blocksOf(s: BlockSettings): [number, number][] {
  if (bySets(s)) {
    return setChunks(s).map((c) => (c.length ? ([Math.min(...c.map((x) => x.year)), Math.max(...c.map((x) => x.year))] as [number, number]) : ([0, 0] as [number, number])));
  }
  const out: [number, number][] = [];
  const size = Math.max(1, Math.min(5, Math.round(s.blockSize)));
  for (let y = s.startYear; y <= s.endYear; y += size) out.push([y, Math.min(s.endYear, y + size - 1)]);
  return out;
}

/** Set codes of a block, or null when the run goes by years. */
export function blockSetCodes(run: BlockSettings & { block: number }, block = run.block): string[] | null {
  if (!bySets(run)) return null;
  const chunks = setChunks(run);
  return (chunks[Math.min(block, chunks.length - 1)] ?? []).map((x) => x.code);
}

/** What a block is called: its years, or its sets for runs by set. */
export function blockLabel(s: BlockSettings, block: number): string {
  if (bySets(s)) {
    const c = setChunks(s)[block] ?? [];
    return c.length > 2 ? `${c[0].name} +${c.length - 1}` : c.map((x) => x.name).join(" + ");
  }
  const blocks = blocksOf(s);
  return yearsLabel(blocks[Math.min(block, blocks.length - 1)] ?? [s.startYear, s.endYear]);
}

/** Short block tags for the timeline (set codes for runs by set). */
export function blockTags(s: BlockSettings): string[] {
  if (bySets(s)) return setChunks(s).map((c) => c.map((x) => x.code.toUpperCase()).join("+") || "—");
  return blocksOf(s).map(yearsLabel);
}

/** The whole run in a few words. */
export function runLabel(s: BlockSettings): string {
  if (bySets(s)) return "Chosen boosters";
  return yearsLabel([s.startYear, s.endYear]);
}

// ── Sides (teams of two at tables of 4) ─────────────────────────────────────

/** The side a seat plays for: its team (0 or 1) at team tables, else the seat itself. */
export function sideOf(run: Pick<RunSettings, "teams"> & { players: unknown[] }, seat: Slot): number {
  return run.teams && run.players.length === 4 ? (seat < 2 ? 0 : 1) : seat;
}

export function sameSide(run: Pick<RunSettings, "teams"> & { players: unknown[] }, a: Slot, b: Slot): boolean {
  return sideOf(run, a) === sideOf(run, b);
}

/** The first seat of a side (the seat a team's results are counted on). */
export function sideLead(run: Pick<RunSettings, "teams"> & { players: unknown[] }, seat: Slot): Slot {
  return run.teams && run.players.length === 4 ? (seat < 2 ? 0 : 2) : seat;
}

/** "Anna" or, at team tables, "Anna & Bruno". */
export function sideName(run: Pick<RunSettings, "teams"> & { players: { name: string }[] }, seat: Slot): string {
  if (!(run.teams && run.players.length === 4)) return run.players[seat]?.name ?? "?";
  const lead = sideLead(run, seat);
  return `${run.players[lead].name} & ${run.players[lead + 1].name}`;
}

export function blockYears(run: BlockSettings & { block: number }): [number, number] {
  const blocks = blocksOf(run);
  return blocks[Math.min(run.block, blocks.length - 1)];
}

export function yearsLabel([a, b]: [number, number]): string {
  return a === b ? String(a) : `${a}–${b}`;
}

function newPlayer(name: string, kind: "human" | "ai", known: boolean): PlayerState {
  return {
    name,
    kind,
    pool: known ? [] : null,
    main: [],
    basics: emptyBasics(),
    wins: 0,
    losses: 0,
    opened: [],
    ready: false,
    reward: null,
  };
}

/** A new run. `kinds`: who plays each seat (the AIs' collections are known to every device). */
export function createRun(settings: RunSettings, names: string[], kinds?: ("human" | "ai")[]): RunState {
  const ai = settings.mode === "ai";
  const seatKinds = kinds ?? names.map((_, i) => (i === 0 ? "human" : ai ? "ai" : "human"));
  return {
    ...settings,
    v: 1,
    id: crypto.randomUUID(),
    seed: randomSeed(),
    created: Date.now(),
    block: 0,
    phase: "opening",
    me: 0,
    players: names.map((n, i) => newPlayer(n, seatKinds[i], i === 0 || seatKinds[i] === "ai")),
    series: names.map(() => 0),
    history: [],
    pendingGameId: null,
    pendingResult: null,
  };
}

export function ownedOf(print: ProgPrint, engineName: string): Owned {
  return { k: print.key, n: engineName };
}

/** Rng for anything tied to (run, block, player, purpose): reload-proof. */
export function runRng(run: RunState, slot: Slot, purpose: string) {
  return makeRng(run.seed, run.block, slot, purpose);
}

// ── Persistence ─────────────────────────────────────────────────────────────

const AUTOSAVE_KEY = "phase-progression-run";

export function autosave(run: RunState | null): void {
  try {
    if (run) localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(run));
    else localStorage.removeItem(AUTOSAVE_KEY);
  } catch {
    // Storage blocked or full: the run code is the reliable save.
  }
}

export function loadAutosave(): RunState | null {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    if (!raw) return null;
    const run = JSON.parse(raw) as RunState;
    return run && run.v === 1 && Array.isArray(run.players) ? run : null;
  } catch {
    return null;
  }
}

/** True while a Progression Bo3 is being played (or its result not yet claimed). */
export function isProgressionMatchPending(): boolean {
  const run = loadAutosave();
  return Boolean(run && run.phase === "match" && run.pendingGameId);
}

/** Autosave key of the Starter mode run (see starter.ts). */
export const STARTER_AUTOSAVE_KEY = "phase-starter-run";

function starterMatchPending(): boolean {
  try {
    const run = JSON.parse(localStorage.getItem(STARTER_AUTOSAVE_KEY) ?? "null") as { phase?: string; pendingGameId?: string | null } | null;
    return Boolean(run && run.phase === "match" && run.pendingGameId);
  } catch {
    return false;
  }
}

export const CHESS_RUN_KEY = "phase-chess-run";

function chessMatchPending(): boolean {
  try {
    const run = JSON.parse(localStorage.getItem(CHESS_RUN_KEY) ?? "null") as { phase?: string; pendingGameId?: string | null } | null;
    return Boolean(run && run.phase === "match" && run.pendingGameId);
  } catch {
    return false;
  }
}

/** Route of the mode whose match is being played (Progression, Starter or Chess), if any. */
export function pendingMatchRoute(): string | null {
  if (isProgressionMatchPending()) return "/progression";
  if (starterMatchPending()) return "/starter";
  if (chessMatchPending()) return "/chess";
  return null;
}

/** Generic save code: `<PREFIX>1-` + gzip + base64url (or `<PREFIX>0-` without CompressionStream). */
export async function encodeCode(prefix: string, value: unknown): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(value));
  if (typeof CompressionStream !== "undefined") {
    return `${prefix}1-${toB64Url(await pipeThrough(json, new CompressionStream("gzip")))}`;
  }
  return `${prefix}0-${toB64Url(json)}`;
}

export async function decodeCode<T>(prefix: string, code: string): Promise<T> {
  const text = code.trim().replace(/\s+/g, "");
  const m = new RegExp(`^${prefix}([01])-(.+)$`).exec(text);
  if (!m) throw new Error(`This is not a valid save code (it should start with ${prefix}1-).`);
  let bytes = fromB64Url(m[2]);
  if (m[1] === "1") {
    if (typeof DecompressionStream === "undefined") throw new Error("This browser cannot read compressed save codes.");
    bytes = await pipeThrough(bytes, new DecompressionStream("gzip"));
  }
  return JSON.parse(new TextDecoder().decode(bytes)) as T;
}

function toB64Url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64Url(text: string): Uint8Array {
  const b64 = text.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "===".slice((b64.length + 3) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function pipeThrough(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

/** RUN save code: `PROG1-` + gzip + base64url (or `PROG0-` + base64url without CompressionStream). */
export async function encodeRun(run: RunState): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify({ ...run, pendingGameId: null }));
  if (typeof CompressionStream !== "undefined") {
    return `PROG1-${toB64Url(await pipeThrough(json, new CompressionStream("gzip")))}`;
  }
  return `PROG0-${toB64Url(json)}`;
}

export async function decodeRun(code: string): Promise<RunState> {
  const text = code.trim().replace(/\s+/g, "");
  const m = /^PROG([01])-(.+)$/.exec(text);
  if (!m) throw new Error("This is not a Progression save code (it should start with PROG1-).");
  let bytes = fromB64Url(m[2]);
  if (m[1] === "1") {
    if (typeof DecompressionStream === "undefined") throw new Error("This browser cannot read compressed save codes.");
    bytes = await pipeThrough(bytes, new DecompressionStream("gzip"));
  }
  const run = JSON.parse(new TextDecoder().decode(bytes)) as RunState;
  if (!run || run.v !== 1 || !Array.isArray(run.players) || run.players.length < 2 || run.players.length > 4) {
    throw new Error("The save code is damaged or from another version.");
  }
  return run;
}

// ── Deck lists ──────────────────────────────────────────────────────────────

function countLines(names: string[]): string[] {
  const counts = new Map<string, number>();
  for (const n of names) counts.set(n, (counts.get(n) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([n, q]) => `${q} ${n}`);
}

export function mainNames(p: PlayerState): string[] {
  if (!p.pool) return [];
  const pool = p.pool;
  const names = p.main.filter((i) => i >= 0 && i < pool.length).map((i) => pool[i].n);
  for (const b of Object.keys(p.basics) as Basic[]) for (let i = 0; i < p.basics[b]; i++) names.push(b);
  return names;
}

export function sideboardNames(p: PlayerState): string[] {
  if (!p.pool) return [];
  const inMain = new Set(p.main);
  return p.pool.filter((_, i) => !inMain.has(i)).map((o) => o.n);
}

/** Plain decklist: main (with basics), then "Sideboard" = the rest of the collection. */
export function exportList(p: PlayerState): string {
  const side = countLines(sideboardNames(p));
  return [...countLines(mainNames(p)), ...(side.length ? ["", "Sideboard", ...side] : [])].join("\n");
}

/**
 * Restore a player's collection and deck from an exported list. Main-deck basics
 * become basic counts; everything else becomes owned cards (printing resolved by
 * name: first booster printing in the index, else The List).
 */
export function importList(text: string, data: ProgData): { pool: Owned[]; main: number[]; basics: Basics; unknown: string[] } {
  const pool: Owned[] = [];
  const main: number[] = [];
  const basics = emptyBasics();
  const unknown: string[] = [];
  const index = new Map<string, ProgPrint>();
  const remember = (name: string, p: ProgPrint) => {
    const full = name.toLowerCase();
    if (!index.has(full)) index.set(full, p);
    const front = full.split(" // ")[0];
    if (!index.has(front)) index.set(front, p);
  };
  for (const [name, prints] of data.byName) remember(name, prints[0]);
  for (const p of data.list) remember(p.card.name, p);
  let side = false;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (/^(sideboard|sb:?)$/i.test(line)) {
      side = true;
      continue;
    }
    const m = /^(?:SB:\s*)?(\d+)\s*x?\s+(.+?)(?:\s+\([A-Za-z0-9]+\)\s*[\w-]*)?$/.exec(line);
    if (!m) continue;
    const qty = Number(m[1]);
    const name = m[2].trim();
    if (!side && (BASICS as string[]).includes(name)) {
      basics[name as Basic] += qty;
      continue;
    }
    const print = index.get(name.toLowerCase());
    if (!print) {
      unknown.push(name);
      continue;
    }
    for (let i = 0; i < qty; i++) {
      if (!side) main.push(pool.length);
      pool.push({ k: print.key, n: name });
    }
  }
  return { pool, main, basics, unknown };
}
