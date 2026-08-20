import * as THREE from "three"

/**
 * Stable public facade for Character 2027 runtime actions.
 *
 * MotionLab and WORLD clients should call this API instead of manipulating
 * MotionController.navigation, AnimationMixer actions or IK directly.
 * Internal locomotion/biomechanics may improve without changing this contract.
 */
export class CharacterActionAPI {
  constructor({ root, controller, lookAt = null, interactionTargets = null, onStateChange = null, onStatus = null }) {
    if (!root) throw new Error("CharacterActionAPI requires root")
    if (!controller) throw new Error("CharacterActionAPI requires controller")
    this.root = root
    this.controller = controller
    this.lookAtController = lookAt
    this.interactionTargets = interactionTargets || {}
    this.onStateChange = onStateChange
    this.onStatus = onStatus
    this._pendingInteractionTimer = null
  }

  _state(name) { this.onStateChange?.(name) }
  _status(message) { this.onStatus?.(message) }

  has(action) { return this.controller.has(action) }

  capabilities() {
    return Array.from(this.controller.actions?.keys?.() || [])
  }

  perform(action, options = {}) {
    if (!action) throw new Error("perform requires an action")
    if (!this.controller.has(action)) throw new Error(`No action registered for ${action}`)
    if (options.clearLookAt !== false) this.lookAtController?.clear?.()
    const result = this.controller.playAction(action, { fadeSeconds: options.fadeSeconds })
    this._state(action)
    if (options.status) this._status(options.status)
    return result
  }

  /**
   * Move toward a world-space point through MotionController.walkTo().
   * The controller owns pre-turn, locomotion start, deceleration and stop.
   */
  moveTo(target, options = {}) {
    if (!target) throw new Error("moveTo requires a target")
    const point = Array.isArray(target)
      ? new THREE.Vector3(...target)
      : (target.clone ? target.clone() : new THREE.Vector3(target.x, target.y, target.z))
    point.y = this.root.position.y

    const label = options.label || "target"
    this._status(`Walking to ${label}…`)

    this.controller.walkTo(point, {
      walkSpeed: options.walkSpeed ?? 0.78,
      stopDistance: options.stopDistance ?? 0.08,
      onArrive: () => {
        this._status(options.arrivalStatus || `ARRIVED: ${label}`)
        options.onArrive?.()
      },
    })

    const state = this.controller.currentState || (this.controller.has("WALK_V2") ? "WALK_V2" : "WALK")
    this._state(state)
  }

  stop() {
    this.controller.stop()
    const state = this.controller.currentState || (this.controller.has("STOP_V2") ? "STOP_V2" : "STOP")
    this._state(state)
    this._status("Stopped")
  }

  turnTo(target, options = {}) {
    if (!target) throw new Error("turnTo requires a target")
    const point = Array.isArray(target)
      ? new THREE.Vector3(...target)
      : (target.clone ? target.clone() : new THREE.Vector3(target.x, target.y, target.z))
    this.controller.turnTo(point, options)
    this._status(options.status || "Turning to target…")
  }

  lookAt(target, options = {}) {
    if (!this.lookAtController) throw new Error("No LookAtController available")
    if (!target) throw new Error("lookAt requires a target")
    const point = Array.isArray(target)
      ? new THREE.Vector3(...target)
      : (target.clone ? target.clone() : new THREE.Vector3(target.x, target.y, target.z))
    this.lookAtController.lookAt(point, { weight: options.weight ?? 1 })
    this._status(options.status || "Target-aware lookAt active")
  }

  clearLookAt() { this.lookAtController?.clear?.() }

  /**
   * Execute a semantic interaction target from the world/benchmark registry.
   * Expected descriptor: { approachPoint, lookAt }.
   * Navigation goes through MotionController.walkTo(); contact/IK stays inside
   * MotionController and its post-processors.
   */
  interact(action, descriptor = null, options = {}) {
    const target = descriptor || this.interactionTargets?.[action]
    if (!target) throw new Error(`No interaction target registered for ${action}`)
    if (!target.approachPoint || !target.lookAt) throw new Error(`${action} target requires approachPoint and lookAt`)

    if (this._pendingInteractionTimer) {
      clearTimeout(this._pendingInteractionTimer)
      this._pendingInteractionTimer = null
    }

    this._status(`${action}: approaching semantic target…`)
    this.lookAtController?.lookAt?.(target.lookAt, { weight: options.approachLookWeight ?? 0.9 })

    const approach = target.approachPoint.clone
      ? target.approachPoint.clone()
      : new THREE.Vector3(target.approachPoint.x, target.approachPoint.y, target.approachPoint.z)
    approach.y = this.root.position.y

    this.controller.walkTo(approach, {
      walkSpeed: options.walkSpeed ?? 0.72,
      stopDistance: options.stopDistance ?? 0.12,
      onArrive: () => {
        this.controller.turnTo(target.lookAt, { turnSpeed: options.turnSpeed ?? 6 })
        this.lookAtController?.lookAt?.(target.lookAt, { weight: 1 })
        this._pendingInteractionTimer = setTimeout(() => {
          this._pendingInteractionTimer = null
          this.perform(action, { clearLookAt: false, status: `${action}: benchmark action` })
        }, options.alignDelayMs ?? 260)
      },
    })

    const state = this.controller.currentState || (this.controller.has("WALK_V2") ? "WALK_V2" : "WALK")
    this._state(state)
  }

  /**
   * Serializable command entry point for WORLD / user-intent layers.
   * Examples:
   *   execute({ type: "perform", action: "WAVE" })
   *   execute({ type: "moveTo", target: [1, 0, 2], options: { label: "sofa" } })
   *   execute({ type: "interact", action: "PICK_UP_PHONE", target: descriptor })
   */
  execute(command) {
    if (!command || !command.type) throw new Error("execute requires a command with type")
    if (command.type === "perform") return this.perform(command.action, command.options)
    if (command.type === "moveTo") return this.moveTo(command.target, command.options)
    if (command.type === "stop") return this.stop()
    if (command.type === "turnTo") return this.turnTo(command.target, command.options)
    if (command.type === "lookAt") return this.lookAt(command.target, command.options)
    if (command.type === "interact") return this.interact(command.action, command.target, command.options)
    throw new Error(`Unsupported CharacterActionAPI command: ${command.type}`)
  }

  dispose() {
    if (this._pendingInteractionTimer) clearTimeout(this._pendingInteractionTimer)
    this._pendingInteractionTimer = null
  }
}

export const CHARACTER_ACTION_COMMANDS = Object.freeze({
  PERFORM: "perform",
  MOVE_TO: "moveTo",
  STOP: "stop",
  TURN_TO: "turnTo",
  LOOK_AT: "lookAt",
  INTERACT: "interact",
})