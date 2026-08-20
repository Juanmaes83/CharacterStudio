import * as THREE from "three"

const _headWorld = new THREE.Vector3()
const _targetLocal = new THREE.Vector3()

export class LookAtController {
  constructor(root) {
    this.root = root
    this.head = root.getObjectByName("head")
    this.neck = root.getObjectByName("neck")
    this.headRest = this.head?.quaternion.clone() || new THREE.Quaternion()
    this.neckRest = this.neck?.quaternion.clone() || new THREE.Quaternion()
    this.target = null
    this.weight = 0
    this.targetWeight = 0
    this.speed = 7
  }

  lookAt(target, options = {}) {
    this.target = target.clone ? target.clone() : new THREE.Vector3(target.x, target.y, target.z)
    this.targetWeight = THREE.MathUtils.clamp(options.weight ?? 1, 0, 1)
    this.speed = options.speed ?? this.speed
  }

  clear() {
    this.targetWeight = 0
  }

  update(delta) {
    if (!this.head) return
    this.weight = THREE.MathUtils.damp(this.weight, this.targetWeight, this.speed, delta)

    if (!this.target || this.weight < 0.001) {
      this.head.quaternion.slerp(this.headRest, Math.min(1, delta * this.speed))
      if (this.neck) this.neck.quaternion.slerp(this.neckRest, Math.min(1, delta * this.speed))
      return
    }

    this.head.getWorldPosition(_headWorld)
    _targetLocal.copy(this.target)
    this.root.worldToLocal(_targetLocal)
    const headLocal = this.root.worldToLocal(_headWorld.clone())
    const dir = _targetLocal.sub(headLocal)
    const horizontal = Math.max(Math.hypot(dir.x, dir.z), 0.0001)
    const yaw = THREE.MathUtils.clamp(Math.atan2(dir.x, dir.z), -0.72, 0.72)
    const pitch = THREE.MathUtils.clamp(-Math.atan2(dir.y, horizontal), -0.38, 0.38)

    const headDelta = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch * 0.72, yaw * 0.72, 0, "YXZ"))
    const neckDelta = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch * 0.28, yaw * 0.28, 0, "YXZ"))
    const headTarget = this.headRest.clone().multiply(headDelta)
    const neckTarget = this.neckRest.clone().multiply(neckDelta)
    this.head.quaternion.slerp(headTarget, Math.min(1, delta * this.speed * this.weight))
    if (this.neck) this.neck.quaternion.slerp(neckTarget, Math.min(1, delta * this.speed * this.weight))
  }
}
