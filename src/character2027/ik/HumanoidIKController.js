import * as THREE from "three"
import { solveTwoBoneJointDecomposed } from "./DonorTwoBoneIK"

const V = () => new THREE.Vector3()
const _rootPos = V()
const _jointPos = V()
const _childPos = V()
const _currentDir = V()
const _desiredDir = V()
const _pole = V()
const _restAxis = V()
const _parentWorldQ = new THREE.Quaternion()
const _boneWorldQ = new THREE.Quaternion()
const _newWorldQ = new THREE.Quaternion()
const _localQ = new THREE.Quaternion()
const _deltaQ = new THREE.Quaternion()
const _invParent = new THREE.Quaternion()
const _rootWorldQ = new THREE.Quaternion()
const _invRootWorldQ = new THREE.Quaternion()
const _tmpV = V()
const _tmpV2 = V()

function getBone(root, name) { return root.getObjectByName(name) || null }
function worldPosition(object, out = V()) { object.updateWorldMatrix(true, false); return object.getWorldPosition(out) }
function lengthBetween(a, b) { return worldPosition(a, V()).distanceTo(worldPosition(b, V())) }
function smoothstep01(t) { const x = THREE.MathUtils.clamp(t, 0, 1); return x * x * (3 - 2 * x) }
function enterHoldExit(t, enterEnd = .28, holdEnd = .72, exitEnd = .98) {
  if (t <= 0 || t >= exitEnd) return 0
  if (t < enterEnd) return smoothstep01(t / Math.max(enterEnd, 1e-4))
  if (t <= holdEnd) return 1
  return 1 - smoothstep01((t - holdEnd) / Math.max(exitEnd - holdEnd, 1e-4))
}
function worldDirectionFromRoot(root, localDirection, out = V()) {
  root.getWorldQuaternion(_rootWorldQ)
  return out.copy(localDirection).applyQuaternion(_rootWorldQ).normalize()
}
function worldOffsetFromAnchor(root, anchorWorld, localOffset, out = V()) {
  root.getWorldQuaternion(_rootWorldQ)
  return out.copy(localOffset).applyQuaternion(_rootWorldQ).add(anchorWorld)
}
function worldToRootDirection(root, worldDirection, out = V()) {
  root.getWorldQuaternion(_rootWorldQ)
  _invRootWorldQ.copy(_rootWorldQ).invert()
  return out.copy(worldDirection).applyQuaternion(_invRootWorldQ).normalize()
}
function projectPerpendicular(direction, axis, out = V()) {
  out.copy(direction).addScaledVector(axis, -direction.dot(axis))
  return out.lengthSq() > 1e-8 ? out.normalize() : out.set(0, 0, 0)
}
function orientBoneToward(bone, child, targetWorld, weight = 1) {
  if (!bone || !child) return
  bone.updateWorldMatrix(true, true)
  const bonePos = worldPosition(bone, _rootPos)
  const childPos = worldPosition(child, _childPos)
  _currentDir.subVectors(childPos, bonePos)
  _desiredDir.subVectors(targetWorld, bonePos)
  if (_currentDir.lengthSq() < 1e-10 || _desiredDir.lengthSq() < 1e-10) return
  _currentDir.normalize(); _desiredDir.normalize()
  _deltaQ.setFromUnitVectors(_currentDir, _desiredDir)
  bone.getWorldQuaternion(_boneWorldQ)
  _newWorldQ.copy(_deltaQ).multiply(_boneWorldQ)
  if (bone.parent) bone.parent.getWorldQuaternion(_parentWorldQ); else _parentWorldQ.identity()
  _invParent.copy(_parentWorldQ).invert()
  _localQ.copy(_invParent).multiply(_newWorldQ)
  bone.quaternion.slerp(_localQ, THREE.MathUtils.clamp(weight, 0, 1))
  bone.updateWorldMatrix(true, true)
}

