"use strict";
/* =====================================================================
   physics.js – Kraftsimulation für die Bühne. Lädt NACH modell.js.
   Federn mit rasterquantisierter Ruhelänge · Coulomb zwischen Ionen
   (gecappt + Soft-Core + Impuls-Dämpfung → keine Oszillation) ·
   weiche Kollision · Anti-Drift zum 20er-Raster · Trennmodus.
   ===================================================================== */

const GRID = 20;
const CUT_NORMAL = 2.1;
const CUT_SCISSOR = 1.5;

/* ---------- Ionen-Stabilisierung ----------
   Coulomb ist 1/r² – ohne Begrenzung oszillieren nahe Ionen extrem.
   Lösung in drei Schichten:
   1) COULOMB_VMAX: Kraft-Cap pro Schritt (keine Beliebig-Steigerung)
   2) ION_MINDIST (Soft-Core): unter 80 px wird der Abstand rechnerisch
      angehoben → Kraft bleibt endlich, Ionen durchdringen sich nicht
   3) Impuls-Vernichtung: nähern sich ungleichnamige Ionen unter 130 px,
      wird die Annäherungsgeschwindigkeit großzügig gelöscht.
   Kraft wirkt IMMER (auch anziehend) – nichts wird abgeschaltet. */
const COULOMB_VMAX = 320;
const ION_MINDIST = 80;
function coulombKraft(qa, qc, d) {
  if (d > 500) return 0;
  const dEff = Math.max(d, ION_MINDIST);
  const d2 = Math.max(dEff * dEff, ION_MINDIST * ION_MINDIST);
  let f = (3.2e6 * qa * qc) / d2;
  f = clamp(f, -COULOMB_VMAX, COULOMB_VMAX);
  return f;
}

function gridRest(b) {
  return Math.max(GRID * 3, Math.round(b.d0 / GRID) * GRID);
}

/* ---------- Coulomb-Schritt (gemeinsam für 2D und 3D) ---------- */
function coulombSchritt(n) {
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = atoms[i],
        c = atoms[j];
      const qa = qOf(a),
        qc = qOf(c);
      if (qa === 0 || qc === 0 || bonded(a, c)) continue;
      if (a._protonFlug || c._protonFlug || a._protonAnkunft || c._protonAnkunft) continue;
      const dx = c.pos.x - a.pos.x,
        dy = c.pos.y - a.pos.y;
      const d = Math.hypot(dx, dy);
      if (d < 0.001) {
        c.pos.x += 0.5;
        continue;
      }

      const f = coulombKraft(qa, qc, d);
      const ux = dx / d,
        uy = dy / d;
      if (f !== 0) {
        a.acc.x -= ux * f;
        a.acc.y -= uy * f;
        c.acc.x += ux * f;
        c.acc.y += uy * f;
      }

      /* Anti-Oszillation: anziehendes Paar nahe + auf Kollisionskurs
         → Relativimpuls entlang der Verbindungslinie vernichten. */
      if (qa * qc < 0 && d < 130) {
        const rel = (c.vel.x - a.vel.x) * ux + (c.vel.y - a.vel.y) * uy;
        if (rel < 0) {
          const imp = rel * 0.75;
          a.vel.x -= ux * imp * 0.5;
          a.vel.y -= uy * imp * 0.5;
          c.vel.x += ux * imp * 0.5;
          c.vel.y += uy * imp * 0.5;
        }
      }
    }
  }
}

