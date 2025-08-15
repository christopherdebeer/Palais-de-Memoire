import { EventEmitter } from './EventEmitter.js'
import { EventTypes } from './types.js'
import replicateAPI from '../services/ReplicateAPI.js'

/**
 * MemoryPalaceCore - Simplified central system for the Memory Palace application
 * Consolidates functionality from multiple managers into a single, cohesive system
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
    
    // Application state - simplified in-memory storage
    this.state = {
      user: {
        id: this.generateId(),
        currentRoomId: null,
        roomCounter: 0,
        objectCounter: 0,
        settings: {}
      },
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
      // Load state from localStorage
      await this.loadState()
      
      // Ensure default state
      this.ensureDefaultState()
      
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
      // Save final state
      await this.saveState()
      
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
    // Ensure a default room exists if no rooms are present
    if (this.state.rooms.size === 0) {
      console.log('[MemoryPalaceCore] No rooms found, creating default room...')
      
      const defaultRoom = await this.createRoom(
        'Study',
        'A large study, with a desk with various papers and objects, the floor is covered with a old persian rug, bookshelfs and wooden filing cabnets line to walls, with a fireplace to the right, and a few closed wooden doors leading to ajoining rooms. There is a window, with heavy curtains open, revealing a snowy forrest at night.',
        { imageUrl: '/default_skybox.png' } 
      )
      
      console.log('[MemoryPalaceCore] Default room created:', defaultRoom)
      await this.navigateToRoom(defaultRoom.id)
      
      return defaultRoom
    }
    
    // If rooms exist but no current room is set, navigate to the first room
    if (!this.state.user.currentRoomId && this.state.rooms.size > 0) {
      const firstRoom = Array.from(this.state.rooms.values())[0]
      console.log('[MemoryPalaceCore] No current room set, navigating to first room:', firstRoom.name)
      await this.navigateToRoom(firstRoom.id)
      return firstRoom
    }
    
    return null
  }

  // === STATE MANAGEMENT ===

  /**
   * Load state from localStorage
   */
  async loadState() {
    try {
      const keys = ['user', 'rooms', 'objects', 'connections', 'conversationHistory']
      
      keys.forEach(key => {
        const stored = localStorage.getItem(`palais_${key}`)
        if (stored) {
          try {
            const parsed = JSON.parse(stored)
            if (key === 'rooms' || key === 'objects' || key === 'connections') {
              this.state[key] = new Map(Object.entries(parsed))
            } else {
              this.state[key] = parsed
            }
          } catch (error) {
            console.warn(`Failed to parse stored state for ${key}:`, error)
          }
        }
      })
    } catch (error) {
      console.error('Failed to load state:', error)
    }
  }

  /**
   * Save state to localStorage
   */
  async saveState() {
    try {
      const keys = ['user', 'rooms', 'objects', 'connections', 'conversationHistory']
      
      keys.forEach(key => {
        const value = this.state[key]
        if (value !== undefined) {
          let serializable = value
          if (value instanceof Map) {
            serializable = Object.fromEntries(value)
          }
          localStorage.setItem(`palais_${key}`, JSON.stringify(serializable))
        }
      })
    } catch (error) {
      console.error('Failed to save state:', error)
    }
  }

  /**
   * Ensure default state exists
   */
  ensureDefaultState() {
    if (!this.state.user.id) {
      this.state.user.id = this.generateId()
    }
  }

  /**
   * Generate a unique ID
   */
  generateId() {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  // === ROOM MANAGEMENT ===

  /**
   * Create a new room
   */
  async createRoom(name, description, options = {}) {
    const roomId = this.generateId()
    const roomCounter = this.state.user.roomCounter + 1

    const room = {
      id: roomId,
      userId: this.state.user.id,
      name: name || `Room ${roomCounter}`,
      description,
      imageUrl: options.imageUrl || null,
      roomCounter,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    // Save room
    this.state.rooms.set(roomId, room)
    this.state.user.roomCounter = roomCounter
    this.state.user.currentRoomId = roomId
    
    await this.saveState()
    
    this.metrics.roomsCreated++
    this.emit(EventTypes.ROOM_CREATED, room)
    
    // Generate room image if needed
    if (!room.imageUrl && !options.skipImageGeneration) {
      this.generateRoomImage(roomId, description)
    }

    return room
  }

  /**
   * Edit an existing room
   */
  async editRoom(roomId, updates) {
    const room = this.state.rooms.get(roomId)
    if (!room) {
      throw new Error(`Room ${roomId} not found`)
    }

    const updatedRoom = {
      ...room,
      ...updates,
      updatedAt: new Date().toISOString()
    }

    this.state.rooms.set(roomId, updatedRoom)
    await this.saveState()

    // Regenerate image if description changed
    if (updates.description && updates.description !== room.description) {
      this.generateRoomImage(roomId, updates.description)
    }

    this.emit(EventTypes.ROOM_UPDATED, updatedRoom)
    return updatedRoom
  }

  /**
   * Delete a room
   */
  async deleteRoom(roomId) {
    const room = this.state.rooms.get(roomId)
    if (!room) {
      return false
    }

    // If deleting current room, navigate to another room or clear current
    if (this.state.user.currentRoomId === roomId) {
      const allRooms = this.getAllRooms().filter(r => r.id !== roomId)
      const newCurrentRoomId = allRooms.length > 0 ? allRooms[0].id : null
      await this.navigateToRoom(newCurrentRoomId)
    }

    // Remove room
    this.state.rooms.delete(roomId)
    
    // Remove associated objects
    for (const [objId, obj] of this.state.objects.entries()) {
      if (obj.roomId === roomId) {
        this.state.objects.delete(objId)
      }
    }
    
    // Remove associated connections
    for (const [connId, conn] of this.state.connections.entries()) {
      if (conn.roomId === roomId || conn.targetRoomId === roomId) {
        this.state.connections.delete(connId)
      }
    }
    
    await this.saveState()
    this.emit(EventTypes.ROOM_DELETED, { roomId, room })
    
    return true
  }

  /**
   * Navigate to a room
   */
  async navigateToRoom(roomId) {
    let targetRoom = null
    
    if (roomId) {
      targetRoom = this.state.rooms.get(roomId)
      if (!targetRoom) {
        throw new Error(`Room ${roomId} not found`)
      }
    }

    const previousRoomId = this.state.user.currentRoomId
    this.state.user.currentRoomId = roomId
    
    await this.saveState()

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

    const room = this.state.rooms.get(roomId)
    if (!room) {
      console.error(`Room ${roomId} not found`)
      return false
    }

    this.isGeneratingImage = true

    try {
      if (!replicateAPI.isConfigured()) {
        throw new Error('Replicate API is not configured. Please add your API key in settings.')
      }

      const result = await replicateAPI.generateSkyboxImage(description, room.name)

      // Update room with image URL
      await this.editRoom(roomId, { imageUrl: result.url })
        
      this.emit('room_image_generated', {
        roomId,
        imageUrl: result.url,
        description
      })
        
      return true
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
    if (!this.state.user.currentRoomId) return null
    return this.state.rooms.get(this.state.user.currentRoomId)
  }

  /**
   * Get all rooms
   */
  getAllRooms() {
    return Array.from(this.state.rooms.values()).sort((a, b) => a.roomCounter - b.roomCounter)
  }

  /**
   * Find room by name
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
    
    // Description match
    found = rooms.find(r => r.description.toLowerCase().includes(lowerName))
    return found || null
  }

  // === OBJECT MANAGEMENT ===

  /**
   * Add an object to current room
   */
  async addObject(name, information, position = null) {
    console.log(`[MemoryPalaceCore] Adding object`, { name, information: information?.substring(0, 100) + '...', position })

    const currentRoomId = this.state.user.currentRoomId
    if (!currentRoomId) {
      throw new Error('No current room')
    }
    
    const objectId = this.generateId()
    const objectCounter = this.state.user.objectCounter + 1

    // Use provided position or generate default
    const objectPosition = position || this.generateDefaultPosition(currentRoomId)

    const object = {
      id: objectId,
      roomId: currentRoomId,
      userId: this.state.user.id,
      name: name || `Object ${objectCounter}`,
      information: information || '',
      position: objectPosition,
      objectCounter,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    // Save object
    this.state.objects.set(objectId, object)
    this.state.user.objectCounter = objectCounter
    
    await this.saveState()

    this.metrics.objectsCreated++
    this.emit(EventTypes.OBJECT_CREATED, object)
    
    console.log(`[MemoryPalaceCore] Object added successfully:`, object)
    return object
  }

  /**
   * Update an existing object
   */
  async updateObject(objectId, updates) {
    const object = this.state.objects.get(objectId)
    if (!object) {
      throw new Error(`Object ${objectId} not found`)
    }

    const updatedObject = {
      ...object,
      ...updates,
      updatedAt: new Date().toISOString()
    }

    this.state.objects.set(objectId, updatedObject)
    await this.saveState()
    
    this.emit(EventTypes.OBJECT_UPDATED, updatedObject)
    return updatedObject
  }

  /**
   * Delete an object
   */
  async deleteObject(objectId) {
    const object = this.state.objects.get(objectId)
    if (!object) {
      return false
    }

    this.state.objects.delete(objectId)
    await this.saveState()
    
    this.emit(EventTypes.OBJECT_DELETED, { objectId, object })
    return true
  }

  /**
   * Get objects in current room
   */
  getCurrentRoomObjects() {
    const currentRoomId = this.state.user.currentRoomId
    return currentRoomId ? this.getRoomObjects(currentRoomId) : []
  }

  /**
   * Get objects in a specific room
   */
  getRoomObjects(roomId) {
    return Array.from(this.state.objects.values()).filter(obj => obj.roomId === roomId)
  }

  /**
   * Find objects by name
   */
  findObjectsByName(name, roomId = null) {
    const objects = roomId ? this.getRoomObjects(roomId) : Array.from(this.state.objects.values())
    const lowerName = name.toLowerCase()
    
    return objects.filter(obj => 
      obj.name.toLowerCase().includes(lowerName) ||
      obj.information.toLowerCase().includes(lowerName)
    ).sort((a, b) => {
      const aExact = obj.name.toLowerCase() === lowerName
      const bExact = obj.name.toLowerCase() === lowerName
      if (aExact && !bExact) return -1
      if (!aExact && bExact) return 1
      return a.name.localeCompare(b.name)
    })
  }

  /**
   * Generate a default position for a new object in a room
   */
  generateDefaultPosition(roomId) {
    const existingObjects = this.getRoomObjects(roomId)
    
    // Create a spiral pattern around the room
    const radius = 400
    const angle = (existingObjects.length * 60) * (Math.PI / 180)
    const height = Math.sin(existingObjects.length * 0.3) * 50
    
    return {
      x: Math.cos(angle) * radius,
      y: height,
      z: Math.sin(angle) * radius
    }
  }

  /**
   * Convert screen coordinates to world position
   */
  screenToWorldPosition(screenX, screenY, distance = 400) {
    const phi = (screenX - 0.5) * Math.PI * 2
    const theta = (screenY - 0.5) * Math.PI
    
    return {
      x: distance * Math.sin(theta) * Math.cos(phi),
      y: distance * Math.cos(theta),
      z: distance * Math.sin(theta) * Math.sin(phi)
    }
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
    const objects = roomId ? this.getRoomObjects(roomId) : Array.from(this.state.objects.values())
    
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
   */
  calculateDistance(pos1, pos2) {
    const dx = pos1.x - pos2.x
    const dy = pos1.y - pos2.y
    const dz = pos1.z - pos2.z
    return Math.sqrt(dx * dx + dy * dy + dz * dz)
  }

  // === SIMPLIFIED COMMAND PROCESSING ===

  /**
   * Parse command using simple pattern matching
   */
  parseCommand(input) {
    const lower = input.toLowerCase()
    const words = lower.split(' ')
    
    // CREATE_ROOM patterns
    if (words.some(w => ['create', 'make', 'build'].includes(w)) && 
        words.some(w => ['room', 'space', 'place', 'area'].includes(w))) {
      return {
        action: 'CREATE_ROOM',
        parameters: {
          description: this.extractDescription(input, 'room'),
          name: this.extractName(input) || 'New Room'
        }
      }
    }
    
    // ADD_OBJECT patterns
    if (words.some(w => ['add', 'place', 'put', 'remember'].includes(w)) && 
        words.some(w => ['object', 'item', 'thing', 'memory'].includes(w))) {
      return {
        action: 'ADD_OBJECT',
        parameters: {
          name: this.extractName(input) || 'Memory Object',
          information: this.extractDescription(input, 'object'),
          position: this.pendingInteraction?.position || null
        }
      }
    }
    
    // NAVIGATE patterns
    if (words.some(w => ['go', 'move', 'navigate', 'travel'].includes(w))) {
      return {
        action: 'NAVIGATE',
        parameters: {
          roomName: this.extractRoomName(input)
        }
      }
    }
    
    // LIST patterns
    if (words.some(w => ['list', 'show', 'tell'].includes(w))) {
      if (words.some(w => ['rooms', 'room'].includes(w))) {
        return { action: 'LIST_ROOMS', parameters: {} }
      } else {
        return { action: 'LIST_OBJECTS', parameters: {} }
      }
    }
    
    // DESCRIBE patterns
    if (words.some(w => ['describe', 'what', 'where'].includes(w))) {
      return { action: 'DESCRIBE', parameters: {} }
    }
    
    // Default CHAT response
    return {
      action: 'CHAT',
      parameters: { input }
    }
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
    const patterns = {
      room: /(?:room|space|area)\s+(?:like|with|of|that)\s+(.+?)(?:\.|$)/i,
      object: /(?:object|item|thing)\s+(?:called|named|with|that)\s+(.+?)(?:\.|$)/i
    }
    
    const pattern = patterns[type]
    if (pattern) {
      const match = input.match(pattern)
      if (match) return match[1].trim()
    }
    
    return input.replace(/^(create|add|make|build)\s+/i, '').trim()
  }

  /**
   * Extract name from input
   */
  extractName(input) {
    const quotedMatch = input.match(/"([^"]+)"/i)
    if (quotedMatch) return quotedMatch[1]
    
    const namedMatch = input.match(/(?:called|named)\s+([a-zA-Z\s]+)/i)
    if (namedMatch) return namedMatch[1].trim()
    
    return null
  }

  /**
   * Extract room name from input
   */
  extractRoomName(input) {
    const quotedMatch = input.match(/"([^"]+)"/i)
    if (quotedMatch) return quotedMatch[1]
    
    const toMatch = input.match(/(?:to|into)\s+([a-zA-Z\s]+)/i)
    if (toMatch) return toMatch[1].trim()
    
    return null
  }

  /**
   * Add message to conversation history
   */
  addToHistory(role, content) {
    this.state.conversationHistory.push({
      role,
      content,
      timestamp: new Date().toISOString()
    })
    
    // Trim history if too long
    if (this.state.conversationHistory.length > 10) {
      this.state.conversationHistory = this.state.conversationHistory.slice(-10)
    }
  }

  // === PUBLIC API ===

  /**
   * Get current application state
   */
  getCurrentState() {
    const currentRoom = this.getCurrentRoom()
    
    return {
      isInitialized: this.isInitialized,
      isRunning: this.isRunning,
      currentRoom,
      userState: this.state.user,
      stats: {
        totalRooms: this.state.rooms.size,
        totalObjects: this.state.objects.size,
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
    return {
      version: this.version,
      exportedAt: new Date().toISOString(),
      data: {
        user: this.state.user,
        rooms: Object.fromEntries(this.state.rooms),
        objects: Object.fromEntries(this.state.objects),
        connections: Object.fromEntries(this.state.connections),
        conversationHistory: this.state.conversationHistory
      },
      metadata: {
        stats: this.getCurrentState().stats,
        config: this.config
      }
    }
  }

  /**
   * Import palace data
   */
  async importPalace(data) {
    try {
      if (data.version && data.data) {
        // Clear current state
        this.state.rooms.clear()
        this.state.objects.clear()
        this.state.connections.clear()
        
        // Import data
        this.state.user = data.data.user || this.state.user
        this.state.rooms = new Map(Object.entries(data.data.rooms || {}))
        this.state.objects = new Map(Object.entries(data.data.objects || {}))
        this.state.connections = new Map(Object.entries(data.data.connections || {}))
        this.state.conversationHistory = data.data.conversationHistory || []
        
        await this.saveState()
        this.emit('palace_imported', data.metadata)
        return true
      } else {
        throw new Error('Invalid import data format')
      }
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
      // Clear state
      this.state.rooms.clear()
      this.state.objects.clear()
      this.state.connections.clear()
      this.state.conversationHistory = []
      this.state.user.currentRoomId = null
      this.state.user.roomCounter = 0
      this.state.user.objectCounter = 0
      
      // Clear localStorage
      const keys = ['user', 'rooms', 'objects', 'connections', 'conversationHistory']
      keys.forEach(key => {
        localStorage.removeItem(`palais_${key}`)
      })
      
      await this.saveState()
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
