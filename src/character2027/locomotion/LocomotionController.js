import * as THREE from "three"

const _target = new THREE.Vector3()
const _flat = new THREE.Vector3()
const _forward = new THREE.Vector3()
const _desiredQuaternion = new THREE.Quaternion()
const _up = new THREE.Vector3(0, 1, 0)

export class LocomotionController {
  constructor(root, motionController, options = {}) {
    this.root = root
    this.motion = motionController
    this.walkSpeed = options.walkSpeed ?? 1.15
    this.turnSpeed = options.turnSpeed ?? 8
    this.stopDistance = options.stopDistance ?? 0.08
    this.turnTolerance = options.turnTolerance ?? THREE.MathUtils.degToRad(2)
    this.target = null
    this.facingTarget = null
    this.mode = "IDLE"
    this.onArrive = null
  }

  walkTo(target, options = {}) {
    this.target = _target.copy(target).clone()
    this.target.y = this.root.position.y
    this.walkSpeed = options.walkSpeed ?? this.walkSpeed
    this.stopDistance = options.stopDistance ?? this.stopDistance
    this.onArrive = options.onArrive ?? null
    this.mode = "WALK_TO"
    if (this.motion.has("WALK")) this.motion.transitionTo("WALK")
  }

  turnTo(target) {
    this.facingTarget = _target.copy(target).clone()
    this.facingTarget.y = this.root.position.y
    this.mode = "TURN_TO"
  }

  stop() {
    this.target = null
    this.facingTarget = null
    this.mode = "IDLE"
    if (this.motion.has("STOP")) this.motion.transitionTo("STOP")
    else if (this.motion.has("IDLE")) this.motion.transitionTo("IDLE")
  }

  _rotateToward(target, delta) {
    _flat.subVectors(target, this.root.position)
    _flat.y = 0
    if (_flat.lengthSq() < 1e-8) return 0
    _flat.normalize()

    _forward.set(0, 0, 1)
    _desiredQuaternion.setFromUnitVectors(_forward, _flat)
    const angle = this.root.quaternion.angleTo(_desiredQuaternion)
    const step = Math.min(1, (this.turnSpeed * delta) / Math.max(angle, 1e-5))
    this.root.quaternion.slerp(_desiredQuaternion, step)
    return angle
  }

  update(delta) {
    if (this.mode === "WALK_TO" && this.target) {
      const angle = this._rotateToward(this.target, delta)
      _flat.subVectors(this.target, this.root.position)
      _flat.y = 0
      const distance = _flat.length()

      if (distance <= this.stopDistance) {
        const callback = this.onArrive
        this.target = null
        this.onArrive = null
        this.mode = "IDLE"
        if (this.motion.has("STOP")) this.motion.transitionTo("STOP")
        else if (this.motion.has("IDLE")) this.motion.transitionTo("IDLE")
        callback?.()
        return
      }

      _flat.normalize()
      const speedScale = THREE.MathUtils.clamp(distance / 0.35, 0.2, 1)
      const turnScale = THREE.MathUtils.clamp(1 - angle / Math.PI, 0.25, 1)
      const step = Math.min(distance, this.walkSpeed * speedScale * turnScale * delta)
      this.root.position.addScaledVector(_flat, step)
      return
    }

    if (this.mode === "TURN_TO" && this.facingTarget) {
      const angle = this._rotateToward(this.facingTarget, delta)
      if (angle <= this.turnTolerance) {
        this.facingTarget = null
        this.mode = "IDLE"
        if (this.motion.has("IDLE")) this.motion.transitionTo("IDLE")
      }
    }
  }
}
