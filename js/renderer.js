// Draws a built scene onto a 2D canvas: x-ray tints, brain sprites, glowing
// nerves with small branches and travelling "signal" pulses, and labels.
import * as G from './geom.js';

export class Renderer {
  constructor(sprites) {
    this.sprites = sprites;
  }

  // extra.skip: overlays replaced by 3D models; extra.layer3d: rendered 3D canvas.
  draw(ctx, scene, opts, time, w, h, extra = {}) {
    this.tints(ctx, scene.tints);
    if (!extra.skip?.brain) {
      for (const s of scene.sprites) this.sprite(ctx, s);
    }
    if (extra.layer3d) ctx.drawImage(extra.layer3d, 0, 0, w, h);
    for (const n of scene.nerves) this.nerve(ctx, n, opts, time);
    if (opts.labels) this.labels(ctx, scene.labels, w, h, extra.reserved || [], opts.maxLabels || 8);
  }

  tints(ctx, tints) {
    if (!tints.length) return;
    ctx.save();
    ctx.fillStyle = 'rgba(8, 18, 40, 0.38)';
    ctx.beginPath();
    for (const t of tints) {
      if (t.type === 'capsule') {
        const d = G.norm(G.sub(t.b, t.a));
        const n = G.perp(d);
        const ang = Math.atan2(n.y, n.x);
        ctx.moveTo(t.a.x + n.x * t.r, t.a.y + n.y * t.r);
        ctx.arc(t.a.x, t.a.y, t.r, ang, ang + Math.PI);
        ctx.arc(t.b.x, t.b.y, t.r, ang + Math.PI, ang + 2 * Math.PI);
        ctx.closePath();
      } else if (t.type === 'ellipse') {
        ctx.moveTo(t.c.x + t.rx * Math.cos(t.rot), t.c.y + t.rx * Math.sin(t.rot));
        ctx.ellipse(t.c.x, t.c.y, t.rx, t.ry, t.rot, 0, Math.PI * 2);
      } else if (t.type === 'poly') {
        t.pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
        ctx.closePath();
      }
    }
    ctx.fill('nonzero');
    ctx.restore();
  }

  sprite(ctx, s) {
    const img = this.sprites[s.view];
    if (!img) return;
    ctx.save();
    ctx.translate(s.c.x, s.c.y);
    ctx.rotate(s.rot);
    ctx.scale(s.R * s.flip, s.R);
    ctx.globalAlpha = 0.85;
    ctx.drawImage(img, -1, -1, 2, 2);
    ctx.restore();
  }

