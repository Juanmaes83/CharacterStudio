import * as THREE from "three"

const _q = new THREE.Quaternion()

function worldDir(root, local, out = new THREE.Vector3()) {
  root.getWorldQuaternion(_q)
  return out.copy(local).applyQuaternion(_q).normalize()
}

function worldPos(object, out = new THREE.Vector3()) {
  object.updateWorldMatrix(true, false)
  return object.getWorldPosition(out)
}

export function applyLadderIK(controller, state, action) {
  if (!controller || (state !== "LADDER_UP" && state !== "LADDER_DOWN")) return
  const duration = action?.getClip?.()?.duration || 1
  const t = duration > 0 ? ((action?.time || 0) / duration) % 1 : 0
  const direction = state === "LADDER_UP" ? 1 : -1
  const root = controller.root
  const chest = controller.chest || root
  const hips = controller.hips || root
  const chestPos = worldPos(chest)
  const hipsPos = worldPos(hips)
  const forward = worldDir(root, new THREE.Vector3(0, 0, 1))
  const right = worldDir(root, new THREE.Vector3(1, 0, 0))

  // Cross-lateral climbing pattern: opposite hand/foot pairs alternate every half-cycle.
  const firstHalf = t < 0.5
  const phase = firstHalf ? t * 2 : (t - 0.5) * 2
  const lift = Math.sin(Math.PI * THREE.MathUtils.clamp(phase, 0, 1))
  const reachY = 0.28 * direction
  const footY = 0.20 * direction

  const leftHand = chestPos.clone().addScaledVector(right, -0.34).addScaledVector(forward, 0.28)
  const rightHand = chestPos.clone().addScaledVector(right, 0.34).addScaledVector(forward, 0.28)
  leftHand.y += firstHalf ? reachY * lift + 0.24 : 0.06
  rightHand.y += firstHalf ? 0.06 : reachY * lift + 0.24

  const leftFoot = hipsPos.clone().addScaledVector(right, -0.18).addScaledVector(forward, 0.18)
  const rightFoot = hipsPos.clone().addScaledVector(right, 0.18).addScaledVector(forward, 0.18)
  leftFoot.y -= 0.62
  rightFoot.y -= 0.62
  leftFoot.y += firstHalf ? 0.02 : footY * lift
  rightFoot.y += firstHalf ? footY * lift : 0.02

  controller.solveChain(controller.chains.leftArm, leftHand, controller.chains.leftArm?.bendPoleLocal, 0.98)
  controller.solveChain(controller.chains.rightArm, rightHand, controller.chains.rightArm?.bendPoleLocal, 0.98)
  controller.solveChain(controller.chains.leftLeg, leftFoot, controller.chains.leftLeg?.bendPoleLocal, 0.99)
  controller.solveChain(controller.chains.rightLeg, rightFoot, controller.chains.rightLeg?.bendPoleLocal, 0.99)
}
