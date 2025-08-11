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
  }

  /**
   * Execute a memory palace tool call
   */
  async executeTool(toolName, input, toolUseId) {
    console.log(`[MemoryPalaceTools] Executing ${toolName}`, input)

    try {
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
    if (!this.core) {
      return `Room creation not available - Memory Palace core not initialized`
    }

    try {
      const room = await this.core.createRoom(name, description)
      return `Successfully created room "${name}" with description: ${description}. Room ID: ${room.id}`
    } catch (error) {
      return `Failed to create room "${name}": ${error.message}`
    }
  }

  /**
   * Edit current room description
   */
  async editRoom({ description }) {
    if (!this.core || !this.roomManager) {
      return `Room editing not available - Memory Palace core not initialized`
    }

    try {
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
    if (!this.core) {
      return `Room navigation not available - Memory Palace core not initialized`
    }

    try {
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
    if (!this.core) {
      return `Object management not available - Memory Palace core not initialized`
    }

    try {
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
    if (!this.core) {
      return `Object management not available - Memory Palace core not initialized`
    }

    try {
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
    if (!this.core) {
      return `Door creation not available - Memory Palace core not initialized`
    }

    try {
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
        
        // Create bidirectional connection with spatial positioning
        // This would need to be implemented in the core to handle spatial door creation
        // For now, we'll create the object as a door marker
        const doorObject = await this.core.addObject(
          description || `Door to ${targetRoomName}`,
          `Door leading to ${targetRoomName}: ${targetRoomDescription}`,
          position
        )
        
        return `Successfully created door "${description || `Door to ${targetRoomName}`}" at the clicked location, leading to the new room "${targetRoomName}"`
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
    if (!this.core || !this.objectManager) {
      return `Object management not available - Memory Palace core not initialized`
    }

    try {
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
    if (!this.core) {
      return `Room listing not available - Memory Palace core not initialized`
    }

    try {
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
    if (!this.core) {
      return `Room info not available - Memory Palace core not initialized`
    }

    try {
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
    if (!this.core) {
      return `Image regeneration not available - Memory Palace core not initialized`
    }

    try {
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
