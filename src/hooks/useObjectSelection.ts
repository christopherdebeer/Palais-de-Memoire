import { useRef, useCallback } from 'react'
import * as THREE from 'three'

interface ObjectMarkerData {
  mesh: THREE.Mesh
  originalScale: THREE.Vector3
  isSelected: boolean
}

interface UseObjectSelectionProps {
  onObjectSelected?: (objectId: string | null) => void
  selectedObjectId?: string | null
}

interface UseObjectSelectionReturn {
  objectMarkersRef: React.MutableRefObject<Map<string, ObjectMarkerData>>
  offScreenIndicatorsRef: React.MutableRefObject<Map<string, THREE.Mesh>>
  createObjectMarker: (obj: any, scene: THREE.Scene) => THREE.Mesh | null
  updateObjectMarkerSelection: (objectId: string, isSelected: boolean) => void
  removeObjectMarker: (objectId: string, scene: THREE.Scene) => void
  createObjectIndicator: (obj: any, direction: THREE.Vector3, isInView: boolean, scene: THREE.Scene, camera: THREE.Camera) => THREE.Mesh | null
  updateOffScreenIndicators: (objects: any[], scene: THREE.Scene, camera: THREE.Camera) => void
  animateObjectIndicators: () => void
  cleanupObjectMarkers: (scene: THREE.Scene) => void
}

