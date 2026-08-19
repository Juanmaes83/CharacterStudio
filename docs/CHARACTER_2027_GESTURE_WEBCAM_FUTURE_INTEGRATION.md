# CHARACTER 2027 — WEBCAM / HAND / BODY / FACE INPUT ARCHITECTURE

Status: DORMANT FOUNDATION ADDED — DO NOT ACTIVATE BEFORE IK / MOTION GATE CLOSES

## Product direction

Character 2027 is not only an animation system. It must become a reusable embodied interaction layer for:

- Costa Blanca Worlds
- Museum / Institutional Worlds
- Sakura
- Paint Your Logo
- future immersive worlds

The same worlds should eventually be navigable by mouse/touch, scripted AI and webcam-recognized human gestures without rewriting the character controller.

## Non-negotiable sequence

1. Close elbow / knee / turn / motion correctness first.
2. Validate Character 2027 in small project clones (Rope first).
3. Integrate webcam detection as a separate input adapter.
4. Never couple MediaPipe/OpenCV directly to a specific world or avatar.

Architecture:

CAMERA / DETECTOR
→ LANDMARKS / GESTURE CLASSIFIER
→ NORMALIZED GESTURE INTENT
→ INPUT ROUTER
→ CHARACTER ACTION API / WORLD ACTION API
→ ANIMATION + IK + INTERACTION CONTROLLER

The detector must never call animation clips directly.

## Confirmed donor repositories already owned/forked

### Juanmaes83/map-gesture-controls — PRIMARY browser gesture-control donor

Current README documents a browser-first MediaPipe Hand Landmarker pipeline with webcam capture, 21 3-D landmarks per detected hand, gesture classification, dwell/grace filtering, dead-zone filtering and exponential smoothing. It already recognizes or uses semantic patterns such as fist, pinch, one-hand movement and two-hand rotation. It runs locally in the browser and is explicitly designed to control OpenLayers, Google Maps and Leaflet.

This is directly relevant to Costa Blanca Worlds and Museum maps because the donor already separates gesture detection from map-specific adapters.

Reuse targets:

- webcam lifecycle / permissions
- MediaPipe Hand Landmarker browser pipeline
- hand landmarks
- dwell / release grace state machine
- smoothing and dead zones
- fist / pinch classification
- one-hand delta tracking
- two-hand rotation / distance semantics
- map pan / zoom / rotate adapters as future capability

Do not copy map-specific code into Character 2027 core. Extract/port the detector and normalized event concepts only.

### Juanmaes83/hand-gesture-recognition-mediapipe — TRAINING / CLASSIFICATION donor

This donor contains MediaPipe + OpenCV/TFLite examples for static hand-sign classification and temporal finger-gesture classification. Its documented default static classes include open hand, closed hand and pointing; temporal examples include stationary, clockwise, counter-clockwise and moving. It also contains training-data and retraining workflows.

Reuse targets later:

- gesture vocabulary design
- keypoint preprocessing
- static hand-sign classifier concepts
- point-history / temporal gesture classifier concepts
- custom gesture training workflow

It is Python-oriented, therefore it is not the primary browser runtime donor.

### Juanmaes83/mediapipe

Large upstream MediaPipe fork. Treat as reference / capability source, not something to embed wholesale into CharacterStudio.

### Additional candidate family already present

- Juanmaes83/OpenCV-Hand-Gesture-Control
- Juanmaes83/Hand-Gesture-Recognition-for-Cursor-Controlling
- Juanmaes83/Gesture-Recognition
- Juanmaes83/sword-rain-hand-control
- Juanmaes83/hand-gesture-particle-effects
- Juanmaes83/mediapipe-touchdesigner

These remain archaeology candidates. Do not integrate before donor-by-donor license/runtime/value inspection.

## Dormant contract added now

`src/character2027/input/GestureIntentContract.js`

This file intentionally has no webcam dependency and is not wired into MotionLab runtime yet.

It defines a stable semantic vocabulary so future detectors can emit normalized events such as:

### Navigation

- MOVE_LEFT
- MOVE_RIGHT
- MOVE_FORWARD
- MOVE_BACK
- STOP
- TURN_LEFT
- TURN_RIGHT
- LOOK_AT
- SELECT
- BACK

### Hand signs / trajectories

- OPEN_HAND
- FIST
- PINCH
- POINT
- OK_SIGN
- THUMBS_UP
- WAVE_LEFT
- WAVE_RIGHT
- TWO_HAND_SPREAD
- TWO_HAND_CLOSE
- ROTATE_CW
- ROTATE_CCW

### Character interactions

