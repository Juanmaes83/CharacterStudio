import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader"

export const QUATERNIUS_BASE = "/vendor/quaternius-u-a-l"
export const QUATERNIUS_GLTF = `${QUATERNIUS_BASE}/AnimationLibrary_Godot_Standard.gltf`
export const QUATERNIUS_MANIFEST = `${QUATERNIUS_BASE}/manifest.json`

const loader = new GLTFLoader()
let cachedLibrary = null
let cachedManifest = null

export async function loadQuaterniusManifest() {
  if (cachedManifest) return cachedManifest
  const response = await fetch(QUATERNIUS_MANIFEST, { cache: "no-cache" })
  if (!response.ok) throw new Error(`Quaternius manifest HTTP ${response.status}`)
  cachedManifest = await response.json()
  return cachedManifest
}

export async function loadQuaterniusMotionLibrary() {
  if (cachedLibrary) return cachedLibrary
  const gltf = await loader.loadAsync(QUATERNIUS_GLTF)
  cachedLibrary = {
    root: gltf.scene,
    clips: gltf.animations || [],
  }
  return cachedLibrary
}

export function findQuaterniusClip(clips, name) {
  return clips.find((clip) => clip.name === name) || null
}

export const QUATERNIUS_BASELINE = Object.freeze({
  IDLE: "Idle_Loop",
  WALK: "Walk_Loop",
  WALK_FORMAL: "Walk_Formal_Loop",
  JOG: "Jog_Fwd_Loop",
  CROUCH: "Crouch_Idle_Loop",
  CROUCH_FORWARD: "Crouch_Fwd_Loop",
  JUMP_START: "Jump_Start",
  JUMP_AIR: "Jump_Loop",
  JUMP_LAND: "Jump_Land",
  SIT_ENTER: "Sitting_Enter",
  SIT_IDLE: "Sitting_Idle_Loop",
  SIT_EXIT: "Sitting_Exit",
  KNEEL: "Fixing_Kneeling",
  PICKUP_TABLE: "PickUp_Table",
  INTERACT: "Interact",
})
