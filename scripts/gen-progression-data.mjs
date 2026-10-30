#!/usr/bin/env node
// Aggregates the NDJSON rows written by gen-progression-data.sh into the
// compact index the Progression mode loads (client/public/progression-data.json).
//
// Shape (arrays instead of objects to keep the file small):
//   sets:   [code, name, released_at, set_type]
//   cards:  [name, type_line, cmc, colors, mana_cost, color_identity]   (one per card name)
//   prints: [cardIdx, setIdx, collector_number, rarity, scryfallIdHex]  (booster printings)
//   list:   [cardIdx, collector_number, scryfallIdHex]                  (The List, set plst)
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

function cardIdx(name, type, cmc, colors, cost, identity) {
  let idx = cards.get(name);
  if (idx === undefined) {
    idx = cardRows.length;
    cards.set(name, idx);
    cardRows.push([name, type, Math.round(Number(cmc) || 0), colors || "", cost || "", identity || ""]);
  }
  return idx;
}

const rl = createInterface({ input: createReadStream(input), crlfDelay: Infinity });
for await (const line of rl) {
  if (!line) continue;
  const [name, set, setName, setType, released, cn, rarity, id, type, cmc, colors, cost, identity] = JSON.parse(line);
  if (!name || !set) continue;
  const ci = cardIdx(name, type, cmc, colors, cost, identity);
  if (set === "plst") {
    list.push([ci, cn, id]);
    continue;
  }
  const r = RARITY[rarity];
  if (!r) continue;
  const key = `${set}:${cn}`;
  if (seenPrint.has(key)) continue;
  seenPrint.add(key);
  if (!sets.has(set)) sets.set(set, [set, setName, released || "", setType || ""]);
  prints.push({ ci, set, cn, r, id });
}

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
  prints: prints.map((p) => [p.ci, setIdx.get(p.set), p.cn, p.r, p.id]),
  list,
};
writeFileSync(output, JSON.stringify(out));
console.log(`progression-data: ${setRows.length} sets, ${cardRows.length} cards, ${prints.length} booster printings, ${list.length} List printings`);
if (prints.length < 1000) {
  console.error("progression-data: suspiciously few booster printings — check the Scryfall bulk file");
  process.exit(1);
}
