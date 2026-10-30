// Year-accurate booster generation.
//
// Every pack belongs to one real set released in the block's years and follows
// that era's pack layout:
//   1993–1996  the original formats. Alpha/Beta/Unlimited/Revised/Legends/Ice Age
//              are 15 cards (11 C, 3 U, 1 R). Arabian Nights, Antiquities, The Dark
//              and Fallen Empires are 8-card packs with no rare slot (6 C, 2 U).
//              Homelands is 8 cards with a rare in the last slot only some of the
//              time, Chronicles is 12 and Alliances is 12 (8 C, 3 U, 1 R).
//   1996–2008  15 cards, 11 C / 3 U / 1 R, no mythics.
//   2008–2024  mythic rarity (Shards of Alara on): the rare slot is a mythic about
//              1 pack in 8 (each mythic printed half as often as each rare). Basic
//              land slots are skipped because basics are free in deck building.
//   2024→      Play Boosters: 6 C, 3 U, 1 R/M, a wildcard of any rarity, a foil of
//              any rarity, and a common slot that is a card from The List 1 time in 8.
// Sets that carry a "special"/"bonus" sheet (Time Spiral timeshifted, Mystical
// Archive, retro artifacts…) replace one common with it.
// Masters sets add a foil slot of any rarity.
// Only cards the rules engine can play are drawn (rarity proportions are kept
// inside the playable subset).

import type { ProgData, ProgPrint, ProgSet, Rarity } from "./data";
import { isPlayable, setsInYears } from "./data";
import type { Rng } from "./rng";

interface SlotSpec {
  weights: Partial<Record<Rarity, number>>;
  /** Weights are per card (rare 2 : mythic 1 per printing) rather than per rarity. */
  perCard?: boolean;
  /** Chance this slot is replaced by a card from The List. */
  list?: number;
}

export interface Pack {
  set: ProgSet;
  cards: ProgPrint[];
}

const C: SlotSpec = { weights: { c: 1 } };
const U: SlotSpec = { weights: { u: 1 } };
const R: SlotSpec = { weights: { r: 1 } };
const RM: SlotSpec = { weights: { r: 2, m: 1 }, perCard: true };
const WILD: SlotSpec = { weights: { c: 0.45, u: 0.35, r: 0.17, m: 0.03 } };
const FOIL: SlotSpec = { weights: { c: 0.6, u: 0.27, r: 0.1, m: 0.03 } };
const rep = (slot: SlotSpec, n: number): SlotSpec[] => Array.from({ length: n }, () => slot);

const EARLY_LAYOUTS: Record<string, SlotSpec[]> = {
  arn: [...rep(C, 6), ...rep(U, 2)],
  atq: [...rep(C, 6), ...rep(U, 2)],
  drk: [...rep(C, 6), ...rep(U, 2)],
  fem: [...rep(C, 6), ...rep(U, 2)],
  hml: [...rep(C, 6), U, { weights: { u: 2, r: 1 } }],
  chr: [...rep(C, 9), ...rep(U, 2), { weights: { u: 1, r: 1 } }],
  all: [...rep(C, 8), ...rep(U, 3), R],
};

const MYTHIC_ERA = "2008-10-03";
const PLAY_BOOSTER_ERA = "2024-02-01";

type RarityPools = Record<Rarity, ProgPrint[]>;

function emptyPools(): RarityPools {
  return { c: [], u: [], r: [], m: [], s: [], b: [] };
}

export function layoutFor(set: ProgSet, pools: RarityPools): SlotSpec[] {
  let slots: SlotSpec[];
  if (EARLY_LAYOUTS[set.code]) slots = EARLY_LAYOUTS[set.code].slice();
  else if (set.released < MYTHIC_ERA) slots = [...rep(C, 11), ...rep(U, 3), R];
  else if (set.released < PLAY_BOOSTER_ERA || set.type === "masters") {
    slots = [...rep(C, 10), ...rep(U, 3), RM];
    if (set.type === "masters") slots.push(FOIL);
  } else {
    slots = [...rep(C, 6), ...rep(U, 3), RM, WILD, FOIL, { weights: { c: 1 }, list: 0.125 }];
  }
  // A special/bonus sheet replaces one common.
  for (const extra of ["s", "b"] as const) {
    const n = pools[extra].length;
    if (!n) continue;
    const p = n >= 20 ? 1 : 0.125;
    const at = slots.findIndex((s) => s === C);
    if (at >= 0) slots[at] = { weights: { [extra]: p, c: 1 - p } };
  }
  return slots;
}

/** How many cards a pack of this set holds (before engine filtering). */
export function packSize(set: ProgSet, pools: RarityPools): number {
  return layoutFor(set, pools).length;
}

