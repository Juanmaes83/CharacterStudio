# Character 2027 — Final Closure / Handoff

## Status

Final closure candidate after human Motion Lab review on 2026-08-19.

Human-validated groups before the last WALK_V2 Lab correction:

- TURN_LEFT_V2 — accepted.
- TURN_RIGHT_V2 — accepted.
- JUMP — accepted.
- Vertical / Terrain — accepted after semantic binding work.
- Social / Guidance — accepted after Social V3 ownership fix.
- Universal Interactions / Semantic Benchmarks — accepted for current scope.
- Locomotion LEFT/RIGHT targets — accepted.

Final remaining issue found by human QA:

- The top-level WALK_V2 button animated the gait in place but did not translate the character from A to B.

Root cause:

- MotionLab routed WALK_V2 through `CharacterActionAPI.perform("WALK_V2")`.
- `perform()` correctly plays a motion clip but does not own world-space navigation.
- Working locomotion uses `CharacterActionAPI.moveTo(target)` -> `MotionController.walkTo()` -> `_updateNavigation()` -> `root.position` displacement.

Final correction:

- MotionLab now treats the WALK_V2 button as a forward locomotion benchmark and routes it through `moveTo()`.
- The WALK_V2 clip remains an internal gait asset; its public/world semantic is movement toward a world-space target.
- `perform("WALK_V2")` was intentionally NOT changed globally, so the public API contract remains clean and backwards compatible.

## Integration rule for Costa Blanca Worlds

Do not import MotionLab or simulate its buttons.

Use the reusable Character Action API:

```js
character.moveTo(target, options)
character.stop()
character.turnTo(target, options)
character.lookAt(target, options)
character.perform("WAVE", options)
character.interact("SIT_SOFA", descriptor, options)
```

For locomotion, NEVER use `perform("WALK_V2")` as the semantic world command. Use `moveTo(target)`.

Runtime architecture:

```text
WORLD / MOTION LAB / OTHER CLIENT
        ↓
CharacterActionAPI
        ↓
MotionController
        ↓
Animation + navigation + contact/adaptation IK
        ↓
Avatar root + humanoid bones
```

## Ownership rules learned and frozen

### Locomotion

Animation owns gait biomechanics. Navigation owns root displacement, orientation, arrival and stop.

### Social

Full authored clips own social choreography. IK must not replace the primary shoulder/elbow/body gesture. Target adaptation may be added only as a secondary layer where semantically required.

### Terrain

Terrain actions are semantic world interactions, not isolated in-place poses. STEP, STAIRS and LADDER require real world geometry, target points and root trajectories.

### Universal interactions

World owns object geometry/descriptors. Character owns execution. Descriptors may contain approach, look/contact/grip/seat/surface data as needed.

## Current branches

- Frozen original API handoff: `agent/character-2027-action-api-01`
- Social checkpoint: `agent/character-2027-social-fix-01`
- Final closure candidate: `agent/character-2027-terrain-semantic-01`

The Costa Blanca integration line may continue consuming the stable CharacterActionAPI contract. Internal Character 2027 improvements must preserve that facade unless an explicit migration is documented.

## Validation

Required closure gates:

1. unit tests / human hinge tests
2. full test suite
3. production build
4. Playwright Social browser verification
5. Playwright Terrain + WALK_V2 world-space displacement verification
6. final human visual QA in `/motion-lab`

Automated validation is evidence of wiring/runtime correctness, not a substitute for human visual approval.

## Do not regress

Do not reintroduce:

- synthetic second gait over WALK/WALK_V2;
- social IK replacing full gesture animation;
- STEP/STAIRS/LADDER without world-space geometry;
- direct World manipulation of MotionController navigation internals;
- virtual clicking/importing of MotionLab from Costa Blanca Worlds.
