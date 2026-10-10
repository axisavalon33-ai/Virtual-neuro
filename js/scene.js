// Turns tracked landmarks (in view pixels) into drawable anatomy:
// nerve polylines, brain sprites, translucent "x-ray" tints and labels.
import * as G from './geom.js';
import {
  COLORS, ARM_NERVES, HAND_BRANCHES, LEG_NERVES, TORSO_NERVES, BRAIN_LABELS,
} from './anatomy.js';

const VIS = 0.5;

// BlazePose landmark indices.
const P = {
  nose: 0, lEyeIn: 1, lEye: 2, lEyeOut: 3, rEyeIn: 4, rEye: 5, rEyeOut: 6, lEar: 7, rEar: 8,
  lMouth: 9, rMouth: 10, lSh: 11, rSh: 12, lEl: 13, rEl: 14, lWr: 15, rWr: 16,
  lPinky: 17, rPinky: 18, lIndex: 19, rIndex: 20, lThumb: 21, rThumb: 22,
  lHip: 23, rHip: 24, lKnee: 25, rKnee: 26, lAnk: 27, rAnk: 28, lHeel: 29, rHeel: 30, lFoot: 31, rFoot: 32,
};

const ARMS = [
  { side: 'left', sh: P.lSh, el: P.lEl, wr: P.lWr, pinky: P.lPinky, index: P.lIndex, thumb: P.lThumb },
  { side: 'right', sh: P.rSh, el: P.rEl, wr: P.rWr, pinky: P.rPinky, index: P.rIndex, thumb: P.rThumb },
];
const LEGS = [
  { side: 'left', hip: P.lHip, knee: P.lKnee, ank: P.lAnk, foot: P.lFoot },
  { side: 'right', hip: P.rHip, knee: P.rKnee, ank: P.rAnk, foot: P.rFoot },
];

// Half-width of each limb segment as a fraction of its length.
const WIDTH = { upperArm: 0.17, forearm: 0.15, thigh: 0.19, leg: 0.14, foot: 0.25 };

const ok = (p, th = VIS) => !!p && (p.v === undefined || p.v > th);

function segFrame(a, b, widthRatio, sidePt) {
  const d = G.sub(b, a);
  const L = G.len(d) || 1;
  const u = G.mul(d, 1 / L);
  let n = G.perp(u);
  if (sidePt && G.dot(n, G.sub(sidePt, a)) < 0) n = G.mul(n, -1);
  return { a, b, u, n, L, w: L * widthRatio };
}

function segPt(f, t, s) {
  return {
    x: f.a.x + f.u.x * f.L * t + f.n.x * f.w * s,
    y: f.a.y + f.u.y * f.L * t + f.n.y * f.w * s,
  };
}

function handRef(lm, r) {
  return typeof r === 'number' ? lm[r] : G.lerp(lm[r[0]], lm[r[1]], r[2]);
}

export function createScene() {
  return {
    nerves: [], sprites: [], tints: [], labels: [], regions: [],
    anchors: { heads: [], segments: [] },
  };
}

// input: { poses: [lm33[]], hands: [{ lm: lm21[], label: 'Left'|'Right' }], faces: [{ box, kps }] }
// All coordinates already in view pixels; pose landmarks carry visibility as .v
export function buildScene(input, opts = {}) {
  const out = createScene();
  const usedHands = new Set();
  for (const pose of input.poses) buildPerson(pose, input, out, usedHands, opts);
  input.hands.forEach((h, i) => { if (!usedHands.has(i)) buildLoneHand(h, out, opts); });
  return out;
}

// ---------------------------------------------------------------------------

// Remember where each body region is on screen; the caption describes the one
// nearest the centre of view (where the visitor is looking).
function addRegion(out, key, at) {
  out.regions.push({ key, x: at.x, y: at.y });
}

function addNerve(out, pts, style) {
  if (pts.length < 2) return;
  out.nerves.push({
    pts: G.smoothPath(pts, 6),
    color: style.color || COLORS.nerve,
    width: style.width,
    alpha: style.alpha ?? 1,
    dashed: !!style.dashed,
    twigs: style.twigs ?? true,
    pulse: style.pulse ?? true,
    seed: G.hash(style.id || 'n'),
  });
}

function addLabel(out, at, text, opts, extra = {}) {
  if (!opts.labels) return;
  out.labels.push({ x: at.x, y: at.y, text, dir: extra.dir || null, color: extra.color || COLORS.nerve, pri: extra.pri ?? 1 });
}

