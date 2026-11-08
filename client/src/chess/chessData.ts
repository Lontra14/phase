// Chess mode data: the boosters opened for the minigame (exact printings from the
// Progression index, 11 cards with the set's rarity ratio + a basic land of the set)
// turned into the minigame's card format, and the meta decks (phase.rs feeds).

import type { ProgData, ProgPrint, ProgSet } from "../progression/data";
import { isPlayable, printImage, resolveSupport } from "../progression/data";
import { getCardFaceData } from "../services/engineRuntime";
import type { Rng } from "../progression/rng";
import type { ChessBooster, ChessCard, ChessFace } from "./minigame";

const COLORS = ["W", "U", "B", "R", "G"];

function typesOf(t: string): ChessFace["types"] {
  const l = t.split("—")[0];
  const types = {
    creature: /Creature/.test(l),
    instant: /Instant/.test(l),
    sorcery: /Sorcery/.test(l),
    enchantment: /Enchantment|Battle|Plane\b|Dungeon/.test(l) || /\b(Room|Saga)\b/.test(t),
    artifact: /Artifact/.test(l),
    planeswalker: /Planeswalker/.test(l),
    land: /Land/.test(l),
    basic: /Basic/.test(l),
  };
  // Nonbasic lands play as enchantments.
  if (types.land && !types.basic) {
    types.land = false;
    types.enchantment = true;
  }
  return types;
}
const colorsOf = (s: string): string[] => s.split("").filter((c) => COLORS.includes(c));

/** A printing in the minigame's card format. */
export function toChessCard(print: ProgPrint, extra: { foil?: boolean; alt?: boolean } = {}): ChessCard {
  const card = print.card;
  const ch = card.chess;
  const flags = ch?.flags ?? 0;
  const dfc = Boolean(flags & 8 && ch?.back);
  const parts = card.type.split(" // ");
  const frontType = parts[0] ?? card.type;
  const types = typesOf(frontType);
  if (!dfc) {
    // Adventure / split / flip cards count as every half.
    for (const p of parts.slice(1)) {
      const t = typesOf(p);
      for (const k of Object.keys(t) as (keyof ChessFace["types"])[]) if (t[k] && k !== "land" && k !== "basic") types[k] = true;
    }
  }
  const front: ChessFace = {
    name: dfc ? card.name.split(" // ")[0] : card.name,
    img: printImage(print, "normal"),
    type: frontType,
    types,
    colors: colorsOf(card.colors),
    power: ch?.power ?? 0,
    toughness: ch?.toughness ?? 0,
    loyalty: ch?.loyalty ?? 0,
    kw: Boolean(flags & 1) && Boolean(types.creature),
    trig: Boolean(flags & 2),
    act: Boolean(flags & 4) || Boolean(types.planeswalker),
    legendary: /Legendary/.test(frontType),
    kwList: ch?.keywords ? ch.keywords.split(", ").filter(Boolean) : [],
  };
  const faces: ChessFace[] = [front];
  if (dfc && ch?.back) {
    const b = ch.back;
    const bt = typesOf(b.type);
    faces.push({
      name: b.name,
      img: printImage(print, "normal", "back"),
      type: b.type,
      types: bt,
      colors: colorsOf(b.colors).length ? colorsOf(b.colors) : front.colors,
      power: b.power,
      toughness: b.toughness,
      loyalty: b.loyalty,
      kw: Boolean(b.flags & 1) && Boolean(bt.creature),
      trig: Boolean(b.flags & 2),
      act: Boolean(b.flags & 4) || Boolean(bt.planeswalker),
      legendary: /Legendary/.test(b.type),
      kwList: [],
    });
  }
  // Creatures / planeswalkers without numbers (index built without the Chess fields,
  // or "*" values): never 0 health — the engine's card data fills them in later
  // (enrichChessCards); until then the mana value stands in.
  for (const f of faces) {
    if (f.types.creature && f.toughness <= 0) f.toughness = Math.max(1, card.cmc);
    if (f.types.creature && f.power <= 0 && !ch) f.power = Math.max(1, card.cmc);
    if (f.types.planeswalker && f.loyalty <= 0) f.loyalty = Math.max(1, card.cmc);
  }
  const r = print.rarity === "c" || print.rarity === "u" || print.rarity === "m" ? print.rarity : "r";
  const out: ChessCard & { needsData?: boolean } = { key: print.key, name: card.name, rarity: r, cmc: card.cmc, faces, dfc, alt: Boolean(extra.alt ?? print.variant), foil: Boolean(extra.foil) };
  if (!ch && (types.creature || types.planeswalker || /Creature|Planeswalker/.test(card.type))) out.needsData = true;
  return out;
}

