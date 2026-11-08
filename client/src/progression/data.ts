// Progression card index: every booster printing (with rarity and release
// year) plus The List, generated at build time by scripts/gen-progression-data.sh.

import { getSharedAdapter } from "../adapter/wasm-adapter";

export type Rarity = "c" | "u" | "r" | "m" | "s" | "b";
export const RARITY_ORDER: Rarity[] = ["m", "r", "u", "c", "s", "b"];
export const RARITY_LABEL: Record<Rarity, string> = {
  c: "Common",
  u: "Uncommon",
  r: "Rare",
  m: "Mythic",
  s: "Special",
  b: "Bonus",
};
export const RARITY_COLOR: Record<Rarity, string> = {
  c: "#c9c3b4",
  u: "#a9c4d6",
  r: "#e2bf62",
  m: "#e5672d",
  s: "#b77be0",
  b: "#5fc7b3",
};

export interface ProgSet {
  idx: number;
  code: string;
  name: string;
  released: string;
  year: number;
  type: string;
}

export interface ProgCard {
  idx: number;
  name: string;
  type: string;
  cmc: number;
  colors: string;
  cost: string;
  identity: string;
  /** Chess mode: rules fields the minigame turns into effects (absent in older indexes). */
  chess?: ChessInfo;
}

export interface ChessFace {
  name: string;
  type: string;
  power: number;
  toughness: number;
  loyalty: number;
  colors: string;
  /** 1 keyword · 2 triggered · 4 activated · 8 double-faced */
  flags: number;
}
export interface ChessInfo {
  power: number;
  toughness: number;
  loyalty: number;
  flags: number;
  keywords: string;
  back: ChessFace | null;
}

export interface ProgPrint {
  /** Stable id used in save codes: `set:collector_number` (`plst:…` for The List). */
  key: string;
  card: ProgCard;
  set: ProgSet | null;
  cn: string;
  rarity: Rarity;
  id: string;
  /** Collector-booster-only printing (showcase, borderless, extended art). */
  variant?: boolean;
}

export interface ProgData {
  generated: string;
  sets: ProgSet[];
  cards: ProgCard[];
  prints: ProgPrint[];
  list: ProgPrint[];
  byKey: Map<string, ProgPrint>;
  byName: Map<string, ProgPrint[]>;
  printsBySet: Map<number, ProgPrint[]>;
  /** Collector-booster variants by set (kept out of the regular booster pools). */
  variantsBySet: Map<number, ProgPrint[]>;
  /** Basic lands of each set (Chess mode boosters). */
  basicsBySet: Map<number, ProgPrint[]>;
  firstYear: number;
  lastYear: number;
}

type RawChess = [string, string, string, number, string, 0 | [string, string, string, string, string, number, string]];
const numOf = (v: string | number | undefined): number => {
  const m = /\d+/.exec(String(v ?? ""));
  return m ? Number(m[0]) : 0;
};
function chessInfo(raw: RawChess | undefined): ChessInfo | undefined {
  if (!raw) return undefined;
  const [p, t, l, flags, keywords, back] = raw;
  return {
    power: numOf(p),
    toughness: numOf(t),
    loyalty: numOf(l),
    flags,
    keywords,
    back: back ? { name: back[0], type: back[1], power: numOf(back[2]), toughness: numOf(back[3]), colors: back[4], flags: back[5], loyalty: numOf(back[6]) } : null,
  };
}

interface RawData {
  v: number;
  generated: string;
  sets: [string, string, string, string][];
  cards: [string, string, number, string, string, string, RawChess?][];
  prints: [number, number, string, string, string, number?][];
  list: [number, string, string, string?][];
  basics?: [number, string, string, number][];
}

let dataPromise: Promise<ProgData> | null = null;

export function loadProgressionData(): Promise<ProgData> {
  if (!dataPromise) {
    dataPromise = fetch("/progression-data.json")
      .then((res) => {
        if (!res.ok) throw new Error(`progression-data.json: HTTP ${res.status}`);
        return res.json() as Promise<RawData>;
      })
      .then(buildData)
      .catch((err: unknown) => {
        dataPromise = null;
        throw err;
      });
  }
  return dataPromise;
}

