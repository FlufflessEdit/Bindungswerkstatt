"use strict";
/* ================================================================
   DATEN – Elemente, Kategorien
================================================================ */
const CAT = {
  al: ["Alkalimetall", "#D9402B"],
  ea: ["Erdalkalimetall", "#E8862D"],
  ue: ["Übergangsmetall", "#C69A2A"],
  pt: ["Metall", "#8A9A5B"],
  hm: ["Halbmetall", "#43A374"],
  nm: ["Nichtmetall", "#23A0A8"],
  hg: ["Halogen", "#4169C8"],
  eg: ["Edelgas", "#8F5FC0"],
};
const METALS = new Set(["al", "ea", "ue", "pt"]);

const ELEMENTS = [
  [1, "H", "Wasserstoff", 2.2, "+1", "nm", 1],
  [2, "He", "Helium", null, "0", "eg", 18],
  [3, "Li", "Lithium", 0.98, "+1", "al", 1],
  [4, "Be", "Beryllium", 1.57, "+2", "ea", 2],
  [5, "B", "Bor", 2.04, "+3", "hm", 13],
  [6, "C", "Kohlenstoff", 2.55, "±4", "nm", 14],
  [7, "N", "Stickstoff", 3.04, "±3", "nm", 15],
  [8, "O", "Sauerstoff", 3.44, "−2", "nm", 16],
  [9, "F", "Fluor", 3.98, "−1", "hg", 17],
  [10, "Ne", "Neon", null, "0", "eg", 18],
  [11, "Na", "Natrium", 0.93, "+1", "al", 1],
  [12, "Mg", "Magnesium", 1.31, "+2", "ea", 2],
  [13, "Al", "Aluminium", 1.61, "+3", "pt", 13],
  [14, "Si", "Silicium", 1.9, "±4", "hm", 14],
  [15, "P", "Phosphor", 2.19, "±3", "nm", 15],
  [16, "S", "Schwefel", 2.58, "−2", "nm", 16],
  [17, "Cl", "Chlor", 3.16, "−1", "hg", 17],
  [18, "Ar", "Argon", null, "0", "eg", 18],
  [19, "K", "Kalium", 0.82, "+1", "al", 1],
  [20, "Ca", "Calcium", 1.0, "+2", "ea", 2],
  [21, "Sc", "Scandium", 1.36, "+3", "ue", 3],
  [22, "Ti", "Titan", 1.54, "+4", "ue", 4],
  [23, "V", "Vanadium", 1.63, "+5", "ue", 5],
  [24, "Cr", "Chrom", 1.66, "+3", "ue", 6],
  [25, "Mn", "Mangan", 1.55, "+2", "ue", 7],
  [26, "Fe", "Eisen", 1.83, "+3", "ue", 8],
  [27, "Co", "Cobalt", 1.88, "+2", "ue", 9],
  [28, "Ni", "Nickel", 1.91, "+2", "ue", 10],
  [29, "Cu", "Kupfer", 1.9, "+2", "ue", 11],
  [30, "Zn", "Zink", 1.65, "+2", "ue", 12],
  [31, "Ga", "Gallium", 1.81, "+3", "pt", 13],
  [32, "Ge", "Germanium", 2.01, "+4", "hm", 14],
  [33, "As", "Arsen", 2.18, "±3", "hm", 15],
  [34, "Se", "Selen", 2.55, "−2", "nm", 16],
  [35, "Br", "Brom", 2.96, "−1", "hg", 17],
  [36, "Kr", "Krypton", 3.0, "0", "eg", 18],
  [37, "Rb", "Rubidium", 0.82, "+1", "al", 1],
  [38, "Sr", "Strontium", 0.95, "+2", "ea", 2],
  [39, "Y", "Yttrium", 1.22, "+3", "ue", 3],
  [40, "Zr", "Zirconium", 1.33, "+4", "ue", 4],
  [41, "Nb", "Niob", 1.4, "+5", "ue", 5],
  [42, "Mo", "Molybdän", 2.16, "+6", "ue", 6],
  [43, "Tc", "Technetium", 1.9, "+7", "ue", 7],
  [44, "Ru", "Ruthenium", 2.2, "+3", "ue", 8],
  [45, "Rh", "Rhodium", 2.28, "+3", "ue", 9],
  [46, "Pd", "Palladium", 2.2, "+2", "ue", 10],
  [47, "Ag", "Silber", 1.93, "+1", "ue", 11],
  [48, "Cd", "Cadmium", 1.96, "+2", "ue", 12],
  [49, "In", "Indium", 1.78, "+3", "pt", 13],
  [50, "Sn", "Zinn", 1.96, "+4", "pt", 14],
  [51, "Sb", "Antimon", 2.05, "±3", "hm", 15],
  [52, "Te", "Tellur", 2.1, "−2", "hm", 16],
  [53, "I", "Iod", 2.66, "−1", "hg", 17],
  [54, "Xe", "Xenon", 2.6, "0", "eg", 18],
].map((r) => ({
  Z: r[0],
  sym: r[1],
  name: r[2],
  en: r[3],
  oz: r[4],
  cat: r[5],
  grp: r[6],
  per: r[0] <= 2 ? 1 : r[0] <= 10 ? 2 : r[0] <= 18 ? 3 : r[0] <= 36 ? 4 : 5,
}));
const ELBYZ = {};
ELEMENTS.forEach((e) => (ELBYZ[e.Z] = e));

/* ================================================================
   AUFBAUPRINZIP (Madelung) + AUSNAHME-KORREKTUREN
   Orbitale: 1≤n≤7, 0≤l<n, Kapazität 2(2l+1)
   Reihenfolge: (n+l) ↑, dann n ↑      R=Z, füllen, danach S_n=Σ_l e_{n,l}
================================================================ */
const EXCEPTIONS = {
  24: [[4, 0, 3, 2, 1]],
  29: [[4, 0, 3, 2, 1]], // Cr, Cu: 1× 4s→3d
  41: [[5, 0, 4, 2, 1]],
  42: [[5, 0, 4, 2, 1]], // Nb, Mo
  44: [[5, 0, 4, 2, 1]],
  45: [[5, 0, 4, 2, 1]], // Ru, Rh
  46: [[5, 0, 4, 2, 2]],
  47: [[5, 0, 4, 2, 1]], // Pd (5s⁰!), Ag
  // wirksam erst, wenn das PSE über Z=54 erweitert wird:
  57: [[4, 3, 5, 2, 1]],
  58: [[4, 3, 5, 2, 1]],
  64: [[4, 3, 5, 2, 1]], // La, Ce, Gd
  78: [[6, 0, 5, 2, 1]],
  79: [[6, 0, 5, 2, 1]], // Pt, Au
  89: [[5, 3, 6, 2, 1]],
  90: [[5, 3, 6, 2, 2]],
  91: [[5, 3, 6, 2, 1]],
  92: [[5, 3, 6, 2, 1]],
  93: [[5, 3, 6, 2, 1]],
  96: [[5, 3, 6, 2, 1]],
  103: [[6, 2, 7, 1, 1]],
};

function computeConfig(Z) {
  const orbs = [];
  for (let n = 1; n <= 7; n++) for (let l = 0; l < n; l++) orbs.push({ n, l, cap: 2 * (2 * l + 1) });
  orbs.sort((x, y) => x.n + x.l - (y.n + y.l) || x.n - y.n);
  const occ = new Map();
  let R = Z;
  for (const o of orbs) {
    if (R <= 0) break;
    const e = Math.min(R, o.cap);
    occ.set(o.n + "|" + o.l, e);
    R -= e;
  }
  const ex = EXCEPTIONS[Z];
  if (ex)
    for (const [fn, fl, tn, tl, k] of ex) {
      // beobachteter Grundzustand korrigiert Madelung
      const fk = fn + "|" + fl,
        tk = tn + "|" + tl;
      occ.set(fk, Math.max(0, (occ.get(fk) || 0) - k));
      occ.set(tk, (occ.get(tk) || 0) + k);
    }
  return { orbs, occ };
}
const SUPS = "⁰¹²³⁴⁵⁶⁷⁸⁹";
const sup = (n) =>
  String(n)
    .split("")
    .map((c) => SUPS[+c])
    .join("");
