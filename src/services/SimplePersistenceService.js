/**
 * Simplified Persistence Service for Memory Palace Application
 * Replaces the complex PersistenceInterface/Manager/Factory pattern
 * with a single, direct service that handles both localStorage and IndexedDB
 */

/**
 * Simple persistence service with automatic fallback
 */
export class PersistenceService {
  constructor(keyPrefix = 'palais') {
    this.keyPrefix = keyPrefix
    this.isInitialized = false
    this.useIndexedDB = false
    this.db = null
    this.dbName = 'MemoryPalaceDB'
    this.storeName = 'palace_data'
  }

  /**
   * Initialize persistence service with automatic adapter selection
   */
  async initialize() {
    if (this.isInitialized) {
      return true
    }

    // Try IndexedDB first
    if (this.isIndexedDBAvailable()) {
      try {
        await this.initializeIndexedDB()
        this.useIndexedDB = true
        console.log('PersistenceService: Using IndexedDB')
      } catch (error) {
        console.warn('Failed to initialize IndexedDB, falling back to localStorage:', error)
        this.useIndexedDB = false
      }
    } else {
      this.useIndexedDB = false
      console.log('PersistenceService: Using localStorage')
    }

    // Migrate legacy data if needed
    await this.migrateLegacyData()

    this.isInitialized = true
    return true
  }

  /**
   * Check if IndexedDB is available
   */
  isIndexedDBAvailable() {
    return typeof window !== 'undefined' && 'indexedDB' in window
  }

