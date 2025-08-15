import { EventEmitter } from './EventEmitter.js'
import { EventTypes } from './types.js'
import * as stateUtils from '../utils/stateUtils.js'
import * as roomUtils from '../utils/roomUtils.js'
import * as objectUtils from '../utils/objectUtils.js'
import * as commandParser from '../utils/commandParser.js'
import * as imageGeneration from '../utils/imageGeneration.js'

/**
 * MemoryPalaceCore - Orchestrates the Memory Palace application
 * Uses utility modules for specific functionality, focuses on coordination and events
 */
export class MemoryPalaceCore extends EventEmitter {
  constructor(config = {}) {
    super()
    
    // Configuration
    this.config = {
      enableImageGeneration: true,
      persistence: 'localStorage',
      enableVoice: true,
      enableSpatialInteraction: true,
      autopilot: false,
      ...config
    }
    
    // Application state - managed by utilities
    this.state = {
      user: null,
      rooms: new Map(),
      objects: new Map(),
      connections: new Map(),
      conversationHistory: []
    }
    
    // Application status
    this.isInitialized = false
    this.isRunning = false
    this.version = '0.1.0'
    
    // Processing state
    this.isProcessingCommand = false
    this.isGeneratingImage = false
    this.pendingInteraction = null
    
    // Performance metrics
    this.metrics = {
      initTime: 0,
      commandsProcessed: 0,
      roomsCreated: 0,
      objectsCreated: 0
    }
  }

  /**
   * Initialize the Memory Palace core system
   */
  async initialize() {
    if (this.isInitialized) {
      return true
    }

    const startTime = performance.now()
    
    try {
      // Load state using utility
      this.state = await stateUtils.loadState()
      
      // Ensure default state using utility
      this.state = stateUtils.ensureDefaultState(this.state)
      
      this.isInitialized = true
      this.metrics.initTime = performance.now() - startTime
      
      this.emit('core_initialized', { version: this.version, metrics: this.metrics })
      
      return true
      
    } catch (error) {
      console.error('[MemoryPalaceCore] Initialization failed:', error)
      this.emit(EventTypes.ERROR_OCCURRED, { 
        type: 'initialization_error', 
        error: error.message
      })
      return false
    }
  }

  /**
   * Start the Memory Palace system
   */
  async start() {
    if (!this.isInitialized) {
      throw new Error('Core must be initialized before starting')
    }
    
    if (this.isRunning) {
      return true
    }
    
    try {
      // Apply initial configuration
      await this.applyConfiguration()
      
      this.isRunning = true
      this.emit('core_started')
      
      console.log('Memory Palace Core started')
      return true
      
    } catch (error) {
      console.error('Failed to start Memory Palace Core:', error)
      this.emit(EventTypes.ERROR_OCCURRED, { 
        type: 'startup_error', 
        error: error.message 
      })
      return false
    }
  }

  /**
   * Stop the Memory Palace system
   */
  async stop() {
    if (!this.isRunning) {
      return true
    }
    
    try {
      // Save final state using utility
      await stateUtils.saveState(this.state)
      
      this.isRunning = false
      this.emit('core_stopped')
      
      console.log('Memory Palace Core stopped')
      return true
      
    } catch (error) {
      console.error('Failed to stop Memory Palace Core:', error)
      return false
    }
  }

  /**
   * Apply initial configuration and ensure default room exists
   */
  async applyConfiguration() {
    // Use room utility for configuration
    const result = await roomUtils.applyConfiguration(this.state)
    
    if (result) {
      // Emit events for any rooms created
      this.metrics.roomsCreated++
      this.emit(EventTypes.ROOM_CREATED, result)
      
      // Generate room image if needed
      if (!result.imageUrl) {
        this.generateRoomImage(result.id, result.description)
      }
    }
    
    return result
  }

  // === UTILITY WRAPPERS ===

  /**
   * Generate a unique ID
   */
  generateId() {
    return stateUtils.generateId()
  }

  // === ROOM MANAGEMENT ===

  /**
   * Create a new room
   */
  async createRoom(name, description, options = {}) {
    const room = await roomUtils.createRoom(this.state, name, description, options)
    
    this.metrics.roomsCreated++
    this.emit(EventTypes.ROOM_CREATED, room)
    
    // Generate room image if needed
    if (!room.imageUrl && !options.skipImageGeneration) {
      this.generateRoomImage(room.id, description)
    }

    return room
  }

