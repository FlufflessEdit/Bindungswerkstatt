"use strict";
/* =====================================================================
   ui.js — Kamera, Eingabe (Maus + Touch), Leiste oben rechts,
   Beispiele-Dropdown, Toasts, Hauptschleife. Lädt als LETZTES.
   Touch: 2 Finger = Verschieben · Pinch = Zoom (Totzone) ·
   Doppelklick/Doppeltap auf ein Atom = löschen.
   Tafel-tauglich: UI_SCALE skaliert Hit-Targets und Gesten mit der
   physischen Bildschirmauflösung; Handballen (>3 Finger) friert
   alle Gesten ein (Palm-Rejection).
   ===================================================================== */

/* ---------- Eingabe-Skalierung für große Displays ----------
   Heuristik über die physische Gestauflösung: 1080p ≈ 2 Mio. Pixel,
   4K-Tafel ≈ 8,3 Mio. → Faktor √(Fläche/Fläche1080p), geklemmt auf
   [1 .. 2,6]. Auf einem normalen Monitor bleibt alles exakt wie bisher. */
const UI_SCALE = (function () {
  try {
    const q = new URLSearchParams(location.search);
    const manuell = parseFloat(q.get("scale"));
    if (isFinite(manuell) && manuell >= 1 && manuell <= 3) return manuell;
  } catch (e) {}
  const physW = screen.width; /* NICHT × DPR: Browser-Zoom/Skalierung
     soll den Faktor senken, nicht erhöhen — ein 4K-Monitor mit 150 %
     Systemskalierung verhält sich wie ein QHD, und genau so fühlt
     er sich für die Hand an. Tafeln ohne Skalierung bleiben groß. */
  const physH = screen.height;
  return clamp(Math.sqrt((physW * physH) / (1920 * 1080)), 1, 2.6);
})();
/* Rotations-Empfindlichkeit: auf der Tafel sind Armbewegungen länger */
const ROT_FAKTOR = 0.008 / Math.max(UI_SCALE * 0.65, 1);

function setStatus() {}

let drag = null,
  hoverAtom = null,
  hoverSlot = null,
  camGoal = null;
let diatomic = true;
let darkBg = true;
const DIA = new Set([1, 7, 8, 9, 17, 35, 53]);

/* ---------- Kamera ---------- */
function fitRect(x0, y0, x1, y1) {
  const z = clamp(Math.min(W / (x1 - x0 + 60), H / (y1 - y0 + 60)), 0.2, 1.3);
  return { x: (x0 + x1) / 2, y: (y0 + y1) / 2, z };
}
function goPSE() {
  camGoal = fitRect(0, 0, PSE.w, PSE.h);
}
function stageVisible() {
  const hw = W / cam.z / 2,
    hh = H / cam.z / 2;
  return Math.abs(STAGE.x - cam.x) < hw - 80 && Math.abs(STAGE.y - cam.y) < hh - 80;
}
function tweenCam(dt) {
  if (!camGoal) return;
  const k = 1 - Math.exp(-6 * dt);
  cam.x += (camGoal.x - cam.x) * k;
  cam.y += (camGoal.y - cam.y) * k;
  cam.z *= Math.pow(camGoal.z / cam.z, k);
  if (Math.abs(camGoal.x - cam.x) < 0.6 && Math.abs(camGoal.y - cam.y) < 0.6 && Math.abs(camGoal.z / cam.z - 1) < 0.005) {
    cam.x = camGoal.x;
    cam.y = camGoal.y;
    cam.z = camGoal.z;
    camGoal = null;
  }
}

/* ---------- Treffer-Tests (tafel-skalierte Fangbereiche) ---------- */
function hitSlot(w) {
  if (typeof Raum !== "undefined" && Raum.an) return null;
  for (let k = atoms.length - 1; k >= 0; k--) {
    const a = atoms[k];
    if (a.dead) continue;
    if (Math.hypot(w.x - a.pos.x, w.y - a.pos.y) > a.edge + 14 * UI_SCALE) continue;
    const s = a.shells.length - 1,
      sh = a.shells[s];
    for (let i = 0; i < sh.slots.length; i++) {
      if (sh.slots[i].st === "rm") continue;
      const p = slotPosWorld(a, s, i);
      if (Math.hypot(w.x - p.x, w.y - p.y) <= BUB + 4 * UI_SCALE) return { a, s, i };
    }
  }
  return null;
}
function hitAtom(w) {
  if (typeof Raum !== "undefined" && Raum.an) return Raum.hitAtom(w);
  for (let k = atoms.length - 1; k >= 0; k--) {
    const a = atoms[k];
    if (a.dead) continue;
    if (Math.hypot(w.x - a.pos.x, w.y - a.pos.y) <= a.edge * (1 + 0.06 * UI_SCALE)) return a;
  }
  return null;
}