export const useObjectSelection = ({
  onObjectSelected,
  selectedObjectId
}: UseObjectSelectionProps): UseObjectSelectionReturn => {
  const objectMarkersRef = useRef<Map<string, ObjectMarkerData>>(new Map())
  const offScreenIndicatorsRef = useRef<Map<string, THREE.Mesh>>(new Map())

  const createObjectMarker = useCallback((obj: any, scene: THREE.Scene): THREE.Mesh | null => {
    if (!scene) return null
    
    console.log(`[ObjectSelection] Creating object marker for:`, {
      objectId: obj.id,
      objectName: obj.name,
      position: obj.position
    })

    // Create sphere marker
    const markerGeometry = new THREE.SphereGeometry(0.5, 16, 16)
    const markerMaterial = new THREE.MeshBasicMaterial({
      color: selectedObjectId === obj.id ? 0xff6b00 : 0x00ff88,
      transparent: true,
      opacity: 0.8
    })

    const marker = new THREE.Mesh(markerGeometry, markerMaterial)
    
    // Position marker based on object position
    if (obj.position) {
      // Convert spherical coordinates to Cartesian if needed
      if (typeof obj.position.x === 'number') {
        marker.position.set(obj.position.x, obj.position.y, obj.position.z)
      } else {
        // Handle other position formats if necessary
        marker.position.set(0, 0, 0)
      }
    }

    // Store original scale for animation
    const originalScale = marker.scale.clone()
    marker.userData = {
      objectId: obj.id,
      originalScale,
      isSelected: selectedObjectId === obj.id
    }

    scene.add(marker)
    
    // Store in ref map
    objectMarkersRef.current.set(obj.id, {
      mesh: marker,
      originalScale,
      isSelected: selectedObjectId === obj.id
    })

    console.log(`[ObjectSelection] Object marker created for ${obj.name}`)
    return marker
  }, [selectedObjectId])

  const updateObjectMarkerSelection = useCallback((objectId: string, isSelected: boolean) => {
    const markerData = objectMarkersRef.current.get(objectId)
    if (!markerData) return

    // Update material color
    const material = markerData.mesh.material as THREE.MeshBasicMaterial
    material.color.setHex(isSelected ? 0xff6b00 : 0x00ff88)
    
    // Update selection state
    markerData.isSelected = isSelected
    markerData.mesh.userData.isSelected = isSelected

    console.log(`[ObjectSelection] Updated marker selection for ${objectId}: ${isSelected}`)
  }, [])

  const removeObjectMarker = useCallback((objectId: string, scene: THREE.Scene) => {
    const markerData = objectMarkersRef.current.get(objectId)
    if (!markerData) return

    // Remove from scene
    scene.remove(markerData.mesh)
    
    // Dispose geometry and material
    markerData.mesh.geometry.dispose()
    if (markerData.mesh.material instanceof THREE.Material) {
      markerData.mesh.material.dispose()
    }

    // Remove from ref map
    objectMarkersRef.current.delete(objectId)

    console.log(`[ObjectSelection] Removed object marker for ${objectId}`)
  }, [])

  const createObjectIndicator = useCallback((
    obj: any, 
    direction: THREE.Vector3, 
    isInView: boolean, 
    scene: THREE.Scene, 
    camera: THREE.Camera
  ): THREE.Mesh | null => {
    if (!scene || !camera) return null

    console.log(`[ObjectSelection] Creating object indicator:`, {
      objectId: obj.id,
      objectName: obj.name,
      isInView,
      direction
    })

    // Create arrow geometry pointing in the direction of the object
    const arrowGeometry = new THREE.ConeGeometry(0.08, 0.4, 4)
    arrowGeometry.rotateX(Math.PI / 2) // Align cone's forward axis

    const arrowMaterial = new THREE.MeshBasicMaterial({
      color: selectedObjectId === obj.id ? 0xff6b00 : 0x00ff88,
      transparent: true,
      opacity: isInView ? 0.4 : 0.8
    })

    const indicator = new THREE.Mesh(arrowGeometry, arrowMaterial)
    
    // Position indicator at edge of screen pointing toward object
    const indicatorDistance = 8
    const indicatorPosition = direction.clone().normalize().multiplyScalar(indicatorDistance)
    indicator.position.copy(indicatorPosition)
    
    // Point arrow toward the object
    indicator.lookAt(direction.clone().normalize().multiplyScalar(indicatorDistance * 2))
    
    indicator.userData = {
      objectId: obj.id,
      targetDirection: direction.clone(),
      isInView,
      originalOpacity: arrowMaterial.opacity
    }

    scene.add(indicator)
    offScreenIndicatorsRef.current.set(obj.id, indicator)

    return indicator
  }, [selectedObjectId])

  const updateOffScreenIndicators = useCallback((objects: any[], scene: THREE.Scene, camera: THREE.Camera) => {
    if (!scene || !camera) return

    // Clear existing indicators
    offScreenIndicatorsRef.current.forEach((indicator, objectId) => {
      scene.remove(indicator)
      indicator.geometry.dispose()
      if (indicator.material instanceof THREE.Material) {
        indicator.material.dispose()
      }
    })
    offScreenIndicatorsRef.current.clear()

    // Create new indicators for objects
    objects.forEach(obj => {
      if (!obj.position) return

      // Calculate direction to object
      const objectPosition = new THREE.Vector3(obj.position.x, obj.position.y, obj.position.z)
      const cameraPosition = camera.position
      const direction = objectPosition.sub(cameraPosition).normalize()

      // Check if object is in view (simplified check)
      const isInView = camera instanceof THREE.PerspectiveCamera ? 
        direction.dot(camera.getWorldDirection(new THREE.Vector3())) > 0.5 : false

      // Create indicator for off-screen objects
      if (!isInView) {
        createObjectIndicator(obj, direction, isInView, scene, camera)
      }
    })
  }, [createObjectIndicator])

  const animateObjectIndicators = useCallback(() => {
    const time = Date.now() * 0.001

    // Animate object markers (subtle pulsing)
    objectMarkersRef.current.forEach((markerData) => {
      if (markerData.originalScale) {
        const scale = 1.0 + Math.sin(time * 2) * 0.1 // Gentle pulsing
        markerData.mesh.scale.copy(markerData.originalScale).multiplyScalar(scale)
      }
    })

    // Animate off-screen indicators
    offScreenIndicatorsRef.current.forEach((indicator) => {
      if (indicator.userData.originalOpacity) {
        const opacity = indicator.userData.originalOpacity * (0.8 + Math.sin(time * 3) * 0.2)
        const material = indicator.material as THREE.MeshBasicMaterial
        material.opacity = opacity
      }
    })
  }, [])

  const cleanupObjectMarkers = useCallback((scene: THREE.Scene) => {
    // Clean up object markers
    objectMarkersRef.current.forEach((markerData) => {
      scene.remove(markerData.mesh)
      markerData.mesh.geometry.dispose()
      if (markerData.mesh.material instanceof THREE.Material) {
        markerData.mesh.material.dispose()
      }
    })
    objectMarkersRef.current.clear()

    // Clean up off-screen indicators
    offScreenIndicatorsRef.current.forEach((indicator) => {
      scene.remove(indicator)
      indicator.geometry.dispose()
      if (indicator.material instanceof THREE.Material) {
        indicator.material.dispose()
      }
    })
    offScreenIndicatorsRef.current.clear()

    console.log('[ObjectSelection] Cleaned up all object markers and indicators')
  }, [])

  return {
    objectMarkersRef,
    offScreenIndicatorsRef,
    createObjectMarker,
    updateObjectMarkerSelection,
    removeObjectMarker,
    createObjectIndicator,
    updateOffScreenIndicators,
    animateObjectIndicators,
    cleanupObjectMarkers
  }
}