function faceStyle(face, facing, opts, base) {
  const visible = face === 'both' || face === facing;
  if (!visible && !opts.deep) return null;
  return { ...base, alpha: visible ? 1 : 0.32, dashed: !visible, visible };
}

function estimateFacing(lm, faces, headR) {
  let score = 0;
  if (ok(lm[P.lSh]) && ok(lm[P.rSh])) score += lm[P.lSh].x > lm[P.rSh].x ? 1 : -1;
  if (ok(lm[P.lHip]) && ok(lm[P.rHip])) score += lm[P.lHip].x > lm[P.rHip].x ? 0.5 : -0.5;
  const nose = lm[P.nose];
  const faceNear = faces.some((f) => G.dist(f.center, nose) < Math.max(headR * 1.2, f.size));
  if (faceNear) score += 1.5;
  else if (headR > 45) score -= 1; // the face detector should have found a face this big
  if (nose && nose.v < 0.3 && (ok(lm[P.lEar], 0.3) || ok(lm[P.rEar], 0.3))) score -= 1;
  return score >= 0 ? 'front' : 'back';
}

function headRadius(lm) {
  const est = [];
  if (ok(lm[P.lEar], 0.4) && ok(lm[P.rEar], 0.4)) est.push(G.dist(lm[P.lEar], lm[P.rEar]) * 0.63);
  if (ok(lm[P.lEar]) && ok(lm[P.lEyeOut])) est.push(G.dist(lm[P.lEar], lm[P.lEyeOut]) * 1.2);
  if (ok(lm[P.rEar]) && ok(lm[P.rEyeOut])) est.push(G.dist(lm[P.rEar], lm[P.rEyeOut]) * 1.2);
  if (ok(lm[P.lSh]) && ok(lm[P.rSh])) est.push(G.dist(lm[P.lSh], lm[P.rSh]) * 0.24);
  return est.length ? Math.max(...est) : 0;
}

function buildPerson(lm, input, out, usedHands, opts) {
  const headR = headRadius(lm);
  const facing = estimateFacing(lm, input.faces, headR);
  const shOk = ok(lm[P.lSh]) && ok(lm[P.rSh]);
  const hipOk = ok(lm[P.lHip]) && ok(lm[P.rHip]);
  const shMid = shOk ? G.mid(lm[P.lSh], lm[P.rSh]) : null;
  const hipMid = hipOk ? G.mid(lm[P.lHip], lm[P.rHip]) : null;
  const shW = shOk ? G.dist(lm[P.lSh], lm[P.rSh]) : 0;

  let center = null;
  if (shMid && hipMid) center = G.mid(shMid, hipMid);
  else if (shMid) center = G.add(shMid, G.v(0, shW * 0.6));
  else if (hipMid) center = G.add(hipMid, G.v(0, -shW * 0.6));

  const scale = Math.max(shW, headR * 3.2, 60);
  const nerveW = G.clamp(scale * 0.022, 1.6, 9);

  if (shOk) buildTorso(lm, out, opts, { facing, shMid, hipMid, shW, nerveW });
  for (const arm of ARMS) buildArm(lm, arm, input.hands, usedHands, out, opts, { facing, center, nerveW });
  for (const leg of LEGS) buildLeg(lm, leg, out, opts, { facing, center, hipMid, nerveW });
  if (headR > 0) buildHead(lm, out, opts, { facing, headR, shMid, shW });
}

// --- Arms & hands ----------------------------------------------------------

function matchHand(hands, used, wrist, maxD) {
  let best = -1, bestD = maxD;
  hands.forEach((h, i) => {
    if (used.has(i)) return;
    const d = G.dist(h.lm[0], wrist);
    if (d < bestD) { bestD = d; best = i; }
  });
  return best;
}

function handPalmFacing(lm, isRightHand) {
  const a = G.sub(lm[5], lm[0]), b = G.sub(lm[17], lm[0]);
  const cross = a.x * b.y - a.y * b.x;
  return (isRightHand ? cross > 0 : cross < 0) ? 'front' : 'back';
}