/* ---------- Spawn ---------- */
function findFreeSpot(a) {
  const c = { x: STAGE.x, y: STAGE.y };
  const step = Math.max(240, a.edge * 2 + 70);
  for (let ring = 0; ring < 6; ring++) {
    const R = ring * step,
      n = ring ? 9 : 1;
    for (let j = 0; j < n; j++) {
      const th = (j / n) * TAU + ring * 0.5;
      const p = { x: c.x + Math.cos(th) * R, y: c.y + Math.sin(th) * R };
      if (atoms.every((o) => Math.hypot(o.pos.x - p.x, o.pos.y - p.y) > o.edge + a.edge + 30)) return p;
    }
  }
  return { x: c.x + (Math.random() - 0.5) * 900, y: c.y + (Math.random() - 0.5) * 700 };
}
function spawnFromPSE(Z) {
  const a = makeAtom(Z, STAGE.x, STAGE.y);
  const p = findFreeSpot(a);
  a.pos.x = p.x;
  a.pos.y = p.y;
  const out = [a];
  if (diatomic && DIA.has(Z)) {
    const b = makeAtom(Z, STAGE.x, STAGE.y);
    const d = a.radii[a.radii.length - 1] + b.radii[b.radii.length - 1];
    const th = Math.random() * TAU;
    b.pos.x = a.pos.x + Math.cos(th) * d;
    b.pos.y = a.pos.y + Math.sin(th) * d;
    createCov(a, b);
    out.push(b);
  }
  if (!stageVisible()) camGoal = fitRect(-20, -20, PSE.w + 560, PSE.h + 20);
  return out;
}
function fitAtoms() {
  if (!atoms.length) {
    goPSE();
    return;
  }
  let x0 = 1e9,
    y0 = 1e9,
    x1 = -1e9,
    y1 = -1e9;
  atoms.forEach((a) => {
    x0 = Math.min(x0, a.pos.x - a.edge);
    x1 = Math.max(x1, a.pos.x + a.edge);
    y0 = Math.min(y0, a.pos.y - a.edge);
    y1 = Math.max(y1, a.pos.y + a.edge + 40);
  });
  camGoal = fitRect(x0, y0, x1, y1);
}

/* ---------- Toast ---------- */
const toastsEl = document.getElementById("toasts");
function toast(msg, typ) {
  const d = document.createElement("div");
  d.className = "toast" + (typ === "warn" ? " warn" : "");
  d.textContent = msg;
  toastsEl.appendChild(d);
  requestAnimationFrame(() => d.classList.add("da"));
  setTimeout(() => {
    d.classList.remove("da");
    setTimeout(() => {
      if (d.parentNode) d.parentNode.removeChild(d);
    }, 300);
  }, 2600);
}

/* ---------- Leiste: Buttons ---------- */
document.getElementById("btnPse").addEventListener("click", goPSE);
document.getElementById("btnClear").addEventListener("click", clearAll);
const btnDi = document.getElementById("btnDi");
btnDi.addEventListener("click", () => {
  diatomic = !diatomic;
  btnDi.classList.toggle("on", diatomic);
});
let darkBgBtn = document.getElementById("btnBg");
darkBgBtn.addEventListener("click", () => {
  darkBg = !darkBg;
  darkBgBtn.classList.toggle("on", !darkBg);
  document.body.classList.toggle("bg-dark", darkBg);
});
const btnCut = document.getElementById("btnCut"),
  cutChip = document.getElementById("cutChip");
btnCut.addEventListener("click", () => {
  cutMode = !cutMode;
  btnCut.classList.toggle("on", cutMode);
  cutChip.classList.toggle("show", cutMode);
});
const btnRaum = document.getElementById("btnRaum");
btnRaum.addEventListener("click", () => {
  Raum.an = !Raum.an;
  btnRaum.classList.toggle("on", Raum.an);
  toast(
    Raum.an
      ? "3D-Lewis-Modus: VSEPR-Geometrie. Leere Fläche ziehen = verschieben · rechte Maustaste / 3 Finger = drehen."
      : "Zurück zum Schalenmodell.",
  );
});
const statusEl = document.getElementById("statusBar");
document.getElementById("btnFull").addEventListener("click", () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen().catch(() => {});
});
const overlay = document.getElementById("overlay");
document.getElementById("btnHelp").addEventListener("click", () => overlay.classList.add("open"));
document.getElementById("btnCloseHelp").addEventListener("click", () => overlay.classList.remove("open"));
overlay.addEventListener("click", (e) => {
  if (e.target === overlay) overlay.classList.remove("open");
});
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") overlay.classList.remove("open");
  /* Undo: Strg+Z / Cmd+Z – nicht während der Texteingabe */
  if ((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "Z")) {
    const aktiv = document.activeElement;
    if (aktiv && (aktiv.tagName === "INPUT" || aktiv.tagName === "TEXTAREA")) return;
    e.preventDefault();
    if (Undo.undo()) toast("Rückgängig gemacht.");
    else toast("Nichts mehr rückgängig zu machen.", "warn");
  }
});

