/**
 * Memory Palace Tools Integration
 * Handles tool execution for memory palace operations via Claude
 */

import replicateAPI from '../services/ReplicateAPI.js'

export class MemoryPalaceToolManager {
  constructor(memoryPalaceCore) {
    this.core = memoryPalaceCore
    this.roomManager = memoryPalaceCore?.roomManager
    this.objectManager = memoryPalaceCore?.objectManager
    
    // Track initialization state
    this.isReady = this.checkIfReady()
    
    console.log(`[MemoryPalaceTools] Tool manager initialized:`, {
      hasCore: !!this.core,
      coreInitialized: this.core?.isInitialized,
      coreRunning: this.core?.isRunning,
      hasRoomManager: !!this.roomManager,
      hasObjectManager: !!this.objectManager,
      isReady: this.isReady
    })
  }
  
  /**
   * Check if the tool manager is ready to use
   */
  checkIfReady() {
    return !!(
      this.core && 
      this.core.isInitialized && 
      this.roomManager && 
      this.objectManager
    )
  }
  
  /**
   * Validate core readiness and throw error if not ready
   */
  validateCore() {
    if (!this.core) {
      throw new Error('Memory Palace core not initialized')
    }
    
    if (!this.core.isInitialized) {
      throw new Error('Memory Palace core not fully initialized')
    }
    
    if (!this.roomManager || !this.objectManager) {
      throw new Error('Memory Palace managers not available')
    }
    
    return true
  }

  /**
   * Execute a memory palace tool call
   */
  async executeTool(toolName, input, toolUseId) {
    console.log(`[MemoryPalaceTools] Executing ${toolName}`, input)

    try {
      // Check if core is ready before executing any tool
      if (!this.isReady && !this.checkIfReady()) {
        return `Tool execution failed: Memory Palace core is not fully initialized. Please wait a moment and try again.`
      }
      switch (toolName) {
        case 'create_room':
          return await this.createRoom(input)
        
        case 'edit_room':
          return await this.editRoom(input)
        
        case 'go_to_room':
          return await this.goToRoom(input)
        
        case 'add_object':
          return await this.addObject(input)
        
        case 'remove_object':
          return await this.removeObject(input)
        
        case 'list_rooms':
          return await this.listRooms()
        
        case 'get_room_info':
          return await this.getRoomInfo()
        
        case 'regenerate_room_image':
          return await this.regenerateRoomImage(input)
        
        case 'add_object_at_position':
          return await this.addObjectAtPosition(input)
        
        case 'create_door_at_position':
          return await this.createDoorAtPosition(input)
        
        default:
          throw new Error(`Unknown tool: ${toolName}`)
      }
    } catch (error) {
      console.error(`[MemoryPalaceTools] Error executing ${toolName}:`, error)
      throw error
    }
  }

  /**
   * Create a new room
   */
  async createRoom({ name, description }) {
    try {
      this.validateCore()
      const room = await this.core.createRoom(name, description)
      // Navigate to the newly created room
      await this.core.navigateToRoom(room.id)
      return `Successfully created room "${name}" with description: ${description}. You are now in the new room.`
    } catch (error) {
      return `Failed to create room "${name}": ${error.message}`
    }
  }

  /**
   * Edit current room description
   */
  async editRoom({ description }) {
    try {
      this.validateCore()
      const currentState = this.core.getCurrentState()
      const currentRoom = currentState.currentRoom
      
      if (!currentRoom) {
        return `No current room to edit`
      }

      await this.roomManager.updateRoom(currentRoom.id, { description })
      return `Successfully updated room "${currentRoom.name}" description to: ${description}`
    } catch (error) {
      return `Failed to edit room: ${error.message}`
    }
  }

  /**
   * Navigate to another room
   */
  async goToRoom({ roomName }) {
    try {
      this.validateCore()
      const rooms = this.core.getAllRooms()
      const room = rooms.find(r => 
        r.name.toLowerCase().includes(roomName.toLowerCase())
      )
      
      if (!room) {
        const availableRooms = rooms.map(r => r.name).join(', ')
        return `Room "${roomName}" not found. Available rooms: ${availableRooms || 'none'}`
      }

      await this.core.navigateToRoom(room.id)
      return `Successfully navigated to room: ${room.name}`
    } catch (error) {
      return `Failed to navigate to room "${roomName}": ${error.message}`
    }
  }

  /**
   * Add object to current room
   */
  async addObject({ name, info, position }) {
    try {
      this.validateCore()
      const currentState = this.core.getCurrentState()
      if (!currentState.currentRoom) {
        return `No current room to add object to. Please create a room first.`
      }

      const object = await this.core.addObject(name, info, position)
      return `Successfully added object "${name}" with info: ${info} to room "${currentState.currentRoom.name}"${position ? ' at the specified location' : ''}`
    } catch (error) {
      return `Failed to add object "${name}": ${error.message}`
    }
  }

