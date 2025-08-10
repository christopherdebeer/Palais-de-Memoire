import React, { useState, useEffect, useRef } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faMicrophone, faCircle, faSpinner, faKeyboard, faPaperPlane, faClosedCaptioning } from '@fortawesome/free-solid-svg-icons'
import anthropicAPI from '../services/AnthropicAPI.js'
import settingsManager from '../services/SettingsManager.js'

const VoiceInterface = ({ enabled, isMobile, onCommand }) => {
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [response, setResponse] = useState('')
  const [isSupported, setIsSupported] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [apiConfigured, setApiConfigured] = useState(false)
  const [textInput, setTextInput] = useState('')
  const [showTextInput, setShowTextInput] = useState(false)
  const [captionsEnabled, setCaptionsEnabled] = useState(false)
  const [captionText, setCaptionText] = useState('')
  const [captionMode, setCaptionMode] = useState(null) // 'recognition', 'synthesis', null
  const recognitionRef = useRef(null)
  const synthRef = useRef(null)
  const captionTimeoutRef = useRef(null)

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
        showCaption(`You said: "${transcript}"`, 'recognition')
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

    // Check API configuration - only need Anthropic API for voice processing
    setApiConfigured(anthropicAPI.isConfigured())

    // Load caption preferences
    const savedCaptions = localStorage.getItem('memoryCaptionsEnabled')
    if (savedCaptions) {
      setCaptionsEnabled(JSON.parse(savedCaptions))
    }

    // Listen for settings changes
    const handleSettingsChange = () => {
      setApiConfigured(anthropicAPI.isConfigured())
    }

    settingsManager.addEventListener(handleSettingsChange)

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort()
      }
      if (synthRef.current) {
        window.speechSynthesis.cancel()
      }
      if (captionTimeoutRef.current) {
        clearTimeout(captionTimeoutRef.current)
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
      
      // Show caption for synthesis
      showCaption(text, 'synthesis')
      
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

  const handleTextSubmit = async (e) => {
    e.preventDefault()
    if (textInput.trim() && !isProcessing) {
      const command = textInput.trim()
      setTextInput('')
      setTranscript(command)
      await processCommand(command)
    }
  }

  const toggleTextInput = () => {
    setShowTextInput(!showTextInput)
  }

  const toggleCaptions = () => {
    const newState = !captionsEnabled
    setCaptionsEnabled(newState)
    localStorage.setItem('memoryCaptionsEnabled', JSON.stringify(newState))
    
    // Hide captions immediately if disabled
    if (!newState) {
      setCaptionText('')
      setCaptionMode(null)
    }
  }

  const showCaption = (text, mode) => {
    if (!captionsEnabled) return
    
    if (captionTimeoutRef.current) {
      clearTimeout(captionTimeoutRef.current)
    }
    
    setCaptionText(text)
    setCaptionMode(mode)
    
    // Auto-hide after 4 seconds
    captionTimeoutRef.current = setTimeout(() => {
      setCaptionText('')
      setCaptionMode(null)
    }, 4000)
  }

  if (!enabled || !isSupported) {
    return null
  }

  return (
    <div className="voice-interface">
      {/* Text Input Toggle Button */}
      <button
        className="text-input-toggle"
        onClick={toggleTextInput}
        aria-label="Toggle text input"
        disabled={isProcessing}
      >
        <FontAwesomeIcon icon={faKeyboard} />
      </button>

      {/* Caption Toggle Button */}
      <button
        className={`caption-toggle ${captionsEnabled ? 'active' : ''}`}
        onClick={toggleCaptions}
        aria-label={captionsEnabled ? 'Disable closed captions' : 'Enable closed captions'}
        disabled={isProcessing}
      >
        <FontAwesomeIcon icon={faClosedCaptioning} />
      </button>

      {/* Manual Text Input */}
      {showTextInput && (
        <form className="text-input-form" onSubmit={handleTextSubmit}>
          <input
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Type your command here..."
            className="manual-text-input"
            disabled={isProcessing}
            autoFocus
          />
          <button
            type="submit"
            className="text-submit-btn"
            disabled={!textInput.trim() || isProcessing}
            aria-label="Send text command"
          >
            <FontAwesomeIcon icon={faPaperPlane} />
          </button>
        </form>
      )}

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

      {/* Closed Caption Display */}
      {captionText && (
        <div className="caption-container" aria-live="polite" aria-atomic="true">
          <p className="caption-text">{captionText}</p>
        </div>
      )}
    </div>
  )
}

export default VoiceInterface