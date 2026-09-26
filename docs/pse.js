"use strict";
/* =====================================================================
   pse.js – globale Konstanten & Helfer, Elementdaten 1–118,
   Periodensystem als Canvas-Objekt, Bühne (STAGE), Statuszeile.
   Lädt als ERSTES.
   ===================================================================== */

const TAU = Math.PI * 2;
const BUB = 8; /* Radius einer Elektronen-Blase */
const PR_STEP = 6.5,
  PR_GAP = 12; /* Protonen-Packung im Kern */
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

/* ---------- Kategorien (warme Palette) ---------- */
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

/* ---------- Elemente: [Symbol, Name, Kat, EN, Schalen, Spalte, Zeile] ---------- */
const RAW = [
  ["H", "Wasserstoff", "nm", 2.2, "1", 1, 1],
  ["He", "Helium", "eg", 0, "2", 18, 1],
  ["Li", "Lithium", "ak", 0.98, "2-1", 1, 2],
  ["Be", "Beryllium", "ea", 1.57, "2-2", 2, 2],
  ["B", "Bor", "hm", 2.04, "2-3", 13, 2],
  ["C", "Kohlenstoff", "nm", 2.55, "2-4", 14, 2],
  ["N", "Stickstoff", "nm", 3.04, "2-5", 15, 2],
  ["O", "Sauerstoff", "nm", 3.44, "2-6", 16, 2],
  ["F", "Fluor", "hg", 3.98, "2-7", 17, 2],
  ["Ne", "Neon", "eg", 0, "2-8", 18, 2],
  ["Na", "Natrium", "ak", 0.93, "2-8-1", 1, 3],
  ["Mg", "Magnesium", "ea", 1.31, "2-8-2", 2, 3],
  ["Al", "Aluminium", "me", 1.61, "2-8-3", 13, 3],
  ["Si", "Silizium", "hm", 1.9, "2-8-4", 14, 3],
  ["P", "Phosphor", "nm", 2.19, "2-8-5", 15, 3],
  ["S", "Schwefel", "nm", 2.58, "2-8-6", 16, 3],
  ["Cl", "Chlor", "hg", 3.16, "2-8-7", 17, 3],
  ["Ar", "Argon", "eg", 0, "2-8-8", 18, 3],
  ["K", "Kalium", "ak", 0.82, "2-8-8-1", 1, 4],
  ["Ca", "Calcium", "ea", 1.0, "2-8-8-2", 2, 4],
  ["Sc", "Scandium", "ue", 1.36, "2-8-9-2", 3, 4],
  ["Ti", "Titan", "ue", 1.54, "2-8-10-2", 4, 4],
  ["V", "Vanadium", "ue", 1.63, "2-8-11-2", 5, 4],
  ["Cr", "Chrom", "ue", 1.66, "2-8-13-1", 6, 4],
  ["Mn", "Mangan", "ue", 1.55, "2-8-13-2", 7, 4],
  ["Fe", "Eisen", "ue", 1.83, "2-8-14-2", 8, 4],
  ["Co", "Cobalt", "ue", 1.88, "2-8-15-2", 9, 4],
  ["Ni", "Nickel", "ue", 1.91, "2-8-16-2", 10, 4],
  ["Cu", "Kupfer", "ue", 1.9, "2-8-18-1", 11, 4],
  ["Zn", "Zink", "ue", 1.65, "2-8-18-2", 12, 4],
  ["Ga", "Gallium", "me", 1.81, "2-8-18-3", 13, 4],
  ["Ge", "Germanium", "hm", 2.01, "2-8-18-4", 14, 4],
  ["As", "Arsen", "hm", 2.18, "2-8-18-5", 15, 4],
  ["Se", "Selen", "nm", 2.55, "2-8-18-6", 16, 4],
  ["Br", "Brom", "hg", 2.96, "2-8-18-7", 17, 4],
  ["Kr", "Krypton", "eg", 3.0, "2-8-18-8", 18, 4],
  ["Rb", "Rubidium", "ak", 0.82, "2-8-18-8-1", 1, 5],
  ["Sr", "Strontium", "ea", 0.95, "2-8-18-8-2", 2, 5],
  ["Y", "Yttrium", "ue", 1.22, "2-8-18-9-2", 3, 5],
  ["Zr", "Zirconium", "ue", 1.33, "2-8-18-10-2", 4, 5],
  ["Nb", "Niob", "ue", 1.6, "2-8-18-12-1", 5, 5],
  ["Mo", "Molybdän", "ue", 2.16, "2-8-18-13-1", 6, 5],
  ["Tc", "Technetium", "ue", 1.9, "2-8-18-13-2", 7, 5],
  ["Ru", "Ruthenium", "ue", 2.2, "2-8-18-15-1", 8, 5],
  ["Rh", "Rhodium", "ue", 2.28, "2-8-18-16-1", 9, 5],
  ["Pd", "Palladium", "ue", 2.2, "2-8-18-18", 10, 5],
  ["Ag", "Silber", "ue", 1.93, "2-8-18-18-1", 11, 5],
  ["Cd", "Cadmium", "ue", 1.69, "2-8-18-18-2", 12, 5],
  ["In", "Indium", "me", 1.78, "2-8-18-18-3", 13, 5],
  ["Sn", "Zinn", "me", 1.96, "2-8-18-18-4", 14, 5],
  ["Sb", "Antimon", "hm", 2.05, "2-8-18-18-5", 15, 5],
  ["Te", "Tellur", "hm", 2.1, "2-8-18-18-6", 16, 5],
  ["I", "Iod", "hg", 2.66, "2-8-18-18-7", 17, 5],
  ["Xe", "Xenon", "eg", 2.6, "2-8-18-18-8", 18, 5],
  ["Cs", "Caesium", "ak", 0.79, "2-8-18-18-8-1", 1, 6],
  ["Ba", "Barium", "ea", 0.89, "2-8-18-18-8-2", 2, 6],
  ["La", "Lanthan", "la", 1.1, "2-8-18-18-9-2", 3, 8],
  ["Ce", "Cer", "la", 1.12, "2-8-18-19-9-2", 4, 8],
  ["Pr", "Praseodym", "la", 1.13, "2-8-18-21-8-2", 5, 8],
  ["Nd", "Neodym", "la", 1.14, "2-8-18-22-8-2", 6, 8],
  ["Pm", "Promethium", "la", 1.13, "2-8-18-23-8-2", 7, 8],
  ["Sm", "Samarium", "la", 1.17, "2-8-18-24-8-2", 8, 8],
  ["Eu", "Europium", "la", 1.2, "2-8-18-25-8-2", 9, 8],
  ["Gd", "Gadolinium", "la", 1.2, "2-8-18-25-9-2", 10, 8],
  ["Tb", "Terbium", "la", 1.2, "2-8-18-27-8-2", 11, 8],
  ["Dy", "Dysprosium", "la", 1.22, "2-8-18-28-8-2", 12, 8],
  ["Ho", "Holmium", "la", 1.23, "2-8-18-29-8-2", 13, 8],
  ["Er", "Erbium", "la", 1.24, "2-8-18-30-8-2", 14, 8],
  ["Tm", "Thulium", "la", 1.25, "2-8-18-31-8-2", 15, 8],
  ["Yb", "Ytterbium", "la", 1.1, "2-8-18-32-8-2", 16, 8],
  ["Lu", "Lutetium", "la", 1.27, "2-8-18-32-9-2", 17, 8],
  ["Hf", "Hafnium", "ue", 1.3, "2-8-18-32-10-2", 4, 6],
  ["Ta", "Tantal", "ue", 1.5, "2-8-18-32-11-2", 5, 6],
  ["W", "Wolfram", "ue", 2.36, "2-8-18-32-12-2", 6, 6],
  ["Re", "Rhenium", "ue", 1.9, "2-8-18-32-13-2", 7, 6],
  ["Os", "Osmium", "ue", 2.2, "2-8-18-32-14-2", 8, 6],
  ["Ir", "Iridium", "ue", 2.2, "2-8-18-32-15-2", 9, 6],
  ["Pt", "Platin", "ue", 2.28, "2-8-18-32-17-1", 10, 6],
  ["Au", "Gold", "ue", 2.54, "2-8-18-32-18-1", 11, 6],
  ["Hg", "Quecksilber", "ue", 2.0, "2-8-18-32-18-2", 12, 6],
  ["Tl", "Thallium", "me", 1.62, "2-8-18-32-18-3", 13, 6],
  ["Pb", "Blei", "me", 2.33, "2-8-18-32-18-4", 14, 6],
  ["Bi", "Bismut", "me", 2.02, "2-8-18-32-18-5", 15, 6],
  ["Po", "Polonium", "me", 2.0, "2-8-18-32-18-6", 16, 6],
  ["At", "Astat", "hg", 2.2, "2-8-18-32-18-7", 17, 6],
  ["Rn", "Radon", "eg", 2.2, "2-8-18-32-18-8", 18, 6],
  ["Fr", "Francium", "ak", 0.7, "2-8-18-32-18-8-1", 1, 7],
  ["Ra", "Radium", "ea", 0.9, "2-8-18-32-18-8-2", 2, 7],
  ["Ac", "Actinium", "ac", 1.1, "2-8-18-32-18-9-2", 3, 9],
  ["Th", "Thorium", "ac", 1.3, "2-8-18-32-18-10-2", 4, 9],
  ["Pa", "Protactinium", "ac", 1.5, "2-8-18-32-20-9-2", 5, 9],
  ["U", "Uran", "ac", 1.38, "2-8-18-32-21-9-2", 6, 9],
  ["Np", "Neptunium", "ac", 1.36, "2-8-18-32-22-9-2", 7, 9],
  ["Pu", "Plutonium", "ac", 1.28, "2-8-18-32-24-8-2", 8, 9],
  ["Am", "Americium", "ac", 1.13, "2-8-18-32-25-8-2", 9, 9],
  ["Cm", "Curium", "ac", 1.28, "2-8-18-32-25-9-2", 10, 9],
  ["Bk", "Berkelium", "ac", 1.3, "2-8-18-32-27-8-2", 11, 9],
  ["Cf", "Californium", "ac", 1.3, "2-8-18-32-28-8-2", 12, 9],
  ["Es", "Einsteinium", "ac", 1.3, "2-8-18-32-29-8-2", 13, 9],
  ["Fm", "Fermium", "ac", 1.3, "2-8-18-32-30-8-2", 14, 9],
  ["Md", "Mendelevium", "ac", 1.3, "2-8-18-32-31-8-2", 15, 9],
  ["No", "Nobelium", "ac", 1.3, "2-8-18-32-32-8-2", 16, 9],
  ["Lr", "Lawrencium", "ac", 1.3, "2-8-18-32-32-8-3", 17, 9],
  ["Rf", "Rutherfordium", "ue", 0, "2-8-18-32-32-10-2", 4, 7],
  ["Db", "Dubnium", "ue", 0, "2-8-18-32-32-11-2", 5, 7],
  ["Sg", "Seaborgium", "ue", 0, "2-8-18-32-32-12-2", 6, 7],
  ["Bh", "Bohrium", "ue", 0, "2-8-18-32-32-13-2", 7, 7],
  ["Hs", "Hassium", "ue", 0, "2-8-18-32-32-14-2", 8, 7],
  ["Mt", "Meitnerium", "ue", 0, "2-8-18-32-32-15-2", 9, 7],
  ["Ds", "Darmstadtium", "ue", 0, "2-8-18-32-32-16-2", 10, 7],
  ["Rg", "Röntgenium", "ue", 0, "2-8-18-32-32-17-2", 11, 7],
  ["Cn", "Copernicium", "ue", 0, "2-8-18-32-32-18-2", 12, 7],
  ["Nh", "Nihonium", "me", 0, "2-8-18-32-32-18-3", 13, 7],
  ["Fl", "Flerovium", "me", 0, "2-8-18-32-32-18-4", 14, 7],
  ["Mc", "Moscovium", "me", 0, "2-8-18-32-32-18-5", 15, 7],
  ["Lv", "Livermorium", "me", 0, "2-8-18-32-32-18-6", 16, 7],
  ["Ts", "Tenness", "hg", 0, "2-8-18-32-32-18-7", 17, 7],
  ["Og", "Oganesson", "eg", 0, "2-8-18-32-32-18-8", 18, 7],
];

