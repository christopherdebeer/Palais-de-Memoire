import { EventEmitter } from './EventEmitter.js'
import { EventTypes, CommandActions } from './types.js'

/**
 * Room Manager - Handles room lifecycle, navigation, and room-related operations
 * Manages the creation, editing, deletion, and navigation between rooms
 */
export class RoomManager extends EventEmitter {
  constructor(stateManager, apiManager) {
    super()
    this.stateManager = stateManager
    this.apiManager = apiManager
    this.currentRoomId = null
    this.isGeneratingImage = false
  }

  /**
   * Initialize the room manager
   */
  async initialize() {
    const userState = this.stateManager.getUserState()
    this.currentRoomId = userState.currentRoomId
    
    // Listen for state changes
    this.stateManager.on(EventTypes.STATE_CHANGED, this.handleStateChange.bind(this))
  }

  /**
   * Get the currently active room
   * @returns {Object|null} Current room data
   */
  getCurrentRoom() {
    if (!this.currentRoomId) return null
    return this.stateManager.getRoom(this.currentRoomId)
  }

  /**
   * Get all rooms for the current user
   * @returns {Object[]} Array of room objects
   */
  getAllRooms() {
    const rooms = this.stateManager.getRooms()
    return Array.from(rooms.values()).sort((a, b) => a.roomCounter - b.roomCounter)
  }