function buildArm(lm, arm, hands, usedHands, out, opts, ctx) {
  const sh = lm[arm.sh], el = lm[arm.el], wr = lm[arm.wr];
  if (!ok(sh) || !ok(el)) return;
  const frames = {};
  const medial = ctx.center || lm[arm.sh === P.lSh ? P.rSh : P.lSh];
  frames.upperArm = segFrame(sh, el, WIDTH.upperArm, medial);

  let handLm = null, handFacing = ctx.facing;
  if (ok(wr)) {
    const fl = G.dist(el, wr);
    const hi = matchHand(hands, usedHands, wr, fl * 0.45);
    let ulnarPt = medial;
    if (hi >= 0) {
      usedHands.add(hi);
      handLm = hands[hi].lm;
      ulnarPt = G.add(wr, G.sub(handLm[17], handLm[5]));
      handFacing = handPalmFacing(handLm, arm.side === 'right');
    } else if (ok(lm[arm.pinky], 0.3) && ok(lm[arm.index], 0.3)) {
      ulnarPt = G.add(wr, G.sub(lm[arm.pinky], lm[arm.index]));
    }
    frames.forearm = segFrame(el, wr, WIDTH.forearm, ulnarPt);
  }
  addRegion(out, 'arm', frames.forearm ? el : G.mid(sh, el));
  if (handLm) addRegion(out, 'hand', handLm[9]);
  out.anchors.segments.push({ name: 'upperArm', a: sh, b: el, w: frames.upperArm.w });
  if (frames.forearm) out.anchors.segments.push({ name: 'forearm', a: el, b: wr, w: frames.forearm.w });
  limbTints(out, frames, opts);
  drawLimbNerves(ARM_NERVES, frames, handLm, out, opts, { facing: ctx.facing, handFacing, nerveW: ctx.nerveW });
  if (!handLm && frames.forearm) poseHandTwigs(lm, arm, out, ctx);
}

// Without hand tracking, BlazePose still gives thumb/index/little-finger tips.
function poseHandTwigs(lm, arm, out, ctx) {
  const wr = lm[arm.wr];
  const tips = [[arm.thumb, 'radial'], [arm.index, 'median'], [arm.pinky, 'ulnar']];
  for (const [i, id] of tips) {
    if (ok(lm[i], 0.3)) addNerve(out, [wr, G.lerp(wr, lm[i], 0.5), lm[i]], { id, width: ctx.nerveW * 0.6, twigs: false });
  }
}

function buildLoneHand(hand, out, opts) {
  const lm = hand.lm;
  const size = G.dist(lm[0], lm[9]);
  if (size < 12) return;
  // The back camera is not mirrored, so MediaPipe's handedness label is inverted.
  const isRight = hand.label === 'Left';
  const handFacing = handPalmFacing(lm, isRight);
  // Extrapolate a forearm behind the wrist so forearm nerves can be shown
  // when someone looks at their own hand.
  const elbow = G.add(lm[0], G.mul(G.norm(G.sub(lm[0], lm[9])), size * 2.6));
  const frames = { forearm: segFrame(elbow, lm[0], WIDTH.forearm, G.add(lm[0], G.sub(lm[17], lm[5]))) };
  addRegion(out, 'hand', lm[9]);
  addRegion(out, 'arm', G.lerp(elbow, lm[0], 0.4));
  out.anchors.segments.push({ name: 'forearm', a: elbow, b: lm[0], w: frames.forearm.w });
  limbTints(out, frames, opts);
  const nerveW = G.clamp(size * 0.07, 1.6, 9);
  drawLimbNerves(ARM_NERVES, frames, lm, out, opts, { facing: handFacing, handFacing, nerveW });
}

function limbTints(out, frames, opts) {
  if (!opts.xray) return;
  for (const f of Object.values(frames)) out.tints.push({ type: 'capsule', a: f.a, b: f.b, r: f.w * 1.15 });
}

function drawLimbNerves(specs, frames, handLm, out, opts, ctx) {
  for (const spec of specs) {
    const style = faceStyle(spec.face, ctx.facing, opts, { id: spec.id, width: ctx.nerveW * (spec.width || 1) });
    let cur = [];
    const flush = () => { if (style) addNerve(out, cur, style); cur = []; };
    for (const p of spec.path) {
      if (p[0] === 'hand') {
        const hb = HAND_BRANCHES[p[1]];
        if (!handLm || !hb) { flush(); continue; }
        const hStyle = faceStyle(hb.face, ctx.handFacing, opts, { id: spec.id + 'h', width: ctx.nerveW * 0.7 });
        hb.branches.forEach((br, i) => {
          const pts = br.map((r) => handRef(handLm, r));
          if (i === 0) {
            // Join the forearm trunk with the facing style of the forearm.
            cur.push(pts[0]);
            flush();
          }
          if (hStyle) addNerve(out, pts, { ...hStyle, id: spec.id + i, twigs: false });
        });
        if (hb.label && hStyle?.visible) {
          addLabel(out, handRef(handLm, hb.label.at), hb.label.name, opts, { pri: 1 });
        }
        continue;
      }
      const f = frames[p[0]];
      if (!f) { flush(); continue; }
      cur.push(segPt(f, p[1], p[2]));
    }
    flush();
    if (spec.label && style?.visible) {
      const f = frames[spec.label[0]];
      if (f) {
        const at = segPt(f, spec.label[1], spec.label[2]);
        const dir = spec.label[2] >= 0 ? f.n : G.mul(f.n, -1);
        addLabel(out, at, spec.name, opts, { pri: 2, dir });
      }
    }
  }
}

