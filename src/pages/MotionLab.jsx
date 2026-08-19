import React, { useEffect, useRef, useState } from "react"
import * as THREE from "three"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader"
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls"
import { inspectHumanoid, unifyCompatibleSkeletons } from "../character2027/rig/BoneMap"
import { retargetClipToCharacter } from "../character2027/animation/Retargeter"
import { MotionController, MOTION_STATES } from "../character2027/animation/MotionController"
import { registerBaselineMotionSet } from "../character2027/animation/ProceduralMotionLibrary"
import { registerMotionFoundationV2, V2_GROUPS } from "../character2027/animation/MotionFoundationV2"
import { registerMotionFoundationV2Extra, V2_EXTRA_VERTICAL } from "../character2027/animation/MotionFoundationV2Extra"
import { createInteractionBenchmarks } from "../character2027/interaction/InteractionBenchmarks"
import { LookAtController } from "../character2027/interaction/LookAtController"
import { CharacterActionAPI } from "../character2027/api/CharacterActionAPI"
import { runMotionLabFoundationAction } from "../character2027/lab/MotionLabLocomotion"

const loaderGLTF = new GLTFLoader()
const loaderFBX = new FBXLoader()

const ui = {
  page: { position: "fixed", inset: 0, display: "grid", gridTemplateColumns: "410px 1fr", background: "#111", color: "#eee", fontFamily: "Inter, system-ui, sans-serif" },
  panel: { padding: 18, overflowY: "auto", borderRight: "1px solid #333", background: "#171717" },
  stage: { position: "relative", minWidth: 0 },
  title: { fontSize: 20, fontWeight: 800, marginBottom: 4 },
  subtitle: { fontSize: 12, opacity: 0.65, marginBottom: 18, lineHeight: 1.45 },
  section: { marginTop: 18, paddingTop: 16, borderTop: "1px solid #333" },
  label: { display: "block", fontSize: 12, fontWeight: 800, marginBottom: 8 },
  input: { width: "100%", boxSizing: "border-box", fontSize: 12 },
  button: { width: "100%", padding: "9px 11px", marginTop: 6, border: "1px solid #555", borderRadius: 6, background: "#242424", color: "#fff", cursor: "pointer", textAlign: "left" },
  activeButton: { background: "#f2f2f2", color: "#111", borderColor: "#f2f2f2" },
  badge: { display: "inline-block", padding: "3px 7px", borderRadius: 999, border: "1px solid #555", marginRight: 5, marginBottom: 5, fontSize: 11 },
  pre: { whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 11, lineHeight: 1.4, color: "#bbb" },
  error: { fontSize: 11, lineHeight: 1.4, color: "#ff8b8b" },
  group: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 },
}

function loadObjectURL(file, loader) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    loader.load(url, (data) => { URL.revokeObjectURL(url); resolve(data) }, undefined, (error) => { URL.revokeObjectURL(url); reject(error) })
  })
}

async function loadAnimationFile(file) {
  const ext = file.name.split(".").pop()?.toLowerCase()
  if (ext === "fbx") {
    const root = await loadObjectURL(file, loaderFBX)
    return { root, clips: root.animations || [] }
  }
  if (["glb", "gltf", "vrm"].includes(ext)) {
    const gltf = await loadObjectURL(file, loaderGLTF)
    return { root: gltf.scene, clips: gltf.animations || [] }
  }
  throw new Error("Animation must be .fbx, .glb, .gltf or .vrm")
}

