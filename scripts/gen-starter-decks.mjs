#!/usr/bin/env node
// Rogue Forge — Starter mode deck index.
//
// Reads MTGJSON's AllDeckFiles (data/mtgjson/decks/*.json, extracted by
// gen-card-data.sh) and writes client/public/starter-decks.json: every paper
// preconstructed deck with exactly 60 main-deck cards and no commander, plus
// every official Commander precon (one or two commanders + the rest of the 100),
// with each card's exact printing (set, collector number, Scryfall id) so the
// match shows the same edition as the deck.
//
//   node scripts/gen-starter-decks.mjs [decks-dir] [output]
//
// Output: { v, decks: [{ id, code, name, type, date, cards: [[name, count, set,
//   number, scryfallIdHex, rarity, type_line, mana_value, colors, mana_cost,
//   color_identity]], commander?: [same rows] }] }   rarity: c u r m s b
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

const decksDir = process.argv[2] ?? "data/mtgjson/decks";
const output = process.argv[3] ?? "client/public/starter-decks.json";

// Not 60-card constructed precons, or not paper products.
const EXCLUDED_TYPE = /commander|brawl|archenemy|planechase|jumpstart|secret lair|mtgo|arena|online|sample|halfdeck/i;
// Official Commander precons (paper): "Commander Deck" (Commander 2011 on, set
// Commander decks, Starter Commander decks…). Not Brawl, Duel Commander, MTGO.
const COMMANDER_TYPE = /commander deck/i;
const COMMANDER_EXCLUDED = /brawl|duel|mtgo|arena|online|sample|secret lair/i;
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
  const count = (list) => (list ?? []).reduce((t, c) => t + (c.count ?? 1), 0);
  const total = count(data.mainBoard);
  // The commander: MTGJSON's "commander" section; older Commander decks name it only
  // as "displayCommander" or keep it in the main deck (then: the legendary creature
  // whose colour identity is the deck's, the rarest first).
  let commanders = Array.isArray(data.commander) && data.commander.length ? data.commander : [];
  if (!commanders.length && Array.isArray(data.displayCommander) && data.displayCommander.length) commanders = data.displayCommander;
  if (!commanders.length && COMMANDER_TYPE.test(type) && !COMMANDER_EXCLUDED.test(type) && total >= 98 && total <= 101) {
    const guess = guessCommander(data.mainBoard);
    if (guess) commanders = [{ ...guess, count: 1 }];
  }
  // A commander precon: 1-2 commanders and about 100 cards in all (some lists carry the commander in the main deck too).
  const isCommander =
    COMMANDER_TYPE.test(type) &&
    !COMMANDER_EXCLUDED.test(type) &&
    commanders.length >= 1 &&
    commanders.length <= 2 &&
    total + count(commanders) >= 98 &&
    total + count(commanders) <= 102;
  if (!isCommander && (EXCLUDED_TYPE.test(type) || total !== 60 || commanders.length > 0)) {
    skipped++;
    continue;
  }
  let missingId = false;
  const rowsOf = (list, skip) => {
    const merged = new Map();
    for (const c of list) {
      let n = c.count ?? 1;
      // The commander is in the command zone: a main-deck copy of it is dropped.
      if (skip && skip.has(c.name)) {
        skip.delete(c.name);
        n -= 1;
      }
      if (n <= 0) continue;
      // Commander precons keep a card with no Scryfall id (it gets the default art).
      const row = cardRow({ ...c, count: n }) ?? (isCommander ? cardRow({ ...c, count: n }, true) : null);
      if (!row) {
        missingId = true;
        continue;
      }
      const key = `${row[0]}|${row[2]}|${row[3]}`;
      const prev = merged.get(key);
      if (prev) prev[1] += row[1];
      else merged.set(key, row);
    }
    return [...merged.values()];
  };
  const commanderRows = isCommander ? rowsOf(commanders) : [];
  const cards = rowsOf(data.mainBoard, isCommander ? new Set(commanders.map((c) => c.name)) : null);
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
    cards,
    ...(commanderRows.length ? { commander: commanderRows } : {}),
  });
}

/** The likely commander of a 100-card list with no commander section. */
function guessCommander(main) {
  const identity = new Set(main.flatMap((c) => c.colorIdentity ?? []));
  const rank = { mythic: 4, special: 3, rare: 2, uncommon: 1, common: 0 };
  const can = (c) => /Legendary/.test(c.type ?? "") && (/Creature/.test(c.type ?? "") || /can be your commander/i.test(c.text ?? ""));
  const fits = main.filter((c) => can(c) && (c.colorIdentity ?? []).length === identity.size && (c.colorIdentity ?? []).every((x) => identity.has(x)));
  const pool = fits.length ? fits : main.filter(can);
  return pool.slice().sort((a, b) => (rank[b.rarity] ?? 0) - (rank[a.rarity] ?? 0))[0] ?? null;
}

/** One card line: [name, count, set, number, scryfallIdHex, rarity, type, mv, colors, cost, identity] (null without a Scryfall id). */
function cardRow(c, allowNoId = false) {
  let id = String(c.identifiers?.scryfallId ?? "").replace(/-/g, "");
  if (id.length !== 32) {
    if (!allowNoId) return null;
    id = "";
  }
  return [
    c.name,
    c.count ?? 1,
    String(c.setCode ?? "").toLowerCase(),
    String(c.number ?? ""),
    id,
    RARITY[c.rarity] ?? "c",
    c.type ?? "",
    Math.round(Number(c.manaValue ?? c.convertedManaCost ?? 0)),
    (c.colors ?? []).join(""),
    c.manaCost ?? "",
    (c.colorIdentity ?? []).join(""),
  ];
}

decks.sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
writeFileSync(output, JSON.stringify({ v: 1, decks }));
const types = {};
for (const d of decks) types[d.type] = (types[d.type] ?? 0) + 1;
const commanderCount = decks.filter((d) => d.commander).length;
console.log(`starter-decks: ${decks.length} decks (${commanderCount} commander precons, ${skipped} skipped) →`, types);
if (decks.length < 20) {
  console.error("starter-decks: suspiciously few decks — check data/mtgjson/decks");
  process.exit(1);
}
