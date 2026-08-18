import * as THREE from "three"

function marker(scene, name, position, color = 0x00d4ff) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.045, 14, 14),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.18 }),
  )
  mesh.name = name
  mesh.position.copy(position)
  scene.add(mesh)
  return mesh
}

export function createInteractionBenchmarks(scene) {
  const root = new THREE.Group()
  root.name = "Character2027InteractionBenchmarks"
  scene.add(root)

  const wall = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 2.2, 2.2),
    new THREE.MeshStandardMaterial({ color: 0x34383d, roughness: 0.95 }),
  )
  wall.position.set(2.15, 1.1, -0.15)
  root.add(wall)

  const sofa = new THREE.Mesh(
    new THREE.BoxGeometry(1.45, 0.48, 0.62),
    new THREE.MeshStandardMaterial({ color: 0x4d4d52, roughness: 0.9 }),
  )
  sofa.position.set(-2.0, 0.24, -0.55)
  root.add(sofa)
  const sofaBack = new THREE.Mesh(sofa.geometry.clone(), sofa.material)
  sofaBack.scale.set(1, 1.25, 0.22)
  sofaBack.position.set(-2.0, 0.75, -0.82)
  root.add(sofaBack)

  const pedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.26, 0.82, 24),
    new THREE.MeshStandardMaterial({ color: 0x55585d, roughness: 0.85 }),
  )
  pedestal.position.set(-0.85, 0.41, 1.55)
  root.add(pedestal)

  const cup = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.06, 0.13, 20),
    new THREE.MeshStandardMaterial({ color: 0xe6e6e6, roughness: 0.55 }),
  )
  cup.position.set(-0.85, 0.89, 1.55)
  root.add(cup)

  const door = new THREE.Mesh(
    new THREE.BoxGeometry(1.0, 2.05, 0.08),
    new THREE.MeshStandardMaterial({ color: 0x2d2a28, roughness: 0.78 }),
  )
  door.position.set(0.75, 1.025, -2.15)
  root.add(door)

  const bell = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.14, 0.035),
    new THREE.MeshStandardMaterial({ color: 0xd9d9d9, metalness: 0.25, roughness: 0.45 }),
  )
  bell.position.set(1.35, 1.25, -2.08)
  root.add(bell)

  const phone = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.15, 0.018),
    new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.4 }),
  )
  phone.position.set(0.85, 0.9, 1.45)
  root.add(phone)

  const magazine = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.012, 0.3),
    new THREE.MeshStandardMaterial({ color: 0xc94d4d, roughness: 0.8 }),
  )
  magazine.position.set(0.45, 0.82, 1.55)
  root.add(magazine)

  const targets = {
    PRESS_DOORBELL: {
      approachPoint: new THREE.Vector3(1.05, 0, -1.55),
      lookAt: bell.position.clone(),
      contactPoint: bell.position.clone(),
      type: "precise-contact",
    },
    KNOCK_DOOR: {
      approachPoint: new THREE.Vector3(0.7, 0, -1.5),
      lookAt: new THREE.Vector3(0.72, 1.35, -2.08),
      contactPoint: new THREE.Vector3(0.72, 1.35, -2.08),
      type: "repeated-contact",
    },
    OPEN_DOOR: {
      approachPoint: new THREE.Vector3(0.55, 0, -1.45),
      lookAt: new THREE.Vector3(1.1, 1.0, -2.08),
      contactPoint: new THREE.Vector3(1.1, 1.0, -2.08),
      type: "handle-grip",
    },
    PICK_UP_CUP: {
      approachPoint: new THREE.Vector3(-0.85, 0, 0.95),
      lookAt: cup.position.clone(),
      contactPoint: cup.position.clone(),
      type: "small-one-hand",
    },
    PICK_UP_PHONE: {
      approachPoint: new THREE.Vector3(0.85, 0, 0.92),
      lookAt: phone.position.clone(),
      contactPoint: phone.position.clone(),
      type: "phone-grip",
    },
    PICK_UP_MAGAZINE: {
      approachPoint: new THREE.Vector3(0.45, 0, 1.0),
      lookAt: magazine.position.clone(),
      contactPoint: magazine.position.clone(),
      type: "two-hand-flat-object",
    },
    SIT_SOFA: {
      approachPoint: new THREE.Vector3(-2.0, 0, 0.1),
      lookAt: new THREE.Vector3(-2.0, 0.55, -0.55),
      contactPoint: new THREE.Vector3(-2.0, 0.47, -0.45),
      type: "full-body-seat",
    },
    LEAN_WALL: {
      approachPoint: new THREE.Vector3(1.72, 0, -0.15),
      lookAt: new THREE.Vector3(2.15, 1.25, -0.15),
      contactPoint: new THREE.Vector3(2.05, 1.05, -0.15),
      surfaceNormal: new THREE.Vector3(-1, 0, 0),
      type: "surface-contact-pose",
    },
  }

  Object.entries(targets).forEach(([name, target]) => marker(root, `${name}_TARGET`, target.contactPoint, 0x4fd1c5))
  return { root, targets }
}
