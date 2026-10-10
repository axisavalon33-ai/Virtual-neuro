// Where the MediaPipe engine and models come from. By default they load from
// public CDNs. Run scripts/download-assets.sh to copy them into ./vendor so the
// exhibition setup also works without internet; they are then picked up
// automatically.
const MP_VERSION = '0.10.14';

export const ASSETS = {
  visionBundle: `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}/vision_bundle.mjs`,
  wasm: `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}/wasm`,
  poseModel: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
  handModel: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
  faceModel: 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.task',
};

export async function resolveAssets() {
  try {
    const res = await fetch('vendor/manifest.json', { cache: 'no-store' });
    if (!res.ok) return 'cdn';
    const base = new URL('vendor/', location.href).href;
    Object.assign(ASSETS, {
      visionBundle: base + 'tasks-vision/vision_bundle.mjs',
      wasm: base + 'tasks-vision/wasm',
      poseModel: base + 'models/pose_landmarker_lite.task',
      handModel: base + 'models/hand_landmarker.task',
      faceModel: base + 'models/blaze_face_short_range.task',
    });
    return 'local';
  } catch {
    return 'cdn';
  }
}
