// Demo mode: an animated synthetic person (front, side, back, then a close-up
// hand) so the overlays can be checked without a camera or a volunteer.
// Open index.html?demo to use it.
export const DEMO_W = 1280, DEMO_H = 720;

const PHASES = [
  { name: 'front', dur: 8 },
  { name: 'side', dur: 6 },
  { name: 'back', dur: 7 },
  { name: 'hand', dur: 6 },
];

export function demoPhase(t, forced) {
  if (forced) return PHASES.find((p) => p.name === forced) ? forced : 'front';
  const total = PHASES.reduce((a, p) => a + p.dur, 0);
  let x = t % total;
  for (const p of PHASES) { if (x < p.dur) return p.name; x -= p.dur; }
  return 'front';
}

const P = (x, y, v = 0.95) => ({ x: x / DEMO_W, y: y / DEMO_H, v });

function body(t, view) {
  const cx = 640 + Math.sin(t * 0.6) * 25;
  const sway = Math.sin(t * 1.3) * 6;
  const raise = (Math.sin(t * 0.9) + 1) / 2; // 0..1 arm raise
  const lm = new Array(33);
  // In the front view the person's left side is on the image right.
  const s = view === 'back' ? -1 : 1;
  const sideView = view === 'side';
  const w = sideView ? 0.18 : 1;
  const X = (dx) => cx + dx * s * w;

  // Head.
  const faceVis = view === 'back' ? 0.08 : 0.97;
  const nose = sideView ? P(cx + 42, 112) : P(X(0) + sway * 0.3, 112, faceVis);
  lm[0] = nose;
  if (sideView) {
    lm[1] = P(cx + 30, 98, 0.9); lm[2] = P(cx + 26, 98, 0.9); lm[3] = P(cx + 18, 99, 0.9);
    lm[4] = P(cx + 33, 98, 0.3); lm[5] = P(cx + 31, 98, 0.3); lm[6] = P(cx + 28, 99, 0.3);
    lm[7] = P(cx - 18, 106, 0.95); lm[8] = P(cx - 10, 106, 0.1);
    lm[9] = P(cx + 32, 134, 0.9); lm[10] = P(cx + 36, 134, 0.4);
  } else {
    lm[1] = P(X(9), 98, faceVis); lm[2] = P(X(18), 98, faceVis); lm[3] = P(X(27), 99, faceVis);
    lm[4] = P(X(-9), 98, faceVis); lm[5] = P(X(-18), 98, faceVis); lm[6] = P(X(-27), 99, faceVis);
    lm[7] = P(X(44), 108); lm[8] = P(X(-44), 108);
    lm[9] = P(X(12), 134, faceVis); lm[10] = P(X(-12), 134, faceVis);
  }
  // Shoulders, arms (left arm waves).
  lm[11] = P(X(85), 190); lm[12] = P(X(-85), 190);
  const le = { x: X(100 + 50 * raise), y: 300 - 70 * raise };
  const lw = { x: X(112 + 120 * raise), y: 405 - 250 * raise };
  lm[13] = P(le.x, le.y); lm[15] = P(lw.x, lw.y);
  lm[17] = P(lw.x + 14 * s * w, lw.y + 22 - 40 * raise); lm[19] = P(lw.x + 4 * s * w, lw.y + 30 - 60 * raise); lm[21] = P(lw.x - 8 * s * w, lw.y + 20 - 40 * raise);
  lm[14] = P(X(-102), 302); lm[16] = P(X(-112), 410);
  lm[18] = P(X(-124), 432); lm[20] = P(X(-114), 442); lm[22] = P(X(-100), 430);
  // Hips and legs.
  lm[23] = P(X(55), 420); lm[24] = P(X(-55), 420);
  lm[25] = P(X(60), 560); lm[26] = P(X(-60), 560);
  lm[27] = P(X(62), 688); lm[28] = P(X(-62), 688);
  lm[29] = P(X(60), 700); lm[30] = P(X(-60), 700);
  lm[31] = P(X(72), 712, 0.8); lm[32] = P(X(-72), 712, 0.8);

  const faces = view === 'back' ? [] : [{ x: (cx - 40) / DEMO_W, y: 70 / DEMO_H, w: 80 / DEMO_W, h: 85 / DEMO_H }];
  return { poses: [lm], hands: [], faces };
}

function hand(t) {
  const ox = 640 + Math.sin(t * 0.8) * 40, oy = 640;
  const a = Math.sin(t * 0.5) * 0.12;
  const R = (x, y) => {
    const dx = x - 640, dy = y - 640;
    return { x: (ox + dx * Math.cos(a) - dy * Math.sin(a)) / DEMO_W, y: (oy + dx * Math.sin(a) + dy * Math.cos(a)) / DEMO_H };
  };
  // A right hand, palm toward the camera, fingers up.
  const pts = [
    [640, 640],
    [585, 600], [545, 545], [520, 495], [500, 455],
    [590, 455], [580, 360], [575, 300], [572, 255],
    [635, 445], [635, 340], [635, 275], [635, 225],
    [680, 455], [688, 360], [692, 300], [695, 255],
    [718, 475], [735, 400], [745, 355], [752, 315],
  ];
  // MediaPipe labels assume a mirrored image, so a real right hand reads 'Left'.
  return { poses: [], hands: [{ lm: pts.map(([x, y]) => R(x, y)), label: 'Left' }], faces: [] };
}

