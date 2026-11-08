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

# One compact row per relevant printing (NDJSON). Booster printings, The List,
# the basic lands of each set (Chess mode boosters), plus the few rules fields the
# Chess minigame turns into effects (power/toughness/loyalty, keywords, oracle, faces).
# and the collector-booster variants of modern sets (showcase, borderless,
# extended art: not in draft boosters, flagged with a trailing 1). Paper,
# English, not digital, no tokens/emblems/art cards, no silver-border or
# memorabilia sets, no basic lands (those are free anyway).
jq -c '
  ["token","double_faced_token","emblem","art_series","vanguard","scheme","planar","augment","host"] as $badLayout |
  ["expansion","core","masters","draft_innovation"] as $collectorSetType |
  ["funny","memorabilia","minigame","alchemy","token","treasure_chest"] as $badSetType |
  .[] |
  select(.lang == "en") |
  select((.games // []) | index("paper")) |
  select((.digital // false) | not) |
  (
    (.booster != true) and ((.promo // false) | not) and
    (.set_type as $t | $collectorSetType | index($t)) and
    ((.released_at // "") >= "2019-10-04") and
    ((.border_color == "borderless") or ((.frame_effects // []) | (index("showcase") or index("extendedart"))))
  ) as $variant |
  ((.type_line // .card_faces[0].type_line // "")) as $type |
  ($type | test("^Basic (Snow )?Land")) as $basic |
  select(.booster == true or .set == "plst" or $variant or ($basic and ((.promo // false) | not) and (.set_type as $t | $collectorSetType | index($t)))) |
  select(.layout as $l | $badLayout | index($l) | not) |
  select(.set == "plst" or (.set_type as $t | $badSetType | index($t) | not)) |
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
    ((.color_identity // []) | join("")),
    (if $basic then 2 elif .booster == true or .set == "plst" then 0 else 1 end),
    {
      p: (.power // .card_faces[0].power // ""),
      t: (.toughness // .card_faces[0].toughness // ""),
      l: (.loyalty // .card_faces[0].loyalty // ""),
      kw: (.keywords // []),
      o: (.oracle_text // .card_faces[0].oracle_text // ""),
      lay: (.layout // ""),
      b: (if (.card_faces // []) | length > 1 then
            (.card_faces[1] | [.name, (.type_line // ""), (.power // ""), (.toughness // ""), ((.colors // []) | join("")), (.oracle_text // ""), (.loyalty // "")])
          else null end)
    }
  ]
' "$CARDS_FILE" > "$TMP"

node "$SCRIPT_DIR/gen-progression-data.mjs" "$TMP" "$OUTPUT"
echo "Wrote $OUTPUT ($(du -h "$OUTPUT" | cut -f1))"