const FALLBACK: Record<Rarity, Rarity[]> = {
  m: ["r", "u", "c"],
  r: ["m", "u", "c"],
  u: ["c", "r"],
  c: ["u"],
  s: ["c", "u"],
  b: ["c", "u"],
};

export class PackFactory {
  private readonly pools = new Map<number, RarityPools>();
  private listPool: ProgPrint[] | null = null;

  constructor(
    private readonly data: ProgData,
    private readonly allowPartial: boolean,
  ) {}

  /** Playable printings of a set, grouped by rarity. */
  poolsFor(set: ProgSet): RarityPools {
    let pools = this.pools.get(set.idx);
    if (!pools) {
      pools = emptyPools();
      for (const p of this.data.printsBySet.get(set.idx) ?? []) {
        if (isPlayable(p, this.allowPartial)) pools[p.rarity].push(p);
      }
      this.pools.set(set.idx, pools);
    }
    return pools;
  }

  playableList(): ProgPrint[] {
    if (!this.listPool) this.listPool = this.data.list.filter((p) => isPlayable(p, this.allowPartial));
    return this.listPool;
  }

  private draw(slot: SlotSpec, pools: RarityPools, used: Set<string>, rng: Rng): ProgPrint | null {
    if (slot.list && rng.next() < slot.list) {
      const list = this.playableList();
      if (list.length) {
        const p = rng.pick(list);
        if (!used.has(p.card.name)) return p;
      }
    }
    const rarities = (Object.keys(slot.weights) as Rarity[]).filter((r) => (slot.weights[r] ?? 0) > 0);
    const available = rarities.filter((r) => pools[r].length > 0);
    let rarity: Rarity | undefined;
    if (available.length) {
      const weights = available.map((r) => (slot.weights[r] ?? 0) * (slot.perCard ? pools[r].length : 1));
      rarity = available[rng.weighted(weights)];
    } else {
      for (const r of rarities) {
        rarity = FALLBACK[r].find((f) => pools[f].length > 0);
        if (rarity) break;
      }
    }
    if (!rarity) return null;
    const bucket = pools[rarity];
    for (let tries = 0; tries < 12; tries++) {
      const p = rng.pick(bucket);
      if (!used.has(p.card.name)) return p;
    }
    return rng.pick(bucket);
  }

  openPack(set: ProgSet, rng: Rng): Pack {
    const pools = this.poolsFor(set);
    const used = new Set<string>();
    const cards: ProgPrint[] = [];
    for (const slot of layoutFor(set, pools)) {
      const p = this.draw(slot, pools, used, rng);
      if (!p) continue;
      used.add(p.card.name);
      cards.push(p);
    }
    // Rarest last, like a real pack reveal.
    const rank: Record<Rarity, number> = { c: 0, s: 1, b: 1, u: 2, r: 3, m: 4 };
    cards.sort((a, b) => rank[a.rarity] - rank[b.rarity]);
    return { set, cards };
  }

  /** Booster sets of the block that have something playable in them. */
  setsFor(from: number, to: number): ProgSet[] {
    return setsInYears(this.data, from, to).filter((s) => {
      const p = this.poolsFor(s);
      return p.c.length + p.u.length + p.r.length + p.m.length >= 8;
    });
  }

  /**
   * A sealed pool for the block: `packs` packs' worth of cards (6 packs ≈ 84 cards).
   * Eras with 8- or 12-card packs open more packs so the pool stays deck-buildable.
   */
  openSealed(from: number, to: number, packs: number, rng: Rng): Pack[] {
    const sets = this.setsFor(from, to);
    if (!sets.length) return [];
    const weights = sets.map((s) => {
      const p = this.poolsFor(s);
      return Math.sqrt(p.c.length + p.u.length + p.r.length + p.m.length);
    });
    const target = packs * 14;
    const out: Pack[] = [];
    let cards = 0;
    while ((out.length < packs || cards < target) && out.length < packs * 3) {
      const set = sets[rng.weighted(weights)];
      const pack = this.openPack(set, rng);
      if (!pack.cards.length) continue;
      out.push(pack);
      cards += pack.cards.length;
    }
    return out;
  }

  /** Every playable printing of the block's years with the given rarity, one per card name. */
  universe(from: number, to: number, rarity: Rarity): ProgPrint[] {
    const seen = new Set<string>();
    const out: ProgPrint[] = [];
    for (const set of setsInYears(this.data, from, to)) {
      for (const p of this.poolsFor(set)[rarity]) {
        if (seen.has(p.card.name)) continue;
        seen.add(p.card.name);
        out.push(p);
      }
    }
    return out;
  }

  /** Card names a block can produce, for the engine support check. */
  static namesForYears(data: ProgData, from: number, to: number): string[] {
    const names = new Set<string>();
    for (const set of setsInYears(data, from, to)) {
      for (const p of data.printsBySet.get(set.idx) ?? []) names.add(p.card.name);
    }
    return [...names];
  }
}