// --- Legs --------------------------------------------------------------------

function buildLeg(lm, leg, out, opts, ctx) {
  const hip = lm[leg.hip], knee = lm[leg.knee], ank = lm[leg.ank], foot = lm[leg.foot];
  if (!ok(hip) || !ok(knee)) return;
  const otherHip = lm[leg.hip === P.lHip ? P.rHip : P.lHip];
  const medial = ctx.hipMid || otherHip || ctx.center;
  const frames = { thigh: segFrame(hip, knee, WIDTH.thigh, medial) };
  if (ok(ank)) {
    const legMedial = G.add(knee, G.sub(medial, hip));
    frames.leg = segFrame(knee, ank, WIDTH.leg, legMedial);
    if (ok(foot, 0.4)) frames.foot = segFrame(ank, foot, WIDTH.foot, G.add(ank, G.sub(medial, hip)));
  }
  addRegion(out, 'leg', knee);
  out.anchors.segments.push({ name: 'thigh', a: hip, b: knee, w: frames.thigh.w });
  if (frames.leg) out.anchors.segments.push({ name: 'leg', a: knee, b: ank, w: frames.leg.w });
  limbTints(out, frames, opts);
  drawLimbNerves(LEG_NERVES, frames, null, out, opts, { facing: ctx.facing, nerveW: ctx.nerveW * 1.1 });
}

// --- Torso & spinal cord -----------------------------------------------------

function buildTorso(lm, out, opts, ctx) {
  const { facing, shMid, shW } = ctx;
  let hipMid = ctx.hipMid;
  let down = G.perp(G.norm(G.sub(lm[P.lSh], lm[P.rSh])));
  if (ok(lm[P.nose], 0.3) && G.dot(down, G.sub(lm[P.nose], shMid)) > 0) down = G.mul(down, -1);
  else if (!ok(lm[P.nose], 0.3) && down.y < 0) down = G.mul(down, -1);
  if (!hipMid) hipMid = G.add(shMid, G.mul(down, shW * 1.25));
  const f = segFrame(shMid, hipMid, 0, G.add(shMid, G.sub(lm[P.lSh], lm[P.rSh])));
  f.w = shW / 2;
  const T = (t, s) => segPt(f, t, s);
  addRegion(out, facing === 'back' ? 'torso-back' : 'torso-front', T(0.4, 0));
  out.anchors.segments.push({ name: 'torso', a: shMid, b: hipMid, w: f.w });

  if (opts.xray) {
    out.tints.push({ type: 'poly', pts: [T(-0.05, 1.05), T(-0.05, -1.05), T(1.02, -0.75), T(1.02, 0.75)] });
  }
  const w = ctx.nerveW;

  for (const spec of TORSO_NERVES) {
    const style = faceStyle(spec.face, facing, opts, { id: spec.id, width: w });
    if (!style) continue;
    for (const sign of spec.mirror ? [1, -1] : [1]) {
      const n = spec.strands || 1;
      for (let k = 0; k < n; k++) {
        const off = (k - (n - 1) / 2) * 0.05;
        addNerve(out, spec.path.map(([, t, s]) => T(t + off, s * sign)), { ...style, id: spec.id + sign + k, width: w * (n > 1 ? 0.7 : 1) });
      }
    }
    if (spec.label && style.visible) {
      const [, t, s] = spec.label;
      addLabel(out, T(t, s), spec.name, opts, { pri: 2, dir: f.n });
    }
  }

  // Spinal cord (CNS) with cauda equina below L1.
  const back = facing === 'back';
  const cordStyle = { color: COLORS.cord, alpha: back ? 1 : 0.4, dashed: !back, twigs: false };
  if (back || opts.deep) {
    addNerve(out, [T(-0.28, 0), T(0, 0), T(0.3, 0), T(0.55, 0)], { ...cordStyle, id: 'cord', width: w * 2.2 });
    for (let k = 0; k < 6; k++) {
      const s = (k - 2.5) * 0.06;
      addNerve(out, [T(0.55, s * 0.2), T(0.8, s * 0.7), T(1.02, s)], { ...cordStyle, id: 'cauda' + k, width: w * 0.55, pulse: k % 2 === 0 });
    }
    if (back) {
      addLabel(out, T(0.2, 0), 'Spinal cord', opts, { pri: 3, color: COLORS.cord, dir: G.mul(f.n, -1) });
      addLabel(out, T(0.85, 0.08), 'Cauda equina', opts, { pri: 2, color: COLORS.cord, dir: f.n });
    }
  }

  // Segmental nerves: intercostal (thoracic) and lumbar spinal nerves.
  const segStyle = { color: COLORS.nerve, alpha: back ? 0.9 : 0.4, twigs: false, pulse: false };
  for (let k = 0; k < 12; k++) {
    const t0 = 0.05 + k * 0.052;
    const reach = k < 9 ? 0.9 : 0.55;
    for (const sign of [1, -1]) {
      addNerve(out, [T(t0, 0.03 * sign), T(t0 + 0.03, 0.4 * reach * sign), T(t0 + 0.08, reach * sign)], { ...segStyle, id: 'ic' + k + sign, width: w * 0.55 });
    }
  }
  addLabel(out, T(0.33, 0.62), back ? 'Spinal nerves' : 'Intercostal nerves', opts, { pri: 1, dir: f.n });
}

