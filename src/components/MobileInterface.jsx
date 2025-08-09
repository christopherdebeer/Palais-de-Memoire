import React, { useState } from 'react'

const MobileInterface = ({ voiceEnabled, onVoiceToggle }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const handleMenuToggle = () => {
    setIsMenuOpen(!isMenuOpen)
  }

  const commands = [
    { text: 'Create Room', command: 'create a new room' },
    { text: 'Add Object', command: 'add an object here' },
    { text: 'Navigate', command: 'where can I go?' },
    { text: 'Describe', command: 'describe this room' },
  ]

  return (
    <div className="mobile-interface">
      {/* Quick Action Buttons */}
      <div className="quick-actions">
        <button 
          className={`voice-btn ${voiceEnabled ? 'active' : ''}`}
          onClick={() => onVoiceToggle(!voiceEnabled)}
          aria-label="Toggle voice control"
        >
          🎤
        </button>
        
        <button 
          className="menu-btn"
          onClick={handleMenuToggle}
          aria-label="Open menu"
        >
          ☰
        </button>
      </div>

      {/* Expandable Menu */}
      {isMenuOpen && (
        <div className="mobile-menu">
          <div className="menu-header">
            <h3>Quick Commands</h3>
            <button 
              className="close-btn"
              onClick={() => setIsMenuOpen(false)}
              aria-label="Close menu"
            >
              ✕
            </button>
          </div>
          
          <div className="command-buttons">
            {commands.map((cmd, index) => (
              <button
                key={index}
                className="command-btn"
                onClick={() => {
                  // In a real implementation, this would trigger the voice command
                  console.log('Command:', cmd.command)
                  setIsMenuOpen(false)
                }}
              >
                {cmd.text}
              </button>
            ))}
          </div>
          
          <div className="menu-footer">
            <p>Tap and hold to speak, or use the command buttons above.</p>
          </div>
        </div>
      )}

      {/* Voice Status Indicator */}
      {voiceEnabled && (
        <div className="voice-status">
          <div className="voice-indicator">
            <span className="pulse"></span>
            Listening...
          </div>
        </div>
      )}
    </div>
  )
}

export default MobileInterface