/**
 * Persistence Interface for Memory Palace Application
 * Provides swappable persistence layer supporting local and remote storage
 */

/**
 * Abstract base class for all persistence adapters
 * Defines the interface that all persistence implementations must follow
 */
export class PersistenceAdapter {
  /**
   * Initialize the persistence adapter
   * @param {Object} config - Configuration for the adapter
   * @returns {Promise<boolean>} Success status
   */
  async initialize(config = {}) {
    throw new Error('initialize() must be implemented by concrete adapter')
  }

  /**
   * Load data from persistence layer
   * @param {string} [key] - Optional specific key to load, otherwise loads all
   * @returns {Promise<Object>} Loaded data
   */
  async load(key = null) {
    throw new Error('load() must be implemented by concrete adapter')
  }

  /**
   * Save data to persistence layer
   * @param {Object} data - Data to save (key-value pairs)
   * @returns {Promise<boolean>} Success status
   */
  async save(data) {
    throw new Error('save() must be implemented by concrete adapter')
  }

  /**
   * Delete specific key or all data
   * @param {string} [key] - Optional specific key to delete, otherwise clears all
   * @returns {Promise<boolean>} Success status
   */
  async clear(key = null) {
    throw new Error('clear() must be implemented by concrete adapter')
  }

  /**
   * Check if adapter is available and functional
   * @returns {Promise<boolean>} Availability status
   */
  async isAvailable() {
    throw new Error('isAvailable() must be implemented by concrete adapter')
  }

  /**
   * Get adapter capabilities and metadata
   * @returns {Object} Adapter information
   */
  getInfo() {
    throw new Error('getInfo() must be implemented by concrete adapter')
  }

  /**
   * Clean up resources when adapter is no longer needed
   * @returns {Promise<void>}
   */
  async dispose() {
    // Default implementation - override if cleanup needed
  }
}

/**
 * LocalStorage persistence adapter (existing implementation)
 */
export class LocalStorageAdapter extends PersistenceAdapter {
  constructor(keyPrefix = 'palais') {
    super()
    this.keyPrefix = keyPrefix
    this.isInitialized = false
  }

  async initialize(config = {}) {
    this.keyPrefix = config.keyPrefix || this.keyPrefix
    this.isInitialized = true
    return true
  }

  async load(key = null) {
    if (!await this.isAvailable()) {
      throw new Error('localStorage not available')
    }

    const data = {}
    
    if (key) {
      const stored = localStorage.getItem(`${this.keyPrefix}_${key}`)
      if (stored) {
        try {
          data[key] = JSON.parse(stored)
        } catch (error) {
          console.warn(`Failed to parse localStorage data for ${key}:`, error)
        }
      }
    } else {
      // Load all keys with our prefix
      for (let i = 0; i < localStorage.length; i++) {
        const storageKey = localStorage.key(i)
        if (storageKey && storageKey.startsWith(`${this.keyPrefix}_`)) {
          const dataKey = storageKey.replace(`${this.keyPrefix}_`, '')
          const stored = localStorage.getItem(storageKey)
          if (stored) {
            try {
              data[dataKey] = JSON.parse(stored)
            } catch (error) {
              console.warn(`Failed to parse localStorage data for ${dataKey}:`, error)
            }
          }
        }
      }
    }

    return data
  }

  async save(data) {
    if (!await this.isAvailable()) {
      throw new Error('localStorage not available')
    }

    try {
      for (const [key, value] of Object.entries(data)) {
        if (value !== undefined) {
          localStorage.setItem(`${this.keyPrefix}_${key}`, JSON.stringify(value))
        }
      }
      return true
    } catch (error) {
      console.error('Failed to save to localStorage:', error)
      return false
    }
  }

  async clear(key = null) {
    if (!await this.isAvailable()) {
      throw new Error('localStorage not available')
    }

    try {
      if (key) {
        localStorage.removeItem(`${this.keyPrefix}_${key}`)
      } else {
        // Clear all keys with our prefix
        const keysToRemove = []
        for (let i = 0; i < localStorage.length; i++) {
          const storageKey = localStorage.key(i)
          if (storageKey && storageKey.startsWith(`${this.keyPrefix}_`)) {
            keysToRemove.push(storageKey)
          }
        }
        keysToRemove.forEach(storageKey => localStorage.removeItem(storageKey))
      }
      return true
    } catch (error) {
      console.error('Failed to clear localStorage:', error)
      return false
    }
  }

  async isAvailable() {
    try {
      const testKey = `${this.keyPrefix}_test`
      localStorage.setItem(testKey, 'test')
      localStorage.removeItem(testKey)
      return true
    } catch (error) {
      return false
    }
  }

  getInfo() {
    return {
      name: 'LocalStorageAdapter',
      type: 'local',
      persistent: true,
      capacity: 'limited', // ~5-10MB depending on browser
      synchronous: true,
      keyPrefix: this.keyPrefix
    }
  }
}

/**
 * Factory class for creating persistence adapters
 */
export class PersistenceFactory {
  static adapters = new Map([
    ['localStorage', LocalStorageAdapter],
    ['indexedDB', null], // Will be set when IndexedDBAdapter is imported
    ['memory', null], // For in-memory testing
    ['remote', null] // For future remote implementations
  ])

  /**
   * Register a new adapter type
   * @param {string} type - Adapter type identifier
   * @param {class} AdapterClass - Adapter class constructor
   */
  static registerAdapter(type, AdapterClass) {
    this.adapters.set(type, AdapterClass)
  }

  /**
   * Create a persistence adapter instance
   * @param {string} type - Type of adapter to create
   * @param {Object} config - Configuration for the adapter
   * @returns {PersistenceAdapter} Adapter instance
   */
  static createAdapter(type, config = {}) {
    const AdapterClass = this.adapters.get(type)
    
    if (!AdapterClass) {
      throw new Error(`Unknown persistence adapter type: ${type}`)
    }

    return new AdapterClass(config)
  }

  /**
   * Get list of available adapter types
   * @returns {string[]} Available adapter types
   */
  static getAvailableTypes() {
    return Array.from(this.adapters.keys()).filter(type => this.adapters.get(type))
  }

  /**
   * Check which adapters are available in current environment
   * @returns {Promise<Object>} Availability status for each adapter
   */
  static async checkAvailability() {
    const availability = {}
    
    for (const [type, AdapterClass] of this.adapters.entries()) {
      if (AdapterClass) {
        try {
          const adapter = new AdapterClass()
          availability[type] = await adapter.isAvailable()
        } catch (error) {
          availability[type] = false
        }
      } else {
        availability[type] = false
      }
    }

    return availability
  }
}

export default PersistenceAdapter