// Rogue Forge · Chess — the minigame, as a module mounted by the Chess page.
// Generated from the standalone test bench (chess-minigame.html) by build.py, then kept in sync by hand.
// One instance at a time. Logic randomness is seeded (both devices of an online game run the
// same engine in lockstep and only exchange the players' inputs).
/* eslint-disable */
// @ts-nocheck
const CSS = ".rfc{\n  --ink:#0d0b14;--ink2:#15121f;--panel:#1b1727;--edge:#3a3346;--gold:#c9a24b;--gold2:#ecca7e;--parch:#e9e1cf;--muted:#9a91a8;\n  --p0:#d9b25a;--p1:#7fb2ff;--W:#f3ecd2;--U:#4a90d9;--B:#9a7bbd;--R:#e0533c;--G:#4fb277;--C:#b9b2a6;\n  --cell:min(13.2vh,calc((100vw - 48px)/4.7),128px);--cw:calc(var(--cell)*.74);--ch:calc(var(--cell)*.98);\n}.rfc *{box-sizing:border-box}.rfc-root,.rfc-root{margin:0;background:radial-gradient(ellipse at 50% -10%,#2a2140 0%,var(--ink) 55%) fixed,var(--ink);color:var(--parch);font-family:\"EB Garamond\",Georgia,serif;min-height:100vh}.rfc button{font-family:inherit;cursor:pointer}.rfc h1,.rfc h2,.rfc h3{font-family:Cinzel,serif;font-weight:700;letter-spacing:.06em;margin:0}.rfc .hidden{display:none!important}.rfc .btn{border:1px solid var(--gold);background:linear-gradient(#e5c47a,#b98d35);color:#1a1408;border-radius:999px;padding:.55rem 1.2rem;font-family:Cinzel,serif;font-weight:700;letter-spacing:.06em;font-size:.82rem;box-shadow:0 6px 18px rgba(201,162,75,.25)}.rfc .btn:hover{filter:brightness(1.08)}.rfc .btn:disabled{opacity:.4;cursor:default;filter:none}.rfc .btn.sec{background:transparent;color:var(--gold2)}.rfc .btn.small{padding:.35rem .8rem;font-size:.72rem}.rfc .chip{border:1px solid var(--edge);background:var(--panel);color:var(--parch);border-radius:999px;padding:.3rem .7rem;font-size:.78rem}.rfc .chip.sel{border-color:var(--gold);color:var(--gold2);box-shadow:0 0 0 1px var(--gold) inset}.rfc select,.rfc input[type=number]{background:#0c0a12;border:1px solid var(--edge);color:var(--parch);border-radius:8px;padding:.4rem .5rem;font:inherit;font-size:.95rem;max-width:100%}.rfc label.f{display:flex;flex-direction:column;gap:.3rem;font-size:.72rem;text-transform:uppercase;letter-spacing:.12em;color:var(--gold)}.rfc .top{display:flex;align-items:center;gap:.8rem;padding:.55rem 1rem;border-bottom:1px solid #2a2436;background:rgba(10,9,16,.7);backdrop-filter:blur(6px);position:sticky;top:0;z-index:40;flex-wrap:wrap}.rfc .brand{font-family:Cinzel,serif;color:var(--gold2);letter-spacing:.14em;font-weight:900;font-size:.9rem;line-height:1.1}.rfc .brand small{display:block;color:var(--muted);font-size:.62rem;letter-spacing:.2em}.rfc .top .sp{flex:1}.rfc .turnpill{font-family:Cinzel,serif;font-size:.78rem;border:1px solid var(--edge);border-radius:999px;padding:.3rem .8rem;color:var(--muted)}.rfc .turnpill b{color:var(--gold2)}.rfc .screen{max-width:1100px;margin:0 auto;padding:1.4rem 1rem 3rem}.rfc .hero{text-align:center;margin:1rem 0 1.6rem}.rfc .hero .eyebrow{color:var(--gold);font-family:Cinzel,serif;letter-spacing:.3em;font-size:.72rem}.rfc .hero h1{font-size:clamp(2rem,6vw,3.4rem);font-weight:500;color:#f4ead6;text-shadow:0 0 30px rgba(236,202,126,.25)}.rfc .hero p{color:var(--muted);font-style:italic;max-width:640px;margin:.4rem auto 0}.rfc .panel{background:linear-gradient(180deg,#1d1829,#15121f);border:1px solid var(--edge);border-radius:16px;padding:1.1rem 1.2rem;box-shadow:0 18px 40px rgba(0,0,0,.35)}.rfc .grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1rem}.rfc .fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:.9rem}.rfc .row{display:flex;gap:.6rem;flex-wrap:wrap;align-items:center;justify-content:center;margin-top:1rem}.rfc .note{color:var(--muted);font-size:.9rem}.rfc .seg{display:flex;border:1px solid var(--edge);border-radius:999px;overflow:hidden}.rfc .seg button{flex:1;border:0;background:transparent;color:var(--muted);padding:.45rem .7rem;font-family:Cinzel,serif;font-size:.72rem;letter-spacing:.05em}.rfc .seg button.sel{background:linear-gradient(#e5c47a,#b98d35);color:#1a1408}.rfc .pack{display:flex;flex-wrap:wrap;gap:1.6rem .6rem;justify-content:center;perspective:1200px;margin:1rem 0 2.2rem}.rfc .mini{width:118px;aspect-ratio:488/680;border-radius:7px;position:relative;transform-style:preserve-3d;transition:transform .55s cubic-bezier(.3,.7,.3,1.2)}.rfc .mini .fc,.rfc .mini .bk{position:absolute;inset:0;border-radius:7px;backface-visibility:hidden;overflow:hidden}.rfc .mini .fc img{width:100%;height:100%;object-fit:cover;display:block}.rfc .mini .fc{transform:rotateY(180deg)}.rfc .mini.up{transform:rotateY(180deg)}.rfc .mini.r .fc{box-shadow:0 0 18px 3px rgba(236,202,126,.75)}.rfc .mini.m .fc{box-shadow:0 0 22px 5px rgba(255,120,40,.85)}.rfc .mini .tagr{position:absolute;bottom:-1.3rem;left:0;right:0;text-align:center;font-family:Cinzel,serif;font-size:.62rem;letter-spacing:.1em;color:var(--muted);transform:rotateY(180deg);backface-visibility:hidden}.rfc .dealin{animation:dealin .5s cubic-bezier(.2,.8,.3,1.1) backwards}@keyframes dealin{from{opacity:0;transform:translateY(-60px) rotate(-12deg) scale(.6)}}.rfc .cardback{background:radial-gradient(circle at 50% 42%,#6a4a1c 0,#3a2410 30%,#1a1209 70%),#1a1209;border:3px solid #2b1d0c;display:flex;align-items:center;justify-content:center}.rfc .cardback::before{content:\"\";width:58%;aspect-ratio:1;border-radius:50%;background:conic-gradient(var(--W),var(--U),var(--B),var(--R),var(--G),var(--W));opacity:.75;box-shadow:0 0 0 3px #2b1d0c,0 0 18px rgba(0,0,0,.6) inset;mask:radial-gradient(circle,transparent 46%,#000 47%)}.rfc .cardback.img{background:#111 center/cover no-repeat;border-color:#0c0a10}.rfc .cardback.img::before,.rfc .cardback.img::after{display:none}.rfc .prepwrap{display:flex;gap:1.2rem;align-items:flex-start;justify-content:center}.rfc .prepwrap>.prepmain{flex:1;min-width:0}.rfc .prepzoom{position:sticky;top:.6rem;width:270px;flex:none}.rfc .prepzoom:empty::before{content:\"Point at a card (click to pin it) to see what it does in the minigame.\";display:block;color:var(--muted);font-size:.85rem;font-style:italic;padding:1rem;border:1px dashed var(--edge);border-radius:12px}@media (max-width:900px){.rfc .prepwrap{flex-direction:column}.rfc .prepzoom{position:static;width:100%}}.rfc .cardback::after{content:\"RF\";position:absolute;font-family:Cinzel,serif;font-weight:900;color:#e9cf8f;font-size:120%;letter-spacing:.05em;text-shadow:0 2px 4px #000}.rfc .bins{display:grid;grid-template-columns:1fr;gap:.6rem}.rfc .bin{border:1px dashed var(--edge);border-radius:12px;padding:.5rem;min-height:120px;background:rgba(255,255,255,.02);transition:border-color .2s,background .2s}.rfc .bin.active{border-color:var(--gold);background:rgba(201,162,75,.07)}.rfc .bin h3{font-size:.78rem;color:var(--gold2);display:flex;justify-content:space-between;margin-bottom:.4rem;cursor:pointer}.rfc .bin .cards,.rfc .tray{display:flex;gap:.45rem;flex-wrap:wrap;min-height:96px}.rfc .tray{border:1px solid var(--edge);border-radius:12px;padding:.6rem;justify-content:center;background:#100e18}.rfc .pick{width:82px;aspect-ratio:488/680;border-radius:6px;overflow:hidden;position:relative;cursor:pointer;transition:transform .15s,box-shadow .15s;flex:none}.rfc .pick:hover{transform:translateY(-4px);box-shadow:0 8px 18px rgba(0,0,0,.5)}.rfc .pick img{width:100%;height:100%;object-fit:cover}.rfc .pick.fixedland{cursor:default;outline:2px solid var(--gold)}.rfc .pick .lbl{position:absolute;left:0;right:0;bottom:0;font-size:.6rem;background:rgba(0,0,0,.75);text-align:center;padding:1px;font-family:Cinzel,serif}.rfc .game{display:grid;grid-template-columns:minmax(220px,300px) auto minmax(250px,330px);gap:1rem;justify-content:center;align-items:start;padding:.8rem}@media (max-width:1100px){.rfc .game{grid-template-columns:minmax(0,1fr);justify-items:center}.rfc .boardwrap{order:1}.rfc .side.right{order:2;width:min(560px,100%)}.rfc .side.left{order:3;width:min(560px,100%)}.rfc .big{width:min(300px,64vw)}}.rfc .side{display:flex;flex-direction:column;gap:.8rem;min-width:0}.rfc .pile{background:var(--panel);border:1px solid var(--edge);border-radius:12px;padding:.5rem .6rem}.rfc .pile h3{font-size:.72rem;display:flex;justify-content:space-between;align-items:center}.rfc .pile.p0 h3{color:var(--p0)}.rfc .pile.p1 h3{color:var(--p1)}.rfc .pile .thumbs{display:flex;flex-wrap:wrap;gap:3px;margin-top:.4rem;min-height:34px}.rfc .pile .thumbs img{width:30px;aspect-ratio:488/680;border-radius:3px;object-fit:cover;cursor:zoom-in}.rfc .pile.turn{box-shadow:0 0 0 1px var(--gold),0 0 18px rgba(201,162,75,.25)}.rfc .boardwrap{display:flex;flex-direction:column;align-items:center;gap:.4rem;padding-right:calc(var(--cell)*.58)}.rfc .board{position:relative;width:calc(var(--cell)*4);height:calc(var(--cell)*6);border-radius:14px;box-shadow:0 0 0 2px #2a2238,0 30px 60px rgba(0,0,0,.6);background:#100d18;flex:none}.rfc .cells{position:absolute;inset:0;display:grid;grid-template-columns:repeat(4,1fr);grid-template-rows:repeat(6,1fr);border-radius:14px;overflow:hidden}.rfc .cell{position:relative;transition:background .2s}.rfc .cell.lt{background:rgba(255,255,255,.035)}.rfc .cell.zone1{box-shadow:inset 0 0 0 1px rgba(127,178,255,.06)}.rfc .cell.zone0{box-shadow:inset 0 0 0 1px rgba(217,178,90,.06)}.rfc .cell.hl-move::after,.rfc .cell.hl-attack::after,.rfc .cell.hl-swap::after,.rfc .cell.hl-own::after,.rfc .cell.hl-pick::after{content:\"\";position:absolute;inset:6%;border-radius:10px;animation:pulse 1.2s ease-in-out infinite;pointer-events:none}.rfc .cell.hl-move::after{border:2px solid #7fd69b;background:rgba(127,214,155,.12)}.rfc .cell.hl-attack::after{border:2px solid #ff6a55;background:rgba(255,90,70,.16)}.rfc .cell.hl-swap::after{border:2px dashed #7fb2ff;background:rgba(127,178,255,.12)}.rfc .cell.hl-own::after{border:2px dashed #e7b0ff;background:rgba(200,120,255,.12)}.rfc .cell.hl-pick::after{border:2px solid var(--gold2);background:rgba(236,202,126,.18)}.rfc .cell.hl-move,.rfc .cell.hl-attack,.rfc .cell.hl-swap,.rfc .cell.hl-own,.rfc .cell.hl-pick{cursor:pointer}@keyframes pulse{50%{opacity:.45;transform:scale(.96)}}.rfc .river{position:absolute;left:-2%;right:-2%;top:calc(50% - 2px);height:4px;background:linear-gradient(90deg,transparent,var(--gold) 20%,var(--gold2) 50%,var(--gold) 80%,transparent);opacity:.55;box-shadow:0 0 16px rgba(236,202,126,.5);pointer-events:none}.rfc .rowband{position:absolute;left:0;right:0;height:calc(100%/6);pointer-events:none;opacity:0;transition:opacity .4s}.rfc .rowband.on{opacity:1}.rfc .rowslot{position:absolute;right:calc(-1*var(--cell)*.52);width:calc(var(--cell)*.44);height:calc(var(--cell)*.62);border:1px dashed #3a3346;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:.6rem;color:#4a4256;overflow:hidden}.rfc .rowslot img{width:100%;height:100%;object-fit:cover}.rfc .rowslot.on{pointer-events:auto;cursor:zoom-in}.rfc .rowslot.on:hover{transform:scale(1.08);transition:transform .15s}.rfc .pinbar{text-align:center;font-size:.85rem;color:var(--gold2);display:flex;gap:.4rem;align-items:center;justify-content:center}.rfc .pile .thumbs img:hover{outline:1px solid var(--gold2)}.rfc .rowslot.on{border-style:solid;box-shadow:0 0 12px currentColor}.rfc .rowslot .kwi{position:absolute;bottom:2px;right:2px;background:rgba(0,0,0,.7);border-radius:50%;width:18px;height:18px;display:flex;align-items:center;justify-content:center;font-size:.7rem}.rfc .layer{position:absolute;inset:0;pointer-events:none}.rfc .fx{position:absolute;inset:0;pointer-events:none;overflow:visible;z-index:30}.rfc .card{position:absolute;width:calc(var(--cell));height:calc(var(--cell));transition:left .38s cubic-bezier(.4,.1,.2,1),top .38s cubic-bezier(.4,.1,.2,1);pointer-events:auto;cursor:pointer;z-index:5}.rfc .card.lift{z-index:20}.rfc .card .anim{position:absolute;inset:0;display:flex;align-items:center;justify-content:center}.rfc .card .rot{width:var(--cw);height:var(--ch);position:relative;transition:transform .35s ease,filter .35s}.rfc .card.tapped .rot{transform:rotate(90deg) scale(.72);filter:saturate(.55) brightness(.8)}.rfc .card .flip{position:absolute;inset:0;transform-style:preserve-3d;transition:transform .55s cubic-bezier(.3,.7,.3,1.15)}.rfc .card.down .flip{transform:rotateY(180deg)}.rfc .card .face{position:absolute;inset:0;border-radius:calc(var(--cw)*.06);backface-visibility:hidden;overflow:visible}.rfc .card .face.back{transform:rotateY(180deg);overflow:hidden}.rfc .card .face.front .art{position:absolute;inset:0;border-radius:inherit;overflow:hidden;background:#000}.rfc .card .face.front img{width:100%;height:100%;object-fit:cover;display:block}.rfc .card.o0 .face{box-shadow:0 0 0 2px var(--p0),0 6px 14px rgba(0,0,0,.55)}.rfc .card.o1 .face{box-shadow:0 0 0 2px var(--p1),0 6px 14px rgba(0,0,0,.55)}.rfc .card.sel .rot{animation:selglow 1.4s ease-in-out infinite}@keyframes selglow{50%{filter:drop-shadow(0 0 10px var(--gold2)) brightness(1.08)}}.rfc .card.peek .face.back .peekimg{display:block}.rfc .card.peek .cardback::after,.rfc .card.peek .cardback::before{opacity:0}.rfc .peekimg{display:none;position:absolute;inset:8%;border-radius:4px;overflow:hidden;opacity:.85;border:1px dashed var(--gold2)}.rfc .peekimg img{width:100%;height:100%;object-fit:cover;filter:sepia(.3)}.rfc .peekimg::after{content:\"\ud83d\udc41\";position:absolute;top:2px;right:3px;font-size:calc(var(--cw)*.16);text-shadow:0 0 4px #000}.rfc .gem{position:absolute;width:calc(var(--cw)*.3);height:calc(var(--cw)*.3);border-radius:50%;display:flex;align-items:center;justify-content:center;font:900 calc(var(--cw)*.18)/1 Cinzel,serif;color:#fff;text-shadow:0 1px 2px #000,0 0 3px #000;border:2px solid rgba(0,0,0,.55);z-index:3;transition:transform .2s}.rfc .gem.cmc{top:calc(var(--cw)*-.08);left:calc(var(--cw)*-.08);background:radial-gradient(circle at 35% 30%,#8cc4ff,#1f5bb0 70%)}.rfc .gem.cmc.down{background:radial-gradient(circle at 35% 30%,#ff9a8c,#9c2a1c 70%)}.rfc .gem.pow{bottom:calc(var(--cw)*-.08);left:calc(var(--cw)*-.08);background:radial-gradient(circle at 35% 30%,#ffe08a,#a8700f 70%)}.rfc .gem.hp{bottom:calc(var(--cw)*-.08);right:calc(var(--cw)*-.08);background:radial-gradient(circle at 35% 30%,#ff8a7a,#9c1c12 70%);border-radius:50% 50% 50% 8%}.rfc .gem.up{color:#a6ffbf}.rfc .gem.hurt{color:#ffb3a8}.rfc .gem.pop{animation:pop .45s}@keyframes pop{40%{transform:scale(1.5)}}.rfc .icons{position:absolute;top:calc(var(--cw)*.06);right:calc(var(--cw)*-.07);display:flex;flex-direction:column;gap:2px;z-index:3}.rfc .icons i{font-style:normal;width:calc(var(--cw)*.24);height:calc(var(--cw)*.24);border-radius:50%;background:rgba(10,8,16,.85);display:flex;align-items:center;justify-content:center;font-size:calc(var(--cw)*.14);border:1px solid currentColor}.rfc .badge{position:absolute;z-index:3;font-size:calc(var(--cw)*.16)}.rfc .badge.leg{top:calc(var(--cw)*-.16);left:50%;transform:translateX(-50%)}.rfc .badge.alt{bottom:calc(var(--cw)*.02);left:50%;transform:translateX(-50%);color:var(--gold2);text-shadow:0 0 6px #000}.rfc .badge.lock{top:40%;left:50%;transform:translate(-50%,-50%) rotate(-90deg);font-size:calc(var(--cw)*.3)}.rfc .colorring{position:absolute;inset:calc(var(--cw)*-.05);border-radius:calc(var(--cw)*.09);pointer-events:none;z-index:2;opacity:.9}.rfc .foil .art::after{content:\"\";position:absolute;inset:0;background:linear-gradient(115deg,transparent 20%,rgba(255,0,180,.35) 35%,rgba(0,255,230,.35) 45%,rgba(255,255,0,.3) 55%,transparent 70%);background-size:250% 250%;mix-blend-mode:color-dodge;animation:foil 3.5s linear infinite}@keyframes foil{from{background-position:120% 0}to{background-position:-120% 0}}.rfc .dmgflash{position:absolute;inset:0;border-radius:inherit;background:radial-gradient(circle,rgba(255,60,40,.85),rgba(255,0,0,0) 70%);opacity:0;pointer-events:none;z-index:4}.rfc .float{position:absolute;font:900 calc(var(--cell)*.26)/1 Cinzel,serif;color:#ff5a45;text-shadow:0 2px 0 #000,0 0 10px rgba(0,0,0,.8);transform:translate(-50%,-50%);white-space:nowrap;z-index:40}.rfc .float.buff{color:#8dff9f}.rfc .float.heal{color:#a6ffbf}.rfc .float.info{color:var(--gold2);font-size:calc(var(--cell)*.15);letter-spacing:.05em}.rfc .orb{position:absolute;width:calc(var(--cell)*.22);height:calc(var(--cell)*.22);border-radius:50%;transform:translate(-50%,-50%);z-index:40}.rfc .spark{position:absolute;width:6px;height:6px;border-radius:50%;z-index:40}.rfc .fxring{position:absolute;border-radius:50%;border:3px solid;transform:translate(-50%,-50%);z-index:39}.rfc .beam{position:absolute;width:calc(var(--cell)*.9);top:0;bottom:0;transform:translateX(-50%);z-index:3;border-radius:12px}.rfc .slash{position:absolute;height:6px;border-radius:3px;background:linear-gradient(90deg,transparent,#fff,transparent);transform-origin:center;z-index:41;box-shadow:0 0 12px #fff}.rfc .ghost{position:fixed;z-index:200;pointer-events:none;border-radius:6px;overflow:hidden}.rfc .ghost img{width:100%;height:100%;object-fit:cover}.rfc .zoom{display:flex;flex-direction:column;align-items:center;gap:.5rem}.rfc .big{width:min(300px,80vw);aspect-ratio:488/680;position:relative;border-radius:14px;flex:none}.rfc .big .art{position:absolute;inset:0;border-radius:14px;overflow:hidden;box-shadow:0 18px 40px rgba(0,0,0,.6)}.rfc .big .art img{width:100%;height:100%;object-fit:cover}.rfc .big .gem{width:56px;height:56px;font-size:28px}.rfc .big .gem.cmc{top:-12px;left:-12px}.rfc .big .gem.pow{bottom:-12px;left:-12px}.rfc .big .gem.hp{bottom:-12px;right:-12px}.rfc .hsbox{position:absolute;left:6.5%;right:6.5%;top:59.5%;bottom:5.2%;background:radial-gradient(ellipse at 50% 40%,#fbf3de,#e8d6ad);border-radius:12px;color:#2a1d0c;padding:6px 10px;display:flex;flex-direction:column;justify-content:center;gap:3px;text-align:center;font:600 13.5px/1.2 \"EB Garamond\",serif;box-shadow:inset 0 0 0 2px #b8955a,inset 0 0 12px rgba(120,80,20,.35),0 2px 6px rgba(0,0,0,.5);overflow:hidden;z-index:2}.rfc .hsbox .ln{display:block}.rfc .hsbox .kw{font-family:Cinzel,serif;font-weight:900;color:#6b1a0c;cursor:help;border-bottom:1px dotted #6b1a0c;font-size:12.5px;letter-spacing:.02em}.rfc .hsbox .pip{display:inline-block;width:10px;height:10px;border-radius:50%;margin:0 2px -1px 0;border:1px solid rgba(0,0,0,.4)}.rfc .hsbox .small{font-size:11.5px;color:#5b4528;font-style:italic}.rfc .zinfo{text-align:center;font-size:.92rem;color:var(--muted);max-width:300px}.rfc .zinfo b{color:var(--parch);font-family:Cinzel,serif;font-size:.9rem}.rfc .tip{position:fixed;z-index:300;max-width:260px;background:#0f0c17;border:1px solid var(--gold);border-radius:10px;padding:.5rem .7rem;font-size:.88rem;color:var(--parch);pointer-events:none;box-shadow:0 10px 30px rgba(0,0,0,.6)}.rfc .tip b{font-family:Cinzel,serif;color:var(--gold2);display:block;margin-bottom:.15rem;font-size:.8rem}.rfc .actions{background:var(--panel);border:1px solid var(--edge);border-radius:12px;padding:.7rem;display:flex;flex-direction:column;gap:.5rem}.rfc .actions .msg{font-size:1rem;text-align:center}.rfc .actions .msg b{color:var(--gold2)}.rfc .actions .btns{display:flex;flex-wrap:wrap;gap:.4rem;justify-content:center}.rfc .log{background:#0f0c17;border:1px solid var(--edge);border-radius:12px;padding:.5rem .7rem;max-height:210px;overflow:auto;font-size:.86rem;color:var(--muted)}.rfc .log div{padding:2px 0;border-bottom:1px solid #1d1828}.rfc .log .p0{color:var(--p0)}.rfc .log .p1{color:var(--p1)}.rfc .overlay{position:fixed;inset:0;z-index:100;background:rgba(5,4,9,.82);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;padding:16px}.rfc .sheet{background:#15121f;border:1px solid var(--gold);border-radius:16px;max-width:820px;width:100%;max-height:90vh;overflow:auto;padding:1.3rem 1.5rem;box-shadow:0 30px 90px rgba(0,0,0,.6)}.rfc .sheet h2{color:var(--gold2);margin-bottom:.6rem}.rfc .sheet h3{color:var(--gold2);font-size:.92rem;margin:1rem 0 .3rem}.rfc .sheet table{width:100%;border-collapse:collapse;font-size:.92rem}.rfc .sheet td,.rfc .sheet th{border-bottom:1px solid #2a2436;padding:.35rem .4rem;text-align:left;vertical-align:top}.rfc .sheet th{font-family:Cinzel,serif;font-size:.72rem;color:var(--gold);letter-spacing:.08em}.rfc .curtain{position:fixed;inset:0;z-index:150;background:radial-gradient(circle,#231b33,#08060c);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1rem;cursor:pointer;text-align:center}.rfc .curtain h1{font-size:2.4rem;color:var(--gold2)}.rfc .banner{position:fixed;left:50%;top:42%;transform:translate(-50%,-50%);z-index:160;font-family:Cinzel,serif;font-weight:900;font-size:clamp(2.2rem,8vw,5rem);color:var(--gold2);text-shadow:0 0 30px rgba(236,202,126,.6),0 4px 0 #3a2a10;pointer-events:none;white-space:nowrap}.rfc .confetti{position:fixed;width:9px;height:14px;z-index:159;pointer-events:none;top:-20px}.rfc .result-pools{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:1rem}.rfc .result-pools .thumbs{display:flex;flex-wrap:wrap;gap:4px}.rfc .result-pools img{width:56px;aspect-ratio:488/680;border-radius:4px;object-fit:cover}.rfc .toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#1d1829;border:1px solid var(--gold);color:var(--parch);padding:.55rem 1rem;border-radius:999px;z-index:120;font-size:.95rem;box-shadow:0 10px 30px rgba(0,0,0,.5)}.rfc .loading{display:inline-block;width:14px;height:14px;border:2px solid var(--gold);border-right-color:transparent;border-radius:50%;animation:spin 1s linear infinite;vertical-align:middle}@keyframes spin{to{transform:rotate(360deg)}}\n.rfc{color:var(--parch);font-family:'EB Garamond',Georgia,serif}.rfc-root{min-height:70vh;background:radial-gradient(ellipse at 50% -10%,#2a2140 0%,#0d0b14 55%);border-radius:14px}.rfc .top{position:relative;top:auto}";

