import { EventEmitter } from './EventEmitter.js'
import { EventTypes, CommandActions } from './types.js'

/**
 * Interaction Controller - Handles user interactions and command processing
 * Central hub for processing voice, text, and spatial interactions
 */
export class InteractionController extends EventEmitter {
  constructor(stateManager, apiManager, roomManager, objectManager) {
    super()
    this.stateManager = stateManager
    this.apiManager = apiManager
    this.roomManager = roomManager
    this.objectManager = objectManager
    
    // Conversation context
    this.conversationHistory = []
    this.maxHistoryLength = 10
    
    // Command processing state
    this.isProcessingCommand = false
    this.pendingInteraction = null
  }

  /**
   * Initialize the interaction controller
   */
  async initialize() {
    // Load conversation history from state
    const savedHistory = this.stateManager.get('conversation_context', [])
    this.conversationHistory = savedHistory.slice(-this.maxHistoryLength)
  }

  /**
   * Process a user input (voice or text)
   * @param {string} input - User input text
   * @param {Object} options - Processing options
   * @returns {Promise<Object>} Processing result
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
      
      // Get current context
      const context = this.getCurrentContext()
      
      // Parse command using AI
      const parseResult = await this.apiManager.parseCommand(input, context)
      
      if (!parseResult.success) {
        this.isProcessingCommand = false
        return parseResult
      }
      
      const command = parseResult.data
      this.emit(EventTypes.COMMAND_PROCESSED, { input, command })
      
      // Execute command
      const result = await this.executeCommand(command)
      
      // Add AI response to history
      if (result.response) {
        this.addToHistory('assistant', result.response)
      }
      
      this.isProcessingCommand = false
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
   * Execute a parsed command
   * @param {Object} command - Parsed command object
   * @returns {Promise<Object>} Execution result
   */
  async executeCommand(command) {
    const { action, parameters } = command
    
    try {
      switch (action) {
        case CommandActions.CREATE_ROOM:
          return await this.handleCreateRoom(command)
          
        case CommandActions.EDIT_ROOM:
          return await this.handleEditRoom(command)
          
        case CommandActions.ADD_OBJECT:
          return await this.handleAddObject(command)
          
        case CommandActions.CREATE_DOOR:
          return await this.handleCreateDoor(command)
          
        case CommandActions.NAVIGATE:
          return await this.handleNavigate(command)
          
        case CommandActions.DESCRIBE:
          return await this.handleDescribe(command)
          
        case CommandActions.LIST:
          return await this.handleList(command)
          
        case CommandActions.DELETE_OBJECT:
          return await this.handleDeleteObject(command)
          
        case CommandActions.DELETE_ROOM:
          return await this.handleDeleteRoom(command)
          
        case CommandActions.CHAT:
        default:
          return await this.handleChat(command)
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

  /**
   * Handle room creation
   */
  async handleCreateRoom(command) {
    const { description, name } = command.parameters
    
    const room = await this.roomManager.createRoom(name, description)
    
    return {
      success: true,
      data: { room },
      response: command.response || `Created "${room.name}" - ${room.description}. The immersive environment is being generated.`
    }
  }

  /**
   * Handle room editing
   */
  async handleEditRoom(command) {
    const { roomId, ...updates } = command.parameters
    const targetRoomId = roomId || this.roomManager.currentRoomId
    
    if (!targetRoomId) {
      return {
        success: false,
        error: 'No room specified and no current room',
        response: 'Please specify which room you want to edit or create a room first.'
      }
    }
    
    const room = await this.roomManager.editRoom(targetRoomId, updates)
    
    return {
      success: true,
      data: { room },
      response: command.response || `Updated the room successfully.`
    }
  }

  /**
   * Handle object addition
   */
  async handleAddObject(command) {
    const { name, information, position } = command.parameters
    const currentRoomId = this.roomManager.currentRoomId
    
    if (!currentRoomId) {
      return {
        success: false,
        error: 'No current room',
        response: 'Please create or navigate to a room first before adding objects.'
      }
    }
    
    const object = await this.objectManager.addObject(
      currentRoomId,
      name,
      information,
      position
    )
    
    return {
      success: true,
      data: { object },
      response: command.response || `Added "${object.name}" to remember: ${object.information}`
    }
  }

  /**
   * Handle door/connection creation
   */
  async handleCreateDoor(command) {
    const { description, target, targetRoomName, targetRoomDescription } = command.parameters
    const currentRoomId = this.roomManager.currentRoomId
    
    if (!currentRoomId) {
      return {
        success: false,
        error: 'No current room',
        response: 'Please create or navigate to a room first before adding doors.'
      }
    }
    
    let targetRoomId = target
    
    // If no target specified, create a new room
    if (!targetRoomId && (targetRoomName || targetRoomDescription)) {
      const newRoom = await this.roomManager.createRoom(
        targetRoomName || 'Connected Room',
        targetRoomDescription || description || 'A connected space'
      )
      targetRoomId = newRoom.id
    }
    
    if (!targetRoomId) {
      return {
        success: false,
        error: 'No target room specified',
        response: 'Please specify which room to connect to or provide a description for a new room.'
      }
    }
    
    // Create connection
    const connectionId = this.stateManager.generateId()
    const position = command.parameters.position || { x: 0, y: 0, z: -450 }
    
    const connection = {
      id: connectionId,
      roomId: currentRoomId,
      userId: this.stateManager.getUserState().id,
      targetRoomId,
      description: description || 'Door',
      bidirectional: true,
      position,
      createdAt: new Date().toISOString()
    }
    
    await this.stateManager.setConnection(connection)
    
    return {
      success: true,
      data: { connection },
      response: command.response || `Created a ${description || 'door'} connecting to the target room.`
    }
  }

  /**
   * Handle navigation
   */
  async handleNavigate(command) {
    const { target, direction, roomName } = command.parameters
    
    let targetRoomId = target
    
    // If no specific target, try to find room by name
    if (!targetRoomId && roomName) {
      const room = this.roomManager.findRoomByName(roomName)
      if (room) {
        targetRoomId = room.id
      }
    }
    
    // If still no target, check connections
    if (!targetRoomId && direction) {
      const connections = this.roomManager.getConnectedRooms(this.roomManager.currentRoomId)
      if (connections.length > 0) {
        // Simple direction matching - could be enhanced
        targetRoomId = connections[0].id
      }
    }
    
    if (!targetRoomId) {
      return {
        success: false,
        error: 'No target room found',
        response: 'I couldn\'t find the room you want to navigate to. Could you be more specific?'
      }
    }
    
    const room = await this.roomManager.navigateToRoom(targetRoomId)
    
    return {
      success: true,
      data: { room },
      response: command.response || `Moved to "${room.name}". ${room.description}`
    }
  }

  /**
   * Handle describe commands
   */
  async handleDescribe(command) {
    const currentRoom = this.roomManager.getCurrentRoom()
    
    if (!currentRoom) {
      return {
        success: true,
        response: 'You are not currently in any room. Create a room to begin building your memory palace.'
      }
    }
    
    const objects = this.objectManager.getRoomObjects(currentRoom.id)
    const connections = this.roomManager.getConnectedRooms(currentRoom.id)
    
    let description = `You are in "${currentRoom.name}". ${currentRoom.description}`
    
    if (objects.length > 0) {
      description += `\n\nMemory objects here: ${objects.map(obj => `"${obj.name}"`).join(', ')}.`
    }
    
    if (connections.length > 0) {
      description += `\n\nConnections: ${connections.map(conn => `${conn.connection.description} (leads to "${conn.name}")`).join(', ')}.`
    }
    
    return {
      success: true,
      data: { currentRoom, objects, connections },
      response: command.response || description
    }
  }

  /**
   * Handle list commands
   */
  async handleList(command) {
    const { type } = command.parameters
    
    if (type === 'rooms') {
      const rooms = this.roomManager.getAllRooms()
      const roomList = rooms.map(room => `"${room.name}"`).join(', ')
      return {
        success: true,
        data: { rooms },
        response: rooms.length > 0 
          ? `Your memory palace has ${rooms.length} rooms: ${roomList}`
          : 'You haven\'t created any rooms yet.'
      }
    } else {
      // List objects in current room
      const currentRoom = this.roomManager.getCurrentRoom()
      if (!currentRoom) {
        return {
          success: true,
          response: 'You are not currently in any room.'
        }
      }
      
      const objects = this.objectManager.getRoomObjects(currentRoom.id)
      const objectList = objects.map(obj => `"${obj.name}"`).join(', ')
      
      return {
        success: true,
        data: { objects },
        response: objects.length > 0
          ? `Objects in "${currentRoom.name}": ${objectList}`
          : `No memory objects in "${currentRoom.name}" yet.`
      }
    }
  }

  /**
   * Handle object deletion
   */
  async handleDeleteObject(command) {
    const { objectId, objectName } = command.parameters
    
    let targetObjectId = objectId
    
    // Find object by name if ID not provided
    if (!targetObjectId && objectName) {
      const currentRoomId = this.roomManager.currentRoomId
      if (currentRoomId) {
        const objects = this.objectManager.findObjectsByName(objectName, currentRoomId)
        if (objects.length > 0) {
          targetObjectId = objects[0].id
        }
      }
    }
    
    if (!targetObjectId) {
      return {
        success: false,
        error: 'Object not found',
        response: 'I couldn\'t find the object you want to delete.'
      }
    }
    
    const success = await this.objectManager.deleteObject(targetObjectId)
    
    return {
      success,
      response: success 
        ? command.response || 'Object deleted successfully.'
        : 'Failed to delete object.'
    }
  }

  /**
   * Handle room deletion
   */
  async handleDeleteRoom(command) {
    const { roomId, roomName } = command.parameters
    
    let targetRoomId = roomId
    
    // Find room by name if ID not provided
    if (!targetRoomId && roomName) {
      const room = this.roomManager.findRoomByName(roomName)
      if (room) {
        targetRoomId = room.id
      }
    }
    
    if (!targetRoomId) {
      return {
        success: false,
        error: 'Room not found',
        response: 'I couldn\'t find the room you want to delete.'
      }
    }
    
    const success = await this.roomManager.deleteRoom(targetRoomId)
    
    return {
      success,
      response: success
        ? command.response || 'Room deleted successfully.'
        : 'Failed to delete room.'
    }
  }

  /**
   * Handle general chat
   */
  async handleChat(command) {
    // Generate contextual response
    const context = this.getCurrentContext()
    const prompt = `
You are a helpful memory palace assistant. Respond conversationally to the user's message.
Current context: ${JSON.stringify(context)}
Recent conversation: ${this.conversationHistory.slice(-3).map(entry => `${entry.role}: ${entry.content}`).join('\n')}
User message: "${command.originalText}"
`
    
    const result = await this.apiManager.generateText(prompt, { temperature: 0.8 })
    
    return {
      success: true,
      response: result.success 
        ? result.data 
        : command.response || 'I\'m here to help you build and navigate your memory palace!'
    }
  }

  /**
   * Handle spatial interactions (clicks, touches)
   * @param {number} screenX - Screen X coordinate (0-1)
   * @param {number} screenY - Screen Y coordinate (0-1)
   * @param {string} interactionType - Type of interaction ('click', 'touch', etc.)
   * @returns {Promise<Object>} Interaction result
   */
  async processSpatialInteraction(screenX, screenY, interactionType = 'click') {
    const currentRoomId = this.roomManager.currentRoomId
    
    if (!currentRoomId) {
      return {
        success: false,
        error: 'No current room',
        response: 'Please create or navigate to a room first.'
      }
    }
    
    // Convert screen coordinates to world position
    const worldPosition = this.objectManager.screenToWorldPosition(screenX, screenY)
    
    // Check if clicking near existing objects
    const nearbyObjects = this.objectManager.getObjectsNearPosition(worldPosition, 100, currentRoomId)
    
    if (nearbyObjects.length > 0) {
      // Clicked on existing object - describe it
      const object = nearbyObjects[0]
      return {
        success: true,
        data: { object, interaction: 'object_selected' },
        response: `"${object.name}": ${object.information}`
      }
    } else {
      // Clicked on empty space - store position for potential object creation
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
   * Get current interaction context
   * @returns {Object} Context object for AI processing
   */
  getCurrentContext() {
    const currentRoom = this.roomManager.getCurrentRoom()
    const context = {
      timestamp: new Date().toISOString(),
      currentRoom: currentRoom ? {
        id: currentRoom.id,
        name: currentRoom.name,
        description: currentRoom.description
      } : null,
      conversationHistory: this.conversationHistory.slice(-5),
      pendingInteraction: this.pendingInteraction
    }
    
    if (currentRoom) {
      context.objects = this.objectManager.getRoomObjects(currentRoom.id).map(obj => ({
        id: obj.id,
        name: obj.name,
        information: obj.information
      }))
      
      context.connections = this.roomManager.getConnectedRooms(currentRoom.id).map(conn => ({
        id: conn.id,
        name: conn.name,
        description: conn.connection.description
      }))
    }
    
    return context
  }

  /**
   * Add message to conversation history
   * @param {string} role - 'user' or 'assistant'
   * @param {string} content - Message content
   */
  addToHistory(role, content) {
    this.conversationHistory.push({
      role,
      content,
      timestamp: new Date().toISOString()
    })
    
    // Trim history if too long
    if (this.conversationHistory.length > this.maxHistoryLength) {
      this.conversationHistory = this.conversationHistory.slice(-this.maxHistoryLength)
    }
    
    // Save to state
    this.stateManager.set('conversation_context', this.conversationHistory, false)
  }

  /**
   * Clear conversation history
   */
  clearHistory() {
    this.conversationHistory = []
    this.stateManager.set('conversation_context', [], false)
  }

  /**
   * Get pending spatial interaction
   * @returns {Object|null} Pending interaction data
   */
  getPendingInteraction() {
    return this.pendingInteraction
  }

  /**
   * Clear pending interaction
   */
  clearPendingInteraction() {
    this.pendingInteraction = null
  }

  /**
   * Set up autopilot mode for autonomous palace construction
   * @param {boolean} enabled - Enable/disable autopilot
   */
  setAutopilotMode(enabled) {
    this.autopilotEnabled = enabled
    
    if (enabled) {
      // Start autopilot loop
      this.startAutopilot()
    } else {
      // Stop autopilot
      this.stopAutopilot()
    }
  }

  /**
   * Start autopilot mode
   */
  async startAutopilot() {
    if (this.autopilotInterval) return
    
    this.autopilotInterval = setInterval(async () => {
      try {
        await this.executeAutopilotAction()
      } catch (error) {
        console.error('Autopilot error:', error)
      }
    }, 5000) // Execute every 5 seconds
    
    this.emit('autopilot_started')
  }

  /**
   * Stop autopilot mode
   */
  stopAutopilot() {
    if (this.autopilotInterval) {
      clearInterval(this.autopilotInterval)
      this.autopilotInterval = null
    }
    
    this.emit('autopilot_stopped')
  }

  /**
   * Execute a single autopilot action
   */
  async executeAutopilotAction() {
    const rooms = this.roomManager.getAllRooms()
    const currentRoom = this.roomManager.getCurrentRoom()
    
    if (!currentRoom && rooms.length === 0) {
      // Create first room
      await this.processInput('Create a cozy starting room for my memory palace')
    } else if (currentRoom) {
      const objects = this.objectManager.getRoomObjects(currentRoom.id)
      const connections = this.roomManager.getConnectedRooms(currentRoom.id)
      
      if (objects.length < 3) {
        // Add objects to sparse rooms
        await this.processInput(`Add an interesting memory object to this room`)
      } else if (connections.length === 0) {
        // Add connections to isolated rooms
        await this.processInput(`Create a door leading to a new themed room`)
      } else if (Math.random() < 0.3) {
        // Sometimes navigate to connected rooms
        const randomConnection = connections[Math.floor(Math.random() * connections.length)]
        await this.processInput(`Go to ${randomConnection.name}`)
      }
    }
  }
}