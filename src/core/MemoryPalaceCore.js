import { EventEmitter } from './EventEmitter.js'
import { StateManager } from './StateManager.js'
import { RoomManager } from './RoomManager.js'
import { ObjectManager } from './ObjectManager.js'
import { InteractionController } from './InteractionController.js'
import { EventTypes, DefaultSettings } from './types.js'
import { persistenceService } from '../services/SimplePersistenceService.js'

/**
 * MemoryPalaceCore - Central orchestrator for the Memory Palace application
 * Coordinates all subsystems and provides a unified API for the application
 */
export class MemoryPalaceCore extends EventEmitter {
  constructor(config = {}) {
    super()
    
    // Configuration
    this.config = {
      enableImageGeneration: true, // Enable image generation via Replicate
      persistence: 'localStorage', // 'localStorage' | 'indexedDB' | custom adapter
      enableVoice: true,
      enableSpatialInteraction: true,
      autopilot: false,
      ...config
    }
    
    // Core subsystems
    this.stateManager = new StateManager()
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
      console.warn('[MemoryPalaceCore] Already initialized')
      return true
    }

    const startTime = performance.now()
    this.lastError = null
    
    try {
      console.log('[MemoryPalaceCore] Starting initialization process...')
      console.log('[MemoryPalaceCore] Config:', this.config)
      
      // Initialize state management
      console.log('[MemoryPalaceCore] Step 1: Initializing StateManager...')
      await this.initializeStateManager()
      console.log('[MemoryPalaceCore] Step 1: StateManager initialized successfully')
      
      // Initialize core managers
      console.log('[MemoryPalaceCore] Step 2: Initializing core managers...')
      await this.initializeCoreManagers()
      console.log('[MemoryPalaceCore] Step 2: Core managers initialized successfully')
      
      // Set up event listeners
      console.log('[MemoryPalaceCore] Step 3: Setting up event listeners...')
      this.setupEventListeners()
      console.log('[MemoryPalaceCore] Step 3: Event listeners set up successfully')
      
      // Apply initial configuration
      console.log('[MemoryPalaceCore] Step 4: Applying initial configuration...')
      await this.applyConfiguration()
      console.log('[MemoryPalaceCore] Step 4: Initial configuration applied successfully')
      
      this.isInitialized = true
      this.metrics.initTime = performance.now() - startTime
      
      console.log(`[MemoryPalaceCore] ✅ Initialization completed successfully in ${this.metrics.initTime.toFixed(2)}ms`)
      console.log('[MemoryPalaceCore] Final state:', {
        isInitialized: this.isInitialized,
        hasStateManager: !!this.stateManager,
        hasRoomManager: !!this.roomManager,
        hasObjectManager: !!this.objectManager,
        hasInteractionController: !!this.interactionController
      })
      
      this.emit('core_initialized', { version: this.version, metrics: this.metrics })
      
      return true
      
    } catch (error) {
      this.lastError = error;
      console.error('[MemoryPalaceCore] ❌ Initialization failed:', error)
      console.error('[MemoryPalaceCore] Error stack:', error.stack)
      console.error('[MemoryPalaceCore] Current state at failure:', {
        isInitialized: this.isInitialized,
        hasStateManager: !!this.stateManager,
        hasRoomManager: !!this.roomManager,
        hasObjectManager: !!this.objectManager,
        hasInteractionController: !!this.interactionController
      })
      
      this.emit(EventTypes.ERROR_OCCURRED, { 
        type: 'initialization_error', 
        error: error.message,
        stack: error.stack,
        component: error.component || 'unknown'
      })
      
      // Don't attempt recovery - fail fast with clear error message
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
    console.log('[MemoryPalaceCore] StateManager: Starting initialization...')
    
    // Use simplified persistence service
    await persistenceService.initialize()
    console.log(`[MemoryPalaceCore] StateManager: Using ${persistenceService.getInfo().type} persistence`)
    
    await this.stateManager.initialize(persistenceService)
    console.log('[MemoryPalaceCore] StateManager: ✅ StateManager initialized successfully')
  }