/* =====================================================================
   Rogue Forge · Chess — minigame test bench (standalone).
   Cards come from Scryfall (real boosters of a set) or from a built-in
   offline demo set. No real Magic rules: each card is turned into a few
   simple, colour-based effects (see the guide).
   ===================================================================== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
let SPEED = 1;
let GEN = 0; // bumped on destroy: the loops of an unmounted game stop at their next pause
const sleep = (ms) => { const g = GEN; return new Promise((r) => setTimeout(() => { if (g === GEN) r(); }, ms / SPEED)); };
let RNG = Math.random; // seeded at mount: every logic draw must happen in the same order on both devices
const rnd = (n) => Math.floor(RNG() * n);
const vpick = (a) => a[Math.floor(Math.random() * a.length)];
const pick = (a) => a[rnd(a.length)];
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

const COLORS = ["W", "U", "B", "R", "G"];
const CNAME = { W: "White", U: "Blue", B: "Black", R: "Red", G: "Green", C: "Colourless" };
const CHEX = { W: "#f3ecd2", U: "#4a90d9", B: "#9a7bbd", R: "#e0533c", G: "#4fb277", C: "#b9b2a6" };
const KW = {
  W: { name: "Vigilance", icon: "🛡", short: "Attacks without tapping.", tip: "Attacking does not tap this creature." },
  U: { name: "Flying", icon: "🪽", short: "After attacking, may hop to an empty square.", tip: "After an attack (if it survives) it may move for free to an empty square it can reach." },
  B: { name: "Deathtouch", icon: "☠", short: "Its combat damage is lethal.", tip: "Any combat damage this creature deals destroys the other creature." },
  R: { name: "Rush", icon: "⚡", short: "No damage back when attacking.", tip: "When it attacks, the defender deals no damage back, even if untapped." },
  G: { name: "Regenerate", icon: "🌿", short: "Heals fully at end of turn.", tip: "At the end of every turn it recovers all lost health." },
};
const TRIG = { name: "Rally", icon: "📯", short: "Face up: your creatures in this column +1/+1 this turn (+2/+2 same colour).", tip: "When this card is turned face up, every creature of yours in the same column gets +1/+1 until end of turn, or +2/+2 if it shares this card's colour." };
const ACT = {
  W: { name: "Bless", icon: "✚", short: "Tap: +1/+1 counter on a creature in reach.", tip: "Tap this creature: put a permanent +1/+1 counter on a face-up creature it could reach with its movement (itself too)." },
  U: { name: "Shift", icon: "⇄", short: "Tap: swap two cards in reach.", tip: "Tap this creature: swap the positions of two cards it could reach with its movement." },
  B: { name: "Wither", icon: "✖", short: "Tap: −1/−1 counter on a creature in reach.", tip: "Tap this creature: put a −1/−1 counter on a face-up creature in reach. A creature at 0 health or less dies." },
  R: { name: "Ping", icon: "✷", short: "Tap: 1 damage to a creature in reach.", tip: "Tap this creature: deal 1 damage to a face-up creature in reach." },
  G: { name: "Growth", icon: "❋", short: "Tap: a creature in reach +3/+3 this turn.", tip: "Tap this creature: a face-up creature in reach (itself too) gets +3/+3 until end of turn." },
};
const SPELL = {
  W: { name: "Mend", icon: "✚", short: "Target creature gains X health.", tip: "The creature it lands on gains health equal to this spell's mana value (permanently)." },
  U: { name: "Freeze", icon: "❄", short: "Tap or untap a creature; tapped, it stays tapped X turns.", tip: "Taps an untapped creature (it can't untap for turns equal to the mana value) or untaps a tapped one." },
  B: { name: "Raise", icon: "⚰", short: "Return a creature (MV ≤ X) from your pile; it fights.", tip: "Brings back a creature with mana value up to this spell's from your pile of won cards. It appears where the spell was and attacks the target." },
  R: { name: "Burn", icon: "🔥", short: "X damage to a creature.", tip: "Deals damage equal to the mana value to the creature (yours too). It can kill." },
  G: { name: "Bite", icon: "🦷", short: "A face-up creature (MV ≤ X) deals its power to a creature in its own reach.", tip: "Land it on a face-up creature with mana value up to this spell's. That creature then deals damage equal to its power to a creature you choose among those it could reach with its own movement (yours too)." },
};
const RARITY_NAME = { c: "Common", u: "Uncommon", r: "Rare", m: "Mythic" };
const MOVE_TEXT = { c: "Forward, left, right", u: "Forward, back, left, right", r: "The 4 diagonals", m: "All 8 directions" };

/* ----------------------------------------------------------------- state */
let UID = 0;
const G = { cells: Array(24).fill(null), piles: [[], []], rowEnch: Array(6).fill(null), player: 0, turnNo: 1, over: null, mode: "ai", debug: false, names: ["Player 1", "Player 2"], ui: null, busy: false, log: [], curtain: true };
const rowOf = (p) => Math.floor(p / 4), colOf = (p) => p % 4, at = (r, c) => r * 4 + c;
const F = (i) => i.card.faces[i.face];
const T = (i) => F(i).types;
const isBasicLand = (i) => T(i).land && T(i).basic;
const isPW = (i) => T(i).planeswalker && !T(i).creature;
const isCreature = (i) => !!(T(i).creature || T(i).planeswalker);
const isSpell = (i) => !!(T(i).instant || T(i).sorcery);
const isArtifact = (i) => !!T(i).artifact;
const isEnch = (i) => !!T(i).enchantment;
const isAI = (p) => G.mode === "ai" && p === 1;
const isRemote = (p) => G.mode === "remote" && p !== G.me;
const isLocal = (p) => !isAI(p) && !isRemote(p);
const posOf = (uid) => G.cells.findIndex((x) => x && x.uid === uid);
const board = () => G.cells.filter(Boolean);
function makeInst(card, owner, fake) {
  const r = fake ? Math.random : RNG;
  return { uid: ++UID, card, owner, face: 0, faceUp: !!card.dfc, tapped: false, damage: 0, pc: 0, tc: 0, tp: 0, tt: 0, hb: 0, lock: 0, cmcMod: 0, known: [!!card.dfc, !!card.dfc], rot: Math.floor(r() * 5), rc: COLORS[Math.floor(r() * 5)], flippedOn: -1 };
}
function colorsOf(i) { const cs = F(i).colors; return cs.length ? cs : [i.rc]; }
function curColor(i) { const cs = colorsOf(i); return cs.length > 1 ? cs[(G.turnNo + i.rot) % cs.length] : cs[0]; }
function basePow(i) { return isPW(i) ? F(i).loyalty : F(i).power; }
function power(i) { return Math.max(0, basePow(i) + i.pc + i.tp); }
function maxHealth(i) { return (isPW(i) ? F(i).loyalty : F(i).toughness) + i.tc + i.tt + i.hb; }
function health(i) { return maxHealth(i) - i.damage; }
function cmcOf(i) { return Math.max(0, i.card.cmc + i.cmcMod); }
function kwSet(i) {
  const s = new Set();
  if (!isCreature(i)) return s;
  if (F(i).kw) s.add(curColor(i));
  const p = posOf(i.uid);
  if (p >= 0) { const e = G.rowEnch[rowOf(p)]; if (e && e.owner === i.owner) s.add(curColor(e.inst)); }
  return s;
}
const hasKwC = (i, c) => kwSet(i).has(c);
const canSee = (i, viewer) => G.debug || viewer === "all" || i.faceUp || i.known[viewer];
function viewer() { return G.mode === "ai" ? 0 : G.mode === "remote" ? G.me : G.player; }

