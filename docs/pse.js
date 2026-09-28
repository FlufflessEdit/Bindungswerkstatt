"use strict";
/* =====================================================================
   pse.js – Konstanten & Helfer, Elementdaten 1–118 (mit Oxidationszahlen),
   Periodensystem als Canvas-Objekt mit Legende, Bühne (STAGE), Statuszeile.
   Lädt als ERSTES.
   ===================================================================== */

const TAU = Math.PI * 2;
const BUB = 8;
const PR_STEP = 6.5,
  PR_GAP = 12;
const SHELL_COL = ["#6fb3c9", "#8fb573", "#c9a15f", "#b58bc9"];

const now = () => performance.now() / 1000;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const angNorm = (x) => {
  while (x > Math.PI) x -= TAU;
  while (x < -Math.PI) x += TAU;
  return x;
};
const easeIO = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const easeOutBack = (t) => {
  const c1 = 1.70158,
    c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
const fmtQ = (q) => (Math.abs(q) > 1 ? Math.abs(q) : "") + (q > 0 ? "+" : "−");

function mixHex(h1, h2, t) {
  const a = parseInt(h1.slice(1), 16),
    b = parseInt(h2.slice(1), 16);
  const r = Math.round(((a >> 16) & 255) * (1 - t) + ((b >> 16) & 255) * t);
  const g = Math.round(((a >> 8) & 255) * (1 - t) + ((b >> 8) & 255) * t);
  const bl = Math.round((a & 255) * (1 - t) + (b & 255) * t);
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1);
}

const CATS = {
  ak: { label: "Alkalimetalle", c: "#e2603f" },
  ea: { label: "Erdalkalimetalle", c: "#e0913a" },
  ue: { label: "Übergangsmetalle", c: "#cfa64f" },
  me: { label: "Metalle", c: "#a3947c" },
  hm: { label: "Halbmetalle", c: "#8fae6e" },
  nm: { label: "Nichtmetalle", c: "#4ba8a2" },
  hg: { label: "Halogene", c: "#5b8fc9" },
  eg: { label: "Edelgase", c: "#9a7fc9" },
  la: { label: "Lanthanoide", c: "#c4826e" },
  ac: { label: "Actinoide", c: "#a06a72" },
};
const METALS = new Set(["ak", "ea", "ue", "me", "la", "ac"]);
const isMetal = (a) => METALS.has(a.el.cat);
const shellColorOf = (a) => CATS[a.el.cat].c;