/* ---------- Beispiele-Dropdown ---------- */
const drop = document.getElementById("presetDrop");
document.getElementById("presetBtn").addEventListener("click", (e) => {
  e.stopPropagation();
  drop.classList.toggle("open");
});
drop.addEventListener("click", (e) => e.stopPropagation());
document.addEventListener("click", () => drop.classList.remove("open"));

/* ---------- Formel-Eingabe ---------- */
const formulaInput = document.getElementById("formulaInput");
formulaInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    const ok = buildFromFormula(formulaInput.value);
    formulaInput.value = "";
    formulaInput.blur();
    if (!ok) {
      toast(Lewis.lastError || "Formel nicht erkannt oder nicht unterstützt.", "warn");
      formulaInput.classList.add("fehler");
      setTimeout(() => formulaInput.classList.remove("fehler"), 900);
    }
  }
  if (e.key === "Escape") formulaInput.blur();
});

const FORMELN = [
  ["H₂O", "H2O"],
  ["CO₂", "CO2"],
  ["NH₃", "NH3"],
  ["CH₄", "CH4"],
  ["C₂H₆", "C2H6"],
  ["C₆H₆", "C6H6"],
  ["SO₄²⁻", "SO4^2-"],
  ["NH₄⁺", "NH4^+"],
  ["SF₆", "SF6"],
  ["NO₂", "NO2"],
  ["NaCl", "NaCl"],
  ["Fe₂O₃", "Fe2O3"],
  ["Ethan", "Ethan"],
  ["But-2-en", "But-2-en"],
  ["Ethanol", "Ethanol"],
  ["Propan-2-ol", "Propan-2-ol"],
  ["2-Methylpropan", "2-Methylpropan"],
  ["2,2-Dimethylbutan", "2,2-Dimethylbutan"],
  ["Butanal", "Butanal"],
  ["Cyclohexan", "Cyclohexan"],
  ["Benzaldehyd", "Benzaldehyd"],
  ["Toluol", "Toluol"],
  ["Aceton", "Aceton"],
  ["Essigsäure", "Essigsäure"],
];

const fpEl = document.getElementById("formulaPresets");
FORMELN.forEach(([label, f]) => {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = label;
  b.title = f + " bauen";
  b.addEventListener("click", () => {
    drop.classList.remove("open");
    formulaInput.value = label;
    if (!buildFromFormula(f)) toast(Lewis.lastError || "„" + label + "“ konnte nicht gebaut werden.", "warn");
  });
  fpEl.appendChild(b);
});

/* ---------- Szenen (vorgefertigte Versuchsaufbauten) ---------- */
const SZENEN = [
  [
    "Säure + Wasser",
    [
      ["HCl", -280, 0],
      ["H2O", 240, 0],
    ],
  ],
  [
    "Neutralisation",
    [
      ["H3O+", -280, 0],
      ["OH-", 240, 0],
    ],
  ],
  [
    "Ammoniak + HCl",
    [
      ["NH3", -280, 0],
      ["HCl", 240, 0],
    ],
  ],
  [
    "Wasser-Cluster (H-Brücken)",
    [
      ["H2O", -220, -160],
      ["H2O", 200, -160],
      ["H2O", -220, 150],
      ["H2O", 200, 150],
    ],
  ],
  [
    "Ionengitter",
    [
      ["NaCl", -300, 0],
      ["MgCl2", 260, 0],
    ],
  ],
];
function baueSzene(teile) {
  clearAll();
  teile.forEach((t) => buildFromFormula(t[0], { x: STAGE.x + t[1], y: STAGE.y + t[2] }, true));
  setTimeout(fitAtoms, 3800);
}
const sep = document.createElement("div");
sep.className = "drop-sep";
sep.textContent = "Szenen";
fpEl.appendChild(sep);
SZENEN.forEach(([name, teile]) => {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "szene";
  b.textContent = name;
  b.addEventListener("click", () => {
    drop.classList.remove("open");
    baueSzene(teile);
  });
  fpEl.appendChild(b);
});

/* ---------- Eingabe: Maus + Touch ----------
   Standard: Ziehen = Pan · Atom ziehen = Molekül · 2 Finger = Pan · Pinch = Zoom
   3D: rechte Maustaste halten oder 3 Finger = Rotation
   Rechtsklick ohne Ziehen = Atom löschen
   Tafel: >3 Finger (Handballen) frieren alle Gesten ein. */
const pointers = new Map();
let pinch = null;
let rot3 = null;
let lastTap = null;
let lastDeleteT = 0;
let lastPseSpawn = null;
let palmPause = false;

function mpos(e) {
  const r = canvas.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}
function midOf() {
  const arr = [...pointers.values()];
  return { x: (arr[0].x + arr[1].x) / 2, y: (arr[0].y + arr[1].y) / 2 };
}
function distOf() {
  const arr = [...pointers.values()];
  return Math.hypot(arr[0].x - arr[1].x, arr[0].y - arr[1].y);
}

