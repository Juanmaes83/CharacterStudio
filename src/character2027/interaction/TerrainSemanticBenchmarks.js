import * as THREE from "three"

function material(color) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.86, metalness: 0.08 })
}

export function ensureTerrainSemanticBenchmarks(scene) {
  if (!scene) return null
  const existing = scene.getObjectByName("Character2027TerrainSemanticBenchmarks")
  if (existing) return existing

  const root = new THREE.Group()
  root.name = "Character2027TerrainSemanticBenchmarks"
  scene.add(root)

  // STEP and STAIRS already come from InteractionBenchmarks. This module adds
  // the previously missing real ladder so LADDER_UP/DOWN has physical rungs.
  const ladder = new THREE.Group()
  ladder.name = "BenchmarkLadder"
  ladder.position.set(1.65, 0, 0.95)
  root.add(ladder)

  const railMaterial = material(0x5c6268)
  const rungMaterial = material(0x858b91)
  const railGeometry = new THREE.BoxGeometry(0.055, 2.05, 0.055)
  const leftRail = new THREE.Mesh(railGeometry, railMaterial)
  leftRail.name = "BenchmarkLadderRailLeft"
  leftRail.position.set(-0.34, 1.02, 0)
  ladder.add(leftRail)
  const rightRail = leftRail.clone()
  rightRail.name = "BenchmarkLadderRailRight"
  rightRail.position.x = 0.34
  ladder.add(rightRail)

  const rungGeometry = new THREE.BoxGeometry(0.72, 0.045, 0.055)
  for (let index = 0; index < 7; index += 1) {
    const rung = new THREE.Mesh(rungGeometry, rungMaterial)
    rung.name = `BenchmarkLadderRung_${index}`
    rung.position.set(0, 0.24 + index * 0.28, 0)
    ladder.add(rung)
  }

  return root
}

export function terrainWorldTop(object) {
  if (!object) return null
  object.updateWorldMatrix(true, true)
  const box = new THREE.Box3().setFromObject(object)
  const center = box.getCenter(new THREE.Vector3())
  center.y = box.max.y
  return center
}

export function getTerrainSemanticDescriptor(avatarRoot, state) {
  const scene = avatarRoot?.parent
  if (!scene) return null

  if (state === "STEP_UP" || state === "STEP_DOWN") {
    const step = scene.getObjectByName("BenchmarkStep")
    const top = terrainWorldTop(step)
    return step && top ? { type: "step", object: step, top } : null
  }

  if (state === "STAIRS_UP" || state === "STAIRS_DOWN") {
    const treads = [1, 2, 3]
      .map((index) => scene.getObjectByName(`BenchmarkStair_${index}`))
      .filter(Boolean)
    const tops = treads.map(terrainWorldTop).filter(Boolean)
    return tops.length ? { type: "stairs", treads, tops } : null
  }

  if (state === "LADDER_UP" || state === "LADDER_DOWN") {
    const ladder = scene.getObjectByName("BenchmarkLadder")
    const rungs = Array.from({ length: 7 }, (_, index) => scene.getObjectByName(`BenchmarkLadderRung_${index}`)).filter(Boolean)
    const rungPoints = rungs.map((rung) => rung.getWorldPosition(new THREE.Vector3()))
    return ladder && rungPoints.length >= 4 ? { type: "ladder", ladder, rungs, rungPoints } : null
  }

  return null
}
