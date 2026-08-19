import * as THREE from "three"
import { solveTwoBoneJoint } from "./DonorTwoBoneIK"

const V = () => new THREE.Vector3()
const Q = () => new THREE.Quaternion()

const _rootPos = V()
const _childPos = V()
const _currentDir = V()
const _desiredDir = V()
const _candidateA = V()
const _candidateB = V()
const _preferredWorld = V()
const _axis = V()
const _projected = V()
const _tmp = V()
const _tmp2 = V()
const _rootWorldQ = Q()
const _invRootWorldQ = Q()
const _boneWorldQ = Q()
const _parentWorldQ = Q()
const _newWorldQ = Q()
const _localQ = Q()
const _deltaQ = Q()
const _invParent = Q()

function getBone(root, name) {
  return root?.getObjectByName(name) || null
}

function worldPosition(object, out = V()) {
  object.updateWorldMatrix(true, false)
  return object.getWorldPosition(out)
}

function worldDirectionFromRoot(root, localDirection, out = V()) {
  root.getWorldQuaternion(_rootWorldQ)
  return out.copy(localDirection).applyQuaternion(_rootWorldQ).normalize()
}

function worldToRootDirection(root, worldDirection, out = V()) {
  root.getWorldQuaternion(_rootWorldQ)
  _invRootWorldQ.copy(_rootWorldQ).invert()
  return out.copy(worldDirection).applyQuaternion(_invRootWorldQ).normalize()
}

function worldOffset(root, origin, localOffset, out = V()) {
  root.getWorldQuaternion(_rootWorldQ)
  return out.copy(localOffset).applyQuaternion(_rootWorldQ).add(origin)
}

function smooth01(value) {
  const x = THREE.MathUtils.clamp(value, 0, 1)
  return x * x * (3 - 2 * x)
}

function enterHoldExit(t, enterEnd = 0.30, holdEnd = 0.72, exitEnd = 0.98) {
  if (t <= 0 || t >= exitEnd) return 0
  if (t < enterEnd) return smooth01(t / Math.max(enterEnd, 1e-4))
  if (t <= holdEnd) return 1
  return 1 - smooth01((t - holdEnd) / Math.max(exitEnd - holdEnd, 1e-4))
}

function phase(t, start, end) {
  return smooth01((t - start) / Math.max(end - start, 1e-4))
}

function orientBoneToward(bone, child, targetWorld, weight = 1) {
  if (!bone || !child) return
  bone.updateWorldMatrix(true, true)
  const bonePos = worldPosition(bone, _rootPos)
  const childPos = worldPosition(child, _childPos)
  _currentDir.subVectors(childPos, bonePos)
  _desiredDir.subVectors(targetWorld, bonePos)
  if (_currentDir.lengthSq() < 1e-10 || _desiredDir.lengthSq() < 1e-10) return

  _currentDir.normalize()
  _desiredDir.normalize()
  _deltaQ.setFromUnitVectors(_currentDir, _desiredDir)
  bone.getWorldQuaternion(_boneWorldQ)
  _newWorldQ.copy(_deltaQ).multiply(_boneWorldQ)

  if (bone.parent) bone.parent.getWorldQuaternion(_parentWorldQ)
  else _parentWorldQ.identity()
  _invParent.copy(_parentWorldQ).invert()
  _localQ.copy(_invParent).multiply(_newWorldQ)
  bone.quaternion.slerp(_localQ, THREE.MathUtils.clamp(weight, 0, 1))
  bone.updateWorldMatrix(true, true)
}

