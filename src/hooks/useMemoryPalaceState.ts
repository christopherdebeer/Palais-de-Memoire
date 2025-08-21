import { useRef } from 'react'
import * as THREE from 'three'
import SimpleParticleManager from '../utils/SimpleParticleManager'
import SettingsManager from '../services/SettingsManager'

interface CameraRotation {
  yaw: number
  pitch: number
}

interface UseMemoryPalaceStateReturn {
  // Three.js refs
  mountRef: React.MutableRefObject<HTMLDivElement | null>
  sceneRef: React.MutableRefObject<THREE.Scene | null>
  rendererRef: React.MutableRefObject<THREE.WebGLRenderer | null>
  cameraRef: React.MutableRefObject<THREE.PerspectiveCamera | null>
  wireframeSphereRef: React.MutableRefObject<THREE.Mesh | null>
  skyboxSphereRef: React.MutableRefObject<THREE.Mesh | null>
  skyboxMaterialRef: React.MutableRefObject<THREE.MeshBasicMaterial | null>
  
  // Animation and particle refs
  animationFrameRef: React.MutableRefObject<number | null>
  particleManagerRef: React.MutableRefObject<SimpleParticleManager | null>
  
  // Camera state
  cameraRotationRef: React.MutableRefObject<CameraRotation>
  
  // Input control refs
  nippleManagerRef: React.MutableRefObject<any>
  nippleContainerRef: React.MutableRefObject<HTMLDivElement | null>
  
  // Settings
  settingsManagerRef: React.MutableRefObject<SettingsManager>
  
  // Helper functions
  updateCameraRotation: (deltaX: number, deltaY: number) => void
  updateCameraFov: (fov: number) => void
  startAnimation: () => void
  stopAnimation: () => void
}

export const useMemoryPalaceState = (): UseMemoryPalaceStateReturn => {
  // Three.js refs
  const mountRef = useRef<HTMLDivElement | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const wireframeSphereRef = useRef<THREE.Mesh | null>(null)
  const skyboxSphereRef = useRef<THREE.Mesh | null>(null)
  const skyboxMaterialRef = useRef<THREE.MeshBasicMaterial | null>(null)
  
  // Animation and particle refs
  const animationFrameRef = useRef<number | null>(null)
  const particleManagerRef = useRef<SimpleParticleManager | null>(null)
  
  // Camera state - needs to be accessible across all functions
  const cameraRotationRef = useRef<CameraRotation>({ yaw: 0, pitch: 0 })
  
  // Input control refs
  const nippleManagerRef = useRef<any>(null)
  const nippleContainerRef = useRef<HTMLDivElement | null>(null)
  
  // Settings
  const settingsManagerRef = useRef(new SettingsManager())

  const updateCameraRotation = (deltaX: number, deltaY: number) => {
    if (!cameraRef.current) return

    // Apply rotation with sensitivity
    cameraRotationRef.current.yaw -= deltaX   // Horizontal rotation (left/right)
    cameraRotationRef.current.pitch += deltaY // Vertical rotation (up/down)

    // Clamp rotations to prevent over-rotation
    cameraRotationRef.current.yaw = Math.max(-135, Math.min(135, cameraRotationRef.current.yaw))
    cameraRotationRef.current.pitch = Math.max(-85, Math.min(85, cameraRotationRef.current.pitch))

    // Apply rotations to camera
    const yawRad = THREE.MathUtils.degToRad(cameraRotationRef.current.yaw)
    const pitchRad = THREE.MathUtils.degToRad(cameraRotationRef.current.pitch)

    // Set camera rotation
    cameraRef.current.rotation.order = 'YXZ'
    cameraRef.current.rotation.y = yawRad
    cameraRef.current.rotation.x = pitchRad
  }

  const updateCameraFov = (fov: number) => {
    if (!cameraRef.current) return

    cameraRef.current.fov = fov
    cameraRef.current.updateProjectionMatrix()
    
    // Save to settings
    settingsManagerRef.current.set('cameraFov', fov)
  }

  const startAnimation = () => {
    if (animationFrameRef.current) return // Already animating
    
    const animate = () => {
      // Update particle systems
      if (particleManagerRef.current) {
        particleManagerRef.current.updateParticleSystems()
      }
      
      // Continue animation loop
      animationFrameRef.current = requestAnimationFrame(animate)
    }
    
    animate()
  }

  const stopAnimation = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
  }

  return {
    // Three.js refs
    mountRef,
    sceneRef,
    rendererRef,
    cameraRef,
    wireframeSphereRef,
    skyboxSphereRef,
    skyboxMaterialRef,
    
    // Animation and particle refs
    animationFrameRef,
    particleManagerRef,
    
    // Camera state
    cameraRotationRef,
    
    // Input control refs
    nippleManagerRef,
    nippleContainerRef,
    
    // Settings
    settingsManagerRef,
    
    // Helper functions
    updateCameraRotation,
    updateCameraFov,
    startAnimation,
    stopAnimation
  }
}