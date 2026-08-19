import * as THREE from "three"
import { solveTwoBoneJointDecomposed } from "./DonorTwoBoneIK"

const _rootPos = new THREE.Vector3()
const _jointPos = new THREE.Vector3()
const _childPos = new THREE.Vector3()
const _currentDir = new THREE.Vector3()
const _desiredDir = new THREE.Vector3()
const _pole = new THREE.Vector3()
const _restAxis = new THREE.Vector3()
const _parentWorldQ = new THREE.Quaternion()
const _boneWorldQ = new THREE.Quaternion()
const _newWorldQ = new THREE.Quaternion()
const _localQ = new THREE.Quaternion()
const _deltaQ = new THREE.Quaternion()
const _invParent = new THREE.Quaternion()
const _rootWorldQ = new THREE.Quaternion()
const _tmpV = new THREE.Vector3()

function getBone(root, name) {
  return root.getObjectByName(name) || null
}

function worldPosition(object, out = new THREE.Vector3()) {
  object.updateWorldMatrix(true, false)
  return object.getWorldPosition(out)
}

function lengthBetween(a, b) {
  return worldPosition(a, new THREE.Vector3()).distanceTo(worldPosition(b, new THREE.Vector3()))
}

function worldDirectionFromRoot(root, localDirection, out = new THREE.Vector3()) {
  root.getWorldQuaternion(_rootWorldQ)
  return out.copy(localDirection).applyQuaternion(_rootWorldQ).normalize()
}