function deriveAnatomicalBasis(root) {
  root.updateWorldMatrix(true, true)
  const leftShoulder = getBone(root, "leftUpperArm")
  const rightShoulder = getBone(root, "rightUpperArm")
  const hips = getBone(root, "hips")
  const head = getBone(root, "head")

  const left = leftShoulder ? worldPosition(leftShoulder, V()) : new THREE.Vector3(-1, 0, 0)
  const right = rightShoulder ? worldPosition(rightShoulder, V()) : new THREE.Vector3(1, 0, 0)
  const low = hips ? worldPosition(hips, V()) : worldPosition(root, V())
  const high = head ? worldPosition(head, V()) : low.clone().add(new THREE.Vector3(0, 1, 0))

  const rightWorld = right.clone().sub(left).normalize()
  const upWorld = high.clone().sub(low).normalize()
  let forwardWorld = rightWorld.clone().cross(upWorld).normalize()
  if (forwardWorld.lengthSq() < 1e-8) forwardWorld.set(0, 0, 1)

  return {
    forwardLocal: worldToRootDirection(root, forwardWorld, V()),
    rightLocal: worldToRootDirection(root, rightWorld, V()),
    upLocal: worldToRootDirection(root, upWorld, V()),
  }
}

function makeChain(root, names, kind, side, basis) {
  const upper = getBone(root, names[0])
  const lower = getBone(root, names[1])
  const end = getBone(root, names[2])
  if (!upper || !lower || !end) return null

  const upperWorld = worldPosition(upper, V())
  const lowerWorld = worldPosition(lower, V())
  const endWorld = worldPosition(end, V())
  const upperLength = upperWorld.distanceTo(lowerWorld)
  const lowerLength = lowerWorld.distanceTo(endWorld)

  // Human hinge rule: knees and elbows close toward the anatomical front.
  // A small lateral term prevents perfectly coplanar singularities but never
  // changes the front/back hemisphere.
  const preferred = basis.forwardLocal.clone()
  if (kind === "arm") preferred.addScaledVector(basis.rightLocal, side === "left" ? -0.18 : 0.18)
  else preferred.addScaledVector(basis.rightLocal, side === "left" ? -0.04 : 0.04)
  preferred.normalize()

  const endLocal = root.worldToLocal(endWorld.clone())

  return {
    upper,
    lower,
    end,
    kind,
    side,
    upperLength,
    lowerLength,
    preferredBendLocal: preferred,
    bendPoleLocal: preferred.clone(), // compatibility with LadderIKExtension
    restEndLocal: endLocal,
    lastJointWorld: lowerWorld.clone(),
  }
}

function candidateBendScore(rootPoint, targetPoint, jointPoint, preferredWorld) {
  _axis.subVectors(targetPoint, rootPoint)
  const axisLength = _axis.length()
  if (axisLength < 1e-8) return -Infinity
  _axis.multiplyScalar(1 / axisLength)
  _tmp.subVectors(jointPoint, rootPoint)
  const along = _tmp.dot(_axis)
  _projected.copy(rootPoint).addScaledVector(_axis, along)
  _tmp2.subVectors(jointPoint, _projected)
  if (_tmp2.lengthSq() < 1e-10) return 0
  return _tmp2.normalize().dot(preferredWorld)
}

function clonePoint(value) {
  return value?.clone ? value.clone() : null
}

export class HumanoidIKController {
  constructor(root) {
    this.root = root
    this.enabled = true
    this.state = null
    this.stateTime = 0
    this.actionDuration = 1
    this.interaction = null
    this.heldObject = null
    this.basis = deriveAnatomicalBasis(root)

    this.chains = {
      leftArm: makeChain(root, ["leftUpperArm", "leftLowerArm", "leftHand"], "arm", "left", this.basis),
      rightArm: makeChain(root, ["rightUpperArm", "rightLowerArm", "rightHand"], "arm", "right", this.basis),
      leftLeg: makeChain(root, ["leftUpperLeg", "leftLowerLeg", "leftFoot"], "leg", "left", this.basis),
      rightLeg: makeChain(root, ["rightUpperLeg", "rightLowerLeg", "rightFoot"], "leg", "right", this.basis),
    }

    this.hips = getBone(root, "hips")
    this.chest = getBone(root, "chest")
    this.head = getBone(root, "head")
    this.baseHipsPosition = this.hips?.position.clone() || V()
    this.baseRootPosition = root.position.clone()
    this.jumpBaseY = root.position.y

    this.footAnchors = {
      left: this.chains.leftLeg ? root.localToWorld(this.chains.leftLeg.restEndLocal.clone()) : null,
      right: this.chains.rightLeg ? root.localToWorld(this.chains.rightLeg.restEndLocal.clone()) : null,
    }

    this.diagnostics = {
      hingeRejects: 0,
      unreachableTargets: 0,
      kneeBackwardsDetected: 0,
      elbowBackwardsDetected: 0,
      anatomicalForwardLocal: this.basis.forwardLocal.toArray(),
    }
  }

