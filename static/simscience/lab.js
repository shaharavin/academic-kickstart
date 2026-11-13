'use strict';
// Isometric lab view. Everything is drawn procedurally on a <canvas>; no image assets.
// Lab.create(canvas, tooltipEl) -> { update(game), destroy() }
const Lab = (() => {
  const TW = 52, TH = 26, WALL_H = 72;
  const ROWS = 6;

  const LIGHT = {
    bg: 'transparent', floorA: '#e7eaef', floorB: '#dee2e8', grid: 'rgba(0,0,0,0.06)',
    wallL: '#f1ece2', wallR: '#e6dfd2', wallTrim: '#cfc6b6', skirt: '#b9b0a0',
    desk: '#d2b48c', deskL: '#b3936b', deskR: '#967855',
    chair: '#5b6b7c', chairL: '#4a5867', chairR: '#3b4653',
    monitor: '#2b2f36', screen: '#8fd3f4', paper: '#ffffff', paperEdge: '#b9bfc8',
    coat: '#fbfbfb', coatShade: '#dcdfe4', trouser: '#3b4a5c', ink: '#2a2f38', faint: '#6b7280',
    pcr: '#dfe3e8', pcrL: '#bcc3cc', pcrR: '#99a3af', lid: '#9fb2c6', lidL: '#7f93a8', lidR: '#67798c',
    ep: '#e8edf2', epL: '#c4cdd7', epR: '#a2adba', rail: '#6c7a89', ledOn: '#2fd36b', ledOff: '#55606b',
    frame: '#7b5d3b', board: '#fdfdfd', boardTrim: '#9aa3ad', note: '#fff176', red: '#d64545',
    shadow: 'rgba(20,24,30,0.14)', mug: '#c0392b', plant: '#3f9d5a', pot: '#b86b3c',
    journal: { weed: '#4caf50', molmicro: '#3f7fd6', cell: '#d64545' },
  };
  const DARK = Object.assign({}, LIGHT, {
    floorA: '#2b313a', floorB: '#262c34', grid: 'rgba(255,255,255,0.05)',
    wallL: '#3a3c42', wallR: '#32343a', wallTrim: '#4c5058', skirt: '#1f2227',
    desk: '#9c7b55', deskL: '#7d6244', deskR: '#634d35',
    chair: '#4a5867', chairL: '#3b4653', chairR: '#2f3842',
    monitor: '#15181d', screen: '#5fb8e0', paper: '#eef0f3', paperEdge: '#8a919c',
    coat: '#e9ebee', coatShade: '#c3c8cf', trouser: '#2a3542', ink: '#e6e9ee', faint: '#9aa3ad',
    pcr: '#aab2bc', pcrL: '#8d96a1', pcrR: '#737c87', ep: '#b4bcc6', epL: '#949dab', epR: '#78828f',
    board: '#e9ecef', boardTrim: '#6b7480', shadow: 'rgba(0,0,0,0.35)',
  });

  const SKIN = ['#f1c9a5', '#dba97a', '#b07a4a', '#7a4b2a', '#f6d9c1', '#c68c5a'];
  const HAIR = ['#2b2b2b', '#5b3b1f', '#c99a4f', '#8d8d8d', '#a93b2a', '#1d2b4f'];

  const P = (x, y) => [((x - y) * TW) / 2, ((x + y) * TH) / 2];
  const hash = (s) => { let h = 7; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };

  function poly(ctx, pts, fill, stroke) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
  }

  // Box with footprint w×d tiles at (x,y), height h px, sitting at elevation z px.
  function box(ctx, x, y, w, d, h, top, left, right, z = 0) {
    const [ax, ay] = P(x, y), [bx, by] = P(x + w, y), [cx, cy] = P(x + w, y + d), [dx, dy] = P(x, y + d);
    const t = z + h;
    poly(ctx, [[dx, dy - t], [cx, cy - t], [cx, cy - z], [dx, dy - z]], left);
    poly(ctx, [[cx, cy - t], [bx, by - t], [bx, by - z], [cx, cy - z]], right);
    poly(ctx, [[ax, ay - t], [bx, by - t], [cx, cy - t], [dx, dy - t]], top);
  }

  function shadow(ctx, x, y, rx, ry, c) {
    const [sx, sy] = P(x, y);
    ctx.beginPath(); ctx.ellipse(sx, sy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = c.shadow; ctx.fill();
  }

  // A little scientist standing at tile (x,y). kind: manager|lazy|bright|genius
  function person(ctx, x, y, kind, seed, c, t, working) {
    const [sx, sy0] = P(x, y);
    const bob = working ? Math.sin(t * 3 + (seed % 7)) * 1.2 : 0;
    const sy = sy0 + bob;
    const skin = SKIN[seed % SKIN.length], hair = HAIR[(seed >> 3) % HAIR.length];
    const slouch = kind === 'lazy';
    const bodyH = kind === 'genius' ? 22 : slouch ? 16 : 19;
    const bodyW = slouch ? 15 : 12;
    shadow(ctx, x, y, 9, 4.5, c);
    // legs
    ctx.fillStyle = c.trouser;
    ctx.fillRect(sx - 5, sy - 8, 4, 8);
    ctx.fillRect(sx + 1, sy - 8, 4, 8);
    // coat
    ctx.beginPath();
    ctx.moveTo(sx - bodyW / 2, sy - 8);
    ctx.lineTo(sx - bodyW / 2 + 1.5, sy - 8 - bodyH);
    ctx.lineTo(sx + bodyW / 2 - 1.5, sy - 8 - bodyH);
    ctx.lineTo(sx + bodyW / 2, sy - 8);
    ctx.closePath();
    ctx.fillStyle = c.coat; ctx.fill();
    ctx.fillStyle = c.coatShade; ctx.fillRect(sx - 0.5, sy - 8 - bodyH + 3, 1, bodyH - 4);
    if (kind === 'manager') { // tie
      ctx.fillStyle = '#b23a48';
      ctx.fillRect(sx - 1, sy - 8 - bodyH + 3, 2, 9);
    }
    // head
    const hy = sy - 8 - bodyH - 6;
    ctx.beginPath(); ctx.arc(sx, hy, 6, 0, Math.PI * 2); ctx.fillStyle = skin; ctx.fill();
    ctx.beginPath(); ctx.arc(sx, hy - 1.5, 6, Math.PI, Math.PI * 2); ctx.fillStyle = hair; ctx.fill();
    ctx.fillStyle = c.ink; ctx.fillRect(sx - 2.5, hy + 0.5, 1.2, 1.2); ctx.fillRect(sx + 1.3, hy + 0.5, 1.2, 1.2);
    if (kind === 'bright') { // ponytail
      ctx.beginPath(); ctx.ellipse(sx + 6, hy + 1, 2.5, 4, 0.4, 0, Math.PI * 2); ctx.fillStyle = hair; ctx.fill();
    }
    if (kind === 'genius') { // glasses
      ctx.strokeStyle = c.ink; ctx.lineWidth = 1;
      ctx.strokeRect(sx - 5, hy - 1, 4, 3); ctx.strokeRect(sx + 1, hy - 1, 4, 3);
    }
    if (slouch) { // mug
      ctx.fillStyle = c.mug; ctx.fillRect(sx + 7, sy - 8 - bodyH + 6, 5, 6);
      if (!working) { // zzz
        ctx.fillStyle = c.faint; ctx.font = '9px sans-serif';
        ctx.fillText('z', sx + 8, hy - 8 + Math.sin(t * 2) * 2);
        ctx.fillText('z', sx + 12, hy - 14 + Math.sin(t * 2 + 1) * 2);
      }
    }
    if (kind === 'manager') { // clipboard
      ctx.fillStyle = '#8b5a2b'; ctx.fillRect(sx - 11, sy - 8 - bodyH + 8, 6, 8);
      ctx.fillStyle = c.paper; ctx.fillRect(sx - 10, sy - 8 - bodyH + 9, 4, 6);
    }
  }

  function paperStack(ctx, x, y, z, n, c) {
    const [sx, sy] = P(x, y);
    const shown = Math.min(n, 6);
    for (let i = 0; i < shown; i++) {
      const yy = sy - z - i * 2.2;
      poly(ctx, [[sx - 7, yy], [sx + 1, yy - 4], [sx + 9, yy], [sx + 1, yy + 4]], c.paper, c.paperEdge);
    }
    if (n > shown) {
      ctx.fillStyle = c.ink; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(`${n}`, sx + 1, sy - z - shown * 2.2 - 3);
      ctx.textAlign = 'start';
    }
  }

  function monitor(ctx, x, y, z, c, on) {
    const [sx, sy] = P(x, y);
    ctx.fillStyle = c.monitor; ctx.fillRect(sx - 1, sy - z - 6, 2, 6);
    poly(ctx, [[sx - 8, sy - z - 6], [sx + 8, sy - z - 12], [sx + 8, sy - z - 22], [sx - 8, sy - z - 16]], c.monitor);
    poly(ctx, [[sx - 6.5, sy - z - 7.5], [sx + 6.5, sy - z - 12.5], [sx + 6.5, sy - z - 20.5], [sx - 6.5, sy - z - 15.5]],
      on ? c.screen : c.pcrR);
  }

  // An AI research agent: a server tower where the chair would be, LEDs blinking while it works.
  function aiRig(ctx, x, y, c, t, working) {
    box(ctx, x + 0.42, y - 0.5, 0.36, 0.42, 30, c.monitor, '#1b1f25', '#0f1216');
    const [fx, fy] = P(x + 0.78, y - 0.29);
    for (let i = 0; i < 4; i++) {
      const on = working ? Math.sin(t * (3 + i) + i * 1.7) > 0 : i === 0;
      ctx.fillStyle = on ? (i % 2 ? c.ledOn : '#f0a35e') : c.ledOff;
      ctx.fillRect(fx - 9, fy - 26 + i * 5, 2, 2);
    }
    ctx.strokeStyle = '#3a4149'; ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(fx - 5, fy - 25 + i * 5); ctx.lineTo(fx + 0.5, fy - 22.5 + i * 5); ctx.stroke(); }
  }

  function workstation(ctx, ws, c, t, hits, view) {
    const { x, y, s, kind, wip, name, away, seed } = ws;
    const deskH = 15;
    // chair behind desk (further back = smaller x+y)
    if (kind === 'ai') {
      aiRig(ctx, x, y, c, t, wip > 0);
    } else if (away) {
      box(ctx, x + 0.4, y - 0.5, 0.36, 0.36, 7, c.chair, c.chairL, c.chairR);
      box(ctx, x + 0.4, y - 0.5, 0.36, 0.06, 12, c.chair, c.chairL, c.chairR, 7);
    } else {
      person(ctx, x + 0.6, y - 0.15, kind, seed, c, t, wip > 0);
    }
    box(ctx, x, y, 1.2, 0.7, deskH, c.desk, c.deskL, c.deskR);
    monitor(ctx, x + 0.3, y + 0.25, deskH, c, !away);
    if (kind === 'ai') { // terminal lines typing themselves on the screen
      const [mx, my] = P(x + 0.3, y + 0.25);
      ctx.fillStyle = '#f0a35e';
      for (let i = 0; i < 3; i++) {
        const w = wip > 0 ? 3 + ((t * 6 + i * 2.3) % 7) : 6;
        ctx.save(); ctx.transform(1, -0.31, 0, 1, mx - 5, my - deskH - 13.5 + i * 2.5);
        ctx.fillRect(0, 0, w, 1); ctx.restore();
      }
    }
    if (wip > 0) paperStack(ctx, x + 0.9, y + 0.4, deskH, wip, c);
    if (away) { // sticky note on the desk
      const [sx, sy] = P(x + 0.8, y + 0.35);
      poly(ctx, [[sx - 6, sy - deskH], [sx + 2, sy - deskH - 4], [sx + 8, sy - deskH - 1], [sx, sy - deskH + 3]], c.note);
    }
    const [hx, hy] = P(x + 0.6, y + 0.1);
    hits.push({ x: hx - 28, y: hy - 70, w: 56, h: 85, text: `${name} (${s})${away ? ` is away at ${away}` : wip ? ` is working on ${wip} project${wip > 1 ? 's' : ''}` : ' has nothing to do'}` });
  }

  function machine(ctx, m, c, t, hits) {
    const { x, kind, inUse, label } = m;
    const y = 0.15;
    const led = inUse ? c.ledOn : c.ledOff;
    if (kind === 'PCR') {
      box(ctx, x, y, 0.8, 0.6, 18, c.pcr, c.pcrL, c.pcrR);
      box(ctx, x + 0.12, y + 0.08, 0.45, 0.42, 5, c.lid, c.lidL, c.lidR, 18);
      const [lx, ly] = P(x + 0.8, y + 0.5);
      ctx.beginPath(); ctx.arc(lx - 4, ly - 10, 1.8, 0, Math.PI * 2);
      ctx.fillStyle = inUse && Math.sin(t * 5) > 0 ? led : (inUse ? c.ledOff : led); ctx.fill();
      // tiny display
      const [dx, dy] = P(x + 0.5, y + 0.6);
      ctx.fillStyle = inUse ? c.screen : c.pcrR; ctx.fillRect(dx - 7, dy - 14, 7, 4);
    } else {
      box(ctx, x, y, 1.1, 0.7, 11, c.ep, c.epL, c.epR);
      // gantry rails
      const [a, b] = [P(x + 0.1, y + 0.1), P(x + 1.0, y + 0.1)];
      const [d, e] = [P(x + 0.1, y + 0.6), P(x + 1.0, y + 0.6)];
      ctx.strokeStyle = c.rail; ctx.lineWidth = 1.5;
      for (const [px, py] of [a, b, d, e]) { ctx.beginPath(); ctx.moveTo(px, py - 11); ctx.lineTo(px, py - 29); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(a[0], a[1] - 29); ctx.lineTo(b[0], b[1] - 29); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(d[0], d[1] - 29); ctx.lineTo(e[0], e[1] - 29); ctx.stroke();
      // pipetting head slides when in use
      const u = inUse ? 0.5 + 0.4 * Math.sin(t * 1.6) : 0.5;
      const [hx1, hy1] = P(x + 0.1 + u * 0.9, y + 0.1), [hx2, hy2] = P(x + 0.1 + u * 0.9, y + 0.6);
      ctx.beginPath(); ctx.moveTo(hx1, hy1 - 29); ctx.lineTo(hx2, hy2 - 29); ctx.stroke();
      const [mx, my] = P(x + 0.1 + u * 0.9, y + 0.35);
      ctx.fillStyle = c.rail; ctx.fillRect(mx - 3, my - 29, 6, 7);
      ctx.beginPath(); ctx.arc(mx, my - 20, 1.5, 0, Math.PI * 2); ctx.fillStyle = led; ctx.fill();
    }
    const [hx, hy] = P(x + 0.5, y + 0.35);
    hits.push({ x: hx - 26, y: hy - 40, w: 52, h: 46, text: label });
  }

  function wallFrames(ctx, published, rows, c, hits) {
    // framed papers on the left wall (plane x = 0)
    const step = 0.5, start = 0.55, maxPerRow = Math.floor((rows - start - 0.2) / step);
    const levels = [52, 36];
    const cap = maxPerRow * levels.length;
    const shown = published.slice(0, cap);
    shown.forEach((r, i) => {
      const row = Math.floor(i / maxPerRow), col = i % maxPerRow;
      const t0 = start + col * step, t1 = t0 + 0.36, h0 = levels[row], h1 = h0 + 11;
      const [ax, ay] = P(0, t0), [bx, by] = P(0, t1);
      poly(ctx, [[ax, ay - h1], [bx, by - h1], [bx, by - h0], [ax, ay - h0]], c.frame);
      poly(ctx, [[ax + 1, ay - h1 + 1.5], [bx - 1, by - h1 + 1], [bx - 1, by - h0 - 1], [ax + 1, ay - h0 - 0.5]], c.paper);
      ctx.fillStyle = c.journal[r.journal] || c.faint;
      ctx.fillRect(ax + 2.5, (ay + by) / 2 - h1 + 4, 3, 3);
      hits.push({ x: Math.min(ax, bx), y: by - h1, w: Math.abs(bx - ax), h: 14, text: `${r.title} (${r.journalName})` });
    });
    if (published.length > cap) {
      const [ax, ay] = P(0, start + maxPerRow * step);
      ctx.save(); ctx.transform(1, -0.5, 0, 1, ax, ay - 40);
      ctx.fillStyle = c.ink; ctx.font = 'bold 10px sans-serif';
      ctx.fillText(`+${published.length - cap}`, 2, 0); ctx.restore();
    }
  }

  function whiteboard(ctx, g, cols, c, t, hits) {
    // on the right wall (plane y = 0), from x = 0.4 to 2.6
    const t0 = 0.45, t1 = Math.min(2.7, cols - 0.3), h0 = 22, h1 = 60;
    const [ax, ay] = P(t0, 0), [bx, by] = P(t1, 0);
    poly(ctx, [[ax, ay - h1], [bx, by - h1], [bx, by - h0], [ax, ay - h0]], c.boardTrim);
    poly(ctx, [[ax + 1.5, ay - h1 + 1.5], [bx - 1.5, by - h1 + 1], [bx - 1.5, by - h0 - 1], [ax + 1.5, ay - h0 - 0.5]], c.board);
    ctx.save();
    ctx.transform(1, 0.5, 0, 1, ax + 5, ay - h1 + 5);
    ctx.fillStyle = '#2a2f38'; ctx.font = 'bold 8px sans-serif';
    ctx.fillText(`Turn ${g.turn}`, 0, 8);
    ctx.font = '7px sans-serif';
    ctx.fillText(`authority ${g.authority}`, 0, 17);
    // research tree: 6 dots, filled when known
    const known = g.known;
    RULES.TOPICS.forEach((tp, i) => {
      const px = 2 + (i % 3) * 12, py = 24 + Math.floor(i / 3) * 8;
      ctx.beginPath(); ctx.arc(px + 2, py, 2.2, 0, Math.PI * 2);
      ctx.fillStyle = known.has(tp.id) ? '#3f7fd6' : 'rgba(0,0,0,0)'; ctx.fill();
      ctx.strokeStyle = '#3f7fd6'; ctx.lineWidth = 0.8; ctx.stroke();
      if (i % 3 < 2) { ctx.beginPath(); ctx.moveTo(px + 4.5, py); ctx.lineTo(px + 11.5, py); ctx.strokeStyle = '#9aa3ad'; ctx.stroke(); }
    });
    if (g.cash < 0) {
      ctx.fillStyle = c.red; ctx.font = 'bold 7px sans-serif';
      ctx.fillText('OVERDRAWN', 0, 40 + Math.sin(t * 2) * 0.5);
    }
    ctx.restore();
    const [hx, hy] = [Math.min(ax, bx), Math.min(ay, by) - h1];
    hits.push({ x: hx, y: hy, w: Math.abs(bx - ax), h: h1 - h0 + 20, text: `Whiteboard: ${g.known.size} of ${RULES.TOPICS.length} topics mastered` });
  }

  function paperclip(ctx, sx, sy, rot, shade) {
    ctx.save(); ctx.translate(sx, sy); ctx.rotate(rot);
    ctx.strokeStyle = shade; ctx.lineWidth = 1.1; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-1.5, 2); ctx.lineTo(-1.5, -3); ctx.arc(0, -3, 1.5, Math.PI, 0);
    ctx.lineTo(1.5, 3.5); ctx.arc(0, 3.5, 1.5, 0, Math.PI); ctx.lineTo(-1.5, 0);
    ctx.stroke();
    ctx.restore();
  }

  // The ending. Clips pile up over the floor, then over everything else.
  function paperclips(ctx, cols, rows, n, c) {
    const shades = ['#9aa3ad', '#b8bfc7', '#7d8791', '#d0d5db'];
    let seed = 0x9e3779b9; // same scatter every frame
    const rnd = () => { seed = (seed + 0x6d2b79f5) >>> 0; let z = seed; z = Math.imul(z ^ (z >>> 15), z | 1); z ^= z + Math.imul(z ^ (z >>> 7), z | 61); return ((z ^ (z >>> 14)) >>> 0) / 4294967296; };
    for (let i = 0; i < n; i++) {
      const fx = rnd() * cols, fy = rnd() * rows, rot = rnd() * Math.PI, shade = shades[Math.floor(rnd() * shades.length)];
      const lift = Math.floor(i / 300) * 5 + rnd() * 4;
      const [sx, sy] = P(fx, fy);
      paperclip(ctx, sx, sy - lift, rot, shade);
    }
  }

  function plant(ctx, x, y, c) {
    const [sx, sy] = P(x, y);
    shadow(ctx, x, y, 6, 3, c);
    ctx.fillStyle = c.pot; ctx.fillRect(sx - 4, sy - 7, 8, 7);
    ctx.fillStyle = c.plant;
    for (const [dx, dy, r] of [[0, -12, 6], [-5, -9, 4.5], [5, -9, 4.5], [0, -17, 4]]) {
      ctx.beginPath(); ctx.arc(sx + dx, sy + dy, r, 0, Math.PI * 2); ctx.fill();
    }
  }

  // ---- scene builder -------------------------------------------------------

  function buildScene(game) {
    const staff = game.staff;
    const slots = Math.min(staff.length, 8);
    const deskRight = slots ? 3.4 + 2 * (Math.ceil(slots / 2) - 1) + 1.2 : 2.6;
    const equipStart = deskRight + 0.7;
    const widthOf = (id) => (id === 'PCR' ? 1.0 : 1.3);
    const wanted = RULES.EQUIPMENT.reduce((w, e) => w + widthOf(e.id) * Math.min(3, RULES.equipmentOwned(game, e.id).owned), 0);
    const cols = Math.min(16, Math.max(7 + 2 * Math.ceil(slots / 2), Math.ceil(equipStart + wanted + 0.4)));
    const rows = ROWS;
    const items = [];
    const seedOf = (s) => hash(s.id + s.name);
    const confName = (id) => (id ? RULES.C[id].name : null);
    const wsFor = (s, x, y) => ({ kind: s.type, x, y, name: s.name, s: RULES.S[s.type].name,
      wip: RULES.currentResearch(game, s.id).length, away: confName(s.conference), seed: seedOf(s) });
    // player desk
    items.push({ depth: 1.2 + 3.1, draw: 'ws', ws: wsFor(game.player, 1.2, 3.1) });
    for (let i = 0; i < slots; i++) {
      const x = 3.4 + 2 * Math.floor(i / 2), y = i % 2 === 0 ? 1.4 : 4.2;
      items.push({ depth: x + y, draw: 'ws', ws: wsFor(staff[i], x, y) });
    }
    // equipment along the back-right wall
    let ex = equipStart;
    const machines = [];
    for (const e of RULES.EQUIPMENT) {
      const slot = RULES.equipmentOwned(game, e.id);
      const w = widthOf(e.id);
      let shown = 0;
      while (shown < slot.owned && shown < 3 && ex + w <= cols - 0.3) {
        machines.push({ depth: ex + 0.15, draw: 'machine',
          m: { x: ex, kind: e.id, inUse: shown < slot.used, label: `${e.name}: ${slot.used} of ${slot.owned} in use` } });
        ex += w; shown += 1;
      }
      if (slot.owned > shown && machines.length) {
        const last = machines[machines.length - 1];
        last.m.label += ` (${slot.owned - shown} more ${e.name} in storage)`;
      }
    }
    items.push(...machines);
    items.push({ depth: cols - 0.6 + rows - 0.6, draw: 'plant', x: cols - 0.6, y: rows - 0.6 });
    items.sort((a, b) => a.depth - b.depth);
    const published = game.research.filter((r) => r.published)
      .map((r) => ({ journal: r.journal, journalName: RULES.J[r.journal].name, title: RULES.T[r.topic].name }));
    return { cols, rows, items, published, over: !!game.over, turn: game.turn, authority: game.player.authority,
      cash: game.player.cash, known: RULES.knownTopics(game), extraStaff: Math.max(0, staff.length - 8) };
  }

  // ---- renderer ------------------------------------------------------------

  function create(canvas, tooltip) {
    const ctx = canvas.getContext('2d');
    let scene = null, hits = [], raf = 0, start = performance.now(), overStart = 0;
    let view = { s: 1, ox: 0, oy: 0 };
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const palette = () => {
      const forced = document.documentElement.getAttribute('data-theme');
      const dark = forced ? forced === 'dark' : mq.matches;
      return dark ? DARK : LIGHT;
    };

    function layout() {
      const dpr = window.devicePixelRatio || 1;
      const W = canvas.clientWidth, H = canvas.clientHeight;
      if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
        canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      }
      if (!scene) return;
      const sw = ((scene.cols + scene.rows) * TW) / 2;
      const sh = ((scene.cols + scene.rows) * TH) / 2 + WALL_H;
      const s = Math.min((W - 24) / sw, (H - 20) / sh, 1.6);
      const ox = W / 2 - ((scene.cols - scene.rows) * TW * s) / 4;
      const oy = (H - sh * s) / 2 + WALL_H * s;
      view = { s, ox, oy, dpr, W, H };
    }

    function draw(now) {
      raf = 0;
      if (!scene) return;
      layout();
      const c = palette();
      const t = motion.matches ? 0 : (now - start) / 1000;
      const { s, ox, oy, dpr, W, H } = view;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.setTransform(dpr * s, 0, 0, dpr * s, ox * dpr, oy * dpr);
      hits = [];
      const { cols, rows } = scene;
      // walls
      const [o0x, o0y] = P(0, 0), [lx, ly] = P(0, rows), [rx, ry] = P(cols, 0);
      poly(ctx, [[o0x, o0y - WALL_H], [lx, ly - WALL_H], [lx, ly], [o0x, o0y]], c.wallL);
      poly(ctx, [[o0x, o0y - WALL_H], [rx, ry - WALL_H], [rx, ry], [o0x, o0y]], c.wallR);
      poly(ctx, [[o0x, o0y - 4], [lx, ly - 4], [lx, ly], [o0x, o0y]], c.skirt);
      poly(ctx, [[o0x, o0y - 4], [rx, ry - 4], [rx, ry], [o0x, o0y]], c.skirt);
      ctx.strokeStyle = c.wallTrim; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(o0x, o0y - WALL_H); ctx.lineTo(o0x, o0y); ctx.stroke();
      // floor
      for (let x = 0; x < cols; x++) for (let y = 0; y < rows; y++) {
        poly(ctx, [P(x, y), P(x + 1, y), P(x + 1, y + 1), P(x, y + 1)], (x + y) % 2 ? c.floorA : c.floorB, c.grid);
      }
      wallFrames(ctx, scene.published, rows, c, hits);
      whiteboard(ctx, scene, cols, c, t, hits);
      for (const it of scene.items) {
        if (it.draw === 'ws') workstation(ctx, it.ws, c, t, hits, view);
        else if (it.draw === 'machine') machine(ctx, it.m, c, t, hits);
        else if (it.draw === 'plant') plant(ctx, it.x, it.y, c);
      }
      if (scene.over) {
        if (!overStart) overStart = now;
        const n = motion.matches ? 900 : Math.min(900, Math.floor(((now - overStart) / 1000) * 220));
        paperclips(ctx, cols, rows, n, c);
        if (n >= 900) {
          const [px, py] = P(cols / 2, rows / 2);
          ctx.fillStyle = c.ink; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
          ctx.fillText('paperclips', px, py - 20); ctx.textAlign = 'start';
        }
      } else overStart = 0;
      if (scene.extraStaff) {
        const [px, py] = P(cols - 0.5, rows - 1.6);
        ctx.fillStyle = c.ink; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(`+${scene.extraStaff} more in the annexe`, px, py); ctx.textAlign = 'start';
      }
      const settled = scene.over && (motion.matches || now - overStart > 6000);
      if (!motion.matches && !document.hidden && !settled) raf = requestAnimationFrame(draw);
    }

    function schedule() { if (!raf) raf = requestAnimationFrame(draw); }

    function onMove(ev) {
      if (!tooltip) return;
      const r = canvas.getBoundingClientRect();
      const mx = (ev.clientX - r.left - view.ox) / view.s, my = (ev.clientY - r.top - view.oy) / view.s;
      let best = null;
      for (const h of hits) if (mx >= h.x && mx <= h.x + h.w && my >= h.y && my <= h.y + h.h) best = h;
      if (best) {
        tooltip.textContent = best.text;
        tooltip.hidden = false;
        tooltip.style.left = `${ev.clientX - r.left + 12}px`;
        tooltip.style.top = `${ev.clientY - r.top + 12}px`;
      } else tooltip.hidden = true;
    }
    function onLeave() { if (tooltip) tooltip.hidden = true; }

    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('mouseleave', onLeave);
    const ro = new ResizeObserver(schedule);
    ro.observe(canvas);
    const onVis = () => schedule();
    document.addEventListener('visibilitychange', onVis);
    mq.addEventListener('change', schedule);

    return {
      update(game) { scene = buildScene(game); schedule(); },
      destroy() {
        if (raf) cancelAnimationFrame(raf);
        ro.disconnect();
        canvas.removeEventListener('mousemove', onMove);
        canvas.removeEventListener('mouseleave', onLeave);
        document.removeEventListener('visibilitychange', onVis);
        mq.removeEventListener('change', schedule);
      },
    };
  }

  return { create };
})();