canvas.addEventListener("pointerdown", (e) => {
  /* Handballen-Schutz: >3 Pointer = alles einfrieren */
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size > 3) {
    if (!palmPause) {
      palmPause = true;
      if (drag && drag.member) drag.member.forEach((mm) => (mm.held = false));
      for (const m of atoms) {
        if (m.pullDir != null) {
          m.pullDir = null;
          m.relaxDirty = true;
        }
      }
      drag = null;
      pinch = null;
      rot3 = null;
    }
    return;
  }
  if (palmPause) return; /* Hand noch drauf: nichts Neues starten */

  canvas.setPointerCapture(e.pointerId);

  const loeseDrag = () => {
    if (drag && drag.member) drag.member.forEach((mm) => (mm.held = false));
    for (const m of atoms) {
      if (m.pullDir != null) {
        m.pullDir = null;
        m.relaxDirty = true;
      }
    }
    drag = null;
    hoverAtom = null;
    hoverSlot = null;
    PSE.hover = null;
    canvas.style.cursor = "default";
  };

  if (pointers.size === 3) {
    loeseDrag();
    pinch = null;
    const arr = [...pointers.values()];
    rot3 = { x: (arr[0].x + arr[1].x + arr[2].x) / 3, y: (arr[0].y + arr[1].y + arr[2].y) / 3 };
    return;
  }
  if (pointers.size === 2) {
    loeseDrag();
    pinch = { d0: distOf(), dPrev: distOf(), armed: false, midPrev: midOf() };
    return;
  }

  /* Rechte Maustaste: Rotation halten · Klick = löschen */
  if (e.button === 2) {
    const m0 = mpos(e);
    drag = {
      mode: "rotR",
      sx: e.clientX,
      sy: e.clientY,
      moved: false,
      rx: typeof Raum !== "undefined" ? Raum.view.rx : 0,
      ry: typeof Raum !== "undefined" ? Raum.view.ry : 0,
      w: screenToWorld(m0.x, m0.y),
    };
    return;
  }

  const m = mpos(e),
    w = screenToWorld(m.x, m.y);
  const slot = hitSlot(w),
    a = slot ? slot.a : hitAtom(w);
  if (slot || a) {
    camGoal = null;
    drag = { mode: "click", start: w, last: w, slot, atom: a, member: null };
  } else {
    drag = { mode: "pan", sx: e.clientX, sy: e.clientY, cx: cam.x, cy: cam.y, downW: w, moved: false };
  }
});

canvas.addEventListener("pointermove", (e) => {
  if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

  /* Handballen aktiv? Nur zählen, nichts tun. */
  if (palmPause) return;

  /* drei Finger: 3D-Rotation (tafel-skalierte Empfindlichkeit) */
  if (rot3 && pointers.size >= 3) {
    const arr = [...pointers.values()];
    const cx = (arr[0].x + arr[1].x + arr[2].x) / 3;
    const cy = (arr[0].y + arr[1].y + arr[2].y) / 3;
    if (typeof Raum !== "undefined" && Raum.an) {
      Raum.view.ry += (cx - rot3.x) * ROT_FAKTOR;
      Raum.view.rx = clamp(Raum.view.rx + (cy - rot3.y) * ROT_FAKTOR, -1.45, 1.45);
    }
    rot3 = { x: cx, y: cy };
    return;
  }

  /* zwei Finger: Pan + Pinch (Totzone skaliert mit der Tafel) */
  if (pinch && pointers.size >= 2) {
    const mid = midOf();
    cam.x -= (mid.x - pinch.midPrev.x) / cam.z;
    cam.y -= (mid.y - pinch.midPrev.y) / cam.z;
    pinch.midPrev = mid;
    camGoal = null;
    const d = distOf();
    if (!pinch.armed && Math.abs(d - pinch.d0) > 100 * UI_SCALE) {
      pinch.armed = true;
      pinch.dPrev = d;
    }
    if (pinch.armed) {
      const before = screenToWorld(mid.x, mid.y);
      cam.z = clamp(cam.z * (d / pinch.dPrev), 0.25, 2.4);
      const after = screenToWorld(mid.x, mid.y);
      cam.x += before.x - after.x;
      cam.y += before.y - after.y;
      pinch.dPrev = d;
    }
    return;
  }

  const m = mpos(e);
  if (!drag) {
    const w = screenToWorld(m.x, m.y);
    hoverSlot = hitSlot(w);
    hoverAtom = hoverSlot ? null : hitAtom(w);
    PSE.hover = !hoverSlot && !hoverAtom ? pseHit(w.x, w.y) : null;
    canvas.style.cursor = hoverSlot || PSE.hover ? "pointer" : hoverAtom ? "grab" : "default";
    return;
  }

  if (drag.mode === "rotR") {
    const dx = e.clientX - drag.sx,
      dy = e.clientY - drag.sy;
    if (Math.hypot(dx, dy) > 4 + 4 * UI_SCALE) drag.moved = true;
    if (drag.moved && typeof Raum !== "undefined" && Raum.an) {
      Raum.view.ry = drag.ry + dx * ROT_FAKTOR;
      Raum.view.rx = clamp(drag.rx + dy * ROT_FAKTOR, -1.45, 1.45);
    }
    return;
  }
  if (drag.mode === "pan") {
    const dx = e.clientX - drag.sx,
      dy = e.clientY - drag.sy;
    if (Math.hypot(dx, dy) > 4 + 4 * UI_SCALE) drag.moved = true;
    if (drag.moved) {
      camGoal = null;
      cam.x = drag.cx - dx / cam.z;
      cam.y = drag.cy - dy / cam.z;
    }
    return;
  }
  const w = screenToWorld(m.x, m.y);
  if (drag.mode === "click") {
    /* Klick-vs-Drag-Schwelle: Finger zittern mehr als Mäuse */
    if (Math.hypot(w.x - drag.start.x, w.y - drag.start.y) > (6 + 4 * UI_SCALE) / Math.max(cam.z, 0.2)) {
      drag.mode = "drag";
      hoverSlot = null;
      hoverAtom = null;
      PSE.hover = null;
      drag.member = cutMode ? [drag.atom] : bondComponent(drag.atom);
      drag.member.forEach((mm) => (mm.held = true));
      canvas.style.cursor = "grabbing";
    }
  }
  if (drag.mode === "drag") {
    const dx = w.x - drag.last.x,
      dy = w.y - drag.last.y;
    drag.member.forEach((mm) => {
      mm.pos.x += dx;
      mm.pos.y += dy;
    });
    drag.last = w;
    interactLive(drag.atom);
  }
});