export default function MotionLab() {
  const mountRef = useRef(null)
  const sceneRef = useRef(null)
  const avatarRef = useRef(null)
  const controllerRef = useRef(null)
  const lookAtRef = useRef(null)
  const actionApiRef = useRef(null)
  const benchmarksRef = useRef(null)
  const frameRef = useRef(null)
  const clockRef = useRef(new THREE.Clock())

  const [avatarName, setAvatarName] = useState("No avatar loaded")
  const [rigReport, setRigReport] = useState(null)
  const [skeletonReport, setSkeletonReport] = useState(null)
  const [state, setState] = useState(null)
  const [slotReports, setSlotReports] = useState({})
  const [baselineReady, setBaselineReady] = useState(false)
  const [v2Ready, setV2Ready] = useState(false)
  const [navStatus, setNavStatus] = useState("Not tested")
  const [error, setError] = useState("")

  useEffect(() => {
    const mount = mountRef.current
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x101010)
    const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 100)
    camera.position.set(3.4, 2.0, 5.6)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.shadowMap.enabled = true
    renderer.domElement.style.width = "100%"
    renderer.domElement.style.height = "100%"
    mount.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.target.set(0, 1, 0)
    controls.enableDamping = true
    scene.add(new THREE.HemisphereLight(0xffffff, 0x333333, 2.1))
    const key = new THREE.DirectionalLight(0xffffff, 3.0)
    key.position.set(3, 5, 4); key.castShadow = true; scene.add(key)

    const floor = new THREE.Mesh(new THREE.CircleGeometry(5, 72), new THREE.MeshStandardMaterial({ color: 0x242424, roughness: 0.9 }))
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor)

    const markerMaterial = new THREE.MeshStandardMaterial({ color: 0x888888, emissive: 0x222222 })
    const leftMarker = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 16), markerMaterial)
    leftMarker.position.set(-1.35, 0.06, 0.65); scene.add(leftMarker)
    const rightMarker = leftMarker.clone(); rightMarker.position.set(1.35, 0.06, 0.65); scene.add(rightMarker)

    benchmarksRef.current = createInteractionBenchmarks(scene)
    sceneRef.current = scene

    const resize = () => {
      const rect = mount.getBoundingClientRect()
      camera.aspect = rect.width / Math.max(rect.height, 1)
      camera.updateProjectionMatrix()
      renderer.setSize(rect.width, rect.height, false)
    }
    resize(); window.addEventListener("resize", resize)

    const tick = () => {
      frameRef.current = requestAnimationFrame(tick)
      const delta = Math.min(clockRef.current.getDelta(), 0.05)
      controllerRef.current?.update(delta)
      lookAtRef.current?.update(delta)
      controls.update(); renderer.render(scene, camera)
    }
    tick()

    return () => {
      cancelAnimationFrame(frameRef.current); window.removeEventListener("resize", resize)
      actionApiRef.current?.dispose(); controllerRef.current?.dispose(); controls.dispose(); renderer.dispose()
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement)
    }
  }, [])

  const loadAvatar = async (file) => {
    setError("")
    try {
      const gltf = await loadObjectURL(file, loaderGLTF)
      const root = gltf.scene
      root.traverse((node) => { if (node.isMesh) { node.castShadow = true; node.receiveShadow = true } })
      if (avatarRef.current) sceneRef.current.remove(avatarRef.current)
      actionApiRef.current?.dispose()
      controllerRef.current?.dispose()

      const box = new THREE.Box3().setFromObject(root)
      const size = box.getSize(new THREE.Vector3())
      root.scale.multiplyScalar(1.75 / Math.max(size.y, 0.0001))
      root.updateMatrixWorld(true)
      const scaledBox = new THREE.Box3().setFromObject(root)
      const center = scaledBox.getCenter(new THREE.Vector3())
      root.position.x -= center.x; root.position.z -= center.z; root.position.y -= scaledBox.min.y
      root.updateMatrixWorld(true)

      const normalizedSkeletons = unifyCompatibleSkeletons(root)
      sceneRef.current.add(root)
      avatarRef.current = root
      controllerRef.current = new MotionController(root)
      lookAtRef.current = new LookAtController(root)
      actionApiRef.current = new CharacterActionAPI({
        root,
        controller: controllerRef.current,
        lookAt: lookAtRef.current,
        interactionTargets: benchmarksRef.current?.targets,
        onStateChange: setState,
        onStatus: setNavStatus,
      })
      setSlotReports({}); setState(null); setBaselineReady(false); setV2Ready(false); setNavStatus("Not tested")
      setAvatarName(file.name); setSkeletonReport(normalizedSkeletons); setRigReport(inspectHumanoid(root))
    } catch (e) { setError(`Avatar load failed: ${e.message || e}`) }
  }

  const loadBaseline = () => {
    setError("")
    if (!avatarRef.current || !controllerRef.current) return setError("Load a target avatar first")
    try {
      const reports = registerBaselineMotionSet(controllerRef.current, avatarRef.current)
      setSlotReports((prev) => ({ ...prev, ...reports }))
      controllerRef.current.transitionTo("IDLE"); setState("IDLE"); setBaselineReady(true); setNavStatus("V1 motion set loaded")
    } catch (e) { setError(`Baseline motion failed: ${e.message || e}`) }
  }

  const loadV2 = () => {
    setError("")
    if (!avatarRef.current || !controllerRef.current) return setError("Load a target avatar first")
    try {
      const reports = { ...registerMotionFoundationV2(controllerRef.current, avatarRef.current), ...registerMotionFoundationV2Extra(controllerRef.current, avatarRef.current) }
      setSlotReports((prev) => ({ ...prev, ...reports }))
      controllerRef.current.transitionTo("IDLE_V2"); setState("IDLE_V2"); setV2Ready(true); setNavStatus("Motion Foundation V2 ready")
    } catch (e) { setError(`Motion Foundation V2 failed: ${e.message || e}`) }
  }

  const loadMotion = async (motionState, file) => {
    setError("")
    if (!avatarRef.current || !controllerRef.current) return setError("Load a target avatar first")
    try {
      const { root, clips } = await loadAnimationFile(file)
      const sourceClip = clips.find((clip) => clip.name === "mixamo.com") || clips[0]
      if (!sourceClip) throw new Error("No animation clip found in file")
      const { clip, report } = retargetClipToCharacter(root, sourceClip, avatarRef.current)
      clip.name = motionState
      controllerRef.current.register(motionState, clip, { loop: motionState === "IDLE" || motionState === "WALK" })
      setSlotReports((previous) => ({ ...previous, [motionState]: { file: file.name, duration: clip.duration, ...report } }))
    } catch (e) { setError(`${motionState} failed: ${e.message || e}`) }
  }

  const playState = (motionState) => {
    setError("")
    if (!actionApiRef.current || !avatarRef.current) return setError("Load an avatar first")
    try {
      runMotionLabFoundationAction({ action: motionState, root: avatarRef.current, actionApi: actionApiRef.current })
    } catch (e) { setError(e.message || String(e)) }
  }

  const walkTo = (name, target) => {
    setError("")
    if (!actionApiRef.current) return setError("Load an avatar first")
    try {
      actionApiRef.current.moveTo(target, { label: name, walkSpeed: 0.78, stopDistance: 0.08 })
    } catch (e) { setError(e.message || String(e)) }
  }

  const playInteraction = (name) => {
    setError("")
    if (!actionApiRef.current) return setError("Load an avatar first")
    try { actionApiRef.current.interact(name) }
    catch (e) { setError(e.message || String(e)) }
  }

  const targetLookAt = () => {
    setError("")
    if (!actionApiRef.current) return setError("Load avatar first")
    try {
      actionApiRef.current.lookAt(new THREE.Vector3(1.4, 1.45, -1.3), { weight: 1, status: "Target-aware lookAt active" })
    } catch (e) { setError(e.message || String(e)) }
  }

  const actionButtons = (actions) => <div style={ui.group}>{actions.map(name => <button key={name} style={{ ...ui.button, ...(state === name ? ui.activeButton : {}) }} disabled={!v2Ready} onClick={() => playState(name)}>{name}</button>)}</div>

  return (
    <div style={ui.page}>
      <aside style={ui.panel}>
        <div style={ui.title}>CHARACTER 2027 — MOTION LAB V2</div>
        <div style={ui.subtitle}>Biomechanics + vertical mobility + social behaviour + semantic interaction benchmarks. GLB preferred; VRM accepted.</div>

        <label style={ui.label}>1. TARGET AVATAR (.glb / .gltf / .vrm)</label>
        <input style={ui.input} type="file" accept=".glb,.gltf,.vrm" onChange={(e) => e.target.files?.[0] && loadAvatar(e.target.files[0])} />
        <div style={ui.section}>
          <div style={ui.label}>Avatar</div><div style={ui.pre}>{avatarName}</div>
          {rigReport && <div style={{ marginTop: 9 }}>
            <span style={ui.badge}>{rigReport.pass ? "RIG PASS" : "RIG REVIEW"}</span>
            <span style={ui.badge}>{rigReport.boneCount} bones</span><span style={ui.badge}>{rigReport.skinnedMeshCount} skins</span>
            {skeletonReport && <span style={ui.badge}>{skeletonReport.unifiedMeshes}/{Math.max(skeletonReport.skinnedMeshes - 1, 0)} unified</span>}
          </div>}
        </div>

        <div style={ui.section}>
          <div style={ui.label}>2. MOTION FOUNDATION V2</div>
          <button style={ui.button} onClick={loadV2}>LOAD MOTION FOUNDATION V2</button>
          <div style={ui.pre}>{v2Ready ? "READY — V2 action library registered" : "Not loaded"}</div>
          {actionButtons(["IDLE_V2","WALK_V2","STOP_V2","TURN_LEFT_V2","TURN_RIGHT_V2"])}
        </div>

        <div style={ui.section}>
          <div style={ui.label}>3. VERTICAL / TERRAIN</div>
          {actionButtons([...V2_GROUPS.vertical, ...V2_EXTRA_VERTICAL])}
        </div>

        <div style={ui.section}>
          <div style={ui.label}>4. SOCIAL / GUIDANCE</div>
          {actionButtons(V2_GROUPS.social.filter(x => x !== "LOOK_AT"))}
          <button style={ui.button} disabled={!v2Ready} onClick={targetLookAt}>LOOK_AT — TARGET AWARE</button>
        </div>

        <div style={ui.section}>
          <div style={ui.label}>5. UNIVERSAL INTERACTIONS — SEMANTIC BENCHMARKS</div>
          <div style={ui.pre}>Each action approaches a target, looks at it, aligns, then performs the benchmark pose.</div>
          <div style={ui.group}>{V2_GROUPS.interactions.map(name => <button key={name} style={ui.button} disabled={!v2Ready} onClick={() => playInteraction(name)}>{name}</button>)}</div>
        </div>

        <div style={ui.section}>
          <div style={ui.label}>6. LOCOMOTION</div>
          <button style={ui.button} disabled={!v2Ready} onClick={() => walkTo("LEFT TARGET", [-1.35, 0, 0.65])}>WALK TO LEFT TARGET</button>
          <button style={ui.button} disabled={!v2Ready} onClick={() => walkTo("RIGHT TARGET", [1.35, 0, 0.65])}>WALK TO RIGHT TARGET</button>
          <div style={ui.pre}>Status: {navStatus}</div>
        </div>

        <div style={ui.section}>
          <div style={ui.label}>7. LEGACY V1 / OPTIONAL RETARGET</div>
          <button style={ui.button} onClick={loadBaseline}>LOAD V1 BASELINE</button>
          {MOTION_STATES.map((motionState) => <div key={motionState} style={{ marginTop: 7 }}><div style={{ fontSize: 11, fontWeight: 700 }}>{motionState}</div><input style={ui.input} type="file" accept=".fbx,.glb,.gltf,.vrm" onChange={(e) => e.target.files?.[0] && loadMotion(motionState, e.target.files[0])} /></div>)}
        </div>

        <div style={ui.section}><div style={ui.label}>8. REPORT</div><div style={ui.pre}>{state && slotReports[state] ? JSON.stringify(slotReports[state], null, 2) : "Load Motion Foundation V2."}</div></div>
        {error && <div style={{ ...ui.section, ...ui.error }}>{error}</div>}
      </aside>
      <main ref={mountRef} style={ui.stage} />
    </div>
  )
}
