# CHARACTER 2027 — PROTOTYPE 01

## Mission

Use this fork as the controlled donor/lab for the first premium web character prototype. Do not rebuild PAINT-YOUR-LOGO-WALL here and do not expand to six characters yet.

The first goal is deliberately small: prove that a single real skinned humanoid can reach a clearly premium 2026–27 visual bar in Three.js before we spend more time on advanced interaction.

## Source baseline

This repository is derived from M3-org/CharacterStudio and remains subject to its MIT license. Preserve upstream attribution and license notices.

The existing stack is strategically useful because it already includes Three.js, @pixiv/three-vrm, GLB/VRM handling, animation support, postprocessing, KTX2-related tooling and avatar optimization capabilities.

## Sculpt-the-stone rule

Work only in closed sequential slices. Finish, validate and checkpoint each slice before opening the next.

### Slice 0 — Freeze legacy assumptions

- No CapsuleGeometry/SphereGeometry/BoxGeometry character bodies as the premium path.
- Procedural primitive characters may survive only as a legacy fallback/reference.
- Do not create six characters.
- Do not port PAINT interaction logic yet.

Definition of Done: the premium prototype has a separate branch and a fixed acceptance contract.

### Slice 1 — Visual ceiling

Load one real humanoid asset and make it look excellent before adding complex behavior.

Acceptance:
- real authored mesh, not primitives;
- complete body;
- recognizable face;
- hair;
- clothing;
- shoes;
- proper hands/fingers;
- authored UV/textures/materials;
- physically coherent lighting and shadows;
- premium camera framing;
- postprocessing only where it improves the image;
- acceptable browser performance.

Definition of Done: Juanma can look at the character and approve that it is in a different visual category from the legacy PAINT crew.

### Slice 2 — Rig contract

Integrate/normalize the same asset around a real skeleton.

Required runtime facts:
- SkinnedMesh present;
- Skeleton present;
- semantic bone map available;
- hips/spine/chest/neck/head;
- shoulders/arms/hands;
- fingers where available;
- thighs/legs/feet;
- eye/jaw bones or expression fallback where available.

Offline donor pipeline candidate:

`Blender -> Rigify -> Rigodotify -> GLB/VRM -> Three.js`

Runtime interoperability candidates:
- @pixiv/three-vrm humanoid mapping;
- Three.js Skeleton/AnimationMixer;
- SkeletonUtils retargeting where appropriate.

Definition of Done: skeleton is inspectable, bone map is deterministic and an animation can drive the avatar without manual per-frame limb rotations.

### Slice 3 — Base motion

Only:
- idle;
- walk;
- stop;
- turn.

Do not start hand IK, painting, ladders or pulling yet.

Definition of Done: clean transitions, stable feet, plausible body weight and no obvious retargeting breakage.

### Slice 4 — Body intelligence

Only after Slice 3 is approved:
- lookAt;
- head/eye aim;
- reach;
- wrist orientation;
- grab/release;
- hand socket/tool socket.

Definition of Done: avatar can visually discover and acquire a target object without the legacy procedural puppet behavior.

### Slice 5 — Hero interaction

Single benchmark sequence:

`see tool -> look -> reach -> grab -> walk to artwork -> paint -> finish -> step back -> inspect`

Reuse PAINT semantic target generation later; do not copy its primitive limb solver as the final IK solution.

Definition of Done: one continuous believable sequence, locally reproducible.

## Donor map

### PRIMARY / candidate primary

- M3-org/CharacterStudio — modular avatar architecture, GLB/VRM workflow, asset composition, optimization.
- Rigify + Juanmaes83/Rigodotify — offline rig authoring / game skeleton normalization.
- Three.js — production browser runtime.
- @pixiv/three-vrm — humanoid interoperability, look-at/expressions where useful.

### MOTION DONORS

- Cat's Godot 4 Modular Souls-like Template — locomotion/root-motion/state-machine knowledge; do not migrate runtime to Godot.
- Mixamo-compatible clips — initial motion source where licensing/use case allows.

### SPECIALIZED DONORS

- closed-chain-ik-js — advanced multi-contact constraints, experimental.
- threejs-procedural-spider — two-bone/foot planting/support-surface concepts, especially for non-human characters.
- BVHEcctrl — optional locomotion/collision reference.

### REFERENCE ONLY

- three.ws — architecture reference only. Its 2026 repository license is proprietary/all-rights-reserved; do not copy or adapt its code without permission.

## Common humanoid semantic contract — draft

- ROOT
- PELVIS
- SPINE_01
- SPINE_02
- CHEST
- NECK
- HEAD
- CLAVICLE_L / CLAVICLE_R
- UPPER_ARM_L / UPPER_ARM_R
- LOWER_ARM_L / LOWER_ARM_R
- HAND_L / HAND_R
- UPPER_LEG_L / UPPER_LEG_R
- LOWER_LEG_L / LOWER_LEG_R
- FOOT_L / FOOT_R
- TOE_L / TOE_R

Optional:
- EYE_L / EYE_R
- JAW
- finger chains

Virtual targets/sockets:
- HAND_L_SOCKET
- HAND_R_SOCKET
- TOOL_GRIP_PRIMARY
- TOOL_GRIP_SECONDARY
- TOOL_WORK_ENDPOINT
- LOOK_TARGET
- FOOT_L_TARGET
- FOOT_R_TARGET

## SMART acceptance target

Specific: one premium humanoid only.

Measurable: real skinned asset + premium visual approval + deterministic skeleton map + idle/walk/stop/turn.

Achievable: reuse donor capabilities instead of inventing the entire avatar stack.

Relevant: directly resolves the visual/movement blocker in PAINT-YOUR-LOGO-WALL.

Time-boxed by slice: no later slice begins until the current one has evidence and a checkpoint.

## Explicit non-goals for Prototype 01

- no six-character family;
- no final art direction for every archetype;
- no Godot migration;
- no Unreal/Unity migration;
- no full PAINT port;
- no complex climbing/pulling/two-hand closed-chain system;
- no premature engine rewrite.

## Immediate next action

Run the upstream CharacterStudio fork locally, install its default/sample assets, identify the highest-quality existing rigged avatar that already works in its runtime, and use that asset as the first visual-ceiling baseline. Only after seeing that baseline should we decide whether to replace the body with an MPFB/MakeHuman/artist-authored base.