function makeChain(root, names, fallbackPoleLocal) {
  const upper = getBone(root, names[0]); const lower = getBone(root, names[1]); const end = getBone(root, names[2])
  if (!upper || !lower || !end) return null
  root.updateWorldMatrix(true, true)
  const upperPos = worldPosition(upper, V()); const lowerPos = worldPosition(lower, V()); const endPos = worldPosition(end, V())
  const axisWorld = endPos.clone().sub(upperPos).normalize()
  const jointOffsetWorld = lowerPos.clone().sub(upperPos)
  const bendWorld = projectPerpendicular(jointOffsetWorld, axisWorld, V())
  const axisLocal = worldToRootDirection(root, axisWorld, V())
  let bendLocal = bendWorld.lengthSq() > 1e-8 ? worldToRootDirection(root, bendWorld, V()) : fallbackPoleLocal.clone().normalize()
  // Straight T/A poses do not reveal a stable bend plane. In that case the semantic fallback wins.
  if (Math.abs(bendLocal.dot(axisLocal)) > .96) bendLocal = fallbackPoleLocal.clone().normalize()
  return {
    upper, lower, end,
    upperLength: lengthBetween(upper, lower), lowerLength: lengthBetween(lower, end),
    restAxisLocal: axisLocal, bendPoleLocal: bendLocal, fallbackPoleLocal: fallbackPoleLocal.clone().normalize(),
    restEndWorld: endPos.clone(), lastSolvedPoleLocal: bendLocal.clone(),
  }
}

function clonePoint(value) { return value?.clone ? value.clone() : null }

export class HumanoidIKController {
  constructor(root) {
    this.root = root; this.enabled = true; this.state = null; this.stateTime = 0; this.actionDuration = 1
    this.interaction = null; this.heldObject = null
    this.chains = {
      leftArm: makeChain(root, ["leftUpperArm", "leftLowerArm", "leftHand"], new THREE.Vector3(-.65, .15, .75)),
      rightArm: makeChain(root, ["rightUpperArm", "rightLowerArm", "rightHand"], new THREE.Vector3(.65, .15, .75)),
      leftLeg: makeChain(root, ["leftUpperLeg", "leftLowerLeg", "leftFoot"], new THREE.Vector3(-.12, .02, 1)),
      rightLeg: makeChain(root, ["rightUpperLeg", "rightLowerLeg", "rightFoot"], new THREE.Vector3(.12, .02, 1)),
    }
    // Anatomical contract: +Z is Character 2027 forward. Knees are never allowed to select the rear hemisphere.
    for (const key of ["leftLeg", "rightLeg"]) {
      const chain = this.chains[key]
      if (chain && chain.bendPoleLocal.z < 0) chain.bendPoleLocal.multiplyScalar(-1)
    }
    this.hips = getBone(root, "hips"); this.chest = getBone(root, "chest"); this.neck = getBone(root, "neck"); this.head = getBone(root, "head")
    this.baseHipsPosition = this.hips?.position.clone() || V(); this.baseRootPosition = root.position.clone()
    this.footAnchors = { left: this.chains.leftLeg?.restEndWorld.clone() || null, right: this.chains.rightLeg?.restEndWorld.clone() || null }
    this.diagnostics = { kneeHemisphereCorrections: 0, elbowHemisphereCorrections: 0, unreachableTargets: 0 }
  }

