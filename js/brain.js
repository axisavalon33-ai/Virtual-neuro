// Procedurally drawn, semi-transparent brain illustrations (front, side, back).
// Each sprite covers the unit square [-1, 1]^2 and is generated once at start-up.
import { rng } from './geom.js';

const SIZE = 640;
const BASE = '#f7b3bf';
const SULCUS = 'rgba(140, 40, 70, 0.55)';
const HILITE = 'rgba(255, 235, 240, 0.35)';
const STEM = '#f0c08f';
const CEREBELLUM = '#c995e0';

const LOBES = {
  frontal: 'rgba(80, 140, 255, 0.45)',
  parietal: 'rgba(255, 205, 70, 0.45)',
  temporal: 'rgba(60, 220, 150, 0.45)',
  occipital: 'rgba(255, 90, 140, 0.45)',
};

function canvas() {
  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  const ctx = c.getContext('2d');
  ctx.setTransform(SIZE / 2, 0, 0, SIZE / 2, SIZE / 2, SIZE / 2);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  return [c, ctx];
}

function ellipse(ctx, x, y, rx, ry, rot = 0) {
  ctx.moveTo(x + rx * Math.cos(rot), y + rx * Math.sin(rot));
  ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
}

function poly(ctx, pts) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
}

// Wandering folds to suggest gyri and sulci, clipped to the current clip path.
function gyri(ctx, seed, box, count = 70) {
  const r = rng(seed);
  const [x0, y0, x1, y1] = box;
  for (let i = 0; i < count; i++) {
    let x = x0 + r() * (x1 - x0), y = y0 + r() * (y1 - y0);
    let a = r() * Math.PI * 2;
    const steps = 6 + Math.floor(r() * 9);
    const pts = [[x, y]];
    for (let s = 0; s < steps; s++) {
      a += (r() - 0.5) * 1.6;
      x += Math.cos(a) * 0.055;
      y += Math.sin(a) * 0.055;
      pts.push([x, y]);
    }
    for (const [style, w, dx] of [[HILITE, 0.016, 0.008], [SULCUS, 0.012, 0]]) {
      ctx.beginPath();
      pts.forEach(([px, py], j) => (j ? ctx.lineTo(px + dx, py + dx) : ctx.moveTo(px + dx, py + dx)));
      ctx.strokeStyle = style;
      ctx.lineWidth = w;
      ctx.stroke();
    }
  }
}

function folia(ctx, cx, cy, rx, ry, n) {
  ctx.strokeStyle = 'rgba(80, 30, 110, 0.55)';
  ctx.lineWidth = 0.01;
  for (let i = 1; i < n; i++) {
    const y = cy - ry + (2 * ry * i) / n;
    ctx.beginPath();
    ctx.moveTo(cx - rx, y);
    ctx.quadraticCurveTo(cx, y + ry * 0.25, cx + rx, y);
    ctx.stroke();
  }
}

function rim(ctx, pathFn, color = 'rgba(255,255,255,0.75)', w = 0.018) {
  ctx.beginPath();
  pathFn();
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.stroke();
}

function shade(ctx, cx, cy, r) {
  const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.4, r * 0.1, cx, cy, r);
  g.addColorStop(0, 'rgba(255,255,255,0.18)');
  g.addColorStop(1, 'rgba(90,0,40,0.35)');
  ctx.fillStyle = g;
  ctx.fillRect(-1, -1, 2, 2);
}

function brainstemFront(ctx) {
  ctx.beginPath();
  ellipse(ctx, 0, 0.33, 0.17, 0.12);
  ctx.fillStyle = STEM;
  ctx.fill();
  poly(ctx, [[-0.075, 0.4], [0.075, 0.4], [0.05, 0.8], [0.035, 1.0], [-0.035, 1.0], [-0.05, 0.8]]);
  ctx.fill();
  ctx.strokeStyle = 'rgba(120,60,20,0.6)';
  ctx.lineWidth = 0.012;
  ctx.stroke();
}

function front() {
  const [c, ctx] = canvas();
  const shape = () => {
    ellipse(ctx, -0.4, -0.22, 0.42, 0.68);
    ellipse(ctx, 0.4, -0.22, 0.42, 0.68);
    ellipse(ctx, -0.58, 0.2, 0.22, 0.25);
    ellipse(ctx, 0.58, 0.2, 0.22, 0.25);
  };
  ctx.save();
  ctx.beginPath(); shape(); ctx.clip();
  ctx.fillStyle = BASE; ctx.fillRect(-1, -1, 2, 2);
  ctx.fillStyle = LOBES.frontal; ctx.fillRect(-1, -1, 2, 1.0);
  ctx.fillStyle = LOBES.temporal; ctx.fillRect(-1, 0.05, 0.62, 1); ctx.fillRect(0.38, 0.05, 0.62, 1);
  gyri(ctx, 11, [-0.85, -0.92, 0.85, 0.45]);
  shade(ctx, 0, -0.2, 1);
  ctx.restore();
  rim(ctx, shape);
  // Longitudinal fissure.
  ctx.beginPath(); ctx.moveTo(0, -0.9); ctx.lineTo(0, 0.12);
  ctx.strokeStyle = 'rgba(90,20,50,0.8)'; ctx.lineWidth = 0.03; ctx.stroke();
  ctx.globalAlpha = 0.9;
  brainstemFront(ctx);
  return c;
}

