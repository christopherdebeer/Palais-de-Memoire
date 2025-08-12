/**
 * Voice Controller - Simplified voice recognition and synthesis
 * Following prototype's direct Web Speech API approach
 */

export class VoiceController {
  constructor(config = {}) {
    this.config = {
      language: 'en-US',
      continuous: true,
      interimResults: true,
      ...config
    }
    
    this.recognition = null
    this.synthesis = window.speechSynthesis
    this.isListening = false
    this.isInitialized = false
    
    // Callbacks
    this.onResult = null
    this.onStart = null
    this.onEnd = null
    this.onError = null
    
    this.initialize()
  }
  
  initialize() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      console.warn('Speech recognition not supported')
      return false
    }
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    this.recognition = new SpeechRecognition()
    
    // Configure recognition
    this.recognition.continuous = this.config.continuous
    this.recognition.interimResults = this.config.interimResults
    this.recognition.lang = this.config.language
    
    // Setup event handlers
    this.recognition.onstart = () => {
      this.isListening = true
      if (this.onStart) this.onStart()
    }
    
    this.recognition.onend = () => {
      this.isListening = false
      if (this.onEnd) this.onEnd()
    }
    
    this.recognition.onerror = (event) => {
      console.warn('Speech recognition error:', event.error)
      if (this.onError) this.onError(event)
    }
    
    this.recognition.onresult = (event) => {
      let finalTranscript = ''
      let interimTranscript = ''
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        
        if (event.results[i].isFinal) {
          finalTranscript += transcript
        } else {
          interimTranscript += transcript
        }
      }
      
      if (this.onResult) {
        this.onResult({
          final: finalTranscript,
          interim: interimTranscript,
          isFinal: finalTranscript.length > 0
        })
      }
    }
    
    this.isInitialized = true
    return true
  }
  
  startListening() {
    if (!this.isInitialized || this.isListening) {
      return false
    }
    
    try {
      this.recognition.start()
      return true
    } catch (error) {
      console.error('Failed to start speech recognition:', error)
      return false
    }
  }
  
  stopListening() {
    if (!this.isInitialized || !this.isListening) {
      return false
    }
    
    try {
      this.recognition.stop()
      return true
    } catch (error) {
      console.error('Failed to stop speech recognition:', error)
      return false
    }
  }
  
  speak(text, options = {}) {
    if (!this.synthesis) {
      console.warn('Speech synthesis not supported')
      return false
    }
    
    // Stop any current speech
    this.synthesis.cancel()
    
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = options.language || this.config.language
    utterance.pitch = options.pitch || 1
    utterance.rate = options.rate || 1
    utterance.volume = options.volume || 1
    
    // Setup callbacks
    if (options.onEnd) utterance.onend = options.onEnd
    if (options.onError) utterance.onerror = options.onError
    
    this.synthesis.speak(utterance)
    return true
  }
  
  stopSpeaking() {
    if (this.synthesis) {
      this.synthesis.cancel()
    }
  }
  
  isSupported() {
    return this.isInitialized
  }
  
  getVoices() {
    return this.synthesis ? this.synthesis.getVoices() : []
  }
}