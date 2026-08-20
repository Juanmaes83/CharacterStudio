# START HERE — PROJECT REENTRY

Status: **MASTER TRANSVERSAL TEMPLATE / REENTRY DOCTRINE / NOT A PROJECT-SPECIFIC EXECUTION ROADMAP**

Purpose: this document is designed to be copied into interactive-world repositories so that, when a project is resumed after weeks or months, the next AI/person understands the architectural doctrine **before** investing time in implementation or visual polish.

This document does **not** replace the local project's canonical roadmap, contracts or execution logs. It is the reentry gate that tells the reader how to think, what to protect and what to read next.

---

## 0. REENTRY INSTRUCTION

Before changing code, visuals or architecture:

1. Read this file completely.
2. Identify the local project's canonical `START_HERE`, roadmap or authority document.
3. Read only the active domain/phase documentation needed for the task.
4. Inspect the current branch / PR / execution state before acting.
5. Do not reopen historical decisions unless new evidence requires it.

If this template conflicts with an explicit, newer, project-specific approved decision, the newer approved local authority wins. Record the conflict before acting; do not silently choose one.

---

# 1. ORGANISM RULE

The current visual representation of a project must **never be confused with the permanent organism of the project**.

Every project should be understood through four layers:

```text
DNA
= purpose / identity / product thesis / non-negotiable rules

BRAIN
= semantics / state / content / POIs / product logic / progress / continuity / meaning

SKELETON
= runtime / navigation / movement / collision / camera / interaction engine / pathfinding / anchors / authority boundaries

SKIN
= meshes / GLB / GLTF / materials / textures / vegetation / props / lighting / atmosphere / sound / post-processing / visual UI
```

The project may change SKIN dramatically while remaining the same organism.

The project must not lose DNA, BRAIN or SKELETON merely because its visual body evolves.

---

# 2. SNAKE-SKIN INVARIANT

Design all new work knowing that the current visual layer may be replaced later.

A valid future skin migration may replace:

- rendered geometry;
- models / meshes;
- materials / textures;
- vegetation;
- props;
- lighting;
- sky / environment;
- atmosphere;
- audio presentation;
- visual UI treatment;
- LOD / render strategy;
- art direction.

A skin migration must **not silently replace or corrupt**:

- semantic IDs;
- entity identity;
- world/product state;
- POI/progress meaning;
- authoritative transforms where they are part of world truth;
- navigation/collision contracts;
- interaction descriptors;
- approach/facing/contact anchors;
- camera authority;
- movement authority;
- FIRST/THIRD or equivalent presentation contracts;
- user continuity / saved state;
- product/business logic.

Conceptual example:

```text
BEFORE                         AFTER
HOUSE_027                      HOUSE_027
same semantic role             same semantic role
same POI relation              same POI relation
same interactions              same interactions
same navigation contract       same navigation contract
same anchors                   same anchors
procedural visual              premium GLB/PBR visual
```

The operation is **skin migration**, not world replacement.

---

# 3. CURRENT VISUALS ARE ALLOWED TO BE PROVISIONAL

Procedural geometry, low-poly assets, primitives and placeholders remain valuable for:

- blockout;
- semantic proxies;
- collision proxies;
- interaction testing;
- layout;
- authoring;
- debug;
- performance fallback;
- LOD;
- early UX validation.

They are **not automatically final art**.

Do not spend large amounts of time or money polishing a provisional layer when the underlying brain, skeleton, engine, usability or interaction model is still unstable.

Quality target during structural phases:

> **good enough to understand, navigate, interact and validate — not falsely final.**

---

# 4. PRIORITY RULE

Unless the local project explicitly proves otherwise, prioritize:

```text
1. DNA / PRODUCT THESIS
2. BRAIN / SEMANTICS / STATE
3. SKELETON / ENGINE / USABILITY
4. SKIN / FINAL VISUAL FIDELITY
```

This does not mean visual research must stop.

Allowed before final skinning:

- donor archaeology;
- asset-source research;
- material/light/atmosphere studies;
- isolated fidelity stones;
- visual binding experiments;
- performance budgets;
- provenance/license research.