/* movement */
function deltas(i) {
  const f = i.owner === 0 ? 1 : -1;
  if (!i.faceUp) return [[f, 0], [0, -1], [0, 1]];
  switch (i.card.rarity) {
    case "c": return [[f, 0], [0, -1], [0, 1]];
    case "u": return [[f, 0], [0, -1], [0, 1], [-f, 0]];
    case "r": return [[1, 1], [1, -1], [-1, 1], [-1, -1]];
    default: return [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  }
}
function reach(i, from) {
  const p = from ?? posOf(i.uid);
  const r = rowOf(p), c = colOf(p);
  return deltas(i).map(([dr, dc]) => [r + dr, c + dc]).filter(([R, C]) => R >= 0 && R < 6 && C >= 0 && C < 4).map(([R, C]) => at(R, C));
}
function neighbours8(p) {
  const out = [];
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    if (!dr && !dc) continue;
    const R = rowOf(p) + dr, C = colOf(p) + dc;
    if (R >= 0 && R < 6 && C >= 0 && C < 4) out.push(at(R, C));
  }
  return out;
}
function spellColor(i) { return curColor(i); }
function ownTargetOK(i, o) {
  if (!(o.faceUp || o.known[i.owner]) || !isCreature(o)) return false;
  if (isSpell(i)) return ["W", "U", "G", "R"].includes(spellColor(i));
  return false;
}
function moveTargets(i) {
  if (i.tapped || isBasicLand(i)) return [];
  const t = T(i);
  const canAttack = isCreature(i) || isSpell(i) || isArtifact(i);
  const out = [];
  for (const p of reach(i)) {
    const o = G.cells[p];
    if (!o) out.push({ p, kind: "move" });
    else if (o.owner !== i.owner) { if (canAttack) out.push({ p, kind: "attack" }); }
    else if (!isBasicLand(o) && (isArtifact(i) || (isSpell(i) && ownTargetOK(i, o)))) out.push({ p, kind: "own" });
  }
  return t ? out : [];
}
function swapTargets(i) {
  if (i.faceUp) return [];
  const p = posOf(i.uid);
  return neighbours8(p).filter((q) => { const o = G.cells[q]; return o && o.owner === i.owner && !o.faceUp; });
}

/* ---------------------------------------------------------------- render */
let cellsEl = null, cardsLayer = null, fxEl = null;
function bindRefs() { cellsEl = $("#cells"); cardsLayer = $("#cardsLayer"); fxEl = $("#fx"); }
const EL = new Map();
/* Each player sees their own side at the bottom: online, seat 2's device turns the board round. */
function flipped() { return G.mode === "remote" && G.me === 1; }
function vrow(r) { return flipped() ? r : 5 - r; }
function vcol(c) { return flipped() ? 3 - c : c; }
function buildBoard() {
  cellsEl.innerHTML = "";
  for (let vr = 0; vr < 6; vr++) for (let vc = 0; vc < 4; vc++) {
    const r = flipped() ? vr : 5 - vr, c = vcol(vc), p = at(r, c);
    const d = document.createElement("div");
    d.className = `cell ${(r + c) % 2 ? "lt" : ""} zone${r < 3 ? 0 : 1}`;
    d.dataset.p = p;
    d.addEventListener("click", () => onCell(p));
    cellsEl.appendChild(d);
  }
  const bands = $("#bands"); bands.innerHTML = "";
  const slots = $("#slots"); slots.innerHTML = "";
  for (let r = 0; r < 6; r++) {
    const b = document.createElement("div"); b.className = "rowband"; b.style.top = `${vrow(r) * 100 / 6}%`; b.dataset.r = r; bands.appendChild(b);
    const s = document.createElement("div"); s.className = "rowslot"; s.style.top = `calc(${vrow(r) * 100 / 6}% + var(--cell)*.18)`; s.dataset.r = r; s.textContent = "row"; slots.appendChild(s);
  }
}
function cellXY(p) { const r = rowOf(p), c = colOf(p); return { left: `calc(var(--cell)*${vcol(c)})`, top: `calc(var(--cell)*${vrow(r)})` }; }
function cellCenter(p) {
  const b = $("#board").getBoundingClientRect();
  const w = b.width / 4, h = b.height / 6;
  return { x: (vcol(colOf(p)) + 0.5) * w, y: (vrow(rowOf(p)) + 0.5) * h, w, h };
}
function cardEl(i) {
  let el = EL.get(i.uid);
  if (el) return el;
  el = document.createElement("div");
  el.className = "card";
  el.innerHTML = `<div class="anim"><div class="rot"><div class="colorring"></div><div class="flip"><div class="face front"><div class="art"><img alt=""></div><div class="dmgflash"></div><div class="gem cmc"></div><div class="gem pow"></div><div class="gem hp"></div><div class="icons"></div><span class="badge leg">👑</span><span class="badge alt">✦</span></div><div class="face back cardback"><div class="peekimg"><img alt=""></div></div></div><span class="badge lock">🔒</span></div></div>`;
  el.addEventListener("click", (e) => { e.stopPropagation(); togglePin({ inst: i }); const p = posOf(i.uid); if (p >= 0) onCell(p); });
  el.addEventListener("mouseenter", () => hoverZoom({ inst: i }));
  el.addEventListener("mouseleave", hoverOut);
  cardsLayer.appendChild(el);
  EL.set(i.uid, el);
  return el;
}
function gemUpdate(g, val, cls) {
  const old = g.textContent;
  g.textContent = val;
  g.className = g.className.replace(/\b(up|hurt|down)\b/g, "").trim() + (cls ? " " + cls : "");
  if (old !== "" && old !== String(val)) { g.classList.remove("pop"); void g.offsetWidth; g.classList.add("pop"); }
}
function abilityIcons(i) {
  const out = [];
  if (isCreature(i)) {
    for (const c of kwSet(i)) out.push([KW[c].icon, CHEX[c]]);
    if (F(i).trig) out.push([TRIG.icon, "#ecca7e"]);
    if (F(i).act) out.push([ACT[curColor(i)].icon, CHEX[curColor(i)]]);
  } else if (isSpell(i)) out.push([SPELL[spellColor(i)].icon, CHEX[spellColor(i)]]);
  else if (isArtifact(i)) out.push(["⚙", "#cfc6b8"]);
  else if (isEnch(i)) out.push([KW[curColor(i)].icon, CHEX[curColor(i)]]);
  return out;
}
/* Card backs: each player's own choice (G.backs[owner] = image URL, null = the Rogue Forge back). */
function applyBack(el, owner) {
  if (!el) return;
  const url = G.backs && G.backs[owner];
  const want = url ? `url("${url}")` : "";
  if (el.dataset.bk === want) return;
  el.dataset.bk = want;
  el.classList.toggle("img", !!url);
  el.style.backgroundImage = want;
}
function renderCard(i, v) {
  const el = cardEl(i);
  applyBack($(".face.back", el), i.owner);
  const p = posOf(i.uid);
  if (p < 0) return;
  const xy = cellXY(p);
  el.style.left = xy.left; el.style.top = xy.top;
  const vis = canSee(i, v);
  el.classList.toggle("o0", i.owner === 0); el.classList.toggle("o1", i.owner === 1);
  el.classList.toggle("down", !i.faceUp && !(G.debug || v === "all"));
  el.classList.toggle("peek", !i.faceUp && vis && !(G.debug || v === "all"));
  el.classList.toggle("tapped", i.tapped);
  el.classList.toggle("foil", !!i.card.foil && vis);
  el.classList.toggle("sel", !!(G.ui && G.ui.sel === i.uid));
  const img = $(".face.front img", el);
  const src = F(i).img;
  if (img.getAttribute("src") !== src) img.src = src;
  const pimg = $(".peekimg img", el); if (pimg.getAttribute("src") !== src) pimg.src = src;
  const showStats = vis;
  const cg = $(".gem.cmc", el), pg = $(".gem.pow", el), hg = $(".gem.hp", el);
  cg.style.display = showStats && !isBasicLand(i) ? "" : "none";
  gemUpdate(cg, cmcOf(i), i.cmcMod < 0 ? "down" : "");
  const cr = showStats && isCreature(i);
  pg.style.display = cr ? "" : "none"; hg.style.display = cr ? "" : "none";
  if (cr) {
    const k = i.dbl ? 2 : 1; // legendary vs non-legendary: stats doubled during the interaction
    gemUpdate(pg, power(i) * k, k > 1 || power(i) > basePow(i) ? "up" : "");
    gemUpdate(hg, health(i) * k, k > 1 ? "up" : i.damage > 0 ? "hurt" : maxHealth(i) > (isPW(i) ? F(i).loyalty : F(i).toughness) ? "up" : "");
  }
  $(".icons", el).innerHTML = showStats ? abilityIcons(i).map(([ic, col]) => `<i style="color:${col}">${ic}</i>`).join("") : "";
  $(".badge.leg", el).style.display = showStats && F(i).legendary ? "" : "none";
  $(".badge.alt", el).style.display = showStats && i.card.alt ? "" : "none";
  $(".badge.lock", el).style.display = i.lock > 0 ? "" : "none";
  const ring = $(".colorring", el);
  const cs = colorsOf(i);
  ring.style.boxShadow = showStats && cs.length > 1 && !isBasicLand(i) ? `0 0 0 2px ${CHEX[curColor(i)]}, 0 0 14px ${CHEX[curColor(i)]}` : "none";
}
function render() {
  const v = viewer();
  for (const i of board()) renderCard(i, v);
  for (const [uid, el] of EL) if (posOf(uid) < 0 && !el.dataset.dying) { el.remove(); EL.delete(uid); }
  // highlights
  $$(".cell").forEach((c) => c.classList.remove("hl-move", "hl-attack", "hl-swap", "hl-own", "hl-pick"));
  if (PROMPT && PROMPT.cells) for (const p of PROMPT.cells) $(`.cell[data-p="${p}"]`).classList.add("hl-pick");
  else if (G.ui && G.ui.targets) for (const t of G.ui.targets) $(`.cell[data-p="${t.p}"]`).classList.add("hl-" + t.kind);
  // enchant rows
  for (let r = 0; r < 6; r++) {
    const e = G.rowEnch[r];
    const s = $(`.rowslot[data-r="${r}"]`), b = $(`.rowband[data-r="${r}"]`);
    if (e) {
      const col = CHEX[curColor(e.inst)];
      s.classList.add("on"); s.style.color = col; s.innerHTML = `<img src="${F(e.inst).img}" alt=""><span class="kwi">${KW[curColor(e.inst)].icon}</span>`;
      s.title = `${F(e.inst).name}: ${G.names[e.owner]}'s creatures in this row have ${KW[curColor(e.inst)].name}`;
      s.onmouseenter = () => hoverZoom({ inst: e.inst });
      s.onmouseleave = hoverOut;
      s.onclick = () => togglePin({ inst: e.inst });
      b.classList.add("on"); b.style.background = `linear-gradient(90deg, ${col}22, ${col}0a 50%, ${col}22)`;
    } else { s.classList.remove("on"); s.innerHTML = ""; s.textContent = ""; s.title = ""; s.onmouseenter = s.onmouseleave = s.onclick = null; b.classList.remove("on"); }
  }
  // A pinned card keeps its zoom up to date (damage, counters, tapping…)
  if (ZPIN && ZPIN.inst && (posOf(ZPIN.inst.uid) >= 0 || G.rowEnch.some((e) => e && e.inst === ZPIN.inst))) zoomShow(ZPIN);
  for (const p of [0, 1]) {
    $(`#pname${p}`).textContent = G.names[p] + (G.player === p && !G.over ? " · to move" : "");
    $(`#pcount${p}`).textContent = `${G.piles[p].length} won`;
    $(`#pile${p} .thumbs`).innerHTML = G.piles[p].map((c, k) => `<img src="${c.faces[0].img}" alt="${esc(c.name)}" data-k="${k}" title="${esc(c.name)} · MV ${c.cmc}">`).join("");
    $(`#pile${p}`).classList.toggle("turn", G.player === p && !G.over);
    $$(`#pile${p} .thumbs img`).forEach((im) => {
      const card = G.piles[p][Number(im.dataset.k)];
      im.addEventListener("mouseenter", () => hoverZoom({ card }));
      im.addEventListener("mouseleave", hoverOut);
      im.addEventListener("click", () => togglePin({ card }));
    });
  }
  const tp = $("#turnpill");
  tp.classList.remove("hidden");
  tp.innerHTML = G.over ? `<b>${esc(G.names[G.over.winner])}</b> wins` : `Turn <b>${G.turnNo}</b> · <b>${esc(G.names[G.player])}</b>`;
  renderActions();
  // Inputs from the other device that arrived while this one was busy animating.
  if (INBOX.length && !pumping) setTimeout(pump, 0);
}

