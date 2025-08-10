/**
 * IndexedDB Persistence Adapter for Memory Palace Application
 * Provides robust local storage with larger capacity and better performance
 */

import { PersistenceAdapter, PersistenceFactory } from './PersistenceInterface.js'

/**
 * IndexedDB adapter implementation
 * Supports structured data storage with better performance than localStorage
 */
export class IndexedDBAdapter extends PersistenceAdapter {
  constructor(config = {}) {
    super()
    this.dbName = config.dbName || 'MemoryPalaceDB'
    this.dbVersion = config.dbVersion || 1
    this.storeName = config.storeName || 'palace_data'
    this.db = null
    this.isInitialized = false
    
    // Storage schema for different data types
    this.stores = [
      {
        name: 'palace_data',
        keyPath: 'key',
        description: 'Main palace data storage'
      },
      {
        name: 'media_cache',
        keyPath: 'url',
        description: 'Cached images and media files'
      },
      {
        name: 'conversation_history',
        keyPath: 'id',
        autoIncrement: true,
        description: 'Voice interaction history'
      }
    ]
  }

  async initialize(config = {}) {
    if (this.isInitialized && this.db) {
      return true
    }

    // Override config if provided
    this.dbName = config.dbName || this.dbName
    this.dbVersion = config.dbVersion || this.dbVersion
    this.storeName = config.storeName || this.storeName

    if (!await this.isAvailable()) {
      throw new Error('IndexedDB not available in this environment')
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion)

      request.onerror = () => {
        console.error('Failed to open IndexedDB:', request.error)
        reject(new Error(`IndexedDB error: ${request.error?.message || 'Unknown error'}`))
      }

      request.onsuccess = () => {
        this.db = request.result
        this.isInitialized = true
        console.log(`IndexedDB initialized: ${this.dbName} v${this.dbVersion}`)
        resolve(true)
      }

      request.onupgradeneeded = (event) => {
        const db = event.target.result
        console.log(`Upgrading IndexedDB from version ${event.oldVersion} to ${event.newVersion}`)

        // Create object stores
        this.stores.forEach(storeConfig => {
          if (!db.objectStoreNames.contains(storeConfig.name)) {
            const store = db.createObjectStore(storeConfig.name, {
              keyPath: storeConfig.keyPath,
              autoIncrement: storeConfig.autoIncrement || false
            })
            
            // Add indices if needed
            if (storeConfig.name === 'conversation_history') {
              store.createIndex('timestamp', 'timestamp', { unique: false })
              store.createIndex('type', 'type', { unique: false })
            }
            
            console.log(`Created object store: ${storeConfig.name}`)
          }
        })
      }

      request.onblocked = () => {
        console.warn('IndexedDB upgrade blocked - close other tabs using this database')
        reject(new Error('IndexedDB upgrade blocked'))
      }
    })
  }

  async load(key = null) {
    if (!this.isInitialized) {
      throw new Error('IndexedDB not initialized')
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readonly')
      const store = transaction.objectStore(this.storeName)
      const data = {}

      if (key) {
        // Load specific key
        const request = store.get(key)
        
        request.onsuccess = () => {
          if (request.result) {
            data[key] = request.result.value
          }
          resolve(data)
        }
        
        request.onerror = () => {
          console.error(`Failed to load key ${key}:`, request.error)
          reject(new Error(`IndexedDB load error: ${request.error?.message}`))
        }
      } else {
        // Load all data
        const request = store.getAll()
        
        request.onsuccess = () => {
          request.result.forEach(item => {
            data[item.key] = item.value
          })
          resolve(data)
        }
        
        request.onerror = () => {
          console.error('Failed to load all data:', request.error)
          reject(new Error(`IndexedDB load error: ${request.error?.message}`))
        }
      }
    })
  }

  async save(data) {
    if (!this.isInitialized) {
      throw new Error('IndexedDB not initialized')
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite')
      const store = transaction.objectStore(this.storeName)
      
      let completedOperations = 0
      const totalOperations = Object.keys(data).length
      let hasError = false

      if (totalOperations === 0) {
        resolve(true)
        return
      }

      // Handle transaction completion
      transaction.oncomplete = () => {
        if (!hasError) {
          resolve(true)
        }
      }

      transaction.onerror = () => {
        console.error('IndexedDB save transaction failed:', transaction.error)
        if (!hasError) {
          hasError = true
          reject(new Error(`IndexedDB save error: ${transaction.error?.message}`))
        }
      }

      // Save each key-value pair
      for (const [key, value] of Object.entries(data)) {
        if (value !== undefined) {
          const request = store.put({
            key: key,
            value: this.serializeValue(value),
            timestamp: new Date().toISOString(),
            size: this.calculateSize(value)
          })

          request.onsuccess = () => {
            completedOperations++
            if (completedOperations === totalOperations && !hasError) {
              // All operations completed successfully
              // Transaction will trigger oncomplete
            }
          }

          request.onerror = () => {
            console.error(`Failed to save key ${key}:`, request.error)
            if (!hasError) {
              hasError = true
              reject(new Error(`IndexedDB save error for ${key}: ${request.error?.message}`))
            }
          }
        } else {
          completedOperations++
        }
      }
    })
  }

  async clear(key = null) {
    if (!this.isInitialized) {
      throw new Error('IndexedDB not initialized')
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite')
      const store = transaction.objectStore(this.storeName)

      let request
      if (key) {
        // Clear specific key
        request = store.delete(key)
      } else {
        // Clear all data
        request = store.clear()
      }

      request.onsuccess = () => {
        console.log(key ? `Cleared key: ${key}` : 'Cleared all data')
        resolve(true)
      }

      request.onerror = () => {
        const errorMsg = key ? `Failed to clear key ${key}` : 'Failed to clear all data'
        console.error(`${errorMsg}:`, request.error)
        reject(new Error(`IndexedDB clear error: ${request.error?.message}`))
      }
    })
  }

  async isAvailable() {
    try {
      return 'indexedDB' in window && indexedDB !== null
    } catch (error) {
      return false
    }
  }

  getInfo() {
    return {
      name: 'IndexedDBAdapter',
      type: 'local',
      persistent: true,
      capacity: 'large', // Usually 50MB+ per origin
      synchronous: false,
      dbName: this.dbName,
      dbVersion: this.dbVersion,
      storeName: this.storeName,
      features: [
        'structured_data',
        'large_storage',
        'async_operations',
        'transactions',
        'indices',
        'versioning'
      ]
    }
  }

  /**
   * Get storage usage statistics
   * @returns {Promise<Object>} Storage usage information
   */
  async getUsageStats() {
    if (!this.isInitialized) {
      return { error: 'Not initialized' }
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readonly')
      const store = transaction.objectStore(this.storeName)
      const request = store.getAll()

      request.onsuccess = () => {
        const items = request.result
        const stats = {
          totalItems: items.length,
          totalSize: 0,
          oldestItem: null,
          newestItem: null,
          itemTypes: new Map()
        }

        items.forEach(item => {
          // Calculate approximate size
          stats.totalSize += item.size || this.calculateSize(item.value)
          
          // Track timestamps
          if (item.timestamp) {
            const timestamp = new Date(item.timestamp)
            if (!stats.oldestItem || timestamp < new Date(stats.oldestItem)) {
              stats.oldestItem = item.timestamp
            }
            if (!stats.newestItem || timestamp > new Date(stats.newestItem)) {
              stats.newestItem = item.timestamp
            }
          }

          // Track item types (based on key prefixes)
          const keyType = item.key.split('_')[0] || 'unknown'
          stats.itemTypes.set(keyType, (stats.itemTypes.get(keyType) || 0) + 1)
        })

        resolve(stats)
      }

      request.onerror = () => {
        reject(new Error(`Failed to get usage stats: ${request.error?.message}`))
      }
    })
  }

  /**
   * Compact database by removing old or unnecessary data
   * @param {Object} options - Compaction options
   * @returns {Promise<Object>} Compaction results
   */
  async compact(options = {}) {
    const maxAge = options.maxAge || (30 * 24 * 60 * 60 * 1000) // 30 days default
    const maxItems = options.maxItems || 10000
    const cutoffDate = new Date(Date.now() - maxAge)

    const stats = await this.getUsageStats()
    let removedItems = 0
    let freedSpace = 0

    if (stats.totalItems > maxItems || (stats.oldestItem && new Date(stats.oldestItem) < cutoffDate)) {
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([this.storeName], 'readwrite')
        const store = transaction.objectStore(this.storeName)
        const request = store.getAll()

        request.onsuccess = () => {
          const items = request.result
          
          // Sort by timestamp (oldest first)
          items.sort((a, b) => {
            const aTime = a.timestamp ? new Date(a.timestamp) : new Date(0)
            const bTime = b.timestamp ? new Date(b.timestamp) : new Date(0)
            return aTime - bTime
          })

          // Determine items to remove
          const itemsToRemove = []
          
          if (items.length > maxItems) {
            itemsToRemove.push(...items.slice(0, items.length - maxItems))
          }

          items.forEach(item => {
            if (item.timestamp && new Date(item.timestamp) < cutoffDate) {
              if (!itemsToRemove.includes(item)) {
                itemsToRemove.push(item)
              }
            }
          })

          // Remove items
          let deleteOps = 0
          itemsToRemove.forEach(item => {
            const deleteRequest = store.delete(item.key)
            deleteOps++
            
            deleteRequest.onsuccess = () => {
              removedItems++
              freedSpace += item.size || this.calculateSize(item.value)
              
              if (removedItems === itemsToRemove.length) {
                resolve({
                  removedItems,
                  freedSpace,
                  remainingItems: stats.totalItems - removedItems
                })
              }
            }
          })

          if (itemsToRemove.length === 0) {
            resolve({ removedItems: 0, freedSpace: 0, remainingItems: stats.totalItems })
          }
        }

        request.onerror = () => {
          reject(new Error(`Compaction failed: ${request.error?.message}`))
        }
      })
    }

    return { removedItems: 0, freedSpace: 0, remainingItems: stats.totalItems }
  }

  /**
   * Save conversation history with automatic indexing
   * @param {Object} conversation - Conversation data
   * @returns {Promise<number>} Conversation ID
   */
  async saveConversation(conversation) {
    if (!this.isInitialized) {
      throw new Error('IndexedDB not initialized')
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['conversation_history'], 'readwrite')
      const store = transaction.objectStore('conversation_history')
      
      const request = store.add({
        ...conversation,
        timestamp: new Date().toISOString(),
        size: this.calculateSize(conversation)
      })

      request.onsuccess = () => {
        resolve(request.result) // Auto-generated ID
      }

      request.onerror = () => {
        reject(new Error(`Failed to save conversation: ${request.error?.message}`))
      }
    })
  }

  /**
   * Get conversation history with filtering options
   * @param {Object} filter - Filter options
   * @returns {Promise<Object[]>} Conversation history
   */
  async getConversationHistory(filter = {}) {
    if (!this.isInitialized) {
      throw new Error('IndexedDB not initialized')
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['conversation_history'], 'readonly')
      const store = transaction.objectStore('conversation_history')
      
      let request
      if (filter.since) {
        const index = store.index('timestamp')
        request = index.getAll(IDBKeyRange.lowerBound(filter.since))
      } else {
        request = store.getAll()
      }

      request.onsuccess = () => {
        let results = request.result
        
        // Apply additional filters
        if (filter.type) {
          results = results.filter(item => item.type === filter.type)
        }
        
        if (filter.limit) {
          results = results.slice(-filter.limit) // Get most recent items
        }

        resolve(results)
      }

      request.onerror = () => {
        reject(new Error(`Failed to get conversation history: ${request.error?.message}`))
      }
    })
  }

  /**
   * Cache media file (images, audio) in IndexedDB
   * @param {string} url - Media URL
   * @param {Blob} blob - Media data
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<boolean>} Success status
   */
  async cacheMedia(url, blob, metadata = {}) {
    if (!this.isInitialized) {
      throw new Error('IndexedDB not initialized')
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['media_cache'], 'readwrite')
      const store = transaction.objectStore('media_cache')
      
      const request = store.put({
        url: url,
        blob: blob,
        metadata: metadata,
        timestamp: new Date().toISOString(),
        size: blob.size
      })

      request.onsuccess = () => {
        resolve(true)
      }

      request.onerror = () => {
        reject(new Error(`Failed to cache media: ${request.error?.message}`))
      }
    })
  }

  /**
   * Get cached media file
   * @param {string} url - Media URL
   * @returns {Promise<Blob|null>} Cached media or null if not found
   */
  async getCachedMedia(url) {
    if (!this.isInitialized) {
      throw new Error('IndexedDB not initialized')
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['media_cache'], 'readonly')
      const store = transaction.objectStore('media_cache')
      
      const request = store.get(url)

      request.onsuccess = () => {
        resolve(request.result ? request.result.blob : null)
      }

      request.onerror = () => {
        reject(new Error(`Failed to get cached media: ${request.error?.message}`))
      }
    })
  }

  /**
   * Serialize value for storage (handle Maps, complex objects)
   * @param {any} value - Value to serialize
   * @returns {any} Serialized value
   */
  serializeValue(value) {
    if (value instanceof Map) {
      return {
        __type: 'Map',
        data: Array.from(value.entries())
      }
    } else if (value instanceof Set) {
      return {
        __type: 'Set',
        data: Array.from(value)
      }
    } else if (value instanceof Date) {
      return {
        __type: 'Date',
        data: value.toISOString()
      }
    }
    return value
  }

  /**
   * Deserialize value from storage
   * @param {any} value - Stored value
   * @returns {any} Deserialized value
   */
  deserializeValue(value) {
    if (value && typeof value === 'object' && value.__type) {
      switch (value.__type) {
        case 'Map':
          return new Map(value.data)
        case 'Set':
          return new Set(value.data)
        case 'Date':
          return new Date(value.data)
      }
    }
    return value
  }

  /**
   * Calculate approximate size of data
   * @param {any} data - Data to measure
   * @returns {number} Size in bytes (approximate)
   */
  calculateSize(data) {
    try {
      return JSON.stringify(data).length * 2 // Rough estimate (UTF-16)
    } catch (error) {
      return 0
    }
  }

  async dispose() {
    if (this.db) {
      this.db.close()
      this.db = null
    }
    this.isInitialized = false
    console.log('IndexedDB adapter disposed')
  }
}

// Register the IndexedDB adapter with the factory
PersistenceFactory.registerAdapter('indexedDB', IndexedDBAdapter)

export default IndexedDBAdapter