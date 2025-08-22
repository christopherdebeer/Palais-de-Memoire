import { useRef, useState, useCallback } from 'react'
import * as THREE from 'three'

export default function usePaintMode({
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
}) {
  const paintCanvasRef = useRef(null)
  const paintTextureRef = useRef(null)
  const paintContextRef = useRef(null)
  const [paintedGroups, setPaintedGroups] = useState(new Map())
  const paintModeEnabledRef = useRef(false)
  const paintInitializedRef = useRef(false)

  const initializePaintCanvas = useCallback(() => {
    if (paintCanvasRef.current || paintInitializedRef.current) return
    paintInitializedRef.current = true
    const canvas = document.createElement('canvas')
    canvas.width = 4096
    canvas.height = 2048
    const context = canvas.getContext('2d')
    context.fillStyle = 'rgba(0, 0, 0, 0)'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.strokeStyle = 'rgba(255, 255, 255, 0.05)'
    context.lineWidth = 2
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
    paintCanvasRef.current = canvas
    paintContextRef.current = context
    const paintTexture = new THREE.CanvasTexture(canvas)
    paintTexture.mapping = THREE.EquirectangularReflectionMapping
    paintTexture.wrapS = THREE.RepeatWrapping
    paintTexture.wrapT = THREE.ClampToEdgeWrapping
    paintTexture.offset.x = 0.5
    paintTexture.needsUpdate = true
    paintTextureRef.current = paintTexture
  }, [])

  const enablePaintMode = useCallback(() => {
    if (!skyboxMaterialRef.current || !skyboxSphereRef.current) return
    initializePaintCanvas()
    if (paintTextureRef.current && !skyboxSphereRef.current.userData.paintSphere) {
      if (!skyboxMaterialRef.current.userData.originalMap) {
        skyboxMaterialRef.current.userData.originalMap = skyboxMaterialRef.current.map
        skyboxMaterialRef.current.userData.originalTransparent = skyboxMaterialRef.current.transparent
      }
      const paintMaterial = new THREE.MeshBasicMaterial({
        map: paintTextureRef.current,
        transparent: true,
        opacity: 0.6,
        depthTest: false,
        depthWrite: false
      })
      const paintGeometry = new THREE.SphereGeometry(499, 60, 40)
      paintGeometry.scale(-1, 1, 1)
      const paintSphere = new THREE.Mesh(paintGeometry, paintMaterial)
      sceneRef.current.add(paintSphere)
      skyboxSphereRef.current.userData.paintSphere = paintSphere
      skyboxSphereRef.current.userData.paintMaterial = paintMaterial
      skyboxSphereRef.current.userData.paintGeometry = paintGeometry
    }
  }, [sceneRef, skyboxMaterialRef, skyboxSphereRef, initializePaintCanvas])

  const cleanupStrokeData = useCallback((objects = []) => {
    let cleanupCount = 0
    objects.forEach(obj => {
      if (obj.paintData && obj.paintData.areas && Array.isArray(obj.paintData.areas)) {
        const areas = obj.paintData.areas
        const summary = {
          strokeCount: areas.length,
          totalArea: areas.reduce((sum, area) => sum + (area.size * area.size || 0), 0),
          averageStrokeSize: areas.length > 0 ? areas.reduce((sum, area) => sum + (area.size || 0), 0) / areas.length : 0
        }
        delete obj.paintData.areas
        obj.paintData.strokeSummary = summary
        obj.paintData.cleaned = true
        cleanupCount++
      }
    })
    return cleanupCount
  }, [])

  const canvasYToLatitude = (y, height) => {
    return (0.5 - y / height) * Math.PI
  }

  const calculateLatitudeAdjustedBrushSize = (baseBrushSize, canvasY, canvasHeight) => {
    const latitude = canvasYToLatitude(canvasY, canvasHeight)
    const cosLat = Math.cos(latitude)
    const clampedCosLat = Math.max(0.1, Math.abs(cosLat))
    return {
      width: baseBrushSize / clampedCosLat,
      height: baseBrushSize,
      size: baseBrushSize * Math.sqrt(1 / clampedCosLat)
    }
  }

  const groupContiguousPaintAreas = (paintedAreas) => {
    const groups = []
    const visited = new Set()
    const proximityThreshold = 75
    paintedAreas.forEach((area, index) => {
      if (visited.has(index)) return
      const group = []
      const queue = [index]
      while (queue.length > 0) {
        const currentIndex = queue.shift()
        if (visited.has(currentIndex)) continue
        visited.add(currentIndex)
        group.push(paintedAreas[currentIndex])
        paintedAreas.forEach((otherArea, otherIndex) => {
          if (visited.has(otherIndex)) return
          const dx = otherArea.center.x - paintedAreas[currentIndex].center.x
          const dy = otherArea.center.y - paintedAreas[currentIndex].center.y
          const distance = Math.sqrt(dx * dx + dy * dy)
          if (distance < proximityThreshold) {
            queue.push(otherIndex)
          }
        })
      }
      groups.push(group)
    })
    return groups
  }

  const createObjectFromPaintGroup = (group, index, type) => {
    const canvasCenter = {
      x: group.reduce((sum, area) => sum + area.center.x, 0) / group.length,
      y: group.reduce((sum, area) => sum + area.center.y, 0) / group.length
    }
    const worldPosition = group[0].worldPosition.clone()
    const dimensions = { width: 50, height: 50, depth: 50 }
    return {
      name: `${type}_${index}`,
      information: `Painted ${type} ${index}`,
      position: worldPosition,
      dimensions,
      canvasCenter,
      group
    }
  }

  const exposePaintedAreasToLLM = useCallback(() => {
    if (paintedGroups.size === 0) return
    const paintedAreas = Array.from(paintedGroups.values())
    const groups = groupContiguousPaintAreas(paintedAreas)
    const paintedAreaData = groups.map((group, index) => {
      const groupData = createObjectFromPaintGroup(group, index + 1, paintModeType)
      return {
        id: `painted_area_${index + 1}`,
        name: groupData.name,
        information: groupData.information,
        position: groupData.position,
        dimensions: groupData.dimensions,
        paintedType: paintModeType,
        strokeCount: group.length,
        canvasCenter: groupData.canvasCenter,
        worldPosition: groupData.position
      }
    })
    if (onPaintedAreasChange) {
      onPaintedAreasChange(paintedAreaData)
    }
  }, [paintedGroups, paintModeType, onPaintedAreasChange])

  const processPaintedAreasIntoObjects = useCallback(() => {
    if (!paintCanvasRef.current || paintedGroups.size === 0) return
    const paintedAreas = Array.from(paintedGroups.values())
    const groups = groupContiguousPaintAreas(paintedAreas)
    groups.forEach((group, index) => {
      const groupData = createObjectFromPaintGroup(group, index + 1, paintModeType)
      const finalName = aiObjectProperties?.name || groupData.name
      const finalInformation = aiObjectProperties?.information || aiObjectProperties?.description || groupData.information
      const finalType = aiObjectProperties?.type || (paintModeType === 'doors' ? 'door' : 'object')
      if (finalType === 'door' || paintModeType === 'doors') {
        const paintedDoorParams = {
          name: finalName,
          type: 'door',
          description: finalInformation,
          information: finalInformation,
          position: groupData.position,
          targetRoomId: aiObjectProperties?.targetRoomId || '',
          isPaintedDoor: true,
          paintData: {
            dimensions: groupData.dimensions,
            canvasPosition: groupData.canvasCenter,
            color: 'rgba(0, 0, 255, 0.9)',
            aiGenerated: !!aiObjectProperties,
            strokeCount: group.length,
            totalArea: group.reduce((sum, area) => sum + (area.size * area.size), 0)
          }
        }
        if (onPaintedObjectCreated) {
          onPaintedObjectCreated(paintedDoorParams)
        }
      } else {
        const paintedObjectParams = {
          name: finalName,
          type: 'object',
          information: finalInformation,
          position: groupData.position,
          isPaintedObject: true,
          paintData: {
            dimensions: groupData.dimensions,
            canvasPosition: groupData.canvasCenter,
            color: 'rgba(255, 0, 0, 0.9)',
            aiGenerated: !!aiObjectProperties,
            strokeCount: group.length,
            totalArea: group.reduce((sum, area) => sum + (area.size * area.size), 0)
          }
        }
        if (onPaintedObjectCreated) {
          onPaintedObjectCreated(paintedObjectParams)
        }
      }
    })
    setPaintedGroups(new Map())
  }, [paintedGroups, paintModeType, aiObjectProperties, onPaintedObjectCreated])

  const disablePaintMode = useCallback(() => {
    if (!skyboxMaterialRef.current || !skyboxSphereRef.current) return
    if (creationModeActive) {
      exposePaintedAreasToLLM()
    } else {
      processPaintedAreasIntoObjects()
    }
    if (skyboxSphereRef.current.userData.paintSphere) {
      const paintSphere = skyboxSphereRef.current.userData.paintSphere
      const paintMaterial = skyboxSphereRef.current.userData.paintMaterial
      const paintGeometry = skyboxSphereRef.current.userData.paintGeometry
      sceneRef.current.remove(paintSphere)
      if (paintGeometry) paintGeometry.dispose()
      if (paintMaterial) paintMaterial.dispose()
      skyboxSphereRef.current.userData.paintSphere = null
      skyboxSphereRef.current.userData.paintMaterial = null
      skyboxSphereRef.current.userData.paintGeometry = null
    }
  }, [creationModeActive, sceneRef, skyboxSphereRef, exposePaintedAreasToLLM, processPaintedAreasIntoObjects])

  const paintOnSkybox = useCallback((event) => {
    if (!paintModeEnabledRef.current || !paintContextRef.current || !cameraRef.current) return
    const mouse = new THREE.Vector2()
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1
    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(mouse, cameraRef.current)
    if (!skyboxSphereRef.current) return
    const intersects = raycaster.intersectObject(skyboxSphereRef.current)
    if (intersects.length > 0) {
      const intersectionPoint = intersects[0].point
      const uv = intersects[0].uv
      if (uv) {
        const canvas = paintCanvasRef.current
        const context = paintContextRef.current
        let canvasX = ((uv.x + 0.5) % 1.0) * canvas.width
        let canvasY = (1.0 - uv.y) * canvas.height
        const latitude = canvasYToLatitude(canvasY, canvas.height)
        const baseBrushSize = 25
        const adjustedBrush = calculateLatitudeAdjustedBrushSize(baseBrushSize, canvasY, canvas.height)
        let effectiveType = paintModeType
        if (creationModeActive && aiObjectProperties?.type) {
          effectiveType = aiObjectProperties.type === 'door' ? 'doors' : 'objects'
          if (effectiveType !== paintModeType && onPaintTypeChange) {
            onPaintTypeChange(effectiveType)
          }
        }
        const paintColor = effectiveType === 'doors'
          ? 'rgba(0, 0, 255, 0.9)'
          : 'rgba(255, 0, 0, 0.9)'
        if (creationModeActive && aiObjectProperties?.type) {
          context.shadowColor = paintColor
          context.shadowBlur = 10
        } else {
          context.shadowBlur = 0
        }
        context.fillStyle = paintColor
        context.beginPath()
        context.save()
        context.translate(canvasX, canvasY)
        context.scale(adjustedBrush.width / adjustedBrush.height, 1)
        context.arc(0, 0, adjustedBrush.height / 2, 0, Math.PI * 2)
        context.restore()
        context.fill()
        context.shadowBlur = 0
        const paintedArea = {
          id: Date.now() + Math.random(),
          center: { x: canvasX, y: canvasY },
          size: adjustedBrush.size,
          width: adjustedBrush.width,
          height: adjustedBrush.height,
          baseSize: baseBrushSize,
          latitude: latitude,
          distortionFactor: 1 / Math.max(0.1, Math.abs(Math.cos(latitude))),
          color: paintColor,
          worldPosition: intersectionPoint.clone(),
          metadata: {
            name: aiObjectProperties?.name || `Painted Object ${paintedGroups.size + 1}`,
            info: aiObjectProperties?.information || aiObjectProperties?.description || 'Created with paint tool',
            aiGenerated: !!aiObjectProperties
          },
          effectiveType: effectiveType
        }
        setPaintedGroups(prev => {
          const newGroups = new Map(prev)
          newGroups.set(paintedArea.id, paintedArea)
          return newGroups
        })
        if (paintTextureRef.current) {
          paintTextureRef.current.needsUpdate = true
        }
        exposePaintedAreasToLLM()
      }
    }
  }, [paintModeEnabledRef, paintContextRef, cameraRef, skyboxSphereRef, paintCanvasRef, paintedGroups, creationModeActive, aiObjectProperties, paintModeType, onPaintTypeChange, exposePaintedAreasToLLM])

  const getPaintedObjectAt = useCallback((event) => {
    if (!paintModeEnabledRef.current) return null
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
        let canvasX = ((uv.x + 0.5) % 1.0) * canvas.width
        let canvasY = (1.0 - uv.y) * canvas.height
        const latitude = canvasYToLatitude(canvasY, canvas.height)
        let closestArea = null
        let minDistance = Infinity
        paintedGroups.forEach((area) => {
          const dx = area.center.x - canvasX
          const dy = area.center.y - canvasY
          const areaWidth = area.width || area.size || 25
          const areaHeight = area.height || area.size || 25
          const ellipticalDistance = Math.sqrt(Math.pow(dx / areaWidth, 2) + Math.pow(dy / areaHeight, 2))
          if (ellipticalDistance < 0.5 && ellipticalDistance < minDistance) {
            minDistance = ellipticalDistance
            closestArea = area
          }
        })
        return closestArea
      }
    }
    return null
  }, [paintModeEnabledRef, cameraRef, skyboxSphereRef, paintCanvasRef, paintedGroups])

  return {
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
  }
}
