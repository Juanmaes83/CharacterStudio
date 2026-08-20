# CHARACTER 2027 — ROPE INTEGRATION GATE

Status: EXECUTABLE MOTION GATE READY — HUMAN VISUAL QA REQUIRED BEFORE ROPE CLONE

## Non-negotiable protection rule

Never modify the stable/base experience to test Character 2027.

Pipeline:

BASE PROJECT (READ-ONLY BASELINE)
→ CLONE / ISOLATED COPY
→ RENAME FOR THE CAPABILITY UNDER TEST
→ IMPLEMENT
→ LOCAL VISUAL QA
→ CHECKPOINT
→ ONLY THEN CONSIDER PROMOTION

## Accepted avatar formats

Character 2027 Motion Lab accepts:

- GLB — preferred portable runtime format
- glTF — accepted
- VRM — accepted humanoid fallback when a CharacterStudio class cannot produce a clean GLB

Current evidence:

- at least two exported GLB avatars load and pass the humanoid rig validator;
- the Demon/ONIFORCE class currently remains a GLB export edge case;
- its VRM output loads successfully in Motion Lab and is accepted as a fallback rather than blocking the program.

The Demon GLB case remains `GLB EXPORT EDGE CASE 01`; it is not a blocker for Motion Foundation or the Rope gate.

## Gate before Rope

The Rope clone must not start until all of these are visually validated:

- Avatar A loads as GLB
- Avatar B loads as GLB
- Demon/alternate humanoid can load through VRM fallback
- both primary GLB rigs pass the humanoid validator
- IDLE works on both
- WALK works on both
- STOP works on both
- TURN_LEFT / TURN_RIGHT work on both
- no catastrophic shoulder/hip/leg deformation
- walkTo(target) reaches the target and stops within tolerance
- turnTo(target) faces the target reliably

External retarget remains part of the architecture, but it is no longer required to run the first locomotion gate: Motion Lab now includes a built-in baseline motion set so the Character 2027 controller can be tested immediately on every compatible avatar.

## Executable Motion Lab gate

`/motion-lab` now exposes one-click controls for:

- LOAD IDLE + WALK + STOP + TURN
- IDLE
- WALK
- STOP
- TURN_LEFT
- TURN_RIGHT
- WALK TO LEFT TARGET
- WALK TO RIGHT TARGET
- TURN TO CENTRE

This baseline is intentionally simple and procedural. Its purpose is not final animation quality. Its purpose is to validate:

- reusable bone targeting;
- AnimationMixer state playback;
- state transitions;
- world-space locomotion;
- deterministic arrival;
- deterministic facing;
- second-avatar portability.

After this gate passes visually, external Mixamo/Quaternius animation quality and retarget refinement can replace the baseline clips without changing the Character Action API.

## GLB export hardening

The CharacterStudio GLB export compatibility path now attempts sanitized SkinnedMesh exports, texture-free fallbacks, bounded timeouts and diagnostics. This is intentionally independent of the upstream optimized exporter. The Demon class still exhibits a class-specific GLB failure and remains an isolated regression case.

## Deterministic locomotion API

MotionController exposes:

- walkTo(target, options)
- turnTo(target, options)
- stop()

The controller owns world translation/orientation while animation clips remain in-place. This is deliberate: Rope, Paint, Museum and world experiences need deterministic spatial arrival rather than animation-root drift.

## Rope four-stone plan

### ROPE 01 — Replace Character
Replace one legacy Rope character with a Character 2027 avatar. Do not change rope interaction yet.

### ROPE 02 — Approach
spawn → orient → walkTo(approachPoint) → stop → turn/look toward rope

### ROPE 03 — Reach + Grab
rope.gripPoint → hand target → arm IK → wrist alignment → hand socket → attach

### ROPE 04 — Pull + Release
grab → body lean → pull → rope reacts → arm/body follows tension → release → idle

## Semantic Rope contract

The clone should expose interaction targets rather than letting the character infer geometry:

- rope.approachPoint
- rope.gripPointLeft
- rope.gripPointRight
- rope.pullDirection
- rope.tension
- rope.releasePoint

Character API remains independent:

- character.walkTo(...)
- character.turnTo(...)
- character.lookAt(...)
- character.reach(...)
- character.grab(...)
- character.pull(...)
- character.release(...)

## Source-project warning

Do not clone `Juanmaes83/rope-gallery` for Character 2027 interaction testing without explicit confirmation. The repository currently inspected under that name is a Vite/Three hanging-gallery landing experience and does not expose the legacy interchangeable-avatar Rope system expected by this plan.

A candidate family exists in `Juanmaes83/escaparates-pro`, including branch `feature/hanging-media-studios-v1-v4-1-1`, but the exact legacy avatar/rope implementation must be identified before cloning. Cloning the wrong donor would violate the baseline-first methodology.

## Next checkpoint

Human visual QA in `/motion-lab`:

1. load Avatar A;
2. press `LOAD IDLE + WALK + STOP + TURN`;
3. inspect all five motion states;
4. run left/right `walkTo` targets and `turnTo`;
5. repeat on Avatar B;
6. if both pass, identify the exact Rope baseline, clone it, rename the isolated experiment `ROPE-CHARACTER-2027-LAB`, freeze the baseline, and begin ROPE 01 only.
