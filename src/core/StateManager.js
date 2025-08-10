import { EventEmitter } from './EventEmitter.js'
import { StateKeys, EventTypes, DefaultSettings } from './types.js'

/**
 * Centralized state management for the Memory Palace application
 * Handles both in-memory state and persistence to localStorage/remote APIs
 */
export class StateManager extends EventEmitter {
  constructor() {
    super()
    this.state = new Map()
    this.isInitialized = false
    this.persistenceAdapter = null
  }

  /**
   * Initialize the state manager
   * @param {Object} persistenceAdapter - Adapter for data persistence (localStorage, API, etc.)
   */
  async initialize(persistenceAdapter = null) {
    this.persistenceAdapter = persistenceAdapter
    
    // Load initial state
    await this.loadState()
    
    // Set up default state if empty
    this.ensureDefaultState()
    
    this.isInitialized = true
    this.emit(EventTypes.STATE_CHANGED, 'initialized')
  }

  /**
   * Load state from persistence layer
   */
  async loadState() {
    try {
      if (this.persistenceAdapter) {
        // Load from persistence adapter (IndexedDB, etc.)
        const data = await this.persistenceAdapter.load()
        Object.entries(data).forEach(([key, value]) => {
          // Handle deserialization of complex types (Maps, etc.)
          const deserializedValue = this.persistenceAdapter.deserializeValue ? 
            this.persistenceAdapter.deserializeValue(value) : value
          this.state.set(key, deserializedValue)
        })
      } else {
        // Load from localStorage (fallback)
        Object.values(StateKeys).forEach(key => {
          const stored = localStorage.getItem(`palais_${key}`)
          if (stored) {
            try {
              this.state.set(key, JSON.parse(stored))
            } catch (error) {
              console.warn(`Failed to parse stored state for ${key}:`, error)
            }
          }
        })
      }
    } catch (error) {
      console.error('Failed to load state:', error)
      this.emit(EventTypes.ERROR_OCCURRED, { type: 'state_load_error', error })
    }
  }

  /**
   * Save state to persistence layer
   * @param {string} [key] - Optional specific key to save, otherwise saves all
   */
  async saveState(key = null) {
    try {
      if (this.persistenceAdapter) {
        // Save to persistence adapter (IndexedDB, etc.)
        const dataToSave = key 
          ? { [key]: this.state.get(key) }
          : Object.fromEntries(this.state)
        
        // Handle serialization of complex types (Maps, etc.)
        if (this.persistenceAdapter.serializeValue) {
          for (const [k, v] of Object.entries(dataToSave)) {
            dataToSave[k] = this.persistenceAdapter.serializeValue(v)
          }
        }
        
        await this.persistenceAdapter.save(dataToSave)
      } else {
        // Save to localStorage (fallback)
        const keysToSave = key ? [key] : [...this.state.keys()]
        
        keysToSave.forEach(stateKey => {
          const value = this.state.get(stateKey)
          if (value !== undefined) {
            localStorage.setItem(`palais_${stateKey}`, JSON.stringify(value))
          }
        })
      }
    } catch (error) {
      console.error('Failed to save state:', error)
      this.emit(EventTypes.ERROR_OCCURRED, { type: 'state_save_error', error, key })
    }
  }

  /**
   * Ensure default state exists
   */
  ensureDefaultState() {
    // Initialize user state if not exists
    if (!this.state.has(StateKeys.USER_STATE)) {
      this.state.set(StateKeys.USER_STATE, {
        id: this.generateId(),
        currentRoomId: null,
        roomCounter: 0,
        objectCounter: 0,
        settings: { ...DefaultSettings }
      })
    }

    // Initialize collections if not exist
    const collections = [StateKeys.ROOMS, StateKeys.OBJECTS, StateKeys.CONNECTIONS]
    collections.forEach(key => {
      if (!this.state.has(key)) {
        this.state.set(key, new Map())
      } else {
        // Convert plain objects back to Maps if loaded from storage
        const value = this.state.get(key)
        if (value && typeof value === 'object' && !(value instanceof Map)) {
          this.state.set(key, new Map(Object.entries(value)))
        }
      }
    })

    // Initialize conversation context
    if (!this.state.has(StateKeys.CONVERSATION_CONTEXT)) {
      this.state.set(StateKeys.CONVERSATION_CONTEXT, [])
    }
  }

  /**
   * Get a value from state
   * @param {string} key - State key
   * @param {any} defaultValue - Default value if key doesn't exist
   * @returns {any} State value
   */
  get(key, defaultValue = undefined) {
    return this.state.get(key) ?? defaultValue
  }

  /**
   * Set a value in state and optionally persist
   * @param {string} key - State key
   * @param {any} value - Value to set
   * @param {boolean} persist - Whether to immediately persist to storage
   */
  async set(key, value, persist = true) {
    const oldValue = this.state.get(key)
    this.state.set(key, value)
    
    if (persist) {
      await this.saveState(key)
    }
    
    this.emit(EventTypes.STATE_CHANGED, { key, value, oldValue })
  }

  /**
   * Update nested properties in state
   * @param {string} key - State key
   * @param {Object} updates - Object with updates to merge
   * @param {boolean} persist - Whether to immediately persist to storage
   */
  async update(key, updates, persist = true) {
    const currentValue = this.state.get(key)
    const newValue = { ...currentValue, ...updates }
    await this.set(key, newValue, persist)
  }

  /**
   * Get user state
   * @returns {Object} Current user state
   */
  getUserState() {
    return this.get(StateKeys.USER_STATE, {})
  }

