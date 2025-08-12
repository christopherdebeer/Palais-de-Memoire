import React, { useState, useEffect, useRef } from 'react'
import { VoiceController } from '../utils/voice.js'

/**
 * SimpleVoiceInterface - Simplified voice interaction component
 * Replaces complex VoiceInterface with direct approach
 */
const SimpleVoiceInterface = React.forwardRef(({ 
  enabled = true, 
  onCommand,
  onStatusChange,
  captionsEnabled = true 
}, ref) => {
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [isSupported, setIsSupported] = useState(true)
  const voiceRef = useRef(null)

  useEffect(() => {
    // Initialize voice controller
    const voice = new VoiceController({
      language: 'en-US',
      continuous: true,
      interimResults: true
    })

    voice.onStart = () => {
      setIsListening(true)
      if (onStatusChange) onStatusChange({ listening: true })
    }

    voice.onEnd = () => {
      setIsListening(false)
      if (onStatusChange) onStatusChange({ listening: false })
    }

    voice.onResult = (result) => {
      if (captionsEnabled) {
        setTranscript(result.interim || result.final)
      }

      // Process final commands
      if (result.isFinal && result.final.trim()) {
        const command = result.final.trim()
        setTranscript('')
        
        if (onCommand) {
          onCommand(command)
        }
      }
    }

    voice.onError = (error) => {
      console.warn('Voice recognition error:', error)
      setIsListening(false)
      if (onStatusChange) onStatusChange({ error: error.error })
    }

    setIsSupported(voice.isSupported())
    voiceRef.current = voice

    return () => {
      if (voice.isListening) {
        voice.stopListening()
      }
    }
  }, [onCommand, onStatusChange, captionsEnabled])

  const toggleListening = () => {
    const voice = voiceRef.current
    if (!voice) return

    if (isListening) {
      voice.stopListening()
    } else {
      voice.startListening()
    }
  }

  const speak = (text) => {
    const voice = voiceRef.current
    if (voice) {
      voice.speak(text)
    }
  }

  // Expose speak function to parent
  React.useImperativeHandle(ref, () => ({
    speak,
    isListening,
    isSupported
  }))

  if (!enabled || !isSupported) {
    return null
  }

  return (
    <div className="voice-interface">
      {/* Voice Toggle Button */}
      <button
        className={`voice-button ${isListening ? 'listening' : ''}`}
        onClick={toggleListening}
        title={isListening ? 'Stop listening' : 'Start voice recognition'}
      >
        {isListening ? '🔴' : '🎤'}
      </button>

      {/* Caption Display */}
      {captionsEnabled && transcript && (
        <div className="voice-transcript">
          {transcript}
        </div>
      )}

      <style>{`
        .voice-interface {
          position: fixed;
          bottom: 20px;
          right: 20px;
          z-index: 1000;
        }

        .voice-button {
          width: 60px;
          height: 60px;
          border: none;
          border-radius: 50%;
          background: var(--color-bg-secondary, #333);
          color: white;
          font-size: 24px;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
          transition: all 0.3s ease;
        }

        .voice-button:hover {
          transform: scale(1.1);
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4);
        }

        .voice-button.listening {
          background: var(--color-primary, #007acc);
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.05); }
          100% { transform: scale(1); }
        }

        .voice-transcript {
          position: absolute;
          bottom: 80px;
          right: 0;
          max-width: 300px;
          padding: 12px;
          background: rgba(0, 0, 0, 0.8);
          color: white;
          border-radius: 8px;
          font-size: 14px;
          backdrop-filter: blur(10px);
        }
      `}</style>
    </div>
  )
})

export default SimpleVoiceInterface