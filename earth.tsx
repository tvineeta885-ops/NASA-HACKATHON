'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowDownRight, Crosshair, Pause, Play } from 'lucide-react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import type { Cell, Layer } from './contract'
import world from './assets/world.jpg'
import still from './assets/earth-still.webp'

type Focus = { lat: number; lon: number }
type PointSet = { cells: Cell[]; layer: Layer }
type EarthProps = PointSet & { focus: Focus; date: string; area: string; onShowHotspots?: () => void }
type Flight = { from: THREE.Spherical; to: THREE.Spherical; zoom: boolean; start?: number; arrived?: () => void }

const europe = { lat: 34, lon: -24 }
const surface = 1
const rad = Math.PI / 180
const colors = { MODIS: '#ffd18d', VIIRS: '#ff6c45', shared: '#fff2d4' }

function position(lat: number, lon: number, radius: number) {
  const phi = lat * rad
  const theta = lon * rad
  return new THREE.Vector3(radius * Math.cos(phi) * Math.cos(theta), radius * Math.sin(phi), -radius * Math.cos(phi) * Math.sin(theta))
}

function graticule() {
  const vertices: number[] = []
  function line(points: THREE.Vector3[]) {
    for (let i = 1; i < points.length; i++) vertices.push(...points[i - 1].toArray(), ...points[i].toArray())
  }
  for (let lat = -60; lat <= 60; lat += 30) {
    line(Array.from({ length: 97 }, (_, i) => position(lat, i * 3.75, 1.001)))
  }
  for (let lon = 0; lon < 360; lon += 30) {
    line(Array.from({ length: 49 }, (_, i) => position(-90 + i * 3.75, lon, 1.001)))
  }
  return new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
}

export function EarthPlaceholder() {
  return <div className="earth-placeholder" aria-hidden="true" style={{ backgroundImage: `url(${still.src})` }} />
}