interface EngineFace {
  power?: unknown;
  toughness?: unknown;
  loyalty?: unknown;
  keywords?: unknown[];
  triggers?: unknown[];
  abilities?: { kind?: string; cost?: unknown }[];
}
const ptNum = (v: unknown): number | null => {
  if (typeof v === "number") return v;
  if (typeof v === "string") return /^-?\d+$/.test(v) ? Number(v) : null;
  if (v && typeof v === "object") {
    const o = v as { value?: unknown; Fixed?: unknown; type?: string };
    if (typeof o.Fixed === "number") return o.Fixed;
    if ((o.type === undefined || o.type === "Fixed") && typeof o.value === "number") return o.value;
  }
  return null;
};
const kwName = (k: unknown): string => (typeof k === "string" ? k : k && typeof k === "object" ? Object.keys(k as object)[0] ?? "" : "");

/**
 * Fill in power / toughness / loyalty / keywords / abilities from the rules engine's
 * card data for cards the index has no Chess fields for. Never throws.
 */
export async function enrichChessCards(boosters: ChessBooster[]): Promise<void> {
  const todo = boosters.flatMap((b) => b.cards).filter((c) => (c as ChessCard & { needsData?: boolean }).needsData);
  await Promise.all(
    todo.map(async (c) => {
      const f = c.faces[0];
      try {
        const e = (await getCardFaceData(f.name.split(" // ")[0])) as EngineFace | null;
        if (!e) return;
        const p = ptNum(e.power);
        const t = ptNum(e.toughness);
        const l = ptNum(e.loyalty);
        if (p !== null) f.power = Math.max(0, p);
        if (t !== null) f.toughness = t > 0 ? t : Math.max(1, c.cmc);
        if (l !== null && l > 0) f.loyalty = l;
        const kws = (e.keywords ?? []).map(kwName).filter(Boolean);
        f.kw = kws.length > 0 && Boolean(f.types.creature);
        f.kwList = kws;
        f.trig = (e.triggers?.length ?? 0) > 0;
        f.act = (e.abilities ?? []).some((a) => a.kind === "Activated") || Boolean(f.types.planeswalker);
      } catch {
        // keep the stand-in numbers
      }
    }),
  );
}

/** Sets a Chess booster can come from (enough playable printings). */
export function chessSets(data: ProgData): ProgSet[] {
  return data.sets.filter((s) => (data.printsBySet.get(s.idx)?.length ?? 0) >= 40).slice().reverse();
}

function playablePools(data: ProgData, set: ProgSet): Record<"c" | "u" | "r" | "m", ProgPrint[]> {
  const pools = { c: [] as ProgPrint[], u: [] as ProgPrint[], r: [] as ProgPrint[], m: [] as ProgPrint[] };
  for (const p of data.printsBySet.get(set.idx) ?? []) {
    if (!isPlayable(p, false)) continue;
    const r = p.rarity === "s" || p.rarity === "b" ? "r" : p.rarity;
    pools[r].push(p);
  }
  return pools;
}

function basicFor(data: ProgData, set: ProgSet, rng: Rng): ProgPrint | null {
  const own = data.basicsBySet.get(set.idx);
  if (own?.length) return rng.pick(own);
  // Sets without basic lands: the closest earlier set that has some.
  for (let i = set.idx; i >= 0; i--) {
    const b = data.basicsBySet.get(i);
    if (b?.length) return rng.pick(b);
  }
  for (const b of data.basicsBySet.values()) if (b.length) return rng.pick(b);
  return null;
}

/** Ask the engine which cards of these sets it supports (boosters only hold playable cards). */
export function prepareSets(data: ProgData, sets: ProgSet[]): Promise<void> {
  const names: string[] = [];
  for (const s of sets) for (const p of data.printsBySet.get(s.idx) ?? []) names.push(p.card.name);
  return resolveSupport(names);
}

