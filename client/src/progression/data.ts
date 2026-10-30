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
}

export interface ProgPrint {
  /** Stable id used in save codes: `set:collector_number` (`plst:…` for The List). */
  key: string;
  card: ProgCard;
  set: ProgSet | null;
  cn: string;
  rarity: Rarity;
  id: string;
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
  firstYear: number;
  lastYear: number;
}

interface RawData {
  v: number;
  generated: string;
  sets: [string, string, string, string][];
  cards: [string, string, number, string, string, string][];
  prints: [number, number, string, string, string][];
  list: [number, string, string][];
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
  const cards: ProgCard[] = raw.cards.map(([name, type, cmc, colors, cost, identity], idx) => ({
    idx,
    name,
    type,
    cmc,
    colors,
    cost,
    identity,
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
  const prints: ProgPrint[] = raw.prints.map(([ci, si, cn, r, id]) => {
    const set = sets[si];
    const p: ProgPrint = { key: `${set.code}:${cn}`, card: cards[ci], set, cn, rarity: r as Rarity, id };
    index(p);
    const bucket = printsBySet.get(si);
    if (bucket) bucket.push(p);
    else printsBySet.set(si, [p]);
    return p;
  });
  const list: ProgPrint[] = raw.list.map(([ci, cn, id]) => {
    const p: ProgPrint = { key: `plst:${cn}`, card: cards[ci], set: null, cn, rarity: "s", id };
    byKey.set(p.key, p);
    return p;
  });
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
    firstYear: years.length ? Math.min(...years) : 1993,
    lastYear: years.length ? Math.max(...years) : new Date().getFullYear(),
  };
}

/** Scryfall CDN image for a printing (front face). */
export function printImage(print: Pick<ProgPrint, "id"> | null | undefined, size: "small" | "normal" | "large" | "art_crop" = "normal"): string {
  if (!print || print.id.length !== 32) return "";
  const h = print.id;
  const uuid = `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  return `https://cards.scryfall.io/${size}/front/${uuid[0]}/${uuid[1]}/${uuid}.jpg`;
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
