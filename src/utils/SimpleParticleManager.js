// Minimal Particle System Manager — area-fill + simple lifetimes
// Public API preserved:
//   createParticleSystem(position, isDoor=false, objectId=null, options={})
//   updateParticleSystems()
//   removeParticleSystem(objectId)
//   dispose()

import * as THREE from 'three'

export class SimpleParticleManager {
  constructor() {
    this.particleSystems = new Map()
    this.texture = this._makeSprite(64)
    this._lastUpdate = performance.now() * 0.001
  }

  /**
   * Create a simple particle system that fills a box or sphere region.
   * Particles live a few seconds, then are reset to a new random position.
   *
   * options:
   *   width, height, depth?: numbers — region size (depth defaults to min(width, height))
   *   shape?: "box" | "sphere"      — default "box" when width/height provided; else "sphere"
   *   particleCount?: number         — explicit count (overrides density calculation)
   *   density?: number               — particles per unit area/volume (default 0.8 door / 0.6 object)
   *   size?: number                  — point size in pixels (default 10 door / 8 object)
   *   lifetime?: [min,max]           — seconds (default [3,6])
   *   opacity?: number               — default 0.9 door / 0.8 object
   *   swirl?: boolean                — enable firefly-like swirling motion (default true)
   *   swirlSpeed?: number            — motion speed multiplier (default 1.0)
   */
  createParticleSystem(position, isDoor = false, objectId = null, options = {}) {
    const {
      width,
      height,
      depth = Math.min(width ?? 6, height ?? 6),
      shape = (width && height ? 'box' : 'sphere'),
      particleCount,
      density = isDoor ? 0.8 : 0.6,
      size = isDoor ? 10 : 8,
      lifetime = [3, 6],
      opacity = isDoor ? 0.4 : 0.4,
      swirl = true,
      swirlSpeed = 1.0
    } = options

    // Calculate particle count based on density if not explicitly provided
    let calculatedCount
    if (particleCount !== undefined) {
      calculatedCount = particleCount
    } else {
      if (shape === 'sphere') {
        const radius = Math.min(width ?? 50, height ?? 50) * 0.5
        const volume = (4/3) * Math.PI * radius * radius * radius
        calculatedCount = Math.floor(density * volume * 0.01) // scale factor for reasonable counts
      } else {
        const area = (width ?? 100) * (height ?? 100)
        calculatedCount = Math.floor(density * area * 0.01) // scale factor for reasonable counts
      }
      // Apply reasonable bounds
      calculatedCount = Math.max(5, Math.min(calculatedCount, isDoor ? 80 : 60))
    }

    const count = Math.max(1, Math.floor(calculatedCount))

    const geometry = new THREE.BufferGeometry()
    const positions = new Float32Array(count * 3)
    const colors    = new Float32Array(count * 3)
    const sizes     = new Float32Array(count)
    const life      = new Float32Array(count * 2) // current, max
    const motion    = new Float32Array(count * 4) // phase, radius, speed, direction

    const baseColor = isDoor ? new THREE.Color(0xffd700) : new THREE.Color(0x4dabf7)

    // Seed initial data
    for (let i = 0; i < count; i++) {
      const i3 = i * 3
      const i4 = i * 4
      const p = (shape === 'sphere')
        ? this._randInSphere(width && height ? Math.min(width, height) * 0.5 : 50)
        : this._randInBox(width ?? 100, height ?? 100, depth ?? 60)

      positions[i3 + 0] = position.x + p.x
      positions[i3 + 1] = position.y + p.y
      positions[i3 + 2] = position.z + p.z

      const cv = 0.85 + Math.random() * 0.3
      colors[i3 + 0] = baseColor.r * cv
      colors[i3 + 1] = baseColor.g * cv
      colors[i3 + 2] = baseColor.b * cv

      sizes[i] = size * (0.5 + Math.random() * 0.3)

      life[i * 2 + 0] = Math.random() * (lifetime[1] - lifetime[0]) // current
      life[i * 2 + 1] = lifetime[0] + Math.random() * (lifetime[1] - lifetime[0]) // max

      // Motion parameters for firefly-like swirling
      motion[i4 + 0] = Math.random() * Math.PI * 2 // phase offset
      motion[i4 + 1] = 2 + Math.random() * 8 // swirl radius (2-10 units)
      motion[i4 + 2] = 0.5 + Math.random() * 1.5 // speed multiplier (0.5-2.0)
      motion[i4 + 3] = Math.random() < 0.5 ? 1 : -1 // direction (clockwise/counter-clockwise)
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('color',    new THREE.BufferAttribute(colors, 3))
    geometry.setAttribute('size',     new THREE.BufferAttribute(sizes, 1))
    geometry.setAttribute('life',     new THREE.BufferAttribute(life, 2))
    geometry.setAttribute('motion',   new THREE.BufferAttribute(motion, 4))
    geometry.computeBoundingSphere()

    const material = new THREE.ShaderMaterial({
      uniforms: {
        opacity:     { value: opacity },
        uPointScale: { value: 800 }, // perspective scale factor (tweak to taste)
        uMap:        { value: this.texture },
        uTime:       { value: 0.0 },
        uSwirl:      { value: swirl ? 1.0 : 0.0 },
        uSwirlSpeed: { value: swirlSpeed }
      },
      vertexShader: `
        attribute float size;
        attribute vec2  life; // current, max
        attribute vec4  motion; // phase, radius, speed, direction

        uniform float opacity;
        uniform float uPointScale;
        uniform float uTime;
        uniform float uSwirl;
        uniform float uSwirlSpeed;

        varying vec3  vColor;
        varying float vAlpha;

        void main() {
          // Simple life envelope: fade in/out across lifetime
          float t = clamp(life.x / max(life.y, 0.0001), 0.0, 1.0);
          float a = min(t / 0.15, (1.0 - t) / 0.25); // quick fade in, slower fade out
          a = clamp(a, 0.0, 1.0);

          vColor = color;
          vAlpha = a * opacity;

          // Base position
          vec3 pos = position;

          // Add firefly-like swirling motion if enabled
          if (uSwirl > 0.5) {
            float phase = motion.x;
            float radius = motion.y;
            float speed = motion.z * uSwirlSpeed;
            float direction = motion.w;
            
            // Create time-based swirling motion
            float timePhase = uTime * speed * direction + phase;
            
            // Gentle figure-8 or circular motion with vertical oscillation
            float swirlX = sin(timePhase) * radius * 0.3;
            float swirlY = sin(timePhase * 0.7 + phase) * radius * 0.2; // slower vertical oscillation
            float swirlZ = cos(timePhase) * radius * 0.3;
            
            // Add subtle drift
            float driftX = sin(timePhase * 0.3) * radius * 0.1;
            float driftZ = cos(timePhase * 0.4) * radius * 0.1;
            
            pos.x += swirlX + driftX;
            pos.y += swirlY;
            pos.z += swirlZ + driftZ;
          }

          vec4 mv = modelViewMatrix * vec4(pos, 1.0);
          gl_Position = projectionMatrix * mv;

          float dist = max(1.0, length(mv.xyz));
          float psize = size * (uPointScale / dist);
          gl_PointSize = clamp(psize, 2.0, 80.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D uMap;
        varying vec3  vColor;
        varying float vAlpha;

        void main() {
          // soft circular sprite
          vec2 uv = gl_PointCoord;
          vec4 tex = texture2D(uMap, uv);

          // clip to circle (texture already fades; this ensures clean edge)
          vec2 c = uv - 0.5;
          if (length(c) > 0.5) discard;

          gl_FragColor = vec4(vColor * tex.rgb, vAlpha * tex.a);
        }
      `,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
      vertexColors: true
    })

    const ps = new THREE.Points(geometry, material)
    ps.frustumCulled = false

    // Keep minimal data needed for resets
    ps.userData = {
      isDoor, objectId,
      baseColor: baseColor.clone(),
      region: { shape, width, height, depth },
      anchor: position.clone(),
      count,
      swirl,
      swirlSpeed,
      lifetime
    }

    if (objectId) this.particleSystems.set(objectId, ps)
    return ps
  }

  updateParticleSystems() {
    const now = performance.now() * 0.001
    let dt = now - this._lastUpdate
    this._lastUpdate = now
    // Clamp dt to avoid giant steps after tab focus, etc.
    dt = Math.min(Math.max(dt, 0.0), 0.1)

    this.particleSystems.forEach(ps => {
      const geo = ps.geometry
      const life = geo.getAttribute('life').array
      const pos  = geo.getAttribute('position').array
      const motion = geo.getAttribute('motion')?.array

      const { count, region, anchor, lifetime } = ps.userData
      const { shape, width, height, depth } = region

      // Update time uniform for swirling animation
      if (ps.material.uniforms.uTime) {
        ps.material.uniforms.uTime.value = now
      }

      // Advance life and respawn expired particles at a new random position
      for (let i = 0; i < count; i++) {
        const li = i * 2
        let cur = life[li]
        const max = life[li + 1]

        cur += dt
        if (cur >= max) {
          // respawn
          const i3 = i * 3
          const i4 = i * 4
          const p = (shape === 'sphere')
            ? this._randInSphere(Math.min(width ?? 100, height ?? 100) * 0.5)
            : this._randInBox(width ?? 100, height ?? 100, (depth ?? Math.min(width ?? 60, height ?? 60)))

          pos[i3 + 0] = anchor.x + p.x
          pos[i3 + 1] = anchor.y + p.y
          pos[i3 + 2] = anchor.z + p.z

          // reset lifetime
          const minL = lifetime?.[0] ?? 3.0
          const maxL = lifetime?.[1] ?? 6.0
          life[li + 0] = 0.0
          life[li + 1] = minL + Math.random() * (maxL - minL)

          // reset motion parameters for new particle
          if (motion) {
            motion[i4 + 0] = Math.random() * Math.PI * 2 // new phase offset
            motion[i4 + 1] = 2 + Math.random() * 8 // new swirl radius
            motion[i4 + 2] = 0.5 + Math.random() * 1.5 // new speed multiplier
            motion[i4 + 3] = Math.random() < 0.5 ? 1 : -1 // new direction
          }
        } else {
          life[li] = cur
        }
      }

      geo.attributes.position.needsUpdate = true
      geo.attributes.life.needsUpdate = true
      if (motion) {
        geo.attributes.motion.needsUpdate = true
      }
      // bounding sphere is generous enough; no need to recompute each frame
    })
  }

  removeParticleSystem(objectId) {
    const ps = this.particleSystems.get(objectId)
    if (ps) {
      ps.geometry?.dispose()
      ps.material?.dispose()
      this.particleSystems.delete(objectId)
      return ps
    }
    return null
  }

  dispose() {
    this.particleSystems.forEach((_, id) => this.removeParticleSystem(id))
    this.particleSystems.clear()
  }

  // Helpers
  _makeSprite(size) {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = size
    const ctx = canvas.getContext('2d')

    const g = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2)
    g.addColorStop(0.0, 'rgba(255,255,255,1)')
    g.addColorStop(0.4, 'rgba(255,255,255,0.65)')
    g.addColorStop(0.7, 'rgba(255,255,255,0.25)')
    g.addColorStop(1.0, 'rgba(255,255,255,0.0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, size, size)

    const tex = new THREE.CanvasTexture(canvas)
    tex.magFilter = THREE.LinearFilter
    tex.minFilter = THREE.LinearMipMapLinearFilter
    return tex
  }

  _randInBox(w, h, d) {
    return new THREE.Vector3(
      (Math.random() - 0.5) * w,
      (Math.random() - 0.5) * h,
      (Math.random() - 0.5) * d
    )
  }

  _randInSphere(r) {
    // uniform in sphere: pick direction on unit sphere, radius ~ cbrt(u)*R
    const u = Math.random(), v = Math.random()
    const theta = 2.0 * Math.PI * u
    const phi   = Math.acos(2.0 * v - 1.0)
    const rr    = Math.cbrt(Math.random()) * r
    const st = Math.sin(phi), ct = Math.cos(phi)
    return new THREE.Vector3(
      rr * st * Math.cos(theta),
      rr * st * Math.sin(theta),
      rr * ct
    )
  }
}

export default SimpleParticleManager
