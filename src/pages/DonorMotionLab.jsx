import React, { useEffect, useRef, useState } from "react"
import * as THREE from "three"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls"
import { retargetClipToCharacter } from "../character2027/animation/Retargeter"
import {
  loadQuaterniusManifest,
  loadQuaterniusMotionLibrary,
  QUATERNIUS_BASELINE,
} from "../character2027/animation/QuaterniusMotionSource"
import { inspectHumanoid, unifyCompatibleSkeletons } from "../character2027/rig/BoneMap"

const avatarLoader = new GLTFLoader()

const ui = {
  page: { position: "fixed", inset: 0, display: "grid", gridTemplateColumns: "390px 1fr", background: "#101010", color: "#f3f3f3", fontFamily: "Inter, system-ui, sans-serif" },
  panel: { padding: 18, overflowY: "auto", borderRight: "1px solid #333", background: "#171717" },
  stage: { minWidth: 0 },
  title: { fontSize: 20, fontWeight: 800, marginBottom: 5 },
  small: { fontSize: 11, lineHeight: 1.5, opacity: 0.72 },
  section: { marginTop: 18, paddingTop: 15, borderTop: "1px solid #333" },
  button: { width: "100%", padding: "9px 10px", marginTop: 6, borderRadius: 6, border: "1px solid #555", background: "#262626", color: "#fff", cursor: "pointer", textAlign: "left" },
  active: { background: "#eee", color: "#111" },
  pre: { whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 11, lineHeight: 1.4, color: "#bbb" },
  error: { fontSize: 11, lineHeight: 1.45, color: "#ff8c8c", marginTop: 10 },
}

function loadLocalGltf(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    avatarLoader.load(url, (gltf) => {
      URL.revokeObjectURL(url)
      resolve(gltf)
    }, undefined, (error) => {
      URL.revokeObjectURL(url)
      reject(error)
    })
  })
}

