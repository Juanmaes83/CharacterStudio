import React, { useEffect, useMemo, useRef, useState } from "react"
import * as THREE from "three"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls"
import { CharacterPerformanceController } from "../character2027/animation/CharacterPerformanceController"
import { loadQuaterniusManifest, loadQuaterniusMotionLibrary } from "../character2027/animation/QuaterniusMotionSource"
import { findTargetBone } from "../character2027/animation/QuaterniusRigMap"

const loader = new GLTFLoader()

const ui = {
  page: { position: "fixed", inset: 0, display: "grid", gridTemplateColumns: "410px 1fr", background: "#0e0e0e", color: "#f4f4f4", fontFamily: "Inter, system-ui, sans-serif" },
  panel: { padding: 18, overflowY: "auto", borderRight: "1px solid #303030", background: "#171717" },
  stage: { minWidth: 0, position: "relative" },
  title: { fontSize: 19, fontWeight: 850, marginBottom: 4 },
  small: { fontSize: 11, lineHeight: 1.5, opacity: 0.72 },
  section: { marginTop: 16, paddingTop: 14, borderTop: "1px solid #333" },
  button: { width: "100%", padding: "9px 10px", marginTop: 6, borderRadius: 6, border: "1px solid #505050", background: "#252525", color: "#fff", cursor: "pointer", textAlign: "left" },
  active: { background: "#ededed", color: "#111" },
  pre: { whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 10, lineHeight: 1.4, color: "#bdbdbd" },
  good: { fontSize: 11, color: "#bde9bf", marginTop: 8 },
  bad: { fontSize: 11, color: "#ff9b9b", marginTop: 8 },
}

function localFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    loader.load(url, (gltf) => {
      URL.revokeObjectURL(url)
      resolve(gltf)
    }, undefined, (error) => {
      URL.revokeObjectURL(url)
      reject(error)
    })
  })
}

function inspectCriticalRig(root) {
  const names = ["hips", "leftUpperLeg", "leftLowerLeg", "leftFoot", "rightUpperLeg", "rightLowerLeg", "rightFoot", "leftUpperArm", "leftLowerArm", "leftHand", "rightUpperArm", "rightLowerArm", "rightHand"]
  const found = Object.fromEntries(names.map((name) => [name, findTargetBone(root, name)?.name || null]))
  const missing = Object.entries(found).filter(([, value]) => !value).map(([name]) => name)
  return { found, missing, pass: missing.length === 0 }
}

function angleDeg(a, b, c) {
  if (!a || !b || !c) return null
  const p0 = a.getWorldPosition(new THREE.Vector3()).sub(b.getWorldPosition(new THREE.Vector3())).normalize()
  const p1 = c.getWorldPosition(new THREE.Vector3()).sub(b.getWorldPosition(new THREE.Vector3())).normalize()
  return THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(p0.dot(p1), -1, 1)))
}

function liveJointAngles(root) {
  if (!root) return null
  return {
    kneeL: angleDeg(findTargetBone(root, "leftUpperLeg"), findTargetBone(root, "leftLowerLeg"), findTargetBone(root, "leftFoot")),
    kneeR: angleDeg(findTargetBone(root, "rightUpperLeg"), findTargetBone(root, "rightLowerLeg"), findTargetBone(root, "rightFoot")),
    elbowL: angleDeg(findTargetBone(root, "leftUpperArm"), findTargetBone(root, "leftLowerArm"), findTargetBone(root, "leftHand")),
    elbowR: angleDeg(findTargetBone(root, "rightUpperArm"), findTargetBone(root, "rightLowerArm"), findTargetBone(root, "rightHand")),
  }
}

