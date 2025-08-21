import React, { useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import * as THREE from 'three'
import SettingsManager from '../services/SettingsManager'

interface ThreeJSRendererProps {
  wireframeEnabled?: boolean
  onSceneReady?: (scene: THREE.Scene, camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer) => void
  onAnimate?: (scene: THREE.Scene, camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer) => void
}

export interface ThreeJSRendererRef {
  scene: THREE.Scene | null
  camera: THREE.PerspectiveCamera | null
  renderer: THREE.WebGLRenderer | null
  skyboxSphere: THREE.Mesh | null
  skyboxMaterial: THREE.MeshBasicMaterial | null
  wireframeSphere: THREE.Mesh | null
  updateCameraFov: (fov: number) => void
  updateSkyboxTexture: (texture: THREE.Texture) => void
}

const ThreeJSRenderer = forwardRef<ThreeJSRendererRef, ThreeJSRendererProps>(({
  wireframeEnabled = false,
  onSceneReady,
  onAnimate
}, ref) => {
  const mountRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const skyboxSphereRef = useRef<THREE.Mesh | null>(null)
  const skyboxMaterialRef = useRef<THREE.MeshBasicMaterial | null>(null)
  const wireframeSphereRef = useRef<THREE.Mesh | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const settingsManagerRef = useRef(new SettingsManager())

  useImperativeHandle(ref, () => ({
    scene: sceneRef.current,
    camera: cameraRef.current,
    renderer: rendererRef.current,
    skyboxSphere: skyboxSphereRef.current,
    skyboxMaterial: skyboxMaterialRef.current,
    wireframeSphere: wireframeSphereRef.current,
    updateCameraFov: (fov: number) => {
      if (cameraRef.current) {
        cameraRef.current.fov = fov
        cameraRef.current.updateProjectionMatrix()
      }
    },
    updateSkyboxTexture: (texture: THREE.Texture) => {
      if (skyboxMaterialRef.current) {
        texture.mapping = THREE.EquirectangularReflectionMapping
        texture.wrapS = THREE.RepeatWrapping
        texture.wrapT = THREE.ClampToEdgeWrapping
        texture.offset.x = 0.5 // 180° offset for coordinate system alignment
        skyboxMaterialRef.current.map = texture
        skyboxMaterialRef.current.color.setHex(0xffffff)
        skyboxMaterialRef.current.needsUpdate = true
      }
    }
  }))

  const createProceduralSkybox = (): THREE.CanvasTexture => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!
    canvas.width = 2048
    canvas.height = 1024

    // Create gradient background
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height)
    gradient.addColorStop(0, '#0a0a2a')
    gradient.addColorStop(0.5, '#1a1a3a')
    gradient.addColorStop(1, '#0f0f1f')

    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Add stars
    ctx.fillStyle = 'white'
    for (let i = 0; i < 400; i++) {
      const x = Math.random() * canvas.width
      const y = Math.random() * canvas.height
      const size = Math.random() * 1.5 + 0.5
      
      ctx.beginPath()
      ctx.arc(x, y, size, 0, Math.PI * 2)
      ctx.fill()
    }

    // Convert canvas to texture
    const proceduralTexture = new THREE.CanvasTexture(canvas)
    proceduralTexture.mapping = THREE.EquirectangularReflectionMapping
    proceduralTexture.wrapS = THREE.RepeatWrapping
    proceduralTexture.wrapT = THREE.ClampToEdgeWrapping
    proceduralTexture.offset.x = 0.5 // 180° offset

    return proceduralTexture
  }

  const tryLoadSkybox = (material: THREE.MeshBasicMaterial) => {
    const textureLoader = new THREE.TextureLoader()
    const localSkyboxPath = '/default_skybox.png'
    
    textureLoader.load(
      localSkyboxPath,
      (texture) => {
        // Local texture loaded successfully
        console.log('Local skybox texture loaded successfully')
        texture.mapping = THREE.EquirectangularReflectionMapping
        texture.wrapS = THREE.RepeatWrapping
        texture.wrapT = THREE.ClampToEdgeWrapping
        texture.offset.x = 0.5 // 180° offset
        material.map = texture
        material.color.setHex(0xffffff)
        material.needsUpdate = true
        
        if (!wireframeEnabled && wireframeSphereRef.current) {
          wireframeSphereRef.current.visible = false
        }
      },
      undefined,
      (error) => {
        console.warn('Local skybox failed, trying remote fallback:', error)
        
        // Fallback to remote texture
        textureLoader.load(
          'https://page-images.websim.com/Create_a_360_degree_equirectangular_panoramic_image_in_21_9_aspect_ratio_showing__scene_____TECHNICA_694056a68c0178.jpg',
          (texture) => {
            console.log('Remote skybox texture loaded successfully')
            texture.mapping = THREE.EquirectangularReflectionMapping
            texture.wrapS = THREE.RepeatWrapping
            texture.wrapT = THREE.ClampToEdgeWrapping
            texture.offset.x = 0.5 // 180° offset
            material.map = texture
            material.color.setHex(0xffffff)
            material.needsUpdate = true
            
            if (!wireframeEnabled && wireframeSphereRef.current) {
              wireframeSphereRef.current.visible = false
            }
          },
          undefined,
          (remoteError) => {
            console.error('Both local and remote skybox loading failed:', remoteError)
            console.log('Using procedural skybox as fallback')
            const proceduralTexture = createProceduralSkybox()
            material.map = proceduralTexture
            material.color.setHex(0xffffff)
            material.needsUpdate = true
            
            if (!wireframeEnabled && wireframeSphereRef.current) {
              wireframeSphereRef.current.visible = false
            }
          }
        )
      }
    )
  }

  const handleResize = () => {
    if (!cameraRef.current || !rendererRef.current) return

    cameraRef.current.aspect = window.innerWidth / window.innerHeight
    cameraRef.current.updateProjectionMatrix()
    rendererRef.current.setSize(window.innerWidth, window.innerHeight)
  }

  useEffect(() => {
    if (!mountRef.current || sceneRef.current) return

    console.log('Initializing ThreeJS Renderer...')

    // Initialize Three.js scene
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x000000)
    
    // Get camera settings
    const cameraFov = settingsManagerRef.current.get('cameraFov') || 75
    
    const camera = new THREE.PerspectiveCamera(
      cameraFov,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    )
    
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      alpha: false,
      preserveDrawingBuffer: true
    })

    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    
    // Ensure canvas is properly styled
    renderer.domElement.style.position = 'absolute'
    renderer.domElement.style.top = '0'
    renderer.domElement.style.left = '0'
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'
    renderer.domElement.style.display = 'block'
    
    mountRef.current.appendChild(renderer.domElement)

    // Create skybox sphere (inverted for interior view)
    const geometry = new THREE.SphereGeometry(500, 60, 40)
    geometry.scale(-1, 1, 1) // Flip inside out
    
    // Create material with fallback color
    const material = new THREE.MeshBasicMaterial({
      color: 0x1a1a2e,
      side: THREE.DoubleSide
    })
    
    // Create wireframe material
    const wireframeMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      wireframe: true,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.3
    })
    
    // Create meshes
    const sphere = new THREE.Mesh(geometry, material)
    scene.add(sphere)
    
    const wireframeSphere = new THREE.Mesh(geometry, wireframeMaterial)
    wireframeSphere.visible = wireframeEnabled
    scene.add(wireframeSphere)
    
    // Store references
    sceneRef.current = scene
    rendererRef.current = renderer
    cameraRef.current = camera
    skyboxSphereRef.current = sphere
    skyboxMaterialRef.current = material
    wireframeSphereRef.current = wireframeSphere

    // Add ambient lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6)
    scene.add(ambientLight)

    // Add directional light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
    directionalLight.position.set(1, 1, 1)
    scene.add(directionalLight)

    // Load skybox textures if not in wireframe mode
    if (!wireframeEnabled) {
      try {
        tryLoadSkybox(material)
      } catch (error) {
        console.error('Error initializing skybox:', error)
        const proceduralTexture = createProceduralSkybox()
        material.map = proceduralTexture
        material.color.setHex(0xffffff)
        material.needsUpdate = true
      }
    }

    // Setup window resize handler
    window.addEventListener('resize', handleResize)

    // Initial render
    renderer.render(scene, camera)

    // Animation loop
    const animate = () => {
      if (onAnimate && sceneRef.current && cameraRef.current && rendererRef.current) {
        onAnimate(sceneRef.current, cameraRef.current, rendererRef.current)
      }
      
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current)
      }
      
      animationFrameRef.current = requestAnimationFrame(animate)
    }

    animate()
    console.log('ThreeJS Renderer initialized successfully')
    
    // Notify parent component that scene is ready
    if (onSceneReady) {
      onSceneReady(scene, camera, renderer)
    }

    // Cleanup function
    return () => {
      console.log('Cleaning up ThreeJS Renderer...')
      window.removeEventListener('resize', handleResize)
      
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      
      if (mountRef.current && renderer.domElement) {
        try {
          mountRef.current.removeChild(renderer.domElement)
        } catch (error) {
          console.warn('Error removing canvas:', error)
        }
      }
      
      // Dispose of Three.js resources
      geometry.dispose()
      material.dispose()
      wireframeMaterial.dispose()
      renderer.dispose()
    }
  }, [wireframeEnabled, onSceneReady, onAnimate])

  return <div ref={mountRef} style={{ width: '100%', height: '100%', position: 'relative' }} />
})

ThreeJSRenderer.displayName = 'ThreeJSRenderer'

export default ThreeJSRenderer