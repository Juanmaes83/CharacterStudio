import * as THREE from "three"
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter"
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js"
import { CharacterManager } from "./characterManager"

function emitStatus(detail) {
  window.dispatchEvent(new CustomEvent("character2027:glb-export", { detail }))
}

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
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

function getSafeColor(material) {
  const source = material?.color || material?.uniforms?.litFactor?.value
  if (source?.isColor) return source.clone()
  if (source?.x != null && source?.y != null && source?.z != null) {
    return new THREE.Color(source.x, source.y, source.z)
  }
  if (Array.isArray(source) && source.length >= 3) {
    return new THREE.Color(source[0], source[1], source[2])
  }
  return new THREE.Color(0xffffff)
}

function getSafeMap(material) {
  return material?.map || material?.uniforms?.map?.value || material?.uniforms?.mainTex?.value || null
}

function toStandardMaterial(material, keepTextures = true) {
  if (!material) return new THREE.MeshStandardMaterial({ color: 0xffffff })

  const converted = new THREE.MeshStandardMaterial({
    name: material.name || "Character2027_Material",
    color: getSafeColor(material),
    map: keepTextures ? getSafeMap(material) : null,
    normalMap: keepTextures ? material.normalMap || null : null,
    roughnessMap: keepTextures ? material.roughnessMap || null : null,
    metalnessMap: keepTextures ? material.metalnessMap || null : null,
    emissiveMap: keepTextures ? material.emissiveMap || null : null,
    alphaMap: keepTextures ? material.alphaMap || null : null,
    roughness: Number.isFinite(material.roughness) ? material.roughness : 0.8,
    metalness: Number.isFinite(material.metalness) ? material.metalness : 0,
    transparent: Boolean(material.transparent),
    opacity: Number.isFinite(material.opacity) ? material.opacity : 1,
    alphaTest: Number.isFinite(material.alphaTest) ? material.alphaTest : 0,
    side: material.side ?? THREE.FrontSide,
  })

  if (material.emissive?.isColor) converted.emissive.copy(material.emissive)
  return converted
}

function describeMaterial(material) {
  if (Array.isArray(material)) return material.map((item) => item?.name || item?.type || "material").join(" + ")
  return material?.name || material?.type || "material"
}

function collectMeshDescriptors(model) {
  const descriptors = []
  let meshIndex = 0
  model?.traverse((node) => {
    if (!node.isMesh) return
    descriptors.push({
      index: meshIndex,
      name: node.name || `mesh-${meshIndex}`,
      type: node.type,
      material: describeMaterial(node.material),
      vertexCount: node.geometry?.attributes?.position?.count || 0,
      indexCount: node.geometry?.index?.count || 0,
      morphTargets: Object.keys(node.geometry?.morphAttributes || {}).join(", ") || "none",
      skinned: Boolean(node.isSkinnedMesh),
      bones: node.skeleton?.bones?.length || 0,
    })
    meshIndex += 1
  })
  return descriptors
}

