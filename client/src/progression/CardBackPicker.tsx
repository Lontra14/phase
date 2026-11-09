import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

import { BACK_PRESETS, type CardBackChoice, type SavedBack, backUrlOf, loadCosmetics, loadSavedBacks, saveCosmetics, saveSavedBacks } from "./cosmetics";

/** Small button that opens the card back picker; shows the current back. */
export function CardBackButton({ label = "Card back" }: { label?: string }) {
  const [open, setOpen] = useState(false);
  const [back, setBack] = useState<CardBackChoice>(() => loadCosmetics().back);
  useEffect(() => {
    const on = () => setBack(loadCosmetics().back);
    window.addEventListener("rf-cosmetics", on);
    return () => window.removeEventListener("rf-cosmetics", on);
  }, []);
  return (
    <>
      <button type="button" className="pf-backbtn" onClick={() => setOpen(true)} title="Choose the back of your cards">
        <img src={backUrlOf(back)} alt="" />
        <span>{label}</span>
      </button>
      {open && <CardBackPicker onClose={() => setOpen(false)} />}
    </>
  );
}

export function CardBackPicker({ onClose }: { onClose: () => void }) {
  const [choice, setChoice] = useState<CardBackChoice>(() => loadCosmetics().back);
  // null = not drawing; "new" = a new back; otherwise the id of the saved back being edited.
  const [drawing, setDrawing] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedBack[]>(() => loadSavedBacks());
  const [full, setFull] = useState(false);
  const pick = (c: CardBackChoice) => {
    setChoice(c);
    saveCosmetics({ back: c });
  };
  const keep = (list: SavedBack[]) => {
    setSaved(list);
    setFull(!saveSavedBacks(list));
  };
  const editing = drawing && drawing !== "new" ? saved.find((b) => b.id === drawing) : undefined;
  return (
    <div className="pf-modal" onClick={onClose}>
      <div className="pf-sheet pf-backsheet" onClick={(e) => e.stopPropagation()}>
        <div className="pf-backsheet-head">
          <h2>Card back</h2>
          <button type="button" className="pf-btn secondary small" onClick={onClose}>
            Done
          </button>
        </div>
        {full && <p className="pf-error">The browser's storage is full: delete a few saved backs to keep new ones.</p>}
        <p className="pf-hint">
          Your own backs stay saved here: draw them or load an image, as many as you like, and switch between them. Used on your cards in every mode and in the Chess minigame. You see your back on your cards and your opponent's back on
          theirs (online, the two choices are swapped at the start of the game). The same goes for the basic land arts chosen in the
          deck builder.
        </p>
        {drawing ? (
          <BackPainter
            start={editing?.img}
            onCancel={() => setDrawing(null)}
            onSave={(img) => {
              // A new drawing joins the gallery; an edited one replaces itself.
              if (editing) keep(saved.map((b) => (b.id === editing.id ? { ...b, img } : b)));
              else keep([{ id: `b${Date.now().toString(36)}`, img }, ...saved]);
              pick({ id: "custom", img });
              setDrawing(null);
            }}
          />
        ) : (
          <div className="pf-backgrid">
            {BACK_PRESETS.map((p) => (
              <button key={p.id} type="button" className={`pf-backtile ${choice.id === p.id ? "on" : ""}`} onClick={() => pick({ id: p.id })}>
                <img src={p.url} alt="" />
                <span>{p.name}</span>
              </button>
            ))}
            {saved.map((b, i) => (
              <div key={b.id} className={`pf-backtile pf-backtile-saved ${choice.id === "custom" && choice.img === b.img ? "on" : ""}`}>
                <button type="button" className="pick" onClick={() => pick({ id: "custom", img: b.img })}>
                  <img src={b.img} alt="" />
                  <span>Yours {saved.length - i}</span>
                </button>
                <div className="tools">
                  <button type="button" title="Edit" onClick={() => setDrawing(b.id)}>
                    ✎
                  </button>
                  <button
                    type="button"
                    title="Delete"
                    onClick={() => {
                      if (!window.confirm("Delete this card back?")) return;
                      keep(saved.filter((x) => x.id !== b.id));
                      if (choice.id === "custom" && choice.img === b.img) pick({ id: "classic" });
                    }}
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
            <button type="button" className="pf-backtile pf-backtile-draw" onClick={() => setDrawing("new")}>
              <div className="pf-backtile-blank">🖌</div>
              <span>Draw a new back</span>
            </button>
            <label className="pf-backtile pf-backtile-draw">
              <div className="pf-backtile-blank">🖼</div>
              <span>Load an image</span>
              <input
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  void imageToBack(file).then((img) => {
                    if (!img) return;
                    keep([{ id: `b${Date.now().toString(36)}`, img }, ...saved]);
                    pick({ id: "custom", img });
                  });
                }}
              />
            </label>
          </div>
        )}
      </div>
    </div>
  );
}

/** A picture from the device as a card back: cropped to the card's shape, small JPEG. */
function imageToBack(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const im = new Image();
    im.onload = () => {
      const c = document.createElement("canvas");
      c.width = 244;
      c.height = 340;
      const ctx = c.getContext("2d");
      if (!ctx) return resolve(null);
      const scale = Math.max(c.width / im.width, c.height / im.height);
      const w = im.width * scale;
      const h = im.height * scale;
      ctx.drawImage(im, (c.width - w) / 2, (c.height - h) / 2, w, h);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", 0.82));
    };
    im.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    im.src = url;
  });
}