/* ---------- [Symbol, Name, Kat, EN, Oxidationszahlen, Schalen, Spalte, Zeile] ---------- */
const RAW = [
  ["H", "Wasserstoff", "nm", 2.2, "+1/-1", "1", 1, 1],
  ["He", "Helium", "eg", 0, "0", "2", 18, 1],
  ["Li", "Lithium", "ak", 0.98, "+1", "2-1", 1, 2],
  ["Be", "Beryllium", "ea", 1.57, "+2", "2-2", 2, 2],
  ["B", "Bor", "hm", 2.04, "+3", "2-3", 13, 2],
  ["C", "Kohlenstoff", "nm", 2.55, "-4/+2/+4", "2-4", 14, 2],
  ["N", "Stickstoff", "nm", 3.04, "-3/+3/+5", "2-5", 15, 2],
  ["O", "Sauerstoff", "nm", 3.44, "-2", "2-6", 16, 2],
  ["F", "Fluor", "hg", 3.98, "-1", "2-7", 17, 2],
  ["Ne", "Neon", "eg", 0, "0", "2-8", 18, 2],
  ["Na", "Natrium", "ak", 0.93, "+1", "2-8-1", 1, 3],
  ["Mg", "Magnesium", "ea", 1.31, "+2", "2-8-2", 2, 3],
  ["Al", "Aluminium", "me", 1.61, "+3", "2-8-3", 13, 3],
  ["Si", "Silizium", "hm", 1.9, "-4/+4", "2-8-4", 14, 3],
  ["P", "Phosphor", "nm", 2.19, "-3/+3/+5", "2-8-5", 15, 3],
  ["S", "Schwefel", "nm", 2.58, "-2/+4/+6", "2-8-6", 16, 3],
  ["Cl", "Chlor", "hg", 3.16, "-1/+1/+5/+7", "2-8-7", 17, 3],
  ["Ar", "Argon", "eg", 0, "0", "2-8-8", 18, 3],
  ["K", "Kalium", "ak", 0.82, "+1", "2-8-8-1", 1, 4],
  ["Ca", "Calcium", "ea", 1.0, "+2", "2-8-8-2", 2, 4],
  ["Sc", "Scandium", "ue", 1.36, "+3", "2-8-9-2", 3, 4],
  ["Ti", "Titan", "ue", 1.54, "+2/+3/+4", "2-8-10-2", 4, 4],
  ["V", "Vanadium", "ue", 1.63, "+2/+3/+4/+5", "2-8-11-2", 5, 4],
  ["Cr", "Chrom", "ue", 1.66, "+2/+3/+6", "2-8-13-1", 6, 4],
  ["Mn", "Mangan", "ue", 1.55, "+2/+3/+4/+6/+7", "2-8-13-2", 7, 4],
  ["Fe", "Eisen", "ue", 1.83, "+2/+3", "2-8-14-2", 8, 4],
  ["Co", "Cobalt", "ue", 1.88, "+2/+3", "2-8-15-2", 9, 4],
  ["Ni", "Nickel", "ue", 1.91, "+2/+3", "2-8-16-2", 10, 4],
  ["Cu", "Kupfer", "ue", 1.9, "+1/+2", "2-8-18-1", 11, 4],
  ["Zn", "Zink", "ue", 1.65, "+2", "2-8-18-2", 12, 4],
  ["Ga", "Gallium", "me", 1.81, "+3", "2-8-18-3", 13, 4],
  ["Ge", "Germanium", "hm", 2.01, "+2/+4", "2-8-18-4", 14, 4],
  ["As", "Arsen", "hm", 2.18, "-3/+3/+5", "2-8-18-5", 15, 4],
  ["Se", "Selen", "nm", 2.55, "-2/+4/+6", "2-8-18-6", 16, 4],
  ["Br", "Brom", "hg", 2.96, "-1/+1/+5", "2-8-18-7", 17, 4],
  ["Kr", "Krypton", "eg", 3.0, "0", "2-8-18-8", 18, 4],
  ["Rb", "Rubidium", "ak", 0.82, "+1", "2-8-18-8-1", 1, 5],
  ["Sr", "Strontium", "ea", 0.95, "+2", "2-8-18-8-2", 2, 5],
  ["Y", "Yttrium", "ue", 1.22, "+3", "2-8-18-9-2", 3, 5],
  ["Zr", "Zirconium", "ue", 1.33, "+4", "2-8-18-10-2", 4, 5],
  ["Nb", "Niob", "ue", 1.6, "+2/+5", "2-8-18-12-1", 5, 5],
  ["Mo", "Molybdän", "ue", 2.16, "+4/+6", "2-8-18-13-1", 6, 5],
  ["Tc", "Technetium", "ue", 1.9, "+4/+7", "2-8-18-13-2", 7, 5],
  ["Ru", "Ruthenium", "ue", 2.2, "+3", "2-8-18-15-1", 8, 5],
  ["Rh", "Rhodium", "ue", 2.28, "+3", "2-8-18-16-1", 9, 5],
  ["Pd", "Palladium", "ue", 2.2, "+2/+4", "2-8-18-18", 10, 5],
  ["Ag", "Silber", "ue", 1.93, "+1", "2-8-18-18-1", 11, 5],
  ["Cd", "Cadmium", "ue", 1.69, "+2", "2-8-18-18-2", 12, 5],
  ["In", "Indium", "me", 1.78, "+1/+3", "2-8-18-18-3", 13, 5],
  ["Sn", "Zinn", "me", 1.96, "+2/+4", "2-8-18-18-4", 14, 5],
  ["Sb", "Antimon", "hm", 2.05, "-3/+3/+5", "2-8-18-18-5", 15, 5],
  ["Te", "Tellur", "hm", 2.1, "-2/+4/+6", "2-8-18-18-6", 16, 5],
  ["I", "Iod", "hg", 2.66, "-1/+1/+5/+7", "2-8-18-18-7", 17, 5],
  ["Xe", "Xenon", "eg", 2.6, "0", "2-8-18-18-8", 18, 5],
  ["Cs", "Caesium", "ak", 0.79, "+1", "2-8-18-18-8-1", 1, 6],
  ["Ba", "Barium", "ea", 0.89, "+2", "2-8-18-18-8-2", 2, 6],
  ["La", "Lanthan", "la", 1.1, "+3", "2-8-18-18-9-2", 3, 8],
  ["Ce", "Cer", "la", 1.12, "+3/+4", "2-8-18-19-9-2", 4, 8],
  ["Pr", "Praseodym", "la", 1.13, "+3", "2-8-18-21-8-2", 5, 8],
  ["Nd", "Neodym", "la", 1.14, "+3", "2-8-18-22-8-2", 6, 8],
  ["Pm", "Promethium", "la", 1.13, "+3", "2-8-18-23-8-2", 7, 8],
  ["Sm", "Samarium", "la", 1.17, "+3", "2-8-18-24-8-2", 8, 8],
  ["Eu", "Europium", "la", 1.2, "+2/+3", "2-8-18-25-8-2", 9, 8],
  ["Gd", "Gadolinium", "la", 1.2, "+3", "2-8-18-25-9-2", 10, 8],
  ["Tb", "Terbium", "la", 1.2, "+3/+4", "2-8-18-27-8-2", 11, 8],
  ["Dy", "Dysprosium", "la", 1.22, "+3", "2-8-18-28-8-2", 12, 8],
  ["Ho", "Holmium", "la", 1.23, "+3", "2-8-18-29-8-2", 13, 8],
  ["Er", "Erbium", "la", 1.24, "+3", "2-8-18-30-8-2", 14, 8],
  ["Tm", "Thulium", "la", 1.25, "+3", "2-8-18-31-8-2", 15, 8],
  ["Yb", "Ytterbium", "la", 1.1, "+2/+3", "2-8-18-32-8-2", 16, 8],
  ["Lu", "Lutetium", "la", 1.27, "+3", "2-8-18-32-9-2", 17, 8],
  ["Hf", "Hafnium", "ue", 1.3, "+4", "2-8-18-32-10-2", 4, 6],
  ["Ta", "Tantal", "ue", 1.5, "+5", "2-8-18-32-11-2", 5, 6],
  ["W", "Wolfram", "ue", 2.36, "+4/+6", "2-8-18-32-12-2", 6, 6],
  ["Re", "Rhenium", "ue", 1.9, "+4/+7", "2-8-18-32-13-2", 7, 6],
  ["Os", "Osmium", "ue", 2.2, "+4", "2-8-18-32-14-2", 8, 6],
  ["Ir", "Iridium", "ue", 2.2, "+3", "2-8-18-32-15-2", 9, 6],
  ["Pt", "Platin", "ue", 2.28, "+2/+4", "2-8-18-32-17-1", 10, 6],
  ["Au", "Gold", "ue", 2.54, "+1/+3", "2-8-18-32-18-1", 11, 6],
  ["Hg", "Quecksilber", "ue", 2.0, "+1/+2", "2-8-18-32-18-2", 12, 6],
  ["Tl", "Thallium", "me", 1.62, "+1/+3", "2-8-18-32-18-3", 13, 6],
  ["Pb", "Blei", "me", 2.33, "+2/+4", "2-8-18-32-18-4", 14, 6],
  ["Bi", "Bismut", "me", 2.02, "+3", "2-8-18-32-18-5", 15, 6],
  ["Po", "Polonium", "me", 2.0, "+2/+4", "2-8-18-32-18-6", 16, 6],
  ["At", "Astat", "hg", 2.2, "-1", "2-8-18-32-18-7", 17, 6],
  ["Rn", "Radon", "eg", 2.2, "0", "2-8-18-32-18-8", 18, 6],
  ["Fr", "Francium", "ak", 0.7, "+1", "2-8-18-32-18-8-1", 1, 7],
  ["Ra", "Radium", "ea", 0.9, "+2", "2-8-18-32-18-8-2", 2, 7],
  ["Ac", "Actinium", "ac", 1.1, "+3", "2-8-18-32-18-9-2", 3, 9],
  ["Th", "Thorium", "ac", 1.3, "+4", "2-8-18-32-18-10-2", 4, 9],
  ["Pa", "Protactinium", "ac", 1.5, "+5", "2-8-18-32-20-9-2", 5, 9],
  ["U", "Uran", "ac", 1.38, "+4/+6", "2-8-18-32-21-9-2", 6, 9],
  ["Np", "Neptunium", "ac", 1.36, "+5", "2-8-18-32-22-9-2", 7, 9],
  ["Pu", "Plutonium", "ac", 1.28, "+4", "2-8-18-32-24-8-2", 8, 9],
  ["Am", "Americium", "ac", 1.13, "+3", "2-8-18-32-25-8-2", 9, 9],
  ["Cm", "Curium", "ac", 1.28, "+3", "2-8-18-32-25-9-2", 10, 9],
  ["Bk", "Berkelium", "ac", 1.3, "+3/+4", "2-8-18-32-27-8-2", 11, 9],
  ["Cf", "Californium", "ac", 1.3, "+3", "2-8-18-32-28-8-2", 12, 9],
  ["Es", "Einsteinium", "ac", 1.3, "+3", "2-8-18-32-29-8-2", 13, 9],
  ["Fm", "Fermium", "ac", 1.3, "+3", "2-8-18-32-30-8-2", 14, 9],
  ["Md", "Mendelevium", "ac", 1.3, "+2/+3", "2-8-18-32-31-8-2", 15, 9],
  ["No", "Nobelium", "ac", 1.3, "+2", "2-8-18-32-32-8-2", 16, 9],
  ["Lr", "Lawrencium", "ac", 1.3, "+3", "2-8-18-32-32-8-3", 17, 9],
  ["Rf", "Rutherfordium", "ue", 0, "+4", "2-8-18-32-32-10-2", 4, 7],
  ["Db", "Dubnium", "ue", 0, "+5", "2-8-18-32-32-11-2", 5, 7],
  ["Sg", "Seaborgium", "ue", 0, "+6", "2-8-18-32-32-12-2", 6, 7],
  ["Bh", "Bohrium", "ue", 0, "+7", "2-8-18-32-32-13-2", 7, 7],
  ["Hs", "Hassium", "ue", 0, "+8", "2-8-18-32-32-14-2", 8, 7],
  ["Mt", "Meitnerium", "ue", 0, "–", "2-8-18-32-32-15-2", 9, 7],
  ["Ds", "Darmstadtium", "ue", 0, "–", "2-8-18-32-32-16-2", 10, 7],
  ["Rg", "Röntgenium", "ue", 0, "–", "2-8-18-32-32-17-2", 11, 7],
  ["Cn", "Copernicium", "ue", 0, "+2", "2-8-18-32-32-18-2", 12, 7],
  ["Nh", "Nihonium", "me", 0, "+1", "2-8-18-32-32-18-3", 13, 7],
  ["Fl", "Flerovium", "me", 0, "–", "2-8-18-32-32-18-4", 14, 7],
  ["Mc", "Moscovium", "me", 0, "–", "2-8-18-32-32-18-5", 15, 7],
  ["Lv", "Livermorium", "me", 0, "+2", "2-8-18-32-32-18-6", 16, 7],
  ["Ts", "Tenness", "hg", 0, "–", "2-8-18-32-32-18-7", 17, 7],
  ["Og", "Oganesson", "eg", 0, "–", "2-8-18-32-32-18-8", 18, 7],
];

