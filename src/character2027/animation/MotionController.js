import * as THREE from "three"
import { ContactIKController } from "../ik/ContactIKController"
import { applyLadderIK } from "../ik/LadderIKExtension"

export const MOTION_STATES = ["IDLE", "WALK", "STOP", "TURN_LEFT", "TURN_RIGHT"]

const _direction = new THREE.Vector3()
const _forward = new THREE.Vector3(0, 0, 1)
const _desiredQuaternion = new THREE.Quaternion()
const _turnStartQuaternion = new THREE.Quaternion()
const _turnTargetQuaternion = new THREE.Quaternion()
const _yawQuaternion = new THREE.Quaternion()
const _worldUp = new THREE.Vector3(0, 1, 0)

function worldPoint(object, local = new THREE.Vector3()) {
  if (!object) return null
  object.updateWorldMatrix(true, false)
  return object.localToWorld(local.clone())
}

function benchmarkInteractionTarget(root, state) {
  const scene = root?.parent
  if (!scene) return null
  const byName = (name) => scene.getObjectByName(name)
  if (state === "PRESS_DOORBELL") { const object = byName("BenchmarkDoorbell"); return object ? { object, hand: "right", contactPoint: worldPoint(object), type: "precise-contact" } : null }
  if (state === "KNOCK_DOOR") { const object = byName("BenchmarkDoor"); return object ? { object, hand: "right", contactPoint: worldPoint(object, new THREE.Vector3(-0.03, 0.32, 0.08)), type: "repeated-contact" } : null }
  if (state === "PICK_UP_CUP") { const object = byName("BenchmarkCup"); return object ? { object, hand: "right", contactPoint: worldPoint(object), gripPoint: worldPoint(object, new THREE.Vector3(0.045, 0.01, 0)), type: "small-one-hand" } : null }
  if (state === "PICK_UP_PHONE") { const object = byName("BenchmarkPhone"); return object ? { object, hand: "right", secondaryHand: "left", contactPoint: worldPoint(object), gripPoint: worldPoint(object), type: "phone-grip" } : null }
  if (state === "PICK_UP_MAGAZINE") {
    const object = byName("BenchmarkMagazine")
    return object ? { object, hand: "right", secondaryHand: "left", contactPoint: worldPoint(object), gripPoint: worldPoint(object, new THREE.Vector3(0.09, 0, -0.04)), secondaryGripPoint: worldPoint(object, new THREE.Vector3(-0.09, 0, -0.04)), type: "two-hand-flat-object" } : null
  }
  if (state === "OPEN_DOOR") {
    const object = byName("BenchmarkDoor"), handle = byName("BenchmarkDoorHandle"), doorPivot = byName("BenchmarkDoorHinge")
    return object && handle && doorPivot ? { object, handle, doorPivot, hand: "right", contactPoint: worldPoint(handle), type: "handle-grip" } : null
  }
  if (state === "SIT_SOFA") {
    const object = byName("BenchmarkSofaSeat")
    return object ? { object, seatPoint: worldPoint(object, new THREE.Vector3(0, 0.25, 0.10)), contactPoint: worldPoint(object, new THREE.Vector3(0, 0.25, 0.10)), footLeft: worldPoint(object, new THREE.Vector3(-0.18, -0.22, 0.54)), footRight: worldPoint(object, new THREE.Vector3(0.18, -0.22, 0.54)), type: "full-body-seat" } : null
  }
  if (state === "LEAN_WALL") {
    const object = byName("BenchmarkWall")
    return object ? { object, contactPoint: worldPoint(object, new THREE.Vector3(-0.05, -0.05, 0)), pelvisContact: worldPoint(object, new THREE.Vector3(-0.06, -0.24, 0)), shoulderContact: worldPoint(object, new THREE.Vector3(-0.06, 0.32, 0)), surfaceNormal: new THREE.Vector3(-1, 0, 0), type: "surface-contact-pose" } : null
  }
  return null
}

export class MotionController {
  constructor(root) {
    this.root = root
    this.mixer = new THREE.AnimationMixer(root)
    this.actions = new Map()
    this.actionOptions = new Map()
    this.currentState = null
    this.currentAction = null
    this.fadeSeconds = 0.22
    this.postProcessor = new ContactIKController(root)
    this.navigation = { mode: "IDLE", target: null, facingTarget: null, walkSpeed: 1.15, turnSpeed: 8, stopDistance: 0.08, turnTolerance: THREE.MathUtils.degToRad(2), preTurnTolerance: THREE.MathUtils.degToRad(8), preTurnThreshold: THREE.MathUtils.degToRad(32), onArrive: null, turnElapsed: 0, turnDuration: 0.72, turnOnComplete: null }
    this._onFinished = (event) => {
      if (event.action !== this.currentAction) return
      const options = this.actionOptions.get(this.currentState) || {}
      let recoverTo = options.recoverTo
      if (recoverTo === undefined) recoverTo = this.has("IDLE_V2") ? "IDLE_V2" : (this.has("IDLE") ? "IDLE" : null)
      if (recoverTo && this.has(recoverTo) && recoverTo !== this.currentState) this.transitionTo(recoverTo, 0.24)
    }
    this.mixer.addEventListener("finished", this._onFinished)
  }

