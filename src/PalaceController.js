/**
 * PalaceController - Simplified core controller replacing multiple manager classes
 * Consolidates StateManager, RoomManager, ObjectManager, and persistence logic
 */

export class PalaceController {
  constructor(config = {}) {
    // Simple configuration
    this.config = {
      enableVoice: true,
      enableSpatialInteraction: true,
      autopilot: false,
      ...config
    }
    
    // Core data storage (replacing complex state management)
    this.rooms = new Map()
    this.objects = new Map()
    this.currentRoomId = null
    this.roomCounter = 0
    this.objectCounter = 0
    
    // Simple event callbacks (replacing EventEmitter complexity)
    this.callbacks = {
      roomChanged: [],
      objectAdded: [],
      objectRemoved: [],
      stateUpdated: []
    }
    
    // Initialize from localStorage
    this.loadFromStorage()
  }
  
  // === Event Management (Simplified) ===
  on(event, callback) {
    if (this.callbacks[event]) {
      this.callbacks[event].push(callback)
    }
  }
  
  emit(event, data) {
    if (this.callbacks[event]) {
      this.callbacks[event].forEach(cb => cb(data))
    }
  }
  
  // === Room Management ===
  createRoom(name, description = '') {
    const roomId = `room_${++this.roomCounter}`
    const room = {
      id: roomId,
      name,
      description,
      objects: [],
      position: { x: 0, y: 0, z: 0 },
      created: Date.now()
    }
    
    this.rooms.set(roomId, room)
    this.saveToStorage()
    this.emit('roomChanged', room)
    
    return room
  }
  
  getRooms() {
    return Array.from(this.rooms.values())
  }
  
  getCurrentRoom() {
    return this.currentRoomId ? this.rooms.get(this.currentRoomId) : null
  }
  
  setCurrentRoom(roomId) {
    if (this.rooms.has(roomId)) {
      this.currentRoomId = roomId
      this.emit('roomChanged', this.rooms.get(roomId))
      this.saveToStorage()
    }
  }
  
  // === Object Management ===
  createObject(roomId, name, description, position) {
    const objectId = `object_${++this.objectCounter}`
    const object = {
      id: objectId,
      name,
      description,
      position,
      roomId,
      created: Date.now()
    }
    
    this.objects.set(objectId, object)
    
    // Add to room
    const room = this.rooms.get(roomId)
    if (room) {
      room.objects.push(objectId)
    }
    
    this.saveToStorage()
    this.emit('objectAdded', object)
    
    return object
  }
  
  getObjectsInRoom(roomId) {
    const room = this.rooms.get(roomId)
    if (!room) return []
    
    return room.objects.map(id => this.objects.get(id)).filter(Boolean)
  }
  
  getObject(objectId) {
    return this.objects.get(objectId)
  }
  
  updateObject(objectId, updates) {
    const object = this.objects.get(objectId)
    if (object) {
      Object.assign(object, updates)
      this.saveToStorage()
      this.emit('stateUpdated', object)
    }
  }
  
  removeObject(objectId) {
    const object = this.objects.get(objectId)
    if (object) {
      // Remove from room
      const room = this.rooms.get(object.roomId)
      if (room) {
        room.objects = room.objects.filter(id => id !== objectId)
      }
      
      this.objects.delete(objectId)
      this.saveToStorage()
      this.emit('objectRemoved', object)
    }
  }
  
  // === Simple Persistence (replacing complex persistence layer) ===
  saveToStorage() {
    try {
      const data = {
        rooms: Array.from(this.rooms.entries()),
        objects: Array.from(this.objects.entries()),
        currentRoomId: this.currentRoomId,
        roomCounter: this.roomCounter,
        objectCounter: this.objectCounter,
        timestamp: Date.now()
      }
      
      localStorage.setItem('memoryPalace', JSON.stringify(data))
    } catch (error) {
      console.warn('Failed to save to localStorage:', error)
    }
  }
  
  loadFromStorage() {
    try {
      const data = JSON.parse(localStorage.getItem('memoryPalace') || '{}')
      
      if (data.rooms) {
        this.rooms = new Map(data.rooms)
      }
      if (data.objects) {
        this.objects = new Map(data.objects)
      }
      if (data.currentRoomId) {
        this.currentRoomId = data.currentRoomId
      }
      if (data.roomCounter) {
        this.roomCounter = data.roomCounter
      }
      if (data.objectCounter) {
        this.objectCounter = data.objectCounter
      }
    } catch (error) {
      console.warn('Failed to load from localStorage:', error)
    }
  }
  
  // === State Access ===
  getState() {
    return {
      rooms: this.getRooms(),
      currentRoom: this.getCurrentRoom(),
      objectCount: this.objects.size,
      roomCount: this.rooms.size
    }
  }
  
  // === Voice Command Processing (Simplified) ===
  processVoiceCommand(command) {
    const lowerCommand = command.toLowerCase()
    
    // Simple command pattern matching
    if (lowerCommand.includes('create room')) {
      const name = this.extractRoomName(command) || `Room ${this.roomCounter + 1}`
      return this.createRoom(name)
    }
    
    if (lowerCommand.includes('add object') || lowerCommand.includes('create object')) {
      if (!this.currentRoomId) {
        throw new Error('No current room selected')
      }
      
      const name = this.extractObjectName(command) || `Object ${this.objectCounter + 1}`
      const position = { x: 0, y: 1.5, z: -5 } // Default position
      
      return this.createObject(this.currentRoomId, name, '', position)
    }
    
    // Add more command patterns as needed
    return { message: 'Command processed', command }
  }
  
  extractRoomName(command) {
    const match = command.match(/room (?:called |named )?["']?([^"']+)["']?/i)
    return match ? match[1].trim() : null
  }
  
  extractObjectName(command) {
    const match = command.match(/object (?:called |named )?["']?([^"']+)["']?/i)
    return match ? match[1].trim() : null
  }
}