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
  
  // Camera rotation state - needs to be accessible across all functions
  const cameraRotationRef = useRef({ yaw: 0, pitch: 0 })

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
      const rotationSpeed = 1000 * force // Increased for better responsiveness
      const deltaX = Math.cos(angle) * rotationSpeed
      const deltaY = Math.sin(angle) * rotationSpeed
      
      // Update yaw and pitch using prototype's approach
      cameraRotationRef.current.yaw += deltaX   // Horizontal rotation (left/right) - fixed direction
      cameraRotationRef.current.pitch += deltaY // Vertical rotation (up/down) - fixed direction
      
      // Constrain horizontal rotation to 90% freedom (prevent viewing directly behind) - from prototype
      cameraRotationRef.current.yaw = Math.max(-135, Math.min(135, cameraRotationRef.current.yaw))
      
      // Clamp vertical rotation - from prototype
      cameraRotationRef.current.pitch = Math.max(-85, Math.min(85, cameraRotationRef.current.pitch))
      
      // Apply rotation using spherical coordinate approach (adjusted for forward-facing)
      const phi = THREE.MathUtils.degToRad(90 - cameraRotationRef.current.pitch)
      const theta = THREE.MathUtils.degToRad(cameraRotationRef.current.yaw)
      
      // Rotate coordinate system so 0,0 faces forward (positive X)
      const x = 500 * Math.sin(phi) * Math.cos(theta)
      const y = 500 * Math.cos(phi)
      const z = 500 * Math.sin(phi) * Math.sin(theta)
      
      cameraRef.current.lookAt(x, y, z)
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
      side: THREE.DoubleSide
    })
    
    // Create wireframe material as fallback
    const wireframeMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ff00, // Green wireframe
      wireframe: true,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.3
    })
    
    let isTextureLoaded = false
    
    // Try to load local skybox first, fallback to remote if needed
    const tryLoadSkybox = () => {
      const localSkyboxPath = '/default_skybox.jpg'
      
      skyboxTexture = textureLoader.load(
        localSkyboxPath,
        (texture) => {
          // Local texture loaded successfully
          console.log('Local skybox texture loaded successfully')
          texture.mapping = THREE.EquirectangularReflectionMapping
          texture.wrapS = THREE.RepeatWrapping
          texture.wrapT = THREE.ClampToEdgeWrapping
          texture.offset.x = 0.5 // Shift texture by 180 degrees to show front when looking at positive X
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
              texture.mapping = THREE.EquirectangularReflectionMapping
              texture.wrapS = THREE.RepeatWrapping
              texture.wrapT = THREE.ClampToEdgeWrapping
              texture.offset.x = 0.5 // Shift texture by 180 degrees to show front when looking at positive X
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
      proceduralTexture.mapping = THREE.EquirectangularReflectionMapping
      proceduralTexture.wrapS = THREE.RepeatWrapping
      proceduralTexture.wrapT = THREE.ClampToEdgeWrapping
      proceduralTexture.offset.x = 0.5 // Shift texture by 180 degrees to show front when looking at positive X
      
      material.map = proceduralTexture
      material.color.setHex(0xffffff)
      material.needsUpdate = true
      
      if (!wireframeEnabled) {
        wireframeSphere.visible = false
      }
      
      console.log('Procedural skybox created as fallback')
    }

    // Create meshes first so they exist when texture callbacks execute
    const sphere = new THREE.Mesh(geometry, material)
    scene.add(sphere)
    
    // Add wireframe version for fallback/debug visualization
    const wireframeSphere = new THREE.Mesh(geometry, wireframeMaterial)
    wireframeSphere.visible = wireframeEnabled // Set initial visibility
    wireframeSphereRef.current = wireframeSphere
    scene.add(wireframeSphere)

    // Now load textures - callbacks can safely reference wireframeSphere
    try {
      tryLoadSkybox()
    } catch (error) {
      console.error('Error initializing skybox:', error)
      createProceduralSkybox()
    }

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

    // Camera control state
    let isDragging = false
    let lastMouseX = 0
    let lastMouseY = 0
    let rotationVelocityX = 0
    let rotationVelocityY = 0
    let isClick = false
    let mouseDownTime = 0
    
    // Camera control settings
    const mouseSensitivity = 0.003
    const touchSensitivity = 0.004
    const keyboardSensitivity = 0.02
    const dampingFactor = 0.85
    const maxVerticalAngle = Math.PI / 2 - 0.1 // Slight margin from straight up/down
    
    // Initialize camera rotation state from ref (facing forward in equirectangular space)
    let yaw = cameraRotationRef.current.yaw || 0   // Start looking forward (center of equirectangular)
    let pitch = cameraRotationRef.current.pitch || 0 // Start looking straight ahead
    
    // Set initial camera position and look direction
    camera.position.set(0, 0, 0)
    // Face forward (positive X direction) which is the center of equirectangular textures
    camera.lookAt(1, 0, 0)
    
    // Keyboard state
    const keys = {
      ArrowLeft: false,
      ArrowRight: false,
      ArrowUp: false,
      ArrowDown: false,
      KeyA: false,
      KeyD: false,
      KeyW: false,
      KeyS: false
    }
    
    // Raycaster for click detection on skybox
    const raycaster = new THREE.Raycaster()
    const mouse = new THREE.Vector2()

    const handleMouseMove = (event) => {
      if (isDragging) {
        const deltaX = (event.clientX - lastMouseX) * mouseSensitivity
        const deltaY = (event.clientY - lastMouseY) * mouseSensitivity
        
        // Update yaw and pitch using prototype's approach
        yaw += deltaX * 50   // Horizontal rotation (left/right) - fixed direction and scaling
        pitch += deltaY * 50 // Vertical rotation (up/down) - fixed direction and scaling
        
        // Constrain horizontal rotation to 90% freedom (prevent viewing directly behind) - from prototype
        yaw = Math.max(-135, Math.min(135, yaw))
        
        // Clamp vertical rotation - from prototype
        pitch = Math.max(-85, Math.min(85, pitch))
        
        // Store back to ref
        cameraRotationRef.current.yaw = yaw
        cameraRotationRef.current.pitch = pitch
        
        // Apply rotation using spherical coordinate approach (adjusted for forward-facing)
        const phi = THREE.MathUtils.degToRad(90 - pitch)
        const theta = THREE.MathUtils.degToRad(yaw)
        
        // Rotate coordinate system so 0,0 faces forward (positive X)
        const x = 500 * Math.sin(phi) * Math.cos(theta)
        const y = 500 * Math.cos(phi)  
        const z = 500 * Math.sin(phi) * Math.sin(theta)
        
        camera.lookAt(x, y, z)
        
        // Store velocity for momentum (optional future enhancement)
        rotationVelocityX = deltaY * 0.1
        rotationVelocityY = deltaX * 0.1
        
        lastMouseX = event.clientX
        lastMouseY = event.clientY
        
        // If we've moved significantly, it's not a click
        if (Math.abs(deltaX) > 0.01 || Math.abs(deltaY) > 0.01) {
          isClick = false
        }
      }
    }

    const handleMouseDown = (event) => {
      // Prevent context menu on right click
      if (event.button === 2) {
        event.preventDefault()
        return
      }
      
      isDragging = true
      isClick = true
      mouseDownTime = Date.now()
      lastMouseX = event.clientX
      lastMouseY = event.clientY
      renderer.domElement.style.cursor = 'grabbing'
      
      // Prevent text selection while dragging
      event.preventDefault()
    }

    const handleMouseUp = (event) => {
      if (isDragging) {
        isDragging = false
        renderer.domElement.style.cursor = 'grab'
        
        // Check if this was a click (short duration, minimal movement)
        const clickDuration = Date.now() - mouseDownTime
        if (isClick && clickDuration < 200) {
          handleClick(event)
        }
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
        isClick = true
        mouseDownTime = Date.now()
        lastMouseX = event.touches[0].clientX
        lastMouseY = event.touches[0].clientY
      }
    }

    const handleTouchMove = (event) => {
      event.preventDefault()
      if (event.touches.length === 1 && isDragging) {
        const deltaX = (event.touches[0].clientX - lastMouseX) * mouseSensitivity  // Changed to use mouseSensitivity for consistency
        const deltaY = (event.touches[0].clientY - lastMouseY) * mouseSensitivity  // Changed to use mouseSensitivity for consistency
        
        // Update yaw and pitch using prototype's approach
        yaw += deltaX * 50   // Horizontal rotation (left/right) - fixed direction and scaling
        pitch += deltaY * 50 // Vertical rotation (up/down) - fixed direction and scaling
        
        // Constrain horizontal rotation to 90% freedom (prevent viewing directly behind) - from prototype
        yaw = Math.max(-135, Math.min(135, yaw))
        
        // Clamp vertical rotation - from prototype
        pitch = Math.max(-85, Math.min(85, pitch))
        
        // Store back to ref
        cameraRotationRef.current.yaw = yaw
        cameraRotationRef.current.pitch = pitch
        
        // Apply rotation using spherical coordinate approach (adjusted for forward-facing)
        const phi = THREE.MathUtils.degToRad(90 - pitch)
        const theta = THREE.MathUtils.degToRad(yaw)
        
        // Rotate coordinate system so 0,0 faces forward (positive X)
        const x = 500 * Math.sin(phi) * Math.cos(theta)
        const y = 500 * Math.cos(phi)
        const z = 500 * Math.sin(phi) * Math.sin(theta)
        
        camera.lookAt(x, y, z)
        
        lastMouseX = event.touches[0].clientX
        lastMouseY = event.touches[0].clientY
        
        // If we've moved significantly, it's not a tap
        if (Math.abs(deltaX) > 0.01 || Math.abs(deltaY) > 0.01) {
          isClick = false
        }
      }
    }

    const handleTouchEnd = (event) => {
      event.preventDefault()
      if (event.touches.length === 0) {
        if (isDragging) {
          isDragging = false
          
          // Check if this was a tap (short duration, minimal movement)
          const tapDuration = Date.now() - mouseDownTime
          if (isClick && tapDuration < 200) {
            // Simulate click event for touch
            const touch = event.changedTouches[0]
            const clickEvent = {
              clientX: touch.clientX,
              clientY: touch.clientY
            }
            handleClick(clickEvent)
          }
        }
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

    // Keyboard event handlers
    const handleKeyDown = (event) => {
      if (keys.hasOwnProperty(event.code)) {
        keys[event.code] = true
        event.preventDefault() // Prevent default browser behavior for these keys
      }
    }

    const handleKeyUp = (event) => {
      if (keys.hasOwnProperty(event.code)) {
        keys[event.code] = false
        event.preventDefault()
      }
    }

    // Process keyboard input for camera rotation
    const processKeyboardInput = () => {
      if (!isDragging) { // Only apply keyboard controls when not dragging
        let deltaX = 0
        let deltaY = 0

        // Horizontal rotation (left/right)
        if (keys.ArrowLeft || keys.KeyA) {
          deltaX = keyboardSensitivity * 50 // Scale to match mouse sensitivity
        }
        if (keys.ArrowRight || keys.KeyD) {
          deltaX = -keyboardSensitivity * 50
        }

        // Vertical rotation (up/down)
        if (keys.ArrowUp || keys.KeyW) {
          deltaY = keyboardSensitivity * 50
        }
        if (keys.ArrowDown || keys.KeyS) {
          deltaY = -keyboardSensitivity * 50
        }

        // Apply rotation
        if (deltaX !== 0 || deltaY !== 0) {
          yaw += deltaX
          pitch += deltaY

          // Constrain horizontal rotation to 90% freedom (prevent viewing directly behind) - from prototype
          yaw = Math.max(-135, Math.min(135, yaw))
          
          // Clamp vertical rotation - from prototype
          pitch = Math.max(-85, Math.min(85, pitch))
          
          // Store back to ref
          cameraRotationRef.current.yaw = yaw
          cameraRotationRef.current.pitch = pitch
          
          // Apply rotation using spherical coordinate approach (adjusted for forward-facing)
          const phi = THREE.MathUtils.degToRad(90 - pitch)
          const theta = THREE.MathUtils.degToRad(yaw)
          
          // Rotate coordinate system so 0,0 faces forward (positive X)
          const x = 500 * Math.sin(phi) * Math.cos(theta)
          const y = 500 * Math.cos(phi)
          const z = 500 * Math.sin(phi) * Math.sin(theta)
          
          camera.lookAt(x, y, z)
        }
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
    
    // Keyboard events
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    
    window.addEventListener('deviceorientation', handleDeviceOrientation)

    // Force an initial render to ensure something shows up
    renderer.render(scene, camera)

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate)

      // Process keyboard input for smooth camera rotation
      processKeyboardInput()

      // Render the scene
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
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
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
