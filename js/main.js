import { resolveAssets } from './config.js';
import { Tracker } from './tracker.js';
import { buildScene, focusScene, createScene } from './scene.js';
import { FocusTracker } from './focus.js';
import { Renderer } from './renderer.js';
import { createBrainSprites } from './brain.js';
import { ModelLayer } from './model3d.js';
import { REGION_INFO } from './anatomy.js';
import { demoFrame, drawMannequin, DEMO_W, DEMO_H } from './demo.js';

const params = new URLSearchParams(location.search);
const $ = (id) => document.getElementById(id);

const DEFAULTS = { vr: false, labels: true, pulses: true, deep: true, xray: true, info: true, showAll: false, debug: false };
const settings = { ...DEFAULTS, ...loadSettings() };
if (params.has('vr')) settings.vr = params.get('vr') !== '0';

const REGION_TITLES = {
  'head-front': 'Head: front view', 'head-side': 'Head: side view', 'head-back': 'Head: back view',
  hand: 'Hand & arm', arm: 'Arm', 'torso-front': 'Chest', 'torso-back': 'Back', leg: 'Leg',
};
const GROUP_NAMES = { head: 'head', arm: 'arm / hand', torso: 'body', leg: 'leg' };

const display = $('stage');
const dctx = display.getContext('2d');
const view = document.createElement('canvas');
const vctx = view.getContext('2d');
const video = $('video');

let tracker = null, modelLayer = null, demo = false, running = false;
let lastVideoTime = -1, lastInput = { poses: [], hands: [], faces: [] };
let fps = 0, lastFrame = performance.now();
const renderer = new Renderer(createBrainSprites());
const focus = new FocusTracker();

function loadSettings() {
  try { return JSON.parse(localStorage.getItem('neuro-ar-settings') || '{}'); } catch { return {}; }
}
function saveSettings() {
  try { localStorage.setItem('neuro-ar-settings', JSON.stringify(settings)); } catch { /* private mode */ }
}

// --- UI -------------------------------------------------------------------------

function bindToggles() {
  for (const key of Object.keys(DEFAULTS)) {
    const el = $('opt-' + key);
    if (!el) continue;
    el.checked = settings[key];
    el.addEventListener('change', () => {
      settings[key] = el.checked;
      saveSettings();
      if (key === 'vr' && settings.vr && running) enterImmersive();
      if (key === 'vr') syncGear();
    });
  }
}

function status(msg) { $('status').textContent = msg; }

async function enterImmersive() {
  try { if (!document.fullscreenElement) await document.documentElement.requestFullscreen?.({ navigationUI: 'hide' }); } catch { /* iOS */ }
  try { await screen.orientation?.lock?.('landscape'); } catch { /* not supported */ }
}

let wakeLock = null;
async function keepAwake() {
  try { wakeLock = await navigator.wakeLock?.request('screen'); } catch { /* not supported */ }
}
document.addEventListener('visibilitychange', () => { if (running && document.visibilityState === 'visible') keepAwake(); });

async function start(useDemo) {
  $('start-camera').disabled = $('start-demo').disabled = true;
  demo = useDemo;
  try {
    const assetsFrom = await resolveAssets();
    modelLayer = await ModelLayer.create().catch((e) => { console.warn(e); return null; });
    if (!demo) {
      status('Opening back camera…');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      video.srcObject = stream;
      await video.play();
      tracker = await Tracker.create(status);
      console.info('Vision assets loaded from', assetsFrom);
    }
    if (settings.vr) await enterImmersive();
    keepAwake();
    $('menu').hidden = true;
    running = true;
    syncGear();
  } catch (e) {
    console.error(e);
    status(explainError(e));
    $('start-camera').disabled = $('start-demo').disabled = false;
  }
}

