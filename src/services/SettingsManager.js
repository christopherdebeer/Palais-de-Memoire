/**
 * Enhanced Settings Manager for Memory Palace Application
 * Handles localStorage persistence, API token management, and settings validation
 */

import { persistenceManager } from './PersistenceManager.js'

export class SettingsManager {
  constructor() {
    this.storageKey = 'memoryPalace_settings'
    this.persistenceStorageKey = 'SETTINGS'
    this.usePersistenceManager = false
    this.defaultSettings = {
      // Voice Settings
      voice: '',
      speechRate: 1.0,
      speechPitch: 1.0,
      
      // AI/LLM Settings
      selectedModel: 'claude-3-sonnet-20240229',
      systemPrompt: `You are a Memory Palace AI assistant. Help users create immersive 3D memory spaces using voice commands. Process commands for creating rooms, adding objects, and navigating between memory spaces. Be conversational and supportive.`,
      responseTemperature: 0.7,
      
      // Image Generation Settings
      aestheticPrompt: 'Professional architectural photography, clean modern interior design, soft natural lighting, high detail, immersive environment',
      
      // API Configuration
      anthropicApiKey: '',
      replicateApiKey: '',
      
      // Application Settings
      wireframeMode: false,
      touchJoystick: false,
      debugMode: false,
      
      // Performance Settings
      renderQuality: 'high', // 'low', 'medium', 'high'
      particleEffects: true,
      audioFeedback: true,
      
      // Persistence Settings
      persistenceType: 'indexedDB', // 'localStorage', 'indexedDB'
      autoBackup: true,
      maxBackupAge: 30 // days
    }
    
    this.settings = this.loadSettings()
    this.listeners = new Set()
    this.isInitializing = false
    
    // Initialize persistence manager integration synchronously
    // This prevents race conditions during component initialization
    this.initializePersistenceSync()
  }
  
  /**
   * Initialize persistence manager synchronously to avoid race conditions
   * This prevents settings from being overwritten during component initialization
   */
  initializePersistenceSync() {
    // Mark as initializing to prevent API calls during setup
    this.isInitializing = true
    
    // Defer async persistence initialization to avoid race condition
    // Components should be able to read settings immediately after constructor
    setTimeout(async () => {
      try {
        await this.initializePersistenceAsync()
      } finally {
        this.isInitializing = false
        // Notify listeners that initialization is complete
        this.notifyListeners('initialization_complete', this.settings)
      }
    }, 0)
  }
  
  /**
   * Async persistence initialization (deferred)
   */
  async initializePersistenceAsync() {
    try {
      if (persistenceManager && !persistenceManager.isInitialized) {
        await persistenceManager.initialize({
          preferredAdapter: this.settings.persistenceType || 'indexedDB'
        })
      }
      
      // Migrate settings to persistence manager if configured
      // Only if localStorage settings exist and persistence manager is ready
      if (this.settings.persistenceType !== 'localStorage' && persistenceManager.isInitialized) {
        await this.migrateToPersistenceManager()
      }
    } catch (error) {
      console.warn('Failed to initialize persistence integration:', error)
    }
  }

  /**
   * Load settings from localStorage with validation
   */
  loadSettings() {
    try {
      const stored = localStorage.getItem(this.storageKey)
      if (stored) {
        const parsed = JSON.parse(stored)
        // Merge with defaults to handle new settings
        return { ...this.defaultSettings, ...parsed }
      }
    } catch (error) {
      console.warn('Failed to load settings from localStorage:', error)
    }
    return { ...this.defaultSettings }
  }
  
  /**
   * Load settings from persistence manager
   */
  async loadSettingsFromPersistence() {
    try {
      if (persistenceManager?.isInitialized) {
        const data = await persistenceManager.load(this.persistenceStorageKey)
        if (data && data[this.persistenceStorageKey]) {
          return { ...this.defaultSettings, ...data[this.persistenceStorageKey] }
        }
      }
    } catch (error) {
      console.warn('Failed to load settings from persistence manager:', error)
    }
    return null
  }

