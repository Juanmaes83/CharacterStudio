import * as THREE from "three"

export const MOTION_STATES = ["IDLE", "WALK", "STOP", "TURN_LEFT", "TURN_RIGHT"]

export class MotionController {
  constructor(root) {
    this.root = root
    this.mixer = new THREE.AnimationMixer(root)
    this.actions = new Map()
    this.currentState = null
    this.currentAction = null
    this.fadeSeconds = 0.2
  }

  setFadeSeconds(seconds) {
    this.fadeSeconds = Math.max(0, Number(seconds) || 0)
  }

  register(state, clip) {
    if (!MOTION_STATES.includes(state)) throw new Error(`Unknown motion state: ${state}`)
    const previous = this.actions.get(state)
    if (previous) {
      previous.stop()
      this.mixer.uncacheAction(previous.getClip(), this.root)
    }

    const action = this.mixer.clipAction(clip)
    action.enabled = true
    action.clampWhenFinished = state === "STOP" || state.startsWith("TURN_")
    action.setLoop(
      action.clampWhenFinished ? THREE.LoopOnce : THREE.LoopRepeat,
      action.clampWhenFinished ? 1 : Infinity,
    )
    this.actions.set(state, action)
    return action
  }

  has(state) {
    return this.actions.has(state)
  }

  transitionTo(state, fadeSeconds = this.fadeSeconds) {
    const next = this.actions.get(state)
    if (!next) throw new Error(`No clip registered for ${state}`)
    if (this.currentAction === next) return

    next.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).play()
    if (this.currentAction) {
      this.currentAction.crossFadeTo(next, fadeSeconds, false)
    }

    this.currentAction = next
    this.currentState = state
  }

  update(delta) {
    this.mixer.update(delta)
  }

  dispose() {
    this.mixer.stopAllAction()
    this.mixer.uncacheRoot(this.root)
    this.actions.clear()
  }
}
