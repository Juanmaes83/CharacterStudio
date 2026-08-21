# CHARACTER 2027 — MOTION FOUNDATION

Status: IMPLEMENTED FOR LOCAL VALIDATION

Branch: `agent/character-2027-prototype-01`

## Scope

This phase deliberately implements only the motion foundation needed to validate reusable animation across exported CharacterStudio avatars.

Included:

- local GLB target avatar loading;
- humanoid rig validation;
- normalization of compatible duplicated modular skeletons;
- local FBX / GLB / glTF animation loading;
- Mixamo-name to normalized humanoid bone mapping;
- retargeting with source rest-pose correction;
- hips translation scaling;
- deterministic motion states;
- cross-fade transitions;
- visual Motion Lab;
- second-avatar compatible architecture.

Not included yet:

- free locomotion through the world;
- collision controller;
- foot IK;
- arm / hand IK;
- look-at orchestration;
- grab / tool sockets;
- paint interaction;
- root-motion actions;
- final premium art direction.

## Runtime entry

Start the existing project normally and open:

`http://localhost:5174/motion-lab`

The Motion Lab is isolated from the original CharacterStudio authoring flow and does not require the Web3 provider stack.

## Test sequence

### 1. Load target avatar

Use the exported `Anon.glb` or another CharacterStudio GLB.

Expected report:

- at least one SkinnedMesh;
- normalized humanoid bone names;
- RIG PASS when all required motion bones are present;
- modular skins unified when their bone layouts are compatible.

### 2. Load animation slots

Each slot accepts FBX / GLB / glTF:

- IDLE
- WALK
- STOP
- TURN_LEFT
- TURN_RIGHT

Mixamo FBX is the first target because CharacterStudio already uses the same Mixamo-to-humanoid mapping.

### 3. Validate retarget report

For each loaded clip the lab reports:

- source track count;
- generated target track count;
- hips scale;
- unmapped source bones;
- missing source bones.

### 4. Validate transitions

Use the state buttons to verify deterministic playback and 0.2s cross-fades.

## Definition of Done for this phase

The phase is only considered complete after human visual validation of:

- IDLE on `Anon.glb`;
- WALK on `Anon.glb`;
- STOP on `Anon.glb`;
- TURN_LEFT on `Anon.glb`;
- TURN_RIGHT on `Anon.glb`;
- no catastrophic shoulder / hips / foot deformation;
- acceptable scale and orientation;
- the same motion clips work on a second compatible avatar.

## Architecture

`MotionLab`
→ `BoneMap / Rig inspection`
→ `Retargeter`
→ `MotionController`
→ `THREE.AnimationMixer`

The target character remains independent from the animation source. This is the key contract for future reusable characters.

## Next slice after approval

Only after this phase passes:

1. controlled `walkTo(target)` locomotion;
2. speed / stride synchronization;
3. foot planting and ground correction;
4. look-at;
5. arm / hand IK;
6. grab and tool socket;
7. paint hero sequence.
