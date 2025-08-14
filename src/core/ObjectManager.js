import { EventEmitter } from './EventEmitter.js'
import { EventTypes } from './types.js'

/**
 * Object Manager - Handles memory objects within rooms
 * Manages placement, retrieval, and spatial positioning of memory objects
 */
export class ObjectManager extends EventEmitter {
  constructor(stateManager) {
    super()
    this.stateManager = stateManager
  }

  /**
   * Initialize the object manager
   */
  async initialize() {
    // Listen for room changes to update object context
    this.stateManager.on(EventTypes.ROOM_CHANGED, this.handleRoomChange.bind(this))
  }

  /**
   * Add a memory object to a room
   * @param {string} roomId - Room ID to place object in
   * @param {string} name - Object name/label
   * @param {string} information - Memory information to associate
   * @param {Object} position - 3D position {x, y, z}
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Created object
   */
  async addObject(roomId, name, information, position = null, options = {}) {
    const room = this.stateManager.getRoom(roomId)
    if (!room) {
      throw new Error(`Room ${roomId} not found`)
    }

    const userState = this.stateManager.getUserState()
    const objectId = this.stateManager.generateId()
    const objectCounter = (userState.objectCounter || 0) + 1

    // Use provided position or generate default
    const objectPosition = position || this.generateDefaultPosition(roomId)

    // Create object
    const object = {
      id: objectId,
      roomId,
      userId: userState.id,
      name: name || `Object ${objectCounter}`,
      information: information || '',
      position: objectPosition,
      objectCounter,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...options
    }

    // Save object to state
    await this.stateManager.setObject(object)

    // Update user state with new object counter
    await this.stateManager.updateUserState({
      objectCounter
    })

    this.emit(EventTypes.OBJECT_CREATED, object)
    return object
  }

  /**
   * Update an existing object
   * @param {string} objectId - Object ID to update
   * @param {Object} updates - Updates to apply
   * @returns {Promise<Object|null>} Updated object
   */
  async updateObject(objectId, updates) {
    const objects = this.stateManager.getObjects()
    const object = objects.get(objectId)
    
    if (!object) {
      throw new Error(`Object ${objectId} not found`)
    }

    const updatedObject = {
      ...object,
      ...updates,
      updatedAt: new Date().toISOString()
    }

    await this.stateManager.setObject(updatedObject)
    this.emit(EventTypes.OBJECT_UPDATED, updatedObject)
    return updatedObject
  }

  /**
   * Delete an object
   * @param {string} objectId - Object ID to delete
   * @returns {Promise<boolean>} Success status
   */
  async deleteObject(objectId) {
    const objects = this.stateManager.getObjects()
    const object = objects.get(objectId)
    
    if (!object) {
      return false
    }

    await this.stateManager.deleteObject(objectId)
    return true
  }

  /**
   * Get all objects in a specific room
   * @param {string} roomId - Room ID
   * @returns {Object[]} Array of objects in the room
   */
  getRoomObjects(roomId) {
    return this.stateManager.getRoomObjects(roomId)
  }

  /**
   * Get a specific object by ID
   * @param {string} objectId - Object ID
   * @returns {Object|null} Object data or null if not found
   */
  getObject(objectId) {
    const objects = this.stateManager.getObjects()
    return objects.get(objectId) || null
  }

  /**
   * Find objects by name (fuzzy search)
   * @param {string} name - Object name to search for
   * @param {string} [roomId] - Optional room ID to limit search
   * @returns {Object[]} Array of matching objects
   */
  findObjectsByName(name, roomId = null) {
    const objects = roomId ? this.getRoomObjects(roomId) : Array.from(this.stateManager.getObjects().values())
    const lowerName = name.toLowerCase()
    
    return objects.filter(obj => 
      obj.name.toLowerCase().includes(lowerName) ||
      obj.information.toLowerCase().includes(lowerName)
    ).sort((a, b) => {
      // Prioritize exact name matches
      const aExact = obj.name.toLowerCase() === lowerName
      const bExact = obj.name.toLowerCase() === lowerName
      if (aExact && !bExact) return -1
      if (!aExact && bExact) return 1
      return a.name.localeCompare(b.name)
    })
  }

  /**
   * Move an object to a new position
   * @param {string} objectId - Object ID
   * @param {Object} newPosition - New 3D position {x, y, z}
   * @returns {Promise<Object|null>} Updated object
   */
  async moveObject(objectId, newPosition) {
    return this.updateObject(objectId, { position: newPosition })
  }

  /**
   * Move an object to a different room
   * @param {string} objectId - Object ID
   * @param {string} targetRoomId - Target room ID
   * @param {Object} [position] - Optional new position in target room
   * @returns {Promise<Object|null>} Updated object
   */
  async moveObjectToRoom(objectId, targetRoomId, position = null) {
    const targetRoom = this.stateManager.getRoom(targetRoomId)
    if (!targetRoom) {
      throw new Error(`Target room ${targetRoomId} not found`)
    }

    const newPosition = position || this.generateDefaultPosition(targetRoomId)
    
    return this.updateObject(objectId, {
      roomId: targetRoomId,
      position: newPosition
    })
  }

