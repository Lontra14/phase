/* Rogue Forge — hot patch for the Progression mode (no rebuild needed).
 *  1. ⟳ Flip card on double-faced cards in every card zoom (deck builder, pool, rewards).
 *  2. Click or right-click a face-up card while opening boosters to zoom it.
 *  3. At the end of a Progression match: one Continue button to the rewards (no Rematch).
 *  4. In the match, cards show the exact printings opened in Progression / Starter (for both players).
 *  5. Deck builder "Add land": choose the art of each basic land type (Arena style); used in every match.
 * Safe to leave in place after the next full build: it steps aside when the
 * page already shows its own flip button or zoom window.
 * Load it from index.html:  <script src="/rogue-forge-patch.js" defer></script>
 */
(function () {
  "use strict";
  if (window.__rogueForgePatch) return;
  window.__rogueForgePatch = 1;

  var BTN_CSS =
    "background:rgba(12,11,18,.85);border:1px solid #c9a24b;color:#ecca7e;font-family:Cinzel,serif;" +
    "letter-spacing:.08em;font-size:.8rem;padding:.5rem 1.1rem;border-radius:999px;cursor:pointer;margin-top:.6rem;align-self:flex-start";

  function isScry(src) {
    return typeof src === "string" && src.indexOf("cards.scryfall.io/") >= 0;
  }
  function face(src, which) {
    return src.replace(/\/(front|back)\//, "/" + which + "/");
  }

  /** Make one <img> flippable; `holder` receives the button. */
  function addFlip(img, name, holder) {
    if (!img || !isScry(img.src) || !name || name.indexOf(" // ") < 0) return;
    if (img.getAttribute("data-rf-flip")) return;
    img.setAttribute("data-rf-flip", "1");
    var btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "⟳ Flip card";
    btn.style.cssText = BTN_CSS;
    var back = false;
    var flip = function (e) {
      if (e) {
        e.stopPropagation();
        e.preventDefault();
      }
      back = !back;
      img.src = face(img.src, back ? "back" : "front");
    };
    img.addEventListener("error", function () {
      if (back) {
        // Split / adventure cards have no back image.
        back = false;
        img.src = face(img.src, "front");
        btn.remove();
      }
    });
    img.addEventListener("click", flip);
    img.style.cursor = "pointer";
    btn.addEventListener("click", flip);
    holder.appendChild(btn);
  }

  // 1. Flip inside the page's own zoom windows.
  function scanZooms() {
    var zooms = document.querySelectorAll(".pf-zoom");
    for (var i = 0; i < zooms.length; i++) {
      var z = zooms[i];
      if (z.querySelector(".pf-flipbtn")) continue; // the page already has it
      var img = z.querySelector("img");
      if (!img) continue;
      var meta = z.querySelector(".pf-zoom-meta");
      var nameEl = meta && meta.querySelector("b");
      var name = (nameEl && nameEl.textContent) || img.getAttribute("alt") || "";
      addFlip(img, name, meta || z);
    }
  }

  // 2. Zoom while opening boosters.
  function openZoom(src, name) {
    var modal = document.createElement("div");
    modal.className = "pf-modal";
    modal.setAttribute("data-rf-zoom", "1");
    modal.style.flexDirection = "column";
    var img = document.createElement("img");
    img.src = src.replace(/\/(small|normal)\//, "/large/");
    img.alt = name;
    img.style.cssText = "max-width:min(400px,88vw);max-height:80dvh;border-radius:18px;box-shadow:0 30px 70px rgba(0,0,0,.7)";
    var col = document.createElement("div");
    col.style.cssText = "display:flex;flex-direction:column;align-items:center";
    col.appendChild(img);
    var title = document.createElement("div");
    title.textContent = name;
    title.style.cssText = "margin-top:.7rem;font-family:Cinzel,serif;color:#ece5d2;font-size:1.05rem;text-align:center";
    col.appendChild(title);
    modal.appendChild(col);
    addFlip(img, name, col);
    var close = function () {
      modal.remove();
      document.removeEventListener("keydown", onKey);
    };
    var onKey = function (e) {
      if (e.key === "Escape") close();
    };
    modal.addEventListener("click", close);
    col.addEventListener("click", function (e) {
      e.stopPropagation();
    });
    document.addEventListener("keydown", onKey);
    var root = document.querySelector(".pf-root") || document.body;
    root.appendChild(modal);
  }

  function onRevealCard(e) {
    var t = e.target;
    var card = t && t.closest ? t.closest(".pf-reveal .pf-flip.up, .pf-listcards .pf-flip.up") : null;
    if (!card) return;
    var img = card.querySelector(".face.front img");
    if (!img || !isScry(img.src)) return;
    if (e.type === "contextmenu") e.preventDefault();
    var src = img.src;
    var name = img.getAttribute("alt") || "";
    // Let the page react first; only zoom if it did not open its own window.
    setTimeout(function () {
      if (document.querySelector(".pf-modal")) return;
      openZoom(src, name);
    }, 60);
  }
  // Left click and right click both zoom a face-up card.
  document.addEventListener("click", onRevealCard, false);
  document.addEventListener("contextmenu", onRevealCard, false);

  // 3. Progression match over: no Rematch / Menu — continue to the rewards.
  var MODE_RUNS = [
    ["phase-progression-run", "/progression"],
    ["phase-starter-run", "/starter"],
    ["phase-chess-run", "/chess"],
  ];
  function pendingRoute() {
    for (var i = 0; i < MODE_RUNS.length; i++) {
      try {
        var run = JSON.parse(localStorage.getItem(MODE_RUNS[i][0]) || "null");
        if (run && run.phase === "match" && run.pendingGameId) return MODE_RUNS[i][1];
      } catch (e) {
        /* ignore */
      }
    }
    return null;
  }
  function progressionPending() {
    return pendingRoute() !== null;
  }
  function goProgression() {
    history.pushState({}, "", pendingRoute() || "/");
    window.dispatchEvent(new PopStateEvent("popstate", { state: {} }));
  }
  function scanGameOver() {
    if (location.pathname.indexOf("/game/") !== 0) return;
    var boxes = document.querySelectorAll(".fixed.inset-0.z-50 .relative.z-10.mt-8");
    for (var i = 0; i < boxes.length; i++) {
      var box = boxes[i];
      if (box.getAttribute("data-rf-continue")) continue;
      var buttons = box.querySelectorAll("button");
      if (!buttons.length || !progressionPending()) continue;
      box.setAttribute("data-rf-continue", "1");
      var cls = buttons[0].className;
      for (var j = 0; j < buttons.length; j++) buttons[j].style.display = "none";
      var go = document.createElement("button");
      go.type = "button";
      go.className = cls;
      go.textContent = "Continue \u25B8";
      go.addEventListener("click", goProgression);
      box.appendChild(go);
    }
  }

  // 4. In the match, show the exact printings opened in Progression.
  // phase.rs draws every card with its default Scryfall image; the URL carries
  // that printing's id. We map default id -> opened printing id and rewrite
  // <img src> / background-image URLs on the game screen. Sources, in priority
  // order: my main deck, the rest of my collection, the AI's collection (from
  // the autosaved run), then the art pins phase.rs stored (which also hold the
  // friend's rebuilt collection in online games).
  var UUID = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/;
  var SCRY_URL = /(https:\/\/cards\.scryfall\.io\/[a-z_]+\/(?:front|back)\/)[0-9a-f]\/[0-9a-f]\/([0-9a-f-]{36})\.jpg(\?[0-9]*)?/g;
  var artMap = {};
  var artMapSig = null;
  var artBuilding = false;
  var jsonCache = {};
  function getJson(url) {
    if (!jsonCache[url]) {
      jsonCache[url] = fetch(url)
        .then(function (r) {
          return r.ok ? r.json() : null;
        })
        .catch(function () {
          return null;
        });
    }
    return jsonCache[url];
  }
  function dash(h) {
    return h.slice(0, 8) + "-" + h.slice(8, 12) + "-" + h.slice(12, 16) + "-" + h.slice(16, 20) + "-" + h.slice(20);
  }
  function defaultIds(entry) {
    var ids = [];
    (entry && entry.faces ? entry.faces : []).forEach(function (f) {
      [f.normal, f.art_crop, f.small].forEach(function (u) {
        var m = u && UUID.exec(u);
        if (m && ids.indexOf(m[1]) < 0) ids.push(m[1]);
      });
    });
    return ids;
  }
  var artCheckedAt = 0;
  function rebuildArtMap() {
    var now = Date.now();
    if (now - artCheckedAt < 1500) return;
    artCheckedAt = now;
    var runRaw = localStorage.getItem("phase-progression-run") || "";
    var prefRaw = localStorage.getItem("phase-preferences") || "";
    var pinsRaw = localStorage.getItem("rogue-forge-pins") || "";
    var landRaw = localStorage.getItem(LAND_KEY) || "";
    var sig = runRaw.length + ":" + prefRaw.length + ":" + pinsRaw.length + ":" + runRaw.slice(-64) + prefRaw.slice(-64) + pinsRaw.slice(-64) + landRaw;
    if (sig === artMapSig || artBuilding) return;
    artBuilding = true;
    Promise.all([getJson("/scryfall-data.json"), getJson("/progression-data.json")])
      .then(function (res) {
        var sd = res[0];
        var pd = res[1];
        if (!sd) return;
        var next = {};
        var taken = {};
        var pinEntry = function (entry, printingId) {
          if (!entry || !printingId || taken[entry.oracle_id]) return;
          taken[entry.oracle_id] = 1;
          defaultIds(entry).forEach(function (d) {
            if (d !== printingId) next[d] = printingId;
          });
        };
        var pin = function (name, printingId) {
          if (!name) return;
          var k = String(name).toLowerCase();
          pinEntry(sd[k] || sd[k.split(" // ")[0]], printingId);
        };
        // 0. Basic land arts chosen in the deck builder win over everything else.
        var picks = landPicks();
        Object.keys(picks).forEach(function (b) {
          if (picks[b] && picks[b].id) pin(b, picks[b].id);
        });
        // 1. The list written right before the match (mode pages): exact, both players.
        try {
          JSON.parse(pinsRaw || "[]").forEach(function (pair) {
            pin(pair[0], pair[1]);
          });
        } catch (e) {
          /* ignore */
        }
        // 2. Fallback: the autosaved Progression run. Printing ids by save key.
        var keyId = {};
        if (pd) {
          pd.prints.forEach(function (p) {
            keyId[pd.sets[p[1]][0] + ":" + p[2]] = dash(p[4]);
          });
          pd.list.forEach(function (p) {
            keyId["plst:" + p[1]] = dash(p[2]);
          });
        }
        var run = null;
        try {
          run = JSON.parse(runRaw || "null");
        } catch (e) {
          run = null;
        }
        if (run && run.players) {
          var order = [run.players[run.me], run.players[1 - run.me]];
          order.forEach(function (pl) {
            if (!pl || !pl.pool) return;
            var main = pl.main || [];
            var idx = main.concat(
              pl.pool
                .map(function (_, i) {
                  return i;
                })
                .filter(function (i) {
                  return main.indexOf(i) < 0;
                }),
            );
            idx.forEach(function (i) {
              var o = pl.pool[i];
              if (o) pin(o.n, keyId[o.k]);
            });
          });
        }
        try {
          var ov = (JSON.parse(prefRaw || "{}").state || {}).artOverrides || {};
          Object.keys(ov).forEach(function (oracle) {
            var entry = sd[oracle.toLowerCase()];
            if (ov[oracle] && ov[oracle].scryfallId) pinEntry(entry, ov[oracle].scryfallId);
          });
        } catch (e) {
          /* ignore */
        }
        // Your basic land arts also replace the printings a precon or a booster pinned
        // (phase.rs may draw those directly instead of its default image).
        Object.keys(picks).forEach(function (b) {
          var pk = picks[b];
          var entry = sd[b.toLowerCase()];
          if (!pk || !pk.id || !entry) return;
          var ids = [];
          try {
            JSON.parse(pinsRaw || "[]").forEach(function (pair) {
              if (pair && String(pair[0]).toLowerCase() === b.toLowerCase() && pair[1]) ids.push(pair[1]);
            });
          } catch (e) {
            /* ignore */
          }
          try {
            var ov2 = (JSON.parse(prefRaw || "{}").state || {}).artOverrides || {};
            Object.keys(ov2).forEach(function (oracle) {
              if (sd[oracle.toLowerCase()] === entry && ov2[oracle] && ov2[oracle].scryfallId) ids.push(ov2[oracle].scryfallId);
            });
          } catch (e) {
            /* ignore */
          }
          ids.concat(defaultIds(entry)).forEach(function (id) {
            if (id && id !== pk.id) next[id] = pk.id;
          });
        });
        artMap = next;
        artMapSig = sig;
        rewriteArt(document.body);
      })
      .then(
        function () {
          artBuilding = false;
        },
        function () {
          artBuilding = false;
        },
      );
  }
  function swapUrl(url) {
    if (!url || url.indexOf("cards.scryfall.io/") < 0) return url;
    return url.replace(SCRY_URL, function (all, head, id) {
      var to = artMap[id] || learnedArt[id];
      return to ? head + to[0] + "/" + to[1] + "/" + to + ".jpg" : all;
    });
  }
  // Printings seen drawn for a basic land with a chosen art (learned from its
  // <img alt>), so the same printing is swapped everywhere else too.
  var learnedArt = {};
  function toPick(url, pk, learn) {
    return url.replace(SCRY_URL, function (all, head, id) {
      if (learn !== false && id !== pk.id) learnedArt[id] = pk.id;
      return head + pk.id[0] + "/" + pk.id[1] + "/" + pk.id + ".jpg";
    });
  }
  // 6. Card backs and basic land arts per player: your choices on your cards, the
  // opponent's on theirs (window.__rfOpp, swapped at the start of online games).
  // Owners come from data-rf-owner on the board permanents, hands, libraries, preview.
  // The phone's full-screen preview carries no owner: it belongs to the card the
  // player last touched (a long press on it opened the preview).
  var lastTouchedOwner = null;
  document.addEventListener(
    "pointerdown",
    function (e) {
      var t = e.target;
      if (!t || !t.closest || t.closest("[data-card-preview]")) return;
      var o = t.closest("[data-rf-owner]");
      lastTouchedOwner = o ? o.getAttribute("data-rf-owner") : null;
    },
    true,
  );
  function ownerOf(el) {
    var o = el.closest ? el.closest("[data-rf-owner]") : null;
    if (o) return o.getAttribute("data-rf-owner");
    if (lastTouchedOwner && el.closest && el.closest("[data-card-preview]")) return lastTouchedOwner;
    return "me";
  }
  function myBackUrl() {
    try {
      var c = JSON.parse(localStorage.getItem("rogue-forge-cosmetics") || "{}");
      return c && c.back && c.back.id && c.back.id !== "classic" && c.backUrl ? c.backUrl : null;
    } catch (e) {
      return null;
    }
  }
  function backFor(owner) {
    if (owner === "opp") return (window.__rfOpp && window.__rfOpp.back) || null;
    return myBackUrl();
  }
  function rewriteBack(el) {
    var cur = el.getAttribute("src") || "";
    var mine = el.getAttribute("data-rf-backurl");
    var isBack = cur.indexOf("backs.scryfall.io/") >= 0 || (mine && cur === mine);
    if (!isBack) {
      if (mine) {
        el.removeAttribute("data-rf-backurl");
        el.removeAttribute("data-rf-backorig");
      }
      return false;
    }
    if (cur.indexOf("backs.scryfall.io/") >= 0) el.setAttribute("data-rf-backorig", cur);
    var want = backFor(ownerOf(el)) || el.getAttribute("data-rf-backorig") || cur;
    if (want !== cur) {
      el.removeAttribute("srcset");
      el.setAttribute("data-rf-backurl", want);
      el.setAttribute("src", want);
    }
    return true;
  }
  function fullId(id) {
    return id && id.length === 32 ? dash(id) : id;
  }
  function rewriteEl(el) {
    if (el.tagName === "IMG") {
      if (rewriteBack(el)) return;
      var alt = el.getAttribute("alt");
      var isLand = alt && LAND_TYPES.indexOf(alt) >= 0;
      var pk = null;
      if (isLand) {
        // Basic lands: rebuilt every time from the image the page asked for, so an
        // element reused for another card (the big preview) never keeps the last
        // player's art. Your lands: your pick; the opponent's: their pick, if any.
        var opp = ownerOf(el) === "opp";
        if (opp) {
          var oid = window.__rfOpp && window.__rfOpp.lands ? fullId(window.__rfOpp.lands[alt]) : null;
          pk = oid ? { id: oid } : null;
        } else pk = landPicks()[alt] || null;
        if (pk && !pk.id) pk = null;
        ["src", "srcset"].forEach(function (attr) {
          var v = el.getAttribute(attr);
          if (!v || v.indexOf("cards.scryfall.io/") < 0) return;
          var setK = "data-rf-l" + attr;
          var origK = "data-rf-lo" + attr;
          if (v !== el.getAttribute(setK)) el.setAttribute(origK, v); // the page wrote it
          var base = el.getAttribute(origK) || v;
          var nv = pk ? toPick(base, pk, !opp) : opp ? base : swapUrl(base);
          el.setAttribute(setK, nv);
          if (nv !== v) el.setAttribute(attr, nv);
        });
        return;
      }
      // src and srcset: the card preview lists several sizes in srcset, which wins over src.
      ["src", "srcset"].forEach(function (attr) {
        var v = el.getAttribute(attr);
        if (!v || v.indexOf("cards.scryfall.io/") < 0) return;
        var nv = pk ? toPick(v, pk) : swapUrl(v);
        if (nv !== v) el.setAttribute(attr, nv);
      });
    }
    var st = el.getAttribute && el.getAttribute("style");
    if (st && st.indexOf("cards.scryfall.io/") >= 0) {
      var nst = swapUrl(st);
      if (nst !== st) el.setAttribute("style", nst);
    }
  }
  function rewriteArt(root) {
    if (location.pathname.indexOf("/game/") !== 0 || !root) return;
    if (root.nodeType === 1) rewriteEl(root);
    var els = root.querySelectorAll ? root.querySelectorAll("img[src*='cards.scryfall.io'],img[srcset*='cards.scryfall.io'],[style*='cards.scryfall.io'],img[src*='backs.scryfall.io'],img[data-rf-backurl]") : [];
    for (var i = 0; i < els.length; i++) rewriteEl(els[i]);
  }


  // 5. Basic land art (Arena-style styles picker) in the deck builder's "Add land" tray.
  // Choices live in localStorage[LAND_KEY] = { Plains: {id, img, small, set, code, year, cn}, … }
  // and are pinned first in the match art map, so every Plains you see uses your Plains.
  var LAND_KEY = "rogue-forge-land-art";
  var LAND_TYPES = ["Plains", "Island", "Swamp", "Mountain", "Forest", "Wastes"];
  var LAND_PIP = { Plains: "#f4ecd4", Island: "#4a90d9", Swamp: "#a487c4", Mountain: "#d6503e", Forest: "#4fb277", Wastes: "#b9b2a6" };
  function landPicks() {
    try {
      var v = JSON.parse(localStorage.getItem(LAND_KEY) || "{}");
      return v && typeof v === "object" ? v : {};
    } catch (e) {
      return {};
    }
  }
  function saveLandPick(type, pick) {
    var all = landPicks();
    if (pick) all[type] = pick;
    else delete all[type];
    try {
      localStorage.setItem(LAND_KEY, JSON.stringify(all));
    } catch (e) {
      /* storage full */
    }
    artMapSig = null;
    artCheckedAt = 0;
    scanLandTrays(true);
    try {
      window.dispatchEvent(new CustomEvent("rf-cosmetics-mine"));
    } catch (e) {
      /* old browsers */
    }
  }

  var landCss = false;
  function ensureLandCss() {
    if (landCss) return;
    landCss = true;
    var st = document.createElement("style");
    st.textContent =
      ".rf-lt-art{position:absolute;left:4px;top:4px;width:26px;height:26px;border-radius:50%;border:1px solid #c9a24b;background:rgba(12,11,18,.82);color:#ecca7e;font-size:.8rem;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;z-index:2}" +
      ".rf-lt-art:hover{background:#c9a24b;color:#14121c}" +
      ".pf-land-tray .lt-img img{cursor:pointer}" +
      ".rf-lt-head-btn{margin-left:auto;margin-right:.7rem;border:1px solid #c9a24b;background:transparent;color:#ecca7e;border-radius:999px;padding:.2rem .7rem;font-family:Cinzel,serif;font-size:.72rem;letter-spacing:.05em;cursor:pointer}" +
      ".rf-lt-head-btn:hover{background:#c9a24b;color:#14121c}" +
      ".rf-la{position:fixed;inset:0;z-index:2147483000;background:rgba(5,4,9,.86);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;padding:16px;font-family:'EB Garamond',Georgia,serif;color:#e9e1cf}" +
      ".rf-la-panel{width:min(1180px,100%);height:min(820px,100%);background:#14121c;border:1px solid #c9a24b;border-radius:16px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 30px 90px rgba(0,0,0,.6)}" +
      ".rf-la-top{display:flex;align-items:center;gap:.5rem;padding:.8rem 1rem;border-bottom:1px solid #3a3346;flex-wrap:wrap}" +
      ".rf-la-top h3{margin:0 .8rem 0 0;font-family:Cinzel,serif;color:#ecca7e;font-size:1.05rem;letter-spacing:.08em}" +
      ".rf-la-tab{display:flex;align-items:center;gap:.4rem;border:1px solid #3a3346;background:#1d1a27;color:#e9e1cf;border-radius:999px;padding:.3rem .75rem;font-family:Cinzel,serif;font-size:.74rem;cursor:pointer}" +
      ".rf-la-tab i{width:10px;height:10px;border-radius:50%;display:inline-block}" +
      ".rf-la-tab img{width:20px;height:20px;border-radius:50%;object-fit:cover}" +
      ".rf-la-tab.sel{border-color:#c9a24b;color:#ecca7e;box-shadow:0 0 0 1px #c9a24b inset}" +
      ".rf-la-x{margin-left:auto;border:1px solid #3a3346;background:transparent;color:#e9e1cf;border-radius:8px;width:34px;height:34px;font-size:1.1rem;cursor:pointer}" +
      ".rf-la-body{flex:1;display:grid;grid-template-columns:minmax(240px,330px) 1fr;min-height:0}" +
      ".rf-la-left{padding:1rem;border-right:1px solid #3a3346;display:flex;flex-direction:column;gap:.7rem;align-items:center;overflow:auto}" +
      ".rf-la-big{width:100%;max-width:300px;aspect-ratio:488/680;border-radius:14px;overflow:hidden;background:#0c0b12;border:1px solid #3a3346;box-shadow:0 14px 40px rgba(0,0,0,.55)}" +
      ".rf-la-big img{width:100%;height:100%;object-fit:cover;display:block}" +
      ".rf-la-meta{text-align:center;font-size:.95rem;line-height:1.3}.rf-la-meta b{display:block;color:#ecca7e;font-family:Cinzel,serif;font-size:.85rem}.rf-la-meta small{color:#9a91a8}" +
      ".rf-la-btn{width:100%;max-width:300px;border:1px solid #c9a24b;background:#c9a24b;color:#14121c;border-radius:999px;padding:.55rem 1rem;font-family:Cinzel,serif;font-weight:700;letter-spacing:.06em;cursor:pointer}" +
      ".rf-la-btn.sec{background:transparent;color:#ecca7e}.rf-la-btn:disabled{opacity:.45;cursor:default}" +
      ".rf-la-right{display:flex;flex-direction:column;min-height:0}" +
      ".rf-la-filters{display:flex;gap:.6rem;align-items:center;padding:.7rem 1rem;border-bottom:1px solid #3a3346;flex-wrap:wrap;font-size:.85rem}" +
      ".rf-la-filters input[type=text]{flex:1;min-width:160px;background:#0c0b12;border:1px solid #3a3346;color:#e9e1cf;border-radius:8px;padding:.4rem .6rem;font:inherit}" +
      ".rf-la-filters label{display:flex;gap:.35rem;align-items:center;cursor:pointer;color:#c9c0d4}" +
      ".rf-la-count{color:#9a91a8;font-size:.8rem}" +
      ".rf-la-grid{flex:1 1 0;min-height:0;overflow:auto;padding:1rem;display:grid;grid-template-columns:repeat(auto-fill,minmax(122px,1fr));grid-auto-rows:max-content;gap:.7rem;align-content:start}" +
      ".rf-la-cell{position:relative;border:2px solid transparent;border-radius:9px;overflow:hidden;cursor:pointer;background:#0c0b12;transition:transform .12s,border-color .12s}" +
      ".rf-la-cell:hover{transform:translateY(-3px);border-color:#6d5a2e}" +
      ".rf-la-cell.sel{border-color:#ecca7e;box-shadow:0 0 14px rgba(236,202,126,.55)}" +
      ".rf-la-cell img{width:100%;height:auto;aspect-ratio:488/680;object-fit:cover;display:block}" +
      ".rf-la-cell .cap{position:absolute;left:0;right:0;bottom:0;background:linear-gradient(transparent,rgba(0,0,0,.88));font-size:.68rem;padding:.9rem .35rem .25rem;color:#e9e1cf;font-family:Cinzel,serif;letter-spacing:.03em}" +
      ".rf-la-cell .on{position:absolute;right:5px;top:5px;background:#c9a24b;color:#14121c;border-radius:999px;font-size:.66rem;font-weight:700;padding:1px 7px;font-family:Cinzel,serif}" +
      ".rf-la-cell.def{display:flex;align-items:center;justify-content:center;text-align:center;font-family:Cinzel,serif;color:#c9c0d4;border:2px dashed #3a3346;font-size:.8rem;padding:.6rem}" +
      ".rf-la-msg{grid-column:1/-1;text-align:center;color:#9a91a8;padding:1rem}" +
      "@media (max-width:720px){.rf-la-body{grid-template-columns:1fr;grid-template-rows:auto 1fr}.rf-la-left{border-right:0;border-bottom:1px solid #3a3346;flex-direction:row;align-items:flex-start;padding:.7rem}.rf-la-big{width:110px;flex:none}.rf-la-left .rf-la-side{flex:1;display:flex;flex-direction:column;gap:.5rem}}";
    document.head.appendChild(st);
  }

  var printCache = {};
  /** All English paper printings of one basic land, newest first (Scryfall search, every page). */
  function landPrintings(type, fullArt, onProgress) {
    var key = type + (fullArt ? ":full" : "");
    if (printCache[key] && printCache[key].done) {
      onProgress(printCache[key].list, true);
      return;
    }
    if (printCache[key]) {
      printCache[key].listeners.push(onProgress);
      onProgress(printCache[key].list, false);
      return;
    }
    var entry = (printCache[key] = { list: [], done: false, listeners: [onProgress] });
    var q = '!"' + type + '" game:paper' + (fullArt ? " is:fullart" : "");
    var url = "https://api.scryfall.com/cards/search?unique=prints&order=released&dir=desc&q=" + encodeURIComponent(q);
    var step = function (u) {
      fetch(u, { headers: { Accept: "application/json" } })
        .then(function (r) {
          return r.json();
        })
        .then(function (res) {
          (res.data || []).forEach(function (c) {
            var iu = c.image_uris || (c.card_faces && c.card_faces[0] && c.card_faces[0].image_uris);
            if (!iu || c.digital) return;
            entry.list.push({
              id: c.id,
              img: iu.normal,
              small: iu.small,
              crop: iu.art_crop,
              set: c.set_name,
              code: c.set,
              year: (c.released_at || "").slice(0, 4),
              cn: c.collector_number,
              full: !!c.full_art,
            });
          });
          if (res.has_more && res.next_page) {
            entry.listeners.forEach(function (fn) {
              fn(entry.list, false);
            });
            setTimeout(function () {
              step(res.next_page);
            }, 120);
          } else {
            entry.done = true;
            entry.listeners.forEach(function (fn) {
              fn(entry.list, true);
            });
          }
        })
        .catch(function () {
          entry.done = true;
          entry.failed = true;
          entry.listeners.forEach(function (fn) {
            fn(entry.list, true);
          });
          delete printCache[key];
        });
    };
    step(url);
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function openLandPicker(startType) {
    ensureLandCss();
    var old = document.querySelector(".rf-la");
    if (old) old.remove();
    var type = LAND_TYPES.indexOf(startType) >= 0 ? startType : "Plains";
    var fullOnly = false;
    var query = "";
    var selected = null; // printing highlighted in the grid
    var token = 0;

    var root = el("div", "rf-la");
    var panel = el("div", "rf-la-panel");
    root.appendChild(panel);
    var top = el("div", "rf-la-top");
    top.appendChild(el("h3", null, "Land art"));
    var tabs = {};
    LAND_TYPES.forEach(function (t) {
      var b = el("button", "rf-la-tab");
      b.type = "button";
      b.addEventListener("click", function () {
        type = t;
        selected = null;
        render();
      });
      tabs[t] = b;
      top.appendChild(b);
    });
    var x = el("button", "rf-la-x", "✕");
    x.type = "button";
    x.title = "Close";
    top.appendChild(x);
    panel.appendChild(top);

    var body = el("div", "rf-la-body");
    var left = el("div", "rf-la-left");
    var big = el("div", "rf-la-big");
    var bigImg = el("img");
    bigImg.alt = "";
    big.appendChild(bigImg);
    var side = el("div", "rf-la-side");
    var meta = el("div", "rf-la-meta");
    var use = el("button", "rf-la-btn", "Use this art");
    use.type = "button";
    var reset = el("button", "rf-la-btn sec", "Default art");
    reset.type = "button";
    side.appendChild(meta);
    side.appendChild(use);
    side.appendChild(reset);
    left.appendChild(big);
    left.appendChild(side);

    var right = el("div", "rf-la-right");
    var filters = el("div", "rf-la-filters");
    var search = el("input");
    search.type = "text";
    search.placeholder = "Filter by set, code or year…";
    var fullLabel = el("label");
    var fullBox = el("input");
    fullBox.type = "checkbox";
    fullLabel.appendChild(fullBox);
    fullLabel.appendChild(document.createTextNode("Full art only"));
    var count = el("span", "rf-la-count");
    filters.appendChild(search);
    filters.appendChild(fullLabel);
    filters.appendChild(count);
    var grid = el("div", "rf-la-grid");
    right.appendChild(filters);
    right.appendChild(grid);
    body.appendChild(left);
    body.appendChild(right);
    panel.appendChild(body);
    document.body.appendChild(root);

    var close = function () {
      document.removeEventListener("keydown", onKey, true);
      root.remove();
    };
    var onKey = function (e) {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
      }
    };
    document.addEventListener("keydown", onKey, true);
    x.addEventListener("click", close);
    root.addEventListener("click", function (e) {
      if (e.target === root) close();
    });
    search.addEventListener("input", function () {
      query = search.value.trim().toLowerCase();
      drawGrid();
    });
    fullBox.addEventListener("change", function () {
      fullOnly = fullBox.checked;
      load();
    });
    use.addEventListener("click", function () {
      if (!selected) return;
      saveLandPick(type, { id: selected.id, img: selected.img, small: selected.small, crop: selected.crop, set: selected.set, code: selected.code, year: selected.year, cn: selected.cn });
      render();
    });
    reset.addEventListener("click", function () {
      saveLandPick(type, null);
      selected = null;
      render();
    });

    var list = [];
    var done = false;
    // The art without a choice: the Starter deck's own basic (the tray shows it), else phase.rs's default.
    var originalOf = function (t) {
      var im = document.querySelector('.pf-land-tray img[alt="' + t + '"]');
      var u = im ? im.getAttribute("data-rf-orig") || im.getAttribute("src") : "";
      return u && u.indexOf("cards.scryfall.io/") >= 0 ? u : null;
    };
    var defaultImg = function (t) {
      return originalOf(t) || "https://api.scryfall.com/cards/named?exact=" + encodeURIComponent(t) + "&format=image&version=normal";
    };
    var showPreview = function (p) {
      var cur = landPicks()[type];
      var shown = p || cur;
      bigImg.src = shown ? shown.img : defaultImg(type);
      meta.innerHTML = "";
      if (shown) {
        meta.appendChild(el("b", null, shown.set || ""));
        meta.appendChild(el("small", null, (shown.code || "").toUpperCase() + " · #" + (shown.cn || "") + " · " + (shown.year || "")));
      } else if (originalOf(type)) {
        meta.appendChild(el("b", null, "Starter deck " + type));
        meta.appendChild(el("small", null, "The printing that came with the deck"));
      } else {
        meta.appendChild(el("b", null, "Default " + type));
        meta.appendChild(el("small", null, "The art phase.rs picks"));
      }
    };
    var updateButtons = function () {
      var cur = landPicks()[type];
      use.disabled = !selected || (cur && cur.id === selected.id);
      use.textContent = selected && cur && cur.id === selected.id ? "In use ✓" : "Use this art";
      reset.disabled = !cur;
      reset.textContent = originalOf(type) ? "Back to the deck's art" : "Default art";
    };
    function drawGrid() {
      var cur = landPicks()[type];
      grid.innerHTML = "";
      var shown = list.filter(function (p) {
        return !query || (p.set + " " + p.code + " " + p.year).toLowerCase().indexOf(query) >= 0;
      });
      count.textContent = shown.length + (done ? "" : "+") + " arts";
      shown.forEach(function (p) {
        var c = el("div", "rf-la-cell" + (selected && selected.id === p.id ? " sel" : ""));
        var im = el("img");
        im.loading = "lazy";
        im.src = p.small;
        im.alt = p.set;
        c.appendChild(im);
        c.appendChild(el("div", "cap", p.code.toUpperCase() + " · " + p.year));
        if (cur && cur.id === p.id) c.appendChild(el("span", "on", "IN USE"));
        c.title = p.set + " (" + p.year + ") #" + p.cn + " — double-click to use";
        c.addEventListener("mouseenter", function () {
          showPreview(p);
        });
        c.addEventListener("mouseleave", function () {
          showPreview(selected);
        });
        c.addEventListener("click", function () {
          selected = p;
          var prev = grid.querySelector(".rf-la-cell.sel");
          if (prev) prev.classList.remove("sel");
          c.classList.add("sel");
          showPreview(p);
          updateButtons();
        });
        c.addEventListener("dblclick", function () {
          selected = p;
          use.click();
        });
        grid.appendChild(c);
      });
      if (!shown.length) grid.appendChild(el("div", "rf-la-msg", done ? (list.length ? "No art matches the filter." : "Could not reach Scryfall — try again later.") : "Loading arts…"));
      else if (!done) grid.appendChild(el("div", "rf-la-msg", "Loading more…"));
    }
    function load() {
      var my = ++token;
      list = [];
      done = false;
      drawGrid();
      landPrintings(type, fullOnly, function (l, fin) {
        if (my !== token) return;
        list = l.slice();
        done = fin;
        if (!selected) {
          var cur = landPicks()[type];
          if (cur)
            for (var i = 0; i < list.length; i++)
              if (list[i].id === cur.id) {
                selected = list[i];
                break;
              }
        }
        var y = grid.scrollTop;
        drawGrid();
        grid.scrollTop = y;
        updateButtons();
      });
    }
    function render() {
      var picks = landPicks();
      LAND_TYPES.forEach(function (t) {
        var b = tabs[t];
        b.className = "rf-la-tab" + (t === type ? " sel" : "");
        b.innerHTML = "";
        if (picks[t] && picks[t].crop) {
          var im = el("img");
          im.src = picks[t].crop;
          im.alt = "";
          b.appendChild(im);
        } else {
          var dot = el("i");
          dot.style.background = LAND_PIP[t];
          b.appendChild(dot);
        }
        b.appendChild(document.createTextNode(t));
      });
      showPreview(selected);
      updateButtons();
      load();
    }
    render();
  }

  var BASIC_SEL = LAND_TYPES.map(function (t) {
    return '.pf-root img[alt="' + t + '"]';
  }).join(",");
  /** Tray buttons + your chosen basic arts everywhere in the mode pages (deck builder, pools). */
  function scanLandTrays(force) {
    if (location.pathname.indexOf("/game/") === 0) return;
    var trays = document.querySelectorAll(".pf-land-tray");
    if (!trays.length && !force && !document.querySelector(".pf-root")) return;
    var picks = landPicks();
    for (var i = 0; i < trays.length; i++) {
      var tray = trays[i];
      var head = tray.querySelector(".lt-head");
      if (head && !head.querySelector(".rf-lt-head-btn")) {
        ensureLandCss();
        var hb = el("button", "rf-lt-head-btn", "🎨 Land art");
        hb.type = "button";
        hb.title = "Choose the art of each basic land";
        hb.addEventListener("click", function () {
          openLandPicker("Plains");
        });
        var sub = head.querySelector(".lt-sub");
        head.insertBefore(hb, sub);
      }
      var cards = tray.querySelectorAll(".lt-card");
      for (var j = 0; j < cards.length; j++) {
        var img = cards[j].querySelector(".lt-img img");
        if (!img) continue;
        var t = img.getAttribute("alt");
        var box = img.parentNode;
        if (!box.querySelector(".rf-lt-art")) {
          ensureLandCss();
          var b = el("button", "rf-lt-art", "🎨");
          b.type = "button";
          b.title = "Choose the " + t + " art";
          (function (tt) {
            var go = function (e) {
              e.preventDefault();
              e.stopPropagation();
              openLandPicker(tt);
            };
            b.addEventListener("click", go);
            img.addEventListener("click", go);
          })(t);
          box.appendChild(b);
        }
      }
    }
    // Every basic land image in the mode pages shows your chosen art.
    var imgs = document.querySelectorAll(BASIC_SEL);
    for (var k = 0; k < imgs.length; k++) {
      var im = imgs[k];
      var name = im.getAttribute("alt");
      var cur = im.getAttribute("src") || "";
      // data-rf-set = what we last wrote; anything else came from the page, so it is the original.
      if (cur !== im.getAttribute("data-rf-set")) im.setAttribute("data-rf-orig", cur);
      var orig = im.getAttribute("data-rf-orig") || cur;
      var pk = picks[name];
      var want = pk ? (/art_crop/.test(orig) ? pk.crop : pk.img) : orig;
      if (want && cur !== want) {
        im.setAttribute("data-rf-set", want);
        im.setAttribute("src", want);
      } else if (!pk) im.removeAttribute("data-rf-set");
    }
  }

  window.addEventListener("rf-cosmetics", function () {
    rewriteArt(document.body);
  });
  new MutationObserver(function (records) {
    scanZooms();
    scanLandTrays();
    scanGameOver();
    if (location.pathname.indexOf("/game/") === 0) {
      rebuildArtMap();
      for (var i = 0; i < records.length; i++) {
        var r = records[i];
        if (r.type === "attributes" && r.attributeName === "data-rf-owner") rewriteArt(r.target);
        else if (r.type === "attributes") rewriteEl(r.target);
        else for (var j = 0; j < r.addedNodes.length; j++) rewriteArt(r.addedNodes[j]);
      }
    }
  }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["src", "srcset", "style", "data-rf-owner"] });
})();

// 7. Online diagnostics: a 🐞 button bottom-left (hidden unless enabled) opens a log of what the
// online play does (rooms, codes, game start, errors), kept across pages in
// sessionStorage. Turn it off with localStorage "pt1-debug" = "0".
(function () {
  "use strict";
  var KEY = "pt1-diag";
  // The 🐞 button shows only with localStorage "pt1-debug" = "1" or "#debug" in the
  // address; the log and the red error banners always work.
  var on = /debug/.test(location.hash);
  try {
    if (on) localStorage.setItem("pt1-debug", "1");
    on = on || localStorage.getItem("pt1-debug") === "1";
  } catch (e) {}
  var lines = [];
  try {
    lines = JSON.parse(sessionStorage.getItem(KEY) || "[]");
  } catch (e) {}
  var panel = null;
  var btn = null;
  function stamp() {
    var d = new Date();
    return ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2) + ":" + ("0" + d.getSeconds()).slice(-2) + "." + ("00" + d.getMilliseconds()).slice(-3);
  }
  function log(m) {
    lines.push(stamp() + "  " + String(m).slice(0, 300));
    if (lines.length > 250) lines = lines.slice(-250);
    try {
      sessionStorage.setItem(KEY, JSON.stringify(lines));
    } catch (e) {}
    if (panel) render();
  }
  window.__pt1log = log;
  log("page " + location.pathname + location.search);

  // Route changes.
  ["pushState", "replaceState"].forEach(function (k) {
    var orig = history[k];
    history[k] = function () {
      var r = orig.apply(this, arguments);
      log("→ " + location.pathname + location.search);
      return r;
    };
  });
  window.addEventListener("popstate", function () {
    log("← " + location.pathname + location.search);
  });
  // Errors and warnings.
  window.addEventListener("error", function (e) {
    log("ERROR " + (e.message || e.error));
  });
  window.addEventListener("unhandledrejection", function (e) {
    var r = e.reason;
    log("REJECTED " + ((r && (r.message || r.type)) || r));
  });
  ["error", "warn"].forEach(function (k) {
    var orig = console[k];
    console[k] = function () {
      try {
        var parts = [];
        for (var i = 0; i < arguments.length; i++) {
          var a = arguments[i];
          parts.push(a instanceof Error ? a.message : typeof a === "object" ? (function () { try { return JSON.stringify(a).slice(0, 160); } catch (x) { return String(a); } })() : String(a));
        }
        var msg = parts.join(" ");
        if (!/Failed to load resource|favicon|DevTools/.test(msg)) log((k === "error" ? "console.error " : "console.warn ") + msg);
      } catch (e) {}
      return orig.apply(this, arguments);
    };
  });
  // The online play's own traces (console.debug "[P2P Host Adapter] …" etc.).
  ["debug", "log", "info"].forEach(function (k) {
    var orig = console[k];
    console[k] = function () {
      try {
        var first = String(arguments[0] || "");
        if (/P2P|Peer|PeerSession|Lobby|hosting|guest/i.test(first)) {
          var parts = [];
          for (var i = 0; i < arguments.length; i++) {
            var a = arguments[i];
            parts.push(a instanceof Error ? a.message : typeof a === "object" ? (function () { try { return JSON.stringify(a).slice(0, 200); } catch (x) { return String(a); } })() : String(a));
          }
          log(parts.join(" "));
        }
      } catch (e) {}
      return orig.apply(this, arguments);
    };
  });
  // How full the browser storage is (a full storage breaks saving the online game).
  try {
    var used = 0;
    var big = [];
    for (var si = 0; si < localStorage.length; si++) {
      var kk = localStorage.key(si);
      var vv = localStorage.getItem(kk) || "";
      used += kk.length + vv.length;
      big.push([kk, vv.length]);
    }
    big.sort(function (x, y) { return y[1] - x[1]; });
    log("storage: " + Math.round((used * 2) / 1024) + " KB in localStorage · biggest: " + big.slice(0, 4).map(function (b) { return b[0] + " " + Math.round((b[1] * 2) / 1024) + "KB"; }).join(", "));
  } catch (e) {
    log("storage: cannot read localStorage (" + e + ")");
  }
  // The multiplayer store (exposed by the mode pages): log what changes.
  var watched = false;
  function summary(st) {
    var slots = (st.playerSlots || [])
      .map(function (p) {
        return p && p.kind ? p.kind.type : "?";
      })
      .join(",");
    var toasts = [];
    if (st.toasts && st.toasts.forEach)
      st.toasts.forEach(function (t) {
        toasts.push(t.message);
      });
    return {
      hostingStatus: st.hostingStatus,
      hostGameCode: st.hostGameCode,
      pendingGameRoute: st.pendingGameRoute,
      activePlayerId: st.activePlayerId,
      slots: slots,
      toasts: toasts.join(" | "),
    };
  }
  function watch() {
    var store = window.__pt1mp;
    if (watched || !store || !store.subscribe) return;
    watched = true;
    var prev = summary(store.getState());
    log("multiplayer: " + JSON.stringify(prev));
    store.subscribe(function (st) {
      var cur = summary(st);
      var diff = [];
      for (var k in cur) if (cur[k] !== prev[k]) diff.push(k + "=" + JSON.stringify(cur[k]));
      if (cur.toasts && cur.toasts !== prev.toasts && location.pathname.indexOf("/game/") !== 0) banner(cur.toasts);
      prev = cur;
      if (diff.length) log("multiplayer: " + diff.join(" · "));
    });
  }
  setInterval(watch, 1000);
  // Online-play messages (errors…) also on the mode pages, where the game shows none.
  function banner(text) {
    var b = document.createElement("div");
    b.textContent = text;
    b.style.cssText = "position:fixed;left:50%;top:14px;transform:translateX(-50%);z-index:2147483645;max-width:min(92vw,640px);padding:10px 16px;border-radius:10px;background:#3a1414;border:1px solid #f19a8c;color:#ffe;font:14px/1.4 system-ui;box-shadow:0 6px 24px rgba(0,0,0,.5)";
    b.onclick = function () { b.remove(); };
    document.body.appendChild(b);
    setTimeout(function () { b.remove(); }, 10000);
  }

  // UI
  function render() {
    if (!panel) return;
    var pre = panel.querySelector("pre");
    pre.textContent = lines.slice(-120).join("\n");
    pre.scrollTop = pre.scrollHeight;
    var a = window.__pt1auto;
    panel.querySelector(".pt1-restart").style.display = a && a.role === "host" ? "" : "none";
    panel.querySelector(".pt1-retry").style.display = a && a.role === "guest" ? "" : "none";
  }
  function mkBtn(label, cls, fn) {
    var b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.className = cls;
    b.style.cssText = "margin:0 6px 6px 0;padding:6px 10px;border-radius:8px;border:1px solid #555;background:#1d1a26;color:#eee;font:12px system-ui";
    b.onclick = fn;
    return b;
  }
  function open() {
    if (panel) {
      panel.remove();
      panel = null;
      return;
    }
    panel = document.createElement("div");
    panel.style.cssText = "position:fixed;left:8px;right:8px;bottom:56px;max-width:720px;max-height:60vh;z-index:2147483646;background:rgba(10,9,16,.96);border:1px solid #c9a24b;border-radius:12px;padding:10px;color:#ddd;font:11px/1.35 ui-monospace,Menlo,monospace;display:flex;flex-direction:column";
    var bar = document.createElement("div");
    bar.appendChild(
      mkBtn("Copy", "", function () {
        var t = lines.join("\n");
        if (navigator.clipboard) navigator.clipboard.writeText(t).catch(function () {});
      }),
    );
    bar.appendChild(
      mkBtn("Clear", "", function () {
        lines = [];
        try {
          sessionStorage.removeItem(KEY);
        } catch (e) {}
        render();
      }),
    );
    bar.appendChild(
      mkBtn("⟳ New game room", "pt1-restart", function () {
        window.__pt1auto && window.__pt1auto.restart();
      }),
    );
    bar.appendChild(
      mkBtn("⟳ Join again", "pt1-retry", function () {
        window.__pt1auto && window.__pt1auto.retry();
      }),
    );
    bar.appendChild(mkBtn("Close", "", open));
    panel.appendChild(bar);
    var pre = document.createElement("pre");
    pre.style.cssText = "margin:0;overflow:auto;white-space:pre-wrap;word-break:break-word;flex:1";
    panel.appendChild(pre);
    document.body.appendChild(panel);
    render();
  }
  function addBtn() {
    if (!on || btn || !document.body) return;
    btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "🐞";
    btn.title = "Online diagnostics";
    btn.style.cssText = "position:fixed;left:8px;bottom:8px;z-index:2147483647;width:38px;height:38px;border-radius:50%;border:1px solid #c9a24b;background:rgba(10,9,16,.85);font-size:18px;line-height:36px;padding:0;cursor:pointer";
    btn.onclick = open;
    document.body.appendChild(btn);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", addBtn);
  else addBtn();
})();
