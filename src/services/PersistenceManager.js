/**
 * Enhanced Persistence Manager for Memory Palace Application
 * Integrates IndexedDB with settings and provides unified persistence interface
 */

import { PersistenceFactory } from './PersistenceInterface.js'
import './IndexedDBAdapter.js' // Register IndexedDB adapter

/**
 * Unified persistence manager that integrates with existing settings
 */
export class PersistenceManager {
  constructor() {
    this.primaryAdapter = null
    this.fallbackAdapter = null
    this.isInitialized = false
    this.listeners = new Set()
    
    // Configuration
    this.config = {
      preferredAdapter: 'indexedDB',
      fallbackAdapter: 'localStorage',
      autoCompact: true,
      compactInterval: 24 * 60 * 60 * 1000, // 24 hours
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    }
  }

  /**
   * Initialize persistence manager with automatic adapter selection
   * @param {Object} config - Configuration options
   */
  async initialize(config = {}) {
    if (this.isInitialized) {
      return true
    }

    this.config = { ...this.config, ...config }

    try {
      // Check availability of adapters
      const availability = await PersistenceFactory.checkAvailability()
      console.log('Persistence adapter availability:', availability)

      // Initialize primary adapter
      if (availability[this.config.preferredAdapter]) {
        try {
          this.primaryAdapter = PersistenceFactory.createAdapter(
            this.config.preferredAdapter,
            {
              dbName: 'MemoryPalaceDB',
              storeName: 'palace_data',
              keyPrefix: 'palais'
            }
          )
          await this.primaryAdapter.initialize()
          console.log(`Primary persistence adapter initialized: ${this.config.preferredAdapter}`)
        } catch (error) {
          console.warn(`Failed to initialize primary adapter (${this.config.preferredAdapter}):`, error)
          this.primaryAdapter = null
        }
      }

      // Initialize fallback adapter
      if (availability[this.config.fallbackAdapter] && this.config.fallbackAdapter !== this.config.preferredAdapter) {
        try {
          this.fallbackAdapter = PersistenceFactory.createAdapter(
            this.config.fallbackAdapter,
            { keyPrefix: 'palais' }
          )
          await this.fallbackAdapter.initialize()
          console.log(`Fallback persistence adapter initialized: ${this.config.fallbackAdapter}`)
        } catch (error) {
          console.warn(`Failed to initialize fallback adapter (${this.config.fallbackAdapter}):`, error)
          this.fallbackAdapter = null
        }
      }

      // Migrate data if needed
      await this.migrateFromLegacyStorage()

      // Set up automatic compaction
      if (this.config.autoCompact && this.primaryAdapter?.compact) {
        this.setupAutoCompaction()
      }

      this.isInitialized = true
      this.notifyListeners('initialized', {
        primaryAdapter: this.primaryAdapter?.getInfo().name,
        fallbackAdapter: this.fallbackAdapter?.getInfo().name
      })

      return true
    } catch (error) {
      console.error('Failed to initialize persistence manager:', error)
      return false
    }
  }

  /**
   * Get the active adapter (primary or fallback)
   */
  getActiveAdapter() {
    return this.primaryAdapter || this.fallbackAdapter
  }

  /**
   * Load data using active adapter
   * @param {string} key - Optional key to load
   */
  async load(key = null) {
    const adapter = this.getActiveAdapter()
    if (!adapter) {
      throw new Error('No persistence adapter available')
    }

    try {
      return await adapter.load(key)
    } catch (error) {
      console.error('Failed to load data with primary adapter, trying fallback:', error)
      
      if (this.fallbackAdapter && adapter !== this.fallbackAdapter) {
        return await this.fallbackAdapter.load(key)
      }
      
      throw error
    }
  }

