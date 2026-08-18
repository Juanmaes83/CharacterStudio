import * as THREE from "three"
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter"
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js"
import { CharacterManager } from "./characterManager"

function saveArrayBuffer(buffer, filename) {
  const blob = new Blob([buffer], { type: "model/gltf-binary" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.style.display = "none"
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}

function toStandardMaterial(material) {
  if (!material) return new THREE.MeshStandardMaterial({ color: 0xffffff })
  if (material.isMeshStandardMaterial || material.isMeshPhysicalMaterial) return material.clone()

  const color = material.color?.clone?.() || material.uniforms?.litFactor?.value?.clone?.() || new THREE.Color(0xffffff)
  const converted = new THREE.MeshStandardMaterial({
    name: material.name || "Character2027_Material",
    color,
    map: material.map || material.uniforms?.map?.value || material.uniforms?.mainTex?.value || null,
    normalMap: material.normalMap || null,
    roughness: Number.isFinite(material.roughness) ? material.roughness : 0.8,
    metalness: Number.isFinite(material.metalness) ? material.metalness : 0,
    transparent: Boolean(material.transparent),
    opacity: Number.isFinite(material.opacity) ? material.opacity : 1,
    side: material.side ?? THREE.FrontSide,
  })
  converted.alphaTest = material.alphaTest || 0
  return converted
}

function buildExportClone(model) {
  // SkeletonUtils.clone preserves SkinnedMesh -> Skeleton -> Bone relationships,
  // unlike Object3D.clone() for modular avatars with repeated skins.
  const clone = cloneSkinned(model)
  clone.name = "Character2027Export"

  clone.traverse((node) => {
    // VRM helpers/managers can carry circular references in userData. They are
    // runtime-only and must not be serialized into the GLB.
    node.userData = {}

    if (node.isMesh) {
      node.geometry = node.geometry?.clone?.() || node.geometry
      node.material = Array.isArray(node.material)
        ? node.material.map(toStandardMaterial)
        : toStandardMaterial(node.material)
      node.visible = true
      node.frustumCulled = false

      if (node.userData?.origIndexBuffer && node.geometry) {
        node.geometry.setIndex(node.userData.origIndexBuffer)
      }
    }
  })

  clone.updateMatrixWorld(true)
  return clone
}

function exportBinaryGLB(model) {
  return new Promise((resolve, reject) => {
    const exporter = new GLTFExporter()
    exporter.parse(
      model,
      (result) => {
        if (result instanceof ArrayBuffer) return resolve(result)
        reject(new Error("GLTFExporter returned JSON instead of binary GLB data."))
      },
      (error) => reject(error instanceof Error ? error : new Error(String(error))),
      {
        binary: true,
        trs: false,
        onlyVisible: false,
        truncateDrawRange: true,
        forcePowerOfTwoTextures: false,
        maxTextureSize: 4096,
      },
    )
  })
}

async function exportWithFallbacks(model) {
  const attempts = [
    { label: "sanitized-skinned-clone", model: () => buildExportClone(model) },
    { label: "live-scene", model: () => model },
  ]

  let lastError = null
  for (const attempt of attempts) {
    try {
      console.info(`[Character2027] GLB export attempt: ${attempt.label}`)
      const buffer = await exportBinaryGLB(attempt.model())
      if (!buffer?.byteLength) throw new Error("Exporter returned an empty GLB")
      return { buffer, strategy: attempt.label }
    } catch (error) {
      lastError = error
      console.warn(`[Character2027] ${attempt.label} failed`, error)
    }
  }
  throw lastError || new Error("GLB export failed")
}

CharacterManager.prototype.downloadGLB = async function downloadGLBFixed(name) {
  if (!this.canDownload()) {
    const error = new Error("Download not supported.")
    console.error("[Character2027] GLB export failed:", error)
    throw error
  }

  const fileName = `${name && name !== "" ? name : "AvatarCreatorModel"}.glb`

  try {
    const { buffer, strategy } = await exportWithFallbacks(this.characterModel)
    saveArrayBuffer(buffer, fileName)
    console.info(`[Character2027] GLB exported: ${fileName} (${strategy}, ${(buffer.byteLength / 1024 / 1024).toFixed(2)} MB)`)
    return buffer
  } catch (error) {
    console.error("[Character2027] GLB export failed after all strategies:", error)
    throw error
  }
}
