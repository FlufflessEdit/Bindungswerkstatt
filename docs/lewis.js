"use strict";
/* =====================================================================
   lewis.js – lewisStructure(Formel) →
   { atoms:[{id,element}], bonds:[{from,to,order}], lp:{}, single:{},
     positions:{id:[x,y]}, ladungen:{}, ionisch?:true }
   Kuratierte Schulstrukturen + generische Bausteine (Diatom, CnHm-Kette,
   Zentralatom-Stern) + binäre Ionenverbindungen inkl. Nebengruppen-
   metallen (Fe₂O₃, CuO, TiO₂ …) mit Ladung aus der Stöchiometrie.
   Jede Struktur wird gegen Elektronenbilanz und Ladungssumme geprüft.
   ===================================================================== */

const Lewis = (function () {
  const SUBS = "₀₁₂₃₄₅₆₇₈₉";
  const SUPS = "⁰¹²³⁴⁵⁶⁷⁸⁹";

  function normalize(s) {
    if (typeof s !== "string") return "";
    const t = s.replace(/[·×\s()[\]{}]/g, "").replace(/[−–—]/g, "-");
    let r = "",
      i = 0;
    while (i < t.length) {
      const ch = t[i];
      if (SUBS.indexOf(ch) >= 0) {
        r += String(SUBS.indexOf(ch));
        i++;
        continue;
      }
      if (SUPS.indexOf(ch) >= 0 || ch === "⁺" || ch === "⁻") {
        let d = "",
          sign = "";
        while (i < t.length) {
          const c = t[i],
            di = SUPS.indexOf(c);
          if (di >= 0) {
            d += String(di);
            i++;
          } else if (c === "⁺") {
            sign = "+";
            i++;
          } else if (c === "⁻") {
            sign = "-";
            i++;
          } else break;
        }
        r += "^" + d + sign;
        continue;
      }
      r += ch;
      i++;
    }
    return r;
  }

  function parse(input) {
    const r = normalize(input);
    if (!r) return null;
    let core = r,
      charge = 0,
      m = null;
    if ((m = r.match(/\^(\d*)([+-])$/)) !== null) {
      charge = (m[1] === "" ? 1 : parseInt(m[1], 10)) * (m[2] === "+" ? 1 : -1);
      core = r.slice(0, m.index);
    } else if ((m = r.match(/([+-])\1$/)) !== null) {
      charge = 2 * (m[1] === "+" ? 1 : -1);
      core = r.slice(0, m.index);
    } else if ((m = r.match(/^(.*?[A-Za-z])(\d+)([+-])$/)) !== null) {
      if (m[2].length > 1) {
        charge = parseInt(m[2].slice(-1), 10) * (m[3] === "+" ? 1 : -1);
        core = m[1] + m[2].slice(0, -1);
      } else {
        charge = m[3] === "+" ? 1 : -1;
        core = m[1] + m[2];
      }
    } else if ((m = r.match(/^(.+?)([+-])$/)) !== null) {
      charge = m[2] === "+" ? 1 : -1;
      core = m[1];
    }
    const parts = [];
    const re = /([A-Z][a-z]?)(\d*)/g;
    let pos = 0,
      t = null;
    while ((t = re.exec(core)) !== null) {
      if (t.index !== pos) return null;
      if (!ELBYSYM[t[1]]) return null;
      const c = t[2] === "" ? 1 : parseInt(t[2], 10);
      if (c < 1 || c > 40) return null;
      parts.push({ sym: t[1], count: c });
      pos += t[0].length;
    }
    if (pos !== core.length || parts.length === 0 || parts.length > 6) return null;
    return { parts: parts, charge: charge };
  }

  const veOf = (sym) => (ELBYSYM[sym] ? ELBYSYM[sym].ve : 0);
  const perOf = (sym) => (ELBYSYM[sym] ? ELBYSYM[sym].per : 2);
  const need = (sym) => (sym === "H" || sym === "He" ? 2 : 8);
  const gcd = (a, b) => {
    while (b > 0) {
      const h = a % b;
      a = b;
      b = h;
    }
    return a;
  };

  /* ---------- Fehlerkanal: build() liefert null, Grund steht hier ---------- */
  let lastError = null;
  const fail = (msg) => {
    lastError = msg;
    return null;
  };

  /* Übliche Kationen-Ladungen (Schulstoff). Die Stöchiometrie hat Vorrang;
     nicht gelistete Nebengruppen-Metalle sind mit 1–7 erlaubt. */
  const KAT_LADUNGEN = {
    Fe: [2, 3],
    Co: [2, 3],
    Ni: [2, 3],
    Cu: [1, 2],
    Zn: [2],
    Ag: [1],
    Au: [1, 3],
    Cd: [2],
    Hg: [1, 2],
    Sn: [2, 4],
    Pb: [2, 4],
    Bi: [3],
    Al: [3],
    Ga: [3],
    In: [3],
    Tl: [1, 3],
    Ti: [2, 3, 4],
    V: [2, 3, 4, 5],
    Cr: [2, 3, 6],
    Mn: [2, 3, 4, 6, 7],
    Mo: [4, 6],
    W: [4, 6],
    Nb: [5],
    Ta: [5],
    Zr: [4],
    Hf: [4],
    Sc: [3],
    Y: [3],
    La: [3],
    Ce: [3, 4],
    U: [4, 6],
    Pt: [2, 4],
    Pd: [2],
  };

  /* ---- kuratierte Strukturen (Atome in Eingabe-Reihenfolge, id = Index) ---- */
  const KNOWN = {
    "H2O|0": {
      root: 2,
      b: [
        [0, 2, 1],
        [1, 2, 1],
      ],
    },
    "CO2|0": {
      root: 0,
      b: [
        [0, 1, 2],
        [0, 2, 2],
      ],
    },
    "NH3|0": {
      root: 0,
      b: [
        [0, 1, 1],
        [0, 2, 1],
        [0, 3, 1],
      ],
    },
    "CH4|0": {
      root: 0,
      b: [
        [0, 1, 1],
        [0, 2, 1],
        [0, 3, 1],
        [0, 4, 1],
      ],
    },
    "SO4|-2": {
      root: 0,
      b: [
        [0, 1, 2],
        [0, 2, 2],
        [0, 3, 1],
        [0, 4, 1],
      ],
    },
    "NH4|1": {
      root: 0,
      b: [
        [0, 1, 1],
        [0, 2, 1],
        [0, 3, 1],
        [0, 4, 1],
      ],
    },
    "BF3|0": {
      root: 0,
      b: [
        [0, 1, 1],
        [0, 2, 1],
        [0, 3, 1],
      ],
      lp: { 0: 0 },
    },
    "SF6|0": {
      root: 0,
      b: [
        [0, 1, 1],
        [0, 2, 1],
        [0, 3, 1],
        [0, 4, 1],
        [0, 5, 1],
        [0, 6, 1],
      ],
    },
    "NO2|0": {
      root: 0,
      b: [
        [0, 1, 2],
        [0, 2, 1],
      ],
      si: 1,
    },
    "NO3|-1": {
      root: 0,
      b: [
        [0, 1, 2],
        [0, 2, 1],
        [0, 3, 1],
      ],
    },
    "PO4|-3": {
      root: 0,
      b: [
        [0, 1, 2],
        [0, 2, 1],
        [0, 3, 1],
        [0, 4, 1],
      ],
    },
    "ClO4|-1": {
      root: 0,
      b: [
        [0, 1, 2],
        [0, 2, 2],
        [0, 3, 2],
        [0, 4, 1],
      ],
    },
    "CO3|-2": {
      root: 0,
      b: [
        [0, 1, 2],
        [0, 2, 1],
        [0, 3, 1],
      ],
    },
    "OH|-1": { root: 0, b: [[0, 1, 1]] },
    "H3O|1": {
      root: 3,
      b: [
        [0, 3, 1],
        [1, 3, 1],
        [2, 3, 1],
      ],
    },
    "O3|0": {
      root: 1,
      k: [0, 1, 2],
      b: [
        [0, 1, 2],
        [1, 2, 1],
      ],
    },
    "O2|0": { root: 0, k: [0, 1], b: [[0, 1, 2]] },
    "N2|0": { root: 0, k: [0, 1], b: [[0, 1, 3]] },
    "H2|0": { root: 0, k: [0, 1], b: [[0, 1, 1]] },
    "H2O2|0": {
      root: 2,
      b: [
        [0, 2, 1],
        [1, 3, 1],
        [2, 3, 1],
      ],
    },
    "N2H4|0": {
      root: 0,
      b: [
        [0, 1, 1],
        [0, 2, 1],
        [0, 3, 1],
        [1, 4, 1],
        [1, 5, 1],
      ],
    },
    "HCN|0": {
      root: 1,
      b: [
        [0, 1, 1],
        [1, 2, 3],
      ],
    },
    "CH3OH|0": {
      root: 0,
      b: [
        [0, 4, 1],
        [0, 1, 1],
        [0, 2, 1],
        [0, 3, 1],
        [4, 5, 1],
      ],
    },
    "H2SO4|0": {
      root: 2,
      b: [
        [2, 3, 2],
        [2, 4, 2],
        [2, 5, 1],
        [2, 6, 1],
        [0, 5, 1],
        [1, 6, 1],
      ],
    },
    "HNO3|0": {
      root: 1,
      b: [
        [1, 2, 2],
        [1, 3, 1],
        [1, 4, 1],
        [0, 4, 1],
      ],
    },
    "H3PO4|0": {
      root: 3,
      b: [
        [3, 4, 2],
        [3, 5, 1],
        [3, 6, 1],
        [3, 7, 1],
        [0, 5, 1],
        [1, 6, 1],
        [2, 7, 1],
      ],
    },
    "HCOOH|0": {
      root: 1,
      b: [
        [1, 2, 2],
        [1, 3, 1],
        [3, 4, 1],
        [1, 0, 1],
      ],
    },
    "CH2O2|0": {
      root: 0,
      b: [
        [0, 3, 2],
        [0, 4, 1],
        [4, 1, 1],
        [0, 2, 1],
      ],
    },
    "H2CO3|0": {
      root: 2,
      b: [
        [2, 3, 2],
        [2, 4, 1],
        [2, 5, 1],
        [4, 0, 1],
        [5, 1, 1],
      ],
    },
  };

  function ordMap(bonds, n) {
    const o = new Array(n).fill(0);
    bonds.forEach((b) => {
      o[b.from] += b.order;
      o[b.to] += b.order;
    });
    return o;
  }

  function deriveLP(atoms, bonds, single) {
    const o = ordMap(bonds, atoms.length);
    const lp = {};
    atoms.forEach((a) => {
      lp[a.id] = Math.max(0, Math.floor((need(a.element) - 2 * o[a.id] - (single[a.id] || 0)) / 2));
    });
    return lp;
  }

  function validate(atoms, bonds, lp, single, total, charge) {
    let e = 0,
      fcs = 0;
    const o = ordMap(bonds, atoms.length);
    bonds.forEach((b) => {
      e += 2 * b.order;
    });
    atoms.forEach((a) => {
      e += 2 * (lp[a.id] || 0) + (single[a.id] || 0);
      fcs += veOf(a.element) - 2 * (lp[a.id] || 0) - (single[a.id] || 0) - o[a.id];
    });
    return e === total && fcs === charge;
  }

  function fromKnown(k, atoms) {
    const bonds = k.b.map((x) => ({ from: x[0], to: x[1], order: x[2] }));
    const single = {};
    atoms.forEach((a) => {
      single[a.id] = a.id === k.root ? k.si || 0 : 0;
    });
    const lp = deriveLP(atoms, bonds, single);
    if (k.lp)
      Object.keys(k.lp).forEach((id) => {
        lp[+id] = k.lp[id];
      });
    return { atoms: atoms, bonds: bonds, lp: lp, single: single, root: k.root, kette: k.k || null };
  }

  /* ---- Diatom X₂: Ordnung aus der Oktettregel (F₂→1, O₂→2, N₂→3) ---- */
  function diatom(atoms, total, charge) {
    const nX = need(atoms[0].element);
    const o = nX - total / 2;
    const lpEach = (total / 2 - o) / 2;
    if (o < 1 || o > 3 || lpEach < 0 || lpEach !== Math.floor(lpEach)) return null;
    if (veOf(atoms[0].element) - 2 * lpEach - o !== 0) return null;
    const bonds = [{ from: 0, to: 1, order: o }];
    const lp = { 0: lpEach, 1: lpEach },
      single = { 0: 0, 1: 0 };
    if (!validate(atoms, bonds, lp, single, total, charge)) return null;
    return { atoms: atoms, bonds: bonds, lp: lp, single: single, root: 0, kette: [0, 1] };
  }

  /* ---- Kette ODER Ring aus identischen Schweratomen ----
     C₂H₄ → Kette · C₆H₆ → Benzol-Ring (alternierend) · S₈ → Ring.
     Doppelbindungen werden möglichst alternierend verteilt (keine Kumulene);
     gewinnt die Variante mit den wenigsten benachbarten Mehrfachbindungen. */
  function spreadDoubles(len, extra) {
    const pos = new Set();
    if (extra <= 0) return pos;
    if (extra >= len) {
      for (let i = 0; i < len; i++) pos.add(i);
      return pos;
    }
    const gap = len / extra;
    for (let j = 0; j < extra; j++) pos.add(Math.floor(j * gap + gap / 2));
    return pos;
  }
  function adjacentPen(bonds, cyclic) {
    let pen = 0;
    for (let i = 0; i < bonds.length - 1; i++) {
      if (bonds[i].order >= 2 && bonds[i + 1].order >= 2) pen++;
    }
    if (cyclic && bonds.length > 2 && bonds[bonds.length - 1].order >= 2 && bonds[0].order >= 2) pen++;
    return pen;
  }
  function attachH(group, bonds, hs) {
    const cap = group.map((g) => {
      let s = 0;
      bonds.forEach((b) => {
        if (b.from === g.id || b.to === g.id) s += b.order;
      });
      return Math.floor(need(g.element) / 2) - s;
    });
    const rest = hs.slice();
    let runde = 0;
    while (rest.length && runde++ < 40) {
      let gab = false;
      for (let i = 0; i < group.length && rest.length; i++) {
        if (cap[i] > 0) {
          bonds.push({ from: group[i].id, to: rest.shift().id, order: 1 });
          cap[i]--;
          gab = true;
        }
      }
      if (!gab) break;
    }
    return rest.length === 0;
  }
  function chainOrRing(atoms, group, hs, total, charge) {
    const n = group.length;
    const B = (8 * n - total) / 2;
    if (B !== Math.floor(B)) return null;
    const cands = [];
    if (B >= n - 1 && B <= 3 * (n - 1)) {
      const base = Math.floor(B / (n - 1)),
        extra = B - base * (n - 1);
      const dbl = spreadDoubles(n - 1, extra);
      const bonds = [];
      for (let i = 0; i < n - 1; i++) bonds.push({ from: group[i].id, to: group[i + 1].id, order: base + (dbl.has(i) ? 1 : 0) });
      cands.push({ bonds: bonds, ring: false, pen: adjacentPen(bonds, false) });
    }
    if (n >= 3 && B >= n && B <= 3 * n) {
      const base = Math.floor(B / n),
        extra = B - base * n;
      const dbl = spreadDoubles(n, extra);
      const bonds = [];
      for (let i = 0; i < n; i++) bonds.push({ from: group[i].id, to: group[(i + 1) % n].id, order: base + (dbl.has(i) ? 1 : 0) });
      cands.push({ bonds: bonds, ring: true, pen: adjacentPen(bonds, true) });
    }
    let best = null;
    for (const c of cands) {
      const bonds = c.bonds.map((b) => ({ from: b.from, to: b.to, order: b.order }));
      if (!attachH(group, bonds, hs)) continue;
      const single = {};
      atoms.forEach((a) => {
        single[a.id] = 0;
      });
      const lp = deriveLP(atoms, bonds, single);
      if (!validate(atoms, bonds, lp, single, total, charge)) continue;
      let pen = c.pen;
      if (c.ring && hs.length === 0 && B === n) pen -= 0.5; /* H-lose, gesättigte Ringe (S₈) sind die Naturform */
      if (!best || pen < best.pen) best = { pen: pen, bonds: bonds, lp: lp, single: single, ring: c.ring };
    }
    if (!best) return null;
    return { atoms: atoms, bonds: best.bonds, lp: best.lp, single: best.single, root: group[0].id, kette: group.map((g) => g.id), ring: best.ring };
  }

  /* ---- Zentralatom-Stern mit Formalladungs-Minimierung ---- */
  function stern(atoms, parts, total, charge) {
    const cnt = {};
    parts.forEach((p) => {
      if (p.sym !== "H") cnt[p.sym] = (cnt[p.sym] || 0) + p.count;
    });
    const cands = Object.keys(cnt).filter((s) => cnt[s] === 1);
    if (!cands.length) return null;
    cands.sort((x, y) => ELBYSYM[x].en - ELBYSYM[y].en);
    const root = atoms.find((a) => a.element === cands[0]).id;
    const bonds = [];
    atoms.forEach((a) => {
      if (a.id !== root) bonds.push({ from: root, to: a.id, order: 1 });
    });

    const lp = {},
      single = {};
    atoms.forEach((a) => {
      lp[a.id] = 0;
      single[a.id] = 0;
    });
    let rest = total - 2 * bonds.length;
    const leaves = atoms.filter((a) => a.id !== root).sort((x, y) => (x.element === "H" ? 1 : 0) - (y.element === "H" ? 1 : 0));
    leaves.forEach((a) => {
      const want = Math.max(0, Math.floor((need(a.element) - 2) / 2));
      const get = Math.min(want, Math.floor(rest / 2));
      lp[a.id] = get;
      rest -= 2 * get;
    });
    if (rest === 1) {
      single[root] = 1;
      rest = 0;
    }
    if (rest < 0 || rest % 2 !== 0) return null;
    lp[root] = rest / 2;

    const os = (id) => {
      let s = 0;
      bonds.forEach((b) => {
        if (b.from === id || b.to === id) s += b.order;
      });
      return s;
    };
    const fc = (id) => veOf(atoms[id].element) - 2 * lp[id] - single[id] - os(id);
    const score = () => {
      let s = 0;
      atoms.forEach((a) => {
        s += 2 * Math.abs(fc(a.id));
        if (perOf(a.element) <= 2) s += 0.5 * Math.max(0, need(a.element) - 2 * lp[a.id] - single[a.id] - 2 * os(a.id));
      });
      return s;
    };
    let guard = 0,
      go = true;
    while (go && guard++ < 12) {
      go = false;
      let bestS = score(),
        bestB = -1,
        bestSrc = -1;
      bonds.forEach((b, bi) => {
        if (b.order >= 3) return;
        if (b.from !== root && b.to !== root) return;
        const y = b.to === root ? b.from : b.to;
        const sources = [];
        if (lp[y] > 0) sources.push(y);
        if (lp[root] > 0) sources.push(root);
        sources.forEach((src) => {
          b.order++;
          lp[src]--;
          let ok = true;
          if (perOf(atoms[root].element) <= 2 && 2 * os(root) + 2 * lp[root] + single[root] > 8) ok = false;
          const s = ok ? score() : Infinity;
          b.order--;
          lp[src]++;
          if (s < bestS - 1e-9) {
            bestS = s;
            bestB = bi;
            bestSrc = src;
          }
        });
      });
      if (bestB >= 0) {
        bonds[bestB].order++;
        lp[bestSrc]--;
        go = true;
      }
    }
    if (!validate(atoms, bonds, lp, single, total, charge)) return null;
    return { atoms: atoms, bonds: bonds, lp: lp, single: single, root: root, kette: null };
  }

  /* ---- Ionische Verbindung: Metall-Ladung aus der Stöchiometrie ----
     m·kQ + n·aQ = 0. Anion: H → 1−, sonst 8−ve (O 2−, Cl 1−, N 3− …).
     Auch Nebengruppen-Metalle (Fe₂O₃, CuO, TiO₂ …). */
  function ionicBuild(p) {
    if (p.parts.length !== 2 || p.charge !== 0) return null;
    const A = p.parts[0],
      B = p.parts[1];
    const eA = ELBYSYM[A.sym],
      eB = ELBYSYM[B.sym];
    const metA = METALS.has(eA.cat),
      metB = METALS.has(eB.cat);
    if (metA === metB) return null;
    const kat = metA ? A : B,
      an = metA ? B : A;
    const eK = ELBYSYM[kat.sym],
      eAn = ELBYSYM[an.sym];
    const formel = p.parts.map((x) => x.sym + (x.count > 1 ? x.count : "")).join("");

    let aQ;
    if (an.sym === "H") aQ = -1;
    else if (eAn.cat === "nm" || eAn.cat === "hg" || eAn.cat === "hm") {
      if (eAn.ve >= 5) aQ = -(8 - eAn.ve);
      else return fail("„" + formel + "“: " + an.sym + " bildet kein einfach geladenes Anion.");
    } else return null;

    const kQ = (-an.count * aQ) / kat.count;
    if (!Number.isInteger(kQ) || kQ < 1 || kQ > 7) {
      return fail("„" + formel + "“ passt nicht zu einheitlichen Ionenladungen (gemischte Oxidationsstufen wie in Fe₃O₄ werden nicht unterstützt).");
    }
    if (eK.cat === "ak" && kQ !== 1) return fail("„" + formel + "“: " + kat.sym + " bildet nur " + kat.sym + "⁺.");
    if (eK.cat === "ea" && kQ !== 2) return fail("„" + formel + "“: " + kat.sym + " bildet nur " + kat.sym + "²⁺.");
    const erlaubt = KAT_LADUNGEN[kat.sym];
    if (erlaubt && erlaubt.indexOf(kQ) < 0) {
      return fail("„" + formel + "“: " + kat.sym + " bildet üblicherweise " + erlaubt.map((q) => "+" + q).join(" / ") + ", nicht +" + kQ + ".");
    }

    const nK = kat.count,
      nA = an.count;
    if (nK + nA > 12) return fail("„" + formel + "“ hat zu viele Ionen (maximal 12).");

    /* Anordnung: Schachbrett-Wechsel auf dem Raster.
       Minderheits-Ionen belegen die kleinere Paritätsklasse →
       Fe₂O₃ = O Fe O Fe O · MgCl₂ = Cl Mg Cl · Ca₃N₂ = Ca N Ca N Ca.
       Ein einzelnes Minderheits-Ion kommt in die Mitte (AlCl₃). */
    const total = nK + nA;
    const perRow = total <= 7 ? total : Math.min(5, Math.ceil(total / 2));
    const rows = Math.ceil(total / perRow);
    const cells = [];
    for (let i = 0; i < total; i++) {
      const col = i % perRow,
        row = Math.floor(i / perRow);
      cells.push({ col, row, par: (col + row) % 2 });
    }
    const nEven = cells.filter((c) => c.par === 0).length;
    const nOdd = total - nEven;
    const minKat = nK <= nA;
    const nMin = Math.min(nK, nA);
    const minS = minKat ? kat.sym : an.sym;
    const majS = minKat ? an.sym : kat.sym;
    const symOf = new Array(total).fill(majS);
    if (nMin === 1 && total >= 3) {
      symOf[Math.floor((total - 1) / 2)] = minS;
    } else if (Math.min(nEven, nOdd) >= nMin) {
      const minPar = nEven <= nOdd ? 0 : 1;
      let minLeft = nMin,
        majLeft = total - nMin;
      for (let i = 0; i < total; i++) {
        const c = cells[i];
        if (c.par === minPar && minLeft > 0) {
          symOf[i] = minS;
          minLeft--;
        } else if (c.par !== minPar && majLeft > 0) {
          majLeft--;
        } else if (minLeft > 0) {
          symOf[i] = minS;
          minLeft--;
        } else {
          majLeft--;
        }
      }
    } else {
      for (let i = 0; i < nMin; i++) symOf[i] = minS;
    }
    const atoms = symOf.map((s, i) => ({ id: i, element: s }));
    const ladungen = {};
    atoms.forEach((a) => {
      ladungen[a.id] = METALS.has(ELBYSYM[a.element].cat) ? kQ : aQ;
    });
    const positions = {};
    atoms.forEach((a, i) => {
      const c = cells[i];
      const inRow = Math.min(perRow, total - c.row * perRow);
      positions[a.id] = [(c.col - (inRow - 1) / 2) * 200, (c.row - (rows - 1) / 2) * 170];
    });
    return { atoms: atoms, bonds: [], lp: {}, single: {}, positions: positions, ladungen: ladungen, ionisch: true };
  }

  /* ---- Layout: 90°-bevorzugte Rasterpositionen ---- */
  function rootDirs(nb, no) {
    if (nb === 1) return no > 0 ? [90] : [270];
    if (nb === 2) return no >= 1 ? [45, 135] : [180, 0];
    if (nb === 3) return no >= 1 ? [90, 180, 270] : [90, 210, 330];
    if (nb === 4) return [180, 0, 90, 270];
    if (nb === 5) return [180, 0, 90, 270, 45];
    return [180, 0, 90, 270, 45, 135, 315, 225].slice(0, Math.max(nb, 6));
  }

  function layoutL(L) {
    const pos = {};
    const A = L.atoms;
    A.forEach((a) => {
      pos[a.id] = [0, 0];
    });
    const adj = {};
    L.bonds.forEach((b) => {
      (adj[b.from] = adj[b.from] || []).push(b.to);
      (adj[b.to] = adj[b.to] || []).push(b.from);
    });
    const RAD = Math.PI / 180;
    const step = (deg) => [Math.round(Math.cos(deg * RAD) * 6) * 20, Math.round(Math.sin(deg * RAD) * 6) * 20];
    const hLast = (x, y) => (A[x].element === "H" ? 1 : 0) - (A[y].element === "H" ? 1 : 0);
    if (L.ring && L.kette && L.kette.length >= 3) {
      const k = L.kette,
        n = k.length;
      const R = Math.round(140 / (2 * Math.sin(Math.PI / n)));
      k.forEach((id, i) => {
        const th = -Math.PI / 2 + (i * TAU) / n;
        pos[id] = [Math.round(Math.cos(th) * R), Math.round(Math.sin(th) * R)];
      });
      k.forEach((id) => {
        const kids = (adj[id] || []).filter((p) => k.indexOf(p) < 0).sort(hLast);
        const base = Math.atan2(pos[id][1], pos[id][0]);
        kids.forEach((pid, j) => {
          const th = base + (j - (kids.length - 1) / 2) * 0.7;
          pos[pid] = [pos[id][0] + Math.round(Math.cos(th) * 100), pos[id][1] + Math.round(Math.sin(th) * 100)];
        });
      });
      return pos;
    }
    if (L.kette && L.kette.length >= 2) {
      const k = L.kette,
        n = k.length;
      k.forEach((id, i) => {
        pos[id] = [(i - (n - 1) / 2) * 120, 0];
      });
      k.forEach((id, i) => {
        const kids = (adj[id] || []).filter((p) => k.indexOf(p) < 0).sort(hLast);
        const dirs = [90, 270];
        if (i === 0) dirs.push(180);
        if (i === n - 1) dirs.push(0);
        kids.forEach((pid, j) => {
          const d = dirs[j] !== undefined ? dirs[j] : (45 + j * 90) % 360;
          const o = step(d);
          pos[pid] = [pos[id][0] + o[0], pos[id][1] + o[1]];
        });
      });
      return pos;
    }

    const root = L.root;
    const seen = new Set([root]);
    const queue = [root];
    while (queue.length) {
      const id = queue.shift();
      const kids = (adj[id] || []).filter((p) => !seen.has(p)).sort(hLast);
      let dirs;
      if (id === root) {
        dirs = rootDirs(kids.length, (L.lp[root] || 0) + (L.single[root] || 0));
      } else {
        const par = (adj[id] || []).find((p) => seen.has(p));
        const pd = Math.atan2(pos[par][1] - pos[id][1], pos[par][0] - pos[id][0]) / RAD;
        dirs = [pd + 180, pd + 90, pd - 90, pd, pd + 45, pd - 45, pd + 135, pd - 135];
      }
      kids.forEach((pid, j) => {
        const o = step(dirs[j] !== undefined ? dirs[j] : 0);
        pos[pid] = [pos[id][0] + o[0], pos[id][1] + o[1]];
        seen.add(pid);
        queue.push(pid);
      });
    }
    return pos;
  }

  /* ---- Hauptfunktion ---- */
  function build(input) {
    lastError = null;
    const p = parse(input);
    if (!p) return fail("Formel nicht erkannt – z. B. H₂O, SO₄²⁻, Fe₂O₃ oder NaCl schreiben.");
    const atoms = [];
    p.parts.forEach((part) => {
      for (let i = 0; i < part.count; i++) atoms.push({ id: atoms.length, element: part.sym });
    });
    if (atoms.length > 26) return fail("Maximal 26 Atome werden unterstützt.");
    let total = 0;
    atoms.forEach((a) => {
      total += veOf(a.element);
    });
    total -= p.charge;
    if (total < 0) return fail("Zu wenige Valenzelektronen für diese Ladung.");

    const ion = ionicBuild(p);
    if (ion) return ion;

    /* Enthält die Formel ein Metall, geht nur der Ionenweg – Grund von dort melden */
    if (p.parts.some((x) => METALS.has(ELBYSYM[x.sym].cat))) {
      return fail(lastError || "Diese Metall-Verbindung kann nicht als Ionengitter gebaut werden (Stöchiometrie passt nicht).");
    }
    for (const a of atoms) {
      if (ELBYSYM[a.element].cat === "eg") return fail("Edelgase gehen keine Bindungen ein.");
    }

    const key = p.parts.map((x) => x.sym + (x.count > 1 ? x.count : "")).join("") + "|" + p.charge;
    const hs = atoms.filter((a) => a.element === "H");
    const nichtH = atoms.filter((a) => a.element !== "H");
    let L = null;

    /* ===== Molekularkomplexitäts-Grenze (bewusst strikt) =====
       Formeln mit mehr als 2 verschiedenen Nichtmetall-Elementen
       (z. B. C₃H₄Br₂O₂P) sind im Schul-Kontext nicht eindeutig als
       Lewis-Struktur darstellbar: mehrere Zentren, verzweigte Gerüste,
       teils ionisch, teils kovalent. Pauschal ablehnen, deutlich
       erklären. Ausnahmen: KNOWN-Einträge (kuratiert, z. B. H₂SO₄,
       CH₃OH) und echte 2-Stoff-Ionenverbindungen (NaCl, Fe₂O₃ …). */
    const schwer = p.parts.filter((x) => x.sym !== "H");
    const anzahlVerschieden = new Set(schwer.map((x) => x.sym)).size;
    const istKuratiert = !!KNOWN[p.parts.map((x) => x.sym + (x.count > 1 ? x.count : "")).join("") + "|" + p.charge];
    if (anzahlVerschieden > 2 && !istKuratiert) {
      const stoffe = [...new Set(schwer.map((x) => x.sym))].join(", ");
      if (anzahlVerschieden > 2 && !istKuratiert) {
        /* Ausnahme: genau EIN nicht-halogenes Zentrum (Anzahl 1), alle
         übrigen Schweratome sind Halogene → eindeutige Halomethane
         (CBr₂F₂, CCl₂F₂, CHBr₂F …): nur Einfachbindungen, stern()
         baut sie korrekt. Alles andere (C₃H₄Br₂O₂P …) bleibt gesperrt. */
        const zaehl = {};
        schwer.forEach((x) => {
          zaehl[x.sym] = (zaehl[x.sym] || 0) + x.count;
        });
        const istHalog = (s) => ELBYSYM[s].cat === "hg";
        const zentren = Object.keys(zaehl).filter((s) => zaehl[s] === 1 && !istHalog(s));
        const eindeutig = zentren.length === 1 && Object.keys(zaehl).every((s) => s === zentren[0] || istHalog(s));
        if (!eindeutig) {
          const stoffe = [...new Set(schwer.map((x) => x.sym))].join(", ");
          return fail(
            "„" +
              input +
              "“ enthält " +
              anzahlVerschieden +
              " verschiedene Elemente neben Wasserstoff (" +
              stoffe +
              ") – solch komplexen Verbindungen kann keine eindeutige Lewis-Struktur zugeordnet werden. " +
              "Bitte eine einfachere Formel oder einen IUPAC-Namen eines unterstützten Stoffes eingeben (z. B. H₂O, C₆H₆, Ethanol, NaCl).",
          );
        }
        /* eindeutig → fällt durch zu stern(), das C als Zentrum baut */
      }
    }

    if (KNOWN[key]) L = fromKnown(KNOWN[key], atoms);
    else if (atoms.length === 2 && atoms[0].element === atoms[1].element) L = diatom(atoms, total, p.charge);
    else if (nichtH.length >= 1) L = stern(atoms, p.parts, total, p.charge);

    if (!L || !validate(L.atoms, L.bonds, L.lp, L.single, total, p.charge)) {
      const nurCHON = p.parts.every((x) => ["C", "H", "O", "N"].indexOf(x.sym) >= 0);
      const hatC = p.parts.some((x) => x.sym === "C");
      const hatON = p.parts.some((x) => x.sym === "O" || x.sym === "N");
      if (nurCHON && hatC && hatON) {
        return fail(
          "Für C-H-O/N-Summenformeln gibt es meist Isomere (C₂H₆O = Ethanol ODER Dimethylether) – bitte den Namen eingeben (z. B. „Ethanol“, „Aceton“, „Benzaldehyd“).",
        );
      }
      return fail(
        !L
          ? "Keine einfache Lewis-Struktur gefunden – Tipp: organische Moleküle bitte beim Namen nennen (z. B. „2-Methylbutan“, „Benzaldehyd“)."
          : "Die Elektronenbilanz lässt für diese Formel keine gültige Lewis-Struktur zu.",
      );
    }
    L.positions = layoutL(L);
    return L;
  }

  return {
    build: build,
    parse: parse,
    get lastError() {
      return lastError;
    },
    setError: function (m) {
      lastError = m;
    },
  };
})();

function lewisStructure(str) {
  if (Lewis.parse(str)) {
    const L = Lewis.build(str);
    if (L) return L;
    return null; /* lastError steht bereits (z. B. Isomerie-Hinweis) */
  }
  if (typeof Organik !== "undefined") {
    const r = Organik.build(str);
    if (r.ok) return r.L;
    Lewis.setError(r.msg || "Weder Formel noch Name erkannt – z. B. H₂O, SO₄²⁻, Ethanol, But-2-en, Benzaldehyd.");
  }
  return null;
}
