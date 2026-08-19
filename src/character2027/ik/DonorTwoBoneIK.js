import * as THREE from "three"

// Character 2027 donor adaptation.
// Source concept and core cosine-law solver adapted from:
// Juanmaes83/threejs-procedural-spider (MIT, Copyright 2026 Majid Manzarpour)
// src/core/dynamics.js -> twoBoneKnee / twoBoneKneeDecomposed.
// Kept intentionally framework-agnostic so it can serve Rope, Paint, Museum,
// Costa Blanca and Sakura without coupling to a specific experience.

const _toTarget = new THREE.Vector3()
const _direction = new THREE.Vector3()
const _bend = new THREE.Vector3()
const _restAxis = new THREE.Vector3()
const _canonicalBend = new THREE.Vector3()
const _canonicalJoint = new THREE.Vector3()
const _aim = new THREE.Quaternion()

export const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

export function solveTwoBoneJoint(root, target, upperLength, lowerLength, poleDirection, out = new THREE.Vector3()) {
  _toTarget.subVectors(target, root)
  const distance = clamp(_toTarget.length(), 1e-4, upperLength + lowerLength - 1e-4)
  _direction.copy(_toTarget).normalize()

  _bend.copy(poleDirection).addScaledVector(_direction, -poleDirection.dot(_direction))
  if (_bend.lengthSq() < 1e-8) {
    _bend.set(0, 1, 0).addScaledVector(_direction, -_direction.y)
    if (_bend.lengthSq() < 1e-8) _bend.set(1, 0, 0)
  }
  _bend.normalize()

  const cosine = clamp(
    (upperLength * upperLength + distance * distance - lowerLength * lowerLength) /
      (2 * upperLength * distance),
    -1,
    1,
  )
  const angle = Math.acos(cosine)

  return out
    .copy(root)
    .addScaledVector(_direction, Math.cos(angle) * upperLength)
    .addScaledVector(_bend, Math.sin(angle) * upperLength)
}

export function solveTwoBoneJointDecomposed(
  root,
  target,
  upperLength,
  lowerLength,
  poleDirection,
  restAxis,
  out = new THREE.Vector3(),
) {
  _toTarget.subVectors(target, root)
  const distance = clamp(_toTarget.length(), 1e-4, upperLength + lowerLength - 1e-4)
  _direction.copy(_toTarget).normalize()

  _restAxis.copy(restAxis)
  if (_restAxis.lengthSq() < 1e-8) _restAxis.copy(_direction)
  else _restAxis.normalize()

  _canonicalBend.copy(poleDirection).addScaledVector(_restAxis, -poleDirection.dot(_restAxis))
  if (_canonicalBend.lengthSq() < 1e-8) {
    _canonicalBend.set(0, 1, 0).addScaledVector(_restAxis, -_restAxis.y)
    if (_canonicalBend.lengthSq() < 1e-8) _canonicalBend.set(1, 0, 0)
  }
  _canonicalBend.normalize()

  const cosine = clamp(
    (upperLength * upperLength + distance * distance - lowerLength * lowerLength) /
      (2 * upperLength * distance),
    -1,
    1,
  )
  const angle = Math.acos(cosine)

  _canonicalJoint
    .copy(root)
    .addScaledVector(_restAxis, Math.cos(angle) * upperLength)
    .addScaledVector(_canonicalBend, Math.sin(angle) * upperLength)

  _aim.setFromUnitVectors(_restAxis, _direction)
  return out.copy(_canonicalJoint).sub(root).applyQuaternion(_aim).add(root)
}