function buildData(raw: RawData): ProgData {
  const sets: ProgSet[] = raw.sets.map(([code, name, released, type], idx) => ({
    idx,
    code,
    name,
    released,
    year: Number(released.slice(0, 4)) || 0,
    type,
  }));
  const cards: ProgCard[] = raw.cards.map(([name, type, cmc, colors, cost, identity, chess], idx) => ({
    idx,
    name,
    type,
    cmc,
    colors,
    cost,
    identity,
    chess: chessInfo(chess),
  }));
  const byKey = new Map<string, ProgPrint>();
  const byName = new Map<string, ProgPrint[]>();
  const printsBySet = new Map<number, ProgPrint[]>();
  const index = (p: ProgPrint) => {
    byKey.set(p.key, p);
    const named = byName.get(p.card.name);
    if (named) named.push(p);
    else byName.set(p.card.name, [p]);
  };
  const variantsBySet = new Map<number, ProgPrint[]>();
  const prints: ProgPrint[] = [];
  for (const [ci, si, cn, r, id, variant] of raw.prints) {
    const set = sets[si];
    const p: ProgPrint = { key: `${set.code}:${cn}`, card: cards[ci], set, cn, rarity: r as Rarity, id };
    if (variant) {
      // Only reachable from collector boosters; saved pools still resolve them by key.
      p.variant = true;
      byKey.set(p.key, p);
      const vb = variantsBySet.get(si);
      if (vb) vb.push(p);
      else variantsBySet.set(si, [p]);
      continue;
    }
    index(p);
    prints.push(p);
    const bucket = printsBySet.get(si);
    if (bucket) bucket.push(p);
    else printsBySet.set(si, [p]);
  }
  // The List reprints keep a real rarity: the one on the List printing when the
  // index carries it, otherwise the card's usual booster rarity.
  const list: ProgPrint[] = raw.list.map(([ci, cn, id, r]) => {
    const card = cards[ci];
    const p: ProgPrint = { key: `plst:${cn}`, card, set: null, cn, rarity: "r", id };
    p.rarity = isMainRarity(r) ? r : usualRarity(byName.get(card.name));
    byKey.set(p.key, p);
    return p;
  });
  const basicsBySet = new Map<number, ProgPrint[]>();
  for (const [si, cn, id, ci] of raw.basics ?? []) {
    const set = sets[si];
    if (!set || !cards[ci]) continue;
    const p: ProgPrint = { key: `${set.code}:${cn}`, card: cards[ci], set, cn, rarity: "c", id };
    byKey.set(p.key, p);
    const b = basicsBySet.get(si);
    if (b) b.push(p);
    else basicsBySet.set(si, [p]);
  }
  const years = sets.map((s) => s.year).filter((y) => y > 0);
  return {
    generated: raw.generated,
    sets,
    cards,
    prints,
    list,
    byKey,
    byName,
    printsBySet,
    variantsBySet,
    basicsBySet,
    firstYear: years.length ? Math.min(...years) : 1993,
    lastYear: years.length ? Math.max(...years) : new Date().getFullYear(),
  };
}

/** The four rarities the wheel and the rewards use. */
export const MAIN_RARITIES: Rarity[] = ["c", "u", "r", "m"];

export function isMainRarity(r: string | undefined | null): r is Rarity {
  return r === "c" || r === "u" || r === "r" || r === "m";
}

/** Most frequent common/uncommon/rare/mythic among a card's printings ("r" if none). */
export function usualRarity(prints: readonly ProgPrint[] | undefined): Rarity {
  const counts: Partial<Record<Rarity, number>> = {};
  for (const p of prints ?? []) if (isMainRarity(p.rarity)) counts[p.rarity] = (counts[p.rarity] ?? 0) + 1;
  let best: Rarity = "r";
  let n = 0;
  for (const r of MAIN_RARITIES) {
    if ((counts[r] ?? 0) > n) {
      n = counts[r] ?? 0;
      best = r;
    }
  }
  return best;
}

/** Rarity a printing counts as on the wheel: special/bonus sheets use the card's usual rarity. */
export function wheelRarity(data: ProgData, print: ProgPrint | undefined): Rarity {
  if (!print) return "c";
  return isMainRarity(print.rarity) ? print.rarity : usualRarity(data.byName.get(print.card.name));
}

/** Scryfall CDN image for a printing (front face). */
export function printImage(
  print: Pick<ProgPrint, "id"> | null | undefined,
  size: "small" | "normal" | "large" | "art_crop" = "normal",
  face: "front" | "back" = "front",
): string {
  if (!print || print.id.length !== 32) return "";
  const h = print.id;
  const uuid = `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  return `https://cards.scryfall.io/${size}/${face}/${uuid[0]}/${uuid[1]}/${uuid}.jpg`;
}

/** Names with two faces ("A // B"). Split and adventure cards also match; their missing back image is detected on load. */
export function maybeDoubleFaced(name: string): boolean {
  return name.includes(" // ");
}

/** Booster sets released in [from, to] (inclusive years). */
export function setsInYears(data: ProgData, from: number, to: number): ProgSet[] {
  return data.sets.filter((s) => s.year >= from && s.year <= to && (data.printsBySet.get(s.idx)?.length ?? 0) > 0);
}

