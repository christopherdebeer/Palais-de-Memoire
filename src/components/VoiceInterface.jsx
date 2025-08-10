import React, { useState, useEffect, useRef } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faMicrophone, faCircle, faSpinner } from '@fortawesome/free-solid-svg-icons'
import anthropicAPI from '../services/AnthropicAPI.js'
import settingsManager from '../services/SettingsManager.js'

const VoiceInterface = ({ enabled, isMobile, onCommand }) => {
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [response, setResponse] = useState('')
  const [isSupported, setIsSupported] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [apiConfigured, setApiConfigured] = useState(false)
  const recognitionRef = useRef(null)
  const synthRef = useRef(null)

  useEffect(() => {
    // Check for Web Speech API support
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      setIsSupported(true)
      
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      recognitionRef.current = new SpeechRecognition()
      
      const recognition = recognitionRef.current
      recognition.continuous = false
      recognition.interimResults = false
      recognition.lang = 'en-US'

      recognition.onstart = () => {
        setIsListening(true)
        setTranscript('')
      }

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript
        setTranscript(transcript)
        processCommand(transcript)
      }

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error)
        setIsListening(false)
        setIsProcessing(false)
      }

      recognition.onend = () => {
        setIsListening(false)
      }
    }

    // Check API configuration
    setApiConfigured(settingsManager.isApiConfigured())

    // Listen for settings changes
    const handleSettingsChange = () => {
      setApiConfigured(settingsManager.isApiConfigured())
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
  }, [])

  const processCommand = async (command) => {
    setIsProcessing(true)
    
    try {
      if (apiConfigured) {
        // Use Anthropic API for intelligent command processing
        const context = {
          currentRoom: null, // TODO: Get from parent component
          rooms: [], // TODO: Get from parent component
          objects: [] // TODO: Get from parent component
        }

        const result = await anthropicAPI.processInput(command, context)
        
        setResponse(result.text)
        speakResponse(result.text)

        // Handle structured commands
        if (result.command && onCommand) {
          onCommand({
            type: result.command,
            parameters: result.parameters,
            originalInput: command,
            aiResponse: result.text
          })
        }
      } else {
        // Fallback to simple pattern matching when API not configured
        const lowerCommand = command.toLowerCase()
        let response = ''
        
        if (lowerCommand.includes('create') && lowerCommand.includes('room')) {
          response = 'Creating a new room in your memory palace... (Configure your Anthropic API key in settings for full AI processing)'
        } else if (lowerCommand.includes('add') && lowerCommand.includes('object')) {
          response = 'Where would you like to place the object? Click on a location. (Configure your API keys in settings for full AI processing)'
        } else if (lowerCommand.includes('navigate') || lowerCommand.includes('go')) {
          response = 'You can navigate to the connected rooms. Which direction would you like to go? (Configure your API keys for full AI processing)'
        } else if (lowerCommand.includes('describe')) {
          response = 'This is your starting room in the memory palace. A serene space with soft lighting where your journey begins. (Configure your API keys for full AI processing)'
        } else {
          response = `I understand you said: "${command}". Please configure your Anthropic API key in the settings panel for full AI-powered memory palace assistance.`
        }
        
        setResponse(response)
        speakResponse(response)

        // Send basic command for fallback processing
        if (onCommand) {
          onCommand({
            type: 'FALLBACK',
            parameters: { input: command },
            originalInput: command,
            aiResponse: response
          })
        }
      }
    } catch (error) {
      console.error('Error processing command:', error)
      const errorResponse = 'I encountered an error processing your request. Please check your API configuration and try again.'
      setResponse(errorResponse)
      speakResponse(errorResponse)
    } finally {
      setIsProcessing(false)
    }
  }

  const speakResponse = (text) => {
    if ('speechSynthesis' in window && settingsManager.get('audioFeedback')) {
      // Cancel any existing speech
      window.speechSynthesis.cancel()
      
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = settingsManager.get('speechRate') || 1.0
      utterance.pitch = settingsManager.get('speechPitch') || 1.0
      utterance.volume = 0.8

      // Use configured voice if available
      const voices = window.speechSynthesis.getVoices()
      const selectedVoice = settingsManager.get('voice')
      if (selectedVoice && voices.length > 0) {
        const voice = voices.find(v => v.name === selectedVoice)
        if (voice) {
          utterance.voice = voice
        }
      }

      synthRef.current = utterance
      window.speechSynthesis.speak(utterance)
    }
  }

  const startListening = () => {
    if (recognitionRef.current && enabled && isSupported) {
      try {
        recognitionRef.current.start()
      } catch (error) {
        console.error('Error starting speech recognition:', error)
      }
    }
  }

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }
  }

  if (!enabled || !isSupported) {
    return null
  }

  return (
    <div className="voice-interface">
      {/* Voice Control Button */}
      <button
        className={`voice-control ${isListening ? 'listening' : ''} ${isProcessing ? 'processing' : ''}`}
        onMouseDown={startListening}
        onMouseUp={stopListening}
        onTouchStart={startListening}
        onTouchEnd={stopListening}
        aria-label="Hold to speak"
        disabled={isProcessing}
      >
        <FontAwesomeIcon 
          icon={isProcessing ? faSpinner : (isListening ? faCircle : faMicrophone)}
          style={{ color: isListening ? '#FF3B30' : 'inherit' }}
          spin={isProcessing}
        />
        <span className="voice-control-text">
          {isProcessing ? 'Processing...' : (isListening ? 'Listening...' : 'Hold to speak')}
        </span>
      </button>

      {/* Transcript Display */}
      {transcript && (
        <div className="transcript">
          <strong>You said:</strong> "{transcript}"
        </div>
      )}

      {/* Response Display */}
      {response && (
        <div className="response">
          <strong>Assistant:</strong> {response}
        </div>
      )}

      {/* Voice Status */}
      <div className="voice-status-info">
        {isSupported ? (
          <>
            <span className="status-supported">
              <FontAwesomeIcon icon={faCircle} style={{ color: '#30D158' }} /> Voice control ready
            </span>
            {apiConfigured ? (
              <span className="status-api-configured">
                <FontAwesomeIcon icon={faCircle} style={{ color: '#007AFF' }} /> AI assistant enabled
              </span>
            ) : (
              <span className="status-api-missing">
                <FontAwesomeIcon icon={faCircle} style={{ color: '#FF9500' }} /> Configure API keys for full AI features
              </span>
            )}
          </>
        ) : (
          <span className="status-unsupported">
            <FontAwesomeIcon icon={faCircle} style={{ color: '#FF3B30' }} /> Voice control not supported in this browser
          </span>
        )}
      </div>
    </div>
  )
}

export default VoiceInterface