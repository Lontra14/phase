// Auto-build a 40-card Limited deck from a collection (same idea as the Rogue
// Forge deck viewer's ⚡ Auto-build): best two colours, ~23 spells shaped to a
// curve, 17 lands topped up with basics in proportion to colour pips.
// The AI uses it every block; players can use it as a starting point.

import type { ProgCard, ProgData, Rarity } from "./data";
import { colorsOf, isLandCard } from "./data";
import type { Basic, Basics, Owned } from "./run";
import { emptyBasics } from "./run";

const BASIC_FOR: Record<string, Basic> = { W: "Plains", U: "Island", B: "Swamp", R: "Mountain", G: "Forest" };
const RARITY_SCORE: Record<Rarity, number> = { c: 1, u: 1.6, r: 2.4, m: 2.8, s: 2, b: 2 };
const CURVE: Record<number, number> = { 1: 3, 2: 6, 3: 5, 4: 4, 5: 3, 6: 2 };

interface Entry {
  i: number;
  card: ProgCard | null;
  rarity: Rarity;
}

function score(e: Entry): number {
  if (!e.card) return 0.5;
  let s = RARITY_SCORE[e.rarity] ?? 1;
  if (/Creature/.test(e.card.type)) s += 0.6;
  if (/Instant|Sorcery/.test(e.card.type)) s += 0.3;
  if (e.card.cmc >= 7) s -= 0.8;
  if (colorsOf(e.card).length > 2) s -= 0.6;
  return s;
}

export interface BuiltDeck {
  main: number[];
  basics: Basics;
  colors: string[];
}

export function autoBuild(pool: Owned[], data: ProgData): BuiltDeck {
  const entries: Entry[] = pool.map((o, i) => {
    const p = data.byKey.get(o.k);
    return { i, card: p?.card ?? null, rarity: p?.rarity ?? "c" };
  });
  const weight: Record<string, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 };
  for (const e of entries) {
    if (!e.card || isLandCard(e.card)) continue;
    for (const c of colorsOf(e.card)) weight[c] += score(e);
  }
  const ranked = Object.keys(weight).filter((k) => weight[k] > 0).sort((a, b) => weight[b] - weight[a]);
  const chosen: string[] = [];
  if (ranked.length) {
    chosen.push(ranked[0]);
    if (ranked[1] && weight[ranked[1]] >= weight[ranked[0]] * 0.3) chosen.push(ranked[1]);
  }
  const inColor = (card: ProgCard | null) => !card || colorsOf(card).every((c) => chosen.includes(c));

  const spells: Entry[] = [];
  const lands: Entry[] = [];
  for (const e of entries) {
    if (!inColor(e.card)) continue;
    if (e.card && isLandCard(e.card)) {
      // Nonbasic lands: keep the ones that make (or are identity-tied to) our colours.
      const id = e.card.identity.split("").filter((c) => "WUBRG".includes(c));
      if (!id.length || id.some((c) => chosen.includes(c))) lands.push(e);
    } else spells.push(e);
  }
  const LANDS = 17;
  const SPELLS = 23;
  const bucketOf = (e: Entry) => {
    const m = Math.round(e.card?.cmc ?? 3);
    return m <= 1 ? 1 : m >= 6 ? 6 : m;
  };
  const byBucket: Record<number, Entry[]> = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
  for (const e of spells) byBucket[bucketOf(e)].push(e);
  const mainSpells: Entry[] = [];
  const leftovers: Entry[] = [];
  for (const b of [1, 2, 3, 4, 5, 6]) {
    const arr = byBucket[b].sort((x, y) => score(y) - score(x));
    arr.forEach((e, idx) => (idx < CURVE[b] ? mainSpells : leftovers).push(e));
  }
  leftovers.sort((x, y) => score(y) - score(x));
  while (mainSpells.length < SPELLS && leftovers.length) mainSpells.push(leftovers.shift()!);
  while (mainSpells.length > SPELLS) mainSpells.pop();

  const mainLands = lands.slice(0, Math.min(lands.length, 4));
  const need = Math.max(0, LANDS - mainLands.length);
  const pips: Record<string, number> = {};
  for (const c of chosen) pips[c] = 0;
  for (const e of mainSpells) {
    const cost = e.card?.cost ?? "";
    for (const c of chosen) pips[c] += (cost.match(new RegExp(`\\{${c}`, "g")) ?? []).length || (e.card && colorsOf(e.card).includes(c) ? 1 : 0);
  }
  const basics = emptyBasics();
  const total = chosen.reduce((t, c) => t + pips[c], 0);
  if (chosen.length) {
    let assigned = 0;
    for (const c of chosen) {
      const n = total > 0 ? Math.round((need * pips[c]) / total) : Math.round(need / chosen.length);
      basics[BASIC_FOR[c]] = n;
      assigned += n;
    }
    basics[BASIC_FOR[chosen[0]]] = Math.max(0, basics[BASIC_FOR[chosen[0]]] + (need - assigned));
  } else {
    basics.Plains = need;
  }
  // Never below 40: thin pools are topped up with basics of the main colour.
  const main = [...mainSpells, ...mainLands].map((e) => e.i).sort((a, b) => a - b);
  const basicCount = Object.values(basics).reduce((t, n) => t + n, 0);
  if (main.length + basicCount < 40) basics[chosen.length ? BASIC_FOR[chosen[0]] : "Plains"] += 40 - main.length - basicCount;
  return { main, basics, colors: chosen };
}

/** AI pick among reward choices: on-colour, rarest-looking, mid-curve first. */
export function aiPick(choices: string[], data: ProgData, colors: string[]): string {
  let best = choices[0];
  let bestScore = -Infinity;
  for (const key of choices) {
    const p = data.byKey.get(key);
    if (!p) continue;
    const cols = colorsOf(p.card);
    let s = score({ i: 0, card: p.card, rarity: p.rarity });
    if (cols.length && cols.every((c) => colors.includes(c))) s += 1.5;
    if (!cols.length) s += 0.7;
    if (isLandCard(p.card)) s -= 0.5;
    if (s > bestScore) {
      bestScore = s;
      best = key;
    }
  }
  return best;
}
