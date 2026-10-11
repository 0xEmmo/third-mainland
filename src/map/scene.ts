import * as THREE from 'three/webgpu'
import type { Node } from 'three/webgpu'
import {
  color as tslColor,
  clamp,
  float,
  floor,
  fract,
  min,
  mix,
  normalize,
  positionGeometry,
  smoothstep,
  step,
  texture,
  uniform,
  uv,
  varying,
  vec2,
  vec3,
  vec4,
  attribute,
} from 'three/tsl'
import type { MapData } from '../data/schema'
import type { Corridor } from '../model/types'
import { resample } from '../geo/polyline'
import type { Point } from '../geo/project'
import { buildParticles, MODE_COLOR } from './flows'
import type { Size, View } from './camera'

/** Samples per corridor in the path texture. Longest line is ~40 km, so ~80 m apart, interpolated. */
const SAMPLES = 512

const PALETTE = {
  water: '#03060b',
  shore: '#284a63',
  street: '#16212b',
  unlit: '#24313d',
}

export type Backend = 'WebGPU' | 'WebGL 2'

export interface LineState {
  /** Layer on and not filtered out. */
  visible: boolean
  selected: boolean
  /** Something else is selected, so this line steps back. */
  dimmed: boolean
}

export interface MapScene {
  readonly backend: Backend
  readonly particleCount: number
  setView(view: View, size: Size): void
  /** Per direction (corridor * 2 + dir): progress along the line, density and brightness. */
  setFlowState(progress: Float32Array, density: Float32Array, brightness: Float32Array): void
  setLines(states: readonly LineState[]): void
  render(): void
  resize(size: Size, pixelRatio: number): void
  dispose(): void
  onContextLost(cb: () => void): void
}

export interface SceneOptions {
  forceWebGL?: boolean
  particles?: number
}

function floatTexture(data: Float32Array, width: number, height: number) {
  const tex = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.FloatType)
  tex.minFilter = THREE.NearestFilter
  tex.magFilter = THREE.NearestFilter
  tex.generateMipmaps = false
  tex.needsUpdate = true
  return tex
}