  _restoreHeldObject() {
    const held = this.heldObject; if (!held) return
    const { object, parent, position, quaternion, scale } = held
    parent?.attach?.(object); object.position.copy(position); object.quaternion.copy(quaternion); object.scale.copy(scale); object.updateWorldMatrix(true, true)
    this.heldObject = null
  }
  _restoreInteractionPose() {
    if (!this.interaction) return
    const { baseRootPosition, doorPivot, doorBaseQuaternion } = this.interaction
    if (baseRootPosition) this.root.position.copy(baseRootPosition)
    if (doorPivot && doorBaseQuaternion) doorPivot.quaternion.copy(doorBaseQuaternion)
    this._restoreHeldObject(); this.interaction = null
  }
  setInteraction(name, target) {
    this._restoreInteractionPose(); const object = target?.object || null
    this.interaction = {
      name, target, contactPoint: clonePoint(target?.contactPoint), gripPoint: clonePoint(target?.gripPoint || target?.contactPoint), secondaryGripPoint: clonePoint(target?.secondaryGripPoint),
      seatPoint: clonePoint(target?.seatPoint), footLeft: clonePoint(target?.footLeft), footRight: clonePoint(target?.footRight), pelvisContact: clonePoint(target?.pelvisContact), shoulderContact: clonePoint(target?.shoulderContact), surfaceNormal: clonePoint(target?.surfaceNormal),
      baseRootPosition: this.root.position.clone(), object, objectParent: object?.parent || null, objectPosition: object?.position.clone() || null, objectQuaternion: object?.quaternion.clone() || null, objectScale: object?.scale.clone() || null,
      doorPivot: target?.doorPivot || null, doorBaseQuaternion: target?.doorPivot?.quaternion.clone() || null, attached: false,
    }
  }
  clearInteraction() { this._restoreInteractionPose() }
  setState(state, action = null) {
    const previous = this.state
    if (previous && previous !== state && this.interaction?.name === previous) this._restoreInteractionPose()
    this.state = state; this.stateTime = 0; this.actionDuration = action?.getClip?.()?.duration || 1
    if (previous === "JUMP" && state !== "JUMP") this.root.position.copy(this.baseRootPosition)
    if (this.hips && !["CROUCH", "SIT_SOFA", "KNEEL"].includes(state)) this.hips.position.copy(this.baseHipsPosition)
    if (this.chains.leftLeg) this.footAnchors.left = worldPosition(this.chains.leftLeg.end, V())
    if (this.chains.rightLeg) this.footAnchors.right = worldPosition(this.chains.rightLeg.end, V())
  }

  _stablePole(chain, requestedLocal) {
    if (!chain) return requestedLocal
    const semantic = chain.bendPoleLocal
    const candidate = (requestedLocal || semantic).clone().normalize()
    // Keep every solve in the same anatomical hemisphere. This prevents knee/elbow popping backwards.
    if (candidate.dot(semantic) < 0) {
      candidate.multiplyScalar(-1)
      if (chain === this.chains.leftLeg || chain === this.chains.rightLeg) this.diagnostics.kneeHemisphereCorrections++
      else this.diagnostics.elbowHemisphereCorrections++
    }
    if ((chain === this.chains.leftLeg || chain === this.chains.rightLeg) && candidate.z < .08) {
      candidate.z = Math.abs(candidate.z) + .35; candidate.normalize(); this.diagnostics.kneeHemisphereCorrections++
    }
    chain.lastSolvedPoleLocal.copy(candidate)
    return candidate
  }

  solveChain(chain, targetWorld, requestedPoleLocal = null, weight = 1) {
    if (!chain || !targetWorld) return
    const upperPos = worldPosition(chain.upper, _rootPos)
    const poleLocal = this._stablePole(chain, requestedPoleLocal)
    worldDirectionFromRoot(this.root, poleLocal, _pole)
    // restAxisLocal is stored in root-local space exactly once. Do not rotate a world-space rest axis twice.
    worldDirectionFromRoot(this.root, chain.restAxisLocal, _restAxis)
    const maxReach = chain.upperLength + chain.lowerLength - 1e-4
    _tmpV.subVectors(targetWorld, upperPos)
    const safeTarget = targetWorld.clone()
    if (_tmpV.length() > maxReach) { safeTarget.copy(upperPos).add(_tmpV.setLength(maxReach)); this.diagnostics.unreachableTargets++ }
    solveTwoBoneJointDecomposed(upperPos, safeTarget, chain.upperLength, chain.lowerLength, _pole, _restAxis, _jointPos)
    orientBoneToward(chain.upper, chain.lower, _jointPos, weight)
    orientBoneToward(chain.lower, chain.end, safeTarget, weight)
  }

