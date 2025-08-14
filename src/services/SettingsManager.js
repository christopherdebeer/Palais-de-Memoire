/**
 * Simple Settings Manager for Memory Palace Application
 * Provides stable interface over localStorage with future extensibility
 */

export class SettingsManager {
  constructor() {
    this.storageKey = 'memoryPalace_settings'
    this.defaultSettings = {
      // Voice Settings
      voice: '',
      speechRate: 1.0,
      speechPitch: 1.0,
      
      // AI/LLM Settings
      selectedModel: 'claude-3-5-haiku-20241022',
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
      
      // Camera Settings
      cameraFov: 75, // Field of view in degrees
      mouseSensitivity: 0.003,
      touchSensitivity: 0.004,
      keyboardSensitivity: 0.02,
      
      // Performance Settings
      renderQuality: 'high', // 'low', 'medium', 'high'
      particleEffects: true,
      audioFeedback: true,
      
      // Persistence Settings
      persistenceType: 'localStorage',
      autoBackup: true,
      maxBackupAge: 30 // days
    }
    
    this.settings = this.loadSettings()
    this.listeners = new Set()
  }

  /**
   * Load settings from localStorage
   */
  loadSettings() {
    try {
      const stored = localStorage.getItem(this.storageKey)
      if (stored) {
        const parsed = JSON.parse(stored)
        return { ...this.defaultSettings, ...parsed }
      }
    } catch (error) {
      console.warn('Failed to load settings:', error)
    }
    return { ...this.defaultSettings }
  }

  /**
   * Save settings to localStorage
   */
  saveSettings() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.settings))
      this.notifyListeners('settings_saved', this.settings)
      return true
    } catch (error) {
      console.error('Failed to save settings:', error)
      return false
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
    this.settings[key] = value
    this.saveSettings()
    this.notifyListeners('setting_changed', { key, value })
  }

  /**
   * Update multiple settings at once
   */
  updateSettings(newSettings) {
    Object.assign(this.settings, newSettings)
    this.saveSettings()
    this.notifyListeners('settings_updated', newSettings)
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
    
    if (!this.settings.anthropicApiKey?.trim()) {
      errors.push('Anthropic API key is required for LLM functionality')
    }
    
    if (!this.settings.replicateApiKey?.trim()) {
      errors.push('Replicate API key is required for image generation')
    }
    
    return {
      isValid: errors.length === 0,
      errors
    }
  }

  /**
   * Check if APIs are configured
   */
  isApiConfigured() {
    return !!(this.settings.anthropicApiKey?.trim() && this.settings.replicateApiKey?.trim())
  }
  
  /**
   * Check if Anthropic API specifically is configured
   */
  isAnthropicConfigured() {
    return !!(this.settings.anthropicApiKey?.trim())
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
   * Export settings to file
   */
  exportSettings() {
    const settingsToExport = { ...this.settings }
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
      
      const validSettings = {}
      for (const [key, value] of Object.entries(importedSettings)) {
        if (key in this.defaultSettings) {
          validSettings[key] = value
        }
      }
      
      validSettings.anthropicApiKey = this.settings.anthropicApiKey
      validSettings.replicateApiKey = this.settings.replicateApiKey
      
      this.updateSettings(validSettings)
      this.notifyListeners('settings_imported', validSettings)
      
      return { success: true, settings: validSettings }
    } catch (error) {
      console.error('Failed to import settings:', error)
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

  // Legacy compatibility methods
  async waitForInitialization() {
    return true
  }
  
  get isInitializing() {
    return false
  }
}

// Simple default export without singleton
export default SettingsManager
