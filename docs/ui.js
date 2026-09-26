"use strict";
/* =====================================================================
   ui.js — Kamera, Eingabe, Buttons, Formel-Presets, Toasts, Hauptschleife.
   Lädt als LETZTES.
   ===================================================================== */

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

/* ---------- Treffer-Tests ---------- */
function hitSlot(w) {
  for (let k = atoms.length - 1; k >= 0; k--) {
    const a = atoms[k];
    if (a.dead) continue;
    if (Math.hypot(w.x - a.pos.x, w.y - a.pos.y) > a.edge + 14) continue;
    const s = a.shells.length - 1,
      sh = a.shells[s];
    for (let i = 0; i < sh.slots.length; i++) {
      if (sh.slots[i].st === "rm") continue;
      const p = slotPosWorld(a, s, i);
      if (Math.hypot(w.x - p.x, w.y - p.y) <= BUB + 4) return { a, s, i };
    }
  }
  return null;
}
function hitAtom(w) {
  for (let k = atoms.length - 1; k >= 0; k--) {
    const a = atoms[k];
    if (a.dead) continue;
    if (Math.hypot(w.x - a.pos.x, w.y - a.pos.y) <= a.edge * 1.05) return a;
  }
  return null;
}

/* ---------- Spawn (mit Elementmolekülen) ---------- */
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
  if (diatomic && DIA.has(Z)) {
    const b = makeAtom(Z, STAGE.x, STAGE.y);
    const d = a.radii[a.radii.length - 1] + b.radii[b.radii.length - 1];
    const th = Math.random() * TAU;
    b.pos.x = a.pos.x + Math.cos(th) * d;
    b.pos.y = a.pos.y + Math.sin(th) * d;
    createCov(a, b);
  }
  if (!stageVisible()) camGoal = fitRect(-20, -20, PSE.w + 560, PSE.h + 20);
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

/* ---------- Buttons ---------- */
const btnPse = document.getElementById("btnPse");
btnPse.addEventListener("click", goPSE);
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
document.getElementById("btnClear").addEventListener("click", clearAll);
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
});
const btnDi = document.getElementById("btnDi");
btnDi.addEventListener("click", () => {
  diatomic = !diatomic;
  btnDi.classList.toggle("on", diatomic);
});

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

/* ---------- Formel-Presets ---------- */
const FORMELN = [
  ["H₂O", "H2O"],
  ["CO₂", "CO2"],
  ["NH₃", "NH3"],
  ["CH₄", "CH4"],
  ["C₂H₆", "C2H6"],
  ["HCN", "HCN"],
  ["O₃", "O3"],
  ["SO₂", "SO2"],
  ["SO₄²⁻", "SO4^2-"],
  ["NH₄⁺", "NH4^+"],
  ["BF₃", "BF3"],
  ["SF₆", "SF6"],
  ["NO₂", "NO2"],
  ["NO₃⁻", "NO3-"],
  ["PO₄³⁻", "PO4^3-"],
  ["ClO₄⁻", "ClO4-"],
  ["C₆H₁₄", "C6H14"],
  ["NaCl", "NaCl"],
];
const fpEl = document.getElementById("formulaPresets");
FORMELN.forEach(([label, f]) => {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = label;
  b.title = f + " bauen";
  b.addEventListener("click", () => {
    formulaInput.value = label;
    if (!buildFromFormula(f)) toast(Lewis.lastError || "„" + label + "“ konnte nicht gebaut werden.", "warn");
  });
  fpEl.appendChild(b);
});

/* ---------- Eingabe ---------- */
function mpos(e) {
  const r = canvas.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

canvas.addEventListener("pointerdown", (e) => {
  const m = mpos(e),
    w = screenToWorld(m.x, m.y);
  const slot = hitSlot(w),
    a = slot ? slot.a : hitAtom(w);
  if (slot || a) {
    camGoal = null;
    drag = { mode: "click", start: w, last: w, slot, atom: a, member: null };
    canvas.setPointerCapture(e.pointerId);
  } else {
    drag = { mode: "pan", sx: e.clientX, sy: e.clientY, cx: cam.x, cy: cam.y, downW: w, moved: false };
    canvas.setPointerCapture(e.pointerId);
  }
});
canvas.addEventListener("pointermove", (e) => {
  const m = mpos(e);
  if (!drag) {
    const w = screenToWorld(m.x, m.y);
    hoverSlot = hitSlot(w);
    hoverAtom = hoverSlot ? null : hitAtom(w);
    PSE.hover = !hoverSlot && !hoverAtom ? pseHit(w.x, w.y) : null;
    canvas.style.cursor = hoverSlot || PSE.hover ? "pointer" : hoverAtom ? "grab" : "default";
    return;
  }
  if (drag.mode === "pan") {
    const dx = e.clientX - drag.sx,
      dy = e.clientY - drag.sy;
    if (Math.hypot(dx, dy) > 5) drag.moved = true;
    if (drag.moved) {
      camGoal = null;
      cam.x = drag.cx - dx / cam.z;
      cam.y = drag.cy - dy / cam.z;
    }
    return;
  }
  const w = screenToWorld(m.x, m.y);
  if (drag.mode === "click") {
    if (Math.hypot(w.x - drag.start.x, w.y - drag.start.y) > 6 / Math.max(cam.z, 0.2)) {
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
canvas.addEventListener("pointerup", (e) => {
  if (drag && drag.mode === "pan") {
    if (!drag.moved) {
      const Z = pseHit(drag.downW.x, drag.downW.y);
      if (Z) spawnFromPSE(Z);
    }
    drag = null;
    return;
  }
  if (drag && drag.mode === "click" && drag.slot) toggleElectron(drag.slot);
  if (drag && drag.member) drag.member.forEach((mm) => (mm.held = false));
  for (const m of atoms) {
    if (m.pullDir != null) {
      m.pullDir = null;
      m.relaxDirty = true;
    }
  }
  drag = null;
  canvas.style.cursor = "default";
});
canvas.addEventListener("pointercancel", () => {
  if (drag && drag.member) drag.member.forEach((mm) => (mm.held = false));
  for (const m of atoms) {
    if (m.pullDir != null) {
      m.pullDir = null;
      m.relaxDirty = true;
    }
  }
  drag = null;
  canvas.style.cursor = "default";
});
canvas.addEventListener("dblclick", () => {});
canvas.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  const m = mpos(e),
    w = screenToWorld(m.x, m.y);
  for (let k = atoms.length - 1; k >= 0; k--) {
    const a = atoms[k];
    if (a.dead) continue;
    if (Math.hypot(w.x - a.pos.x, w.y - a.pos.y) <= Math.max(a.kernR * 1.9, 26)) {
      removeAtom(a);
      return;
    }
  }
});
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
  } catch (err) {
    console.error("[render]", err);
  }
  requestAnimationFrame(loop);
}
if (window.lucide) {
  try {
    lucide.createIcons();
  } catch (err) {}
}
cam = fitRect(-20, -20, PSE.w + 560, PSE.h + 20);
requestAnimationFrame(loop);
