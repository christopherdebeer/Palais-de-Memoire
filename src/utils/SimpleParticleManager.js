// Simplified Particle System Manager for React Memory Palace
// Based on prototype/ParticleSystemManager.js but simplified for initial implementation

import * as THREE from 'three'

export class SimpleParticleManager {
  constructor() {
    this.particleSystems = new Map()
  }

  createParticleSystem(position, isDoor = false, objectId = null) {
    // Create simplified particle system for object markers
    const particleCount = isDoor ? 100 : 50
    const geometry = new THREE.BufferGeometry()
    
    // Create particle positions
    const positions = new Float32Array(particleCount * 3)
    const colors = new Float32Array(particleCount * 3)
    const sizes = new Float32Array(particleCount)
    
    // Particle properties
    const baseColor = isDoor ? new THREE.Color(0xffd700) : new THREE.Color(0x4dabf7)
    const spawnRadius = isDoor ? 30 : 25
    
    for (let i = 0; i < particleCount; i++) {
      // Random position around the object marker
      const angle = Math.random() * Math.PI * 2
      const radius = Math.random() * spawnRadius
      const height = (Math.random() - 0.5) * (isDoor ? 40 : 20)
      
      positions[i * 3] = position.x + Math.cos(angle) * radius
      positions[i * 3 + 1] = position.y + height
      positions[i * 3 + 2] = position.z + Math.sin(angle) * radius
      
      // Color with slight variation
      const colorVariation = 0.8 + Math.random() * 0.4
      colors[i * 3] = baseColor.r * colorVariation
      colors[i * 3 + 1] = baseColor.g * colorVariation
      colors[i * 3 + 2] = baseColor.b * colorVariation
      
      // Random size
      sizes[i] = isDoor ? 3 + Math.random() * 2 : 2 + Math.random() * 1.5
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1))
    
    // Create shader material for particles
    const material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        opacity: { value: isDoor ? 0.8 : 0.6 }
      },
      vertexShader: `
        attribute float size;
        attribute vec3 color;
        uniform float time;
        varying vec3 vColor;
        varying float vOpacity;
        
        void main() {
          vColor = color;
          
          // Animate particles with slight movement
          vec3 pos = position;
          pos.y += sin(time * 2.0 + position.x * 0.01) * 5.0;
          pos.x += cos(time * 1.5 + position.z * 0.01) * 2.0;
          
          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
          gl_PointSize = size * (300.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
          
          // Fade based on distance and time
          float dist = length(mvPosition.xyz);
          vOpacity = 1.0 - smoothstep(200.0, 400.0, dist);
        }
      `,
      fragmentShader: `
        uniform float opacity;
        varying vec3 vColor;
        varying float vOpacity;
        
        void main() {
          // Create circular particles
          vec2 center = gl_PointCoord - vec2(0.5);
          float dist = length(center);
          if (dist > 0.5) discard;
          
          float alpha = (1.0 - dist * 2.0) * opacity * vOpacity;
          gl_FragColor = vec4(vColor, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
    
    const particleSystem = new THREE.Points(geometry, material)
    
    // Store animation data
    particleSystem.userData = {
      startTime: Date.now(),
      isDoor,
      objectId,
      originalPositions: positions.slice() // Store original positions for animation
    }
    
    if (objectId) {
      this.particleSystems.set(objectId, particleSystem)
    }
    
    return particleSystem
  }

  updateParticleSystems() {
    const time = Date.now() * 0.001
    
    this.particleSystems.forEach((particleSystem) => {
      if (particleSystem.material && particleSystem.material.uniforms) {
        particleSystem.material.uniforms.time.value = time
      }
    })
  }

  removeParticleSystem(objectId) {
    const particleSystem = this.particleSystems.get(objectId)
    if (particleSystem) {
      // Dispose resources
      if (particleSystem.geometry) particleSystem.geometry.dispose()
      if (particleSystem.material) particleSystem.material.dispose()
      
      this.particleSystems.delete(objectId)
      return particleSystem
    }
    return null
  }

  dispose() {
    this.particleSystems.forEach((particleSystem, objectId) => {
      this.removeParticleSystem(objectId)
    })
    this.particleSystems.clear()
  }
}

export default SimpleParticleManager