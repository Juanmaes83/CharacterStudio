import * as THREE from "three"
import { QUATERNIUS_RIG_MAP, findTargetBone } from "./QuaterniusRigMap"

const CORE = [
  "hips", "spine", "chest", "neck", "head",
  "leftUpperArm", "leftLowerArm", "leftHand",
  "rightUpperArm", "rightLowerArm", "rightHand",
  "leftUpperLeg", "leftLowerLeg", "leftFoot",
  "rightUpperLeg", "rightLowerLeg", "rightFoot",
]

function sourceNode(root, name) {
  return root?.getObjectByName(name) || null
}

function cloneQuat(q) {
  return new THREE.Quaternion(q.x, q.y, q.z, q.w)
}

function cloneVec(v) {
  return new THREE.Vector3(v.x, v.y, v.z)
}

function snapshotPair(sourceRoot, targetRoot, sourceName, canonicalName) {
  const source = sourceNode(sourceRoot, sourceName)
  const target = findTargetBone(targetRoot, canonicalName)
  if (!source || !target) return null

  sourceRoot.updateMatrixWorld(true)
  targetRoot.updateMatrixWorld(true)

  const sourceWorld = source.getWorldQuaternion(new THREE.Quaternion())
  const targetWorld = target.getWorldQuaternion(new THREE.Quaternion())
  // Maps a rotation expressed in donor bone-local coordinates into the target
  // bone-local basis. This is the piece the previous retarget path omitted.
  const basis = targetWorld.clone().invert().multiply(sourceWorld)

  return {
    source,
    target,
    sourceRestLocal: cloneQuat(source.quaternion),
    targetRestLocal: cloneQuat(target.quaternion),
    sourceRestPosition: cloneVec(source.position),
    targetRestPosition: cloneVec(target.position),
    basis,
    basisInverse: basis.clone().invert(),
  }
}

function ensureQuaternionContinuity(values) {
  const previous = new THREE.Quaternion()
  const current = new THREE.Quaternion()
  let hasPrevious = false
  for (let i = 0; i < values.length; i += 4) {
    current.fromArray(values, i)
    if (hasPrevious && previous.dot(current) < 0) {
      values[i] *= -1
      values[i + 1] *= -1
      values[i + 2] *= -1
      values[i + 3] *= -1
      current.fromArray(values, i)
    }
    previous.copy(current)
    hasPrevious = true
  }
}

function getHipsScale(sourcePair, targetPair) {
  if (!sourcePair || !targetPair) return 1
  const s = sourcePair.source.getWorldPosition(new THREE.Vector3())
  const t = targetPair.target.getWorldPosition(new THREE.Vector3())
  const sr = sourcePair.sourceRootPosition || new THREE.Vector3()
  const tr = targetPair.targetRootPosition || new THREE.Vector3()
  const sourceHeight = Math.max(Math.abs(s.y - sr.y), 1e-4)
  const targetHeight = Math.max(Math.abs(t.y - tr.y), 1e-4)
  return targetHeight / sourceHeight
}

export function buildRetargetPlan(sourceRoot, targetRoot) {
  if (!sourceRoot || !targetRoot) throw new Error("Retarget plan requires source and target roots")
  sourceRoot.updateMatrixWorld(true)
  targetRoot.updateMatrixWorld(true)

  const pairs = new Map()
  for (const [sourceName, canonicalName] of Object.entries(QUATERNIUS_RIG_MAP)) {
    const pair = snapshotPair(sourceRoot, targetRoot, sourceName, canonicalName)
    if (pair) pairs.set(sourceName, pair)
  }

  const sourceRootPosition = sourceRoot.getWorldPosition(new THREE.Vector3())
  const targetRootPosition = targetRoot.getWorldPosition(new THREE.Vector3())
  const hipsPair = pairs.get("DEF-hips")
  if (hipsPair) {
    hipsPair.sourceRootPosition = sourceRootPosition
    hipsPair.targetRootPosition = targetRootPosition
  }

  const mappedCanonical = new Set([...pairs.values()].map((pair) => {
    const entry = Object.entries(QUATERNIUS_RIG_MAP).find(([sourceName]) => pairs.get(sourceName) === pair)
    return entry?.[1]
  }).filter(Boolean))

  return {
    pairs,
    hipsScale: getHipsScale(hipsPair, hipsPair),
    coreMissing: CORE.filter((name) => !mappedCanonical.has(name)),
    mappedBones: pairs.size,
  }
}