  getDiagnostics() {
    return { ...this.diagnostics }
  }

  _restoreHeldObject() {
    const held = this.heldObject
    if (!held) return
    const { object, parent, position, quaternion, scale } = held
    parent?.attach?.(object)
    object.position.copy(position)
    object.quaternion.copy(quaternion)
    object.scale.copy(scale)
    object.updateWorldMatrix(true, true)
    this.heldObject = null
  }

  _restoreInteractionPose() {
    if (!this.interaction) return
    const { baseRootPosition, doorPivot, doorBaseQuaternion } = this.interaction
    if (baseRootPosition) this.root.position.copy(baseRootPosition)
    if (doorPivot && doorBaseQuaternion) doorPivot.quaternion.copy(doorBaseQuaternion)
    this._restoreHeldObject()
    this.interaction = null
  }

  setInteraction(name, target) {
    this._restoreInteractionPose()
    const object = target?.object || null
    this.interaction = {
      name,
      target,
      contactPoint: clonePoint(target?.contactPoint),
      gripPoint: clonePoint(target?.gripPoint || target?.contactPoint),
      secondaryGripPoint: clonePoint(target?.secondaryGripPoint),
      seatPoint: clonePoint(target?.seatPoint),
      pelvisContact: clonePoint(target?.pelvisContact),
      shoulderContact: clonePoint(target?.shoulderContact),
      surfaceNormal: clonePoint(target?.surfaceNormal),
      baseRootPosition: this.root.position.clone(),
      baseHipsWorld: this.hips ? worldPosition(this.hips, V()) : worldPosition(this.root, V()),
      object,
      objectParent: object?.parent || null,
      objectPosition: object?.position.clone() || null,
      objectQuaternion: object?.quaternion.clone() || null,
      objectScale: object?.scale.clone() || null,
      doorPivot: target?.doorPivot || null,
      doorBaseQuaternion: target?.doorPivot?.quaternion.clone() || null,
      attached: false,
    }
  }

  clearInteraction() {
    this._restoreInteractionPose()
  }

  setState(state, action = null) {
    const previous = this.state
    if (previous && previous !== state && this.interaction?.name === previous) this._restoreInteractionPose()
    if (previous === "JUMP" && state !== "JUMP") this.root.position.y = this.jumpBaseY

    this.state = state
    this.stateTime = 0
    this.actionDuration = action?.getClip?.()?.duration || 1
    if (state === "JUMP") this.jumpBaseY = this.root.position.y

    if (this.hips && !["CROUCH", "SIT_SOFA", "KNEEL", "JUMP"].includes(state)) {
      this.hips.position.copy(this.baseHipsPosition)
    }

    // Refresh ground contacts when a new action starts.
    if (this.chains.leftLeg) this.footAnchors.left = worldPosition(this.chains.leftLeg.end, V())
    if (this.chains.rightLeg) this.footAnchors.right = worldPosition(this.chains.rightLeg.end, V())
  }

