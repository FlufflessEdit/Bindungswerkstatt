"use strict";
/* =====================================================================
   physics.js – Kraftsimulation für die Bühne. Lädt NACH modell.js.
   Federn mit rasterquantisierter Ruhelänge · Coulomb zwischen Ionen ·
   weiche Kollision · Anti-Drift zum 20er-Raster · Trennmodus.
   ===================================================================== */

const GRID = 20;
const CUT_NORMAL = 2.1;
const CUT_SCISSOR = 1.5;

function gridRest(b) {
  return Math.max(GRID * 3, Math.round(b.d0 / GRID) * GRID);
}

function physicsStep(dt) {
  const n = atoms.length;

  /* 1) Kräfte zurücksetzen */
  for (let i = 0; i < n; i++) {
    atoms[i].acc.x = 0;
    atoms[i].acc.y = 0;
  }

  /* 2) Bindungs-Federn */
  for (const b of bonds) {
    const dx = b.b.pos.x - b.a.pos.x,
      dy = b.b.pos.y - b.a.pos.y;
    const d = Math.hypot(dx, dy) || 0.001;
    const rest = gridRest(b);
    const ux = dx / d,
      uy = dy / d;
    const rel = (b.b.vel.x - b.a.vel.x) * ux + (b.b.vel.y - b.a.vel.y) * uy;
    const f = (d - rest) * b.k + rel * b.c;
    if (!b.a.held) {
      b.a.acc.x += ux * f;
      b.a.acc.y += uy * f;
    }
    if (!b.b.held) {
      b.b.acc.x -= ux * f;
      b.b.acc.y -= uy * f;
    }
  }

  /* 3) Coulomb zwischen ungebundenen Ionen */
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = atoms[i],
        c = atoms[j];
      const qa = qOf(a),
        qc = qOf(c);
      if (qa === 0 || qc === 0 || bonded(a, c)) continue;
      const dx = c.pos.x - a.pos.x,
        dy = c.pos.y - a.pos.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > 250000) continue;
      const d = Math.sqrt(d2) || 1;
      let f = (3.2e6 * qa * qc) / Math.max(d2, 900);
      f = clamp(f, -2400, 2400);
      const ux = dx / d,
        uy = dy / d;
      a.acc.x -= ux * f;
      a.acc.y -= uy * f;
      c.acc.x += ux * f;
      c.acc.y += uy * f;
    }
  }

  /* 4) Kollision ungebundener Atome */
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = atoms[i],
        c = atoms[j];
      if (bonded(a, c)) continue;
      const dx = c.pos.x - a.pos.x,
        dy = c.pos.y - a.pos.y;
      const d = Math.hypot(dx, dy);
      if (d < 0.001) {
        c.pos.x += 0.4;
        continue;
      }
      const min = (a.edge + c.edge) * 0.82;
      if (d >= min) continue;
      const ux = dx / d,
        uy = dy / d;
      const push = (min - d) * 0.5;
      if (!a.held) {
        a.pos.x -= ux * push;
        a.pos.y -= uy * push;
      }
      if (!c.held) {
        c.pos.x += ux * push;
        c.pos.y += uy * push;
      }
      const rel = (c.vel.x - a.vel.x) * ux + (c.vel.y - a.vel.y) * uy;
      if (rel < 0) {
        const k = rel * 0.5;
        if (!a.held) {
          a.vel.x += ux * k;
          a.vel.y += uy * k;
        }
        if (!c.held) {
          c.vel.x -= ux * k;
          c.vel.y -= uy * k;
        }
      }
    }
  }

  /* 5) deform + Integration + Grid + Bühnengrenzen */
  const damp = Math.exp(-2.4 * dt);
  for (const a of atoms) {
    const soll = a.bonds.some((b) => b.type === "cov") ? 1 : 0;
    a.deform += (soll - a.deform) * (1 - Math.exp(-7 * dt));
    if (a.held) {
      a.vel.x = 0;
      a.vel.y = 0;
      continue;
    }
    a.vel.x = (a.vel.x + a.acc.x * dt) * damp;
    a.vel.y = (a.vel.y + a.acc.y * dt) * damp;
    const sp = Math.hypot(a.vel.x, a.vel.y);
    if (sp > 550) {
      a.vel.x *= 550 / sp;
      a.vel.y *= 550 / sp;
    }
    a.pos.x += a.vel.x * dt;
    a.pos.y += a.vel.y * dt;
    const g = (sp < 30 ? 1 : 0.3) * clamp(7 * dt, 0, 0.3);
    a.pos.x += (Math.round(a.pos.x / GRID) * GRID - a.pos.x) * g;
    a.pos.y += (Math.round(a.pos.y / GRID) * GRID - a.pos.y) * g;
    const x0 = STAGE.x - STAGE.hw + a.edge,
      x1 = STAGE.x + STAGE.hw - a.edge;
    const y0 = STAGE.y - STAGE.hh + a.edge,
      y1 = STAGE.y + STAGE.hh - a.edge;
    if (a.pos.x < x0) {
      a.pos.x = x0;
      if (a.vel.x < 0) a.vel.x = 0;
    }
    if (a.pos.x > x1) {
      a.pos.x = x1;
      if (a.vel.x > 0) a.vel.x = 0;
    }
    if (a.pos.y < y0) {
      a.pos.y = y0;
      if (a.vel.y < 0) a.vel.y = 0;
    }
    if (a.pos.y > y1) {
      a.pos.y = y1;
      if (a.vel.y > 0) a.vel.y = 0;
    }
  }

  /* 6) Bindungsbruch bei Überdehnung */
  const lim = cutMode ? CUT_SCISSOR : CUT_NORMAL;
  for (let i = bonds.length - 1; i >= 0; i--) {
    const b = bonds[i];
    const d = Math.hypot(b.b.pos.x - b.a.pos.x, b.b.pos.y - b.a.pos.y);
    if (d > gridRest(b) * lim) breakBond(b, null);
  }
}
