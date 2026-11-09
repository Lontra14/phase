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
  /** Draw from the set's alternate-frame printings (showcase, borderless, extended art). */
  variant?: boolean;
}

/** Booster products (Starter mode offers any of them). */
export type ProductKind = "booster" | "draft" | "set" | "play" | "collector";

export const PRODUCT_LABEL: Record<ProductKind, string> = {
  booster: "Booster",
  draft: "Draft Booster",
  set: "Set Booster",
  play: "Play Booster",
  collector: "Collector Booster",
};

export interface Pack {
  set: ProgSet;
  cards: ProgPrint[];
  kind?: ProductKind;
  /** Premium product (Collector Booster): shown with an aura. */
  special?: boolean;
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
const COLLECTOR_ERA = "2019-10-04";
const SET_BOOSTER_ERA = "2020-09-25";

/** The ordinary booster of a set (what openPack/layoutFor produce). */
export function baseKind(set: ProgSet): ProductKind {
  if (set.released >= PLAY_BOOSTER_ERA && set.type !== "masters") return "play";
  if (set.released >= MYTHIC_ERA) return "draft";
  return "booster";
}

/** Every product a set was sold in (approximate by release date). */
export function productsFor(set: ProgSet): ProductKind[] {
  const out: ProductKind[] = [baseKind(set)];
  if (set.released >= SET_BOOSTER_ERA && set.released < PLAY_BOOSTER_ERA && set.type === "expansion") out.push("set");
  if (set.released >= COLLECTOR_ERA && (set.type === "expansion" || set.type === "core" || set.type === "masters" || set.type === "draft_innovation")) out.push("collector");
  return out;
}

const SET_BOOSTER: SlotSpec[] = [
  ...Array.from({ length: 4 }, () => ({ weights: { c: 1 } })),
  ...Array.from({ length: 3 }, () => ({ weights: { u: 1 } })),
  { weights: { c: 0.45, u: 0.35, r: 0.17, m: 0.03 } },
  { weights: { c: 0.45, u: 0.35, r: 0.17, m: 0.03 } },
  { weights: { r: 2, m: 1 }, perCard: true },
  { weights: { c: 0.6, u: 0.27, r: 0.1, m: 0.03 } },
  { weights: { c: 1 }, list: 0.25 },
];

const COLLECTOR_BOOSTER: SlotSpec[] = [
  ...Array.from({ length: 4 }, () => ({ weights: { c: 1 } })),
  ...Array.from({ length: 3 }, () => ({ weights: { u: 1 } })),
  { weights: { c: 1, u: 1 }, variant: true },
  { weights: { r: 2, m: 1 }, perCard: true },
  { weights: { r: 2, m: 1 }, perCard: true, variant: true },
  { weights: { r: 2, m: 1 }, perCard: true, variant: true },
  { weights: { r: 2, m: 1 }, perCard: true, variant: true },
  { weights: { u: 1, r: 2, m: 1 }, perCard: true, variant: true },
];

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
    // Not cached while empty: the engine support check may still be running.
    if (!this.listPool || !this.listPool.length) this.listPool = this.data.list.filter((p) => isPlayable(p, this.allowPartial));
    return this.listPool;
  }

  private readonly variants = new Map<number, RarityPools>();

  /**
   * Collector-booster sheets of a set: its showcase / borderless / extended-art
   * printings from the index (older indexes: collector numbers past the last
   * common). A rarity with fewer than 4 different cards uses the regular sheet,
   * so a pack never repeats the one variant a set happens to have.
   */
  variantPoolsFor(set: ProgSet): RarityPools {
    let pools = this.variants.get(set.idx);
    if (!pools) {
      const base = this.poolsFor(set);
      const num = (cn: string) => (/^\d+$/.test(cn) ? Number(cn) : Number.POSITIVE_INFINITY);
      pools = emptyPools();
      const listed = this.data.variantsBySet?.get(set.idx) ?? [];
      for (const p of listed) if (isPlayable(p, this.allowPartial)) pools[p.rarity].push(p);
      if (!listed.length) {
        let lastCommon = 0;
        for (const p of base.c) if (num(p.cn) !== Number.POSITIVE_INFINITY) lastCommon = Math.max(lastCommon, num(p.cn));
        for (const r of ["c", "u", "r", "m"] as Rarity[]) {
          for (const p of base[r]) if (lastCommon > 0 && num(p.cn) > lastCommon) pools[r].push(p);
        }
      }
      for (const r of ["c", "u", "r", "m"] as Rarity[]) {
        if (new Set(pools[r].map((p) => p.card.name)).size < 4) pools[r] = base[r];
      }
      pools.s = [];
      pools.b = [];
      this.variants.set(set.idx, pools);
    }
    return pools;
  }

  private draw(slot: SlotSpec, basePools: RarityPools, used: Set<string>, rng: Rng, set?: ProgSet): ProgPrint | null {
    const pools = slot.variant && set ? this.variantPoolsFor(set) : basePools;
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
    return { set, cards, kind: baseKind(set) };
  }

  /** A specific product of a set (Starter mode's booster grid). */
  openProduct(set: ProgSet, kind: ProductKind, rng: Rng): Pack {
    if (kind !== "set" && kind !== "collector") return this.openPack(set, rng);
    const pools = this.poolsFor(set);
    const used = new Set<string>();
    const cards: ProgPrint[] = [];
    for (const slot of kind === "set" ? SET_BOOSTER : COLLECTOR_BOOSTER) {
      const p = this.draw(slot, pools, used, rng, set);
      if (!p) continue;
      used.add(p.card.name);
      cards.push(p);
    }
    const rank: Record<Rarity, number> = { c: 0, s: 1, b: 1, u: 2, r: 3, m: 4 };
    cards.sort((a, b) => rank[a.rarity] - rank[b.rarity]);
    return { set, cards, kind, special: kind === "collector" };
  }

  /** Booster sets of the block that have something playable in them. */
  setsFor(from: number, to: number): ProgSet[] {
    return this.openable(setsInYears(this.data, from, to));
  }

  /** The sets of a list that have something playable in them. */
  openable(sets: ProgSet[]): ProgSet[] {
    return sets.filter((s) => {
      const p = this.poolsFor(s);
      return p.c.length + p.u.length + p.r.length + p.m.length >= 8;
    });
  }

  /**
   * A sealed pool for the block: `packs` packs' worth of cards (6 packs ≈ 84 cards).
   * Eras with 8- or 12-card packs open more packs so the pool stays deck-buildable.
   */
  openSealed(from: number, to: number, packs: number, rng: Rng): Pack[] {
    return this.openSealedFrom(setsInYears(this.data, from, to), packs, rng);
  }

  /** A sealed pool from the given sets (runs by set). */
  openSealedFrom(all: ProgSet[], packs: number, rng: Rng): Pack[] {
    const sets = this.openable(all);
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
    return this.universeOf(setsInYears(this.data, from, to), rarity);
  }

  /** Every playable printing of the given sets with the given rarity, one per card name. */
  universeOf(sets: ProgSet[], rarity: Rarity): ProgPrint[] {
    const seen = new Set<string>();
    const out: ProgPrint[] = [];
    for (const set of sets) {
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
    return PackFactory.namesForSets(data, setsInYears(data, from, to));
  }

  static namesForSets(data: ProgData, sets: ProgSet[]): string[] {
    const names = new Set<string>();
    for (const set of sets) {
      for (const p of data.printsBySet.get(set.idx) ?? []) names.add(p.card.name);
    }
    return [...names];
  }
}
