import { HumanoidIKController } from "./HumanoidIKController"

const CLIP_OWNED_STATES = new Set([
  "WALK_V2",
  "WALK",
  "WAVE",
  "GOODBYE",
  "POINT",
  "NOD",
  "WELCOME",
  "AFTER_YOU",
])

/**
 * Character 2027 contact/adaptation IK.
 *
 * Locomotion and social gesture biomechanics are owned by their animation clips.
 * IK must not synthesize a second gait or replace the authored shoulder/elbow
 * choreography of a social gesture. Contact/adaptation IK remains active for
 * jump, terrain and semantic object interactions where a real world target is
 * part of the behaviour contract.
 */
export class ContactIKController extends HumanoidIKController {
  update(delta, state, action) {
    if (!this.enabled || !state) return

    if (CLIP_OWNED_STATES.has(state)) {
      if (state !== this.state) this.setState(state, action)
      this.stateTime += delta
      return
    }

    super.update(delta, state, action)
  }
}

export const CHARACTER_CLIP_OWNED_STATES = CLIP_OWNED_STATES
