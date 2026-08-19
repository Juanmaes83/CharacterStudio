# CHARACTER 2027 — MOTION FOUNDATION V2.3 / ANATOMICAL LOCK

Status: **FAILED VISUAL QA — DO NOT PROMOTE**

V2.3 is retained only as a historical checkpoint. Human review of `PRUEBA AVATAR MOVIMIENTO 4` showed that the intended anatomical lock was not actually guaranteed.

## Confirmed failures

- knees could still bend toward the posterior hemisphere in WALK_V2, SIT, STEP and STAIRS;
- elbows could select the mirrored bend solution during reach/social actions;
- SIT lowered the pelvis but did not enforce the correct seated leg geometry;
- JUMP still behaved too much like root translation plus pose instead of impulse -> extension -> flight -> landing absorption -> recovery;
- procedural clips and IK authority were still not cleanly separated enough;
- pickup actions reached objects without a sufficiently strong grip-surface / carry biomechanics model.

## Root cause

The V2.3 implementation treated a global/root `+Z` assumption and a pole direction as if they were a hard anatomical constraint. A two-bone chain has mirrored geometric solutions. A pole preference is not enough unless the invalid hinge hemisphere is explicitly rejected.

The next version therefore replaces this approach with a HUMAN HINGE contract:

- derive an anatomical body basis from the rig;
- solve both two-bone candidates;
- reject the mirrored knee/elbow candidate;
- preserve temporal continuity near full extension;
- use feet/grip surfaces as physical end-effectors;
- rebuild SIT/JUMP/WALK around human biomechanics rather than named poses.

## Correct seated geometry

For the accepted sitting model:

1. sofa is behind the human;
2. pelvis travels backward and downward;
3. thighs project forward;
4. knees are the anterior-most part of the leg chain;
5. shins return backward from the knees;
6. feet remain behind the knees, close to the vertical axis of pelvis/spine;
7. feet stay on the floor.

## Correct jump geometry

The first phase of JUMP is a shallower version of the sitting/squat mechanism:

1. pelvis lowers;
2. knees flex forward;
3. body compresses for impulse;
4. legs extend rapidly and the body leaves the floor;
5. body expands during ascent/flight;
6. before contact, the legs soften again;
7. landing is absorbed with moderate knee flexion;
8. the body rapidly returns upright.

## Replacement

V2.3 is superseded by:

`CHARACTER 2027 — V2.4 HUMAN HINGE LOCK`

Do not use V2.3 as a donor for future world integrations except for unaffected infrastructure such as semantic interaction targets, object restore/attach concepts, door hinge, LookAt, navigation contracts and diagnostics.
