"use client"

import { useEffect, useRef } from "react"
import * as THREE from "three"

const INDIGO = 0x5b5ce2
const VIOLET = 0x7c5cfc
const LIME = 0xd8f55a
const WHITE = 0xffffff
const MINT = 0x34d399

type Floater = {
  obj: THREE.Object3D
  baseY: number
  speed: number
  phase: number
  spin: THREE.Vector3
}

/** Two-tone medicine capsule (cylinder body + hemisphere caps). */
function makePill(color: number, length = 1.1, radius = 0.34): THREE.Group {
  const g = new THREE.Group()
  const half = length / 2
  const matA = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.32,
    metalness: 0.05,
  })
  const matB = new THREE.MeshStandardMaterial({
    color: WHITE,
    roughness: 0.4,
    metalness: 0.02,
  })
  const cylA = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, half, 32),
    matA,
  )
  cylA.position.y = half / 2
  const cylB = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, half, 32),
    matB,
  )
  cylB.position.y = -half / 2
  const capA = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    matA,
  )
  capA.position.y = half
  const capB = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
    matB,
  )
  capB.position.y = -half
  g.add(cylA, cylB, capA, capB)
  return g
}

/** Rounded medical cross. */
function makeCross(color: number, size = 0.9): THREE.Group {
  const g = new THREE.Group()
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.3,
    metalness: 0.04,
  })
  const arm = size
  const thick = size * 0.38
  const depth = size * 0.3
  const a = new THREE.Mesh(new THREE.BoxGeometry(arm, thick, depth), mat)
  const b = new THREE.Mesh(new THREE.BoxGeometry(thick, arm, depth), mat)
  g.add(a, b)
  return g
}

/**
 * Ambient floating "store universe": two-tone pills, soft spheres and a lime
 * cross drifting with mouse parallax. Transparent background — drop it on any
 * surface (designed for ink panels).
 */
export default function PillsScene({
  className,
  variant = "hero",
}: {
  className?: string
  variant?: "hero" | "full"
}) {
  const mountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100)
    camera.position.set(0, 0, variant === "full" ? 11 : 9)

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0x000000, 0)
    renderer.domElement.style.width = "100%"
    renderer.domElement.style.height = "100%"
    renderer.domElement.style.display = "block"
    mount.appendChild(renderer.domElement)

    scene.add(new THREE.AmbientLight(0xffffff, 0.75))
    const key = new THREE.DirectionalLight(0xffffff, 1.6)
    key.position.set(4, 6, 6)
    scene.add(key)
    const rim = new THREE.PointLight(VIOLET, 14, 30)
    rim.position.set(-5, -3, 4)
    scene.add(rim)
    const limeGlow = new THREE.PointLight(LIME, 8, 24)
    limeGlow.position.set(4, -4, 3)
    scene.add(limeGlow)

    const root = new THREE.Group()
    scene.add(root)

    const floaters: Floater[] = []
    const rand = (a: number, b: number) => a + Math.random() * (b - a)

    function place(obj: THREE.Object3D, x: number, y: number, z: number, s = 1) {
      obj.position.set(x, y, z)
      obj.scale.setScalar(s)
      obj.rotation.set(rand(0, Math.PI), rand(0, Math.PI), rand(0, Math.PI))
      root.add(obj)
      floaters.push({
        obj,
        baseY: y,
        speed: rand(0.5, 1.1),
        phase: rand(0, Math.PI * 2),
        spin: new THREE.Vector3(rand(0.1, 0.3), rand(0.15, 0.4), rand(0.05, 0.2)),
      })
    }

    if (variant === "full") {
      place(makePill(INDIGO, 1.3, 0.4), -2.6, 1.4, 0, 1.25)
      place(makePill(VIOLET), 2.8, -0.4, -1, 1)
      place(makePill(MINT, 0.9, 0.3), 1.7, 2, -2, 0.9)
      place(makeCross(LIME), -1.6, -1.9, -0.5, 0.95)
      place(makePill(INDIGO, 0.8, 0.28), 0.4, -2.6, -2.5, 0.8)
      const sphereMat = new THREE.MeshStandardMaterial({
        color: VIOLET,
        roughness: 0.25,
      })
      const s1 = new THREE.Mesh(new THREE.SphereGeometry(0.34, 32, 32), sphereMat)
      place(s1, 3.4, 1.9, -2, 1)
      const s2 = new THREE.Mesh(
        new THREE.SphereGeometry(0.2, 32, 32),
        new THREE.MeshStandardMaterial({ color: LIME, roughness: 0.35 }),
      )
      place(s2, -3.4, 0.2, -1.5, 1)
    } else {
      place(makePill(INDIGO, 1.2, 0.38), -0.6, 0.5, 0, 1.15)
      place(makePill(VIOLET, 0.9, 0.3), 1.6, -0.9, -1, 0.95)
      place(makeCross(LIME), 1.9, 1.3, -1.4, 0.7)
      const s = new THREE.Mesh(
        new THREE.SphereGeometry(0.26, 32, 32),
        new THREE.MeshStandardMaterial({ color: MINT, roughness: 0.3 }),
      )
      place(s, -2.1, -1.2, -1, 1)
    }

    // Mouse parallax
    const target = new THREE.Vector2(0, 0)
    function onPointer(e: PointerEvent) {
      const r = mount!.getBoundingClientRect()
      target.set(
        ((e.clientX - r.left) / r.width - 0.5) * 2,
        ((e.clientY - r.top) / r.height - 0.5) * 2,
      )
    }
    window.addEventListener("pointermove", onPointer, { passive: true })

    function resize() {
      const w = mount!.clientWidth
      const h = mount!.clientHeight
      if (w === 0 || h === 0) return
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h, false)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(mount)

    const clock = new THREE.Clock()
    let raf = 0
    function tick() {
      raf = requestAnimationFrame(tick)
      const dt = clock.getDelta()
      const t = clock.elapsedTime
      for (const f of floaters) {
        f.obj.position.y = f.baseY + Math.sin(t * f.speed + f.phase) * 0.28
        f.obj.rotation.x += f.spin.x * dt
        f.obj.rotation.y += f.spin.y * dt
      }
      root.rotation.y += (target.x * 0.16 - root.rotation.y) * 0.04
      root.rotation.x += (-target.y * 0.1 - root.rotation.x) * 0.04
      renderer.render(scene, camera)
    }
    if (reduced) {
      renderer.render(scene, camera)
    } else {
      tick()
    }

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      window.removeEventListener("pointermove", onPointer)
      renderer.dispose()
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh
        if (mesh.isMesh) {
          mesh.geometry?.dispose()
          const m = mesh.material
          if (Array.isArray(m)) m.forEach((x) => x.dispose())
          else m?.dispose()
        }
      })
      mount.removeChild(renderer.domElement)
    }
  }, [variant])

  return <div ref={mountRef} className={className} aria-hidden="true" />
}