  _applySocial(t) {
    const chestPos = worldPosition(this.chest || this.root, V()); const headPos = worldPosition(this.head || this.root, V())
    if (this.state === "WAVE" || this.state === "GOODBYE") {
      const wave = Math.sin(t * Math.PI * 4) * .08
      this.solveChain(this.chains.rightArm, worldOffsetFromAnchor(this.root, headPos, new THREE.Vector3(.38, .04 + wave, .10)), this.chains.rightArm?.bendPoleLocal, .96)
    }
    if (this.state === "POINT") this.solveChain(this.chains.rightArm, worldOffsetFromAnchor(this.root, chestPos, new THREE.Vector3(.30, -.02, .72)), this.chains.rightArm?.bendPoleLocal, .96)
    if (this.state === "AFTER_YOU") this.solveChain(this.chains.rightArm, worldOffsetFromAnchor(this.root, chestPos, new THREE.Vector3(.48, -.24, .42)), this.chains.rightArm?.bendPoleLocal, .94)
    if (this.state === "WELCOME") {
      this.solveChain(this.chains.leftArm, worldOffsetFromAnchor(this.root, chestPos, new THREE.Vector3(-.48, -.12, .28)), this.chains.leftArm?.bendPoleLocal, .92)
      this.solveChain(this.chains.rightArm, worldOffsetFromAnchor(this.root, chestPos, new THREE.Vector3(.48, -.12, .28)), this.chains.rightArm?.bendPoleLocal, .92)
    }
  }

  _solvePlantedLegs(weight = .99, leftTarget = this.footAnchors.left, rightTarget = this.footAnchors.right) {
    if (leftTarget) this.solveChain(this.chains.leftLeg, leftTarget, this.chains.leftLeg?.bendPoleLocal, weight)
    if (rightTarget) this.solveChain(this.chains.rightLeg, rightTarget, this.chains.rightLeg?.bendPoleLocal, weight)
  }

  _applyStepLike(t, direction = 1, stairs = false) {
    const left = this.footAnchors.left?.clone(); const right = this.footAnchors.right?.clone(); if (!left || !right) return
    const phase = stairs ? ((t * 2) % 1) : t
    const useLeft = stairs ? t < .5 : true
    const swing = smoothstep01(Math.min(1, phase / .72)); const lift = Math.sin(Math.PI * THREE.MathUtils.clamp(phase / .82, 0, 1))
    const active = useLeft ? left : right; const support = useLeft ? right : left
    const stepForward = .28 * direction; const stepHeight = .22 * direction
    active.add(worldDirectionFromRoot(this.root, new THREE.Vector3(0, 0, stepForward), V()))
    active.y += (direction > 0 ? .22 * swing : -.16 * swing) + .10 * lift
    if (stairs) active.y += direction > 0 ? .08 : -.06
    if (this.hips) {
      const rise = (direction > 0 ? .11 : -.07) * smoothstep01(Math.min(1, t * 1.3))
      this.hips.position.copy(this.baseHipsPosition); this.hips.position.y += rise
    }
    if (useLeft) this._solvePlantedLegs(.99, active, support); else this._solvePlantedLegs(.99, support, active)
  }

  _applyLowerBody(t) {
    if (!this.hips) return
    const isPose = ["CROUCH", "SIT_SOFA", "KNEEL"].includes(this.state)
    if (!isPose) this.hips.position.copy(this.baseHipsPosition)
    if (this.state === "CROUCH" || this.state === "KNEEL") {
      const e = enterHoldExit(t, this.state === "KNEEL" ? .34 : .30, .70, .98)
      const depth = this.state === "KNEEL" ? .28 : .22
      this.hips.position.copy(this.baseHipsPosition); this.hips.position.y -= depth * e; this.hips.updateWorldMatrix(true, true)
      if (this.state === "KNEEL" && this.footAnchors.left) {
        const left = this.footAnchors.left.clone().add(worldDirectionFromRoot(this.root, new THREE.Vector3(0, 0, -.12 * e), V()))
        this._solvePlantedLegs(.99, left, this.footAnchors.right)
      } else this._solvePlantedLegs(.99)
    }
    if (this.state === "JUMP") {
      const x = THREE.MathUtils.clamp(t, 0, 1)
      const compression = x < .22 ? smoothstep01(x / .22) : x > .72 ? 1 - smoothstep01((x - .72) / .28) : 0
      const airborne = x > .18 && x < .82 ? Math.sin(((x - .18) / .64) * Math.PI) : 0
      this.root.position.y = this.baseRootPosition.y + airborne * .34
      this.hips.position.copy(this.baseHipsPosition); this.hips.position.y -= .12 * compression
      this._solvePlantedLegs(airborne > .03 ? .22 : .96)
    }
    if (this.state === "STEP_UP") this._applyStepLike(t, 1, false)
    if (this.state === "STEP_DOWN") this._applyStepLike(t, -1, false)
    if (this.state === "STAIRS_UP") this._applyStepLike(t, 1, true)
    if (this.state === "STAIRS_DOWN") this._applyStepLike(t, -1, true)
  }

