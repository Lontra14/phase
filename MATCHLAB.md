# Rogue Forge MatchLab

A small site on top of phase.rs. The home page is a mode select with four modes, **Test match** (`/test`),
**Progression** (`/progression`), **Starter** (`/starter`) and **Chess** (`/chess`); the only other screen is the
match itself (plus replays). Every other phase.rs page
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
The List, collector-booster variants, the basic lands of each set and the few rules fields the Chess minigame reads)
from Scryfall's default-cards bulk file during the site build.

## Starter

Both players pick a 60-card paper precon (`scripts/gen-starter-decks.mjs`, from MTGJSON AllDeckFiles, exact
printings). Boosters of any set and product are at stake; single games; the loser gets a List card of a chosen colour,
the winner a copy of a card of their deck (rarity wheel); then the winner and the loser each open a booster from the
shared grid (live peer-to-peer sync vs a friend). The precon's basics live in the land tray with their own art.

## Chess

Both players pick a deck: a Starter precon or a meta deck — today's (phase.rs feeds, top decks per format) or from
any past year (`public/meta-history.json`, a static file added on its own: `{ formats: { CODE: { name, metas: [{ id,
label, year, decks: [{ archetype, pct, player, event, date, main: [[count, name]], side }] }] } } }`; missing = only
today's decks). If both decks have a commander the
game is played as Commander (or Duel Commander when both decks are Duel Commander) with the command zone; otherwise
as a 1v1 game with the commander shuffled into the deck. Choose the number of
games and of boosters before each game (sets chosen per slot, one set, one random set per game, or all random).
Before every game each player opens the boosters one by one; each booster is a minigame on a 4×6 board (11 cards +
a basic land, hidden in three rows; peek, swap, move/reveal, reach the enemy land; effects are generated from the card's
type, colour, mana value, P/T and whether it has keywords / triggered / activated abilities). Cards won and cards left
on the board join the collections; deck building; a single game. The winner moves first in the next minigames, the
loser plays first in the next game. Vs a friend the minigame runs on both devices in lockstep (seeded engine, only the
inputs travel peer to peer: `client/src/chess/chessLink.ts`). The minigame is `client/src/chess/minigame.js`
(generated from the standalone test bench, then edited by hand).

Card backs: each player picks one (presets or a drawing of their own: `client/src/progression/{cosmetics.ts,CardBackPicker.tsx}`,
button on the home page, in the deck builder and in the Chess setup). It is used in every mode and in the Chess minigame; each
player sees their own back and basic land arts on their cards and the opponent's on the opponent's cards. Online the two devices
swap them over a side channel keyed by the room code (`cosmeticsLink.ts`); in the match the patch swaps the images using the
`data-rf-owner` marks on permanents, hands, libraries and the card preview.

In the match every card shows the printing from the deck or the booster: `public/rogue-forge-patch.js` (loaded by
`index.html`) swaps phase.rs's default images for the printings in `localStorage["rogue-forge-pins"]`, and adds card
zoom/flip, the land art picker of the deck builder and the Continue button after mode matches.

Files: `client/src/pages/{HomePage,MatchLabPage,ProgressionPage,StarterPage,ChessPage}.tsx` · `client/src/progression/*` · `client/src/chess/*` ·
`deploy/matchlab/{.htaccess,turn.json}` · `scripts/build-matchlab-site.sh` · `scripts/gen-progression-data.{sh,mjs}` · `scripts/gen-starter-decks.mjs` ·
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

## Rooms vs a friend (Chess, Starter, Progression)

Choosing "Vs a friend (online)" opens the mode room first (`client/src/progression/room.tsx`):
the host presses **Create a room** and reads out the 5-character code, the friend types it
and presses **Join**. Inside the room each player picks their own deck on their own device,
the host chooses the settings and presses Start: the run opens on both devices (the guest
plays seat 2). Before every game the host's device opens the game room by itself and sends
its code over the mode room; the guest joins automatically ("Use a room code by hand" keeps
the old manual flow). The room is remembered (localStorage `pt1-room-<mode>`) until a player
presses **Leave room**. The room also carries each player's card back and basic land arts.

Chess vs a friend: the host's device opens both boosters and sends them, so the two devices
play with exactly the same cards; at the start of every turn the host also sends a snapshot
of the board, and the guest adopts it if the two ever disagree. Seat 2 sees the board from
its own side.

## Branding

The app is branded "Pay the 1 pt1" (title, manifest, logos in `client/public`). The rules
engine is phase.rs (MIT / Apache-2.0): its licence notice ships as
`client/public/LICENSE-phase.txt`, linked from the home page. Background music is disabled
(`ROGUE_FORGE_NO_MUSIC` in `client/src/audio/AudioManager.ts`); the settings are reachable
from every screen through the gear in the top-right corner.

## Your own decklist (Chess, Starter, Test match)

"✎ Your list" in the deck bar (Chess, Starter) and the two list boxes of the Test match read
any common decklist format (`client/src/progression/deckImport.ts`, panel in
`DeckImportPanel.tsx`): cards with set + collector number keep that printing, the others get
the newest printing of the index; basic lands go to the basic-land tray (with the art of the
printing the list names); cards the engine does not know block the list, cards it only partly
implements are shown as "May not work as usual". Rules "👑 Commander": only commander decks
(commander meta decks or your own commander lists): the commander comes from a "Commander"
section of the list or is chosen from its legendary creatures; the list must have 100 cards with
the commander, one copy of each card (basics and "any number" cards excepted) and the
commander's colours; Start stays disabled until both decks are commander decks. Vs a friend the
imported list travels over the mode room.

The Test match page (`client/src/pages/MatchLabPage.tsx`) now looks and works like the other
modes (room for online games, rules switch, the same list reading); its deep link
(`#you=…&opp=…&auto=1`) still works.

## Test match: tables of 2–4, ready-made decks, multiplayer variants

- **Decks**: every seat can paste a list or pick a ready-made deck (`client/src/progression/deckCatalog.ts`,
  picker `DeckCatalogPicker.tsx`): the Starter precons (with their own printings) and the meta decks of today and
  of every year (commander decks under 👑 Commander).
- **Tables**: 2, 3 or 4 players. Vs AI every other seat is an AI with its own deck and difficulty. Online the room
  (`client/src/progression/roomHub.tsx`) takes up to 3 friends: the host's device is the hub, the friends join with
  the code; each seat is a friend or an AI; the host presses Start and every friend joins the game by itself.
- **Rules**: Normal (Freeform), Commander (Freeform Commander), Two-Headed Giant (seats 1+2 against 3+4),
  Archenemy (seat 1 is the archenemy; the engine supplies the scheme deck), Planechase (online only, no AI; the
  engine supplies the planar deck). No card-pool legality; the three variants keep the engine's 60-card minimum.
  The Commander versions of the variants are not offered: the engine applies Commander's banned list to them.