  /**
   * Create a new room
   * @param {string} name - Room name
   * @param {string} description - Room description for image generation
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Created room object
   */
  async createRoom(name, description, options = {}) {
    const userState = this.stateManager.getUserState()
    const roomId = this.stateManager.generateId()
    const roomCounter = (userState.roomCounter || 0) + 1

    // Create room object
    const room = {
      id: roomId,
      userId: userState.id,
      name: name || `Room ${roomCounter}`,
      description,
      imageUrl: null,
      roomCounter,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    // Save room to state
    await this.stateManager.setRoom(room)
    
    // Update user state with new room counter
    await this.stateManager.updateUserState({
      roomCounter,
      currentRoomId: roomId
    })

    this.currentRoomId = roomId
    this.emit(EventTypes.ROOM_CREATED, room)

    // Generate room image if API is available
    if (!options.skipImageGeneration) {
      await this.generateRoomImage(roomId, description)
    }

    return room
  }

  /**
   * Edit an existing room
   * @param {string} roomId - Room ID to edit
   * @param {Object} updates - Updates to apply
   * @returns {Promise<Object|null>} Updated room object
   */
  async editRoom(roomId, updates) {
    const room = this.stateManager.getRoom(roomId)
    if (!room) {
      throw new Error(`Room ${roomId} not found`)
    }

    const updatedRoom = {
      ...room,
      ...updates,
      updatedAt: new Date().toISOString()
    }

    await this.stateManager.setRoom(updatedRoom)

    // Regenerate image if description changed
    if (updates.description && updates.description !== room.description) {
      this.generateRoomImage(roomId, updates.description)
    }

    this.emit(EventTypes.ROOM_UPDATED, updatedRoom)
    return updatedRoom
  }

  /**
   * Delete a room and handle cleanup
   * @param {string} roomId - Room ID to delete
   * @returns {Promise<boolean>} Success status
   */
  async deleteRoom(roomId) {
    const room = this.stateManager.getRoom(roomId)
    if (!room) {
      return false
    }

    // If deleting current room, navigate to another room or clear current
    if (this.currentRoomId === roomId) {
      const allRooms = this.getAllRooms().filter(r => r.id !== roomId)
      const newCurrentRoomId = allRooms.length > 0 ? allRooms[0].id : null
      
      await this.navigateToRoom(newCurrentRoomId)
    }

    // Delete room and associated data
    await this.stateManager.deleteRoom(roomId)
    
    return true
  }

  /**
   * Navigate to a specific room
   * @param {string|null} roomId - Room ID to navigate to, or null to clear current room
   * @returns {Promise<Object|null>} Target room object
   */
  async navigateToRoom(roomId) {
    let targetRoom = null
    
    if (roomId) {
      targetRoom = this.stateManager.getRoom(roomId)
      if (!targetRoom) {
        throw new Error(`Room ${roomId} not found`)
      }
    }

    const previousRoomId = this.currentRoomId
    this.currentRoomId = roomId

    // Update user state
    await this.stateManager.updateUserState({
      currentRoomId: roomId
    })

    this.emit(EventTypes.ROOM_CHANGED, {
      previousRoomId,
      currentRoomId: roomId,
      currentRoom: targetRoom
    })

    return targetRoom
  }

  /**
   * Generate an image for a room
   * @param {string} roomId - Room ID
   * @param {string} description - Description for image generation
   * @returns {Promise<boolean>} Success status
   */
  async generateRoomImage(roomId, description) {
    if (this.isGeneratingImage) {
      console.warn('Image generation already in progress')
      return false
    }

    const room = this.stateManager.getRoom(roomId)
    if (!room) {
      console.error(`Room ${roomId} not found`)
      return false
    }

    this.isGeneratingImage = true

    try {
      // Get user settings for aesthetic prompt
      const userState = this.stateManager.getUserState()
      const aestheticPrompt = userState.settings?.ai?.aestheticPrompt || 'photorealistic, high quality, immersive'
      
      // Combine description with aesthetic prompt
      const fullPrompt = `Create a 360 degree equirectangular panoramic image in 21:9 aspect ratio showing: ${description}. ${aestheticPrompt}`

      const result = await this.apiManager.generateImage(fullPrompt, {
        width: 2048,
        height: 1024,
        format: 'jpg'
      })

      if (result.success) {
        // Update room with image URL
        await this.editRoom(roomId, {
          imageUrl: result.data
        })
        
        this.emit('room_image_generated', {
          roomId,
          imageUrl: result.data,
          description
        })
        
        return true
      } else {
        console.error('Failed to generate room image:', result.error)
        this.emit(EventTypes.ERROR_OCCURRED, {
          type: 'image_generation_error',
          roomId,
          error: result.error
        })
        return false
      }
    } catch (error) {
      console.error('Error generating room image:', error)
      this.emit(EventTypes.ERROR_OCCURRED, {
        type: 'image_generation_error',
        roomId,
        error: error.message
      })
      return false
    } finally {
      this.isGeneratingImage = false
    }
  }

  /**
   * Get rooms connected to a specific room
   * @param {string} roomId - Source room ID
   * @returns {Object[]} Array of connected rooms
   */
  getConnectedRooms(roomId) {
    const connections = this.stateManager.getRoomConnections(roomId)
    const connectedRooms = []

    for (const connection of connections) {
      const targetRoom = this.stateManager.getRoom(connection.targetRoomId)
      if (targetRoom) {
        connectedRooms.push({
          ...targetRoom,
          connection
        })
      }
    }

    return connectedRooms
  }

  /**
   * Find a room by name (fuzzy search)
   * @param {string} name - Room name to search for
   * @returns {Object|null} Found room or null
   */
  findRoomByName(name) {
    const rooms = this.getAllRooms()
    const lowerName = name.toLowerCase()
    
    // Exact match first
    let found = rooms.find(r => r.name.toLowerCase() === lowerName)
    if (found) return found
    
    // Partial match
    found = rooms.find(r => r.name.toLowerCase().includes(lowerName))
    if (found) return found
    
    // Fuzzy match (description contains name)
    found = rooms.find(r => r.description.toLowerCase().includes(lowerName))
    return found || null
  }

  /**
   * Get room statistics
   * @param {string} [roomId] - Specific room ID, or current room if not specified
   * @returns {Object} Room statistics
   */
  getRoomStats(roomId = null) {
    const targetRoomId = roomId || this.currentRoomId
    if (!targetRoomId) {
      return {
        objectCount: 0,
        connectionCount: 0,
        hasImage: false
      }
    }

    const objects = this.stateManager.getRoomObjects(targetRoomId)
    const connections = this.stateManager.getRoomConnections(targetRoomId)
    const room = this.stateManager.getRoom(targetRoomId)

    return {
      objectCount: objects.length,
      connectionCount: connections.length,
      hasImage: Boolean(room?.imageUrl),
      room
    }
  }

  /**
   * Export room data
   * @param {string} roomId - Room ID to export
   * @returns {Object} Exportable room data
   */
  exportRoom(roomId) {
    const room = this.stateManager.getRoom(roomId)
    if (!room) return null

    const objects = this.stateManager.getRoomObjects(roomId)
    const connections = this.stateManager.getRoomConnections(roomId)

    return {
      room,
      objects,
      connections,
      exportedAt: new Date().toISOString()
    }
  }

  /**
   * Import room data
   * @param {Object} roomData - Room data to import
   * @returns {Promise<string>} Imported room ID
   */
  async importRoom(roomData) {
    const { room, objects = [], connections = [] } = roomData
    
    // Generate new IDs to avoid conflicts
    const newRoomId = this.stateManager.generateId()
    const userState = this.stateManager.getUserState()
    const roomCounter = (userState.roomCounter || 0) + 1

    // Import room
    const newRoom = {
      ...room,
      id: newRoomId,
      userId: userState.id,
      roomCounter,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    
    await this.stateManager.setRoom(newRoom)
    
    // Update room counter
    await this.stateManager.updateUserState({ roomCounter })

    // Import objects
    const objectIdMap = new Map()
    for (const obj of objects) {
      const newObjectId = this.stateManager.generateId()
      objectIdMap.set(obj.id, newObjectId)
      
      const newObject = {
        ...obj,
        id: newObjectId,
        roomId: newRoomId,
        userId: userState.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      
      await this.stateManager.setObject(newObject)
    }

    // Import connections
    for (const conn of connections) {
      const newConnectionId = this.stateManager.generateId()
      
      const newConnection = {
        ...conn,
        id: newConnectionId,
        roomId: newRoomId,
        userId: userState.id,
        createdAt: new Date().toISOString()
      }
      
      await this.stateManager.setConnection(newConnection)
    }

    this.emit(EventTypes.ROOM_CREATED, newRoom)
    return newRoomId
  }

  /**
   * Handle state changes
   * @param {Object} change - State change details
   */
  handleStateChange(change) {
    if (change.key === 'user_state' && change.value?.currentRoomId !== change.oldValue?.currentRoomId) {
      this.currentRoomId = change.value.currentRoomId
    }
  }
}