export default function ProductionMotionLab() {
  const mountRef = useRef(null)
  const sceneRef = useRef(null)
  const avatarRef = useRef(null)
  const helperRef = useRef(null)
  const performanceRef = useRef(null)
  const donorRef = useRef(null)
  const frameRef = useRef(null)
  const clockRef = useRef(new THREE.Clock())

  const [manifest, setManifest] = useState(null)
  const [clips, setClips] = useState([])
  const [avatarName, setAvatarName] = useState("No avatar loaded")
  const [rig, setRig] = useState(null)
  const [active, setActive] = useState(null)
  const [report, setReport] = useState(null)
  const [angles, setAngles] = useState(null)
  const [error, setError] = useState("")
  const [showSkeleton, setShowSkeleton] = useState(true)

  useEffect(() => {
    Promise.all([loadQuaterniusManifest(), loadQuaterniusMotionLibrary()])
      .then(([nextManifest, library]) => {
        setManifest(nextManifest)
        donorRef.current = library
        setClips(library.clips.map((clip) => clip.name).sort())
      })
      .catch((e) => setError(`Donor load failed: ${e.message || e}`))
  }, [])

  useEffect(() => {
    const mount = mountRef.current
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x101010)
    sceneRef.current = scene
    const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 100)
    camera.position.set(3.3, 1.8, 5.4)
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.shadowMap.enabled = true
    renderer.domElement.style.width = "100%"
    renderer.domElement.style.height = "100%"
    mount.appendChild(renderer.domElement)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.target.set(0, 0.95, 0)
    controls.enableDamping = true
    scene.add(new THREE.HemisphereLight(0xffffff, 0x333333, 2.1))
    const key = new THREE.DirectionalLight(0xffffff, 3.0)
    key.position.set(3, 5, 4)
    scene.add(key)
    const floor = new THREE.Mesh(new THREE.CircleGeometry(5, 64), new THREE.MeshStandardMaterial({ roughness: 0.92 }))
    floor.rotation.x = -Math.PI / 2
    scene.add(floor)

    const resize = () => {
      const rect = mount.getBoundingClientRect()
      camera.aspect = rect.width / Math.max(rect.height, 1)
      camera.updateProjectionMatrix()
      renderer.setSize(rect.width, rect.height, false)
    }
    resize()
    window.addEventListener("resize", resize)

    let angleTimer = 0
    const tick = () => {
      frameRef.current = requestAnimationFrame(tick)
      const dt = Math.min(clockRef.current.getDelta(), 0.05)
      performanceRef.current?.update(dt)
      helperRef.current?.update()
      controls.update()
      angleTimer += dt
      if (angleTimer > 0.15) {
        angleTimer = 0
        setAngles(liveJointAngles(avatarRef.current))
      }
      renderer.render(scene, camera)
    }
    tick()

    return () => {
      cancelAnimationFrame(frameRef.current)
      window.removeEventListener("resize", resize)
      performanceRef.current?.dispose()
      controls.dispose()
      renderer.dispose()
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement)
    }
  }, [])

  useEffect(() => {
    if (helperRef.current) helperRef.current.visible = showSkeleton
  }, [showSkeleton])

  const loadAvatar = async (file) => {
    setError("")
    try {
      const gltf = await localFile(file)
      const root = gltf.scene
      root.traverse((node) => {
        if (node.isMesh) { node.castShadow = true; node.receiveShadow = true }
      })
      performanceRef.current?.dispose()
      if (helperRef.current) sceneRef.current.remove(helperRef.current)
      if (avatarRef.current) sceneRef.current.remove(avatarRef.current)

      const box = new THREE.Box3().setFromObject(root)
      const size = box.getSize(new THREE.Vector3())
      root.scale.multiplyScalar(1.75 / Math.max(size.y, 0.0001))
      root.updateMatrixWorld(true)
      const scaled = new THREE.Box3().setFromObject(root)
      const center = scaled.getCenter(new THREE.Vector3())
      root.position.x -= center.x
      root.position.z -= center.z
      root.position.y -= scaled.min.y
      root.updateMatrixWorld(true)

      const nextRig = inspectCriticalRig(root)
      sceneRef.current.add(root)
      const helper = new THREE.SkeletonHelper(root)
      helper.visible = showSkeleton
      sceneRef.current.add(helper)
      avatarRef.current = root
      helperRef.current = helper
      setRig(nextRig)
      setAvatarName(file.name)
      setActive(null)
      setReport(null)

      if (!donorRef.current) throw new Error("Donor library is still loading")
      performanceRef.current = new CharacterPerformanceController({ targetRoot: root, donorRoot: donorRef.current.root, donorClips: donorRef.current.clips })
      const result = performanceRef.current.idle()
      setActive("Idle_Loop")
      setReport(result.report)
    } catch (e) {
      setError(`Avatar load failed: ${e.message || e}`)
    }
  }

  const play = (name) => {
    try {
      const result = performanceRef.current?.play(name)
      if (!result) throw new Error("Load the avatar first")
      setActive(name)
      setReport(result.report)
    } catch (e) { setError(e.message || String(e)) }
  }

  const command = async (kind) => {
    try {
      if (!performanceRef.current) throw new Error("Load the avatar first")
      setError("")
      if (kind === "jump") await performanceRef.current.jump()
      else if (kind === "sit") await performanceRef.current.sit()
      else if (kind === "stand") await performanceRef.current.stand()
      else performanceRef.current.react(kind)
      setActive(performanceRef.current.currentName)
      setReport(performanceRef.current.lastReport)
    } catch (e) { setError(e.message || String(e)) }
  }

  const angleText = useMemo(() => angles ? Object.entries(angles).map(([k, v]) => `${k}: ${v == null ? "—" : v.toFixed(1)}°`).join(" · ") : "—", [angles])

  return <div style={ui.page}>
    <aside style={ui.panel}>
      <div style={ui.title}>CHARACTER 2027 — PRODUCTION CLOSE</div>
      <div style={ui.small}>Advanced prototype preserved. Donor keyframes are untouched. Procedural knee/elbow IK is OFF in this lab; donor motion is transferred through source-rest → target-rest basis correction and blended with AnimationMixer.</div>

      <div style={ui.section}>
        <b style={{ fontSize: 12 }}>1. CUSTOM AVATAR</b>
        <input style={{ display: "block", marginTop: 8 }} type="file" accept=".glb,.gltf,.vrm" onChange={(e) => e.target.files?.[0] && loadAvatar(e.target.files[0])} />
        <div style={ui.pre}>{avatarName}</div>
        {rig && <div style={rig.pass ? ui.good : ui.bad}>{rig.pass ? "CRITICAL RIG: PASS" : `CRITICAL RIG: REVIEW — ${rig.missing.join(", ")}`}</div>}
        <button style={ui.button} onClick={() => setShowSkeleton((v) => !v)}>{showSkeleton ? "Hide" : "Show"} skeleton debug</button>
        <div style={{ ...ui.pre, marginTop: 8 }}>LIVE HINGE ANGLES · {angleText}</div>
      </div>

      <div style={ui.section}>
        <b style={{ fontSize: 12 }}>2. FLUID PERFORMANCE / REAL REACTIONS</b>
        <button style={ui.button} onClick={() => command("conversation")}>CONVERSATION — donor talking reaction</button>
        <button style={ui.button} onClick={() => command("object")}>NOTICE / INTERACT — donor interaction</button>
        <button style={ui.button} onClick={() => command("pickup")}>PICK UP — donor pickup</button>
        <button style={ui.button} onClick={() => command("impact-head")}>REACT HEAD — donor hit reaction</button>
        <button style={ui.button} onClick={() => command("impact-chest")}>REACT CHEST — donor hit reaction</button>
        <button style={ui.button} onClick={() => command("jump")}>JUMP — start → air → land → idle</button>
        <button style={ui.button} onClick={() => command("sit")}>SIT — enter → idle</button>
        <button style={ui.button} onClick={() => command("stand")}>STAND — exit → idle</button>
        <button style={ui.button} onClick={() => command("celebrate")}>CELEBRATE — donor dance reaction</button>
      </div>

      <div style={ui.section}>
        <b style={{ fontSize: 12 }}>3. COMPLETE DONOR LIBRARY</b>
        <div style={ui.pre}>{manifest ? `${manifest.animationCount} manifest clips` : "Loading manifest…"} · runtime {clips.length} clips</div>
        {clips.map((name) => <button key={name} style={{ ...ui.button, ...(active === name ? ui.active : {}) }} onClick={() => play(name)}>{name}</button>)}
      </div>

      <div style={ui.section}>
        <b style={{ fontSize: 12 }}>RETARGET AUDIT</b>
        <div style={ui.pre}>{report ? JSON.stringify(report, null, 2) : "No motion played yet"}</div>
      </div>
      {error && <div style={ui.bad}>{error}</div>}
    </aside>
    <main ref={mountRef} style={ui.stage} />
  </div>
}
