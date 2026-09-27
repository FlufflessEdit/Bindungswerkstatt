"use strict";
/* =====================================================================
   modell.js – Atome (Schalenmodell mit einzelnen Elektronen), Elektronen-
   transfer, kovalente Bindungen, Kontakt-Logik, Lewis-Aufbau.
   ===================================================================== */
let atoms = [],
  bonds = [],
  tweens = [],
  slides = [],
  nextAid = 1,
  nextEid = 1;
let cutMode = false;
const cooldowns = new Map();
function cd(key, ms = 1400) {
  const t = now();
  if ((cooldowns.get(key) || 0) > t) return true;
  cooldowns.set(key, t + ms);
  return false;
}

function placesForShell(n, S) {
  const caps = [2, 6, 10, 14];
  let lmax = n >= 2 ? 1 : 0,
    rest = S,
    l = 0;
  while (rest > 0 && l < 4) {
    rest -= Math.min(rest, caps[l]);
    lmax = Math.max(lmax, l);
    l++;
  }
  lmax = Math.min(lmax, 3, n - 1);
  let t = 0;
  for (let i = 0; i <= lmax; i++) t += caps[i];
  return t;
}
function buildShellSlots(count, S, rot) {
  const slots = [],
    occ = new Set();
  for (let k = 0; k < S; k++) occ.add(Math.min(count - 1, Math.round((k * count) / S)));
  for (let i = 0; i < count; i++) slots.push({ ang: rot + TAU * ((i + 0.5) / count), st: occ.has(i) ? "e" : "empty", e: null });
  return slots;
}
function setSlot(sh, i, st, e) {
  const o = sh.slots[i];
  sh.slots[i] = { ang: o.ang, st, e: e || null };
}

function makeAtom(Z, x, y) {
  const el = ELBYZ[Z];
  if (!el) {
    console.error("[Bindungswerkstatt] makeAtom: Kein Element mit Ordnungszahl " + Z + " – pse.js unvollständig oder veraltet.");
    return null;
  }
  const plus = [{ x: 0, y: 0 }];
  let ring = 1,
    placed = 1;
  while (placed < Z) {
    const capR = Math.floor((TAU * ring * PR_STEP) / PR_GAP),
      cnt = Math.min(Z - placed, capR);
    for (let i = 0; i < cnt; i++) {
      const a2 = (i / cnt) * TAU + ring * 0.5;
      plus.push({ x: Math.cos(a2) * ring * PR_STEP, y: Math.sin(a2) * ring * PR_STEP });
    }
    placed += cnt;
    ring++;
  }
  const kernR = Math.max(15, (ring - 1) * PR_STEP + 8.5);
  const counts = [];
  for (let n = 1; n <= el.per; n++) counts.push(placesForShell(n, el.shells[n - 1] || 0));
  const radii = [];
  let r = kernR + 24;
  counts.forEach((c, i) => {
    if (i > 0) r = Math.max(radii[i - 1] + 26, (c * 23.5) / TAU + 4);
    radii.push(r);
  });
  const a = {
    id: nextAid++,
    Z,
    el,
    pos: { x, y },
    vel: { x: 0, y: 0 },
    acc: { x: 0, y: 0 },
    kernR,
    plus,
    radii,
    edge: radii[radii.length - 1] + BUB,
    shells: [],
    electrons: [],
    bonds: [],
    deform: 0,
    pullDir: null,
    born: now(),
    badgePop: -9,
    held: false,
    dead: false,
    relaxKey: null,
    relaxDirty: false,
  };
  counts.forEach((c, s) => {
    const slots = buildShellSlots(c, el.shells[s] || 0, -Math.PI / 2 + s * 0.35);
    a.shells.push({ slots });
    slots.forEach((sl, i) => {
      if (sl.st === "e") {
        const e = {
          id: nextEid++,
          atom: a,
          state: "slot",
          sh: s,
          idx: i,
          bond: null,
          pairIndex: null,
          role: null,
          tw: null,
          animT: 1,
          animFrom: null,
          dispA: sl.ang,
        };
        sl.e = e;
        a.electrons.push(e);
      }
    });
  });
  atoms.push(a);
  refreshCounts();
  return a;
}

const qOf = (a) => a.Z - a.electrons.length;
const outerSh = (a) => a.shells[a.shells.length - 1];
const outerE = (a) => outerSh(a).slots.filter((s) => s.st === "e").length;
const bondOrderSum = (a) => a.bonds.reduce((s, b) => s + (b.type === "cov" ? b.order : 0), 0);
const valenceAround = (a) => outerE(a) + bondOrderSum(a);

/* Valenz-Ziel: Dublett (H) · Oktett (Periode 2) · 2·ve ab Periode 3
   (Hypervalenz: S 12 → SF₆, Cl 14 → ClO₄⁻, P 10 → PCl₅). */