  solveChain(chain, targetWorld, requestedPoleLocal = null, weight = 1) {
    if (!chain || !targetWorld) return

    const upperPos = worldPosition(chain.upper, V())
    const safeTarget = targetWorld.clone()
    const maxReach = (chain.upperLength + chain.lowerLength) * 0.995
    const minReach = Math.max(Math.abs(chain.upperLength - chain.lowerLength) + 0.015, (chain.upperLength + chain.lowerLength) * 0.12)
    _tmp.subVectors(safeTarget, upperPos)
    let distance = _tmp.length()
    if (distance > maxReach) {
      safeTarget.copy(upperPos).add(_tmp.setLength(maxReach))
      distance = maxReach
      this.diagnostics.unreachableTargets++
    } else if (distance < minReach && distance > 1e-6) {
      safeTarget.copy(upperPos).add(_tmp.setLength(minReach))
      distance = minReach
    }

    const preferredLocal = (requestedPoleLocal || chain.preferredBendLocal).clone().normalize()
    // Hard anatomical lock: requested poles may influence lateral direction, but
    // they are never allowed to reverse the front/back bend hemisphere.
    if (preferredLocal.dot(chain.preferredBendLocal) < 0) preferredLocal.multiplyScalar(-1)
    worldDirectionFromRoot(this.root, preferredLocal, _preferredWorld)

    solveTwoBoneJoint(upperPos, safeTarget, chain.upperLength, chain.lowerLength, _preferredWorld, _candidateA)
    solveTwoBoneJoint(upperPos, safeTarget, chain.upperLength, chain.lowerLength, _preferredWorld.clone().multiplyScalar(-1), _candidateB)

    const scoreA = candidateBendScore(upperPos, safeTarget, _candidateA, _preferredWorld)
    const scoreB = candidateBendScore(upperPos, safeTarget, _candidateB, _preferredWorld)
    const chosen = scoreA >= scoreB ? _candidateA : _candidateB
    const chosenScore = Math.max(scoreA, scoreB)

    if (chosenScore < -1e-4) {
      if (chain.kind === "leg") this.diagnostics.kneeBackwardsDetected++
      else this.diagnostics.elbowBackwardsDetected++
      return
    }
    if (scoreA !== scoreB) this.diagnostics.hingeRejects++

    // Temporal continuity: at near-singular extension use the previous valid
    // joint rather than allowing the hinge to pop to the mirrored hemisphere.
    if (Math.abs(scoreA - scoreB) < 0.025 && chain.lastJointWorld) {
      const da = _candidateA.distanceToSquared(chain.lastJointWorld)
      const db = _candidateB.distanceToSquared(chain.lastJointWorld)
      const continuity = da <= db ? _candidateA : _candidateB
      if (candidateBendScore(upperPos, safeTarget, continuity, _preferredWorld) >= -1e-4) chosen.copy(continuity)
    }

    chain.lastJointWorld.copy(chosen)
    orientBoneToward(chain.upper, chain.lower, chosen, weight)
    orientBoneToward(chain.lower, chain.end, safeTarget, weight)
  }

  _rootForward(out = V()) {
    return worldDirectionFromRoot(this.root, this.basis.forwardLocal, out)
  }

  _rootRight(out = V()) {
    return worldDirectionFromRoot(this.root, this.basis.rightLocal, out)
  }

  _restFootWorld(chain) {
    return this.root.localToWorld(chain.restEndLocal.clone())
  }

  _solveLegs(leftTarget, rightTarget, weight = 0.995) {
    if (leftTarget) this.solveChain(this.chains.leftLeg, leftTarget, this.chains.leftLeg?.preferredBendLocal, weight)
    if (rightTarget) this.solveChain(this.chains.rightLeg, rightTarget, this.chains.rightLeg?.preferredBendLocal, weight)
  }