// ── Engine support ──────────────────────────────────────────────────────────
// Only cards the rules engine knows (and, by default, fully implements) go into
// packs and rewards. Answers are cached for the whole session.

interface SupportAnswer {
  canonical: string | null;
  full: boolean;
}

const supportCache = new Map<string, SupportAnswer>();

interface CompatResult {
  unknown_cards?: string[];
  coverage?: { unsupported_cards?: { name: string }[] } | null;
}

export async function resolveSupport(names: readonly string[]): Promise<void> {
  const todo = [...new Set(names)].filter((n) => !supportCache.has(n));
  if (!todo.length) return;
  const adapter = getSharedAdapter();
  const CHUNK = 1500;
  for (let i = 0; i < todo.length; i += CHUNK) {
    const chunk = todo.slice(i, i + CHUNK);
    const canon = await adapter.canonicalCardNames(chunk);
    const known = [...new Set(canon.filter((c): c is string => Boolean(c)))];
    const unsupported = new Set<string>();
    if (known.length) {
      try {
        const res = (await adapter.checkDeckCompatibility({
          main_deck: known,
          sideboard: [],
          commander: [],
          planar_deck: [],
          scheme_deck: [],
          signature_spell: [],
          companion: [],
          draft_set_codes: [],
          selected_format: null,
          selected_match_type: null,
          player_count: 2,
          summary_only: false,
        })) as CompatResult;
        for (const card of res.coverage?.unsupported_cards ?? []) unsupported.add(card.name);
        for (const name of res.unknown_cards ?? []) unsupported.add(name);
      } catch (err) {
        console.warn("[progression] coverage check failed; treating known cards as supported", err);
      }
    }
    chunk.forEach((name, j) => {
      const c = canon[j] ?? null;
      supportCache.set(name, { canonical: c, full: c !== null && !unsupported.has(c) });
    });
  }
}

/** Engine name for a card, or null when it cannot be played here. Call resolveSupport first. */
export function playableName(name: string, allowPartial: boolean): string | null {
  const a = supportCache.get(name);
  if (!a || !a.canonical) return null;
  return a.full || allowPartial ? a.canonical : null;
}

export function isPlayable(print: ProgPrint, allowPartial: boolean): boolean {
  return playableName(print.card.name, allowPartial) !== null;
}

// ── Card helpers used by the deck builder and the AI ────────────────────────

export function isLandCard(card: ProgCard): boolean {
  return /\bLand\b/.test(card.type.split("//")[0]);
}

export function colorsOf(card: ProgCard): string[] {
  return card.colors.split("").filter((c) => "WUBRG".includes(c));
}

// ── Cards by name outside the booster index (meta decks, precons) ─────────────

const frontIndex = new WeakMap<ProgData, Map<string, ProgPrint>>();
/**
 * The index printing of a card named in a decklist: exact name, else the front face
 * of a double-faced / split / adventure card ("Fable of the Mirror-Breaker"), else a
 * basic land of any set (snow-covered too). Undefined when the index lacks it.
 */
export function findPrintByName(data: ProgData, name: string): ProgPrint | undefined {
  const exact = data.byName.get(name)?.[0];
  if (exact) return exact;
  let idx = frontIndex.get(data);
  if (!idx) {
    idx = new Map();
    for (const [full, prints] of data.byName) {
      if (!full.includes(" // ")) continue;
      for (const part of full.split(" // ")) if (!idx.has(part.toLowerCase())) idx.set(part.toLowerCase(), prints[0]);
    }
    for (const prints of data.basicsBySet.values()) for (const p of prints) if (!idx.has(p.card.name.toLowerCase())) idx.set(p.card.name.toLowerCase(), p);
    frontIndex.set(data, idx);
  }
  const key = name.toLowerCase();
  return idx.get(key) ?? idx.get(key.split(" // ")[0]);
}

