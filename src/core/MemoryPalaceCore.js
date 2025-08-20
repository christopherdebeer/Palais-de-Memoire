import { EventEmitter } from './EventEmitter.js'
import { EventTypes, ObjectType } from '../types/index.ts'
import * as stateUtils from '../utils/stateUtils.js'
import * as roomUtils from '../utils/roomUtils.js'
import * as objectUtils from '../utils/objectUtils.ts'
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
      
      // Generate room image if needed - AWAIT completion
      if (!result.imageUrl) {
        console.log('[MemoryPalaceCore] Starting default room image generation and awaiting completion...')
        await this.generateRoomImage(result.id, result.description)
        console.log('[MemoryPalaceCore] Default room image generation completed')
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
    
    // Generate room image if needed - AWAIT completion before returning
    if (!room.imageUrl && !options.skipImageGeneration) {
      console.log('[MemoryPalaceCore] Starting room image generation and awaiting completion...')
      const imageUrl = await this.generateRoomImage(room.id, description);
      room.imageUrl = imageUrl || room.imageUrl;
      console.log('[MemoryPalaceCore] Room image generation completed')
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
    
    // Emit loading state start
    this.emit('room_image_generation_started', { roomId, description })

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
        return result.imageUrl
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
      
      // Emit loading state end
      this.emit('room_image_generation_completed', { roomId })
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
   * Create object with comprehensive parameters
   */
  async createObject(params) {
    console.log(`[MemoryPalaceCore] Creating ${params.type}`, { 
      name: params.name, 
      type: params.type,
      information: params.information?.substring(0, 100) + '...',
      position: params.position 
    })

    const object = await objectUtils.createObject(this.state, params)
    
    this.metrics.objectsCreated++
    this.emit(EventTypes.OBJECT_CREATED, object)
    
    console.log(`[MemoryPalaceCore] ${params.type} created successfully:`, object)
    return object
  }

  /**
   * Add an object to current room (simplified interface)
   */
  async addObject(name, information, position = null, type = ObjectType.OBJECT) {
    console.log(`[MemoryPalaceCore] Adding ${type}`, { name, information: information?.substring(0, 100) + '...', position, type })

    const object = await objectUtils.addObject(this.state, name, information, position, type)
    
    this.metrics.objectsCreated++
    this.emit(EventTypes.OBJECT_CREATED, object)
    
    console.log(`[MemoryPalaceCore] ${type} added successfully:`, object)
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
   * Convert screen coordinates to world position on sphere surface using ray casting
   * @param {number} screenX - Screen X coordinate (0-1, normalized)
   * @param {number} screenY - Screen Y coordinate (0-1, normalized)
   * @param {number} [sphereRadius] - Sphere radius (default 500 to match skybox)
   * @param {Object} [camera] - THREE.js camera for proper ray casting
   */
  screenToWorldPosition(screenX, screenY, sphereRadius = 500, camera = null) {
    return objectUtils.screenToWorldPosition(screenX, screenY, sphereRadius, camera)
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
    
    return {
      isInitialized: this.isInitialized,
      isRunning: this.isRunning,
      isGeneratingImage: this.isGeneratingImage, // Add loading state
      currentRoom,
      objects, // Include both objects AND doors
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

}

export default MemoryPalaceCore