function endPointer(e) {
  pointers.delete(e.pointerId);
  if (pointers.size < 2) pinch = null;
  if (pointers.size < 3) rot3 = null;

  /* Handballen weg? Pause aufheben, sauber neu starten */
  if (palmPause) {
    if (pointers.size <= 1) palmPause = false;
    return;
  }

  if (pointers.size === 1 && !drag) {
    const p = [...pointers.values()][0];
    drag = { mode: "pan", sx: p.x, sy: p.y, cx: cam.x, cy: cam.y, moved: true, downW: null };
    return;
  }
  if (!drag) return;

  if (drag.mode === "rotR") {
    /* Rechtsklick ohne Ziehen = Atom löschen */
    if (!drag.moved) {
      const w = drag.w;
      let ziel = null;
      if (typeof Raum !== "undefined" && Raum.an) {
        ziel = Raum.hitAtom(w);
      } else {
        for (let k = atoms.length - 1; k >= 0; k--) {
          const a = atoms[k];
          if (a.dead) continue;
          if (Math.hypot(w.x - a.pos.x, w.y - a.pos.y) <= Math.max(a.kernR * 1.9, 26) * UI_SCALE) {
            ziel = a;
            break;
          }
        }
      }
      if (ziel && atoms.indexOf(ziel) >= 0) {
        removeAtom(ziel);
        toast(ziel.el.sym + " entfernt.");
      }
    }
    drag = null;
    return;
  }
  if (drag.mode === "pan") {
    if (!drag.moved && drag.downW) {
      infoKarte.hidden = true;
      const Z = pseHit(drag.downW.x, drag.downW.y);
      if (Z) {
        const spawned = spawnFromPSE(Z);
        if (lastPseSpawn && performance.now() - lastPseSpawn.t < 400 && lastPseSpawn.z === Z) {
          lastPseSpawn.list = lastPseSpawn.list.concat(spawned);
          lastPseSpawn.t = performance.now();
        } else {
          lastPseSpawn = { z: Z, list: spawned, t: performance.now() };
        }
      }
    }
    drag = null;
    return;
  }
  if (drag.mode === "click") {
    if (drag.slot) {
      toggleElectron(drag.slot);
    } else if (drag.atom) {
      const t = performance.now();
      /* Doppeltap-Fenster: Finger tippen langsamer als Mäuse klicken */
      if (lastTap && lastTap.atom === drag.atom && t - lastTap.t < 350 + 150 * UI_SCALE) {
        if (atoms.indexOf(drag.atom) >= 0) {
          removeAtom(drag.atom);
          lastDeleteT = t;
          infoKarte.hidden = true;
          toast(drag.atom.el.sym + " entfernt.");
        }
        lastTap = null;
      } else {
        lastTap = { atom: drag.atom, t };
        zeigeInfo(drag.atom);
      }
    }
    drag = null;
    return;
  }
  if (drag.member) drag.member.forEach((mm) => (mm.held = false));
  for (const m of atoms) {
    if (m.pullDir != null) {
      m.pullDir = null;
      m.relaxDirty = true;
    }
  }
  drag = null;
  canvas.style.cursor = "default";
}
canvas.addEventListener("pointerup", endPointer);
canvas.addEventListener("pointercancel", endPointer);

