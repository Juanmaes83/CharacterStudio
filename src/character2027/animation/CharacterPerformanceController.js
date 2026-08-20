import * as THREE from "three"
import { findQuaterniusClip, QUATERNIUS_ACTIONS } from "./QuaterniusMotionSource"
import { retargetQuaterniusClip } from "./RestPoseRetargeter"

const LOOP_RE = /(Loop|Idle|Walk|Jog|Sprint|Crouch_Fwd|Push)/

export class CharacterPerformanceController {
  constructor({ targetRoot, donorRoot, donorClips }) {
    this.targetRoot = targetRoot
    this.donorRoot = donorRoot
    this.donorClips = donorClips
    this.mixer = new THREE.AnimationMixer(targetRoot)
    this.cache = new Map()
    this.current = null
    this.currentName = null
    this.sequenceToken = 0
    this.lastReport = null
  }

  getRetargeted(name) {
    if (this.cache.has(name)) return this.cache.get(name)
    const source = findQuaterniusClip(this.donorClips, name)
    if (!source) throw new Error(`Donor clip not found: ${name}`)
    const result = retargetQuaterniusClip(this.donorRoot, source, this.targetRoot)
    this.cache.set(name, result)
    return result
  }

  play(name, { fade = 0.28, loop = LOOP_RE.test(name), timeScale = 1, preserveSequence = false } = {}) {
    if (!preserveSequence) this.sequenceToken += 1
    const { clip, report } = this.getRetargeted(name)
    const next = this.mixer.clipAction(clip)
    next.enabled = true
    next.setEffectiveTimeScale(timeScale)
    next.setEffectiveWeight(1)
    next.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1)
    next.clampWhenFinished = !loop
    next.reset().play()

    if (this.current && this.current !== next) {
      next.crossFadeFrom(this.current, fade, true)
    } else {
      next.fadeIn(Math.min(fade, 0.2))
    }

    this.current = next
    this.currentName = name
    this.lastReport = report
    return { action: next, clip, report }
  }

  async sequence(steps) {
    const token = ++this.sequenceToken
    for (const step of steps) {
      if (token !== this.sequenceToken) return false
      const result = this.play(step.name, {
        fade: step.fade ?? 0.18,
        loop: step.loop ?? false,
        timeScale: step.timeScale ?? 1,
        preserveSequence: true,
      })
      const seconds = step.seconds ?? (result.clip.duration / Math.max(step.timeScale ?? 1, 0.001))
      await new Promise((resolve) => setTimeout(resolve, Math.max(0, seconds - (step.overlap ?? 0.08)) * 1000))
    }
    return token === this.sequenceToken
  }

  idle() { return this.play(QUATERNIUS_ACTIONS.IDLE, { loop: true, fade: 0.32 }) }
  walk() { return this.play(QUATERNIUS_ACTIONS.WALK, { loop: true, fade: 0.3 }) }
  talk() { return this.play(QUATERNIUS_ACTIONS.TALK, { loop: true, fade: 0.32 }) }
  crouch() { return this.play(QUATERNIUS_ACTIONS.CROUCH, { loop: true, fade: 0.28 }) }
  kneel() { return this.play(QUATERNIUS_ACTIONS.KNEEL, { loop: false, fade: 0.24 }) }
  pickup() { return this.play(QUATERNIUS_ACTIONS.PICKUP, { loop: false, fade: 0.2 }) }
  interact() { return this.play(QUATERNIUS_ACTIONS.INTERACT, { loop: false, fade: 0.2 }) }

  jump() {
    return this.sequence([
      { name: QUATERNIUS_ACTIONS.JUMP_START, fade: 0.14, overlap: 0.1 },
      { name: QUATERNIUS_ACTIONS.JUMP_AIR, fade: 0.12, loop: false, overlap: 0.08 },
      { name: QUATERNIUS_ACTIONS.JUMP_LAND, fade: 0.12, overlap: 0.04 },
      { name: QUATERNIUS_ACTIONS.IDLE, fade: 0.26, loop: true, seconds: 0.01 },
    ])
  }

  sit() {
    return this.sequence([
      { name: QUATERNIUS_ACTIONS.SIT_ENTER, fade: 0.2, overlap: 0.1 },
      { name: QUATERNIUS_ACTIONS.SIT_IDLE, fade: 0.18, loop: true, seconds: 2.2 },
    ])
  }

  stand() {
    return this.sequence([
      { name: QUATERNIUS_ACTIONS.SIT_EXIT, fade: 0.18, overlap: 0.06 },
      { name: QUATERNIUS_ACTIONS.IDLE, fade: 0.28, loop: true, seconds: 0.01 },
    ])
  }

  react(kind) {
    switch (kind) {
      case "conversation": return this.talk()
      case "object": return this.interact()
      case "pickup": return this.pickup()
      case "impact-head": return this.play(QUATERNIUS_ACTIONS.HIT_HEAD, { loop: false, fade: 0.1 })
      case "impact-chest": return this.play(QUATERNIUS_ACTIONS.HIT_CHEST, { loop: false, fade: 0.1 })
      case "celebrate": return this.play(QUATERNIUS_ACTIONS.DANCE, { loop: true, fade: 0.35 })
      default: return this.idle()
    }
  }

  update(delta) {
    this.mixer.update(Math.min(delta, 0.05))
  }

  dispose() {
    this.sequenceToken += 1
    this.mixer.stopAllAction()
    this.mixer.uncacheRoot(this.targetRoot)
    this.current = null
  }
}
