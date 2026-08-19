import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const donorDir = path.join(root, 'public/vendor/quaternius-u-a-l')
const gltfPath = path.join(donorDir, 'AnimationLibrary_Godot_Standard.gltf')
const outPath = path.join(donorDir, 'manifest.json')

if (!fs.existsSync(gltfPath)) {
  throw new Error(`Missing donor glTF: ${gltfPath}`)
}

const gltf = JSON.parse(fs.readFileSync(gltfPath, 'utf8'))
const animations = (gltf.animations || []).map((animation, index) => ({
  index,
  name: animation.name || `animation_${index}`,
  channels: animation.channels?.length || 0,
  samplers: animation.samplers?.length || 0,
}))

const nodes = (gltf.nodes || []).map((node, index) => ({
  index,
  name: node.name || '',
})).filter((node) => node.name)

const lower = (value) => String(value || '').toLowerCase()
const classify = (name) => {
  const n = lower(name)
  const rules = [
    ['WALK', ['walk']],
    ['RUN', ['run', 'jog']],
    ['JUMP', ['jump']],
    ['IDLE', ['idle']],
    ['CROUCH', ['crouch', 'squat']],
    ['SIT', ['sit', 'sitting']],
    ['KNEEL', ['kneel']],
    ['STEP', ['step', 'stair']],
    ['PICKUP', ['pick', 'grab', 'lift']],
    ['WAVE', ['wave']],
  ]
  for (const [kind, tokens] of rules) {
    if (tokens.some((token) => n.includes(token))) return kind
  }
  return 'OTHER'
}

const manifest = {
  schema: 'character2027.quaternius-motion-manifest.v1',
  source: {
    repository: 'J-Ponzo/gltf-universal-animation-library',
    author: 'Quaternius',
    license: 'CC0-1.0',
    donorCommit: 'e24c23cf2a1323488a3faa226ea7ea21f644b73e',
    asset: 'glTF/AnimationLibrary_Godot_Standard.gltf',
  },
  immutableSourcePolicy: true,
  animationCount: animations.length,
  animations: animations.map((animation) => ({
    ...animation,
    kind: classify(animation.name),
  })),
  namedNodes: nodes,
}

fs.mkdirSync(donorDir, { recursive: true })
fs.writeFileSync(outPath, `${JSON.stringify(manifest, null, 2)}\n`)
console.log(`Quaternius donor manifest: ${animations.length} animations, ${nodes.length} named nodes`)
for (const animation of manifest.animations) {
  console.log(`${String(animation.index).padStart(3, '0')}  ${animation.kind.padEnd(8)}  ${animation.name}`)
}