  /**
   * Save data using active adapter
   * @param {Object} data - Data to save
   */
  async save(data) {
    const adapter = this.getActiveAdapter()
    if (!adapter) {
      throw new Error('No persistence adapter available')
    }

    try {
      const success = await adapter.save(data)
      
      // Also save to fallback adapter if available (redundancy)
      if (this.fallbackAdapter && adapter !== this.fallbackAdapter) {
        try {
          await this.fallbackAdapter.save(data)
        } catch (fallbackError) {
          console.warn('Failed to save to fallback adapter:', fallbackError)
        }
      }
      
      return success
    } catch (error) {
      console.error('Failed to save data with primary adapter:', error)
      
      // Try fallback adapter
      if (this.fallbackAdapter && adapter !== this.fallbackAdapter) {
        return await this.fallbackAdapter.save(data)
      }
      
      throw error
    }
  }

  /**
   * Clear data using active adapter
   * @param {string} key - Optional key to clear
   */
  async clear(key = null) {
    const adapter = this.getActiveAdapter()
    if (!adapter) {
      throw new Error('No persistence adapter available')
    }

    const success = await adapter.clear(key)
    
    // Also clear from fallback adapter
    if (this.fallbackAdapter && adapter !== this.fallbackAdapter) {
      try {
        await this.fallbackAdapter.clear(key)
      } catch (fallbackError) {
        console.warn('Failed to clear from fallback adapter:', fallbackError)
      }
    }
    
    return success
  }

  /**
   * Get persistence statistics
   */
  async getStats() {
    const adapter = this.getActiveAdapter()
    if (!adapter) {
      return { error: 'No adapter available' }
    }

    const stats = {
      adapterInfo: adapter.getInfo(),
      availability: await PersistenceFactory.checkAvailability()
    }

    // Get usage stats if available (IndexedDB)
    if (adapter.getUsageStats) {
      try {
        stats.usage = await adapter.getUsageStats()
      } catch (error) {
        stats.usage = { error: error.message }
      }
    }

    return stats
  }

  /**
   * Compact storage (if supported by adapter)
   * @param {Object} options - Compaction options
   */
  async compact(options = {}) {
    const adapter = this.getActiveAdapter()
    if (!adapter || !adapter.compact) {
      return { message: 'Compaction not supported by current adapter' }
    }

    try {
      const result = await adapter.compact({
        maxAge: this.config.maxAge,
        ...options
      })
      
      this.notifyListeners('compacted', result)
      return result
    } catch (error) {
      console.error('Compaction failed:', error)
      return { error: error.message }
    }
  }