  _applyWalk(t) {
    const leftChain = this.chains.leftLeg
    const rightChain = this.chains.rightLeg
    if (!leftChain || !rightChain) return

    const forward = this._rootForward(V())
    const left = this._restFootWorld(leftChain)
    const right = this._restFootWorld(rightChain)
    const cycle = (t % 1 + 1) % 1

    // Each foot follows a restrained human gait arc. The swing foot advances
    // while it lifts; the anatomical hinge solver guarantees the knee closes
    // toward the front rather than choosing the mirrored solution.
    const leftPhase = cycle
    const rightPhase = (cycle + 0.5) % 1
    const gait = (target, p) => {
      const swing = Math.sin(Math.PI * p)
      const foreAft = Math.sin(2 * Math.PI * p) * 0.16
      target.addScaledVector(forward, foreAft)
      target.y += Math.max(0, swing) * 0.075
    }
    gait(left, leftPhase)
    gait(right, rightPhase)
    this._solveLegs(left, right, 0.995)
  }

  _applyCrouch(t, depth = 0.20) {
    if (!this.hips) return
    const e = enterHoldExit(t, 0.30, 0.70, 0.98)
    this.hips.position.copy(this.baseHipsPosition)
    this.hips.position.y -= depth * e
    this.hips.updateWorldMatrix(true, true)
    this._solveLegs(this.footAnchors.left, this.footAnchors.right)
  }

  _applyKneel(t) {
    if (!this.hips) return
    const e = enterHoldExit(t, 0.34, 0.72, 0.98)
    const forward = this._rootForward(V())
    const left = this.footAnchors.left?.clone()
    const right = this.footAnchors.right?.clone()
    this.hips.position.copy(this.baseHipsPosition)
    this.hips.position.y -= 0.26 * e
    this.hips.updateWorldMatrix(true, true)
    if (left) left.addScaledVector(forward, -0.10 * e)
    this._solveLegs(left, right)
  }

  _applyJump(t) {
    if (!this.hips) return
    const x = THREE.MathUtils.clamp(t, 0, 1)
    const forward = this._rootForward(V())

    // Human jump phases:
    // 0-.20 sit-like impulse compression; .20-.32 extension/take-off;
    // .32-.68 airborne expansion; .68-.84 prepare landing;
    // .84-.93 absorb with forward knees; .93-1 recover upright.
    let compression = 0
    let rootLift = 0
    if (x < 0.20) compression = phase(x, 0, 0.20)
    else if (x < 0.32) compression = 1 - phase(x, 0.20, 0.32)
    else if (x < 0.68) rootLift = Math.sin(Math.PI * phase(x, 0.26, 0.74)) * 0.36
    else if (x < 0.84) {
      rootLift = (1 - phase(x, 0.68, 0.84)) * 0.16
      compression = phase(x, 0.68, 0.84) * 0.45
    } else if (x < 0.93) compression = 0.45 + phase(x, 0.84, 0.93) * 0.30
    else compression = 0.75 * (1 - phase(x, 0.93, 1.0))

    this.root.position.y = this.jumpBaseY + rootLift
    this.hips.position.copy(this.baseHipsPosition)
    this.hips.position.y -= 0.18 * compression
    this.hips.updateWorldMatrix(true, true)

    if (rootLift < 0.03) {
      this._solveLegs(this.footAnchors.left, this.footAnchors.right)
    } else {
      const left = this._restFootWorld(this.chains.leftLeg)
      const right = this._restFootWorld(this.chains.rightLeg)
      // Slightly tuck the lower legs in flight, then reopen before landing.
      const tuck = x < 0.60 ? phase(x, 0.34, 0.52) : 1 - phase(x, 0.60, 0.76)
      left.addScaledVector(forward, -0.04 * tuck); left.y += 0.09 * tuck
      right.addScaledVector(forward, -0.04 * tuck); right.y += 0.09 * tuck
      this._solveLegs(left, right, 0.99)
    }
  }

