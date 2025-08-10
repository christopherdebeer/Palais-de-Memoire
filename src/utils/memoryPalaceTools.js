/**
 * Memory Palace Tools Integration
 * Handles tool execution for memory palace operations via Claude
 */

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
    if (!this.roomManager) {
      return `Room creation not available - Memory Palace core not initialized`
    }

    try {
      const room = await this.roomManager.createRoom({
        name,
        description,
        position: { x: 0, y: 0, z: 0 } // Default position
      })
      
      return `Successfully created room "${name}" with description: ${description}`
    } catch (error) {
      return `Failed to create room "${name}": ${error.message}`
    }
  }

  /**
   * Edit current room description
   */
  async editRoom({ description }) {
    if (!this.roomManager) {
      return `Room editing not available - Memory Palace core not initialized`
    }

    try {
      const currentRoom = this.roomManager.getCurrentRoom()
      if (!currentRoom) {
        return `No current room to edit`
      }

      await this.roomManager.updateRoom(currentRoom.id, { description })
      return `Successfully updated room description to: ${description}`
    } catch (error) {
      return `Failed to edit room: ${error.message}`
    }
  }

  /**
   * Navigate to another room
   */
  async goToRoom({ roomName }) {
    if (!this.roomManager) {
      return `Room navigation not available - Memory Palace core not initialized`
    }

    try {
      const room = await this.roomManager.findRoomByName(roomName)
      if (!room) {
        return `Room "${roomName}" not found`
      }

      await this.roomManager.navigateToRoom(room.id)
      return `Successfully navigated to room: ${roomName}`
    } catch (error) {
      return `Failed to navigate to room "${roomName}": ${error.message}`
    }
  }

  /**
   * Add object to current room
   */
  async addObject({ name, info }) {
    if (!this.objectManager || !this.roomManager) {
      return `Object management not available - Memory Palace core not initialized`
    }

    try {
      const currentRoom = this.roomManager.getCurrentRoom()
      if (!currentRoom) {
        return `No current room to add object to`
      }

      await this.objectManager.createObject({
        name,
        info,
        roomId: currentRoom.id,
        position: { x: 0, y: 0, z: 0 } // Default position
      })

      return `Successfully added object "${name}" with info: ${info}`
    } catch (error) {
      return `Failed to add object "${name}": ${error.message}`
    }
  }

  /**
   * Remove object from current room
   */
  async removeObject({ name }) {
    if (!this.objectManager || !this.roomManager) {
      return `Object management not available - Memory Palace core not initialized`
    }

    try {
      const currentRoom = this.roomManager.getCurrentRoom()
      if (!currentRoom) {
        return `No current room to remove object from`
      }

      const object = await this.objectManager.findObjectByName(name, currentRoom.id)
      if (!object) {
        return `Object "${name}" not found in current room`
      }

      await this.objectManager.deleteObject(object.id)
      return `Successfully removed object: ${name}`
    } catch (error) {
      return `Failed to remove object "${name}": ${error.message}`
    }
  }

  /**
   * List all available rooms
   */
  async listRooms() {
    if (!this.roomManager) {
      return `Room listing not available - Memory Palace core not initialized`
    }

    try {
      const rooms = await this.roomManager.getAllRooms()
      
      if (rooms.length === 0) {
        return `No rooms found in your memory palace`
      }

      const roomList = rooms.map(room => 
        `- ${room.name}: ${room.description}`
      ).join('\n')

      return `Available rooms in your memory palace:\n${roomList}`
    } catch (error) {
      return `Failed to list rooms: ${error.message}`
    }
  }

  /**
   * Get information about current room
   */
  async getRoomInfo() {
    if (!this.roomManager || !this.objectManager) {
      return `Room info not available - Memory Palace core not initialized`
    }

    try {
      const currentRoom = this.roomManager.getCurrentRoom()
      if (!currentRoom) {
        return `No current room`
      }

      const objects = await this.objectManager.getObjectsInRoom(currentRoom.id)
      
      let info = `Current room: ${currentRoom.name}\n`
      info += `Description: ${currentRoom.description}\n`
      
      if (objects.length > 0) {
        info += `\nObjects in this room:\n`
        info += objects.map(obj => `- ${obj.name}: ${obj.info}`).join('\n')
      } else {
        info += `\nNo objects in this room`
      }

      return info
    } catch (error) {
      return `Failed to get room info: ${error.message}`
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
      }
    ]
  }
}

export default MemoryPalaceToolManager