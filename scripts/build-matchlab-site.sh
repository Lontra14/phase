#!/usr/bin/env bash
# Build the Rogue Forge MatchLab static site: the folder you upload to your domain.
#
#   ./scripts/build-matchlab-site.sh [output-dir]      (default: matchlab-site)
#
# Needs: cargo (rustup reads rust-toolchain.toml), wasm-bindgen 0.2.121, pnpm 9,
# node 22, jq, curl. Downloads MTGJSON + Scryfall data (a few hundred MB).
# Used by .github/workflows/matchlab-pages.yml and Dockerfile.matchlab.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
OUT="${1:-matchlab-site}"

# P2P relay: same origin static file instead of the official credentials endpoint,
# which only serves phase-rs.dev. Override with your own endpoint if you have one.
export TURN_CREDENTIALS_URL="${TURN_CREDENTIALS_URL:-/turn.json}"

for tool in cargo pnpm jq curl wasm-bindgen; do
  command -v "$tool" >/dev/null 2>&1 || { echo "missing tool: $tool" >&2; exit 1; }
done

echo "== 1/5 Scryfall image + set data"
./scripts/gen-scryfall-images.sh & a=$!
./scripts/gen-scryfall-token-images.sh & b=$!
./scripts/gen-scryfall-printings.sh & c=$!
./scripts/gen-scryfall-sets.sh & d=$!
wait $a; wait $b; wait $c; wait $d

echo "== 2/5 client dependencies"
(cd client && pnpm install --frozen-lockfile)

echo "== 3/5 card database (MTGJSON)"
./scripts/gen-card-data.sh

echo "== 4/5 rules engine (release WASM)"
./scripts/build-wasm.sh release
test -s client/src/wasm/engine_wasm_bg.wasm

echo "== 5/5 client (type-check + bundle)"
(cd client && pnpm build)

rm -rf "$OUT"
cp -r client/dist "$OUT"
cp deploy/matchlab/.htaccess deploy/matchlab/turn.json "$OUT/"
cp "$OUT/index.html" "$OUT/404.html"
# Non-English sidecars fall back to English when missing; dropping them saves space.
rm -f "$OUT"/card-data.{de,es,fr,it,ja,pt,zh}.json "$OUT"/scryfall-images.v2.{de,es,fr,it,ja,pt,zh}.json
test -s "$OUT/index.html"
test -s "$OUT/card-data.json"

echo
echo "Site ready in: $OUT  ($(du -sh "$OUT" | cut -f1))"
echo "Largest files:"; find "$OUT" -type f -printf '%10s  %p\n' | sort -nr | head -8
echo "Upload the CONTENTS of $OUT to the root of your (sub)domain, then open /lab"
