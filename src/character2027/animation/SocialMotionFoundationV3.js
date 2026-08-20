import * as THREE from "three"

const NEUTRAL = {
  leftUpperArm: [0, 0, 1.18],
  rightUpperArm: [0, 0, -1.18],
  leftLowerArm: [0.08, 0, -0.18],
  rightLowerArm: [0.08, 0, 0.18],
  chest: [0.02, 0, 0],
  head: [0, 0, 0],
}

const SOCIAL = {
  WAVE: {
    duration: 1.65,
    frames: [
      { t: 0, bones: { ...NEUTRAL } },
      { t: 0.16, bones: { ...NEUTRAL, rightUpperArm: [-0.72, -0.10, -0.52], rightLowerArm: [-1.18, 0.10, 0.18], chest: [0.01, -0.05, 0], head: [0, -0.08, 0] } },
      { t: 0.34, bones: { ...NEUTRAL, rightUpperArm: [-0.74, -0.10, -0.50], rightLowerArm: [-1.12, 0.32, 0.24], chest: [0.01, -0.06, 0], head: [0, -0.08, 0] } },
      { t: 0.50, bones: { ...NEUTRAL, rightUpperArm: [-0.74, -0.10, -0.50], rightLowerArm: [-1.12, -0.30, 0.10], chest: [0.01, -0.06, 0], head: [0, -0.08, 0] } },
      { t: 0.66, bones: { ...NEUTRAL, rightUpperArm: [-0.74, -0.10, -0.50], rightLowerArm: [-1.12, 0.30, 0.24], chest: [0.01, -0.06, 0], head: [0, -0.08, 0] } },
      { t: 0.82, bones: { ...NEUTRAL, rightUpperArm: [-0.72, -0.10, -0.52], rightLowerArm: [-1.18, 0.05, 0.18], chest: [0.01, -0.04, 0] } },
      { t: 1, bones: { ...NEUTRAL } },
    ],
  },
  GOODBYE: {
    duration: 1.95,
    frames: [
      { t: 0, bones: { ...NEUTRAL } },
      { t: 0.18, bones: { ...NEUTRAL, rightUpperArm: [-0.62, -0.12, -0.56], rightLowerArm: [-1.05, 0.08, 0.16], chest: [0.02, -0.08, 0], head: [0.02, -0.10, 0] } },
      { t: 0.38, bones: { ...NEUTRAL, rightUpperArm: [-0.65, -0.12, -0.54], rightLowerArm: [-1.00, 0.34, 0.20], chest: [0.02, -0.10, 0], head: [0.03, -0.10, 0] } },
      { t: 0.58, bones: { ...NEUTRAL, rightUpperArm: [-0.65, -0.12, -0.54], rightLowerArm: [-1.00, -0.34, 0.08], chest: [0.02, -0.10, 0], head: [0.06, -0.08, 0] } },
      { t: 0.78, bones: { ...NEUTRAL, rightUpperArm: [-0.62, -0.12, -0.56], rightLowerArm: [-1.05, 0.12, 0.16], chest: [0.01, -0.06, 0], head: [0.04, -0.04, 0] } },
      { t: 1, bones: { ...NEUTRAL } },
    ],
  },
  POINT: {
    duration: 1.45,
    frames: [
      { t: 0, bones: { ...NEUTRAL } },
      { t: 0.22, bones: { ...NEUTRAL, rightUpperArm: [-0.22, -0.52, -0.46], rightLowerArm: [-0.40, 0.08, 0.12], chest: [0.02, -0.12, 0], head: [0, -0.18, 0] } },
      { t: 0.48, bones: { ...NEUTRAL, rightUpperArm: [-0.12, -0.72, -0.30], rightLowerArm: [-0.16, 0.04, 0.05], chest: [0.02, -0.18, 0], head: [0, -0.24, 0] } },
      { t: 0.76, bones: { ...NEUTRAL, rightUpperArm: [-0.12, -0.72, -0.30], rightLowerArm: [-0.16, 0.04, 0.05], chest: [0.02, -0.18, 0], head: [0, -0.24, 0] } },
      { t: 1, bones: { ...NEUTRAL } },
    ],
  },
  NOD: {
    duration: 1.05,
    frames: [
      { t: 0, bones: { ...NEUTRAL } },
      { t: 0.24, bones: { ...NEUTRAL, head: [0.26, 0, 0], chest: [0.04, 0, 0] } },
      { t: 0.48, bones: { ...NEUTRAL, head: [-0.10, 0, 0], chest: [0.01, 0, 0] } },
      { t: 0.70, bones: { ...NEUTRAL, head: [0.16, 0, 0], chest: [0.03, 0, 0] } },
      { t: 1, bones: { ...NEUTRAL } },
    ],
  },
  WELCOME: {
    duration: 1.70,
    frames: [
      { t: 0, bones: { ...NEUTRAL } },
      { t: 0.22, bones: { ...NEUTRAL, leftUpperArm: [-0.30, 0.10, 0.78], rightUpperArm: [-0.30, -0.10, -0.78], leftLowerArm: [-0.55, -0.08, -0.10], rightLowerArm: [-0.55, 0.08, 0.10], chest: [-0.04, 0, 0], head: [0.03, 0, 0] } },
      { t: 0.50, bones: { ...NEUTRAL, leftUpperArm: [-0.38, 0.16, 0.56], rightUpperArm: [-0.38, -0.16, -0.56], leftLowerArm: [-0.34, -0.16, -0.04], rightLowerArm: [-0.34, 0.16, 0.04], chest: [-0.08, 0, 0], head: [0.05, 0, 0] } },
      { t: 0.78, bones: { ...NEUTRAL, leftUpperArm: [-0.34, 0.10, 0.66], rightUpperArm: [-0.34, -0.10, -0.66], leftLowerArm: [-0.44, -0.10, -0.06], rightLowerArm: [-0.44, 0.10, 0.06], chest: [-0.05, 0, 0] } },
      { t: 1, bones: { ...NEUTRAL } },
    ],
  },
  AFTER_YOU: {
    duration: 1.60,
    frames: [
      { t: 0, bones: { ...NEUTRAL } },
      { t: 0.22, bones: { ...NEUTRAL, rightUpperArm: [-0.24, -0.28, -0.56], rightLowerArm: [-0.44, 0.02, 0.10], chest: [0.04, -0.14, 0], head: [0.02, -0.16, 0] } },
      { t: 0.50, bones: { ...NEUTRAL, rightUpperArm: [-0.20, -0.48, -0.38], rightLowerArm: [-0.26, 0.02, 0.06], chest: [0.06, -0.24, 0], head: [0.03, -0.24, 0] } },
      { t: 0.78, bones: { ...NEUTRAL, rightUpperArm: [-0.20, -0.48, -0.38], rightLowerArm: [-0.26, 0.02, 0.06], chest: [0.04, -0.20, 0], head: [0.02, -0.20, 0] } },
      { t: 1, bones: { ...NEUTRAL } },
    ],
  },
}