/* -------------------------------------------------- zoom with HS text box */
function pip(c) { return `<span class="pip" style="background:${CHEX[c]}"></span>`; }
function kwSpan(name, tip) { return `<span class="kw" data-tip="${esc(tip)}" data-tiptitle="${esc(name)}">${esc(name)}</span>`; }
function abilityLines(i) {
  const L = [];
  const cs = colorsOf(i), cc = curColor(i);
  const multi = F(i).colors.length > 1, colourless = !F(i).colors.length;
  if (isBasicLand(i)) return [`<span class="ln">${kwSpan("Home", "If an enemy card moves onto this land, its player wins the game.")}</span>`, `<span class="ln small">Can't move. Can be swapped while face down.</span>`];
  if (isCreature(i)) {
    if (isPW(i)) L.push(`<span class="ln">${kwSpan("Planeswalker", "Loyalty is both attack and health. It never deals or takes damage back in combat.")} · loyalty ${F(i).loyalty}</span>`);
    for (const c of kwSet(i)) L.push(`<span class="ln">${pip(c)}${kwSpan(KW[c].name, KW[c].tip)} — ${esc(KW[c].short)}</span>`);
    if (F(i).trig) L.push(`<span class="ln">${kwSpan(TRIG.name, TRIG.tip)} — ${esc(TRIG.short)}</span>`);
    if (F(i).act) L.push(`<span class="ln">${pip(cc)}${kwSpan(ACT[cc].name, ACT[cc].tip)} — ${esc(ACT[cc].short)}</span>`);
    if (!kwSet(i).size && !F(i).trig && !F(i).act) L.push(`<span class="ln small">A plain creature: fights with its power and health.</span>`);
  }
  if (isSpell(i)) {
    const c = spellColor(i);
    L.push(`<span class="ln">${pip(c)}${kwSpan(SPELL[c].name, SPELL[c].tip)} — ${esc(SPELL[c].short.replace("X", cmcOf(i)))}</span>`);
    if (c === "B" && G.piles && posOf(i.uid) >= 0) { const r = raiseInfo(i.owner, cmcOf(i)); L.push(`<span class="ln small">${r.ok.length ? "Ready to raise: " + r.ok.map((x) => esc(x.name.split(" // ")[0])).join(", ") : "Nothing to raise yet"}</span>`); }
  }
  if (isArtifact(i)) L.push(`<span class="ln">${kwSpan("Artifact", "Move it onto any card (yours too): that card's mana value drops by this card's. At 0 or less, the card is removed and goes to you. The artifact goes to that card's owner.")} — lowers a card's MV by ${cmcOf(i)}.</span>`);
  if (isEnch(i)) { const c = cc; L.push(`<span class="ln">${pip(c)}${kwSpan("Aura of the row", "When you turn it face up on your turn you may set it beside its row: your creatures in that row gain the keyword. One per row; a new one replaces the old.")} — your creatures in its row gain ${KW[c].name}.</span>`); }
  const ex = [];
  if (F(i).legendary) ex.push(kwSpan("Legendary", "Its stats are doubled when it fights or is hit by non-legendary cards."));
  if (i.card.alt) ex.push(kwSpan("Alt art", "When turned face up, its owner peeks at one card in its reach."));
  if (i.card.foil) ex.push(kwSpan("Foil", "When turned face up, its owner peeks at any card on the board."));
  if (i.card.dfc) ex.push(kwSpan("Double-faced", "Always face up. On your turn, when you select it, you may transform it once."));
  if (multi) ex.push(kwSpan("Multicolour", `Its colour rotates every turn: ${cs.join(" → ")}. Now ${CNAME[cc]}.`) + " " + cs.map((c) => `<span style="opacity:${c === cc ? 1 : 0.35}">${pip(c)}</span>`).join(""));
  if (colourless && !isBasicLand(i)) ex.push(kwSpan("Colourless", `Plays as a random colour: ${CNAME[cc]}.`));
  if (ex.length) L.push(`<span class="ln small">${ex.join(" · ")}</span>`);
  return L;
}
/* The zoom panel: beside the board in the game, beside the cards on the booster / rows screens. */
function zoomBox() { const pz = $("#prepZoom"); return pz && !$("#prep").classList.contains("hidden") ? pz : $("#zoom"); }
function showZoom(i) {
  const v = viewer();
  const z = zoomBox();
  if (!canSee(i, v)) {
    z.innerHTML = `<div class="big"><div class="art cardback ${G.backs && G.backs[i.owner] ? "img" : ""}" style="position:absolute;inset:0;${G.backs && G.backs[i.owner] ? `background-image:url('${G.backs[i.owner]}')` : ""}"></div></div><div class="zinfo"><b>Face-down card</b><br>${i.owner === (v === "all" ? -1 : v) ? "One of yours — select it to look at it." : "Your opponent's. Unknown."}</div>`;
    return;
  }
  const cr = isCreature(i);
  const p = posOf(i.uid);
  z.innerHTML = `<div class="big ${i.card.foil ? "foil" : ""}"><div class="art"><img src="${F(i).img}" alt=""></div>
    ${isBasicLand(i) ? "" : `<div class="gem cmc ${i.cmcMod < 0 ? "down" : ""}">${cmcOf(i)}</div>`}
    ${cr ? `<div class="gem pow ${power(i) > basePow(i) ? "up" : ""}">${power(i)}</div><div class="gem hp ${i.damage ? "hurt" : ""}">${health(i)}</div>` : ""}
    <div class="hsbox">${abilityLines(i).join("")}</div></div>
    <div class="zinfo"><b>${esc(F(i).name)}</b><br>${esc(F(i).type)} · ${RARITY_NAME[i.card.rarity]}${i.card.foil ? " · foil" : ""}${i.card.alt ? " · alternate art" : ""}<br>
    ${p < 0 && G.rowEnch.some((e) => e && e.inst === i) ? `Active beside row ${G.rowEnch.findIndex((e) => e && e.inst === i) + 1} · ${esc(G.names[i.owner])}'s creatures there have ${KW[curColor(i)].name}` : `Moves: ${i.faceUp ? MOVE_TEXT[i.card.rarity] : "face down: forward, left, right"}`}${i.tapped ? " · <span style='color:#ffb3a8'>tapped</span>" : ""}${i.lock ? ` · frozen ${i.lock}` : ""}${!i.faceUp ? " · <i>face down (hidden)</i>" : ""}
    <br>${readFrom(i)}</div>`;
}
/* Zoom panel: hovering shows a card after a short pause (so crossing other cards on the
   way to the panel does not replace it); clicking a card pins it until Esc / click again. */
let ZPIN = null, ZHOVER = 0;
function zoomShow(t) {
  if (t.inst) showZoom(t.inst); else showZoomCard(t.card);
  const pinned = ZPIN && (ZPIN.inst ? ZPIN.inst === t.inst : ZPIN.card === t.card);
  const z = zoomBox();
  const bar = document.createElement("div");
  bar.className = "pinbar";
  bar.innerHTML = pinned ? `📌 Pinned · <button class="chip" type="button">Unpin</button>` : `<span class="note">Click a card to pin it here</span>`;
  const b = bar.querySelector("button");
  if (b) b.onclick = () => { ZPIN = null; zoomShow(t); };
  z.appendChild(bar);
}
function hoverZoom(t) { clearTimeout(ZHOVER); if (ZPIN) return; ZHOVER = setTimeout(() => zoomShow(t), 280); }
function hoverOut() { clearTimeout(ZHOVER); }
function togglePin(t) {
  clearTimeout(ZHOVER);
  const same = ZPIN && (ZPIN.inst ? ZPIN.inst === t.inst : ZPIN.card === t.card);
  ZPIN = same ? null : t;
  zoomShow(t);
}
function onEsc(e) { if (e.key === "Escape" && ZPIN) { const t = ZPIN; ZPIN = null; zoomShow(t); } }
function showZoomCard(card) {
  const fake = makeInst(card, 0, true); fake.faceUp = true;
  const z = zoomBox();
  const f = card.faces[0];
  const cr = isCreature(fake);
  z.innerHTML = `<div class="big ${card.foil ? "foil" : ""}"><div class="art"><img src="${f.img}" alt=""></div>
    ${f.types.basic ? "" : `<div class="gem cmc">${card.cmc}</div>`}
    ${cr ? `<div class="gem pow">${power(fake)}</div><div class="gem hp">${health(fake)}</div>` : ""}
    <div class="hsbox">${abilityLines(fake).join("")}</div></div><div class="zinfo"><b>${esc(card.name)}</b><br>${esc(f.type)} · ${RARITY_NAME[card.rarity]} · MV ${card.cmc}<br>${readFrom(fake)}</div>`;
}
/* What the effects were generated from (to check the real card data). */
function readFrom(i) {
  const f = F(i);
  if (f.types.basic) return "";
  const bits = [`MV ${i.card.cmc}`];
  if (isCreature(i)) bits.push(isPW(i) ? `loyalty ${f.loyalty}` : `${f.power}/${f.toughness}`);
  bits.push(f.colors.length ? f.colors.join("") : "colourless");
  if (f.kwList && f.kwList.length) bits.push("keywords: " + f.kwList.join(", "));
  else if (f.kw) bits.push("keyword");
  if (f.trig) bits.push("triggered");
  if (f.act) bits.push("activated");
  if (f.legendary) bits.push("legendary");
  if (i.card.dfc) bits.push("double-faced");
  if (i.card.alt) bits.push("alt art");
  if (i.card.foil) bits.push("foil");
  return `<span style="font-size:.8rem">Read from the card: ${esc(bits.join(" · "))}</span>`;
}
let tipEl = null;
function onTipOver(e) {
  const t = e.target.closest && e.target.closest("[data-tip]");
  if (!t) { tipEl.classList.add("hidden"); return; }
  tipEl.innerHTML = `<b>${t.dataset.tiptitle || ""}</b>${t.dataset.tip}`;
  tipEl.classList.remove("hidden");
  const r = t.getBoundingClientRect();
  tipEl.style.left = Math.min(window.innerWidth - 270, Math.max(8, r.left)) + "px";
  tipEl.style.top = (r.bottom + 8) + "px";
}

/* ---------------------------------------------------------------- effects */
function fxAt(p, cls, html) {
  const c = cellCenter(p);
  const d = document.createElement("div");
  d.className = cls; d.innerHTML = html || "";
  d.style.left = c.x + "px"; d.style.top = c.y + "px";
  fxEl.appendChild(d);
  return d;
}
function floatText(p, text, kind = "") {
  const d = fxAt(p, "float " + kind, esc(text));
  d.animate([{ opacity: 0, transform: "translate(-50%,-30%) scale(.6)" }, { opacity: 1, transform: "translate(-50%,-80%) scale(1.15)", offset: 0.2 }, { opacity: 1, transform: "translate(-50%,-120%) scale(1)", offset: 0.7 }, { opacity: 0, transform: "translate(-50%,-160%) scale(.9)" }], { duration: 1300 / SPEED, easing: "ease-out" }).finished.then(() => d.remove());
}
function sparks(p, color, n = 14) {
  const c = cellCenter(p);
  for (let k = 0; k < n; k++) {
    const s = document.createElement("div"); s.className = "spark";
    s.style.background = color; s.style.boxShadow = `0 0 8px ${color}`;
    s.style.left = c.x + "px"; s.style.top = c.y + "px";
    fxEl.appendChild(s);
    const a = Math.random() * Math.PI * 2, d = 30 + Math.random() * c.w * 0.6;
    s.animate([{ transform: "translate(-50%,-50%) scale(1)", opacity: 1 }, { transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d}px)) scale(.2)`, opacity: 0 }], { duration: (500 + Math.random() * 400) / SPEED, easing: "cubic-bezier(.2,.7,.3,1)" }).finished.then(() => s.remove());
  }
}
function ring(p, color) {
  const c = cellCenter(p);
  const d = fxAt(p, "fxring");
  d.style.borderColor = color; d.style.boxShadow = `0 0 16px ${color}`;
  d.animate([{ width: "10px", height: "10px", opacity: 1 }, { width: c.w * 1.4 + "px", height: c.w * 1.4 + "px", opacity: 0 }], { duration: 650 / SPEED, easing: "ease-out" }).finished.then(() => d.remove());
}
async function projectile(from, to, color) {
  const a = cellCenter(from), b = cellCenter(to);
  const o = fxAt(from, "orb");
  o.style.background = `radial-gradient(circle, #fff, ${color} 45%, transparent 70%)`;
  o.style.boxShadow = `0 0 24px 8px ${color}`;
  const mid = { x: (a.x + b.x) / 2 + (b.y - a.y) * 0.25, y: (a.y + b.y) / 2 - Math.abs(b.x - a.x) * 0.25 - 30 };
  await o.animate([{ left: a.x + "px", top: a.y + "px", transform: "translate(-50%,-50%) scale(.6)" }, { left: mid.x + "px", top: mid.y + "px", transform: "translate(-50%,-50%) scale(1.3)" }, { left: b.x + "px", top: b.y + "px", transform: "translate(-50%,-50%) scale(1)" }], { duration: 520 / SPEED, easing: "ease-in" }).finished;
  o.remove();
  ring(to, color); sparks(to, color, 18);
}
function animOf(i) { return $(".anim", cardEl(i)); }
async function lunge(i, toP) {
  const from = posOf(i.uid);
  const a = cellCenter(from), b = cellCenter(toP);
  const el = cardEl(i); el.classList.add("lift");
  const dx = (b.x - a.x) * 0.62, dy = (b.y - a.y) * 0.62;
  await animOf(i).animate([{ transform: "translate(0,0) scale(1)" }, { transform: `translate(${-dx * 0.12}px,${-dy * 0.12}px) scale(1.06)`, offset: 0.35 }, { transform: `translate(${dx}px,${dy}px) scale(1.12) rotate(${dx > 0 ? 6 : -6}deg)`, offset: 0.7 }, { transform: "translate(0,0) scale(1)" }], { duration: 560 / SPEED, easing: "cubic-bezier(.5,0,.4,1)" }).finished;
  el.classList.remove("lift");
}
function slash(p) {
  const c = cellCenter(p);
  const d = fxAt(p, "slash");
  d.style.width = c.w * 0.9 + "px";
  d.style.transform = `translate(-50%,-50%) rotate(${-35 + Math.random() * 20}deg) scaleX(.1)`;
  d.animate([{ transform: d.style.transform, opacity: 1 }, { transform: d.style.transform.replace("scaleX(.1)", "scaleX(1.2)"), opacity: 0 }], { duration: 380 / SPEED, easing: "ease-out" }).finished.then(() => d.remove());
}
async function hit(i, amount, lethal) {
  const p = posOf(i.uid);
  if (p < 0) return;
  slash(p);
  const fl = $(".dmgflash", cardEl(i));
  fl.animate([{ opacity: 0 }, { opacity: 1 }, { opacity: 0 }], { duration: 420 / SPEED });
  animOf(i).animate([{ transform: "translate(0,0)" }, { transform: "translate(-7px,2px) rotate(-3deg)" }, { transform: "translate(6px,-2px) rotate(3deg)" }, { transform: "translate(-4px,1px)" }, { transform: "translate(0,0)" }], { duration: 380 / SPEED });
  floatText(p, lethal ? "☠" : `-${amount}`);
  sparks(p, "#ff7a55", 10);
}
async function flyToPile(i, toPlayer, kind) {
  const el = cardEl(i);
  el.dataset.dying = "1";
  const r = el.getBoundingClientRect();
  const pile = $(`#pile${toPlayer}`).getBoundingClientRect();
  const g = document.createElement("div"); g.className = "ghost";
  g.style.left = r.left + r.width * 0.13 + "px"; g.style.top = r.top + "px"; g.style.width = r.width * 0.74 + "px"; g.style.height = r.height * 0.98 + "px";
  g.innerHTML = `<img src="${F(i).img}" alt="">`;
  OVER.appendChild(g);
  el.style.visibility = "hidden";
  if (kind === "death") {
    sparks(posOf(i.uid) >= 0 ? posOf(i.uid) : 0, "#bbb", 22);
    await g.animate([{ transform: "scale(1) rotate(0)", filter: "brightness(1)" }, { transform: "scale(1.15) rotate(-8deg)", filter: "brightness(2) grayscale(1)", offset: 0.25 }, { transform: "scale(.9) rotate(4deg)", filter: "grayscale(1) brightness(.7)", offset: 0.45 }], { duration: 420 / SPEED, fill: "forwards" }).finished;
  }
  const tx = pile.left + pile.width / 2 - (r.left + r.width / 2), ty = pile.top + pile.height / 2 - (r.top + r.height / 2);
  await g.animate([{ transform: kind === "death" ? "scale(.9) rotate(4deg)" : "scale(1)", opacity: 1 }, { transform: `translate(${tx}px,${ty}px) scale(.25) rotate(${kind === "death" ? 200 : 0}deg)`, opacity: 0.2 }], { duration: 650 / SPEED, easing: "cubic-bezier(.5,0,.3,1)", fill: "forwards" }).finished;
  g.remove();
  el.remove(); EL.delete(i.uid);
}
function banner(text, ms = 1400) {
  const b = document.createElement("div"); b.className = "banner"; b.textContent = text;
  OVER.appendChild(b);
  b.animate([{ opacity: 0, transform: "translate(-50%,-50%) scale(.4)" }, { opacity: 1, transform: "translate(-50%,-50%) scale(1.08)", offset: 0.25 }, { opacity: 1, transform: "translate(-50%,-50%) scale(1)", offset: 0.75 }, { opacity: 0, transform: "translate(-50%,-50%) scale(1.3)" }], { duration: ms / SPEED }).finished.then(() => b.remove());
}
function confetti() {
  for (let k = 0; k < 90; k++) {
    const c = document.createElement("div"); c.className = "confetti";
    c.style.left = Math.random() * 100 + "vw"; c.style.background = vpick(Object.values(CHEX).concat(["#ecca7e", "#ecca7e"]));
    OVER.appendChild(c);
    c.animate([{ transform: `translateY(0) rotate(0)` }, { transform: `translate(${(Math.random() - 0.5) * 200}px, 110vh) rotate(${Math.random() * 900}deg)` }], { duration: 2200 + Math.random() * 1800, delay: Math.random() * 600, easing: "cubic-bezier(.3,.6,.5,1)" }).finished.then(() => c.remove());
  }
}
function toast(msg) {
  const t = document.createElement("div"); t.className = "toast"; t.textContent = msg;
  OVER.appendChild(t);
  setTimeout(() => t.remove(), 2200);
}
function log(html, p) {
  G.log.unshift(`<div class="${p === undefined ? "" : "p" + p}">${html}</div>`);
  $("#log").innerHTML = G.log.slice(0, 80).join("");
}
const nameOf = (i) => `<b>${esc(F(i).name)}</b>`;

/* --------------------------------------------------------------- prompts */
let PROMPT = null;
function promptChoice(player, title, options) {
  return new Promise((resolve) => { PROMPT = { player, title, options, resolve }; render(); });
}
function promptCell(player, title, cells, cancelLabel) {
  return new Promise((resolve) => { PROMPT = { player, title, cells, cancelLabel, resolve }; render(); });
}
/* The other device's answer to a prompt (remote games). */
function promptRemote(player, title, kind) {
  return new Promise((resolve) => { PROMPT = { player, title, remote: kind, resolve }; render(); });
}
function resolvePrompt(v) { const p = PROMPT; PROMPT = null; render(); p.resolve(v); }
async function ask(player, title, options, aiPick) {
  if (isAI(player)) { await sleep(350); return aiPick(); }
  if (isRemote(player)) { const k = await promptRemote(player, title, "opt"); return options[k] ? options[k].value : options[options.length - 1].value; }
  const v = await promptChoice(player, title, options);
  netSend({ k: "opt", i: options.findIndex((o) => o.value === v) });
  return v;
}
async function askCell(player, title, cells, aiPick, cancelLabel) {
  if (!cells.length) return null;
  if (isAI(player)) { await sleep(300); return aiPick(); }
  if (isRemote(player)) { const q = await promptRemote(player, title, "cell"); return q === null || cells.includes(q) ? q : null; }
  const q = await promptCell(player, title, cells, cancelLabel);
  netSend({ k: "cell", p: q === undefined ? null : q });
  return q;
}

/* ------------------------------------------------------------- the rules */
async function reveal(i, opts = {}) {
  if (i.faceUp) return;
  i.faceUp = true; i.known = [true, true];
  const p = posOf(i.uid);
  render();
  await sleep(560);
  if (p >= 0) { ring(p, CHEX[curColor(i)]); }
  log(`${nameOf(i)} is turned face up`, i.owner);
  // Rally
  if (isCreature(i) && F(i).trig && p >= 0) {
    const col = colOf(p);
    const beam = document.createElement("div"); beam.className = "beam";
    beam.style.left = `calc(var(--cell)*${vcol(col) + 0.5})`;
    beam.style.background = `linear-gradient(180deg, transparent, ${CHEX[curColor(i)]}55, transparent)`;
    fxEl.appendChild(beam);
    beam.animate([{ opacity: 0 }, { opacity: 1 }, { opacity: 0 }], { duration: 1100 / SPEED }).finished.then(() => beam.remove());
    for (let r = 0; r < 6; r++) {
      const o = G.cells[at(r, col)];
      if (!o || o.owner !== i.owner || !isCreature(o) || !o.faceUp) continue;
      const n = colorsOf(o).includes(curColor(i)) ? 2 : 1;
      o.tp += n; o.tt += n;
      floatText(at(r, col), `+${n}/+${n}`, "buff");
      sparks(at(r, col), "#9dffb0", 8);
    }
    log(`📯 Rally: ${esc(G.names[i.owner])}'s creatures in column ${col + 1} grow`, i.owner);
    render();
    await sleep(500);
  }
  // Alt art / foil: the owner peeks
  if (i.card.alt && p >= 0) await peekPrompt(i.owner, reach(i, p), `${F(i).name} (alt art): peek at a card in its reach`);
  if (i.card.foil) await peekPrompt(i.owner, G.cells.map((o, q) => q), `${F(i).name} (foil): peek at any card`);
  // Enchantment beside its row
  if (opts.allowEnchant && isEnch(i) && p >= 0 && !G.over) {
    const c = curColor(i);
    const yes = await ask(i.owner, `Set ${F(i).name} beside row ${rowOf(p) + 1}? Your creatures there gain ${KW[c].name}.`, [{ label: `Activate (${KW[c].icon} ${KW[c].name})`, value: true, primary: true }, { label: isCreature(i) ? "Keep it as a creature" : "Not now", value: false }], () => aiWantsEnchant(i));
    if (yes) await activateEnchant(i);
  }
}
async function peekPrompt(player, cells, title) {
  const cand = cells.filter((q) => { const o = G.cells[q]; return o && !o.faceUp && !o.known[player]; });
  if (!cand.length) return;
  const q = await askCell(player, title, cand, () => aiPeekPick(player, cand), "Skip");
  if (q === null || q === undefined) return;
  const o = G.cells[q];
  o.known[player] = true;
  ring(q, "#ecca7e");
  floatText(q, "👁", "info");
  if (player === viewer()) { ZPIN = { inst: o }; zoomShow(ZPIN); toast(`You saw: ${F(o).name}`); }
  log(`👁 ${esc(G.names[player])} peeks at a card`, player);
  render();
  await sleep(400);
}
async function activateEnchant(i) {
  const p = posOf(i.uid), r = rowOf(p);
  const old = G.rowEnch[r];
  const slot = $(`.rowslot[data-r="${r}"]`).getBoundingClientRect();
  const el = cardEl(i); const er = el.getBoundingClientRect();
  await animOf(i).animate([{ transform: "translate(0,0) scale(1)" }, { transform: `translate(${slot.left - er.left - er.width * 0.25}px, ${slot.top - er.top - er.height * 0.15}px) scale(.45)`, opacity: 0.9 }], { duration: 600 / SPEED, easing: "cubic-bezier(.4,0,.2,1)", fill: "forwards" }).finished;
  G.cells[p] = null; el.remove(); EL.delete(i.uid);
  if (old) { G.piles[i.owner].push(old.inst.card); log(`${nameOf(old.inst)} leaves its row and goes to ${esc(G.names[i.owner])}`, i.owner); }
  G.rowEnch[r] = { inst: i, owner: i.owner };
  log(`${KW[curColor(i)].icon} ${nameOf(i)} empowers row ${r + 1}: ${esc(G.names[i.owner])}'s creatures there gain ${KW[curColor(i)].name}`, i.owner);
  render();
  const band = $(`.rowband[data-r="${r}"]`);
  band.animate([{ filter: "brightness(3)" }, { filter: "brightness(1)" }], { duration: 900 / SPEED });
  await sleep(500);
}
async function removeCard(i, toPlayer, kind) {
  const p = posOf(i.uid);
  if (p < 0) return;
  await flyToPile(i, toPlayer, kind);
  G.cells[p] = null;
  G.piles[toPlayer].push(i.card);
  render();
}
async function moveTo(i, p) {
  const from = posOf(i.uid);
  G.cells[from] = null; G.cells[p] = i;
  cardEl(i).classList.add("lift");
  render();
  await sleep(400);
  cardEl(i).classList.remove("lift");
}
async function damage(target, amount, source, killerPlayer, { lethal = false, combat = false } = {}) {
  if (posOf(target.uid) < 0 || amount <= 0 && !lethal) return false;
  let dmg = amount;
  if (F(target).legendary && source && !F(source).legendary && !lethal) {
    dmg = Math.ceil(dmg / 2);
    if (!target.dbl) { floatText(posOf(target.uid), "👑 ×2 health", "info"); log(`👑 ${nameOf(target)} is legendary: ${amount} damage counts as ${dmg} (health doubled)`, target.owner); }
  }
  if (lethal) dmg = Math.max(dmg, health(target));
  target.damage += dmg;
  target.lastHitBy = killerPlayer;
  await hit(target, dmg, lethal && combat);
  render();
  return health(target) <= 0;
}
async function checkDeath(i, killer) {
  if (posOf(i.uid) >= 0 && isCreature(i) && health(i) <= 0) {
    log(`💀 ${nameOf(i)} dies and goes to ${esc(G.names[killer])}`, killer);
    await removeCard(i, killer, "death");
    return true;
  }
  return false;
}
function canDecline(wasHidden) { return wasHidden; }
/* Every creature at 0 health or less dies; it goes to whoever last hurt it (else the opponent). */
async function sweepDeaths() {
  for (const i of board()) {
    if (!i.faceUp || !isCreature(i) || health(i) > 0) continue;
    const to = i.lastHitBy ?? 1 - i.owner;
    log(`💀 ${nameOf(i)} falls to 0 and goes to ${esc(G.names[to])}`, to);
    await removeCard(i, to, "death");
  }
}

