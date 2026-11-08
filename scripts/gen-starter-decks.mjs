#!/usr/bin/env node
// Rogue Forge — Starter mode deck index.
//
// Reads MTGJSON's AllDeckFiles (data/mtgjson/decks/*.json, extracted by
// gen-card-data.sh) and writes client/public/starter-decks.json: every paper
// preconstructed deck with exactly 60 main-deck cards and no commander, with
// each card's exact printing (set, collector number, Scryfall id) so the match
// shows the same edition as the deck.
//
//   node scripts/gen-starter-decks.mjs [decks-dir] [output]
//
// Output: { v, decks: [{ id, code, name, type, date, cards: [[name, count, set,
//   number, scryfallIdHex, rarity, type_line, mana_value, colors, mana_cost,
//   color_identity]] }] }   rarity: c u r m s b
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

const decksDir = process.argv[2] ?? "data/mtgjson/decks";
const output = process.argv[3] ?? "client/public/starter-decks.json";

// Not 60-card constructed precons, or not paper products.
const EXCLUDED_TYPE = /commander|brawl|archenemy|planechase|jumpstart|secret lair|mtgo|arena|online|sample|halfdeck/i;
const RARITY = { common: "c", uncommon: "u", rare: "r", mythic: "m", special: "s", bonus: "b" };

const decks = [];
let skipped = 0;
for (const file of readdirSync(decksDir)) {
  if (!file.endsWith(".json")) continue;
  let data;
  try {
    data = JSON.parse(readFileSync(join(decksDir, file), "utf8")).data;
  } catch {
    skipped++;
    continue;
  }
  if (!data || !Array.isArray(data.mainBoard)) {
    skipped++;
    continue;
  }
  const type = String(data.type ?? "");
  const total = data.mainBoard.reduce((t, c) => t + (c.count ?? 1), 0);
  if (EXCLUDED_TYPE.test(type) || total !== 60 || (data.commander?.length ?? 0) > 0) {
    skipped++;
    continue;
  }
  const merged = new Map();
  let missingId = false;
  for (const c of data.mainBoard) {
    const id = String(c.identifiers?.scryfallId ?? "").replace(/-/g, "");
    if (id.length !== 32) missingId = true;
    const set = String(c.setCode ?? "").toLowerCase();
    const key = `${c.name}|${set}|${c.number}`;
    const prev = merged.get(key);
    if (prev) {
      prev[1] += c.count ?? 1;
      continue;
    }
    merged.set(key, [
      c.name,
      c.count ?? 1,
      set,
      String(c.number ?? ""),
      id,
      RARITY[c.rarity] ?? "c",
      c.type ?? "",
      Math.round(Number(c.manaValue ?? c.convertedManaCost ?? 0)),
      (c.colors ?? []).join(""),
      c.manaCost ?? "",
      (c.colorIdentity ?? []).join(""),
    ]);
  }
  if (missingId) {
    skipped++;
    continue;
  }
  decks.push({
    id: basename(file, ".json"),
    code: String(data.code ?? "").toLowerCase(),
    name: String(data.name ?? ""),
    type,
    date: String(data.releaseDate ?? ""),
    cards: [...merged.values()],
  });
}

decks.sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
writeFileSync(output, JSON.stringify({ v: 1, decks }));
const types = {};
for (const d of decks) types[d.type] = (types[d.type] ?? 0) + 1;
console.log(`starter-decks: ${decks.length} decks (${skipped} skipped) →`, types);
if (decks.length < 20) {
  console.error("starter-decks: suspiciously few decks — check data/mtgjson/decks");
  process.exit(1);
}
