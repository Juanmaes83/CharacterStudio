// CHARACTER 2027 — dormant multimodal input contract
// Intentionally not wired into runtime yet.
// Purpose: make future webcam hand/body/face recognition feed the same semantic
// character/world action API used by Mouse/Touch/AI/Scripted controllers.

export const INPUT_MODALITIES = Object.freeze({
  HAND: "hand",
  BODY: "body",
  FACE: "face",
  VOICE: "voice",
  POINTER: "pointer",
  SCRIPT: "script",
})

export const GESTURE_INTENTS = Object.freeze({
  // Navigation / world control
  MOVE_LEFT: "MOVE_LEFT",
  MOVE_RIGHT: "MOVE_RIGHT",
  MOVE_FORWARD: "MOVE_FORWARD",
  MOVE_BACK: "MOVE_BACK",
  STOP: "STOP",
  TURN_LEFT: "TURN_LEFT",
  TURN_RIGHT: "TURN_RIGHT",
  LOOK_AT: "LOOK_AT",
  SELECT: "SELECT",
  BACK: "BACK",

  // Hand signs
  OPEN_HAND: "OPEN_HAND",
  FIST: "FIST",
  PINCH: "PINCH",
  POINT: "POINT",
  OK_SIGN: "OK_SIGN",
  THUMBS_UP: "THUMBS_UP",
  WAVE_LEFT: "WAVE_LEFT",
  WAVE_RIGHT: "WAVE_RIGHT",
  TWO_HAND_SPREAD: "TWO_HAND_SPREAD",
  TWO_HAND_CLOSE: "TWO_HAND_CLOSE",
  ROTATE_CW: "ROTATE_CW",
  ROTATE_CCW: "ROTATE_CCW",

  // Character / interaction semantics
  WAVE_HELLO: "WAVE_HELLO",
  WAVE_GOODBYE: "WAVE_GOODBYE",
  NOD: "NOD",
  SHAKE_HEAD: "SHAKE_HEAD",
  GRAB: "GRAB",
  RELEASE: "RELEASE",
  USE: "USE",
  PRESS: "PRESS",
  KNOCK: "KNOCK",
  PICK_UP: "PICK_UP",
  PUT_DOWN: "PUT_DOWN",
  OPEN: "OPEN",
  CLOSE: "CLOSE",
  SIT: "SIT",
  STAND: "STAND",
  CROUCH: "CROUCH",
  JUMP: "JUMP",

  // Content/media semantics
  NEXT_PAGE: "NEXT_PAGE",
  PREVIOUS_PAGE: "PREVIOUS_PAGE",
  MAP_PAN: "MAP_PAN",
  MAP_ZOOM: "MAP_ZOOM",
  MAP_ROTATE: "MAP_ROTATE",
  PHONE_SWIPE_LEFT: "PHONE_SWIPE_LEFT",
  PHONE_SWIPE_RIGHT: "PHONE_SWIPE_RIGHT",
  PHONE_TAP: "PHONE_TAP",
})

export function createGestureIntent({
  modality,
  intent,
  confidence = 1,
  handedness = null,
  value = null,
  landmarks = null,
  timestamp = performance.now(),
  source = "unknown",
} = {}) {
  if (!Object.values(INPUT_MODALITIES).includes(modality)) {
    throw new Error(`Unknown input modality: ${modality}`)
  }
  if (!Object.values(GESTURE_INTENTS).includes(intent)) {
    throw new Error(`Unknown gesture intent: ${intent}`)
  }

  return Object.freeze({
    modality,
    intent,
    confidence: Math.max(0, Math.min(1, Number(confidence) || 0)),
    handedness,
    value,
    landmarks,
    timestamp,
    source,
  })
}

// Default dormant mapping. Products may override this without changing detector code.
export const DEFAULT_CHARACTER_ACTION_MAP = Object.freeze({
  WAVE_HELLO: "WAVE",
  WAVE_GOODBYE: "GOODBYE",
  NOD: "NOD",
  TURN_LEFT: "TURN_LEFT_V2",
  TURN_RIGHT: "TURN_RIGHT_V2",
  CROUCH: "CROUCH",
  JUMP: "JUMP",
  POINT: "POINT",
})

export const DEFAULT_WORLD_ACTION_MAP = Object.freeze({
  MOVE_LEFT: "world.moveLeft",
  MOVE_RIGHT: "world.moveRight",
  MOVE_FORWARD: "world.moveForward",
  MOVE_BACK: "world.moveBack",
  STOP: "world.stop",
  SELECT: "world.select",
  BACK: "world.back",
  MAP_PAN: "map.pan",
  MAP_ZOOM: "map.zoom",
  MAP_ROTATE: "map.rotate",
  NEXT_PAGE: "content.nextPage",
  PREVIOUS_PAGE: "content.previousPage",
})

export function resolveIntent(intentEvent, overrides = {}) {
  const characterMap = { ...DEFAULT_CHARACTER_ACTION_MAP, ...(overrides.character || {}) }
  const worldMap = { ...DEFAULT_WORLD_ACTION_MAP, ...(overrides.world || {}) }
  const key = intentEvent?.intent
  if (!key) return null
  if (characterMap[key]) return { channel: "character", action: characterMap[key], event: intentEvent }
  if (worldMap[key]) return { channel: "world", action: worldMap[key], event: intentEvent }
  return { channel: "unmapped", action: key, event: intentEvent }
}
