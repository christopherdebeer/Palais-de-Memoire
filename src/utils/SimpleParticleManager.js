// Simplified Particle System Manager for React Memory Palace
// Based on prototype/ParticleSystemManager.js but simplified for initial implementation

import * as THREE from 'three'

export class SimpleParticleManager {
  constructor() {
    this.particleSystems = new Map()
  }

  /**
   * Create a particle system.
   * @param {THREE.Vector3} position - center of the effect
   * @param {boolean} isDoor - golden aura if true; blue aura otherwise
   * @param {string|null} objectId - stored key for later removal
   * @param {object} options - optional tuning:
   *   width, height           : area to fill (default: fallback to radial)
   *   shape                   : "rect" | "circle" (default "rect" if width/height, else radial)
   *   density                 : particles per 10k area units (default 0.02)
   *   particleCount           : explicit override (wins over density)
   *   swirlSpeed              : base swirl angular speed (default 0.9)
   *   swirlTightness          : radial bias toward center 0..1 (default 0.45)
   *   drift                   : base random drift amplitude (default 1.2)
   *   twinkleSpeed            : flicker speed (default 1.4)
   *   twinkleIntensity        : 0..1 alpha/size modulation (default 0.5)
   *   sizeBase                : base point size (default 6 door / 4.5 object)
   *   sizeJitter              : random size spread (default 0.6)
   */
  createParticleSystem(position, isDoor = false, objectId = null, options = {}) {
    const {
      width,
      height,
      shape,
      density = 0.02,                // particles per 10k units area
      particleCount,
      swirlSpeed = 0.9,
      swirlTightness = 0.45,         // 0 center-weighted, 1 edge-weighted
      drift = 1.2,
      twinkleSpeed = 1.4,
      twinkleIntensity = 0.5,
      sizeBase = isDoor ? 6.0 : 4.5,
      sizeJitter = 0.6
    } = options

    // Decide particle count
    let count
    if (typeof particleCount === "number") {
      count = Math.max(8, Math.floor(particleCount))
    } else if (width && height) {
      const area = width * height
      count = Math.max(20, Math.floor((area / 10000) * density * 10000))
    } else {
      // radial fallback (original behavior scale)
      count = isDoor ? 160 : 90
    }

    const geometry = new THREE.BufferGeometry()
    const positions = new Float32Array(count * 3)
    const colors    = new Float32Array(count * 3)
    const sizes     = new Float32Array(count)
    const phases    = new Float32Array(count) // per-particle phase for swirl/twinkle
    const seeds     = new Float32Array(count) // extra per-particle seed for variety
    const radii     = new Float32Array(count) // stored radial factor (0..1) for swirl tightness

    const baseColor = isDoor ? new THREE.Color(0xffd700) : new THREE.Color(0x4dabf7)

    const useArea = (width && height)
    const useCircle = useArea ? (shape === "circle") : false

    // Spawn points uniformly inside rect or disc; store per-particle attributes
    for (let i = 0; i < count; i++) {
      let x = 0, y = 0, z = 0

      if (useArea) {
        if (useCircle) {
          // Uniform inside circle of radius R = min(width, height)/2
          const R = Math.min(width, height) * 0.5
          const t = Math.random() * Math.PI * 2
          const r = Math.sqrt(Math.random()) * R
          x = position.x + Math.cos(t) * r
          z = position.z + Math.sin(t) * r
          y = position.y + (Math.random() - 0.5) * (isDoor ? 60 : 30)
          // Normalized radial factor for swirl tightness
          radii[i] = r / R
        } else {
          // Uniform inside rectangle
          x = position.x + (Math.random() - 0.5) * width
          z = position.z + (Math.random() - 0.5) * height
          y = position.y + (Math.random() - 0.5) * (isDoor ? 60 : 30)

          // For rect, estimate "radius" as distance to center normalized by half-diagonal
          const dx = x - position.x
          const dz = z - position.z
          const halfDiag = Math.sqrt((width * width + height * height)) * 0.5
          radii[i] = Math.min(1.0, Math.sqrt(dx * dx + dz * dz) / Math.max(1e-3, halfDiag))
        }
      } else {
        // Radial fallback like before
        const angle  = Math.random() * Math.PI * 2
        const rBase  = isDoor ? 50 : 35
        const radius = Math.random() * rBase
        const heightJ = (Math.random() - 0.5) * (isDoor ? 60 : 30)
        x = position.x + Math.cos(angle) * radius
        z = position.z + Math.sin(angle) * radius
        y = position.y + heightJ
        radii[i] = radius / rBase
      }

      positions[i * 3 + 0] = x
      positions[i * 3 + 1] = y
      positions[i * 3 + 2] = z

      const colorVariation = 0.85 + Math.random() * 0.3
      colors[i * 3 + 0] = baseColor.r * colorVariation
      colors[i * 3 + 1] = baseColor.g * colorVariation
      colors[i * 3 + 2] = baseColor.b * colorVariation

      sizes[i]  = sizeBase * (0.85 + Math.random() * sizeJitter)
      phases[i] = Math.random() * Math.PI * 2
      seeds[i]  = Math.random() * 1000.0
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute("color",    new THREE.BufferAttribute(colors, 3))
    geometry.setAttribute("size",     new THREE.BufferAttribute(sizes, 1))
    geometry.setAttribute("phase",    new THREE.BufferAttribute(phases, 1))
    geometry.setAttribute("seed",     new THREE.BufferAttribute(seeds, 1))
    geometry.setAttribute("rnorm",    new THREE.BufferAttribute(radii, 1))
    geometry.computeBoundingSphere()

    const material = new THREE.ShaderMaterial({
      uniforms: {
        time:       { value: 0 },
        opacity:    { value: isDoor ? 0.9 : 0.75 },
        sizeScale:  { value: 1.0 },
        center:     { value: new THREE.Vector3(position.x, position.y, position.z) },
        swirlSpeed: { value: swirlSpeed },
        swirlTight: { value: swirlTightness },
        driftAmp:   { value: drift },
        twkSpeed:   { value: twinkleSpeed },
        twkInt:     { value: twinkleIntensity }
      },
      vertexShader: `
        attribute float size;
        attribute vec3  color;
        attribute float phase;
        attribute float seed;
        attribute float rnorm; // 0..1 radial factor (center→edge)
        uniform float time;
        uniform float sizeScale;
        uniform vec3  center;
        uniform float swirlSpeed;
        uniform float swirlTight;
        uniform float driftAmp;
        uniform float twkSpeed;
        uniform float twkInt;
        varying vec3  vColor;
        varying float vTwinkle;
        varying float vFade;

        // small hash-noise
        float hash(float n){ return fract(sin(n)*43758.5453123); }

        void main() {
          vColor = color;

          // Vector from center to particle (in world space)
          vec3 base = position - center;

          // Compute angular rotation amount: per-particle phase + time factor
          float ang = phase + time * swirlSpeed * (0.7 + 0.6 * hash(seed));

          // Tightness: bias radius toward center or edge. 0 → hug center; 1 → hug original radius
          float radBias = mix(0.25, 1.0, clamp(swirlTight, 0.0, 1.0));
          vec2 p = base.xz * radBias;

          // Rotate around Y
          float ca = cos(ang), sa = sin(ang);
          vec2 swirl = vec2(p.x * ca - p.y * sa, p.x * sa + p.y * ca);

          // Gentle vertical bob
          float bob = sin(time * (0.8 + 0.5*hash(seed+17.0)) + phase) * (0.6 + 0.6*rnorm);

          // Random drift adds organic motion (per seed)
          float dx = (hash(seed+3.0)-0.5) * driftAmp;
          float dz = (hash(seed+7.0)-0.5) * driftAmp;

          vec3 pos = vec3(center.x + swirl.x + dx, center.y + base.y*0.5 + bob, center.z + swirl.y + dz);

          // Per-particle twinkle: smooth sinus flicker 0.7..1.0 scaled by twkInt
          float tw = 0.85 + 0.5 * sin(time * twkSpeed * (1.0 + 0.8*hash(seed+11.0)) + phase);
          vTwinkle = mix(1.0, tw, clamp(twkInt, 0.0, 1.0));

          // Project
          vec4 mv = modelViewMatrix * vec4(pos, 1.0);

          // Perspective size attenuation with clamp
          float baseSize = max(size * sizeScale, 2.0);
          float atten = 300.0 / max(1.0, -mv.z);
          gl_PointSize = clamp(baseSize * atten * vTwinkle, 1.0, 48.0);

          gl_Position = projectionMatrix * mv;

          // Mild depth fade to avoid hard cutoffs; never fully zero
          float z = -mv.z;
          vFade = clamp(1.0 - smoothstep(4000.0, 30000.0, z), 0.3, 1.0);
        }
      `,
      fragmentShader: `
        uniform float opacity;
        varying vec3  vColor;
        varying float vTwinkle;
        varying float vFade;

        void main() {
          vec2  c = gl_PointCoord - vec2(0.5);
          float d = length(c);
          if (d > 0.5) discard;

          float edge = smoothstep(0.5, 0.0, d);
          float alpha = opacity * vFade * edge * vTwinkle;

          gl_FragColor = vec4(vColor, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending
    })

    const particleSystem = new THREE.Points(geometry, material)
    particleSystem.frustumCulled = false

    particleSystem.userData = { isDoor, objectId }

    if (objectId) this.particleSystems.set(objectId, particleSystem)
    return particleSystem
  }

  updateParticleSystems() {
    const t = Date.now() * 0.001
    this.particleSystems.forEach(ps => {
      const u = ps.material?.uniforms
      if (!u) return
      u.time.value = t
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
}

export default SimpleParticleManager