  _applyStep(t, direction = 1, stairs = false) {
    const leftBase = this.footAnchors.left?.clone()
    const rightBase = this.footAnchors.right?.clone()
    if (!leftBase || !rightBase) return
    const forward = this._rootForward(V())

    if (!stairs) {
      const e = phase(t, 0.08, 0.82)
      const lift = Math.sin(Math.PI * THREE.MathUtils.clamp((t - 0.06) / 0.78, 0, 1))
      const swing = leftBase.clone().addScaledVector(forward, 0.24 * direction * e)
      swing.y += (direction > 0 ? 0.20 : -0.13) * e + 0.10 * lift
      if (this.hips) {
        this.hips.position.copy(this.baseHipsPosition)
        this.hips.position.y += (direction > 0 ? 0.08 : -0.05) * phase(t, 0.48, 0.90)
      }
      this._solveLegs(swing, rightBase)
      return
    }

    const cycle = (t % 1 + 1) % 1
    const firstHalf = cycle < 0.5
    const p = firstHalf ? cycle * 2 : (cycle - 0.5) * 2
    const swingBase = firstHalf ? leftBase : rightBase
    const supportBase = firstHalf ? rightBase : leftBase
    const e = phase(p, 0.04, 0.86)
    const lift = Math.sin(Math.PI * THREE.MathUtils.clamp(p, 0, 1))
    const swing = swingBase.clone().addScaledVector(forward, 0.22 * direction * e)
    swing.y += (direction > 0 ? 0.14 : -0.10) * e + 0.09 * lift
    if (firstHalf) this._solveLegs(swing, supportBase)
    else this._solveLegs(supportBase, swing)
  }

  _applySocial(t) {
    const chestPos = worldPosition(this.chest || this.root, V())
    const headPos = worldPosition(this.head || this.root, V())
    const rightArm = this.chains.rightArm
    const leftArm = this.chains.leftArm

    if (this.state === "WAVE" || this.state === "GOODBYE") {
      const wave = Math.sin(t * Math.PI * 4) * 0.07
      const target = worldOffset(this.root, headPos, new THREE.Vector3(0.36, 0.03 + wave, 0.12))
      this.solveChain(rightArm, target, rightArm?.preferredBendLocal, 0.98)
    } else if (this.state === "POINT") {
      const target = worldOffset(this.root, chestPos, new THREE.Vector3(0.28, -0.02, 0.70))
      this.solveChain(rightArm, target, rightArm?.preferredBendLocal, 0.98)
    } else if (this.state === "AFTER_YOU") {
      const target = worldOffset(this.root, chestPos, new THREE.Vector3(0.46, -0.22, 0.40))
      this.solveChain(rightArm, target, rightArm?.preferredBendLocal, 0.97)
    } else if (this.state === "WELCOME") {
      this.solveChain(leftArm, worldOffset(this.root, chestPos, new THREE.Vector3(-0.44, -0.10, 0.30)), leftArm?.preferredBendLocal, 0.97)
      this.solveChain(rightArm, worldOffset(this.root, chestPos, new THREE.Vector3(0.44, -0.10, 0.30)), rightArm?.preferredBendLocal, 0.97)
    }
  }

  _attachObjectToHand(i, chain, localPosition, localEuler = null) {
    if (!i.object || !chain?.end || i.attached) return
    this.heldObject = {
      object: i.object,
      parent: i.objectParent,
      position: i.objectPosition.clone(),
      quaternion: i.objectQuaternion.clone(),
      scale: i.objectScale.clone(),
    }
    chain.end.attach(i.object)
    i.object.position.copy(localPosition)
    if (localEuler) i.object.quaternion.setFromEuler(localEuler)
    i.object.updateWorldMatrix(true, true)
    i.attached = true
  }

  _releaseObject(i) {
    if (!i.attached) return
    this._restoreHeldObject()
    i.attached = false
  }

  _reachTarget(chain, target, amount = 1, weight = 0.995) {
    if (!chain || !target) return
    const rest = this._restFootWorld(chain)
    const desired = rest.lerp(target, THREE.MathUtils.clamp(amount, 0, 1))
    this.solveChain(chain, desired, chain.preferredBendLocal, weight)
  }