  /**
   * Edit an existing room
   */
  async editRoom(roomId, updates) {
    const updatedRoom = await roomUtils.editRoom(this.state, roomId, updates)

    // Regenerate image if description changed
    const originalRoom = this.state.rooms.get(roomId)
    if (updates.description && originalRoom && updates.description !== originalRoom.description) {
      this.generateRoomImage(roomId, updates.description)
    }

    this.emit(EventTypes.ROOM_UPDATED, updatedRoom)
    return updatedRoom
  }

  /**
   * Delete a room
   */
  async deleteRoom(roomId) {
    const success = await roomUtils.deleteRoom(this.state, roomId)
    
    if (success) {
      this.emit(EventTypes.ROOM_DELETED, { roomId })
    }
    
    return success
  }

  /**
   * Navigate to a room
   */
  async navigateToRoom(roomId) {
    const previousRoomId = this.state.user.currentRoomId
    const targetRoom = await roomUtils.navigateToRoom(this.state, roomId)

    this.emit(EventTypes.ROOM_CHANGED, {
      previousRoomId,
      currentRoomId: roomId,
      currentRoom: targetRoom
    })

    return targetRoom
  }

  /**
   * Generate an image for a room
   */
  async generateRoomImage(roomId, description) {
    if (this.isGeneratingImage) {
      console.warn('Image generation already in progress')
      return false
    }

    this.isGeneratingImage = true

    try {
      const result = await imageGeneration.generateAndUpdateRoomImage(
        this.state, 
        roomId, 
        description,
        (progress) => {
          this.emit('room_image_progress', { roomId, ...progress })
        }
      )

      if (result.success) {
        this.emit('room_image_generated', {
          roomId,
          imageUrl: result.imageUrl,
          description
        })
        return true
      } else {
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
   * Get current room
   */
  getCurrentRoom() {
    return roomUtils.getCurrentRoom(this.state)
  }

  /**
   * Get all rooms
   */
  getAllRooms() {
    return roomUtils.getAllRooms(this.state)
  }

  /**
   * Find room by name
   */
  findRoomByName(name) {
    return roomUtils.findRoomByName(this.state, name)
  }

  // === OBJECT MANAGEMENT ===

  /**
   * Add an object to current room
   */
  async addObject(name, information, position = null) {
    console.log(`[MemoryPalaceCore] Adding object`, { name, information: information?.substring(0, 100) + '...', position })

    const object = await objectUtils.addObject(this.state, name, information, position)
    
    this.metrics.objectsCreated++
    this.emit(EventTypes.OBJECT_CREATED, object)
    
    console.log(`[MemoryPalaceCore] Object added successfully:`, object)
    return object
  }

  /**
   * Update an existing object
   */
  async updateObject(objectId, updates) {
    const updatedObject = await objectUtils.updateObject(this.state, objectId, updates)
    
    this.emit(EventTypes.OBJECT_UPDATED, updatedObject)
    return updatedObject
  }

  /**
   * Delete an object
   */
  async deleteObject(objectId) {
    const object = objectUtils.getObject(this.state, objectId)
    const success = await objectUtils.deleteObject(this.state, objectId)
    
    if (success) {
      this.emit(EventTypes.OBJECT_DELETED, { objectId, object })
    }
    
    return success
  }

  /**
   * Get objects in current room
   */
  getCurrentRoomObjects() {
    return objectUtils.getCurrentRoomObjects(this.state)
  }

  /**
   * Get objects in a specific room
   */
  getRoomObjects(roomId) {
    return objectUtils.getRoomObjects(this.state, roomId)
  }

  /**
   * Find objects by name
   */
  findObjectsByName(name, roomId = null) {
    return objectUtils.findObjectsByName(this.state, name, roomId)
  }

  /**
   * Generate a default position for a new object in a room
   */
  generateDefaultPosition(roomId) {
    return objectUtils.generateDefaultPosition(this.state, roomId)
  }

  /**
   * Convert screen coordinates to world position
   */
  screenToWorldPosition(screenX, screenY, distance = 400) {
    return objectUtils.screenToWorldPosition(screenX, screenY, distance)
  }

  // === INPUT PROCESSING ===

  /**
   * Process user input (simplified command processing)
   */
  async processInput(input, options = {}) {
    if (this.isProcessingCommand) {
      return {
        success: false,
        error: 'Another command is currently being processed'
      }
    }

    this.isProcessingCommand = true
    
    try {
      // Add to conversation history
      this.addToHistory('user', input)
      
      // Simple command parsing
      const command = this.parseCommand(input)
      this.emit(EventTypes.COMMAND_PROCESSED, { input, command })
      
      // Execute command
      const result = await this.executeCommand(command)
      
      // Add response to history
      if (result.response) {
        this.addToHistory('assistant', result.response)
      }
      
      this.isProcessingCommand = false
      this.metrics.commandsProcessed++
      
      return result
      
    } catch (error) {
      this.isProcessingCommand = false
      console.error('Error processing input:', error)
      
      return {
        success: false,
        error: error.message,
        response: 'I apologize, but I encountered an error processing your request. Please try again.'
      }
    }
  }

  /**
   * Handle spatial interaction (clicks, touches)
   */
  async processSpatialInteraction(screenX, screenY, type = 'click') {
    const currentRoomId = this.state.user.currentRoomId
    
    if (!currentRoomId) {
      return {
        success: false,
        error: 'No current room',
        response: 'Please create or navigate to a room first.'
      }
    }
    
    // Convert screen coordinates to world position
    const worldPosition = this.screenToWorldPosition(screenX, screenY)
    
    // Check if clicking near existing objects
    const nearbyObjects = this.getObjectsNearPosition(worldPosition, 100, currentRoomId)
    
    if (nearbyObjects.length > 0) {
      // Clicked on existing object
      const object = nearbyObjects[0]
      return {
        success: true,
        data: { object, interaction: 'object_selected' },
        response: `"${object.name}": ${object.information}`
      }
    } else {
      // Clicked on empty space
      this.pendingInteraction = {
        type: 'spatial_placement',
        position: worldPosition,
        screenX,
        screenY,
        timestamp: Date.now()
      }
      
      return {
        success: true,
        data: { interaction: 'position_selected', position: worldPosition },
        response: 'Position selected. You can now describe what you want to remember at this location.'
      }
    }
  }

  /**
   * Get objects within a certain distance of a position
   */
  getObjectsNearPosition(position, radius, roomId = null) {
    return objectUtils.getObjectsNearPosition(this.state, position, radius, roomId)
  }

  /**
   * Calculate distance between two 3D points
   */
  calculateDistance(pos1, pos2) {
    return objectUtils.calculateDistance(pos1, pos2)
  }

  // === COMMAND PROCESSING ===

  /**
   * Parse command using utility
   */
  parseCommand(input) {
    return commandParser.parseCommand(input)
  }

  /**
   * Execute a parsed command
   */
  async executeCommand(command) {
    const { action, parameters } = command
    
    try {
      switch (action) {
        case 'CREATE_ROOM':
          const room = await this.createRoom(parameters.name, parameters.description)
          return {
            success: true,
            data: { room },
            response: `Created "${room.name}" - ${room.description}. The immersive environment is being generated.`
          }
          
        case 'ADD_OBJECT':
          const object = await this.addObject(parameters.name, parameters.information, parameters.position)
          return {
            success: true,
            data: { object },
            response: `Added "${object.name}" to remember: ${object.information}`
          }
          
        case 'NAVIGATE':
          if (parameters.roomName) {
            const targetRoom = this.findRoomByName(parameters.roomName)
            if (targetRoom) {
              await this.navigateToRoom(targetRoom.id)
              return {
                success: true,
                data: { room: targetRoom },
                response: `Moved to "${targetRoom.name}". ${targetRoom.description}`
              }
            }
          }
          return {
            success: false,
            error: 'Room not found',
            response: 'I couldn\'t find the room you want to navigate to.'
          }
          
        case 'LIST_ROOMS':
          const rooms = this.getAllRooms()
          const roomList = rooms.map(room => `"${room.name}"`).join(', ')
          return {
            success: true,
            data: { rooms },
            response: rooms.length > 0 
              ? `Your memory palace has ${rooms.length} rooms: ${roomList}`
              : 'You haven\'t created any rooms yet.'
          }
          
        case 'LIST_OBJECTS':
          const currentRoom = this.getCurrentRoom()
          if (!currentRoom) {
            return {
              success: true,
              response: 'You are not currently in any room.'
            }
          }
          
          const objects = this.getCurrentRoomObjects()
          const objectList = objects.map(obj => `"${obj.name}"`).join(', ')
          
          return {
            success: true,
            data: { objects },
            response: objects.length > 0
              ? `Objects in "${currentRoom.name}": ${objectList}`
              : `No memory objects in "${currentRoom.name}" yet.`
          }
          
        case 'DESCRIBE':
          const current = this.getCurrentRoom()
          if (!current) {
            return {
              success: true,
              response: 'You are not currently in any room. Create a room to begin building your memory palace.'
            }
          }
          
          const roomObjects = this.getCurrentRoomObjects()
          let description = `You are in "${current.name}". ${current.description}`
          
          if (roomObjects.length > 0) {
            description += `\n\nMemory objects here: ${roomObjects.map(obj => `"${obj.name}"`).join(', ')}.`
          }
          
          return {
            success: true,
            data: { currentRoom: current, objects: roomObjects },
            response: description
          }
          
        case 'CHAT':
        default:
          return {
            success: true,
            response: 'I\'m here to help you build and navigate your memory palace!'
          }
      }
    } catch (error) {
      console.error(`Error executing command ${action}:`, error)
      return {
        success: false,
        error: error.message,
        response: `I encountered an error while ${action.toLowerCase().replace('_', ' ')}: ${error.message}`
      }
    }
  }

  // === HELPER METHODS ===

  /**
   * Extract description from input
   */
  extractDescription(input, type) {
    return commandParser.extractDescription(input, type)
  }

  /**
   * Extract name from input
   */
  extractName(input) {
    return commandParser.extractName(input)
  }

  /**
   * Extract room name from input
   */
  extractRoomName(input) {
    return commandParser.extractRoomName(input)
  }

  /**
   * Add message to conversation history
   */
  addToHistory(role, content) {
    stateUtils.addToHistory(this.state, role, content)
  }

  // === PUBLIC API ===

  /**
   * Get current application state
   */
  getCurrentState() {
    const currentRoom = this.getCurrentRoom()
    const objects = this.getCurrentRoomObjects()
    
    // Get connections for current room and transform them to door objects
    const connections = Array.from(this.state.connections.values())
      .filter(conn => conn.roomId === this.state.user.currentRoomId)
      .map(conn => ({
        ...conn,
        name: conn.description || 'Door',
        information: `Door leading to another room`,
        targetRoomId: conn.targetRoomId, // This is the key property MemoryPalace checks for doors
      }))
    
    // Combine objects and door connections
    const allRoomItems = [...objects, ...connections]
    
    return {
      isInitialized: this.isInitialized,
      isRunning: this.isRunning,
      currentRoom,
      objects: allRoomItems, // Include both objects AND doors
      userState: this.state.user,
      stats: {
        totalRooms: this.state.rooms.size,
        totalObjects: this.state.objects.size,
        totalConnections: this.state.connections.size, // Add this for completeness
        metrics: this.metrics
      }
    }
  }

  /**
   * Get application settings
   */
  getSettings() {
    return this.state.user.settings || {}
  }

  /**
   * Save state using utility
   */
  async saveState() {
    await stateUtils.saveState(this.state)
  }

  /**
   * Update application settings
   */
  async updateSettings(updates) {
    this.state.user.settings = { ...this.state.user.settings, ...updates }
    await this.saveState()
    
    this.emit('settings_updated', this.state.user.settings)
    return this.state.user.settings
  }

  /**
   * Export palace data
   */
  exportPalace() {
    return stateUtils.exportState(this.state)
  }

  /**
   * Import palace data
   */
  async importPalace(data) {
    try {
      this.state = stateUtils.importState(data)
      await this.saveState()
      this.emit('palace_imported', data.metadata)
      return true
    } catch (error) {
      console.error('Failed to import palace:', error)
      this.emit(EventTypes.ERROR_OCCURRED, { 
        type: 'import_error', 
        error: error.message 
      })
      return false
    }
  }

  /**
   * Clear all palace data
   */
  async clearPalace() {
    try {
      await stateUtils.clearState()
      
      // Reset state to defaults
      this.state = stateUtils.ensureDefaultState({
        user: null,
        rooms: new Map(),
        objects: new Map(),
        connections: new Map(),
        conversationHistory: []
      })
      
      this.emit('palace_cleared')
      return true
    } catch (error) {
      console.error('Failed to clear palace:', error)
      return false
    }
  }

  /**
   * Get system performance metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      uptime: this.isRunning ? performance.now() - this.metrics.initTime : 0,
      memoryUsage: {
        rooms: this.state.rooms.size,
        objects: this.state.objects.size,
        connections: this.state.connections.size,
        conversationHistory: this.state.conversationHistory.length
      }
    }
  }

  /**
   * Get system health status
   */
  getHealthStatus() {
    return {
      initialized: this.isInitialized,
      running: this.isRunning,
      hasRooms: this.state.rooms.size > 0,
      hasCurrentRoom: !!this.state.user.currentRoomId,
      lastError: this.lastError || null
    }
  }

  /**
   * Restart the system
   */
  async restart() {
    await this.stop()
    return this.start()
  }

  /**
   * Dispose of the system and clean up resources
   */
  async dispose() {
    try {
      if (this.isRunning) {
        await this.stop()
      }
      
      // Clear all event listeners
      this.removeAllListeners()
      
      // Clear state references
      this.state = null
      
      this.isInitialized = false
      this.isRunning = false
      
      console.log('[MemoryPalaceCore] All resources disposed successfully')
    } catch (error) {
      console.error('[MemoryPalaceCore] Error during disposal:', error)
    }
  }

  // === LEGACY COMPATIBILITY ===
  // These methods provide compatibility with the old manager-based system

  /**
   * Legacy compatibility - provides roomManager-like interface
   */
  get roomManager() {
    return {
      currentRoomId: this.state.user.currentRoomId,
      getCurrentRoom: () => this.getCurrentRoom(),
      getAllRooms: () => this.getAllRooms(),
      createRoom: (name, description, options) => this.createRoom(name, description, options),
      editRoom: (roomId, updates) => this.editRoom(roomId, updates),
      deleteRoom: (roomId) => this.deleteRoom(roomId),
      navigateToRoom: (roomId) => this.navigateToRoom(roomId),
      findRoomByName: (name) => this.findRoomByName(name),
      generateRoomImage: (roomId, description) => this.generateRoomImage(roomId, description)
    }
  }

  /**
   * Legacy compatibility - provides objectManager-like interface
   */
  get objectManager() {
    return {
      addObject: (roomId, name, information, position) => {
        // For legacy compatibility, if roomId is provided, temporarily set it as current
        const originalRoomId = this.state.user.currentRoomId
        if (roomId !== originalRoomId) {
          this.state.user.currentRoomId = roomId
        }
        const result = this.addObject(name, information, position)
        // Restore original room
        if (roomId !== originalRoomId) {
          this.state.user.currentRoomId = originalRoomId
        }
        return result
      },
      updateObject: (objectId, updates) => this.updateObject(objectId, updates),
      deleteObject: (objectId) => this.deleteObject(objectId),
      getRoomObjects: (roomId) => this.getRoomObjects(roomId),
      getObject: (objectId) => this.state.objects.get(objectId) || null,
      findObjectsByName: (name, roomId) => this.findObjectsByName(name, roomId),
      screenToWorldPosition: (screenX, screenY, distance) => this.screenToWorldPosition(screenX, screenY, distance),
      generateDefaultPosition: (roomId) => this.generateDefaultPosition(roomId)
    }
  }

  /**
   * Legacy compatibility - provides stateManager-like interface
   */
  get stateManager() {
    return {
      getUserState: () => this.state.user,
      updateUserState: (updates) => {
        this.state.user = { ...this.state.user, ...updates }
        return this.saveState()
      },
      getRooms: () => this.state.rooms,
      getRoom: (roomId) => this.state.rooms.get(roomId),
      setRoom: (room) => {
        this.state.rooms.set(room.id, room)
        return this.saveState()
      },
      getObjects: () => this.state.objects,
      getRoomObjects: (roomId) => this.getRoomObjects(roomId),
      setObject: (object) => {
        this.state.objects.set(object.id, object)
        return this.saveState()
      },
      deleteObject: (objectId) => this.deleteObject(objectId),
      getConnections: () => this.state.connections,
      setConnection: (connection) => {
        this.state.connections.set(connection.id, connection)
        return this.saveState()
      },
      generateId: () => this.generateId(),
      exportState: () => this.exportPalace().data,
      importState: (data) => this.importPalace({ version: this.version, data }),
      clearState: () => this.clearPalace()
    }
  }
}

export default MemoryPalaceCore
