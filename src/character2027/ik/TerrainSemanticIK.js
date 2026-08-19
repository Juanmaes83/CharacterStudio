import * as THREE from "three"
import { getTerrainSemanticDescriptor } from "../interaction/TerrainSemanticBenchmarks"

const V = () => new THREE.Vector3()

function smooth01(value) {
  const x = THREE.MathUtils.clamp(value, 0, 1)
  return x * x * (3 - 2 * x)
}

function phase(value, start, end) {
  return smooth01((value - start) / Math.max(end - start, 1e-5))
}

function actionT(action, fallbackTime = 0) {
  const duration = action?.getClip?.()?.duration || 1
  const time = action?.time ?? fallbackTime
  return THREE.MathUtils.clamp(time / Math.max(duration, 1e-5), 0, 1)
}

function begin(controller, state, descriptor) {
  if (controller._terrainSemantic?.state === state) return controller._terrainSemantic
  controller._terrainSemantic = {
    state,
    descriptor,
    rootStart: controller.root.position.clone(),
    leftStart: controller.chains.leftLeg?.end?.getWorldPosition(V()) || null,
    rightStart: controller.chains.rightLeg?.end?.getWorldPosition(V()) || null,
  }
  return controller._terrainSemantic
}

function platformFeet(controller, center, y) {
  const right = controller._rootRight(V())
  const leftFoot = center.clone().addScaledVector(right, -0.14)
  const rightFoot = center.clone().addScaledVector(right, 0.14)
  leftFoot.y = y + 0.018
  rightFoot.y = y + 0.018
  return { leftFoot, rightFoot }
}

function applyStep(controller, state, action) {
  const descriptor = getTerrainSemanticDescriptor(controller.root, state)
  if (!descriptor?.top) return false
  const memory = begin(controller, state, descriptor)
  const t = actionT(action, controller.stateTime)
  const up = state === "STEP_UP"
  const forward = controller._rootForward(V())
  const right = controller._rootRight(V())

  if (up) {
    const top = descriptor.top.clone()
    const targetRoot = top.clone()
    const move = smooth01(t)
    const rise = phase(t, 0.28, 0.82)
    controller.root.position.x = THREE.MathUtils.lerp(memory.rootStart.x, targetRoot.x, move)
    controller.root.position.z = THREE.MathUtils.lerp(memory.rootStart.z, targetRoot.z, move)
    controller.root.position.y = THREE.MathUtils.lerp(memory.rootStart.y, top.y, rise)
    controller.root.updateWorldMatrix(true, true)

    const feet = platformFeet(controller, top, top.y)
    const swing = memory.leftStart?.clone() || feet.leftFoot.clone()
    swing.lerp(feet.leftFoot, phase(t, 0.05, 0.62))
    swing.y += Math.sin(Math.PI * THREE.MathUtils.clamp(t / 0.65, 0, 1)) * 0.09
    const support = memory.rightStart?.clone() || feet.rightFoot.clone()
    if (t > 0.56) support.lerp(feet.rightFoot, phase(t, 0.56, 0.96))
    controller._solveLegs(swing, support, 0.995)
    return true
  }

  // STEP_DOWN starts from the current elevated root and lands on the ground in
  // front of the step. If invoked from ground, it is clamped rather than moving
  // the avatar below the world floor.
  const startY = Math.max(memory.rootStart.y, 0)
  const landing = memory.rootStart.clone().addScaledVector(forward, 0.48)
  landing.y = 0
  const move = smooth01(t)
  const descend = phase(t, 0.18, 0.78)
  controller.root.position.x = THREE.MathUtils.lerp(memory.rootStart.x, landing.x, move)
  controller.root.position.z = THREE.MathUtils.lerp(memory.rootStart.z, landing.z, move)
  controller.root.position.y = Math.max(0, THREE.MathUtils.lerp(startY, 0, descend))
  controller.root.updateWorldMatrix(true, true)

  const leftGround = landing.clone().addScaledVector(right, -0.14)
  const rightGround = landing.clone().addScaledVector(right, 0.14)
  leftGround.y = 0.018; rightGround.y = 0.018
  const first = memory.leftStart?.clone() || leftGround.clone()
  first.lerp(leftGround, phase(t, 0.05, 0.58))
  first.y += Math.sin(Math.PI * THREE.MathUtils.clamp(t / 0.62, 0, 1)) * 0.07
  const second = memory.rightStart?.clone() || rightGround.clone()
  if (t > 0.50) second.lerp(rightGround, phase(t, 0.50, 0.96))
  controller._solveLegs(first, second, 0.995)
  return true
}

function stairPath(memory, descriptor, state, controller) {
  const up = state === "STAIRS_UP"
  const tops = up ? descriptor.tops.map((p) => p.clone()) : descriptor.tops.slice().reverse().map((p) => p.clone())
  if (up) return [memory.rootStart.clone(), ...tops]

  const firstLow = descriptor.tops[0]
  const forward = controller._rootForward(V())
  const landing = firstLow.clone().addScaledVector(forward, -0.48)
  landing.y = 0
  return [memory.rootStart.clone(), ...tops, landing]
}

function applyStairs(controller, state, action) {
  const descriptor = getTerrainSemanticDescriptor(controller.root, state)
  if (!descriptor?.tops?.length) return false
  const memory = begin(controller, state, descriptor)
  const t = actionT(action, controller.stateTime)
  const points = stairPath(memory, descriptor, state, controller)
  const segments = points.length - 1
  const scaled = Math.min(t * segments, segments - 1e-6)
  const index = Math.min(Math.floor(scaled), segments - 1)
  const local = scaled - index
  const eased = smooth01(local)
  const a = points[index]
  const b = points[index + 1]

  controller.root.position.lerpVectors(a, b, eased)
  // Keep the body lift delayed slightly behind the swing foot.
  controller.root.position.y = THREE.MathUtils.lerp(a.y, b.y, phase(local, 0.28, 0.82))
  controller.root.updateWorldMatrix(true, true)

  const right = controller._rootRight(V())
  const aLeft = a.clone().addScaledVector(right, -0.14); aLeft.y = a.y + 0.018
  const aRight = a.clone().addScaledVector(right, 0.14); aRight.y = a.y + 0.018
  const bLeft = b.clone().addScaledVector(right, -0.14); bLeft.y = b.y + 0.018
  const bRight = b.clone().addScaledVector(right, 0.14); bRight.y = b.y + 0.018
  const leftSwings = index % 2 === 0
  const lift = Math.sin(Math.PI * THREE.MathUtils.clamp(local, 0, 1)) * 0.09

  const leftTarget = leftSwings ? aLeft.clone().lerp(bLeft, phase(local, 0.04, 0.82)) : aLeft
  const rightTarget = leftSwings ? aRight : aRight.clone().lerp(bRight, phase(local, 0.04, 0.82))
  if (leftSwings) leftTarget.y += lift
  else rightTarget.y += lift
  controller._solveLegs(leftTarget, rightTarget, 0.995)
  return true
}

export function applyTerrainSemanticIK(controller, state, action) {
  if (!controller || !state) return false
  if (state === "STEP_UP" || state === "STEP_DOWN") return applyStep(controller, state, action)
  if (state === "STAIRS_UP" || state === "STAIRS_DOWN") return applyStairs(controller, state, action)
  return false
}

export function clearTerrainSemanticMemory(controller) {
  if (controller) controller._terrainSemantic = null
}
