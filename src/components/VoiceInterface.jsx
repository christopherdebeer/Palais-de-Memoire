import React, { useState, useEffect, useRef } from 'react'

const VoiceInterface = ({ enabled, isMobile }) => {
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [response, setResponse] = useState('')
  const [isSupported, setIsSupported] = useState(false)
  const recognitionRef = useRef(null)

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
      }

      recognition.onend = () => {
        setIsListening(false)
      }
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort()
      }
    }
  }, [])

  const processCommand = (command) => {
    // Simulate command processing - in real implementation, this would integrate with the AI system
    const lowerCommand = command.toLowerCase()
    
    let response = ''
    
    if (lowerCommand.includes('create') && lowerCommand.includes('room')) {
      response = 'Creating a new room in your memory palace...'
    } else if (lowerCommand.includes('add') && lowerCommand.includes('object')) {
      response = 'Where would you like to place the object? Click on a location.'
    } else if (lowerCommand.includes('navigate') || lowerCommand.includes('go')) {
      response = 'You can navigate to the connected rooms. Which direction would you like to go?'
    } else if (lowerCommand.includes('describe')) {
      response = 'This is your starting room in the memory palace. A serene space with soft lighting where your journey begins.'
    } else {
      response = 'I understand you said: "' + command + '". How can I help you build your memory palace?'
    }
    
    setResponse(response)
    speakResponse(response)
  }

  const speakResponse = (text) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = 0.9
      utterance.pitch = 1
      utterance.volume = 0.8
      speechSynthesis.speak(utterance)
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
        className={`voice-control ${isListening ? 'listening' : ''}`}
        onMouseDown={startListening}
        onMouseUp={stopListening}
        onTouchStart={startListening}
        onTouchEnd={stopListening}
        aria-label="Hold to speak"
      >
        {isListening ? '🔴' : '🎤'}
        <span className="voice-control-text">
          {isListening ? 'Listening...' : 'Hold to speak'}
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
          <span className="status-supported">🟢 Voice control ready</span>
        ) : (
          <span className="status-unsupported">🔴 Voice control not supported in this browser</span>
        )}
      </div>
    </div>
  )
}

export default VoiceInterface