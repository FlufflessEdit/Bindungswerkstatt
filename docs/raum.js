"use strict";
/* =====================================================================
   raum.js – 3D-Lewis-Modus: VSEPR/Highlight, Kugel-Stab-Rendering,
   Resonanz-Flow, heterolytische Spaltung, Dativ-Bindungen.
   ===================================================================== */

const Raum = (function () {
  const an = false; /* Modus-Schalter (per Object-Hack) */
  const state = { an: false };
  const view = { rx: -0.5, ry: 0.7 };
  let molekuele = [];
  let anims = [];
  let meldung = null;
  let letzter = 0;

  /* ---------- Helfer ---------- */
  const norm = (v) => {
    const l = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / l, v[1] / l, v[2] / l];
  };
  function rot(v, ax, ang) {
    const c = Math.cos(ang),
      s = Math.sin(ang);
    const d = ax[0] * v[0] + ax[1] * v[1] + ax[2] * v[2];
    return [
      v[0] * c + (ax[1] * v[2] - ax[2] * v[1]) * s + ax[0] * d * (1 - c),
      v[1] * c + (ax[2] * v[0] - ax[0] * v[2]) * s + ax[1] * d * (1 - c),
      v[2] * c + (ax[0] * v[1] - ax[1] * v[0]) * s + ax[2] * d * (1 - c),
    ];
  }
  /* 24 achsenparallele Rotationen – Kandidaten für den Ausrichtungs-Fit */
  const ROTS = (function () {
    const rx = (a) => [
      [1, 0, 0],
      [0, Math.cos(a), -Math.sin(a)],
      [0, Math.sin(a), Math.cos(a)],
    ];
    const ry = (a) => [
      [Math.cos(a), 0, Math.sin(a)],
      [0, 1, 0],
      [-Math.sin(a), 0, Math.cos(a)],
    ];
    const rz = (a) => [
      [Math.cos(a), -Math.sin(a), 0],
      [Math.sin(a), Math.cos(a), 0],
      [0, 0, 1],
    ];
    const mul = (A, B) => A.map((row, i) => row.map((_, j) => A[i][0] * B[0][j] + A[i][1] * B[1][j] + A[i][2] * B[2][j]));
    const list = [],
      seen = new Set();
    for (const a of [0, 1, 2, 3])
      for (const b of [0, 1, 2, 3])
        for (const c of [0, 1, 2, 3]) {
          const M = mul(mul(rx((a * Math.PI) / 2), ry((b * Math.PI) / 2)), rz((c * Math.PI) / 2));
          const key = M.flat()
            .map((v) => v.toFixed(2))
            .join(",");
          if (!seen.has(key)) {
            seen.add(key);
            list.push(M);
          }
        }
    return list;
  })();
  const applyM = (M, v) => ({
    x: M[0][0] * v.x + M[0][1] * v.y + M[0][2] * v.z,
    y: M[1][0] * v.x + M[1][1] * v.y + M[1][2] * v.z,
    z: M[2][0] * v.x + M[2][1] * v.y + M[2][2] * v.z,
  });
  function orient(dirs, target) {
    const f = norm(dirs[0]);
    const c = clamp(f[0] * target[0] + f[1] * target[1] + f[2] * target[2], -1, 1);
    const ang = Math.acos(c);
    if (ang < 0.02) return dirs.map((d) => d.slice());
    let ax;
    if (ang > Math.PI - 0.02) {
      ax = Math.abs(f[0]) < 0.9 ? norm([0, f[2], -f[1]]) : norm([-f[2], 0, f[0]]);
    } else {
      ax = norm([f[1] * target[2] - f[2] * target[1], f[2] * target[0] - f[0] * target[2], f[0] * target[1] - f[1] * target[0]]);
    }
    return dirs.map((d) => rot(d, ax, ang));
  }

  /* Bindungslängen (px) */
  const LEN = {
    "C-C": 100,
    "C-H": 72,
    "C-O": 92,
    "C-N": 95,
    "N-H": 68,
    "O-H": 64,
    "C-F": 80,
    "C-Cl": 100,
    "C-Br": 112,
    "C-I": 130,
    "O-O": 86,
    "N-N": 90,
    "H-H": 56,
    "S-O": 95,
    "C-S": 105,
    "S-H": 82,
    "N-O": 90,
    "P-O": 100,
    "P-H": 90,
    "Cl-Cl": 100,
    "F-F": 72,
    "Br-Br": 116,
  };
  function lenOf(a, b, order) {
    const k = [a.el.sym, b.el.sym].sort().join("-");
    let l = LEN[k] || 95;
    if (order === 2) l *= 0.88;
    if (order >= 3) l *= 0.78;
    return l;
  }
  function orderBetween(a, b) {
    for (const bb of a.bonds) {
      if (bb.type !== "cov") continue;
      if ((bb.a === a && bb.b === b) || (bb.b === a && bb.a === b)) return bb.order;
    }
    return 1;
  }
  const R3 = { H: 15, C: 21, N: 20, O: 20, F: 17, Cl: 24, Br: 27, I: 29, S: 25, P: 25, Si: 24, B: 19 };
  const radOf = (a) => R3[a.el.sym] || 22;

  /* Domänen & Hybridisierung */
  function domainsOf(a) {
    const sig = a.bonds.filter((b) => b.type === "cov").length;
    const lp = Math.floor(loneCount(a) / 2);
    const rad = loneCount(a) % 2;
    return { sig: sig, lp: lp, rad: rad, n: sig + lp + rad };
  }
  const DIRS = {
    2: [
      [1, 0, 0],
      [-1, 0, 0],
    ],
    3: [
      [1, 0, 0],
      [-0.5, 0.866, 0],
      [-0.5, -0.866, 0],
    ],
    4: [
      [1, 1, 1],
      [1, -1, -1],
      [-1, 1, -1],
      [-1, -1, 1],
    ].map(norm),
    5: [
      [0, 0, 1],
      [0, 0, -1],
      [1, 0, 0],
      [-0.5, 0.866, 0],
      [-0.5, -0.866, 0],
    ],
    6: [
      [1, 0, 0],
      [-1, 0, 0],
      [0, 1, 0],
      [0, -1, 0],
      [0, 0, 1],
      [0, 0, -1],
    ],
  };
  const FORMEN = {
    1: "linear",
    2: "linear",
    "1;1": "linear",
    "2;1": "gewinkelt",
    "2;2": "gewinkelt",
    3: "trigonal-planar",
    "3;1": "trigonal-pyramidal",
    "3;2": "T-förmig",
    4: "tetraedrisch",
    "4;1": "wiegenförmig",
    "4;2": "quadratisch-planar",
    5: "trigonal-bipyramidal",
    "5;1": "quadratisch-pyramidal",
    6: "oktaedrisch",
  };
  function beschreibe(a) {
    const d = domainsOf(a);
    const hyb = { 2: "sp", 3: "sp²", 4: "sp³", 5: "sp³d", 6: "sp³d²" }[d.n] || "–";
    const key = d.lp > 0 ? d.sig + ";" + d.lp : String(d.sig);
    let s = a.el.sym + " · " + a.el.name + " · " + hyb + " · AX" + d.sig;
    if (d.lp > 0) s += "E" + d.lp;
    if (d.rad > 0) s += " · Radikal";
    s += " · " + (FORMEN[key] || "AX" + d.sig);
    const q = qOf(a);
    if (q !== 0) s += " · Ladung " + fmtQ(q);
    return s;
  }

  /* ---------- Molekül-Layout (BFS + ideale Richtungen) ---------- */
  function layoutMolecule(members, ring) {
    const r3 = {},
      doms = {};
    members.forEach((m) => {
      r3[m.id] = { x: 0, y: 0, z: 0 };
      doms[m.id] = [];
    });
    const byId = new Map(members.map((m) => [m.id, m]));
    const placed = new Set();
    const queue = [];

    if (ring) {
      /* Ring = reguläres Polygon in der z=0-Ebene (planar!) */
      const n = ring.ids.length;
      const e0 = byId.get(ring.ids[0]);
      const e1 = byId.get(ring.ids[1]);
      const R = Math.round(lenOf(e0, e1, ring.bonds[0].order) / (2 * Math.sin(Math.PI / n)));
      ring.ids.forEach((id, i) => {
        const th = -Math.PI / 2 + (i * TAU) / n;
        r3[id] = { x: Math.cos(th) * R, y: Math.sin(th) * R, z: 0 };
        placed.add(id);
        queue.push(byId.get(id));
      });
    } else {
      let root = members[0],
        best = -1;
      for (const m of members) {
        const c = m.bonds.filter((b) => b.type === "cov" && byId.has((b.a === m ? b.b : b.a).id)).length;
        if (c > best || (c === best && m.Z > root.Z)) {
          best = c;
          root = m;
        }
      }
      placed.add(root.id);
      queue.push(root);
    }

    while (queue.length) {
      const a = queue.shift();
      const nachbarn = a.bonds
        .filter((b) => b.type === "cov")
        .map((b) => (b.a === a ? b.b : b.a))
        .filter((p) => byId.has(p.id));
      const kids = nachbarn.filter((p) => !placed.has(p.id));
      const elter = nachbarn.find((p) => placed.has(p.id));
      const dom = domainsOf(a);
      const isRing = ring && ring.setId.has(a.id);

      let dirs;
      if (isRing) {
        /* Ringatom: freie Richtung zeigt radial nach außen in der Ebene
           (Benzol-H, Pyridin-freies Paar), weitere leicht nach oben/unten */
        const rad = norm([r3[a.id].x, r3[a.id].y, 0]);
        dirs = [rad, norm([rad[0] * 0.65, rad[1] * 0.65, 0.76]), norm([rad[0] * 0.65, rad[1] * 0.65, -0.76]), [0, 0, 1], [0, 0, -1]];
      } else if (elter) {
        /* Referenz zeigt ZUM Elternteil; diese Richtung wird übersprungen */
        const zurueck = norm([r3[elter.id].x - r3[a.id].x, r3[elter.id].y - r3[a.id].y, r3[elter.id].z - r3[a.id].z]);
        const n = Math.min(Math.max(dom.n, nachbarn.length), 6);
        dirs = orient(DIRS[n] || DIRS[6], zurueck).slice(1);
      } else {
        const n = Math.min(Math.max(dom.n, nachbarn.length), 6);
        dirs = (DIRS[n] || DIRS[6]).slice();
      }

      let di = 0;
      for (const k of kids) {
        const d = dirs[di] || dirs[dirs.length - 1] || [1, 0, 0];
        const L = lenOf(a, k, orderBetween(a, k));
        r3[k.id] = { x: r3[a.id].x + d[0] * L, y: r3[a.id].y + d[1] * L, z: r3[a.id].z + d[2] * L };
        di++;
        placed.add(k.id);
        queue.push(k);
      }
      const rest = dirs.slice(di);
      const liste = [];
      for (let i = 0; i < dom.lp; i++) liste.push({ kind: "lp", d: rest[i % Math.max(rest.length, 1)] || [0, 0, 1] });
      if (dom.rad > 0) liste.push({ kind: "rad", d: rest[dom.lp % Math.max(rest.length, 1)] || [0, 0, 1] });
      doms[a.id] = liste;
    }

    const nichtPlatziert = members.filter((m) => !placed.has(m.id));
    nichtPlatziert.forEach((m, i) => {
      const th = (i / Math.max(nichtPlatziert.length, 1)) * TAU;
      r3[m.id] = { x: Math.cos(th) * 170, y: Math.sin(th) * 170, z: 0 };
    });
    return { r3: r3, doms: doms };
  }

  /* ---------- Ring-/Resonanz-Erkennung ---------- */
  function findeRinge(members) {
    const ids = members.map((m) => m.id);
    const inM = new Set(ids);
    const adj = {};
    ids.forEach((i) => {
      adj[i] = [];
    });
    for (const b of bonds) {
      if (b.type !== "cov") continue;
      if (inM.has(b.a.id) && inM.has(b.b.id)) {
        adj[b.a.id].push({ to: b.b.id, b: b });
        adj[b.b.id].push({ to: b.a.id, b: b });
      }
    }
    const root = ids[0];
    const par = {};
    par[root] = null;
    const qq = [root];
    while (qq.length) {
      const u = qq.shift();
      for (const e of adj[u]) {
        if (par[e.to] === undefined) {
          par[e.to] = { p: u, b: e.b };
          qq.push(e.to);
        }
      }
    }
    const pfad = (id) => {
      const o = [];
      let c = id;
      while (c != null) {
        o.push(c);
        c = par[c] ? par[c].p : null;
      }
      return o;
    };
    for (const u of ids) {
      for (const e of adj[u]) {
        if (u >= e.to) continue;
        if (par[e.to] && par[e.to].p === u) continue;
        if (par[u] && par[u].p === e.to) continue;
        const pu = pfad(u),
          pv = pfad(e.to);
        const pos = new Map(pu.map((x, i) => [x, i]));
        let lca = null,
          vi = -1;
        for (let i = 0; i < pv.length; i++) {
          if (pos.has(pv[i])) {
            lca = pv[i];
            vi = i;
            break;
          }
        }
        if (lca === null) continue;
        const zweigU = pu.slice(0, pos.get(lca));
        const zweigV = pv.slice(0, vi);
        const ringIds = zweigU.concat([lca], zweigV.slice().reverse());
        if (ringIds.length < 4) continue;
        const ringBonds = [];
        let ok = true;
        for (let i = 0; i < ringIds.length; i++) {
          const x = ringIds[i],
            y = ringIds[(i + 1) % ringIds.length];
          const be = adj[x].find((k) => k.to === y);
          if (!be) {
            ok = false;
            break;
          }
          ringBonds.push(be.b);
        }
        if (!ok) continue;
        let alternierend = true;
        for (let i = 0; i < ringBonds.length; i++) {
          if (ringBonds[i].order === ringBonds[(i + 1) % ringBonds.length].order) {
            alternierend = false;
            break;
          }
        }
        return { ids: ringIds, bonds: ringBonds, setId: new Set(ringIds), map: new Map(ringBonds.map((b, k) => [b, k])), alternierend: alternierend };
      }
    }
    return null;
  }

  /* ---------- Projektion ---------- */
  function proj(p) {
    let x = p.x,
      y = p.y,
      z = p.z;
    const cy = Math.cos(view.ry),
      sy = Math.sin(view.ry);
    const x1 = x * cy + z * sy,
      z1 = -x * sy + z * cy;
    const cx = Math.cos(view.rx),
      sx = Math.sin(view.rx);
    const y2 = y * cx - z1 * sx,
      z2 = y * sx + z1 * cx;
    const s = 1 / Math.max(0.3, 1 + z2 * 0.0016);
    return { x: x1 * s, y: y2 * s, z: z2, s: s };
  }

  /* ---------- Frame: Layouts neu berechnen ---------- */
  function frame(t, dt) {
    molekuele = [];
    const seen = new Set();
    for (const a of atoms) {
      if (seen.has(a.id)) continue;
      const members = bondComponent(a);
      members.forEach((m) => seen.add(m.id));
      const ring = findeRinge(members);
      const L = layoutMolecule(members, ring);

      /* Anker: beim Trenn-Drag zählt nur der ruhige Rest → Molekül bleibt liegen */
      const held = members.filter((m) => m.held);
      const teilsDrag = held.length > 0 && held.length < members.length;
      const anchor = teilsDrag ? members.filter((m) => !m.held) : members;
      let cx = 0,
        cy = 0;
      anchor.forEach((m) => {
        cx += m.pos.x;
        cy += m.pos.y;
      });
      cx /= anchor.length;
      cy /= anchor.length;

      const set = new Set(members.map((m) => m.id));
      const mol = {
        members: members,
        set: set,
        cx: cx,
        cy: cy,
        ringMap: ring ? ring.map : null,
        resonanz: !!(ring && ring.alternierend),
        erregt: members.some((m) => m.pullDir != null),
      };

      /* 1) Rebasing: gezeichnete Position bleibt stetig, auch wenn
            Zentrum oder Mitgliedschaft wechseln (Andocken/Abspalten) */
      for (const m of members) {
        if (m._off && m._pc) {
          m._off.x += m._pc.x - cx;
          m._off.y += m._pc.y - cy;
        }
      }

      /* 2) Ziellayout an vorhandene Positionen fitten:
            beste Drehung + Verschiebung → Bestehendes bleibt in Place */
      const shared = members.filter((m) => m._off);
      let bestM = null;
      if (shared.length >= 2) {
        let ox = 0,
          oy = 0,
          oz = 0,
          tx = 0,
          ty = 0,
          tz = 0;
        for (const m of shared) {
          ox += m._off.x;
          oy += m._off.y;
          oz += m._off.z;
          const p = L.r3[m.id];
          tx += p.x;
          ty += p.y;
          tz += p.z;
        }
        ox /= shared.length;
        oy /= shared.length;
        oz /= shared.length;
        tx /= shared.length;
        ty /= shared.length;
        tz /= shared.length;
        let bestErr = Infinity;
        for (const M of ROTS) {
          let err = 0;
          for (const m of shared) {
            const r = applyM(M, L.r3[m.id]);
            const dx = r.x - tx - (m._off.x - ox);
            const dy = r.y - ty - (m._off.y - oy);
            const dz = r.z - tz - (m._off.z - oz);
            err += dx * dx + dy * dy + dz * dz;
            if (err >= bestErr) break;
          }
          if (err < bestErr) {
            bestErr = err;
            bestM = M;
          }
        }
      }
      for (const m of members) {
        m._tgt = bestM ? applyM(bestM, L.r3[m.id]) : { x: L.r3[m.id].x, y: L.r3[m.id].y, z: L.r3[m.id].z };
      }
      if (bestM) {
        let ox = 0,
          oy = 0,
          sx = 0,
          sy = 0;
        for (const m of shared) {
          ox += m._off.x;
          oy += m._off.y;
          sx += m._tgt.x;
          sy += m._tgt.y;
        }
        const dx = ox / shared.length - sx / shared.length;
        const dy = oy / shared.length - sy / shared.length;
        for (const m of members) {
          m._tgt.x += dx;
          m._tgt.y += dy;
        }
      }

      /* 3) Gleiten; beim Trenn-Drag folgt das gegriffene Atom dem Zeiger 1:1 */
      const k = dt > 0 ? 1 - Math.exp(-8 * dt) : 1;
      for (const m of members) {
        m._doms = L.doms[m.id];
        m.molId = members[0].id;
        if (!m._off) {
          m._off = { x: m._tgt.x, y: m._tgt.y, z: m._tgt.z };
        } else if (teilsDrag && m.held) {
          m._off = { x: m.pos.x - cx, y: m.pos.y - cy, z: m._off.z };
        } else {
          m._off.x += (m._tgt.x - m._off.x) * k;
          m._off.y += (m._tgt.y - m._off.y) * k;
          m._off.z += (m._tgt.z - m._off.z) * k;
        }
        m._pc = { x: cx, y: cy };
      }
      molekuele.push(mol);
    }

    anims = anims.filter((x) => t - x.t0 < (x.dauer || 0.5) + 0.4);
  }

  /* ---------- Heterolyse beim Löschen ---------- */
  function heterolyse(a) {
    meldung = null;
    const positionen = [];
    for (const b of [...a.bonds]) {
      if (b.type !== "cov") {
        breakBond(b, a);
        continue;
      }
      const other = b.a === a ? b.b : b.a;
      const restBehaelt = other.el.en >= a.el.en;
      for (const p of b.pairs) {
        for (const e of [p.eA, p.eB]) {
          if (!e || e.state === "gone") continue;
          if (e.atom === a) {
            if (restBehaelt) {
              const sh = other.shells.length - 1;
              let idx = freeSlotNear(other, Math.atan2(a.pos.y - other.pos.y, a.pos.x - other.pos.x) + Math.PI);
              if (idx == null) {
                for (let i = 0; i < other.shells[sh].slots.length; i++) {
                  if (other.shells[sh].slots[i].st === "empty") {
                    idx = i;
                    break;
                  }
                }
              }
              const di = a.electrons.indexOf(e);
              if (di >= 0) a.electrons.splice(di, 1);
              e.atom = other;
              e.state = "slot";
              e.sh = sh;
              e.idx = idx != null ? idx : 0;
              e.bond = null;
              e.pairIndex = null;
              e.role = null;
              other.electrons.push(e);
              if (idx != null) setSlot(other.shells[sh], idx, "e", e);
              anims.push({ vonW: { x: a.pos.x, y: a.pos.y }, zu: other, t0: now(), dauer: 0.5 });
              positionen.push(other);
            }
          } else {
            if (!restBehaelt) {
              const besitzer = e.atom;
              const sh = besitzer.shells.length - 1;
              const ix = besitzer.electrons.indexOf(e);
              if (ix >= 0) besitzer.electrons.splice(ix, 1);
              e.state = "gone";
              e.bond = null;
              if (e.idx != null && besitzer.shells[sh] && besitzer.shells[sh].slots[e.idx] && besitzer.shells[sh].slots[e.idx].e === e) {
                setSlot(besitzer.shells[sh], e.idx, "empty");
              }
              anims.push({ vonW: { x: besitzer.pos.x, y: besitzer.pos.y }, zu: null, t0: now(), dauer: 0.5 });
            }
          }
        }
      }
      breakBond(b, a);
    }
    if (positionen.length > 0) {
      const gezaehlt = {};
      positionen.forEach((p2) => {
        gezaehlt[p2.el.sym] = (gezaehlt[p2.el.sym] || 0) + 1;
      });
      meldung =
        "Heterolyse: Elektronenpaar(e) bleiben bei " +
        Object.keys(gezaehlt)
          .map((s) => s + " (" + gezaehlt[s] + "×)")
          .join(", ") +
        ".";
    } else {
      meldung = a.el.sym + " entfernt (Kationen bleiben zurück).";
    }
  }

  /* ---------- Dativ-Bindung: Überschuss sucht die Verbindung ---------- */
  function tryDative(a, b) {
    const qa = qOf(a),
      qb = qOf(b);
    let d = null,
      k = null;
    if (qa < 0 && freeVal(b) > 0 && loneCount(a) >= 2) {
      d = a;
      k = b;
    } else if (qb < 0 && freeVal(a) > 0 && loneCount(b) >= 2) {
      d = b;
      k = a;
    } else if (qa > 0 && loneCount(b) >= 2) {
      d = b;
      k = a;
    } else if (qb > 0 && loneCount(a) >= 2) {
      d = a;
      k = b;
    }
    if (!d) return false;
    const shD = d.shells.length - 1,
      shK = k.shells.length - 1;
    const pick = pickElectron(d, Math.atan2(k.pos.y - d.pos.y, k.pos.x - d.pos.x));
    const slot = freeSlotNear(k, Math.atan2(d.pos.y - k.pos.y, d.pos.x - k.pos.x));
    if (!pick || slot == null) return false;
    const e = pick.e;
    const from = slotPosWorld(d, shD, pick.i);
    setSlot(d.shells[shD], pick.i, "empty");
    setSlot(k.shells[shK], slot, "res");
    const ix = d.electrons.indexOf(e);
    if (ix >= 0) d.electrons.splice(ix, 1);
    e.atom = k;
    e.sh = shK;
    e.idx = slot;
    e.state = "slot";
    e.dispA = k.shells[shK].slots[slot].ang;
    k.electrons.push(e);
    setSlot(k.shells[shK], slot, "e", e);
    d.badgePop = now();
    k.badgePop = now();
    anims.push({ vonW: { x: from.x, y: from.y }, zu: k, t0: now(), dauer: 0.45 });
    const dd = d,
      kk = k;
    setTimeout(() => {
      if (!dd.dead && !kk.dead) createCov(dd, kk);
    }, 380);
    if (typeof toast === "function") {
      toast("Dative Bindung: Elektronenpaar wandert von " + d.el.sym + " zu " + k.el.sym + " …");
    }
    valenzDirty();
    return true;
  }

  /* ---------- Schere im 3D-Modus: Überdehnung trennt ---------- */
  function checkBonds() {
    const lim = cutMode ? 1.5 : 2.1;
    for (let i = bonds.length - 1; i >= 0; i--) {
      const b = bonds[i];
      if (b._rest2d === undefined) {
        b._rest2d = Math.max(70, Math.hypot(b.b.pos.x - b.a.pos.x, b.b.pos.y - b.a.pos.y));
      }
      const d = Math.hypot(b.b.pos.x - b.a.pos.x, b.b.pos.y - b.a.pos.y);
      if (d > b._rest2d * lim) {
        b._rest2d = undefined;
        breakBond(b, null);
      }
    }
  }
  /* ---------- Valenz-Optimierer ----------
     Findet die Bindungsverteilung, die Oktetts füllt und Formalladungen
     minimiert. Läuft nach jeder Topologieänderung. Animation: Elektronen
     fliegen von freien Paaren in die neue Bindung (oder zurück). */
  function kovalenteVon(a) {
    return a.bonds.filter((b) => b.type === "cov");
  }
  function ordsum(a) {
    let s = 0;
    for (const b of kovalenteVon(a)) s += b.order;
    return s;
  }

  function valenzScore(members) {
    let s = 0;
    for (const a of members) {
      const ziel = valTarget(a);
      const um = ordsum(a) + outerE(a); /* Elektronen um das Atom */
      if (um < ziel) s += 6 * (ziel - um); /* unvolles Oktett ist schlecht */
      if (um > ziel) s += 9 * (um - ziel); /* Überoktett noch schlechter */
    }
    /* Formalladungen: fc = ve − freie Paare − Bindigkeit */
    let fcSum = 0;
    for (const a of members) {
      const fc = a.el.ve - (outerE(a) - ordsum(a)) - ordsum(a);
      if (fc !== 0) fcSum += Math.abs(fc);
    }
    s += 4 * fcSum;
    /* Radikale vermeiden, wenn möglich */
    for (const a of members) {
      if ((outerE(a) - ordsum(a)) % 2 === 1) s += 3;
    }
    return s;
  }

  function optimiereValenzen(members) {
    /* Kantenliste (jede kovalente Bindung genau einmal) */
    const kanten = [];
    const inM = new Set(members.map((m) => m.id));
    for (const b of bonds) {
      if (b.type !== "cov") continue;
      if (inM.has(b.a.id) && inM.has(b.b.id)) kanten.push(b);
    }
    if (!kanten.length) return;

    /* Zustand: Ordnungen; Simulation auf Kopien von outerE */
    const ordNeu = kanten.map((b) => b.order);
    const applyVirtual = (i, delta) => {
      ordNeu[i] += delta;
    };
    /* score über virtuelle Ordnungen */
    const scoreVirt = () => {
      let s = 0;
      const ordMap = new Map();
      members.forEach((m) => ordMap.set(m.id, 0));
      kanten.forEach((b, i) => {
        ordMap.set(b.a.id, ordMap.get(b.a.id) + ordNeu[i]);
        ordMap.set(b.b.id, ordMap.get(b.b.id) + ordNeu[i]);
      });
      for (const a of members) {
        const ziel = valTarget(a);
        const um = ordMap.get(a.id) + outerE(a);
        if (um < ziel) s += 6 * (ziel - um);
        if (um > ziel) s += 9 * (um - ziel);
        const fc = a.el.ve - (outerE(a) - ordMap.get(a.id)) - ordMap.get(a.id);
        if (fc !== 0) s += 4 * Math.abs(fc);
        if ((outerE(a) - ordMap.get(a.id)) % 2 === 1) s += 3;
      }
      return s;
    };

    let cur = scoreVirt();
    let verbesserung = true;
    let guard = 0;
    while (verbesserung && guard++ < 60) {
      verbesserung = false;
      for (let i = 0; i < kanten.length; i++) {
        for (const d of [1, -1]) {
          const alt = ordNeu[i];
          if (alt + d < 1 || alt + d > 3) continue;
          applyVirtual(i, d);
          const s2 = scoreVirt();
          if (s2 < cur - 1e-9) {
            cur = s2;
            verbesserung = true;
          } else ordNeu[i] = alt;
        }
      }
    }

    /* Änderungen anwenden + Elektronen-Animation */
    let geaendert = false;
    kanten.forEach((b, i) => {
      const delta = ordNeu[i] - b.order;
      if (delta === 0) return;
      geaendert = true;
      const dir = Math.atan2(b.b.pos.y - b.a.pos.y, b.b.pos.x - b.a.pos.x);
      const mitte = { x: (b.a.pos.x + b.b.pos.x) / 2, y: (b.a.pos.y + b.b.pos.y) / 2 };
      if (delta > 0) {
        /* Elektronen aus freien Paaren in die Bindung */
        for (let k = 0; k < delta; k++) {
          for (const [spender, gegen] of [
            [b.a, b.b],
            [b.b, b.a],
          ]) {
            if (b.order + k + 1 - 1 < 0) continue;
            const pick = pickElectron(spender, dir + (spender === b.a ? 0 : Math.PI));
            if (!pick) continue;
            const e = pick.e;
            const from = slotPosWorld(spender, spender.shells.length - 1, pick.i);
            const sh = spender.shells.length - 1;
            setSlot(spender.shells[sh], pick.i, "empty");
            const ix = spender.electrons.indexOf(e);
            if (ix >= 0) spender.electrons.splice(ix, 1);
            e.bond = b;
            e.pairIndex = b.order + k;
            e.role = spender === b.a ? "a" : "b";
            e.state = "slot";
            e.atom = spender;
            spender.electrons.push(e);
            b.pairs.push({ eA: spender === b.a ? e : null, eB: spender === b.b ? e : null });
            anims.push({ vonW: { x: from.x, y: from.y }, zu: null, zuW: mitte, t0: now(), dauer: 0.4 });
          }
        }
      } else {
        /* Elektronen aus der Bindung zurück in freie Paare */
        for (let k = 0; k < -delta; k++) {
          const p = b.pairs.pop();
          if (!p) break;
          for (const e of [p.eA, p.eB]) {
            if (!e || e.state === "gone") continue;
            const besitzer = e.atom;
            e.bond = null;
            e.pairIndex = null;
            e.role = null;
            const sh = besitzer.shells.length - 1;
            const idx = freeSlotNear(besitzer, dir + (besitzer === b.a ? Math.PI : 0));
            if (idx != null) {
              setSlot(besitzer.shells[sh], idx, "e", e);
              e.idx = idx;
              e.sh = sh;
            }
            anims.push({ vonW: mitte, zu: besitzer, t0: now(), dauer: 0.4 });
          }
        }
      }
      b.order = ordNeu[i];
      b.a.relaxDirty = true;
      b.b.relaxDirty = true;
    });
    if (geaendert && typeof toast === "function") {
      /* still bleiben lassen – nur bei großer Umordnung melden */
    }
  }

  let dirty = false;
  function valenzDirty() {
    dirty = true;
  }
  function valenzTick() {
    if (!dirty) return;
    dirty = false;
    const seen = new Set();
    for (const a of atoms) {
      if (seen.has(a.id)) continue;
      const members = bondComponent(a);
      members.forEach((m) => seen.add(m.id));
      optimiereValenzen(members);
    }
  }

  /* ---------- Zeichnen ---------- */
  function badge(ctx, x, y, txt, col, gefuellt) {
    ctx.beginPath();
    ctx.arc(x, y, 9, 0, TAU);
    if (gefuellt) {
      ctx.fillStyle = col;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#0e1116";
      ctx.stroke();
      ctx.fillStyle = "#fff";
    } else {
      ctx.fillStyle = "rgba(14,17,22,.85)";
      ctx.fill();
      ctx.strokeStyle = col;
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.fillStyle = col;
    }
    ctx.font = "700 10px 'IBM Plex Mono',monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(txt, x, y + 0.5);
  }

  function drawSphere(ctx, a, t) {
    const p = a._p;
    const r = radOf(a) * p.s;
    const col = CATS[a.el.cat].c;
    const g = ctx.createRadialGradient(p.x - r * 0.35, p.y - r * 0.4, r * 0.1, p.x, p.y, r);
    g.addColorStop(0, mixHex(col, "#ffffff", 0.55));
    g.addColorStop(0.55, col);
    g.addColorStop(1, mixHex(col, "#0a0d12", 0.45));
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, TAU);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "rgba(10,13,18,.55)";
    ctx.stroke();

    ctx.font = "700 " + Math.round(r * 0.92) + "px 'Space Grotesk',sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 3.2;
    ctx.strokeStyle = "rgba(10,13,18,.75)";
    ctx.strokeText(a.el.sym, p.x, p.y + 1);
    ctx.fillStyle = "#fff";
    ctx.fillText(a.el.sym, p.x, p.y + 1);

    const q = qOf(a);
    if (q !== 0) badge(ctx, p.x + r * 0.8, p.y - r * 0.8, fmtQ(q), q > 0 ? "#e0563f" : "#5b8fd9", true);
    else {
      const pc = partialCharge(a);
      if (pc !== 0) badge(ctx, p.x + r * 0.85, p.y - r * 0.85, pc < 0 ? "δ−" : "δ+", pc < 0 ? "#5b8fd9" : "#e0563f", false);
    }

    /* freie Paare / Radikale – wandern Richtung Partner (pullDir) */
    for (const dm of a._doms || []) {
      let d = dm.d;
      if (a.pullDir != null) {
        const ziel = [Math.cos(a.pullDir), Math.sin(a.pullDir), 0];
        const s = 0.45 + 0.35 * Math.sin(t * 5);
        d = norm([d[0] * (1 - s) + ziel[0] * s, d[1] * (1 - s) + ziel[1] * s, d[2] * (1 - s) + ziel[2] * s]);
      }
      const abstand = radOf(a) + 12;
      const lpp = proj({ x: a._off.x + d[0] * abstand, y: a._off.y + d[1] * abstand, z: a._off.z + d[2] * abstand });
      const pp = { x: lpp.x + a._c.x, y: lpp.y + a._c.y };
      ctx.fillStyle = "#f2efe6";
      ctx.strokeStyle = col;
      ctx.lineWidth = 1.6;
      if (dm.kind === "lp") {
        const vx = pp.x - p.x,
          vy = pp.y - p.y,
          vl = Math.hypot(vx, vy) || 1;
        const qx = -vy / vl,
          qy = vx / vl;
        for (const s2 of [-4.5, 4.5]) {
          ctx.beginPath();
          ctx.arc(pp.x + qx * s2, pp.y + qy * s2, 3.4, 0, TAU);
          ctx.fill();
          ctx.stroke();
        }
      } else {
        ctx.beginPath();
        ctx.arc(pp.x, pp.y, 3.6, 0, TAU);
        ctx.fill();
        ctx.stroke();
      }
    }
    /* Suchtpuls: negativer Ort + Partner in Reichweite */
    if (q < 0 && a.pullDir != null) {
      const k = 0.5 + 0.5 * Math.sin(t * 6);
      ctx.beginPath();
      ctx.arc(p.x, p.y, r + 6 + 7 * k, 0, TAU);
      ctx.strokeStyle = "rgba(91,143,217," + (0.75 - 0.5 * k).toFixed(2) + ")";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  /* ---------- Bindungssegmente: in Hälften malen, jede Hälfte gehört zu ihrem Atom ---------- */
  function bondSegments(b, mol, t) {
    const p1 = b.a._p,
      p2 = b.b._p;
    const segs = [];
    const k = mol.ringMap ? mol.ringMap.get(b) : undefined;
    const imRing = k != null;
    let ord = b.order;
    if (imRing && mol.resonanz) {
      const w = mol.erregt ? 4.4 : 1.6;
      ord = 1.5 + 0.5 * Math.sin(t * w + k * Math.PI);
    }
    const dx = p2.x - p1.x,
      dy = p2.y - p1.y,
      d = Math.hypot(dx, dy) || 1;
    const nx = -dy / d,
      ny = dx / d;
    const w = 4.5 * ((p1.s + p2.s) / 2);
    segs.push({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, w: w, col: "rgba(233,228,216,.85)" });
    if (imRing && mol.resonanz) {
      if (ord > 1.05) {
        segs.push({
          x1: p1.x + nx * 7,
          y1: p1.y + ny * 7,
          x2: p2.x + nx * 7,
          y2: p2.y + ny * 7,
          w: 3.4,
          col: "#d9a05b",
          dash: [8, 7],
          dashOff: -((t * 46) % 15),
          alpha: clamp(ord - 1, 0, 1),
        });
      }
    } else if (ord > 1.05) {
      const offs = b.order >= 3 ? [-8, 8] : [7];
      for (const o of offs) {
        segs.push({ x1: p1.x + nx * o, y1: p1.y + ny * o, x2: p2.x + nx * o, y2: p2.y + ny * o, w: w, col: "rgba(233,228,216,.85)" });
      }
    }
    return segs;
  }

  function drawSeg(ctx, s) {
    ctx.save();
    if (s.alpha !== undefined) ctx.globalAlpha = s.alpha;
    if (s.dash) {
      ctx.setLineDash(s.dash);
      ctx.lineDashOffset = s.dashOff || 0;
    }
    ctx.lineCap = "round";
    ctx.strokeStyle = s.col;
    ctx.lineWidth = s.w;
    ctx.beginPath();
    ctx.moveTo(s.x1, s.y1);
    ctx.lineTo(s.x2, s.y2);
    ctx.stroke();
    ctx.restore();
  }

  function drawIonSeg(ctx, x1, y1, x2, y2) {
    ctx.setLineDash([5, 6]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(255,255,255,.3)";
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function render(ctx) {
    const t = now();
    if (!letzter) letzter = t;
    const dt = Math.min(0.05, t - letzter);
    letzter = t;
    frame(t, dt);

    valenzTick();

    const items = [];
    for (const mol of molekuele) {
      for (const a of mol.members) {
        a._c = { x: mol.cx, y: mol.cy };
        const lp = proj(a._off);
        a._p = { x: lp.x + mol.cx, y: lp.y + mol.cy, z: lp.z, s: lp.s };
        a._wp = a._p;
      }
      for (const b of bonds) {
        if (!mol.set.has(b.a.id) || !mol.set.has(b.b.id)) continue;
        if (b.type === "ion") {
          const A = b.a._p,
            B = b.b._p;
          const mx = (A.x + B.x) / 2,
            my = (A.y + B.y) / 2;
          items.push({ z: A.z + 0.001, f: () => drawIonSeg(ctx, A.x, A.y, mx, my) });
          items.push({ z: B.z + 0.001, f: () => drawIonSeg(ctx, mx, my, B.x, B.y) });
        } else {
          for (const s of bondSegments(b, mol, t)) {
            const mx = (s.x1 + s.x2) / 2,
              my = (s.y1 + s.y2) / 2;
            const ha = Object.assign({}, s, { x2: mx, y2: my });
            const hb = Object.assign({}, s, { x1: mx, y1: my });
            /* +0.001: Bindungshälfte wird unmittelbar VOR ihrer Kugel gemalt →
               die Kugel deckt die Stoßstelle ab */
            items.push({ z: b.a._p.z + 0.001, f: () => drawSeg(ctx, ha) });
            items.push({ z: b.b._p.z + 0.001, f: () => drawSeg(ctx, hb) });
          }
        }
      }
      for (const a of mol.members) items.push({ z: a._p.z, f: () => drawSphere(ctx, a, t) });
    }
    /* Painter's Algorithm: WEIT zuerst (großes z), NAH zuletzt */
    items.sort((u, v) => v.z - u.z);
    for (const it of items) it.f();
    /* fliegende Elektronen (Heterolyse/Dativ + Transfers) */
    for (const an2 of anims) {
      const p = (t - an2.t0) / (an2.dauer || 0.5);
      if (p < 0 || p > 1.2) continue;
      const kk = clamp(p, 0, 1);
      const x0 = an2.vonW.x,
        y0 = an2.vonW.y;
      let zx, zy;
      if (an2.zu && !an2.zu.dead) {
        zx = an2.zu._p ? an2.zu._p.x : an2.zu.pos.x;
        zy = an2.zu._p ? an2.zu._p.y : an2.zu.pos.y;
      } else {
        zx = x0 + 70;
        zy = y0 - 60;
      }
      const mx = (x0 + zx) / 2,
        my = (y0 + zy) / 2 - 40;
      const u = 1 - easeIO(kk);
      const x = u * u * x0 + 2 * u * kk * mx + kk * kk * zx;
      const y = u * u * y0 + 2 * u * kk * my + kk * kk * zy;
      drawElectronBubble(x, y, "#d9a05b", false);
    }
    for (const tw of tweens) drawElectronBubble(tw.pos.x, tw.pos.y, "#d9a05b", false);
  }

  function hitAtom(w) {
    let best = null,
      bd = 1e9;
    for (const a of atoms) {
      if (!a._p) continue;
      const r = radOf(a) * a._p.s + 6;
      const d = Math.hypot(w.x - a._p.x, w.y - a._p.y);
      if (d < r && d < bd) {
        bd = d;
        best = a;
      }
    }
    return best;
  }

  return {
    get an() {
      return state.an;
    },
    set an(v) {
      state.an = v;
      if (v) {
        view.rx = -0.5;
        view.ry = 0.7;
        for (const a of atoms) {
          a._off = null;
          a._pc = null;
        }
      }
    },
    view: view,
    render: render,
    hitAtom: hitAtom,
    beschreibe: beschreibe,
    heterolyse: heterolyse,
    tryDative: tryDative,
    checkBonds: checkBonds,
    get meldung() {
      return meldung;
    },
  };
})();
