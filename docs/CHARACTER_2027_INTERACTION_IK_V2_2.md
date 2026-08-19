# CHARACTER 2027 — INTERACTION IK V2.2

Status: IMPLEMENTED — HUMAN VISUAL QA REQUIRED

## Goal

Move the universal interaction benchmarks from pose approximation to target-driven physical interaction using the Character 2027 humanoid IK post-process.

## Implemented contracts

### PRESS_DOORBELL
- right hand solves toward the real doorbell world-space target
- elbow is resolved through donor-backed two-bone IK
- reach uses a bounded envelope and returns to neutral

### KNOCK_DOOR
- right hand solves toward the real door surface
- repeated contact pulses create knock/retract motion
- elbow pole keeps the bend natural

### PICK_UP_CUP
- hand reaches the cup grip point
- object is attached to the hand during the use phase
- object returns to its original parent / transform on release

### PICK_UP_PHONE
- primary right-hand grip
- optional left-hand support while held
- attach / release lifecycle

### PICK_UP_MAGAZINE
- right-hand primary grip
- left-hand secondary grip target
- two-hand flat-object benchmark
- attach / release lifecycle

### OPEN_DOOR
- hand reaches the physical handle
- door has a real hinge pivot instead of rotating around its centre
- door rotates through the interaction phase and restores after the benchmark

### LEAN_WALL
- wall exposes a surface normal, pelvis contact and shoulder contact
- character root moves toward the contact surface with a bounded correction
- pelvis settles and torso receives a lean adjustment

### SIT_SOFA
- sofa exposes seat and foot targets
- pelvis is lowered toward the real seat target
- root translates toward the seat
- both legs solve toward floor targets
- torso receives a small forward comfort adjustment

## Architecture

```text
SEMANTIC OBJECT CONTRACT
        ↓
approach / look / align
        ↓
AnimationMixer style layer
        ↓
HumanoidIKController
        ↓
shoulder → elbow → hand target
hip → knee → foot target
        ↓
contact / attach / release / recover
```

The interaction system is intentionally target-driven. The avatar does not infer where a button, handle, seat or grip is from arbitrary mesh geometry. Worlds expose semantic targets. This same contract can later be supplied by Rope, Museum, Costa Blanca Worlds, Paint, Sakura and authored rooms.

## Donor basis

Two-bone limb solving remains derived from the already integrated donor math from `Juanmaes83/threejs-procedural-spider` (MIT), with Character 2027 adaptation for humanoid shoulders/elbows and hips/knees.

`closed-chain-ik-js` is still reserved for the Rope / multi-contact stage where two hands, rope tension or multiple simultaneous constraints justify a generalized solver.

## QA gate

Do not mark this phase complete until visual validation confirms:

- elbow bends away from the torso instead of collapsing inward
- knees bend forward / naturally for the tested avatar
- hand visibly reaches the doorbell
- knock visibly contacts and retracts from the door
- cup leaves its pedestal, follows the hand, and returns on release
- phone follows the hand without catastrophic wrist/elbow deformation
- magazine is supported by both arms
- door rotates from a hinge and the hand/arm remain plausible
- seated pelvis reaches the sofa and feet remain near the floor
- lean reads as body-to-wall contact rather than a free-standing tilt
- all interactions recover without accumulating root, hip or object transforms

## Known limitation before visual QA

This is a browser procedural/IK benchmark, not final mocap. Finger closure, exact wrist orientation, collision-aware shoulder compensation, hand-to-handle closed-chain persistence and surface-aware full-body balance are subsequent refinement layers if the human QA shows they are needed.
