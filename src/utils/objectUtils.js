/**
 * Object Management Utilities
 * Handles memory objects within rooms - creation, editing, positioning, and spatial operations
 */

import { generateId, saveState } from './stateUtils.js'

/**
 * Add a memory object to a room
 * @param {Object} state - Application state
 * @param {string} name - Object name/label
 * @param {string} information - Memory information to associate
 * @param {Object} position - 3D position {x, y, z}
 * @returns {Object} Created object
 */
export async function addObject(state, name, information, position = null) {
  const currentRoomId = state.user.currentRoomId
  if (!currentRoomId) {
    throw new Error('No current room')
  }
  
  const objectId = generateId()
  const objectCounter = state.user.objectCounter + 1

  // Use provided position or generate default
  const objectPosition = position || generateDefaultPosition(state, currentRoomId)

  const object = {
    id: objectId,
    roomId: currentRoomId,
    userId: state.user.id,
    name: name || `Object ${objectCounter}`,
    information: information || '',
    position: objectPosition,
    objectCounter,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }

  // Save object
  state.objects.set(objectId, object)
  state.user.objectCounter = objectCounter
  
  await saveState(state)
  
  return object
}

/**
 * Update an existing object
 * @param {Object} state - Application state
 * @param {string} objectId - Object ID to update
 * @param {Object} updates - Updates to apply
 * @returns {Object} Updated object
 */
export async function updateObject(state, objectId, updates) {
  const object = state.objects.get(objectId)
  if (!object) {
    throw new Error(`Object ${objectId} not found`)
  }

  const updatedObject = {
    ...object,
    ...updates,
    updatedAt: new Date().toISOString()
  }

  state.objects.set(objectId, updatedObject)
  await saveState(state)
  
  return updatedObject
}

/**
 * Delete an object
 * @param {Object} state - Application state
 * @param {string} objectId - Object ID to delete
 * @returns {boolean} Success status
 */
export async function deleteObject(state, objectId) {
  const object = state.objects.get(objectId)
  if (!object) {
    return false
  }

  state.objects.delete(objectId)
  await saveState(state)
  
  return true
}

/**
 * Get objects in current room
 * @param {Object} state - Application state
 * @returns {Object[]} Array of objects in current room
 */
export function getCurrentRoomObjects(state) {
  const currentRoomId = state?.user?.currentRoomId
  const objects = currentRoomId ? getRoomObjects(state, currentRoomId) : []
    
    // Get connections for current room and transform them to door objects
    const connections = Array.from(state.connections.values())
      .filter(conn => conn.roomId === state.user.currentRoomId)
      .map(conn => ({
        ...conn,
        name: conn.description || 'Door',
        information: `Door leading to another room`,
        targetRoomId: conn.targetRoomId, // This is the key property MemoryPalace checks for doors
      }))
    
    // Combine objects and door connections
    const allRoomItems = [...objects, ...connections]
  return allRoomItems;
}

/**
 * Get objects in a specific room
 * @param {Object} state - Application state
 * @param {string} roomId - Room ID
 * @returns {Object[]} Array of objects in the room
 */
export function getRoomObjects(state, roomId) {
  return Array.from(state.objects.values()).filter(obj => obj.roomId === roomId)
}

/**
 * Get a specific object by ID
 * @param {Object} state - Application state
 * @param {string} objectId - Object ID
 * @returns {Object|null} Object data or null if not found
 */
export function getObject(state, objectId) {
  return state.objects.get(objectId) || null
}

/**
 * Find objects by name (fuzzy search)
 * @param {Object} state - Application state
 * @param {string} name - Object name to search for
 * @param {string} [roomId] - Optional room ID to limit search
 * @returns {Object[]} Array of matching objects
 */
export function findObjectsByName(state, name, roomId = null) {
  const objects = roomId ? getRoomObjects(state, roomId) : Array.from(state.objects.values())
  const lowerName = name.toLowerCase()
  
  return objects.filter(obj => 
    obj.name.toLowerCase().includes(lowerName) ||
    obj.information.toLowerCase().includes(lowerName)
  ).sort((a, b) => {
    // Prioritize exact name matches
    const aExact = a.name.toLowerCase() === lowerName
    const bExact = b.name.toLowerCase() === lowerName
    if (aExact && !bExact) return -1
    if (!aExact && bExact) return 1
    return a.name.localeCompare(b.name)
  })
}

