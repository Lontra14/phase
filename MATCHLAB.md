# Rogue Forge MatchLab

A small site on top of phase.rs. The home page is a mode select with two modes, **Test match** (`/test`) and
**Progression** (`/progression`); the only other screen is the match itself (plus replays). Every other phase.rs page
(menu, deck builder, draft, tournaments, multiplayer lobby browser) is removed.

## Test match


- **Vs AI** — paste your list and the opponent's (or pick a test deck for either side), choose AI difficulty,
  format, starting life and who starts, press **Start match**.
- **Vs a friend (online)** — each player opens the site on their own device and pastes their own deck.
  One presses **Create room** and reads out the 5-character code; the other types it and presses **Join room**.
  Peer-to-peer (PeerJS) like the rest of phase.rs: no game server of yours is involved.

The match itself is the stock phase.rs board, rules engine and AI.

## Progression

A run through Magic's history. Settings: start year, end year (1993 → today), years per block (1–5), packs per sealed,
vs AI or vs a friend.

Each block:

1. **Sealed.** Every player opens boosters from sets released in the block's years (animated opening). Packs follow
   their era: 8-card packs without a rare slot for Arabian Nights / Antiquities / The Dark / Fallen Empires, 12-card
   Alliances / Chronicles, 15-card 11C/3U/1R until 2008, a mythic about 1 pack in 8 from Shards of Alara, Play Boosters
   (wildcard + foil + a 1-in-8 slot from The List) from 2024. Special sheets (timeshifted, Mystical Archive…) replace a
   common. Only cards the rules engine fully supports are drawn (option to include partially supported ones).
   Collections are cumulative by default.
2. **Deck building** in the Rogue Forge deck builder (piles, drag & drop, sideboard, stats, basic lands, Auto-build).
3. **Best of three**, Limited rules (40+ cards, the rest of the collection is the sideboard), vs the AI (which builds
   its own deck from its own sealed) or a friend over P2P with a room code. The result is read from the match; it can
   also be entered by hand.
4. **Rewards.** The loser opens 3 random cards that were on The List. The winner spins the Wheel of Fortune (one slice
   per rarity in the pool opened this block) and picks 1 of 30 cards of that rarity from the block's years.
5. **Timeline** animation to the next block, until the end year. Records are kept by player name.

Saving: the run is autosaved in the browser. **Save / Load** gives two separate exports:
- the **run code** (`PROG1-…`): settings, seed, block, phase, records, the pools this device knows, pending rewards —
  loading it asks which player you are, so pools are re-associated with the people in the room;
- **my list**: own main deck + sideboard (the rest of the collection) as a plain decklist, importable into any run.

Card index: `scripts/gen-progression-data.sh` builds `progression-data.json` (booster printings with rarity and year,
plus The List) from Scryfall's default-cards bulk file during the site build.

Files: `client/src/pages/{HomePage,MatchLabPage,ProgressionPage}.tsx` · `client/src/progression/*` ·
`deploy/matchlab/{.htaccess,turn.json}` · `scripts/build-matchlab-site.sh` · `scripts/gen-progression-data.{sh,mjs}` ·
`.github/workflows/matchlab-pages.yml` · `Dockerfile.matchlab`

## Hosting on your own domain

The build output is a plain static folder (HTML, JS, WASM, JSON). Upload **the contents of the folder** to the
**document root of a domain or subdomain** — for example create `mtg.tuodominio.it` in the hosting panel and point it
to its own folder. It must be the root: the app does not work from a sub-path like `tuodominio.it/mtg/`.

- `.htaccess` (included) does the Apache/LiteSpeed work: routes `/test`, `/progression`, `/game/…` to `index.html`, serves `.wasm` as
  `application/wasm`, compresses the card JSON, sets caching. On nginx use `try_files $uri /index.html;` and add the
  `application/wasm` type.
- HTTPS is required (browsers only allow WebAssembly workers, storage and WebRTC on secure origins) — turn on the free
  Let's Encrypt certificate in the hosting panel.
- `turn.json` lists the STUN/TURN relays for friend games (the same free relays Serata Chill uses), so players on
  mobile data or school/office Wi-Fi can still connect.

## Building the folder

Pick one:

1. **GitHub Actions (nothing to install).** Push this branch to any GitHub repository (a fork of phase-rs/phase),
   run **Actions → MatchLab site build**, then download the **matchlab-site** artifact (a ZIP). GitHub only compiles;
   nothing is published there.
2. **Docker on your PC.** `docker build -f Dockerfile.matchlab --output type=local,dest=matchlab-site .`
3. **Native toolchain.** Rust (rustup), `wasm-bindgen-cli@0.2.121`, Node 22, pnpm 9, jq, curl, then
   `./scripts/build-matchlab-site.sh`.

All three run the same script and produce the same folder.

## Deep link (hand a battle over from the roguelike)

```
/#you=<b64url decklist>&opp=<b64url decklist>&life=20&ai=Medium&format=Freeform&first=play&auto=1
```

All keys optional. `ai` = VeryEasy | Easy | Medium | Hard | VeryHard. `first` = random | play | draw.
`auto=1` starts the AI match as soon as the card database has loaded. Encoder for the roguelike page:

```js
function matchlabLink(base, youList, oppList, opts = {}) {
  const enc = (text) => {
    const bytes = new TextEncoder().encode(text);
    let bin = "";
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  };
  const p = new URLSearchParams({ you: enc(youList), opp: enc(oppList) });
  for (const [k, v] of Object.entries(opts)) p.set(k, String(v));
  return `${base.replace(/\/$/, "")}/#${p}`;
}
// window.open(matchlabLink("https://mtg.tuodominio.it", myDeckText, bossDeckText, { life: 30, ai: "Hard", auto: 1 }));
```

Links to `/#you=…` and old `/lab` links still work (forwarded to `/test`, hash kept).

Licence: phase.rs is MIT / Apache-2.0 — keep `LICENSE-*` and `NOTICE` in the repository.