canvas.addEventListener("dblclick", (e) => {
  if (performance.now() - lastDeleteT < 150) return;
  const m = mpos(e),
    w = screenToWorld(m.x, m.y);
  if (pseHit(w.x, w.y) && lastPseSpawn && performance.now() - lastPseSpawn.t < 400) {
    lastPseSpawn.list.forEach((a) => {
      if (atoms.indexOf(a) >= 0) removeAtom(a);
    });
    lastPseSpawn = null;
    return;
  }
  let a = null;
  if (typeof Raum !== "undefined" && Raum.an) a = Raum.hitAtom(w);
  else a = hitAtom(w);
  if (a && atoms.indexOf(a) >= 0) {
    removeAtom(a);
    lastDeleteT = performance.now();
    toast(a.el.sym + " entfernt.");
  }
});

canvas.addEventListener("contextmenu", (e) => e.preventDefault());
canvas.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    camGoal = null;
    const m = mpos(e);
    const before = screenToWorld(m.x, m.y);
    cam.z = clamp(cam.z * Math.exp(-e.deltaY * 0.0012), 0.25, 2.4);
    const after = screenToWorld(m.x, m.y);
    cam.x += before.x - after.x;
    cam.y += before.y - after.y;
  },
  { passive: false },
);

/* ---------- Hauptschleife ---------- */
let lastT = performance.now();
function loop(t) {
  const dt = clamp((t - lastT) / 1000, 0.004, 0.032);
  lastT = t;
  try {
    const sub = dt / 2;
    physicsStep(sub);
    physicsStep(sub);
    updateTweens(dt);
    updateSlides(dt);
    updateElectronAnims(dt);
    tweenCam(dt);
    proximitySearch();
    for (const a of atoms) maybeRelax(a);
    if (typeof Bronsted !== "undefined") Bronsted.tick();
  } catch (err) {
    console.error("[Bindungswerkstatt]", err);
  }
  try {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (darkBg) {
      ctx.fillStyle = "#0e1116";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    renderWorld();
    if (typeof Bronsted !== "undefined" && !(typeof Raum !== "undefined" && Raum.an)) {
      try {
        setWorldTransform();
        Bronsted.zeichne2D(ctx);
      } catch (err) {
        console.error("[Bronsted 2D]", err);
      }
    }

    if (typeof Raum !== "undefined" && Raum.an) {
      statusEl.textContent = hoverAtom ? Raum.beschreibe(hoverAtom) : atoms.length + " Atome · " + bonds.length + " Bindungen · 3D-Lewis";
    }
  } catch (err) {
    console.error("[render]", err);
  }
  requestAnimationFrame(loop);
}

/* ---------- Share-Link: kompletter Zustand als URL ---------- */
function zustandsCode() {
  const snap = Undo.snapshot();
  const at = snap.at.map((a) => [a.Z, a.x, a.y, a.e].join(",")).join(";");
  const bd = snap.bd.map((b) => [b.ai, b.bi, b.type, b.order].join(",")).join(";");
  return encodeURIComponent(at + "|" + bd);
}
function codeZuZustand(code) {
  const s = decodeURIComponent(code);
  const teile = s.split("|");
  const at = (teile[0] || "")
    .split(";")
    .filter(Boolean)
    .map((t) => {
      const p = t.split(",");
      return { Z: +p[0], x: +p[1], y: +p[2], e: +p[3] };
    });
  const bd = (teile[1] || "")
    .split(";")
    .filter(Boolean)
    .map((t) => {
      const p = t.split(",");
      return { ai: +p[0], bi: +p[1], type: p[2], order: +p[3] };
    });
  return { at: at, bd: bd };
}
function kopiereText(txt) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(txt).then(
      () => toast("Link kopiert – einfach einfügen!"),
      () => fallbackKopie(txt),
    );
  } else fallbackKopie(txt);
}
function fallbackKopie(txt) {
  const ta = document.createElement("textarea");
  ta.value = txt;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand("copy");
    toast("Link kopiert – einfach einfügen!");
  } catch (e) {
    toast("Kopieren fehlgeschlagen – URL steht in der Konsole.", "warn");
    console.log(txt);
  }
  document.body.removeChild(ta);
}
document.getElementById("btnShare").addEventListener("click", () => {
  if (!atoms.length) {
    toast("Die Bühne ist leer – erst etwas bauen!", "warn");
    return;
  }
  const p = [];
  if (Raum.an) p.push("3d=1");
  if (cutMode) p.push("cut=1");
  p.push("s=" + zustandsCode());
  kopiereText(location.origin + location.pathname + "?" + p.join("&"));
});

/* ---------- URL-Parameter ----------
   ?f=<Formel|Name> – baut beim Start · &3d=1 · &cut=1 · &s=<Zustand> */
