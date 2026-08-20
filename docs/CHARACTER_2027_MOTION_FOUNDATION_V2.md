# CHARACTER 2027 — MOTION FOUNDATION V2

Status: IMPLEMENTED AS VISUAL/TECHNICAL BENCHMARK — HUMAN QA REQUIRED

## Purpose

V2 upgrades the first motion proof from simple state playback into a reusable behaviour layer for Rope, Paint Your Logo, Museum, Costa Blanca, Sakura and future spatial experiences.

The procedural clips in this lab are NOT the final premium animation library. They are deterministic reference motions used to validate rig compatibility, relaxed posture, body participation, target-aware gaze, navigation, semantic interaction contracts and the breadth of the action API before replacing clips with premium mocap/retargeted animation where useful.

## Biomechanics corrections

V2 intentionally attacks the biggest problems seen in the first visual recording:

- arms no longer remain close to a T-pose during neutral motion;
- neutral shoulders/forearms are relaxed;
- walk adds arm/leg opposition;
- chest counter-rotation participates in gait;
- hips shift during the gait cycle;
- stop includes weight settling;
- turns include hips/chest/head anticipation;
- one-shot actions crossfade back to V2 idle;
- deterministic walkTo slows near the arrival target.

These are benchmark improvements, not final motion-capture quality. Foot planting and full-body IK remain future layers.

## V2 locomotion core

- IDLE_V2
- WALK_V2
- STOP_V2
- TURN_LEFT_V2
- TURN_RIGHT_V2
- deterministic walkTo(target)
- deterministic turnTo(target)

## Vertical / terrain capability

Required:

- JUMP
- CROUCH
- STEP_UP
- STEP_DOWN
- STAIRS_UP
- STAIRS_DOWN
- LADDER_UP
- LADDER_DOWN

Additional V2 choices:

- KNEEL — useful for low exhibits, objects, maintenance, lifestyle scenes and Sakura performance.
- BEND_DOWN — universal prerequisite for picking up low objects and inspecting low targets.

## Social / guidance capability

Required:

- WAVE
- GOODBYE
- POINT
- NOD
- LOOK_AT

Additional V2 choices:

- WELCOME — Museum/Costa Blanca guide and host behaviour.
- AFTER_YOU — spatial guidance for doors, galleries, homes, resorts and visitor flows.

LOOK_AT also has a target-aware controller using head + neck with yaw/pitch clamps rather than being only a fixed clip.

## Eight universal interaction benchmarks

1. PRESS_DOORBELL — precise contact.
2. PICK_UP_CUP — one-hand object acquisition/use pose.
3. SIT_SOFA — full-body environmental alignment benchmark.
4. LEAN_WALL — surface contact / relaxed environmental pose benchmark.
5. KNOCK_DOOR — repeated contact.
6. PICK_UP_PHONE — small-object grip/use benchmark.
7. PICK_UP_MAGAZINE — two-hand flat-object benchmark.
8. OPEN_DOOR — handle/contact + body turn benchmark.

The lab creates semantic environment targets for these actions. Each target can expose:

- approachPoint
- lookAt
- contactPoint
- optional surfaceNormal
- interaction type

The benchmark sequence is:

walkTo(approachPoint)
→ lookAt(target)
→ turn/alignment
→ action/contact pose
→ recovery

This is the same architecture that later becomes Rope grip points, Paint tool grips, museum artwork targets, door handles, cups, phones, sofas, walls and Costa Blanca POIs.

## Project mapping

### Rope
reach → grip → pull → release → body follows tension.

### Paint Your Logo
ladder up/down → tool approach → reach/grab → paint → inspect → ladder reposition.

### Museum
welcome → after-you → point → lookAt artwork → bend/kneel → sit/lean → phone/photo-like object use.

### Costa Blanca
walk/turn → stairs → doorbell/door → sit/lean → cup/phone/magazine → welcome/guidance.

### Sakura
jump → crouch → kneel → fast expressive social actions → later personality/motion profiles.

## QA gate before project clones

Validate at least two different CharacterStudio avatars:

- relaxed idle is visibly better than V1;
- walk does not read as a T-pose;
- stop and turns are readable and stable;
- jump/crouch/step/stairs/ladder actions do not catastrophically deform the rig;
- target-aware lookAt turns head/neck toward a target without extreme rotation;
- all eight semantic interaction buttons approach their environment target and trigger the intended benchmark action;
- no core skeleton failure on GLB avatar A and B;
- VRM fallback remains accepted for the Demon edge case.

Only after human visual QA should the next small-project clone be created. Stable source projects remain untouched.