  nerve(ctx, n, opts, time) {
    const pts = n.pts;
    const w = n.width;
    ctx.save();
    ctx.globalAlpha = n.alpha;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (n.dashed) ctx.setLineDash([w * 2.5, w * 2]);

    const path = new Path2D();
    pts.forEach((p, i) => (i ? path.lineTo(p.x, p.y) : path.moveTo(p.x, p.y)));

    let twigs = null;
    if (n.twigs && !n.dashed) twigs = this.twigs(pts, w, n.seed);

    // Outer glow, body, bright core.
    for (const [lw, style, a] of [[w * 3.2, n.color, 0.18], [w, n.color, 1], [w * 0.35, '#ffffff', 0.8]]) {
      ctx.globalAlpha = n.alpha * a;
      ctx.lineWidth = lw;
      ctx.strokeStyle = style;
      ctx.stroke(path);
      if (twigs) { ctx.lineWidth = lw * 0.45; ctx.stroke(twigs); }
    }

    if (opts.pulses && n.pulse && !n.dashed) {
      const L = G.pathLength(pts);
      if (L > 30) {
        const speed = 160; // px/s
        const count = Math.max(1, Math.round(L / 260));
        for (let k = 0; k < count; k++) {
          const d = ((time * speed + (n.seed % 997) + (k * L) / count) % L);
          const { p } = G.pointAt(pts, d);
          ctx.globalAlpha = n.alpha * 0.35;
          ctx.fillStyle = n.color;
          const r = Math.min(w, 5);
          ctx.beginPath(); ctx.arc(p.x, p.y, r * 2.4, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = n.alpha;
          ctx.fillStyle = '#ffffff';
          ctx.beginPath(); ctx.arc(p.x, p.y, r * 0.95, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
    ctx.restore();
  }

  // Small side branches along a nerve, deterministic per nerve.
  twigs(pts, w, seed) {
    const L = G.pathLength(pts);
    const spacing = Math.max(28, w * 9);
    if (L < spacing * 1.5) return null;
    const r = G.rng(seed);
    const p2 = new Path2D();
    let side = r() > 0.5 ? 1 : -1;
    for (let d = spacing * (0.6 + r() * 0.4); d < L - spacing * 0.4; d += spacing * (0.7 + r() * 0.6)) {
      const { p, tan } = G.pointAt(pts, d);
      const n = G.mul(G.perp(tan), side);
      const len = w * 3.5 + r() * w * 4;
      const tip = G.add(p, G.add(G.mul(n, len), G.mul(tan, len * 0.8)));
      const ctl = G.add(p, G.add(G.mul(n, len * 0.2), G.mul(tan, len * 0.6)));
      p2.moveTo(p.x, p.y);
      p2.quadraticCurveTo(ctl.x, ctl.y, tip.x, tip.y);
      side = -side;
    }
    return p2;
  }

  // Labels nearest the centre of view win, so whatever the visitor looks at
  // gets its names; at most maxLabels are shown to keep the view readable.
  labels(ctx, labels, w, h, reserved, maxLabels) {
    if (!labels.length) return;
    const fs = Math.round(G.clamp(Math.min(w, h) * 0.032, 11, 22));
    ctx.save();
    ctx.font = `600 ${fs}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
    ctx.textBaseline = 'middle';
    const placed = [...reserved];
    const diag = Math.hypot(w, h) / 2;
    const score = (l) => l.pri + 3 * (1 - Math.hypot(l.x - w / 2, l.y - h / 2) / diag);
    // Bilateral structures appear twice; keep the instance nearest the centre.
    const seen = new Set();
    const sorted = labels.filter((l) => l.x >= 0 && l.x <= w && l.y >= 0 && l.y <= h)
      .sort((a, b) => score(b) - score(a))
      .filter((l) => !seen.has(l.text) && seen.add(l.text));
    const pad = fs * 0.45;
    const boxH = fs + pad * 1.2;
    const items = [];
    for (const l of sorted) {
      if (items.length >= maxLabels) break;
      const tw = ctx.measureText(l.text).width;
      const bw = tw + pad * 2;
      let dir = l.dir ? G.norm(l.dir) : G.norm(G.sub(l, G.v(w / 2, h / 2)));
      if (!G.len(dir)) dir = G.v(1, 0);
      const reach = fs * 2.6;
      let bx = l.x + dir.x * reach, by = l.y + dir.y * reach;
      bx = dir.x >= 0 ? bx : bx - bw;
      let box = null;
      for (let tries = 0; tries < 9 && !box; tries++) {
        const off = tries === 0 ? 0 : Math.ceil(tries / 2) * (boxH + 2) * (tries % 2 ? 1 : -1);
        const cand = {
          x: G.clamp(bx, 2, w - bw - 2),
          y: G.clamp(by - boxH / 2 + off, 2, h - boxH - 2),
          w: bw, h: boxH,
        };
        if (!placed.some((p) => overlap(p, cand))) box = cand;
      }
      if (!box) continue;
      placed.push(box);
      items.push({ l, box, tw });
    }
    for (const { l, box } of items) {
      const ex = l.x < box.x ? box.x : l.x > box.x + box.w ? box.x + box.w : l.x;
      const ey = box.y + box.h / 2;
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(l.x, l.y); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.fillStyle = l.color;
      ctx.beginPath(); ctx.arc(l.x, l.y, 3.5, 0, Math.PI * 2); ctx.fill();
    }
    for (const { l, box } of items) {
      ctx.fillStyle = 'rgba(6, 12, 28, 0.78)';
      roundRect(ctx, box.x, box.y, box.w, box.h, box.h / 2);
      ctx.fill();
      ctx.strokeStyle = l.color;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.fillText(l.text, box.x + pad, box.y + box.h / 2 + 1);
    }
    ctx.restore();
  }
}

function overlap(a, b) {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
