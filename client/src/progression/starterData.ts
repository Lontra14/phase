// Starter mode: the precon index (scripts/gen-starter-decks.mjs): 60-card
// precons and the official Commander precons (commander rows apart).
// Deck cards keep their exact printing; they are registered in the Progression
// index under `sd:<set>:<number>` keys so the deck builder, wheel and art pins
// treat them like any other owned card.

import type { ProgCard, ProgData, ProgPrint, ProgSet, Rarity } from "./data";
import { colorsOf, isLandCard, isMainRarity, usualRarity } from "./data";
import type { Owned } from "./run";

type RawCard = [string, number, string, string, string, string, string, number, string, string, string];

export interface StarterDeck {
  id: string;
  code: string;
  name: string;
  type: string;
  date: string;
  year: number;
  /** One entry per printing: key into data.byKey + copies. */
  cards: { key: string; count: number }[];
  colors: string[];
  /** Printing shown as the deck's picture (its signature card). */
  face: ProgPrint | null;
  /** A list the player imported (deckImport.ts): its cards as owned copies (keys may be `name:` for cards outside the index). */
  custom?: boolean;
  owned?: Owned[];
  /** Commander decks (official precons and imported lists): the commander(s). */
  commanders?: string[];
  /** Commander precons: the printing of each commander (its art in the match). */
  commanderKeys?: string[];
  commanderFormat?: "Commander";
  /** Imported lists: cards the rules engine only partly implements. */
  partial?: string[];
}

interface RawFile {
  v: number;
  decks: { id: string; code: string; name: string; type: string; date: string; cards: RawCard[]; commander?: RawCard[] }[];
}

let decksPromise: Promise<StarterDeck[]> | null = null;

export function loadStarterDecks(data: ProgData): Promise<StarterDeck[]> {
  if (!decksPromise) {
    decksPromise = fetch("/starter-decks.json")
      .then((res) => {
        if (!res.ok) throw new Error(`starter-decks.json: HTTP ${res.status}`);
        return res.json() as Promise<RawFile>;
      })
      .then((raw) => raw.decks.map((d) => buildDeck(data, d)))
      .catch((err: unknown) => {
        decksPromise = null;
        throw err;
      });
  }
  return decksPromise;
}

const setIndex = new WeakMap<ProgData, Map<string, ProgSet>>();
const cardIndex = new WeakMap<ProgData, Map<string, ProgCard>>();

function setFor(data: ProgData, code: string, date: string): ProgSet {
  let idx = setIndex.get(data);
  if (!idx) {
    idx = new Map(data.sets.map((s) => [s.code, s] as [string, ProgSet]));
    setIndex.set(data, idx);
  }
  const known = idx.get(code);
  if (known) return known;
  const set: ProgSet = { idx: data.sets.length, code, name: code.toUpperCase(), released: date, year: Number(date.slice(0, 4)) || 0, type: "starter" };
  data.sets.push(set);
  idx.set(code, set);
  return set;
}

function cardFor(data: ProgData, raw: RawCard): ProgCard {
  let idx = cardIndex.get(data);
  if (!idx) {
    idx = new Map(data.cards.map((c) => [c.name, c] as [string, ProgCard]));
    cardIndex.set(data, idx);
  }
  const known = idx.get(raw[0]);
  if (known) return known;
  const card: ProgCard = { idx: data.cards.length, name: raw[0], type: raw[6], cmc: raw[7], colors: raw[8], cost: raw[9], identity: raw[10] };
  data.cards.push(card);
  idx.set(card.name, card);
  return card;
}

function printFor(data: ProgData, raw: RawCard, date: string): ProgPrint {
  const [, , setCode, number, id, rarity] = raw;
  const key = `sd:${setCode}:${number}`;
  let print = data.byKey.get(key);
  if (!print) {
    const card = cardFor(data, raw);
    const r: Rarity = isMainRarity(rarity) ? rarity : usualRarity(data.byName.get(card.name));
    // A card with no Scryfall id in the list: the art of another printing of it.
    print = { key, card, set: setFor(data, setCode, date), cn: number, rarity: r, id: id || data.byName.get(card.name)?.[0]?.id || "" };
    data.byKey.set(key, print);
  }
  return print;
}

function buildDeck(data: ProgData, d: RawFile["decks"][number]): StarterDeck {
  const cards: { key: string; count: number }[] = [];
  const prints: ProgPrint[] = [];
  for (const raw of d.cards) {
    const print = printFor(data, raw, d.date);
    prints.push(print);
    cards.push({ key: print.key, count: raw[1] });
  }
  // Commander precons: the commander(s) stay out of the deck (command zone).
  const commanders = (d.commander ?? []).map((raw) => printFor(data, raw, d.date));
  const colorCount: Record<string, number> = {};
  for (const p of prints) if (!isLandCard(p.card)) for (const c of colorsOf(p.card)) colorCount[c] = (colorCount[c] ?? 0) + 1;
  // A commander deck's colours are its commanders' colour identity.
  const identity = new Set(commanders.flatMap((p) => [...(p.card.identity || p.card.colors || "")]).filter((c) => "WUBRG".includes(c)));
  const colors = (commanders.length ? [...identity] : Object.keys(colorCount).filter((c) => colorCount[c] >= 2)).sort((a, b) => "WUBRG".indexOf(a) - "WUBRG".indexOf(b));
  const rank: Record<Rarity, number> = { m: 5, r: 4, s: 3, b: 3, u: 2, c: 1 };
  const face =
    commanders[0] ??
    prints
      .filter((p) => !isLandCard(p.card))
      .sort((a, b) => {
        const pw = (p: ProgPrint) => (/Planeswalker/.test(p.card.type) ? 2 : /Legendary/.test(p.card.type) ? 1 : 0);
        return rank[b.rarity] - rank[a.rarity] || pw(b) - pw(a) || b.card.cmc - a.card.cmc;
      })[0] ?? prints[0] ?? null;
  return {
    id: d.id,
    code: d.code,
    name: d.name,
    type: d.type,
    date: d.date,
    year: Number(d.date.slice(0, 4)) || 0,
    cards,
    colors,
    face,
    ...(commanders.length ? { commanders: commanders.map((p) => p.card.name), commanderKeys: commanders.map((p) => p.key), commanderFormat: "Commander" as const } : {}),
  };
}

/** The deck's 60 cards as owned copies (basic lands included). */
export function deckOwned(data: ProgData, deck: StarterDeck): Owned[] {
  if (deck.owned) return deck.owned.map((o) => ({ ...o }));
  const out: Owned[] = [];
  for (const c of deck.cards) {
    const print = data.byKey.get(c.key);
    if (!print) continue;
    for (let i = 0; i < c.count; i++) out.push({ k: c.key, n: print.card.name });
  }
  return out;
}

// ── "May not work" warnings, from phase.rs's own precon projection (decks.json).

let warningsPromise: Promise<Map<string, string[]>> | null = null;

export function loadDeckWarnings(): Promise<Map<string, string[]>> {
  if (!warningsPromise) {
    warningsPromise = fetch("/decks.json")
      .then((res): Promise<Record<string, { unsupported?: string[] }>> | Record<string, { unsupported?: string[] }> =>
        res.ok ? (res.json() as Promise<Record<string, { unsupported?: string[] }>>) : {},
      )
      .then((json) => new Map(Object.entries(json).map(([id, d]) => [id, d.unsupported ?? []] as [string, string[]])))
      .catch(() => new Map<string, string[]>());
  }
  return warningsPromise;
}