function cfgStr(c) {
  let s = "";
  for (const o of c.orbs) {
    const e = c.occ.get(o.n + "|" + o.l) || 0;
    if (e > 0) s += o.n + "spdf"[o.l] + sup(e) + " ";
  }
  return s.trim();
}
ELEMENTS.forEach((el) => {
  el.cfg = cfgStr(computeConfig(el.Z));
  el.exc = !!EXCEPTIONS[el.Z];
});

const SHELL_COL = ["#D9402B", "#128A96", "#7C4DBF", "#3E9D4E", "#3E6FC0"];
const SHELL_NAMES = ["K", "L", "M", "N", "O", "P", "Q"];
const BUB = 7.5,
  PR_STEP = 9.5,
  PR_GAP = 12.5,
  SUBGAP = 0.1,
  TAU = Math.PI * 2;

/* ================================================================
   HILFSFUNKTIONEN
================================================================ */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const angNorm = (a) => {
  while (a > Math.PI) a -= TAU;
  while (a < -Math.PI) a += TAU;
  return a;
};
const easeIO = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
const easeOutBack = (p) => {
  const c = 1.70158;
  return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2);
};
const fmtEN = (x) => (x == null ? "–" : x.toFixed(2).replace(".", ","));
const fmtQ = (q) => (q > 0 ? "+" : "−") + Math.abs(q);
const isMetal = (a) => METALS.has(a.el.cat);
const shellColorOf = (a) => SHELL_COL[a.shells.length - 1];

/* ================================================================
   ZUSTAND
================================================================ */
let atoms = [],
  bonds = [],
  tweens = [],
  nextAid = 1,
  nextEid = 1;
let cam = { x: 0, y: 0, z: 0.9 };
let drag = null,
  hoverAtom = null,
  hoverSlot = null,
  hoverStatusAtom = null;
let cutMode = false;
const cooldowns = new Map();
const now = () => performance.now() / 1000;
function cd(key, ms = 1400) {
  const t = now();
  if ((cooldowns.get(key) || 0) > t) return true;
  cooldowns.set(key, t + ms);
  return false;
}

/* ================================================================
   STATUSLEISTE
================================================================ */
const sBadge = document.getElementById("sBadge"),
  sText = document.getElementById("sText"),
  sBar = document.getElementById("status");
const BADGES = {
  ion: ["IONENBINDUNG", "#C0392B"],
  pol: ["POLARE BINDUNG", "#7C4DBF"],
  cov: ["ATOMBINDUNG", "#128A96"],
  none: ["KEINE BINDUNG", "#6B7280"],
  ionm: ["ION", "#B3541E"],
  info: ["INFO", "#3F4A54"],
  prev: ["VORSCHAU", "#9C7A2E"],
};
let lastStatus = "";
function setStatus(kind, html) {
  if (lastStatus === kind + html) return;
  lastStatus = kind + html;
  const b = BADGES[kind] || BADGES.info;
  sBadge.textContent = b[0];
  sBadge.style.background = b[1];
  sText.innerHTML = html;
  sBar.classList.remove("flash");
  void sBar.offsetWidth;
  sBar.classList.add("flash");
}

/* ================================================================
   PERIODENSYSTEM (DOM)
================================================================ */
const pseGrid = document.getElementById("pseGrid");
(function buildPSE() {
  let html = "<div></div>";
  for (let g = 1; g <= 18; g++) html += `<div class="gh">${g}</div>`;
  for (let p = 1; p <= 5; p++) {
    html += `<div class="ph">${p}</div>`;
    for (let g = 1; g <= 18; g++) {
      const el = ELEMENTS.find((e) => e.per === p && e.grp === g);
      if (!el) {
        html += '<div class="empty"></div>';
        continue;
      }
      const col = CAT[el.cat][1];
      html += `<div class="el" data-z="${el.Z}" style="--c:${col};grid-column:${g + 1};grid-row:${p + 1}" title="${el.name} · EN ${fmtEN(el.en)} · OZ ${el.oz}">
        <span class="z">${el.Z}</span><span class="sym">${el.sym}</span>
        <span class="data">${fmtEN(el.en)} · ${el.oz}</span>
        <span class="name">${el.name}</span><span class="cnt"></span></div>`;
    }
  }
  pseGrid.innerHTML = html;
  let leg = "";
  for (const k in CAT) leg += `<span class="lg"><span class="dot" style="background:${CAT[k][1]}"></span>${CAT[k][0]}</span>`;
  document.getElementById("legend").innerHTML = leg;

  pseGrid.querySelectorAll(".el").forEach((cell) => {
    const Z = +cell.dataset.z;
    cell.addEventListener("click", () => {
      cell.classList.remove("pop");
      void cell.offsetWidth;
      cell.classList.add("pop");
      spawnFromPSE(Z);
    });
    cell.addEventListener("mouseenter", () => {
      const el = ELBYZ[Z];
      setStatus(
        "info",
        `<b>${el.sym} · ${el.name}</b> — Periode ${el.per}, Gruppe ${el.grp} · EN ${fmtEN(el.en)} · OZ ${el.oz} · ${el.cfg}${el.exc ? " · <b>Ausnahme</b> vom Aufbauprinzip" : ""} · ${CAT[el.cat][0]}`,
      );
    });
  });
})();
function refreshCounts() {
  const n = {};
  atoms.forEach((a) => {
    if (!a.dead) n[a.Z] = (n[a.Z] || 0) + 1;
  });
  pseGrid.querySelectorAll(".el").forEach((c) => {
    const k = n[+c.dataset.z] || 0,
      b = c.querySelector(".cnt");
    b.style.display = k ? "block" : "none";
    b.textContent = k;
  });
}

/* ================================================================
   ATOM-MODELL – Schalen aus S_n (Madelung + Ausnahmen)
================================================================ */
// Subschal-Bögen (s→p→d→f) mit kleinen Lücken; Elektronen gleichmäßig im Bogen verteilt
function buildShellSlots(subs, rot) {
  const total = subs.reduce((s, x) => s + x.cap, 0),
    span = TAU - SUBGAP * subs.length;
  const slots = [];
  let ang = rot - span / 2;
  subs.forEach((sub, si) => {
    const arc = (sub.cap / total) * span;
    sub.mid = ang + arc / 2;
    const occIdx = new Set();
    for (let k = 0; k < sub.e; k++) occIdx.add(Math.min(sub.cap - 1, Math.floor(((k + 0.5) * sub.cap) / Math.max(sub.e, 1))));
    for (let i = 0; i < sub.cap; i++) slots.push({ ang: ang + arc * ((i + 0.5) / sub.cap), sub: si, st: occIdx.has(i) ? "e" : "empty", e: null });
    ang += arc + SUBGAP;
  });
  return slots;
}

