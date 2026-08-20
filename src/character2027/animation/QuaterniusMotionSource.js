import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader"

export const DONOR_COMMIT = "e24c23cf2a1323488a3faa226ea7ea21f644b73e"
const LOCAL_BASE = "/vendor/quaternius-u-a-l"
const REMOTE_BASE = "https://raw.githubusercontent.com/Juanmaes83/CharacterStudio/agent/character-2027-donor-clone-01/public/vendor/quaternius-u-a-l"

const loader = new GLTFLoader()
let cachedLibrary = null
let cachedManifest = null

async function firstJson(urls) {
  let lastError = null
  for (const url of urls) {
    try {
      const response = await fetch(url, { cache: "no-cache" })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return await response.json()
    } catch (error) {
      lastError = error
    }
  }
  throw lastError || new Error("Unable to load donor manifest")
}

async function firstGltf(urls) {
  let lastError = null
  for (const url of urls) {
    try {
      return await loader.loadAsync(url)
    } catch (error) {
      lastError = error
    }
  }
  throw lastError || new Error("Unable to load donor animation library")
}

export async function loadQuaterniusManifest() {
  if (cachedManifest) return cachedManifest
  cachedManifest = await firstJson([
    `${LOCAL_BASE}/manifest.json`,
    `${REMOTE_BASE}/manifest.json`,
  ])
  return cachedManifest
}

export async function loadQuaterniusMotionLibrary() {
  if (cachedLibrary) return cachedLibrary
  const gltf = await firstGltf([
    `${LOCAL_BASE}/AnimationLibrary_Godot_Standard.gltf`,
    `${REMOTE_BASE}/AnimationLibrary_Godot_Standard.gltf`,
  ])
  cachedLibrary = { root: gltf.scene, clips: gltf.animations || [] }
  return cachedLibrary
}

export function findQuaterniusClip(clips, name) {
  return clips.find((clip) => clip.name === name) || null
}

export const QUATERNIUS_ACTIONS = Object.freeze({
  IDLE: "Idle_Loop",
  TALK: "Idle_Talking_Loop",
  WALK: "Walk_Loop",
  WALK_FORMAL: "Walk_Formal_Loop",
  JOG: "Jog_Fwd_Loop",
  SPRINT: "Sprint_Loop",
  CROUCH: "Crouch_Idle_Loop",
  CROUCH_FORWARD: "Crouch_Fwd_Loop",
  JUMP_START: "Jump_Start",
  JUMP_AIR: "Jump_Loop",
  JUMP_LAND: "Jump_Land",
  SIT_ENTER: "Sitting_Enter",
  SIT_IDLE: "Sitting_Idle_Loop",
  SIT_TALK: "Sitting_Talking_Loop",
  SIT_EXIT: "Sitting_Exit",
  KNEEL: "Fixing_Kneeling",
  PICKUP: "PickUp_Table",
  INTERACT: "Interact",
  PUSH: "Push_Loop",
  HIT_CHEST: "Hit_Chest",
  HIT_HEAD: "Hit_Head",
  ROLL: "Roll",
  DANCE: "Dance_Loop",
})
