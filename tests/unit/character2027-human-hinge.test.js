import { describe, expect, it } from "vitest"
import * as THREE from "three"
import { HumanoidIKController } from "../../src/character2027/ik/HumanoidIKController"

function bone(name, position = [0, 0, 0]) {
  const b = new THREE.Bone()
  b.name = name
  b.position.set(...position)
  return b
}

function makeHumanoid() {
  const root = new THREE.Group()
  root.name = "SyntheticHuman"

  const hips = bone("hips", [0, 1.0, 0])
  const chest = bone("chest", [0, 0.45, 0])
  const neck = bone("neck", [0, 0.28, 0])
  const head = bone("head", [0, 0.20, 0])
  root.add(hips)
  hips.add(chest)
  chest.add(neck)
  neck.add(head)

  const leftUpperLeg = bone("leftUpperLeg", [-0.14, 0, 0])
  const leftLowerLeg = bone("leftLowerLeg", [0, -0.46, 0])
  const leftFoot = bone("leftFoot", [0, -0.44, 0])
  hips.add(leftUpperLeg)
  leftUpperLeg.add(leftLowerLeg)
  leftLowerLeg.add(leftFoot)

  const rightUpperLeg = bone("rightUpperLeg", [0.14, 0, 0])
  const rightLowerLeg = bone("rightLowerLeg", [0, -0.46, 0])
  const rightFoot = bone("rightFoot", [0, -0.44, 0])
  hips.add(rightUpperLeg)
  rightUpperLeg.add(rightLowerLeg)
  rightLowerLeg.add(rightFoot)

  const leftUpperArm = bone("leftUpperArm", [-0.30, 0.20, 0])
  const leftLowerArm = bone("leftLowerArm", [-0.34, 0, 0])
  const leftHand = bone("leftHand", [-0.30, 0, 0])
  chest.add(leftUpperArm)
  leftUpperArm.add(leftLowerArm)
  leftLowerArm.add(leftHand)

  const rightUpperArm = bone("rightUpperArm", [0.30, 0.20, 0])
  const rightLowerArm = bone("rightLowerArm", [0.34, 0, 0])
  const rightHand = bone("rightHand", [0.30, 0, 0])
  chest.add(rightUpperArm)
  rightUpperArm.add(rightLowerArm)
  rightLowerArm.add(rightHand)

  root.updateMatrixWorld(true)
  return root
}

function worldPos(object) {
  object.updateWorldMatrix(true, false)
  return object.getWorldPosition(new THREE.Vector3())
}

describe("Character 2027 human hinge lock", () => {
  it("selects the forward knee solution when the foot stays near the pelvis axis", () => {
    const root = makeHumanoid()
    const controller = new HumanoidIKController(root)
    const chain = controller.chains.rightLeg
    const hip = worldPos(chain.upper)
    const target = new THREE.Vector3(hip.x, hip.y - 0.72, hip.z + 0.04)

    controller.solveChain(chain, target, chain.preferredBendLocal, 1)
    root.updateMatrixWorld(true)

    const knee = worldPos(chain.lower)
    expect(knee.z).toBeGreaterThan(hip.z + 0.03)
  })

  it("keeps the ankle behind the forward knee in a seated-like leg geometry", () => {
    const root = makeHumanoid()
    const controller = new HumanoidIKController(root)
    const chain = controller.chains.leftLeg
    const hip = worldPos(chain.upper)
    const ankleTarget = new THREE.Vector3(hip.x, hip.y - 0.62, hip.z + 0.05)

    controller.solveChain(chain, ankleTarget, chain.preferredBendLocal, 1)
    root.updateMatrixWorld(true)

    const knee = worldPos(chain.lower)
    const ankle = worldPos(chain.end)
    expect(knee.z).toBeGreaterThan(ankle.z + 0.03)
    expect(knee.z).toBeGreaterThan(hip.z + 0.03)
  })

  it("selects the forward elbow solution when the hand closes toward the torso", () => {
    const root = makeHumanoid()
    const controller = new HumanoidIKController(root)
    const chain = controller.chains.rightArm
    const shoulder = worldPos(chain.upper)
    const target = new THREE.Vector3(shoulder.x - 0.08, shoulder.y - 0.10, shoulder.z + 0.34)

    controller.solveChain(chain, target, chain.preferredBendLocal, 1)
    root.updateMatrixWorld(true)

    const elbow = worldPos(chain.lower)
    expect(elbow.z).toBeGreaterThan(shoulder.z + 0.02)
  })

  it("never accepts an explicitly mirrored pole behind the human", () => {
    const root = makeHumanoid()
    const controller = new HumanoidIKController(root)
    const chain = controller.chains.rightLeg
    const hip = worldPos(chain.upper)
    const target = new THREE.Vector3(hip.x, hip.y - 0.70, hip.z)
    const backwards = chain.preferredBendLocal.clone().multiplyScalar(-1)

    controller.solveChain(chain, target, backwards, 1)
    root.updateMatrixWorld(true)

    const knee = worldPos(chain.lower)
    expect(knee.z).toBeGreaterThan(hip.z)
  })
})
