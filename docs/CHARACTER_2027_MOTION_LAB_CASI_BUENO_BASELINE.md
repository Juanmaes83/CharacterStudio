# CHARACTER 2027 — MOTION LAB “CASI BUENO” BASELINE

## Status

HUMAN-VALIDATED BASELINE — FROZEN

This document freezes the Motion Lab version reviewed by Juanma on 2026-08-19 as the current **“CASI BUENO”** visual baseline.

## Exact freeze

- Repository: `Juanmaes83/CharacterStudio`
- Source branch at freeze: `agent/character-2027-production-close-01`
- Frozen branch: `agent/character-2027-motion-baseline-casi-bueno`
- Frozen commit: `695c3e0c96bd28e44f7cc251411535161a8386b0`
- Lab route: `/motion-lab`

`agent/character-2027-motion-baseline-casi-bueno` must remain unchanged unless a deliberate new baseline is approved after visual review.

## Human acceptance scope

The baseline is accepted as a practical starting point, not as a finished motion system.

Known P0 problems explicitly left open:

- `WALK_V2` is not yet production-grade locomotion.
- Social / guidance actions are inconsistent.
- `SIT_SOFA` is not yet a reliable complete sit interaction.
- The action referred to as “GROK” in review still needs exact historical/code identification before modification.

All other currently demonstrated motions are accepted **for now** and must not be casually replaced while solving those P0 issues.

## Governance rule

Do not modify `main` during this closure loop.

Required iteration loop:

1. Human visual QA.
2. Technical diagnosis.
3. Proposed change.
4. Human approval.
5. Implementation in an isolated branch.
6. Technical + visual validation.
7. Review URL / local route.
8. Merge only after human approval.

## Architecture decision

The Motion Lab is a test client, not the product API.

Target architecture:

```text
MOTION LAB ─────────────┐
                       │
COSTA BLANCA WORLDS ───┼─> CharacterActionAPI -> Character Runtime -> Motion / IK / Interaction -> Avatar
                       │
OTHER WORLDS ──────────┘
```

The lab must stop manipulating `MotionController.navigation`, actions and interaction sequencing directly. Those operations are exposed through `CharacterActionAPI` so the same character runtime can be reused by worlds without importing the lab UI.