const valTarget = (a) => (a.shells.length === 1 ? 2 : a.el.per >= 3 ? 2 * a.el.ve : 8);
const freeVal = (a) => valTarget(a) - valenceAround(a);
const loneCount = (a) => outerE(a) - bondOrderSum(a);

/* Elektronen-AUFNAHME endet beim Oktett (Cl⁻ nimmt kein zweites Elektron) */
const oktettFrei = (a) => (a.shells.length === 1 ? 2 : 8) - valenceAround(a);

/* Statischer Bindungsbedarf (8 − Valenz): F/H 1, O 2, N 3, C 4, S 2, Cl 1 … */
const valBedarf = (a) => Math.max(0, (a.shells.length === 1 ? 2 : 8) - a.el.ve);

/* Ordnung einer neuen Hand-Bindung: kleinster Bedarf beider Partner.
   C+O → 2 (Doppelbindung), N+N → 3, Cl+Cl → 1, S+O → 2, H+X → 1. */
function bondOrderFor(a, b) {
  if (qOf(a) !== 0 || qOf(b) !== 0) return 0;
  const cap = Math.min(3, valBedarf(a), valBedarf(b));
  if (cap < 1) return 0;
  return Math.max(0, Math.min(cap, freeVal(a), freeVal(b), loneCount(a), loneCount(b)));
}

function partialCharge(a) {
  if (qOf(a) !== 0) return 0;
  let s = 0;
  for (const b of a.bonds) {
    if (b.type !== "cov" || !b.polar) continue;
    if ((b.a === a) === (b.strong === "a")) s++;
    else s--;
  }
  return s > 0 ? -1 : s < 0 ? 1 : 0;
}

function slotAngle(a, sh, i) {
  return a.shells[sh].slots[i].ang;
}
function outerRAt(a, th) {
  const base = a.radii[a.radii.length - 1];
  let add = 0;
  for (const b of a.bonds) {
    if (b.type !== "cov") continue;
    const p = (b.a === a ? b.b : b.a).pos;
    const c = Math.cos(angNorm(th - Math.atan2(p.y - a.pos.y, p.x - a.pos.x)));
    if (c > 0) add += a.deform * (b.a === a ? b.bulgeA : b.bulgeB) * c * c;
  }
  return base + add;
}
function slotPosWorld(a, sh, i) {
  const th = slotAngle(a, sh, i),
    r = sh === a.shells.length - 1 ? outerRAt(a, th) : a.radii[sh];
  return { x: a.pos.x + Math.cos(th) * r, y: a.pos.y + Math.sin(th) * r };
}
function dispAng(a, e) {
  let t;
  if (e.bond && e.bond.a && e.bond.b) {
    const b = e.bond,
      p = (b.a === a ? b.b : b.a).pos;
    t = Math.atan2(p.y - a.pos.y, p.x - a.pos.x) + ((e.pairIndex || 0) - (b.order - 1) / 2) * 0.16;
  } else {
    const sh = a.shells[e.sh];
    t = sh && sh.slots[e.idx] ? sh.slots[e.idx].ang : -Math.PI / 2;
  }
  if (!isFinite(t)) t = -Math.PI / 2;
  if (e.animT < 1 && e.animFrom != null && isFinite(e.animFrom)) return e.animFrom + angNorm(t - e.animFrom) * easeIO(e.animT);
  return t;
}
function updateElectronAnims(dt) {
  for (const a of atoms) {
    if (a.dead) continue;
    for (const e of a.electrons) {
      if (e.state !== "slot") continue;
      if (e.animT < 1) e.animT = Math.min(1, e.animT + dt / 0.35);
      e.dispA = dispAng(a, e);
    }
  }
}
const bonded = (a, b) => a.bonds.some((x) => x.a === b || x.b === b);
function bondComponent(start) {
  const seen = new Set([start]),
    stack = [start];
  while (stack.length) {
    const a = stack.pop();
    for (const b of a.bonds) {
      const p = b.a === a ? b.b : b.a;
      if (!seen.has(p)) {
        seen.add(p);
        stack.push(p);
      }
    }
  }
  return [...seen];
}

function addTween(e, from, targetFn, onDone, delay = 0, dur = 0.55) {
  const T0 = targetFn();
  const mx = (from.x + T0.x) / 2,
    my = (from.y + T0.y) / 2;
  const dx = T0.x - from.x,
    dy = T0.y - from.y,
    d = Math.hypot(dx, dy) || 1;
  const ctrl = { x: mx - (dy / d) * d * 0.3, y: my + (dx / d) * d * 0.3 };
  const tw = { e, t: -delay, dur, from, ctrl, targetFn, onDone, pos: { ...from } };
  e.state = "fly";
  e.tw = tw;
  tweens.push(tw);
  return tw;
}
function updateTweens(dt) {
  for (let i = tweens.length - 1; i >= 0; i--) {
    const tw = tweens[i];
    if (tw.e.state === "gone" || tw.e.atom.dead) {
      tweens.splice(i, 1);
      continue;
    }
    tw.t += dt;
    if (tw.t < 0) continue;
    const p = clamp(tw.t / tw.dur, 0, 1),
      k = easeIO(p),
      T = tw.targetFn();
    const u = 1 - k;
    tw.pos.x = u * u * tw.from.x + 2 * u * k * tw.ctrl.x + k * k * T.x;
    tw.pos.y = u * u * tw.from.y + 2 * u * k * tw.ctrl.y + k * k * T.y;
    if (p >= 1) {
      tweens.splice(i, 1);
      tw.e.tw = null;
      tw.onDone();
    }
  }
}

