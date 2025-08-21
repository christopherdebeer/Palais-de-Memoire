import { useRef, useState, useCallback } from 'react'
import * as THREE from 'three'

interface PaintedArea {
  id: string
  x: number
  y: number
  size: number
  color: string
  timestamp: number
  type?: string
}

interface PaintedGroup {
  id: string
  areas: PaintedArea[]
  bounds: {
    x: number
    y: number
    width: number
    height: number
  }
  centroid: {
    x: number
    y: number
  }
}

interface UsePaintModeProps {
  paintModeType: string
  onPaintedObjectCreated?: (objectData: any) => void
  onPaintedAreasChange?: (areas: any) => void
  creationModeActive?: boolean
  aiObjectProperties?: any
}

interface UsePaintModeReturn {
  paintCanvasRef: React.MutableRefObject<HTMLCanvasElement | null>
  paintTextureRef: React.MutableRefObject<THREE.CanvasTexture | null>
  paintContextRef: React.MutableRefObject<CanvasRenderingContext2D | null>
  paintedGroups: Map<string, PaintedGroup>
  setPaintedGroups: React.Dispatch<React.SetStateAction<Map<string, PaintedGroup>>>
  paintInitialized: boolean
  initializePaintCanvas: () => void
  enablePaintMode: (scene: THREE.Scene, skyboxSphere: THREE.Mesh) => void
  disablePaintMode: (scene: THREE.Scene, skyboxSphere: THREE.Mesh) => void
  cleanupStrokeData: (objects?: any[]) => void
  exposePaintedAreasToLLM: () => void
  processPaintedAreasIntoObjects: () => void
}

