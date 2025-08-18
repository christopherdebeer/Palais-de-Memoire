// Simplified Particle System Manager — random particle selection with varied blending modes
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
    
    // Available blending modes for visibility across diverse backgrounds
    this.blendingModes = [
      THREE.AdditiveBlending,    // Bright particles for dark backgrounds
      THREE.SubtractiveBlending, // Dark particles for bright backgrounds
      THREE.MultiplyBlending,    // Overlay effect
      THREE.NormalBlending       // Standard blending
    ]
  }

  /**
   * Create a simplified particle system with random particle selection and varied blending.
   * 
   * options:
   *   width, height, depth?: numbers — region size (depth defaults to min(width, height))
   *   shape?: "box" | "sphere"      — default "box" when width/height provided; else "sphere"
   *   particleCount?: number         — explicit count (default: 20-40 particles)
   *   size?: number                  — point size in pixels (default 8-12)
   *   lifetime?: [min,max]           — seconds (default [2,5])
   *   opacity?: number               — default 0.6-0.8
   */
  createParticleSystem(position, isDoor = false, objectId = null, options = {}) {
    const {
      width,
      height,
      depth = Math.min(width ?? 6, height ?? 6),
      shape = (width && height ? 'box' : 'sphere'),
      particleCount = Math.floor(Math.random() * 20) + 20, // Random 20-40 particles
      size = Math.random() * 4 + 8, // Random size 8-12
      lifetime = [2, 5],
      opacity = Math.random() * 0.2 + 0.6 // Random opacity 0.6-0.8
    } = options

    const count = Math.max(10, Math.floor(particleCount))

    // Randomly select particles from the region 
    const selectedPositions = []
    const totalPossiblePositions = count * 3 // Generate more positions to select from randomly
    
    for (let i = 0; i < totalPossiblePositions; i++) {
      const p = (shape === 'sphere')
        ? this._randInSphere(width && height ? Math.min(width, height) * 0.5 : 50)
        : this._randInBox(width ?? 100, height ?? 100, depth ?? 60)
      
      selectedPositions.push({
        x: position.x + p.x,
        y: position.y + p.y,
        z: position.z + p.z
      })
    }
    
    // Randomly pick subset of positions
    const shuffled = selectedPositions.sort(() => Math.random() - 0.5).slice(0, count)

    const geometry = new THREE.BufferGeometry()
    const positions = new Float32Array(count * 3)
    const colors    = new Float32Array(count * 3)
    const sizes     = new Float32Array(count)
    const life      = new Float32Array(count * 2) // current, max
    const velocity  = new Float32Array(count * 3) // vx, vy, vz
    const motion    = new Float32Array(count * 4) // phase, frequency, amplitude, orbit_radius

    // Random color variations for better visibility
    const colorPalette = [
      new THREE.Color(0xffd700), // Gold
      new THREE.Color(0x4dabf7), // Blue  
      new THREE.Color(0xff6b6b), // Red
      new THREE.Color(0x51cf66), // Green
      new THREE.Color(0xff8cc8), // Pink
      new THREE.Color(0xffd43b)  // Yellow
    ]

    // Seed initial data with random selection
    for (let i = 0; i < count; i++) {
      const i3 = i * 3
      const i4 = i * 4
      const pos = shuffled[i]

      positions[i3 + 0] = pos.x
      positions[i3 + 1] = pos.y
      positions[i3 + 2] = pos.z

      // Randomly pick color from palette
      const baseColor = colorPalette[Math.floor(Math.random() * colorPalette.length)]
      const cv = 0.7 + Math.random() * 0.3
      colors[i3 + 0] = baseColor.r * cv
      colors[i3 + 1] = baseColor.g * cv
      colors[i3 + 2] = baseColor.b * cv

      sizes[i] = size * (0.8 + Math.random() * 0.4)

      life[i * 2 + 0] = Math.random() * (lifetime[1] - lifetime[0]) // current
      life[i * 2 + 1] = lifetime[0] + Math.random() * (lifetime[1] - lifetime[0]) // max

      // Initialize firefly-like movement parameters
      velocity[i3 + 0] = (Math.random() - 0.5) * 2.0 // Random initial velocity
      velocity[i3 + 1] = (Math.random() - 0.5) * 1.0
      velocity[i3 + 2] = (Math.random() - 0.5) * 2.0

      motion[i4 + 0] = Math.random() * Math.PI * 2 // Random phase
      motion[i4 + 1] = 0.5 + Math.random() * 1.5   // Random frequency (0.5-2.0)
      motion[i4 + 2] = 2 + Math.random() * 8       // Random amplitude (2-10)
      motion[i4 + 3] = 5 + Math.random() * 15      // Random orbit radius (5-20)
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('color',    new THREE.BufferAttribute(colors, 3))
    geometry.setAttribute('size',     new THREE.BufferAttribute(sizes, 1))
    geometry.setAttribute('life',     new THREE.BufferAttribute(life, 2))
    geometry.setAttribute('velocity', new THREE.BufferAttribute(velocity, 3))
    geometry.setAttribute('motion',   new THREE.BufferAttribute(motion, 4))
    geometry.computeBoundingSphere()

    // Randomly select blending mode for this particle system to ensure visibility
    const randomBlendMode = this.blendingModes[Math.floor(Math.random() * this.blendingModes.length)]

    const material = new THREE.PointsMaterial({
      map: this.texture,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: randomBlendMode,
      vertexColors: true,
      size: size,
      sizeAttenuation: true,
      opacity: opacity,
      // Add slight randomness to alpha test to create variation
      alphaTest: Math.random() * 0.1
    })

    const ps = new THREE.Points(geometry, material)
    ps.frustumCulled = false

    // Keep minimal data needed for resets - much simplified
    ps.userData = {
      isDoor, objectId,
      region: { shape, width, height, depth },
      anchor: position.clone(),
      count,
      lifetime,
      blendMode: randomBlendMode // Store the chosen blend mode
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
      const vel  = geo.getAttribute('velocity').array
      const mot  = geo.getAttribute('motion').array

      const { count, region, anchor, lifetime } = ps.userData
      const { shape, width, height, depth } = region

      // Firefly-like particle movement and lifecycle
      for (let i = 0; i < count; i++) {
        const li = i * 2
        const i3 = i * 3
        const i4 = i * 4
        let cur = life[li]
        const max = life[li + 1]

        cur += dt
        if (cur >= max) {
          // Respawn at new random position with new movement parameters
          const p = (shape === 'sphere')
            ? this._randInSphere(Math.min(width ?? 100, height ?? 100) * 0.5)
            : this._randInBox(width ?? 100, height ?? 100, (depth ?? Math.min(width ?? 60, height ?? 60)))

          pos[i3 + 0] = anchor.x + p.x
          pos[i3 + 1] = anchor.y + p.y
          pos[i3 + 2] = anchor.z + p.z

          // Reset movement parameters for variety
          vel[i3 + 0] = (Math.random() - 0.5) * 2.0
          vel[i3 + 1] = (Math.random() - 0.5) * 1.0
          vel[i3 + 2] = (Math.random() - 0.5) * 2.0
          
          mot[i4 + 0] = Math.random() * Math.PI * 2 // New phase
          mot[i4 + 1] = 0.5 + Math.random() * 1.5   // New frequency
          mot[i4 + 2] = 2 + Math.random() * 8       // New amplitude
          mot[i4 + 3] = 5 + Math.random() * 15      // New orbit radius

          // Reset lifetime
          const minL = lifetime?.[0] ?? 2.0
          const maxL = lifetime?.[1] ?? 5.0
          life[li + 0] = 0.0
          life[li + 1] = minL + Math.random() * (maxL - minL)
        } else {
          life[li] = cur
          
          // Organic firefly movement: combination of sine wave motion and gradual drift
          const phase = mot[i4 + 0] + cur * mot[i4 + 1]
          const amplitude = mot[i4 + 2]
          const orbitalRadius = mot[i4 + 3]
          
          // Apply organic swirling motion using sine waves
          const swirl_x = Math.sin(phase) * amplitude * dt
          const swirl_y = Math.cos(phase * 1.3) * amplitude * 0.7 * dt  // Different frequency for Y
          const swirl_z = Math.sin(phase * 0.8) * amplitude * 0.5 * dt  // Subtle Z movement
          
          // Add orbital motion around anchor point
          const distFromCenter = Math.sqrt(
            Math.pow(pos[i3 + 0] - anchor.x, 2) + 
            Math.pow(pos[i3 + 2] - anchor.z, 2)
          )
          
          if (distFromCenter > orbitalRadius) {
            // Gently pull back toward center if too far
            const pullStrength = 0.5 * dt
            vel[i3 + 0] += (anchor.x - pos[i3 + 0]) * pullStrength / distFromCenter
            vel[i3 + 2] += (anchor.z - pos[i3 + 2]) * pullStrength / distFromCenter
          }
          
          // Apply damping to prevent runaway velocity
          const damping = 0.98
          vel[i3 + 0] = (vel[i3 + 0] + swirl_x) * damping
          vel[i3 + 1] = (vel[i3 + 1] + swirl_y) * damping  
          vel[i3 + 2] = (vel[i3 + 2] + swirl_z) * damping
          
          // Update positions based on velocity
          pos[i3 + 0] += vel[i3 + 0] * dt
          pos[i3 + 1] += vel[i3 + 1] * dt
          pos[i3 + 2] += vel[i3 + 2] * dt
        }
      }

      geo.attributes.position.needsUpdate = true
      geo.attributes.life.needsUpdate = true
      geo.attributes.velocity.needsUpdate = true
      geo.attributes.motion.needsUpdate = true
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