const ELEMENTS = RAW.map(function (r, i) {
  const z = i + 1,
    col = r[5],
    row = r[6];
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
    shells: r[4].split("-").map(Number),
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

/* ---------- Bühne (rechts vom PSE, im Weltkoordinatensystem) ---------- */
const STAGE = { x: 1560, y: 300, hw: 660, hh: 350 };

/* ---------- Periodensystem-Geometrie ---------- */
const PZ = { ox: 36, oy: 96, pitch: 48, cell: 44, fPad: 28, cells: [] };
const PSE = { w: 0, h: 0, hover: null };
const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII"];

(function pseBuildCells() {
  let maxX = 0,
    maxY = 0;
  ELEMENTS.forEach(function (el) {
    const x = PZ.ox + (el.col - 1) * PZ.pitch;
    const y = PZ.oy + (el.row - 1) * PZ.pitch + (el.row >= 8 ? PZ.fPad : 0);
    PZ.cells.push({ x: x, y: y, z: el.z });
    maxX = Math.max(maxX, x + PZ.cell);
    maxY = Math.max(maxY, y + PZ.cell);
  });
  PSE.w = maxX + 24;
  PSE.h = maxY + 16;
})();

function pseHit(wx, wy) {
  for (let i = 0; i < PZ.cells.length; i++) {
    const c = PZ.cells[i];
    if (wx >= c.x && wx <= c.x + PZ.cell && wy >= c.y && wy <= c.y + PZ.cell) return c.z;
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

function drawPSE(ctx) {
  const dark = typeof darkBg !== "undefined" ? darkBg : true;
  const ink = dark ? "233,228,216" : "38,37,31";
  const g = PZ;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.fillStyle = "rgba(" + ink + ",.6)";
  ctx.font = "700 13px 'Space Grotesk',sans-serif";
  ctx.fillText("PERIODENSYSTEM", g.ox + (18 * g.pitch) / 2, g.oy - 66);

  for (let c = 1; c <= 18; c++) {
    const x = g.ox + (c - 1) * g.pitch + g.cell / 2;
    ctx.fillStyle = "rgba(" + ink + ",.62)";
    ctx.font = "600 9px 'IBM Plex Mono',monospace";
    ctx.fillText(ROMAN[c], x, g.oy - 27);
    ctx.fillStyle = "rgba(" + ink + ",.3)";
    ctx.font = "400 8px 'IBM Plex Mono',monospace";
    ctx.fillText("(" + c + ")", x, g.oy - 16);
  }
  for (let r = 1; r <= 7; r++) {
    ctx.fillStyle = "rgba(" + ink + ",.55)";
    ctx.font = "600 10px 'IBM Plex Mono',monospace";
    ctx.textAlign = "right";
    ctx.fillText(String(r), g.ox - 10, g.oy + (r - 1) * g.pitch + g.cell / 2);
    ctx.textAlign = "center";
  }

  /* f-Block-Platzhalter + Beschriftung */
  [
    [6, "57–71", "la"],
    [7, "89–103", "ac"],
  ].forEach(function (pl) {
    const x = g.ox + 2 * g.pitch,
      y = g.oy + (pl[0] - 1) * g.pitch;
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = hexA(CATS[pl[2]].c, 0.55);
    ctx.lineWidth = 1;
    pseRound(ctx, x, y, g.cell, g.cell, 5);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = hexA(CATS[pl[2]].c, 0.8);
    ctx.font = "600 8.5px 'IBM Plex Mono',monospace";
    ctx.fillText(pl[1], x + g.cell / 2, y + g.cell / 2);
    ctx.textAlign = "left";
    ctx.fillText(pl[2] === "la" ? "Lanthanoide" : "Actinoide", g.ox + 2 * g.pitch, y - 9);
    ctx.textAlign = "center";
  });

  /* Elementzellen */
  for (let i = 0; i < g.cells.length; i++) {
    const c = g.cells[i],
      el = ELBYZ[c.z];
    const hov = PSE.hover === c.z;
    const col = CATS[el.cat].c;
    ctx.fillStyle = hexA(col, hov ? 0.34 : 0.13);
    pseRound(ctx, c.x, c.y, g.cell, g.cell, 5);
    ctx.fill();
    ctx.strokeStyle = hexA(col, hov ? 1 : 0.72);
    ctx.lineWidth = hov ? 1.8 : 1;
    ctx.stroke();
    ctx.fillStyle = hov ? "#ffffff" : col;
    ctx.font = "700 13px 'IBM Plex Mono',monospace";
    ctx.fillText(el.sym, c.x + g.cell / 2 + 1, c.y + g.cell / 2 + 3);
    ctx.fillStyle = "rgba(" + ink + ",.4)";
    ctx.font = "400 7.5px 'IBM Plex Mono',monospace";
    ctx.textAlign = "left";
    ctx.fillText(String(el.z), c.x + 4, c.y + 8);
    ctx.textAlign = "center";
  }

  /* Tooltip-Karte neben der gehoverten Zelle */
  if (PSE.hover && ELBYZ[PSE.hover]) {
    const el = ELBYZ[PSE.hover];
    let cell = null;
    for (let i = 0; i < g.cells.length; i++)
      if (g.cells[i].z === el.z) {
        cell = g.cells[i];
        break;
      }
    if (cell) {
      const w = 212,
        h = 108;
      let x = cell.x + g.cell + 12;
      if (x + w > PSE.w) x = cell.x - w - 12;
      let y = clamp(cell.y - 8, 8, PSE.h - h - 8);
      ctx.fillStyle = dark ? "rgba(18,22,27,.95)" : "rgba(250,249,244,.97)";
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
      ctx.fillText("Schalen       " + el.shells.join(" · "), x + 13, y + 92);
      ctx.textAlign = "center";
    }
  }
}

/* ---------- Statuszeile (wird von modell.js gerufen) ---------- */
function refreshCounts() {
  const el = document.getElementById("statusBar");
  if (!el) return;
  let e = 0;
  for (const a of atoms) e += a.electrons.length;
  el.textContent = atoms.length + " Atome · " + bonds.length + " Bindungen · " + e + " Elektronen";
}