/* Creature combat. A attacks D. */
async function combat(A, D) {
  const pa = posOf(A.uid), pd = posOf(D.uid);
  const aLeg = F(A).legendary && !F(D).legendary, dLeg = F(D).legendary && !F(A).legendary;
  if (aLeg || dLeg) {
    for (const [X, on] of [[A, aLeg], [D, dLeg]]) if (on) { X.dbl = true; const q = posOf(X.uid); floatText(q, "👑 ×2", "info"); ring(q, "#ecca7e"); sparks(q, "#ecca7e", 12); }
    render();
    log(`👑 Legendary vs non-legendary: ${[aLeg ? A : null, dLeg ? D : null].filter(Boolean).map((x) => `${nameOf(x)} fights as ${power(x) * 2}/${health(x) * 2}`).join(", ")}`, A.owner);
    await sleep(650);
  }
  await lunge(A, pd);
  const powA = power(A) * (aLeg ? 2 : 1);
  const powD = power(D) * (dLeg ? 2 : 1);
  const back = !D.tapped && !hasKwC(A, "R") && !isPW(A) && !isPW(D);
  const dtA = hasKwC(A, "B") && powA > 0, dtD = hasKwC(D, "B") && powD > 0 && back;
  if (powA > 0 || dtA) await damage(D, powA, A, A.owner, { lethal: dtA, combat: true });
  if (back && (powD > 0 || dtD)) { await sleep(120); await damage(A, powD, D, D.owner, { lethal: dtD, combat: true }); }
  else if (!back) floatText(pa, D.tapped ? "no block" : hasKwC(A, "R") ? "rush!" : "", "info");
  log(`⚔ ${nameOf(A)} (${powA}) attacks ${nameOf(D)} (${powD})${back ? "" : " — no damage back"}`, A.owner);
  if (!hasKwC(A, "W")) A.tapped = true; else floatText(pa, "vigilance", "info");
  render();
  await sleep(250);
  A.dbl = false; D.dbl = false;
  render();
  const dDead = await checkDeath(D, A.owner);
  const aDead = await checkDeath(A, D.owner);
  if (dDead && !aDead) await moveTo(A, pd);
  if (!aDead && hasKwC(A, "U")) {
    const empty = reach(A).filter((q) => !G.cells[q]);
    if (empty.length) {
      const q = await askCell(A.owner, `${F(A).name} has Flying: hop to an empty square?`, empty, () => aiFlyPick(A, empty), "Stay");
      if (q !== null && q !== undefined) { await moveTo(A, q); floatText(q, "🪽", "info"); }
    }
  }
}
/* A creature lands on a non-creature: it takes it and moves in (untapped). */
async function takeOver(A, D) {
  const pd = posOf(D.uid);
  await lunge(A, pd);
  log(`${nameOf(A)} captures ${nameOf(D)}`, A.owner);
  await removeCard(D, A.owner, "take");
  await moveTo(A, pd);
}
function validSpellTarget(color, X, caster, target, spellPos) {
  if (!target || !isCreature(target)) return color === "B" ? false : false;
  switch (color) {
    case "W": case "U": case "R": return true;
    case "B": return target.owner !== caster && G.piles[caster].some((c) => isCreatureCard(c) && c.cmc <= X);
    case "G": return target.faceUp && cmcOf(target) <= X && biteVictims(target).length > 0;
    default: return false;
  }
}
/* Raise (black spells): which creatures of your pile of won cards can come back. */
function raiseInfo(player, X) {
  const creatures = G.piles[player].filter((c) => isCreatureCard(c));
  return { ok: creatures.filter((c) => c.cmc <= X), tooBig: creatures.filter((c) => c.cmc > X) };
}
function raiseWhyNot(player, X) {
  const r = raiseInfo(player, X);
  if (r.ok.length) return "";
  if (!r.tooBig.length) return "your pile of won cards has no creature to raise yet";
  return `it raises creatures with mana value ${X} or less — in your pile: ${r.tooBig.map((c) => `${c.name.split(" // ")[0]} (MV ${c.cmc})`).join(", ")}`;
}
/* Bite: the biting creature hits a face-up creature in its own movement reach. */
function biteVictims(src) {
  if (posOf(src.uid) < 0) return [];
  return reach(src).filter((q) => { const o = G.cells[q]; return o && o !== src && isCreature(o) && o.faceUp; });
}
function isCreatureCard(c) { const t = c.faces[0].types; return !!(t.creature || t.planeswalker); }
/* Cast a spell's colour effect. Returns once resolved. */
async function castEffect(color, X, caster, target, fromPos, srcInst) {
  const tp = posOf(target.uid);
  const col = CHEX[color];
  await projectile(fromPos, tp, col);
  switch (color) {
    case "W":
      target.hb += X; floatText(tp, `+${X} ♥`, "heal"); sparks(tp, "#fff6c8", 16);
      log(`✚ ${nameOf(target)} gains ${X} health`, caster); break;
    case "U": {
      if (target.tapped) { target.tapped = false; target.lock = 0; floatText(tp, "untap", "info"); log(`❄ ${nameOf(target)} is untapped`, caster); }
      else { target.tapped = true; target.lock = X; floatText(tp, `❄ ${X}`, "info"); log(`❄ ${nameOf(target)} is frozen for ${X} turns`, caster); }
      break;
    }
    case "R": {
      log(`🔥 ${X} damage to ${nameOf(target)}`, caster);
      await damage(target, X, srcInst, caster);
      await checkDeath(target, caster);
      break;
    }
    case "G": {
      const victims = biteVictims(target);
      const vq = await askCell(caster, `${F(target).name} bites: choose the creature it hits (${power(target)} damage)`, victims, () => aiBitePick(caster, target, victims));
      if (vq === null || vq === undefined) break;
      const V = G.cells[vq];
      await lunge(target, vq);
      log(`🦷 ${nameOf(target)} bites ${nameOf(V)} for ${power(target)}`, caster);
      await damage(V, power(target), target, caster, { lethal: hasKwC(target, "B") && power(target) > 0 });
      await checkDeath(V, caster);
      break;
    }
    case "B": break;
  }
  render();
}
async function raiseDead(caster, X, atPos) {
  const cands = G.piles[caster].map((c, k) => ({ c, k })).filter(({ c }) => isCreatureCard(c) && c.cmc <= X);
  if (!cands.length) return null;
  let choice;
  if (isAI(caster)) choice = cands.sort((a, b) => (b.c.faces[0].power + b.c.faces[0].toughness) - (a.c.faces[0].power + a.c.faces[0].toughness))[0];
  else {
    const k = await ask(caster, "Raise which creature from your pile?", cands.map(({ c, k }) => ({ label: `${c.name} (${c.faces[0].power}/${c.faces[0].toughness}, MV ${c.cmc})`, value: k })), () => cands[0].k);
    choice = cands.find((x) => x.k === k) || cands[0];
  }
  G.piles[caster].splice(choice.k, 1);
  const inst = makeInst({ ...choice.c, foil: false }, caster);
  inst.faceUp = true; inst.known = [true, true];
  G.cells[atPos] = inst;
  render();
  const el = cardEl(inst);
  animOf(inst).animate([{ transform: "translateY(30px) scale(.3)", opacity: 0, filter: "brightness(3)" }, { transform: "translateY(0) scale(1)", opacity: 1, filter: "brightness(1)" }], { duration: 650 / SPEED, easing: "cubic-bezier(.2,.8,.3,1.2)" });
  sparks(atPos, "#b48cff", 20);
  log(`⚰ ${nameOf(inst)} rises from ${esc(G.names[caster])}'s pile`, caster);
  await sleep(650);
  void el;
  return inst;
}

/* Something moved onto a card. */
async function interact(A, targetPos) {
  const D = G.cells[targetPos];
  const own = D.owner === A.owner;
  const wasHidden = !A.faceUp || !D.faceUp;
  // Basic land: game over
  if (!own && isBasicLand(D)) {
    await lunge(A, targetPos);
    if (!D.faceUp) { D.faceUp = true; D.known = [true, true]; render(); await sleep(500); }
    return win(A.owner, `${F(A).name} reaches ${G.names[D.owner]}'s ${F(D).name}`);
  }
  if (!A.faceUp) await reveal(A);
  if (!D.faceUp) await reveal(D);
  if (posOf(A.uid) < 0 || posOf(D.uid) < 0) return;
  // Which way does the mover act?
  const modes = [];
  if (isCreature(A)) modes.push("creature");
  if (isSpell(A)) modes.push("spell");
  if (isArtifact(A)) modes.push("artifact");
  let mode = modes[0];
  if (modes.length > 1) mode = await ask(A.owner, `How does ${F(A).name} act?`, modes.map((m) => ({ label: m === "creature" ? "⚔ As a creature" : m === "spell" ? `✦ As a spell (${SPELL[spellColor(A)].name})` : `⚙ As an artifact (−${cmcOf(A)} MV)`, value: m })), () => aiModePick(A, D, modes));
  if (!mode) { log(`${nameOf(A)} can't act on ${nameOf(D)}`, A.owner); return; }
  // Defender's instant answers first
  if (!own && T(D).instant) {
    const c = spellColor(D), X = cmcOf(D);
    const targets = board().filter((o) => o !== D && validSpellTarget(c, X, D.owner, o, targetPos)).map((o) => posOf(o.uid));
    const canB = c === "B" && G.piles[D.owner].some((x) => isCreatureCard(x) && x.cmc <= X);
    if (targets.length || canB) {
      const go = await ask(D.owner, `Cast ${F(D).name} (${SPELL[c].name}) before the attack?`, [{ label: `Cast ${SPELL[c].icon} ${SPELL[c].name}`, value: true, primary: true }, { label: "Let it be taken", value: false }], () => aiReact(D, A, targets));
      if (go) {
        const dpos = targetPos;
        log(`⚡ ${esc(G.names[D.owner])} answers with ${nameOf(D)}`, D.owner);
        if (c === "B") {
          await removeCard(D, D.owner, "take");
          const raised = await raiseDead(D.owner, X, dpos);
          if (raised && posOf(A.uid) >= 0) {
            if (mode === "creature") await combat(A, raised);
            else await resolveNonCreature(A, raised, mode, false);
          }
          return;
        }
        const tq = await askCell(D.owner, `Target for ${F(D).name}`, targets, () => aiSpellTarget(c, X, D.owner, targets, A));
        if (tq !== null && tq !== undefined) await castEffect(c, X, D.owner, G.cells[tq], dpos, D);
        await removeCard(D, D.owner, "take");
        if (posOf(A.uid) >= 0 && !G.over) { if (!A.tapped || mode !== "creature") await moveTo(A, dpos); }
        return;
      }
    }
  }
  if (mode === "creature") {
    if (isCreature(D)) await combat(A, D);
    else await takeOver(A, D);
    return;
  }
  await resolveNonCreature(A, D, mode, wasHidden);
}
async function resolveNonCreature(A, D, mode, wasHidden) {
  const pa = posOf(A.uid), pd = posOf(D.uid);
  const own = D.owner === A.owner;
  if (mode === "artifact") {
    const X = Math.max(1, cmcOf(A));
    await lunge(A, pd);
    const gear = fxAt(pd, "float info", "⚙");
    gear.animate([{ transform: "translate(-50%,-50%) rotate(0) scale(.5)", opacity: 0 }, { transform: "translate(-50%,-50%) rotate(360deg) scale(1.4)", opacity: 1 }, { transform: "translate(-50%,-50%) rotate(540deg) scale(.5)", opacity: 0 }], { duration: 900 / SPEED }).finished.then(() => gear.remove());
    const before = cmcOf(D);
    D.cmcMod -= X;
    floatText(pd, `−${X} MV`, "info");
    log(`⚙ ${nameOf(A)} grinds ${nameOf(D)}: MV ${before} → ${D.card.cmc + D.cmcMod}. The artifact goes to ${esc(G.names[D.owner])}`, A.owner);
    render();
    await sleep(350);
    await removeCard(A, D.owner, "take");
    if (D.card.cmc + D.cmcMod <= 0) { log(`${nameOf(D)} crumbles to 0 and goes to ${esc(G.names[A.owner])}`, A.owner); await removeCard(D, A.owner, "death"); }
    return;
  }
  // spell
  const c = spellColor(A), X = cmcOf(A);
  const valid = c === "B" ? (!own && G.piles[A.owner].some((x) => isCreatureCard(x) && x.cmc <= X)) : validSpellTarget(c, X, A.owner, D, pa);
  let cast = true;
  const why = valid ? "" : c === "B" ? (own ? "Raise only works on an enemy card" : raiseWhyNot(A.owner, X)) : `${SPELL[c].name} needs ${c === "G" ? `a face-up creature with mana value ${X} or less that has a face-up creature in its reach to hit` : "a creature"}`;
  if (!valid && !isAI(A.owner)) toast(`${F(A).name}: ${why}`);
  if (wasHidden) {
    cast = await ask(A.owner, valid ? `Cast ${F(A).name} (${SPELL[c].name}) on ${F(D).name}?` : `${F(A).name} can't use ${SPELL[c].name} here: ${why}. ${isCreature(D) ? "Use it up anyway?" : `Use it anyway to capture ${F(D).name}?`}`, [{ label: valid ? `Cast ${SPELL[c].icon} ${SPELL[c].name}` : isCreature(D) ? "Use it up (no effect)" : "Capture it", value: true, primary: true }, { label: "Don't — stay put", value: false }], () => aiCast(A, D, valid));
  }
  if (!valid) log(`${nameOf(A)} — no ${SPELL[c].name}: ${esc(why)}`, A.owner);
  if (!cast) { log(`${nameOf(A)} holds back`, A.owner); return; }
  if (valid && c === "B") {
    log(`✦ ${nameOf(A)} — ${SPELL[c].name}`, A.owner);
    await projectile(pa, pd, CHEX.B);
    await removeCard(A, A.owner, "take");
    const raised = await raiseDead(A.owner, X, pa);
    if (raised && posOf(D.uid) >= 0) { if (isCreature(D)) await combat(raised, D); else await takeOver(raised, D); }
    return;
  }
  if (valid) { log(`✦ ${nameOf(A)} — ${SPELL[c].name} on ${nameOf(D)}`, A.owner); await castEffect(c, X, A.owner, D, pa, A); }
  else { await lunge(A, pd); }
  if (posOf(A.uid) >= 0) await removeCard(A, A.owner, "take");
  if (!own && posOf(D.uid) >= 0 && !isCreature(D)) { log(`${nameOf(D)} is captured by ${esc(G.names[A.owner])}`, A.owner); await removeCard(D, A.owner, "take"); }
}
/* Activated ability of a face-up creature (taps it). */
function abilityTargets(i) {
  const c = curColor(i);
  const cells = reach(i).concat(c === "W" || c === "G" ? [posOf(i.uid)] : []);
  if (c === "U") return cells.filter((q) => G.cells[q] && G.cells[q] !== i);
  return cells.filter((q) => { const o = G.cells[q]; return o && isCreature(o) && o.faceUp; });
}
async function useAbility(i) {
  const c = curColor(i), p = posOf(i.uid);
  const cells = abilityTargets(i);
  if (c === "U") {
    if (cells.length < 2) return false;
    const a = await askCell(i.owner, "Shift: first card to swap", cells, () => aiShiftPick(i, cells)[0], "Cancel");
    if (a === null || a === undefined) return false;
    const b = await askCell(i.owner, "Shift: second card", cells.filter((q) => q !== a), () => aiShiftPick(i, cells)[1], "Cancel");
    if (b === null || b === undefined) return false;
    i.tapped = true;
    ring(p, CHEX.U);
    const A = G.cells[a], B = G.cells[b];
    G.cells[a] = B; G.cells[b] = A;
    render(); await sleep(450);
    log(`⇄ ${nameOf(i)} shifts two cards`, i.owner);
    return true;
  }
  const q = await askCell(i.owner, `${ACT[c].name}: choose a creature`, cells, () => aiAbilityPick(i, cells), "Cancel");
  if (q === null || q === undefined) return false;
  i.tapped = true;
  const o = G.cells[q];
  await projectile(p, q, CHEX[c]);
  if (c === "W") { o.pc++; o.tc++; floatText(q, "+1/+1", "buff"); log(`✚ ${nameOf(i)} blesses ${nameOf(o)}`, i.owner); }
  if (c === "B") { o.pc--; o.tc--; o.lastHitBy = i.owner; floatText(q, "−1/−1"); log(`✖ ${nameOf(i)} withers ${nameOf(o)}`, i.owner); render(); await sleep(300); await checkDeath(o, i.owner); }
  if (c === "G") { o.tp += 3; o.tt += 3; floatText(q, "+3/+3", "buff"); log(`❋ ${nameOf(o)} grows`, i.owner); }
  if (c === "R") { log(`✷ ${nameOf(i)} pings ${nameOf(o)}`, i.owner); await damage(o, 1, i, i.owner); await checkDeath(o, i.owner); }
  render();
  return true;
}