/**
 * Move an object to a new position
 * @param {Object} state - Application state
 * @param {string} objectId - Object ID
 * @param {Object} newPosition - New 3D position {x, y, z}
 * @returns {Object} Updated object
 */
export async function moveObject(state, objectId, newPosition) {
  return updateObject(state, objectId, { position: newPosition })
}

/**
 * Move an object to a different room
 * @param {Object} state - Application state
 * @param {string} objectId - Object ID
 * @param {string} targetRoomId - Target room ID
 * @param {Object} [position] - Optional new position in target room
 * @returns {Object} Updated object
 */
export async function moveObjectToRoom(state, objectId, targetRoomId, position = null) {
  const targetRoom = state.rooms.get(targetRoomId)
  if (!targetRoom) {
    throw new Error(`Target room ${targetRoomId} not found`)
  }

  const newPosition = position || generateDefaultPosition(state, targetRoomId)
  
  return updateObject(state, objectId, {
    roomId: targetRoomId,
    position: newPosition
  })
}

/**
 * Generate a default position for a new object in a room
 * @param {Object} state - Application state
 * @param {string} roomId - Room ID
 * @returns {Object} Default position {x, y, z}
 */
export function generateDefaultPosition(state, roomId) {
  const existingObjects = getRoomObjects(state, roomId)
  
  // Create a spiral pattern around the room
  const radius = 400
  const angle = (existingObjects.length * 60) * (Math.PI / 180) // 60 degrees apart
  const height = Math.sin(existingObjects.length * 0.3) * 50 // Slight height variation
  
  return {
    x: Math.cos(angle) * radius,
    y: height,
    z: Math.sin(angle) * radius
  }
}

/**
 * Perform ray casting from screen coordinates to find sphere intersection
 * @param {number} clientX - Screen X coordinate in pixels
 * @param {number} clientY - Screen Y coordinate in pixels 
 * @param {Object} camera - THREE.js camera
 * @param {Object} sphere - THREE.js sphere mesh to intersect with
 * @returns {Object|null} Intersection point {x, y, z} or null if no intersection
 */
export function performRayCasting(clientX, clientY, camera, sphere) {
  if (typeof window === 'undefined' || !window.THREE) {
    return null
  }
  
  const THREE = window.THREE
  
  // Convert screen coordinates to normalized device coordinates (-1 to +1)
  const mouse = new THREE.Vector2()
  mouse.x = (clientX / window.innerWidth) * 2 - 1
  mouse.y = -(clientY / window.innerHeight) * 2 + 1

  // Create raycaster and find intersection
  const raycaster = new THREE.Raycaster()
  raycaster.setFromCamera(mouse, camera)
  
  const intersects = raycaster.intersectObject(sphere)
  
  if (intersects.length > 0) {
    const intersectionPoint = intersects[0].point
    return {
      x: intersectionPoint.x,
      y: intersectionPoint.y,
      z: intersectionPoint.z
    }
  }
  
  return null
}

/**
 * Convert screen coordinates to world position on sphere surface using ray casting
 * @param {number} screenX - Screen X coordinate (0-1, normalized)
 * @param {number} screenY - Screen Y coordinate (0-1, normalized) 
 * @param {number} [sphereRadius] - Sphere radius (default 500 to match the skybox)
 * @param {Object} [camera] - THREE.js camera for proper ray casting (optional)
 * @returns {Object} 3D position {x, y, z} on sphere surface
 */
