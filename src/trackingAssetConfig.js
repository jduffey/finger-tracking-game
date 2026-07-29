export const MEDIAPIPE_HANDS_SOLUTION_PATH = "/vendor/mediapipe/hands";
export const MOVENET_MODEL_BASE_PATH = "/vendor/movenet";

export const MOVENET_MODEL_PATHS = Object.freeze({
  "SinglePose.Lightning": `${MOVENET_MODEL_BASE_PATH}/singlepose-lightning-v4/model.json`,
  "MultiPose.Lightning": `${MOVENET_MODEL_BASE_PATH}/multipose-lightning-v1/model.json`,
});

export const MEDIAPIPE_HANDS_ASSET_NAMES = Object.freeze([
  "hand_landmark_full.tflite",
  "hand_landmark_lite.tflite",
  "hands.binarypb",
  "hands.js",
  "hands_solution_packed_assets.data",
  "hands_solution_packed_assets_loader.js",
  "hands_solution_simd_wasm_bin.data",
  "hands_solution_simd_wasm_bin.js",
  "hands_solution_simd_wasm_bin.wasm",
  "hands_solution_wasm_bin.js",
  "hands_solution_wasm_bin.wasm",
]);

export function getMoveNetModelPath(modelType) {
  return MOVENET_MODEL_PATHS[modelType] ?? null;
}