export function retargetQuaterniusClip(sourceRoot, sourceClip, targetRoot) {
  if (!sourceClip) throw new Error("Missing donor AnimationClip")
  const plan = buildRetargetPlan(sourceRoot, targetRoot)
  if (!plan.pairs.size) throw new Error("Target rig has no compatible humanoid bones")

  const output = []
  const unmapped = new Set()
  const qSource = new THREE.Quaternion()
  const qDelta = new THREE.Quaternion()
  const qTargetDelta = new THREE.Quaternion()
  const qOut = new THREE.Quaternion()
  const vSource = new THREE.Vector3()
  const vDelta = new THREE.Vector3()
  const vOut = new THREE.Vector3()

  for (const original of sourceClip.tracks) {
    const splitAt = original.name.lastIndexOf(".")
    if (splitAt < 1) continue
    const sourceName = original.name.slice(0, splitAt)
    const property = original.name.slice(splitAt + 1)
    const pair = plan.pairs.get(sourceName)
    if (!pair) {
      unmapped.add(sourceName)
      continue
    }

    if (original instanceof THREE.QuaternionKeyframeTrack && property === "quaternion") {
      const values = original.values.slice()
      const inverseSourceRest = pair.sourceRestLocal.clone().invert()
      for (let i = 0; i < values.length; i += 4) {
        qSource.fromArray(values, i).normalize()
        // Donor absolute local rotation -> donor rest-relative delta.
        qDelta.copy(inverseSourceRest).multiply(qSource).normalize()
        // Express the exact donor delta in the target bone's local basis.
        qTargetDelta.copy(pair.basis).multiply(qDelta).multiply(pair.basisInverse).normalize()
        // Reapply the target avatar's own bind/rest rotation.
        qOut.copy(pair.targetRestLocal).multiply(qTargetDelta).normalize().toArray(values, i)
      }
      ensureQuaternionContinuity(values)
      output.push(new THREE.QuaternionKeyframeTrack(
        `${pair.target.name}.quaternion`,
        original.times.slice(),
        values,
        original.getInterpolation(),
      ))
      continue
    }

    // Preserve only hips translation. Limb positions belong to the target rig and
    // must not be overwritten by donor proportions.
    if (original instanceof THREE.VectorKeyframeTrack && property === "position" && sourceName === "DEF-hips") {
      const values = original.values.slice()
      for (let i = 0; i < values.length; i += 3) {
        vSource.fromArray(values, i)
        vDelta.copy(vSource).sub(pair.sourceRestPosition).multiplyScalar(plan.hipsScale)
        vOut.copy(pair.targetRestPosition).add(vDelta).toArray(values, i)
      }
      output.push(new THREE.VectorKeyframeTrack(
        `${pair.target.name}.position`,
        original.times.slice(),
        values,
        original.getInterpolation(),
      ))
    }
  }

  if (!output.length) throw new Error(`No compatible tracks for ${sourceClip.name}`)

  return {
    clip: new THREE.AnimationClip(sourceClip.name, sourceClip.duration, output),
    report: {
      donorClip: sourceClip.name,
      sourceTracks: sourceClip.tracks.length,
      targetTracks: output.length,
      mappedBones: plan.mappedBones,
      coreMissing: plan.coreMissing,
      hipsScale: plan.hipsScale,
      unmapped: [...unmapped],
      sourceKeyframesModified: false,
      targetRestPosePreserved: true,
      basisCorrected: true,
    },
  }
}
