import React, { useState, useEffect, useRef } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faMicrophone, faCircle, faSpinner, faKeyboard, faPaperPlane, faClosedCaptioning } from '@fortawesome/free-solid-svg-icons'
import { useAnthropicStream } from '../hooks/useAnthropicStream.js'
import settingsManager from '../services/SettingsManager.js'
import voiceManager from '../utils/VoiceManager.js'

const VoiceInterface = ({ enabled, isMobile, onCommand, onListeningChange, onCaptionUpdate, onCaptionToggle, captionsEnabled, memoryPalaceCore, currentPalaceState, isCreationMode, pendingCreationPosition }) => {
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [response, setResponse] = useState('')
  const [isSupported, setIsSupported] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [apiConfigured, setApiConfigured] = useState(false)
  const [textInput, setTextInput] = useState('')
  const [showTextInput, setShowTextInput] = useState(false)
  const [conversationHistory, setConversationHistory] = useState([])
  const recognitionRef = useRef(null)
  const synthRef = useRef(null)
  const captionTimeoutRef = useRef(null)
  
  // Initialize Anthropic streaming hook with memory palace core
  // Ensure we only pass the core if it's properly initialized
  const { send, status, liveBlocks } = useAnthropicStream(
    (message) => {
      // Handle incoming messages from stream
      console.log('[VoiceInterface] Received streaming message:', message)
    },
    memoryPalaceCore
  )

  useEffect(() => {
    const initializeVoiceInterface = async () => {
      console.log('[VoiceInterface] Initializing voice interface...')
      
      // Wait for settings manager to initialize completely
      try {
        console.log('[VoiceInterface] Waiting for settings initialization...')
        await settingsManager.waitForInitialization()
        console.log('[VoiceInterface] Settings initialization complete')
        
        // Now that settings are fully initialized, check API configuration
        const isConfigured = settingsManager.isAnthropicConfigured()
        console.log('[VoiceInterface] API configuration check after initialization:', {
          isConfigured,
          anthropicKey: settingsManager.get('anthropicApiKey') ? '[SET]' : '[NOT SET]',
          isInitializing: settingsManager.isInitializing
        })
        setApiConfigured(isConfigured)
      } catch (error) {
        console.error('[VoiceInterface] Settings initialization error:', error)
        // Set API as not configured if initialization fails
        setApiConfigured(false)
      }
      
      // Check for Web Speech API support
      if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        console.log('[VoiceInterface] Web Speech API supported')
        setIsSupported(true)
        
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
        recognitionRef.current = new SpeechRecognition()
        
        const recognition = recognitionRef.current
        recognition.continuous = false
        recognition.interimResults = false
        recognition.lang = 'en-US'
        
        console.log('[VoiceInterface] Speech recognition configured:', {
          continuous: recognition.continuous,
          interimResults: recognition.interimResults,
          lang: recognition.lang
        })

        recognition.onstart = () => {
          console.log('[VoiceInterface] Speech recognition started')
          setIsListening(true)
          setTranscript('')
          // Notify parent component about listening state change
          if (false && onListeningChange) {
            onListeningChange(true)
          }
        }

        recognition.onresult = (event) => {
          const transcript = event.results[0][0].transcript
          const confidence = event.results[0][0].confidence
          console.log('[VoiceInterface] Speech recognition result:', {
            transcript,
            confidence,
            resultCount: event.results.length,
            transcriptEmpty: !transcript || transcript.trim().length === 0
          })
          
          if (!transcript || transcript.trim().length === 0) {
            console.warn('[VoiceInterface] Voice input captured but transcript is empty')
            if (onCaptionUpdate) {
              onCaptionUpdate('No speech detected, please try again', 'recognition')
            }
            return
          }
          
          console.log('[VoiceInterface] Processing captured voice input:', transcript)
          setTranscript(transcript)
          if (false && onCaptionUpdate) {
            onCaptionUpdate(`You said: "${transcript}"`, 'recognition')
          }
          processCommand(transcript)
        }

        recognition.onerror = (event) => {
          const errorDetails = {
            error: event.error,
            message: event.message,
            timeStamp: event.timeStamp,
            errorType: typeof event.error,
            stack: new Error().stack
          }
          
          console.error('[VoiceInterface] Speech recognition error:', errorDetails)
          
          // Log specific error context for debugging
          if (event.error === 'no-speech') {
            console.warn('[VoiceInterface] No speech was detected during recognition')
          } else if (event.error === 'audio-capture') {
            console.error('[VoiceInterface] Audio capture failed - check microphone permissions')
          } else if (event.error === 'not-allowed') {
            console.error('[VoiceInterface] Speech recognition not allowed - check browser permissions')
          } else {
            console.error('[VoiceInterface] Unknown speech recognition error:', event.error)
          }
          
          setIsListening(false)
          setIsProcessing(false)
          // Notify parent component about listening state change
          if (onListeningChange) {
            onListeningChange(false)
          }
        }

        recognition.onend = () => {
          console.log('[VoiceInterface] Speech recognition ended')
          setIsListening(false)
          // Notify parent component about listening state change
          if (onListeningChange) {
            onListeningChange(false)
          }
        }
      } else {
        console.warn('[VoiceInterface] Web Speech API not supported in this browser')
      }

      // Caption preferences are now managed at App level
      console.log('[VoiceInterface] Caption management moved to App level')
    }

    // Initialize asynchronously
    initializeVoiceInterface()

    // Listen only for settings changes that affect the API key
    const handleSettingsChange = (eventType, data) => {
      console.log('[VoiceInterface] Settings event:', eventType, data)
      
      if (eventType === 'setting_changed' && data?.key === 'anthropicApiKey') {
        console.log('[VoiceInterface] Anthropic API key changed, updating configuration')
        const newConfigured = settingsManager.isAnthropicConfigured()
        console.log('[VoiceInterface] API key change - configured:', newConfigured)
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
      if (captionTimeoutRef.current) {
        clearTimeout(captionTimeoutRef.current)
      }
      settingsManager.removeEventListener(handleSettingsChange)
    }
  }, [])

  // Auto-start listening when creation mode is activated
  useEffect(() => {
    // Check if core is ready before auto-starting
    const isCoreReady = memoryPalaceCore && memoryPalaceCore.isInitialized && memoryPalaceCore.isRunning;
    
    if (isCreationMode && enabled && isSupported && !isListening && !isProcessing && apiConfigured && isCoreReady) {
      console.log('[VoiceInterface] Creation mode detected - auto-starting voice input')
      // Small delay to ensure UI is ready
      setTimeout(() => {
        startListening()
      }, 500)
    } else if (isCreationMode && !apiConfigured) {
      console.warn('[VoiceInterface] Creation mode triggered but API not configured')
      // Provide feedback that API needs to be configured
      const response = 'Please configure your Anthropic API key in the settings panel to use voice creation mode.'
      if (onCaptionUpdate) {
        onCaptionUpdate(response, 'synthesis')
      }
      speakResponse(response)
    } else if (isCreationMode && !isCoreReady) {
      console.warn('[VoiceInterface] Creation mode triggered but Memory Palace Core not ready')
      // Provide feedback that core is not ready
      const response = 'Memory Palace is still initializing. Please try again in a moment.'
      if (onCaptionUpdate) {
        onCaptionUpdate(response, 'synthesis')
      }
      speakResponse(response)
    }
  }, [isCreationMode, enabled, isSupported, isProcessing, apiConfigured, memoryPalaceCore])

  const processCommand = async (command) => {
    console.log('[VoiceInterface] Processing command:', {
      command,
      apiConfigured,
      isProcessing,
      streamStatus: status
    })
    
    setIsProcessing(true)
    
    try {
      // Double-check API configuration at runtime to prevent stale state issues
      const isCurrentlyConfigured = settingsManager.isAnthropicConfigured()
      console.log('[VoiceInterface] Runtime API configuration check:', {
        stateApiConfigured: apiConfigured,
        runtimeApiConfigured: isCurrentlyConfigured,
        settingsInitializing: settingsManager.isInitializing
      })
      
      if (isCurrentlyConfigured) {
        console.log('[VoiceInterface] Using useAnthropicStream hook for command processing')
        
        // Build context for memory palace from current state
        // First check if memoryPalaceCore is initialized and running
        const isCoreReady = memoryPalaceCore && memoryPalaceCore.isInitialized && memoryPalaceCore.isRunning;
        
        const context = {
          currentRoom: currentPalaceState?.currentRoom || null,
          rooms: isCoreReady ? memoryPalaceCore.getAllRooms() : [],
          objects: isCoreReady ? memoryPalaceCore.getCurrentRoomObjects() : [],
          // Add creation mode context
          isCreationMode: isCreationMode || false,
          creationPosition: pendingCreationPosition || null,
          // Add core status for better error handling
          coreStatus: {
            isInitialized: memoryPalaceCore?.isInitialized || false,
            isRunning: memoryPalaceCore?.isRunning || false
          }
        }
        
        console.log('[VoiceInterface] Sending message with context:', {
          command,
          context,
          historyLength: conversationHistory.length
        })
        
        // Stream response from Anthropic using send function
        try {
          const newMessages = await send(conversationHistory, command, context)
          
          console.log('[VoiceInterface] Send response received:', {
            newMessageCount: newMessages.length,
            messageTypes: newMessages.map(m => m.role)
          })
          
          // Process the assistant messages from the response
          let responseText = ''
          let toolCalls = []
          
          for (const message of newMessages) {
            if (message.role === 'assistant' && message.content) {
              for (const block of message.content) {
                if (block.type === 'text') {
                  responseText += block.text
                } else if (block.type === 'tool_use') {
                  toolCalls.push(block)
                }
              }
            }
          }
          
          console.log('[VoiceInterface] Parsed send response:', {
            responseText: responseText.substring(0, 100) + '...',
            toolCallCount: toolCalls.length,
            toolNames: toolCalls.map(t => t.name)
          })
          
          // Update conversation history with user message and new messages
          setConversationHistory([
            ...conversationHistory,
            { role: 'user', content: command },
            ...newMessages
          ])
          
          // Set response for display
          if (responseText) {
            setResponse(responseText)
            speakResponse(responseText)
          }
          
          // Handle tool calls as commands
          if (toolCalls.length > 0 && onCommand) {
            for (const toolCall of toolCalls) {
              console.log('[VoiceInterface] Executing tool call:', {
                name: toolCall.name,
                input: toolCall.input,
                id: toolCall.id
              })
              
              onCommand({
                type: toolCall.name.toUpperCase(),
                parameters: toolCall.input,
                originalInput: command,
                aiResponse: responseText,
                toolCallId: toolCall.id
              })
            }
          } else if (!toolCalls.length && responseText && onCommand) {
            // Send general response as info command
            onCommand({
              type: 'RESPONSE',
              parameters: { text: responseText },
              originalInput: command,
              aiResponse: responseText
            })
          }
          
        } catch (streamError) {
          console.error('[VoiceInterface] Stream processing error:', {
            error: streamError.message,
            stack: streamError.stack,
            name: streamError.name,
            command,
            timestamp: new Date().toISOString(),
            streamStatus: status
          })
          throw streamError
        }
        
      } else {
        const fallbackReason = 'Anthropic API key not configured or invalid'
        console.log('[VoiceInterface] Using fallback processing:', {
          reason: fallbackReason,
          apiConfigured,
          hasAnthropicKey: !!settingsManager.get('anthropicApiKey'),
          isInitializing: settingsManager.isInitializing
        })
        console.warn('[VoiceInterface] LLM fallback triggered - reason:', fallbackReason)
        
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
        
        console.log('[VoiceInterface] Fallback response generated:', {
          command,
          response: response.substring(0, 100) + '...',
          fallbackReason
        })
        
        setResponse(response)
        speakResponse(response)

        // Send basic command for fallback processing
        if (onCommand) {
          onCommand({
            type: 'FALLBACK',
            parameters: { input: command },
            originalInput: command,
            aiResponse: response,
            fallbackReason
          })
        }
      }
    } catch (error) {
      const errorDetails = {
        error: error.message,
        stack: error.stack,
        command,
        apiConfigured,
        errorType: error.name,
        timestamp: new Date().toISOString(),
        streamStatus: status
      }
      
      console.error('[VoiceInterface] Error processing command:', errorDetails)
      
      // Log specific error context for debugging
      if (error.message.includes('API key')) {
        console.error('[VoiceInterface] API key error - check configuration')
      } else if (error.message.includes('network') || error.message.includes('fetch')) {
        console.error('[VoiceInterface] Network error - check internet connection')
      } else if (error.message.includes('not configured')) {
        console.error('[VoiceInterface] Configuration error - API not properly set up')
      } else {
        console.error('[VoiceInterface] Unknown error type encountered')
      }
      
      const errorResponse = `I encountered an error processing your request: ${error.message}. Please check your API configuration and try again.`
      setResponse(errorResponse)
      speakResponse(errorResponse)
    } finally {
      console.log('[VoiceInterface] Command processing complete')
      setIsProcessing(false)
    }
  }

  const speakResponse = async (text) => {
    console.log('[VoiceInterface] Speaking response:', {
      text,
      speechSynthesisSupported: 'speechSynthesis' in window,
      audioFeedbackEnabled: settingsManager.get('audioFeedback')
    })
    
    if ('speechSynthesis' in window && settingsManager.get('audioFeedback')) {
      // Cancel any existing speech
      window.speechSynthesis.cancel()
      
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = settingsManager.get('speechRate') || 1.0
      utterance.pitch = settingsManager.get('speechPitch') || 1.0
      utterance.volume = 0.8
      
      console.log('[VoiceInterface] TTS settings:', {
        rate: utterance.rate,
        pitch: utterance.pitch,
        volume: utterance.volume
      })

      // Use configured voice with VoiceManager for better voice handling
      const selectedVoiceName = settingsManager.get('voice')
      console.log('[VoiceInterface] Voice selection:', {
        selectedVoiceName,
        voiceManagerLoaded: !voiceManager.isLoading()
      })
      
      if (selectedVoiceName) {
        try {
          const selectedVoice = await voiceManager.findVoiceByName(selectedVoiceName)
          if (selectedVoice) {
            utterance.voice = selectedVoice
            console.log('[VoiceInterface] Using voice from VoiceManager:', {
              name: selectedVoice.name,
              lang: selectedVoice.lang,
              localService: selectedVoice.localService
            })
          } else {
            console.warn('[VoiceInterface] Selected voice not found:', selectedVoiceName)
            // Fallback to default voice for the language
            const defaultVoice = await voiceManager.getDefaultVoiceForLanguage('en')
            if (defaultVoice) {
              utterance.voice = defaultVoice
              console.log('[VoiceInterface] Using default voice fallback:', defaultVoice.name)
            }
          }
        } catch (error) {
          console.error('[VoiceInterface] Error setting voice:', error)
        }
      } else {
        // No voice selected, use system default or get a recommended voice
        try {
          const defaultVoice = await voiceManager.getDefaultVoiceForLanguage('en')
          if (defaultVoice) {
            utterance.voice = defaultVoice
            console.log('[VoiceInterface] Using system default voice:', defaultVoice.name)
          }
        } catch (error) {
          console.warn('[VoiceInterface] Could not set default voice:', error)
        }
      }

      // Enhanced caption display with karaoke-style highlighting
      if (captionsEnabled && onCaptionUpdate) {
        console.log('[VoiceInterface] Setting up TTS captions for:', text.substring(0, 50) + '...')
        onCaptionUpdate(text, 'synthesis')
        
        // Set up word-by-word highlighting
        let wordIndex = 0
        const words = text.split(/\s+/)
        
        utterance.onboundary = (event) => {
          console.log('[VoiceInterface] TTS boundary event:', event.name, 'wordIndex:', wordIndex)
          if (event.name === 'word' && captionsEnabled && onCaptionUpdate) {
            wordIndex++
            const spoken = words.slice(0, wordIndex).join(' ')
            const remaining = words.slice(wordIndex).join(' ')
            
            // Create karaoke-style highlighting
            const highlightedText = remaining.length > 0 
              ? `<span class="spoken">${spoken}</span> ${remaining}`
              : `<span class="spoken">${spoken}</span>`
            
            console.log('[VoiceInterface] Updating caption with highlighting:', highlightedText.substring(0, 50) + '...')
            onCaptionUpdate(highlightedText, 'synthesis')
          }
        }
      } else {
        console.log('[VoiceInterface] Captions disabled, not showing TTS captions')
      }
      
      utterance.onstart = () => {
        console.log('[VoiceInterface] TTS started')
      }
      
      utterance.onend = () => {
        console.log('[VoiceInterface] TTS ended')
        // Caption hiding is now handled at App level
      }
      
      utterance.onerror = (event) => {
        console.error('[VoiceInterface] TTS error:', {
          error: event.error,
          type: event.type,
          stack: new Error().stack
        })
        // Caption hiding is now handled at App level
      }

      synthRef.current = utterance
      window.speechSynthesis.speak(utterance)
    } else {
      console.log('[VoiceInterface] TTS skipped - not supported or audio feedback disabled')
    }
  }

  const startListening = async () => {
    // console.log("Testing")
    // const resp = await processCommand("testing voice")
    // console.log(resp)
    // return;
    console.log('[VoiceInterface] Attempting to start listening:', {
      hasRecognition: !!recognitionRef.current,
      enabled,
      isSupported,
      isListening,
      isProcessing,
      apiConfigured
    })
    
    // // Check if API is configured before starting voice recognition
    // if (!apiConfigured) {
    //   console.warn('[VoiceInterface] API not configured - providing feedback instead of starting recognition')
    //   const fallbackReason = 'Anthropic API key not configured or invalid'
    //   const response = 'Please configure your Anthropic API key in the settings panel for AI-powered memory palace assistance.'
      
    //   // Provide the same feedback as text input would
    //   if (onCaptionUpdate) {
    //     onCaptionUpdate(response, 'synthesis')
    //   }
    //   speakResponse(response)
      
    //   return
    // }
    
    if (recognitionRef.current && enabled && isSupported && !isListening) {
      try {
        console.log('[VoiceInterface] Starting speech recognition...')
        recognitionRef.current.start()
      } catch (error) {
        console.error('[VoiceInterface] Error starting speech recognition:', {
          error: error.message,
          name: error.name,
          stack: error.stack,
          recognitionState: recognitionRef.current ? 'available' : 'null'
        })
      }
    } else {
      console.warn('[VoiceInterface] Cannot start listening - requirements not met')
    }
  }

  const stopListening = () => {
    console.log('[VoiceInterface] Stopping speech recognition')
    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }
    // Ensure listening state is updated immediately
    setIsListening(false)
    if (onListeningChange) {
      onListeningChange(false)
    }
  }

  const handleTextSubmit = async (e) => {
    e.preventDefault()
    if (textInput.trim() && !isProcessing) {
      const command = textInput.trim()
      setTextInput('')
      setTranscript(command)
      
      // Check if API is configured before processing text input
      if (!apiConfigured) {
        console.warn('[VoiceInterface] API not configured - providing feedback for text input')
        const response = 'Please configure your Anthropic API key in the settings panel for AI-powered memory palace assistance.'
        
        // Provide consistent feedback for text input
        if (onCaptionUpdate) {
          onCaptionUpdate(`You typed: "${command}"`, 'recognition')
          // Brief delay then show the response
          setTimeout(() => {
            onCaptionUpdate(response, 'synthesis')
          }, 1000)
        }
        speakResponse(response)
        
        return
      }
      
      await processCommand(command)
    }
  }

  const toggleTextInput = () => {
    setShowTextInput(!showTextInput)
  }

  const toggleCaptions = () => {
    const newState = !captionsEnabled
    if (onCaptionToggle) {
      onCaptionToggle(newState)
    }
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