(function urlStart() {
  try {
    const q = new URLSearchParams(location.search);
    if (q.get("3d") === "1") {
      Raum.an = true;
      btnRaum.classList.add("on");
    }
    if (q.get("cut") === "1") {
      cutMode = true;
      btnCut.classList.add("on");
      cutChip.classList.add("show");
    }
    const sCode = q.get("s");
    if (sCode) {
      Undo.restore(codeZuZustand(sCode));
      fitAtoms();
    } else {
      let delay = 0;
      q.getAll("f").forEach((f) => {
        setTimeout(() => {
          if (!buildFromFormula(f)) toast(Lewis.lastError || "URL-Formel „" + f + "“ konnte nicht gebaut werden.", "warn");
        }, delay);
        delay += 1200;
      });
    }
  } catch (err) {
    console.error("[urlStart]", err);
  }
})();
cam = fitRect(-20, -20, PSE.w + 560, PSE.h + 20);
requestAnimationFrame(loop);

/* ---------- Molekül-Infokarte ---------- */
const SUB = "₀₁₂₃₄₅₆₇₈₉",
  SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹";
const subN = (n) =>
  String(n)
    .split("")
    .map((d) => SUB[+d])
    .join("");
const MOLEKUEL_DB = {
  H2O: ["Wasser", "Dipolmolekül mit Wasserstoffbrücken — Lösungsmittel des Lebens, Siedetemperatur 100 °C, Dichteanomalie."],
  CO2: ["Kohlenstoffdioxid", "Linear und unpolar — Atmungsprodukt, Sprudelgas, Treibhausgas."],
  NH3: ["Ammoniak", "Trigonal-pyramidal, stark polar — stechender Geruch (Salmiakgeist), wichtige Base."],
  CH4: ["Methan", "Tetraedrisch und unpolar — Erdgas/Faulgas, einfachster Kohlenwasserstoff."],
  H2: ["Wasserstoff", "Leichtestes Element — unpolare Einfachbindung."],
  N2: ["Stickstoff", "78 % der Luft — extrem stabile Dreifachbindung, deshalb reaktionsträge."],
  O2: ["Sauerstoff", "21 % der Luft — Doppelbindung, Atmung und Verbrennung."],
  O3: ["Ozon", "Gewinkelt, polar — bodennah Schadstoff, in der Stratosphäre Schutzschild."],
  HCl: ["Chlorwasserstoff", "Sehr polar — in Wasser starke Säure (Salzsäure)."],
  H2O2: ["Wasserstoffperoxid", "Bleich- und Desinfektionsmittel — instabile O–O-Bindung."],
  SO2: ["Schwefeldioxid", "Gewinkelt, polar — stechender Geruch, verursacht sauren Regen."],
  SO3: ["Schwefeltrioxid", "Trigonal-planar — Ausgangsstoff der Schwefelsäure-Herstellung."],
  H2S: ["Schwefelwasserstoff", "Geruch fauler Eier — Faulschlamm/Vulkane."],
  HCN: ["Cyanwasserstoff", "Blausäure — Bittermandelgeruch, hochgiftig."],
  CO: ["Kohlenstoffmonoxid", "Unpolar, aber hochgiftig — blockiert den Sauerstofftransport im Blut."],
  NO2: ["Stickstoffdioxid", "Braunes Reizgas, Radikal — Verkehrsexposition."],
  CH4O: ["Methanol", "Holzgeist — giftig, einfachster Alkohol."],
  C2H6O: ["Ethanol", "Trinkalkohol — polar durch OH-Gruppe."],
  C2H4: ["Ethen", "Ethylen — Doppelbindung, fördert die Fruchtreifung."],
  C2H2: ["Ethin", "Acetylen — Dreifachbindung, Schweißgas mit heißer Flamme."],
  C6H6: ["Benzol", "Aromat — delokalisierte Elektronen, karzinogen, Lösungsmittel."],
  CH2O: ["Methanal", "Formaldehyd — Konservierung, Desinfektion."],
  CH2O2: ["Ameisensäure", "In Brennnesseln — macht das Zungenbrennen."],
  C2H4O2: ["Essigsäure", "Hauptbestandteil von Essig."],
  NaCl: ["Natriumchlorid", "Kochsalz — Ionengitter, Schmelze/Lösung leitet Strom."],
  MgCl2: ["Magnesiumchlorid", "Ionengitter — in Salzsole und Abau-Salzen."],
  CaCl2: ["Calciumchlorid", "Ionengitter — Streusalz, Trocknungsmittel."],
  Fe2O3: ["Eisen(III)-oxid", "Rost und Hämatit — rotes Erz."],
  Al2O3: ["Aluminiumoxid", "Korund — hart, Saphir und Rubin."],
  CuO: ["Kupfer(II)-oxid", "Schwarzes Pigment, Halbleiter."],
  "NH4+": ["Ammonium-Ion", "Tetraedrisch — 'protoniertes Ammoniak', Dünger."],
  "H3O+": ["Oxonium-Ion", "'Protoniertes Wasser' — die eigentliche Säure-Form."],
  "OH-": ["Hydroxid-Ion", "Die eigentliche Base-Form in Wasser."],
  "SO42-": ["Sulfat-Ion", "Tetraedrisch — Gips und Düngesalze."],
  "NO3-": ["Nitrat-Ion", "Tetraedrisch — Dünger, Grundwasserthema."],
  "PO43-": ["Phosphat-Ion", "Tetraedrisch — Knochen, DNA, Dünger."],
  "CO32-": ["Carbonat-Ion", "Planar — Kalk, Muschelschalen."],
  "ClO4-": ["Perchlorat-Ion", "Tetraedrisch — erweiterter Oktett am Cl."],
  SF6: ["Schwefelhexafluorid", "Oktaedrisch — extrem inert, Isoliergas."],
  BF3: ["Bortrifluorid", "Elektronenarm (kein Oktett am B) — klassische Lewis-Säure."],
};
const infoKarte = document.getElementById("infoKarte");
document.getElementById("infoZu").addEventListener("click", () => (infoKarte.hidden = true));