/** A strip two vertices wide along a polyline; width is applied in the shader so it stays the same in pixels at any zoom. */
function ribbonGeometry(line: readonly Point[]) {
  const n = line.length
  const position = new Float32Array(n * 2 * 3)
  const miter = new Float32Array(n * 2 * 2)
  const side = new Float32Array(n * 2)
  const index: number[] = []
  for (let i = 0; i < n; i++) {
    const p = line[i]!
    const a = line[Math.max(0, i - 1)]!
    const b = line[Math.min(n - 1, i + 1)]!
    let dx = b[0] - a[0]
    let dy = b[1] - a[1]
    const len = Math.hypot(dx, dy) || 1
    dx /= len
    dy /= len
    // Scale the miter at sharp corners, capped so hairpins don't spike.
    let scale = 1
    if (i > 0 && i < n - 1) {
      const sx = p[0] - a[0]
      const sy = p[1] - a[1]
      const sl = Math.hypot(sx, sy) || 1
      const cos = Math.abs((sx / sl) * dx + (sy / sl) * dy)
      scale = Math.min(2, 1 / Math.max(cos, 0.5))
    }
    for (let s = 0; s < 2; s++) {
      const v = i * 2 + s
      position.set([p[0], p[1], 0], v * 3)
      miter.set([-dy * scale, dx * scale], v * 2)
      side[v] = s === 0 ? 1 : -1
    }
    if (i < n - 1) {
      const v = i * 2
      index.push(v, v + 1, v + 2, v + 1, v + 3, v + 2)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(position, 3))
  g.setAttribute('miter', new THREE.BufferAttribute(miter, 2))
  g.setAttribute('side', new THREE.BufferAttribute(side, 1))
  g.setIndex(index)
  return g
}

export async function createMapScene(canvas: HTMLCanvasElement, data: MapData, corridors: readonly Corridor[], options: SceneOptions = {}): Promise<MapScene> {
  const renderer = new THREE.WebGPURenderer({ canvas, antialias: true, alpha: true, forceWebGL: options.forceWebGL ?? false })
  renderer.setClearColor(0x000000, 0)
  await renderer.init()
  const backend: Backend = (renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend ? 'WebGPU' : 'WebGL 2'

  const scene = new THREE.Scene()
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100)
  camera.position.set(0, 0, 10)

  /** Kilometres per CSS pixel; lets widths and dot sizes stay constant on screen. */
  const kmPerPx = uniform(0.03)
  const disposables: { dispose(): void }[] = []
  const track = <T extends { dispose(): void }>(x: T) => {
    disposables.push(x)
    return x
  }

  /* Water */
  const waterMat = track(new THREE.MeshBasicNodeMaterial({ color: PALETTE.water }))
  const shoreMat = track(new THREE.LineBasicNodeMaterial({ color: PALETTE.shore, transparent: true, opacity: 0.85 }))
  const shore: number[] = []
  for (const polygon of data.water) {
    const [outer, ...holes] = polygon
    if (!outer || outer.length < 3) continue
    const shape = new THREE.Shape(outer.map(([x, y]) => new THREE.Vector2(x, y)))
    shape.holes = holes.map((h) => new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))))
    const mesh = new THREE.Mesh(track(new THREE.ShapeGeometry(shape)), waterMat)
    mesh.renderOrder = 0
    scene.add(mesh)
    for (const ring of polygon) for (let i = 1; i < ring.length; i++) shore.push(ring[i - 1]![0], ring[i - 1]![1], 0.01, ring[i]![0], ring[i]![1], 0.01)
  }
  const shoreGeo = track(new THREE.BufferGeometry())
  shoreGeo.setAttribute('position', new THREE.Float32BufferAttribute(shore, 3))
  const shoreLines = new THREE.LineSegments(shoreGeo, shoreMat)
  shoreLines.renderOrder = 1
  scene.add(shoreLines)

  /* Street mesh */
  const seg: number[] = []
  for (const line of data.streets) for (let i = 1; i < line.length; i++) seg.push(line[i - 1]![0], line[i - 1]![1], 0.02, line[i]![0], line[i]![1], 0.02)
  const streetGeo = track(new THREE.BufferGeometry())
  streetGeo.setAttribute('position', new THREE.Float32BufferAttribute(seg, 3))
  const streets = new THREE.LineSegments(streetGeo, track(new THREE.LineBasicNodeMaterial({ color: PALETTE.street })))
  streets.renderOrder = 1
  scene.add(streets)

  /* Corridor ribbons: an unlit road, a thin lit line and a soft glow for the selected one */
  interface Ribbon {
    width: { value: number }
    opacity: { value: number }
    mesh: THREE.Mesh
  }
  const makeRibbon = (geo: THREE.BufferGeometry, color: string, width: number, opacity: number, order: number, z: number): Ribbon => {
    const w = uniform(width)
    const o = uniform(opacity)
    const mat = track(new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false }))
    const miter = attribute('miter', 'vec2')
    const side = attribute('side', 'float')
    mat.positionNode = vec3(positionGeometry.xy.add(miter.mul(side).mul(w).mul(0.5).mul(kmPerPx)), z)
    mat.colorNode = vec4(tslColor(color), o)
    if (order >= 4) mat.blending = THREE.AdditiveBlending
    const mesh = new THREE.Mesh(geo, mat)
    mesh.renderOrder = order
    mesh.frustumCulled = false
    scene.add(mesh)
    return { width: w, opacity: o, mesh }
  }
  const ribbons = corridors.map((c) => {
    const line = data.corridors[c.id]?.line ?? []
    const geo = track(ribbonGeometry(line))
    return {
      base: makeRibbon(geo, PALETTE.unlit, 2.6, 1, 2, 0.05),
      lit: makeRibbon(geo, MODE_COLOR[c.mode], 1.2, 0.55, 3, 0.06),
      glow: makeRibbon(geo, MODE_COLOR[c.mode], 14, 0, 4, 0.07),
    }
  })

  /* Path texture: each corridor resampled at even spacing, one row per corridor */
  const pathData = new Float32Array(SAMPLES * corridors.length * 4)
  corridors.forEach((c, row) => {
    const line = data.corridors[c.id]?.line ?? [
      [0, 0],
      [0, 0],
    ]
    resample(line, SAMPLES).forEach(([x, y], i) => pathData.set([x, y, 0, 1], (row * SAMPLES + i) * 4))
  })
  const pathTex = track(floatTexture(pathData, SAMPLES, corridors.length))

  const rows = corridors.length * 2
  const stateData = new Float32Array(rows * 4)
  const stateTex = track(floatTexture(stateData, rows, 1))

  /* Particles */
  const lengths = Object.fromEntries(corridors.map((c) => [c.id, data.corridors[c.id]?.length ?? 1]))
  const buffers = buildParticles(corridors, lengths, options.particles ?? 40_000)
  const particleGeo = track(new THREE.PlaneGeometry(1, 1))
  particleGeo.setAttribute('info', new THREE.InstancedBufferAttribute(buffers.info, 4))
  particleGeo.setAttribute('shape', new THREE.InstancedBufferAttribute(buffers.shape, 4))
  particleGeo.setAttribute('tint', new THREE.InstancedBufferAttribute(buffers.color, 3))
  const info = attribute('info', 'vec4') as unknown as Node<'vec4'>
  const shapeAttr = attribute('shape', 'vec4') as unknown as Node<'vec4'>
  const tint = attribute('tint', 'vec3') as unknown as Node<'vec3'>

  const row = info.x
  const dir = info.y
  const state = texture(stateTex, vec2(row.mul(2).add(dir).add(0.5).div(rows), 0.5))
  const t0 = fract(info.z.add(state.x))
  const t = mix(t0, float(1).sub(t0), dir)
  const fi = t.mul(SAMPLES - 1)
  const i0 = floor(fi)
  const f = fi.sub(i0)
  const v = row.add(0.5).div(corridors.length)
  const p0 = texture(pathTex, vec2(i0.add(0.5).div(SAMPLES), v)).xy
  const p1 = texture(pathTex, vec2(min(i0.add(1.5), SAMPLES - 0.5).div(SAMPLES), v)).xy
  const along = normalize(p1.sub(p0).add(vec2(1e-6, 0)))
  // Drive on the right: each direction sits on the right-hand side of its own travel.
  const right = vec2(along.y, along.x.negate()).mul(float(1).sub(dir.mul(2)))
  const on = step(info.w, state.y).mul(state.z)
  const centre = mix(p0, p1, f).add(right.mul(shapeAttr.x).mul(kmPerPx))
  const dotSize = uniform(1)
  const corner = positionGeometry.xy.mul(shapeAttr.y.mul(dotSize).mul(on).mul(kmPerPx).mul(2.2))

  const particleMat = track(new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }))
  particleMat.positionNode = vec3(centre.add(corner), 0.1)
  const r = uv().sub(0.5).length().mul(2)
  const alpha = float(1)
    .sub(smoothstep(0.15, 1, r))
    .mul(clamp(varying(on), 0, 1))
  particleMat.colorNode = vec4(varying(tint).mul(alpha), alpha)

  // InstancedMesh only for the instanced draw call; its matrices stay identity
  // because every position is worked out in the vertex shader.
  const particles = new THREE.InstancedMesh(particleGeo, particleMat, buffers.count)
  particles.frustumCulled = false
  particles.renderOrder = 5
  scene.add(particles)

  let lost: (() => void) | null = null
  const onLost = (e: Event) => {
    e.preventDefault()
    lost?.()
  }
  canvas.addEventListener('webglcontextlost', onLost)
  const device = (renderer.backend as { device?: { lost: Promise<unknown> } }).device
  device?.lost.then(() => lost?.())

  return {
    backend,
    particleCount: buffers.count,
    setView(view, size) {
      const hw = size.width / 2 / view.zoom
      const hh = size.height / 2 / view.zoom
      camera.left = -hw
      camera.right = hw
      camera.top = hh
      camera.bottom = -hh
      camera.position.set(view.x, view.y, 10)
      camera.updateProjectionMatrix()
      kmPerPx.value = 1 / view.zoom
      // Dots grow a touch when zoomed in so the bridge doesn't turn into sand.
      dotSize.value = Math.min(1.8, Math.max(0.85, Math.sqrt(view.zoom / 40)))
    },
    setFlowState(progress, density, brightness) {
      for (let i = 0; i < rows; i++) {
        stateData[i * 4] = progress[i] ?? 0
        stateData[i * 4 + 1] = density[i] ?? 0
        stateData[i * 4 + 2] = brightness[i] ?? 0
      }
      stateTex.needsUpdate = true
    },
    setLines(states) {
      states.forEach((s, i) => {
        const r = ribbons[i]
        if (!r) return
        r.base.mesh.visible = s.visible
        r.lit.mesh.visible = s.visible
        r.glow.mesh.visible = s.visible && s.selected
        r.lit.opacity.value = s.selected ? 0.95 : s.dimmed ? 0.25 : 0.55
        r.lit.width.value = s.selected ? 2.2 : 1.2
        r.glow.opacity.value = s.selected ? 0.16 : 0
      })
    },
    render() {
      renderer.render(scene, camera)
    },
    resize(size, pixelRatio) {
      renderer.setPixelRatio(Math.min(pixelRatio, 2))
      renderer.setSize(size.width, size.height, false)
    },
    dispose() {
      canvas.removeEventListener('webglcontextlost', onLost)
      disposables.forEach((d) => d.dispose())
      renderer.dispose()
    },
    onContextLost(cb) {
      lost = cb
    },
  }
}
