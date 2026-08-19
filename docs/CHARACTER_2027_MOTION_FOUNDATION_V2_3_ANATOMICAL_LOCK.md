# CHARACTER 2027 — MOTION FOUNDATION V2.3 / ANATOMICAL LOCK

Status: IMPLEMENTED — HUMAN VISUAL QA REQUIRED BEFORE PHASE CLOSE

## Why V2.3 exists

V2.2 proved the action architecture but exposed repeated structural failures: knees and elbows could select the wrong bend hemisphere, world/rest axes could be transformed twice, procedural clips and IK could fight over the same joints, jump/kneel recovery could create end-of-action artifacts, and navigation could translate before the actor had acquired its heading.

V2.3 fixes those causes rather than patching each action independently.

## Structural corrections

1. `restAxis` is stored once in root-local space and converted to world only during solve.
2. Each two-bone chain calibrates a bend pole from the avatar rest pose, with semantic fallbacks for straight limbs.
3. Character 2027 anatomical forward is +Z; leg poles are locked to the forward hemisphere.
4. Pole continuity prevents a requested pole from flipping into the opposite anatomical hemisphere.
5. IK-owned joints are removed from procedural clip tracks for states where IK is authoritative.
6. Crouch/kneel/sit/reach use explicit enter-hold-exit envelopes instead of a universal sine return.
7. Jump uses separate anticipation, airborne and landing-compression phases with no discontinuous pose jump.
8. `walkTo` uses PRE_TURN_WALK when heading error is large; translation begins only after orientation is within tolerance.
9. Step/stair benchmark geometry is now visible in Motion Lab.
10. Ladder arms and legs are post-solved by IK with a cross-lateral climbing pattern.

## IK ownership

When an action is IK-governed, the solver owns the affected two-bone chains after `AnimationMixer`:

- legs: JUMP, CROUCH, STEP_UP, STEP_DOWN, STAIRS_UP, STAIRS_DOWN, LADDER_UP, LADDER_DOWN, SIT_SOFA, LEAN_WALL
- right arm: WAVE, GOODBYE, POINT, AFTER_YOU, PRESS_DOORBELL, KNOCK_DOOR, PICK_UP_CUP, PICK_UP_PHONE, PICK_UP_MAGAZINE, OPEN_DOOR, LADDER_UP, LADDER_DOWN
- left arm: WELCOME, PICK_UP_MAGAZINE, LADDER_UP, LADDER_DOWN

The procedural clip keeps timing, chest/head/hips style and secondary motion, but it no longer competes with IK for those elbow/knee chains.

## Interaction corrections retained

- doorbell: hand -> button target
- knock: repeated hand -> door contact
- cup: grip -> attach -> carry -> release/restore
- phone: primary grip + optional second-hand support
- magazine: two-hand grip benchmark
- door: handle reach + hinged rotation
- sofa: pelvis back/down + planted feet + forward-knee IK + torso participation
- lean: pelvis/wall contact + surface normal + planted support

## Runtime diagnostics

`MotionController.getDiagnostics()` exposes navigation state plus `HumanoidIKController` diagnostics including knee/elbow hemisphere corrections, unreachable targets, current pole vectors and local rest axes.

These diagnostics are useful for technical QA but do not replace human visual QA.

## FINAL acceptance gate

Do not close Character Foundation until the same build passes on at least two accepted avatars:

- knees never visibly bend backward during SIT, CROUCH, STEP, STAIRS, JUMP, KNEEL
- elbows never invert unexpectedly during social/reach actions
- SIT reads as pelvis back/down, knees forward, feet planted
- STEP_UP and STEP_DOWN have correct knee direction and foot clearance
- STAIRS_UP/DOWN alternate legs without backward knee inversion
- JUMP reads anticipation -> airborne -> landing -> recover
- KNEEL enters and exits cleanly with no end pop
- TURN and walkTo produce no backward drift caused by translating before heading acquisition
- DOORBELL reaches the button
- KNOCK produces repeated visible contact
- CUP/PHONE/MAGAZINE reach and attach without catastrophic arm deformation
- OPEN_DOOR reaches handle and door rotates around hinge
- LEAN reads as supported by wall rather than arbitrary displacement
- LADDER alternates arms/legs with correct elbow/knee hemisphere

## Phase boundary

When the human visual gate passes:

CHARACTER FOUNDATION V2.3 -> CLOSED

Next integration sequence:

1. ROPE clone / reach + grab + pull + release
2. PAINT YOUR LOGO clone / tools + ladder + paint
3. MUSEUM integration
4. COSTA BLANCA WORLDS integration

No promotion to those projects before the final visual gate.