// --- Head & brain ------------------------------------------------------------

function buildHead(lm, out, opts, ctx) {
  const R = ctx.headR;
  const earL = lm[P.lEar], earR = lm[P.rEar];
  const eyesOk = ok(lm[P.lEye]) && ok(lm[P.rEye]);
  const mouthOk = ok(lm[P.lMouth], 0.4) && ok(lm[P.rMouth], 0.4);
  const eyeMid = eyesOk ? G.mid(lm[P.lEye], lm[P.rEye]) : null;
  const mouthMid = mouthOk ? G.mid(lm[P.lMouth], lm[P.rMouth]) : null;

  let earMid;
  if (ok(earL, 0.3) && ok(earR, 0.3)) earMid = G.mid(earL, earR);
  else if (ok(earL, 0.3)) earMid = earL;
  else if (ok(earR, 0.3)) earMid = earR;
  else if (eyeMid) earMid = eyeMid;
  else if (ctx.shMid) earMid = G.add(ctx.shMid, G.v(0, -ctx.shW * 0.55));
  else return;

  // "Up" direction of the head.
  let U = G.v(0, -1);
  if (ctx.facing !== 'back' && eyeMid && mouthMid) U = G.norm(G.sub(eyeMid, mouthMid));
  else if (ctx.shMid) U = G.norm(G.sub(earMid, ctx.shMid));
  const D = G.mul(U, -1);
  const X = G.v(-U.y, U.x); // screen-right when upright

  let view = 'front', dir = 1;
  if (ctx.facing === 'back') view = 'back';
  else if (ok(lm[P.nose], 0.4)) {
    const yaw = G.dot(G.sub(lm[P.nose], earMid), X) / R;
    const bothEars = ok(earL, 0.5) && ok(earR, 0.5);
    if (Math.abs(yaw) > 0.42 || !bothEars) { view = 'side'; dir = yaw >= 0 ? 1 : -1; }
  }

  const rot = Math.atan2(U.x, -U.y);
  let C;
  if (view === 'side') C = G.add(G.add(earMid, G.mul(U, 0.2 * R)), G.mul(X, dir * 0.12 * R));
  else C = G.add(earMid, G.mul(U, (view === 'back' ? 0.15 : 0.12) * R));

  const H = (u, v) => {
    const uu = view === 'side' ? u * dir : u;
    return G.add(C, G.add(G.mul(X, uu * R), G.mul(D, v * R)));
  };

  addRegion(out, 'head-' + view, C);
  out.anchors.heads.push({ c: C, R, rot, view, dir });
  if (opts.xray) {
    out.tints.push({ type: 'ellipse', c: H(0, -0.05), rx: R * (view === 'side' ? 1.05 : 0.88), ry: R * 1.12, rot });
  }
  const k = { front: 0.85, side: 0.95, back: 0.85 }[view];
  out.sprites.push({ view, c: C, R: R * k, rot, flip: view === 'side' && dir < 0 ? -1 : 1 });
  for (const l of BRAIN_LABELS[view]) {
    const at = H(l.u * k, l.v * k);
    addLabel(out, at, l.name, opts, { pri: 3, color: '#ff9fb4', dir: G.norm(G.sub(at, C)) });
  }

  const w = G.clamp(R * 0.04, 1.4, 7);
  if (view === 'back') {
    for (const s of [1, -1]) {
      addNerve(out, [H(0.12 * s, 1.0), H(0.25 * s, 0.65), H(0.36 * s, 0.15), H(0.32 * s, -0.45)], { id: 'gon' + s, width: w, twigs: true });
    }
    addLabel(out, H(0.36, 0.15), 'Greater occipital nerve', opts, { pri: 1, dir: X });
    return;
  }

  // Cranial nerves on the face sides that are visible.
  const sides = [
    { eye: P.lEye, out: P.lEyeOut, ear: P.lEar, mouth: P.lMouth },
    { eye: P.rEye, out: P.rEyeOut, ear: P.rEar, mouth: P.rMouth },
  ];
  let labelled = false;
  for (const s of sides) {
    const eye = lm[s.eye], eo = lm[s.out], ear = lm[s.ear], mouth = lm[s.mouth], nose = lm[P.nose];
    if (!ok(ear, 0.5) || !ok(eo, 0.5) || !ok(mouth, 0.3) || !ok(nose, 0.4)) continue;
    const Gg = G.add(G.lerp(ear, eo, 0.3), G.mul(D, 0.08 * R));
    const tri = { color: COLORS.trigeminal, width: w * 0.9, twigs: false };
    addNerve(out, [Gg, G.add(eo, G.mul(U, 0.2 * R)), G.add(eye, G.mul(U, 0.55 * R))], { ...tri, id: 'v1' });
    addNerve(out, [Gg, G.add(G.lerp(eo, eye, 0.5), G.mul(D, 0.3 * R)), G.add(G.lerp(eye, nose, 0.6), G.mul(D, 0.22 * R))], { ...tri, id: 'v2' });
    addNerve(out, [Gg, G.add(G.lerp(ear, mouth, 0.45), G.mul(D, 0.22 * R)), G.add(mouth, G.mul(D, 0.42 * R))], { ...tri, id: 'v3' });

    const F = G.add(ear, G.mul(D, 0.28 * R));
    const Pa = G.lerp(F, G.add(eo, G.mul(D, 0.6 * R)), 0.3);
    const fac = { color: COLORS.facial, width: w * 0.8, twigs: false };
    for (const end of [G.add(eo, G.mul(U, 0.45 * R)), G.add(eo, G.mul(D, 0.12 * R)), G.add(mouth, G.mul(U, 0.18 * R)), G.add(mouth, G.mul(D, 0.35 * R))]) {
      addNerve(out, [F, Pa, end], { ...fac, id: 'vii' });
    }
    addNerve(out, [F, G.add(F, G.mul(D, 0.4 * R)), G.add(F, G.mul(D, 0.8 * R))], { ...fac, id: 'vii-c' });

    if (!labelled) {
      labelled = true;
      const outward = G.norm(G.sub(ear, C));
      addLabel(out, G.add(G.lerp(eo, eye, 0.5), G.mul(D, 0.3 * R)), 'Trigeminal nerve (CN V)', opts, { pri: 2, color: COLORS.trigeminal, dir: G.mul(outward, -1) });
      addLabel(out, Pa, 'Facial nerve (CN VII)', opts, { pri: 2, color: COLORS.facial, dir: outward });
    }
  }

  // Optic nerves to the chiasm.
  const eyes = [P.lEye, P.rEye].filter((i) => ok(lm[i], 0.6));
  if (eyes.length) {
    const eyeC = eyeMid || lm[eyes[0]];
    const chi = G.add(G.lerp(eyeC, earMid, view === 'side' ? 0.45 : 0.5), G.mul(U, 0.05 * R));
    for (const i of eyes) addNerve(out, [lm[i], G.lerp(lm[i], chi, 0.5), chi], { id: 'ii', color: COLORS.cranial, width: w, twigs: false });
    addNerve(out, [chi, G.add(chi, G.mul(D, 0.05 * R)), G.add(earMid, G.mul(U, 0.1 * R))], { id: 'ot', color: COLORS.cranial, width: w * 0.8, twigs: false });
    addLabel(out, G.lerp(lm[eyes[0]], chi, 0.5), 'Optic nerve (CN II)', opts, { pri: 2, color: COLORS.cranial, dir: U });
  }
}