  _attachObjectToHand(interaction, handChain, localPosition, localEuler = null) {
    if (!interaction.object || !handChain?.end || interaction.attached) return
    const object = interaction.object
    this.heldObject = { object, parent: interaction.objectParent, position: interaction.objectPosition.clone(), quaternion: interaction.objectQuaternion.clone(), scale: interaction.objectScale.clone() }
    handChain.end.attach(object); object.position.copy(localPosition); if (localEuler) object.quaternion.setFromEuler(localEuler); object.updateWorldMatrix(true, true); interaction.attached = true
  }
  _releaseObject(interaction) { if (!interaction.attached) return; this._restoreHeldObject(); interaction.attached = false }
  _applyReachInteraction(t, interaction, options = {}) {
    const chain = options.hand === "left" ? this.chains.leftArm : this.chains.rightArm
    if (!chain || !interaction.contactPoint) return
    const e = enterHoldExit(t, options.inEnd ?? .36, options.outStart ?? .78, options.outEnd ?? .98)
    const shoulder = worldPosition(chain.upper, V()); const rest = chain.restEndWorld.clone(); const target = rest.lerp(interaction.contactPoint, e)
    const maxReach = (chain.upperLength + chain.lowerLength) * .985; _tmpV.subVectors(target, shoulder)
    if (_tmpV.length() > maxReach) target.copy(shoulder).add(_tmpV.setLength(maxReach))
    this.solveChain(chain, target, options.pole || chain.bendPoleLocal, .99)
    return { chain, envelope: e, target }
  }

