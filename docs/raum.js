"use strict";
/* =====================================================================
   raum.js – 3D-Lewis-Modus: VSEPR, Kugel-Stab-Rendering, Resonanz-Flow,
   heterolytische Spaltung, Dativ-Bindungen, Valenz-Optimierer.
   ===================================================================== */

const Raum = (function () {
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
        if (c > best || (c === best && m.Z < root.Z)) {
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

  /* ---------- Projektion: FESTE Ebene ----------
     Molekülzentren liegen immer auf der Bühne (z = 0); Ziehen bewegt sie
     nur in x/y. view.rx/ry drehen ausschließlich jedes Molekül um die
     Achsen dieser Ebene. Die Ebene selbst rotiert nie.
     Vorzeichen: Maus nach rechts = Drehung im Uhrzeigersinn. */
  function proj(v) {
    const cy = Math.cos(view.ry),
      sy = Math.sin(view.ry);
    const x1 = v.x * cy - v.z * sy;
    const z1 = v.x * sy + v.z * cy;
    const cx = Math.cos(view.rx),
      sx = Math.sin(view.rx);
    const y2 = v.y * cx - z1 * sx;
    const z2 = v.y * sx + z1 * cx;
    const s = 1 / Math.max(0.35, 1 + z2 * 0.0018);
    return { x: x1 * s, y: y2 * s, z: z2, s: s };
  }

  /* Inverse Blickrotation: liefert das lokale _off-Delta, das nach
     Projektion (dx, dy) auf dem Schirm ergibt.
     p = Rx·Ry·v  →  v = Ry⁻¹·Rx⁻¹·p, mit Rx⁻¹ = Rx(-rx), Ry⁻¹ = Ry(-ry). */
  function invProjDelta(dx, dy) {
    const cy = Math.cos(view.ry),
      sy = Math.sin(view.ry);
    const cx = Math.cos(view.rx),
      sx = Math.sin(view.rx);
    /* Rx(-rx): [1,0,0; 0,cx,sx; 0,-sx,cx] */
    const x1 = dx;
    const y1 = dy * cx;
    const z1 = -dy * sx;
    /* Ry(-ry): [cy,0,-sy; 0,1,0; sy,0,cy] */
    return [x1 * cy - z1 * sy, y1, x1 * sy + z1 * cy];
  }
  /* Perspektiv-EXAKTE Umkehrung: zu gewünschtem Bildschirm-Offset (X, Y)
     und bekannter Tiefe z2 (aus _p.z der letzten Frame) das lokale _off.
     Im Gegensatz zu invProjDelta wird die Perspektivskalierung
     s = 1/(1+z2·k) mit umgekehrt — sonst springt jedes Atom bei
     Topologieänderung um (s−1)·Abstand. */
  function unprojScreen(X, Y, z2) {
    const s = 1 / Math.max(0.35, 1 + z2 * 0.0018);
    const x1 = X / s;
    const y2 = Y / s;
    const cx = Math.cos(view.rx),
      sx = Math.sin(view.rx);
    const y1 = y2 * cx + z2 * sx;
    const z1 = -y2 * sx + z2 * cx;
    const cy = Math.cos(view.ry),
      sy = Math.sin(view.ry);
    return { x: x1 * cy + z1 * sy, y: y1, z: -x1 * sy + z1 * cy };
  }

  /* ---------- Tiefen-Dunst (Fog) & Farb-Helfer ---------- */
  function hexRgb(h) {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgbStr(c, a) {
    return "rgba(" + Math.round(c[0]) + "," + Math.round(c[1]) + "," + Math.round(c[2]) + "," + a + ")";
  }
  function mixRgb(c1, c2, t) {
    return [c1[0] + (c2[0] - c1[0]) * t, c1[1] + (c2[1] - c1[1]) * t, c1[2] + (c2[2] - c1[2]) * t];
  }
  function fogBg() {
    return (typeof darkBg !== "undefined" ? darkBg : true) ? [14, 17, 22] : [236, 234, 227];
  }
  const fogVon = (z) => clamp((z + 130) / 460, 0, 0.7);

  /* ---------- Frame: Layouts neu berechnen ----------
     Zentrum PERSISTENT: wird nie aus pos zurückgerechnet (keine
     Rückkopplung, kein Kamera-Drift), sondern nur um externe
     Verschiebungen (_shadow-Delta) fortgeführt. */
  function frame(t, dt) {
    molekuele = [];
    const seen = new Set();
    for (const a of atoms) {
      if (seen.has(a.id)) continue;
      const members = bondComponent(a);
      members.forEach((m) => seen.add(m.id));
      const ring = findeRinge(members);
      const L = layoutMolecule(members, ring);

      const held = members.filter((m) => m.held);
      const teilsDrag = held.length > 0 && held.length < members.length;

      const set = new Set(members.map((m) => m.id));
      const sig = members
        .map((m) => m.id)
        .sort((x, y) => x - y)
        .join(",");

      let cx, cy;
      const definiert = members.some((m) => m._molSig !== undefined);
      const unveraendert = definiert && members.every((m) => m._molSig === sig);
      if (unveraendert) {
        const anchor = teilsDrag ? members.filter((m) => !m.held) : members;
        let dxs = 0,
          dys = 0,
          cnt = 0;
        for (const m of anchor) {
          if (m._shadow) {
            dxs += m.pos.x - m._shadow.x;
            dys += m.pos.y - m._shadow.y;
            cnt++;
          }
        }
        cx = anchor[0]._pc.x;
        cy = anchor[0]._pc.y;
        if (cnt > 0) {
          cx += dxs / cnt;
          cy += dys / cnt;
        }
      } else {
        cx = 0;
        cy = 0;
        members.forEach((m) => {
          cx += m.pos.x;
          cy += m.pos.y;
        });
        cx /= members.length;
        cy /= members.length;
        for (const m of members) {
          if (m._p) {
            /* Bildschirmposition der letzten Frame exakt beibehalten
               (inkl. Tiefe) — kein Sprung beim Beitritt/Verlust */
            const u = unprojScreen(m._p.x - cx, m._p.y - cy, m._p.z);
            m._off = { x: u.x, y: u.y, z: u.z };
          } else if (m._off && m._pc) {
            const d = invProjDelta(m._pc.x - cx, m._pc.y - cy);
            m._off.x += d[0];
            m._off.y += d[1];
            m._off.z += d[2];
          }
        }
      }
      for (const m of members) {
        m._molSig = sig;
        m._pc = { x: cx, y: cy };
      }

      const mol = {
        members: members,
        set: set,
        cx: cx,
        cy: cy,
        teils: teilsDrag,
        ringMap: ring ? ring.map : null,
        resonanz: !!(ring && ring.alternierend),
        erregt: members.some((m) => m.pullDir != null),
      };

      /* Ziellayout an Bestehendes fitten (Rotations-Fit) */
      let shared = teilsDrag ? members.filter((m) => m._off && !m.held) : members.filter((m) => m._off);
      if (shared.length < 2) shared = members.filter((m) => m._off);
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
      if (bestM && shared.length) {
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
        const ddx = ox / shared.length - sx / shared.length;
        const ddy = oy / shared.length - sy / shared.length;
        for (const m of members) {
          m._tgt.x += ddx;
          m._tgt.y += ddy;
        }
      }

      /* Gleiten — bewusst langsam (exp(-2·dt)): ~2 s sichtbare,
         flüssige Bewegung statt Sprung. Betrifft auch die Rückkehr
         nach Scheren-Drag (angenehm weich). */
      const k = dt > 0 ? 1 - Math.exp(-3.2 * dt) : 1;
      for (const m of members) {
        m._doms = L.doms[m.id];
        m.molId = members[0].id;
        if (members.length === 1) {
          m._off = { x: 0, y: 0, z: 0 };
        } else if (!m._off) {
          const zAlt = m._p ? m._p.z : 0;
          const st = unprojScreen(m.pos.x - cx, m.pos.y - cy, zAlt);
          m._off = { x: st.x, y: st.y, z: st.z };
        } else if (!(teilsDrag && m.held)) {
          m._off.x += (m._tgt.x - m._off.x) * k;
          m._off.y += (m._tgt.y - m._off.y) * k;
          m._off.z += (m._tgt.z - m._off.z) * k;
        }
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
        if (!p) continue;
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
    if (bonded(a, b)) return false;
    /* Reaktionsfenster: während ein Proton fliegt/andockt, niemanden anfassen */
    if (typeof Bronsted !== "undefined" && Bronsted.imFenster && (Bronsted.imFenster(a) || Bronsted.imFenster(b))) return false;
    /* Kein Atom mit bestehender Dativ-Bindung (eB === null) als Ziel */
    for (const bb of a.bonds) if (bb.type === "cov" && bb.pairs.some((p) => p.eB === null)) return false;
    for (const bb of b.bonds) if (bb.type === "cov" && bb.pairs.some((p) => p.eB === null)) return false;
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
      if (!dd.dead && !kk.dead && !bonded(dd, kk)) createCov(dd, kk);
    }, 380);
    if (typeof toast === "function") {
      toast("Dative Bindung: Elektronenpaar wandert von " + d.el.sym + " zu " + k.el.sym + " …");
    }
    valenzDirty();
    return true;
  }

  /* ---------- Schere im 3D-Modus: Überdehnung trennt ----------
     NIEMALS projizierte Abstände (ändern sich mit Kamera/Aufbau!),
     sondern echte 3D-Abstände gegen die chemische Ruhelänge lenOf.
     Arming-Fenster + Glide-Guard überbrücken Aufbau-Phasen
     (an das langsame Gleiten von ~2 s angepasst). */
  function checkBonds() {
    const lim = cutMode ? 1.5 : 2.1;
    for (let i = bonds.length - 1; i >= 0; i--) {
      const b = bonds[i];
      if (b.type !== "cov") continue; /* Ionen hält Coulomb, keine Schere */
      const A = b.a,
        B = b.b;
      if (!A._off || !B._off || !A._tgt || !B._tgt) continue;
      if (A.dead || B.dead) {
        b._arm3d = undefined;
        continue;
      }
      if (b._arm3d === undefined) b._arm3d = b.born !== undefined ? b.born : now();
      if (now() - b._arm3d < 1.5) continue; /* Aufbau/Andock-Gleiten */
      /* Glide-Guard: nicht gehaltene Atome, die noch weit zu ihrer
         Ziellage gleiten (Fit-Umorientierung), nicht prüfen */
      const gleitet = (m) => {
        if (m.held) return false;
        return Math.hypot(m._off.x - m._tgt.x, m._off.y - m._tgt.y, m._off.z - m._tgt.z) > 60;
      };
      if (gleitet(A) || gleitet(B)) continue;

      const rest = lenOf(A, B, b.order);
      const d = Math.hypot(A._off.x - B._off.x, A._off.y - B._off.y, A._off.z - B._off.z);
      if (d > rest * lim) {
        b._arm3d = undefined;
        breakBond(b, null);
      }
    }
  }

  /* ---------- Valenz-Optimierer ----------
     Findet die Bindungsverteilung, die Oktetts füllt und Formalladungen
     minimiert. Läuft (per valenzDirty-Markierung) nach jeder
     Topologieänderung: Anbau, Bruch, Dativ, Brønsted-Andocken.
     Buchführungsmodell: outerE zählt ALLE eigenen Elektronen (auch die
     in Bindungen — jedes Atom steuert 1 Elektron pro Bindungsordnung
     bei, sein Slot bleibt "e"). Daraus folgt:
     – Oktett um das Atom  = eigene (outerE) + Partner-Anteil (ordsum)
     – Formalladung        = ve − outerE
     – Radikal             = ungerade Zahl NICHT bindender Eigener
                            = (outerE − ordsum) % 2 */
  function ordsum(a) {
    let s = 0;
    for (const b of a.bonds) {
      if (b.type === "cov") s += b.order;
    }
    return s;
  }

  function optimiereValenzen(members) {
    const kanten = [];
    const inM = new Set(members.map((m) => m.id));
    for (const b of bonds) {
      if (b.type !== "cov") continue;
      if (inM.has(b.a.id) && inM.has(b.b.id)) kanten.push(b);
    }
    if (!kanten.length) return;

    const ordNeu = kanten.map((b) => b.order);
    const scoreVirt = () => {
      let s = 0;
      const ordMap = new Map();
      members.forEach((m) => ordMap.set(m.id, 0));
      kanten.forEach((b, i) => {
        ordMap.set(b.a.id, ordMap.get(b.a.id) + ordNeu[i]);
        ordMap.set(b.b.id, ordMap.get(b.b.id) + ordNeu[i]);
      });
      for (const a of members) {
        if (a.el.sym === "H" && ordMap.get(a.id) === 1) continue; /* H mit 1 Bindung ist happy */
        const ziel = valTarget(a);
        const um = ordMap.get(a.id) + outerE(a);
        if (um < ziel) s += 6 * (ziel - um);
        if (um > ziel) s += 9 * (um - ziel);
        const fc = a.el.ve - outerE(a);
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
          /* Schul-Deckel: Ordnung nur bis zum BEDARF beider Atome
             (Cl nie über 1, O nie über 2, N bis 3). Hypervalenz gilt
             für die ANZAHL Bindungen (SF₆), nicht ihre Ordnung! */
          const bedarfA = Math.min(3, Math.max(1, valBedarf(kanten[i].a)));
          const bedarfB = Math.min(3, Math.max(1, valBedarf(kanten[i].b)));
          if (alt + d > bedarfA || alt + d > bedarfB) continue;
          ordNeu[i] += d;
          const s2 = scoreVirt();
          if (s2 < cur - 1e-9) {
            cur = s2;
            verbesserung = true;
          } else ordNeu[i] = alt;
        }
      }
    }

    /* Änderungen anwenden + Elektronen-Animation */
    kanten.forEach((b, i) => {
      const delta = ordNeu[i] - b.order;
      if (delta === 0) return;
      const dir = Math.atan2(b.b.pos.y - b.a.pos.y, b.b.pos.x - b.a.pos.x);
      const mitte = { x: (b.a.pos.x + b.b.pos.x) / 2, y: (b.a.pos.y + b.b.pos.y) / 2 };
      if (delta > 0) {
        for (let k = 0; k < delta; k++) {
          for (const [spender] of [[b.a], [b.b]]) {
            const pick = pickElectron(spender, dir + (spender === b.a ? 0 : Math.PI));
            if (!pick) continue;
            const e = pick.e;
            const from = slotPosWorld(spender, spender.shells.length - 1, pick.i);
            const sh = spender.shells.length - 1;
            setSlot(spender.shells[sh], pick.i, "empty");
            e.bond = b;
            e.pairIndex = b.order + k;
            e.role = spender === b.a ? "a" : "b";
            e.state = "slot";
            e.atom = spender;
            b.pairs.push({ eA: spender === b.a ? e : null, eB: spender === b.b ? e : null });
            anims.push({ vonW: { x: from.x, y: from.y }, zu: null, zuW: mitte, t0: now(), dauer: 0.4 });
          }
        }
      } else {
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
      if (delta > 0) b.born = now(); /* Hochstufung wächst sichtbar vom Donor */
      b.a.relaxDirty = true;
      b.b.relaxDirty = true;
    });
  }

  let dirty = false;
  function valenzDirty() {
    dirty = true;
  }
  function valenzTick() {
    if (!dirty) return;
    if (typeof aufbauBis !== "undefined" && now() < aufbauBis) return; /* dirty bleibt gesetzt */
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
  function badge(ctx, x, y, txt, col, gefuellt, alpha) {
    const al = alpha === undefined ? 1 : alpha;
    ctx.save();
    ctx.globalAlpha = al;
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
    ctx.restore();
  }

  function drawSphere(ctx, a, t) {
    const p = a._p;
    const r = radOf(a) * p.s;
    const fog = fogVon(p.z);
    const bg = fogBg();
    const col = CATS[a.el.cat].c;
    const cCol = hexRgb(col);

    /* Kugelschattierung: Hauptlicht oben links → Schatten unten rechts,
       alles verblassend Richtung Hintergrund (Tiefen-Dunst) */
    const hell = mixRgb(mixRgb(cCol, [255, 255, 255], 0.55), bg, fog);
    const mittel = mixRgb(cCol, bg, fog);
    const dunkel = mixRgb(mixRgb(cCol, [10, 13, 18], 0.5), bg, fog);
    const g = ctx.createRadialGradient(p.x - r * 0.38, p.y - r * 0.42, r * 0.06, p.x, p.y, r);
    g.addColorStop(0, rgbStr(hell, 1));
    g.addColorStop(0.55, rgbStr(mittel, 1));
    g.addColorStop(1, rgbStr(dunkel, 1));
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, TAU);
    ctx.fillStyle = g;
    ctx.fill();

    /* Kantenlicht: heller Bogen an der vom Licht abgewandten Kante */
    ctx.beginPath();
    ctx.arc(p.x, p.y, r * 0.8, 0.25, 1.45);
    ctx.strokeStyle = rgbStr(mixRgb([255, 255, 255], bg, fog), 0.42 * (1 - fog));
    ctx.lineWidth = Math.max(1.4, r * 0.17);
    ctx.lineCap = "round";
    ctx.stroke();
    ctx.lineCap = "butt";

    /* Glanzpunkt */
    ctx.beginPath();
    ctx.ellipse(p.x - r * 0.34, p.y - r * 0.4, r * 0.2, r * 0.12, -0.6, 0, TAU);
    ctx.fillStyle = rgbStr([255, 255, 255], 0.55 * (1 - fog));
    ctx.fill();

    /* Elementsymbol (verblassend) */
    const tAlpha = 1 - fog * 0.7;
    ctx.font = "700 " + Math.round(r * 0.92) + "px 'Space Grotesk',sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 3.2;
    ctx.strokeStyle = "rgba(10,13,18," + (0.75 * tAlpha).toFixed(3) + ")";
    ctx.strokeText(a.el.sym, p.x, p.y + 1);
    ctx.fillStyle = rgbStr(mixRgb([255, 255, 255], bg, fog * 0.8), tAlpha);
    ctx.fillText(a.el.sym, p.x, p.y + 1);

    const q = qOf(a);
    if (q !== 0) badge(ctx, p.x + r * 0.8, p.y - r * 0.8, fmtQ(q), q > 0 ? "#e0563f" : "#5b8fd9", true, 1 - fog * 0.5);
    else {
      const pc = partialCharge(a);
      if (pc !== 0) badge(ctx, p.x + r * 0.85, p.y - r * 0.85, pc < 0 ? "δ−" : "δ+", pc < 0 ? "#5b8fd9" : "#e0563f", false, 1 - fog * 0.5);
    }

    /* freie Paare / Radikale – ruhig Richtung Partner geneigt (pullDir) */
    for (const dm of a._doms || []) {
      let d = dm.d;
      if (a.pullDir != null) {
        const ziel = [Math.cos(a.pullDir), Math.sin(a.pullDir), 0];
        const sMix = 0.45;
        d = norm([d[0] * (1 - sMix) + ziel[0] * sMix, d[1] * (1 - sMix) + ziel[1] * sMix, d[2] * (1 - sMix) + ziel[2] * sMix]);
      }
      const abstand = radOf(a) + 12;
      const lpp = proj({ x: a._off.x + d[0] * abstand, y: a._off.y + d[1] * abstand, z: a._off.z + d[2] * abstand });
      const pp = { x: lpp.x + a._c.x, y: lpp.y + a._c.y, z: lpp.z };
      const fogP = fogVon(pp.z);
      ctx.fillStyle = rgbStr(mixRgb([242, 239, 230], bg, fogP), 1 - fogP * 0.4);
      ctx.strokeStyle = rgbStr(mixRgb(cCol, bg, fogP), 1 - fogP * 0.4);
      ctx.lineWidth = 1.6;
      if (dm.kind === "lp") {
        const vx = pp.x - p.x,
          vy = pp.y - p.y,
          vl = Math.hypot(vx, vy) || 1;
        const qx = -vy / vl,
          qy = vx / vl;
        for (const s2 of [-4.5, 4.5]) {
          ctx.beginPath();
          ctx.arc(pp.x + qx * s2, pp.y + qy * s2, 3.4 * lpp.s, 0, TAU);
          ctx.fill();
          ctx.stroke();
        }
      } else {
        ctx.beginPath();
        ctx.arc(pp.x, pp.y, 3.6 * lpp.s, 0, TAU);
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

  /* ---------- Bindungssegmente ----------
     Zwei unabhängige Teile-Operationen:
     a) WACHSEN entlang der Achse (neue Bindungen, vom Donor aus)
     b) HÄLFTEN für die Tiefensortierung (jede Hälfte vor ihrer Kugel) */
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
    const fog = fogVon((p1.z + p2.z) / 2);
    const bg = fogBg();
    const stab = mixRgb([233, 228, 216], bg, fog);
    const gold = mixRgb([217, 160, 91], bg, fog);
    const dx = p2.x - p1.x,
      dy = p2.y - p1.y,
      d = Math.hypot(dx, dy) || 1;
    const nx = -dy / d,
      ny = dx / d;
    const w = 4.5 * ((p1.s + p2.s) / 2);

    /* --- Wachstum: Achsenabschnitte [0..1] sichtbar --- */
    const g = wachsFaktor(b, t);
    let a0 = 0,
      b0 = 1; /* sichtbarer Achsenbereich */
    if (g < 1) {
      const split = wachsSplit(b); /* Anteil von Seite a */
      a0 = clamp(split * (1 - g), 0, 1); /* a wächst von 0 vorwärts */
      b0 = clamp(1 - (1 - split) * (1 - g), 0, 1); /* b von 1 rückwärts */
      if (b0 < a0) b0 = a0; /* in der Mitte getroffen */
    }
    const ax = (q) => p1.x + dx * q,
      ay = (q) => p1.y + dy * q;
    const sx1 = ax(a0),
      sy1 = ay(a0),
      sx2 = ax(b0),
      sy2 = ay(b0);

    const push = (x1, y1, x2, y2, lw, col, opt) => {
      opt = opt || {};
      segs.push({ x1: x1, y1: y1, x2: x2, y2: y2, w: lw, col: col, dash: opt.dash, dashOff: opt.dashOff, alpha: opt.alpha });
    };
    push(sx1, sy1, sx2, sy2, w, rgbStr(stab, 0.9));
    if (imRing && mol.resonanz) {
      if (ord > 1.05) {
        push(sx1 + nx * 7, sy1 + ny * 7, sx2 + nx * 7, sy2 + ny * 7, 3.4, rgbStr(gold, 1), {
          dash: [8, 7],
          dashOff: -((t * 46) % 15),
          alpha: clamp(ord - 1, 0, 1),
        });
      }
    } else if (ord > 1.05) {
      const offs = b.order >= 3 ? [-8, 8] : [7];
      for (const o of offs) {
        push(sx1 + nx * o, sy1 + ny * o, sx2 + nx * o, sy2 + ny * o, w, rgbStr(stab, 0.9));
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

  /* ---------- Wachs-Bindung: wächst vom Ort höherer Elektronendichte ----------
     EN-Differenz entscheidet: stark polar → fast nur eine Seite greift aus,
     unpol (ΔEN < 0,5) → beide symmetrisch zur Mitte. growth ∈ [0,1]. */
  function wachsFaktor(b, t) {
    if (b.born === undefined) return 1;
    const p = clamp((t - b.born) / 0.9, 0, 1);
    return easeOutBack(p) * 0.04 + p * 0.96; /* minimal Overshoot, dann settle */
  }
  /* Anteil (0..1), den SEITE A liefert: 0 = ganz von a, 1 = ganz von b */
  function wachsSplit(b) {
    if (b.type !== "cov") return 0.5;
    if (!b.polar || b.dEN < 0.5) return 0.5;
    /* stark = Seite mit höherer EN (Elektronendichte). Das Bindungs-
       paar "gehört" ihr → sie greift aus. Anteil skaliert mit ΔEN:
       0,5 → 0,5 (Mitte), ≥ 1,7 → 0,15/0,85 (fast einseitig). */
    const k = clamp((b.dEN - 0.5) / 1.2, 0, 1);
    return b.strong === "a" ? 0.5 - 0.35 * k : 0.5 + 0.35 * k;
  }

  function render(ctx) {
    const t = now();
    if (!letzter) letzter = t;
    const dt = Math.min(0.05, t - letzter);
    letzter = t;
    frame(t, dt);
    valenzTick(); /* Valenz-Reorganisation nach Topologieänderungen */

    /* Durchgang 1: projizieren */
    for (const mol of molekuele) {
      for (const a of mol.members) {
        a._c = { x: mol.cx, y: mol.cy };
        const lp = proj(a._off);
        a._p = { x: lp.x + mol.cx, y: lp.y + mol.cy, z: lp.z, s: lp.s };
        a._wp = a._p;
      }
    }

    /* Durchgang 2: gegriffenes Atom (Schere) folgt dem Zeiger in der
       Ebene; danach pos = gerenderte Position, _shadow als Referenz.
       Das Zentrum wird NICHT aus pos zurückgerechnet → keine
       Rückkopplung, kein Kamera-Drift. */
    for (const mol of molekuele) {
      for (const a of mol.members) {
        if (mol.teils && a.held) {
          /* Perspektiv-exakte Ein-Schuss-Korrektur: _off SO setzen, dass
             die Projektion exakt den Zeiger trifft (Tiefe beibehalten).
             Kein iteratives invProjDelta — das kann bei nahen Atomen
             (s > 2) oszillieren/divergieren. */
          const u = unprojScreen(a.pos.x - mol.cx, a.pos.y - mol.cy, a._p ? a._p.z : 0);
          a._off = { x: u.x, y: u.y, z: u.z };
          const lp = proj(a._off);
          a._p = { x: lp.x + mol.cx, y: lp.y + mol.cy, z: lp.z, s: lp.s };
          a._wp = a._p;
        }
        a.pos.x = a._p.x;
        a.pos.y = a._p.y;
        a._shadow = { x: a._p.x, y: a._p.y };
      }
    }

    /* Durchgang 3: Zeichenliste */
    const items = [];
    for (const mol of molekuele) {
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
            items.push({ z: b.a._p.z + 0.001, f: () => drawSeg(ctx, ha) });
            items.push({ z: b.b._p.z + 0.001, f: () => drawSeg(ctx, hb) });
          }
        }
      }
      for (const a of mol.members) items.push({ z: a._p.z, f: () => drawSphere(ctx, a, t) });
    }
    for (const hb of typeof hBrueckenListe === "function" ? hBrueckenListe() : []) {
      if (!hb.h._p || !hb.akz._p) continue;
      const A = hb.h._p,
        B = hb.akz._p;
      items.push({
        z: (A.z + B.z) / 2,
        f: () => {
          ctx.setLineDash([3, 5]);
          ctx.strokeStyle = "rgba(217,160,91,.75)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(A.x, A.y);
          ctx.lineTo(B.x, B.y);
          ctx.stroke();
          ctx.setLineDash([]);
        },
      });
    }
    items.sort((u, v) => v.z - u.z);
    for (const it of items) it.f();

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
      } else if (an2.zuW) {
        zx = an2.zuW.x;
        zy = an2.zuW.y;
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
      const r = radOf(a) * a._p.s + 6 * UI_SCALE;
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
          a._pos2d = { x: a.pos.x, y: a.pos.y };
          a._off = null;
          a._pc = null;
          a._molSig = undefined;
          a._shadow = null;
        }
      } else {
        for (const a of atoms) {
          if (a._pos2d) {
            a.pos.x = a._pos2d.x;
            a.pos.y = a._pos2d.y;
            a._pos2d = null;
          }
          a._off = null;
          a._pc = null;
          a._molSig = undefined;
          a._shadow = null;
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
    valenzDirty: valenzDirty,
    get meldung() {
      return meldung;
    },
  };
})();