  /**
   * Generate a default position for a new object in a room
   * @param {string} roomId - Room ID
   * @returns {Object} Default position {x, y, z}
   */
  generateDefaultPosition(roomId) {
    const existingObjects = this.getRoomObjects(roomId)
    
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
   * Find the closest position to a screen coordinate
   * Used for click-to-place functionality
   * @param {number} screenX - Screen X coordinate (0-1)
   * @param {number} screenY - Screen Y coordinate (0-1)
   * @param {number} [distance] - Distance from origin (default 400)
   * @returns {Object} 3D position {x, y, z}
   */
  screenToWorldPosition(screenX, screenY, distance = 400) {
    // Convert screen coordinates to spherical coordinates
    const phi = (screenX - 0.5) * Math.PI * 2 // Azimuth (horizontal)
    const theta = (screenY - 0.5) * Math.PI    // Elevation (vertical)
    
    // Convert to Cartesian coordinates
    return {
      x: distance * Math.sin(theta) * Math.cos(phi),
      y: distance * Math.cos(theta),
      z: distance * Math.sin(theta) * Math.sin(phi)
    }
  }

  /**
   * Get objects within a certain distance of a position
   * @param {Object} position - Center position {x, y, z}
   * @param {number} radius - Search radius
   * @param {string} [roomId] - Optional room ID to limit search
   * @returns {Object[]} Array of nearby objects with distances
   */
  getObjectsNearPosition(position, radius, roomId = null) {
    const objects = roomId ? this.getRoomObjects(roomId) : Array.from(this.stateManager.getObjects().values())
    
    return objects
      .map(obj => ({
        ...obj,
        distance: this.calculateDistance(position, obj.position)
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
  calculateDistance(pos1, pos2) {
    const dx = pos1.x - pos2.x
    const dy = pos1.y - pos2.y
    const dz = pos1.z - pos2.z
    return Math.sqrt(dx * dx + dy * dy + dz * dz)
  }

  /**
   * Validate object position
   * @param {Object} position - Position to validate {x, y, z}
   * @param {string} roomId - Room ID
   * @returns {Object} Validation result {valid: boolean, issues: string[]}
   */
  validatePosition(position, roomId) {
    const issues = []
    
    // Check if position is too close to other objects
    const nearby = this.getObjectsNearPosition(position, 50, roomId)
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
   * @param {string} roomId - Room ID
   * @returns {Object} Statistics about objects in the room
   */
  getRoomObjectStats(roomId) {
    const objects = this.getRoomObjects(roomId)
    
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
      const category = this.classifyObject(obj)
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
  classifyObject(object) {
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
   * @param {string} roomId - Room ID
   * @returns {Object[]} Array of object data
   */
  exportRoomObjects(roomId) {
    return this.getRoomObjects(roomId).map(obj => ({
      ...obj,
      exportedAt: new Date().toISOString()
    }))
  }

  /**
   * Import objects into a room
   * @param {string} roomId - Target room ID
   * @param {Object[]} objectsData - Array of object data to import
   * @param {Object} options - Import options
   * @returns {Promise<Object[]>} Array of imported objects
   */
  async importObjects(roomId, objectsData, options = {}) {
    const room = this.stateManager.getRoom(roomId)
    if (!room) {
      throw new Error(`Room ${roomId} not found`)
    }
    
    const imported = []
    
    for (const objData of objectsData) {
      try {
        // Generate new position if needed to avoid conflicts
        let position = objData.position
        if (options.regeneratePositions) {
          position = this.generateDefaultPosition(roomId)
        } else if (options.offsetPositions) {
          position = {
            x: objData.position.x + (Math.random() - 0.5) * 100,
            y: objData.position.y + (Math.random() - 0.5) * 50,
            z: objData.position.z + (Math.random() - 0.5) * 100
          }
        }
        
        const importedObj = await this.addObject(
          roomId,
          objData.name,
          objData.information,
          position,
          { 
            ...objData,
            // Remove fields that will be regenerated
            id: undefined,
            roomId: undefined,
            userId: undefined,
            objectCounter: undefined,
            createdAt: undefined,
            updatedAt: undefined
          }
        )
        
        imported.push(importedObj)
      } catch (error) {
        console.error('Failed to import object:', objData.name, error)
      }
    }
    
    return imported
  }

  /**
   * Handle room changes to update context
   * @param {Object} changeData - Room change details
   */
  handleRoomChange(changeData) {
    // Update any object-related context when room changes
    this.emit('room_objects_context_changed', {
      roomId: changeData.currentRoomId,
      objects: changeData.currentRoomId ? this.getRoomObjects(changeData.currentRoomId) : []
    })
  }
}