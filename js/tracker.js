// MediaPipe wrapper: body pose, hands and faces from the camera, with light
// temporal smoothing. Outputs are in normalised video coordinates (0..1).
import { ASSETS } from './config.js';

const SMOOTH = 0.55; // weight of the new sample (higher means less lag and more jitter)

export class Tracker {
  static async create(onStatus = () => {}) {
    const t = new Tracker();
    await t.init(onStatus);
    return t;
  }

  async init(onStatus) {
    onStatus('Loading vision engine…');
    const vision = await import(ASSETS.visionBundle);
    this.vision = vision;
    const fileset = await vision.FilesetResolver.forVisionTasks(ASSETS.wasm);
    const make = async (Cls, model, extra) => {
      for (const delegate of ['GPU', 'CPU']) {
        try {
          return await Cls.createFromOptions(fileset, {
            baseOptions: { modelAssetPath: model, delegate },
            runningMode: 'VIDEO',
            ...extra,
          });
        } catch (e) {
          if (delegate === 'CPU') throw e;
          console.warn('GPU delegate failed, falling back to CPU', e);
        }
      }
    };
    onStatus('Loading body tracking model…');
    this.pose = await make(vision.PoseLandmarker, ASSETS.poseModel, {
      numPoses: 2, minPoseDetectionConfidence: 0.5, minPosePresenceConfidence: 0.5, minTrackingConfidence: 0.5,
    });
    onStatus('Loading hand tracking model…');
    this.hands = await make(vision.HandLandmarker, ASSETS.handModel, {
      numHands: 2, minHandDetectionConfidence: 0.5, minHandPresenceConfidence: 0.5, minTrackingConfidence: 0.5,
    });
    onStatus('Loading face detector…');
    try {
      this.face = await make(vision.FaceDetector, ASSETS.faceModel, { minDetectionConfidence: 0.5 });
    } catch (e) {
      console.warn('Face detector unavailable; front/back detection will rely on pose only', e);
    }
    this.frame = 0;
    this.lastTs = 0;
    this.prev = { poses: [], hands: [] };
    this.faces = [];
  }

  detect(video) {
    let ts = performance.now();
    if (ts <= this.lastTs) ts = this.lastTs + 1;
    this.lastTs = ts;
    this.frame++;

    const pr = this.pose.detectForVideo(video, ts);
    const poses = (pr.landmarks || []).map((lm) => lm.map((p) => ({ x: p.x, y: p.y, v: p.visibility ?? 1 })));

    const hr = this.hands.detectForVideo(video, ts);
    const hands = (hr.landmarks || []).map((lm, i) => ({
      lm: lm.map((p) => ({ x: p.x, y: p.y })),
      label: hr.handednesses?.[i]?.[0]?.categoryName || hr.handedness?.[i]?.[0]?.categoryName || 'Right',
    }));

    // The face detector only decides front vs back, so it can run at half rate.
    if (this.face && this.frame % 2 === 0) {
      const fr = this.face.detectForVideo(video, ts);
      const vw = video.videoWidth || 1, vh = video.videoHeight || 1;
      this.faces = (fr.detections || []).map((d) => {
        const b = d.boundingBox;
        return { x: b.originX / vw, y: b.originY / vh, w: b.width / vw, h: b.height / vh };
      });
    }

    const out = {
      poses: smoothList(this.prev.poses, poses, (p) => p[0]),
      hands: smoothList(this.prev.hands.map((h) => h.lm), hands.map((h) => h.lm), (lm) => lm[0])
        .map((lm, i) => ({ lm, label: hands[i].label })),
      faces: this.faces,
    };
    this.prev = out;
    return out;
  }
}

// Exponential smoothing; each new detection is paired with the nearest previous one.
function smoothList(prevList, list, key) {
  return list.map((cur) => {
    let best = null, bestD = 0.15;
    for (const p of prevList) {
      if (p.length !== cur.length) continue;
      const a = key(p), b = key(cur);
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d < bestD) { bestD = d; best = p; }
    }
    if (!best) return cur;
    return cur.map((c, i) => {
      const p = best[i];
      const o = { x: p.x + (c.x - p.x) * SMOOTH, y: p.y + (c.y - p.y) * SMOOTH };
      if (c.v !== undefined) o.v = p.v + (c.v - p.v) * SMOOTH;
      return o;
    });
  });
}