/* ---------------------------------------------------------------- turns */
function freshUI() { return { sel: null, moved: false, revealed: false, targets: null }; }
function legalActionsFor(i) {
  const a = [];
  if (i.tapped) { if (i.lock === 0) a.push("untap"); }
  else if (moveTargets(i).length) a.push("move");
  if (!i.faceUp && !isBasicLand(i)) a.push("reveal");
  if (swapTargets(i).length) a.push("swap");
  if (i.faceUp && !i.tapped && isCreature(i) && F(i).act && abilityTargets(i).length >= (curColor(i) === "U" ? 2 : 1)) a.push("ability");
  return a;
}
function hasAnyAction(p) { return board().some((i) => i.owner === p && legalActionsFor(i).length); }
function computeTargets() {
  const u = G.ui; if (!u || !u.sel) { if (u) u.targets = null; return; }
  const i = board().find((x) => x.uid === u.sel);
  if (!i) { u.targets = null; return; }
  const t = [];
  if (!u.moved) for (const m of moveTargets(i)) t.push(m);
  if (!u.moved && !u.revealed) for (const s of swapTargets(i)) t.push({ p: s, kind: "swap" });
  u.targets = t;
}
async function startTurn() {
  G.ui = freshUI();
  if (G.mode === "remote" && NET && !G.over) await syncTurn();
  render();
  if (G.over) return;
  if (!hasAnyAction(G.player)) {
    G.passes = (G.passes || 0) + 1;
    log(`${esc(G.names[G.player])} has nothing to move and passes`, G.player);
    if (G.passes >= 2) { const w = G.piles[0].length === G.piles[1].length ? 1 - G.player : G.piles[0].length > G.piles[1].length ? 0 : 1; return win(w, "both players are stuck — most cards won"); }
    toast(`${G.names[G.player]} can't move: turn passes`);
    await sleep(700);
    return endTurn();
  }
  G.passes = 0;
  if (G.turnNo > 120) { const w = G.piles[0].length === G.piles[1].length ? G.player : G.piles[0].length > G.piles[1].length ? 0 : 1; return win(w, "turn limit — most cards won"); }
  if (G.mode === "hot" && G.curtain) await curtain(G.player);
  if (isRemote(G.player)) toast(`${G.names[G.player]} is playing…`);
  render();
  if (isAI(G.player)) await aiTurn(G.player);
}
async function endTurn() {
  if (G.over) return;
  G.busy = true;
  // Regenerate, end of temporary effects, frozen counters
  for (const i of board()) {
    if (isCreature(i) && hasKwC(i, "G") && i.damage > 0) { i.damage = 0; const p = posOf(i.uid); floatText(p, "🌿 regen", "heal"); sparks(p, CHEX.G, 8); }
    if (i.tp || i.tt) { const p = posOf(i.uid); if (p >= 0 && isCreature(i)) floatText(p, `−${i.tp}/−${i.tt}`, "info"); }
    i.tp = 0; i.tt = 0;
    if (i.owner === G.player && i.lock > 0) i.lock--;
  }
  render();
  // Anything at 0 health or less dies (e.g. a Rally or Growth bonus ran out after combat).
  await sweepDeaths();
  if (G.over) return;
  G.player = 1 - G.player;
  G.turnNo++;
  G.ui = freshUI();
  render();
  await sleep(250);
  G.busy = false;
  await startTurn();
}
function curtain(p) {
  return new Promise((resolve) => {
    const c = document.createElement("div"); c.className = "curtain";
    c.innerHTML = `<div class="hero" style="margin:0"><div class="eyebrow">PASS THE DEVICE</div><h1>${esc(G.names[p])}</h1><p>Tap anywhere when ${esc(G.names[1 - p])} is not looking.</p></div>`;
    OVER.appendChild(c);
    c.addEventListener("click", () => { c.remove(); resolve(); });
  });
}
async function win(p, why) {
  if (G.over) return;
  G.over = { winner: p, why };
  G.ui = freshUI();
  PROMPT = null;
  log(`🏆 <b>${esc(G.names[p])} wins</b> — ${esc(why)}`, p);
  render();
  banner(`${G.names[p]} wins!`, 2200);
  confetti();
  await sleep(1800);
  showResult();
}
function showResult() {
  const pools = [0, 1].map((p) => ({ won: G.piles[p].slice(), back: board().filter((i) => i.owner === p).map((i) => i.card).concat(G.rowEnch.filter((e) => e && e.owner === p).map((e) => e.inst.card)) }));
  const o = document.createElement("div"); o.className = "overlay";
  o.innerHTML = `<div class="sheet"><h2>🏆 ${esc(G.names[G.over.winner])} wins</h2><p class="note">${esc(G.over.why)} · ${G.turnNo} turns. These cards join each player's collection for deck building.</p>
  <div class="result-pools">${[0, 1].map((p) => `<div class="panel"><h3 style="color:var(--p${p})">${esc(G.names[p])}</h3><p class="note">Won during the game (${pools[p].won.length})</p><div class="thumbs">${pools[p].won.map((c) => `<img src="${c.faces[0].img}" title="${esc(c.name)}">`).join("") || "<span class='note'>—</span>"}</div><p class="note">Back from the board (${pools[p].back.length})</p><div class="thumbs">${pools[p].back.map((c) => `<img src="${c.faces[0].img}" title="${esc(c.name)}">`).join("")}</div></div>`).join("")}</div>
  <div class="row"><button class="btn" id="againBtn">Continue ▸</button><button class="btn sec" id="closeRes">Look at the board</button></div></div>`;
  OVER.appendChild(o);
  $("#againBtn", o).onclick = () => { o.remove(); finish(); };
  $("#closeRes", o).onclick = () => o.remove();
}

/* Human input */
async function onCell(p) {
  if (PROMPT) {
    if (!PROMPT.remote && isLocal(PROMPT.player) && PROMPT.cells && PROMPT.cells.includes(p)) resolvePrompt(p);
    return;
  }
  if (G.busy || G.over || !isLocal(G.player)) return;
  netSend({ k: "click", p });
  return handleClick(p);
}
async function handleClick(p) {
  const u = G.ui;
  const o = G.cells[p];
  if (!u.sel) {
    if (!o || o.owner !== G.player) { if (!o && ZPIN) { const t = ZPIN; ZPIN = null; zoomShow(t); } return; }
    if (!legalActionsFor(o).length) { toast("That card has nothing to do."); return; }
    await selectCard(o);
    return;
  }
  const t = u.targets && u.targets.find((x) => x.p === p);
  const i = board().find((x) => x.uid === u.sel);
  if (!t) return;
  G.busy = true;
  let ended = false;
  try {
    if (t.kind === "move") {
      await moveTo(i, p);
      u.moved = true;
      log(`${canSee(i, 1 - i.owner) ? nameOf(i) : "A face-down card"} moves`, i.owner);
      computeTargets(); render();
      if (i.faceUp || isBasicLand(i)) { ended = true; G.busy = false; return endTurn(); }
    } else if (t.kind === "swap") {
      await swapCards(i, p);
      ended = true; G.busy = false; return endTurn();
    } else {
      u.targets = null; render();
      await interact(i, p);
      ended = true; G.busy = false; return endTurn();
    }
  } finally { if (!ended) { G.busy = false; render(); } }
}
async function selectCard(i) {
  G.ui.sel = i.uid;
  const first = !i.known[i.owner];
  i.known[i.owner] = true;
  computeTargets();
  render();
  if (i.owner === viewer()) { ZPIN = { inst: i }; zoomShow(ZPIN); }
  if (first && !i.faceUp) {
    const p = posOf(i.uid);
    ring(p, "#ecca7e");
    animOf(i).animate([{ transform: "translateY(0)" }, { transform: "translateY(-10px) scale(1.06)" }, { transform: "translateY(0)" }], { duration: 500 / SPEED });
  }
}
async function swapCards(i, q) {
  const p = posOf(i.uid), o = G.cells[q];
  const a = cellCenter(p), b = cellCenter(q);
  cardEl(i).classList.add("lift"); cardEl(o).classList.add("lift");
  animOf(i).animate([{ transform: "translateY(0)" }, { transform: `translate(${(b.x - a.x) / 2}px, ${(b.y - a.y) / 2 - 24}px) rotate(8deg)` }, { transform: "translateY(0)" }], { duration: 420 / SPEED });
  G.cells[p] = o; G.cells[q] = i;
  render();
  await sleep(450);
  cardEl(i).classList.remove("lift"); cardEl(o).classList.remove("lift");
  log(`${esc(G.names[i.owner])} swaps two face-down cards`, i.owner);
}
function btn(label, fn, cls = "btn small", disabled = false) {
  const b = document.createElement("button"); b.className = cls; b.innerHTML = label; b.disabled = disabled;
  b.addEventListener("click", fn); return b;
}
function renderActions() {
  const a = $("#actions");
  if (!a) return;
  a.innerHTML = "";
  const msg = document.createElement("div"); msg.className = "msg";
  const btns = document.createElement("div"); btns.className = "btns";
  a.appendChild(msg); a.appendChild(btns);
  if (G.over) { msg.innerHTML = `<b>${esc(G.names[G.over.winner])}</b> wins — ${esc(G.over.why)}`; btns.appendChild(btn("Results ▸", showResult)); return; }
  if (PROMPT && PROMPT.remote) { msg.innerHTML = `Waiting for <b>${esc(G.names[PROMPT.player])}</b>: ${esc(PROMPT.title)} <span class="loading"></span>`; return; }
  if (PROMPT) {
    msg.innerHTML = `<b>${esc(G.names[PROMPT.player])}</b> · ${esc(PROMPT.title)}`;
    if (PROMPT.options) for (const o of PROMPT.options) btns.appendChild(btn(esc(o.label), () => resolvePrompt(o.value), o.primary ? "btn small" : "btn small sec"));
    if (PROMPT.cells && PROMPT.cancelLabel) btns.appendChild(btn(esc(PROMPT.cancelLabel), () => resolvePrompt(null), "btn small sec"));
    if (PROMPT.cells) msg.innerHTML += `<br><span class="note">Click a highlighted square.</span>`;
    return;
  }
  if (isAI(G.player)) { msg.innerHTML = `<b>${esc(G.names[G.player])}</b> is thinking… <span class="loading"></span>`; return; }
  if (isRemote(G.player)) { msg.innerHTML = `<b>${esc(G.names[G.player])}</b> is playing… <span class="loading"></span>`; return; }
  if (G.busy && G.ui && G.ui.sel && !G.ui.targets) { msg.innerHTML = `Resolving… <span class="loading"></span>`; return; }
  const u = G.ui;
  if (!u || !u.sel) { msg.innerHTML = `<b>${esc(G.names[G.player])}</b>, choose one of your cards.<br><span class="note">Selecting a face-down card lets you look at it — then you must act with it.</span>`; return; }
  const i = board().find((x) => x.uid === u.sel);
  if (!i) return;
  let extra = "";
  if (isSpell(i) && spellColor(i) === "B") {
    const r = raiseInfo(i.owner, cmcOf(i));
    extra = `<br><span class="note">⚰ Raise (MV ≤ ${cmcOf(i)}): ${r.ok.length ? "can bring back " + r.ok.map((c) => esc(c.name.split(" // ")[0])).join(", ") : esc(raiseWhyNot(i.owner, cmcOf(i)))}</span>`;
  }
  msg.innerHTML = `${nameOf(i)}${i.faceUp ? "" : " <span class='note'>(face down — only you see it)</span>"}<br><span class="note">${u.targets && u.targets.length ? "Green: move · Red: attack · Blue: swap · Pink: use on your card" : "No squares to move to."}</span>${extra}`;
  const A = (name) => () => { if (G.busy || !isLocal(G.player)) return; netSend({ k: "act", a: name }); doAct(name); };
  if (!i.faceUp && !u.revealed && !isBasicLand(i)) btns.appendChild(btn("👁 Reveal", A("reveal")));
  if (i.card.dfc && i.flippedOn !== G.turnNo) btns.appendChild(btn("⟳ Transform", A("transform"), "btn small sec"));
  if (i.faceUp && !i.tapped && !u.moved && isCreature(i) && F(i).act && abilityTargets(i).length >= (curColor(i) === "U" ? 2 : 1)) {
    const c = curColor(i);
    btns.appendChild(btn(`${ACT[c].icon} ${ACT[c].name}`, A("ability")));
  }
  if (i.tapped && !u.moved) btns.appendChild(btn(i.lock ? `🔒 Frozen ${i.lock}` : "↺ Untap", A("untap"), "btn small", i.lock > 0));
  if (u.moved || u.revealed) btns.appendChild(btn("End turn ▸", A("end"), "btn small sec"));
  else btns.appendChild(btn("Pass", A("end"), "btn small sec"));
}
/* The turn buttons, run the same way for a local click and for the other device's. */
async function doAct(name) {
  const u = G.ui;
  const i = u && board().find((x) => x.uid === u.sel);
  if (name === "end") return endTurn();
  if (!i) return;
  if (name === "reveal") { G.busy = true; await reveal(i, { allowEnchant: true }); u.revealed = true; G.busy = false; computeTargets(); render(); if (posOf(i.uid) < 0) endTurn(); return; }
  if (name === "transform") { i.face = 1 - i.face; i.flippedOn = G.turnNo; const p = posOf(i.uid); animOf(i).animate([{ transform: "rotateY(0)" }, { transform: "rotateY(90deg)" }, { transform: "rotateY(0)" }], { duration: 500 / SPEED }); ring(p, "#ecca7e"); log(`⟳ ${nameOf(i)} transforms`, i.owner); computeTargets(); render(); return; }
  if (name === "ability") { G.busy = true; const ok = await useAbility(i); G.busy = false; if (ok) endTurn(); else render(); return; }
  if (name === "untap") { if (i.lock > 0) return; i.tapped = false; log(`${nameOf(i)} untaps`, i.owner); render(); endTurn(); }
}