function explainError(e) {
  if (!window.isSecureContext) return 'The camera needs HTTPS (or localhost). Open the app from an https:// address.';
  if (e && e.name === 'NotAllowedError') return 'Camera permission was denied. Allow camera access and try again.';
  if (e && e.name === 'NotFoundError') return 'No camera found on this device.';
  return 'Could not start: ' + (e && e.message ? e.message : e) + '. Check your internet connection or use offline assets (see README).';
}

$('start-camera').addEventListener('click', () => start(false));
$('start-demo').addEventListener('click', () => start(true));
$('gear').addEventListener('click', (ev) => { ev.stopPropagation(); $('menu').hidden = !$('menu').hidden; });
$('close-menu').addEventListener('click', () => { if (running) $('menu').hidden = true; });
// In a headset the screen can't be reached, so a tap anywhere toggles the menu.
display.addEventListener('click', () => { if (running) $('menu').hidden = !$('menu').hidden; });
bindToggles();
if (params.has('demo')) start(true);

// --- Frame loop -------------------------------------------------------------------------

function frame(now) {
  requestAnimationFrame(frame);
  const t = now / 1000;
  fps = fps * 0.9 + (1000 / Math.max(1, now - lastFrame)) * 0.1;
  lastFrame = now;

  const W = window.innerWidth, H = window.innerHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  if (display.width !== Math.round(W * dpr) || display.height !== Math.round(H * dpr)) {
    display.width = Math.round(W * dpr);
    display.height = Math.round(H * dpr);
  }
  const vr = settings.vr && running;
  const vw = vr ? W / 2 : W, vh = H;
  if (view.width !== Math.round(vw * dpr) || view.height !== Math.round(vh * dpr)) {
    view.width = Math.round(vw * dpr);
    view.height = Math.round(vh * dpr);
  }
  vctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  vctx.fillStyle = '#05070d';
  vctx.fillRect(0, 0, vw, vh);

  if (!running) { blit(vr, vw, dpr); return; }

  let srcW, srcH, input;
  if (demo) {
    srcW = DEMO_W; srcH = DEMO_H;
    input = demoFrame(t, params.get('demo') || null);
  } else {
    srcW = video.videoWidth; srcH = video.videoHeight;
    if (!srcW) { blit(vr, vw, dpr); return; }
    if (video.currentTime !== lastVideoTime) {
      lastVideoTime = video.currentTime;
      try { lastInput = tracker.detect(video); } catch (e) { console.warn(e); }
    }
    input = lastInput;
  }

  // Cover-fit the camera image into the eye view.
  // In demo mode ?zoom=3&at=0.5,0.15 frames a close-up like a visitor looking at one body part.
  const zoom = demo ? Number(params.get('zoom')) || 1 : 1;
  const [ax, ay] = demo && params.get('at') ? params.get('at').split(',').map(Number) : [0.5, 0.5];
  const sc = Math.max(vw / srcW, vh / srcH) * zoom;
  const dw = srcW * sc, dh = srcH * sc, ox = vw / 2 - ax * dw, oy = vh / 2 - ay * dh;
  const toPx = (p) => ({ x: ox + p.x * dw, y: oy + p.y * dh, v: p.v });

  if (demo) {
    const g = vctx.createLinearGradient(0, 0, 0, vh);
    g.addColorStop(0, '#1b2333'); g.addColorStop(1, '#0b0f18');
    vctx.fillStyle = g; vctx.fillRect(0, 0, vw, vh);
    drawMannequin(vctx, input, toPx, sc);
  } else {
    vctx.drawImage(video, ox, oy, dw, dh);
  }

  const mapped = {
    poses: input.poses.map((lm) => lm.map(toPx)),
    hands: input.hands.map((h) => ({ lm: h.lm.map(toPx), label: h.label })),
    faces: input.faces.map((f) => ({ center: toPx({ x: f.x + f.w / 2, y: f.y + f.h / 2 }), size: Math.max(f.w * dw, f.h * dh) })),
    faceDetector: demo || !!tracker?.face,
  };
  const scene = buildScene(mapped, { ...settings, view: { w: vw, h: vh } });

  // Step 1: decide which body part is in view. Step 2: show only its nerves.
  const f = focus.update(scene.regions, vw, vh, t);
  let shown, reveal = 1, key = null;
  if (settings.showAll) {
    shown = scene;
    key = f.current?.key || null;
  } else if (f.current) {
    shown = focusScene(scene, f.current.group);
    reveal = Math.min(1, (t - f.current.since) / 1.2);
    key = f.current.key;
  } else {
    shown = createScene();
  }

  let layer3d = null, skip = {};
  if (modelLayer) {
    layer3d = modelLayer.update(shown, vw, vh, dpr);
    skip = modelLayer.replaces(shown);
  }
  const cap = settings.info && key ? layoutCaption(key, vw, vh) : null;
  renderer.draw(vctx, shown, { ...settings, maxLabels: vr ? 6 : 8 }, t, vw, vh, { skip, layer3d, reveal, reserved: cap ? [cap.box] : [] });
  if (cap) drawCaption(cap);
  if (f.current) drawBadge(REGION_TITLES[f.current.key] || f.current.group, vw, vh, t - f.current.since);
  else drawScanner(f, vw, vh, t);
  if (settings.debug) { vctx.fillStyle = '#9fb3d9'; vctx.font = '12px monospace'; vctx.fillText(`${fps.toFixed(0)} fps`, 8, 16); }
  if (settings.debug) debugDraw(mapped);
  blit(vr, vw, dpr);
}