const ELEMENTS = RAW.map(function (r, i) {
  const z = i + 1,
    col = r[6],
    row = r[7];
  const per = row <= 7 ? row : row === 8 ? 6 : 7;
  const gruppe = row <= 7 ? (col <= 2 || col >= 13 ? col : 0) : 0;
  let ve;
  if (z === 2) ve = 2;
  else if (gruppe >= 13) ve = gruppe - 10;
  else if (gruppe >= 1) ve = gruppe;
  else ve = 2;
  return {
    z: z,
    sym: r[0],
    name: r[1],
    cat: r[2],
    en: r[3],
    ox: r[4],
    shells: r[5].split("-").map(Number),
    col: col,
    row: row,
    per: per,
    gruppe: gruppe,
    ve: ve,
  };
});

const ELBYZ = [],
  ELBYSYM = {};
ELEMENTS.forEach(function (e) {
  ELBYZ[e.z] = e;
  ELBYSYM[e.sym] = e;
});

/* ---------- Periodensystem-Geometrie (Kästchen mit vollem Inhalt) ---------- */
const PZ = { ox: 56, oy: 140, cw: 58, ch: 66, px: 62, py: 70, fPad: 30, cells: [] };
const PSE = { w: 0, h: 0, hover: null };

(function pseBuildCells() {
  let maxX = 0,
    maxY = 0;
  ELEMENTS.forEach(function (el) {
    const x = PZ.ox + (el.col - 1) * PZ.px;
    const y = PZ.oy + (el.row - 1) * PZ.py + (el.row >= 8 ? PZ.fPad : 0);
    PZ.cells.push({ x: x, y: y, z: el.z });
    maxX = Math.max(maxX, x + PZ.cw);
    maxY = Math.max(maxY, y + PZ.ch);
  });
  PSE.w = maxX + 18;
  PSE.h = maxY + 16;
})();