export function screenToWorldPosition(screenX, screenY, sphereRadius = 500, camera = null) {
  // If camera is available, use proper ray casting (preferred method)
  if (camera && typeof window !== 'undefined' && window.THREE) {
    const THREE = window.THREE
    
    // Convert normalized screen coordinates to NDC (-1 to +1)
    const mouse = new THREE.Vector2()
    mouse.x = screenX * 2 - 1
    mouse.y = -(screenY * 2 - 1)
    
    // Create raycaster
    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(mouse, camera)
    
    // Create sphere geometry for intersection testing
    const sphereGeometry = new THREE.SphereGeometry(sphereRadius, 32, 16)
    const sphereMesh = new THREE.Mesh(sphereGeometry)
    
    // Find intersection with sphere
    const intersects = raycaster.intersectObject(sphereMesh)
    
    // Cleanup
    sphereGeometry.dispose()
    
    if (intersects.length > 0) {
      const intersectionPoint = intersects[0].point
      return {
        x: intersectionPoint.x,
        y: intersectionPoint.y, 
        z: intersectionPoint.z
      }
    }
  }
  
  // Fallback: Improved spherical coordinate conversion
  // This assumes a forward-facing camera at origin (0,0,0)
  
  // Convert screen coordinates to spherical angles
  // Map screen coordinates to sphere surface more accurately
  const phi = (screenX - 0.5) * Math.PI * 1.8  // Horizontal (reduced from 2π for better distribution)
  const theta = (screenY - 0.5) * Math.PI * 0.9 // Vertical (reduced to avoid poles)
  
  // Convert spherical to Cartesian coordinates
  // Using standard spherical coordinate system: (r, θ, φ)
  // where θ is polar angle from positive Y, φ is azimuthal angle from positive X
  const polarAngle = Math.PI/2 + theta  // Offset so center of screen maps to horizon
  
  return {
    x: sphereRadius * Math.sin(polarAngle) * Math.cos(phi),
    y: sphereRadius * Math.cos(polarAngle), 
    z: sphereRadius * Math.sin(polarAngle) * Math.sin(phi)
  }
}

/**
 * Position an object on the sphere surface
 * @param {Object} position - Input position {x, y, z}
 * @param {number} [sphereRadius] - Sphere radius (default 500)
 * @param {number} [offsetMultiplier] - Multiplier for positioning slightly outside surface (default 1.0)
 * @returns {Object} Position on sphere surface {x, y, z}
 */
export function positionOnSphere(position, sphereRadius = 500, offsetMultiplier = 1.0) {
  if (typeof window !== 'undefined' && window.THREE) {
    const THREE = window.THREE
    
    // Normalize position to sphere surface
    const direction = new THREE.Vector3(position.x, position.y, position.z).normalize()
    const finalPosition = direction.multiplyScalar(sphereRadius * offsetMultiplier)
    
    return {
      x: finalPosition.x,
      y: finalPosition.y,
      z: finalPosition.z
    }
  }
  
  // Fallback without THREE.js
  const magnitude = Math.sqrt(position.x * position.x + position.y * position.y + position.z * position.z)
  if (magnitude === 0) {
    return { x: sphereRadius * offsetMultiplier, y: 0, z: 0 }
  }
  
  const normalizedRadius = (sphereRadius * offsetMultiplier) / magnitude
  return {
    x: position.x * normalizedRadius,
    y: position.y * normalizedRadius,
    z: position.z * normalizedRadius
  }
}

/**
 * Get objects within a certain distance of a position
 * @param {Object} state - Application state
 * @param {Object} position - Center position {x, y, z}
 * @param {number} radius - Search radius
 * @param {string} [roomId] - Optional room ID to limit search
 * @returns {Object[]} Array of nearby objects with distances
 */
export function getObjectsNearPosition(state, position, radius, roomId = null) {
  const objects = roomId ? getRoomObjects(state, roomId) : Array.from(state.objects.values())
  
  return objects
    .map(obj => ({
      ...obj,
      distance: calculateDistance(position, obj.position)
    }))
    .filter(obj => obj.distance <= radius)
    .sort((a, b) => a.distance - b.distance)
}

/**
 * Calculate distance between two 3D points
 * @param {Object} pos1 - First position {x, y, z}
 * @param {Object} pos2 - Second position {x, y, z}
 * @returns {number} Distance
 */
