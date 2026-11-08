#!/usr/bin/env node
// Aggregates the NDJSON rows written by gen-progression-data.sh into the
// compact index the Progression mode loads (client/public/progression-data.json).
//
// Shape (arrays instead of objects to keep the file small):
//   sets:   [code, name, released_at, set_type]
//   cards:  [name, type_line, cmc, colors, mana_cost, color_identity]   (one per card name)
//   prints: [cardIdx, setIdx, collector_number, rarity, scryfallIdHex, variant?]  (booster printings;
//           variant = 1 for collector-booster-only showcase/borderless/extended-art printings)
//   list:   [cardIdx, collector_number, scryfallIdHex, rarity]          (The List, set plst)
//   basics: [setIdx, collector_number, scryfallIdHex, cardIdx]              (basic lands per set, Chess mode)
//   cards[i][6] (Chess mode, optional): [power, toughness, loyalty, flags, keywords, back]
//           flags: 1 keyword · 2 triggered ability · 4 activated ability · 8 double-faced (transform/MDFC)
//           back: [name, type_line, power, toughness, colors, flags, loyalty] for double-faced cards, else 0
// rarity: c u r m s(special) b(bonus)
import { createReadStream, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  console.error("usage: gen-progression-data.mjs <rows.ndjson> <output.json>");
  process.exit(2);
}

const RARITY = { common: "c", uncommon: "u", rare: "r", mythic: "m", special: "s", bonus: "b" };
const sets = new Map(); // code -> [code, name, released, type]
const cards = new Map(); // name -> idx
const cardRows = [];
const prints = [];
const list = [];
const seenPrint = new Set();
const variants = [];
const basicRows = [];

// Chess mode: what a card "has", read from its rules text (no real rules are used).
const ABILITY_WORDS = /^(Landfall|Raid|Constellation|Metalcraft|Threshold|Morbid|Revolt|Ferocious|Delirium|Heroic|Magecraft|Alliance|Coven|Domain|Hellbent|Spell mastery|Formidable|Battalion|Bloodrush|Channel|Chroma|Converge|Eminence|Enrage|Fateful hour|Grandeur|Imprint|Inspired|Join forces|Kinship|Lieutenant|Parley|Radiance|Rally|Sweep|Tempting offer|Undergrowth|Will of the council|Adamant|Addendum|Celebration|Corrupted|Descend \d+|Eerie|Survival|Valiant|Void|Flurry|Start your engines!|Max speed|Renew)$/;
const strip = (t) => String(t || "").replace(/\([^)]*\)/g, "").trim();
const escRe = (k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function kwOf(keywords, oracle) {
  return (keywords || []).filter((k) => !ABILITY_WORDS.test(k) && new RegExp("\\b" + escRe(k) + "\\b", "i").test(oracle) && !new RegExp("^" + escRe(k) + "\\s*—", "mi").test(oracle));
}
const trigOf = (o) => /\b(When|Whenever|At the beginning|At end of)\b/.test(o);
const actOf = (o) => o.split("\n").some((l) => /^[^"•]*?(\{[^}]+\}|\bSacrifice\b|\bPay\b|\bDiscard\b|\bExile\b|\bRemove\b)[^"]*?:\s/.test(l));
const numOr = (v) => (v === "" || v == null ? "" : v);
function chessOf(ch) {
  if (!ch) return null;
  const front = strip(ch.o);
  const kws = kwOf(ch.kw, front);
  const flags = (kws.length ? 1 : 0) | (trigOf(front) ? 2 : 0) | (actOf(front) ? 4 : 0) | (ch.b && (ch.lay === "transform" || ch.lay === "modal_dfc") ? 8 : 0);
  let back = 0;
  if (flags & 8) {
    const [bn, bt, bp, btt, bc, bo, bl] = ch.b;
    const bor = strip(bo);
    const bk = kwOf(ch.kw, bor);
    back = [bn, bt, numOr(bp), numOr(btt), bc, (bk.length ? 1 : 0) | (trigOf(bor) ? 2 : 0) | (actOf(bor) ? 4 : 0), numOr(bl)];
  }
  return [numOr(ch.p), numOr(ch.t), numOr(ch.l), flags, kws.join(", "), back];
}

function cardIdx(name, type, cmc, colors, cost, identity, chess) {
  let idx = cards.get(name);
  if (idx === undefined) {
    idx = cardRows.length;
    cards.set(name, idx);
    const row = [name, type, Math.round(Number(cmc) || 0), colors || "", cost || "", identity || ""];
    const c = chessOf(chess);
    if (c) row.push(c);
    cardRows.push(row);
  }
  return idx;
}

const rl = createInterface({ input: createReadStream(input), crlfDelay: Infinity });
for await (const line of rl) {
  if (!line) continue;
  const [name, set, setName, setType, released, cn, rarity, id, type, cmc, colors, cost, identity, variant, chess] = JSON.parse(line);
  if (!name || !set) continue;
  const ci = cardIdx(name, type, cmc, colors, cost, identity, chess);
  if (variant === 2) {
    basicRows.push({ ci, set, cn, id });
    continue;
  }
  if (set === "plst") {
    list.push([ci, cn, id, RARITY[rarity] ?? ""]);
    continue;
  }
  const r = RARITY[rarity];
  if (!r) continue;
  const key = `${set}:${cn}`;
  if (seenPrint.has(key)) continue;
  seenPrint.add(key);
  if (variant) {
    variants.push({ ci, set, cn, r, id, v: 1 });
    continue;
  }
  if (!sets.has(set)) sets.set(set, [set, setName, released || "", setType || ""]);
  prints.push({ ci, set, cn, r, id });
}

// Variants only for sets that also have draft/play booster printings.
for (const v of variants) if (sets.has(v.set)) prints.push(v);
const setRows = [...sets.values()].sort((a, b) => a[2].localeCompare(b[2]) || a[0].localeCompare(b[0]));
const setIdx = new Map(setRows.map((s, i) => [s[0], i]));
const cnKey = (cn) => {
  const m = /^(\d+)(.*)$/.exec(cn);
  return m ? [Number(m[1]), m[2]] : [1e9, cn];
};
prints.sort((a, b) => {
  const s = setIdx.get(a.set) - setIdx.get(b.set);
  if (s) return s;
  const [an, as] = cnKey(a.cn);
  const [bn, bs] = cnKey(b.cn);
  return an - bn || as.localeCompare(bs);
});

const out = {
  v: 1,
  generated: new Date().toISOString().slice(0, 10),
  sets: setRows,
  cards: cardRows,
  prints: prints.map((p) => (p.v ? [p.ci, setIdx.get(p.set), p.cn, p.r, p.id, 1] : [p.ci, setIdx.get(p.set), p.cn, p.r, p.id])),
  list,
  basics: basicRows.filter((b) => setIdx.has(b.set)).map((b) => [setIdx.get(b.set), b.cn, b.id, b.ci]),
};
writeFileSync(output, JSON.stringify(out));
const nVar = prints.filter((p) => p.v).length;
console.log(`progression-data: ${setRows.length} sets, ${cardRows.length} cards, ${prints.length - nVar} booster printings, ${nVar} collector variants, ${list.length} List printings, ${out.basics.length} basic lands`);
if (prints.length < 1000) {
  console.error("progression-data: suspiciously few booster printings — check the Scryfall bulk file");
  process.exit(1);
}