function zentralAtom(members) {
  let best = members[0],
    bn = -1;
  for (const m of members) {
    const kov = m.bonds.filter((b) => b.type === "cov").length;
    const ord = m.bonds.filter((b) => b.type === "cov").reduce((s, b) => s + b.order, 0);
    const sc = kov * 10 + ord;
    if (sc > bn) {
      bn = sc;
      best = m;
    }
  }
  return best;
}
function summenFormel(members) {
  const n = {};
  let ladung = 0;
  members.forEach((m) => {
    n[m.el.sym] = (n[m.el.sym] || 0) + 1;
    ladung += qOf(m);
  });
  const reihen = [];
  if (n.C) {
    reihen.push(["C", n.C]);
    delete n.C;
  }
  if (n.H) {
    reihen.push(["H", n.H]);
    delete n.H;
  }
  Object.keys(n)
    .sort()
    .forEach((s) => reihen.push([s, n[s]]));
  let f = reihen.map(([s, c]) => s + (c > 1 ? subN(c) : "")).join("");
  return { f: f, ladung: ladung };
}
function polaritaet(members) {
  if (members.some((m) => qOf(m) !== 0)) return "Ionenverbindung — Coulomb-Gitter";
  const inM = new Set(members.map((m) => m.id));
  let vx = 0,
    vy = 0;
  for (const b of bonds) {
    if (b.type !== "cov" || !inM.has(b.a.id) || !inM.has(b.b.id)) continue;
    const dEN = Math.abs(b.a.el.en - b.b.el.en);
    if (dEN < 0.4) continue;
    const neg = b.a.el.en > b.b.el.en ? b.a : b.b;
    const pos = neg === b.a ? b.b : b.a;
    const dx = neg.pos.x - pos.pos.x,
      dy = neg.pos.y - pos.pos.y;
    const l = Math.hypot(dx, dy) || 1;
    vx += (dx / l) * dEN;
    vy += (dy / l) * dEN;
  }
  return Math.hypot(vx, vy) < 0.5 ? "unpolar — Dipole heben sich auf" : "polar — resultierender Dipol";
}
function zeigeInfo(a) {
  const members = bondComponent(a);
  const { f, ladung } = summenFormel(members);
  const key = f + (ladung === 0 ? "" : (Math.abs(ladung) > 1 ? Math.abs(ladung) : "") + (ladung > 0 ? "+" : "-"));
  const db = MOLEKUEL_DB[key];
  const za = zentralAtom(members);
  document.getElementById("infoTitel").textContent = db ? db[0] : "Unbenannte Verbindung";
  document.getElementById("infoFormel").textContent =
    f + (ladung === 0 ? "" : (Math.abs(ladung) > 1 ? Math.abs(ladung) : "") + (ladung > 0 ? "⁺" : "⁻"));
  const z = document.getElementById("infoZeilen");
  z.textContent = "";
  const zeile = (l, w) => {
    const d = document.createElement("div");
    const b = document.createElement("b");
    b.textContent = l;
    d.appendChild(b);
    d.appendChild(document.createTextNode(w));
    z.appendChild(d);
  };
  zeile("VSEPR", Raum.beschreibe(za).split(" · ").slice(2).join(" · "));
  zeile("Polarität", polaritaet(members));
  zeile("Atome · Bindungen", members.length + " · " + members.reduce((s, m) => s + m.bonds.filter((b) => b.type === "cov").length, 0) / 2);
  const p = document.createElement("p");
  p.textContent = db ? db[1] : "Keine Datenbank-Info — freies Experimentiermolekül!";
  z.appendChild(p);
  infoKarte.hidden = false;
}
