import * as THREE from "three"

export const MOTION_STATES = ["IDLE", "WALK", "STOP", "TURN_LEFT", "TURN_RIGHT"]

const _direction = new THREE.Vector3()
const _forward = new THREE.Vector3(0, 0, 1)
const _desiredQuaternion = new THREE.Quaternion()

export class MotionController {
  constructor(root) {
    this.root = root
    this.mixer = new THREE.AnimationMixer(root)
    this.actions = new Map()
    this.actionOptions = new Map()
    this.currentState = null
    this.currentAction = null
    this.fadeSeconds = 0.22

    this.navigation = {
      mode: "IDLE",
      target: null,
      facingTarget: null,
      walkSpeed: 1.15,
      turnSpeed: 8,
      stopDistance: 0.08,
      turnTolerance: THREE.MathUtils.degToRad(2),
      onArrive: null,
    }

    this._onFinished = (event) => {
      if (event.action !== this.currentAction) return
      const options = this.actionOptions.get(this.currentState) || {}
      let recoverTo = options.recoverTo
      if (recoverTo === undefined) recoverTo = this.has("IDLE_V2") ? "IDLE_V2" : (this.has("IDLE") ? "IDLE" : null)
      if (recoverTo && this.has(recoverTo) && recoverTo !== this.currentState) {
        this.transitionTo(recoverTo, 0.24)
      }
    }
    this.mixer.addEventListener("finished", this._onFinished)
  }

  setFadeSeconds(seconds) {
    this.fadeSeconds = Math.max(0, Number(seconds) || 0)
  }

  register(state, clip, options = {}) {
    if (!state || !clip) throw new Error("register requires state and clip")
    const previous = this.actions.get(state)
    if (previous) {
      previous.stop()
      this.mixer.uncacheAction(previous.getClip(), this.root)
    }

    const loop = options.loop ?? (state === "IDLE" || state === "WALK")
    const clamp = options.clamp ?? !loop
    const repetitions = loop ? Infinity : 1

    const action = this.mixer.clipAction(clip)
    action.enabled = true
    action.clampWhenFinished = clamp
    action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, repetitions)
    this.actions.set(state, action)
    this.actionOptions.set(state, {
      loop,
      clamp,
      recoverTo: Object.prototype.hasOwnProperty.call(options, "recoverTo") ? options.recoverTo : undefined,
      fadeSeconds: options.fadeSeconds ?? this.fadeSeconds,
    })
    return action
  }

  has(state) {
    return this.actions.has(state)
  }

  transitionTo(state, fadeSeconds = null) {
    const next = this.actions.get(state)
    if (!next) throw new Error(`No clip registered for ${state}`)
    if (this.currentAction === next && next.isRunning()) return

    const options = this.actionOptions.get(state) || {}
    const fade = fadeSeconds ?? options.fadeSeconds ?? this.fadeSeconds
    next.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).play()
    if (this.currentAction && this.currentAction !== next) this.currentAction.crossFadeTo(next, fade, false)

    this.currentAction = next
    this.currentState = state
  }

  playAction(state, options = {}) {
    this.transitionTo(state, options.fadeSeconds)
    return this.actions.get(state)
  }

  walkTo(target, options = {}) {
    this.navigation.target = target.clone ? target.clone() : new THREE.Vector3(target.x, target.y, target.z)
    this.navigation.target.y = this.root.position.y
    this.navigation.walkSpeed = options.walkSpeed ?? this.navigation.walkSpeed
    this.navigation.stopDistance = options.stopDistance ?? this.navigation.stopDistance
    this.navigation.onArrive = options.onArrive ?? null
    this.navigation.mode = "WALK_TO"
    const walkState = this.has("WALK_V2") ? "WALK_V2" : "WALK"
    if (this.has(walkState)) this.transitionTo(walkState)
  }

  turnTo(target, options = {}) {
    this.navigation.facingTarget = target.clone ? target.clone() : new THREE.Vector3(target.x, target.y, target.z)
    this.navigation.facingTarget.y = this.root.position.y
    this.navigation.turnSpeed = options.turnSpeed ?? this.navigation.turnSpeed
    this.navigation.mode = "TURN_TO"
  }

  stop() {
    this.navigation.target = null
    this.navigation.facingTarget = null
    this.navigation.mode = "IDLE"
    const stopState = this.has("STOP_V2") ? "STOP_V2" : (this.has("STOP") ? "STOP" : null)
    const idleState = this.has("IDLE_V2") ? "IDLE_V2" : (this.has("IDLE") ? "IDLE" : null)
    if (stopState) this.transitionTo(stopState)
    else if (idleState) this.transitionTo(idleState)
  }

  _rotateToward(target, delta) {
    _direction.subVectors(target, this.root.position)
    _direction.y = 0
    if (_direction.lengthSq() < 1e-8) return 0
    _direction.normalize()
    _desiredQuaternion.setFromUnitVectors(_forward, _direction)
    const angle = this.root.quaternion.angleTo(_desiredQuaternion)
    const fraction = Math.min(1, (this.navigation.turnSpeed * delta) / Math.max(angle, 1e-5))
    this.root.quaternion.slerp(_desiredQuaternion, fraction)
    return angle
  }

  _updateNavigation(delta) {
    if (this.navigation.mode === "WALK_TO" && this.navigation.target) {
      const angle = this._rotateToward(this.navigation.target, delta)
      _direction.subVectors(this.navigation.target, this.root.position)
      _direction.y = 0
      const distance = _direction.length()

      if (distance <= this.navigation.stopDistance) {
        const callback = this.navigation.onArrive
        this.navigation.target = null
        this.navigation.onArrive = null
        this.navigation.mode = "IDLE"
        const stopState = this.has("STOP_V2") ? "STOP_V2" : (this.has("STOP") ? "STOP" : null)
        const idleState = this.has("IDLE_V2") ? "IDLE_V2" : (this.has("IDLE") ? "IDLE" : null)
        if (stopState) this.transitionTo(stopState)
        else if (idleState) this.transitionTo(idleState)
        callback?.()
        return
      }

      _direction.normalize()
      const distanceScale = THREE.MathUtils.clamp(distance / 0.45, 0.16, 1)
      const turnScale = THREE.MathUtils.clamp(1 - angle / Math.PI, 0.18, 1)
      const step = Math.min(distance, this.navigation.walkSpeed * distanceScale * turnScale * delta)
      this.root.position.addScaledVector(_direction, step)
    }

    if (this.navigation.mode === "TURN_TO" && this.navigation.facingTarget) {
      const angle = this._rotateToward(this.navigation.facingTarget, delta)
      if (angle <= this.navigation.turnTolerance) {
        this.navigation.facingTarget = null
        this.navigation.mode = "IDLE"
        const idleState = this.has("IDLE_V2") ? "IDLE_V2" : (this.has("IDLE") ? "IDLE" : null)
        if (idleState) this.transitionTo(idleState)
      }
    }
  }

  update(delta) {
    this._updateNavigation(delta)
    this.mixer.update(delta)
  }

  dispose() {
    this.mixer.removeEventListener("finished", this._onFinished)
    this.mixer.stopAllAction()
    this.mixer.uncacheRoot(this.root)
    this.actions.clear()
    this.actionOptions.clear()
  }
}
