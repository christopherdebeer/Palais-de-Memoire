import { EventEmitter } from './EventEmitter.js'
import { StateManager } from './StateManager.js'
import { APIManager, MockAPIProvider } from './APIManager.js'
import { RoomManager } from './RoomManager.js'
import { ObjectManager } from './ObjectManager.js'
import { InteractionController } from './InteractionController.js'
import { EventTypes, DefaultSettings } from './types.js'

/**
 * MemoryPalaceCore - Central orchestrator for the Memory Palace application
 * Coordinates all subsystems and provides a unified API for the application
 */
export class MemoryPalaceCore extends EventEmitter {
  constructor(config = {}) {
    super()
    
    // Configuration
    this.config = {
      apiProvider: 'mock', // 'mock' | 'websim' | custom provider
      persistence: 'localStorage', // 'localStorage' | 'indexedDB' | custom adapter
      enableVoice: true,
      enableSpatialInteraction: true,
      autopilot: false,
      ...config
    }
    
    // Core subsystems
    this.stateManager = new StateManager()
    this.apiManager = new APIManager()
    this.roomManager = null
    this.objectManager = null
    this.interactionController = null
    
    // Application state
    this.isInitialized = false
    this.isRunning = false
    this.version = '0.1.0'
    
    // Performance monitoring
    this.metrics = {
      initTime: 0,
      commandsProcessed: 0,
      roomsCreated: 0,
      objectsCreated: 0,
      apiCallsPerformed: 0
    }
  }

  /**
   * Initialize the Memory Palace core system
   * @returns {Promise<boolean>} Success status
   */
  async initialize() {
    if (this.isInitialized) {
      console.warn('MemoryPalaceCore already initialized')
      return true
    }

    const startTime = performance.now()
    
    try {
      console.log('Initializing Memory Palace Core...')
      
      // Initialize state management
      await this.initializeStateManager()
      
      // Initialize API management
      await this.initializeAPIManager()
      
      // Initialize core managers
      await this.initializeCoreManagers()
      
      // Set up event listeners
      this.setupEventListeners()
      
      // Apply initial configuration
      await this.applyConfiguration()
      
      this.isInitialized = true
      this.metrics.initTime = performance.now() - startTime
      
      console.log(`Memory Palace Core initialized successfully in ${this.metrics.initTime.toFixed(2)}ms`)
      this.emit('core_initialized', { version: this.version, metrics: this.metrics })
      
      return true
      
    } catch (error) {
      console.error('Failed to initialize Memory Palace Core:', error)
      this.emit(EventTypes.ERROR_OCCURRED, { 
        type: 'initialization_error', 
        error: error.message 
      })
      return false
    }
  }