function relaxLonePairs(a) {
  const sh = outerSh(a);
  const cap = sh.slots.length;
  if (!cap) return;
  const es = [];
  for (let i = 0; i < cap; i++) {
    const s = sh.slots[i];
    if (s.st === "e" && s.e && !s.e.bond && s.e.state === "slot") es.push({ e: s.e, idx: i });
  }
  if (!es.length) return;
  es.sort((x, y) => sh.slots[x.idx].ang - sh.slots[y.idx].ang);
  const n = es.length;
  for (let i = 0; i < cap; i++) if (sh.slots[i].st === "rm") setSlot(sh, i, "empty");
  for (const it of es) setSlot(sh, it.idx, "empty", null);
  const dirs = [];
  for (const b of a.bonds) {
    if (b.type !== "cov") continue;
    const p = (b.a === a ? b.b : b.a).pos;
    dirs.push(Math.atan2(p.y - a.pos.y, p.x - a.pos.x));
  }
  const pull = a.pullDir != null ? a.pullDir : null;
  if (pull != null) dirs.push(pull);
  let th0 = -Math.PI / 2,
    span = TAU;
  if (dirs.length) {
    dirs.sort((x, y) => x - y);
    let bigW = dirs[0] - dirs[dirs.length - 1] + TAU,
      bigS = dirs[dirs.length - 1];
    for (let i = 0; i < dirs.length - 1; i++) {
      const w = dirs[i + 1] - dirs[i];
      if (w > bigW) {
        bigW = w;
        bigS = dirs[i];
      }
    }
    th0 = bigS;
    span = bigW;
  }
  const P = Math.ceil(n / 2);
  const targets = [];
  for (let j = 0; j < P; j++) {
    if (j === 0 && pull != null) targets.push(pull);
    else targets.push(dirs.length ? th0 + span * ((j + 1) / (P + 1)) : th0 + span * ((j + 0.5) / P));
  }
  const empty = (i) => sh.slots[i].st === "empty";
  const used = new Set(),
    tgt = [];
  for (let j = 0; j < P; j++) {
    const single = j === P - 1 && n % 2 === 1;
    if (!single) {
      let best = null,
        bs = 1e9;
      for (let i = 0; i < cap; i++) {
        const i2 = (i + 1) % cap;
        if (used.has(i) || used.has(i2) || !empty(i) || !empty(i2)) continue;
        const m = sh.slots[i].ang + angNorm(sh.slots[i2].ang - sh.slots[i].ang) / 2;
        const d = Math.abs(angNorm(m - targets[j]));
        if (d < bs) {
          bs = d;
          best = [i, i2];
        }
      }
      if (best) {
        used.add(best[0]);
        used.add(best[1]);
        tgt.push(best[0], best[1]);
      } else tgt.push(null, null);
    } else {
      let best = -1,
        bs = 1e9;
      for (let i = 0; i < cap; i++) {
        if (used.has(i) || !empty(i)) continue;
        const d = Math.abs(angNorm(sh.slots[i].ang - targets[j]));
        if (d < bs) {
          bs = d;
          best = i;
        }
      }
      if (best >= 0) {
        used.add(best);
        tgt.push(best);
      } else tgt.push(null);
    }
  }
  const assign = [];
  for (let j = 0; j < P; j++) {
    const cnt = j === P - 1 && n % 2 === 1 ? 1 : 2;
    for (let k = 0; k < cnt; k++) {
      const it = es[j * 2 + k];
      if (it) assign.push({ e: it.e, to: tgt[j * 2 + k] });
    }
  }
  for (const x of assign) {
    if (x.to != null) continue;
    for (let i = 0; i < cap; i++) {
      if (!used.has(i) && empty(i)) {
        used.add(i);
        x.to = i;
        break;
      }
    }
  }
  for (const x of assign) {
    if (x.to == null) continue;
    const e = x.e;
    e.animFrom = isFinite(e.dispA) ? e.dispA : sh.slots[x.to].ang;
    e.animT = 0;
    setSlot(sh, x.to, "e", e);
    e.idx = x.to;
    e.sh = a.shells.length - 1;
  }
}

