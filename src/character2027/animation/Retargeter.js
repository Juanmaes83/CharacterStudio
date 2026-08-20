import * as THREE from "three"
import { resolveTargetBoneName, normalizeMixamoBoneName, inspectHumanoid } from "../rig/BoneMap"

const _restRotationInverse = new THREE.Quaternion()
const _parentRestWorldRotation = new THREE.Quaternion()
const _quat = new THREE.Quaternion()
const _vec = new THREE.Vector3()

function findSourceBone(sourceRoot, rawName) {
  return (
    sourceRoot.getObjectByName(rawName) ||
    sourceRoot.getObjectByName(normalizeMixamoBoneName(rawName)) ||
    sourceRoot.getObjectByName(rawName.replace("mixamorig", "mixamorig:"))
  )
}

function getTargetHipsHeight(targetRoot) {
  const hips = targetRoot.getObjectByName("hips")
  if (!hips) return 1
  const hipsY = hips.getWorldPosition(_vec).y
  const rootY = targetRoot.getWorldPosition(_vec).y
  return Math.max(Math.abs(hipsY - rootY), 0.0001)
}

function getSourceHipsHeight(sourceRoot) {
  const hips = findSourceBone(sourceRoot, "mixamorigHips") || sourceRoot.getObjectByName("hips")
  if (!hips) return 1
  const hipsY = hips.getWorldPosition(_vec).y
  const rootY = sourceRoot.getWorldPosition(_vec).y
  return Math.max(Math.abs(hipsY - rootY), 0.0001)
}

export function retargetClipToCharacter(sourceRoot, sourceClip, targetRoot) {
  if (!sourceRoot || !sourceClip || !targetRoot) {
    throw new Error("Retarget requires source root, source clip and target root")
  }

  sourceRoot.updateMatrixWorld(true)
  targetRoot.updateMatrixWorld(true)

  const targetInfo = inspectHumanoid(targetRoot)
  if (!targetInfo.firstSkinnedMesh) {
    throw new Error("Target contains no SkinnedMesh")
  }

  const targetBoneNames = targetInfo.boneNames
  const sourceHipsHeight = getSourceHipsHeight(sourceRoot)
  const targetHipsHeight = getTargetHipsHeight(targetRoot)
  const hipsScale = targetHipsHeight / sourceHipsHeight
  const tracks = []
  const missingSource = new Set()
  const unmapped = new Set()

  for (const originalTrack of sourceClip.tracks) {
    const dot = originalTrack.name.lastIndexOf(".")
    if (dot === -1) continue

    const rawBoneName = originalTrack.name.slice(0, dot)
    const propertyName = originalTrack.name.slice(dot + 1)
    const targetBoneName = resolveTargetBoneName(rawBoneName, targetBoneNames)
    if (!targetBoneName) {
      unmapped.add(rawBoneName)
      continue
    }

    const sourceBone = findSourceBone(sourceRoot, rawBoneName)

    if (originalTrack instanceof THREE.QuaternionKeyframeTrack) {
      if (!sourceBone || !sourceBone.parent) {
        missingSource.add(rawBoneName)
        continue
      }

      sourceBone.getWorldQuaternion(_restRotationInverse).invert()
      sourceBone.parent.getWorldQuaternion(_parentRestWorldRotation)
      const values = originalTrack.values.slice()

      for (let i = 0; i < values.length; i += 4) {
        _quat.fromArray(values, i)
        _quat.premultiply(_parentRestWorldRotation).multiply(_restRotationInverse)
        _quat.toArray(values, i)
      }

      tracks.push(
        new THREE.QuaternionKeyframeTrack(
          `${targetBoneName}.${propertyName}`,
          originalTrack.times.slice(),
          values,
        ),
      )
      continue
    }

    if (originalTrack instanceof THREE.VectorKeyframeTrack && targetBoneName === "hips") {
      const values = originalTrack.values.slice()
      for (let i = 0; i < values.length; i += 3) {
        values[i] *= hipsScale
        values[i + 1] *= hipsScale
        values[i + 2] *= hipsScale
      }
      tracks.push(
        new THREE.VectorKeyframeTrack(
          `${targetBoneName}.${propertyName}`,
          originalTrack.times.slice(),
          values,
        ),
      )
    }
  }

  if (tracks.length === 0) {
    throw new Error("No compatible animation tracks were produced")
  }

  return {
    clip: new THREE.AnimationClip(sourceClip.name || "retargeted", sourceClip.duration, tracks),
    report: {
      sourceTracks: sourceClip.tracks.length,
      targetTracks: tracks.length,
      hipsScale,
      unmapped: [...unmapped],
      missingSource: [...missingSource],
    },
  }
}
