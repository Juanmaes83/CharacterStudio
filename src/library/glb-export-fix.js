import * as THREE from "three"
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter"
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js"
import { CharacterManager } from "./characterManager"

const EXPORT_TIMEOUT_MS = 12000
const DIAGNOSTIC_TIMEOUT_MS = 6000

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

function buildExportClone(model, { keepTextures = true, omitMeshIndices = [] } = {}) {
  const omitSet = new Set(omitMeshIndices)
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

    if (omitSet.has(currentMeshIndex)) {
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

function exportBinaryGLB(model, timeoutMs = EXPORT_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    let settled = false
    const finishResolve = (value) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(value)
    }
    const finishReject = (error) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      reject(error instanceof Error ? error : new Error(String(error)))
    }

    const timer = setTimeout(() => {
      finishReject(new Error(`GLTFExporter timed out after ${(timeoutMs / 1000).toFixed(0)}s`))
    }, timeoutMs)

    try {
      const exporter = new GLTFExporter()
      exporter.parse(
        model,
        (result) => {
          if (result instanceof ArrayBuffer) return finishResolve(result)
          finishReject(new Error("GLTFExporter returned JSON instead of binary GLB data."))
        },
        finishReject,
        {
          binary: true,
          trs: false,
          onlyVisible: false,
          truncateDrawRange: true,
          forcePowerOfTwoTextures: false,
          maxTextureSize: 4096,
        },
      )
    } catch (error) {
      finishReject(error)
    }
  })
}

async function canExportWithout(model, omitMeshIndices, timeoutMs = DIAGNOSTIC_TIMEOUT_MS) {
  try {
    const diagnosticClone = buildExportClone(model, {
      keepTextures: false,
      omitMeshIndices,
    })
    const buffer = await exportBinaryGLB(diagnosticClone, timeoutMs)
    return Boolean(buffer?.byteLength)
  } catch {
    return false
  }
}

async function diagnoseFailingMesh(model, originalError) {
  const descriptors = collectMeshDescriptors(model)
  if (!descriptors.length) {
    return { originalError: originalError?.message || String(originalError), meshCount: 0, tested: 0, suspects: [] }
  }

  emitStatus({
    status: "diagnosing",
    message: `GLB stalled/failed. Isolating the incompatible avatar part across ${descriptors.length} meshes…`,
  })

  // Fast binary isolation: if omitting one half makes export succeed, the culprit
  // is in that omitted half. Repeat until one mesh remains. This avoids up to 24
  // sequential 6–12 second stalls on problematic avatars.
  let candidates = descriptors.map((item) => item.index)
  let tested = 0

  while (candidates.length > 1) {
    const midpoint = Math.ceil(candidates.length / 2)
    const left = candidates.slice(0, midpoint)
    const right = candidates.slice(midpoint)

    emitStatus({
      status: "diagnosing",
      message: `Diagnosing GLB… ${candidates.length} candidate parts remain`,
    })

    tested += 1
    if (await canExportWithout(model, left)) {
      candidates = left
      continue
    }

    if (right.length) {
      tested += 1
      if (await canExportWithout(model, right)) {
        candidates = right
        continue
      }
    }

    // Neither half alone fixes the export: likely more than one incompatible mesh
    // or shared skeleton/geometry state. Fall back to a bounded single-mesh scan.
    const suspects = []
    const maxTrials = Math.min(descriptors.length, 12)
    for (let i = 0; i < maxTrials; i += 1) {
      const descriptor = descriptors[i]
      tested += 1
      emitStatus({
        status: "diagnosing",
        message: `Diagnosing GLB… testing ${i + 1}/${maxTrials}: ${descriptor.name}`,
      })
      if (await canExportWithout(model, [descriptor.index], 4500)) suspects.push(descriptor)
    }

    return {
      originalError: originalError?.message || String(originalError),
      meshCount: descriptors.length,
      tested,
      suspects,
      sharedFailure: suspects.length === 0,
    }
  }

  const suspects = candidates.length === 1
    ? descriptors.filter((item) => item.index === candidates[0])
    : []

  return {
    originalError: originalError?.message || String(originalError),
    meshCount: descriptors.length,
    tested,
    suspects,
    sharedFailure: suspects.length === 0,
  }
}

async function exportWithFallbacks(model) {
  const attempts = [
    {
      label: "sanitized-skinned-clone-with-textures",
      model: () => buildExportClone(model, { keepTextures: true }),
    },
    {
      label: "sanitized-skinned-clone-no-textures",
      model: () => buildExportClone(model, { keepTextures: false }),
    },
    {
      // Keep this only as the last compatibility route. A timeout is mandatory:
      // the ONIFORCE/Demon avatar demonstrated that upstream GLTFExporter can
      // stall indefinitely on the live assembled scene without invoking error.
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
      const buffer = await exportBinaryGLB(attempt.model(), EXPORT_TIMEOUT_MS)
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

    console.group("[Character2027] GLB export diagnostic")
    console.table(collectMeshDescriptors(this.characterModel))
    if (suspects.length) console.table(suspects)
    console.groupEnd()

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