/** Cards no booster index has (Commander-only cards, Secret Lair…): looked up on Scryfall once, kept in localStorage. */
const EXTRA_KEY = "rogue-forge-extra-cards";
type ExtraRow = [string, string, number, string, string]; // name, type, cmc, colors, scryfall id (hex)
let extraCache: Map<string, ExtraRow> | null = null;
const extraPrints = new Map<string, ProgPrint>();
function extras(): Map<string, ExtraRow> {
  if (!extraCache) {
    extraCache = new Map();
    try {
      const rows = JSON.parse(localStorage.getItem(EXTRA_KEY) ?? "[]") as [string, ExtraRow][];
      for (const [k, r] of rows) extraCache.set(k, r);
    } catch {
      // ignore
    }
  }
  return extraCache;
}
/** A stand-in printing for a card the index lacks (after ensureExtraCards), else null. */
export function extraPrint(name: string): ProgPrint | null {
  const r = extras().get(name.toLowerCase());
  if (!r) return null;
  let p = extraPrints.get(r[0]);
  if (!p) {
    const card: ProgCard = { idx: -1, name: r[0], type: r[1], cmc: r[2], colors: r[3], cost: "", identity: r[3] };
    p = { key: `name:${name}`, card, set: null, cn: "", rarity: "r", id: r[4] };
    extraPrints.set(r[0], p);
  }
  return p;
}
const extraAsked = new Set<string>();
/** Look the given names up on Scryfall (75 per request). Resolves true when something new arrived. */
export async function ensureExtraCards(names: readonly string[]): Promise<boolean> {
  const todo = [...new Set(names)].filter((n) => !extras().has(n.toLowerCase()) && !extraAsked.has(n.toLowerCase()));
  if (!todo.length) return false;
  for (const n of todo) extraAsked.add(n.toLowerCase());
  let got = false;
  for (let i = 0; i < todo.length; i += 75) {
    const chunk = todo.slice(i, i + 75);
    try {
      const res = await fetch("https://api.scryfall.com/cards/collection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifiers: chunk.map((name) => ({ name: name.split(" // ")[0] })) }),
      });
      if (!res.ok) continue;
      const body = (await res.json()) as { data?: { name: string; type_line?: string; cmc?: number; colors?: string[]; card_faces?: { colors?: string[]; type_line?: string }[]; id: string }[] };
      for (const c of body.data ?? []) {
        const row: ExtraRow = [
          c.name,
          c.type_line ?? c.card_faces?.map((f) => f.type_line ?? "").join(" // ") ?? "",
          c.cmc ?? 0,
          (c.colors ?? c.card_faces?.[0]?.colors ?? []).join(""),
          c.id.replace(/-/g, ""),
        ];
        const keys = new Set([c.name.toLowerCase(), c.name.split(" // ")[0].toLowerCase()]);
        for (const n of chunk) if (keys.has(n.toLowerCase()) || keys.has(n.split(" // ")[0].toLowerCase())) keys.add(n.toLowerCase());
        for (const k of keys) extras().set(k, row);
        got = true;
      }
    } catch {
      // offline: the card keeps its name-only tile
    }
  }
  if (got) {
    try {
      localStorage.setItem(EXTRA_KEY, JSON.stringify([...extras()].slice(-3000)));
    } catch {
      // storage full
    }
  }
  return got;
}

/** The engine's answer for a card name (call resolveSupport first): canonical null = unknown to the engine. */
export function supportOf(name: string): { canonical: string | null; full: boolean } | null {
  return supportCache.get(name) ?? null;
}

const released = (p: ProgPrint) => p.set?.released ?? "";
/**
 * The printing of a decklist card: the exact one when the list names set and
 * collector number, else the newest printing in the index (regular printings
 * before collector-only variants), basic lands included.
 */
export function newestPrintByName(data: ProgData, name: string, setCode?: string, cn?: string): ProgPrint | undefined {
  if (setCode) {
    const set = setCode.toLowerCase();
    if (cn) {
      const lower = name.toLowerCase();
      const same = (p: ProgPrint | undefined) => !!p && (p.card.name.toLowerCase() === lower || p.card.name.toLowerCase().split(" // ").includes(lower));
      // `sd:` keys: the precons' own printings (starter-decks.json).
      const exact = [data.byKey.get(`${set}:${cn}`), data.byKey.get(`${set}:${cn.replace(/^0+/, "")}`), data.byKey.get(`sd:${set}:${cn}`)].find(same);
      if (exact) return exact;
    }
  }
  let cands = data.byName.get(name);
  if (!cands?.length) {
    const viaFront = findPrintByName(data, name);
    if (viaFront) cands = data.byName.get(viaFront.card.name) ?? [viaFront];
  }
  const basics: ProgPrint[] = [];
  if (!cands?.length || /^(Snow-Covered )?(Plains|Island|Swamp|Mountain|Forest|Wastes)$/i.test(name)) {
    for (const prints of data.basicsBySet.values()) for (const p of prints) if (p.card.name.toLowerCase() === name.toLowerCase()) basics.push(p);
  }
  const all = [...(cands ?? []), ...basics];
  if (!all.length) return undefined;
  if (setCode) {
    const inSet = all.filter((p) => p.set?.code.toLowerCase() === setCode.toLowerCase());
    if (inSet.length) return inSet.sort((a, b) => Number(!!a.variant) - Number(!!b.variant))[0];
  }
  return all.slice().sort((a, b) => Number(!!a.variant) - Number(!!b.variant) || released(b).localeCompare(released(a)))[0];
}