  _applyInteraction(t) {
    const i = this.interaction; if (!i || i.name !== this.state) return
    if (i.name === "PRESS_DOORBELL") { this._applyReachInteraction(t, i, { hand: "right", inEnd: .40, outStart: .72 }); return }
    if (i.name === "KNOCK_DOOR") {
      const pulse = t > .34 && t < .76 ? Math.max(0, Math.sin((t - .34) * Math.PI * 10)) * .055 : 0
      const normal = worldDirectionFromRoot(this.root, new THREE.Vector3(0, 0, 1), V()); const base = i.contactPoint.clone().addScaledVector(normal, pulse)
      const original = i.contactPoint; i.contactPoint = base; this._applyReachInteraction(t, i, { hand: "right", inEnd: .32, outStart: .80 }); i.contactPoint = original; return
    }
    if (["PICK_UP_CUP", "PICK_UP_PHONE", "PICK_UP_MAGAZINE"].includes(i.name)) {
      i.contactPoint.copy(i.gripPoint || i.contactPoint)
      const primary = this._applyReachInteraction(t, i, { hand: "right", inEnd: .34, outStart: .88 })
      if (i.name === "PICK_UP_MAGAZINE" && i.secondaryGripPoint) {
        const secondary = { ...i, contactPoint: i.secondaryGripPoint }; this._applyReachInteraction(t, secondary, { hand: "left", inEnd: .38, outStart: .86 })
      }
      if (i.name === "PICK_UP_PHONE" && t > .54 && t < .84 && primary?.chain) {
        const phoneWorld = worldPosition(primary.chain.end, V()); const support = phoneWorld.clone().add(worldDirectionFromRoot(this.root, new THREE.Vector3(-.08, -.04, .02), V()))
        this.solveChain(this.chains.leftArm, support, this.chains.leftArm?.bendPoleLocal, .78)
      }
      if (t >= .43 && t < .82 && !i.attached) {
        const localPos = i.name === "PICK_UP_CUP" ? new THREE.Vector3(.02, .055, .02) : i.name === "PICK_UP_PHONE" ? new THREE.Vector3(.01, .07, 0) : new THREE.Vector3(.02, .02, .10)
        const localEuler = i.name === "PICK_UP_PHONE" ? new THREE.Euler(0, 0, Math.PI * .5) : i.name === "PICK_UP_MAGAZINE" ? new THREE.Euler(Math.PI * .5, 0, 0) : null
        this._attachObjectToHand(i, this.chains.rightArm, localPos, localEuler)
      }
      if (t >= .86) this._releaseObject(i); return
    }
    if (i.name === "OPEN_DOOR") {
      this._applyReachInteraction(t, i, { hand: "right", inEnd: .34, outStart: .90 })
      if (i.doorPivot && i.doorBaseQuaternion) {
        const open = smoothstep01((t - .42) / .34); const close = t > .86 ? 1 - smoothstep01((t - .86) / .12) : 1
        i.doorPivot.quaternion.copy(i.doorBaseQuaternion).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI * .42 * open * close)); i.doorPivot.updateWorldMatrix(true, true)
      }
      return
    }
    if (i.name === "SIT_SOFA" && this.hips && i.seatPoint) {
      const sit = enterHoldExit(t, .38, .78, .99); const base = i.baseRootPosition
      // Human sit: pelvis travels BACK and DOWN while planted feet force knees into the calibrated forward hemisphere.
      this.root.position.x = THREE.MathUtils.lerp(base.x, i.seatPoint.x, sit * .55)
      this.root.position.z = THREE.MathUtils.lerp(base.z, i.seatPoint.z + .12, sit * .82)
      this.root.updateWorldMatrix(true, true)
      const hipsWorld = worldPosition(this.hips, V()); const desiredDrop = THREE.MathUtils.clamp(i.seatPoint.y - hipsWorld.y, -.48, .02)
      this.hips.position.copy(this.baseHipsPosition); this.hips.position.y += desiredDrop * sit
      if (this.chest) this.chest.rotateX(.14 * sit)
      this._solvePlantedLegs(.995, i.footLeft || this.footAnchors.left, i.footRight || this.footAnchors.right)
      return
    }
    if (i.name === "LEAN_WALL" && i.pelvisContact && i.surfaceNormal) {
      const lean = enterHoldExit(t, .40, .80, .99); const hipsWorld = worldPosition(this.hips || this.root, V()); const correction = i.pelvisContact.clone().sub(hipsWorld); correction.y = 0
      if (correction.length() > .24) correction.setLength(.24)
      this.root.position.copy(i.baseRootPosition).addScaledVector(correction, lean)
      if (this.hips) { this.hips.position.copy(this.baseHipsPosition); this.hips.position.y -= .05 * lean }
      if (this.chest) { const localNormal = i.surfaceNormal.clone().applyQuaternion(this.root.quaternion.clone().invert()); this.chest.rotateZ(-localNormal.x * .16 * lean); this.chest.rotateX(.06 * lean) }
      this._solvePlantedLegs(.92)
    }
  }

  getDiagnostics() { return { ...this.diagnostics, state: this.state, chains: Object.fromEntries(Object.entries(this.chains).map(([k,c]) => [k, c ? { pole: c.lastSolvedPoleLocal.toArray(), restAxis: c.restAxisLocal.toArray() } : null])) } }
  update(delta, state, action) {
    if (!this.enabled || !state) return
    if (state !== this.state) this.setState(state, action)
    this.stateTime += delta; const duration = action?.getClip?.()?.duration || this.actionDuration || 1; const actionTime = action?.time ?? this.stateTime; const t = duration > 0 ? THREE.MathUtils.clamp(actionTime / duration, 0, 1) : 0
    this._applyLowerBody(t); this._applySocial(t); this._applyInteraction(t)
  }
  dispose() { this._restoreInteractionPose(); if (this.hips) this.hips.position.copy(this.baseHipsPosition); this.root.position.copy(this.baseRootPosition) }
}
