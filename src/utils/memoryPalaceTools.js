/**
 * Memory Palace Tools - Simplified Integration
 * Direct interface to the consolidated MemoryPalaceCore system
 */

import replicateAPI from '../services/ReplicateAPI.js'

export class MemoryPalaceToolManager {
  constructor(memoryPalaceCore, voiceInterface = null) {
    this.core = memoryPalaceCore
    this.voiceInterface = voiceInterface
    
    console.log(`[MemoryPalaceTools] Tool manager initialized:`, {
      hasCore: !!this.core,
      coreInitialized: this.core?.isInitialized,
      coreRunning: this.core?.isRunning
    })
  }

  /**
   * Execute a memory palace tool call
   */
  async executeTool(toolName, input, toolUseId) {
    console.log(`[MemoryPalaceTools] Executing ${toolName}`, input)

    try {
      if (!this.core?.isInitialized) {
        return `Tool execution failed: Memory Palace core is not fully initialized. Please wait a moment and try again.`
      }

      switch (toolName) {
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
        case 'create_door':
          return await this.createDoor(input)
        case 'narrate':
          return await this.narrateText(input)
        default:
          throw new Error(`Unknown tool: ${toolName}`)
      }
    } catch (error) {
      console.error(`[MemoryPalaceTools] Error executing ${toolName}:`, error)
      throw error
    }
  }

