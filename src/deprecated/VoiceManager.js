/**
 * Voice Manager Utility
 * Handles discovery, categorization, and management of available speech synthesis voices
 */

export class VoiceManager {
  constructor() {
    this.voices = []
    this.voicesLoaded = false
    this.listeners = new Set()
    this.loadingPromise = null
    
    // Initialize voice loading
    this.initializeVoices()
  }

  /**
   * Initialize voice discovery with proper async handling
   */
  initializeVoices() {
    if (this.loadingPromise) {
      return this.loadingPromise
    }

    this.loadingPromise = new Promise((resolve) => {
      if (!('speechSynthesis' in window)) {
        console.warn('[VoiceManager] Speech Synthesis not supported')
        resolve([])
        return
      }

      let voicesLoadedCount = 0
      const maxRetries = 10
      const retryDelay = 100

      const loadVoices = () => {
        const voices = window.speechSynthesis.getVoices()
        console.log(`[VoiceManager] Voices loaded (attempt ${voicesLoadedCount + 1}):`, voices.length)
        
        if (voices.length > 0) {
          this.voices = voices
          this.voicesLoaded = true
          this.notifyListeners('voices_loaded', voices)
          resolve(voices)
          return true
        }
        return false
      }

      const retryLoadVoices = () => {
        if (loadVoices()) return

        voicesLoadedCount++
        if (voicesLoadedCount < maxRetries) {
          setTimeout(retryLoadVoices, retryDelay * voicesLoadedCount) // Exponential backoff
        } else {
          console.warn('[VoiceManager] Failed to load voices after', maxRetries, 'attempts')
          this.voices = []
          this.voicesLoaded = true
          this.notifyListeners('voices_loaded', [])
          resolve([])
        }
      }

      // Try to load voices immediately
      if (loadVoices()) return

      // Set up voiceschanged event listener for browsers that need it (Chrome, Safari)
      const handleVoicesChanged = () => {
        console.log('[VoiceManager] voiceschanged event fired')
        if (!this.voicesLoaded && loadVoices()) {
          // Remove the event listener once voices are loaded
          if (window.speechSynthesis.removeEventListener) {
            window.speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged)
          } else {
            window.speechSynthesis.onvoiceschanged = null
          }
        }
      }

      // Modern browsers
      if (window.speechSynthesis.addEventListener) {
        window.speechSynthesis.addEventListener('voiceschanged', handleVoicesChanged)
      } 
      // Older browsers
      else if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = handleVoicesChanged
      }

      // Also try periodic retries for browsers that don't fire voiceschanged reliably
      retryLoadVoices()
    })

    return this.loadingPromise
  }

  /**
   * Get all available voices
   */
  async getVoices() {
    if (!this.voicesLoaded) {
      await this.initializeVoices()
    }
    return this.voices
  }

  /**
   * Get voices grouped by language
   */
  async getVoicesByLanguage() {
    const voices = await this.getVoices()
    const grouped = {}

    // Filter out invalid voices and process valid ones
    voices
      .filter(voice => voice && voice.name && voice.name.trim()) // Filter out voices with invalid names
      .forEach(voice => {
        const lang = voice.lang || 'unknown'
        const langCode = lang.split('-')[0] // Get base language code (e.g., 'en' from 'en-US')
        
        if (!grouped[langCode]) {
          grouped[langCode] = {
            code: langCode,
            name: this.getLanguageName(langCode),
            voices: []
          }
        }
        
        grouped[langCode].voices.push({
          ...voice,
          displayName: this.getVoiceDisplayName(voice),
          isLocal: voice.localService,
          quality: this.getVoiceQuality(voice)
        })
      })

    // Sort voices within each language group
    Object.values(grouped).forEach(group => {
      group.voices.sort((a, b) => {
        // Prioritize local voices, then by name
        if (a.isLocal !== b.isLocal) {
          return b.isLocal - a.isLocal
        }
        return a.displayName.localeCompare(b.displayName)
      })
    })

    return grouped
  }

  /**
   * Get voices for a specific language
   */
  async getVoicesForLanguage(languageCode) {
    const voices = await this.getVoices()
    return voices.filter(voice => 
      voice.lang && voice.lang.startsWith(languageCode)
    )
  }

  /**
   * Find a voice by name
   */
  async findVoiceByName(voiceName) {
    const voices = await this.getVoices()
    return voices.find(voice => voice.name === voiceName)
  }

  /**
   * Get the best default voice for a language
   */
  async getDefaultVoiceForLanguage(languageCode = 'en') {
    const voices = await this.getVoicesForLanguage(languageCode)
    
    if (voices.length === 0) {
      return null
    }

    // Prefer local voices
    const localVoices = voices.filter(voice => voice.localService)
    if (localVoices.length > 0) {
      return localVoices[0]
    }

    return voices[0]
  }

  /**
   * Get recommended voices (high quality, commonly used)
   */
  async getRecommendedVoices() {
    const voices = await this.getVoices()
    
    // Define patterns for high-quality voices
    const qualityPatterns = [
      /premium/i,
      /enhanced/i,
      /natural/i,
      /neural/i,
      /wavenet/i,
      /studio/i
    ]

    return voices.filter(voice => {
      // Prefer local voices
      if (voice.localService) return true
      
      // Check for quality indicators in name
      return qualityPatterns.some(pattern => pattern.test(voice.name))
    }).slice(0, 10) // Limit to top 10
  }

  /**
   * Test a voice by speaking sample text
   */
  async testVoice(voice, sampleText = "Hello, this is a voice test.", options = {}) {
    return new Promise((resolve, reject) => {
      if (!('speechSynthesis' in window)) {
        reject(new Error('Speech synthesis not supported'))
        return
      }

      // Cancel any existing speech
      window.speechSynthesis.cancel()

      const utterance = new SpeechSynthesisUtterance(sampleText)
      utterance.voice = voice
      utterance.rate = options.rate || 1.0
      utterance.pitch = options.pitch || 1.0
      utterance.volume = options.volume || 0.8

      utterance.onend = () => resolve(true)
      utterance.onerror = (event) => reject(new Error(`Voice test failed: ${event.error}`))

      window.speechSynthesis.speak(utterance)
    })
  }

  /**
   * Get a human-readable display name for a voice
   */
  getVoiceDisplayName(voice) {
    let name = voice.name

    // Clean up common voice name patterns
    name = name.replace(/Microsoft\s+/i, '')
    name = name.replace(/Google\s+/i, '')
    name = name.replace(/Apple\s+/i, '')
    name = name.replace(/\s+\(.*?\)$/, '') // Remove parenthetical info at end

    // Add quality indicators
    const indicators = []
    if (voice.localService) {
      indicators.push('Local')
    }
    
    if (this.getVoiceQuality(voice) === 'high') {
      indicators.push('HD')
    }

    if (indicators.length > 0) {
      name += ` (${indicators.join(', ')})`
    }

    return name
  }

  /**
   * Determine voice quality based on various factors
   */
  getVoiceQuality(voice) {
    const name = voice.name.toLowerCase()
    
    // High quality indicators
    const highQualityPatterns = [
      /premium/,
      /enhanced/,
      /natural/,
      /neural/,
      /wavenet/,
      /studio/,
      /pro/
    ]

    if (voice.localService || highQualityPatterns.some(pattern => pattern.test(name))) {
      return 'high'
    }

    return 'standard'
  }

  /**
   * Get human-readable language name from language code
   */
  getLanguageName(langCode) {
    const languageNames = {
      'en': 'English',
      'es': 'Spanish',
      'fr': 'French',
      'de': 'German',
      'it': 'Italian',
      'pt': 'Portuguese',
      'ru': 'Russian',
      'ja': 'Japanese',
      'ko': 'Korean',
      'zh': 'Chinese',
      'ar': 'Arabic',
      'hi': 'Hindi',
      'nl': 'Dutch',
      'sv': 'Swedish',
      'da': 'Danish',
      'no': 'Norwegian',
      'fi': 'Finnish',
      'pl': 'Polish',
      'tr': 'Turkish',
      'th': 'Thai'
    }

    return languageNames[langCode] || langCode.toUpperCase()
  }

  /**
   * Check if voices are currently loading
   */
  isLoading() {
    return !this.voicesLoaded
  }

  /**
   * Add event listener for voice manager events
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
   * Notify all listeners of events
   */
  notifyListeners(type, data) {
    this.listeners.forEach(callback => {
      try {
        callback(type, data)
      } catch (error) {
        console.error('[VoiceManager] Listener error:', error)
      }
    })
  }

  /**
   * Get voice statistics
   */
  async getVoiceStats() {
    const voices = await this.getVoices()
    const byLanguage = await this.getVoicesByLanguage()
    
    const localVoices = voices.filter(v => v.localService)
    const remoteVoices = voices.filter(v => !v.localService)

    return {
      total: voices.length,
      local: localVoices.length,
      remote: remoteVoices.length,
      languages: Object.keys(byLanguage).length,
      supported: 'speechSynthesis' in window
    }
  }
}

// Singleton instance
export const voiceManager = new VoiceManager()
export default voiceManager