  /**
   * Initialize core managers
   */
  async initializeCoreManagers() {
    console.log('[MemoryPalaceCore] CoreManagers: Starting initialization...')
    
    try {
      // Create manager instances
      console.log('[MemoryPalaceCore] CoreManagers: Creating RoomManager...')
      this.roomManager = new RoomManager(this.stateManager)
      console.log('[MemoryPalaceCore] CoreManagers: RoomManager created')
      
      console.log('[MemoryPalaceCore] CoreManagers: Creating ObjectManager...')
      this.objectManager = new ObjectManager(this.stateManager)
      console.log('[MemoryPalaceCore] CoreManagers: ObjectManager created')
      
      console.log('[MemoryPalaceCore] CoreManagers: Creating InteractionController...')
      this.interactionController = new InteractionController(
        this.stateManager,
        this.roomManager,
        this.objectManager
      )
      console.log('[MemoryPalaceCore] CoreManagers: InteractionController created')
      
      // Initialize managers
      console.log('[MemoryPalaceCore] CoreManagers: Initializing RoomManager...')
      await this.roomManager.initialize()
      console.log('[MemoryPalaceCore] CoreManagers: RoomManager initialized')
      
      console.log('[MemoryPalaceCore] CoreManagers: Initializing ObjectManager...')
      await this.objectManager.initialize()
      console.log('[MemoryPalaceCore] CoreManagers: ObjectManager initialized')
      
      console.log('[MemoryPalaceCore] CoreManagers: Initializing InteractionController...')
      await this.interactionController.initialize()
      console.log('[MemoryPalaceCore] CoreManagers: InteractionController initialized')
      
      console.log('[MemoryPalaceCore] CoreManagers: ✅ All core managers initialized successfully')
    } catch (error) {
      console.error('[MemoryPalaceCore] CoreManagers: ❌ Failed to initialize core managers:', error)
      throw error
    }
  }

  /**
   * Set up event listeners for system coordination
   */
  setupEventListeners() {
    // Forward important events from subsystems
    this.stateManager.on(EventTypes.ERROR_OCCURRED, (error) => {
      this.emit(EventTypes.ERROR_OCCURRED, error)
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
    
    // Ensure a default room exists if no rooms are present
    await this.ensureDefaultRoom()
  }

  /**
   * Ensure a default room exists when starting with an empty palace
   */
  async ensureDefaultRoom() {
    const rooms = this.stateManager.getRooms()
    const userState = this.stateManager.getUserState()
    
    // If no rooms exist, create a default room
    if (rooms.size === 0) {
      console.log('[MemoryPalaceCore] No rooms found, creating default room...')
      
      // Create the default room with the same description as the default skybox
      const defaultRoom = await this.roomManager.createRoom(
        'Welcome Hall',
        'A peaceful starting space for your memory palace. This elegant hall features classical architecture with warm lighting, perfect for beginning your journey of memory organization.',
        { imageUrl: '/default_skybox.png' } 
      )
      
      console.log('[MemoryPalaceCore] Default room created:', defaultRoom)
      
      // Navigate to the default room
      await this.roomManager.navigateToRoom(defaultRoom.id)
      console.log('[MemoryPalaceCore] Navigated to default room')
      
      return defaultRoom
    }
    
    // If rooms exist but no current room is set, navigate to the first room
    if (!userState.currentRoomId && rooms.size > 0) {
      const firstRoom = Array.from(rooms.values())[0]
      console.log('[MemoryPalaceCore] No current room set, navigating to first room:', firstRoom.name)
      await this.roomManager.navigateToRoom(firstRoom.id)
      return firstRoom
    }
    
    return null
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
      memoryUsage: this.calculateMemoryUsage()
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
  async dispose() {
    try {
      // Stop the system if it's running
      if (this.isRunning) {
        await this.stop()
      }
      
      // Properly dispose of each subsystem if they have dispose methods
      if (this.interactionController?.dispose) {
        await this.interactionController.dispose()
      }
      
      if (this.objectManager?.dispose) {
        await this.objectManager.dispose()
      }
      
      if (this.roomManager?.dispose) {
        await this.roomManager.dispose()
      }
      
      if (this.stateManager?.dispose) {
        await this.stateManager.dispose()
      }
      
      // Clear all event listeners
      this.clear()
      
      // Clear subsystem references
      this.stateManager = null
      this.roomManager = null
      this.objectManager = null
      this.interactionController = null
      
      this.isInitialized = false
      this.isRunning = false
      
      console.log('[MemoryPalaceCore] All resources disposed successfully')
    } catch (error) {
      console.error('[MemoryPalaceCore] Error during disposal:', error)
    }
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