const STAGE = { x: PSE.w + 430, y: 450, hw: 680, hh: 380 };

function pseHit(wx, wy) {
  for (let i = 0; i < PZ.cells.length; i++) {
    const c = PZ.cells[i];
    if (wx >= c.x && wx <= c.x + PZ.cw && wy >= c.y && wy <= c.y + PZ.ch) return c.z;
  }
  return null;
}

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return "rgba(" + ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + a + ")";
}
function pseRound(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* ---------- ein Element-Kästchen (vollständig, opak) ---------- */
function drawCell(ctx, c, el, dark, hov) {
  const ink = dark ? "233,228,216" : "38,37,31";
  const g = PZ;
  const cat = CATS[el.cat];
  const base = dark ? "#141a21" : "#f7f5ef";
  ctx.fillStyle = mixHex(base, cat.c, hov ? 0.34 : 0.16);
  pseRound(ctx, c.x, c.y, g.cw, g.ch, 5);
  ctx.fill();
  ctx.strokeStyle = cat.c;
  ctx.lineWidth = hov ? 1.8 : 1.1;
  ctx.stroke();
  /* Ordnungszahl oben links, fett */
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(" + ink + ",.95)";
  ctx.font = "700 9px 'IBM Plex Mono',monospace";
  ctx.fillText(String(el.z), c.x + 4, c.y + 8);
  /* darunter: Elektronegativität */
  ctx.fillStyle = "rgba(" + ink + ",.6)";
  ctx.font = "400 7px 'IBM Plex Mono',monospace";
  ctx.fillText(el.en > 0 ? el.en.toFixed(2).replace(".", ",") : "–", c.x + 4, c.y + 18);
  /* Elementsymbol rechts daneben */
  ctx.textAlign = "center";
  ctx.fillStyle = hov ? "#ffffff" : cat.c;
  ctx.font = "700 15px 'IBM Plex Mono',monospace";
  ctx.fillText(el.sym, c.x + g.cw - 14, c.y + 15);
  /* deutscher Name (einpassen) */
  let fs = 6.2;
  ctx.font = "500 " + fs.toFixed(1) + "px 'Space Grotesk',sans-serif";
  while (ctx.measureText(el.name).width > g.cw - 6 && fs > 4.4) {
    fs -= 0.3;
    ctx.font = "500 " + fs.toFixed(1) + "px 'Space Grotesk',sans-serif";
  }
  ctx.fillStyle = "rgba(" + ink + ",.8)";
  ctx.fillText(el.name, c.x + g.cw / 2, c.y + 38);
  /* Oxidationszahlen */
  const ox = el.ox.replace(/-/g, "−");
  let fs2 = 6.6;
  ctx.font = "600 " + fs2.toFixed(1) + "px 'IBM Plex Mono',monospace";
  while (ctx.measureText(ox).width > g.cw - 6 && fs2 > 4.6) {
    fs2 -= 0.3;
    ctx.font = "600 " + fs2.toFixed(1) + "px 'IBM Plex Mono',monospace";
  }
  ctx.fillStyle = "rgba(" + ink + ",.65)";
  ctx.fillText(ox, c.x + g.cw / 2, c.y + 52);
}

function drawPSE(ctx) {
  const dark = typeof darkBg !== "undefined" ? darkBg : true;
  const ink = dark ? "233,228,216" : "38,37,31";
  const g = PZ;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  /* Titel */
  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(" + ink + ",.62)";
  ctx.font = "700 13px 'Space Grotesk',sans-serif";
  ctx.fillText("PERIODENSYSTEM", g.ox, g.oy - 192);
  ctx.textAlign = "center";

  /* Gruppen: Hauptgruppen I–VIII (1, 2, 13–18), Nebengruppen III–VIII/I/II (3–12) */
  const HG = { 1: "I", 2: "II", 13: "III", 14: "IV", 15: "V", 16: "VI", 17: "VII", 18: "VIII" };
  const NG = { 3: "III", 4: "IV", 5: "V", 6: "VI", 7: "VII", 11: "I", 12: "II" };
  ctx.font = "600 10px 'IBM Plex Mono',monospace";
  for (const c in HG) {
    const x = g.ox + (c - 1) * g.px + g.cw / 2;
    ctx.fillStyle = "rgba(" + ink + ",.85)";
    ctx.fillText(HG[c], x, g.oy - 48);
  }
  ctx.fillStyle = "rgba(" + ink + ",.5)";
  for (const c in NG) {
    const x = g.ox + (c - 1) * g.px + g.cw / 2;
    ctx.fillText(NG[c], x, g.oy - 48);
  }
  ctx.fillText("VIII", g.ox + 8 * g.px + g.cw / 2, g.oy - 48); /* Spalten 8–10 */

  ctx.font = "600 7.5px 'Space Grotesk',sans-serif";
  ctx.fillStyle = "rgba(" + ink + ",.5)";
  ctx.fillText("Hauptgruppen", g.ox + 15.5 * g.px, g.oy - 64);
  ctx.fillText("Nebengruppen", g.ox + 7.5 * g.px, g.oy - 64);

  /* Periodennummern + hochkantige Beschriftung */
  for (let r = 1; r <= 7; r++) {
    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(" + ink + ",.6)";
    ctx.font = "600 10px 'IBM Plex Mono',monospace";
    ctx.fillText(String(r), g.ox - 12, g.oy + (r - 1) * g.py + g.ch / 2);
    ctx.textAlign = "center";
  }
  ctx.save();
  ctx.translate(g.ox - 38, g.oy + 3.5 * g.py);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = "rgba(" + ink + ",.5)";
  ctx.font = "600 9px 'IBM Plex Mono',monospace";
  ctx.fillText("Perioden", 0, 0);
  ctx.restore();

  /* f-Block-Platzhalter + Beschriftung */
  [
    [6, "57–71", "la", "Lanthanoide"],
    [7, "89–103", "ac", "Actinoide"],
  ].forEach(function (pl) {
    const x = g.ox + 2 * g.px,
      y = g.oy + (pl[0] - 1) * g.py;
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = hexA(CATS[pl[2]].c, 0.55);
    ctx.lineWidth = 1;
    pseRound(ctx, x, y, g.cw, g.ch, 5);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = hexA(CATS[pl[2]].c, 0.8);
    ctx.font = "600 9px 'IBM Plex Mono',monospace";
    ctx.fillText(pl[1], x + g.cw / 2, y + g.ch / 2);
    ctx.textAlign = "left";
    ctx.font = "600 8px 'Space Grotesk',sans-serif";
    ctx.fillStyle = "rgba(" + ink + ",.55)";
    ctx.fillText(pl[3], g.ox + 2 * g.px, y - 10);
    ctx.textAlign = "center";
  });

  /* Elementzellen */
  for (let i = 0; i < g.cells.length; i++) {
    drawCell(ctx, g.cells[i], ELBYZ[g.cells[i].z], dark, PSE.hover === g.cells[i].z);
  }

  /* Tooltip-Karte */
  if (PSE.hover && ELBYZ[PSE.hover]) {
    const el = ELBYZ[PSE.hover];
    let cell = null;
    for (let i = 0; i < g.cells.length; i++)
      if (g.cells[i].z === el.z) {
        cell = g.cells[i];
        break;
      }
    if (cell) {
      const w = 216,
        h = 122;
      let x = cell.x + g.cw + 12;
      if (x + w > PSE.w) x = cell.x - w - 12;
      let y = clamp(cell.y - 8, 8, PSE.h - h - 8);
      ctx.fillStyle = dark ? "rgba(18,22,27,.96)" : "rgba(250,249,244,.97)";
      ctx.strokeStyle = hexA(CATS[el.cat].c, 0.7);
      ctx.lineWidth = 1;
      pseRound(ctx, x, y, w, h, 8);
      ctx.fill();
      ctx.stroke();
      ctx.textAlign = "left";
      ctx.fillStyle = CATS[el.cat].c;
      ctx.font = "700 20px 'IBM Plex Mono',monospace";
      ctx.fillText(el.sym, x + 13, y + 24);
      ctx.fillStyle = dark ? "#e9e4d8" : "#26251f";
      ctx.font = "600 13px 'Space Grotesk',sans-serif";
      ctx.fillText(el.name, x + 58, y + 24);
      ctx.font = "400 10.5px 'IBM Plex Mono',monospace";
      ctx.fillStyle = "rgba(" + ink + ",.65)";
      ctx.fillText("Ordnungszahl  " + el.z, x + 13, y + 47);
      ctx.fillText("Kategorie     " + CATS[el.cat].label, x + 13, y + 62);
      ctx.fillText("EN            " + (el.en > 0 ? el.en.toFixed(2).replace(".", ",") : "–"), x + 13, y + 77);
      ctx.fillText("Ox.-Zahlen    " + el.ox.replace(/-/g, "−"), x + 13, y + 92);
      ctx.fillText("Schalen       " + el.shells.join(" · "), x + 13, y + 107);
      ctx.textAlign = "center";
    }
  }
}

/* ---------- Statuszeile ---------- */
function refreshCounts() {
  const el = document.getElementById("statusBar");
  if (!el) return;
  let e = 0;
  for (const a of atoms) e += a.electrons.length;
  el.textContent = atoms.length + " Atome · " + bonds.length + " Bindungen · " + e + " Elektronen";
}
