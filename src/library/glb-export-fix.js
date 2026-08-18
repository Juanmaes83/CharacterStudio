import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter"
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
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function exportBinaryGLB(model) {
  return new Promise((resolve, reject) => {
    const exporter = new GLTFExporter()
    exporter.parse(
      model,
      (result) => {
        if (result instanceof ArrayBuffer) {
          resolve(result)
          return
        }
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

/**
 * CHARACTER 2027 hotfix
 *
 * The upstream optimized GLB route is currently broken because downloadGLB()
 * calls getOptimizedGLB(model, options), while getOptimizedGLB expects
 * (model, avatar, options). That shifts the arguments and leaves `options`
 * undefined inside the optimizer.
 *
 * For Prototype 01 we prefer a correct, inspectable GLB over a broken optimized
 * export. This patch exports the live assembled CharacterStudio scene directly,
 * preserving the real skinned meshes / skeleton hierarchy. VRM export remains
 * untouched. Once the optimized exporter is repaired and covered by tests this
 * compatibility patch can be removed.
 */
CharacterManager.prototype.downloadGLB = async function downloadGLBFixed(name) {
  if (!this.canDownload()) {
    const error = new Error("Download not supported.")
    console.error("[Character2027] GLB export failed:", error)
    throw error
  }

  const fileName = `${name && name !== "" ? name : "AvatarCreatorModel"}.glb`

  try {
    console.info("[Character2027] Exporting direct binary GLB fallback…")
    const glb = await exportBinaryGLB(this.characterModel)
    saveArrayBuffer(glb, fileName)
    console.info(`[Character2027] GLB exported: ${fileName}`)
    return glb
  } catch (error) {
    console.error("[Character2027] GLB export failed:", error)
    throw error
  }
}