function makeAtom(Z, x, y) {
  const el = ELBYZ[Z];
  const { occ } = computeConfig(Z);
  // Protonen-Kreuze in konzentrischen Ringen + Kernradius
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
  // Subschalen je Schale: bis zum höchsten besetzten l, mindestens s+p (n≥2), höchstens f
  const subsByN = [];
  for (let n = 1; n <= el.per; n++) {
    let lmax = n >= 2 ? 1 : 0;
    occ.forEach((e, k) => {
      if (e <= 0) return;
      const p = k.split("|").map(Number);
      if (p[0] === n) lmax = Math.max(lmax, p[1]);
    });
    lmax = Math.min(lmax, 3, n - 1);
    const subs = [];
    for (let l = 0; l <= lmax; l++) subs.push({ l, cap: 2 * (2 * l + 1), e: occ.get(n + "|" + l) || 0 });
    subsByN.push(subs);
  }
  // Schalenradien aus den tatsächlichen Platzanzahlen
  const radii = [];
  let r = kernR + 24;
  subsByN.forEach((subs, i) => {
    if (i > 0) r = Math.max(radii[i - 1] + 26, (subs.reduce((s, x) => s + x.cap, 0) * 23.5) / TAU + 4);
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
    deformTarget: 0,
    born: now(),
    badgePop: -9,
    held: false,
    dead: false,
  };
  subsByN.forEach((subs, s) => {
    const slots = buildShellSlots(subs, -Math.PI / 2 + s * 0.55);
    a.shells.push({ subs, slots });
    slots.forEach((sl, i) => {
      if (sl.st === "e") {
        const e = { id: nextEid++, atom: a, state: "slot", sh: s, idx: i, bond: null, pairIndex: null, role: null, tw: null };
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
const valenceAround = (a) => outerE(a) + 2 * bondOrderSum(a); // Elektronen um das Atom (Oktett-Zählung)
const valTarget = (a) => (a.shells.length === 1 ? 2 : 8); // s²p⁶-Ziel der Außenschale (Duplett/Oktett)
const freeVal = (a) => valTarget(a) - valenceAround(a);
const prevShellFull = (a) => a.shells.length > 1 && a.shells[a.shells.length - 2].slots.every((s) => s.st === "e");
const isStable = (a) => valenceAround(a) >= valTarget(a) || (outerE(a) === 0 && bondOrderSum(a) === 0 && prevShellFull(a));
// Live-Konfiguration der Außenschale aus der aktuellen Elektronenverteilung
function dynCfgOuter(a) {
  const out = a.shells.length - 1,
    sh = a.shells[out];
  const cnt = sh.subs.map(() => 0);
  for (const e of a.electrons) {
    if (e.state === "gone") continue;
    if (e.sh === out && a.shells[e.sh] && a.shells[e.sh].slots[e.idx]) cnt[a.shells[e.sh].slots[e.idx].sub]++;
  }
  let s = "";
  sh.subs.forEach((sub, i) => {
    if (cnt[i] > 0) s += out + 1 + "spdf"[sub.l] + sup(cnt[i]) + " ";
  });
  return s.trim();
}

function slotAngle(a, sh, i) {
  return a.shells[sh].slots[i].ang;
}
// Deformierte Außenschale: absoluter Wulst (bond.bulge) Richtung jedes kovalenten Partners
function outerRAt(a, th) {
  const base = a.radii[a.radii.length - 1];
  let add = 0;
  for (const b of a.bonds) {
    if (b.type !== "cov") continue;
    const p = (b.a === a ? b.b : b.a).pos;
    const c = Math.cos(angNorm(th - Math.atan2(p.y - a.pos.y, p.x - a.pos.x)));
    if (c > 0) add += a.deform * b.bulge * c * c;
  }
  return base + add;
}
function slotPosWorld(a, sh, i) {
  const th = slotAngle(a, sh, i),
    r = sh === a.shells.length - 1 ? outerRAt(a, th) : a.radii[sh];
  return { x: a.pos.x + Math.cos(th) * r, y: a.pos.y + Math.sin(th) * r };
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

/* ================================================================
   TWEENS (Elektronenflüge)
================================================================ */
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

/* ================================================================
   ELEKTRONEN-LOGIK
================================================================ */
function pickElectron(a, ang) {
  // besetzter Außenplatz Richtung Partner
  const sh = outerSh(a);
  let best = null,
    bs = 1e9;
  for (let i = 0; i < sh.slots.length; i++) {
    const s = sh.slots[i];
    if (s.st !== "e") continue;
    const d = Math.abs(angNorm(sh.slots[i].ang - ang));
    if (d < bs) {
      bs = d;
      best = { e: s.e, i };
    }
  }
  return best;
}
// freier Außenplatz: bevorzugt niedrigsten Subschalen-Bogen (s vor p vor d), dann nächster Winkel
function freeSlotNear(a, ang) {
  const sh = outerSh(a);
  let best = null,
    bs = 1e9,
    bl = 99;
  for (let i = 0; i < sh.slots.length; i++) {
    const s = sh.slots[i];
    if (s.st !== "empty") continue;
    const l = sh.subs[s.sub].l;
    if (l > bl) continue;
    const d = Math.abs(angNorm(sh.slots[i].ang - ang));
    if (l < bl) {
      bl = l;
      bs = 1e9;
    }
    if (d < bs) {
      bs = d;
      best = i;
    }
  }
  return best;
}

function tryTransfer(donor, acc) {
  // Ionenbindung: Übergang stoppt beim Oktett des Akzeptors
  const n = Math.min(outerE(donor), Math.max(0, freeVal(acc)), 3);
  if (n <= 0) return 0;
  const ang = Math.atan2(acc.pos.y - donor.pos.y, acc.pos.x - donor.pos.x);
  for (let k = 0; k < n; k++) {
    const pick = pickElectron(donor, ang);
    if (!pick) break;
    const idx = freeSlotNear(acc, ang + Math.PI);
    if (idx == null) break;
    const shD = donor.shells.length - 1,
      shA = acc.shells.length - 1;
    const from = slotPosWorld(donor, shD, pick.i);
    donor.shells[shD].slots[pick.i] = { st: "empty", e: null };
    acc.shells[shA].slots[idx] = { st: "res", e: null };
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
        acc.electrons.push(e);
        acc.shells[shA].slots[idx] = { st: "e", e };
        acc.badgePop = now();
        donor.badgePop = now();
      },
      k * 0.16,
      0.6,
    );
  }
  return n;
}

/* Gemeinsames Elektronenpaar: Position aus der TATSÄCHLICHEN Überlappungszone
   beider (deformierter) Außenschalen – nie aus einem festen Kernabstand. */
function pairPos(bond, i, role) {
  const A = bond.a,
    B = bond.b;
  let ux = B.pos.x - A.pos.x,
    uy = B.pos.y - A.pos.y;
  const len = Math.hypot(ux, uy) || 1;
  ux /= len;
  uy /= len;
  const nx = -uy,
    ny = ux;
  const rA = outerRAt(A, Math.atan2(uy, ux));
  const rB = outerRAt(B, Math.atan2(-uy, -ux));
  let z0 = len - rB,
    z1 = rA;
  if (z1 - z0 < 8) {
    const zc = (z0 + z1) / 2;
    z0 = zc - 4;
    z1 = zc + 4;
  }
  const m = (z0 + z1) / 2,
    hw = (z1 - z0) / 2;
  let z = m;
  if (bond.polar) {
    const dir = bond.strong === "b" ? 1 : -1;
    z = m + dir * bond.bias * hw;
    z = clamp(z, z0 + 4, z1 - 4);
  }
  const off = (i - (bond.order - 1) / 2) * 19 + (role === "a" ? -6.5 : 6.5);
  return { x: A.pos.x + ux * z + nx * off, y: A.pos.y + uy * z + ny * off };
}

function createCov(a, b) {
  const ord = Math.min(freeVal(a), freeVal(b), outerE(a), outerE(b), 3);
  if (ord < 1) return null;
  const ea = a.el.en,
    eb = b.el.en,
    dEN = Math.abs(ea - eb),
    polar = dEN >= 0.5;
  const strong = eb > ea ? "b" : "a";
  const bias = 0.42 + 0.3 * clamp((dEN - 0.5) / 1.2, 0, 1);
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
    bias,
    ov,
    bulge: ov / 2,
    d0: eA + eB - ov,
    k: 130,
    c: 11,
    pairs: [],
  };
  const angAB = Math.atan2(b.pos.y - a.pos.y, b.pos.x - a.pos.x);
  for (let i = 0; i < ord; i++) {
    const shA = a.shells.length - 1,
      shB = b.shells.length - 1;
    const pa = pickElectron(a, angAB),
      pb = pickElectron(b, angAB + Math.PI);
    if (!pa || !pb) return null;
    a.shells[shA].slots[pa.i] = { st: "res", e: null };
    b.shells[shB].slots[pb.i] = { st: "res", e: null };
    const fromA = slotPosWorld(a, shA, pa.i),
      fromB = slotPosWorld(b, shB, pb.i);
    const eA2 = pa.e,
      eB2 = pb.e;
    addTween(
      eA2,
      fromA,
      () => pairPos(bond, i, "a"),
      () => {
        eA2.state = "bond";
      },
      i * 0.05,
      0.45,
    );
    addTween(
      eB2,
      fromB,
      () => pairPos(bond, i, "b"),
      () => {
        eB2.state = "bond";
      },
      i * 0.05,
      0.45,
    );
    eA2.bond = bond;
    eA2.pairIndex = i;
    eA2.role = "a";
    eB2.bond = bond;
    eB2.pairIndex = i;
    eB2.role = "b";
    bond.pairs.push({ eA: eA2, eB: eB2 });
  }
  a.bonds.push(bond);
  b.bonds.push(bond);
  bonds.push(bond);
  return bond;
}

function returnElectron(e) {
  const a = e.atom,
    sh = a.shells.length - 1;
  const from = e.tw ? { ...e.tw.pos } : pairPos(e.bond, e.pairIndex || 0, e.role || "a");
  let idx = e.idx != null && a.shells[sh].slots[e.idx] && a.shells[sh].slots[e.idx].st === "res" ? e.idx : freeSlotNear(a, 0);
  e.bond = null;
  e.pairIndex = null;
  e.role = null;
  const targetIdx = idx == null ? 0 : idx;
  if (idx != null) a.shells[sh].slots[idx] = { st: "res", e: null };
  addTween(
    e,
    from,
    () => slotPosWorld(a, sh, targetIdx),
    () => {
      if (a.dead) {
        e.state = "gone";
        return;
      }
      e.state = "slot";
      e.sh = sh;
      e.idx = targetIdx;
      a.shells[sh].slots[targetIdx] = { st: "e", e };
    },
    0,
    0.5,
  );
}

function breakBond(bond, deadAtom) {
  for (const p of bond.pairs) {
    for (const e of [p.eA, p.eB]) {
      if (e.state === "gone") continue;
      if (e.atom === deadAtom) {
        e.state = "gone";
        continue;
      }
      returnElectron(e);
    }
  }
  bonds.splice(bonds.indexOf(bond), 1);
  bond.a.bonds.splice(bond.a.bonds.indexOf(bond), 1);
  bond.b.bonds.splice(bond.b.bonds.indexOf(bond), 1);
}
function createIonBond(a, b) {
  const bond = { id: nextAid + 1000, a, b, type: "ion", order: 0, pairs: [], d0: a.edge + b.edge + 10, k: 110, c: 12 };
  a.bonds.push(bond);
  b.bonds.push(bond);
  bonds.push(bond);
}

function removeAtom(a) {
  a.dead = true;
  for (const b of [...a.bonds]) breakBond(b, a);
  for (const e of a.electrons) e.state = "gone";
  tweens = tweens.filter((t) => t.e.atom !== a);
  atoms.splice(atoms.indexOf(a), 1);
  if (hoverAtom === a) hoverAtom = null;
  if (hoverStatusAtom === a) hoverStatusAtom = null;
  if (drag && drag.member && drag.member.includes(a)) drag = null;
  refreshCounts();
}
function clearAll() {
  atoms = [];
  bonds = [];
  tweens = [];
  hoverAtom = null;
  hoverSlot = null;
  hoverStatusAtom = null;
  drag = null;
  refreshCounts();
}

/* ================================================================
   BINDUNGS-ENTSCHEIDUNG
================================================================ */
function classify(a, b) {
  if (a.el.cat === "eg" || b.el.cat === "eg") return { kind: "edel" };
  const ea = a.el.en,
    eb = b.el.en;
  if (ea == null || eb == null) return { kind: "none", why: "en" };
  const d = Math.abs(ea - eb),
    ma = isMetal(a),
    mb = isMetal(b);
  if (ma !== mb) {
    if (d >= 1.7) {
      const donor = ea < eb ? a : b;
      return { kind: "ion", dEN: d, donor, acc: donor === a ? b : a };
    }
    return { kind: "none", why: "klein", dEN: d };
  }
  if (ma && mb) return { kind: "none", why: "mm", dEN: d };
  return { kind: d >= 0.5 ? "pol" : "cov", dEN: d };
}

function contact(a, b) {
  const c = classify(a, b);
  if (c.kind === "edel") {
    if (!cd(`edel${a.id}:${b.id}`))
      setStatus("none", `<b>${a.el.name}</b> und <b>${b.el.name}</b>: Edelgas – die Außenschale ist bereits voll. <b>Keine Bindung.</b>`);
    return;
  }
  if (c.kind === "ion") {
    const key = `ion${a.id}:${b.id}`;
    const n = tryTransfer(c.donor, c.acc);
    if (n > 0) {
      const qD = c.donor.Z - (c.donor.electrons.length - n),
        qA = c.acc.Z - (c.acc.electrons.length + n);
      setStatus(
        "ion",
        `<b>${c.donor.el.name}</b> gibt ${n === 1 ? "ein Elektron" : n + " Elektronen"} an <b>${c.acc.el.name}</b> ab (ΔEN = ${fmtEN(c.dEN)} ≥ 1,7) → <b>${c.donor.el.sym}<sup>${fmtQ(qD)}</sup></b> und <b>${c.acc.el.sym}<sup>${fmtQ(qA)}</sup></b> entstehen und ziehen sich an.`,
      );
    } else if (qOf(a) * qOf(b) < 0) {
      if (!cd(key))
        setStatus(
          "ion",
          `<b>${a.el.sym}<sup>${fmtQ(qOf(a))}</sup></b> und <b>${b.el.sym}<sup>${fmtQ(qOf(b))}</sup></b>: entgegengesetzte Ladungen – die Ionen ziehen sich an.`,
        );
    } else if (!cd(key)) {
      const msg =
        freeVal(c.acc) <= 0
          ? `Kein Elektronenübergang möglich: <b>${c.acc.el.name}</b> hat die stabile s²p⁶-Konfiguration bereits erreicht.`
          : `Kein Elektronenübergang möglich: <b>${c.donor.el.name}</b> kann keine Außenelektronen mehr abgeben.`;
      setStatus("none", msg);
    }
    return;
  }
  if (c.kind === "cov" || c.kind === "pol") {
    if (bonded(a, b)) return;
    const bnd = createCov(a, b);
    if (!bnd) {
      if (!cd(`full${a.id}:${b.id}`)) {
        const full = freeVal(a) <= 0 ? a : b;
        const msg =
          outerE(full) === 0
            ? `<b>${full.el.name}</b> besitzt kein eigenes Außenelektron für eine Atombindung.`
            : `<b>${full.el.name}</b> hat das Oktett bereits erreicht (${valenceAround(full)}/${valTarget(full)}) – keine weitere Bindung.`;
        setStatus("none", msg);
      }
      return;
    }
    const ordTxt =
      bnd.order === 1
        ? "Ein gemeinsames Elektronenpaar (Einfachbindung)."
        : bnd.order === 2
          ? "Zwei gemeinsame Paare – <b>Doppelbindung</b>."
          : "Drei gemeinsame Paare – <b>Dreifachbindung</b>.";
    if (bnd.polar) {
      const st = bnd.strong === "a" ? a : b,
        wk = bnd.strong === "a" ? b : a;
      setStatus(
        "pol",
        `<b>${a.el.name}</b> + <b>${b.el.name}</b>: ΔEN = ${fmtEN(bnd.dEN)} → <b>polare Atombindung</b>. ${ordTxt} Die Paare sammeln sich in der <b>Überlappungszone</b> der Außenschalen – deutlich auf der Seite von <b>${st.el.name}</b> (δ−); <b>${wk.el.name}</b> trägt δ+.`,
      );
    } else {
      setStatus(
        "cov",
        `<b>${a.el.name}</b> + <b>${b.el.name}</b>: ΔEN = ${fmtEN(bnd.dEN)} → <b>unpolare Atombindung</b>. ${ordTxt} Die Paare sammeln sich symmetrisch in der <b>Überlappungszone</b> beider Außenschalen.`,
      );
    }
    return;
  }
  if (!cd(`none${a.id}:${b.id}`)) {
    if (c.why === "mm")
      setStatus(
        "none",
        `<b>${a.el.name}</b> und <b>${b.el.name}</b> sind beide Metalle → <b>metallische Bindung</b> („Elektronengas"), die hier nicht dargestellt wird.`,
      );
    else if (c.why === "klein")
      setStatus(
        "none",
        `ΔEN = ${fmtEN(c.dEN)} &lt; 1,7 – zu klein für eine Ionenbindung, und Metalle bilden keine Atombindungen → <b>keine Bindung</b>.`,
      );
    else setStatus("none", "Für diese Kombination ist im Schalenmodell keine Bindung vorgesehen.");
  }
}

function interactLive(a) {
  let best = null,
    bestD = 1e9;
  for (const o of atoms) {
    if (o === a || o.dead) continue;
    const d = Math.hypot(o.pos.x - a.pos.x, o.pos.y - a.pos.y);
    if (d < (o.edge + a.edge) * 1.35 && d < bestD && !bonded(a, o)) {
      bestD = d;
      best = o;
    }
  }
  if (!best) return;
  const es = best.edge + a.edge;
  if (bestD < es + 18) {
    contact(a, best);
    return;
  }
  const c = classify(a, best);
  const nA = a.el.name,
    nB = best.el.name,
    d = fmtEN(c.dEN ?? Math.abs((a.el.en ?? 0) - (best.el.en ?? 0)));
  let txt;
  if (c.kind === "edel") txt = `${nA}–${nB}: Edelgas beteiligt – es wird keine Bindung entstehen.`;
  else if (c.kind === "ion") txt = `${nA}–${nB}: ΔEN = ${d} ≥ 1,7 → bei Berührung springen Elektronen über (<b>Ionenbindung</b>).`;
  else if (c.kind === "pol") txt = `${nA}–${nB}: ΔEN = ${d} → <b>polare Atombindung</b> erwartet – näher zusammenziehen!`;
  else if (c.kind === "cov") txt = `${nA}–${nB}: ΔEN = ${d} → <b>unpolare Atombindung</b> erwartet – näher zusammenziehen!`;
  else txt = `${nA}–${nB}: ΔEN = ${d} → im Schalenmodell keine Bindung.`;
  setStatus("prev", txt);
}

/* ================================================================
   PHYSIK
================================================================ */
const K_COUL = 6e7,
  F_MAX = 2600;
function physicsStep(dt) {
  for (const a of atoms) {
    a.acc.x = 0;
    a.acc.y = 0;
  }
  for (const b of bonds) {
    const A = b.a,
      B = b.b;
    if (A.dead || B.dead) continue;
    let dx = B.pos.x - A.pos.x,
      dy = B.pos.y - A.pos.y;
    const d = Math.hypot(dx, dy);
    if (d < 1) continue;
    const ux = dx / d,
      uy = dy / d;
    const rv = (B.vel.x - A.vel.x) * ux + (B.vel.y - A.vel.y) * uy;
    const F = b.k * (d - b.d0) + b.c * rv;
    B.acc.x -= F * ux;
    B.acc.y -= F * uy;
    A.acc.x += F * ux;
    A.acc.y += F * uy;
  }
  for (let i = 0; i < atoms.length; i++)
    for (let j = i + 1; j < atoms.length; j++) {
      const a = atoms[i],
        b = atoms[j];
      if (a.dead || b.dead) continue;
      const qa = qOf(a),
        qb = qOf(b);
      if (!qa || !qb) continue;
      let dx = b.pos.x - a.pos.x,
        dy = b.pos.y - a.pos.y;
      const d = Math.hypot(dx, dy);
      if (d < 1) continue;
      const ux = dx / d,
        uy = dy / d,
        d2 = Math.max(d * d, 8100);
      const F = clamp((K_COUL * qa * qb) / d2, -F_MAX, F_MAX);
      a.acc.x -= F * ux;
      a.acc.y -= F * uy;
      b.acc.x += F * ux;
      b.acc.y += F * uy;
    }
  for (const a of atoms) {
    if (a.held) {
      a.vel.x = 0;
      a.vel.y = 0;
      continue;
    }
    a.vel.x += a.acc.x * dt;
    a.vel.y += a.acc.y * dt;
    const dp = Math.exp(-6.5 * dt);
    a.vel.x *= dp;
    a.vel.y *= dp;
    const v = Math.hypot(a.vel.x, a.vel.y);
    if (v > 950) {
      a.vel.x *= 950 / v;
      a.vel.y *= 950 / v;
    }
    a.pos.x += a.vel.x * dt;
    a.pos.y += a.vel.y * dt;
  }
  for (const a of atoms) {
    const ps = a.bonds.filter((b) => b.type === "cov").map((b) => (b.a === a ? b.b : b.a));
    if (ps.length < 2) continue;
    const tgt = ps.length === 2 ? (109.5 * Math.PI) / 180 : ps.length === 3 ? (120 * Math.PI) / 180 : (90 * Math.PI) / 180;
    for (let j = 0; j < ps.length; j++)
      for (let k = j + 1; k < ps.length; k++) {
        const fj = Math.atan2(ps[j].pos.y - a.pos.y, ps[j].pos.x - a.pos.x);
        const fk = Math.atan2(ps[k].pos.y - a.pos.y, ps[k].pos.x - a.pos.x);
        let delta = angNorm(tgt - angNorm(fj - fk));
        if (Math.abs(delta) < 0.03) continue;
        delta = clamp(delta, -0.6, 0.6) * 0.09;
        rotAround(a.pos, ps[j].pos, delta * 0.5);
        rotAround(a.pos, ps[k].pos, -delta * 0.5);
      }
  }
  for (let i = 0; i < atoms.length; i++)
    for (let j = i + 1; j < atoms.length; j++) {
      const a = atoms[i],
        b = atoms[j];
      if (a.dead || b.dead) continue;
      if (bonded(a, b)) continue;
      let dx = b.pos.x - a.pos.x,
        dy = b.pos.y - a.pos.y;
      const d = Math.hypot(dx, dy);
      if (d < 0.01) continue;
      const ux = dx / d,
        uy = dy / d;
      if (qOf(a) * qOf(b) < 0 && d < a.edge + b.edge + 26) {
        createIonBond(a, b);
        continue;
      }
      const minD = a.edge + b.edge + 8;
      if (d < minD) {
        const s = (minD - d) * 0.45;
        if (a.held && !b.held) {
          b.pos.x += ux * s;
          b.pos.y += uy * s;
        } else if (b.held && !a.held) {
          a.pos.x -= ux * s;
          a.pos.y -= uy * s;
        } else {
          a.pos.x -= ux * s * 0.5;
          a.pos.y -= uy * s * 0.5;
          b.pos.x += ux * s * 0.5;
          b.pos.y += uy * s * 0.5;
        }
      }
    }
  const vw = W / cam.z / 2 + 260,
    vh = H / cam.z / 2 + 300;
  for (const a of atoms) {
    if (a.held) continue;
    if (a.pos.x < cam.x - vw) a.vel.x += 900 * dt * (cam.x - vw - a.pos.x > 200 ? 3 : 1);
    if (a.pos.x > cam.x + vw) a.vel.x -= 900 * dt * (a.pos.x - cam.x - vw > 200 ? 3 : 1);
    if (a.pos.y < cam.y - vh) a.vel.y += 900 * dt * (cam.y - vh - a.pos.y > 200 ? 3 : 1);
    if (a.pos.y > cam.y + vh - 60) a.vel.y -= 900 * dt * (a.pos.y - cam.y - vh + 60 > 200 ? 3 : 1);
  }
  if (cutMode) {
    for (const b of [...bonds]) {
      const d = Math.hypot(b.b.pos.x - b.a.pos.x, b.b.pos.y - b.a.pos.y);
      if (d > b.d0 * 2.05) {
        breakBond(b, null);
        setStatus("info", "Bindung gelöst – die gemeinsamen Elektronen kehren auf ihre Plätze zurück.");
      }
    }
  }
  for (const a of atoms) {
    a.deformTarget = a.bonds.some((b) => b.type === "cov") ? 1 : 0;
    a.deform += (a.deformTarget - a.deform) * Math.min(1, dt * 5);
  }
}
function rotAround(c, p, d) {
  const co = Math.cos(d),
    si = Math.sin(d),
    dx = p.x - c.x,
    dy = p.y - c.y;
  p.x = c.x + dx * co - dy * si;
  p.y = c.y + dx * si + dy * co;
}

/* ================================================================
   RENDERING
================================================================ */
const canvas = document.getElementById("stage"),
  ctx = canvas.getContext("2d");
let W = 800,
  H = 600,
  DPR = 1;
new ResizeObserver(() => {
  const r = canvas.parentElement.getBoundingClientRect();
  W = r.width;
  H = r.height;
  DPR = window.devicePixelRatio || 1;
  canvas.width = W * DPR;
  canvas.height = H * DPR;
}).observe(canvas.parentElement);

function setWorldTransform() {
  ctx.setTransform(DPR * cam.z, 0, 0, DPR * cam.z, DPR * (W / 2 - cam.x * cam.z), DPR * (H / 2 - cam.y * cam.z));
}
function screenToWorld(px, py) {
  return { x: (px - W / 2) / cam.z + cam.x, y: (py - H / 2) / cam.z + cam.y };
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
function drawBadge(x, y, txt, bg, r = 14) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = "#FBF9F3";
  ctx.stroke();
  ctx.fillStyle = "#fff";
  ctx.font = '700 15px "Space Grotesk",sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(txt, x, y + 0.5);
}

function render() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  setWorldTransform();
  const L = cam.x - W / cam.z / 2,
    T = cam.y - H / cam.z / 2,
    R2 = cam.x + W / cam.z / 2,
    B2 = cam.y + H / cam.z / 2;
  ctx.fillStyle = "rgba(35,39,46,.12)";
  for (let gx = Math.floor(L / 56) * 56; gx <= R2; gx += 56)
    for (let gy = Math.floor(T / 56) * 56; gy <= B2; gy += 56) {
      ctx.beginPath();
      ctx.arc(gx, gy, 1.5, 0, TAU);
      ctx.fill();
    }

  for (const a of atoms) {
    ctx.globalAlpha = 0.09;
    outerPath(a);
    ctx.fillStyle = shellColorOf(a);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  for (const b of bonds) if (b.type === "ion") drawIonLine(b);
  for (const a of atoms) withSpawnScale(a, () => drawShells(a));
  for (const b of bonds) if (b.type === "cov") drawBond(b);
  for (const a of atoms) withSpawnScale(a, () => drawCore(a));
  for (const tw of tweens) drawElectronBubble(tw.pos.x, tw.pos.y, shellColorOf(tw.e.atom), false);
}

function drawShells(a) {
  const last = a.shells.length - 1;
  for (let s = 0; s <= last; s++) {
    const col = SHELL_COL[s],
      sh = a.shells[s];
    if (s === last) {
      outerPath(a);
    } else {
      ctx.beginPath();
      ctx.arc(a.pos.x, a.pos.y, a.radii[s], 0, TAU);
    }
    ctx.lineWidth = s === last && hoverAtom === a ? 3.4 : 2.4;
    ctx.strokeStyle = col;
    ctx.stroke();
    // d/f-Bögen beschriften – dort liegen Plätze jenseits der Oktettregel
    sh.subs.forEach((sub) => {
      if (sub.l < 2) return;
      const R = s === last ? outerRAt(a, sub.mid) : a.radii[s];
      ctx.fillStyle = "rgba(35,39,46,.42)";
      ctx.font = '700 10px "Space Grotesk",sans-serif';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("spdf"[sub.l], a.pos.x + Math.cos(sub.mid) * (R + 16), a.pos.y + Math.sin(sub.mid) * (R + 16));
    });
    for (let i = 0; i < sh.slots.length; i++) {
      const slot = sh.slots[i],
        p = slotPosWorld(a, s, i);
      const hov = hoverSlot && hoverSlot.a === a && hoverSlot.s === s && hoverSlot.i === i && (slot.st === "e" || slot.st === "empty");
      if (slot.st === "e") {
        drawElectronBubble(p.x, p.y, col, hov);
      } else {
        const faint = sh.subs[slot.sub].l >= 2; // d/f-Plätze dezenter
        ctx.beginPath();
        ctx.arc(p.x, p.y, BUB * (hov ? 1.22 : slot.st === "res" ? 0.82 : 1), 0, TAU);
        ctx.setLineDash([3, 3.5]);
        ctx.lineWidth = 1.6;
        ctx.strokeStyle = slot.st === "res" ? "rgba(35,39,46,.20)" : faint ? "rgba(35,39,46,.20)" : "rgba(35,39,46,.34)";
        ctx.stroke();
        ctx.setLineDash([]);
        if (hov) {
          ctx.fillStyle = "#FFF3C9";
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
  ctx.fillStyle = hov ? "#FFF3C9" : "#fff";
  ctx.fill();
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = col;
  ctx.stroke();
  ctx.fillStyle = "#22303C";
  ctx.font = '700 11px "Space Grotesk",sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("−", x, y + 0.5);
}
function drawIonLine(b) {
  ctx.setLineDash([5, 6]);
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(35,39,46,.38)";
  ctx.beginPath();
  ctx.moveTo(b.a.pos.x, b.a.pos.y);
  ctx.lineTo(b.b.pos.x, b.b.pos.y);
  ctx.stroke();
  ctx.setLineDash([]);
}
function drawBond(b) {
  for (let i = 0; i < b.order; i++) {
    const pA = pairPos(b, i, "a"),
      pB = pairPos(b, i, "b");
    const mx = (pA.x + pB.x) / 2,
      my = (pA.y + pB.y) / 2;
    ctx.beginPath();
    ctx.arc(mx, my, 14.5, 0, TAU);
    ctx.fillStyle = "rgba(255,255,255,.8)";
    ctx.fill();
    drawElectronBubble(pA.x, pA.y, shellColorOf(b.a), false);
    drawElectronBubble(pB.x, pB.y, shellColorOf(b.b), false);
  }
  if (b.polar) {
    const u = norm2(b.b.pos, b.a.pos);
    const strong = b.strong === "a" ? b.a : b.b,
      weak = b.strong === "a" ? b.b : b.a;
    const dS = strong === b.a ? u : { x: -u.x, y: -u.y };
    const dW = weak === b.a ? u : { x: -u.x, y: -u.y };
    drawDelta(strong.pos.x + dS.x * (strong.edge + 26), strong.pos.y + dS.y * (strong.edge + 26), "δ−", "#2E5FA3");
    drawDelta(weak.pos.x + dW.x * (weak.edge + 26), weak.pos.y + dW.y * (weak.edge + 26), "δ+", "#C0392B");
  }
}
function drawDelta(x, y, txt, col) {
  ctx.beginPath();
  ctx.arc(x, y, 13, 0, TAU);
  ctx.fillStyle = "#fff";
  ctx.fill();
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = col;
  ctx.stroke();
  ctx.fillStyle = col;
  ctx.font = '800 13px "Space Grotesk",sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(txt, x, y + 0.5);
}
function drawCore(a) {
  const q = qOf(a);
  ctx.beginPath();
  ctx.arc(a.pos.x, a.pos.y, a.kernR, 0, TAU);
  ctx.fillStyle = "#FBE7E0";
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = "#C0392B";
  ctx.stroke();
  ctx.strokeStyle = "#C0392B";
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
  const sr = clamp(a.kernR * 0.86, 15, 27);
  ctx.beginPath();
  ctx.arc(a.pos.x, a.pos.y, sr, 0, TAU);
  ctx.fillStyle = "rgba(255,255,255,.78)";
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "rgba(35,39,46,.4)";
  ctx.stroke();
  const fs = clamp(sr * 0.95, 15, 26);
  ctx.font = `700 ${fs}px "Space Grotesk",sans-serif`;
  ctx.fillStyle = "#23272E";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const symX = q !== 0 ? a.pos.x - 4 : a.pos.x;
  ctx.fillText(a.el.sym, symX, a.pos.y + 1);
  if (q !== 0) {
    const w = ctx.measureText(a.el.sym).width;
    ctx.font = `700 ${Math.round(fs * 0.62)}px "Space Grotesk",sans-serif`;
    ctx.fillStyle = q > 0 ? "#C0392B" : "#2E5FA3";
    ctx.fillText(fmtQ(q), symX + w / 2 + 7, a.pos.y - fs * 0.42);
  }
  if (q !== 0) {
    const t = now(),
      s = easeOutBack(clamp((t - a.badgePop) / 0.3, 0, 1));
    const bx = a.pos.x + Math.SQRT1_2 * (a.edge * 1.06 + 10),
      by = a.pos.y - Math.SQRT1_2 * (a.edge * 1.06 + 10);
    ctx.save();
    ctx.translate(bx, by);
    ctx.scale(s, s);
    ctx.translate(-bx, -by);
    drawBadge(bx, by, fmtQ(q), q > 0 ? "#C0392B" : "#2E5FA3");
    ctx.restore();
  }
  // Beschriftung: Live-Außenkonfiguration + Valenz + Name
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const cfg = dynCfgOuter(a),
    stab = isStable(a);
  let line = (cfg ? cfg + " · " : "") + `${valenceAround(a)} e⁻`;
  if (stab) line += " · stabil";
  if (a.el.exc && outerE(a) === 0 && bondOrderSum(a) === 0) line += ` · ${SHELL_NAMES[a.shells.length - 1]}-Schale leer (Ausnahme!)`;
  ctx.fillStyle = "rgba(35,39,46,.66)";
  ctx.font = '600 12px "Space Grotesk",sans-serif';
  ctx.fillText(line, a.pos.x, a.pos.y + a.edge + 14);
  ctx.fillStyle = "rgba(35,39,46,.55)";
  ctx.font = 'italic 600 13px "Fraunces",serif';
  ctx.fillText(a.el.name, a.pos.x, a.pos.y + a.edge + 30);
}
function norm2(to, from) {
  const dx = to.x - from.x,
    dy = to.y - from.y,
    l = Math.hypot(dx, dy) || 1;
  return { x: dx / l, y: dy / l };
}

/* ================================================================
   EINGABE
================================================================ */
function hitSlot(w) {
  for (let k = atoms.length - 1; k >= 0; k--) {
    const a = atoms[k];
    if (a.dead) continue;
    if (Math.hypot(w.x - a.pos.x, w.y - a.pos.y) > a.edge + 14) continue;
    const s = a.shells.length - 1,
      sh = a.shells[s];
    for (let i = 0; i < sh.slots.length; i++) {
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
function toggleElectron(hit) {
  const a = hit.a,
    sh = outerSh(a),
    slot = sh.slots[hit.i];
  if (slot.st === "res") {
    setStatus("info", "Dieser Platz ist für die Bindung reserviert.");
    return;
  }
  if (slot.st === "e") {
    const e = slot.e,
      ix = a.electrons.indexOf(e);
    if (ix >= 0) a.electrons.splice(ix, 1);
    e.state = "gone";
    sh.slots[hit.i] = { st: "empty", e: null };
    a.badgePop = now();
    setStatus("ionm", `Elektron entfernt → <b>${a.el.sym}<sup>${fmtQ(qOf(a))}</sup></b> (${dynCfgOuter(a) || "leer"}).`);
  } else {
    const e = { id: nextEid++, atom: a, state: "slot", sh: a.shells.length - 1, idx: hit.i, bond: null, pairIndex: null, role: null, tw: null };
    sh.slots[hit.i] = { st: "e", e };
    a.electrons.push(e);
    a.badgePop = now();
    setStatus("ionm", `Elektron eingefügt → <b>${a.el.sym}<sup>${fmtQ(qOf(a))}</sup></b> (${dynCfgOuter(a)}).`);
  }
}

canvas.addEventListener("pointerdown", (e) => {
  const rect = canvas.getBoundingClientRect(),
    w = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
  const slot = hitSlot(w),
    a = slot ? slot.a : hitAtom(w);
  if (slot || a) {
    drag = { mode: "click", start: w, last: w, slot, atom: a, member: null };
    canvas.setPointerCapture(e.pointerId);
  } else {
    drag = { mode: "pan", sx: e.clientX, sy: e.clientY, cx: cam.x, cy: cam.y };
    canvas.setPointerCapture(e.pointerId);
  }
});
canvas.addEventListener("pointermove", (e) => {
  const rect = canvas.getBoundingClientRect();
  const w = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
  if (!drag) {
    hoverSlot = hitSlot(w);
    hoverAtom = hoverSlot ? null : hitAtom(w);
    canvas.style.cursor = hoverSlot ? "pointer" : hoverAtom ? "grab" : "default";
    if (hoverAtom && hoverStatusAtom !== hoverAtom) {
      hoverStatusAtom = hoverAtom;
      const el = hoverAtom.el,
        a = hoverAtom;
      let tend;
      if (el.cat === "eg") tend = "stabile Edelgaskonfiguration";
      else if (isMetal(a)) tend = `gibt bis zu ${outerE(a)} Außenelektron(en) ab`;
      else if (freeVal(a) > 0) tend = `nimmt ${freeVal(a)} e⁻ auf (bis Oktett)`;
      else tend = "Oktett erreicht";
      setStatus(
        "info",
        `<b>${el.sym} · ${el.name}</b> — Periode ${el.per}, Gruppe ${el.grp} · EN ${fmtEN(el.en)} · ${el.cfg} · Außen ${valenceAround(a)}/${valTarget(a)} (${tend}).`,
      );
    }
    return;
  }
  if (drag.mode === "pan") {
    cam.x = drag.cx - (e.clientX - drag.sx) / cam.z;
    cam.y = drag.cy - (e.clientY - drag.sy) / cam.z;
    return;
  }
  if (drag.mode === "click") {
    if (Math.hypot(w.x - drag.start.x, w.y - drag.start.y) > 6 / Math.max(cam.z, 0.2)) {
      drag.mode = "drag";
      hoverSlot = null;
      hoverAtom = null;
      drag.member = cutMode ? [drag.atom] : bondComponent(drag.atom);
      drag.member.forEach((m) => (m.held = true));
      canvas.style.cursor = "grabbing";
    }
  }
  if (drag.mode === "drag") {
    const dx = w.x - drag.last.x,
      dy = w.y - drag.last.y;
    drag.member.forEach((m) => {
      m.pos.x += dx;
      m.pos.y += dy;
    });
    drag.last = w;
    interactLive(drag.atom);
  }
});
canvas.addEventListener("pointerup", () => {
  if (drag && drag.mode === "click") {
    if (drag.slot) toggleElectron(drag.slot);
  }
  if (drag && drag.member) drag.member.forEach((m) => (m.held = false));
  drag = null;
  canvas.style.cursor = "default";
});
canvas.addEventListener("pointercancel", () => {
  if (drag && drag.member) drag.member.forEach((m) => (m.held = false));
  drag = null;
  canvas.style.cursor = "default";
});
canvas.addEventListener("dblclick", (e) => {
  const rect = canvas.getBoundingClientRect(),
    w = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
  if (hitSlot(w)) return;
  const a = hitAtom(w);
  if (!a) return;
  setStatus("info", `<b>${a.el.name}</b>-Atom von der Bühne entfernt.`);
  removeAtom(a);
});
canvas.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left,
      my = e.clientY - rect.top;
    const before = screenToWorld(mx, my);
    cam.z = clamp(cam.z * Math.exp(-e.deltaY * 0.0012), 0.35, 2.2);
    const after = screenToWorld(mx, my);
    cam.x += before.x - after.x;
    cam.y += before.y - after.y;
  },
  { passive: false },
);

/* ================================================================
   SPAWNS, BUTTONS, PRESETS
================================================================ */
function findFreeSpot(a) {
  const c = { x: cam.x, y: cam.y };
  for (let ring = 0; ring < 5; ring++) {
    const R = ring * 230;
    for (let j = 0; j < (ring ? 7 : 1); j++) {
      const th = (j / (ring ? 7 : 1)) * TAU + ring * 0.5;
      const p = { x: c.x + Math.cos(th) * R, y: c.y + Math.sin(th) * R };
      if (atoms.every((o) => Math.hypot(o.pos.x - p.x, o.pos.y - p.y) > o.edge + a.edge + 30)) return p;
    }
  }
  return { x: c.x + (Math.random() - 0.5) * 500, y: c.y + (Math.random() - 0.5) * 400 };
}
function spawnFromPSE(Z) {
  const a = makeAtom(Z, 0, 0);
  const p = findFreeSpot(a);
  a.pos.x = p.x;
  a.pos.y = p.y;
  if (a.el.exc)
    setStatus(
      "info",
      `<b>${a.el.name}</b> auf die Bühne — ${a.el.cfg}. <b>Ausnahme vom Aufbauprinzip:</b> die Madelung-Regel würde hier etwas anderes vorhersagen; der beobachtete Grundzustand ist korrigiert.`,
    );
  else
    setStatus(
      "info",
      `<b>${a.el.name}</b> auf die Bühne geholt — ${a.el.cfg} · Außen ${valenceAround(a)}/${valTarget(a)}. Ziehe es an einen Reaktionspartner heran.`,
    );
}
function fitView() {
  if (!atoms.length) {
    cam = { x: 0, y: 0, z: 0.9 };
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
  cam.x = (x0 + x1) / 2;
  cam.y = (y0 + y1) / 2;
  cam.z = clamp(Math.min(W / (x1 - x0 + 280), H / (y1 - y0 + 280)), 0.4, 1.05);
}
function preset(name) {
  clearAll();
  if (name === "nacl") {
    const na = makeAtom(11, -170, 0),
      cl = makeAtom(17, 170, 0);
    fitView();
    setTimeout(() => {
      const n = tryTransfer(na, cl);
      if (n)
        setStatus(
          "ion",
          `<b>Natrium</b> gibt 1 Elektron an <b>Chlor</b> ab (ΔEN = 2,23 ≥ 1,7) → <b>Na⁺</b> und <b>Cl⁻</b> entstehen – beobachte, wie sich die Ionen anziehen!`,
        );
    }, 450);
  } else if (name === "h2o") {
    const o = makeAtom(8, 0, 0),
      h1 = makeAtom(1, 0, 0),
      h2 = makeAtom(1, 0, 0);
    const d = 0.84 * (o.edge + h1.edge);
    h1.pos = { x: Math.cos(-0.906) * d, y: Math.sin(-0.906) * d };
    h2.pos = { x: Math.cos(-2.236) * d, y: Math.sin(-2.236) * d };
    fitView();
    setTimeout(() => createCov(o, h1), 350);
    setTimeout(() => createCov(o, h2), 900);
    setStatus("pol", `Beispiel <b>Wasser</b>: 2× Wasserstoff an Sauerstoff → zwei polare Atombindungen (ΔEN = 1,24), Winkel ≈ 109°.`);
  } else if (name === "ch4") {
    const c = makeAtom(6, 0, 0),
      H = [];
    for (let k = 0; k < 4; k++) H.push(makeAtom(1, 0, 0));
    const d = 0.84 * (c.edge + H[0].edge);
    [0.785, 2.356, 3.927, 5.498].forEach((th, k) => {
      H[k].pos.x = Math.cos(th) * d;
      H[k].pos.y = Math.sin(th) * d;
    });
    fitView();
    H.forEach((h, i) => setTimeout(() => createCov(c, h), 350 + i * 450));
    setStatus(
      "cov",
      `Beispiel <b>Methan</b>: vier unpolare Atombindungen (ΔEN C–H = 0,35) – der Kohlenstoff erreicht mit 4 Paaren die 8-Elektronen-Konfiguration.`,
    );
  } else if (name === "ethan") {
    const c1 = makeAtom(6, -75, 0),
      c2 = makeAtom(6, 75, 0);
    const Hs = [];
    for (let k = 0; k < 6; k++) Hs.push(makeAtom(1, 0, 0));
    const dCH = 0.84 * (c1.edge + Hs[0].edge);
    [(100 * Math.PI) / 180, Math.PI, (260 * Math.PI) / 180].forEach((t, k) => {
      Hs[k].pos.x = c1.pos.x + Math.cos(t) * dCH;
      Hs[k].pos.y = c1.pos.y + Math.sin(t) * dCH;
    });
    [(80 * Math.PI) / 180, 0, (280 * Math.PI) / 180].forEach((t, k) => {
      Hs[3 + k].pos.x = c2.pos.x + Math.cos(t) * dCH;
      Hs[3 + k].pos.y = c2.pos.y + Math.sin(t) * dCH;
    });
    fitView();
    Hs.slice(0, 3).forEach((h, i) => setTimeout(() => createCov(c1, h), 350 + i * 260));
    Hs.slice(3).forEach((h, i) => setTimeout(() => createCov(c2, h), 350 + (3 + i) * 260));
    setTimeout(
      () => {
        createCov(c1, c2);
        fitView();
        setStatus(
          "cov",
          `Beispiel <b>Ethan</b> (C₂H₆): erst die Wasserstoffe ansetzen (Valenz!), dann die C-Atome verbinden – so entsteht die Einfachbindung.`,
        );
      },
      350 + 6 * 260 + 200,
    );
  }
}

document.querySelectorAll("[data-preset]").forEach((b) => b.addEventListener("click", () => preset(b.dataset.preset)));
const btnCut = document.getElementById("btnCut"),
  cutChip = document.getElementById("cutChip");
btnCut.addEventListener("click", () => {
  cutMode = !cutMode;
  btnCut.classList.toggle("on", cutMode);
  cutChip.classList.toggle("show", cutMode);
  if (cutMode) setStatus("info", "<b>Trennmodus aktiv:</b> Ziehe ein Atom aus einem Molekül heraus, bis die Bindung reißt.");
});
document.getElementById("btnClear").addEventListener("click", () => {
  clearAll();
  setStatus("info", "Bühne geleert. Klicke im Periodensystem auf ein Element, um neu zu starten.");
});
document.getElementById("btnCam").addEventListener("click", () => {
  fitView();
});
const pseWrap = document.getElementById("pseWrap"),
  btnPse = document.getElementById("btnPse");
btnPse.addEventListener("click", () => {
  pseWrap.classList.toggle("closed");
  btnPse.classList.toggle("on", pseWrap.classList.contains("closed"));
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

/* ================================================================
   HAUPTSCHLEIFE
================================================================ */
let lastT = performance.now();
function loop(t) {
  const dt = clamp((t - lastT) / 1000, 0.004, 0.032);
  lastT = t;
  const sub = dt / 2;
  physicsStep(sub);
  physicsStep(sub);
  updateTweens(dt);
  render();
  requestAnimationFrame(loop);
}
if (window.lucide) {
  try {
    lucide.createIcons();
  } catch (err) {}
}
overlay.classList.add("open");
requestAnimationFrame(loop);
