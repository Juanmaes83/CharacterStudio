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
