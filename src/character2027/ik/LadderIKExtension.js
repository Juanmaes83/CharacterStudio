import * as THREE from "three"
import { getTerrainSemanticDescriptor } from "../interaction/TerrainSemanticBenchmarks"

const _forward = new THREE.Vector3(0, 0, 1)
const _direction = new THREE.Vector3()
const _desiredQuaternion = new THREE.Quaternion()

function smooth01(value) {
  const x = THREE.MathUtils.clamp(value, 0, 1)
  return x * x * (3 - 2 * x)
}

function phase(value, start, end) {
  return smooth01((value - start) / Math.max(end - start, 1e-5))
}

function rungTarget(point, xOffset) {
  return point.clone().add(new THREE.Vector3(xOffset, 0, -0.015))
}

export function applyLadderIK(controller, state, action) {
  if (!controller || (state !== "LADDER_UP" && state !== "LADDER_DOWN")) return
  const descriptor = getTerrainSemanticDescriptor(controller.root, state)
  if (!descriptor?.rungPoints?.length) return

  const duration = action?.getClip?.()?.duration || 1
  const t = THREE.MathUtils.clamp((action?.time || 0) / Math.max(duration, 1e-5), 0, 1)
  const up = state === "LADDER_UP"
  const root = controller.root

  if (controller._ladderSemantic?.state !== state) {
    controller._ladderSemantic = {
      state,
      rootStart: root.position.clone(),
      rootStartQuaternion: root.quaternion.clone(),
    }
  }
  const memory = controller._ladderSemantic
  const rungs = descriptor.rungPoints.slice().sort((a, b) => a.y - b.y)
  const ladderCentre = rungs[Math.floor(rungs.length / 2)].clone()

  // Phase 1: orient and approach the physical ladder. Phase 2: ascend/descend
  // the real rung field. The root trajectory is spatial, not an in-place pose.
  _direction.set(ladderCentre.x - root.position.x, 0, ladderCentre.z - root.position.z)
  if (_direction.lengthSq() > 1e-8) {
    _direction.normalize()
    _desiredQuaternion.setFromUnitVectors(_forward, _direction)
    root.quaternion.slerpQuaternions(memory.rootStartQuaternion, _desiredQuaternion, phase(t, 0, 0.20))
  }

  const approach = phase(t, 0, 0.22)
  const climb = phase(t, 0.18, 0.96)
  const ladderZ = ladderCentre.z - 0.30
  root.position.x = THREE.MathUtils.lerp(memory.rootStart.x, ladderCentre.x, approach)
  root.position.z = THREE.MathUtils.lerp(memory.rootStart.z, ladderZ, approach)

  const rungSpan = Math.max(0.56, rungs[rungs.length - 1].y - rungs[0].y)
  const climbDistance = Math.min(1.12, rungSpan * 0.78)
  const targetY = up ? memory.rootStart.y + climbDistance : Math.max(0, memory.rootStart.y - climbDistance)
  root.position.y = THREE.MathUtils.lerp(memory.rootStart.y, targetY, climb)
  root.updateWorldMatrix(true, true)

  const progress = up ? climb : 1 - climb
  const maxBase = Math.max(0, rungs.length - 4)
  const baseIndex = Math.min(maxBase, Math.max(0, Math.floor(progress * (maxBase + 0.999))))
  const rhythm = Math.sin(t * Math.PI * 4)
  const leftLead = rhythm >= 0

  const footLow = rungs[Math.min(baseIndex, rungs.length - 1)]
  const footHigh = rungs[Math.min(baseIndex + 1, rungs.length - 1)]
  const handLow = rungs[Math.min(baseIndex + 2, rungs.length - 1)]
  const handHigh = rungs[Math.min(baseIndex + 3, rungs.length - 1)]

  const leftFoot = rungTarget(leftLead ? footHigh : footLow, -0.16)
  const rightFoot = rungTarget(leftLead ? footLow : footHigh, 0.16)
  const leftHand = rungTarget(leftLead ? handHigh : handLow, -0.24)
  const rightHand = rungTarget(leftLead ? handLow : handHigh, 0.24)

  controller.solveChain(controller.chains.leftArm, leftHand, controller.chains.leftArm?.preferredBendLocal, 0.99)
  controller.solveChain(controller.chains.rightArm, rightHand, controller.chains.rightArm?.preferredBendLocal, 0.99)
  controller.solveChain(controller.chains.leftLeg, leftFoot, controller.chains.leftLeg?.preferredBendLocal, 0.995)
  controller.solveChain(controller.chains.rightLeg, rightFoot, controller.chains.rightLeg?.preferredBendLocal, 0.995)
}
