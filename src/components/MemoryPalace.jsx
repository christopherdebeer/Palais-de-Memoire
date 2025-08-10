import React, { useRef, useEffect } from 'react'
import * as THREE from 'three'

const MemoryPalace = () => {
  const mountRef = useRef(null)
  const sceneRef = useRef(null)
  const rendererRef = useRef(null)
  const cameraRef = useRef(null)

  useEffect(() => {
    if (!mountRef.current || sceneRef.current) return

    console.log('Initializing Memory Palace scene...')

    // Initialize Three.js scene
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    )
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })

    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    
    console.log('Appending canvas to DOM...')
    mountRef.current.appendChild(renderer.domElement)

    // Create skybox sphere (inverted for interior view)
    const geometry = new THREE.SphereGeometry(500, 60, 40)
    geometry.scale(-1, 1, 1) // Flip inside out
    
    // Load skybox texture
    const textureLoader = new THREE.TextureLoader()
    let skyboxTexture = null
    
    // Create material with fallback color initially
    const material = new THREE.MeshBasicMaterial({
      color: 0x1a1a2e, // Dark fallback color
      side: THREE.BackSide
    })
    
    // Create wireframe material as fallback
    const wireframeMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ff00, // Green wireframe
      wireframe: true,
      side: THREE.BackSide,
      transparent: true,
      opacity: 0.3
    })
    
    let isTextureLoaded = false
    
    try {
      skyboxTexture = textureLoader.load(
        'https://page-images.websim.com/Create_a_360_degree_equirectangular_panoramic_image_in_21_9_aspect_ratio_showing__scene_____TECHNICA_694056a68c0178.jpg',
        (texture) => {
          // Texture loaded successfully - update material
          console.log('Skybox texture loaded successfully')
          material.map = texture
          material.color.setHex(0xffffff) // Set to white to show texture properly
          material.needsUpdate = true
          isTextureLoaded = true
          
          // Hide wireframe when texture loads
          wireframeSphere.visible = false
        },
        undefined,
        (error) => {
          console.error('Error loading skybox texture:', error)
          console.log('Keeping wireframe mode visible as fallback')
          // Keep wireframe visible as fallback
        }
      )
    } catch (error) {
      console.error('Error creating skybox texture:', error)
      console.log('Keeping wireframe mode visible as fallback')
      // Keep wireframe visible as fallback
    }
    
    const sphere = new THREE.Mesh(geometry, material)
    scene.add(sphere)
    
    // Add wireframe version for fallback/debug visualization
    const wireframeSphere = new THREE.Mesh(geometry, wireframeMaterial)
    scene.add(wireframeSphere)

    // Add ambient lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6)
    scene.add(ambientLight)

    // Add directional light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
    directionalLight.position.set(1, 1, 1)
    scene.add(directionalLight)

    // Add axes helper for direction indicators
    const axesHelper = new THREE.AxesHelper(100) // Size 100 units
    scene.add(axesHelper)

    // Add grid helper on the ground for spatial reference
    const gridHelper = new THREE.GridHelper(200, 20, 0x444444, 0x444444)
    gridHelper.position.y = -480
    gridHelper.material.transparent = true
    gridHelper.material.opacity = 0.5
    scene.add(gridHelper)

    // Create ground compass indicator
    const compassGeometry = new THREE.CircleGeometry(50, 32)
    const compassMaterial = new THREE.MeshBasicMaterial({
      color: 0x333333,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide
    })
    const compass = new THREE.Mesh(compassGeometry, compassMaterial)
    compass.rotation.x = -Math.PI / 2
    compass.position.y = -480
    scene.add(compass)

    // Store references
    sceneRef.current = scene
    rendererRef.current = renderer
    cameraRef.current = camera

    // Set initial camera position
    camera.position.set(0, 0, 0)

    // Handle window resize
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
    }

    window.addEventListener('resize', handleResize)

    // Mouse controls for desktop
    let mouseX = 0
    let mouseY = 0
    let targetRotationX = 0
    let targetRotationY = 0

    const handleMouseMove = (event) => {
      mouseX = (event.clientX - window.innerWidth / 2) * 0.001
      mouseY = (event.clientY - window.innerHeight / 2) * 0.001
      
      targetRotationY = mouseX * Math.PI
      targetRotationX = mouseY * Math.PI * 0.5
    }

    const handleDeviceOrientation = (event) => {
      if (event.alpha !== null && event.beta !== null && event.gamma !== null) {
        const alpha = event.alpha * Math.PI / 180
        const beta = event.beta * Math.PI / 180
        const gamma = event.gamma * Math.PI / 180

        camera.rotation.set(beta - Math.PI / 2, alpha, -gamma)
      }
    }

    // Add event listeners
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('deviceorientation', handleDeviceOrientation)

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate)

      // Smooth camera rotation for mouse control
      if (!window.DeviceOrientationEvent) {
        camera.rotation.y += (targetRotationY - camera.rotation.y) * 0.05
        camera.rotation.x += (targetRotationX - camera.rotation.x) * 0.05
        
        // Limit vertical rotation
        camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, camera.rotation.x))
      }

      renderer.render(scene, camera)
    }

    animate()
    console.log('Memory Palace scene initialized successfully')

    // Cleanup
    return () => {
      console.log('Cleaning up Memory Palace scene...')
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('deviceorientation', handleDeviceOrientation)
      
      if (mountRef.current && renderer.domElement) {
        try {
          mountRef.current.removeChild(renderer.domElement)
        } catch (error) {
          console.warn('Error removing canvas:', error)
        }
      }
      
      geometry.dispose()
      material.dispose()
      wireframeMaterial.dispose()
      if (skyboxTexture) {
        skyboxTexture.dispose()
      }
      compassGeometry.dispose()
      compassMaterial.dispose()
      gridHelper.dispose()
      renderer.dispose()
      
      // Clear refs
      sceneRef.current = null
      rendererRef.current = null
      cameraRef.current = null
    }
  }, [])

  return <div ref={mountRef} className="memory-palace-canvas" />
}

export default MemoryPalace