  /**
   * Initialize IndexedDB
   */
  async initializeIndexedDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1)
      
      // Add timeout to prevent hanging
      const timeout = setTimeout(() => {
        reject(new Error('IndexedDB initialization timeout'))
      }, 5000)
      
      request.onerror = () => {
        clearTimeout(timeout)
        reject(request.error)
      }
      request.onsuccess = () => {
        clearTimeout(timeout)
        this.db = request.result
        resolve()
      }
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName)
        }
      }
    })
  }

  /**
   * Load data from persistence
   */
  async load(key = null) {
    if (!this.isInitialized) {
      await this.initialize()
    }

    if (this.useIndexedDB) {
      return this.loadFromIndexedDB(key)
    } else {
      return this.loadFromLocalStorage(key)
    }
  }

  /**
   * Save data to persistence
   */
  async save(data) {
    if (!this.isInitialized) {
      await this.initialize()
    }

    if (this.useIndexedDB) {
      return this.saveToIndexedDB(data)
    } else {
      return this.saveToLocalStorage(data)
    }
  }

  /**
   * Clear data from persistence
   */
  async clear(key = null) {
    if (!this.isInitialized) {
      await this.initialize()
    }

    if (this.useIndexedDB) {
      return this.clearFromIndexedDB(key)
    } else {
      return this.clearFromLocalStorage(key)
    }
  }

  // IndexedDB operations
  async loadFromIndexedDB(key = null) {
    const transaction = this.db.transaction([this.storeName], 'readonly')
    const store = transaction.objectStore(this.storeName)
    
    if (key) {
      return new Promise((resolve, reject) => {
        const request = store.get(key)
        request.onsuccess = () => {
          const result = request.result ? { [key]: request.result } : {}
          resolve(result)
        }
        request.onerror = () => reject(request.error)
      })
    } else {
      return new Promise((resolve, reject) => {
        const request = store.getAll()
        const keyRequest = store.getAllKeys()
        let data = {}
        let completed = 0
        
        const checkComplete = () => {
          if (++completed === 2) resolve(data)
        }
        
        request.onsuccess = () => {
          const values = request.result
          keyRequest.onsuccess = () => {
            const keys = keyRequest.result
            keys.forEach((key, index) => {
              data[key] = values[index]
            })
            checkComplete()
          }
          keyRequest.onerror = () => reject(keyRequest.error)
        }
        request.onerror = () => reject(request.error)
      })
    }
  }

  async saveToIndexedDB(data) {
    const transaction = this.db.transaction([this.storeName], 'readwrite')
    const store = transaction.objectStore(this.storeName)
    
    const promises = Object.entries(data).map(([key, value]) => {
      return new Promise((resolve, reject) => {
        const request = store.put(value, key)
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })
    })

    try {
      await Promise.all(promises)
      return true
    } catch (error) {
      console.error('Failed to save to IndexedDB:', error)
      return false
    }
  }

  async clearFromIndexedDB(key = null) {
    const transaction = this.db.transaction([this.storeName], 'readwrite')
    const store = transaction.objectStore(this.storeName)
    
    return new Promise((resolve, reject) => {
      const request = key ? store.delete(key) : store.clear()
      request.onsuccess = () => resolve(true)
      request.onerror = () => {
        console.error('Failed to clear from IndexedDB:', request.error)
        resolve(false)
      }
    })
  }

  // localStorage operations
  async loadFromLocalStorage(key = null) {
    try {
      const data = {}
      
      if (key) {
        const stored = localStorage.getItem(`${this.keyPrefix}_${key}`)
        if (stored) {
          data[key] = JSON.parse(stored)
        }
      } else {
        for (let i = 0; i < localStorage.length; i++) {
          const storageKey = localStorage.key(i)
          if (storageKey?.startsWith(`${this.keyPrefix}_`)) {
            const dataKey = storageKey.replace(`${this.keyPrefix}_`, '')
            const stored = localStorage.getItem(storageKey)
            if (stored) {
              data[dataKey] = JSON.parse(stored)
            }
          }
        }
      }
      
      return data
    } catch (error) {
      console.error('Failed to load from localStorage:', error)
      return {}
    }
  }

  async saveToLocalStorage(data) {
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

  async clearFromLocalStorage(key = null) {
    try {
      if (key) {
        localStorage.removeItem(`${this.keyPrefix}_${key}`)
      } else {
        const keysToRemove = []
        for (let i = 0; i < localStorage.length; i++) {
          const storageKey = localStorage.key(i)
          if (storageKey?.startsWith(`${this.keyPrefix}_`)) {
            keysToRemove.push(storageKey)
          }
        }
        keysToRemove.forEach(k => localStorage.removeItem(k))
      }
      return true
    } catch (error) {
      console.error('Failed to clear from localStorage:', error)
      return false
    }
  }

  /**
   * Migrate legacy data from old storage format
   */
  async migrateLegacyData() {
    try {
      const legacyKeys = ['USER_STATE', 'ROOMS', 'OBJECTS', 'CONNECTIONS', 'CONVERSATION_CONTEXT']
      const legacyData = {}
      
      let hasData = false
      for (const key of legacyKeys) {
        const stored = localStorage.getItem(`palais_${key}`)
        if (stored) {
          try {
            legacyData[key] = JSON.parse(stored)
            hasData = true
          } catch (error) {
            console.warn(`Failed to parse legacy data for ${key}:`, error)
          }
        }
      }

      if (hasData) {
        console.log('Migrating legacy data...')
        await this.save(legacyData)
        
        // Keep backup of migrated data
        localStorage.setItem('palais_migration_backup', JSON.stringify(legacyData))
        console.log('Legacy data migration completed')
      }
    } catch (error) {
      console.error('Legacy data migration failed:', error)
    }
  }

  /**
   * Get persistence info
   */
  getInfo() {
    return {
      type: this.useIndexedDB ? 'indexedDB' : 'localStorage',
      initialized: this.isInitialized,
      keyPrefix: this.keyPrefix
    }
  }

  /**
   * Dispose of resources
   */
  async dispose() {
    if (this.db) {
      this.db.close()
      this.db = null
    }
    this.isInitialized = false
  }
}

// Export singleton instance for convenience
export const persistenceService = new PersistenceService()

export default persistenceService