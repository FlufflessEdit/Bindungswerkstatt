"use strict";

/* =====================================================================
   bronsted.js – Brønsted-Säure-Base: Protonenwanderung zwischen Molekülen.
   pKS-Näherung (Schulwerte) · Richtungsentscheidung · sichtbarer H⁺-Flug.
   Andocken: Akzeptor gibt dem Proton 1 Elektron, dann kovalente Bindung
   (Schalenmodell-Buchführung: Ladung +1 landet am O/N, H bleibt neutral).

   Robustheit:
   – Re-Entry-Guard (nie zwei Übertragungen parallel)
   – Reaktionsfenster sperrt H, Säure-Rest UND Akzeptor vom Kappen
     bis zum Andocken (schnelles Ziehen kann nichts mehr korrumpieren)
   – _fensterT-Timeout räumt hängende Fenster nach 2,5 s ab
   – Flug bricht ab, wenn das Ziel stirbt (H bleibt als H⁺ stehen)
   ===================================================================== */

const Bronsted = (function () {
  const PKS = {
    HCl: -7,
    HBr: -9,
    HI: -10,
    HNO3: -1.4,
    H2O4S: -3,
    "H3O+": -1.7,
    H2O3S: 1.9,
    H3O4P: 2.1,
    HF: 3.2,
    CH2O2: 3.7,
    C2H4O2: 4.8,
    CH2O3: 6.4,
    "H4N+": 9.3,
    CHN: 9.4,
    HS: 7.0,
    H2O2: 11.7,
    H2O: 15.7,
    CH4O: 15.5,
    C2H6O: 16.0,
    H3N: 38,
    CH4: 50,
    H2: 35,
  };
  const PKS_KONJ = {
    H2O: 15.7,
    H3N: 9.3,
    "HO-": 15.7,
    "C2H3O2-": 4.8,
    "CO3-": 10.3,
    "Cl-": -7,
    "Br-": -9,
    "NO3-": -1.4,
    "O4S-": 1.9,
    "F-": 3.2,
    "CH3O-": 15.5,
  };

  function summenformel(members) {
    const n = {};
    let ladung = 0;
    members.forEach((m) => {
      n[m.el.sym] = (n[m.el.sym] || 0) + 1;
      ladung += qOf(m);
    });
    const teile = [];
    if (n.C) {
      teile.push("C" + (n.C > 1 ? n.C : ""));
      delete n.C;
    }
    if (n.H) {
      teile.push("H" + (n.H > 1 ? n.H : ""));
      delete n.H;
    }
    Object.keys(n)
      .sort()
      .forEach((s) => teile.push(s + (n[s] > 1 ? n[s] : "")));
    return { f: teile.join(""), ladung: ladung };
  }
  function keyVon(members) {
    const s = summenformel(members);
    return s.f + (s.ladung === 0 ? "" : s.ladung > 0 ? "+" : "-");
  }

  function istProtonDonor(mol) {
    const pks = PKS[keyVon(mol)];
    if (pks === undefined || pks >= 16) return null;
    const hs = mol.filter((m) => m.el.sym === "H" && m.bonds.some((b) => b.type === "cov" && (b.a === m ? b.b : b.a).el.cat !== "ak"));
    return hs.length ? { pks: pks, hs: hs } : null;
  }
  function istProtonAkzeptor(mol) {
    const key = keyVon(mol);
    const hatLP = mol.some((m) => "ONF".includes(m.el.sym) && loneCount(m) >= 2);
    const anion = mol.some((m) => qOf(m) < 0) && mol.every((m) => qOf(m) <= 0);
    if (!hatLP && !anion) return null;
    const pksKonj = PKS_KONJ[key] !== undefined ? PKS_KONJ[key] : anion ? 14 : null;
    return pksKonj === null ? null : { pksKonj: pksKonj };
  }

  /* EINE Definition. Die Richtung regelt allein die pKS-Regel:
     NH₄⁺ → Cl⁻ scheitert (9,3 ≮ −7,5) – keine Rückreaktion.
     NH₄⁺ → OH⁻ läuft (echte Chemie: Ammoniakfreisetzung). */
  function pruefePaar(molA, molB) {
    const dA = istProtonDonor(molA),
      aB = istProtonAkzeptor(molB);
    if (dA && aB && dA.pks < aB.pksKonj - 0.5) return { laeuft: true, donor: molA, akzeptor: molB, d: dA };
    const dB = istProtonDonor(molB),
      aA = istProtonAkzeptor(molA);
    if (dB && aA && dB.pks < aA.pksKonj - 0.5) return { laeuft: true, donor: molB, akzeptor: molA, d: dB };
    return { laeuft: false };
  }

  /* Reaktionsfenster: während des Flugs/Andockens sind die Beteiligten
     für Dativ/Kontakt/Physik gesperrt. */
  const imFenster = (a) => !!(a && (a._protonFlug || a._protonAnkunft));

  /* ---------- Proton abspalten (heterolytisch, sichtbar) ---------- */
  function uebertrageProton(hAtom, zielMol) {
    /* Re-Entry-Schutz: läuft für dieses H schon eine Übertragung? */
    if (hAtom._protonFlug || hAtom._proton) return false;
    const b = hAtom.bonds.find((x) => x.type === "cov" && (x.a === hAtom || x.b === hAtom));
    if (!b) return false;
    const akz =
      zielMol
        .filter((m) => "ONF".includes(m.el.sym) && loneCount(m) >= 2)
        .sort((p, q) => Math.hypot(p.pos.x - hAtom.pos.x, p.pos.y - hAtom.pos.y) - Math.hypot(q.pos.x - hAtom.pos.x, q.pos.y - hAtom.pos.y))[0] ||
      zielMol[0];
    if (!akz) return false;
    const partner = b.a === hAtom ? b.b : b.a; /* Säure-Rest, z. B. Cl */

    /* Drag lösen UND Restgeschwindigkeit nullen — sonst rast das
       Proton nach dem Ablösen weiter und der Flug startet falsch. */
    if (typeof drag !== "undefined" && drag && drag.member) {
      const ix = drag.member.indexOf(hAtom);
      if (ix >= 0) drag.member.splice(ix, 1);
      hAtom.held = false;
    }
    hAtom.vel.x = 0;
    hAtom.vel.y = 0;

    /* Fenster setzen, BEVOR irgendetwas kappt wird: von hier an sind
       alle Beteiligten (H, Cl-Seite, NH₃) für contact/Physik gesperrt. */
    hAtom._proton = true;
    hAtom._protonFlug = null; /* Platzhalter, unten gefüllt */
    partner._protonAnkunft = true; /* Rest-Molekül (Cl-Seite) sperren */
    akz._protonAnkunft = true; /* Akzeptor (NH₃) sperren */
    partner._fensterT = now();
    akz._fensterT = now();

    const ang = Math.atan2(hAtom.pos.y - partner.pos.y, hAtom.pos.x - partner.pos.x);

    breakBond(b, null);

    /* HETEROLYSE: Das Bindungselektron des H gehört jetzt dem Partner
       (Cl⁻ wird korrekt negativ). */
    const shP = partner.shells.length - 1;
    const pSh = partner.shells[shP];
    for (let i = 0; i < pSh.slots.length; i++) {
      if (pSh.slots[i].st === "rm") setSlot(pSh, i, "empty");
    }
    for (const e of [...hAtom.electrons]) {
      if (e.state !== "slot") continue;
      const idx = freeSlotNear(partner, ang);
      if (idx == null) break;
      const shH = hAtom.shells.length - 1;
      const from = slotPosWorld(hAtom, shH, e.idx);
      setSlot(hAtom.shells[shH], e.idx, "empty");
      setSlot(pSh, idx, "res");
      const hix = hAtom.electrons.indexOf(e);
      if (hix >= 0) hAtom.electrons.splice(hix, 1);
      addTween(
        e,
        from,
        () => slotPosWorld(partner, shP, idx),
        () => {
          e.atom = partner;
          e.sh = shP;
          e.idx = idx;
          e.state = "slot";
          e.dispA = pSh.slots[idx].ang;
          partner.electrons.push(e);
          setSlot(pSh, idx, "e", e);
          partner.badgePop = now();
          partner.relaxDirty = true;
        },
        0.12,
        0.55,
      );
    }
    hAtom.badgePop = now();
    hAtom.relaxDirty = true;

    hAtom._protonFlug = { t0: now(), dauer: 0.7, von: { x: hAtom.pos.x, y: hAtom.pos.y }, zuRef: akz, fertig: () => andocken(hAtom, akz, partner) };
    return true;
  }

  /* ---------- Andocken (Schalenmodell-Buchführung) ----------
     1) Akzeptor gibt dem Proton EIN Elektron (sichtbarer Flug)
     2) danach kovalente Bindung (je 1 Elektron pro Seite)
     → N/O besitzt ein Elektron weniger = Ladung +1 am N/O,
       H besitzt 1 = neutral. */
  function andocken(hAtom, akz, partner) {
    hAtom._protonFlug = null;
    hAtom._protonAnkunft = true; /* H sperren */
    hAtom._fensterT = now();
    akz._protonAnkunft = true; /* Akzeptor sperren (Fenster!) */
    const ang = Math.atan2(hAtom.pos.y - akz.pos.y, hAtom.pos.x - akz.pos.x);
    hAtom.pos.x = akz.pos.x + Math.cos(ang) * 95;
    hAtom.pos.y = akz.pos.y + Math.sin(ang) * 95;
    hAtom.vel.x = 0;
    hAtom.vel.y = 0;

    const n = tryTransfer(akz, hAtom, 1); /* O/N → H, 1 Elektron */

    setTimeout(() => {
      hAtom._protonAnkunft = false;
      hAtom._fensterT = undefined;
      akz._protonAnkunft = false;
      akz._fensterT = undefined;
      hAtom._proton = false;
      /* auch der Säure-Rest: sein Fenster wurde in uebertrageProton
         gesetzt und muss hier freigegeben werden */
      if (partner && !partner.dead) {
        partner._protonAnkunft = false;
        partner._fensterT = undefined;
      }
      if (hAtom.dead || akz.dead) return;
      if (n > 0 && !bonded(akz, hAtom)) createCov(akz, hAtom, 1);
      if (typeof Raum !== "undefined" && Raum.an && Raum.valenzDirty) Raum.valenzDirty();
      if (typeof toast === "function") {
        const s = summenformel(bondComponent(akz));
        toast("Proton übertragen → " + s.f + (s.ladung > 0 ? "⁺" : s.ladung < 0 ? "⁻" : "") + "!");
      }
    }, 780);
  }

  /* ---------- Frame-Treiber ---------- */
  const cooldown = new Map();
  function tick() {
    /* Flüge weitertweenen; Abbruch, wenn das Ziel stirbt */
    for (const a of atoms) {
      if (!a._protonFlug) continue;
      const f = a._protonFlug;
      if (f.zuRef.dead) {
        /* Ziel gelöscht: Flug abbrechen, H bleibt als pulsierendes H⁺ */
        a._protonFlug = null;
        a._proton = true;
        continue;
      }
      const t = clamp((now() - f.t0) / f.dauer, 0, 1);
      const k = easeIO(t);
      const zx = f.zuRef.pos.x,
        zy = f.zuRef.pos.y;
      const mx = (f.von.x + zx) / 2,
        my = (f.von.y + zy) / 2 - 50;
      const u = 1 - k;
      a.pos.x = u * u * f.von.x + 2 * u * k * mx + k * k * zx;
      a.pos.y = u * u * f.von.y + 2 * u * k * my + k * k * zy;
      a.vel.x = 0;
      a.vel.y = 0;
      if (t >= 1) f.fertig();
    }
    /* Hängende Fenster aufräumen: älter als 2,5 s → freigeben.
       (Schutz gegen Zustände, die nach Moduswechsel/Löschen hängen
       bleiben; _fensterT wird bei jeder Freigabe sauber resettet.) */
    for (const a of atoms) {
      if (!a._protonAnkunft) continue;
      if (a._protonFlug) continue;
      if (a._fensterT === undefined) a._fensterT = now();
      if (now() - a._fensterT > 2.5) {
        a._protonAnkunft = false;
        a._fensterT = undefined;
      }
    }
    /* Automatische Annäherungsreaktionen */
    const comps = [];
    const seen = new Set();
    for (const a of atoms) {
      if (seen.has(a.id) || imFenster(a)) continue;
      const m = bondComponent(a);
      m.forEach((x) => seen.add(x.id));
      comps.push(m);
    }
    outer: for (let i = 0; i < comps.length; i++) {
      for (let j = i + 1; j < comps.length; j++) {
        let dMin = 1e9;
        for (const x of comps[i]) {
          for (const y of comps[j]) {
            dMin = Math.min(dMin, Math.hypot(x.pos.x - y.pos.x, x.pos.y - y.pos.y));
          }
        }
        if (dMin > 190) continue;
        const erg = pruefePaar(comps[i], comps[j]);
        if (!erg.laeuft) continue;
        let h = null;
        for (const kand of erg.d.hs) {
          if (atoms.indexOf(kand) < 0) continue;
          if ((cooldown.get(kand.id) || 0) > now()) continue;
          /* H oder Ziel schon im Fenster (laufende Reaktion)? */
          if (kand._protonFlug || kand._proton || kand._protonAnkunft) continue;
          h = kand;
          break;
        }
        if (!h) continue;
        cooldown.set(h.id, now() + 4);
        if (typeof toast === "function") {
          toast("Brønsted: " + summenformel(erg.donor).f + " gibt ein H⁺ ab …");
        }
        uebertrageProton(h, erg.akzeptor);
        break outer;
      }
    }
  }

  /* 2D-Overlay: pulsierendes Proton */
  function zeichne2D(ctx) {
    for (const a of atoms) {
      if (!a._proton && !a._protonFlug) continue;
      const puls = 0.5 + 0.5 * Math.sin(now() * 6);
      ctx.beginPath();
      ctx.arc(a.pos.x, a.pos.y, 22 + 6 * puls, 0, TAU);
      ctx.strokeStyle = "rgba(91,143,217," + (0.7 - 0.4 * puls).toFixed(2) + ")";
      ctx.lineWidth = 2;
      ctx.stroke();
      if (a._proton) {
        ctx.font = "700 10px 'IBM Plex Mono',monospace";
        ctx.fillStyle = "#5b8fd9";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("H⁺", a.pos.x, a.pos.y - 32);
      }
    }
  }

  return { tick: tick, zeichne2D: zeichne2D, pruefePaar: pruefePaar, imFenster: imFenster, starte: uebertrageProton };
})();
