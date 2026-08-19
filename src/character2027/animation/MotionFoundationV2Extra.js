import * as THREE from "three"
import { registerSocialMotionFoundationV3 } from "./SocialMotionFoundationV3"
import { ensureTerrainSemanticBenchmarks } from "../interaction/TerrainSemanticBenchmarks"

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

const TERRAIN_ONE_SHOT = ["STEP_UP", "STEP_DOWN", "STAIRS_UP", "STAIRS_DOWN", "LADDER_UP", "LADDER_DOWN"]

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

function configureTerrainActions(controller) {
  TERRAIN_ONE_SHOT.forEach((name) => {
    const action = controller.actions.get(name)
    if (!action) return
    action.setLoop(THREE.LoopOnce, 1)
    action.clampWhenFinished = true
    const previous = controller.actionOptions.get(name) || {}
    controller.actionOptions.set(name, {
      ...previous,
      loop: false,
      clamp: true,
      recoverTo: "IDLE_V2",
      fadeSeconds: 0.14,
    })
  })
}

export function registerMotionFoundationV2Extra(controller, root) {
  const report = {}
  Object.entries(EXTRA).forEach(([name, definition]) => {
    const c = clip(root, name, definition)
    controller.register(name, c, { loop: false, clamp: true })
    report[name] = { duration: c.duration, tracks: c.tracks.length, loop: false, source: "Motion Foundation V2 extra" }
  })

  // Social V3 deliberately re-registers the social states after V2 so their
  // complete authored body tracks win over the older IK-owned definitions.
  Object.assign(report, registerSocialMotionFoundationV3(controller, root))

  // Terrain actions are semantic one-shot interactions with real world
  // geometry. The ladder is materialised here because the older benchmark
  // scene never had a ladder object at all.
  ensureTerrainSemanticBenchmarks(root.parent)
  configureTerrainActions(controller)
  TERRAIN_ONE_SHOT.forEach((name) => {
    if (report[name]) report[name] = { ...report[name], loop: false, semanticTerrain: true }
    else if (controller.actions.has(name)) {
      const action = controller.actions.get(name)
      report[name] = {
        duration: action.getClip().duration,
        tracks: action.getClip().tracks.length,
        loop: false,
        semanticTerrain: true,
        source: "Motion Foundation V2 + Terrain Semantic Binding",
      }
    }
  })
  return report
}

export const V2_EXTRA_VERTICAL = Object.keys(EXTRA)
export const TERRAIN_SEMANTIC_ACTIONS = Object.freeze(TERRAIN_ONE_SHOT)
