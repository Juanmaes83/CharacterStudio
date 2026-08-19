import * as THREE from "three"
import { MotionController } from "../animation/MotionController"
import { registerMotionFoundationV2 } from "../animation/MotionFoundationV2"
import { registerMotionFoundationV2Extra } from "../animation/MotionFoundationV2Extra"
import { createInteractionBenchmarks } from "../interaction/InteractionBenchmarks"
import { CharacterActionAPI } from "../api/CharacterActionAPI"
import { runMotionLabFoundationAction } from "../lab/MotionLabLocomotion"

function bone(name, position) {
  const b = new THREE.Bone()
  b.name = name
  b.position.set(...position)
  return b
}

function buildHumanoid() {
  const root = new THREE.Group()
  root.name = "E2E_TerrainHumanoid"

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

function run(controller, name, fraction = 0.96) {
  controller.playAction(name, { fadeSeconds: 0 })
  const action = controller.actions.get(name)
  const duration = action.getClip().duration
  const target = duration * fraction
  const step = 1 / 60
  let elapsed = 0
  while (elapsed < target) {
    controller.update(step)
    elapsed += step
  }
  return controller.root.position.clone()
}

function runNavigation(controller, maxSeconds = 5) {
  const step = 1 / 60
  let elapsed = 0
  while (elapsed < maxSeconds && controller.navigation.mode !== "IDLE") {
    controller.update(step)
    elapsed += step
  }
  return elapsed
}

const scene = new THREE.Scene()
createInteractionBenchmarks(scene)
const root = buildHumanoid()
scene.add(root)
const controller = new MotionController(root)
registerMotionFoundationV2(controller, root)
registerMotionFoundationV2Extra(controller, root)
const actionApi = new CharacterActionAPI({ root, controller })

const report = []
const walkStart = root.position.clone()
const walkDispatch = runMotionLabFoundationAction({ action: "WALK_V2", root, actionApi, walkDistance: 1.35 })
runNavigation(controller)
const walkEnd = root.position.clone()
report.push({
  action: "WALK_V2_BUTTON",
  mode: walkDispatch.mode,
  start: walkStart.toArray(),
  position: walkEnd.toArray(),
  distance: walkStart.distanceTo(walkEnd),
  navigationMode: controller.navigation.mode,
  pass: walkDispatch.mode === "moveTo" && walkStart.distanceTo(walkEnd) > 1.15 && controller.navigation.mode === "IDLE",
})
root.position.copy(walkStart)
root.quaternion.identity()
controller.navigation.mode = "IDLE"
controller.navigation.target = null
controller.transitionTo("IDLE_V2", 0)

const start = root.position.clone()
const stepUp = run(controller, "STEP_UP")
report.push({ action: "STEP_UP", position: stepUp.toArray(), pass: stepUp.y > start.y + 0.14 && Math.abs(stepUp.x + 0.55) < 0.30 })

const stepDown = run(controller, "STEP_DOWN")
report.push({ action: "STEP_DOWN", position: stepDown.toArray(), pass: stepDown.y < 0.07 })

const stairsStart = root.position.clone()
const stairsUp = run(controller, "STAIRS_UP")
report.push({ action: "STAIRS_UP", position: stairsUp.toArray(), pass: stairsUp.y > stairsStart.y + 0.38 && stairsUp.z > stairsStart.z + 0.20 })

const stairsDown = run(controller, "STAIRS_DOWN")
report.push({ action: "STAIRS_DOWN", position: stairsDown.toArray(), pass: stairsDown.y < 0.08 })

const ladder = scene.getObjectByName("BenchmarkLadder")
const ladderRungs = Array.from({ length: 7 }, (_, i) => scene.getObjectByName(`BenchmarkLadderRung_${i}`)).filter(Boolean)
const ladderStart = root.position.clone()
const ladderUp = run(controller, "LADDER_UP")
report.push({
  action: "LADDER_UP",
  position: ladderUp.toArray(),
  ladderExists: Boolean(ladder),
  rungCount: ladderRungs.length,
  pass: Boolean(ladder) && ladderRungs.length === 7 && ladderUp.y > ladderStart.y + 0.42,
})

const ladderDown = run(controller, "LADDER_DOWN")
report.push({ action: "LADDER_DOWN", position: ladderDown.toArray(), pass: ladderDown.y < ladderUp.y - 0.40 && ladderDown.y >= -0.001 })

const pass = report.every((item) => item.pass)
const resultNode = document.getElementById("result")
const reportNode = document.getElementById("report")
resultNode.textContent = pass ? "PASS — WALK + TERRAIN USE WORLD-SPACE MOVEMENT" : "FAIL — LOCOMOTION/TERRAIN REGRESSION"
resultNode.dataset.status = pass ? "pass" : "fail"
resultNode.className = pass ? "pass" : "fail"
reportNode.textContent = JSON.stringify(report, null, 2)
window.__CHARACTER2027_TERRAIN_E2E__ = { pass, report }
actionApi.dispose()
controller.dispose()
