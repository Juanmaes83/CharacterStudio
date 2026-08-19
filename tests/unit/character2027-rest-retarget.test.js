import { describe, expect, it } from "vitest"
import * as THREE from "three"
import { buildRetargetPlan, retargetQuaterniusClip } from "../../src/character2027/animation/RestPoseRetargeter"

function bone(name, position = [0, 0, 0], rotation = [0, 0, 0]) {
  const node = new THREE.Bone()
  node.name = name
  node.position.set(...position)
  node.rotation.set(...rotation)
  return node
}

function makePair() {
  const source = new THREE.Group()
  const sHips = bone("DEF-hips", [0, 1, 0])
  const sThigh = bone("DEF-thigh.L", [-0.1, -0.05, 0])
  const sShin = bone("DEF-shin.L", [0, -0.45, 0])
  const sFoot = bone("DEF-foot.L", [0, -0.42, 0.05])
  const sUpperArm = bone("DEF-upper_arm.L", [-0.22, 0.45, 0], [0, 0, Math.PI / 2])
  const sForearm = bone("DEF-forearm.L", [-0.35, 0, 0])
  const sHand = bone("DEF-hand.L", [-0.3, 0, 0])
  source.add(sHips)
  sHips.add(sThigh); sThigh.add(sShin); sShin.add(sFoot)
  sHips.add(sUpperArm); sUpperArm.add(sForearm); sForearm.add(sHand)

  const target = new THREE.Group()
  const tHips = bone("hips", [0, 1.2, 0], [0, 0.2, 0])
  const tThigh = bone("leftUpperLeg", [-0.12, -0.06, 0], [0.05, 0, 0.04])
  const tShin = bone("leftLowerLeg", [0, -0.55, 0], [-0.03, 0.02, 0])
  const tFoot = bone("leftFoot", [0, -0.5, 0.07])
  const tUpperArm = bone("leftUpperArm", [-0.26, 0.5, 0], [0.1, -0.15, 1.3])
  const tForearm = bone("leftLowerArm", [-0.42, 0, 0], [0.04, 0.08, -0.03])
  const tHand = bone("leftHand", [-0.34, 0, 0])
  target.add(tHips)
  tHips.add(tThigh); tThigh.add(tShin); tShin.add(tFoot)
  tHips.add(tUpperArm); tUpperArm.add(tForearm); tForearm.add(tHand)

  source.updateMatrixWorld(true)
  target.updateMatrixWorld(true)
  return { source, target, sForearm, tForearm, sShin, tShin }
}

function quatTrack(name, rest, delta) {
  const animated = rest.clone().multiply(delta).normalize()
  return new THREE.QuaternionKeyframeTrack(`${name}.quaternion`, [0, 1], [
    rest.x, rest.y, rest.z, rest.w,
    animated.x, animated.y, animated.z, animated.w,
  ])
}

describe("Character 2027 rest-pose retarget", () => {
  it("preserves target bind pose at donor frame zero", () => {
    const { source, target, sForearm, tForearm } = makePair()
    const clip = new THREE.AnimationClip("arm", 1, [quatTrack("DEF-forearm.L", sForearm.quaternion, new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), 0.7))])
    const { clip: out } = retargetQuaterniusClip(source, clip, target)
    const q = new THREE.Quaternion().fromArray(out.tracks[0].values, 0)
    expect(Math.abs(q.dot(tForearm.quaternion))).toBeGreaterThan(0.99999)
  })

  it("transfers a hinge delta through source-to-target rest basis instead of mirroring it", () => {
    const { source, target, sShin, tShin } = makePair()
    const delta = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.8)
    const clip = new THREE.AnimationClip("knee", 1, [quatTrack("DEF-shin.L", sShin.quaternion, delta)])
    const plan = buildRetargetPlan(source, target)
    const pair = plan.pairs.get("DEF-shin.L")
    const expectedDelta = pair.basis.clone().multiply(delta).multiply(pair.basisInverse).normalize()
    const expected = tShin.quaternion.clone().multiply(expectedDelta).normalize()
    const { clip: out } = retargetQuaterniusClip(source, clip, target)
    const actual = new THREE.Quaternion().fromArray(out.tracks[0].values, 4)
    expect(Math.abs(actual.dot(expected))).toBeGreaterThan(0.99999)
  })

  it("does not mutate donor keyframe arrays", () => {
    const { source, target, sForearm } = makePair()
    const track = quatTrack("DEF-forearm.L", sForearm.quaternion, new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.4))
    const before = Array.from(track.values)
    const clip = new THREE.AnimationClip("immutable", 1, [track])
    retargetQuaterniusClip(source, clip, target)
    expect(Array.from(track.values)).toEqual(before)
  })
})