function worldOffsetFromAnchor(root, anchorWorld, localOffset, out = new THREE.Vector3()) {
  root.getWorldQuaternion(_rootWorldQ)
  return out.copy(localOffset).applyQuaternion(_rootWorldQ).add(anchorWorld)
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

function makeChain(root, names, poleLocal) {
  const upper = getBone(root, names[0])
  const lower = getBone(root, names[1])
  const end = getBone(root, names[2])
  if (!upper || !lower || !end) return null

  const upperLength = lengthBetween(upper, lower)
  const lowerLength = lengthBetween(lower, end)
  const upperPos = worldPosition(upper, new THREE.Vector3())
  const endPos = worldPosition(end, new THREE.Vector3())
  const restAxis = endPos.clone().sub(upperPos).normalize()

  return {
    upper,
    lower,
    end,
    upperLength,
    lowerLength,
    restAxis,
    poleLocal: poleLocal.clone(),
    restEndWorld: endPos.clone(),
  }
}

function clonePoint(value) {
  return value?.clone ? value.clone() : null
}

function smoothstep01(t) {
  const x = THREE.MathUtils.clamp(t, 0, 1)
  return x * x * (3 - 2 * x)
}

function phaseEnvelope(t, inStart = 0.12, inEnd = 0.42, outStart = 0.78, outEnd = 0.98) {
  if (t <= inStart || t >= outEnd) return 0
  if (t < inEnd) return smoothstep01((t - inStart) / Math.max(inEnd - inStart, 1e-4))
  if (t <= outStart) return 1
  return 1 - smoothstep01((t - outStart) / Math.max(outEnd - outStart, 1e-4))
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

    this.chains = {
      leftArm: makeChain(root, ["leftUpperArm", "leftLowerArm", "leftHand"], new THREE.Vector3(-1, 0.15, 0.35)),
      rightArm: makeChain(root, ["rightUpperArm", "rightLowerArm", "rightHand"], new THREE.Vector3(1, 0.15, 0.35)),
      leftLeg: makeChain(root, ["leftUpperLeg", "leftLowerLeg", "leftFoot"], new THREE.Vector3(-0.18, 0.05, 1)),
      rightLeg: makeChain(root, ["rightUpperLeg", "rightLowerLeg", "rightFoot"], new THREE.Vector3(0.18, 0.05, 1)),
    }

    this.hips = getBone(root, "hips")
    this.chest = getBone(root, "chest")
    this.neck = getBone(root, "neck")
    this.head = getBone(root, "head")
    this.baseHipsPosition = this.hips?.position.clone() || new THREE.Vector3()
    this.baseRootPosition = root.position.clone()
    this.footAnchors = {
      left: this.chains.leftLeg?.restEndWorld.clone() || null,
      right: this.chains.rightLeg?.restEndWorld.clone() || null,
    }
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
      footLeft: clonePoint(target?.footLeft),
      footRight: clonePoint(target?.footRight),
      pelvisContact: clonePoint(target?.pelvisContact),
      shoulderContact: clonePoint(target?.shoulderContact),
      surfaceNormal: clonePoint(target?.surfaceNormal),
      baseRootPosition: this.root.position.clone(),
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
    this.state = state
    this.stateTime = 0
    this.actionDuration = action?.getClip?.()?.duration || 1

    if (previous === "JUMP" && state !== "JUMP") this.root.position.y = this.baseRootPosition.y
    if (this.hips && !["CROUCH", "SIT_SOFA", "KNEEL"].includes(state)) this.hips.position.copy(this.baseHipsPosition)

    if (this.chains.leftLeg) this.footAnchors.left = worldPosition(this.chains.leftLeg.end, new THREE.Vector3())
    if (this.chains.rightLeg) this.footAnchors.right = worldPosition(this.chains.rightLeg.end, new THREE.Vector3())
  }

  solveChain(chain, targetWorld, poleLocal = chain?.poleLocal, weight = 1) {
    if (!chain || !targetWorld) return
    const upperPos = worldPosition(chain.upper, _rootPos)
    worldDirectionFromRoot(this.root, poleLocal, _pole)
    this.root.getWorldQuaternion(_boneWorldQ)
    _restAxis.copy(chain.restAxis).applyQuaternion(_boneWorldQ).normalize()

    solveTwoBoneJointDecomposed(
      upperPos,
      targetWorld,
      chain.upperLength,
      chain.lowerLength,
      _pole,
      _restAxis,
      _jointPos,
    )

    orientBoneToward(chain.upper, chain.lower, _jointPos, weight)
    orientBoneToward(chain.lower, chain.end, targetWorld, weight)
  }

  _armTarget(offset) {
    return worldOffsetFromAnchor(this.root, worldPosition(this.chest || this.root, new THREE.Vector3()), offset, new THREE.Vector3())
  }

  _applySocial(t) {
    const chestPos = worldPosition(this.chest || this.root, new THREE.Vector3())
    const headPos = worldPosition(this.head || this.root, new THREE.Vector3())

    if (this.state === "WAVE" || this.state === "GOODBYE") {
      const wave = Math.sin(t * Math.PI * 4) * 0.08
      const target = worldOffsetFromAnchor(this.root, headPos, new THREE.Vector3(0.38, 0.04 + wave, 0.10))
      this.solveChain(this.chains.rightArm, target, new THREE.Vector3(0.85, 0.25, 0.4), 0.94)
    }

    if (this.state === "POINT") {
      const target = worldOffsetFromAnchor(this.root, chestPos, new THREE.Vector3(0.30, -0.02, 0.72))
      this.solveChain(this.chains.rightArm, target, new THREE.Vector3(0.9, -0.05, 0.25), 0.94)
    }

    if (this.state === "AFTER_YOU") {
      const target = worldOffsetFromAnchor(this.root, chestPos, new THREE.Vector3(0.48, -0.24, 0.42))
      this.solveChain(this.chains.rightArm, target, new THREE.Vector3(0.9, -0.15, 0.18), 0.92)
    }

    if (this.state === "WELCOME") {
      const left = worldOffsetFromAnchor(this.root, chestPos, new THREE.Vector3(-0.48, -0.12, 0.28))
      const right = worldOffsetFromAnchor(this.root, chestPos, new THREE.Vector3(0.48, -0.12, 0.28))
      this.solveChain(this.chains.leftArm, left, new THREE.Vector3(-0.9, 0.12, 0.2), 0.9)
      this.solveChain(this.chains.rightArm, right, new THREE.Vector3(0.9, 0.12, 0.2), 0.9)
    }
  }

  _applyLowerBody(t) {
    if (!this.hips) return

    const crouchLike = this.state === "CROUCH" || this.state === "SIT_SOFA" || this.state === "KNEEL"
    if (!crouchLike) this.hips.position.copy(this.baseHipsPosition)

    if (crouchLike && this.state !== "SIT_SOFA") {
      const envelope = Math.sin(Math.PI * THREE.MathUtils.clamp(t, 0, 1))
      const depth = this.state === "KNEEL" ? 0.27 : 0.22
      this.hips.position.copy(this.baseHipsPosition)
      this.hips.position.y -= depth * envelope
      this.hips.updateWorldMatrix(true, true)
      if (this.footAnchors.left) this.solveChain(this.chains.leftLeg, this.footAnchors.left, new THREE.Vector3(-0.2, 0.05, 1), 0.98)
      if (this.footAnchors.right) this.solveChain(this.chains.rightLeg, this.footAnchors.right, new THREE.Vector3(0.2, 0.05, 1), 0.98)
    }

    if (this.state === "JUMP") {
      const jump = Math.sin(Math.PI * THREE.MathUtils.clamp(t, 0, 1))
      this.root.position.y = this.baseRootPosition.y + jump * 0.34
    }
  }

  _attachObjectToHand(interaction, handChain, localPosition, localEuler = null) {
    if (!interaction.object || !handChain?.end || interaction.attached) return
    const object = interaction.object
    const originalParent = interaction.objectParent
    this.heldObject = {
      object,
      parent: originalParent,
      position: interaction.objectPosition.clone(),
      quaternion: interaction.objectQuaternion.clone(),
      scale: interaction.objectScale.clone(),
    }
    handChain.end.attach(object)
    object.position.copy(localPosition)
    if (localEuler) object.quaternion.setFromEuler(localEuler)
    object.updateWorldMatrix(true, true)
    interaction.attached = true
  }

  _releaseObject(interaction) {
    if (!interaction.attached) return
    this._restoreHeldObject()
    interaction.attached = false
  }

  _applyReachInteraction(t, interaction, options = {}) {
    const chain = options.hand === "left" ? this.chains.leftArm : this.chains.rightArm
    if (!chain || !interaction.contactPoint) return
    const envelope = phaseEnvelope(t, options.inStart ?? 0.1, options.inEnd ?? 0.38, options.outStart ?? 0.76, options.outEnd ?? 0.98)
    const shoulder = worldPosition(chain.upper, new THREE.Vector3())
    const rest = worldPosition(chain.end, new THREE.Vector3())
    const target = rest.clone().lerp(interaction.contactPoint, envelope)
    const maxReach = (chain.upperLength + chain.lowerLength) * 0.985
    _tmpV.subVectors(target, shoulder)
    if (_tmpV.length() > maxReach) target.copy(shoulder).add(_tmpV.setLength(maxReach))
    this.solveChain(chain, target, options.pole || new THREE.Vector3(options.hand === "left" ? -0.9 : 0.9, 0.08, 0.35), 0.98)
    return { chain, envelope, target }
  }

  _applyInteraction(t) {
    const i = this.interaction
    if (!i || i.name !== this.state) return

    if (i.name === "PRESS_DOORBELL") {
      this._applyReachInteraction(t, i, { hand: "right", inEnd: 0.42, outStart: 0.70 })
      return
    }

    if (i.name === "KNOCK_DOOR") {
      const pulse = t > 0.34 && t < 0.76 ? Math.max(0, Math.sin((t - 0.34) * Math.PI * 10)) * 0.055 : 0
      const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(this.root.quaternion)
      const base = i.contactPoint.clone().addScaledVector(normal, pulse)
      const original = i.contactPoint
      i.contactPoint = base
      this._applyReachInteraction(t, i, { hand: "right", inEnd: 0.34, outStart: 0.78, pole: new THREE.Vector3(0.9, 0.2, 0.25) })
      i.contactPoint = original
      return
    }

    if (["PICK_UP_CUP", "PICK_UP_PHONE", "PICK_UP_MAGAZINE"].includes(i.name)) {
      const primary = this._applyReachInteraction(t, i, { hand: "right", inEnd: 0.34, outStart: 0.88, pole: new THREE.Vector3(0.9, 0.05, 0.30) })
      if (i.name === "PICK_UP_MAGAZINE" && i.secondaryGripPoint) {
        const secondary = { ...i, contactPoint: i.secondaryGripPoint }
        this._applyReachInteraction(t, secondary, { hand: "left", inEnd: 0.38, outStart: 0.86, pole: new THREE.Vector3(-0.9, 0.05, 0.30) })
      }
      if (i.name === "PICK_UP_PHONE" && t > 0.56 && t < 0.84 && this.chains.leftArm && primary?.chain) {
        const phoneWorld = worldPosition(primary.chain.end, new THREE.Vector3())
        const support = phoneWorld.clone().add(new THREE.Vector3(-0.08, -0.04, 0.02).applyQuaternion(this.root.quaternion))
        this.solveChain(this.chains.leftArm, support, new THREE.Vector3(-0.9, 0.05, 0.25), 0.72)
      }
      if (t >= 0.43 && t < 0.82 && !i.attached) {
        const localPos = i.name === "PICK_UP_CUP" ? new THREE.Vector3(0.02, 0.055, 0.02)
          : i.name === "PICK_UP_PHONE" ? new THREE.Vector3(0.01, 0.07, 0)
            : new THREE.Vector3(0.02, 0.02, 0.10)
        this._attachObjectToHand(i, this.chains.rightArm, localPos)
      }
      if (t >= 0.86) this._releaseObject(i)
      return
    }

    if (i.name === "OPEN_DOOR") {
      this._applyReachInteraction(t, i, { hand: "right", inEnd: 0.34, outStart: 0.90, pole: new THREE.Vector3(0.9, 0.05, 0.32) })
      if (i.doorPivot && i.doorBaseQuaternion) {
        const open = smoothstep01((t - 0.42) / 0.36)
        const close = t > 0.86 ? 1 - smoothstep01((t - 0.86) / 0.12) : 1
        const angle = -Math.PI * 0.42 * open * close
        i.doorPivot.quaternion.copy(i.doorBaseQuaternion).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle))
        i.doorPivot.updateWorldMatrix(true, true)
      }
      return
    }

    if (i.name === "SIT_SOFA" && this.hips && i.seatPoint) {
      const sit = phaseEnvelope(t, 0.08, 0.45, 0.82, 0.99)
      const hipsWorld = worldPosition(this.hips, new THREE.Vector3())
      const deltaY = THREE.MathUtils.clamp((i.seatPoint.y - hipsWorld.y) * sit, -0.52, 0.08)
      this.hips.position.copy(this.baseHipsPosition)
      this.hips.position.y += deltaY
      const base = i.baseRootPosition
      this.root.position.x = THREE.MathUtils.lerp(base.x, i.seatPoint.x, sit * 0.55)
      this.root.position.z = THREE.MathUtils.lerp(base.z, i.seatPoint.z + 0.18, sit * 0.72)
      this.root.updateWorldMatrix(true, true)
      if (i.footLeft) this.solveChain(this.chains.leftLeg, i.footLeft, new THREE.Vector3(-0.22, 0.04, 1), 0.98)
      if (i.footRight) this.solveChain(this.chains.rightLeg, i.footRight, new THREE.Vector3(0.22, 0.04, 1), 0.98)
      if (this.chest) this.chest.rotateX(0.10 * sit)
      return
    }

    if (i.name === "LEAN_WALL" && i.pelvisContact && i.surfaceNormal) {
      const lean = phaseEnvelope(t, 0.10, 0.42, 0.82, 0.99)
      const hipsWorld = worldPosition(this.hips || this.root, new THREE.Vector3())
      const correction = i.pelvisContact.clone().sub(hipsWorld)
      correction.y = 0
      if (correction.length() > 0.24) correction.setLength(0.24)
      this.root.position.copy(i.baseRootPosition).addScaledVector(correction, lean)
      if (this.hips) {
        this.hips.position.copy(this.baseHipsPosition)
        this.hips.position.y -= 0.05 * lean
      }
      if (this.chest) {
        const localNormal = i.surfaceNormal.clone().applyQuaternion(this.root.quaternion.clone().invert())
        this.chest.rotateZ(-localNormal.x * 0.16 * lean)
        this.chest.rotateX(0.06 * lean)
      }
    }
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