  setPostProcessor(processor) { this.postProcessor?.dispose?.(); this.postProcessor = processor || null }
  setFadeSeconds(seconds) { this.fadeSeconds = Math.max(0, Number(seconds) || 0) }

  register(state, clip, options = {}) {
    if (!state || !clip) throw new Error("register requires state and clip")
    const previous = this.actions.get(state)
    if (previous) { previous.stop(); this.mixer.uncacheAction(previous.getClip(), this.root) }
    const loop = options.loop ?? (state === "IDLE" || state === "WALK")
    const clamp = options.clamp ?? !loop
    const action = this.mixer.clipAction(clip)
    action.enabled = true
    action.clampWhenFinished = clamp
    action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1)
    this.actions.set(state, action)
    this.actionOptions.set(state, { loop, clamp, recoverTo: Object.prototype.hasOwnProperty.call(options, "recoverTo") ? options.recoverTo : undefined, fadeSeconds: options.fadeSeconds ?? this.fadeSeconds })
    return action
  }

  has(state) { return this.actions.has(state) }
  _prepareTurnBy(angleRadians, options = {}) {
    _turnStartQuaternion.copy(this.root.quaternion)
    _yawQuaternion.setFromAxisAngle(_worldUp, angleRadians)
    _turnTargetQuaternion.copy(_turnStartQuaternion).premultiply(_yawQuaternion)
    this.navigation.turnElapsed = 0
    this.navigation.turnDuration = Math.max(0.18, options.duration ?? 0.72)
    this.navigation.turnOnComplete = options.onComplete ?? null
    this.navigation.mode = "TURN_BY"
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
    this.postProcessor?.setState?.(state, next)
    const interactionTarget = benchmarkInteractionTarget(this.root, state)
    if (interactionTarget) this.postProcessor?.setInteraction?.(state, interactionTarget)
    if (this.navigation.mode !== "TURN_BY") {
      if (state === "TURN_LEFT_V2" || state === "TURN_LEFT") this._prepareTurnBy(Math.PI / 2, { duration: next.getClip().duration })
      if (state === "TURN_RIGHT_V2" || state === "TURN_RIGHT") this._prepareTurnBy(-Math.PI / 2, { duration: next.getClip().duration })
    }
  }

  playAction(state, options = {}) { this.transitionTo(state, options.fadeSeconds); return this.actions.get(state) }
  _angleTo(target) {
    _direction.subVectors(target, this.root.position); _direction.y = 0
    if (_direction.lengthSq() < 1e-8) return 0
    _direction.normalize(); _desiredQuaternion.setFromUnitVectors(_forward, _direction)
    return this.root.quaternion.angleTo(_desiredQuaternion)
  }

  walkTo(target, options = {}) {
    this.navigation.target = target.clone ? target.clone() : new THREE.Vector3(target.x, target.y, target.z)
    this.navigation.target.y = this.root.position.y
    this.navigation.walkSpeed = options.walkSpeed ?? this.navigation.walkSpeed
    this.navigation.stopDistance = options.stopDistance ?? this.navigation.stopDistance
    this.navigation.onArrive = options.onArrive ?? null
    const angle = this._angleTo(this.navigation.target)
    this.navigation.mode = angle > this.navigation.preTurnThreshold ? "PRE_TURN_WALK" : "WALK_TO"
    if (this.navigation.mode === "WALK_TO") {
      const walkState = this.has("WALK_V2") ? "WALK_V2" : "WALK"
      if (this.has(walkState)) this.transitionTo(walkState)
    } else {
      const idle = this.has("IDLE_V2") ? "IDLE_V2" : (this.has("IDLE") ? "IDLE" : null)
      if (idle) this.transitionTo(idle, 0.12)
    }
  }

  turnTo(target, options = {}) { this.navigation.facingTarget = target.clone ? target.clone() : new THREE.Vector3(target.x, target.y, target.z); this.navigation.facingTarget.y = this.root.position.y; this.navigation.turnSpeed = options.turnSpeed ?? this.navigation.turnSpeed; this.navigation.mode = "TURN_TO" }
  turnBy(angleRadians, options = {}) {
    this._prepareTurnBy(angleRadians, options)
    const state = angleRadians >= 0 ? (this.has("TURN_LEFT_V2") ? "TURN_LEFT_V2" : (this.has("TURN_LEFT") ? "TURN_LEFT" : null)) : (this.has("TURN_RIGHT_V2") ? "TURN_RIGHT_V2" : (this.has("TURN_RIGHT") ? "TURN_RIGHT" : null))
    if (state) this.transitionTo(state, 0.12)
  }

  stop() {
    this.navigation.target = null; this.navigation.facingTarget = null; this.navigation.mode = "IDLE"
    const stopState = this.has("STOP_V2") ? "STOP_V2" : (this.has("STOP") ? "STOP" : null), idleState = this.has("IDLE_V2") ? "IDLE_V2" : (this.has("IDLE") ? "IDLE" : null)
    if (stopState) this.transitionTo(stopState); else if (idleState) this.transitionTo(idleState)
  }

  _rotateToward(target, delta) {
    _direction.subVectors(target, this.root.position); _direction.y = 0
    if (_direction.lengthSq() < 1e-8) return 0
    _direction.normalize(); _desiredQuaternion.setFromUnitVectors(_forward, _direction)
    const angle = this.root.quaternion.angleTo(_desiredQuaternion)
    const fraction = Math.min(1, (this.navigation.turnSpeed * delta) / Math.max(angle, 1e-5))
    this.root.quaternion.slerp(_desiredQuaternion, fraction)
    return angle
  }

  _startWalkingAfterPreTurn() { this.navigation.mode = "WALK_TO"; const walkState = this.has("WALK_V2") ? "WALK_V2" : "WALK"; if (this.has(walkState)) this.transitionTo(walkState, 0.14) }

  _updateNavigation(delta) {
    if (this.navigation.mode === "PRE_TURN_WALK" && this.navigation.target) { const angle = this._rotateToward(this.navigation.target, delta); if (angle <= this.navigation.preTurnTolerance) this._startWalkingAfterPreTurn(); return }
    if (this.navigation.mode === "WALK_TO" && this.navigation.target) {
      const angle = this._rotateToward(this.navigation.target, delta)
      _direction.subVectors(this.navigation.target, this.root.position); _direction.y = 0
      const distance = _direction.length()
      if (distance <= this.navigation.stopDistance) {
        const callback = this.navigation.onArrive
        this.navigation.target = null; this.navigation.onArrive = null; this.navigation.mode = "IDLE"
        const stopState = this.has("STOP_V2") ? "STOP_V2" : (this.has("STOP") ? "STOP" : null), idleState = this.has("IDLE_V2") ? "IDLE_V2" : (this.has("IDLE") ? "IDLE" : null)
        if (stopState) this.transitionTo(stopState); else if (idleState) this.transitionTo(idleState)
        callback?.(); return
      }
      if (angle > this.navigation.preTurnThreshold) { this.navigation.mode = "PRE_TURN_WALK"; return }
      _direction.normalize()
      const distanceScale = THREE.MathUtils.clamp(distance / 0.45, 0.16, 1), turnScale = THREE.MathUtils.clamp(1 - angle / (Math.PI * .75), 0.32, 1), step = Math.min(distance, this.navigation.walkSpeed * distanceScale * turnScale * delta)
      this.root.position.addScaledVector(_direction, step)
    }
    if (this.navigation.mode === "TURN_TO" && this.navigation.facingTarget) {
      const angle = this._rotateToward(this.navigation.facingTarget, delta)
      if (angle <= this.navigation.turnTolerance) { this.navigation.facingTarget = null; this.navigation.mode = "IDLE"; const idleState = this.has("IDLE_V2") ? "IDLE_V2" : (this.has("IDLE") ? "IDLE" : null); if (idleState) this.transitionTo(idleState) }
    }
    if (this.navigation.mode === "TURN_BY") {
      this.navigation.turnElapsed += delta
      const raw = THREE.MathUtils.clamp(this.navigation.turnElapsed / this.navigation.turnDuration, 0, 1), eased = raw * raw * (3 - 2 * raw)
      this.root.quaternion.slerpQuaternions(_turnStartQuaternion, _turnTargetQuaternion, eased)
      if (raw >= 1) { const callback = this.navigation.turnOnComplete; this.navigation.turnOnComplete = null; this.navigation.mode = "IDLE"; const idleState = this.has("IDLE_V2") ? "IDLE_V2" : (this.has("IDLE") ? "IDLE" : null); if (idleState) this.transitionTo(idleState, 0.14); callback?.() }
    }
  }

  getDiagnostics() { return { navigationMode: this.navigation.mode, state: this.currentState, ik: this.postProcessor?.getDiagnostics?.() || null } }
  update(delta) {
    this._updateNavigation(delta)
    this.mixer.update(delta)
    this.postProcessor?.update?.(delta, this.currentState, this.currentAction)
    applyLadderIK(this.postProcessor, this.currentState, this.currentAction)
  }
  dispose() { this.mixer.removeEventListener("finished", this._onFinished); this.postProcessor?.dispose?.(); this.mixer.stopAllAction(); this.mixer.uncacheRoot(this.root); this.actions.clear(); this.actionOptions.clear() }
}