  /**
   * Start the Memory Palace system
   * @returns {Promise<boolean>} Success status
   */
  async start() {
    if (!this.isInitialized) {
      throw new Error('Core must be initialized before starting')
    }
    
    if (this.isRunning) {
      console.warn('Memory Palace Core already running')
      return true
    }
    
    try {
      // Start subsystems
      if (this.config.autopilot) {
        this.interactionController.setAutopilotMode(true)
      }
      
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
   * @returns {Promise<boolean>} Success status
   */
  async stop() {
    if (!this.isRunning) {
      return true
    }
    
    try {
      // Stop subsystems
      this.interactionController.setAutopilotMode(false)
      
      // Save final state
      await this.stateManager.saveState()
      
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
   * Initialize state management
   */
  async initializeStateManager() {
    let persistenceAdapter = null
    
    // Create persistence adapter based on config
    if (this.config.persistence && this.config.persistence !== 'localStorage') {
      try {
        const { PersistenceFactory } = await import('../services/PersistenceInterface.js')
        
        if (this.config.persistence === 'indexedDB') {
          // Import IndexedDB adapter
          await import('../services/IndexedDBAdapter.js')
        }
        
        persistenceAdapter = PersistenceFactory.createAdapter(this.config.persistence, {
          dbName: 'MemoryPalaceDB',
          storeName: 'palace_data'
        })
        
        await persistenceAdapter.initialize()
        console.log(`Using ${this.config.persistence} persistence adapter`)
      } catch (error) {
        console.warn(`Failed to initialize ${this.config.persistence} persistence, falling back to localStorage:`, error)
        persistenceAdapter = null
      }
    }
    
    await this.stateManager.initialize(persistenceAdapter)
    console.log('State Manager initialized')
  }

  /**
   * Initialize API management
   */
  async initializeAPIManager() {
    let provider
    
    switch (this.config.apiProvider) {
      case 'mock':
        provider = APIManager.createMockProvider()
        break
      case 'websim':
        provider = APIManager.createWebSimProvider(this.config.websimBaseUrl)
        break
      default:
        if (typeof this.config.apiProvider === 'object') {
          provider = this.config.apiProvider
        } else {
          throw new Error(`Unknown API provider: ${this.config.apiProvider}`)
        }
    }
    
    this.apiManager.initialize(provider)
    console.log(`API Manager initialized with ${provider.constructor.name}`)
  }

  /**
   * Initialize core managers
   */
  async initializeCoreManagers() {
    // Create manager instances
    this.roomManager = new RoomManager(this.stateManager, this.apiManager)
    this.objectManager = new ObjectManager(this.stateManager, this.apiManager)
    this.interactionController = new InteractionController(
      this.stateManager,
      this.apiManager,
      this.roomManager,
      this.objectManager
    )
    
    // Initialize managers
    await this.roomManager.initialize()
    await this.objectManager.initialize()
    await this.interactionController.initialize()
    
    console.log('Core managers initialized')
  }

  /**
   * Set up event listeners for system coordination
   */
  setupEventListeners() {
    // Forward important events from subsystems
    this.stateManager.on(EventTypes.ERROR_OCCURRED, (error) => {
      this.emit(EventTypes.ERROR_OCCURRED, error)
    })
    
    this.apiManager.on(EventTypes.API_REQUEST, (request) => {
      this.metrics.apiCallsPerformed++
      this.emit(EventTypes.API_REQUEST, request)
    })
    
    this.roomManager.on(EventTypes.ROOM_CREATED, (room) => {
      this.metrics.roomsCreated++
      this.emit(EventTypes.ROOM_CREATED, room)
    })
    
    this.objectManager.on(EventTypes.OBJECT_CREATED, (object) => {
      this.metrics.objectsCreated++
      this.emit(EventTypes.OBJECT_CREATED, object)
    })
    
    this.interactionController.on(EventTypes.COMMAND_PROCESSED, (command) => {
      this.metrics.commandsProcessed++
      this.emit(EventTypes.COMMAND_PROCESSED, command)
    })
    
    // Cross-system coordination
    this.interactionController.on('autopilot_started', () => {
      this.emit('autopilot_started')
    })
    
    this.interactionController.on('autopilot_stopped', () => {
      this.emit('autopilot_stopped')
    })
  }

  /**
   * Apply initial configuration
   */
  async applyConfiguration() {
    // Apply settings from config or load saved settings
    const userState = this.stateManager.getUserState()
    const settings = { ...DefaultSettings, ...(userState.settings || {}) }
    
    await this.stateManager.updateUserState({ settings })
  }

  // Public API Methods

  /**
   * Process user input (main interaction method)
   * @param {string} input - User input text
   * @param {Object} options - Processing options
   * @returns {Promise<Object>} Processing result
   */
  async processInput(input, options = {}) {
    if (!this.isInitialized || !this.isRunning) {
      throw new Error('Core must be initialized and started')
    }
    
    return this.interactionController.processInput(input, options)
  }

  /**
   * Handle spatial interaction (clicks, touches)
   * @param {number} screenX - Screen X coordinate (0-1)
   * @param {number} screenY - Screen Y coordinate (0-1)
   * @param {string} type - Interaction type
   * @returns {Promise<Object>} Interaction result
   */
  async processSpatialInteraction(screenX, screenY, type = 'click') {
    if (!this.isInitialized || !this.isRunning) {
      throw new Error('Core must be initialized and started')
    }
    
    return this.interactionController.processSpatialInteraction(screenX, screenY, type)
  }

  /**
   * Get current application state
   * @returns {Object} Current state information
   */
  getCurrentState() {
    const currentRoom = this.roomManager?.getCurrentRoom()
    const userState = this.stateManager.getUserState()
    
    return {
      isInitialized: this.isInitialized,
      isRunning: this.isRunning,
      currentRoom,
      userState,
      stats: {
        totalRooms: this.roomManager?.getAllRooms().length || 0,
        totalObjects: Array.from(this.stateManager.getObjects().values()).length,
        metrics: this.metrics
      }
    }
  }

  /**
   * Create a new room
   * @param {string} name - Room name
   * @param {string} description - Room description
   * @param {Object} options - Creation options
   * @returns {Promise<Object>} Created room
   */
  async createRoom(name, description, options = {}) {
    if (!this.roomManager) {
      throw new Error('Room manager not initialized')
    }
    
    return this.roomManager.createRoom(name, description, options)
  }

  /**
   * Navigate to a room
   * @param {string} roomId - Target room ID
   * @returns {Promise<Object|null>} Target room
   */
  async navigateToRoom(roomId) {
    if (!this.roomManager) {
      throw new Error('Room manager not initialized')
    }
    
    return this.roomManager.navigateToRoom(roomId)
  }

  /**
   * Add an object to current room
   * @param {string} name - Object name
   * @param {string} information - Memory information
   * @param {Object} position - 3D position
   * @returns {Promise<Object>} Created object
   */
  async addObject(name, information, position = null) {
    if (!this.objectManager || !this.roomManager) {
      throw new Error('Managers not initialized')
    }
    
    const currentRoomId = this.roomManager.currentRoomId
    if (!currentRoomId) {
      throw new Error('No current room')
    }
    
    return this.objectManager.addObject(currentRoomId, name, information, position)
  }

  /**
   * Get all rooms
   * @returns {Object[]} Array of rooms
   */
  getAllRooms() {
    return this.roomManager?.getAllRooms() || []
  }

  /**
   * Get objects in current room
   * @returns {Object[]} Array of objects
   */
  getCurrentRoomObjects() {
    const currentRoomId = this.roomManager?.currentRoomId
    return currentRoomId ? this.objectManager?.getRoomObjects(currentRoomId) || [] : []
  }

  /**
   * Get application settings
   * @returns {Object} Current settings
   */
  getSettings() {
    const userState = this.stateManager.getUserState()
    return userState.settings || DefaultSettings
  }

  /**
   * Update application settings
   * @param {Object} updates - Settings updates
   * @returns {Promise<Object>} Updated settings
   */
  async updateSettings(updates) {
    const currentSettings = this.getSettings()
    const newSettings = { ...currentSettings, ...updates }
    
    await this.stateManager.updateUserState({ settings: newSettings })
    this.emit('settings_updated', newSettings)
    
    return newSettings
  }

  /**
   * Enable/disable autopilot mode
   * @param {boolean} enabled - Enable autopilot
   */
  setAutopilotMode(enabled) {
    this.interactionController?.setAutopilotMode(enabled)
  }

  /**
   * Export palace data
   * @returns {Object} Exportable data
   */
  exportPalace() {
    return {
      version: this.version,
      exportedAt: new Date().toISOString(),
      data: this.stateManager.exportState(),
      metadata: {
        stats: this.getCurrentState().stats,
        config: this.config
      }
    }
  }

  /**
   * Import palace data
   * @param {Object} data - Data to import
   * @returns {Promise<boolean>} Success status
   */
  async importPalace(data) {
    try {
      if (data.version && data.data) {
        await this.stateManager.importState(data.data)
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
   * @returns {Promise<boolean>} Success status
   */
  async clearPalace() {
    try {
      await this.stateManager.clearState()
      this.emit('palace_cleared')
      return true
    } catch (error) {
      console.error('Failed to clear palace:', error)
      return false
    }
  }

  /**
   * Get system performance metrics
   * @returns {Object} Performance data
   */
  getMetrics() {
    return {
      ...this.metrics,
      uptime: this.isRunning ? performance.now() - this.metrics.initTime : 0,
      memoryUsage: this.calculateMemoryUsage(),
      rateLimitStatus: this.apiManager.getRateLimitStatus()
    }
  }

  /**
   * Calculate approximate memory usage
   * @returns {Object} Memory usage statistics
   */
  calculateMemoryUsage() {
    const rooms = this.stateManager.getRooms()
    const objects = this.stateManager.getObjects()
    const connections = this.stateManager.getConnections()
    
    return {
      rooms: rooms.size,
      objects: objects.size,
      connections: connections.size,
      conversationHistory: this.interactionController?.conversationHistory?.length || 0
    }
  }

  /**
   * Get system health status
   * @returns {Object} Health check results
   */
  getHealthStatus() {
    return {
      initialized: this.isInitialized,
      running: this.isRunning,
      stateManager: !!this.stateManager,
      apiManager: !!this.apiManager,
      roomManager: !!this.roomManager,
      objectManager: !!this.objectManager,
      interactionController: !!this.interactionController,
      lastError: this.lastError || null
    }
  }

  /**
   * Restart the system
   * @returns {Promise<boolean>} Success status
   */
  async restart() {
    await this.stop()
    return this.start()
  }

  /**
   * Dispose of the system and clean up resources
   */
  dispose() {
    if (this.isRunning) {
      this.stop()
    }
    
    // Clear all event listeners
    this.clear()
    
    // Clear subsystem references
    this.stateManager = null
    this.apiManager = null
    this.roomManager = null
    this.objectManager = null
    this.interactionController = null
    
    this.isInitialized = false
    
    console.log('Memory Palace Core disposed')
  }
}

// Export singleton instance for convenience
let globalInstance = null

/**
 * Get or create the global Memory Palace Core instance
 * @param {Object} config - Configuration for new instance
 * @returns {MemoryPalaceCore} Global instance
 */
export function getMemoryPalaceCore(config = {}) {
  if (!globalInstance) {
    globalInstance = new MemoryPalaceCore(config)
  }
  return globalInstance
}

/**
 * Create a new Memory Palace Core instance
 * @param {Object} config - Configuration
 * @returns {MemoryPalaceCore} New instance
 */
export function createMemoryPalaceCore(config = {}) {
  return new MemoryPalaceCore(config)
}

export default MemoryPalaceCore