// Test case for false detections: a close-up hand plus the kind of skeleton
// BlazePose hallucinates around it (a "head" on the fingers, shoulders off-screen).
function handWithGhostPose(t) {
  const frame = hand(t);
  const h = frame.hands[0].lm;
  const lm = new Array(33).fill(null).map(() => ({ x: 0.5, y: 1.4, v: 0.2 }));
  const at = (i, p, v = 0.9) => { lm[i] = { x: p.x, y: p.y, v }; };
  at(0, h[12]); at(2, h[11]); at(5, h[15]); at(3, h[10]); at(6, h[16]);
  at(7, h[6]); at(8, h[19]); at(9, h[9], 0.8); at(10, h[13], 0.8);
  at(11, { x: 0.25, y: 1.05 }); at(12, { x: 0.85, y: 1.05 });
  at(13, { x: 0.2, y: 1.6 }, 0.6); at(14, { x: 0.9, y: 1.6 }, 0.6);
  return { ...frame, poses: [lm] };
}

export function demoFrame(t, forced) {
  if (forced === 'ghost') return handWithGhostPose(t);
  const phase = demoPhase(t, forced);
  return phase === 'hand' ? hand(t) : body(t, phase);
}

// Draw a simple mannequin so the overlay has a body to sit on.
export function drawMannequin(ctx, input, toPx, scale) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const skin = '#c99a84';
  for (const lm of input.poses) {
    const p = (i) => toPx(lm[i]);
    const limb = (a, b, w) => {
      ctx.lineWidth = w * scale; ctx.strokeStyle = skin;
      ctx.beginPath(); ctx.moveTo(p(a).x, p(a).y); ctx.lineTo(p(b).x, p(b).y); ctx.stroke();
    };
    ctx.fillStyle = skin;
    ctx.beginPath();
    [11, 12, 24, 23].forEach((i, k) => (k ? ctx.lineTo(p(i).x, p(i).y) : ctx.moveTo(p(i).x, p(i).y)));
    ctx.closePath(); ctx.fill();
    ctx.lineWidth = 40 * scale; ctx.strokeStyle = skin; ctx.stroke();
    limb(11, 13, 46); limb(13, 15, 36); limb(12, 14, 46); limb(14, 16, 36);
    limb(23, 25, 70); limb(25, 27, 50); limb(24, 26, 70); limb(26, 28, 50);
    limb(27, 31, 26); limb(28, 32, 26);
    limb(15, 19, 24); limb(16, 20, 24);
    const sh = { x: (p(11).x + p(12).x) / 2, y: (p(11).y + p(12).y) / 2 };
    const ear = lm[7].v > lm[8].v ? p(7) : p(8);
    ctx.lineWidth = 34 * scale;
    ctx.beginPath(); ctx.moveTo(sh.x, sh.y); ctx.lineTo(ear.x, ear.y + 20 * scale); ctx.stroke();
    const side = Math.abs(p(11).x - p(12).x) < 60 * scale;
    ctx.beginPath();
    ctx.ellipse((p(7).x + p(8).x) / 2 + (side ? 10 * scale : 0), p(7).y - 4 * scale, (side ? 58 : 50) * scale, 64 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    if (lm[0].v > 0.5) {
      ctx.fillStyle = '#3a2a24';
      for (const i of [2, 5]) if (lm[i].v > 0.5) { ctx.beginPath(); ctx.arc(p(i).x, p(i).y, 4 * scale, 0, 7); ctx.fill(); }
    } else {
      ctx.fillStyle = '#4a3325';
      ctx.beginPath(); ctx.ellipse((p(7).x + p(8).x) / 2, p(7).y - 10 * scale, 52 * scale, 58 * scale, 0, 0, 7); ctx.fill();
    }
  }
  for (const h of input.hands) {
    const p = (i) => toPx(h.lm[i]);
    ctx.strokeStyle = skin; ctx.fillStyle = skin;
    ctx.beginPath(); [0, 1, 5, 9, 13, 17].forEach((i, k) => (k ? ctx.lineTo(p(i).x, p(i).y) : ctx.moveTo(p(i).x, p(i).y))); ctx.closePath(); ctx.fill();
    ctx.lineWidth = 60 * scale; ctx.stroke();
    for (const f of [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16], [17, 18, 19, 20]]) {
      ctx.lineWidth = 46 * scale;
      ctx.beginPath(); f.forEach((i, k) => (k ? ctx.lineTo(p(i).x, p(i).y) : ctx.moveTo(p(i).x, p(i).y))); ctx.stroke();
    }
    const w = p(0), m = p(9);
    ctx.lineWidth = 120 * scale;
    ctx.beginPath(); ctx.moveTo(w.x, w.y); ctx.lineTo(w.x + (w.x - m.x) * 3, w.y + (w.y - m.y) * 3); ctx.stroke();
  }
  ctx.restore();
}
