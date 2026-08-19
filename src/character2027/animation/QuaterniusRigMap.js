// Exact source-bone map for the vendored Quaternius Universal Animation Library.
// Source nodes are taken from the pinned donor manifest generated from commit
// e24c23cf2a1323488a3faa226ea7ea21f644b73e.
// This file maps names only. It does not alter donor keyframes or motion timing.
export const QUATERNIUS_RIG_MAP = {
  "DEF-hips": "hips",
  "DEF-spine.001": "spine",
  "DEF-spine.002": "chest",
  "DEF-spine.003": "upperChest",
  "DEF-neck": "neck",
  "DEF-head": "head",

  "DEF-shoulder.L": "leftShoulder",
  "DEF-upper_arm.L": "leftUpperArm",
  "DEF-forearm.L": "leftLowerArm",
  "DEF-hand.L": "leftHand",
  "DEF-shoulder.R": "rightShoulder",
  "DEF-upper_arm.R": "rightUpperArm",
  "DEF-forearm.R": "rightLowerArm",
  "DEF-hand.R": "rightHand",

  "DEF-thigh.L": "leftUpperLeg",
  "DEF-shin.L": "leftLowerLeg",
  "DEF-foot.L": "leftFoot",
  "DEF-toe.L": "leftToes",
  "DEF-thigh.R": "rightUpperLeg",
  "DEF-shin.R": "rightLowerLeg",
  "DEF-foot.R": "rightFoot",
  "DEF-toe.R": "rightToes",

  "DEF-thumb.01.L": "leftThumbMetacarpal",
  "DEF-thumb.02.L": "leftThumbProximal",
  "DEF-thumb.03.L": "leftThumbDistal",
  "DEF-f_index.01.L": "leftIndexProximal",
  "DEF-f_index.02.L": "leftIndexIntermediate",
  "DEF-f_index.03.L": "leftIndexDistal",
  "DEF-f_middle.01.L": "leftMiddleProximal",
  "DEF-f_middle.02.L": "leftMiddleIntermediate",
  "DEF-f_middle.03.L": "leftMiddleDistal",
  "DEF-f_ring.01.L": "leftRingProximal",
  "DEF-f_ring.02.L": "leftRingIntermediate",
  "DEF-f_ring.03.L": "leftRingDistal",
  "DEF-f_pinky.01.L": "leftLittleProximal",
  "DEF-f_pinky.02.L": "leftLittleIntermediate",
  "DEF-f_pinky.03.L": "leftLittleDistal",

  "DEF-thumb.01.R": "rightThumbMetacarpal",
  "DEF-thumb.02.R": "rightThumbProximal",
  "DEF-thumb.03.R": "rightThumbDistal",
  "DEF-f_index.01.R": "rightIndexProximal",
  "DEF-f_index.02.R": "rightIndexIntermediate",
  "DEF-f_index.03.R": "rightIndexDistal",
  "DEF-f_middle.01.R": "rightMiddleProximal",
  "DEF-f_middle.02.R": "rightMiddleIntermediate",
  "DEF-f_middle.03.R": "rightMiddleDistal",
  "DEF-f_ring.01.R": "rightRingProximal",
  "DEF-f_ring.02.R": "rightRingIntermediate",
  "DEF-f_ring.03.R": "rightRingDistal",
  "DEF-f_pinky.01.R": "rightLittleProximal",
  "DEF-f_pinky.02.R": "rightLittleIntermediate",
  "DEF-f_pinky.03.R": "rightLittleDistal",
}

export function resolveQuaterniusBoneName(sourceBoneName, targetBoneNames) {
  const mapped = QUATERNIUS_RIG_MAP[sourceBoneName]
  return mapped && targetBoneNames.has(mapped) ? mapped : null
}