/**
 * One Chess booster: 11 cards with the set's rarity ratio (with a foil and the odd
 * alternate-art printing) and one basic land of the set. Deterministic for `rng`.
 */
export function openChessBooster(data: ProgData, set: ProgSet, rng: Rng): { booster: ChessBooster; prints: ProgPrint[] } {
  const pools = playablePools(data, set);
  const era = set.released >= "2024-02-01" ? "play" : set.released >= "2008-10-03" ? "mythic" : "old";
  type W = Partial<Record<"c" | "u" | "r" | "m", number>>;
  const slots: { w: W; foil?: boolean }[] =
    era === "play"
      ? [...Array.from({ length: 6 }, () => ({ w: { c: 1 } })), ...Array.from({ length: 3 }, () => ({ w: { u: 1 } })), { w: { r: 7, m: 1 } }, { w: { c: 50, u: 30, r: 15, m: 5 }, foil: true }]
      : era === "mythic"
        ? [...Array.from({ length: 7 }, () => ({ w: { c: 1 } })), ...Array.from({ length: 3 }, () => ({ w: { u: 1 } })), { w: { r: 7, m: 1 } }]
        : [...Array.from({ length: 7 }, () => ({ w: { c: 1 } })), ...Array.from({ length: 3 }, () => ({ w: { u: 1 } })), { w: { r: 1 } }];
  if (era !== "play" && rng.next() < 0.33) slots[0] = { w: { c: 60, u: 25, r: 12, m: 3 }, foil: true };
  const variants = new Map<string, ProgPrint[]>();
  for (const v of data.variantsBySet.get(set.idx) ?? []) {
    const arr = variants.get(v.card.name);
    if (arr) arr.push(v);
    else variants.set(v.card.name, [v]);
  }
  const used = new Set<string>();
  const cards: ChessCard[] = [];
  const prints: ProgPrint[] = [];
  for (const slot of slots) {
    const avail = (Object.keys(slot.w) as ("c" | "u" | "r" | "m")[]).filter((r) => pools[r].length);
    const fallback = (["c", "u", "r", "m"] as const).filter((r) => pools[r].length);
    const rs = avail.length ? avail : fallback;
    if (!rs.length) continue;
    const r = rs[rng.weighted(rs.map((x) => slot.w[x] ?? 1))];
    let p = rng.pick(pools[r]);
    for (let k = 0; k < 15 && used.has(p.card.name); k++) p = rng.pick(pools[r]);
    used.add(p.card.name);
    let alt = false;
    const vars = variants.get(p.card.name);
    if (vars?.length && rng.next() < (r === "c" ? 0.05 : 0.18)) {
      p = rng.pick(vars);
      alt = true;
    }
    prints.push(p);
    cards.push(toChessCard(p, { foil: slot.foil, alt }));
  }
  const rank = { c: 0, u: 1, r: 2, m: 3 };
  const order = cards.map((_, i) => i).sort((a, b) => rank[cards[a].rarity] - rank[cards[b].rarity]);
  const land = basicFor(data, set, rng);
  const landCard: ChessCard = land
    ? toChessCard(land)
    : { key: "basic:plains", name: "Plains", rarity: "c", cmc: 0, dfc: false, alt: false, foil: false, faces: [{ name: "Plains", img: "https://api.scryfall.com/cards/named?exact=Plains&format=image&version=normal", type: "Basic Land — Plains", types: { land: true, basic: true }, colors: [], power: 0, toughness: 0, loyalty: 0, kw: false, trig: false, act: false, legendary: false }] };
  return { booster: { cards: order.map((i) => cards[i]), land: landCard, setName: set.name }, prints: order.map((i) => prints[i]) };
}

// ── meta decks ────────────────────────────────────────────────────────────────
// Today's top decks (phase.rs feeds, MTGGoldfish) and the historical ones per year
// and format (public/meta-history.json, a static file added separately; missing = only today's decks).