function physicsStep(dt) {
  if (typeof Raum !== "undefined" && Raum.an) {
    raumPhysik(dt);
    return;
  }
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

  /* 3) Coulomb zwischen ungebundenen Ionen (stabilisiert) */
  coulombSchritt(n);

  hBrueckenListe();
  hbrKraefte();

  /* 4) Kollision ungebundener Atome.
     Gehaltene/Protonen-Atome sind unbeweglich: das andere wird voll
     verdrängt (kein continue mehr vor dem Push – FIX). */
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = atoms[i],
        c = atoms[j];
      if (bonded(a, c)) continue;
      if (a._protonFlug || c._protonFlug || a._protonAnkunft || c._protonAnkunft) continue;
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
      const aFix = a.held;
      const cFix = c.held;
      if (!aFix && !cFix) {
        a.pos.x -= ux * push;
        a.pos.y -= uy * push;
        c.pos.x += ux * push;
        c.pos.y += uy * push;
      } else if (aFix && !cFix) {
        c.pos.x += ux * push * 2;
        c.pos.y += uy * push * 2;
      } else if (!aFix && cFix) {
        a.pos.x -= ux * push * 2;
        a.pos.y -= uy * push * 2;
      }
      if (aFix) {
        a.vel.x = 0;
        a.vel.y = 0;
      }
      if (cFix) {
        c.vel.x = 0;
        c.vel.y = 0;
      }
      const rel = (c.vel.x - a.vel.x) * ux + (c.vel.y - a.vel.y) * uy;
      if (rel < 0) {
        const k = rel * 0.5;
        if (!aFix) {
          a.vel.x += ux * k;
          a.vel.y += uy * k;
        }
        if (!cFix) {
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
    if (a.held || a._protonFlug || a._protonAnkunft) {
      a.vel.x = 0;
      a.vel.y = 0;
      continue;
    }
    a.vel.x = (a.vel.x + a.acc.x * dt) * damp;
    a.vel.y = (a.vel.y + a.acc.y * dt) * damp;
    const sp = Math.hypot(a.vel.x, a.vel.y);
    if (sp > 480) {
      a.vel.x *= 480 / sp;
      a.vel.y *= 480 / sp;
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

/* ---------- Wasserstoffbrücken ----------
   Donor: H kovalent an O/N/F · Akzeptor: O/N/F mit freiem Paar.
   Nur zwischen verschiedenen Molekülen. Liste wird pro Frame gecacht. */
let hbrAktuell = [];
function hBrueckenListe() {
  const comp = new Map();
  let cid = 0;
  for (const a of atoms) {
    if (!comp.has(a.id)) {
      bondComponent(a).forEach((m) => comp.set(m.id, cid));
      cid++;
    }
  }
  const list = [];
  for (const h of atoms) {
    if (h.el.sym !== "H") continue;
    const don = h.bonds.find((b) => b.type === "cov" && "ONF".includes((b.a === h ? b.b : b.a).el.sym));
    if (!don) continue;
    const kandidaten = [];
    for (const akz of atoms) {
      if (akz === h || akz.el === h.el) continue;
      if (!"ONF".includes(akz.el.sym)) continue;
      if (comp.get(akz.id) === comp.get(h.id)) continue;
      if (loneCount(akz) < 2) continue;
      const d = Math.hypot(akz.pos.x - h.pos.x, akz.pos.y - h.pos.y);
      if (d > 60 && d < 240) kandidaten.push({ akz: akz, d: d });
    }
    kandidaten.sort((x, y) => x.d - y.d);
    if (kandidaten.length) list.push({ h: h, akz: kandidaten[0].akz });
  }
  hbrAktuell = list;
  return list;
}
function hbrKraefte() {
  for (const hb of hbrAktuell) {
    const dx = hb.akz.pos.x - hb.h.pos.x,
      dy = hb.akz.pos.y - hb.h.pos.y;
    const d = Math.hypot(dx, dy) || 1;
    /* beidseitige Feder: zieht oberhalb 185 zusammen, drückt unterhalb
       155 auseinander → stabiles Gleichgewicht statt Pendeln */
    let f = 0;
    if (d > 185) f = (d - 185) * 2.2;
    else if (d < 155) f = (d - 155) * 2.2;
    if (f === 0) continue;
    const ux = dx / d,
      uy = dy / d;
    if (!hb.h.held) {
      hb.h.acc.x += ux * f;
      hb.h.acc.y += uy * f;
    }
    if (!hb.akz.held) {
      hb.akz.acc.x -= ux * f;
      hb.akz.acc.y -= uy * f;
    }
  }
}

/* 3D-Modus: Coulomb zwischen Molekülen, H-Brücken, sanfte Bewegung,
   kein Raster / keine Federn (Geometrie macht raum.js). */
function raumPhysik(dt) {
  const n = atoms.length;
  for (let i = 0; i < n; i++) {
    atoms[i].acc.x = 0;
    atoms[i].acc.y = 0;
  }
  coulombSchritt(n);
  hBrueckenListe();
  hbrKraefte();

  const damp = Math.exp(-2.4 * dt);
  for (const a of atoms) {
    if (a.held || a._protonFlug || a._protonAnkunft) {
      a.vel.x = 0;
      a.vel.y = 0;
      continue;
    }
    a.vel.x = (a.vel.x + a.acc.x * dt) * damp;
    a.vel.y = (a.vel.y + a.acc.y * dt) * damp;
    const sp = Math.hypot(a.vel.x, a.vel.y);
    if (sp > 480) {
      a.vel.x *= 480 / sp;
      a.vel.y *= 480 / sp;
    }
    a.pos.x += a.vel.x * dt;
    a.pos.y += a.vel.y * dt;
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

  /* Schere: Überdehnung trennt */
  if (typeof Raum !== "undefined" && Raum.an) Raum.checkBonds();
}