/* --------------------------------------------------------------------- AI */
function cardValue(i) { return (isCreature(i) ? power(i) + health(i) : 2) + cmcOf(i) * 0.6 + ({ c: 0, u: 1, r: 2, m: 3 }[i.card.rarity]); }
function aiKnows(p, o) { return o.faceUp || o.known[p] || o.owner === p; }
function simCombat(A, D) {
  const aLeg = F(A).legendary && !F(D).legendary, dLeg = F(D).legendary && !F(A).legendary;
  const powA = power(A) * (aLeg ? 2 : 1), powD = power(D) * (dLeg ? 2 : 1);
  const back = !D.tapped && !hasKwC(A, "R") && !isPW(A) && !isPW(D);
  const dmgD = hasKwC(A, "B") && powA > 0 ? 99 : dLeg ? Math.ceil(powA / 2) : powA;
  const dmgA = back ? (hasKwC(D, "B") && powD > 0 ? 99 : aLeg ? Math.ceil(powD / 2) : powD) : 0;
  return { dKill: dmgD >= health(D), aDie: dmgA >= health(A) };
}
function aiScoreAttack(p, i, o, pos) {
  if (aiKnows(p, o)) {
    if (isBasicLand(o)) return 1000;
    if (isCreature(i) && isCreature(o)) { const s = simCombat(i, o); return (s.dKill ? 20 + cardValue(o) : 2) - (s.aDie ? 10 + cardValue(i) : 0); }
    if (isCreature(i)) return 14 + cardValue(o) - (T(o).instant ? 4 : 0);
    if (isSpell(i)) {
      const c = spellColor(i), X = cmcOf(i);
      if (c === "R" && isCreature(o)) return X >= health(o) ? 25 + cardValue(o) : 4;
      if (c === "U" && isCreature(o)) return o.tapped ? -5 : 8 + X;
      if (c === "W") return -6;
      if (c === "B") return G.piles[p].some((x) => isCreatureCard(x) && x.cmc <= X) ? 14 : isCreature(o) ? -3 : 9;
      if (c === "G") return isCreature(o) && cmcOf(o) <= X ? 3 : isCreature(o) ? -2 : 9;
      return isCreature(o) ? 0 : 10;
    }
    if (isArtifact(i)) return cmcOf(o) <= Math.max(1, cmcOf(i)) ? 18 + cardValue(o) : 2;
    return 0;
  }
  // unknown target
  const backRow = rowOf(pos) === (p === 0 ? 5 : 0);
  let s = isCreature(i) ? 6 + power(i) : isArtifact(i) ? 4 : isSpell(i) ? 3 : 1;
  if (backRow) {
    const unknown = [0, 1, 2, 3].map((c) => G.cells[at(rowOf(pos), c)]).filter((x) => x && x.owner !== p && !aiKnows(p, x)).length || 1;
    const landFound = board().some((x) => x.owner !== p && isBasicLand(x) && aiKnows(p, x));
    s += landFound ? 0 : 900 / unknown * 0.35;
  }
  return s;
}
function aiCandidates(p) {
  const acts = [];
  const fwd = p === 0 ? 1 : -1;
  for (const i of board().filter((x) => x.owner === p)) {
    const pos = posOf(i.uid);
    if (isBasicLand(i)) { for (const q of swapTargets(i)) acts.push({ i, type: "swap", q, score: 0.3 }); continue; }
    if (i.tapped) { if (i.lock === 0) acts.push({ i, type: "untap", score: isCreature(i) ? 7 : 1 }); }
    const options = [{ rev: false }];
    if (!i.faceUp && i.card.rarity !== "c") options.push({ rev: true });
    for (const opt of options) {
      const saved = i.faceUp;
      if (opt.rev) i.faceUp = true;
      for (const m of moveTargets(i)) {
        let s;
        if (m.kind === "move") s = (rowOf(m.p) - rowOf(pos)) * fwd * 3 + 1 + (isCreature(i) ? 1 : 0);
        else if (m.kind === "attack") s = aiScoreAttack(p, i, G.cells[m.p], m.p);
        else s = aiOwnScore(i, G.cells[m.p]);
        if (opt.rev) s += aiRevealScore(i) - 1;
        acts.push({ i, type: m.kind === "move" ? "move" : "interact", q: m.p, rev: opt.rev, score: s });
      }
      i.faceUp = saved;
    }
    if (!i.faceUp) acts.push({ i, type: "reveal", score: aiRevealScore(i) });
    for (const q of swapTargets(i)) acts.push({ i, type: "swap", q, score: 0.4 });
    if (i.faceUp && !i.tapped && isCreature(i) && F(i).act) {
      const c = curColor(i), cells = abilityTargets(i);
      if (c === "R" && cells.some((q) => G.cells[q].owner !== p && health(G.cells[q]) <= 1)) acts.push({ i, type: "ability", score: 30 });
      else if (c === "W" && cells.some((q) => G.cells[q].owner === p)) acts.push({ i, type: "ability", score: 4 });
      else if (c === "B" && cells.some((q) => G.cells[q].owner !== p)) acts.push({ i, type: "ability", score: 4 });
      else if (c === "U" && cells.length >= 2) acts.push({ i, type: "ability", score: 1 });
      else if (c === "G" && cells.some((q) => G.cells[q].owner === p)) acts.push({ i, type: "ability", score: 1.5 });
    }
  }
  return acts;
}
function aiOwnScore(i, o) {
  if (isArtifact(i)) return -4;
  const c = spellColor(i);
  if (c === "W") return o.damage > 0 ? 6 : 1;
  if (c === "U") return o.tapped ? 7 : -8;
  if (c === "G") return o.faceUp && cmcOf(o) <= cmcOf(i) && biteVictims(o).some((q) => G.cells[q].owner !== i.owner && power(o) >= health(G.cells[q])) ? 16 : -3;
  return -10;
}
function aiRevealScore(i) {
  let s = 0;
  if (isCreature(i)) {
    s += 2;
    if (F(i).trig) { const p = posOf(i.uid); s += [0, 1, 2, 3, 4, 5].filter((r) => { const o = G.cells[at(r, colOf(p))]; return o && o.owner === i.owner && isCreature(o) && o.faceUp; }).length * 2; }
  }
  if (isEnch(i) && !isCreature(i)) s += 11;
  if (isSpell(i) || isArtifact(i)) s -= 3;
  if (i.card.alt || i.card.foil) s += 2;
  return s;
}
async function aiTurn(p) {
  G.busy = true;
  await sleep(500);
  const acts = aiCandidates(p);
  if (!acts.length) { G.busy = false; return endTurn(); }
  for (const a of acts) a.score += Math.random() * 3;
  acts.sort((x, y) => y.score - x.score);
  const a = acts[0];
  const i = a.i;
  G.ui.sel = i.uid; i.known[p] = true; render();
  await sleep(450);
  try {
    if (a.type === "untap") { i.tapped = false; log(`${nameOf(i)} untaps`, p); }
    else if (a.type === "reveal") await reveal(i, { allowEnchant: true });
    else if (a.type === "swap") await swapCards(i, a.q);
    else if (a.type === "ability") await useAbility(i);
    else {
      if (a.rev) await reveal(i, { allowEnchant: false });
      if (posOf(i.uid) >= 0 && !G.over) {
        if (a.type === "move") { if (!G.cells[a.q]) { await moveTo(i, a.q); log(`${canSee(i, 1 - p) ? nameOf(i) : "A face-down card"} moves`, p); } }
        else if (G.cells[a.q] && moveTargets(i).some((m) => m.p === a.q)) await interact(i, a.q);
      }
    }
  } catch (e) { console.error(e); }
  G.busy = false;
  if (!G.over) await endTurn();
}
function aiWantsEnchant(i) { const p = posOf(i.uid); const r = rowOf(p); return board().some((o) => o.owner === i.owner && isCreature(o) && rowOf(posOf(o.uid)) === r && o !== i) || !isCreature(i); }
function aiPeekPick(p, cand) { const back = cand.filter((q) => rowOf(q) === (p === 0 ? 5 : 0)); return pick(back.length ? back : cand); }
function aiFlyPick(A, empty) { const f = A.owner === 0 ? 1 : -1; const best = empty.sort((a, b) => (rowOf(b) - rowOf(a)) * f)[0]; return Math.random() < 0.7 ? best : null; }
function aiModePick(A, D, modes) { if (isCreature(D) && modes.includes("creature")) { const s = simCombat(A, D); if (!s.aDie || s.dKill) return "creature"; } return modes.includes("spell") ? "spell" : modes.includes("artifact") && cmcOf(D) <= cmcOf(A) ? "artifact" : modes[0]; }
function aiReact(D, A, targets) { const c = spellColor(D), X = cmcOf(D); if (c === "R") return isCreature(A) && X >= health(A); if (c === "B") return true; if (c === "U") return isCreature(A) && !A.tapped; return targets.length > 0 && Math.random() < 0.6; }
function aiSpellTarget(c, X, caster, targets, A) {
  const enemy = targets.filter((q) => G.cells[q].owner !== caster), mine = targets.filter((q) => G.cells[q].owner === caster);
  if (c === "R") { const k = enemy.find((q) => health(G.cells[q]) <= X); return k ?? (A && targets.includes(posOf(A.uid)) ? posOf(A.uid) : enemy[0] ?? targets[0]); }
  if (c === "U") return A && targets.includes(posOf(A.uid)) ? posOf(A.uid) : enemy[0] ?? targets[0];
  if (c === "W") return mine.sort((a, b) => G.cells[b].damage - G.cells[a].damage)[0] ?? targets[0];
  if (c === "G") return mine[0] ?? targets[0];
  return targets[0];
}
function aiCast(A, D, valid) { if (!valid) return D.owner !== A.owner && !isCreature(D); const c = spellColor(A); if (c === "W") return D.owner === A.owner; if (c === "U") return D.owner !== A.owner ? !D.tapped : D.tapped; return true; }
function aiBitePick(caster, src, victims) { const enemy = victims.filter((q) => G.cells[q].owner !== caster); const k = enemy.find((q) => health(G.cells[q]) <= power(src)); return k ?? enemy[0] ?? victims[0]; }
function aiShiftPick(i, cells) { return shuffle(cells.slice()).slice(0, 2); }
function aiAbilityPick(i, cells) {
  const c = curColor(i), p = i.owner;
  const mine = cells.filter((q) => G.cells[q].owner === p), enemy = cells.filter((q) => G.cells[q].owner !== p);
  if (c === "R") return enemy.sort((a, b) => health(G.cells[a]) - health(G.cells[b]))[0] ?? cells[0];
  if (c === "B") return enemy[0] ?? cells[0];
  return mine[0] ?? cells[0];
}

function miniCard(c, extra = "", owner = 0) {
  const bk = G.backs && G.backs[owner];
  return `<div class="mini ${c.rarity} ${extra}"><div class="bk cardback ${bk ? "img" : ""}" style="${bk ? `background-image:url('${bk}')` : ""}"></div><div class="fc ${c.foil ? "foil" : ""}" style="position:absolute"><div class="art" style="position:absolute;inset:0"><img src="${c.faces[0].img}" alt=""></div></div><div class="tagr">${c.faces[0].types.basic ? "Basic land" : RARITY_NAME[c.rarity]}${c.foil ? " · foil" : ""}${c.alt ? " · alt art" : ""}</div></div>`;
}
async function boosterScreen(p) {
  if (isAI(p)) { autoArrange(p); return p === 0 ? boosterScreen(1) : beginBoard(); }
  if (isRemote(p)) return p === 0 ? boosterScreen(1) : beginBoard();
  const bo = SETUP.boosters[p];
  const prep = $("#prep");
  show("prep");
  const cards = bo.cards.concat([bo.land]);
  void SETUP;
  ZPIN = null;
  prep.innerHTML = `<div class="prepwrap"><div class="prepmain"><div class="hero" style="margin-top:0"><div class="eyebrow">${esc(G.names[p])} · ${esc(bo.setName || (bo.set && bo.set.name) || "")}</div><h1 style="font-size:2rem">Your booster</h1><p>11 cards and a basic land. Click a card to flip it; point at a flipped card to see what it does in the minigame (click it again to pin it).</p></div><div class="pack" id="pack">${cards.map((c) => miniCard(c, "dealin", p)).join("")}</div><div class="row"><button class="btn sec" id="flipAll">Reveal all</button><button class="btn" id="toRows">Arrange the rows ▸</button></div></div><div class="zoom prepzoom" id="prepZoom"></div></div>`;
  const minis = $$(".mini", prep);
  minis.forEach((m, k) => {
    m.style.animationDelay = k * 60 + "ms";
    m.addEventListener("click", () => { if (m.classList.contains("up")) togglePin({ card: cards[k] }); else { m.classList.add("up"); zoomShow({ card: cards[k] }); } });
    m.addEventListener("mouseenter", () => { if (m.classList.contains("up")) hoverZoom({ card: cards[k] }); });
    m.addEventListener("mouseleave", hoverOut);
  });
  const flipAll = () => minis.forEach((m, k) => setTimeout(() => m.classList.add("up"), k * 90));
  $("#flipAll").onclick = flipAll;
  $("#toRows").onclick = () => arrangeScreen(p);
}
function autoArrange(p) {
  const cards = SETUP.boosters[p].cards.slice();
  const score = (c) => { const t = c.faces[0].types; return (t.creature ? 10 + c.faces[0].power : 0) + (t.instant || t.sorcery ? 4 : 0) + (t.artifact ? 3 : 0) + Math.random() * 3; };
  cards.sort((a, b) => score(b) - score(a));
  SETUP.rows[p] = { front: cards.slice(0, 4), middle: cards.slice(4, 8), back: cards.slice(8, 11) };
}
function arrangeScreen(p) {
  const bo = SETUP.boosters[p];
  const rows = { front: [], middle: [], back: [] };
  let tray = bo.cards.slice();
  let active = "front";
  const cap = { front: 4, middle: 4, back: 3 };
  const prep = $("#prep");
  const draw = () => {
    const done = rows.front.length === 4 && rows.middle.length === 4 && rows.back.length === 3;
    prep.innerHTML = `<div class="prepwrap"><div class="prepmain"><div class="hero" style="margin-top:0"><div class="eyebrow">${esc(G.names[p])}</div><h1 style="font-size:2rem">Split your cards into three rows</h1><p>Each row is shuffled face down: you will know which row a card is in, but not its square. Your basic land always goes in the back row.</p></div>
    <div class="grid2" style="align-items:start"><div class="bins">${["front", "middle", "back"].map((r) => `<div class="bin ${active === r ? "active" : ""}" data-r="${r}"><h3 data-r="${r}"><span>${r === "front" ? "⚔ Front row" : r === "middle" ? "◈ Middle row" : "⌂ Back row"}</span><span>${rows[r].length}/${cap[r]}${r === "back" ? " + land" : ""}</span></h3><div class="cards">${rows[r].map((c, k) => `<div class="pick" data-from="${r}" data-k="${k}"><img src="${c.faces[0].img}" alt=""><div class="lbl">${esc(c.name.split(" // ")[0])}</div></div>`).join("")}${r === "back" ? `<div class="pick fixedland"><img src="${bo.land.faces[0].img}" alt=""><div class="lbl">${esc(bo.land.name)}</div></div>` : ""}</div></div>`).join("")}</div>
    <div><p class="note" style="margin-top:0">Click a card to drop it in the highlighted row (click a row title to change it). Click a placed card to take it back. Point at a card to see what it does in the minigame (right-click pins it).</p><div class="tray">${tray.map((c, k) => `<div class="pick" data-from="tray" data-k="${k}"><img src="${c.faces[0].img}" alt=""><div class="lbl">${esc(c.name.split(" // ")[0])}</div></div>`).join("") || "<span class='note'>All placed.</span>"}</div>
    <div class="row"><button class="btn sec" id="autoA">⚡ Auto-arrange</button><button class="btn" id="lockA" ${done ? "" : "disabled"}>Lock the rows ▸</button></div></div></div></div><div class="zoom prepzoom" id="prepZoom"></div></div>`;
    if (ZPIN && ZPIN.card) zoomShow(ZPIN);
    $$(".bin h3", prep).forEach((h) => h.onclick = () => { active = h.dataset.r; draw(); });
    $$(".bin", prep).forEach((b) => b.addEventListener("click", (e) => { if (e.target === b) { active = b.dataset.r; draw(); } }));
    $$(".pick[data-from]", prep).forEach((el) => {
      const from = el.dataset.from, k = Number(el.dataset.k);
      const card = from === "tray" ? tray[k] : rows[from][k];
      el.addEventListener("mouseenter", () => hoverZoom({ card }));
      el.addEventListener("mouseleave", hoverOut);
      el.addEventListener("contextmenu", (e) => { e.preventDefault(); togglePin({ card }); });
      el.onclick = () => {
        if (from === "tray") {
          let target = active;
          if (rows[target].length >= cap[target]) target = ["front", "middle", "back"].find((r) => rows[r].length < cap[r]);
          if (!target) return;
          rows[target].push(card); tray.splice(k, 1);
          if (rows[active].length >= cap[active]) active = ["front", "middle", "back"].find((r) => rows[r].length < cap[r]) || active;
        } else { tray.push(card); rows[from].splice(k, 1); active = from; }
        draw();
      };
    });
    $("#autoA").onclick = () => { autoArrange(p); const r = SETUP.rows[p]; rows.front = r.front; rows.middle = r.middle; rows.back = r.back; tray = []; draw(); };
    $("#lockA").onclick = async () => {
      SETUP.rows[p] = { front: rows.front, middle: rows.middle, back: rows.back };
      if (G.mode === "remote") { const ix = (arr) => arr.map((c) => bo.cards.indexOf(c)); netSend({ k: "rows", p, rows: { front: ix(rows.front), middle: ix(rows.middle), back: ix(rows.back) } }); }
      if (p === 0) {
        if (G.mode === "hot" && G.curtain) { await curtain(1); }
        boosterScreen(1);
      } else beginBoard();
    };
  };
  draw();
}
async function beginBoard() {
  if (G.mode === "remote" && (!SETUP.rows[0] || !SETUP.rows[1])) {
    show("prep");
    $("#prep").innerHTML = `<div class="hero"><div class="eyebrow">${esc(G.title || "")}</div><h1 style="font-size:2rem">Waiting for ${esc(G.names[1 - G.me])}</h1><p>They are arranging their rows. <span class="loading"></span></p></div>`;
    G.waitingRows = true;
    return;
  }
  G.waitingRows = false;
  show("game");
  G.cells = Array(24).fill(null); G.piles = [[], []]; G.rowEnch = Array(6).fill(null); G.over = null; G.turnNo = 1; G.log = []; G.busy = true; G.passes = 0; PROMPT = null;
  for (const [, el] of EL) el.remove();
  EL.clear();
  buildBoard();
  $("#log").innerHTML = "";
  const order = [];
  for (const p of [0, 1]) {
    const r = SETUP.rows[p], land = SETUP.boosters[p].land;
    const rowIdx = p === 0 ? { back: 0, middle: 1, front: 2 } : { back: 5, middle: 4, front: 3 };
    for (const name of ["front", "middle", "back"]) {
      const cards = shuffle(r[name].concat(name === "back" ? [land] : []).map((c) => makeInst(c, p)));
      cards.forEach((inst, c) => { G.cells[at(rowIdx[name], c)] = inst; order.push(inst); });
    }
  }
  G.player = G.first;
  render();
  // deal animation
  for (const [k, inst] of order.entries()) {
    const el = cardEl(inst);
    animOf(inst).animate([{ transform: `translate(${inst.owner === 0 ? 0 : 0}px, ${inst.owner === 0 ? 400 : -400}px) rotate(${(Math.random() - 0.5) * 60}deg) scale(.4)`, opacity: 0 }, { transform: "translate(0,0) rotate(0) scale(1)", opacity: 1 }], { duration: 480, delay: k * 45, easing: "cubic-bezier(.2,.8,.3,1.1)", fill: "backwards" });
    void el;
  }
  await sleep(order.length * 45 + 500);
  log(`The boards are set. <b>${esc(G.names[G.player])}</b> moves first.`);
  banner(`${G.names[G.player]} moves first`, 1300);
  await sleep(900);
  G.busy = false;
  startTurn();
}