export function calculateDistance(pos1, pos2) {
  const dx = pos1.x - pos2.x
  const dy = pos1.y - pos2.y
  const dz = pos1.z - pos2.z
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

/**
 * Validate object position
 * @param {Object} state - Application state
 * @param {Object} position - Position to validate {x, y, z}
 * @param {string} roomId - Room ID
 * @returns {Object} Validation result {valid: boolean, issues: string[]}
 */
export function validatePosition(state, position, roomId) {
  const issues = []
  
  // Check if position is too close to other objects
  const nearby = getObjectsNearPosition(state, position, 50, roomId)
  if (nearby.length > 0) {
    issues.push('Position is too close to existing objects')
  }
  
  // Check if position is within reasonable bounds
  const distance = Math.sqrt(position.x * position.x + position.y * position.y + position.z * position.z)
  if (distance > 500) {
    issues.push('Position is too far from center')
  }
  
  if (distance < 100) {
    issues.push('Position is too close to center')
  }
  
  return {
    valid: issues.length === 0,
    issues
  }
}

/**
 * Get object statistics for a room
 * @param {Object} state - Application state
 * @param {string} roomId - Room ID
 * @returns {Object} Statistics about objects in the room
 */
export function getRoomObjectStats(state, roomId) {
  const objects = getRoomObjects(state, roomId)
  
  if (objects.length === 0) {
    return {
      count: 0,
      averageDistance: 0,
      spread: 0,
      categories: {}
    }
  }
  
  // Calculate distances from center
  const distances = objects.map(obj => {
    const pos = obj.position
    return Math.sqrt(pos.x * pos.x + pos.y * pos.y + pos.z * pos.z)
  })
  
  const averageDistance = distances.reduce((sum, d) => sum + d, 0) / distances.length
  const spread = Math.max(...distances) - Math.min(...distances)
  
  // Categorize objects by name patterns (simple classification)
  const categories = {}
  objects.forEach(obj => {
    const category = classifyObject(obj)
    categories[category] = (categories[category] || 0) + 1
  })
  
  return {
    count: objects.length,
    averageDistance: Math.round(averageDistance),
    spread: Math.round(spread),
    categories
  }
}

/**
 * Simple object classification based on name/content
 * @param {Object} object - Object to classify
 * @returns {string} Category name
 */
export function classifyObject(object) {
  const text = `${object.name} ${object.information}`.toLowerCase()
  
  if (text.includes('book') || text.includes('document') || text.includes('paper')) {
    return 'documents'
  } else if (text.includes('person') || text.includes('people') || text.includes('name')) {
    return 'people'
  } else if (text.includes('number') || text.includes('date') || text.includes('time')) {
    return 'data'
  } else if (text.includes('place') || text.includes('location') || text.includes('address')) {
    return 'places'
  } else {
    return 'other'
  }
}

/**
 * Export objects from a room
 * @param {Object} state - Application state
 * @param {string} roomId - Room ID
 * @returns {Object[]} Array of object data
 */
export function exportRoomObjects(state, roomId) {
  return getRoomObjects(state, roomId).map(obj => ({
    ...obj,
    exportedAt: new Date().toISOString()
  }))
}

/**
 * Import objects into a room
 * @param {Object} state - Application state
 * @param {string} roomId - Target room ID
 * @param {Object[]} objectsData - Array of object data to import
 * @param {Object} options - Import options
 * @returns {Object[]} Array of imported objects
 */
export async function importObjects(state, roomId, objectsData, options = {}) {
  const room = state.rooms.get(roomId)
  if (!room) {
    throw new Error(`Room ${roomId} not found`)
  }
  
  const imported = []
  
  for (const objData of objectsData) {
    try {
      // Generate new position if needed to avoid conflicts
      let position = objData.position
      if (options.regeneratePositions) {
        position = generateDefaultPosition(state, roomId)
      } else if (options.offsetPositions) {
        position = {
          x: objData.position.x + (Math.random() - 0.5) * 100,
          y: objData.position.y + (Math.random() - 0.5) * 50,
          z: objData.position.z + (Math.random() - 0.5) * 100
        }
      }
      
      // Temporarily set current room for addObject
      const originalRoomId = state.user.currentRoomId
      state.user.currentRoomId = roomId
      
      const importedObj = await addObject(
        state,
        objData.name,
        objData.information,
        position
      )
      
      // Restore original current room
      state.user.currentRoomId = originalRoomId
      
      imported.push(importedObj)
    } catch (error) {
      console.error('Failed to import object:', objData.name, error)
    }
  }
  
  return imported
}