export const usePaintMode = ({
  paintModeType = 'objects',
  onPaintedObjectCreated,
  onPaintedAreasChange,
  creationModeActive = false,
  aiObjectProperties = null
}: UsePaintModeProps): UsePaintModeReturn => {
  const paintCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const paintTextureRef = useRef<THREE.CanvasTexture | null>(null)
  const paintContextRef = useRef<CanvasRenderingContext2D | null>(null)
  const [paintedGroups, setPaintedGroups] = useState<Map<string, PaintedGroup>>(new Map())
  const paintInitializedRef = useRef(false)

  const initializePaintCanvas = useCallback(() => {
    if (paintCanvasRef.current || paintInitializedRef.current) return
    
    paintInitializedRef.current = true
    console.log('[PaintMode] Initializing paint canvas system')
    
    // Create canvas for painting - high resolution for detail
    const canvas = document.createElement('canvas')
    canvas.width = 4096 // High resolution equirectangular
    canvas.height = 2048
    
    const context = canvas.getContext('2d')!
    
    // Initialize with subtle visible base pattern
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
    paintTexture.offset.x = 0.5 // Apply same 180° offset as all skybox textures
    paintTexture.needsUpdate = true
    
    paintTextureRef.current = paintTexture
    
    console.log('[PaintMode] Paint canvas system initialized with subtle grid pattern')
  }, [])

  const enablePaintMode = useCallback((scene: THREE.Scene, skyboxSphere: THREE.Mesh) => {
    if (!skyboxSphere) return
    
    console.log('[PaintMode] Enabling paint mode')
    
    // Initialize paint canvas if not already done
    initializePaintCanvas()
    
    // Create a separate paint sphere that overlays on the skybox
    if (paintTextureRef.current && !skyboxSphere.userData.paintSphere) {
      // Store original skybox state
      const skyboxMaterial = skyboxSphere.material as THREE.MeshBasicMaterial
      if (!skyboxMaterial.userData.originalMap) {
        skyboxMaterial.userData.originalMap = skyboxMaterial.map
        skyboxMaterial.userData.originalTransparent = skyboxMaterial.transparent
      }
      
      console.log('[PaintMode] Paint mode enabled - using actual paint canvas texture')
      
      // Create paint material with actual paint canvas texture
      const paintMaterial = new THREE.MeshBasicMaterial({
        map: paintTextureRef.current,
        transparent: true,
        opacity: 0.6,
        depthTest: false,
        depthWrite: false
      })
      
      // Create paint sphere inside the skybox for inside viewing
      const paintGeometry = new THREE.SphereGeometry(499, 60, 40) // Inside skybox (500)
      paintGeometry.scale(-1, 1, 1)
      
      const paintSphere = new THREE.Mesh(paintGeometry, paintMaterial)
      scene.add(paintSphere)
      
      // Store reference for cleanup
      skyboxSphere.userData.paintSphere = paintSphere
      skyboxSphere.userData.paintMaterial = paintMaterial
      skyboxSphere.userData.paintGeometry = paintGeometry
      
      console.log('[PaintMode] Paint overlay sphere created with actual paint canvas texture')
    }
  }, [initializePaintCanvas])

  const disablePaintMode = useCallback((scene: THREE.Scene, skyboxSphere: THREE.Mesh) => {
    if (!skyboxSphere) return
    
    console.log('[PaintMode] Disabling paint mode')
    
    // In creation mode, make painted areas available to LLM instead of directly creating objects
    if (creationModeActive) {
      console.log('[PaintMode] Creation mode active - making painted areas available to LLM')
      exposePaintedAreasToLLM()
    } else {
      // Normal paint mode - process painted areas into objects directly
      processPaintedAreasIntoObjects()
    }
    
    // Remove paint sphere overlay
    if (skyboxSphere.userData.paintSphere) {
      const paintSphere = skyboxSphere.userData.paintSphere
      const paintMaterial = skyboxSphere.userData.paintMaterial
      const paintGeometry = skyboxSphere.userData.paintGeometry
      
      // Remove from scene
      scene.remove(paintSphere)
      
      // Dispose resources
      if (paintGeometry) paintGeometry.dispose()
      if (paintMaterial) paintMaterial.dispose()
      
      // Clear references
      skyboxSphere.userData.paintSphere = null
      skyboxSphere.userData.paintMaterial = null
      skyboxSphere.userData.paintGeometry = null
      
      console.log('[PaintMode] Paint overlay sphere removed')
    }
  }, [creationModeActive])

  const cleanupStrokeData = useCallback((objects: any[] = []) => {
    console.log('[PaintMode] Cleaning up stroke data from objects to reduce memory usage')
    let cleanupCount = 0
    
    objects.forEach(obj => {
      if (obj.paintData && obj.paintData.areas && Array.isArray(obj.paintData.areas)) {
        // Replace detailed stroke data with summary statistics
        const areas = obj.paintData.areas
        const summary = {
          strokeCount: areas.length,
          totalArea: areas.reduce((sum: number, area: any) => sum + (area.size * area.size || 0), 0),
          averageStrokeSize: areas.length > 0 ? areas.reduce((sum: number, area: any) => sum + (area.size || 0), 0) / areas.length : 0
        }
        
        // Remove detailed stroke data and replace with summary
        obj.paintData.strokeSummary = summary
        obj.paintData.areas = []
        cleanupCount++
      }
    })
    
    console.log(`[PaintMode] Cleaned up stroke data from ${cleanupCount} objects`)
  }, [])

  const groupContiguousPaintAreas = useCallback((paintedAreas: PaintedArea[]) => {
    // Implementation for grouping contiguous paint areas
    // This is a simplified version - the original has more complex logic
    const groups: PaintedArea[][] = []
    const processedIds = new Set<string>()
    
    paintedAreas.forEach(area => {
      if (processedIds.has(area.id)) return
      
      const group = [area]
      processedIds.add(area.id)
      groups.push(group)
    })
    
    return groups
  }, [])

  const createObjectFromPaintGroup = useCallback((group: PaintedArea[], index: number, type: string) => {
    // Calculate group bounds and centroid
    const bounds = {
      minX: Math.min(...group.map(area => area.x)),
      maxX: Math.max(...group.map(area => area.x)),
      minY: Math.min(...group.map(area => area.y)),
      maxY: Math.max(...group.map(area => area.y))
    }
    
    const centroid = {
      x: (bounds.minX + bounds.maxX) / 2,
      y: (bounds.minY + bounds.maxY) / 2
    }
    
    return {
      name: `${type === 'doors' ? 'Door' : 'Object'} ${index}`,
      information: `A ${type === 'doors' ? 'door' : 'object'} created through paint mode`,
      type: type === 'doors' ? 'door' : 'object',
      position: centroid,
      bounds,
      paintData: {
        areas: group,
        type,
        created: Date.now()
      }
    }
  }, [])

  const exposePaintedAreasToLLM = useCallback(() => {
    console.log('[PaintMode] Exposing painted areas to LLM for processing in creation mode')
    
    if (paintedGroups.size === 0) {
      console.log('[PaintMode] No painted areas to expose')
      return
    }
    
    const paintedAreas = Array.from(paintedGroups.values()).flatMap(group => group.areas)
    const groups = groupContiguousPaintAreas(paintedAreas)
    
    console.log(`[PaintMode] Found ${groups.length} paint groups to expose to LLM`)
    
    const paintedAreaData = groups.map((group, index) => {
      const groupData = createObjectFromPaintGroup(group, index + 1, paintModeType)
      return {
        groupId: `paint_group_${index + 1}`,
        suggestedName: groupData.name,
        suggestedInformation: groupData.information,
        position: groupData.position,
        bounds: groupData.bounds,
        areaCount: group.length,
        paintType: paintModeType
      }
    })
    
    if (onPaintedAreasChange) {
      onPaintedAreasChange(paintedAreaData)
    }
  }, [paintedGroups, paintModeType, groupContiguousPaintAreas, createObjectFromPaintGroup, onPaintedAreasChange])

  const processPaintedAreasIntoObjects = useCallback(() => {
    console.log('[PaintMode] Processing painted areas into objects')
    
    if (paintedGroups.size === 0) {
      console.log('[PaintMode] No painted areas to process')
      return
    }
    
    const paintedAreas = Array.from(paintedGroups.values()).flatMap(group => group.areas)
    const groups = groupContiguousPaintAreas(paintedAreas)
    
    console.log(`[PaintMode] Processing ${groups.length} paint groups into objects`)
    
    groups.forEach((group, index) => {
      const groupData = createObjectFromPaintGroup(group, index + 1, paintModeType)
      
      const finalName = aiObjectProperties?.name || groupData.name
      const finalInformation = aiObjectProperties?.information || aiObjectProperties?.description || groupData.information
      const finalType = aiObjectProperties?.type || (paintModeType === 'doors' ? 'door' : 'object')
      
      const objectData = {
        id: `paint_${Date.now()}_${index}`,
        name: finalName,
        information: finalInformation,
        type: finalType,
        position: groupData.position,
        paintData: groupData.paintData,
        created: Date.now()
      }
      
      console.log(`[PaintMode] Created object from paint group:`, objectData.name)
      
      if (onPaintedObjectCreated) {
        onPaintedObjectCreated(objectData)
      }
    })
    
    // Clear painted groups after processing
    setPaintedGroups(new Map())
  }, [paintedGroups, paintModeType, aiObjectProperties, groupContiguousPaintAreas, createObjectFromPaintGroup, onPaintedObjectCreated])

  return {
    paintCanvasRef,
    paintTextureRef,
    paintContextRef,
    paintedGroups,
    setPaintedGroups,
    paintInitialized: paintInitializedRef.current,
    initializePaintCanvas,
    enablePaintMode,
    disablePaintMode,
    cleanupStrokeData,
    exposePaintedAreasToLLM,
    processPaintedAreasIntoObjects
  }
}