/* ------------------------------------------------------------------ guide */
function guide() {
  const o = document.createElement("div"); o.className = "overlay";
  const row = (c, d) => `<tr><td>${pip(c)} ${CNAME[c]}</td>${d.map((x) => `<td><b>${x.name}</b> — ${esc(x.tip)}</td>`).join("")}</tr>`;
  o.innerHTML = `<div class="sheet"><h2>📖 How to play Chess</h2>
  <p>Each player opens a booster (11 cards + 1 basic land) and splits it into three rows: <b>front</b> (4), <b>middle</b> (4) and <b>back</b> (3 + the land). Every row is shuffled face down: you know the row of each card, not its square. The two 4×3 halves face each other on a 4×6 board.</p>
  <h3>Win</h3><p>Move any card onto your opponent's <b>basic land</b>. (If a player has no moves left, they lose.)</p>
  <h3>Your turn</h3><p>Choose one of your cards: you secretly look at it. Then do <b>one</b> of these:</p>
  <ul><li><b>Swap</b> it with another of your face-down cards in the 8 squares around it.</li>
  <li><b>Move and/or reveal</b> it (either one, or both: reveal first to use its better movement).</li>
  <li><b>Untap</b> it, if it is tapped (tapped cards can't move).</li>
  <li>Face-up creatures can <b>tap</b> to use their activated ability instead.</li></ul>
  <p>Cards move 1 square, only into an empty square or onto an enemy card. Face-down cards: forward, left, right. Face up, by rarity: <b>common</b> forward/left/right · <b>uncommon</b> also back · <b>rare</b> only the 4 diagonals · <b>mythic</b> all 8. Artifacts and some spells can also move onto your own cards.</p>
  <h3>When a card moves onto another</h3>
  <table><tr><th>Mover</th><th>What happens</th></tr>
  <tr><td>Creature → creature</td><td>Combat: both deal damage equal to their power (a tapped defender deals none back). Damage stays on the card until it heals. At 0 health or less a creature dies and goes to the player who killed it — also when a −1/−1 counter or the end of a temporary bonus (Rally, Growth) brings it to 0. If the defender dies, the attacker takes its square. Attacking taps the attacker.</td></tr>
  <tr><td>Creature → other</td><td>The card is captured (goes to the attacker's pile) and the creature moves in, untapped. If it was an <b>instant</b>, its owner may cast it first.</td></tr>
  <tr><td>Sorcery / instant</td><td>Its colour effect hits the card (if valid), then the spell goes to your pile; a non-creature target is captured too. If either card was face down, you may cancel: the spell stays where it is.</td></tr>
  <tr><td>Artifact</td><td>Only when it is the card that moves (an attacked artifact is simply captured). The target's mana value drops by the artifact's. At 0 or less the target goes to you. The artifact goes to the target's owner.</td></tr>
  <tr><td>Enchantment</td><td>When you turn it face up on your turn, you may set it beside its row: your creatures in that row gain its keyword. One per row.</td></tr>
  <tr><td>Anything → basic land</td><td>You win.</td></tr></table>
  <h3>Colours</h3>
  <table><tr><th></th><th>Keyword</th><th>Activated (tap)</th><th>Instant / sorcery (X = mana value)</th></tr>
  ${COLORS.map((c) => row(c, [KW[c], ACT[c], SPELL[c]])).join("")}</table>
  <p><b>${TRIG.name}</b> (creatures with a triggered ability): ${esc(TRIG.tip)}</p>
  <h3>Special cards</h3><ul>
  <li><b>Colourless</b>: plays as a random colour. <b>Multicolour</b>: its colour rotates every turn (the glowing ring shows the current one).</li>
  <li><b>Legendary</b>: stats doubled against non-legendary cards. <b>Planeswalker</b>: loyalty is attack and health; never deals or takes damage back; always has its colour's activated ability.</li>
  <li><b>Alternate art</b>: when turned face up, peek at a card in its reach. <b>Foil</b>: peek at any card.</li>
  <li><b>Double-faced</b>: always face up; on your turn you may transform it once when you select it. <b>Adventure / split</b> cards count as both halves. Rooms, sagas, battles and nonbasic lands play as enchantments.</li></ul>
  <p class="note">Every effect is generated from the card's type, colour, mana value, power/toughness and whether it has keywords, triggered or activated abilities — not from its real rules text. Hover a bold word on a card to read its reminder.</p>
  <div class="row"><button class="btn" id="closeGuide">Got it</button></div></div>`;
  OVER.appendChild(o);
  o.addEventListener("click", (e) => { if (e.target === o || e.target.id === "closeGuide") o.remove(); });
}

/* ------------------------------------------------------------------ mount */
const SETUP = { boosters: [null, null], rows: [null, null] };
let OVER = null;
let ROOT = null;
let DONE = null;
const LISTENERS = [];
function on(target, ev, fn) { target.addEventListener(ev, fn); LISTENERS.push([target, ev, fn]); }
function show(id) { for (const s of ["prep", "game"]) $("#" + s).classList.toggle("hidden", s !== id); }
function seeded(seed) {
  let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
  for (let i = 0; i < seed.length; i++) { const k = seed.charCodeAt(i); h1 = h2 ^ Math.imul(h1 ^ k, 597399067); h2 = h3 ^ Math.imul(h2 ^ k, 2869860233); h3 = h4 ^ Math.imul(h3 ^ k, 951274213); h4 = h1 ^ Math.imul(h4 ^ k, 2716044813); }
  const S = [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
  RNGS = S; // exposed for the online resync snapshot
  return () => { let a = S[0] >>> 0, b = S[1] >>> 0, c = S[2] >>> 0, d = S[3] >>> 0; let t = (a + b) | 0; a = b ^ (b >>> 9); b = (c + (c << 3)) | 0; c = (c << 21) | (c >>> 11); d = (d + 1) | 0; t = (t + d) | 0; c = (c + t) | 0; S[0] = a >>> 0; S[1] = b >>> 0; S[2] = c >>> 0; S[3] = d >>> 0; return (t >>> 0) / 4294967296; };
}
let RNGS = [0, 0, 0, 0];

/* Online desync guard: at the start of every turn the host sends a snapshot of the
   game state and its hash; the guest compares it with its own and, if they differ,
   adopts the host's state (a clean point: no animation or prompt is running). */
const SYNC = new Map();
let SYNCWAIT = null;
function cardId(c) {
  for (const p of [0, 1]) { const b = SETUP.boosters[p]; if (!b) continue; if (c === b.land) return p + ":L"; const k = b.cards.indexOf(c); if (k >= 0) return p + ":" + k; }
  return null;
}
function cardOf(id) { const [p, k] = String(id).split(":"); const b = SETUP.boosters[Number(p)]; return k === "L" ? b.land : b.cards[Number(k)]; }
function instOut(i) { return Object.assign({}, i, { card: cardId(i.card), known: i.known.slice() }); }
function instIn(o) { return Object.assign({}, o, { card: cardOf(o.card), known: o.known.slice() }); }
function snapshot() {
  return { cells: G.cells.map((i) => (i ? instOut(i) : null)), piles: G.piles.map((p) => p.map(cardId)), ench: G.rowEnch.map((e) => (e ? { owner: e.owner, inst: instOut(e.inst) } : null)), player: G.player, turnNo: G.turnNo, passes: G.passes || 0, uid: UID, rng: RNGS.slice() };
}
function hashOf(v) { const str = JSON.stringify(v); let h = 2166136261; for (let k = 0; k < str.length; k++) h = Math.imul(h ^ str.charCodeAt(k), 16777619); return (h >>> 0).toString(36); }
function restore(sn) {
  G.cells = sn.cells.map((o) => (o ? instIn(o) : null));
  G.piles = sn.piles.map((p) => p.map(cardOf));
  G.rowEnch = sn.ench.map((e) => (e ? { owner: e.owner, inst: instIn(e.inst) } : null));
  G.player = sn.player; G.turnNo = sn.turnNo; G.passes = sn.passes; UID = sn.uid;
  for (let k = 0; k < 4; k++) RNGS[k] = sn.rng[k];
  for (const [, el] of EL) el.remove();
  EL.clear();
  ZPIN = null;
}
function waitSync(t) {
  if (SYNC.has(t)) return Promise.resolve(SYNC.get(t));
  return new Promise((resolve) => { SYNCWAIT = { t, resolve }; });
}
async function syncTurn() {
  const sn = snapshot();
  const h = hashOf(sn);
  const t = G.turnNo;
  if (G.me === 0) { netSend({ k: "sync", t, h, s: sn }); return; }
  const g = GEN;
  G.busy = true;
  const host = await waitSync(t);
  if (g !== GEN) return;
  G.busy = false;
  for (const k of SYNC.keys()) if (k <= t) SYNC.delete(k);
  if (!host || host.h === h) return;
  restore(host.s);
  G.ui = freshUI();
  log(`⟲ The two devices disagreed: synced with ${esc(G.names[0])}'s board`);
  toast("Re-synced with the other device");
}

/* Online: inputs of the other player arrive here and are applied in order, when the engine is ready. */
let NET = null;
const INBOX = [];
let pumping = false;
function netSend(msg) { if (G.mode === "remote" && NET) NET.send(msg); }
function netReceive(msg) {
  if (msg && msg.k === "sync") {
    SYNC.set(msg.t, msg);
    if (SYNCWAIT && SYNCWAIT.t === msg.t) { const w = SYNCWAIT; SYNCWAIT = null; w.resolve(msg); }
    return;
  }
  if (msg && msg.k === "back") { if (msg.p === 0 || msg.p === 1) { G.backs[msg.p] = typeof msg.url === "string" ? msg.url : null; if (!$("#game").classList.contains("hidden")) render(); } return; }
  INBOX.push(msg); setTimeout(pump, 0);
}
function pump() {
  if (pumping) return;
  pumping = true;
  try {
    while (INBOX.length) {
      const m = INBOX[0];
      if (m.k === "rows") {
        INBOX.shift();
        const bo = SETUP.boosters[m.p];
        if (bo && !SETUP.rows[m.p]) SETUP.rows[m.p] = { front: m.rows.front.map((x) => bo.cards[x]), middle: m.rows.middle.map((x) => bo.cards[x]), back: m.rows.back.map((x) => bo.cards[x]) };
        if (G.waitingRows) beginBoard();
        continue;
      }
      if (m.k === "opt" || m.k === "cell") {
        if (!PROMPT || !PROMPT.remote || PROMPT.remote !== m.k) break;
        INBOX.shift();
        resolvePrompt(m.k === "opt" ? m.i : m.p);
        continue;
      }
      if (m.k === "click" || m.k === "act") {
        if (PROMPT || G.busy || G.over || !G.ui || !isRemote(G.player)) break;
        INBOX.shift();
        if (m.k === "click") handleClick(m.p); else doAct(m.a);
        break; // let the action start; the next render pumps again
      }
      INBOX.shift();
    }
  } finally { pumping = false; }
}
function finish() {
  if (!DONE) return;
  const keyOf = (c) => c.key;
  const pools = [0, 1].map((p) => G.piles[p].concat(board().filter((i) => i.owner === p).map((i) => i.card)).concat(G.rowEnch.filter((e) => e && e.owner === p).map((e) => e.inst.card)).filter((c) => !c.faces[0].types.basic).map(keyOf));
  const d = DONE; DONE = null;
  d({ winner: G.over ? G.over.winner : 0, why: G.over ? G.over.why : "", turns: G.turnNo, pools });
}
const TEMPLATE = `<div class="top">
  <div class="brand">PAY THE 1<small>CHESS</small></div>
  <span class="turnpill hidden" id="turnpill"></span>
  <span class="note" id="rfcTitle"></span>
  <span class="sp"></span>
  <label class="note" style="display:flex;align-items:center;gap:.35rem">Speed <input id="speed" type="range" min="0.5" max="3" step="0.25" value="1" style="width:80px"></label>
  <button class="chip hidden" id="debugBtn" title="Show every card (test only)">👁 Reveal all</button>
  <button class="chip" id="guideBtn">📖 How to play</button>
</div>
<div class="screen hidden" id="prep"></div>
<div class="game hidden" id="game">
  <div class="side left">
    <div class="pile p1" id="pile1"><h3><span id="pname1">Player 2</span><span id="pcount1">0</span></h3><div class="thumbs"></div></div>
    <div class="zoom" id="zoom"></div>
  </div>
  <div class="boardwrap">
    <div class="board" id="board">
      <div class="cells" id="cells"></div>
      <div class="layer" id="bands"></div>
      <div class="river"></div>
      <div class="layer" id="slots"></div>
      <div class="layer" id="cardsLayer"></div>
      <div class="fx" id="fx"></div>
    </div>
  </div>
  <div class="side right">
    <div class="actions" id="actions"></div>
    <div class="pile p0" id="pile0"><h3><span id="pname0">Player 1</span><span id="pcount0">0</span></h3><div class="thumbs"></div></div>
    <div class="log" id="log"></div>
  </div>
</div>`;
let styleEl = null;
/**
 * Mount the minigame. opts: { boosters: [{cards, land}, {cards, land}], names, mode: "ai"|"hot"|"remote",
 * me (remote: local seat), first, seed, title, curtain, debug, net: { send(msg), onMessage(cb) } }.
 * Returns { done: Promise<{winner, why, turns, pools:[keys0, keys1]}>, destroy() }.
 */
export function mountChess(root, opts) {
  if (!styleEl) { styleEl = document.createElement("style"); styleEl.textContent = CSS; document.head.appendChild(styleEl); }
  ROOT = root;
  root.classList.add("rfc", "rfc-root");
  // Seat 2 online sees the board from its side: its own pile on the right.
  root.innerHTML = opts.mode === "remote" && opts.me === 1 ? TEMPLATE.replace(/\b(pile|pname|pcount)([01])\b/g, (m, a, n) => a + (1 - Number(n))).replace(/class="pile p([01])"/g, (m, n) => `class="pile p${1 - Number(n)}"`) : TEMPLATE;
  OVER = document.createElement("div"); OVER.className = "rfc"; document.body.appendChild(OVER);
  const tip = document.createElement("div"); tip.className = "tip hidden"; tip.id = "tip"; OVER.appendChild(tip);
  tipEl = tip;
  bindRefs();
  RNG = seeded(String(opts.seed || Math.random()));
  UID = 0;
  EL.clear(); INBOX.length = 0; PROMPT = null; ZPIN = null; SYNC.clear(); SYNCWAIT = null;
  Object.assign(G, { cells: Array(24).fill(null), piles: [[], []], rowEnch: Array(6).fill(null), player: 0, turnNo: 1, over: null, mode: opts.mode || "ai", me: opts.me || 0, first: opts.first || 0, debug: !!opts.debug, names: opts.names || ["Player 1", "Player 2"], ui: null, busy: false, log: [], curtain: opts.curtain !== false, passes: 0, title: opts.title || "", waitingRows: false });
  SETUP.boosters = opts.boosters; SETUP.rows = [null, null];
  G.backs = [opts.backs && opts.backs[0] || null, opts.backs && opts.backs[1] || null];
  $("#rfcTitle").textContent = G.title;
  NET = opts.net || null;
  if (NET) NET.onMessage(netReceive);
  if (NET && G.mode === "remote" && G.backs[G.me]) netSend({ k: "back", p: G.me, url: G.backs[G.me] });
  on($("#guideBtn"), "click", guide);
  if (G.debug) { $("#debugBtn").classList.remove("hidden"); on($("#debugBtn"), "click", () => { G.debug = !G.debug; $("#debugBtn").classList.toggle("sel", G.debug); if (!$("#game").classList.contains("hidden")) render(); }); }
  on($("#speed"), "input", (e) => { SPEED = Number(e.target.value); });
  on(window, "resize", () => { if (!$("#game").classList.contains("hidden")) render(); });
  on(document, "mouseover", onTipOver);
  on(document, "keydown", onEsc);
  const pumpTimer = setInterval(() => { if (INBOX.length && !pumping) pump(); }, 500);
  const done = new Promise((resolve) => { DONE = resolve; });
  const firstHuman = isLocal(0) ? 0 : 1;
  boosterScreen(firstHuman === 0 ? 0 : 0);
  return {
    done,
    destroy() {
      GEN++;
      clearInterval(pumpTimer);
      DONE = null; NET = null; G.over = G.over || { winner: 0, why: "left" };
      for (const [t, ev, fn] of LISTENERS) t.removeEventListener(ev, fn);
      LISTENERS.length = 0;
      if (OVER) OVER.remove();
      root.innerHTML = "";
      root.classList.remove("rfc", "rfc-root");
      EL.clear();
    },
  };
}
export const CHESS_KEYWORDS = KW;
/** Test hooks (tests only). */
export const __debug = { G, get PROMPT() { return PROMPT; }, get SETUP() { return SETUP; }, resolvePrompt, onCell, legalActionsFor, setSpeed(v) { SPEED = v; } };
