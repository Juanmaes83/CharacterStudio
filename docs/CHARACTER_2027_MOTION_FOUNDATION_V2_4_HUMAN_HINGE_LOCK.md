# CHARACTER 2027 — V2.4 HUMAN HINGE LOCK

Status: **IMPLEMENTED — TECHNICAL + HUMAN VISUAL QA REQUIRED**

V2.4 replaces the failed V2.3 anatomical assumption with a stricter human-biomechanics model.

## Non-negotiable hinge rule

A knee or elbow is not a free spherical joint. For Character 2027 the two-bone solver must never accept a mirrored geometric solution simply because it reaches the target.

For every arm/leg chain:

1. derive an anatomical preferred bend direction;
2. solve both mirrored two-bone candidates;
3. score each candidate against the preferred human bend hemisphere;
4. reject the posterior/mirrored candidate;
5. near full extension, preserve the previous valid joint side to prevent popping;
6. clamp unreachable/extreme targets before applying bone orientation.

## Anatomical body basis

The controller derives its working body frame from labeled humanoid bones rather than assuming the previous hardcoded root `+Z` pole is universally correct.

- right axis: left shoulder -> right shoulder;
- up axis: hips -> head;
- forward working axis: body-frame normal derived from those labeled axes;
- knees use forward-biased hinge poles;
- elbows use forward-biased poles with a small lateral component to avoid singularity.

## Sitting contract

SIT is no longer defined as `pelvis down`.

Required side-view geometry:

- sofa behind actor;
- pelvis back + down;
- thighs forward;
- knees clearly forward of pelvis;
- shins return backward;
- ankles/feet behind the knees and close to the pelvis/spine vertical axis;
- feet remain on floor;
- torso participates rather than remaining mechanically vertical.

MotionLab now faces the actor away from the sofa before SIT so the seat is physically behind the body.

## Jump contract

The impulse phase is a shallower sitting/squat pattern.

Sequence:

`compress -> push/extend -> airborne expansion -> prepare landing -> absorb -> recover`

Landing is never fully rigid: knees flex moderately at contact, pelvis absorbs, then the actor straightens quickly.

## Walking / terrain contract

WALK_V2, STEP_UP, STEP_DOWN, STAIRS_UP and STAIRS_DOWN are post-solved through the same human hinge rules. A swing foot follows an end-effector trajectory; the knee is not allowed to choose the mirrored/backward solution.

## Pickup contract

Pickups now follow:

`extend -> logical grip surface -> contact -> attach -> lift/retract -> flex elbow -> carry -> release/restore`

The benchmark cup now has a physical handle. Phone and magazine expose edge/surface grip semantics. The carry phase retracts the object toward the torso so the elbow flexes instead of remaining fully extended.

Future object contracts should add:

- massClass;
- sizeClass;
- gripPoints[];
- preferredHands;
- gripOrientation;
- carryOffset;
- liftSpeed;
- bodyAssist.

## Automated regression tests

`tests/unit/character2027-human-hinge.test.js`

Guards:

- knee chooses forward candidate;
- seated-like geometry keeps ankle behind forward knee;
- elbow closes toward front when hand returns toward torso;
- an explicitly reversed pole is not allowed to invert a knee.

A dedicated Character 2027 validation workflow was added to run hinge tests, the full Vitest suite and the production build on the prototype branch.

## Human acceptance gate

V2.4 cannot be marked closed until video QA confirms on real avatars:

- WALK: no backward knee flexion;
- CROUCH: knees forward and stable;
- SIT: pelvis back/down, knees forward, shins back, feet under body axis;
- JUMP: compression, extension, flight, soft landing, recovery;
- STEP/STAIRS: no mirrored knees and credible foot clearance;
- KNEEL: clean enter/hold/exit without end pop;
- WAVE/POINT/REACH: elbows never invert backward;
- DOORBELL/KNOCK: hand reaches real contact with plausible elbow;
- CUP: hand aims at handle, lifts, retracts and carries;
- PHONE/MAGAZINE: hands respect the object surface/volume;
- OPEN_DOOR: hand reaches handle while elbow remains human;
- LEAN: support still reads correctly.

Only after this gate passes:

`CHARACTER FOUNDATION -> CLOSED -> ROPE -> PAINT YOUR LOGO -> MUSEUM -> COSTA BLANCA WORLDS`
