# CHARACTER 2027 — ROPE INTEGRATION GATE

Status: IMPLEMENTATION IN PROGRESS — HUMAN VISUAL QA REQUIRED BEFORE ROPE CLONE

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

## Gate before Rope

The Rope clone must not start until all of these are visually validated:

- Avatar A loads as GLB
- Avatar B loads as GLB
- both rigs pass the humanoid validator
- IDLE works on both
- WALK works on both
- STOP works on both
- TURN_LEFT / TURN_RIGHT work on both
- retarget report has no catastrophic unmapped core bones
- no catastrophic shoulder/hip/leg deformation
- walkTo(target) reaches the target and stops within tolerance
- turnTo(target) faces the target reliably

## GLB export hardening

The CharacterStudio GLB export compatibility path now:

1. clones the live modular character with SkeletonUtils so SkinnedMesh/Skeleton/Bone relationships survive;
2. strips runtime userData that may contain circular VRM references;
3. converts unsupported/custom shader materials to MeshStandardMaterial while preserving available maps;
4. exports binary GLB;
5. falls back to the live assembled scene if the sanitized clone fails;
6. reports the strategy and file size in the browser console.

This is intentionally independent of the upstream optimized exporter, which still has argument-order defects in several code paths.

## Deterministic locomotion API

MotionController now exposes:

- walkTo(target, options)
- turnTo(target, options)
- stop()

The controller owns world translation/orientation while animation clips remain in-place. This is deliberate: Rope, Paint, Museum and world experiences need deterministic spatial arrival rather than animation-root drift.

## Rope four-stone plan

### ROPE 01 — Replace Character
Replace one legacy Rope character with a Character 2027 GLB. Do not change rope interaction yet.

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

Human visual QA in `/motion-lab` with two freshly exported GLBs. Once both pass, identify the exact Rope baseline, clone it, rename it `ROPE-CHARACTER-2027-LAB`, freeze the baseline, and begin ROPE 01 only.