export default function Earth({ cells, layer, focus, date, area, onShowHotspots }: EarthProps) {
  const container = useRef<HTMLDivElement>(null)
  const sceneApi = useRef<{
    drawPoints: (data: PointSet) => void
    flyTo: (target: Focus, zoom?: boolean, arrived?: () => void) => void
    animate: (active: boolean) => void
  } | null>(null)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    const element = container.current!
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power', canvas: document.createElement('canvas') })
    } catch {
      setFailed(true)
      return
    }
    renderer.setClearColor(0x000000, 0)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.65))
    const canvas = renderer.domElement
    canvas.setAttribute('aria-label', 'Interactive 3D Earth. Drag or use the arrow keys to rotate.')
    canvas.tabIndex = 0
    element.append(canvas)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(33, 1, 0.1, 25)
    const controls = new OrbitControls(camera, canvas)
    controls.enablePan = false
    controls.enableZoom = false
    controls.rotateSpeed = 0.52
    controls.autoRotateSpeed = 0.8
    controls.minPolarAngle = 0.09
    controls.maxPolarAngle = Math.PI - 0.09

    const sphere = new THREE.SphereGeometry(surface, 80, 56)
    const material = new THREE.MeshStandardMaterial({ color: 0xf2f8fa, roughness: 1 })
    scene.add(new THREE.Mesh(sphere, material), new THREE.HemisphereLight(0xc9eaff, 0x40516a, 1.4))
    const keyLight = new THREE.DirectionalLight(0xffe8d8, 2.15)
    scene.add(keyLight)
    const grid = graticule()
    const gridInk = new THREE.LineBasicMaterial({ color: 0xafcbe4, transparent: true, opacity: 0.17, depthWrite: false })
    scene.add(new THREE.LineSegments(grid, gridInk))

    const atmosphere = new THREE.ShaderMaterial({
      vertexShader: `varying vec3 normalView; varying vec3 viewDir;
        void main() { vec4 view = modelViewMatrix * vec4(position * 1.033, 1.0); normalView = normalize(normalMatrix * normal); viewDir = normalize(-view.xyz); gl_Position = projectionMatrix * view; }`,
      fragmentShader: `varying vec3 normalView; varying vec3 viewDir;
        void main() { float edge = pow(1.0 - clamp(abs(dot(normalize(normalView), normalize(viewDir))), 0.0, 1.0), 3.2); gl_FragColor = vec4(0.40, 0.68, 0.91, edge * 0.39); }`,
      side: THREE.BackSide, transparent: true, depthWrite: false,
    })
    scene.add(new THREE.Mesh(sphere, atmosphere))

    const marker = document.createElement('canvas')
    marker.width = marker.height = 32
    const brush = marker.getContext('2d')!
    const glow = brush.createRadialGradient(16, 16, 0, 16, 16, 16)
    glow.addColorStop(0, '#ffffff')
    glow.addColorStop(0.4, '#ffffff')
    glow.addColorStop(0.55, '#ffffff75')
    glow.addColorStop(1, '#ffffff00')
    brush.fillStyle = glow
    brush.fillRect(0, 0, 32, 32)
    const pointTexture = new THREE.CanvasTexture(marker)
    const pointMaterial = new THREE.PointsMaterial({ map: pointTexture, size: 5, sizeAttenuation: false, vertexColors: true, transparent: true, depthWrite: false, alphaTest: 0.07 })
    const points = new THREE.Points(new THREE.BufferGeometry(), pointMaterial)
    scene.add(points)

    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    let disposed = false
    let intersecting = true
    let frame = 0
    let previous = 0
    let distance = 4.15
    let flight: Flight | null = null
    const cameraPath = new THREE.Spherical()
    const lightOffset = new THREE.Vector3()
    function draw(time: number) {
      frame = -1
      if (flight) {
        flight.start ??= time
        const progress = Math.min(1, (time - flight.start) / (flight.zoom ? 1050 : 720))
        const ease = progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2
        cameraPath.set(
          THREE.MathUtils.lerp(flight.from.radius, flight.to.radius, ease),
          THREE.MathUtils.lerp(flight.from.phi, flight.to.phi, ease),
          THREE.MathUtils.lerp(flight.from.theta, flight.to.theta, ease),
        )
        camera.position.setFromSpherical(cameraPath)
        controls.update()
        if (progress === 1) finishFlight()
      } else if (controls.autoRotate) {
        controls.update(previous ? Math.min(0.04, (time - previous) / 1000) : 0)
      }
      previous = controls.autoRotate ? time : 0
      lightOffset.set(-0.70, 0.58, 0.55).applyQuaternion(camera.quaternion)
      keyLight.position.copy(lightOffset)
      renderer.render(scene, camera)
      frame = 0
      if (flight || controls.autoRotate) schedule()
    }
    function schedule() {
      if (!frame && !disposed && intersecting && !document.hidden) frame = requestAnimationFrame(draw)
    }
    function finishFlight() {
      if (!flight) return
      const { to, arrived } = flight
      flight = null
      camera.position.setFromSpherical(to)
      controls.update()
      schedule()
      arrived?.()
    }
    function stopSpin() {
      controls.autoRotate = false
      setPlaying(false)
    }
    function flyTo(target: Focus, zoom = false, arrived?: () => void) {
      stopSpin()
      const from = new THREE.Spherical().setFromVector3(camera.position)
      const to = new THREE.Spherical().setFromVector3(position(target.lat, target.lon, zoom ? 1.56 : distance))
      to.phi = THREE.MathUtils.clamp(to.phi, controls.minPolarAngle, controls.maxPolarAngle)
      to.theta = from.theta + THREE.MathUtils.euclideanModulo(to.theta - from.theta + Math.PI, 2 * Math.PI) - Math.PI
      flight = { from, to, zoom, arrived }
      if (preference.matches) finishFlight()
      else schedule()
    }
    function interrupt() {
      flight = null
      stopSpin()
    }
    function updatePreference() {
      setReducedMotion(preference.matches)
      setPlaying(!preference.matches)
      if (preference.matches) finishFlight()
    }
    function keydown(event: KeyboardEvent) {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return
      event.preventDefault()
      interrupt()
      const next = new THREE.Spherical().setFromVector3(camera.position)
      if (event.key === 'ArrowLeft') next.theta -= 0.13
      if (event.key === 'ArrowRight') next.theta += 0.13
      if (event.key === 'ArrowUp') next.phi -= 0.13
      if (event.key === 'ArrowDown') next.phi += 0.13
      camera.position.setFromSpherical(next.makeSafe())
      controls.update()
      schedule()
    }

    camera.position.copy(position(europe.lat, europe.lon, distance))
    controls.update()
    updatePreference()
    preference.addEventListener('change', updatePreference)
    const resize = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      if (!width || !height) return
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      if (!flight && camera.position.length() >= distance - 0.05) {
        camera.position.setLength(Math.max(4.15, 4.15 / camera.aspect))
      }
      distance = Math.max(4.15, 4.15 / camera.aspect)
      if (flight && !flight.zoom) flight.to.radius = distance
      renderer.setSize(width, height, false)
      controls.update()
      schedule()
    })
    resize.observe(element)
    const visibility = new IntersectionObserver(([entry]) => {
      intersecting = entry.isIntersecting
      if (intersecting) schedule()
    })
    visibility.observe(element)

    controls.addEventListener('change', schedule)
    controls.addEventListener('start', interrupt)
    canvas.addEventListener('keydown', keydown)
    function contextLost(event: Event) { event.preventDefault(); finishFlight(); interrupt(); setFailed(true); setReady(false) }
    canvas.addEventListener('webglcontextlost', contextLost)
    document.addEventListener('visibilitychange', schedule)

    const texture = new THREE.TextureLoader().load(world.src, () => {
      if (disposed) return
      material.map = texture
      material.needsUpdate = true
      setReady(true)
      schedule()
    }, undefined, () => { if (!disposed) setFailed(true) })
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 4)

    sceneApi.current = {
      flyTo,
      animate(active) {
        if (active) flight = null
        controls.autoRotate = active
        schedule()
      },
      drawPoints({ cells: values, layer: sensor }) {
        const coordinates: number[] = []
        const rgb: number[] = []
        const color = new THREE.Color()
        for (const cell of values) {
          coordinates.push(...position(cell.lat, cell.lon, 1.006).toArray())
          const channel = sensor === 'Combined' ? (cell.MODIS && cell.VIIRS ? 'shared' : cell.MODIS ? 'MODIS' : 'VIIRS') : sensor
          rgb.push(...color.set(colors[channel]).toArray())
        }
        points.geometry.dispose()
        points.geometry = new THREE.BufferGeometry()
          .setAttribute('position', new THREE.Float32BufferAttribute(coordinates, 3))
          .setAttribute('color', new THREE.Float32BufferAttribute(rgb, 3))
        schedule()
      },
    }

    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      sceneApi.current = null
      document.removeEventListener('visibilitychange', schedule)
      preference.removeEventListener('change', updatePreference)
      canvas.removeEventListener('webglcontextlost', contextLost)
      canvas.removeEventListener('keydown', keydown)
      controls.dispose()
      resize.disconnect()
      visibility.disconnect()
      for (const resource of [points.geometry, pointTexture, pointMaterial, material, texture, sphere, grid, gridInk, atmosphere]) resource.dispose()
      renderer.dispose()
      canvas.remove()
    }
  }, [])

  useEffect(() => sceneApi.current?.drawPoints({ cells, layer }), [cells, layer])
  useEffect(() => sceneApi.current?.animate(playing && !failed), [failed, playing])

  function zoomToHotspots() {
    if (ready && !failed) sceneApi.current?.flyTo(focus, true, onShowHotspots)
    else onShowHotspots?.()
  }

  return <div className="earth-stage" data-renderer={failed ? 'fallback' : ready ? 'webgl' : 'loading'} data-points={cells.length}>
    {(!ready || failed) && <EarthPlaceholder />}
    <div className="earth-canvas" ref={container} data-ready={ready && !failed} />
    <div className="earth-coordinate"><Crosshair size={14} /><span>{date} UTC</span><span>{cells.length} occupied cells</span></div>
    <div className="earth-controls">
      {ready && !failed && <>
        <button type="button" onClick={() => sceneApi.current?.flyTo(focus)} title={`Center on ${area}`}><Crosshair size={15} /> Locate area</button>
        {!reducedMotion && <button type="button" aria-label={playing ? 'Pause Earth rotation' : 'Play Earth rotation'} title={playing ? 'Pause rotation' : 'Play rotation'} onClick={() => setPlaying(value => !value)}>{playing ? <Pause size={15} /> : <Play size={15} />}</button>}
      </>}
      {onShowHotspots && <button type="button" className="earth-map-link" onClick={zoomToHotspots}>Zoom to hotspots <ArrowDownRight size={16} /></button>}
    </div>
    {failed && <span className="earth-fallback-note">Earth preview · see regional map for hotspots</span>}
  </div>
}
