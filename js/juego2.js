/* ===== NEON RUSH · juego2.js =====
   Endless runner de 3 carriles con proyección en perspectiva sobre Canvas. */
(() => {
'use strict';
const cv = document.getElementById('game'), ctx = cv.getContext('2d');
const $ = id => document.getElementById(id), stage = $('stage');
const COL = { cy:'#38BDF8', vi:'#818CF8', pu:'#A855F7', pk:'#EC4899' };
const F = 6, FAR = 170, MAXH = 3, KEY = 'neonrush_longest', LANE_W = 2/3;

let W=0, H=0, dpr=1, cx=0, hz=0, gy=0, R=0, skyG, roadG, groundG, cities=[];
let best = 0; try { best = +localStorage.getItem(KEY) || 0; } catch (e) {}
const S = { state:'menu' }, parts = [], lines = [], stars = [];
let clock = 0;

/* ---------- Proyección: z = distancia al frente (0 = jugador) ---------- */
const sc = z => F / (z + F);
const px = (x, z) => cx + x * R * sc(z);
const py = (y, z) => hz + (gy - hz) * sc(z) - y * R * sc(z);
const Pt = (x, y, z) => [px(x, z), py(y, z)];
const rnd = seed => { let s = seed * 9301 % 233280 || 1; return () => (s = (s * 9301 + 49297) % 233280) / 233280; };

/* ---------- Tamaño y fondos precalculados ---------- */
function resize() {
  const r = stage.getBoundingClientRect();
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = r.width; H = r.height;
  cv.width = W * dpr; cv.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  cx = W / 2; hz = H * 0.4; gy = H * 0.86;
  R = Math.min(W * (W < H ? 0.46 : 0.27), H * 0.55);
  let g = ctx.createLinearGradient(0, 0, 0, hz);
  g.addColorStop(0, '#0F172A'); g.addColorStop(.55, '#2a1860'); g.addColorStop(1, '#9d2f8e'); skyG = g;
  g = ctx.createLinearGradient(0, hz, 0, H);
  g.addColorStop(0, '#0a1020'); g.addColorStop(1, '#1E293B'); roadG = g;
  g = ctx.createLinearGradient(0, hz, 0, H);
  g.addColorStop(0, '#1b1245'); g.addColorStop(1, '#0F172A'); groundG = g;
  cities = [makeCity(0), makeCity(1)];
}
function makeCity(layer) {          // silueta de ciudad prerenderizada
  const c = document.createElement('canvas'), w = W * 1.2;
  c.width = w * dpr; c.height = hz * dpr;
  const g = c.getContext('2d'), r = rnd(layer + 7); g.scale(dpr, dpr);
  for (let x = 0; x < w;) {
    const bw = W * (.02 + r() * .04) * (layer ? 1.3 : 1), bh = hz * (layer ? .12 + r() * .38 : .2 + r() * .5);
    g.globalAlpha = 1; g.fillStyle = layer ? '#0c1327' : '#1a2142'; g.fillRect(x, hz - bh, bw, bh);
    g.globalAlpha = layer ? .9 : .4; g.fillStyle = layer ? (r() > .5 ? COL.cy : COL.pk) : COL.vi; g.fillRect(x, hz - bh, bw, 2);
    g.globalAlpha = layer ? .8 : .25;
    for (let wy = hz - bh + 8; wy < hz - 6; wy += 9)
      for (let wx = x + 4; wx < x + bw - 4; wx += 7)
        if (r() > .72) { g.fillStyle = r() > .5 ? COL.cy : (r() > .5 ? COL.pu : COL.pk); g.fillRect(wx, wy, 3, 4); }
    x += bw + W * .004;
  }
  return c;
}
for (let i = 0; i < 80; i++) stars.push({ x:Math.random(), y:Math.random(), r:Math.random()*1.6+.6, p:Math.random()*2+.5 });
for (let i = 0; i < 46; i++) lines.push({ a:.04*Math.PI + Math.random()*.92*Math.PI, r:Math.random(), c:[COL.cy,COL.vi,COL.pk][i%3] });

/* ---------- Estado ---------- */
function reset() {
  Object.assign(S, { dist:0, speed:28, time:0, level:0, hops:MAXH, hopD:0, lane:0, x:0, h:0, vy:0, air:false,
    obs:[], scn:[], obsD:60, scnD:0, shake:0, flash:0, crashT:0, final:0, isNew:false });
  parts.length = 0;
  for (let z = FAR; z > 0; z -= 6) spawnScn(z);
}
function setState(s) { S.state = s; stage.dataset.state = s; }
function startGame() { reset(); setState('play'); }
function toMenu() { reset(); setState('menu'); $('mBest').textContent = best + ' m'; }
function togglePause() {
  if (S.state === 'play') setState('pause'); else if (S.state === 'pause') setState('play');
}

/* ---------- Generación ---------- */
function spawnScn(z) {              // edificios y árboles holográficos a los lados
  for (const side of [-1, 1]) {
    if (Math.random() < .6) {
      const inner = 1.5 + Math.random() * .7, w = .5 + Math.random() * .9, x0 = side > 0 ? inner : -inner - w;
      S.scn.push({ k:'b', x0, x1:x0 + w, h:1 + Math.random() * 4.5, z, d:4, seed:Math.random() * 1e9 | 0,
        c:[COL.cy, COL.pu, COL.pk][Math.random() * 3 | 0] });
    } else S.scn.push({ k:'t', x:side * 1.28, z, h:.42 + Math.random() * .2, d:0 });
  }
}
function spawnRow() {               // 1-2 carriles bloqueados, siempre queda uno libre
  const free = Math.floor(Math.random() * 3) - 1;
  let blocked = [-1, 0, 1].filter(l => l !== free).sort(() => Math.random() - .5);
  blocked = blocked.slice(0, Math.random() < .45 ? 2 : 1);
  for (const lane of blocked) S.obs.push({ lane, z:FAR, d:1.6, type:Math.random() < .5 ? 'low' : 'tall' });
}

/* ---------- Acciones del jugador ---------- */
function move(dir) { if (S.state === 'play') S.lane = Math.max(-1, Math.min(1, S.lane + dir)); }
function jump() {
  if (S.state !== 'play' || S.air || S.hops <= 0) return;
  S.air = true; S.vy = 1.9; S.hops--;
  const [sx, sy] = shipPos(); burst(sx, sy + R * .15, 18, [COL.cy, COL.pu], 160);
}
const shipPos = () => [cx + S.x * R * LANE_W, gy - S.h * R];
function burst(x, y, n, cols, sp) {
  for (let i = 0; i < n && parts.length < 320; i++) {
    const a = Math.random() * 6.283, v = Math.random() * sp;
    parts.push({ x, y, vx:Math.cos(a) * v, vy:Math.sin(a) * v, l:.6, m:.6, s:2 + Math.random() * 3, c:cols[i % cols.length] });
  }
}
function crash() {
  S.state = 'crash'; stage.dataset.state = 'crash';
  S.final = Math.floor(S.dist); S.shake = 1; S.crashT = .9;
  const [sx, sy] = shipPos(); burst(sx, sy, 90, [COL.pk, COL.pu, COL.cy, '#F8FAFC'], 380);
}
function gameOver() {
  S.isNew = S.final > best;
  if (S.isNew) { best = S.final; try { localStorage.setItem(KEY, best); } catch (e) {} }
  $('oDist').textContent = S.final + ' m'; $('oBest').textContent = best + ' m';
  $('oNew').classList.toggle('on', S.isNew);
  setState('over');
}

/* ---------- Actualización ---------- */
function update(dt) {
  const play = S.state === 'play';
  if (S.state === 'crash') {
    S.speed *= Math.pow(.02, dt); S.shake = Math.max(0, S.shake - dt * 1.4);
    if ((S.crashT -= dt) <= 0) gameOver();
  }
  if (play) {
    S.time += dt;
    S.speed = Math.min(200, 30 + S.time * .5);                     // velocidad progresiva
    const lvl = Math.floor(S.time / 10);
    if (lvl > S.level) { S.level = lvl; S.flash = 1; toast(); }
    S.hopD += S.speed * dt; if (S.hopD >= 300) { S.hopD = 0; if (S.hops < MAXH) S.hops++; }
    S.x += (S.lane - S.x) * Math.min(1, dt * 12);                 // desplazamiento suave
    if (S.air) {                                                  // salto
      S.vy -= 5.5 * dt; S.h += S.vy * dt;
      if (S.h <= 0) { S.h = 0; S.vy = 0; S.air = false; const [sx, sy] = shipPos(); burst(sx, sy + R * .1, 10, [COL.vi, COL.cy], 120); }
    }
    S.obsD -= S.speed * dt;
    if (S.obsD <= 0) { spawnRow(); S.obsD = 16 + S.speed * .5 + Math.random() * 10; }
  }
  if (S.state !== 'pause') {
    const v = S.speed * dt;
    S.dist += v; S.scnD += v;
    while (S.scnD >= 6) { S.scnD -= 6; spawnScn(FAR + S.scnD); }
    for (const o of S.obs) o.z -= v;
    for (const s of S.scn) s.z -= v;
    S.obs = S.obs.filter(o => o.z + o.d > -3.5);
    S.scn = S.scn.filter(s => s.z + s.d > -3.5);
    S.flash = Math.max(0, S.flash - dt * 2);
  }
  if (play) {
    for (const o of S.obs)                                         // colisiones
      if (o.z < .9 && o.z + o.d > -.9 && Math.abs(S.x - o.lane) < .62 && (o.type === 'tall' || S.h < .18)) { crash(); break; }
    if (S.state === 'play' && parts.length < 300) {                // estela del motor
      const [sx, sy] = shipPos(), u = R * .15;
      for (let i = 0; i < 2; i++) parts.push({ x:sx + (i ? .8 : -.8) * u + Math.random() * 4, y:sy + u * 1.1, vx:(Math.random() - .5) * 30, vy:90 + Math.random() * 90, l:.35, m:.35, s:3 + Math.random() * 3, c:Math.random() < .5 ? COL.pk : COL.cy });
    }
  }
  for (const p of parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.l -= dt; }
  for (let i = parts.length - 1; i >= 0; i--) if (parts[i].l <= 0) parts.splice(i, 1);
  for (const l of lines) { l.r += dt * (.35 + S.speed / 60); if (l.r > 1) { l.r = 0; l.a = .04 * Math.PI + Math.random() * .92 * Math.PI; } }
}
function toast() { const t = $('toast'); t.classList.remove('show'); void t.offsetWidth; t.classList.add('show'); }

/* ---------- Dibujo ---------- */
function poly(pts, fill, stroke) {
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath(); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) ctx.stroke();
}
function quad(z0, z1, x0, x1, fill) {
  if (z1 < -3.5) return; z0 = Math.max(z0, -3.5);
  poly([Pt(x0, 0, z0), Pt(x1, 0, z0), Pt(x1, 0, z1), Pt(x0, 0, z1)], fill);
}
function box(x0, x1, h, z0, z1, c) {     // caja 3D: lateral, techo y frente
  z0 = Math.max(z0, -3.5);
  const a = Pt(x0,0,z0), b = Pt(x1,0,z0), cc = Pt(x1,h,z0), d = Pt(x0,h,z0),
        e = Pt(x0,0,z1), f = Pt(x1,0,z1), g = Pt(x1,h,z1), i = Pt(x0,h,z1);
  ctx.strokeStyle = c.edge; ctx.lineWidth = 1.3;
  if (x0 > 0) poly([a, d, i, e], c.side, true); else if (x1 < 0) poly([b, cc, g, f], c.side, true);
  if (gy - hz > h * R) poly([d, cc, g, i], c.top, true);
  poly([a, b, cc, d], c.fill, true);
  return [d, cc, a];
}
const CO = {
  low:  { fill:'rgba(236,72,153,.55)', side:'#7a1d4f', top:'rgba(244,114,182,.85)', edge:COL.pk },
  tall: { fill:'rgba(168,85,247,.5)',  side:'#4c1d95', top:'rgba(192,132,252,.85)', edge:COL.pu }
};
function drawObs(o) {
  ctx.globalAlpha = Math.min(1, (FAR - o.z) / 30);                // aparición progresiva
  const c = CO[o.type], x = o.lane * LANE_W;
  ctx.shadowColor = c.edge; ctx.shadowBlur = 14;
  box(x - .26, x + .26, o.type === 'low' ? .17 : .62, o.z, o.z + o.d, c);
  ctx.shadowBlur = 0; ctx.globalAlpha = 1;
}
function drawScn(s) {
  ctx.globalAlpha = Math.min(1, (FAR - s.z) / 30);
  if (s.k === 'b') {
    const [d, cc, a] = box(s.x0, s.x1, s.h, s.z, s.z + s.d, { fill:'#141b34', side:'#0d1328', top:'#1c2548', edge:s.c });
    const w = cc[0] - d[0], h = a[1] - d[1];
    if (w > 8 && h > 20) {                                          // ventanas
      const cols = 3, rows = Math.max(3, Math.min(12, Math.round(s.h * 3))), cw = w / cols, ch = h / rows;
      ctx.fillStyle = s.c; ctx.globalAlpha *= .85;
      for (let i = 0; i < cols * rows; i++)
        if (((Math.imul(s.seed ^ i * 2654435761, 2246822519) >>> 9) & 3) === 0)
          ctx.fillRect(d[0] + (i % cols) * cw + cw * .27, d[1] + Math.floor(i / cols) * ch + ch * .3, cw * .46, ch * .38);
    }
  } else {                                                          // árbol holográfico
    const t = Pt(s.x, 0, s.z), u = R * sc(s.z), hh = s.h * u;
    ctx.strokeStyle = COL.pk; ctx.lineWidth = Math.max(1, 2 * sc(s.z)); ctx.beginPath(); ctx.moveTo(t[0], t[1]); ctx.lineTo(t[0], t[1] - hh * .35); ctx.stroke();
    ctx.strokeStyle = COL.cy; ctx.shadowColor = COL.cy; ctx.shadowBlur = 8;
    for (let k = 0; k < 3; k++) {
      const by = t[1] - hh * (.25 + k * .25), tw = u * .17 * (1 - k * .22);
      poly([[t[0], by - hh * .4], [t[0] + tw, by], [t[0] - tw, by]], 'rgba(56,189,248,.14)', true);
    }
    ctx.shadowBlur = 0;
  }
  ctx.globalAlpha = 1;
}
function drawShip() {
  if (S.state === 'crash') return;
  const u = R * .15, [sx, sy] = shipPos(), k = 1 - Math.min(.8, S.h * 2);
  ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.beginPath(); ctx.ellipse(sx, gy + u * .5, u * 1.8 * k, u * .35 * k, 0, 0, 7); ctx.fill();
  let g = ctx.createRadialGradient(sx, sy + u, 0, sx, sy + u, u * 3.2);
  g.addColorStop(0, 'rgba(56,189,248,.35)'); g.addColorStop(1, 'rgba(56,189,248,0)');
  ctx.fillStyle = g; ctx.fillRect(sx - u * 3.2, sy - u * 2.2, u * 6.4, u * 6.4);
  ctx.save(); ctx.translate(sx, sy); ctx.rotate((S.lane - S.x) * .3);
  g = ctx.createLinearGradient(0, -1.6 * u, 0, 1.1 * u); g.addColorStop(0, COL.cy); g.addColorStop(1, COL.pu);
  ctx.shadowColor = COL.cy; ctx.shadowBlur = 12; ctx.strokeStyle = COL.cy; ctx.lineWidth = 1.5;
  const B = [[0,-1.6],[1.1,.2],[2,.9],[1.2,1.1],[0,.7],[-1.2,1.1],[-2,.9],[-1.1,.2]].map(p => [p[0] * u, p[1] * u]);
  poly(B, g, true); ctx.shadowBlur = 0;
  poly([[0,-1.6*u],[.35*u,-.1*u],[-.35*u,-.1*u]], 'rgba(248,250,252,.35)');
  ctx.fillStyle = 'rgba(248,250,252,.85)'; ctx.beginPath(); ctx.ellipse(0, 0, u * .22, u * .4, 0, 0, 7); ctx.fill();
  ctx.globalCompositeOperation = 'lighter';
  for (const ex of [-.8, .8]) {
    const r = u * .6 * (.8 + Math.random() * .4); g = ctx.createRadialGradient(ex * u, 1.05 * u, 0, ex * u, 1.05 * u, r);
    g.addColorStop(0, 'rgba(236,72,153,.95)'); g.addColorStop(1, 'rgba(236,72,153,0)');
    ctx.fillStyle = g; ctx.fillRect(ex * u - r, 1.05 * u - r, r * 2, r * 2);
  }
  ctx.restore(); ctx.globalCompositeOperation = 'source-over';
}
function render() {
  ctx.save();
  if (S.shake > 0) ctx.translate((Math.random() - .5) * S.shake * 14, (Math.random() - .5) * S.shake * 14);
  // cielo + estrellas
  ctx.fillStyle = skyG; ctx.fillRect(-20, -20, W + 40, hz + 20);
  ctx.fillStyle = '#F8FAFC';
  for (const s of stars) { ctx.globalAlpha = (.35 + .65 * Math.abs(Math.sin(clock * s.p + s.x * 9))) * .8; ctx.fillRect(s.x * W, s.y * hz * .9, s.r, s.r); }
  ctx.globalAlpha = 1;
  // sol synthwave con franjas animadas
  const sr = H * .17, sy = hz - sr * .3;
  let g = ctx.createRadialGradient(cx, sy, sr * .6, cx, sy, sr * 2.4);
  g.addColorStop(0, 'rgba(236,72,153,.35)'); g.addColorStop(1, 'rgba(236,72,153,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, hz);
  g = ctx.createLinearGradient(0, sy - sr, 0, sy + sr); g.addColorStop(0, COL.pu); g.addColorStop(1, COL.pk);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, sy, sr, 0, 7); ctx.fill();
  ctx.fillStyle = skyG;
  for (let i = 0; i < 6; i++) { const t = (i + (clock * .25) % 1) / 6; ctx.fillRect(cx - sr, sy + sr * (-.1 + t * 1.1), sr * 2, 1 + t * sr * .12); }
  // brillo del horizonte y ciudad en paralaje
  g = ctx.createLinearGradient(0, hz - H * .12, 0, hz); g.addColorStop(0, 'rgba(236,72,153,0)'); g.addColorStop(1, 'rgba(236,72,153,.3)');
  ctx.fillStyle = g; ctx.fillRect(0, hz - H * .12, W, H * .12);
  ctx.drawImage(cities[0], -W * .1 - S.x * W * .008, 0, W * 1.2, hz);
  ctx.drawImage(cities[1], -W * .1 - S.x * W * .02, 0, W * 1.2, hz);
  // suelo con rejilla
  ctx.fillStyle = groundG; ctx.fillRect(-20, hz, W + 40, H - hz + 20);
  ctx.fillStyle = 'rgba(56,189,248,.5)'; ctx.fillRect(0, hz, W, 1.5);
  ctx.strokeStyle = 'rgba(129,140,248,.28)'; ctx.lineWidth = 1; ctx.beginPath();
  for (let i = -12; i <= 12; i++) { ctx.moveTo(cx, hz); ctx.lineTo(cx + i * W * .22, H + 20); }
  for (let z = -(S.dist % 10); z < FAR; z += 10) if (z > -3.5) { const y = py(0, z); ctx.moveTo(0, y); ctx.lineTo(W, y); }
  ctx.stroke();
  // carretera
  const sB = (H - hz) / (gy - hz);
  poly([[cx, hz], [cx + R * sB, H + 20], [cx - R * sB, H + 20]], roadG);
  for (let z = -(S.dist % 16); z < FAR; z += 16) quad(z, z + 8, -1, 1, 'rgba(129,140,248,.07)');
  for (let z = -(S.dist % 8); z < FAR; z += 8) for (const xb of [-1/3, 1/3]) quad(z, z + 3.2, xb - .012, xb + .012, 'rgba(129,140,248,.9)');
  ctx.shadowColor = COL.cy; ctx.shadowBlur = 14; ctx.strokeStyle = COL.cy; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(cx - R * sB, H + 20); ctx.lineTo(cx, hz); ctx.lineTo(cx + R * sB, H + 20); ctx.stroke(); ctx.shadowBlur = 0;
  // líneas de velocidad
  ctx.globalCompositeOperation = 'lighter'; ctx.lineWidth = 1.5;
  const al = Math.min(.55, (S.speed - 20) / 90);
  for (const l of lines) {
    const r0 = l.r * l.r, r1 = Math.min(1.2, r0 + .04 + l.r * .08), ca = Math.cos(l.a), sa = Math.sin(l.a);
    ctx.globalAlpha = al * l.r; ctx.strokeStyle = l.c; ctx.beginPath();
    ctx.moveTo(cx + ca * r0 * W * .75, hz + sa * r0 * (H - hz) * 1.1); ctx.lineTo(cx + ca * r1 * W * .75, hz + sa * r1 * (H - hz) * 1.1); ctx.stroke();
  }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  // objetos ordenados por profundidad
  const items = [{ z:0, ship:1 }];
  for (const o of S.obs) items.push({ z:o.z, o });
  for (const s of S.scn) items.push({ z:s.z, s });
  items.sort((a, b) => b.z - a.z);
  for (const it of items) { if (it.ship) drawShip(); else if (it.o) drawObs(it.o); else drawScn(it.s); }
  // partículas luminosas
  ctx.globalCompositeOperation = 'lighter';
  for (const p of parts) { ctx.globalAlpha = Math.max(0, p.l / p.m); ctx.fillStyle = p.c; ctx.fillRect(p.x, p.y, p.s, p.s); }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  if (S.flash > 0) { ctx.fillStyle = `rgba(56,189,248,${S.flash * .18})`; ctx.fillRect(-20, -20, W + 40, H + 40); }
  ctx.restore();
}

/* ---------- HUD ---------- */
const hudEl = { d:$('hDist'), b:$('hBest'), s:$('hSpeed'), h:$('hHops') }, hudC = {};
function setT(k, v) { if (hudC[k] !== v) { hudC[k] = v; hudEl[k].textContent = v; } }
function hud() {
  const d = S.state === 'crash' ? S.final : Math.floor(S.dist);
  setT('d', d + ' m'); setT('b', Math.max(best, d) + ' m');
  setT('s', Math.round(S.speed * 3.6) + ' km/h'); setT('h', '◆'.repeat(S.hops) + '◇'.repeat(MAXH - S.hops));
}

/* ---------- Bucle principal ---------- */
let last = 0;
function frame(t) {
  const dt = Math.min(.05, (t - last) / 1000 || 0); last = t; clock = t / 1000;
  if (S.state === 'menu') S.speed = 28;
  update(dt); render(); hud();
  requestAnimationFrame(frame);
}

/* ---------- Entradas ---------- */
addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (['arrowleft','arrowright','arrowup',' '].includes(k)) e.preventDefault();
  if (e.repeat) return;
  if (k === 'arrowleft' || k === 'a') move(-1);
  else if (k === 'arrowright' || k === 'd') move(1);
  else if (k === ' ' || k === 'arrowup') jump();
  else if (k === 'p') togglePause();
  else if (k === 'enter' && (S.state === 'menu' || S.state === 'over')) startGame();
});
document.querySelectorAll('.touch button').forEach(b => b.addEventListener('pointerdown', e => {
  e.preventDefault(); const a = b.dataset.act; if (a === 'left') move(-1); else if (a === 'right') move(1); else jump();
}));
// Tras pulsar un botón se quita el foco, así Espacio/flechas siempre controlan el juego
const act = (id, fn) => $(id).addEventListener('click', e => { e.currentTarget.blur(); fn(); });
act('btnPlay', startGame); act('btnRetry', startGame); act('btnMenu', toMenu); act('btnMenu2', toMenu); act('btnResume', togglePause);
addEventListener('keyup', e => { if (e.key === ' ') e.preventDefault(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && S.state === 'play') setState('pause'); });
if (window.ResizeObserver) new ResizeObserver(resize).observe(stage); else addEventListener('resize', resize);

/* ---------- Inicio ---------- */
resize(); reset(); toMenu(); requestAnimationFrame(frame);
})();