import * as THREE from "three"

function marker(parent, name, position, color = 0x00d4ff) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.045, 14, 14), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.18 }))
  mesh.name = name; mesh.position.copy(position); parent.add(mesh); return mesh
}

function worldPoint(object, local = new THREE.Vector3()) { object.updateWorldMatrix(true, false); return object.localToWorld(local.clone()) }

export function createInteractionBenchmarks(scene) {
  const root = new THREE.Group(); root.name = "Character2027InteractionBenchmarks"; scene.add(root)

  const wall = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.2, 2.2), new THREE.MeshStandardMaterial({ color: 0x34383d, roughness: 0.95 }))
  wall.name = "BenchmarkWall"; wall.position.set(2.15, 1.1, -0.15); root.add(wall)

  const sofa = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.48, 0.62), new THREE.MeshStandardMaterial({ color: 0x4d4d52, roughness: 0.9 }))
  sofa.name = "BenchmarkSofaSeat"; sofa.position.set(-2.0, 0.24, -0.55); root.add(sofa)
  const sofaBack = new THREE.Mesh(sofa.geometry.clone(), sofa.material); sofaBack.name = "BenchmarkSofaBack"; sofaBack.scale.set(1, 1.25, 0.22); sofaBack.position.set(-2.0, 0.75, -0.82); root.add(sofaBack)

  // Real geometry for vertical QA. The actions are still controller-driven, but the human can now judge foot clearance and anatomical direction against actual surfaces.
  const step = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.22, 0.55), new THREE.MeshStandardMaterial({ color: 0x3c4248, roughness: 0.92 }))
  step.name = "BenchmarkStep"; step.position.set(-0.55, 0.11, 0.18); root.add(step)

  const stairs = new THREE.Group(); stairs.name = "BenchmarkStairs"; stairs.position.set(-1.55, 0, 0.75); root.add(stairs)
  const stairMaterial = new THREE.MeshStandardMaterial({ color: 0x343a40, roughness: 0.94 })
  const stairTreads = []
  for (let index = 0; index < 3; index++) {
    const tread = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.18 * (index + 1), 0.34), stairMaterial)
    tread.name = `BenchmarkStair_${index + 1}`
    tread.position.set(0, 0.09 * (index + 1), index * 0.34)
    stairs.add(tread); stairTreads.push(tread)
  }

  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.82, 24), new THREE.MeshStandardMaterial({ color: 0x55585d, roughness: 0.85 }))
  pedestal.position.set(-0.85, 0.41, 1.55); root.add(pedestal)
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.13, 20), new THREE.MeshStandardMaterial({ color: 0xe6e6e6, roughness: 0.55 }))
  cup.name = "BenchmarkCup"; cup.position.set(-0.85, 0.89, 1.55); root.add(cup)

  const doorPivot = new THREE.Group(); doorPivot.name = "BenchmarkDoorHinge"; doorPivot.position.set(0.25, 1.025, -2.15); root.add(doorPivot)
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.0, 2.05, 0.08), new THREE.MeshStandardMaterial({ color: 0x2d2a28, roughness: 0.78 }))
  door.name = "BenchmarkDoor"; door.position.x = 0.5; doorPivot.add(door)
  const handle = new THREE.Mesh(new THREE.SphereGeometry(0.045, 14, 14), new THREE.MeshStandardMaterial({ color: 0xb7b7b7, metalness: 0.55, roughness: 0.3 }))
  handle.name = "BenchmarkDoorHandle"; handle.position.set(0.86, -0.02, 0.075); doorPivot.add(handle)

  const bell = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.035), new THREE.MeshStandardMaterial({ color: 0xd9d9d9, metalness: 0.25, roughness: 0.45 }))
  bell.name = "BenchmarkDoorbell"; bell.position.set(1.35, 1.25, -2.08); root.add(bell)

  const objectTable = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 0.65), new THREE.MeshStandardMaterial({ color: 0x484b50, roughness: 0.85 }))
  objectTable.position.set(0.65, 0.76, 1.5); root.add(objectTable)
  const phone = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.15, 0.018), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.4 }))
  phone.name = "BenchmarkPhone"; phone.position.set(0.85, 0.86, 1.45); root.add(phone)
  const magazine = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.012, 0.3), new THREE.MeshStandardMaterial({ color: 0xc94d4d, roughness: 0.8 }))
  magazine.name = "BenchmarkMagazine"; magazine.position.set(0.45, 0.82, 1.55); root.add(magazine)

  const targets = {
    PRESS_DOORBELL:{approachPoint:new THREE.Vector3(1.05,0,-1.55),lookAt:bell.position.clone(),contactPoint:bell.position.clone(),object:bell,hand:"right",type:"precise-contact"},
    KNOCK_DOOR:{approachPoint:new THREE.Vector3(0.7,0,-1.5),lookAt:new THREE.Vector3(0.72,1.35,-2.08),contactPoint:new THREE.Vector3(0.72,1.35,-2.08),object:door,hand:"right",type:"repeated-contact"},
    OPEN_DOOR:{approachPoint:new THREE.Vector3(0.55,0,-1.45),get lookAt(){return worldPoint(handle)},get contactPoint(){return worldPoint(handle)},object:door,handle,doorPivot,hand:"right",type:"handle-grip"},
    PICK_UP_CUP:{approachPoint:new THREE.Vector3(-0.85,0,0.95),get lookAt(){return worldPoint(cup)},get contactPoint(){return worldPoint(cup)},get gripPoint(){return worldPoint(cup,new THREE.Vector3(0.045,0.01,0))},object:cup,hand:"right",type:"small-one-hand"},
    PICK_UP_PHONE:{approachPoint:new THREE.Vector3(0.85,0,0.92),get lookAt(){return worldPoint(phone)},get contactPoint(){return worldPoint(phone)},get gripPoint(){return worldPoint(phone)},object:phone,hand:"right",secondaryHand:"left",type:"phone-grip"},
    PICK_UP_MAGAZINE:{approachPoint:new THREE.Vector3(0.45,0,1.0),get lookAt(){return worldPoint(magazine)},get contactPoint(){return worldPoint(magazine)},get gripPoint(){return worldPoint(magazine,new THREE.Vector3(0.09,0,-0.04))},get secondaryGripPoint(){return worldPoint(magazine,new THREE.Vector3(-0.09,0,-0.04))},object:magazine,hand:"right",secondaryHand:"left",type:"two-hand-flat-object"},
    SIT_SOFA:{approachPoint:new THREE.Vector3(-2.0,0,0.1),lookAt:new THREE.Vector3(-2.0,0.55,-0.55),seatPoint:new THREE.Vector3(-2.0,0.49,-0.45),footLeft:new THREE.Vector3(-2.18,0.02,-0.02),footRight:new THREE.Vector3(-1.82,0.02,-0.02),contactPoint:new THREE.Vector3(-2.0,0.49,-0.45),object:sofa,type:"full-body-seat"},
    LEAN_WALL:{approachPoint:new THREE.Vector3(1.72,0,-0.15),lookAt:new THREE.Vector3(2.15,1.25,-0.15),contactPoint:new THREE.Vector3(2.05,1.05,-0.15),pelvisContact:new THREE.Vector3(2.03,0.86,-0.15),shoulderContact:new THREE.Vector3(2.03,1.42,-0.15),surfaceNormal:new THREE.Vector3(-1,0,0),object:wall,type:"surface-contact-pose"},
  }

  Object.entries(targets).forEach(([name,target])=>marker(root,`${name}_TARGET`,target.contactPoint,0x4fd1c5))
  return { root, targets, terrain:{step,stairs,stairTreads}, objects:{wall,sofa,sofaBack,cup,phone,magazine,door,handle,doorPivot,bell,step,stairs} }
}
