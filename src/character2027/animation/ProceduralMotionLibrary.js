import * as THREE from "three"

const BONE_OFFSETS = {
  IDLE: {
    chest: [[0, 0, 0], [0.02, 0, 0], [0, 0, 0]],
    head: [[0, 0, 0], [-0.015, 0.015, 0], [0, 0, 0]],
    leftUpperArm: [[0, 0, 0], [0, 0, 0.025], [0, 0, 0]],
    rightUpperArm: [[0, 0, 0], [0, 0, -0.025], [0, 0, 0]],
  },
  WALK: {
    leftUpperArm: [[0.28, 0, 0], [-0.28, 0, 0], [0.28, 0, 0]],
    rightUpperArm: [[-0.28, 0, 0], [0.28, 0, 0], [-0.28, 0, 0]],
    leftUpperLeg: [[-0.35, 0, 0], [0.35, 0, 0], [-0.35, 0, 0]],
    rightUpperLeg: [[0.35, 0, 0], [-0.35, 0, 0], [0.35, 0, 0]],
    leftLowerLeg: [[0.15, 0, 0], [0.55, 0, 0], [0.15, 0, 0]],
    rightLowerLeg: [[0.55, 0, 0], [0.15, 0, 0], [0.55, 0, 0]],
    chest: [[0, -0.035, 0], [0, 0.035, 0], [0, -0.035, 0]],
  },
  STOP: {
    chest: [[0.04, 0, 0], [-0.025, 0, 0], [0, 0, 0]],
    leftUpperLeg: [[-0.12, 0, 0], [0.04, 0, 0], [0, 0, 0]],
    rightUpperLeg: [[0.12, 0, 0], [-0.04, 0, 0], [0, 0, 0]],
  },
  TURN_LEFT: {
    hips: [[0, 0, 0], [0, 0.18, 0], [0, 0, 0]],
    chest: [[0, 0, 0], [0, 0.22, 0], [0, 0, 0]],
    head: [[0, 0, 0], [0, 0.18, 0], [0, 0, 0]],
  },
  TURN_RIGHT: {
    hips: [[0, 0, 0], [0, -0.18, 0], [0, 0, 0]],
    chest: [[0, 0, 0], [0, -0.22, 0], [0, 0, 0]],
    head: [[0, 0, 0], [0, -0.18, 0], [0, 0, 0]],
  },
}

const DURATIONS = {
  IDLE: 2.4,
  WALK: 1.0,
  STOP: 0.55,
  TURN_LEFT: 0.6,
  TURN_RIGHT: 0.6,
}

function findBone(root, name) {
  return root.getObjectByName(name)
}

function quaternionWithOffset(restQuaternion, xyz) {
  const delta = new THREE.Quaternion().setFromEuler(new THREE.Euler(xyz[0], xyz[1], xyz[2], "XYZ"))
  return restQuaternion.clone().multiply(delta)
}

function buildTrack(root, boneName, samples, duration) {
  const bone = findBone(root, boneName)
  if (!bone) return null
  const rest = bone.quaternion.clone()
  const times = [0, duration * 0.5, duration]
  const values = []
  samples.forEach((sample) => quaternionWithOffset(rest, sample).toArray(values, values.length))
  return new THREE.QuaternionKeyframeTrack(`${boneName}.quaternion`, times, values)
}

export function createBaselineMotionClip(root, state) {
  const definition = BONE_OFFSETS[state]
  if (!definition) throw new Error(`No baseline motion definition for ${state}`)
  const duration = DURATIONS[state]
  const tracks = Object.entries(definition)
    .map(([boneName, samples]) => buildTrack(root, boneName, samples, duration))
    .filter(Boolean)
  if (!tracks.length) throw new Error(`Avatar has no compatible bones for ${state}`)
  return new THREE.AnimationClip(`Character2027_${state}`, duration, tracks)
}

export function registerBaselineMotionSet(controller, root) {
  const report = {}
  Object.keys(BONE_OFFSETS).forEach((state) => {
    const clip = createBaselineMotionClip(root, state)
    controller.register(state, clip)
    report[state] = { duration: clip.duration, tracks: clip.tracks.length, source: "built-in baseline" }
  })
  return report
}