  /**
   * Update user state
   * @param {Object} updates - Updates to merge into user state
   */
  async updateUserState(updates) {
    await this.update(StateKeys.USER_STATE, updates)
  }

  /**
   * Get all rooms
   * @returns {Map<string, Object>} Map of room ID to room data
   */
  getRooms() {
    return this.get(StateKeys.ROOMS, new Map())
  }

  /**
   * Get a specific room
   * @param {string} roomId - Room ID
   * @returns {Object|null} Room data or null if not found
   */
  getRoom(roomId) {
    return this.getRooms().get(roomId) || null
  }

  /**
   * Add or update a room
   * @param {Object} room - Room data
   */
  async setRoom(room) {
    const rooms = this.getRooms()
    rooms.set(room.id, { 
      ...room, 
      updatedAt: new Date().toISOString() 
    })
    await this.set(StateKeys.ROOMS, rooms)
    this.emit(EventTypes.ROOM_UPDATED, room)
  }

  /**
   * Delete a room and its associated objects/connections
   * @param {string} roomId - Room ID to delete
   */
  async deleteRoom(roomId) {
    const rooms = this.getRooms()
    const room = rooms.get(roomId)
    
    if (!room) return
    
    // Remove room
    rooms.delete(roomId)
    await this.set(StateKeys.ROOMS, rooms)
    
    // Remove associated objects
    const objects = this.getObjects()
    const objectsToDelete = []
    for (const [objId, obj] of objects.entries()) {
      if (obj.roomId === roomId) {
        objectsToDelete.push(objId)
      }
    }
    objectsToDelete.forEach(objId => objects.delete(objId))
    await this.set(StateKeys.OBJECTS, objects)
    
    // Remove associated connections
    const connections = this.getConnections()
    const connectionsToDelete = []
    for (const [connId, conn] of connections.entries()) {
      if (conn.roomId === roomId || conn.targetRoomId === roomId) {
        connectionsToDelete.push(connId)
      }
    }
    connectionsToDelete.forEach(connId => connections.delete(connId))
    await this.set(StateKeys.CONNECTIONS, connections)
    
    this.emit(EventTypes.ROOM_DELETED, { roomId, room })
  }

  /**
   * Get all objects
   * @returns {Map<string, Object>} Map of object ID to object data
   */
  getObjects() {
    return this.get(StateKeys.OBJECTS, new Map())
  }

  /**
   * Get objects for a specific room
   * @param {string} roomId - Room ID
   * @returns {Object[]} Array of objects in the room
   */
  getRoomObjects(roomId) {
    const objects = this.getObjects()
    return Array.from(objects.values()).filter(obj => obj.roomId === roomId)
  }

  /**
   * Add or update an object
   * @param {Object} object - Object data
   */
  async setObject(object) {
    const objects = this.getObjects()
    objects.set(object.id, {
      ...object,
      updatedAt: new Date().toISOString()
    })
    await this.set(StateKeys.OBJECTS, objects)
    this.emit(EventTypes.OBJECT_UPDATED, object)
  }

  /**
   * Delete an object
   * @param {string} objectId - Object ID to delete
   */
  async deleteObject(objectId) {
    const objects = this.getObjects()
    const object = objects.get(objectId)
    
    if (!object) return
    
    objects.delete(objectId)
    await this.set(StateKeys.OBJECTS, objects)
    this.emit(EventTypes.OBJECT_DELETED, { objectId, object })
  }

  /**
   * Get all connections
   * @returns {Map<string, Object>} Map of connection ID to connection data
   */
  getConnections() {
    return this.get(StateKeys.CONNECTIONS, new Map())
  }

  /**
   * Get connections for a specific room
   * @param {string} roomId - Room ID
   * @returns {Object[]} Array of connections from the room
   */
  getRoomConnections(roomId) {
    const connections = this.getConnections()
    return Array.from(connections.values()).filter(conn => conn.roomId === roomId)
  }

  /**
   * Add a connection
   * @param {Object} connection - Connection data
   */
  async setConnection(connection) {
    const connections = this.getConnections()
    connections.set(connection.id, connection)
    await this.set(StateKeys.CONNECTIONS, connections)
    this.emit(EventTypes.CONNECTION_CREATED, connection)
  }

  /**
   * Generate a unique ID
   * @returns {string} Unique identifier
   */
  generateId() {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Clear all state
   */
  async clearState() {
    this.state.clear()
    if (this.persistenceAdapter) {
      await this.persistenceAdapter.clear()
    } else {
      Object.values(StateKeys).forEach(key => {
        localStorage.removeItem(`palais_${key}`)
      })
    }
    this.ensureDefaultState()
    this.emit(EventTypes.STATE_CHANGED, 'cleared')
  }

  /**
   * Export state for backup/sharing
   * @returns {Object} Serializable state object
   */
  exportState() {
    const exportData = {}
    for (const [key, value] of this.state.entries()) {
      if (value instanceof Map) {
        exportData[key] = Object.fromEntries(value)
      } else {
        exportData[key] = value
      }
    }
    return exportData
  }

  /**
   * Import state from backup
   * @param {Object} data - State data to import
   */
  async importState(data) {
    this.state.clear()
    
    for (const [key, value] of Object.entries(data)) {
      if (key === StateKeys.ROOMS || key === StateKeys.OBJECTS || key === StateKeys.CONNECTIONS) {
        this.state.set(key, new Map(Object.entries(value)))
      } else {
        this.state.set(key, value)
      }
    }
    
    await this.saveState()
    this.emit(EventTypes.STATE_CHANGED, 'imported')
  }
}