  /**
   * Create a door (unified tool for room/door creation)
   * Handles both object conversion and new door creation
   * Automatically creates target room and bidirectional connections
   */
  async createDoor({ description, targetRoomName, targetRoomDescription, position, dimensions, objectId }) {
    try {
      const currentRoom = this.core.getCurrentRoom()
      if (!currentRoom) {
        return `No current room to create door from. Please create a room first.`
      }

      if (!targetRoomName || !targetRoomDescription) {
        return `Target room name and description are required for door creation`
      }

      let doorPosition = position
      let doorDescription = description || `Door to ${targetRoomName}`
      
      // Log dimension information if provided
      if (dimensions) {
        console.log(`[createDoor] Creating door with dimensions:`, dimensions)
        doorDescription += ` (${dimensions.width}×${dimensions.height} world units)`
      }
      
      // Handle object conversion scenario
      if (objectId) {
        const existingObject = this.core.state.objects.get(objectId)
        if (!existingObject) {
          return `Object with ID "${objectId}" not found`
        }
        
        if (existingObject.roomId !== currentRoom.id) {
          return `Cannot convert object from different room`
        }
        
        // Use existing object's position and remove it
        doorPosition = existingObject.position
        doorDescription = description || `${existingObject.name} (converted to door)`
        
        await this.core.deleteObject(objectId)
      }
      
      // Validate position for new door creation
      if (!doorPosition) {
        return `Position is required for door creation (either through objectId or position parameter)`
      }

      // Create the target room
      const newRoom = await this.core.createRoom(targetRoomName, targetRoomDescription)
      
      // Create forward connection from current room to new room
      const forwardConnection = {
        id: this.core.generateId(),
        roomId: currentRoom.id,
        userId: this.core.state.user.id,
        targetRoomId: newRoom.id,
        description: doorDescription,
        bidirectional: true,
        position: doorPosition,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      
      this.core.state.connections.set(forwardConnection.id, forwardConnection)
      
      // Create return door in the new room - place at user's "feet" on sphere surface
      // When entering a new room, the user should see the return door at ground level, facing them
      // Calculate position as normalized vector on sphere surface (radius 500)
      const direction = { x: 1, y: -0.9, z: 0 } // Forward and down (ground level)
      const magnitude = Math.sqrt(direction.x * direction.x + direction.y * direction.y + direction.z * direction.z)
      const sphereRadius = 500
      
      const returnPosition = {
        x: (direction.x / magnitude) * sphereRadius,  // Normalized to sphere surface
        y: (direction.y / magnitude) * sphereRadius,  // Ground level relative to sphere
        z: (direction.z / magnitude) * sphereRadius   // Center horizontally
      }
      
      const returnConnection = {
        id: this.core.generateId(),
        roomId: newRoom.id,
        userId: this.core.state.user.id,
        targetRoomId: currentRoom.id,
        description: `Return to ${currentRoom.name}`,
        bidirectional: true,
        position: returnPosition,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      
      this.core.state.connections.set(returnConnection.id, returnConnection)
      await this.core.saveState()
      
      const conversionNote = objectId ? ' (converted from existing object)' : ''
      return `Successfully created door "${doorDescription}"${conversionNote} leading to the new room "${targetRoomName}". A return door has been automatically placed in the new room.`
      
    } catch (error) {
      return `Failed to create door: ${error.message}`
    }
  }

  /**
   * Edit current room description
   */
  async editRoom({ description }) {
    try {
      const currentRoom = this.core.getCurrentRoom()
      
      if (!currentRoom) {
        return `No current room to edit`
      }

      await this.core.editRoom(currentRoom.id, { description })
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
      const room = this.core.findRoomByName(roomName)
      
      if (!room) {
        const availableRooms = this.core.getAllRooms().map(r => r.name).join(', ')
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
      const currentRoom = this.core.getCurrentRoom()
      if (!currentRoom) {
        return `No current room to add object to. Please create a room first.`
      }

      const object = await this.core.addObject(name, info, position)
      return `Successfully added object "${name}" with info: ${info} to room "${currentRoom.name}"${position ? ' at the specified location' : ''}`
    } catch (error) {
      return `Failed to add object "${name}": ${error.message}`
    }
  }

  /**
   * Add object at specific position (for creation mode)
   */
  async addObjectAtPosition({ name, info, position, dimensions }) {
    try {
      const currentRoom = this.core.getCurrentRoom()
      if (!currentRoom) {
        return `No current room to add object to. Please create a room first.`
      }

      if (!position) {
        return `Position is required for spatial object creation`
      }

      // Log dimension information if provided
      if (dimensions) {
        console.log(`[addObjectAtPosition] Creating object with dimensions:`, dimensions)
        info += ` (Size: ${dimensions.width}×${dimensions.height} world units)`
      }
      
      const object = await this.core.addObject(name, info, position)
      return `Successfully created object "${name}" at the clicked location with info: ${info}`
    } catch (error) {
      return `Failed to create object "${name}" at position: ${error.message}`
    }
  }


  /**
   * Remove object from current room
   */
  async removeObject({ name }) {
    try {
      const currentRoom = this.core.getCurrentRoom()
      if (!currentRoom) {
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

      await this.core.deleteObject(object.id)
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
      const rooms = this.core.getAllRooms()
      
      if (rooms.length === 0) {
        return `No rooms found in your memory palace. Say "create a room" to get started!`
      }

      const currentRoom = this.core.getCurrentRoom()
      const currentRoomId = currentRoom?.id

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
      const currentRoom = this.core.getCurrentRoom()
      
      if (!currentRoom) {
        return `No current room. Say "create a room" to get started!`
      }

      const objects = this.core.getCurrentRoomObjects()
      const stats = this.core.getCurrentState().stats
      
      let info = `Current room: ${currentRoom.name}\n`
      info += `Description: ${currentRoom.description}\n`
      
      if (objects.length > 0) {
        info += `\nObjects in this room (${objects.length} total):\n`
        info += objects.map(obj => `- ${obj.name}: ${obj.information}`).join('\n')
      } else {
        info += `\nNo objects in this room yet. Say "add an object" to place something here.`
      }

      info += `\n\nMemory Palace Statistics:`
      info += `\n- Total rooms: ${stats.totalRooms}`
      info += `\n- Total objects: ${stats.totalObjects}`

      return info
    } catch (error) {
      return `Failed to get room info: ${error.message}`
    }
  }

  /**
   * Narrate text using speech synthesis and captions
   */
  async narrateText({ text }) {
    try {
      console.log(`[MemoryPalaceTools] Narrating text:`, text.substring(0, 100) + '...')
      
      if (!this.voiceInterface?.speakResponse) {
        return `Narration not available - voice interface not connected`
      }

      await this.voiceInterface.speakResponse(text)
      return `Successfully narrated text`
    } catch (error) {
      console.error(`[MemoryPalaceTools] Error narrating text:`, error)
      return `Failed to narrate text: ${error.message}`
    }
  }

  /**
   * Regenerate image for current room using existing description
   */
  async regenerateRoomImage(input = {}) {
    try {
      const currentRoom = this.core.getCurrentRoom()
      
      if (!currentRoom) {
        return `No current room to regenerate image for. Please create a room first.`
      }

      console.log(`[MemoryPalaceTools] Regenerating image for room: ${currentRoom.name}`)
      
      if (!replicateAPI.isConfigured()) {
        return `Image regeneration not available - Replicate API key not configured. Please configure your Replicate API key in settings to generate room images.`
      }

      const result = await replicateAPI.generateSkyboxImage(
        currentRoom.description, 
        currentRoom.name
      )

      if (result.success) {
        try {
          await this.core.editRoom(currentRoom.id, { 
            imageUrl: result.url,
            lastImageGenerated: new Date().toISOString()
          })
          console.log(`[MemoryPalaceTools] Updated room ${currentRoom.name} with new image URL`)
        } catch (updateError) {
          console.warn(`[MemoryPalaceTools] Could not update room with image URL:`, updateError)
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
        name: 'edit_room',
        description: 'Modify the description of the current room',
        input_schema: {
          type: 'object',
          properties: {
            description: { type: 'string', description: 'Updated detailed room description' }
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
            roomName: { type: 'string', description: 'Name of the room to navigate to' }
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
            name: { type: 'string', description: 'Name of the memory object' },
            info: { type: 'string', description: 'Information or memory to associate with this object' }
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
            name: { type: 'string', description: 'Name of the object to remove' }
          },
          required: ['name']
        }
      },
      {
        name: 'list_rooms',
        description: 'List all available rooms in the memory palace',
        input_schema: { type: 'object', properties: {} }
      },
      {
        name: 'get_room_info',
        description: 'Get detailed information about the current room and its objects',
        input_schema: { type: 'object', properties: {} }
      },
      {
        name: 'regenerate_room_image',
        description: 'Regenerate the skybox image for the current room using its existing description',
        input_schema: { type: 'object', properties: {} }
      },
      {
        name: 'add_object_at_position',
        description: 'Add a memory object at a specific spatial position (used when user double-clicks skybox)',
        input_schema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Name of the memory object' },
            info: { type: 'string', description: 'Information or memory to associate with this object' },
            position: {
              type: 'object',
              description: 'Spatial position coordinates',
              properties: {
                x: { type: 'number' },
                y: { type: 'number' },
                z: { type: 'number' }
              },
              required: ['x', 'y', 'z']
            },
            dimensions: {
              type: 'object',
              description: 'Optional object dimensions from painted areas',
              properties: {
                width: { type: 'number', description: 'Width in world units' },
                height: { type: 'number', description: 'Height in world units' }
              },
              required: ['width', 'height']
            }
          },
          required: ['name', 'info', 'position']
        }
      },
      {
        name: 'create_door',
        description: 'Create a door/connection that leads to a new room. Can convert an existing object to a door OR create a new door at a position. Automatically creates the target room and bidirectional connections.',
        input_schema: {
          type: 'object',
          properties: {
            description: { type: 'string', description: 'Description of the door/entrance' },
            targetRoomName: { type: 'string', description: 'Name of the new room to create and connect to' },
            targetRoomDescription: { type: 'string', description: 'Description of the new room to create' },
            position: {
              type: 'object',
              description: 'Spatial position coordinates (required if not converting existing object)',
              properties: {
                x: { type: 'number' },
                y: { type: 'number' },
                z: { type: 'number' }
              },
              required: ['x', 'y', 'z']
            },
            dimensions: {
              type: 'object',
              description: 'Optional door dimensions from painted areas',
              properties: {
                width: { type: 'number', description: 'Width in world units' },
                height: { type: 'number', description: 'Height in world units' }
              },
              required: ['width', 'height']
            },
            objectId: { type: 'string', description: 'ID of existing object to convert to door (alternative to position)' }
          },
          required: ['targetRoomName', 'targetRoomDescription']
        }
      },
      {
        name: 'narrate',
        description: 'Speak text aloud with speech synthesis and closed captions',
        input_schema: {
          type: 'object',
          properties: {
            text: { type: 'string', description: 'Text to speak aloud to the user' }
          },
          required: ['text']
        }
      }
    ]
  }
}

export default MemoryPalaceToolManager
