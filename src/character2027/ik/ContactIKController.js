import { HumanoidIKController } from "./HumanoidIKController"
import { applyTerrainSemanticIK, clearTerrainSemanticMemory } from "./TerrainSemanticIK"

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

const SEMANTIC_TERRAIN_STATES = new Set([
  "STEP_UP",
  "STEP_DOWN",
  "STAIRS_UP",
  "STAIRS_DOWN",
  "LADDER_UP",
  "LADDER_DOWN",
])

/**
 * Character 2027 contact/adaptation IK.
 *
 * Locomotion and social gesture biomechanics are owned by their animation clips.
 * Terrain states are different: they bind to actual world geometry and own a
 * semantic root/contact trajectory. The generic procedural terrain pose is not
 * allowed to run underneath that binding.
 */
export class ContactIKController extends HumanoidIKController {
  update(delta, state, action) {
    if (!this.enabled || !state) return

    if (CLIP_OWNED_STATES.has(state)) {
      if (state !== this.state) this.setState(state, action)
      this.stateTime += delta
      return
    }

    if (SEMANTIC_TERRAIN_STATES.has(state)) {
      if (state !== this.state) this.setState(state, action)
      this.stateTime += delta
      // Ladder contact is applied after the mixer by LadderIKExtension using
      // real BenchmarkLadder rungs. Step/stairs are solved here.
      if (state !== "LADDER_UP" && state !== "LADDER_DOWN") {
        applyTerrainSemanticIK(this, state, action)
      }
      return
    }

    if (this._terrainSemantic) clearTerrainSemanticMemory(this)
    super.update(delta, state, action)
  }
}

export const CHARACTER_CLIP_OWNED_STATES = CLIP_OWNED_STATES
export const CHARACTER_SEMANTIC_TERRAIN_STATES = SEMANTIC_TERRAIN_STATES
