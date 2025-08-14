import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { SettingsManager } from '../services/SettingsManager.js'

describe('SettingsManager', () => {
  let settingsManager
  let mockLocalStorage

  beforeEach(() => {
    // Mock localStorage
    mockLocalStorage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn()
    }
    Object.defineProperty(global, 'localStorage', {
      value: mockLocalStorage,
      writable: true
    })

    // Mock DOM elements for export functionality
    const mockElement = {
      href: '',
      download: '',
      click: vi.fn(),
      remove: vi.fn(),
      style: {}
    }
    document.createElement = vi.fn().mockReturnValue(mockElement)
    document.body.appendChild = vi.fn()
    document.body.removeChild = vi.fn()
    global.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url')
    global.URL.revokeObjectURL = vi.fn()
    global.Blob = vi.fn().mockImplementation((content, options) => ({
      size: content[0].length,
      type: options.type
    }))

    settingsManager = new SettingsManager()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Constructor and Initialization', () => {
    it('should initialize with default settings when localStorage is empty', () => {
      mockLocalStorage.getItem.mockReturnValue(null)
      
      const manager = new SettingsManager()
      
      expect(manager.settings).toEqual(expect.objectContaining({
        voice: '',
        speechRate: 1.0,
        selectedModel: 'claude-3-5-haiku-20241022',
        wireframeMode: false,
        renderQuality: 'high'
      }))
    })

    it('should merge stored settings with defaults', () => {
      const storedSettings = JSON.stringify({
        voice: 'custom-voice',
        wireframeMode: true,
        customSetting: 'should-be-ignored'
      })
      mockLocalStorage.getItem.mockReturnValue(storedSettings)
      
      const manager = new SettingsManager()
      
      expect(manager.settings.voice).toBe('custom-voice')
      expect(manager.settings.wireframeMode).toBe(true)
      expect(manager.settings.speechRate).toBe(1.0) // default preserved
    })

    it('should handle corrupted localStorage data gracefully', () => {
      mockLocalStorage.getItem.mockReturnValue('invalid-json')
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      
      const manager = new SettingsManager()
      
      expect(manager.settings).toEqual(expect.objectContaining(manager.defaultSettings))
      expect(consoleSpy).toHaveBeenCalledWith('Failed to load settings:', expect.any(Error))
    })
  })

  describe('Core Settings Methods', () => {
    describe('get()', () => {
      it('should return setting value', () => {
        expect(settingsManager.get('voice')).toBe('')
        expect(settingsManager.get('speechRate')).toBe(1.0)
        expect(settingsManager.get('wireframeMode')).toBe(false)
      })

      it('should return undefined for non-existent keys', () => {
        expect(settingsManager.get('nonExistentKey')).toBeUndefined()
      })
    })

    describe('set()', () => {
      it('should set a single setting and save', () => {
        settingsManager.set('voice', 'test-voice')
        
        expect(settingsManager.get('voice')).toBe('test-voice')
        expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
          'memoryPalace_settings',
          expect.stringContaining('"voice":"test-voice"')
        )
      })

      it('should notify listeners when setting changes', () => {
        const listener = vi.fn()
        settingsManager.addEventListener(listener)
        
        settingsManager.set('wireframeMode', true)
        
        expect(listener).toHaveBeenCalledWith('setting_changed', { 
          key: 'wireframeMode', 
          value: true 
        })
      })
    })

    describe('updateSettings()', () => {
      it('should update multiple settings at once', () => {
        const updates = {
          voice: 'new-voice',
          speechRate: 1.5,
          wireframeMode: true
        }
        
        settingsManager.updateSettings(updates)
        
        expect(settingsManager.get('voice')).toBe('new-voice')
        expect(settingsManager.get('speechRate')).toBe(1.5)
        expect(settingsManager.get('wireframeMode')).toBe(true)
      })

      it('should notify listeners of batch update', () => {
        const listener = vi.fn()
        settingsManager.addEventListener(listener)
        
        const updates = { voice: 'new-voice', speechRate: 1.5 }
        settingsManager.updateSettings(updates)
        
        expect(listener).toHaveBeenCalledWith('settings_updated', updates)
      })
    })

    describe('getAllSettings()', () => {
      it('should return a copy of all settings', () => {
        const allSettings = settingsManager.getAllSettings()
        
        expect(allSettings).toEqual(settingsManager.settings)
        expect(allSettings).not.toBe(settingsManager.settings) // should be a copy
      })
    })

    describe('resetSettings()', () => {
      it('should reset all settings to defaults', () => {
        settingsManager.set('voice', 'custom-voice')
        settingsManager.set('wireframeMode', true)
        
        settingsManager.resetSettings()
        
        expect(settingsManager.get('voice')).toBe('')
        expect(settingsManager.get('wireframeMode')).toBe(false)
      })

      it('should notify listeners of reset', () => {
        const listener = vi.fn()
        settingsManager.addEventListener(listener)
        
        settingsManager.resetSettings()
        
        expect(listener).toHaveBeenCalledWith('settings_reset', settingsManager.settings)
      })
    })
  })

  describe('Persistence Methods', () => {
    describe('saveSettings()', () => {
      it('should save settings to localStorage successfully', () => {
        const result = settingsManager.saveSettings()
        
        expect(result).toBe(true)
        expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
          'memoryPalace_settings',
          JSON.stringify(settingsManager.settings)
        )
      })

      it('should handle localStorage save errors', () => {
        mockLocalStorage.setItem.mockImplementation(() => {
          throw new Error('Storage full')
        })
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
        
        const result = settingsManager.saveSettings()
        
        expect(result).toBe(false)
        expect(consoleSpy).toHaveBeenCalledWith('Failed to save settings:', expect.any(Error))
      })

      it('should notify listeners when settings are saved', () => {
        const listener = vi.fn()
        settingsManager.addEventListener(listener)
        
        settingsManager.saveSettings()
        
        expect(listener).toHaveBeenCalledWith('settings_saved', settingsManager.settings)
      })
    })

    describe('loadSettings()', () => {
      it('should load and parse settings from localStorage', () => {
        const testSettings = { voice: 'test-voice', speechRate: 1.2 }
        mockLocalStorage.getItem.mockReturnValue(JSON.stringify(testSettings))
        
        const loaded = settingsManager.loadSettings()
        
        expect(loaded).toEqual(expect.objectContaining(testSettings))
        expect(mockLocalStorage.getItem).toHaveBeenCalledWith('memoryPalace_settings')
      })

      it('should return defaults when localStorage is empty', () => {
        mockLocalStorage.getItem.mockReturnValue(null)
        
        const loaded = settingsManager.loadSettings()
        
        expect(loaded).toEqual(settingsManager.defaultSettings)
      })
    })
  })

  describe('API Configuration Methods', () => {
    describe('validateApiConfiguration()', () => {
      it('should validate API configuration with missing keys', () => {
        const result = settingsManager.validateApiConfiguration()
        
        expect(result.isValid).toBe(false)
        expect(result.errors).toContain('Anthropic API key is required for LLM functionality')
        expect(result.errors).toContain('Replicate API key is required for image generation')
      })

      it('should validate API configuration with valid keys', () => {
        settingsManager.set('anthropicApiKey', 'valid-key')
        settingsManager.set('replicateApiKey', 'valid-key')
        
        const result = settingsManager.validateApiConfiguration()
        
        expect(result.isValid).toBe(true)
        expect(result.errors).toHaveLength(0)
      })

      it('should handle whitespace-only keys as invalid', () => {
        settingsManager.set('anthropicApiKey', '   ')
        settingsManager.set('replicateApiKey', '   ')
        
        const result = settingsManager.validateApiConfiguration()
        
        expect(result.isValid).toBe(false)
        expect(result.errors).toHaveLength(2)
      })
    })

    describe('isApiConfigured()', () => {
      it('should return false when APIs are not configured', () => {
        expect(settingsManager.isApiConfigured()).toBe(false)
      })

      it('should return true when both APIs are configured', () => {
        settingsManager.set('anthropicApiKey', 'valid-key')
        settingsManager.set('replicateApiKey', 'valid-key')
        
        expect(settingsManager.isApiConfigured()).toBe(true)
      })

      it('should return false when only one API is configured', () => {
        settingsManager.set('anthropicApiKey', 'valid-key')
        
        expect(settingsManager.isApiConfigured()).toBe(false)
      })
    })

    describe('isAnthropicConfigured()', () => {
      it('should return false when Anthropic API is not configured', () => {
        expect(settingsManager.isAnthropicConfigured()).toBe(false)
      })

      it('should return true when Anthropic API is configured', () => {
        settingsManager.set('anthropicApiKey', 'valid-key')
        
        expect(settingsManager.isAnthropicConfigured()).toBe(true)
      })
    })

    describe('getAnthropicHeaders()', () => {
      it('should return correct headers for Anthropic API', () => {
        settingsManager.set('anthropicApiKey', 'test-key')
        
        const headers = settingsManager.getAnthropicHeaders()
        
        expect(headers).toEqual({
          'Content-Type': 'application/json',
          'x-api-key': 'test-key',
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        })
      })
    })

    describe('getReplicateHeaders()', () => {
      it('should return correct headers for Replicate API', () => {
        settingsManager.set('replicateApiKey', 'test-key')
        
        const headers = settingsManager.getReplicateHeaders()
        
        expect(headers).toEqual({
          'Content-Type': 'application/json',
          'Authorization': 'Token test-key'
        })
      })
    })
  })

  describe('Import/Export Methods', () => {
    describe('exportSettings()', () => {
      it('should create and trigger download of settings file', () => {
        const mockElement = { click: vi.fn() }
        document.createElement.mockReturnValue(mockElement)
        
        settingsManager.set('anthropicApiKey', 'secret-key')
        settingsManager.set('voice', 'test-voice')
        
        settingsManager.exportSettings()
        
        const blobContent = global.Blob.mock.calls[0][0][0]
        expect(blobContent).toContain('"voice": "test-voice"')
        expect(global.Blob).toHaveBeenCalledWith(
          [expect.any(String)],
          { type: 'application/json' }
        )
        expect(mockElement.click).toHaveBeenCalled()
        expect(mockElement.download).toBe('memory-palace-settings.json')
      })

      it('should exclude sensitive keys from export', () => {
        settingsManager.set('anthropicApiKey', 'secret-key')
        settingsManager.set('replicateApiKey', 'secret-key')
        
        settingsManager.exportSettings()
        
        const blobContent = global.Blob.mock.calls[0][0][0]
        expect(blobContent).not.toContain('secret-key')
        expect(blobContent).not.toContain('anthropicApiKey')
        expect(blobContent).not.toContain('replicateApiKey')
      })
    })

    describe('importSettings()', () => {
      it('should import valid settings from file', async () => {
        const mockFile = {
          text: () => Promise.resolve(JSON.stringify({
            voice: 'imported-voice',
            speechRate: 1.3,
            invalidKey: 'should-be-ignored'
          }))
        }
        
        const result = await settingsManager.importSettings(mockFile)
        
        expect(result.success).toBe(true)
        expect(settingsManager.get('voice')).toBe('imported-voice')
        expect(settingsManager.get('speechRate')).toBe(1.3)
        expect(settingsManager.get('invalidKey')).toBeUndefined()
      })

      it('should preserve API keys during import', async () => {
        settingsManager.set('anthropicApiKey', 'existing-key')
        settingsManager.set('replicateApiKey', 'existing-key')
        
        const mockFile = {
          text: () => Promise.resolve(JSON.stringify({
            voice: 'imported-voice'
          }))
        }
        
        await settingsManager.importSettings(mockFile)
        
        expect(settingsManager.get('anthropicApiKey')).toBe('existing-key')
        expect(settingsManager.get('replicateApiKey')).toBe('existing-key')
      })

      it('should handle invalid JSON in import file', async () => {
        const mockFile = {
          text: () => Promise.resolve('invalid-json')
        }
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
        
        const result = await settingsManager.importSettings(mockFile)
        
        expect(result.success).toBe(false)
        expect(result.error).toContain('Unexpected token')
        expect(consoleSpy).toHaveBeenCalled()
      })

      it('should notify listeners of successful import', async () => {
        const listener = vi.fn()
        settingsManager.addEventListener(listener)
        
        const mockFile = {
          text: () => Promise.resolve(JSON.stringify({ voice: 'imported' }))
        }
        
        await settingsManager.importSettings(mockFile)
        
        expect(listener).toHaveBeenCalledWith('settings_imported', expect.any(Object))
      })
    })
  })

  describe('Event System Methods', () => {
    describe('addEventListener()', () => {
      it('should add event listener', () => {
        const listener = vi.fn()
        
        settingsManager.addEventListener(listener)
        settingsManager.set('voice', 'test')
        
        expect(listener).toHaveBeenCalled()
      })

      it('should support multiple listeners', () => {
        const listener1 = vi.fn()
        const listener2 = vi.fn()
        
        settingsManager.addEventListener(listener1)
        settingsManager.addEventListener(listener2)
        settingsManager.set('voice', 'test')
        
        expect(listener1).toHaveBeenCalled()
        expect(listener2).toHaveBeenCalled()
      })
    })

    describe('removeEventListener()', () => {
      it('should remove specific event listener', () => {
        const listener1 = vi.fn()
        const listener2 = vi.fn()
        
        settingsManager.addEventListener(listener1)
        settingsManager.addEventListener(listener2)
        settingsManager.removeEventListener(listener1)
        settingsManager.set('voice', 'test')
        
        expect(listener1).not.toHaveBeenCalled()
        expect(listener2).toHaveBeenCalled()
      })
    })

    describe('notifyListeners()', () => {
      it('should notify all listeners with correct parameters', () => {
        const listener = vi.fn()
        settingsManager.addEventListener(listener)
        
        settingsManager.notifyListeners('test_event', { data: 'test' })
        
        expect(listener).toHaveBeenCalledWith('test_event', { data: 'test' })
      })

      it('should handle listener errors gracefully', () => {
        const errorListener = vi.fn().mockImplementation(() => {
          throw new Error('Listener error')
        })
        const goodListener = vi.fn()
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
        
        settingsManager.addEventListener(errorListener)
        settingsManager.addEventListener(goodListener)
        settingsManager.notifyListeners('test_event', {})
        
        expect(consoleSpy).toHaveBeenCalledWith('Settings listener error:', expect.any(Error))
        expect(goodListener).toHaveBeenCalled()
      })
    })
  })

  describe('Legacy Compatibility Methods', () => {
    describe('waitForInitialization()', () => {
      it('should return resolved promise immediately', async () => {
        const result = await settingsManager.waitForInitialization()
        
        expect(result).toBe(true)
      })
    })

    describe('isInitializing', () => {
      it('should return false', () => {
        expect(settingsManager.isInitializing).toBe(false)
      })
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle setting undefined values', () => {
      settingsManager.set('voice', undefined)
      
      expect(settingsManager.get('voice')).toBeUndefined()
    })

    it('should handle setting null values', () => {
      settingsManager.set('voice', null)
      
      expect(settingsManager.get('voice')).toBeNull()
    })

    it('should handle complex object settings', () => {
      const complexValue = { nested: { value: 'test' }, array: [1, 2, 3] }
      settingsManager.set('complexSetting', complexValue)
      
      expect(settingsManager.get('complexSetting')).toEqual(complexValue)
    })

    it('should maintain setting types after save/load cycle', () => {
      settingsManager.set('numberSetting', 42)
      settingsManager.set('booleanSetting', true)
      settingsManager.set('stringSetting', 'test')
      
      const saved = JSON.stringify(settingsManager.settings)
      mockLocalStorage.getItem.mockReturnValue(saved)
      
      const newManager = new SettingsManager()
      
      expect(newManager.get('numberSetting')).toBe(42)
      expect(newManager.get('booleanSetting')).toBe(true)
      expect(newManager.get('stringSetting')).toBe('test')
    })
  })
})