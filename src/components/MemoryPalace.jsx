import React, { useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import * as THREE from 'three'
import nipplejs from 'nipplejs'

const MemoryPalace = forwardRef(({ 
  wireframeEnabled = false, 
  nippleEnabled = false 
}, ref) => {
  const mountRef = useRef(null)
  const sceneRef = useRef(null)
  const rendererRef = useRef(null)
  const cameraRef = useRef(null)
  const wireframeSphereRef = useRef(null)
  const nippleManagerRef = useRef(null)
  const nippleContainerRef = useRef(null)

  // Nipple.js functions
  const initializeNipple = () => {
    if (nippleManagerRef.current || !nippleEnabled) return

    console.log('Initializing nipple.js controls...')
    
    // Create nipple container if it doesn't exist
    if (!nippleContainerRef.current) {
      const container = document.createElement('div')
      container.className = 'nipple-container'
      document.body.appendChild(container)
      nippleContainerRef.current = container
    }

    // Initialize nipple manager
    const manager = nipplejs.create({
      zone: nippleContainerRef.current,
      mode: 'static',
      position: { left: '50%', top: '50%' },
      color: 'rgba(255, 255, 255, 0.8)',
      size: 100
    })

    nippleManagerRef.current = manager

    // Handle nipple events
    manager.on('move', (evt, data) => {
      if (!cameraRef.current) return

      const force = data.force
      const angle = data.angle.radian
      
      // Convert nipple input to camera rotation
      const rotationSpeed = 0.02 * force
      const deltaX = Math.cos(angle) * rotationSpeed
      const deltaY = Math.sin(angle) * rotationSpeed
      
      cameraRef.current.rotation.y -= deltaX
      cameraRef.current.rotation.x -= deltaY
      
      // Limit vertical rotation
      cameraRef.current.rotation.x = Math.max(
        -Math.PI / 2, 
        Math.min(Math.PI / 2, cameraRef.current.rotation.x)
      )
    })

    console.log('Nipple.js controls initialized')
  }

  const cleanupNipple = () => {
    if (nippleManagerRef.current) {
      nippleManagerRef.current.destroy()
      nippleManagerRef.current = null
    }
    
    if (nippleContainerRef.current) {
      document.body.removeChild(nippleContainerRef.current)
      nippleContainerRef.current = null
    }
  }

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    toggleWireframe: (enabled) => {
      if (wireframeSphereRef.current) {
        wireframeSphereRef.current.visible = enabled
      }
    },
    toggleNipple: (enabled) => {
      if (enabled) {
        initializeNipple()
      } else {
        cleanupNipple()
      }
    }
  }))

  useEffect(() => {
    if (!mountRef.current || sceneRef.current) return

    console.log('Initializing Memory Palace scene...')

    // Initialize Three.js scene
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x000000) // Ensure black background as fallback
    
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    )
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      alpha: false, // Change to false for better performance
      preserveDrawingBuffer: true
    })

    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    
    console.log('Appending canvas to DOM...')
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
    
    // Try to load local skybox first, fallback to remote if needed
    const tryLoadSkybox = () => {
      const localSkyboxPath = './assets/default_skybox.jpg'
      
      skyboxTexture = textureLoader.load(
        localSkyboxPath,
        (texture) => {
          // Local texture loaded successfully
          console.log('Local skybox texture loaded successfully')
          material.map = texture
          material.color.setHex(0xffffff)
          material.needsUpdate = true
          isTextureLoaded = true
          
          if (!wireframeEnabled) {
            wireframeSphere.visible = false
          }
        },
        undefined,
        (error) => {
          console.warn('Local skybox failed, trying remote fallback:', error)
          
          // Fallback to remote texture
          skyboxTexture = textureLoader.load(
            'https://page-images.websim.com/Create_a_360_degree_equirectangular_panoramic_image_in_21_9_aspect_ratio_showing__scene_____TECHNICA_694056a68c0178.jpg',
            (texture) => {
              console.log('Remote skybox texture loaded successfully')
              material.map = texture
              material.color.setHex(0xffffff)
              material.needsUpdate = true
              isTextureLoaded = true
              
              if (!wireframeEnabled) {
                wireframeSphere.visible = false
              }
            },
            undefined,
            (remoteError) => {
              console.error('Both local and remote skybox loading failed:', remoteError)
              console.log('Keeping wireframe mode visible as fallback')
              // Create a simple procedural texture as final fallback
              createProceduralSkybox()
            }
          )
        }
      )
    }

    const createProceduralSkybox = () => {
      // Create a simple procedural starfield texture
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
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
      proceduralTexture.wrapS = THREE.RepeatWrapping
      proceduralTexture.wrapT = THREE.ClampToEdgeWrapping
      
      material.map = proceduralTexture
      material.color.setHex(0xffffff)
      material.needsUpdate = true
      
      if (!wireframeEnabled) {
        wireframeSphere.visible = false
      }
      
      console.log('Procedural skybox created as fallback')
    }

    try {
      tryLoadSkybox()
    } catch (error) {
      console.error('Error initializing skybox:', error)
      createProceduralSkybox()
    }
    
    const sphere = new THREE.Mesh(geometry, material)
    scene.add(sphere)
    
    // Add wireframe version for fallback/debug visualization
    const wireframeSphere = new THREE.Mesh(geometry, wireframeMaterial)
    wireframeSphere.visible = wireframeEnabled // Set initial visibility
    wireframeSphereRef.current = wireframeSphere
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

    // Mouse and touch controls
    let mouseX = 0
    let mouseY = 0
    let targetRotationX = 0
    let targetRotationY = 0
    let isDragging = false
    let lastTouchX = 0
    let lastTouchY = 0
    
    // Raycaster for click detection on skybox
    const raycaster = new THREE.Raycaster()
    const mouse = new THREE.Vector2()

    const handleMouseMove = (event) => {
      if (isDragging) {
        const deltaX = (event.clientX - lastTouchX) * 0.005
        const deltaY = (event.clientY - lastTouchY) * 0.005
        
        camera.rotation.y -= deltaX
        camera.rotation.x -= deltaY
        
        // Limit vertical rotation
        camera.rotation.x = Math.max(
          -Math.PI / 2, 
          Math.min(Math.PI / 2, camera.rotation.x)
        )
        
        lastTouchX = event.clientX
        lastTouchY = event.clientY
      } else {
        // Original mouse hover behavior for non-dragging
        mouseX = (event.clientX - window.innerWidth / 2) * 0.001
        mouseY = (event.clientY - window.innerHeight / 2) * 0.001
        
        targetRotationY = mouseX * Math.PI
        targetRotationX = mouseY * Math.PI * 0.5
      }
    }

    const handleMouseDown = (event) => {
      isDragging = true
      lastTouchX = event.clientX
      lastTouchY = event.clientY
      renderer.domElement.style.cursor = 'grabbing'
    }

    const handleMouseUp = (event) => {
      if (isDragging) {
        isDragging = false
        renderer.domElement.style.cursor = 'grab'
      }
    }

    const handleClick = (event) => {
      if (!isDragging) {
        // Calculate mouse position in normalized device coordinates (-1 to +1)
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1

        // Update the picking ray with the camera and mouse position
        raycaster.setFromCamera(mouse, camera)

        // Calculate objects intersecting the picking ray
        const intersects = raycaster.intersectObject(sphere)

        if (intersects.length > 0) {
          const intersectionPoint = intersects[0].point
          console.log('Skybox clicked at point:', intersectionPoint)
          
          // Here you can add logic for room/door/object interactions
          // For now, just log the click position
          console.log('Click detected on skybox sphere - ready for interaction logic')
          
          // Optional: Add visual feedback
          const clickIndicator = new THREE.SphereGeometry(2, 8, 6)
          const clickMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 })
          const clickMesh = new THREE.Mesh(clickIndicator, clickMaterial)
          clickMesh.position.copy(intersectionPoint)
          scene.add(clickMesh)
          
          // Remove indicator after 1 second
          setTimeout(() => {
            scene.remove(clickMesh)
            clickIndicator.dispose()
            clickMaterial.dispose()
          }, 1000)
        }
      }
    }

    // Touch event handlers
    const handleTouchStart = (event) => {
      event.preventDefault()
      if (event.touches.length === 1) {
        isDragging = true
        lastTouchX = event.touches[0].clientX
        lastTouchY = event.touches[0].clientY
      }
    }

    const handleTouchMove = (event) => {
      event.preventDefault()
      if (event.touches.length === 1 && isDragging) {
        const deltaX = (event.touches[0].clientX - lastTouchX) * 0.005
        const deltaY = (event.touches[0].clientY - lastTouchY) * 0.005
        
        camera.rotation.y -= deltaX
        camera.rotation.x -= deltaY
        
        // Limit vertical rotation
        camera.rotation.x = Math.max(
          -Math.PI / 2, 
          Math.min(Math.PI / 2, camera.rotation.x)
        )
        
        lastTouchX = event.touches[0].clientX
        lastTouchY = event.touches[0].clientY
      }
    }

    const handleTouchEnd = (event) => {
      event.preventDefault()
      if (event.touches.length === 0) {
        isDragging = false
      }
    }

    const handleDeviceOrientation = (event) => {
      if (event.alpha !== null && event.beta !== null && event.gamma !== null) {
        const alpha = event.alpha * Math.PI / 180
        const beta = event.beta * Math.PI / 180
        const gamma = event.gamma * Math.PI / 180

        camera.rotation.set(beta - Math.PI / 2, alpha, -gamma)
      }
    }

    // Set cursor style
    renderer.domElement.style.cursor = 'grab'

    // Add event listeners
    window.addEventListener('mousemove', handleMouseMove)
    renderer.domElement.addEventListener('mousedown', handleMouseDown)
    window.addEventListener('mouseup', handleMouseUp)
    renderer.domElement.addEventListener('click', handleClick)
    
    // Touch events
    renderer.domElement.addEventListener('touchstart', handleTouchStart, { passive: false })
    renderer.domElement.addEventListener('touchmove', handleTouchMove, { passive: false })
    renderer.domElement.addEventListener('touchend', handleTouchEnd, { passive: false })
    
    window.addEventListener('deviceorientation', handleDeviceOrientation)

    // Force an initial render to ensure something shows up
    renderer.render(scene, camera)

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate)

      // Smooth camera rotation for mouse control
      if (!window.DeviceOrientationEvent && !nippleManagerRef.current) {
        camera.rotation.y += (targetRotationY - camera.rotation.y) * 0.05
        camera.rotation.x += (targetRotationX - camera.rotation.x) * 0.05
        
        // Limit vertical rotation
        camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, camera.rotation.x))
      }

      renderer.render(scene, camera)
    }

    animate()
    console.log('Memory Palace scene initialized successfully')
    
    // Initialize nipple if enabled
    if (nippleEnabled) {
      setTimeout(initializeNipple, 100) // Small delay to ensure DOM is ready
    }

    // Cleanup
    return () => {
      console.log('Cleaning up Memory Palace scene...')
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      window.removeEventListener('deviceorientation', handleDeviceOrientation)
      
      // Remove canvas event listeners
      if (renderer.domElement) {
        renderer.domElement.removeEventListener('mousedown', handleMouseDown)
        renderer.domElement.removeEventListener('click', handleClick)
        renderer.domElement.removeEventListener('touchstart', handleTouchStart)
        renderer.domElement.removeEventListener('touchmove', handleTouchMove)
        renderer.domElement.removeEventListener('touchend', handleTouchEnd)
      }
      
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
      
      // Cleanup nipple
      cleanupNipple()
      
      // Clear refs
      sceneRef.current = null
      rendererRef.current = null
      cameraRef.current = null
      wireframeSphereRef.current = null
    }
  }, [])

  // Handle wireframe toggle
  useEffect(() => {
    if (wireframeSphereRef.current) {
      wireframeSphereRef.current.visible = wireframeEnabled
    }
  }, [wireframeEnabled])

  // Handle nipple toggle
  useEffect(() => {
    if (nippleEnabled) {
      initializeNipple()
    } else {
      cleanupNipple()
    }
  }, [nippleEnabled])

  return <div ref={mountRef} className="memory-palace-canvas" />
})

MemoryPalace.displayName = 'MemoryPalace'

export default MemoryPalace