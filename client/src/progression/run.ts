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
export type Slot = 0 | 1;

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
  players: [PlayerState, PlayerState];
  history: HistoryEntry[];
  /** Set while a Bo3 is being played (the result watcher matches on it). */
  pendingGameId: string | null;
  /** Result written by the watcher (or by hand) and not yet applied. */
  pendingResult: { myWins: number; oppWins: number } | null;
}

export function blocksOf(s: Pick<RunSettings, "startYear" | "endYear" | "blockSize">): [number, number][] {
  const out: [number, number][] = [];
  const size = Math.max(1, Math.min(5, Math.round(s.blockSize)));
  for (let y = s.startYear; y <= s.endYear; y += size) out.push([y, Math.min(s.endYear, y + size - 1)]);
  return out;
}

export function blockYears(run: RunState): [number, number] {
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

export function createRun(settings: RunSettings, names: [string, string]): RunState {
  const ai = settings.mode === "ai";
  return {
    ...settings,
    v: 1,
    id: crypto.randomUUID(),
    seed: randomSeed(),
    created: Date.now(),
    block: 0,
    phase: "opening",
    me: 0,
    players: [newPlayer(names[0], "human", true), newPlayer(names[1], ai ? "ai" : "human", ai)],
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
  if (!run || run.v !== 1 || !Array.isArray(run.players) || run.players.length !== 2) {
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