function syncGear() { $('gear').hidden = !running || settings.vr; }

function blit(vr, vw, dpr) {
  dctx.setTransform(1, 0, 0, 1, 0, 0);
  dctx.fillStyle = '#000';
  dctx.fillRect(0, 0, display.width, display.height);
  dctx.drawImage(view, 0, 0);
  if (vr) {
    dctx.drawImage(view, Math.round(vw * dpr), 0);
    dctx.fillStyle = '#000';
    dctx.fillRect(Math.round(vw * dpr) - dpr, 0, 2 * dpr, display.height);
  }
}

function layoutCaption(region, w, h) {
  const fs = Math.round(Math.max(11, Math.min(w, h) * 0.03));
  const font = `600 ${fs}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  const bodyFont = `${Math.round(fs * 0.85)}px system-ui, sans-serif`;
  const title = REGION_TITLES[region];
  const body = REGION_INFO[region] + (settings.pulses ? ' Moving lights are nerve impulses.' : '');
  const maxW = Math.min(w * 0.86, fs * 34);
  const lines = body ? wrap(vctx, body, maxW, bodyFont) : [];
  const lh = fs * 1.15;
  const boxH = lh * (1 + lines.length * 0.88) + fs * 0.8;
  const boxW = maxW + fs;
  const box = { x: (w - boxW) / 2, y: h * 0.95 - boxH, w: boxW, h: boxH };
  return { box, fs, font, bodyFont, title, lines, lh };
}

function drawCaption({ box, fs, font, bodyFont, title, lines, lh }) {
  const ctx = vctx;
  ctx.save();
  ctx.fillStyle = 'rgba(6, 12, 28, 0.72)';
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(box.x, box.y, box.w, box.h, fs * 0.6); else ctx.rect(box.x, box.y, box.w, box.h);
  ctx.fill();
  ctx.textBaseline = 'top';
  ctx.font = font;
  ctx.fillStyle = '#ffd447';
  ctx.fillText(title, box.x + fs / 2, box.y + fs * 0.4);
  ctx.font = bodyFont;
  ctx.fillStyle = '#e8eefc';
  lines.forEach((ln, i) => ctx.fillText(ln, box.x + fs / 2, box.y + fs * 0.4 + lh + i * lh * 0.88));
  ctx.restore();
}

const uiFont = (px, weight = 600) => `${weight} ${Math.round(px)}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;

// Shown while nothing has been recognised yet: a scanning reticle.
function drawScanner(f, w, h, t) {
  const ctx = vctx;
  const r = Math.min(w, h) * 0.16;
  const cx = w / 2, cy = h / 2;
  ctx.save();
  ctx.strokeStyle = 'rgba(120, 220, 255, 0.9)';
  ctx.lineWidth = 3;
  const k = r * 0.35;
  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    ctx.beginPath();
    ctx.moveTo(cx + sx * r, cy + sy * (r - k)); ctx.lineTo(cx + sx * r, cy + sy * r); ctx.lineTo(cx + sx * (r - k), cy + sy * r);
    ctx.stroke();
  }
  ctx.globalAlpha = 0.6;
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.7, t * 3, t * 3 + 1.2); ctx.stroke();
  const sweep = cy - r + ((t * 0.8) % 1) * 2 * r;
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = 'rgba(120, 220, 255, 1)';
  ctx.fillRect(cx - r, sweep - 1, 2 * r, 2);
  if (f.pendingGroup) {
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#8dff9e';
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.85, -Math.PI / 2, -Math.PI / 2 + f.progress * Math.PI * 2); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const fs = Math.max(12, Math.min(w, h) * 0.035);
  ctx.font = uiFont(fs);
  ctx.fillStyle = '#e8eefc';
  const msg = f.pendingGroup ? `Detecting ${GROUP_NAMES[f.pendingGroup]}…` : 'Scanning… look at a hand, arm, head, back or leg';
  ctx.fillText(msg, cx, cy + r + fs * 0.6);
  ctx.restore();
}