function buildExportClone(model, { keepTextures = true, omitMeshIndex = null } = {}) {
  // SkeletonUtils.clone preserves SkinnedMesh -> Skeleton -> Bone relationships
  // for modular avatars. Preserve the original index buffer BEFORE sanitizing
  // runtime-only userData.
  const clone = cloneSkinned(model)
  clone.name = "Character2027Export"

  let meshIndex = 0
  const toRemove = []
  clone.traverse((node) => {
    if (!node.isMesh) {
      node.userData = {}
      return
    }

    const currentMeshIndex = meshIndex
    meshIndex += 1

    if (omitMeshIndex === currentMeshIndex) {
      toRemove.push(node)
      return
    }

    const originalIndex = node.userData?.origIndexBuffer || null
    node.geometry = node.geometry?.clone?.() || node.geometry
    if (originalIndex && node.geometry) node.geometry.setIndex(originalIndex)

    node.material = Array.isArray(node.material)
      ? node.material.map((material) => toStandardMaterial(material, keepTextures))
      : toStandardMaterial(node.material, keepTextures)

    node.visible = true
    node.frustumCulled = false
    node.userData = {}
  })

  toRemove.forEach((node) => node.parent?.remove(node))
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

async function diagnoseFailingMesh(model, originalError) {
  const descriptors = collectMeshDescriptors(model)
  const suspects = []
  const maxTrials = Math.min(descriptors.length, 24)

  emitStatus({
    status: "diagnosing",
    message: `GLB failed. Testing ${maxTrials} avatar parts to isolate the incompatible asset…`,
  })

  for (let i = 0; i < maxTrials; i += 1) {
    const descriptor = descriptors[i]
    try {
      const diagnosticClone = buildExportClone(model, {
        keepTextures: false,
        omitMeshIndex: descriptor.index,
      })
      const buffer = await exportBinaryGLB(diagnosticClone)
      if (buffer?.byteLength) {
        suspects.push(descriptor)
        console.warn("[Character2027] GLB culprit candidate isolated:", descriptor)
      }
    } catch {
      // Expected for non-culprit omissions: the problematic asset is still present.
    }
  }

  const diagnostic = {
    originalError: originalError?.message || String(originalError),
    meshCount: descriptors.length,
    tested: maxTrials,
    suspects,
  }

  console.group("[Character2027] GLB export diagnostic")
  console.table(descriptors)
  if (suspects.length) console.table(suspects)
  console.groupEnd()

  return diagnostic
}

async function exportWithFallbacks(model) {
  const attempts = [
    {
      label: "sanitized-skinned-clone-with-textures",
      model: () => buildExportClone(model, { keepTextures: true }),
    },
    {
      // Some avatar packs contain browser/CORS-hostile texture sources. Keep the
      // full rig and geometry as a motion-test fallback even if a texture cannot
      // be serialized.
      label: "sanitized-skinned-clone-no-textures",
      model: () => buildExportClone(model, { keepTextures: false }),
    },
    {
      label: "live-scene",
      model: () => model,
    },
  ]

  let lastError = null
  const errors = []
  for (const attempt of attempts) {
    try {
      emitStatus({ status: "working", strategy: attempt.label })
      console.info(`[Character2027] GLB export attempt: ${attempt.label}`)
      const buffer = await exportBinaryGLB(attempt.model())
      if (!buffer?.byteLength) throw new Error("Exporter returned an empty GLB")
      return { buffer, strategy: attempt.label }
    } catch (error) {
      lastError = error
      errors.push({ strategy: attempt.label, message: error?.message || String(error) })
      console.warn(`[Character2027] ${attempt.label} failed`, error)
    }
  }

  const failure = lastError || new Error("GLB export failed")
  failure.character2027Attempts = errors
  throw failure
}

CharacterManager.prototype.downloadGLB = async function downloadGLBFixed(name) {
  const fileName = `${name && name !== "" ? name : "AvatarCreatorModel"}.glb`

  if (!this.characterModel || this.characterModel.children.length === 0) {
    const error = new Error("No assembled character is loaded to export.")
    emitStatus({ status: "error", message: error.message })
    throw error
  }

  // Preserve upstream manifest download policy. Surface the reason instead of
  // silently doing nothing so a blocked asset cannot look like a broken button.
  if (!this.canDownload()) {
    const error = new Error("This avatar includes a manifest that does not permit downloading.")
    console.error("[Character2027] GLB export blocked:", error)
    emitStatus({ status: "blocked", message: error.message })
    throw error
  }

  emitStatus({ status: "working", message: "Preparing GLB…" })

  try {
    const { buffer, strategy } = await exportWithFallbacks(this.characterModel)
    saveArrayBuffer(buffer, fileName)
    const sizeMB = (buffer.byteLength / 1024 / 1024).toFixed(2)
    console.info(`[Character2027] GLB exported: ${fileName} (${strategy}, ${sizeMB} MB)`)
    emitStatus({ status: "success", fileName, strategy, sizeMB })
    return buffer
  } catch (error) {
    console.error("[Character2027] GLB export failed after all strategies:", error)

    const diagnostic = await diagnoseFailingMesh(this.characterModel, error)
    const suspects = diagnostic.suspects || []
    const culpritText = suspects.length
      ? suspects.map((item) => `${item.name} [${item.material}]`).join("; ")
      : "No single mesh isolated; failure may be shared skeleton/geometry state."

    emitStatus({
      status: "diagnostic-error",
      message: error?.message || String(error),
      suspects,
      culpritText,
      tested: diagnostic.tested,
      meshCount: diagnostic.meshCount,
      attempts: error.character2027Attempts || [],
    })

    error.character2027Diagnostic = diagnostic
    throw error
  }
}