export default function DonorMotionLab() {
  const mountRef = useRef(null)
  const sceneRef = useRef(null)
  const avatarRef = useRef(null)
  const mixerRef = useRef(null)
  const actionRef = useRef(null)
  const clockRef = useRef(new THREE.Clock())
  const frameRef = useRef(null)
  const donorRef = useRef(null)

  const [manifest, setManifest] = useState(null)
  const [avatarName, setAvatarName] = useState("No avatar loaded")
  const [rigReport, setRigReport] = useState(null)
  const [activeClip, setActiveClip] = useState(null)
  const [retargetReport, setRetargetReport] = useState(null)
  const [error, setError] = useState("")

  useEffect(() => {
    let cancelled = false
    Promise.all([loadQuaterniusManifest(), loadQuaterniusMotionLibrary()])
      .then(([nextManifest, library]) => {
        if (cancelled) return
        setManifest(nextManifest)
        donorRef.current = library
      })
      .catch((e) => !cancelled && setError(`Donor load failed: ${e.message || e}`))
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const mount = mountRef.current
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x101010)
    const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 100)
    camera.position.set(3.2, 1.8, 5.2)
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
    scene.add(new THREE.HemisphereLight(0xffffff, 0x333333, 2.2))
    const key = new THREE.DirectionalLight(0xffffff, 3.2)
    key.position.set(3, 5, 4)
    key.castShadow = true
    scene.add(key)
    const floor = new THREE.Mesh(new THREE.CircleGeometry(5, 72), new THREE.MeshStandardMaterial({ color: 0x252525, roughness: 0.9 }))
    floor.rotation.x = -Math.PI / 2
    floor.receiveShadow = true
    scene.add(floor)
    sceneRef.current = scene

    const resize = () => {
      const rect = mount.getBoundingClientRect()
      camera.aspect = rect.width / Math.max(rect.height, 1)
      camera.updateProjectionMatrix()
      renderer.setSize(rect.width, rect.height, false)
    }
    resize()
    window.addEventListener("resize", resize)

    const tick = () => {
      frameRef.current = requestAnimationFrame(tick)
      const delta = Math.min(clockRef.current.getDelta(), 0.05)
      mixerRef.current?.update(delta)
      controls.update()
      renderer.render(scene, camera)
    }
    tick()

    return () => {
      cancelAnimationFrame(frameRef.current)
      window.removeEventListener("resize", resize)
      actionRef.current?.stop()
      mixerRef.current?.stopAllAction()
      controls.dispose()
      renderer.dispose()
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement)
    }
  }, [])

  const loadAvatar = async (file) => {
    setError("")
    try {
      const gltf = await loadLocalGltf(file)
      const root = gltf.scene
      root.traverse((node) => {
        if (node.isMesh) {
          node.castShadow = true
          node.receiveShadow = true
        }
      })
      if (avatarRef.current) sceneRef.current.remove(avatarRef.current)
      actionRef.current?.stop()
      mixerRef.current?.stopAllAction()

      const box = new THREE.Box3().setFromObject(root)
      const size = box.getSize(new THREE.Vector3())
      root.scale.multiplyScalar(1.75 / Math.max(size.y, 0.0001))
      root.updateMatrixWorld(true)
      const scaledBox = new THREE.Box3().setFromObject(root)
      const center = scaledBox.getCenter(new THREE.Vector3())
      root.position.x -= center.x
      root.position.z -= center.z
      root.position.y -= scaledBox.min.y
      root.updateMatrixWorld(true)

      unifyCompatibleSkeletons(root)
      sceneRef.current.add(root)
      avatarRef.current = root
      mixerRef.current = new THREE.AnimationMixer(root)
      setAvatarName(file.name)
      setRigReport(inspectHumanoid(root))
      setActiveClip(null)
      setRetargetReport(null)
    } catch (e) {
      setError(`Avatar load failed: ${e.message || e}`)
    }
  }

  const playDonorClip = (clipName) => {
    setError("")
    if (!avatarRef.current || !mixerRef.current) return setError("Load a target avatar first")
    if (!donorRef.current) return setError("Quaternius donor library is not ready")
    try {
      const sourceClip = donorRef.current.clips.find((clip) => clip.name === clipName)
      if (!sourceClip) throw new Error(`Donor clip not found: ${clipName}`)
      const { clip, report } = retargetClipToCharacter(donorRef.current.root, sourceClip, avatarRef.current)
      clip.name = `DONOR_${clipName}`
      actionRef.current?.stop()
      mixerRef.current.stopAllAction()
      const action = mixerRef.current.clipAction(clip)
      const loops = /Loop|Idle|Walk|Jog|Crouch_Fwd/.test(clipName)
      action.setLoop(loops ? THREE.LoopRepeat : THREE.LoopOnce, loops ? Infinity : 1)
      action.clampWhenFinished = !loops
      action.reset().play()
      actionRef.current = action
      setActiveClip(clipName)
      setRetargetReport({
        ...report,
        donorClip: clipName,
        duration: clip.duration,
        sourceTracks: sourceClip.tracks.length,
      })
    } catch (e) {
      setError(`Donor playback failed: ${e.message || e}`)
    }
  }

  const baseline = [
    ["IDLE", QUATERNIUS_BASELINE.IDLE],
    ["WALK", QUATERNIUS_BASELINE.WALK],
    ["CROUCH", QUATERNIUS_BASELINE.CROUCH],
    ["JUMP START", QUATERNIUS_BASELINE.JUMP_START],
    ["JUMP AIR", QUATERNIUS_BASELINE.JUMP_AIR],
    ["JUMP LAND", QUATERNIUS_BASELINE.JUMP_LAND],
    ["SIT ENTER", QUATERNIUS_BASELINE.SIT_ENTER],
    ["SIT IDLE", QUATERNIUS_BASELINE.SIT_IDLE],
    ["SIT EXIT", QUATERNIUS_BASELINE.SIT_EXIT],
    ["KNEEL", QUATERNIUS_BASELINE.KNEEL],
    ["PICKUP", QUATERNIUS_BASELINE.PICKUP_TABLE],
  ]

  return (
    <div style={ui.page}>
      <aside style={ui.panel}>
        <div style={ui.title}>CHARACTER 2027 — DONOR MOTION LAB</div>
        <div style={ui.small}>Donor-first validation. Quaternius keyframes are not rewritten or biomechanically “improved”. Only retarget mapping is applied.</div>

        <div style={ui.section}>
          <div style={{ fontWeight: 800, fontSize: 12, marginBottom: 8 }}>1. TARGET AVATAR</div>
          <input type="file" accept=".glb,.gltf,.vrm" onChange={(e) => e.target.files?.[0] && loadAvatar(e.target.files[0])} />
          <div style={{ ...ui.pre, marginTop: 8 }}>{avatarName}</div>
          {rigReport && <div style={ui.pre}>Rig: {rigReport.pass ? "PASS" : "REVIEW"} · bones {rigReport.boneCount} · skins {rigReport.skinnedMeshCount}</div>}
        </div>

        <div style={ui.section}>
          <div style={{ fontWeight: 800, fontSize: 12 }}>2. PINNED QUATERNIUS DONOR</div>
          <div style={ui.pre}>{manifest ? `${manifest.animationCount} clips · ${manifest.source.license} · ${manifest.source.donorCommit.slice(0, 12)}` : "Loading donor…"}</div>
        </div>

        <div style={ui.section}>
          <div style={{ fontWeight: 800, fontSize: 12, marginBottom: 6 }}>3. PROVEN MOTION CLIPS</div>
          {baseline.map(([label, clipName]) => (
            <button key={clipName} style={{ ...ui.button, ...(activeClip === clipName ? ui.active : {}) }} onClick={() => playDonorClip(clipName)}>
              {label} — {clipName}
            </button>
          ))}
        </div>

        <div style={ui.section}>
          <div style={{ fontWeight: 800, fontSize: 12 }}>RETARGET REPORT</div>
          <div style={ui.pre}>{retargetReport ? JSON.stringify(retargetReport, null, 2) : "No donor clip played yet"}</div>
        </div>

        {error && <div style={ui.error}>{error}</div>}
      </aside>
      <main ref={mountRef} style={ui.stage} />
    </div>
  )
}
