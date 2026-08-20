import { describe, expect, it, vi } from "vitest"
import * as THREE from "three"
import { ContactIKController } from "../../src/character2027/ik/ContactIKController"

function addBone(parent, name, position) {
  const bone = new THREE.Bone()
  bone.name = name
  bone.position.set(...position)
  parent.add(bone)
  return bone
}

function makeHumanoid() {
  const root = new THREE.Group()
  const hips = addBone(root, "hips", [0, 1, 0])

  const leftUpperLeg = addBone(hips, "leftUpperLeg", [-0.1, -0.08, 0])
  const leftLowerLeg = addBone(leftUpperLeg, "leftLowerLeg", [0, -0.48, 0])
  addBone(leftLowerLeg, "leftFoot", [0, -0.46, 0.08])

  const rightUpperLeg = addBone(hips, "rightUpperLeg", [0.1, -0.08, 0])
  const rightLowerLeg = addBone(rightUpperLeg, "rightLowerLeg", [0, -0.48, 0])
  addBone(rightLowerLeg, "rightFoot", [0, -0.46, 0.08])

  const chest = addBone(hips, "chest", [0, 0.42, 0])
  const head = addBone(chest, "head", [0, 0.42, 0])
  const leftUpperArm = addBone(chest, "leftUpperArm", [-0.26, 0.18, 0])
  const leftLowerArm = addBone(leftUpperArm, "leftLowerArm", [-0.32, 0, 0])
  addBone(leftLowerArm, "leftHand", [-0.28, 0, 0])
  const rightUpperArm = addBone(chest, "rightUpperArm", [0.26, 0.18, 0])
  const rightLowerArm = addBone(rightUpperArm, "rightLowerArm", [0.32, 0, 0])
  addBone(rightLowerArm, "rightHand", [0.28, 0, 0])

  root.updateMatrixWorld(true)
  return { root, leftUpperLeg, leftLowerLeg, rightUpperLeg, rightLowerLeg }
}

function actionAt(time = 0.5, duration = 1) {
  return { time, getClip: () => ({ duration }) }
}

describe("ContactIKController locomotion boundary", () => {
  it("does not synthesize a second gait over WALK_V2 animation pose", () => {
    const { root, leftUpperLeg, leftLowerLeg, rightUpperLeg, rightLowerLeg } = makeHumanoid()
    const controller = new ContactIKController(root)
    const action = actionAt()

    controller.setState("WALK_V2", action)
    leftUpperLeg.rotation.x = 0.31
    leftLowerLeg.rotation.x = 0.52
    rightUpperLeg.rotation.x = -0.27
    rightLowerLeg.rotation.x = 0.43

    const before = [leftUpperLeg, leftLowerLeg, rightUpperLeg, rightLowerLeg].map((bone) => bone.quaternion.clone())
    controller.update(1 / 60, "WALK_V2", action)
    const after = [leftUpperLeg, leftLowerLeg, rightUpperLeg, rightLowerLeg].map((bone) => bone.quaternion.clone())

    after.forEach((quaternion, index) => {
      expect(Math.abs(quaternion.dot(before[index]))).toBeGreaterThan(0.999999)
    })
  })

  it("keeps existing contact/adaptation IK active for non-walk states", () => {
    const { root } = makeHumanoid()
    const controller = new ContactIKController(root)
    const crouch = vi.spyOn(controller, "_applyCrouch")
    const action = actionAt(0.4, 1)

    controller.update(1 / 60, "CROUCH", action)
    expect(crouch).toHaveBeenCalledTimes(1)
  })
})