- WAVE_HELLO
- WAVE_GOODBYE
- NOD
- SHAKE_HEAD
- GRAB
- RELEASE
- USE
- PRESS
- KNOCK
- PICK_UP
- PUT_DOWN
- OPEN
- CLOSE
- SIT
- STAND
- CROUCH
- JUMP

### Media / object interactions

- NEXT_PAGE
- PREVIOUS_PAGE
- MAP_PAN
- MAP_ZOOM
- MAP_ROTATE
- PHONE_SWIPE_LEFT
- PHONE_SWIPE_RIGHT
- PHONE_TAP

This initial vocabulary deliberately covers the known future use cases: books/pages, maps, mobile interfaces, pointer/select gestures and embodied character actions.

## Future gesture → action examples

Human waves at webcam
→ WAVE_HELLO
→ character.playAction("WAVE")

Human points right
→ POINT + direction
→ character/guide points or world selects target

Open palm moves left/right
→ movement delta
→ world/map pan or UI carousel movement

Pinch
→ PINCH
→ select / grab / map zoom depending on active interaction context

Two hands separate/close
→ TWO_HAND_SPREAD / TWO_HAND_CLOSE
→ map/object zoom

Two hands rotate
→ ROTATE_CW / ROTATE_CCW
→ map/object rotation

Page-turn gesture
→ NEXT_PAGE / PREVIOUS_PAGE
→ book/magazine content controller

Fist / open hand
→ GRAB / RELEASE in an interaction context
→ Character 2027 hand IK later mirrors or responds to user intent

## Important distinction: gesture control vs avatar mirroring

There are two future modes and they must remain separate:

### COMMAND MODE

The user's gesture triggers a semantic action.

Example:

wave webcam → avatar executes polished WAVE animation

This is the first integration target because it is stable, low latency and reusable.

### PERFORMANCE / MIRROR MODE

The webcam landmarks drive avatar body / arms / hands / face continuously.

Example:

user raises right hand → Character 2027 right arm follows user pose.

This requires retargeting, temporal filtering, joint limits, confidence gates, hand/finger rig support and later facial blendshape/expression mapping. It must not be mixed into the first command-mode implementation.

## Finger system requirement

Current Character 2027 contract must anticipate fingers even though Motion Foundation V2 currently focuses on major humanoid joints.

Future canonical hand capability should include semantic finger state / targets for:

- open hand
- closed fist
- pinch
- pointing index
- OK sign
- thumbs up
- relaxed grip
- cup grip
- phone grip
- book/magazine grip
- handle grip

These should be motion/profile parameters, not bespoke world code.

## Body / face future adapters

Reserve these adapters conceptually:

- `MediaPipeHandInputAdapter`
- `MediaPipePoseInputAdapter`
- `MediaPipeFaceInputAdapter`
- `GestureIntentRouter`
- `AvatarPerformanceAdapter`

Do not implement them into runtime until the IK / Motion Foundation gate is visually accepted.

## Costa Blanca Worlds surgery implication

When Kimi's new panel, customizable rooms and custom avatars are unified into Costa Blanca Worlds, the world must consume semantic Character 2027 APIs rather than knowing where animations or webcam detectors come from.

Target architecture:

COSTA BLANCA WORLD / MUSEUM / SAKURA
              ↓
      CHARACTER ACTION API
              ↓
  MOTION + IK + INTERACTIONS
              ↑
    INPUT INTENT ROUTER
       ↑              ↑
mouse/touch/AI     webcam gestures

This protects the worlds from future detector changes.

## Tomorrow / next execution order

### Gate A — finish current V2.1

Validate and correct:

- knees
- elbows
- left/right turns
- backwards artifacts
- wave/goodbye
- sit/crouch/jump
- interaction poses

### Gate B — Rope isolated clone

Use Character 2027 for reach → grab → pull → release. Introduce closed-chain IK only where multi-contact requires it.

### Gate C — Costa Blanca Worlds surgery

Audit Kimi work, new panel, customizable rooms, new custom avatars and current world runtime. Freeze each baseline, then integrate through contracts rather than copying components blindly.

### Gate D — webcam command-mode lab

Clone an isolated world lab and connect browser MediaPipe hand detection to `GestureIntentContract`, initially with only:

- open hand
- fist
- pinch
- point
- wave
- left/right hand movement
- two-hand spread/close
- two-hand rotation

Acceptance: detector input can trigger world or Character 2027 semantic actions without detector-specific code leaking into the character or world layer.

## Dormant means dormant

The contract is committed now so architecture built tomorrow does not block or contradict webcam control. It does not request camera permission, load MediaPipe, activate tracking or alter MotionLab behaviour today.

That is deliberate: close motion mechanics first, then integrate the new input layer from a stable foundation.
