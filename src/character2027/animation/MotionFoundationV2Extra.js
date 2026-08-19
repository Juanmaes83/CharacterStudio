import * as THREE from "three"

const NEUTRAL = {
  leftUpperArm: [0, 0, 1.18], rightUpperArm: [0, 0, -1.18],
  leftLowerArm: [0.08, 0, -0.18], rightLowerArm: [0.08, 0, 0.18],
  chest: [0.02, 0, 0], head: [0, 0, 0],
}

const EXTRA = {
  KNEEL: { duration: 1.45, frames: [
    { t: 0, bones: { ...NEUTRAL } },
    { t: .48, bones: { ...NEUTRAL, hips: [-.28,0,0], chest:[.16,0,0], leftUpperLeg:[-.72,0,0], leftLowerLeg:[1.28,0,0], rightUpperLeg:[-.42,0,0], rightLowerLeg:[.78,0,0] } },
    { t: 1, bones: { ...NEUTRAL, hips: [-.34,0,0], chest:[.12,0,0], leftUpperLeg:[-.88,0,0], leftLowerLeg:[1.42,0,0], rightUpperLeg:[-.5,0,0], rightLowerLeg:[.92,0,0] } },
  ] },
  BEND_DOWN: { duration: 1.35, frames: [
    { t: 0, bones: { ...NEUTRAL } },
    { t: .5, bones: { ...NEUTRAL, hips:[-.12,0,0], chest:[.62,0,0], head:[-.18,0,0], leftUpperLeg:[-.22,0,0], rightUpperLeg:[-.22,0,0], leftLowerLeg:[.32,0,0], rightLowerLeg:[.32,0,0] } },
    { t: 1, bones: { ...NEUTRAL } },
  ] },
}

function clip(root, name, definition) {
  const names = new Set()
  definition.frames.forEach(f => Object.keys(f.bones).forEach(b => names.add(b)))
  const tracks = []
  names.forEach(name2 => {
    const bone = root.getObjectByName(name2)
    if (!bone) return
    const rest = bone.quaternion.clone()
    const times = definition.frames.map(f => f.t * definition.duration)
    const values = []
    definition.frames.forEach(f => {
      const xyz = f.bones[name2] || [0,0,0]
      const delta = new THREE.Quaternion().setFromEuler(new THREE.Euler(...xyz, "XYZ"))
      rest.clone().multiply(delta).toArray(values, values.length)
    })
    tracks.push(new THREE.QuaternionKeyframeTrack(`${name2}.quaternion`, times, values))
  })
  return new THREE.AnimationClip(`Character2027_V2_${name}`, definition.duration, tracks)
}

export function registerMotionFoundationV2Extra(controller, root) {
  const report = {}
  Object.entries(EXTRA).forEach(([name, definition]) => {
    const c = clip(root, name, definition)
    controller.register(name, c, { loop: false, clamp: true })
    report[name] = { duration: c.duration, tracks: c.tracks.length, loop: false, source: "Motion Foundation V2 extra" }
  })
  return report
}

export const V2_EXTRA_VERTICAL = Object.keys(EXTRA)