const W = 244;
const H = 340;
const SWATCH = ["#111111", "#f5f0e6", "#c9a24b", "#d6503e", "#4a90d9", "#4fb277", "#a487c4", "#f2a2c0", "#ff9f1c", "#2ec4b6"];

/** A tiny paint program for drawing your own card back. */
function BackPainter({ start, onSave, onCancel }: { start?: string; onSave: (img: string) => void; onCancel: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [color, setColor] = useState("#c9a24b");
  const [size, setSize] = useState(8);
  const [tool, setTool] = useState<"brush" | "eraser" | "fill">("brush");
  const [mirror, setMirror] = useState<"none" | "h" | "4">("h");
  const [bg, setBg] = useState("#1c1630");
  const undo = useRef<ImageData[]>([]);
  const last = useRef<{ x: number; y: number } | null>(null);

  const ctx = () => ref.current?.getContext("2d") ?? null;
  const paintBg = (c: string) => {
    const g = ctx();
    if (!g) return;
    g.save();
    g.globalCompositeOperation = "source-over";
    g.fillStyle = c;
    g.fillRect(0, 0, W, H);
    g.restore();
  };
  useEffect(() => {
    const g = ctx();
    if (!g) return;
    paintBg(bg);
    if (start) {
      const im = new Image();
      im.onload = () => g.drawImage(im, 0, 0, W, H);
      im.src = start;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const snapshot = () => {
    const g = ctx();
    if (!g) return;
    undo.current.push(g.getImageData(0, 0, W, H));
    if (undo.current.length > 30) undo.current.shift();
  };
  const pos = (e: ReactPointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };
  const mirrors = (x: number, y: number) => {
    const pts = [{ x, y }];
    if (mirror === "h" || mirror === "4") pts.push({ x: W - x, y });
    if (mirror === "4") pts.push({ x, y: H - y }, { x: W - x, y: H - y });
    return pts;
  };
  const stroke = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    const g = ctx();
    if (!g) return;
    g.lineCap = "round";
    g.lineJoin = "round";
    g.lineWidth = size;
    g.strokeStyle = tool === "eraser" ? bg : color;
    const A = mirrors(a.x, a.y);
    const B = mirrors(b.x, b.y);
    for (let k = 0; k < A.length; k++) {
      g.beginPath();
      g.moveTo(A[k].x, A[k].y);
      g.lineTo(B[k].x, B[k].y);
      g.stroke();
    }
  };
  const down = (e: ReactPointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    snapshot();
    const p = pos(e);
    if (tool === "fill") {
      setBg(color);
      paintBg(color);
      last.current = null;
      return;
    }
    last.current = p;
    stroke(p, { x: p.x + 0.01, y: p.y });
  };
  const move = (e: ReactPointerEvent) => {
    if (!last.current) return;
    const p = pos(e);
    stroke(last.current, p);
    last.current = p;
  };
  const up = () => {
    last.current = null;
  };
  const doUndo = () => {
    const g = ctx();
    const im = undo.current.pop();
    if (g && im) g.putImageData(im, 0, 0);
  };
  const clear = () => {
    snapshot();
    paintBg(bg);
  };
  const frame = () => {
    const g = ctx();
    if (!g) return;
    snapshot();
    g.lineWidth = 7;
    g.strokeStyle = color;
    g.strokeRect(10, 10, W - 20, H - 20);
    g.lineWidth = 2;
    g.strokeRect(20, 20, W - 40, H - 40);
  };
  const save = () => {
    const c = ref.current;
    if (!c) return;
    onSave(c.toDataURL("image/jpeg", 0.82));
  };

  return (
    <div className="pf-painter">
      <canvas ref={ref} width={W} height={H} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up} />
      <div className="pf-painter-tools">
        <div className="pf-painter-row">
          {(["brush", "eraser", "fill"] as const).map((t) => (
            <button key={t} type="button" className={`pf-chip ${tool === t ? "on" : ""}`} onClick={() => setTool(t)}>
              {t === "brush" ? "🖌 Brush" : t === "eraser" ? "⌫ Eraser" : "🪣 Fill"}
            </button>
          ))}
        </div>
        <div className="pf-painter-row">
          {SWATCH.map((c) => (
            <button key={c} type="button" className={`pf-swatch ${color === c ? "on" : ""}`} style={{ background: c }} onClick={() => setColor(c)} aria-label={c} />
          ))}
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} aria-label="Any colour" />
        </div>
        <label className="pf-painter-row">
          Size <input type="range" min={2} max={40} value={size} onChange={(e) => setSize(Number(e.target.value))} /> {size}
        </label>
        <div className="pf-painter-row">
          Symmetry
          {(["none", "h", "4"] as const).map((m) => (
            <button key={m} type="button" className={`pf-chip ${mirror === m ? "on" : ""}`} onClick={() => setMirror(m)}>
              {m === "none" ? "Off" : m === "h" ? "◧ Mirror" : "✣ Four ways"}
            </button>
          ))}
        </div>
        <div className="pf-painter-row">
          <button type="button" className="pf-chip" onClick={frame}>
            ▢ Frame
          </button>
          <button type="button" className="pf-chip" onClick={doUndo}>
            ↶ Undo
          </button>
          <button type="button" className="pf-chip" onClick={clear}>
            ✕ Clear
          </button>
        </div>
        <div className="pf-painter-row">
          <button type="button" className="pf-btn small" onClick={save}>
            Use this back
          </button>
          <button type="button" className="pf-btn secondary small" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