  _applyPickUp(t, i) {
    const right = this.chains.rightArm
    const left = this.chains.leftArm
    if (!right || !i.gripPoint) return
    const chest = worldPosition(this.chest || this.root, V())
    const forward = this._rootForward(V())
    const rightDir = this._rootRight(V())

    const reach = phase(t, 0.06, 0.34)
    const gripHold = t >= 0.34 && t < 0.82
    const carry = phase(t, 0.42, 0.60)
    const returnAmount = t > 0.82 ? 1 - phase(t, 0.82, 0.98) : 1

    // Extend first to the object's logical grip surface.
    const rightTarget = this._restFootWorld(right).lerp(i.gripPoint, reach)
    if (carry > 0) {
      // Once held, retract toward the torso. This creates natural elbow flexion
      // and communicates weight rather than leaving the arm fully extended.
      const carryTarget = chest.clone().addScaledVector(forward, 0.30).addScaledVector(rightDir, 0.22)
      carryTarget.y -= i.name === "PICK_UP_MAGAZINE" ? 0.10 : 0.02
      rightTarget.lerp(carryTarget, carry * returnAmount)
    }
    this.solveChain(right, rightTarget, right.preferredBendLocal, 0.995)

    if (i.name === "PICK_UP_MAGAZINE" && i.secondaryGripPoint && left) {
      const leftTarget = this._restFootWorld(left).lerp(i.secondaryGripPoint, reach)
      if (carry > 0) {
        const carryLeft = chest.clone().addScaledVector(forward, 0.30).addScaledVector(rightDir, -0.22)
        carryLeft.y -= 0.10
        leftTarget.lerp(carryLeft, carry * returnAmount)
      }
      this.solveChain(left, leftTarget, left.preferredBendLocal, 0.995)
    }

    if (i.name === "PICK_UP_PHONE" && left && carry > 0.2 && t < 0.80) {
      const support = chest.clone().addScaledVector(forward, 0.31).addScaledVector(rightDir, -0.10)
      support.y -= 0.02
      this.solveChain(left, support, left.preferredBendLocal, 0.90)
    }

    if (gripHold && !i.attached) {
      const local = i.name === "PICK_UP_CUP" ? new THREE.Vector3(0.02, 0.05, 0)
        : i.name === "PICK_UP_PHONE" ? new THREE.Vector3(0.01, 0.06, 0)
          : new THREE.Vector3(0.02, 0.02, 0.08)
      this._attachObjectToHand(i, right, local)
    }
    if (t >= 0.84) this._releaseObject(i)
  }

