#!/usr/bin/env bash
# Rogue Forge MatchLab — Progression mode card index.
#
# Builds client/public/progression-data.json from Scryfall's default-cards bulk
# file: every paper printing that appears in booster packs (with its rarity,
# set and release date) plus every card that was ever on "The List" (set plst).
# The Progression mode opens year-accurate sealed pools from it.
#
#   ./scripts/gen-progression-data.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/scryfall-fetch.sh"

DATA_DIR="data/scryfall"
CARDS_FILE="${SCRYFALL_DEFAULT_CARDS_FILE:-$DATA_DIR/default-cards.json}"
OUTPUT="${PROGRESSION_OUTPUT:-client/public/progression-data.json}"

echo "=== Progression data generation ==="
if [ -f "$OUTPUT" ]; then
  echo "Skipping — $OUTPUT already exists (delete to regenerate)."
  exit 0
fi
if [ ! -f "$CARDS_FILE" ]; then
  echo "Downloading Scryfall default-cards bulk data..."
  mkdir -p "$DATA_DIR"
  scryfall_fetch_bulk default_cards "$CARDS_FILE"
fi

TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

# One compact row per relevant printing (NDJSON). Booster printings only, plus
# The List. Paper, English, not digital, no tokens/emblems/art cards, no
# silver-border or memorabilia sets, no basic lands (those are free anyway).
jq -c '
  ["token","double_faced_token","emblem","art_series","vanguard","scheme","planar","augment","host"] as $badLayout |
  ["funny","memorabilia","minigame","alchemy","token","treasure_chest"] as $badSetType |
  .[] |
  select(.lang == "en") |
  select((.games // []) | index("paper")) |
  select((.digital // false) | not) |
  select(.booster == true or .set == "plst") |
  select(.layout as $l | $badLayout | index($l) | not) |
  select(.set == "plst" or (.set_type as $t | $badSetType | index($t) | not)) |
  ((.type_line // .card_faces[0].type_line // "")) as $type |
  select($type | test("^Basic (Snow )?Land") | not) |
  [
    .name,
    .set,
    .set_name,
    .set_type,
    .released_at,
    .collector_number,
    .rarity,
    (.id | gsub("-"; "")),
    $type,
    (.cmc // 0),
    ((.colors // .card_faces[0].colors // []) | join("")),
    (.mana_cost // .card_faces[0].mana_cost // ""),
    ((.color_identity // []) | join(""))
  ]
' "$CARDS_FILE" > "$TMP"

node "$SCRIPT_DIR/gen-progression-data.mjs" "$TMP" "$OUTPUT"
echo "Wrote $OUTPUT ($(du -h "$OUTPUT" | cut -f1))"
