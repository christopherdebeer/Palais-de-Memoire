import React, { useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import * as THREE from 'three'
import nipplejs from 'nipplejs'
import SimpleParticleManager from '../utils/SimpleParticleManager'
import SettingsManager from '../services/SettingsManager'

const MemoryPalace = forwardRef(({ 
  wireframeEnabled = false, 
  nippleEnabled = false,
  paintModeEnabled = false,
  paintModeType = 'objects',
  onCreationModeTriggered = null,
  onObjectSelected = null,
  onPaintedObjectCreated = null,
  selectedObjectId = null,
  currentRoom = null,
  objects = []
}, ref) => {
  const mountRef = useRef(null)
  const sceneRef = useRef(null)
  const rendererRef = useRef(null)
  const cameraRef = useRef(null)
  const wireframeSphereRef = useRef(null)
  const nippleManagerRef = useRef(null)
  const nippleContainerRef = useRef(null)
  const skyboxSphereRef = useRef(null)
  const skyboxMaterialRef = useRef(null)
  const particleManagerRef = useRef(null)
  const objectMarkersRef = useRef(new Map())
  const offScreenIndicatorsRef = useRef(new Map())
  const animationFrameRef = useRef(null)
  const settingsManagerRef = useRef(new SettingsManager())
  
  // Paint mode refs
  const paintCanvasRef = useRef(null)
  const paintTextureRef = useRef(null)
  const paintContextRef = useRef(null)
  const paintedGroupsRef = useRef(new Map()) // Store painted object groups
  const paintModeEnabledRef = useRef(paintModeEnabled) // Ref for current paint mode state
  const paintInitializedRef = useRef(false) // Prevent double initialization in strict mode
  
  // Camera rotation state - needs to be accessible across all functions
  const cameraRotationRef = useRef({ yaw: 0, pitch: 0 })

  // Paint mode functions
  const initializePaintCanvas = () => {
    if (paintCanvasRef.current || paintInitializedRef.current) return // Already initialized or initializing
    
    paintInitializedRef.current = true // Prevent double initialization
    console.log('[MemoryPalace] Initializing paint canvas system')
    
    // Create canvas for painting - high resolution for detail
    const canvas = document.createElement('canvas')
    canvas.width = 4096 // High resolution equirectangular
    canvas.height = 2048
    
    const context = canvas.getContext('2d')
    
    // Initialize with subtle visible base pattern so we can see if the texture is rendering
    // Start with very subtle transparent overlay
    context.fillStyle = 'rgba(0, 0, 0, 0)' // Fully transparent base
    context.fillRect(0, 0, canvas.width, canvas.height)
    
    // Add very subtle grid pattern to confirm texture visibility 
    context.strokeStyle = 'rgba(255, 255, 255, 0.05)' // Very faint white lines
    context.lineWidth = 2
    
    // Add sparse grid lines for debugging visibility
    const gridSpacing = 200
    for (let x = 0; x < canvas.width; x += gridSpacing) {
      context.beginPath()
      context.moveTo(x, 0)
      context.lineTo(x, canvas.height)
      context.stroke()
    }
    for (let y = 0; y < canvas.height; y += gridSpacing) {
      context.beginPath()
      context.moveTo(0, y)
      context.lineTo(canvas.width, y)
      context.stroke()
    }
    
    // Store references
    paintCanvasRef.current = canvas
    paintContextRef.current = context
    
    // Create Three.js texture from canvas
    const paintTexture = new THREE.CanvasTexture(canvas)
    paintTexture.mapping = THREE.EquirectangularReflectionMapping
    paintTexture.wrapS = THREE.RepeatWrapping
    paintTexture.wrapT = THREE.ClampToEdgeWrapping
    paintTexture.offset.x = 0.5 // Apply same 180° offset as all skybox textures for coordinate system alignment
    paintTexture.needsUpdate = true
    
    paintTextureRef.current = paintTexture
    
    console.log('[MemoryPalace] Paint canvas system initialized with subtle grid pattern for visibility testing')
  }

  const enablePaintMode = () => {
    if (!skyboxMaterialRef.current || !skyboxSphereRef.current) return
    
    console.log('[MemoryPalace] Enabling paint mode')
    
    // Initialize paint canvas if not already done
    initializePaintCanvas()
    
    // Create a separate paint sphere that overlays on the skybox
    if (paintTextureRef.current && !skyboxSphereRef.current.userData.paintSphere) {
      // Store original skybox state
      if (!skyboxMaterialRef.current.userData.originalMap) {
        skyboxMaterialRef.current.userData.originalMap = skyboxMaterialRef.current.map
        skyboxMaterialRef.current.userData.originalTransparent = skyboxMaterialRef.current.transparent
      }
      
      console.log('[MemoryPalace] Paint mode enabled - using actual paint canvas texture')
      
      // Create paint material with actual paint canvas texture
      const paintMaterial = new THREE.MeshBasicMaterial({
        map: paintTextureRef.current, // Use actual paint texture for painting
        transparent: true,
        opacity: 0.6,
        depthTest: false,
        depthWrite: false
      })
      
      // Create paint sphere inside the skybox for inside viewing
      const paintGeometry = new THREE.SphereGeometry(499, 60, 40) // Inside skybox (500)
      paintGeometry.scale(-1, 1, 1)
      
      const paintSphere = new THREE.Mesh(paintGeometry, paintMaterial)
      sceneRef.current.add(paintSphere)
      
      // Store reference for cleanup
      skyboxSphereRef.current.userData.paintSphere = paintSphere
      skyboxSphereRef.current.userData.paintMaterial = paintMaterial
      skyboxSphereRef.current.userData.paintGeometry = paintGeometry
      
      console.log('[MemoryPalace] Paint overlay sphere created with actual paint canvas texture - should show subtle grid pattern')
    }
  }

  const disablePaintMode = () => {
    if (!skyboxMaterialRef.current || !skyboxSphereRef.current) return
    
    console.log('[MemoryPalace] Disabling paint mode')
    
    // Process painted areas into objects before cleanup
    processPaintedAreasIntoObjects()
    
    // Remove paint sphere overlay
    if (skyboxSphereRef.current.userData.paintSphere) {
      const paintSphere = skyboxSphereRef.current.userData.paintSphere
      const paintMaterial = skyboxSphereRef.current.userData.paintMaterial
      const paintGeometry = skyboxSphereRef.current.userData.paintGeometry
      
      // Remove from scene
      sceneRef.current.remove(paintSphere)
      
      // Dispose resources
      if (paintGeometry) paintGeometry.dispose()
      if (paintMaterial) paintMaterial.dispose()
      // Note: Don't dispose paintTextureRef.current as it's managed separately
      
      // Clear references
      skyboxSphereRef.current.userData.paintSphere = null
      skyboxSphereRef.current.userData.paintMaterial = null
      skyboxSphereRef.current.userData.paintGeometry = null
      
      console.log('[MemoryPalace] Paint overlay sphere removed')
    }
  }

  const processPaintedAreasIntoObjects = () => {
    console.log('[MemoryPalace] Processing painted areas into objects/doors, mode:', paintModeType)
    
    if (!paintCanvasRef.current || paintedGroupsRef.current.size === 0) {
      console.log('[MemoryPalace] No painted areas to process')
      return
    }
    
    // Group painted areas by proximity to create contiguous objects/doors
    const paintedAreas = Array.from(paintedGroupsRef.current.values())
    const groups = groupContiguousPaintAreas(paintedAreas)
    
    console.log(`[MemoryPalace] Found ${groups.length} contiguous paint groups from ${paintedAreas.length} paint areas`)
    
    // Convert each group to a memory palace object or door based on paint mode type
    groups.forEach((group, index) => {
      const groupData = createObjectFromPaintGroup(group, index + 1, paintModeType)
      
      if (paintModeType === 'doors') {
        // Create painted door with proper type structure
        const paintedDoorParams = {
          name: groupData.name,
          type: 'door',
          description: groupData.information,
          information: groupData.information,
          position: groupData.position,
          targetRoomId: '', // Will need to be configured later
          isPaintedDoor: true,
          paintData: {
            areas: group,
            canvasPosition: groupData.canvasCenter,
            color: 'rgba(0, 0, 255, 0.9)', // Blue for doors
            dimensions: groupData.dimensions
          }
        }
        
        console.log('[MemoryPalace] Created painted door params:', paintedDoorParams)
        
        // Notify parent about painted door creation
        if (onPaintedObjectCreated) {
          console.log('[MemoryPalace] Notifying parent about painted door creation')
          onPaintedObjectCreated(paintedDoorParams)
        }
      } else {
        // Create painted object with proper type structure
        const paintedObjectParams = {
          name: groupData.name,
          type: 'object',
          information: groupData.information,
          position: groupData.position,
          isPaintedObject: true,
          paintData: {
            areas: group,
            canvasPosition: groupData.canvasCenter,
            color: 'rgba(255, 0, 0, 0.9)', // Red for objects
            dimensions: groupData.dimensions
          }
        }
        
        console.log('[MemoryPalace] Created painted object params:', paintedObjectParams)
        
        // Notify parent about painted object creation
        if (onPaintedObjectCreated) {
          console.log('[MemoryPalace] Notifying parent about painted object creation')
          onPaintedObjectCreated(paintedObjectParams)
        }
      }
    })
    
    // Clear painted groups after processing
    paintedGroupsRef.current.clear()
    console.log('[MemoryPalace] Painted groups cleared after processing')
  }

  const groupContiguousPaintAreas = (paintedAreas) => {
    console.log('[MemoryPalace] Grouping contiguous paint areas:', paintedAreas.length)
    
    const groups = []
    const visited = new Set()
    const proximityThreshold = 75 // Pixels - areas within this distance are considered contiguous
    
    paintedAreas.forEach((area, index) => {
      if (visited.has(index)) return
      
      // Start new group with current area
      const group = []
      const queue = [index]
      
      while (queue.length > 0) {
        const currentIndex = queue.shift()
        if (visited.has(currentIndex)) continue
        
        visited.add(currentIndex)
        const currentArea = paintedAreas[currentIndex]
        group.push(currentArea)
        
        // Find nearby areas to add to this group
        paintedAreas.forEach((otherArea, otherIndex) => {
          if (visited.has(otherIndex)) return
          
          const distance = Math.sqrt(
            Math.pow(currentArea.center.x - otherArea.center.x, 2) + 
            Math.pow(currentArea.center.y - otherArea.center.y, 2)
          )
          
          if (distance <= proximityThreshold) {
            queue.push(otherIndex)
          }
        })
      }
      
      if (group.length > 0) {
        groups.push(group)
        console.log(`[MemoryPalace] Created group ${groups.length} with ${group.length} areas`)
      }
    })
    
    return groups
  }

  const createObjectFromPaintGroup = (group, groupNumber, type = 'objects') => {
    console.log('[MemoryPalace] Creating', type, 'from paint group:', group.length, 'areas')
    
    // Calculate center position of the group
    const centerX = group.reduce((sum, area) => sum + area.center.x, 0) / group.length
    const centerY = group.reduce((sum, area) => sum + area.center.y, 0) / group.length
    
    // Calculate bounding box of painted areas to determine geometry size
    const minX = Math.min(...group.map(area => area.center.x - area.size))
    const maxX = Math.max(...group.map(area => area.center.x + area.size))
    const minY = Math.min(...group.map(area => area.center.y - area.size))
    const maxY = Math.max(...group.map(area => area.center.y + area.size))
    
    const paintedWidth = maxX - minX
    const paintedHeight = maxY - minY
    
    // Convert canvas dimensions to world scale
    // Canvas is 4096x2048, representing 360° x 180° view
    const canvasToWorldScale = 1000 / 2048 // Approximate scale factor
    const worldWidth = Math.max(paintedWidth * canvasToWorldScale, 50) // Minimum 50 units
    const worldHeight = Math.max(paintedHeight * canvasToWorldScale, 50) // Minimum 50 units
    
    // Calculate average world position
    const avgWorldPos = group.reduce((sum, area) => {
      return {
        x: sum.x + area.worldPosition.x,
        y: sum.y + area.worldPosition.y,
        z: sum.z + area.worldPosition.z
      }
    }, { x: 0, y: 0, z: 0 })
    
    avgWorldPos.x /= group.length
    avgWorldPos.y /= group.length
    avgWorldPos.z /= group.length
    
    // Create different names and information based on type
    const isObject = type === 'objects'
    const objectData = {
      name: isObject ? `Painted Object ${groupNumber}` : `Painted Door ${groupNumber}`,
      information: isObject 
        ? `Created from ${group.length} paint stroke${group.length > 1 ? 's' : ''}. Double-click to edit this painted memory.`
        : `Created from ${group.length} paint stroke${group.length > 1 ? 's' : ''}. This door needs a destination room. Double-click to configure.`,
      position: avgWorldPos,
      canvasCenter: { x: centerX, y: centerY },
      dimensions: {
        width: worldWidth,
        height: worldHeight,
        canvasWidth: paintedWidth,
        canvasHeight: paintedHeight
      }
    }
    
    console.log('[MemoryPalace] Created object data with dimensions:', objectData)
    return objectData
  }

  const paintOnSkybox = (event) => {
    console.log('[MemoryPalace] DEBUG: paintOnSkybox called', {
      paintModeEnabled,
      hasContext: !!paintContextRef.current,
      hasCamera: !!cameraRef.current,
      hasSkyboxSphere: !!skyboxSphereRef.current
    })
    
    if (!paintModeEnabledRef.current || !paintContextRef.current || !cameraRef.current) return
    
    // Calculate mouse position in normalized device coordinates
    const mouse = new THREE.Vector2()
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1
    
    console.log('[MemoryPalace] DEBUG: Mouse position', { clientX: event.clientX, clientY: event.clientY, normalizedX: mouse.x, normalizedY: mouse.y })
    
    // Create raycaster
    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(mouse, cameraRef.current)
    
    // Check intersection with skybox sphere
    if (!skyboxSphereRef.current) return
    
    const intersects = raycaster.intersectObject(skyboxSphereRef.current)
    console.log('[MemoryPalace] DEBUG: Raycast intersections with skybox:', intersects.length)
    
    if (intersects.length > 0) {
      const intersectionPoint = intersects[0].point
      const uv = intersects[0].uv
      
      if (uv) {
        // Convert UV coordinates to canvas coordinates
        const canvas = paintCanvasRef.current
        const context = paintContextRef.current
        
        // Convert UV coordinates to canvas coordinates
        // UV coordinates: u=0 is left edge, v=0 is bottom edge
        // Canvas coordinates: x=0 is left edge, y=0 is top edge
        // Account for the 0.5 texture offset applied to paint texture (same as skybox textures)
        let canvasX = ((uv.x + 0.5) % 1.0) * canvas.width  // Apply 180° offset compensation
        let canvasY = (1.0 - uv.y) * canvas.height  // Flip Y-axis
        
        // Paint with brush (50% smaller size)
        const brushSize = 25 // Reduced from 50 to 25 for smaller brush
        
        // Use different paint colors based on paint mode type
        const paintColor = paintModeType === 'doors' 
          ? 'rgba(0, 0, 255, 0.9)'  // Blue for doors
          : 'rgba(255, 0, 0, 0.9)'  // Red for objects
        
        context.fillStyle = paintColor
        context.beginPath()
        context.arc(canvasX, canvasY, brushSize, 0, Math.PI * 2)
        context.fill()
        
        // Store painted area info for later grouping (simplified)
        const paintedArea = {
          id: Date.now() + Math.random(),
          center: { x: canvasX, y: canvasY },
          size: brushSize,
          color: paintColor,
          worldPosition: intersectionPoint.clone(),
          metadata: { name: `Painted Object ${paintedGroupsRef.current.size + 1}`, info: 'Created with paint tool' }
        }
        
        paintedGroupsRef.current.set(paintedArea.id, paintedArea)
        
        // Update texture
        if (paintTextureRef.current) {
          paintTextureRef.current.needsUpdate = true
        }
        
        console.log('[MemoryPalace] Painted area created:', paintedArea)
      }
    }
  }

  const getPaintedObjectAt = (event) => {
    if (!paintModeEnabledRef.current) return null
    
    // Calculate mouse position and find painted object
    const mouse = new THREE.Vector2()
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1
    
    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(mouse, cameraRef.current)
    
    if (!skyboxSphereRef.current) return null
    
    const intersects = raycaster.intersectObject(skyboxSphereRef.current)
    
    if (intersects.length > 0) {
      const uv = intersects[0].uv
      if (uv) {
        const canvas = paintCanvasRef.current
        let canvasX = uv.x * canvas.width
        let canvasY = (1.0 - uv.y) * canvas.height
        
        // Find closest painted area (simplified approach)
        let closestArea = null
        let minDistance = Infinity
        
        paintedGroupsRef.current.forEach((area) => {
          const distance = Math.sqrt(
            Math.pow(area.center.x - canvasX, 2) + 
            Math.pow(area.center.y - canvasY, 2)
          )
          
          if (distance < area.size && distance < minDistance) {
            minDistance = distance
            closestArea = area
          }
        })
        
        return closestArea
      }
    }
    
    return null
  }

  // Skybox update function for room navigation
  const updateSkyboxForRoom = (room) => {
    if (!skyboxMaterialRef.current) {
      console.warn('[MemoryPalace] Skybox material not ready for room update')
      return
    }

    console.log('[MemoryPalace] Updating skybox for room:', room?.name || 'default')

    // Skip texture loading if wireframe is enabled
    if (wireframeEnabled) {
      console.log('[MemoryPalace] Wireframe enabled, skipping room texture loading')
      return
    }

    if (room?.imageUrl) {
      // Load room-specific texture
      console.log('[MemoryPalace] Loading room texture:', room.imageUrl)
      const textureLoader = new THREE.TextureLoader()
      
      textureLoader.load(
        room.imageUrl,
        (texture) => {
          console.log('[MemoryPalace] Room texture loaded successfully')
          texture.mapping = THREE.EquirectangularReflectionMapping
          texture.wrapS = THREE.RepeatWrapping
          texture.wrapT = THREE.ClampToEdgeWrapping
          texture.offset.x = 0.5 // Shift texture by 180 degrees
          
          // Dispose previous texture to prevent memory leaks
          if (skyboxMaterialRef.current.map && skyboxMaterialRef.current.map !== texture) {
            skyboxMaterialRef.current.map.dispose()
          }
          
          skyboxMaterialRef.current.map = texture
          skyboxMaterialRef.current.color.setHex(0xffffff)
          skyboxMaterialRef.current.needsUpdate = true
          
          // Hide wireframe when texture loads
          if (wireframeSphereRef.current && !wireframeEnabled) {
            wireframeSphereRef.current.visible = false
          }
        },
        undefined,
        (error) => {
          console.warn('[MemoryPalace] Failed to load room texture, keeping current:', error)
        }
      )
    } else {
      // No room-specific image, use default texture logic
      console.log('[MemoryPalace] No room image, using default skybox')
      // The default texture loading logic from initialization will be used
    }
  }

  // Object rendering functions
  const createObjectMarker = (obj) => {
    if (!sceneRef.current) return null
    console.log(`[MemoryPalace] 🏗️ SCENE: createObjectMarker called`, {
      objectId: obj.id,
      objectName: obj.name,
      position: obj.position,
      timestamp: new Date().toISOString()
    })
    
    // Determine marker type based on explicit type property or fallback to targetRoomId
    const isDoor = obj.type === 'door' || obj.targetRoomId !== undefined
    const isPainted = obj.isPaintedObject || obj.isPaintedDoor
    
    console.log(`[MemoryPalace] 🎯 SCENE: marker type determined`, {
      objectId: obj.id,
      explicitType: obj.type,
      isDoor,
      isPainted,
      markerType: isDoor ? 'door' : 'object',
      hasPaintData: !!obj.paintData
    })
    
    // Create appropriate geometry for marker type
    let markerGeometry, markerMaterial
    
    if (isDoor) {
      // For doors, check if painted and use dimensions from paint data
      if (isPainted && obj.paintData?.dimensions) {
        const width = Math.max(obj.paintData.dimensions.width, 100) // Minimum door width
        const height = Math.max(obj.paintData.dimensions.height, 150) // Minimum door height
        markerGeometry = new THREE.PlaneGeometry(width, height)
        console.log(`[MemoryPalace] Using painted door geometry: ${width}x${height}`)
      } else {
        // Default door geometry
        markerGeometry = new THREE.BoxGeometry(200, 300, 10)
      }
      markerMaterial = new THREE.MeshBasicMaterial({
        color: 0xffd700,
        transparent: true,
        opacity: 0.0, // Invisible hit area
        depthTest: false,
        depthWrite: false,
        wireframe: true,
      })
    } else {
      // For objects, check if painted and use dimensions from paint data
      if (isPainted && obj.paintData?.dimensions) {
        const width = Math.max(obj.paintData.dimensions.width, 50)
        const height = Math.max(obj.paintData.dimensions.height, 50)
        markerGeometry = new THREE.PlaneGeometry(width, height)
        console.log(`[MemoryPalace] Using painted object geometry: ${width}x${height}`)
      } else {
        // Default object geometry
        markerGeometry = new THREE.SphereGeometry(50, 8, 6)
      }
      markerMaterial = new THREE.MeshBasicMaterial({
        color: 0x4dabf7,
        transparent: true,
        opacity: 0.0, // Invisible hit area
        depthTest: false,
        depthWrite: false,
        wireframe: true,
      })
    }
    
    const marker = new THREE.Mesh(markerGeometry, markerMaterial)
    
    // Position marker just outside sphere surface (radius 500)
    const baseRadius = 500
    
    if (obj.position?.x !== undefined && obj.position?.y !== undefined && obj.position?.z !== undefined) {
      const direction = new THREE.Vector3(obj.position.x, obj.position.y, obj.position.z).normalize()
      marker.position.copy(direction.multiplyScalar(baseRadius))
      
      // Orient plane geometries to face toward camera (center)
      if (isPainted && obj.paintData?.dimensions) {
        // For plane geometries, ensure they face toward the camera
        const lookDirection = new THREE.Vector3(0, 0, 0).sub(marker.position).normalize()
        marker.lookAt(marker.position.clone().add(lookDirection))
      } else if (isDoor) {
        // For doors (including non-painted), orient to face the user's view
        const lookDirection = new THREE.Vector3(0, 0, 0).sub(marker.position).normalize()
        marker.lookAt(marker.position.clone().add(lookDirection))
      }
      // Objects with sphere geometry don't need special orientation
      
      console.log(`[MemoryPalace] 📍 SCENE: marker positioned using object coordinates`, {
        objectId: obj.id,
        objectPosition: obj.position,
        markerPosition: marker.position
      })
    } else {
      // Fallback to default position (facing forward)
      console.warn(`[MemoryPalace] ⚠️ SCENE: object has no 3D position, using default`, {
        objectId: obj.id,
        objectName: obj.name
      })
      marker.position.set(baseRadius, 0, 0) // Forward facing
    }
    
    // Store object data in userData
    marker.userData = {
      objectData: obj,
      isDoor: isDoor,
      objectId: obj.id,
      originalScale: marker.scale.clone()
    }
    
    // Create particle system for this marker
    if (particleManagerRef.current) {
      const width = Math.max(obj.paintData?.dimensions?.width, 50)
      const height = Math.max(obj.paintData?.dimensions?.height, 50)
      console.log(`[MemoryPalace] ✨ SCENE: creating particle system for marker`, {
        objectId: obj.id,
        markerPosition: marker.position,
        width,
        height,
      })
      
      
      
      const particleSystem = particleManagerRef.current.createParticleSystem(marker.position, isDoor, obj.id, {
        width,
        height,
        shape: "box",
        density: 0.5,
        swirlSpeed: 1.7,
        swirlTightness: 0.0,
        twinkleSpeed: 0,
        twinkleIntensity: 2.55
      })
      sceneRef.current.add(particleSystem)
      
      // Store particle system reference
      marker.userData.particleSystem = particleSystem
    }
    
    sceneRef.current.add(marker)
    
    console.log(`[MemoryPalace] ✅ SCENE: object marker added to scene`, {
      objectId: obj.id,
      objectName: obj.name,
      markerPosition: marker.position,
      isDoor,
      hasParticleSystem: !!marker.userData.particleSystem,
      timestamp: new Date().toISOString()
    })
    
    return marker
  }

  const updateObjectMarkers = (newObjects) => {
    if (!sceneRef.current) return
    
    console.log(`[MemoryPalace] 🎬 SCENE: updateObjectMarkers called`, {
      newObjectsCount: newObjects.length,
      newObjectIds: newObjects.map(obj => obj.id),
      newObjectNames: newObjects.map(obj => obj.name),
      timestamp: new Date().toISOString()
    })
    
    // Get current markers
    const currentMarkers = objectMarkersRef.current
    const currentObjectIds = new Set(Array.from(currentMarkers.keys()))
    const newObjectIds = new Set(newObjects.map(obj => obj.id))
    
    console.log(`[MemoryPalace] 🔍 SCENE: marker comparison`, {
      currentMarkerCount: currentMarkers.size,
      currentObjectIds: Array.from(currentObjectIds),
      newObjectIds: Array.from(newObjectIds),
      markersToRemove: Array.from(currentObjectIds).filter(id => !newObjectIds.has(id)),
      markersToAdd: Array.from(newObjectIds).filter(id => !currentObjectIds.has(id))
    })
    
    // Remove markers for objects that no longer exist
    currentObjectIds.forEach(objectId => {
      if (!newObjectIds.has(objectId)) {
        console.log(`[MemoryPalace] 🗑️ SCENE: removing marker for deleted object`, { objectId })
        const marker = currentMarkers.get(objectId)
        if (marker) {
          // Remove particle system
          if (marker.userData.particleSystem && particleManagerRef.current) {
            sceneRef.current.remove(marker.userData.particleSystem)
            particleManagerRef.current.removeParticleSystem(objectId)
          }
          
          // Remove marker from scene
          sceneRef.current.remove(marker)
          
          // Dispose resources
          if (marker.geometry) marker.geometry.dispose()
          if (marker.material) marker.material.dispose()
          
          currentMarkers.delete(objectId)
          console.log(`[MemoryPalace] ✅ SCENE: marker removed from scene`, { objectId })
        }
      }
    })
    
    // Add markers for new objects
    newObjects.forEach(obj => {
      if (!currentMarkers.has(obj.id)) {
        console.log(`[MemoryPalace] ➕ SCENE: adding marker for new object`, {
          objectId: obj.id,
          objectName: obj.name,
          position: obj.position
        })
        const marker = createObjectMarker(obj)
        if (marker) {
          currentMarkers.set(obj.id, marker)
          console.log(`[MemoryPalace] ✅ SCENE: new marker added to scene`, {
            objectId: obj.id,
            objectName: obj.name,
            markerPosition: marker.position
          })
        }
      } else {
        // Update existing marker if needed (position, properties)
        const marker = currentMarkers.get(obj.id)
        if (marker && marker.userData.objectData) {
          // Check if position changed
          const oldPos = marker.userData.objectData.position
          const newPos = obj.position
          if (oldPos && newPos && 
              (oldPos.x !== newPos.x || oldPos.y !== newPos.y || oldPos.z !== newPos.z)) {
            console.log(`[MemoryPalace] 🔄 SCENE: updating position for existing object`, {
              objectId: obj.id,
              objectName: obj.name,
              oldPosition: oldPos,
              newPosition: newPos
            })
            
            // Update marker position
            const isDoor = obj.targetRoomId !== undefined
            if (isDoor) {
              // For doors, use exact position coordinates
              marker.position.set(newPos.x, newPos.y, newPos.z)
              
              // Orient door to face the user's view (toward center)
              const lookDirection = new THREE.Vector3(0, 0, 0).sub(marker.position).normalize()
              marker.lookAt(marker.position.clone().add(lookDirection))
            } else {
              // For objects, extend to sphere surface
              const baseRadius = 500
              const direction = new THREE.Vector3(newPos.x, newPos.y, newPos.z).normalize()
              marker.position.copy(direction.multiplyScalar(baseRadius))
            }
            
            // Update particle system position
            if (marker.userData.particleSystem) {
              marker.userData.particleSystem.position.copy(marker.position)
            }
            
            console.log(`[MemoryPalace] ✅ SCENE: object position updated in scene`, {
              objectId: obj.id,
              newMarkerPosition: marker.position
            })
          }
          
          // Update userData with new object data
          marker.userData.objectData = obj
        }
      }
    })
    
    console.log(`[MemoryPalace] ✅ SCENE: updateObjectMarkers completed`, {
      totalActiveMarkers: currentMarkers.size,
      activeMarkerIds: Array.from(currentMarkers.keys()),
      timestamp: new Date().toISOString()
    })
  }

  const startObjectAnimation = () => {
    if (animationFrameRef.current) return // Already animating
    
    const animate = () => {
      // Update particle systems
      if (particleManagerRef.current) {
        particleManagerRef.current.updateParticleSystems()
      }
      
      // Animate object markers (subtle pulsing)
      // objectMarkersRef.current.forEach(marker => {
      //   if (marker.userData.originalScale) {
      //     const time = Date.now() * 0.001
      //     const scale = 1.0 + Math.sin(time * 2) * 0.1 // Gentle pulsing
      //     marker.scale.copy(marker.userData.originalScale).multiplyScalar(scale)
      //   }
      // })
      
      // Animate off-screen indicators
      animateOffScreenIndicators()
      
      animationFrameRef.current = requestAnimationFrame(animate)
    }
    
    animate()
  }

  const stopObjectAnimation = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
  }

  // Off-screen indicator functions
  const createOffScreenIndicator = (obj, direction) => {
    if (!sceneRef.current || !cameraRef.current) return null

    console.log(`[MemoryPalace] 🎯 Creating off-screen indicator for object:`, {
      objectId: obj.id,
      objectName: obj.name,
      direction: direction
    })

    // Create arrow geometry pointing in the direction of the object
    const arrowGeometry = new THREE.ConeGeometry(0.08, 0.4, 4) // Half the previous size
    // Align cone's forward axis (+Z) with look direction
    arrowGeometry.rotateX(Math.PI / 2)
    const isDoor = obj.targetRoomId !== undefined
    
    // Use same color scheme as object markers
    const arrowMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff, // isDoor ? 0xffd700 : 0x4dabf7,
      transparent: true,
      opacity: 0.0,
      depthTest: false,
      depthWrite: false
    })

    const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial)
    
    // Position arrow at a fixed distance from camera in screen space
    const camera = cameraRef.current
    const fixedDistance = 8 // Fixed distance from camera
    
    // Calculate direction from camera to object in camera space
    const objectWorldPos = new THREE.Vector3(obj.position.x, obj.position.y, obj.position.z)
    const directionFromCamera = objectWorldPos.clone().sub(camera.position).normalize()
    
    // Convert to screen space to find edge position
    const tempVector = directionFromCamera.clone()
    tempVector.project(camera)
    
    // Find closest edge position instead of simple clamping
    const margin = 0.85 // Keep indicators within 85% of screen edge
    const absX = Math.abs(tempVector.x)
    const absY = Math.abs(tempVector.y)
    
    // Determine which edge is closest and position on that edge
    if (absX > absY) {
      // Object is more to the left/right - position on vertical edges
      tempVector.x = tempVector.x > 0 ? margin : -margin
      tempVector.y = Math.max(-margin, Math.min(margin, tempVector.y))
    } else {
      // Object is more up/down - position on horizontal edges  
      tempVector.y = tempVector.y > 0 ? margin : -margin
      tempVector.x = Math.max(-margin, Math.min(margin, tempVector.x))
    }
    tempVector.z = 0.1 // Near the camera
    
    // Convert back to world space at fixed distance
    tempVector.unproject(camera)
    const indicatorDirection = tempVector.sub(camera.position).normalize()
    const indicatorPosition = camera.position.clone().add(indicatorDirection.multiplyScalar(fixedDistance))
    
    arrow.position.copy(indicatorPosition)

    // Point arrow toward the object from its current position
    const forward = new THREE.Vector3(0, 0, 1)
    let directionToObject = objectWorldPos.clone().sub(indicatorPosition).normalize()
    const cameraForward = new THREE.Vector3()
    camera.getWorldDirection(cameraForward)
    if (directionFromCamera.dot(cameraForward) < 0) {
      // Object is behind camera; use projected indicator direction so arrow
      // points from screen edge toward the object
      directionToObject = indicatorDirection.clone().negate()
    }
    arrow.quaternion.setFromUnitVectors(forward, directionToObject)
    
    // Add distance text sprite
    const distance = camera.position.distanceTo(objectWorldPos)
    const distanceText = Math.round(distance).toString() + 'm'
    
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    canvas.width = 128
    canvas.height = 64
    
    context.fillStyle = 'white'; // isDoor ? '#ffd700' : '#4dabf7'
    context.font = 'bold 10px Arial'
    context.textAlign = 'center'
    context.fillText(obj.name, 64, 20)
    // context.fillText(distanceText, 64, 40)
    
    const texture = new THREE.CanvasTexture(canvas)
    const spriteMaterial = new THREE.SpriteMaterial({ 
      map: texture,
      transparent: true,
      opacity: 0.0,
      depthTest: false
    })
    const sprite = new THREE.Sprite(spriteMaterial)
    sprite.scale.set(0.75, 0.375, 1) // Half the previous size
    
    // Position sprite slightly behind arrow
    const spriteOffset = indicatorDirection.clone().multiplyScalar(-0.5)
    sprite.position.copy(indicatorPosition.clone().add(spriteOffset))
    
    // Store references
    arrow.userData = {
      objectData: obj,
      objectId: obj.id,
      isDoor: isDoor,
      sprite: sprite,
      originalOpacity: 1.0,
      originalPosition: indicatorPosition.clone(),
      originalSpritePosition: sprite.position.clone()
    }
    
    sprite.userData = {
      objectId: obj.id,
      arrow: arrow
    }
    
    sceneRef.current.add(arrow)
    sceneRef.current.add(sprite)
    
    return { arrow, sprite }
  }

  const updateOffScreenIndicators = (objects) => {
    if (!sceneRef.current || !cameraRef.current) return

    const camera = cameraRef.current
    const frustum = new THREE.Frustum()
    const cameraMatrix = new THREE.Matrix4()
    cameraMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
    frustum.setFromProjectionMatrix(cameraMatrix)

    // Clear existing indicators
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
    currentIndicators.clear()

    // Check each object for visibility
    objects.forEach(obj => {
      if (!obj.position) return

      const objectPosition = new THREE.Vector3(obj.position.x, obj.position.y, obj.position.z)
      
      // Check if object is outside camera frustum
      if (!frustum.containsPoint(objectPosition)) {
        // Calculate direction from camera to object
        const direction = objectPosition.clone().sub(camera.position)
        
        // Create indicator
        const indicator = createOffScreenIndicator(obj, direction)
        if (indicator) {
          currentIndicators.set(obj.id, indicator)
        }
      }
    })

    console.log(`[MemoryPalace] 🎯 Updated off-screen indicators:`, {
      totalObjects: objects.length,
      indicatorsCreated: currentIndicators.size,
      timestamp: new Date().toISOString(),
      objects,
      currentIndicators,
    })
  }

  const animateOffScreenIndicators = () => {
    const currentIndicators = offScreenIndicatorsRef.current
    const time = Date.now() * 0.001
    const camera = cameraRef.current

    if (!camera) return

    currentIndicators.forEach((indicator, objectId) => {
      if (indicator.arrow && indicator.sprite) {
        // Update positions to maintain screen-edge placement as camera moves
        const obj = indicator.arrow.userData.objectData
        const objectWorldPos = new THREE.Vector3(obj.position.x, obj.position.y, obj.position.z)
        const directionFromCamera = objectWorldPos.clone().sub(camera.position).normalize()
        
        // Convert to screen space to find edge position
        const tempVector = directionFromCamera.clone()
        tempVector.project(camera)
        
        // Find closest edge position instead of simple clamping
        const margin = 0.85
        const absX = Math.abs(tempVector.x)
        const absY = Math.abs(tempVector.y)
        
        // Determine which edge is closest and position on that edge
        if (absX > absY) {
          // Object is more to the left/right - position on vertical edges
          tempVector.x = tempVector.x > 0 ? margin : -margin
          tempVector.y = Math.max(-margin, Math.min(margin, tempVector.y))
        } else {
          // Object is more up/down - position on horizontal edges  
          tempVector.y = tempVector.y > 0 ? margin : -margin
          tempVector.x = Math.max(-margin, Math.min(margin, tempVector.x))
        }
        tempVector.z = 0.1
        
        // Convert back to world space at fixed distance
        tempVector.unproject(camera)
        const indicatorDirection = tempVector.sub(camera.position).normalize()
        const fixedDistance = 8
        const indicatorPosition = camera.position.clone().add(indicatorDirection.multiplyScalar(fixedDistance))
        
        // Update arrow position and rotation
        indicator.arrow.position.copy(indicatorPosition)
        const forward = new THREE.Vector3(0, 0, 1)
        let directionToObject = objectWorldPos.clone().sub(indicatorPosition).normalize()
        const cameraForward = new THREE.Vector3()
        camera.getWorldDirection(cameraForward)
        if (directionFromCamera.dot(cameraForward) < 0) {
          // Object is behind camera; use projected indicator direction so arrow
          // points from screen edge toward the object
          directionToObject = indicatorDirection.clone().negate()
        }
        indicator.arrow.quaternion.setFromUnitVectors(forward, directionToObject)
        
        // Update sprite position
        const spriteOffset = indicatorDirection.clone().multiplyScalar(-0.5)
        indicator.sprite.position.copy(indicatorPosition.clone().add(spriteOffset))
        
        // Gentle pulsing animation
        const pulse = 0.8 + Math.sin(time * 3) * 0.2
        indicator.arrow.material.opacity = indicator.arrow.userData.originalOpacity * pulse
        indicator.sprite.material.opacity = 0.9 * pulse

        // Subtle floating motion (much smaller now)
        const float = Math.sin(time * 2 + objectId.length) * 0.05
        indicator.arrow.position.add(new THREE.Vector3(0, float, 0))
        indicator.sprite.position.add(new THREE.Vector3(0, float, 0))
      }
    })
  }

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
      cameraRotationRef.current.yaw -= deltaX   // Horizontal rotation (left/right) - fixed direction
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
    updateCameraFov: updateCameraFov
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
        
        // Update yaw and pitch using prototype's approach
        yaw -= deltaX * 50   // Horizontal rotation (left/right) - fixed direction and scaling
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
        console.log('[MemoryPalace] Creation mode triggered at point:', intersectionPoint)
        
        // Position object/door slightly outside the sphere surface (like prototype)
        const positionMultiplier = 1.02
        const creationPosition = {
          x: intersectionPoint.x * positionMultiplier,
          y: intersectionPoint.y * positionMultiplier,
          z: intersectionPoint.z * positionMultiplier
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
            timestamp: Date.now()
          })
        }
        
        // Remove creation indicator after 5 seconds (or when creation is complete)
        setTimeout(() => {
          if (creationMesh.parent) {
            scene.remove(creationMesh)
            creationIndicator.dispose()
            creationMaterial.dispose()
          }
        }, 5000)
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
        
        // Update yaw and pitch using prototype's approach
        yaw -= deltaX * 50   // Horizontal rotation (left/right) - fixed direction and scaling
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
    
    // Initialize nipple if enabled
    if (nippleEnabled) {
      setTimeout(initializeNipple, 100) // Small delay to ensure DOM is ready
    }

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
      paintedGroupsRef.current.clear()
      
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

  // Handle nipple toggle
  useEffect(() => {
    if (nippleEnabled) {
      initializeNipple()
    } else {
      cleanupNipple()
    }
  }, [nippleEnabled])

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
      updateOffScreenIndicators(objects)
      
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