export interface MetaDeck {
  id: string;
  /** Display format, e.g. "Standard", "Duel Commander". */
  format: string;
  name: string;
  colors: string[];
  cards: { name: string; count: number }[];
  size: number;
  source: "today" | "history";
  year?: number;
  period?: string;
  pct?: number;
  event?: string;
  player?: string;
  /** Commander decks: the commander(s) when the list says so. */
  commanders?: string[];
  /** Played with commander rules ("Commander" or "DuelCommander"). */
  commanderFormat?: "Commander" | "DuelCommander";
}

const TODAY_FEEDS: [string, string][] = [
  ["standard", "Standard"],
  ["pioneer", "Pioneer"],
  ["modern", "Modern"],
  ["legacy", "Legacy"],
  ["vintage", "Vintage"],
  ["pauper", "Pauper"],
  ["commander", "Commander"],
];
export const META_FORMATS = ["Standard", "Pioneer", "Modern", "Extended", "Legacy", "Vintage", "Pauper", "Premodern", "Commander", "Duel Commander", "cEDH"];

interface FeedFile {
  decks: { name: string; colors?: string[]; main: { count: number; name: string }[] }[];
}
interface HistoryFile {
  formats: Record<string, { name: string; metas: { id: string; label: string; year: number; decks: { archetype: string; pct: number; player: string; event: string; date: string; deck: string; main: [number, string][]; side: [number, string][] }[] }[] }>;
}

const COLOR_OF_BASIC: Record<string, string> = { Plains: "W", Island: "U", Swamp: "B", Mountain: "R", Forest: "G" };

let metaPromise: Promise<MetaDeck[]> | null = null;
export function loadMetaDecks(): Promise<MetaDeck[]> {
  if (!metaPromise) {
    const today = Promise.all(
      TODAY_FEEDS.map(([f, label]) =>
        fetch(`/feeds/mtggoldfish-${f}.json`)
          .then((r) => (r.ok ? (r.json() as Promise<FeedFile>) : null))
          .catch(() => null)
          .then((file): MetaDeck[] =>
            (file?.decks ?? []).map((d, i) => {
              const cards = d.main.filter((c) => c && c.name && c.count > 0);
              const commander = f === "commander" ? cards.find((c) => c.name === d.name)?.name : undefined;
              return {
                id: `${f}:${i}`,
                format: label,
                name: d.name,
                colors: d.colors ?? [],
                cards,
                size: cards.reduce((t, c) => t + c.count, 0),
                source: "today" as const,
                year: new Date().getFullYear(),
                period: "Today",
                ...(f === "commander" ? { commanderFormat: "Commander" as const, ...(commander ? { commanders: [commander] } : {}) } : {}),
              };
            }),
          ),
      ),
    ).then((l) => l.flat());
    const history = fetch("/meta-history.json")
      .then((r) => (r.ok ? (r.json() as Promise<HistoryFile>) : null))
      .catch(() => null)
      .then((file): MetaDeck[] => {
        const out: MetaDeck[] = [];
        for (const [code, f] of Object.entries(file?.formats ?? {})) {
          const isCmd = code === "EDH" || code === "cEDH";
          for (const m of f.metas) {
            m.decks.forEach((d, i) => {
              const sideTotal = d.side.reduce((t, [c]) => t + c, 0);
              const commanders = isCmd && sideTotal > 0 && sideTotal <= 2 ? d.side.map(([, n]) => n) : undefined;
              const cards = d.main.map(([count, name]) => ({ count, name }));
              const colors = [...new Set(cards.map((c) => COLOR_OF_BASIC[c.name]).filter(Boolean))];
              out.push({
                id: `h:${code}:${m.id}:${i}`,
                format: f.name,
                name: d.archetype,
                colors,
                cards,
                size: cards.reduce((t, c) => t + c.count, 0),
                source: "history",
                year: m.year,
                period: m.label,
                pct: d.pct,
                event: d.event,
                player: d.player,
                ...(isCmd ? { commanderFormat: code === "EDH" ? ("DuelCommander" as const) : ("Commander" as const), ...(commanders ? { commanders } : {}) } : {}),
              });
            });
          }
        }
        return out;
      });
    metaPromise = Promise.all([today, history]).then(([a, b]) => [...a, ...b]);
  }
  return metaPromise;
}
