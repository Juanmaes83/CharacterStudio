# COSTA BLANCA WORLDS — CHARACTER 2027 HANDOFF

## Status

This document is the integration handoff for using the current Character 2027 runtime from Costa Blanca Worlds.

The current visual baseline is **CASI BUENO**. It is intentionally not a claim that all motions are production-perfect.

Known motions that should be treated as **experimental / not preferred for final UX yet**:

- `WALK_V2`
- Social / Guidance actions (`WAVE`, `GOODBYE`, `POINT`, `NOD`, `WELCOME`, `AFTER_YOU`)
- `SIT_SOFA`
- Historical action referred to as `GROK` still needs exact identification

Other current motions may be used provisionally where visually acceptable.

## Source location

Repository:

`Juanmaes83/CharacterStudio`

Integration branch:

`agent/character-2027-action-api-01`

Human-approved frozen visual baseline:

`agent/character-2027-motion-baseline-casi-bueno`

Frozen commit:

`695c3e0c96bd28e44f7cc251411535161a8386b0`

Reference lab route:

`/motion-lab`

The lab is a test client only. Costa Blanca Worlds should **not import or reproduce the Motion Lab UI**.

## Runtime boundary

Use:

`src/character2027/api/CharacterActionAPI.js`

Architecture:

```text
COSTA BLANCA WORLDS
        ↓
CharacterActionAPI
        ↓
MotionController
        ↓
Motion / IK / Interaction
        ↓
Avatar
```

Costa Blanca Worlds should call the public API instead of manipulating `MotionController.navigation`, AnimationMixer actions, bones, or IK directly.

## Integration is optional

The Character 2027 runtime is a capability available to Costa Blanca Worlds, not a mandatory dependency for every world feature.

Costa Blanca may initially integrate:

- avatar loading/rendering
- idle behaviour
- a small allow-list of accepted actions
- selected object interactions

while leaving experimental motions disabled until they are visually approved.

## Public API

### Direct avatar action

```js
character.perform("JUMP")
character.perform("CROUCH")
character.perform("KNEEL")
```

Use `perform()` for actions that do not require a world object or target descriptor.

### Move in the world

```js
character.moveTo([x, y, z], {
  label: "terrace"
})
```

### Stop

```js
character.stop()
```

### Turn toward something

```js
character.turnTo(targetPosition)
```

### Look at something / someone

```js
character.lookAt(targetPosition)
```

### Semantic world interaction

```js
character.interact("PICK_UP_PHONE", phoneDescriptor)
character.interact("PICK_UP_CUP", coffeeDescriptor)
character.interact("SIT_SOFA", sofaDescriptor)
```

`SIT_SOFA` exists but is currently visually experimental and should not be presented as final.

### Serializable command entry point

```js
character.execute({
  type: "perform",
  action: "JUMP"
})

character.execute({
  type: "moveTo",
  target: [4.2, 0, -1.8],
  options: { label: "terrace" }
})
```

Supported command types:

- `perform`
- `moveTo`
- `stop`
- `turnTo`
- `lookAt`
- `interact`

## Two distinct command families

Costa Blanca Worlds should keep these concepts separate.

### A. User / agent-selected avatar actions

These are actions the user, UI, controller or future natural-language layer can request directly.

Examples:

- walk / move to a point
- stop
- turn
- look at
- jump
- crouch
- kneel
- wave (experimental)
- nod (experimental)
- point (experimental)

Example intent:

`Go to the terrace and look at the sea.`

Possible orchestration:

```js
character.moveTo(terracePoint, {
  onArrive: () => character.lookAt(seaPoint)
})
```

These commands are chosen dynamically by the user/system.

### B. World-defined contextual interactions

These are predefined behaviours attached to known objects or situations in the world.

Examples:

- sit on a specific sofa
- pick up a specific coffee cup
- pick up a phone
- open a door
- press a doorbell
- knock on a door
- lean on a wall

The WORLD owns the semantic target and geometry. The CHARACTER owns the movement/action execution.

Example sofa descriptor:

```js
const sofaDescriptor = {
  approachPoint: sofa.userData.approachPoint,
  lookAt: sofa.userData.lookAt,
  seatPoint: sofa.userData.seatPoint,
  exitPoint: sofa.userData.exitPoint
}

character.interact("SIT_SOFA", sofaDescriptor)
```

The current API requires at minimum:

```js
{
  approachPoint,
  lookAt
}
```

Future interaction descriptors may also expose anchors such as:

- `seatPoint`
- `gripPoint`
- `secondaryGripPoint`
- `handlePoint`
- `footLeft`
- `footRight`
- `surfaceNormal`
- `exitPoint`

Those anchors are for contact/IK adaptation and should remain world/object data, not hard-coded into generic avatar commands.

## Recommended Costa Blanca integration policy

Start with an allow-list instead of exposing every current lab button.

Suggested first integration:

```js
const ALLOWED_CHARACTER_ACTIONS = [
  "IDLE_V2",
  "JUMP",
  "CROUCH",
  "STEP_UP",
  "STEP_DOWN",
  "STAIRS_UP",
  "STAIRS_DOWN",
  "LADDER_UP",
  "LADDER_DOWN",
  "KNEEL"
]
```

The exact allow-list should follow human visual QA.

Keep these behind an experimental flag for now:

```js
const EXPERIMENTAL_CHARACTER_ACTIONS = [
  "WALK_V2",
  "WAVE",
  "GOODBYE",
  "POINT",
  "NOD",
  "WELCOME",
  "AFTER_YOU",
  "SIT_SOFA"
]
```

## What Costa Blanca should NOT do

Do not:

- copy Motion Lab button logic into the world
- manipulate skeleton bones directly from world code
- manipulate AnimationMixer directly from world code
- create a second parallel character action API
- hard-code sofa/coffee/phone geometry into the generic character runtime
- depend on experimental social/sit motions for core UX

## Current objective

The goal of this handoff is not to force full Character 2027 adoption now.

The goal is to make the avatar runtime available as a reusable world capability with a clear integration boundary, while the motion branch can continue improving specific actions independently.

This allows Costa Blanca Worlds to integrate the character architecture now without waiting for every motion to be perfect.