Avoid mass visual production before structural gates are stable.

---

# 5. UNIVERSAL EXECUTION METHOD

Every major capability — Brain, Skeleton or Skin — follows the same lifecycle:

```text
0. FREEZE MOTHER BASELINE
        ↓
1. ARCHAEOLOGY
        ↓
2. QUARRY MAP / EXACT STONES
        ↓
3. ISOLATED SCULPTURE
        ↓
4. COMPATIBILITY GATE
        ↓
5. MINIMAL INTEGRATION SEAM
        ↓
6. POST-INTEGRATION SURGERY / PERSONALIZATION
        ↓
7. FUNCTIONAL + VISUAL + PERFORMANCE + REGRESSION VALIDATION
        ↓
8. HUMAN APPROVAL
        ↓
9. PROMOTE COMPLETE IMPLEMENTATION
```

Operational shorthand:

> **ARCHAEOLOGY → STONES → SCULPTURE → INTEGRATION → SURGERY/PERSONALIZATION → VALIDATION → PROMOTION**

Core rules:

- proven donor stone > reinventing from scratch;
- exact useful stone > importing an entire donor;
- reuse / adapt / minimal seam > parallel replacement system;
- integration comes before broad personalization;
- tests green do not automatically equal visual/product approval;
- human review remains required where experience or visual quality matters.

---

# 6. DONOR-FIRST RULE

Before building a capability from zero, ask:

1. Does this project already contain a partial version?
2. Does another project in the ecosystem contain a proven version?
3. Is there an external donor repo/example/source that already solves the hard part?
4. What is the **smallest exact stone** worth extracting?
5. What must explicitly **not** be copied?
6. What are the license/provenance constraints?

A donor is a quarry, not automatically a new mother architecture.

Do not replace a working mother system merely because a donor has a parallel implementation.

---

# 7. VISUAL DECOUPLING RULE

Business logic, semantics and interactions should not depend unnecessarily on a concrete visual asset.

Avoid patterns conceptually equivalent to:

```js
if (mesh.name === "villa_red_final_v7.glb") {
  // product logic
}
```

Prefer a separation conceptually equivalent to:

```js
entity.id = "PROPERTY_012"
entity.role = "PROPERTY"
entity.interactions = [...]
entity.visualBinding = "villa_variant_07"
```

Then `villa_variant_07` can change without destroying `PROPERTY_012`.

Visual filenames are representation details, not semantic identity.

---

# 8. SKIN-READINESS CHECK

When resuming a project, ask:

> **If we removed today's meshes/materials/visual assets, would the project still know what everything is and how it behaves?**

If YES, the architecture is probably skin-ready.

If NO, identify coupling before expanding the project.

Warning signs:

- POIs identified only by mesh names;
- interaction logic embedded inside a specific GLB hierarchy;
- collision and semantic identity inseparable from render meshes;
- camera behavior hardwired to one visual model;
- state stored inside presentation components;
- replacing an asset requires rewriting business rules;
- map/navigation logic depends on current decorative geometry;
- visual variants create duplicate world state.

Do not necessarily refactor everything immediately. Record the debt and protect new work from deepening it.

---

# 9. FUTURE VISUAL BINDING DIRECTION

Projects should trend toward a seam conceptually similar to:

```text
SEMANTIC ENTITY
  id
  role
  transform
  state
  interactions
  anchors
        │
        ▼
VISUAL BINDING
  asset / variant
  material profile
  LOD profile
  render flags
  visual anchors
        │
        ▼
CURRENT SKIN
```

The exact implementation may differ by project.

The invariant is the separation, not a mandatory class/file name.

---

# 10. ASSET / CODE PROVENANCE

Code donors and visual assets have separate legal/technical gates.

Before production adoption, record as applicable:

```text
source
creator / provider
license
attribution requirements
original format
processed format
semantic role
optimization history
triangle / texture budget
LOD policy
known restrictions
```

Do not assume:

- public repo = unrestricted reuse;
- paid asset = unlimited redistribution;
- visual inspiration = permission to copy code/assets;
- one file's license covers every third-party asset inside a donor.

