import { VRMRigMapMixamo } from "../../library/VRMRigMapMixamo"

export const REQUIRED_HUMANOID_BONES = [
  "hips",
  "spine",
  "chest",
  "neck",
  "head",
  "leftUpperArm",
  "leftLowerArm",
  "leftHand",
  "rightUpperArm",
  "rightLowerArm",
  "rightHand",
  "leftUpperLeg",
  "leftLowerLeg",
  "leftFoot",
  "rightUpperLeg",
  "rightLowerLeg",
  "rightFoot",
]

export function normalizeMixamoBoneName(name = "") {
  return name.replace(/^mixamorig:/, "mixamorig")
}

export function resolveTargetBoneName(sourceBoneName, targetBoneNames) {
  const normalized = normalizeMixamoBoneName(sourceBoneName)
  const mapped = VRMRigMapMixamo[normalized]
  if (mapped && targetBoneNames.has(mapped)) return mapped
  if (targetBoneNames.has(sourceBoneName)) return sourceBoneName
  if (targetBoneNames.has(normalized)) return normalized
  return null
}

function sameSkeletonLayout(a, b) {
  if (!a || !b || a.bones.length !== b.bones.length) return false
  for (let i = 0; i < a.bones.length; i += 1) {
    if (a.bones[i].name !== b.bones[i].name) return false
  }
  return true
}

export function unifyCompatibleSkeletons(root) {
  const meshes = []
  root?.traverse((node) => {
    if (node.isSkinnedMesh && node.skeleton) meshes.push(node)
  })

  if (meshes.length < 2) {
    return { skinnedMeshes: meshes.length, unifiedMeshes: 0, canonicalBoneCount: meshes[0]?.skeleton?.bones?.length || 0 }
  }

  const canonical = meshes[0].skeleton
  let unifiedMeshes = 0

  for (let i = 1; i < meshes.length; i += 1) {
    const mesh = meshes[i]
    if (!sameSkeletonLayout(canonical, mesh.skeleton)) continue
    mesh.skeleton = canonical
    unifiedMeshes += 1
  }

  canonical.pose()
  canonical.update()
  root.updateMatrixWorld(true)

  return {
    skinnedMeshes: meshes.length,
    unifiedMeshes,
    canonicalBoneCount: canonical.bones.length,
  }
}

export function inspectHumanoid(root) {
  const boneNames = new Set()
  let skinnedMeshCount = 0
  let firstSkinnedMesh = null

  root?.traverse((node) => {
    if (node.isBone) boneNames.add(node.name)
    if (node.isSkinnedMesh) {
      skinnedMeshCount += 1
      if (!firstSkinnedMesh) firstSkinnedMesh = node
      node.skeleton?.bones?.forEach((bone) => boneNames.add(bone.name))
    }
  })

  const missing = REQUIRED_HUMANOID_BONES.filter((name) => !boneNames.has(name))
  return {
    boneNames,
    boneCount: boneNames.size,
    skinnedMeshCount,
    firstSkinnedMesh,
    missing,
    pass: skinnedMeshCount > 0 && missing.length === 0,
  }
}