function clipFromDefinition(root, name, definition) {
  const boneNames = new Set()
  definition.frames.forEach((frame) => Object.keys(frame.bones || {}).forEach((bone) => boneNames.add(bone)))
  const tracks = []
  boneNames.forEach((boneName) => {
    const bone = root.getObjectByName(boneName)
    if (!bone) return
    const rest = bone.quaternion.clone()
    const times = definition.frames.map((frame) => frame.t * definition.duration)
    const values = []
    definition.frames.forEach((frame) => {
      const xyz = frame.bones?.[boneName] || [0, 0, 0]
      const delta = new THREE.Quaternion().setFromEuler(new THREE.Euler(...xyz, "XYZ"))
      rest.clone().multiply(delta).toArray(values, values.length)
    })
    tracks.push(new THREE.QuaternionKeyframeTrack(`${boneName}.quaternion`, times, values))
  })
  if (!tracks.length) throw new Error(`No compatible bones for social action ${name}`)
  return new THREE.AnimationClip(`Character2027_SOCIAL_V3_${name}`, definition.duration, tracks)
}

export function registerSocialMotionFoundationV3(controller, root) {
  const report = {}
  Object.entries(SOCIAL).forEach(([name, definition]) => {
    const clip = clipFromDefinition(root, name, definition)
    controller.register(name, clip, { loop: false, clamp: true, recoverTo: "IDLE_V2", fadeSeconds: 0.16 })
    report[name] = {
      duration: clip.duration,
      tracks: clip.tracks.length,
      loop: false,
      source: "Social Motion Foundation V3 — full-body clip ownership",
    }
  })
  return report
}

export const SOCIAL_V3_ACTIONS = Object.freeze(Object.keys(SOCIAL))
export { clipFromDefinition as createSocialMotionClip }