---

# 11. PROJECT-SPECIFIC REENTRY BLOCK

When this master template is copied into a project, fill in this section and keep the universal doctrine above intact unless an ecosystem-wide decision formally changes it.

```text
PROJECT NAME:

PROJECT PURPOSE / DNA:

MOTHER / BASE RUNTIME:

CURRENT PRIORITY:

CURRENT ACTIVE PHASE:

BRAIN — local authority/capabilities:

SKELETON — local authority/capabilities:

SKIN — current status:

CURRENT SKIN CLASSIFICATION:
[ ] final-approved
[ ] candidate-final
[ ] provisional
[ ] blockout/proxy

LOCAL CANONICAL START_HERE:

LOCAL ACTIVE ROADMAP:

LOCAL ACTIVE EXECUTION LOG:

FROZEN / VALIDATED DONORS:

KNOWN SKIN-COUPLING DEBT:

DO NOT REOPEN / DO NOT TOUCH:

NEXT VALIDATION GATE:
```

Keep this block concise. It is a reentry snapshot, not a second roadmap.

---

# 12. WHAT TO READ AFTER THIS FILE

Do **not** read the entire repository documentation by default.

Preferred order:

```text
THIS REENTRY FILE
        ↓
LOCAL CANONICAL START_HERE
        ↓
LOCAL ACTIVE ROADMAP
        ↓
RELEVANT DOMAIN CONTRACT
        ↓
ACTIVE EXECUTION LOG
        ↓
DONOR ARCHAEOLOGY ONLY IF THE TASK NEEDS IT
```

Historical documentation is evidence, not active authority, unless the local project explicitly says otherwise.

---

# 13. DOCUMENTATION DISCIPLINE

Do not create a new document for every decision or commit.

Before creating documentation, ask:

1. Is there already a canonical document for this domain?
2. Can the decision be integrated there cleanly?
3. Is the new information a durable contract, or merely an execution note?
4. Will a new document create another competing authority?

Default:

> **UPDATE EXISTING CANONICAL DOCUMENT > CREATE NEW DOCUMENT**

New documents are justified when they capture:

- a genuinely new durable contract;
- a bounded donor archaeology artifact;
- an execution log for a meaningful phase;
- evidence that cannot be represented clearly elsewhere.

When a document becomes historical or superseded, mark it explicitly.

---

# 14. AI / AGENT BEHAVIOR ON REENTRY

Any AI/agent resuming the project must:

- preserve the mother/base unless explicitly authorized otherwise;
- identify current branch and active authority before writes;
- distinguish current facts from historical decisions;
- avoid reopening solved architecture without new evidence;
- separate Brain / Skeleton / Skin in its reasoning and implementation;
- treat current visuals as replaceable unless explicitly approved final;
- avoid large visual investment while structural gates are open;
- search for proven donor stones before rewriting;
- validate in isolation before integrating high-risk capabilities;
- preserve provenance and licenses;
- document only meaningful phase/status changes;
- never claim visual approval from compilation/tests alone.

---

# 15. HUMAN APPROVAL RULE

Visual fidelity, experiential quality and major integration promotion require human approval.

The AI may report:

- functional PASS;
- browser/runtime PASS;
- performance PASS;
- regression PASS;
- visual evidence READY FOR REVIEW.

It must not convert those automatically into:

> **FINAL VISUAL APPROVAL**

unless the responsible human explicitly gives that approval.

---

# 16. CORE MEMORY

When the project is resumed, remember this sentence:

> **Build the organism so well that it can change skin without losing its DNA, brain, bones, memory or movement.**

And this operational corollary:

> **Do not spend final-art effort on a skin that the architecture already expects to shed.**

---

## Template governance

This file is the **universal reentry template**. Project-specific copies may add their local reentry block and references, but should not silently weaken the organism/skin-migration doctrine.

If the doctrine itself evolves across the ecosystem, update the master first, then deliberately propagate the change to project copies when those projects are next touched. Do not mass-edit dormant projects merely to keep timestamps synchronized.