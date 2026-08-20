import * as THREE from "three"

const LOCAL_FORWARD = new THREE.Vector3(0, 0, 1)

/**
 * Motion Lab WALK_V2 is a locomotion benchmark, not an in-place clip preview.
 * Production/world callers should use CharacterActionAPI.moveTo(target).
 */
export function getForwardWalkPreviewTarget(root, distance = 1.35) {
  if (!root) throw new Error("WALK_V2 preview requires a character root")
  const forward = LOCAL_FORWARD.clone().applyQuaternion(root.quaternion)
  forward.y = 0
  if (forward.lengthSq() < 1e-8) forward.set(0, 0, 1)
  forward.normalize()
  return root.position.clone().addScaledVector(forward, Math.max(0.25, Number(distance) || 1.35))
}

export function runMotionLabFoundationAction({ action, root, actionApi, walkDistance = 1.35 }) {
  if (!actionApi) throw new Error("Motion Lab action requires CharacterActionAPI")

  if (action === "WALK_V2") {
    const target = getForwardWalkPreviewTarget(root, walkDistance)
    actionApi.moveTo(target, {
      label: "WALK_V2 FORWARD PREVIEW",
      arrivalStatus: "WALK_V2 PREVIEW COMPLETE",
      walkSpeed: 0.78,
      stopDistance: 0.08,
    })
    return { mode: "moveTo", target }
  }

  actionApi.perform(action)
  return { mode: "perform", target: null }
}