// "Detected: …" badge at the top of the view.
function drawBadge(text, w, h, age) {
  const ctx = vctx;
  const fs = Math.max(12, Math.min(w, h) * 0.034);
  ctx.save();
  ctx.font = uiFont(fs);
  const label = `Detected: ${text}`;
  const tw = ctx.measureText(label).width;
  const bw = tw + fs * 2.4, bh = fs * 1.9;
  const x = (w - bw) / 2, y = h * 0.04;
  ctx.globalAlpha = Math.min(1, age * 3);
  ctx.fillStyle = 'rgba(6, 12, 28, 0.78)';
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, bw, bh, bh / 2); else ctx.rect(x, y, bw, bh);
  ctx.fill();
  ctx.strokeStyle = '#8dff9e'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#8dff9e';
  ctx.beginPath(); ctx.arc(x + fs * 0.95, y + bh / 2, fs * 0.3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + fs * 1.6, y + bh / 2 + 1);
  ctx.restore();
}

function wrap(ctx, text, maxW, font) {
  ctx.save();
  ctx.font = font;
  const words = text.split(' ');
  const lines = [];
  let cur = '';
  for (const wd of words) {
    const test = cur ? cur + ' ' + wd : wd;
    if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = wd; } else cur = test;
  }
  if (cur) lines.push(cur);
  ctx.restore();
  return lines;
}

function debugDraw(mapped) {
  const ctx = vctx;
  ctx.save();
  for (const lm of mapped.poses) {
    lm.forEach((p, i) => {
      ctx.fillStyle = p.v > 0.5 ? '#00e5ff' : 'rgba(255,80,80,0.6)';
      ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = '9px monospace'; ctx.fillText(String(i), p.x + 4, p.y - 4);
    });
  }
  for (const h of mapped.hands) {
    ctx.fillStyle = '#ff00d4';
    h.lm.forEach((p) => { ctx.beginPath(); ctx.arc(p.x, p.y, 2.5, 0, 7); ctx.fill(); });
  }
  ctx.strokeStyle = '#7CFC00';
  for (const f of mapped.faces) { ctx.strokeRect(f.center.x - f.size / 2, f.center.y - f.size / 2, f.size, f.size); }
  ctx.restore();
}

requestAnimationFrame(frame);