function updateRemovedSpots(a) {
  const sh = outerSh(a);
  const cap = sh.slots.length;
  for (let i = 0; i < cap; i++) if (sh.slots[i].st === "rm") setSlot(sh, i, "empty");
  for (const b of a.bonds) {
    if (b.type !== "cov") continue;
    const p = (b.a === a ? b.b : b.a).pos;
    const ang = Math.atan2(p.y - a.pos.y, p.x - a.pos.x);
    const o = b.order;
    let best = -1,
      bs = 1e9;
    for (let i = 0; i < cap; i++) {
      let ok = true;
      for (let k = 0; k < o; k++) {
        if (sh.slots[(i + k) % cap].st !== "empty") {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      let sc = 0;
      for (let k = 0; k < o; k++) sc += Math.abs(angNorm(sh.slots[(i + k) % cap].ang - ang));
      if (sc < bs) {
        bs = sc;
        best = i;
      }
    }
    if (best >= 0) {
      for (let k = 0; k < o; k++) setSlot(sh, (best + k) % cap, "rm");
    } else {
      const cand = [];
      for (let i = 0; i < cap; i++) {
        if (sh.slots[i].st !== "empty") continue;
        cand.push({ i, d: Math.abs(angNorm(sh.slots[i].ang - ang)) });
      }
      cand.sort((x, y) => x.d - y.d);
      for (let k = 0; k < Math.min(o, cand.length); k++) setSlot(sh, cand[k].i, "rm");
    }
  }
}
function updateSlides(dt) {
  for (let i = slides.length - 1; i >= 0; i--) slides.splice(i, 1);
}
function maybeRelax(a) {
  if (a.dead) return;
  let key = outerE(a);
  for (const b of a.bonds) {
    if (b.type !== "cov") continue;
    const p = (b.a === a ? b.b : b.a).pos;
    key = key * 31 + Math.round(Math.atan2(p.y - a.pos.y, p.x - a.pos.x) * 20);
  }
  if (a.pullDir != null) key = key * 31 + Math.round(a.pullDir * 20);
  if (a.relaxDirty || key !== a.relaxKey) {
    a.relaxKey = key;
    a.relaxDirty = false;
    relaxLonePairs(a);
    updateRemovedSpots(a);
  }
}

function pickElectron(a, ang) {
  const sh = outerSh(a);
  let best = null,
    bs = 1e9;
  for (let i = 0; i < sh.slots.length; i++) {
    const s = sh.slots[i];
    if (s.st !== "e" || !s.e || s.e.bond || s.e.state !== "slot") continue;
    const d = Math.abs(angNorm(s.ang - ang));
    if (d < bs) {
      bs = d;
      best = { e: s.e, i };
    }
  }
  return best;
}
function freeSlotNear(a, ang) {
  const sh = outerSh(a);
  let best = null,
    bs = 1e9;
  for (let i = 0; i < sh.slots.length; i++) {
    if (sh.slots[i].st !== "empty") continue;
    const d = Math.abs(angNorm(sh.slots[i].ang - ang));
    if (d < bs) {
      bs = d;
      best = i;
    }
  }
  return best;
}

/* Äußerste Schale mit einem freien Elektron – bei leerer Valenzschale
   auch innere Schalen (Fe³⁺, Ti⁴⁺, Cr⁶⁺ geben auch d-Elektronen ab). */
function filledShellIdx(a) {
  for (let s = a.shells.length - 1; s >= 0; s--) {
    const sh = a.shells[s];
    for (let i = 0; i < sh.slots.length; i++) {
      const sl = sh.slots[i];
      if (sl.st === "e" && sl.e && !sl.e.bond && sl.e.state === "slot") return s;
    }
  }
  return -1;
}
function pickElectronAt(a, s, ang) {
  const sh = a.shells[s];
  let best = null,
    bs = 1e9;
  for (let i = 0; i < sh.slots.length; i++) {
    const sl = sh.slots[i];
    if (sl.st !== "e" || !sl.e || sl.e.bond || sl.e.state !== "slot") continue;
    const d = Math.abs(angNorm(sl.ang - ang));
    if (d < bs) {
      bs = d;
      best = { e: sl.e, i };
    }
  }
  return best;
}

/* tryTransfer(donor, acc, maxN):
   maxN gesetzt (Formelaufbau) → genau geplante Anzahl, auch aus inneren Schalen.
   Ohne maxN (Handkontakt) → nur Valenzelektronen der äußersten Schale. */
function tryTransfer(donor, acc, maxN) {
  let n = maxN !== undefined ? Math.min(maxN, 3) : Math.min(outerE(donor), 3);
  n = Math.min(n, Math.max(0, oktettFrei(acc)));
  if (n <= 0) return 0;
  const ang = Math.atan2(acc.pos.y - donor.pos.y, acc.pos.x - donor.pos.x);
  let done = 0;
  for (let k = 0; k < n; k++) {
    const sD = filledShellIdx(donor);
    if (sD < 0) break;
    const pick = pickElectronAt(donor, sD, ang);
    if (!pick) break;
    const idx = freeSlotNear(acc, ang + Math.PI);
    if (idx == null) break;
    const shA = acc.shells.length - 1;
    const from = slotPosWorld(donor, sD, pick.i);
    setSlot(donor.shells[sD], pick.i, "empty");
    setSlot(acc.shells[shA], idx, "res");
    const e = pick.e;
    addTween(
      e,
      from,
      () => slotPosWorld(acc, shA, idx),
      () => {
        if (acc.dead) {
          e.state = "gone";
          return;
        }
        const di = donor.electrons.indexOf(e);
        if (di >= 0) donor.electrons.splice(di, 1);
        e.atom = acc;
        e.sh = shA;
        e.idx = idx;
        e.state = "slot";
        e.dispA = acc.shells[shA].slots[idx].ang;
        acc.electrons.push(e);
        setSlot(acc.shells[shA], idx, "e", e);
        acc.badgePop = now();
        donor.badgePop = now();
        acc.relaxDirty = true;
        donor.relaxDirty = true;
      },
      k * 0.16,
      0.6,
    );
    done++;
  }
  return done;
}

/* forceOrd = Soll-Ordnung aus der Lewis-Vorlage; ohne: Bedarfsregel */
function createCov(a, b, forceOrd) {
  let ord;
  if (forceOrd >= 1) ord = Math.min(forceOrd, 3, loneCount(a), loneCount(b));
  else ord = bondOrderFor(a, b);
  if (ord < 1) return null;
  const ea = a.el.en,
    eb = b.el.en,
    dEN = Math.abs(ea - eb),
    polar = dEN >= 0.5;
  const strong = eb > ea ? "b" : "a";
  const f = polar ? 0.5 + 0.38 * clamp((dEN - 0.5) / 1.2, 0, 1) : 0.5;
  const eA = a.radii[a.radii.length - 1],
    eB = b.radii[b.radii.length - 1];
  const gapOf = (x) => x.radii[x.radii.length - 1] - (x.shells.length > 1 ? x.radii[x.radii.length - 2] : x.kernR);
  const ov = clamp(Math.min(0.45 * Math.min(eA, eB), (gapOf(a) - 4) / 1.5, (gapOf(b) - 4) / 1.5), 10, 16);
  const bond = {
    id: nextAid + 1000,
    a,
    b,
    type: "cov",
    order: ord,
    dEN,
    polar,
    strong,
    bulgeA: (strong === "a" ? 1 - f : f) * ov,
    bulgeB: (strong === "a" ? f : 1 - f) * ov,
    d0: eA + eB,
    k: 130,
    c: 11,
    pairs: [],
  };
  const angAB = Math.atan2(b.pos.y - a.pos.y, b.pos.x - a.pos.x);
  for (let i = 0; i < ord; i++) {
    const pa = pickElectron(a, angAB),
      pb = pickElectron(b, angAB + Math.PI);
    if (!pa || !pb) break;
    for (const e of [pa.e, pb.e]) {
      e.animFrom = isFinite(e.dispA) ? e.dispA : 0;
      e.animT = 0;
    }
    pa.e.bond = bond;
    pa.e.pairIndex = i;
    pa.e.role = "a";
    pb.e.bond = bond;
    pb.e.pairIndex = i;
    pb.e.role = "b";
    bond.pairs.push({ eA: pa.e, eB: pb.e });
  }
  a.bonds.push(bond);
  b.bonds.push(bond);
  bonds.push(bond);
  a.relaxDirty = true;
  b.relaxDirty = true;
  if (polar) {
    a.badgePop = now();
    b.badgePop = now();
  }
  if (typeof Raum !== "undefined" && Raum.an && Raum.valenzDirty) Raum.valenzDirty();
  return bond;
}

function breakBond(bond, deadAtom) {
  for (const p of bond.pairs) {
    for (const e of [p.eA, p.eB]) {
      if (e.state === "gone") continue;
      e.bond = null;
      e.pairIndex = null;
      e.role = null;
      e.animFrom = isFinite(e.dispA) ? e.dispA : e.animFrom;
      e.animT = 0;
    }
  }
  bonds.splice(bonds.indexOf(bond), 1);
  bond.a.bonds.splice(bond.a.bonds.indexOf(bond), 1);
  bond.b.bonds.splice(bond.b.bonds.indexOf(bond), 1);
  if (!bond.a.dead) bond.a.relaxDirty = true;
  if (!bond.b.dead) bond.b.relaxDirty = true;
  if (typeof Raum !== "undefined" && Raum.an && Raum.valenzDirty) Raum.valenzDirty();
}

function createIonBond(a, b) {
  const bond = { id: nextAid + 1000, a, b, type: "ion", order: 0, pairs: [], d0: a.edge + b.edge + 10, k: 110, c: 12, dEN: 0 };
  a.bonds.push(bond);
  b.bonds.push(bond);
  bonds.push(bond);
}

function removeAtom(a) {
  a.dead = true;
  if (typeof Raum !== "undefined" && Raum.an) Raum.heterolyse(a);
  else for (const b of [...a.bonds]) breakBond(b, a);
  for (const e of a.electrons) e.state = "gone";
  tweens = tweens.filter((t) => t.e.atom !== a);
  for (let i = slides.length - 1; i >= 0; i--) if (slides[i].a === a || slides[i].e.atom === a) slides.splice(i, 1);
  atoms.splice(atoms.indexOf(a), 1);
  if (hoverAtom === a) hoverAtom = null;
  if (drag && drag.member && drag.member.includes(a)) drag = null;
  refreshCounts();
}
function clearAll() {
  atoms = [];
  bonds = [];
  tweens = [];
  slides = [];
  hoverAtom = null;
  hoverSlot = null;
  drag = null;
  refreshCounts();
}

function toggleElectron(hit) {
  const a = hit.a,
    sh = outerSh(a),
    slot = sh.slots[hit.i];
  if (slot.st === "res") return;
  if (slot.st === "e") {
    if (slot.e && (slot.e.bond || slot.e.state !== "slot")) return;
    const e = slot.e,
      ix = a.electrons.indexOf(e);
    if (ix >= 0) a.electrons.splice(ix, 1);
    e.state = "gone";
    setSlot(sh, hit.i, "empty");
    a.badgePop = now();
    a.relaxDirty = true;
  } else {
    const e = {
      id: nextEid++,
      atom: a,
      state: "slot",
      sh: a.shells.length - 1,
      idx: hit.i,
      bond: null,
      pairIndex: null,
      role: null,
      tw: null,
      animT: 1,
      animFrom: null,
      dispA: sh.slots[hit.i].ang,
    };
    setSlot(sh, hit.i, "e", e);
    a.electrons.push(e);
    a.badgePop = now();
    a.relaxDirty = true;
  }
}

/* Elektron gezielt hinzufügen/entfernen (für Formalladungen beim Aufbau) */
function fuegeElektronHinzu(a) {
  const sh = outerSh(a);
  const idx = freeSlotNear(a, biggestGapAngle(a));
  if (idx == null) return false;
  const e = {
    id: nextEid++,
    atom: a,
    state: "slot",
    sh: a.shells.length - 1,
    idx,
    bond: null,
    pairIndex: null,
    role: null,
    tw: null,
    animT: 1,
    animFrom: null,
    dispA: sh.slots[idx].ang,
  };
  setSlot(sh, idx, "e", e);
  a.electrons.push(e);
  a.badgePop = now();
  a.relaxDirty = true;
  return true;
}
function entferneElektron(a) {
  const sh = outerSh(a);
  const pick = pickElectron(a, biggestGapAngle(a));
  if (!pick) return false;
  const e = pick.e;
  const ix = a.electrons.indexOf(e);
  if (ix >= 0) a.electrons.splice(ix, 1);
  e.state = "gone";
  setSlot(sh, pick.i, "empty");
  a.badgePop = now();
  a.relaxDirty = true;
  return true;
}

function classify(a, b) {
  if (a.el.cat === "eg" || b.el.cat === "eg") return { kind: "edel" };
  const ea = a.el.en,
    eb = b.el.en;
  if (ea == null || eb == null) return { kind: "none", why: "en" };
  const d = Math.abs(ea - eb),
    ma = isMetal(a),
    mb = isMetal(b);
  if (ma !== mb) {
    const met = ma ? a : b,
      nme = ma ? b : a;
    if (d >= 1.7) return { kind: "ion", dEN: d, donor: met, acc: nme };
    /* Hydride (NaH, CaH₂) sowie Nebengruppen-/weiche Metalle mit typischem
       Anion (Fe₂O₃, FeCl₃, CuO, ZnO, SnO): ionisch auch unter ΔEN 1,7 */
    const kat = met.el.cat;
    if (nme.el.sym === "H" || ((kat === "ue" || kat === "la" || kat === "ac" || kat === "me") && nme.el.ve >= 5)) {
      return { kind: "ion", dEN: d, donor: met, acc: nme };
    }
    return { kind: "none", why: "klein", dEN: d };
  }
  if (ma && mb) return { kind: "none", why: "mm", dEN: d };
  return { kind: d >= 0.5 ? "pol" : "cov", dEN: d };
}
function bondStrength(b) {
  return (b.type === "ion" ? 4 : 1) + (b.dEN || 0);
}
function pairStrength(x, y) {
  const c = classify(x, y);
  if (c.kind === "ion") return 4 + c.dEN;
  if (c.kind === "pol" || c.kind === "cov") return 1 + c.dEN;
  return -1;
}
function displaceWeakest(x, newScore) {
  let weakest = null,
    ws = 1e9;
  for (const b2 of x.bonds) {
    if (b2.type !== "cov") continue;
    const s = bondStrength(b2);
    if (s < ws) {
      ws = s;
      weakest = b2;
    }
  }
  if (weakest && newScore > ws) breakBond(weakest, null);
}

function downgradeMultipleBond(x) {
  let best = null;
  for (const b of x.bonds) {
    if (b.type === "cov" && b.order > 1) {
      if (!best || b.order > best.order) best = b;
    }
  }
  if (!best) return false;
  const pair = best.pairs.pop();
  best.order--;
  if (pair) {
    for (const e of [pair.eA, pair.eB]) {
      if (e && e.state !== "gone") {
        e.bond = null;
        e.pairIndex = null;
        e.role = null;
        e.animFrom = isFinite(e.dispA) ? e.dispA : e.animFrom;
        e.animT = 0;
      }
    }
  }
  if (!best.a.dead) best.a.relaxDirty = true;
  if (!best.b.dead) best.b.relaxDirty = true;
  return true;
}

function contact(a, b) {
  const c = classify(a, b);
  if (c.kind === "edel") return;
  if (c.kind === "ion") {
    if (outerE(c.donor) > 0 && oktettFrei(c.acc) <= 0) displaceWeakest(c.acc, pairStrength(c.donor, c.acc));
    tryTransfer(c.donor, c.acc);
    return;
  }
  if (c.kind === "cov" || c.kind === "pol") {
    if (bonded(a, b)) return;
    if (qOf(a) !== 0 || qOf(b) !== 0) {
      if (typeof Raum !== "undefined" && Raum.an) Raum.tryDative(a, b);
      return;
    }
    if (freeVal(a) <= 0 || loneCount(a) <= 0) downgradeMultipleBond(a);
    if (freeVal(b) <= 0 || loneCount(b) <= 0) downgradeMultipleBond(b);
    if (freeVal(a) <= 0 || loneCount(a) <= 0) displaceWeakest(a, pairStrength(a, b));
    if (freeVal(b) <= 0 || loneCount(b) <= 0) displaceWeakest(b, pairStrength(a, b));
    createCov(a, b);
    return;
  }
}

function interactLive(a) {
  let best = null,
    bestD = 1e9;
  for (const o of atoms) {
    if (o === a || o.dead) continue;
    const d = Math.hypot(o.pos.x - a.pos.x, o.pos.y - a.pos.y);
    if (d < (o.edge + a.edge) * 1.2 && d < bestD && !bonded(a, o)) {
      bestD = d;
      best = o;
    }
  }
  if (!best) return;
  const es = best.edge + a.edge;
  if (bestD < es + 12) {
    contact(a, best);
    return;
  }
  a.pullDir = Math.atan2(best.pos.y - a.pos.y, best.pos.x - a.pos.x);
  best.pullDir = Math.atan2(a.pos.y - best.pos.y, a.pos.x - best.pos.x);
  const c = classify(a, best);
  if ((c.kind === "cov" || c.kind === "pol") && freeVal(a) > 0 && loneCount(a) > 0 && freeVal(best) > 0 && loneCount(best) > 0) {
    a.relaxDirty = true;
    best.relaxDirty = true;
  }
}

function proximitySearch() {
  for (const a of atoms) {
    if (a.pullDir != null) {
      a.pullDir = null;
      a.relaxDirty = true;
    }
  }
  for (const a of atoms) {
    if (a.dead) continue;
    let best = null,
      bestD = 1e9;
    for (const o of atoms) {
      if (o === a || o.dead) continue;
      if (bonded(a, o)) continue;
      const d = Math.hypot(o.pos.x - a.pos.x, o.pos.y - a.pos.y);
      if (d < (o.edge + a.edge) * 1.2 && d < bestD) {
        bestD = d;
        best = o;
      }
    }
    if (!best) continue;
    a.pullDir = Math.atan2(best.pos.y - a.pos.y, best.pos.x - a.pos.x);
    best.pullDir = Math.atan2(a.pos.y - best.pos.y, a.pos.x - best.pos.x);
    const c = classify(a, best);
    if ((c.kind === "cov" || c.kind === "pol") && freeVal(a) > 0 && loneCount(a) > 0 && freeVal(best) > 0 && loneCount(best) > 0) {
      a.relaxDirty = true;
      best.relaxDirty = true;
    }
  }
}

function biggestGapAngle(target) {
  const dirs = target.bonds.map((b) => {
    const p = (b.a === target ? b.b : b.a).pos;
    return Math.atan2(p.y - target.pos.y, p.x - target.pos.x);
  });
  if (!dirs.length) return -Math.PI / 2;
  dirs.sort((x, y) => x - y);
  let bigA = dirs[dirs.length - 1],
    bigW = dirs[0] - dirs[dirs.length - 1] + TAU;
  for (let i = 0; i < dirs.length - 1; i++) {
    const w = dirs[i + 1] - dirs[i];
    if (w > bigW) {
      bigW = w;
      bigA = dirs[i];
    }
  }
  return bigA + bigW / 2;
}

/* Startpositionen an echte Atomradien entspannen (Federn starten in Ruhe) */
function passPositionen(created, bondList) {
  const ids = Object.keys(created).map(Number);
  const pos = {};
  for (const id of ids) pos[id] = { x: created[id].pos.x, y: created[id].pos.y };
  for (let pass = 0; pass < 10; pass++) {
    for (const b of bondList) {
      const A = pos[b.from],
        B = pos[b.to];
      if (!A || !B) continue;
      let dx = B.x - A.x,
        dy = B.y - A.y,
        d = Math.hypot(dx, dy);
      if (d < 1) {
        dx = 1;
        dy = 0;
        d = 1;
      }
      const rA = created[b.from].radii[created[b.from].radii.length - 1];
      const rB = created[b.to].radii[created[b.to].radii.length - 1];
      const soll = Math.max(60, Math.round((rA + rB) / 20) * 20);
      const corr = (soll - d) / 2;
      const ux = dx / d,
        uy = dy / d;
      A.x -= ux * corr;
      A.y -= uy * corr;
      B.x += ux * corr;
      B.y += uy * corr;
    }
  }
  for (const id of ids) {
    created[id].pos.x = Math.round(pos[id].x / 20) * 20;
    created[id].pos.y = Math.round(pos[id].y / 20) * 20;
  }
}

/* Formel → Lewis-Struktur → gestaffelter Aufbau */
function buildFromFormula(str) {
  clearAll();
  const ls = lewisStructure(str);
  if (!ls) return false;
  const S = STAGE;
  const created = {};
  for (const at of ls.atoms) {
    const el = ELBYSYM[at.element];
    if (!el) {
      console.error("[Bindungswerkstatt] Unbekanntes Element in der Lewis-Struktur:", at.element);
      return false;
    }
    const Z = el.z !== undefined ? el.z : el.Z;
    const p = (ls.positions && ls.positions[at.id]) || [0, 0];
    const neue = makeAtom(Z, S.x + p[0], S.y + p[1]);
    if (!neue) return false;
    created[at.id] = neue;
  }
  const ops = [];

  if (ls.ionisch) {
    /* Ionisch: Transfers nach Soll-Ladung aus der Lewis-Ebene
       (Fe₂O₃ → 2 Fe³⁺ + 3 O²⁻ – auch wenn die Valenzschale allein nicht reicht) */
    const m = [],
      n = [];
    for (const at of ls.atoms) {
      const ziel = created[at.id];
      const q = (ls.ladungen && ls.ladungen[at.id]) || 0;
      if (q > 0) m.push({ a: ziel, rest: q });
      else if (q < 0) n.push({ a: ziel, rest: -q });
    }
    let fortschritt = true;
    while (fortschritt) {
      fortschritt = false;
      for (let i = 0; i < m.length; i++) {
        if (m[i].rest <= 0) continue;
        for (let j = 0; j < n.length; j++) {
          if (n[j].rest <= 0) continue;
          const anzahl = Math.min(m[i].rest, n[j].rest, 3);
          const mi = m[i].a,
            nj = n[j].a;
          ops.push(() => tryTransfer(mi, nj, anzahl));
          m[i].rest -= anzahl;
          n[j].rest -= anzahl;
          fortschritt = true;
          break;
        }
      }
    }
  } else {
    passPositionen(created, ls.bonds);
    /* Kovalent: H-Bindungen zuerst, Ordnung aus der Vorlage */
    const isH = (id) => ls.atoms[id].element === "H";
    const hBonds = ls.bonds.filter((b) => isH(b.from) || isH(b.to));
    const chainBonds = ls.bonds.filter((b) => !isH(b.from) && !isH(b.to));
    for (const b of hBonds) ops.push(() => createCov(created[b.from], created[b.to], b.order));
    for (const b of chainBonds) ops.push(() => createCov(created[b.from], created[b.to], b.order));
    /* Formalladungen als Elektronen umsetzen:
       fc +1 → 1 Elektron entfernen (NH₄⁺), fc −1 → 1 hinzufügen (SO₄²⁻, O₃, NO₂) */
    const orderSum = {};
    ls.bonds.forEach((b) => {
      orderSum[b.from] = (orderSum[b.from] || 0) + b.order;
      orderSum[b.to] = (orderSum[b.to] || 0) + b.order;
    });
    for (const at of ls.atoms) {
      const fc = ELBYSYM[at.element].ve - 2 * (ls.lp[at.id] || 0) - (ls.single[at.id] || 0) - (orderSum[at.id] || 0);
      const ziel = created[at.id];
      for (let k = 0; k < Math.abs(fc); k++) {
        if (fc > 0) ops.push(() => entferneElektron(ziel));
        else ops.push(() => fuegeElektronHinzu(ziel));
      }
    }
  }

  const step = ops.length > 14 ? 140 : ops.length > 8 ? 190 : 250;
  let d = 350;
  ops.forEach((op) => {
    setTimeout(op, d);
    d += step;
  });
  setTimeout(() => fitAtoms(), d + 400);
  return true;
}
