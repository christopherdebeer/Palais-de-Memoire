import React, { useRef, useState, useEffect, forwardRef, useImperativeHandle } from 'react'
import * as THREE from 'three'
import SimpleParticleManager from '../utils/SimpleParticleManager'
import SettingsManager from '../services/SettingsManager'
import { useJoystick, usePaintMode, useCameraControls } from '../hooks'

const MemoryPalace = forwardRef(({ 
  wireframeEnabled = false, 
  nippleEnabled = false,
  paintModeEnabled = false,
  paintModeType = 'objects',
  onCreationModeTriggered = null,
  onObjectSelected = null,
  onPaintedObjectCreated = null,
  onPaintTypeChange = null,
  onPaintedAreasChange = null,
  selectedObjectId = null,
  currentRoom = null,
  objects = [],
  creationModeActive = false,
  aiObjectProperties = null
}, ref) => {
  const mountRef = useRef(null)
  const sceneRef = useRef(null)
  const rendererRef = useRef(null)
  const cameraRef = useRef(null)
  const wireframeSphereRef = useRef(null)
  const skyboxSphereRef = useRef(null)
  const skyboxMaterialRef = useRef(null)
  const particleManagerRef = useRef(null)
  const objectMarkersRef = useRef(new Map())
  const offScreenIndicatorsRef = useRef(new Map())
  const animationFrameRef = useRef(null)
  const settingsManagerRef = useRef(new SettingsManager())

  // Hooks for modularized logic
  const { cameraRotationRef, applyRotation } = useCameraControls(cameraRef)
  const {
    paintCanvasRef,
    paintTextureRef,
    paintContextRef,
    paintedGroups,
    setPaintedGroups,
    paintModeEnabledRef,
    initializePaintCanvas,
    enablePaintMode,
    disablePaintMode,
    cleanupStrokeData,
    exposePaintedAreasToLLM,
    processPaintedAreasIntoObjects,
    paintOnSkybox,
    getPaintedObjectAt
  } = usePaintMode({
    sceneRef,
    cameraRef,
    skyboxMaterialRef,
    skyboxSphereRef,
    creationModeActive,
    paintModeType,
    onPaintTypeChange,
    onPaintedObjectCreated,
    onPaintedAreasChange,
    aiObjectProperties
  })
  const { initializeNipple, cleanupNipple } = useJoystick({
    nippleEnabled,
    cameraRef,
    applyRotation
  })

  // Update camera FOV dynamically
  const updateCameraFov = (newFov) => {
    if (cameraRef.current) {
      cameraRef.current.fov = newFov
      cameraRef.current.updateProjectionMatrix()
      console.log('[MemoryPalace] Updated camera FOV to:', newFov)
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
    },
    updateCameraFov: updateCameraFov,
    cleanupStrokeData: cleanupStrokeData
  }))

  useEffect(() => {
    if (!mountRef.current || sceneRef.current) return

    console.log('Initializing Memory Palace scene...')

    // Initialize Three.js scene
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x000000) // Ensure black background as fallback
    
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
      const localSkyboxPath = '/default_skybox.png'
      
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
    
    // Store references for room-based texture updates
    skyboxSphereRef.current = sphere
    skyboxMaterialRef.current = material
    
    // Add wireframe version for fallback/debug visualization
    const wireframeSphere = new THREE.Mesh(geometry, wireframeMaterial)
    wireframeSphere.visible = wireframeEnabled // Set initial visibility
    wireframeSphereRef.current = wireframeSphere
    scene.add(wireframeSphere)

    // Only load textures if wireframe is disabled
    if (!wireframeEnabled) {
      try {
        tryLoadSkybox()
      } catch (error) {
        console.error('Error initializing skybox:', error)
        createProceduralSkybox()
      }
    } else {
      console.log('[MemoryPalace] Wireframe enabled, skipping texture loading')
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

    // Initialize particle manager for object markers
    particleManagerRef.current = new SimpleParticleManager()
    console.log('[MemoryPalace] Particle manager initialized')

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
    
    // Double-click detection state
    let lastClickTime = 0
    let lastClickPosition = { x: 0, y: 0 }
    const DOUBLE_CLICK_THRESHOLD = 300 // ms
    const DOUBLE_CLICK_DISTANCE_THRESHOLD = 10 // pixels
    
    // Camera control settings from SettingsManager
    const mouseSensitivity = settingsManagerRef.current.get('mouseSensitivity') || 0.003
    const touchSensitivity = settingsManagerRef.current.get('touchSensitivity') || 0.004
    const keyboardSensitivity = settingsManagerRef.current.get('keyboardSensitivity') || 0.02
    const dampingFactor = 0.85
    const maxVerticalAngle = Math.PI / 2 - 0.1 // Slight margin from straight up/down

    // Set initial camera position and look direction
    camera.position.set(0, 0, 0)
    applyRotation(0, 0)
    
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
        const currentPaintMode = paintModeEnabledRef.current
        // In paint mode, paint while dragging instead of rotating camera
        if (currentPaintMode) {
          console.log('[MemoryPalace] DEBUG: Paint mode mouse move - painting instead of camera rotation')
          paintOnSkybox(event)
          lastMouseX = event.clientX
          lastMouseY = event.clientY
          isClick = false // Dragging paint stroke is not a click
          event.preventDefault() // Prevent any other event handling
          event.stopPropagation() // Stop event bubbling
          return // Early return - don't execute camera rotation code below
        }
        
        const deltaX = (event.clientX - lastMouseX) * mouseSensitivity
        const deltaY = (event.clientY - lastMouseY) * mouseSensitivity

        applyRotation(deltaX * 50, deltaY * 50)

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
      const currentPaintMode = paintModeEnabledRef.current
      console.log('[MemoryPalace] DEBUG: Mouse down event', { button: event.button, paintModeEnabled: currentPaintMode })
      
      // In paint mode, prevent all default behaviors and stop propagation
      if (currentPaintMode) {
        event.preventDefault()
        event.stopPropagation()
        console.log('[MemoryPalace] DEBUG: Paint mode - prevented defaults and stopped propagation')
        // return false
      }
      
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
      
      if (!currentPaintMode) {
        renderer.domElement.style.cursor = 'grabbing'
      } else {
        console.log('[MemoryPalace] DEBUG: In paint mode - setting paint cursor')
        renderer.domElement.style.cursor = 'crosshair'
      }
      
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
        const currentPaintMode = paintModeEnabledRef.current
        // Check if we're in paint mode - paint instead of other interactions
        if (currentPaintMode) {
          console.log('[MemoryPalace] Paint mode click detected')
          paintOnSkybox(event)
          return
        }
        
        // Check for painted object selection when not in paint mode
        const paintedObject = getPaintedObjectAt(event)
        if (paintedObject) {
          console.log('[MemoryPalace] Painted object clicked:', paintedObject)
          // Convert painted object to standard object format for existing system
          const objectData = {
            id: paintedObject.id,
            name: paintedObject.metadata.name,
            information: paintedObject.metadata.info,
            position: paintedObject.worldPosition,
            isPaintedObject: true
          }
          
          if (onObjectSelected) {
            onObjectSelected(paintedObject.id, objectData)
          }
          return
        }
        
        const currentTime = Date.now()
        const currentPosition = { x: event.clientX, y: event.clientY }
        
        // Check for double-click
        const timeSinceLastClick = currentTime - lastClickTime
        const distanceFromLastClick = Math.sqrt(
          Math.pow(currentPosition.x - lastClickPosition.x, 2) + 
          Math.pow(currentPosition.y - lastClickPosition.y, 2)
        )
        
        const isDoubleClick = timeSinceLastClick < DOUBLE_CLICK_THRESHOLD && 
                             distanceFromLastClick < DOUBLE_CLICK_DISTANCE_THRESHOLD
        
        // Update click tracking
        lastClickTime = currentTime
        lastClickPosition = currentPosition
        
        if (isDoubleClick) {
          console.log('[MemoryPalace] Double-click detected - entering creation mode')
          handleCreationModeClick(event)
        } else {
          // Single click - handle existing object interactions
          handleSingleClick(event)
        }
      }
    }

    const handleSingleClick = (event) => {
      // Calculate mouse position in normalized device coordinates (-1 to +1)
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1

      // Update the picking ray with the camera and mouse position
      raycaster.setFromCamera(mouse, camera)

      // First check for object marker intersections
      const objectMarkers = Array.from(objectMarkersRef.current.values())
      const objectIntersects = raycaster.intersectObjects(objectMarkers)
      
      if (objectIntersects.length > 0) {
        // Object clicked - get the closest intersection
        const objectIntersect = objectIntersects[0]
        const marker = objectIntersect.object
        const objectData = marker.userData.objectData
        
        console.log('[MemoryPalace] Object clicked:', objectData.name, objectData.id)
        
        // Highlight the selected object
        const originalOpacity = marker.material.opacity;
        if (marker.material) {
          marker.material.opacity = 0.3 // Make visible temporarily
          setTimeout(() => {
            if (marker.material) {
              marker.material.opacity = originalOpacity // Back to original
            }
          }, 500)
        }
        
        // Notify parent component about object selection
        if (onObjectSelected) {
          onObjectSelected(objectData.id, objectData)
        }
        
        return // Don't process skybox click if object was clicked
      }

      // No object clicked, check skybox intersection
      const skyboxIntersects = raycaster.intersectObject(sphere)
      if (skyboxIntersects.length > 0) {
        const intersectionPoint = skyboxIntersects[0].point
        console.log('[MemoryPalace] Skybox single click at point:', intersectionPoint)
        
        // Add visual feedback for skybox click
        const clickIndicator = new THREE.SphereGeometry(1, 8, 6)
        const clickMaterial = new THREE.MeshBasicMaterial({ 
          color: 0x00ff00, 
          transparent: true, 
          opacity: 0.7 
        })
        const clickMesh = new THREE.Mesh(clickIndicator, clickMaterial)
        clickMesh.position.copy(intersectionPoint)
        scene.add(clickMesh)
        
        // Remove indicator after 0.5 seconds
        setTimeout(() => {
          scene.remove(clickMesh)
          clickIndicator.dispose()
          clickMaterial.dispose()
        }, 500)
      }
    }

  const handleCreationModeClick = (event) => {
    // Calculate mouse position in normalized device coordinates (-1 to +1)
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1

    // Update the picking ray with the camera and mouse position
    raycaster.setFromCamera(mouse, camera)

    // Calculate objects intersecting the picking ray
    const intersects = raycaster.intersectObject(sphere)

    if (intersects.length > 0) {
      const intersectionPoint = intersects[0].point
      const uv = intersects[0].uv
      console.log('[MemoryPalace] Creation mode triggered at point:', intersectionPoint)
      
      // Position object/door slightly outside the sphere surface (like prototype)
      const positionMultiplier = 1.02
      const creationPosition = {
        x: intersectionPoint.x * positionMultiplier,
        y: intersectionPoint.y * positionMultiplier,
        z: intersectionPoint.z * positionMultiplier
      }
      
      // Initialize paint canvas if not already done
      initializePaintCanvas()
      
      // Enable paint mode and create initial mark at tapped position
      if (!paintModeEnabledRef.current) {
        console.log('[MemoryPalace] Auto-enabling paint mode and creating initial mark')
        
        // Create initial paint mark at the tapped position
        if (uv && paintContextRef.current && paintCanvasRef.current) {
          const canvas = paintCanvasRef.current
          const context = paintContextRef.current
          
          // Convert UV coordinates to canvas coordinates
          let canvasX = ((uv.x + 0.5) % 1.0) * canvas.width
          let canvasY = (1.0 - uv.y) * canvas.height
          
          // Create initial mark with default object color (red)
          const brushSize = 25
          const initialColor = 'rgba(255, 0, 0, 0.9)' // Red for objects (default)
          
          context.fillStyle = initialColor
          context.beginPath()
          context.arc(canvasX, canvasY, brushSize, 0, Math.PI * 2)
          context.fill()
          
          // Store initial painted area
          const initialPaintedArea = {
            id: Date.now() + Math.random(),
            center: { x: canvasX, y: canvasY },
            size: brushSize,
            color: initialColor,
            worldPosition: intersectionPoint.clone(),
            metadata: { 
              name: `Object ${paintedGroups.size + 1}`, 
              info: 'Created with creation mode',
              aiGenerated: false
            },
            effectiveType: 'objects',
            isInitialMark: true
          }
          
          setPaintedGroups(prevGroups => {
            const newGroups = new Map(prevGroups)
            newGroups.set(initialPaintedArea.id, initialPaintedArea)
            return newGroups
          })
          
          // Update texture
          if (paintTextureRef.current) {
            paintTextureRef.current.needsUpdate = true
          }
          
          console.log('[MemoryPalace] Created initial paint mark:', initialPaintedArea)
        }
        
        // Enable paint mode through parent
        if (onPaintTypeChange) {
          // This will trigger paint mode activation in the parent
          console.log('[MemoryPalace] Requesting paint mode activation')
        }
      }
      
      // Add visual feedback for creation mode
      const creationIndicator = new THREE.SphereGeometry(3, 8, 6)
      const creationMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xff6600, 
        transparent: true, 
        opacity: 0.8 
      })
      const creationMesh = new THREE.Mesh(creationIndicator, creationMaterial)
      creationMesh.position.copy(intersectionPoint)
      scene.add(creationMesh)
      
      // Pulsing animation for creation indicator
      let pulseDirection = 1
      const pulseAnimation = () => {
        if (creationMesh.parent) {
          const scale = creationMesh.scale.x + (pulseDirection * 0.02)
          if (scale > 1.3) pulseDirection = -1
          if (scale < 0.7) pulseDirection = 1
          creationMesh.scale.setScalar(scale)
          requestAnimationFrame(pulseAnimation)
        }
      }
      pulseAnimation()
      
      // Notify parent component about creation mode
      if (onCreationModeTriggered) {
        onCreationModeTriggered({
          position: creationPosition,
          screenPosition: { x: event.clientX, y: event.clientY },
          worldPosition: intersectionPoint,
          timestamp: Date.now(),
          initialPaintMark: true // Flag to indicate initial paint mark was created
        })
      }
      
      // Remove creation indicator after 15 seconds (extended for paint workflow)
      setTimeout(() => {
        if (creationMesh.parent) {
          scene.remove(creationMesh)
          creationIndicator.dispose()
          creationMaterial.dispose()
        }
      }, 15000)
    }
  }

    // Touch event handlers
    const handleTouchStart = (event) => {
      const currentPaintMode = paintModeEnabledRef.current
      console.log('[MemoryPalace] DEBUG: Touch start event', { touchCount: event.touches.length, paintModeEnabled: currentPaintMode })
      
      // In paint mode, prevent all defaults and stop propagation
      if (currentPaintMode) {
        event.preventDefault()
        event.stopPropagation()
        console.log('[MemoryPalace] DEBUG: Paint mode touch - prevented defaults and stopped propagation')
        // Still process the touch for painting
        if (event.touches.length === 1) {
          isDragging = true
          isClick = true
          mouseDownTime = Date.now()
          lastMouseX = event.touches[0].clientX
          lastMouseY = event.touches[0].clientY
        }
        return false
      }
      
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
        const currentPaintMode = paintModeEnabledRef.current
        // In paint mode, paint while dragging instead of rotating camera
        if (currentPaintMode) {
          console.log('[MemoryPalace] DEBUG: Paint mode touch move - painting instead of camera rotation')
          const touchEvent = {
            clientX: event.touches[0].clientX,
            clientY: event.touches[0].clientY
          }
          paintOnSkybox(touchEvent)
          lastMouseX = event.touches[0].clientX
          lastMouseY = event.touches[0].clientY
          isClick = false // Dragging paint stroke is not a tap
          event.stopPropagation() // Stop event bubbling
          return // Early return - don't execute camera rotation code below
        }
        
        const deltaX = (event.touches[0].clientX - lastMouseX) * touchSensitivity
        const deltaY = (event.touches[0].clientY - lastMouseY) * touchSensitivity

        applyRotation(deltaX * 50, deltaY * 50)

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

    // Helper function to check if user is currently typing in an input field
    const isTypingInInput = () => {
      const activeElement = document.activeElement
      if (!activeElement) return false
      
      const inputTypes = ['INPUT', 'TEXTAREA', 'SELECT']
      const isInputElement = inputTypes.includes(activeElement.tagName)
      const isContentEditable = activeElement.contentEditable === 'true'
      
      // Also check for specific input types that should allow typing
      if (activeElement.tagName === 'INPUT') {
        const inputType = activeElement.type.toLowerCase()
        const textInputTypes = ['text', 'password', 'email', 'search', 'url', 'tel', 'number']
        return textInputTypes.includes(inputType)
      }
      
      return isInputElement || isContentEditable
    }

    // Keyboard event handlers with smart input detection
    const handleKeyDown = (event) => {
      if (keys.hasOwnProperty(event.code)) {
        // Only handle navigation keys if user is NOT typing in an input field
        if (!isTypingInInput()) {
          keys[event.code] = true
          event.preventDefault() // Prevent default browser behavior for navigation keys
        }
        // If user IS typing, let the input field handle the key normally
      }
    }

    const handleKeyUp = (event) => {
      if (keys.hasOwnProperty(event.code)) {
        // Only handle navigation keys if user is NOT typing in an input field
        if (!isTypingInInput()) {
          keys[event.code] = false
          event.preventDefault()
        }
        // If user IS typing, let the input field handle the key normally
      }
    }

    // Process keyboard input for camera rotation
    const processKeyboardInput = () => {
      if (!isDragging) { // Only apply keyboard controls when not dragging
        let deltaX = 0
        let deltaY = 0

        // Horizontal rotation (left/right)
        if (keys.ArrowLeft || keys.KeyA) {
          deltaX = -keyboardSensitivity * 50 // Scale to match mouse sensitivity
        }
        if (keys.ArrowRight || keys.KeyD) {
          deltaX = keyboardSensitivity * 50
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
          applyRotation(deltaX, deltaY)
        }
      }
    }

    // Set cursor style
    renderer.domElement.style.cursor = 'grab'

    // Add event listeners
    window.addEventListener('mousemove', handleMouseMove)
    renderer.domElement.addEventListener('mousedown', handleMouseDown)
    window.addEventListener('mouseup', handleMouseUp)
    // renderer.domElement.addEventListener('click', handleClick)
    
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

    // Start object animation loop
    startObjectAnimation()

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
      
      // Stop object animations
      stopObjectAnimation()
      
      // Cleanup particle manager
      if (particleManagerRef.current) {
        particleManagerRef.current.dispose()
        particleManagerRef.current = null
      }
      
      // Clear object markers
      objectMarkersRef.current.clear()
      
      // Clear off-screen indicators
      const currentIndicators = offScreenIndicatorsRef.current
      currentIndicators.forEach((indicator, objectId) => {
        if (indicator.arrow) {
          sceneRef.current.remove(indicator.arrow)
          if (indicator.arrow.geometry) indicator.arrow.geometry.dispose()
          if (indicator.arrow.material) indicator.arrow.material.dispose()
        }
        if (indicator.sprite) {
          sceneRef.current.remove(indicator.sprite)
          if (indicator.sprite.material && indicator.sprite.material.map) {
            indicator.sprite.material.map.dispose()
          }
          if (indicator.sprite.material) indicator.sprite.material.dispose()
        }
      })
      offScreenIndicatorsRef.current.clear()
      
      // Clean up paint resources
      if (skyboxSphereRef.current?.userData.paintSphere) {
        const paintSphere = skyboxSphereRef.current.userData.paintSphere
        const paintMaterial = skyboxSphereRef.current.userData.paintMaterial
        const paintGeometry = skyboxSphereRef.current.userData.paintGeometry
        
        if (sceneRef.current) sceneRef.current.remove(paintSphere)
        if (paintGeometry) paintGeometry.dispose()
        if (paintMaterial) paintMaterial.dispose()
      }
      
      if (paintTextureRef.current) {
        paintTextureRef.current.dispose()
        paintTextureRef.current = null
      }
      
      paintCanvasRef.current = null
      paintContextRef.current = null
      setPaintedGroups(new Map())
      
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

    // Handle texture loading/unloading based on wireframe state
    if (!wireframeEnabled && skyboxMaterialRef.current) {
      // Switching to textured mode - load textures if not already loaded
      if (!skyboxMaterialRef.current.map) {
        console.log('[MemoryPalace] Switching to textured mode, loading textures')
        // Load default texture
        const textureLoader = new THREE.TextureLoader()
        const localSkyboxPath = '/default_skybox.png'
        
        textureLoader.load(
          localSkyboxPath,
          (texture) => {
            console.log('[MemoryPalace] Default texture loaded for textured mode')
            texture.mapping = THREE.EquirectangularReflectionMapping
            texture.wrapS = THREE.RepeatWrapping
            texture.wrapT = THREE.ClampToEdgeWrapping
            texture.offset.x = 0.5
            skyboxMaterialRef.current.map = texture
            skyboxMaterialRef.current.color.setHex(0xffffff)
            skyboxMaterialRef.current.needsUpdate = true
            wireframeSphereRef.current.visible = false
          },
          undefined,
          (error) => {
            console.warn('[MemoryPalace] Local texture failed, trying remote:', error)
            // Fallback to remote texture
            textureLoader.load(
              'https://page-images.websim.com/Create_a_360_degree_equirectangular_panoramic_image_in_21_9_aspect_ratio_showing__scene_____TECHNICA_694056a68c0178.jpg',
              (texture) => {
                console.log('[MemoryPalace] Remote texture loaded for textured mode')
                texture.mapping = THREE.EquirectangularReflectionMapping
                texture.wrapS = THREE.RepeatWrapping
                texture.wrapT = THREE.ClampToEdgeWrapping
                texture.offset.x = 0.5
                skyboxMaterialRef.current.map = texture
                skyboxMaterialRef.current.color.setHex(0xffffff)
                skyboxMaterialRef.current.needsUpdate = true
                wireframeSphereRef.current.visible = false
              },
              undefined,
              (remoteError) => {
                console.error('[MemoryPalace] Both textures failed in wireframe toggle:', remoteError)
              }
            )
          }
        )
      }
    } else if (wireframeEnabled && skyboxMaterialRef.current) {
      // Switching to wireframe mode - clear textures to save memory
      console.log('[MemoryPalace] Switching to wireframe mode, disposing textures')
      if (skyboxMaterialRef.current.map) {
        skyboxMaterialRef.current.map.dispose()
        skyboxMaterialRef.current.map = null
        skyboxMaterialRef.current.color.setHex(0x000000) // Black background for wireframe
        skyboxMaterialRef.current.needsUpdate = true
      }
    }
  }, [wireframeEnabled])

  // Handle paint mode toggle
  useEffect(() => {
    paintModeEnabledRef.current = paintModeEnabled // Update ref when prop changes
    if (paintModeEnabled) {
      enablePaintMode()
    } else {
      disablePaintMode()
    }
  }, [paintModeEnabled])

  // Handle room changes
  useEffect(() => {
    if (currentRoom) {
      console.log('[MemoryPalace] Room changed, updating skybox:', currentRoom)
      updateSkyboxForRoom(currentRoom)
    }
  }, [currentRoom])

  // Handle objects changes
  useEffect(() => {
    console.log(`[MemoryPalace] 🎭 SCENE: objects prop changed, triggering scene re-render`, {
      objectsCount: objects.length,
      objectIds: objects.map(obj => obj.id),
      objectNames: objects.map(obj => obj.name),
      hasScene: !!sceneRef.current,
      hasParticleManager: !!particleManagerRef.current,
      timestamp: new Date().toISOString()
    })

    if (sceneRef.current && particleManagerRef.current) {
      console.log(`[MemoryPalace] 🎬 SCENE: scene and particle manager ready, updating markers`)
      updateObjectMarkers(objects)
      
      // Update off-screen indicators when objects change
      updateObjectIndicators(objects)
      
      console.log(`[MemoryPalace] ✅ SCENE: scene re-render completed with objects`, {
        finalObjectCount: objects.length,
        timestamp: new Date().toISOString()
      })
    } else {
      console.warn(`[MemoryPalace] ⚠️ SCENE: scene re-render skipped - missing dependencies`, {
        hasScene: !!sceneRef.current,
        hasParticleManager: !!particleManagerRef.current
      })
    }
  }, [objects])

  // Listen for camera settings changes
  useEffect(() => {
    const settingsManager = settingsManagerRef.current
    
    const handleSettingsChange = (type, data) => {
      if (type === 'setting_changed' || type === 'settings_updated') {
        // Handle FOV changes
        if (data.key === 'cameraFov' || (data.cameraFov !== undefined)) {
          const newFov = data.key === 'cameraFov' ? data.value : data.cameraFov
          updateCameraFov(newFov)
        }
        // Note: Sensitivity changes will be applied on the next user interaction
        // since they're read dynamically from settings in the event handlers
      }
    }
    
    settingsManager.addEventListener(handleSettingsChange)
    
    return () => {
      settingsManager.removeEventListener(handleSettingsChange)
    }
  }, [])

  return <div ref={mountRef} className="memory-palace-canvas" />
})

MemoryPalace.displayName = 'MemoryPalace'

export default MemoryPalace