  _applyInteraction(t) {
    const i = this.interaction
    if (!i || i.name !== this.state) return

    const right = this.chains.rightArm
    if (i.name === "PRESS_DOORBELL") {
      const e = enterHoldExit(t, 0.38, 0.70, 0.98)
      const target = this._restFootWorld(right).lerp(i.contactPoint, e)
      this.solveChain(right, target, right?.preferredBendLocal, 0.995)
      return
    }

    if (i.name === "KNOCK_DOOR") {
      const e = enterHoldExit(t, 0.30, 0.80, 0.98)
      const pulse = t > 0.36 && t < 0.76 ? Math.max(0, Math.sin((t - 0.36) * Math.PI * 10)) * 0.045 : 0
      const target = this._restFootWorld(right).lerp(i.contactPoint, e)
      target.addScaledVector(this._rootForward(V()), pulse)
      this.solveChain(right, target, right?.preferredBendLocal, 0.995)
      return
    }

    if (["PICK_UP_CUP", "PICK_UP_PHONE", "PICK_UP_MAGAZINE"].includes(i.name)) {
      this._applyPickUp(t, i)
      return
    }

    if (i.name === "OPEN_DOOR") {
      const e = enterHoldExit(t, 0.34, 0.90, 0.99)
      const target = this._restFootWorld(right).lerp(i.contactPoint, e)
      this.solveChain(right, target, right?.preferredBendLocal, 0.995)
      if (i.doorPivot && i.doorBaseQuaternion) {
        const open = phase(t, 0.42, 0.76)
        const close = t > 0.88 ? 1 - phase(t, 0.88, 0.99) : 1
        i.doorPivot.quaternion.copy(i.doorBaseQuaternion).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI * 0.42 * open * close))
      }
      return
    }

    if (i.name === "SIT_SOFA" && this.hips && i.seatPoint) {
      const sit = enterHoldExit(t, 0.44, 0.82, 0.995)
      const forward = this._rootForward(V())
      const rightDir = this._rootRight(V())

      // Correct human sitting geometry:
      // sofa behind -> pelvis travels back/down -> thighs project forward ->
      // knees are the anterior-most joint -> shins return backward -> feet sit
      // near the pelvis/spine axis rather than in front of the knees.
      const horizontalDelta = i.seatPoint.clone().sub(i.baseHipsWorld)
      horizontalDelta.y = 0
      this.root.position.copy(i.baseRootPosition).addScaledVector(horizontalDelta, sit)

      this.hips.position.copy(this.baseHipsPosition)
      const baseHipsY = i.baseHipsWorld.y
      const desiredSeatY = i.seatPoint.y + 0.03
      this.hips.position.y += (desiredSeatY - baseHipsY) * sit
      this.hips.updateWorldMatrix(true, true)

      const pelvisWorld = worldPosition(this.hips, V())
      const leftFoot = pelvisWorld.clone().addScaledVector(rightDir, -0.16).addScaledVector(forward, 0.06)
      const rightFoot = pelvisWorld.clone().addScaledVector(rightDir, 0.16).addScaledVector(forward, 0.06)
      leftFoot.y = Math.min(this.footAnchors.left?.y ?? leftFoot.y, 0.025)
      rightFoot.y = Math.min(this.footAnchors.right?.y ?? rightFoot.y, 0.025)
      this._solveLegs(leftFoot, rightFoot)

      if (this.chest) this.chest.rotateX(0.10 * sit)
      return
    }

    if (i.name === "LEAN_WALL" && i.pelvisContact && i.surfaceNormal) {
      const lean = enterHoldExit(t, 0.40, 0.82, 0.995)
      const hipsWorld = worldPosition(this.hips || this.root, V())
      const correction = i.pelvisContact.clone().sub(hipsWorld)
      correction.y = 0
      if (correction.length() > 0.22) correction.setLength(0.22)
      this.root.position.copy(i.baseRootPosition).addScaledVector(correction, lean)
      if (this.hips) {
        this.hips.position.copy(this.baseHipsPosition)
        this.hips.position.y -= 0.04 * lean
      }
      this._solveLegs(this.footAnchors.left, this.footAnchors.right, 0.99)
    }
  }

  _applyLowerBody(t) {
    if (this.state === "WALK_V2" || this.state === "WALK") this._applyWalk(t)
    else if (this.state === "CROUCH") this._applyCrouch(t)
    else if (this.state === "KNEEL") this._applyKneel(t)
    else if (this.state === "JUMP") this._applyJump(t)
    else if (this.state === "STEP_UP") this._applyStep(t, 1, false)
    else if (this.state === "STEP_DOWN") this._applyStep(t, -1, false)
    else if (this.state === "STAIRS_UP") this._applyStep(t, 1, true)
    else if (this.state === "STAIRS_DOWN") this._applyStep(t, -1, true)
  }

  update(delta, state, action) {
    if (!this.enabled || !state) return
    if (state !== this.state) this.setState(state, action)
    this.stateTime += delta
    const duration = action?.getClip?.()?.duration || this.actionDuration || 1
    const actionTime = action?.time ?? this.stateTime
    const t = duration > 0 ? THREE.MathUtils.clamp(actionTime / duration, 0, 1) : 0

    this._applyLowerBody(t)
    this._applySocial(t)
    this._applyInteraction(t)
  }

  dispose() {
    this._restoreInteractionPose()
    if (this.hips) this.hips.position.copy(this.baseHipsPosition)
    this.root.position.copy(this.baseRootPosition)
  }
}
