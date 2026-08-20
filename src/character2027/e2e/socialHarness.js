import * as THREE from "three"
import { MotionController } from "../animation/MotionController"
import { registerMotionFoundationV2 } from "../animation/MotionFoundationV2"
import { registerMotionFoundationV2Extra } from "../animation/MotionFoundationV2Extra"

function bone(name, position) {
  const b = new THREE.Bone()
  b.name = name
  b.position.set(...position)
  return b
}

function buildHumanoid() {
  const root = new THREE.Group()
  root.name = "E2E_Humanoid"

  const hips = bone("hips", [0, 1, 0])
  const chest = bone("chest", [0, 0.45, 0])
  const head = bone("head", [0, 0.45, 0])
  root.add(hips); hips.add(chest); chest.add(head)

  const lua = bone("leftUpperArm", [-0.22, 0.32, 0])
  const lla = bone("leftLowerArm", [-0.34, 0, 0])
  const lh = bone("leftHand", [-0.28, 0, 0])
  chest.add(lua); lua.add(lla); lla.add(lh)

  const rua = bone("rightUpperArm", [0.22, 0.32, 0])
  const rla = bone("rightLowerArm", [0.34, 0, 0])
  const rh = bone("rightHand", [0.28, 0, 0])
  chest.add(rua); rua.add(rla); rla.add(rh)

  const lul = bone("leftUpperLeg", [-0.11, -0.06, 0])
  const lll = bone("leftLowerLeg", [0, -0.48, 0])
  const lf = bone("leftFoot", [0, -0.45, 0.08])
  hips.add(lul); lul.add(lll); lll.add(lf)

  const rul = bone("rightUpperLeg", [0.11, -0.06, 0])
  const rll = bone("rightLowerLeg", [0, -0.48, 0])
  const rf = bone("rightFoot", [0, -0.45, 0.08])
  hips.add(rul); rul.add(rll); rll.add(rf)

  root.updateMatrixWorld(true)
  return root
}

function angleFromIdentity(bone) {
  return bone.quaternion.angleTo(new THREE.Quaternion())
}

function runAction(controller, root, name, requiredBones) {
  requiredBones.forEach((boneName) => root.getObjectByName(boneName)?.quaternion.identity())
  controller.playAction(name, { fadeSeconds: 0 })
  const action = controller.actions.get(name)
  const duration = action.getClip().duration
  const step = 1 / 60
  let elapsed = 0
  let peak = Object.fromEntries(requiredBones.map((b) => [b, 0]))
  while (elapsed < duration * 0.82) {
    controller.update(step)
    elapsed += step
    requiredBones.forEach((boneName) => {
      const b = root.getObjectByName(boneName)
      if (b) peak[boneName] = Math.max(peak[boneName], angleFromIdentity(b))
    })
  }
  const tracks = action.getClip().tracks.map((track) => track.name)
  const missingTracks = requiredBones.filter((boneName) => !tracks.some((name2) => name2.startsWith(`${boneName}.`)))
  const weakBones = requiredBones.filter((boneName) => (peak[boneName] || 0) < 0.08)
  return { name, peak, tracks: tracks.length, missingTracks, weakBones, pass: missingTracks.length === 0 && weakBones.length === 0 }
}

const root = buildHumanoid()
const controller = new MotionController(root)
registerMotionFoundationV2(controller, root)
registerMotionFoundationV2Extra(controller, root)

const checks = [
  ["WAVE", ["rightUpperArm", "rightLowerArm"]],
  ["GOODBYE", ["rightUpperArm", "rightLowerArm"]],
  ["POINT", ["rightUpperArm", "rightLowerArm", "head"]],
  ["NOD", ["head"]],
  ["WELCOME", ["leftUpperArm", "rightUpperArm"]],
  ["AFTER_YOU", ["rightUpperArm", "rightLowerArm", "chest"]],
]

const results = checks.map(([name, bones]) => runAction(controller, root, name, bones))
const pass = results.every((result) => result.pass)
const resultNode = document.getElementById("result")
const reportNode = document.getElementById("report")
resultNode.textContent = pass ? "PASS — SOCIAL MOTIONS MOVE AUTHORED BONES" : "FAIL — SOCIAL MOTION REGRESSION"
resultNode.dataset.status = pass ? "pass" : "fail"
resultNode.className = pass ? "pass" : "fail"
reportNode.textContent = JSON.stringify(results, null, 2)
window.__CHARACTER2027_SOCIAL_E2E__ = { pass, results }
controller.dispose()
