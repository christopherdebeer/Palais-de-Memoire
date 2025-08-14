import React, { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faMicrophone, faCircle, faSpinner, faKeyboard, faPaperPlane, faClosedCaptioning } from '@fortawesome/free-solid-svg-icons'

const VoiceInterface = ({ enabled, isMobile, isListening, isSupported, isProcessing, apiConfigured, onStartListening, onStopListening, onCaptionUpdate, onCaptionToggle, captionsEnabled, isCreationMode }) => {
  const [textInput, setTextInput] = useState('')
  const [showTextInput, setShowTextInput] = useState(false)

  // Note: Auto-start listening for creation mode is now handled at App level

  // Note: Command processing is now handled at App level through the custom hook

  // Note: Speech synthesis is now handled at App level through the custom hook

  // Note: Speech recognition start/stop is now handled through props from App level

  // Note: Speech recognition stop is now handled through props from App level

  const handleTextSubmit = async (e) => {
    e.preventDefault()
    if (textInput.trim() && !isProcessing) {
      const command = textInput.trim()
      setTextInput('')
      
      // Check if API is configured before processing text input
      if (!apiConfigured) {
        console.warn('[VoiceInterface] API not configured - providing feedback for text input')
        const response = 'Please configure your Anthropic API key in the settings panel for AI-powered memory palace assistance.'
        
        if (onCaptionUpdate) {
          onCaptionUpdate(`You typed: "${command}"`, 'recognition')
          setTimeout(() => {
            onCaptionUpdate(response, 'synthesis')
          }, 1000)
        }
        
        return
      }
      
      // Show what was typed and let App level handle the processing
      if (onCaptionUpdate) {
        onCaptionUpdate(`You typed: "${command}"`, 'recognition')
      }
      
      // Note: Text processing would be handled at App level in a full implementation
      // For now, this is simplified since voice transcripts are processed at App level
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
        onMouseDown={onStartListening}
        onMouseUp={onStopListening}
        onTouchStart={onStartListening}
        onTouchEnd={onStopListening}
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