  /**
   * Add object at specific position (for creation mode)
   */
  async addObjectAtPosition({ name, info, position }) {
    try {
      this.validateCore()
      const currentState = this.core.getCurrentState()
      if (!currentState.currentRoom) {
        return `No current room to add object to. Please create a room first.`
      }

      if (!position) {
        return `Position is required for spatial object creation`
      }

      const object = await this.core.addObject(name, info, position)
      return `Successfully created object "${name}" at the clicked location with info: ${info}`
    } catch (error) {
      return `Failed to create object "${name}" at position: ${error.message}`
    }
  }

  /**
   * Create door at specific position (for creation mode)
   */
  async createDoorAtPosition({ description, targetRoomName, targetRoomDescription, position }) {
    try {
      this.validateCore()
      const currentState = this.core.getCurrentState()
      if (!currentState.currentRoom) {
        return `No current room to create door from. Please create a room first.`
      }

      if (!position) {
        return `Position is required for spatial door creation`
      }

      // Create a new connected room if target room details provided
      if (targetRoomName && targetRoomDescription) {
        const newRoom = await this.core.createRoom(targetRoomName, targetRoomDescription)
        
        // Create forward connection from current room to new room
        const forwardConnection = {
          id: this.core.stateManager.generateId(),
          roomId: currentState.currentRoom.id,
          userId: this.core.stateManager.getUserState().id,
          targetRoomId: newRoom.id,
          description: description || `Door to ${targetRoomName}`,
          bidirectional: true,
          position,
          createdAt: new Date().toISOString()
        }
        
        await this.core.stateManager.setConnection(forwardConnection)
        
        // Create return door "just behind the user" in the new room
        const returnPosition = {
          x: position.x !== undefined ? -position.x : 0, // opposite direction
          y: position.y !== undefined ? position.y : 1.5, // same height
          z: position.z !== undefined ? -position.z : -2  // behind user position
        }
        
        const returnConnection = {
          id: this.core.stateManager.generateId(),
          roomId: newRoom.id,
          userId: this.core.stateManager.getUserState().id,
          targetRoomId: currentState.currentRoom.id,
          description: `Return to ${currentState.currentRoom.name}`,
          bidirectional: true,
          position: returnPosition,
          createdAt: new Date().toISOString()
        }
        
        await this.core.stateManager.setConnection(returnConnection)
        
        return `Successfully created door "${description || `Door to ${targetRoomName}`}" at the clicked location, leading to the new room "${targetRoomName}". A return door has been automatically placed in the new room.`
      } else {
        return `Target room name and description are required for door creation`
      }
    } catch (error) {
      return `Failed to create door at position: ${error.message}`
    }
  }

  /**
   * Remove object from current room
   */
  async removeObject({ name }) {
    try {
      this.validateCore()
      const currentState = this.core.getCurrentState()
      if (!currentState.currentRoom) {
        return `No current room to remove object from`
      }

      const objects = this.core.getCurrentRoomObjects()
      const object = objects.find(obj => 
        obj.name.toLowerCase().includes(name.toLowerCase())
      )
      
      if (!object) {
        const availableObjects = objects.map(obj => obj.name).join(', ')
        return `Object "${name}" not found in current room. Available objects: ${availableObjects || 'none'}`
      }

      await this.objectManager.deleteObject(object.id)
      return `Successfully removed object: ${object.name}`
    } catch (error) {
      return `Failed to remove object "${name}": ${error.message}`
    }
  }

  /**
   * List all available rooms
   */
  async listRooms() {
    try {
      this.validateCore()
      const rooms = this.core.getAllRooms()
      
      if (rooms.length === 0) {
        return `No rooms found in your memory palace. Say "create a room" to get started!`
      }

      const currentState = this.core.getCurrentState()
      const currentRoomId = currentState.currentRoom?.id

      const roomList = rooms.map(room => {
        const marker = room.id === currentRoomId ? ' (current)' : ''
        return `- ${room.name}${marker}: ${room.description}`
      }).join('\n')

      return `Available rooms in your memory palace (${rooms.length} total):\n${roomList}`
    } catch (error) {
      return `Failed to list rooms: ${error.message}`
    }
  }

  /**
   * Get information about current room
   */
  async getRoomInfo() {
    try {
      this.validateCore()
      const currentState = this.core.getCurrentState()
      const currentRoom = currentState.currentRoom
      
      if (!currentRoom) {
        return `No current room. Say "create a room" to get started!`
      }

      const objects = this.core.getCurrentRoomObjects()
      
      let info = `Current room: ${currentRoom.name}\n`
      info += `Description: ${currentRoom.description}\n`
      
      if (objects.length > 0) {
        info += `\nObjects in this room (${objects.length} total):\n`
        info += objects.map(obj => `- ${obj.name}: ${obj.info || obj.information}`).join('\n')
      } else {
        info += `\nNo objects in this room yet. Say "add an object" to place something here.`
      }

      // Add room statistics
      const stats = currentState.stats
      info += `\n\nMemory Palace Statistics:`
      info += `\n- Total rooms: ${stats.totalRooms}`
      info += `\n- Total objects: ${stats.totalObjects}`

      return info
    } catch (error) {
      return `Failed to get room info: ${error.message}`
    }
  }

