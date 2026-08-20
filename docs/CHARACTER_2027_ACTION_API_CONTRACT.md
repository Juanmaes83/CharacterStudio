# CHARACTER 2027 — CharacterActionAPI Contract

## Purpose

`CharacterActionAPI` is the stable boundary between a WORLD/client and the Character 2027 runtime.

Clients must not manipulate `MotionController.navigation`, animation actions, IK targets or semantic interaction sequencing directly.

```text
WORLD / MOTION LAB / AGENT INTENT
              ↓
      CharacterActionAPI
              ↓
       MotionController
              ↓
   Motion + IK + Interaction
              ↓
            Avatar
```

## Public commands

### `perform(action, options?)`

Play a registered character action.

```js
character.perform("WAVE")
character.perform("NOD")
character.perform("CROUCH")
character.perform("JUMP")
```

Use for direct, already-registered character actions.

### `moveTo(target, options?)`

Move the avatar toward a world-space target.

```js
character.moveTo([4.2, 0, -1.8], { label: "terrace" })
```

Current defaults intentionally preserve the human-approved Motion Lab baseline. Locomotion quality can be improved internally later without changing the world-facing command.

### `stop()`

Stop current navigation using the best registered stop/idle state.

```js
character.stop()
```

### `turnTo(target, options?)`

Turn the avatar toward a world-space point.

```js
character.turnTo(person.position)
```

### `lookAt(target, options?)`

Target-aware head/body look behaviour.

```js
character.lookAt(person.headPosition)
```

### `interact(action, targetDescriptor?, options?)`

Execute a semantic world interaction. The world provides geometry/context; the character runtime owns movement/action execution.

```js
character.interact("SIT_SOFA", sofaInteraction)
character.interact("PICK_UP_PHONE", phoneInteraction)
```

Minimum interaction target contract in this slice:

```js
{
  approachPoint: Vector3,
  lookAt: Vector3
}
```

Additional contact anchors can be provided by world-specific target descriptors and consumed by IK/post-processors.

### `execute(command)`

Serializable command entry point for agent/user-intent orchestration.

```js
character.execute({ type: "perform", action: "WAVE" })
character.execute({ type: "moveTo", target: [1, 0, 2], options: { label: "sofa" } })
character.execute({ type: "interact", action: "PICK_UP_PHONE", target: phoneInteraction })
```

Supported command types:

- `perform`
- `moveTo`
- `stop`
- `turnTo`
- `lookAt`
- `interact`

## Command ownership

Two classes of commands are expected.

### User / agent generated character intent

Examples:

- walk
- stop
- turn
- wave
- nod
- point
- crouch
- jump
- kneel
- look at a person/object

A higher intent layer can translate natural language such as:

```text
"Ve a la terraza y saluda a Sarah"
```

into:

```js
character.moveTo(terrace.approachPoint, { label: "terrace" })
character.lookAt(sarah.headPosition)
character.perform("WAVE")
```

### WORLD-defined semantic interactions

Examples:

- sit on sofa/chair
- pick up coffee
- pick up phone
- open door
- press doorbell
- knock door
- lean on wall
- use laptop

These actions require world geometry, anchors or object semantics and should be invoked with `interact(...)` rather than encoded as hardwired Motion Lab behaviour.

## Current benchmark action IDs

Motion Foundation V2 currently exposes these groups:

### Core locomotion / state

- `IDLE_V2`
- `WALK_V2`
- `STOP_V2`
- `TURN_LEFT_V2`
- `TURN_RIGHT_V2`

### Vertical / terrain

- `JUMP`
- `CROUCH`
- `STEP_UP`
- `STEP_DOWN`
- `STAIRS_UP`
- `STAIRS_DOWN`
- `LADDER_UP`
- `LADDER_DOWN`

### Social / guidance

- `WAVE`
- `GOODBYE`
- `POINT`
- `NOD`
- `LOOK_AT`
- `WELCOME`
- `AFTER_YOU`

### Semantic interactions

- `PRESS_DOORBELL`
- `PICK_UP_CUP`
- `SIT_SOFA`
- `LEAN_WALL`
- `KNOCK_DOOR`
- `PICK_UP_PHONE`
- `PICK_UP_MAGAZINE`
- `OPEN_DOOR`

## Important limitation

This slice introduces the API boundary only. It deliberately does **not** claim that every underlying action is production-ready.

Known unresolved motion issues remain tracked by the frozen “CASI BUENO” baseline, especially `WALK_V2`, social/guidance consistency and `SIT_SOFA`.
