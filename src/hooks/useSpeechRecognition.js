import { useState, useEffect, useRef, useCallback } from 'react'
import settingsManager from '../services/SettingsManager.js'
import voiceManager from '../utils/VoiceManager.js'

const useSpeechRecognition = (onTranscript, onListeningChange, onCaptionUpdate) => {
  const [isListening, setIsListening] = useState(false)
  const [isSupported, setIsSupported] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [apiConfigured, setApiConfigured] = useState(false)

  const recognitionRef = useRef(null)
  const synthRef = useRef(null)

  // Initialize speech recognition once
  useEffect(() => {
    const initializeSpeechRecognition = async () => {
      console.log('[useSpeechRecognition] Initializing speech recognition...')

      // Initialize settings and check API configuration
      try {
        await settingsManager.waitForInitialization()
        const isConfigured = settingsManager.isAnthropicConfigured()
        setApiConfigured(isConfigured)
        console.log('[useSpeechRecognition] API configured:', isConfigured)
      } catch (error) {
        console.error('[useSpeechRecognition] Settings initialization error:', error)
        setApiConfigured(false)
      }

      // Check for Web Speech API support
      if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        console.log('[useSpeechRecognition] Web Speech API supported')
        setIsSupported(true)

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
        recognitionRef.current = new SpeechRecognition()

        const recognition = recognitionRef.current
        recognition.continuous = false
        recognition.interimResults = false
        recognition.lang = 'en-US'

        console.log('[useSpeechRecognition] Speech recognition configured')

        recognition.onstart = () => {
          console.log('[useSpeechRecognition] Speech recognition started')
          setIsListening(true)
          onListeningChange?.(true)
        }

        recognition.onresult = (event) => {
          const transcript = event.results[0][0].transcript
          const confidence = event.results[0][0].confidence
          console.log('[useSpeechRecognition] Speech recognition result:', {
            transcript,
            confidence
          })

          if (!transcript || transcript.trim().length === 0) {
            console.warn('[useSpeechRecognition] Empty transcript')
            onCaptionUpdate?.('No speech detected, please try again', 'recognition')
            return
          }

          console.log('[useSpeechRecognition] Processing transcript:', transcript)
          onCaptionUpdate?.(`You said: "${transcript}"`, 'recognition')
          onTranscript?.(transcript)
        }

        recognition.onerror = (event) => {
          console.error('[useSpeechRecognition] Speech recognition error:', event.error)
          setIsListening(false)
          setIsProcessing(false)
          onListeningChange?.(false)
        }

        recognition.onend = () => {
          console.log('[useSpeechRecognition] Speech recognition ended')
          setIsListening(false)
          onListeningChange?.(false)
        }
      } else {
        console.warn('[useSpeechRecognition] Web Speech API not supported')
      }
    }

    initializeSpeechRecognition()

    // Listen for API key changes
    const handleSettingsChange = (eventType, data) => {
      if (eventType === 'setting_changed' && data?.key === 'anthropicApiKey') {
        const newConfigured = settingsManager.isAnthropicConfigured()
        console.log('[useSpeechRecognition] API key changed, configured:', newConfigured)
        setApiConfigured(newConfigured)
      }
    }

    settingsManager.addEventListener(handleSettingsChange)

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort()
      }
      if (synthRef.current) {
        window.speechSynthesis.cancel()
      }
      settingsManager.removeEventListener(handleSettingsChange)
    }
  }, [onTranscript, onListeningChange, onCaptionUpdate])

  const startListening = useCallback(() => {
    console.log('[useSpeechRecognition] Attempting to start listening:', {
      hasRecognition: !!recognitionRef.current,
      isSupported,
      isListening,
      isProcessing
    })

    if (recognitionRef.current && isSupported && !isListening && !isProcessing) {
      try {
        console.log('[useSpeechRecognition] Starting speech recognition...')
        recognitionRef.current.start()
      } catch (error) {
        console.error('[useSpeechRecognition] Error starting speech recognition:', error)
      }
    } else {
      console.warn('[useSpeechRecognition] Cannot start listening - requirements not met')
    }
  }, [isSupported, isListening, isProcessing])

  const stopListening = useCallback(() => {
    console.log('[useSpeechRecognition] Stopping speech recognition')
    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }
    setIsListening(false)
    onListeningChange?.(false)
  }, [onListeningChange])

  const speakResponse = useCallback(async (text) => {
    console.log('[useSpeechRecognition] Speaking response:', text)

    if ('speechSynthesis' in window && settingsManager.get('audioFeedback')) {
      window.speechSynthesis.cancel()

      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = settingsManager.get('speechRate') || 1.0
      utterance.pitch = settingsManager.get('speechPitch') || 1.0
      utterance.volume = 0.8

      // Use configured voice with VoiceManager
      const selectedVoiceName = settingsManager.get('voice')
      if (selectedVoiceName) {
        try {
          const selectedVoice = await voiceManager.findVoiceByName(selectedVoiceName)
          if (selectedVoice) {
            utterance.voice = selectedVoice
          } else {
            const defaultVoice = await voiceManager.getDefaultVoiceForLanguage('en')
            if (defaultVoice) {
              utterance.voice = defaultVoice
            }
          }
        } catch (error) {
          console.error('[useSpeechRecognition] Error setting voice:', error)
        }
      } else {
        try {
          const defaultVoice = await voiceManager.getDefaultVoiceForLanguage('en')
          if (defaultVoice) {
            utterance.voice = defaultVoice
          }
        } catch (error) {
          console.warn('[useSpeechRecognition] Could not set default voice:', error)
        }
      }

      // Enhanced caption display with word highlighting
      if (onCaptionUpdate) {
        onCaptionUpdate(text, 'synthesis')

        let wordIndex = 0
        const words = text.split(/\s+/)

        utterance.onboundary = (event) => {
          if (event.name === 'word' && onCaptionUpdate) {
            wordIndex++
            const spoken = words.slice(0, wordIndex).join(' ')
            const remaining = words.slice(wordIndex).join(' ')

            const highlightedText = remaining.length > 0
              ? `<span class="spoken">${spoken}</span> ${remaining}`
              : `<span class="spoken">${spoken}</span>`

            onCaptionUpdate(highlightedText, 'synthesis')
          }
        }
      }

      utterance.onstart = () => {
        console.log('[useSpeechRecognition] TTS started')
      }

      utterance.onend = () => {
        console.log('[useSpeechRecognition] TTS ended')
      }

      utterance.onerror = (event) => {
        console.error('[useSpeechRecognition] TTS error:', event.error)
      }

      synthRef.current = utterance
      window.speechSynthesis.speak(utterance)
    } else {
      console.log('[useSpeechRecognition] TTS skipped - not supported or audio feedback disabled')
    }
  }, [onCaptionUpdate])

  return {
    isListening,
    isSupported,
    isProcessing,
    setIsProcessing,
    apiConfigured,
    startListening,
    stopListening,
    speakResponse
  }
}

export default useSpeechRecognition