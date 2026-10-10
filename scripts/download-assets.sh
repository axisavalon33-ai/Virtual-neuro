#!/usr/bin/env bash
# Copies the MediaPipe engine and models into ./vendor so the app can run
# without internet (handy for exhibitions with unreliable Wi-Fi).
set -euo pipefail
cd "$(dirname "$0")/.."
VER=0.10.14
OUT=vendor
mkdir -p "$OUT/tasks-vision/wasm" "$OUT/models"

NPM="https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@$VER"
curl -fsSL "$NPM/vision_bundle.mjs" -o "$OUT/tasks-vision/vision_bundle.mjs"
for f in vision_wasm_internal.js vision_wasm_internal.wasm vision_wasm_nosimd_internal.js vision_wasm_nosimd_internal.wasm; do
  curl -fsSL "$NPM/wasm/$f" -o "$OUT/tasks-vision/wasm/$f"
done

M=https://storage.googleapis.com/mediapipe-models
curl -fsSL "$M/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task" -o "$OUT/models/pose_landmarker_lite.task"
curl -fsSL "$M/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task" -o "$OUT/models/hand_landmarker.task"
curl -fsSL "$M/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.task" -o "$OUT/models/blaze_face_short_range.task"

echo '{"version":"'"$VER"'"}' > "$OUT/manifest.json"
echo "Assets saved to $OUT/"