  /**
   * Regenerate image for current room using existing description
   */
  async regenerateRoomImage(input = {}) {
    try {
      this.validateCore()
      const currentState = this.core.getCurrentState()
      const currentRoom = currentState.currentRoom
      
      if (!currentRoom) {
        return `No current room to regenerate image for. Please create a room first.`
      }

      console.log(`[MemoryPalaceTools] Regenerating image for room: ${currentRoom.name}`)
      
      // Check if Replicate API is configured
      if (!replicateAPI.isConfigured()) {
        return `Image regeneration not available - Replicate API key not configured. Please configure your Replicate API key in settings to generate room images.`
      }

      // Generate new image using existing room description
      const result = await replicateAPI.generateSkyboxImage(
        currentRoom.description, 
        currentRoom.name
      )

      if (result.success) {
        // Update room with new image URL if the core supports it
        if (this.roomManager && result.url) {
          try {
            await this.roomManager.updateRoom(currentRoom.id, { 
              imageUrl: result.url,
              lastImageGenerated: new Date().toISOString(),
              imagePrompt: result.prompt
            })
            console.log(`[MemoryPalaceTools] Updated room ${currentRoom.name} with new image URL`)
          } catch (updateError) {
            console.warn(`[MemoryPalaceTools] Could not update room with image URL:`, updateError)
          }
        }

        return `Successfully regenerated image for room "${currentRoom.name}"! The new skybox image has been generated using the existing description: "${currentRoom.description}". Image URL: ${result.url}`
      } else {
        return `Failed to regenerate image for room "${currentRoom.name}": ${result.error || 'Unknown error'}`
      }

    } catch (error) {
      console.error(`[MemoryPalaceTools] Error regenerating room image:`, error)
      return `Failed to regenerate room image: ${error.message}`
    }
  }

  /**
   * Get tool definitions for Claude
   */
  static getToolDefinitions() {
    return [
      {
        name: 'create_room',
        description: 'Create a new memory room in the palace',
        input_schema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Name of the new room'
            },
            description: {
              type: 'string', 
              description: 'Detailed description of the room for image generation and memory association'
            }
          },
          required: ['name', 'description']
        }
      },
      {
        name: 'edit_room',
        description: 'Modify the description of the current room',
        input_schema: {
          type: 'object',
          properties: {
            description: {
              type: 'string',
              description: 'Updated detailed room description'
            }
          },
          required: ['description']
        }
      },
      {
        name: 'go_to_room',
        description: 'Navigate to another room in the memory palace',
        input_schema: {
          type: 'object',
          properties: {
            roomName: {
              type: 'string',
              description: 'Name of the room to navigate to'
            }
          },
          required: ['roomName']
        }
      },
      {
        name: 'add_object',
        description: 'Add a memory object to the current room',
        input_schema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Name of the memory object'
            },
            info: {
              type: 'string',
              description: 'Information or memory to associate with this object'
            }
          },
          required: ['name', 'info']
        }
      },
      {
        name: 'remove_object',
        description: 'Remove an object from the current room',
        input_schema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Name of the object to remove'
            }
          },
          required: ['name']
        }
      },
      {
        name: 'list_rooms',
        description: 'List all available rooms in the memory palace',
        input_schema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'get_room_info',
        description: 'Get detailed information about the current room and its objects',
        input_schema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'regenerate_room_image',
        description: 'Regenerate the skybox image for the current room using its existing description with a new random seed',
        input_schema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'add_object_at_position',
        description: 'Add a memory object at a specific spatial position (used when user double-clicks skybox)',
        input_schema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Name of the memory object'
            },
            info: {
              type: 'string',
              description: 'Information or memory to associate with this object'
            },
            position: {
              type: 'object',
              description: 'Spatial position coordinates',
              properties: {
                x: { type: 'number' },
                y: { type: 'number' },
                z: { type: 'number' }
              },
              required: ['x', 'y', 'z']
            }
          },
          required: ['name', 'info', 'position']
        }
      },
      {
        name: 'create_door_at_position',
        description: 'Create a door/connection at a specific spatial position (used when user double-clicks skybox)',
        input_schema: {
          type: 'object',
          properties: {
            description: {
              type: 'string',
              description: 'Description of the door/entrance'
            },
            targetRoomName: {
              type: 'string',
              description: 'Name of the new room to create and connect to'
            },
            targetRoomDescription: {
              type: 'string',
              description: 'Description of the new room to create'
            },
            position: {
              type: 'object',
              description: 'Spatial position coordinates',
              properties: {
                x: { type: 'number' },
                y: { type: 'number' },
                z: { type: 'number' }
              },
              required: ['x', 'y', 'z']
            }
          },
          required: ['description', 'targetRoomName', 'targetRoomDescription', 'position']
        }
      }
    ]
  }
}

export default MemoryPalaceToolManager
