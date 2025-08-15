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

    // iOS detection (Mobile Safari, not Chrome/Firefox on iOS)
    this.isIOSWebKit = /iP(hone|ad|od)/.test(navigator.platform || navigator.userAgent) &&
                       /WebKit/i.test(navigator.userAgent) &&
                       !/CriOS|FxiOS/i.test(navigator.userAgent)

    this._primed = false      // whether we've already attempted a dummy speak
    this._priming = null      // in-flight priming promise

    // Initialize voice loading
    this.initializeVoices()
  }

  /**
   * PUBLIC: Call this from a user gesture (click/tap) *especially on iOS*
   * to ensure voices are populated before you try to select a voice.
   *
   * Example:
   *   button.addEventListener('click', () => voiceManager.prime())
   */
  async prime() {
    await this._primeIOSVoicesOnce()
    // After priming, ensure voices are (re)loaded
    await this.initializeVoices()
    return this.voices
  }

  /**
   * Try to trigger iOS to actually populate voices by speaking a silent,
   * ultra-short utterance. Works best when called inside a user gesture.
   */
  _primeIOSVoicesOnce() {
    if (!('speechSynthesis' in window)) return Promise.resolve()
    if (!this.isIOSWebKit) return Promise.resolve()
    if (this._primed) return Promise.resolve()
    if (this._priming) return this._priming

    this._priming = new Promise((resolve) => {
      try {
        // Use NBSP or a single period; set volume to 0 to be silent.
        const u = new SpeechSynthesisUtterance('\u00A0')
        u.volume = 0
        u.rate = 1
        u.pitch = 1

        // In case iOS queues forever, add a short timeout fail-safe.
        let settled = false
        const done = () => {
          if (settled) return
          settled = true
          this._primed = true
          resolve()
        }

        u.onend = done
        u.onerror = done

        // Kick it off (ideally inside a user gesture).
        window.speechSynthesis.speak(u)

        // Fallback: force-resolve after a short delay if events don't fire.
        setTimeout(done, 250)
      } catch {
        // Even if it throws, mark as primed so we don't loop.
        this._primed = true
        resolve()
      }
    })

    return this._priming
  }

  /**
   * Initialize voice discovery with proper async handling
   */
  initializeVoices() {
    if (this.loadingPromise) {
      return this.loadingPromise
    }

    this.loadingPromise = new Promise(async (resolve) => {
      if (!('speechSynthesis' in window)) {
        console.warn('[VoiceManager] Speech Synthesis not supported')
        this.voices = []
        this.voicesLoaded = true
        this.notifyListeners('voices_loaded', [])
        resolve([])
        return
      }

      let attempts = 0
      const maxRetries = 10
      const baseDelay = 100

      const loadVoices = () => {
        const list = window.speechSynthesis.getVoices() || []
        console.log(`[VoiceManager] Voices loaded (attempt ${attempts + 1}):`, list.length, list)

        if (list.length > 0) {
          this.voices = list
          this.voicesLoaded = true
          this.notifyListeners('voices_loaded', list)
          resolve(list)
          return true
        }
        return false
      }

      const retry = async () => {
        if (loadVoices()) return

        attempts++

        // If iOS and still empty, try the “dummy speak” prime once.
        if (this.isIOSWebKit && attempts === 1) {
          await this._primeIOSVoicesOnce()
          // Re-check immediately after priming
          if (loadVoices()) return
        }

        if (attempts < maxRetries) {
          const delay = baseDelay * (attempts) // gentle backoff
          setTimeout(retry, delay)
        } else {
          console.warn('[VoiceManager] Failed to load voices after', maxRetries, 'attempts')
          this.voices = []
          this.voicesLoaded = true
          this.notifyListeners('voices_loaded', [])
          resolve([])
        }
      }

      // Try immediately
      if (loadVoices()) return

      // Listen for voiceschanged where it’s reliable (Chrome/Safari desktop)
      const handleVoicesChanged = () => {
        console.log('[VoiceManager] voiceschanged event fired')
        if (!this.voicesLoaded && loadVoices()) {
          if (window.speechSynthesis.removeEventListener) {
            window.speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged)
          } else {
            window.speechSynthesis.onvoiceschanged = null
          }
        }
      }

      if (window.speechSynthesis.addEventListener) {
        window.speechSynthesis.addEventListener('voiceschanged', handleVoicesChanged)
      } else if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = handleVoicesChanged
      }

      // Begin retries (and iOS prime on first pass)
      retry()
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

    voices
      .filter(voice => voice && voice.name && voice.name.trim())
      .forEach(voice => {
        const lang = voice.lang || 'unknown'
        const langCode = lang.split('-')[0]

        if (!grouped[langCode]) {
          grouped[langCode] = {
            code: langCode,
            name: this.getLanguageName(langCode),
            voices: []
          }
        }

        grouped[langCode].voices.push({
          ...voice,
          name: voice.name,
          displayName: this.getVoiceDisplayName(voice),
          isLocal: voice.localService,
          quality: this.getVoiceQuality(voice)
        })
      })

    Object.values(grouped).forEach(group => {
      group.voices.sort((a, b) => {
        if (a.isLocal !== b.isLocal) return (b.isLocal ? 1 : 0) - (a.isLocal ? 1 : 0)
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

    if (voices.length === 0) return null

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

    const qualityPatterns = [
      /premium/i, /enhanced/i, /natural/i, /neural/i, /wavenet/i, /studio/i
    ]

    return voices.filter(voice => {
      if (voice.localService) return true
      return qualityPatterns.some(pattern => pattern.test(voice.name))
    }).slice(0, 10)
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

      window.speechSynthesis.cancel()

      const utterance = new SpeechSynthesisUtterance(sampleText)
      utterance.voice = voice // IMPORTANT: set the actual object
      utterance.rate = options.rate ?? 1.0
      utterance.pitch = options.pitch ?? 1.0
      utterance.volume = options.volume ?? 0.8

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
    name = name.replace(/Microsoft\s+/i, '')
               .replace(/Google\s+/i, '')
               .replace(/Apple\s+/i, '')
               .replace(/\s+\(.*?\)$/, '')

    const indicators = []
    if (voice.localService) indicators.push('Local')
    if (this.getVoiceQuality(voice) === 'high') indicators.push('HD')
    if (indicators.length > 0) name += ` (${indicators.join(', ')})`
    return name
  }

  /**
   * Determine voice quality based on various factors
   */
  getVoiceQuality(voice) {
    const name = voice.name.toLowerCase()
    const highQualityPatterns = [
      /premium/, /enhanced/, /natural/, /neural/, /wavenet/, /studio/, /pro/
    ]
    if (voice.localService || highQualityPatterns.some(p => p.test(name))) {
      return 'high'
    }
    return 'standard'
  }

  /**
   * Get human-readable language name from language code
   */
  getLanguageName(langCode) {
    const languageNames = {
      'en': 'English', 'es': 'Spanish', 'fr': 'French', 'de': 'German',
      'it': 'Italian', 'pt': 'Portuguese', 'ru': 'Russian', 'ja': 'Japanese',
      'ko': 'Korean', 'zh': 'Chinese', 'ar': 'Arabic', 'hi': 'Hindi',
      'nl': 'Dutch', 'sv': 'Swedish', 'da': 'Danish', 'no': 'Norwegian',
      'fi': 'Finnish', 'pl': 'Polish', 'tr': 'Turkish', 'th': 'Thai'
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
      try { callback(type, data) }
      catch (error) { console.error('[VoiceManager] Listener error:', error) }
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
