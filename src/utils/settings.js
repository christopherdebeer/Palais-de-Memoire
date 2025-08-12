/**
 * Settings - Simple settings management using localStorage
 */

const DEFAULT_SETTINGS = {
  // Voice settings
  voiceEnabled: true,
  voiceLanguage: 'en-US',
  voiceRate: 1,
  voicePitch: 1,
  voiceVolume: 1,
  
  // Display settings
  wireframeEnabled: true,
  captionsEnabled: true,
  minimapEnabled: true,
  minimapCollapsed: true,
  
  // Interaction settings
  nippleEnabled: false,
  motionControlEnabled: false,
  
  // Theme settings
  theme: 'dark'
}

export class Settings {
  constructor() {
    this.settings = { ...DEFAULT_SETTINGS }
    this.callbacks = []
    this.loadFromStorage()
  }
  
  get(key) {
    return this.settings[key]
  }
  
  set(key, value) {
    if (this.settings[key] !== value) {
      this.settings[key] = value
      this.saveToStorage()
      this.notifyChange(key, value)
    }
  }
  
  setMultiple(updates) {
    let hasChanges = false
    
    Object.entries(updates).forEach(([key, value]) => {
      if (this.settings[key] !== value) {
        this.settings[key] = value
        hasChanges = true
      }
    })
    
    if (hasChanges) {
      this.saveToStorage()
      this.notifyChange(null, updates)
    }
  }
  
  getAll() {
    return { ...this.settings }
  }
  
  reset() {
    this.settings = { ...DEFAULT_SETTINGS }
    this.saveToStorage()
    this.notifyChange(null, this.settings)
  }
  
  onChange(callback) {
    this.callbacks.push(callback)
  }
  
  offChange(callback) {
    const index = this.callbacks.indexOf(callback)
    if (index > -1) {
      this.callbacks.splice(index, 1)
    }
  }
  
  notifyChange(key, value) {
    this.callbacks.forEach(callback => {
      callback(key, value, this.settings)
    })
  }
  
  saveToStorage() {
    try {
      localStorage.setItem('memoryPalaceSettings', JSON.stringify(this.settings))
    } catch (error) {
      console.warn('Failed to save settings to localStorage:', error)
    }
  }
  
  loadFromStorage() {
    try {
      const stored = localStorage.getItem('memoryPalaceSettings')
      if (stored) {
        const parsed = JSON.parse(stored)
        this.settings = { ...DEFAULT_SETTINGS, ...parsed }
      }
    } catch (error) {
      console.warn('Failed to load settings from localStorage:', error)
      this.settings = { ...DEFAULT_SETTINGS }
    }
  }
}

// Export singleton instance
export const settings = new Settings()