  /**
   * Save settings to localStorage
   */
  saveSettings() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.settings))
      
      // Also save to persistence manager if configured
      this.saveSettingsToPersistence()
      
      this.notifyListeners('settings_saved', this.settings)
      return true
    } catch (error) {
      console.error('Failed to save settings to localStorage:', error)
      this.notifyListeners('settings_save_error', error)
      return false
    }
  }
  
  /**
   * Save settings to persistence manager
   */
  async saveSettingsToPersistence() {
    try {
      if (this.usePersistenceManager && persistenceManager?.isInitialized) {
        await persistenceManager.save({
          [this.persistenceStorageKey]: this.settings
        })
      }
    } catch (error) {
      console.warn('Failed to save settings to persistence manager:', error)
    }
  }

  /**
   * Get a specific setting value
   */
  get(key) {
    return this.settings[key]
  }

  /**
   * Set a specific setting value
   */
  set(key, value) {
    const oldValue = this.settings[key]
    this.settings[key] = value
    
    // Auto-save after each change
    this.saveSettings()
    
    this.notifyListeners('setting_changed', {
      key,
      oldValue,
      newValue: value
    })
  }

  /**
   * Update multiple settings at once
   */
  updateSettings(newSettings) {
    const changes = {}
    
    for (const [key, value] of Object.entries(newSettings)) {
      if (this.settings[key] !== value) {
        changes[key] = {
          oldValue: this.settings[key],
          newValue: value
        }
        this.settings[key] = value
      }
    }
    
    if (Object.keys(changes).length > 0) {
      this.saveSettings()
      this.notifyListeners('settings_updated', changes)
    }
  }

  /**
   * Reset settings to defaults
   */
  resetSettings() {
    this.settings = { ...this.defaultSettings }
    this.saveSettings()
    this.notifyListeners('settings_reset', this.settings)
  }
  
  /**
   * Migrate settings from localStorage to persistence manager
   */
  async migrateToPersistenceManager() {
    try {
      // Check if settings exist in persistence manager
      const persistedSettings = await this.loadSettingsFromPersistence()
      
      if (!persistedSettings && persistenceManager?.isInitialized) {
        // Migrate current settings
        await persistenceManager.save({
          [this.persistenceStorageKey]: this.settings
        })
        
        this.usePersistenceManager = true
        console.log('Settings migrated to persistence manager')
        this.notifyListeners('settings_migrated', { target: 'persistence_manager' })
      } else if (persistedSettings) {
        // Use persisted settings
        this.settings = persistedSettings
        this.usePersistenceManager = true
        console.log('Loaded settings from persistence manager')
      }
    } catch (error) {
      console.error('Failed to migrate settings to persistence manager:', error)
    }
  }
  
  /**
   * Switch persistence method
   */
  async switchPersistence(persistenceType) {
    try {
      if (persistenceType === 'localStorage') {
        this.usePersistenceManager = false
        this.set('persistenceType', 'localStorage')
      } else {
        if (persistenceManager && !persistenceManager.isInitialized) {
          await persistenceManager.initialize({ preferredAdapter: persistenceType })
        }
        
        if (persistenceManager.isInitialized) {
          await this.migrateToPersistenceManager()
          this.set('persistenceType', persistenceType)
        } else {
          throw new Error(`Failed to initialize ${persistenceType} persistence`)
        }
      }
      
      this.notifyListeners('persistence_switched', { type: persistenceType })
      return true
    } catch (error) {
      console.error('Failed to switch persistence:', error)
      this.notifyListeners('persistence_switch_error', error)
      return false
    }
  }

  /**
   * Get all settings
   */
  getAllSettings() {
    return { ...this.settings }
  }

  /**
   * Validate API configuration
   */
  validateApiConfiguration() {
    const errors = []
    
    if (!this.settings.anthropicApiKey) {
      errors.push('Anthropic API key is required for LLM functionality')
    }
    
    if (!this.settings.replicateApiKey) {
      errors.push('Replicate API key is required for image generation')
    }
    
    return {
      isValid: errors.length === 0,
      errors
    }
  }

  /**
   * Check if APIs are configured with defensive validation
   */
  isApiConfigured() {
    // Prevent API calls during initialization to avoid race conditions
    if (this.isInitializing) {
      console.warn('[SettingsManager] API configuration check blocked - initialization in progress')
      return false
    }
    
    const anthropicKey = this.settings.anthropicApiKey
    const replicateKey = this.settings.replicateApiKey
    
    // Validate keys are not just whitespace or empty
    const isAnthropicValid = anthropicKey && typeof anthropicKey === 'string' && anthropicKey.trim().length > 0
    const isReplicateValid = replicateKey && typeof replicateKey === 'string' && replicateKey.trim().length > 0
    
    const result = !!(isAnthropicValid && isReplicateValid)
    
    console.log('[SettingsManager] API configuration check:', {
      anthropicValid: isAnthropicValid,
      replicateValid: isReplicateValid,
      result,
      isInitializing: this.isInitializing
    })
    
    return result
  }
  
  /**
   * Check if Anthropic API specifically is configured (for voice interface)
   */
  isAnthropicConfigured() {
    if (this.isInitializing) {
      console.warn('[SettingsManager] Anthropic configuration check blocked - initialization in progress')
      return false
    }
    
    const anthropicKey = this.settings.anthropicApiKey
    const isValid = anthropicKey && typeof anthropicKey === 'string' && anthropicKey.trim().length > 0
    
    console.log('[SettingsManager] Anthropic configuration check:', {
      hasKey: !!anthropicKey,
      isValid,
      keyLength: anthropicKey ? anthropicKey.length : 0,
      isInitializing: this.isInitializing
    })
    
    return isValid
  }

  /**
   * Get API headers for Anthropic
   */
  getAnthropicHeaders() {
    return {
      'Content-Type': 'application/json',
      'x-api-key': this.settings.anthropicApiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    }
  }

  /**
   * Get API headers for Replicate
   */
  getReplicateHeaders() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Token ${this.settings.replicateApiKey}`
    }
  }
  
  /**
   * Get persistence statistics
   */
  async getPersistenceStats() {
    try {
      if (this.usePersistenceManager && persistenceManager?.isInitialized) {
        return await persistenceManager.getStats()
      }
      
      // Fallback: localStorage statistics
      let totalSize = 0
      let itemCount = 0
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith('palais_')) {
          const value = localStorage.getItem(key)
          totalSize += value ? value.length : 0
          itemCount++
        }
      }
      
      return {
        adapterInfo: {
          name: 'localStorage',
          type: 'local',
          capacity: 'limited'
        },
        usage: {
          totalItems: itemCount,
          totalSize: totalSize
        }
      }
    } catch (error) {
      return { error: error.message }
    }
  }
  
  /**
   * Compact persistence storage (if supported)
   */
  async compactStorage(options = {}) {
    try {
      if (this.usePersistenceManager && persistenceManager?.isInitialized) {
        return await persistenceManager.compact(options)
      }
      
      return { message: 'Compaction not available for localStorage' }
    } catch (error) {
      return { error: error.message }
    }
  }

  /**
   * Export settings to file
   */
  exportSettings() {
    const settingsToExport = { ...this.settings }
    // Remove sensitive data from export
    delete settingsToExport.anthropicApiKey
    delete settingsToExport.replicateApiKey
    
    const blob = new Blob([JSON.stringify(settingsToExport, null, 2)], {
      type: 'application/json'
    })
    
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'memory-palace-settings.json'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  /**
   * Import settings from file
   */
  async importSettings(file) {
    try {
      const text = await file.text()
      const importedSettings = JSON.parse(text)
      
      // Validate imported settings
      const validSettings = {}
      for (const [key, value] of Object.entries(importedSettings)) {
        if (key in this.defaultSettings) {
          validSettings[key] = value
        }
      }
      
      // Don't overwrite API keys from import
      validSettings.anthropicApiKey = this.settings.anthropicApiKey
      validSettings.replicateApiKey = this.settings.replicateApiKey
      
      this.updateSettings(validSettings)
      this.notifyListeners('settings_imported', validSettings)
      
      return { success: true, settings: validSettings }
    } catch (error) {
      console.error('Failed to import settings:', error)
      this.notifyListeners('settings_import_error', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Add event listener for settings changes
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
   * Notify all listeners of changes
   */
  notifyListeners(type, data) {
    this.listeners.forEach(callback => {
      try {
        callback(type, data)
      } catch (error) {
        console.error('Settings listener error:', error)
      }
    })
  }
}

// Singleton instance
export const settingsManager = new SettingsManager()
export default settingsManager