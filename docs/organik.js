"use strict";
/* =====================================================================
   organik.js – organische Chemie: deutsche IUPAC-Namen → Lewis-Struktur.
   Gleicht Ausgabeformat wie lewis.js (atoms/bonds/lp/single/positions).
   Lädt NACH lewis.js, VOR modell.js.
   ===================================================================== */

const Organik = (function () {
  const VALENZ = { C: 4, O: 2, N: 3 };
  const need = (el) => (el === "H" ? 2 : 8);
  const ZAEHLEN = [
    ["hept", 7],
    ["meth", 1],
    ["dec", 10],
    ["non", 9],
    ["oct", 8],
    ["hex", 6],
    ["pent", 5],
    ["but", 4],
    ["prop", 3],
    ["eth", 2],
  ];

  const TRIVIAL = {
    toluol: "methylbenzol",
    phenol: "hydroxybenzol",
    benzaldehyd: "formylbenzol",
    benzoesaure: "carboxybenzol",
    formaldehyd: "methanal",
    acetaldehyd: "ethanal",
    aceton: "propan-2-on",
    essigsaure: "ethansaure",
    ameisensaure: "methansaure",
    glycol: "ethan-1,2-diol",
    isopropylalkohol: "propan-2-ol",
    tertbutanol: "2-methylpropan-2-ol",
    isobutan: "2-methylpropan",
    isopentan: "2-methylbutan",
    neopentan: "2,2-dimethylpropan",
    neohexan: "2,2-dimethylbutan",
    ethylen: "ethen",
    acetylen: "ethin",
    butadien: "buta-1,3-dien",
  };

  const SUBS = {
    methyl: { art: "kette", n: 1 },
    ethyl: { art: "kette", n: 2 },
    propyl: { art: "kette", n: 3 },
    butyl: { art: "kette", n: 4 },
    isopropyl: { art: "verzweigt2" },
    isobutyl: { art: "isobutyl" },
    tertbutyl: { art: "tert" },
    hydroxy: { art: "oh" },
    formyl: { art: "cho" },
    carboxy: { art: "cooh" },
  };
  const MULT = { di: 2, tri: 3, tetra: 4 };
  const subRe = /^(\d+(?:,\d+)*)?-?(di|tri|tetra)?(isopropyl|isobutyl|tertbutyl|methyl|ethyl|propyl|butyl|hydroxy|formyl|carboxy)-?/;

  /* ---------- Tippfehler-Vorschläge ---------- */
  function lev(a, b) {
    const m = a.length,
      n = b.length;
    if (!m) return n;
    if (!n) return m;
    let prev = [];
    for (let j = 0; j <= n; j++) prev[j] = j;
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      prev = cur;
    }
    return prev[n];
  }
  const NAMEN = (function () {
    const list = [
      "benzol",
      "toluol",
      "phenol",
      "benzaldehyd",
      "cyclohexan",
      "cyclohexen",
      "cyclopentan",
      "cyclohexanol",
      "methylcyclohexan",
      "aceton",
      "essigsaure",
      "formaldehyd",
      "glycol",
      "buta-1,3-dien",
      "2-methylpropan",
      "2-methylbutan",
      "2,2-dimethylpropan",
      "2,2-dimethylbutan",
      "2,3-dimethylbutan",
    ];
    const staemme = ["meth", "eth", "prop", "but", "pent", "hex", "hept", "oct", "non", "dec"];
    staemme.forEach(function (st, i) {
      const n = i + 1;
      list.push(st + "an", st + "en", st + "in", st + "an-1-ol", st + "anal", st + "ansaure");
      if (n >= 3) list.push(st + "an-2-ol", st + "an-2-on");
      if (n >= 4) list.push(st + "-1-en", st + "-2-en", "2-methyl" + st + "an");
    });
    return list;
  })();
  function vorschlag(s) {
    let best = null,
      bd = 99;
    for (const n of NAMEN) {
      const d = lev(s, n);
      if (d < bd) {
        bd = d;
        best = n;
      }
    }
    if (best && bd <= (s.length > 7 ? 3 : 2)) return best.replace(/saure/g, "säure");
    return null;
  }

  let curS = "";
  function fehler(msg) {
    let m = msg;
    const v = vorschlag(curS);
    if (v && v !== curS) m += " Meintest du „" + v + "“?";
    return { ok: false, msg: m };
  }

  /* ---------- Graph-Builder ---------- */
  function neuG() {
    return { els: [], bonds: [], ring: null, chain: null };
  }
  function addEl(G, el) {
    G.els.push(el);
    return G.els.length - 1;
  }
  function verbinde(G, a, b, o) {
    for (const x of G.bonds) {
      if ((x.a === a && x.b === b) || (x.a === b && x.b === a)) return x;
    }
    const e = { a: a, b: b, order: o || 1 };
    G.bonds.push(e);
    return e;
  }
  function orderSum(G, i) {
    let s = 0;
    for (const b of G.bonds) {
      if (b.a === i || b.b === i) s += b.order;
    }
    return s;
  }
  function haengeSub(G, ziel, def) {
    if (def.art === "kette") {
      let prev = ziel;
      for (let k = 0; k < def.n; k++) {
        const c = addEl(G, "C");
        verbinde(G, prev, c, 1);
        prev = c;
      }
    } else if (def.art === "verzweigt2") {
      const m = addEl(G, "C");
      verbinde(G, ziel, m, 1);
      verbinde(G, m, addEl(G, "C"), 1);
      verbinde(G, m, addEl(G, "C"), 1);
    } else if (def.art === "isobutyl") {
      const c1 = addEl(G, "C");
      verbinde(G, ziel, c1, 1);
      const c2 = addEl(G, "C");
      verbinde(G, c1, c2, 1);
      verbinde(G, c2, addEl(G, "C"), 1);
      verbinde(G, c2, addEl(G, "C"), 1);
    } else if (def.art === "tert") {
      const m = addEl(G, "C");
      verbinde(G, ziel, m, 1);
      for (let k = 0; k < 3; k++) verbinde(G, m, addEl(G, "C"), 1);
    } else if (def.art === "oh") {
      verbinde(G, ziel, addEl(G, "O"), 1);
    } else if (def.art === "cho") {
      const c = addEl(G, "C");
      verbinde(G, ziel, c, 1);
      verbinde(G, c, addEl(G, "O"), 2);
    } else if (def.art === "cooh") {
      const c = addEl(G, "C");
      verbinde(G, ziel, c, 1);
      verbinde(G, c, addEl(G, "O"), 2);
      verbinde(G, c, addEl(G, "O"), 1);
    }
  }

  /* ---------- Suffix-Sequenz (an, en, dien, in, ol, diol, al, on, säure) ---------- */
  function parseSuffixe(rest, leadLoc) {
    const out = { ens: [], ins: [], ols: [], al: false, hatOn: false, on: -1, saure: false };
    let i = 0,
      guard = 0,
      leadUsed = false;
    while (i < rest.length && guard++ < 10) {
      while (rest.charAt(i) === "-") i++;
      let locs = null;
      const mz = /^(\d+(?:,\d+)*)-?/.exec(rest.slice(i));
      if (mz) {
        locs = mz[1].split(",").map(Number);
        i += mz[0].length;
      }
      let end = null;
      for (const e of ["saure", "dien", "triol", "diol", "en", "in", "an", "ol", "al", "on"]) {
        if (rest.startsWith(e, i)) {
          end = e;
          break;
        }
      }
      if (!end) return null;
      if (!locs && leadLoc != null && !leadUsed && ["en", "in", "ol", "on"].indexOf(end) >= 0) {
        locs = [leadLoc];
        leadUsed = true;
      }
      i += end.length;
      if (rest.charAt(i) === "-") i++;
      if (end === "an") {
      } else if (end === "en") out.ens.push(locs || [1]);
      else if (end === "dien") out.ens.push(locs || [1, 3]);
      else if (end === "in") out.ins.push(locs || [1]);
      else if (end === "ol") out.ols.push(locs || [1]);
      else if (end === "diol") out.ols.push(locs || [1, 2]);
      else if (end === "triol") out.ols.push(locs || [1, 2, 3]);
      else if (end === "al") out.al = true;
      else if (end === "on") {
        out.hatOn = true;
        out.on = locs ? locs[0] : 0;
      } else if (end === "saure") out.saure = true;
    }
    return i >= rest.length ? out : null;
  }

  /* ---------- Name → Rohstruktur ---------- */
  function parseName(eingabe) {
    let s = eingabe
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "")
      .replace(/ä/g, "a")
      .replace(/ö/g, "o")
      .replace(/ü/g, "u")
      .replace(/tert-/g, "tert")
      .replace(/sec-/g, "sek");
    if (!s) return { ok: false, msg: "Bitte einen Namen eingeben." };
    if (TRIVIAL[s]) s = TRIVIAL[s];

    const subs = [];
    for (;;) {
      const m = subRe.exec(s);
      if (!m) break;
      let pos = m[1] ? m[1].split(",").map(Number) : null;
      const mult = m[2] ? MULT[m[2]] : 1;
      if (!pos) {
        if (mult > 1) return fehler("Bitte Positionen angeben (z. B. 2,2-Dimethylbutan oder 1,2-Dimethylbenzol).");
        pos = [1];
      }
      if (pos.length !== mult) return fehler("Zu „" + (m[2] || "") + "“ gehören " + mult + " Positionen.");
      for (const p of pos) subs.push({ pos: p, name: m[3] });
      s = s.slice(m[0].length);
      curS = s;
    }

    if (/yl$/.test(s)) {
      return fehler("„…yl“ ist eine Gruppenbezeichnung – bitte den vollständigen Namen eingeben (z. B. Ethan, Ethen, Ethanol).");
    }

    let benzol = false,
      cyclo = false,
      n = 0,
      sufs = null,
      leadLoc = null;
    if (s === "benzol") {
      benzol = true;
      n = 6;
      sufs = { ens: [], ins: [], ols: [], al: false, hatOn: false, on: -1, saure: false };
    } else {
      const ml = /^(\d+)-?/.exec(s);
      if (ml) {
        leadLoc = parseInt(ml[1], 10);
        s = s.slice(ml[0].length);
      }
      if (s.startsWith("cyclo")) {
        cyclo = true;
        s = s.slice(5);
      }
      for (const z of ZAEHLEN) {
        if (s.startsWith(z[0])) {
          n = z[1];
          s = s.slice(z[0].length);
          break;
        }
      }
      if (!n) return fehler("Stamm nicht erkannt (Meth…, Eth…, Prop…, But…, Pent…, Hex…, Hept…, Oct…, Non…, Dec…).");
      if (s.startsWith("a-")) s = s.slice(2);
      else if (s.startsWith("a") && !s.startsWith("an") && !s.startsWith("al") && !s.startsWith("as")) s = s.slice(1);
      while (s.startsWith("-")) s = s.slice(1); /* FIX: but-2-en, prop-2-en-1-ol, hex-2-in … */
      sufs = parseSuffixe(s, leadLoc);
      if (!sufs)
        return fehler(
          "Endung nicht verstanden. Bekannt: -an, -en, -dien, -in, -ol, -diol, -al, -on, -säure (z. B. But-2-en, Propan-2-ol, Butanal, Buta-1,3-dien).",
        );
    }
    return { ok: true, n: n, sufs: sufs, subs: subs, cyclo: cyclo, benzol: benzol };
  }

  function baueStruktur(p) {
    const G = neuG();
    const n = p.n;
    const ids = [];
    for (let i = 0; i < n; i++) ids.push(addEl(G, "C"));
    if (p.benzol || p.cyclo) {
      for (let i = 0; i < n; i++) verbinde(G, ids[i], ids[(i + 1) % n], 1);
      G.ring = ids.slice();
    } else {
      for (let i = 0; i < n - 1; i++) verbinde(G, ids[i], ids[i + 1], 1);
      G.chain = ids.slice();
    }

    const ens = p.benzol ? [1, 3, 5] : [].concat.apply([], p.sufs.ens);
    const ins = [].concat.apply([], p.sufs.ins);
    const ols = [].concat.apply([], p.sufs.ols);

    for (const q of ens) {
      if (q < 1 || q > n || (!G.ring && q === n)) return fehler("Doppelbindung an Position " + q + " passt nicht in die Kette.");
      verbinde(G, ids[q - 1], ids[q % n], 1).order = 2;
    }
    for (const q of ins) {
      if (q < 1 || q > n || (!G.ring && q === n)) return fehler("Dreifachbindung an Position " + q + " passt nicht in die Kette.");
      verbinde(G, ids[q - 1], ids[q % n], 1).order = 3;
    }
    if ((p.sufs.al || p.sufs.saure) && p.cyclo) {
      return fehler("Aldehyd/Carbonsäure direkt am Ring wird nicht unterstützt – bitte z. B. „Benzaldehyd“ oder „Benzoesäure“ benutzen.");
    }
    if (p.sufs.al || p.sufs.saure) {
      verbinde(G, ids[0], addEl(G, "O"), 2);
      if (p.sufs.saure) verbinde(G, ids[0], addEl(G, "O"), 1);
    }
    if (p.sufs.hatOn) {
      let q = p.sufs.on;
      if (q === 0) q = G.ring ? 1 : n === 3 ? 2 : 0;
      if (q === 0) return fehler("Keton braucht eine Positionsangabe (z. B. Propan-2-on, Butan-2-on).");
      if (G.ring ? q < 1 || q > n : q < 2 || q > n - 1) return fehler("Keton-Position " + q + " passt nicht in die Kette.");
      verbinde(G, ids[q - 1], addEl(G, "O"), 2);
    }
    for (const q of ols) {
      if (q < 1 || q > n) return fehler("OH-Position " + q + " liegt außerhalb des Moleküls.");
      verbinde(G, ids[q - 1], addEl(G, "O"), 1);
    }
    for (const sub of p.subs) {
      if (sub.pos < 1 || sub.pos > n) return fehler("Substituent an Position " + sub.pos + " liegt außerhalb des Moleküls.");
      haengeSub(G, ids[sub.pos - 1], SUBS[sub.name]);
    }
    for (let i = 0; i < G.els.length; i++) {
      if (orderSum(G, i) > VALENZ[G.els[i]]) {
        return fehler("Valenz überschritten – „" + curS + "“ beschreibt kein gültiges Molekül.");
      }
    }
    return { ok: true, G: G };
  }

  /* ---------- H-Atome auffüllen + Elektronenbilanz ---------- */
  function vollstaendig(G) {
    /* Valenzelektronen (nicht Bindigkeit!): H 1 · C 4 · N 5 · O 6 */
    const VE = { H: 1, C: 4, N: 5, O: 6 };
    const atoms = G.els.map(function (el, i) {
      return { id: i, element: el };
    });
    const bonds = G.bonds.map(function (b) {
      return { from: b.a, to: b.b, order: b.order };
    });
    for (let i = 0; i < G.els.length; i++) {
      const frei = VALENZ[G.els[i]] - orderSum(G, i);
      for (let k = 0; k < frei; k++) {
        const h = { id: atoms.length, element: "H" };
        atoms.push(h);
        bonds.push({ from: i, to: h.id, order: 1 });
      }
    }
    const lp = {},
      single = {};
    let eCount = 0,
      veS = 0;
    atoms.forEach(function (a) {
      let os = 0;
      for (const b of bonds) {
        if (b.from === a.id || b.to === a.id) os += b.order;
      }
      lp[a.id] = Math.max(0, (need(a.element) - 2 * os) / 2);
      single[a.id] = 0;
      veS += VE[a.element] || 0;
    });
    bonds.forEach(function (b) {
      eCount += 2 * b.order;
    });
    atoms.forEach(function (a) {
      eCount += 2 * lp[a.id];
    });
    if (eCount !== veS) return { ok: false, msg: "Interne Elektronenbilanz stimmt nicht – Name bitte prüfen." };
    return { ok: true, atoms: atoms, bonds: bonds, lp: lp, single: single };
  }

  /* ---------- Layout: Ring/Kette + generische Richtungswahl ---------- */
  function layout(G, atoms, bonds) {
    const pos = {};
    atoms.forEach(function (a) {
      pos[a.id] = [0, 0];
    });
    const adj = {};
    bonds.forEach(function (b) {
      (adj[b.from] = adj[b.from] || []).push(b.to);
      (adj[b.to] = adj[b.to] || []).push(b.from);
    });
    const dist = function (a, b) {
      const ea = atoms[a].element,
        eb = atoms[b].element;
      if (ea === "H" || eb === "H") return 95;
      if (ea === "C" && eb === "C") return 130;
      return 115;
    };
    const done = new Set();
    const usedAng = function (id) {
      const u = [];
      for (const p of adj[id] || []) {
        if (done.has(p)) u.push(Math.atan2(pos[p][1] - pos[id][1], pos[p][0] - pos[id][0]));
      }
      return u;
    };
    const bestDir = function (id) {
      const u = usedAng(id);
      let best = 0,
        bs = -1;
      for (let k = 0; k < 16; k++) {
        const th = (k * TAU) / 16;
        let d = Infinity;
        for (const w of u) d = Math.min(d, Math.abs(angNorm(th - w)));
        const raster = Math.round(th / (Math.PI / 2)) * (Math.PI / 2);
        const sc = d + (Math.abs(angNorm(th - raster)) < 0.01 ? 0.35 : 0);
        if (sc > bs) {
          bs = sc;
          best = th;
        }
      }
      return best;
    };
    if (G.ring) {
      const n = G.ring.length;
      const R = Math.round(135 / (2 * Math.sin(Math.PI / n)));
      G.ring.forEach(function (id, i) {
        const th = -Math.PI / 2 + (i * TAU) / n;
        pos[id] = [Math.round(Math.cos(th) * R), Math.round(Math.sin(th) * R)];
        done.add(id);
      });
    } else if (G.chain) {
      const n = G.chain.length;
      G.chain.forEach(function (id, i) {
        pos[id] = [Math.round((i - (n - 1) / 2) * 130), 0];
        done.add(id);
      });
    }
    const queue = atoms
      .filter(function (a) {
        return a.element !== "H" && done.has(a.id);
      })
      .map(function (a) {
        return a.id;
      });
    while (queue.length) {
      const id = queue.shift();
      for (const p of adj[id] || []) {
        if (done.has(p) || atoms[p].element === "H") continue;
        const th = bestDir(id);
        const d = dist(id, p);
        pos[p] = [Math.round(pos[id][0] + Math.cos(th) * d), Math.round(pos[id][1] + Math.sin(th) * d)];
        done.add(p);
        queue.push(p);
      }
    }
    for (const a of atoms) {
      if (a.element === "H") continue;
      for (const p of adj[a.id] || []) {
        if (atoms[p].element !== "H" || done.has(p)) continue;
        const th = bestDir(a.id);
        const d = dist(a.id, p);
        pos[p] = [Math.round(pos[a.id][0] + Math.cos(th) * d), Math.round(pos[a.id][1] + Math.sin(th) * d)];
        done.add(p);
      }
    }
    return pos;
  }

  function build(raw) {
    const p = parseName(raw);
    if (!p.ok) return p;
    const b = baueStruktur(p);
    if (!b.ok) return b;
    const v = vollstaendig(b.G);
    if (!v.ok) return v;
    return { ok: true, L: { atoms: v.atoms, bonds: v.bonds, lp: v.lp, single: v.single, positions: layout(b.G, v.atoms, v.bonds) } };
  }

  return { build: build };
})();