  /**
   * Save conversation to specialized storage (if supported)
   * @param {Object} conversation - Conversation data
   */
  async saveConversation(conversation) {
    const adapter = this.getActiveAdapter()
    
    if (adapter && adapter.saveConversation) {
      return await adapter.saveConversation(conversation)
    }
    
    // Fallback to regular storage
    const conversationId = `conversation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    await this.save({ [conversationId]: conversation })
    return conversationId
  }

  /**
   * Get conversation history (if supported)
   * @param {Object} filter - Filter options
   */
  async getConversationHistory(filter = {}) {
    const adapter = this.getActiveAdapter()
    
    if (adapter && adapter.getConversationHistory) {
      return await adapter.getConversationHistory(filter)
    }
    
    // Fallback: search regular storage for conversation keys
    const allData = await this.load()
    const conversations = []
    
    for (const [key, value] of Object.entries(allData)) {
      if (key.startsWith('conversation_') && value.timestamp) {
        conversations.push({ id: key, ...value })
      }
    }
    
    return conversations.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
  }

  /**
   * Cache media file (if supported)
   * @param {string} url - Media URL
   * @param {Blob} blob - Media data
   * @param {Object} metadata - Additional metadata
   */
  async cacheMedia(url, blob, metadata = {}) {
    const adapter = this.getActiveAdapter()
    
    if (adapter && adapter.cacheMedia) {
      return await adapter.cacheMedia(url, blob, metadata)
    }
    
    console.warn('Media caching not supported by current persistence adapter')
    return false
  }

  /**
   * Get cached media file (if supported)
   * @param {string} url - Media URL
   */
  async getCachedMedia(url) {
    const adapter = this.getActiveAdapter()
    
    if (adapter && adapter.getCachedMedia) {
      return await adapter.getCachedMedia(url)
    }
    
    return null
  }

  /**
   * Migrate data from legacy localStorage storage
   */
  async migrateFromLegacyStorage() {
    if (!this.primaryAdapter || this.config.preferredAdapter === 'localStorage') {
      return // No migration needed
    }

    try {
      // Check if legacy data exists
      const hasLegacyData = ['USER_STATE', 'ROOMS', 'OBJECTS', 'CONNECTIONS', 'CONVERSATION_CONTEXT']
        .some(key => localStorage.getItem(`palais_${key}`))

      if (hasLegacyData) {
        console.log('Migrating data from localStorage to IndexedDB...')
        
        // Load legacy data
        const legacyData = {}
        ;['USER_STATE', 'ROOMS', 'OBJECTS', 'CONNECTIONS', 'CONVERSATION_CONTEXT'].forEach(key => {
          const stored = localStorage.getItem(`palais_${key}`)
          if (stored) {
            try {
              legacyData[key] = JSON.parse(stored)
            } catch (error) {
              console.warn(`Failed to parse legacy data for ${key}:`, error)
            }
          }
        })

        if (Object.keys(legacyData).length > 0) {
          // Save to new adapter
          await this.primaryAdapter.save(legacyData)
          
          // Backup localStorage data before clearing (in case rollback needed)
          localStorage.setItem('palais_migration_backup', JSON.stringify(legacyData))
          
          // Clear legacy data (optional - keep for safety)
          // Object.keys(legacyData).forEach(key => {
          //   localStorage.removeItem(`palais_${key}`)
          // })
          
          console.log(`Migrated ${Object.keys(legacyData).length} data keys to IndexedDB`)
          this.notifyListeners('migrated', { keys: Object.keys(legacyData) })
        }
      }
    } catch (error) {
      console.error('Data migration failed:', error)
      // Don't fail initialization due to migration issues
    }
  }

  /**
   * Set up automatic compaction
   */
  setupAutoCompaction() {
    setInterval(async () => {
      try {
        const result = await this.compact()
        if (result.removedItems > 0) {
          console.log(`Auto-compaction removed ${result.removedItems} items, freed ${result.freedSpace} bytes`)
        }
      } catch (error) {
        console.error('Auto-compaction failed:', error)
      }
    }, this.config.compactInterval)

    console.log(`Auto-compaction scheduled every ${this.config.compactInterval / (60 * 60 * 1000)} hours`)
  }

  /**
   * Switch primary adapter (for testing or configuration changes)
   * @param {string} adapterType - New adapter type
   */
  async switchAdapter(adapterType) {
    try {
      const newAdapter = PersistenceFactory.createAdapter(adapterType)
      await newAdapter.initialize()
      
      // Migrate existing data to new adapter
      if (this.primaryAdapter) {
        const existingData = await this.primaryAdapter.load()
        if (Object.keys(existingData).length > 0) {
          await newAdapter.save(existingData)
          console.log(`Migrated data to new ${adapterType} adapter`)
        }
      }
      
      // Dispose old adapter
      if (this.primaryAdapter?.dispose) {
        await this.primaryAdapter.dispose()
      }
      
      this.primaryAdapter = newAdapter
      this.notifyListeners('adapter_switched', { newAdapter: adapterType })
      
      return true
    } catch (error) {
      console.error(`Failed to switch to ${adapterType} adapter:`, error)
      return false
    }
  }

  /**
   * Add event listener
   */
  addEventListener(callback) {
    this.listeners.add(callback)
  }

  /**
   * Remove event listener
   */
  removeEventListener(callback) {
    this.listeners.delete(callback)
  }

  /**
   * Notify all listeners
   */
  notifyListeners(type, data) {
    this.listeners.forEach(callback => {
      try {
        callback(type, data)
      } catch (error) {
        console.error('Persistence manager listener error:', error)
      }
    })
  }

  /**
   * Dispose of persistence manager and adapters
   */
  async dispose() {
    if (this.primaryAdapter?.dispose) {
      await this.primaryAdapter.dispose()
    }
    
    if (this.fallbackAdapter?.dispose) {
      await this.fallbackAdapter.dispose()
    }
    
    this.listeners.clear()
    this.isInitialized = false
    
    console.log('Persistence manager disposed')
  }
}

// Singleton instance
export const persistenceManager = new PersistenceManager()

export default persistenceManager