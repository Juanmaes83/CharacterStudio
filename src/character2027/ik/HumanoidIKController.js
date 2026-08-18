import * as THREE from "three"
import { solveTwoBoneJointDecomposed } from "./DonorTwoBoneIK"

const _rootPos = new THREE.Vector3()
const _jointPos = new THREE.Vector3()
const _endPos = new THREE.Vector3()
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
const _localTarget = new THREE.Vector3()

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

function localOffsetToWorld(root, offset, out = new THREE.Vector3()) {
  out.copy(offset)
  return root.localToWorld(out)
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

export class HumanoidIKController {
  constructor(root) {
    this.root = root
    this.enabled = true
    this.state = null
    this.stateTime = 0
    this.actionDuration = 1

    this.chains = {
      leftArm: makeChain(root, ["leftUpperArm", "leftLowerArm", "leftHand"], new THREE.Vector3(-1, 0.15, 0.35)),
      rightArm: makeChain(root, ["rightUpperArm", "rightLowerArm", "rightHand"], new THREE.Vector3(1, 0.15, 0.35)),
      leftLeg: makeChain(root, ["leftUpperLeg", "leftLowerLeg", "leftFoot"], new THREE.Vector3(-0.18, 0.05, 1)),
      rightLeg: makeChain(root, ["rightUpperLeg", "rightLowerLeg", "rightFoot"], new THREE.Vector3(0.18, 0.05, 1)),
    }

    this.hips = getBone(root, "hips")
    this.head = getBone(root, "head")
    this.chest = getBone(root, "chest")
    this.restHipsPosition = this.hips?.position.clone() || new THREE.Vector3()
    this.restRootY = root.position.y
    this.footAnchors = {
      left: this.chains.leftLeg?.restEndWorld.clone() || null,
      right: this.chains.rightLeg?.restEndWorld.clone() || null,
    }
  }

  setState(state, action = null) {
    this.state = state
    this.stateTime = 0
    this.actionDuration = action?.getClip?.()?.duration || 1
    this.restRootY = this.root.position.y
    if (this.hips) this.restHipsPosition.copy(this.hips.position)
    if (this.chains.leftLeg) this.footAnchors.left = worldPosition(this.chains.leftLeg.end, new THREE.Vector3())
    if (this.chains.rightLeg) this.footAnchors.right = worldPosition(this.chains.rightLeg.end, new THREE.Vector3())
  }

  solveChain(chain, targetWorld, poleLocal = chain?.poleLocal, weight = 1) {
    if (!chain || !targetWorld) return
    const upperPos = worldPosition(chain.upper, _rootPos)
    localOffsetToWorld(this.root, poleLocal, _pole).sub(worldPosition(this.root, new THREE.Vector3())).normalize()
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
    return localOffsetToWorld(this.root, offset, new THREE.Vector3())
  }

  _applySocial(t) {
    const chestY = worldPosition(this.chest || this.root, new THREE.Vector3()).y
    const headY = worldPosition(this.head || this.root, new THREE.Vector3()).y
    const baseY = Math.max(chestY, headY - 0.18)

    if (this.state === "WAVE" || this.state === "GOODBYE") {
      const wave = Math.sin(t * Math.PI * 4) * 0.10
      const target = this._armTarget(new THREE.Vector3(0.42, baseY - this.root.position.y + wave, 0.18))
      this.solveChain(this.chains.rightArm, target, new THREE.Vector3(0.8, 0.2, 0.45), 0.92)
    }

    if (this.state === "POINT" || this.state === "AFTER_YOU") {
      const target = this._armTarget(new THREE.Vector3(0.45, chestY - this.root.position.y - 0.08, 0.75))
      this.solveChain(this.chains.rightArm, target, new THREE.Vector3(0.9, -0.1, 0.3), 0.92)
    }

    if (this.state === "WELCOME") {
      const left = this._armTarget(new THREE.Vector3(-0.55, chestY - this.root.position.y - 0.08, 0.35))
      const right = this._armTarget(new THREE.Vector3(0.55, chestY - this.root.position.y - 0.08, 0.35))
      this.solveChain(this.chains.leftArm, left, new THREE.Vector3(-0.9, 0.15, 0.2), 0.85)
      this.solveChain(this.chains.rightArm, right, new THREE.Vector3(0.9, 0.15, 0.2), 0.85)
    }
  }

  _applyLowerBody(t) {
    if (!this.hips) return

    const crouchLike = this.state === "CROUCH" || this.state === "SIT_SOFA" || this.state === "KNEEL"
    if (crouchLike) {
      const envelope = Math.sin(Math.PI * THREE.MathUtils.clamp(t, 0, 1))
      const depth = this.state === "SIT_SOFA" ? 0.34 : this.state === "KNEEL" ? 0.27 : 0.22
      this.hips.position.copy(this.restHipsPosition)
      this.hips.position.y -= depth * envelope
      this.hips.updateWorldMatrix(true, true)
      if (this.footAnchors.left) this.solveChain(this.chains.leftLeg, this.footAnchors.left, new THREE.Vector3(-0.2, 0.1, 1), 0.96)
      if (this.footAnchors.right) this.solveChain(this.chains.rightLeg, this.footAnchors.right, new THREE.Vector3(0.2, 0.1, 1), 0.96)
    }

    if (this.state === "JUMP") {
      const jump = Math.sin(Math.PI * THREE.MathUtils.clamp(t, 0, 1))
      this.root.position.y = this.restRootY + jump * 0.34
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
  }

  dispose() {
    if (this.hips) this.hips.position.copy(this.restHipsPosition)
    this.root.position.y = this.restRootY
  }
}
