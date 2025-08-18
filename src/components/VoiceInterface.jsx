import React, { useState, useEffect, useRef } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faMicrophone, faCircle, faSpinner, faKeyboard, faPaperPlane, faClosedCaptioning } from '@fortawesome/free-solid-svg-icons'
import { useAnthropicStream } from '../hooks/useAnthropicStream.js'
import SettingsManager from '../services/SettingsManager.js'

// Create settings manager instance
const settingsManager = new SettingsManager()


const VoiceInterface = ({ enabled, speakResponse, isMobile, onCommand, onListeningChange, onCaptionToggle, captionsEnabled, memoryPalaceCore, currentPalaceState, isCreationMode, pendingCreationPosition, onAiObjectPropertiesUpdate }) => {
  const [isListening, setIsListening] = useState(false)
  const [isSupported, setIsSupported] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [apiConfigured, setApiConfigured] = useState(false)
  const [textInput, setTextInput] = useState('')
  const [showTextInput, setShowTextInput] = useState(false)
  const [conversationHistory, setConversationHistory] = useState([])
  const recognitionRef = useRef(null)
  const captionTimeoutRef = useRef(null)
  
  // Initialize Anthropic streaming hook with memory palace core and voice interface
  // Ensure we only pass the core if it's properly initialized
  const { send, status, liveBlocks } = useAnthropicStream(
    (message) => {
      // Handle incoming messages from stream
      console.log('[VoiceInterface] Received streaming message:', message)
    },
    memoryPalaceCore,
    this
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
          setIsListening(true);
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
            speakResponse('No speech detected, please try again', 'recognition')
            return
          }
          
          console.log('[VoiceInterface] Processing captured voice input:', transcript)
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
          if (false && onListeningChange) {
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
      speakResponse(response)
    } else if (isCreationMode && !isCoreReady) {
      console.warn('[VoiceInterface] Creation mode triggered but Memory Palace Core not ready')
      // Provide feedback that core is not ready
      const response = 'Memory Palace is still initializing. Please try again in a moment.'
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
        
        // Get painted area data if in creation mode
        let paintedAreaData = null
        if (isCreationMode && window.memoryPalacePaintedAreas) {
          paintedAreaData = window.memoryPalacePaintedAreas
          console.log('[VoiceInterface] Including painted area data in context:', paintedAreaData)
        }
        
        const context = {
          isCoreReady,
          isCreationMode: isCreationMode || false,
          creationPosition: pendingCreationPosition || null,
          paintedAreaData: paintedAreaData,
          ...memoryPalaceCore.getCurrentState()
        }
        
        console.log('[VoiceInterface] Sending message with context:', {
          command,
          context,
          historyLength: conversationHistory.length
        })
        
        // Stream response from Anthropic using send function
        try {
          const newMessages = await send(conversationHistory, command, context, {speakResponse})
          
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
          
          // Set response for display (but don't speak it - narrate tool handles speech)
          if (responseText) {
            console.log(`[VoiceInterface] responseText ${responseText}`)
            
          }
          
          // Extract AI object properties for paint mode integration
          if (isCreationMode && toolCalls.length > 0 && onAiObjectPropertiesUpdate) {
            for (const toolCall of toolCalls) {
              // Check if this is an object/door creation tool call
              if (toolCall.name === 'add_object' || toolCall.name === 'create_door') {
                const aiProperties = {
                  name: toolCall.input.name,
                  information: toolCall.input.info || toolCall.input.information || toolCall.input.description,
                  type: toolCall.name === 'create_door' ? 'door' : 'object',
                  targetRoomId: toolCall.input.targetRoomId || ''
                }
                
                console.log('[VoiceInterface] Extracted AI object properties:', aiProperties)
                onAiObjectPropertiesUpdate(aiProperties)
              }
            }
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
      speakResponse(errorResponse)
    } finally {
      console.log('[VoiceInterface] Command processing complete')
      setIsProcessing(false)
    }
  }

  const startListening = async () => {
    console.log('[VoiceInterface] Attempting to start listening:', {
      hasRecognition: !!recognitionRef.current,
      enabled,
      isSupported,
      isListening,
      isProcessing,
      apiConfigured
    })
    
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
    if (false && onListeningChange) {
      onListeningChange(false)
    }
  }

  const toggleListening = () => {
    console.log('[VoiceInterface] Toggling voice input - currently listening:', isListening)
    if (isListening) {
      stopListening()
    } else {
      startListening()
    }
  }

  const handleTextSubmit = async (e) => {
    e.preventDefault()
    if (textInput.trim() && !isProcessing) {
      const command = textInput.trim()
      setTextInput('')
      
      // Check if API is configured before processing text input
      if (!apiConfigured) {
        console.warn('[VoiceInterface] API not configured - providing feedback for text input')
        const response = 'Please configure your Anthropic API key in the settings panel for AI-powered memory palace assistance.'
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
        onClick={toggleListening}
        aria-label={isListening ? 'Tap to cancel' : 'Tap to speak'}
        disabled={isProcessing}
      >
        <FontAwesomeIcon 
          icon={isProcessing ? faSpinner : (isListening ? faCircle : faMicrophone)}
          style={{ color: isListening ? 'white' : 'inherit' }}
          spin={isProcessing}
        />
        <span className="voice-control-text">
          {isProcessing ? 'Processing...' : (isListening ? 'Tap to cancel' : 'Tap to speak')}
        </span>
      </button>

    </div>
  )
}

export default VoiceInterface
