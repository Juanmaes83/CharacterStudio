# CHARACTER 2027 — DONOR INTEGRATION V2.1

Status: IMPLEMENTED — VISUAL QA REQUIRED

## Why V2.1 exists

Visual QA of Motion Foundation V2 showed that hard-coded Euler offsets are not sufficient for production movement across different humanoid rigs. The most visible failures were elbows and knees bending on the wrong plane, social gestures not reading correctly, sit/crouch/jump lacking real joint-chain behaviour, left/right turns changing pose without convincingly rotating the actor, and occasional backward-looking motion.

The correction strategy is donor-first: reuse proven kinematic ideas from repositories already owned/forked by Juanma instead of continuing to hand-author arbitrary per-bone rotations.

## PRIMARY donor integrated now

### Juanmaes83/threejs-procedural-spider

License: MIT.

Relevant proven capability:

- analytic two-bone IK;
- decomposed two-bone IK;
- pole-direction control for knee/elbow bend plane;
- rest-axis-aware solving;
- planted-end-effector concepts;
- grounded/procedural gait concepts.

Integrated into Character 2027 as:

- `src/character2027/ik/DonorTwoBoneIK.js`
- `src/character2027/ik/HumanoidIKController.js`

The donor math is adapted and attributed in source. It is not coupled to the spider renderer or spider body model.

## What V2.1 changes

### Elbows

Arm actions such as WAVE, GOODBYE, POINT, WELCOME and AFTER_YOU now use a two-bone arm chain:

shoulder/upper arm -> elbow/lower arm -> hand target

A pole vector controls the elbow side so the joint cannot arbitrarily invert because a GLB uses a different local bone axis.

### Knees

CROUCH, KNEEL and SIT_SOFA now use:

hip/upper leg -> knee/lower leg -> planted foot target

The hips move vertically while both feet remain semantic end targets. Knee poles explicitly bias the knees forward/outward instead of relying on guessed local Euler X rotations.

### Jump

JUMP now includes actual character-root vertical displacement rather than only rotating leg bones. The root is restored to its stable base Y after recovery so repeated jumps cannot accumulate vertical drift.

### Turns

TURN_LEFT / TURN_RIGHT and their V2 equivalents now perform a deterministic 90-degree root rotation with eased interpolation while the turn pose plays. A turn is therefore a spatial action, not just torso twist.

### Post-animation solve order

Runtime order is now:

1. navigation/root motion;
2. AnimationMixer clip update;
3. humanoid IK post-process;
4. render.

This lets authored or retargeted clips provide style while IK corrects contact and joint-chain intent afterward.

## SECONDARY donors retained, not embedded tonight

### Juanmaes83/BVHEcctrl

Role: locomotion/collision/grounding donor.

Useful for:

- acceleration/deceleration;
- slope and stair traversal;
- grounded capsule behaviour;
- movement-state orchestration.

Not copied wholesale into CharacterStudio because it is React Three Fiber / physics-controller oriented while CharacterStudio and the target PAINT runtime are vanilla Three.js. Its movement concepts remain a donor for the next grounded-world integration rather than introducing an unnecessary runtime migration.

### Juanmaes83/closed-chain-ik-js

Role: advanced multi-contact IK.

Reserved for ROPE / ladder / two-hand contact where more than one end effector must stay constrained simultaneously. It is intentionally not the default arm/leg solver because generalized closed-chain IK would be excessive for ordinary wave, sit, point, crouch and jump actions.

## Gate to Rope

V2.1 should be considered ready for Rope only after visual QA confirms on at least two different avatars:

- elbows bend consistently and do not invert;
- knees bend consistently and do not invert;
- WAVE and GOODBYE read as arm gestures;
- POINT reads as a directed gesture;
- CROUCH visibly lowers the body while preserving foot intent;
- SIT_SOFA visibly bends knees instead of folding the whole leg backward;
- JUMP leaves the ground and returns to the same Y;
- TURN_LEFT / TURN_RIGHT rotate the whole actor by approximately 90 degrees;
- repeated actions do not accumulate pose or vertical drift.

After this gate, the next isolated project should be the protected Rope clone. `closed-chain-ik-js` becomes relevant there for two-hand rope contact and body-follow constraints.
