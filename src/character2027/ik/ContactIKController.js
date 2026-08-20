import { HumanoidIKController } from "./HumanoidIKController"

/**
 * Character 2027 contact/adaptation IK.
 *
 * Locomotion animation owns gait biomechanics. IK must not synthesize a second
 * walk cycle on top of WALK/WALK_V2, because doing so fights the animation
 * tracks and can create sliding, knee popping and an artificial "moving pose"
 * look. Contact IK remains active for crouch, jump, stairs, semantic
 * interactions and the other states already handled by HumanoidIKController.
 */
export class ContactIKController extends HumanoidIKController {
  update(delta, state, action) {
    if (!this.enabled || !state) return

    if (state === "WALK_V2" || state === "WALK") {
      if (state !== this.state) this.setState(state, action)
      this.stateTime += delta
      return
    }

    super.update(delta, state, action)
  }
}
