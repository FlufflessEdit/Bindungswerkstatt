"use strict";
/* ================================================================
   render.js — Canvas, Kamera und die Bühnen-Darstellung.
   PSE und Atome leben in EINEM Weltkoordinatensystem.
   Lädt nach physics.js, vor ui.js.
================================================================ */
const canvas = document.getElementById("stage"),
  ctx = canvas.getContext("2d");
let W = 800,
  H = 600,
  DPR = 1;
let cam = { x: 0, y: 0, z: 0.9 };
new ResizeObserver(() => {
  const r = canvas.parentElement.getBoundingClientRect();
  W = r.width;
  H = r.height;
  DPR = window.devicePixelRatio || 1;
  canvas.width = W * DPR;
  canvas.height = H * DPR;
}).observe(canvas.parentElement);

function screenToWorld(px, py) {
  return { x: (px - W / 2) / cam.z + cam.x, y: (py - H / 2) / cam.z + cam.y };
}
function setWorldTransform() {
  ctx.setTransform(DPR * cam.z, 0, 0, DPR * cam.z, DPR * (W / 2 - cam.x * cam.z), DPR * (H / 2 - cam.y * cam.z));
}
function withSpawnScale(a, fn) {
  const s = easeOutBack(clamp((now() - a.born) / 0.5, 0, 1));
  ctx.save();
  ctx.translate(a.pos.x, a.pos.y);
  ctx.scale(s, s);
  ctx.translate(-a.pos.x, -a.pos.y);
  fn();
  ctx.restore();
}
function outerPath(a) {
  ctx.beginPath();
  for (let i = 0; i <= 88; i++) {
    const th = (i / 88) * TAU,
      r = outerRAt(a, th);
    const x = a.pos.x + Math.cos(th) * r,
      y = a.pos.y + Math.sin(th) * r;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.closePath();
}

const FONT = '"Space Grotesk",sans-serif';

function renderWorld() {
  setWorldTransform();
  const L = cam.x - W / cam.z / 2,
    T = cam.y - H / cam.z / 2,
    R2 = cam.x + W / cam.z / 2,
    B2 = cam.y + H / cam.z / 2;
  ctx.fillStyle = darkBg ? "rgba(255,255,255,.07)" : "rgba(128,134,148,.3)";
  for (let gx = Math.floor(L / 56) * 56; gx <= R2; gx += 56)
    for (let gy = Math.floor(T / 56) * 56; gy <= B2; gy += 56) {
      ctx.beginPath();
      ctx.arc(gx, gy, 1.5, 0, TAU);
      ctx.fill();
    }
  try {
    drawPSE(ctx);
  } catch (err) {
    console.error("[drawPSE]", err);
  }
  if (typeof Raum !== "undefined" && Raum.an) {
    try {
      Raum.render(ctx);
    } catch (err) {
      console.error("[Raum]", err);
    }
    return;
  }
  for (const a of atoms) {
    try {
      ctx.globalAlpha = 0.1;
      outerPath(a);
      ctx.fillStyle = shellColorOf(a);
      ctx.fill();
      ctx.globalAlpha = 1;
    } catch (err) {
      console.error("[fill]", err);
    }
  }
  for (const b of bonds) {
    try {
      if (b.type === "ion") drawIonLine(b);
    } catch (err) {
      console.error(err);
    }
  }

  for (const hb of typeof hBrueckenListe === "function" ? hBrueckenListe() : []) {
    ctx.setLineDash([3, 5]);
    ctx.strokeStyle = "rgba(217,160,91,.75)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(hb.h.pos.x, hb.h.pos.y);
    ctx.lineTo(hb.akz.pos.x, hb.akz.pos.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  for (const a of atoms) {
    try {
      withSpawnScale(a, () => drawShells(a));
    } catch (err) {
      console.error("[drawShells]", err);
    }
  }
  try {
    for (const tw of tweens) drawElectronBubble(tw.pos.x, tw.pos.y, shellColorOf(tw.e.atom), false);
  } catch (err) {
    console.error(err);
  }
  // Kerne ZULETZT und neueste zuerst – kein Kern wird je verdeckt
  for (let k = atoms.length - 1; k >= 0; k--) {
    const a = atoms[k];
    if (a.dead) continue;
    try {
      withSpawnScale(a, () => drawCore(a));
    } catch (err) {
      console.error("[drawCore]", err);
    }
  }
}

/* Jeder Platz: gestrichelt leer ODER ein Elektron. */
function drawShells(a) {
  const last = a.shells.length - 1;
  for (let s = 0; s <= last; s++) {
    const col = SHELL_COL[s] || "#93a1b3" /* FIX: Fallback ab 5. Schale */,
      sh = a.shells[s];
    if (s === last) outerPath(a);
    else {
      ctx.beginPath();
      ctx.arc(a.pos.x, a.pos.y, a.radii[s], 0, TAU);
    }
    ctx.lineWidth = s === last && hoverAtom === a ? 3.4 : 2.4;
    ctx.strokeStyle = col;
    ctx.stroke();
    for (let i = 0; i < sh.slots.length; i++) {
      const slot = sh.slots[i];
      if (slot.st === "rm") continue;
      const hov = hoverSlot && hoverSlot.a === a && hoverSlot.s === s && hoverSlot.i === i;
      if (slot.st === "e") {
        const e = slot.e;
        if (e && e.state === "slot") {
          const th = dispAng(a, e);
          const r = s === last ? outerRAt(a, th) : a.radii[s];
          if (isFinite(th) && isFinite(r)) drawElectronBubble(a.pos.x + Math.cos(th) * r, a.pos.y + Math.sin(th) * r, col, hov);
        }
      } else {
        const p = slotPosWorld(a, s, i);
        ctx.beginPath();
        ctx.arc(p.x, p.y, BUB * (hov ? 1.22 : slot.st === "res" ? 0.82 : 1), 0, TAU);
        ctx.setLineDash([3, 3.5]);
        ctx.lineWidth = 1.6;
        ctx.strokeStyle = slot.st === "res" ? "rgba(255,255,255,.16)" : "rgba(255,255,255,.26)";
        ctx.stroke();
        ctx.setLineDash([]);
        if (hov) {
          ctx.fillStyle = "rgba(240,200,90,.35)";
          ctx.fill();
        }
      }
    }
  }
}
function drawElectronBubble(x, y, col, hov) {
  const r = BUB * (hov ? 1.25 : 1);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fillStyle = hov ? "#ffe9a8" : "#f2efe6";
  ctx.fill();
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = col;
  ctx.stroke();
  ctx.fillStyle = "#171b22";
  ctx.font = "700 11px " + FONT;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("−", x, y + 0.5);
}
function drawIonLine(b) {
  ctx.setLineDash([5, 6]);
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(255,255,255,.3)";
  ctx.beginPath();
  ctx.moveTo(b.a.pos.x, b.a.pos.y);
  ctx.lineTo(b.b.pos.x, b.b.pos.y);
  ctx.stroke();
  ctx.setLineDash([]);
}

/* Kern mit Elementsymbol. Ladung ODER partielle Ladung sitzt als
   farbiger Kreis DIREKT am Symbol. Symbol UND Marke schrumpfen
   gemeinsam proportional, bis die ganze Gruppe in den Kreis passt. */
function drawCore(a) {
  const q = qOf(a);
  let mark = "",
    mcol = "";
  if (q !== 0) {
    mark = fmtQ(q);
    mcol = q > 0 ? "#e0563f" : "#5b8fd9";
  } else {
    const pc = partialCharge(a);
    if (pc < 0) {
      mark = "δ−";
      mcol = "#5b8fd9";
    } else if (pc > 0) {
      mark = "δ+";
      mcol = "#e0563f";
    }
  }
  // Kern mit Protonen-Kreuzen
  ctx.beginPath();
  ctx.arc(a.pos.x, a.pos.y, a.kernR, 0, TAU);
  ctx.fillStyle = "#2a1613";
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = "#e0563f";
  ctx.stroke();
  ctx.strokeStyle = "#ff8a68";
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  for (const p of a.plus) {
    const x = a.pos.x + p.x,
      y = a.pos.y + p.y;
    ctx.beginPath();
    ctx.moveTo(x - 3, y);
    ctx.lineTo(x + 3, y);
    ctx.moveTo(x, y - 3);
    ctx.lineTo(x, y + 3);
    ctx.stroke();
  }
  ctx.lineCap = "butt";
  // transparenter Symbolkreis
  const sr = clamp(a.kernR * 0.86, 15, 27);
  ctx.beginPath();
  ctx.arc(a.pos.x, a.pos.y, sr, 0, TAU);
  ctx.fillStyle = "rgba(240,238,230,.88)";
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "rgba(14,17,22,.5)";
  ctx.stroke();
  /* Gemeinsame Größenfindung: Symbol + Marke = eine Gruppe, die in
     den Kreis passen muss. Beide schrumpfen proportional mit. */
  const gap = 3,
    pad = 3;
  const avail = (sr - pad) * 2;
  let fs = clamp(sr * 0.95, 15, 26);
  for (let pass = 0; pass < 4; pass++) {
    ctx.font = `700 ${Math.round(fs)}px ${FONT}`;
    const sw0 = ctx.measureText(a.el.sym).width;
    let need = sw0;
    if (mark) {
      const mf0 = Math.max(7, fs * 0.52);
      ctx.font = `700 ${Math.round(mf0)}px ${FONT}`;
      const qw0 = ctx.measureText(mark).width;
      need = sw0 + gap + 2 * (qw0 / 2 + 2);
    }
    if (need <= avail) break;
    fs = Math.max(8, (fs * avail) / need);
  }
  // finale, konsistente Werte
  ctx.font = `700 ${Math.round(fs)}px ${FONT}`;
  const sw = ctx.measureText(a.el.sym).width;
  let mf = 0,
    qw = 0,
    mr = 0;
  if (mark) {
    mf = Math.max(7, fs * 0.52);
    ctx.font = `700 ${Math.round(mf)}px ${FONT}`;
    qw = ctx.measureText(mark).width;
    mr = qw / 2 + 2;
  }
  const gx = mark ? -(gap + 2 * mr) / 2 : 0; // Gruppe zentrieren
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#171b22";
  ctx.font = `700 ${Math.round(fs)}px ${FONT}`;
  ctx.fillText(a.el.sym, a.pos.x + gx, a.pos.y + 1);
  // Marke: farbiger Kreis mit weißer Schrift, hochgesetzt ans Symbol
  if (mark) {
    const mx = a.pos.x + gx + sw / 2 + gap + mr;
    // vertikal: hochgesetzt, aber vollständig im Kreis
    const my = a.pos.y - Math.max(0, Math.min(fs * 0.42, sr - mr - 3));
    const t = now(),
      ps = easeOutBack(clamp((t - a.badgePop) / 0.3, 0, 1));
    ctx.save();
    ctx.translate(mx, my);
    ctx.scale(ps, ps);
    ctx.translate(-mx, -my);
    ctx.beginPath();
    ctx.arc(mx, my, mr, 0, TAU);
    ctx.fillStyle = mcol;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#0e1116";
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.font = `700 ${Math.round(mf)}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(mark, mx, my + 0.5);
    ctx.restore();
  }
}