function side() {
  const [c, ctx] = canvas();
  // Brainstem behind the temporal lobe.
  poly(ctx, [[0.08, 0.05], [0.22, 0.3], [0.12, 0.5], [0.03, 0.62], [-0.01, 1.0], [-0.13, 1.0], [-0.12, 0.6], [-0.16, 0.35], [-0.1, 0.05]]);
  ctx.fillStyle = STEM; ctx.fill();
  ctx.strokeStyle = 'rgba(120,60,20,0.6)'; ctx.lineWidth = 0.012; ctx.stroke();

  const shape = () => {
    ellipse(ctx, 0, -0.2, 0.9, 0.62);
    ellipse(ctx, 0.08, 0.16, 0.5, 0.22);
  };
  ctx.save();
  ctx.beginPath(); shape(); ctx.clip();
  ctx.fillStyle = BASE; ctx.fillRect(-1, -1, 2, 2);
  const regions = {
    frontal: [[0.18, -1.2], [1.2, -1.2], [1.2, 0.05], [0.6, 0.05], [0.02, -0.055], [0.18, -0.85]],
    parietal: [[0.18, -1.2], [0.18, -0.85], [0.02, -0.055], [-0.35, -0.12], [-0.6, -0.15], [-0.62, -1.2]],
    occipital: [[-0.62, -1.2], [-0.6, -0.15], [-0.55, 0.5], [-1.2, 0.5], [-1.2, -1.2]],
    temporal: [[1.2, 0.05], [0.6, 0.05], [-0.35, -0.12], [-0.6, -0.15], [-0.55, 0.5], [1.2, 0.5]],
  };
  for (const [k, pts] of Object.entries(regions)) { poly(ctx, pts); ctx.fillStyle = LOBES[k]; ctx.fill(); }
  gyri(ctx, 23, [-0.95, -0.85, 0.95, 0.4], 85);
  // Central and lateral sulci.
  ctx.strokeStyle = 'rgba(90,20,50,0.85)'; ctx.lineWidth = 0.025;
  ctx.beginPath(); ctx.moveTo(0.18, -0.85); ctx.quadraticCurveTo(0.05, -0.45, 0.02, -0.055); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0.6, 0.05); ctx.quadraticCurveTo(0.1, -0.02, -0.35, -0.12); ctx.stroke();
  shade(ctx, 0.1, -0.25, 1.1);
  ctx.restore();
  rim(ctx, shape);

  // Cerebellum under the occipital lobe.
  ctx.save();
  ctx.beginPath(); ellipse(ctx, -0.52, 0.38, 0.33, 0.2); ctx.clip();
  ctx.fillStyle = CEREBELLUM; ctx.fillRect(-1, -1, 2, 2);
  folia(ctx, -0.52, 0.38, 0.35, 0.2, 9);
  ctx.restore();
  rim(ctx, () => ellipse(ctx, -0.52, 0.38, 0.33, 0.2));
  return c;
}

function back() {
  const [c, ctx] = canvas();
  // Spinal cord leaving the skull.
  poly(ctx, [[-0.07, 0.45], [0.07, 0.45], [0.05, 1.0], [-0.05, 1.0]]);
  ctx.fillStyle = STEM; ctx.fill();

  const shape = () => {
    ellipse(ctx, -0.4, -0.25, 0.44, 0.62);
    ellipse(ctx, 0.4, -0.25, 0.44, 0.62);
  };
  ctx.save();
  ctx.beginPath(); shape(); ctx.clip();
  ctx.fillStyle = BASE; ctx.fillRect(-1, -1, 2, 2);
  ctx.fillStyle = LOBES.parietal; ctx.fillRect(-1, -1, 2, 0.75);
  ctx.fillStyle = LOBES.occipital; ctx.fillRect(-1, -0.25, 2, 1);
  gyri(ctx, 37, [-0.85, -0.9, 0.85, 0.35]);
  shade(ctx, 0, -0.25, 1);
  ctx.restore();
  rim(ctx, shape);
  ctx.beginPath(); ctx.moveTo(0, -0.88); ctx.lineTo(0, 0.3);
  ctx.strokeStyle = 'rgba(90,20,50,0.8)'; ctx.lineWidth = 0.03; ctx.stroke();

  const cb = () => {
    ellipse(ctx, -0.33, 0.38, 0.36, 0.22);
    ellipse(ctx, 0.33, 0.38, 0.36, 0.22);
  };
  ctx.save();
  ctx.beginPath(); cb(); ctx.clip();
  ctx.fillStyle = CEREBELLUM; ctx.fillRect(-1, -1, 2, 2);
  folia(ctx, -0.33, 0.38, 0.38, 0.22, 9);
  folia(ctx, 0.33, 0.38, 0.38, 0.22, 9);
  ctx.restore();
  rim(ctx, cb);
  return c;
}

export function createBrainSprites() {
  return { front: front(), side: side(), back: back() };
}
