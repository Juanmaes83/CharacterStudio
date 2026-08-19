import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { QUATERNIUS_BASELINE } from "./QuaterniusMotionSource"
import { QUATERNIUS_RIG_MAP } from "./QuaterniusRigMap"

const manifestPath = path.join(process.cwd(), "public/vendor/quaternius-u-a-l/manifest.json")
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"))
const clipNames = new Set(manifest.animations.map((animation) => animation.name))

describe("Quaternius donor baseline", () => {
  it("is pinned to the audited donor commit and CC0 license", () => {
    expect(manifest.source.donorCommit).toBe("e24c23cf2a1323488a3faa226ea7ea21f644b73e")
    expect(manifest.source.license).toBe("CC0-1.0")
    expect(manifest.immutableSourcePolicy).toBe(true)
  })

  it("contains every baseline motion used by Character 2027", () => {
    for (const clipName of Object.values(QUATERNIUS_BASELINE)) {
      expect(clipNames.has(clipName), `missing donor clip ${clipName}`).toBe(true)
    }
  })

  it("contains the human hinge body chain in the exact donor rig map", () => {
    expect(QUATERNIUS_RIG_MAP["DEF-hips"]).toBe("hips")
    expect(QUATERNIUS_RIG_MAP["DEF-thigh.L"]).toBe("leftUpperLeg")
    expect(QUATERNIUS_RIG_MAP["DEF-shin.L"]).toBe("leftLowerLeg")
    expect(QUATERNIUS_RIG_MAP["DEF-foot.L"]).toBe("leftFoot")
    expect(QUATERNIUS_RIG_MAP["DEF-upper_arm.L"]).toBe("leftUpperArm")
    expect(QUATERNIUS_RIG_MAP["DEF-forearm.L"]).toBe("leftLowerArm")
    expect(QUATERNIUS_RIG_MAP["DEF-hand.L"]).toBe("leftHand")
  })
})
