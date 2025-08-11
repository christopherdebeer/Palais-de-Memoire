import React, { useState, useEffect, useRef } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faMicrophone } from '@fortawesome/free-solid-svg-icons'
import MemoryPalace from './components/MemoryPalace'
import MobileInterface from './components/MobileInterface'
import VoiceInterface from './components/VoiceInterface'
import SettingsPanel from './components/SettingsPanel'
import './styles/App.css'

function App() {
  const [isLoading, setIsLoading] = useState(true)
  const [isMobile, setIsMobile] = useState(false)
  const [voiceEnabled, setVoiceEnabled] = useState(false)
  const [wireframeEnabled, setWireframeEnabled] = useState(true) // Start with wireframe enabled for debugging
  const [nippleEnabled, setNippleEnabled] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const memoryPalaceRef = useRef()

  useEffect(() => {
    // Check if running on mobile
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent))
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    
    // Initialize app
    setTimeout(() => {
      setIsLoading(false)
    }, 1500)
    
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const handleVoiceToggle = (enabled) => {
    setVoiceEnabled(enabled)
  }

  const handleListeningChange = (listening) => {
    setIsListening(listening)
  }

  const handleWireframeToggle = (enabled) => {
    setWireframeEnabled(enabled)
    console.log(`Wireframe mode ${enabled ? 'enabled' : 'disabled'}`)
  }

  const handleNippleToggle = (enabled) => {
    setNippleEnabled(enabled)
    console.log(`Nipple controls ${enabled ? 'enabled' : 'disabled'}`)
  }

  const handleVoiceCommand = (command) => {
    console.log('[App] Voice command received:', {
      type: command.type,
      parameters: command.parameters,
      originalInput: command.originalInput,
      aiResponse: command.aiResponse
    })
    
    // Handle different command types
    switch (command.type) {
      case 'CREATE_ROOM':
        console.log('[App] Processing CREATE_ROOM command:', command.parameters.roomName)
        // TODO: Implement room creation logic
        break
      
      case 'ADD_OBJECT':
        console.log('[App] Processing ADD_OBJECT command:', command.parameters.objectName)
        // TODO: Implement object addition logic
        break
      
      case 'GO_TO_ROOM':
        console.log('Navigating to room:', command.parameters.targetRoom)
        // TODO: Implement room navigation logic
        break
      
      case 'LIST_ROOMS':
        console.log('Listing available rooms')
        // TODO: Implement room listing logic
        break
      
      case 'FALLBACK':
        console.log('Fallback command processing for:', command.parameters.input)
        // TODO: Implement basic fallback logic
        break
      
      default:
        console.log('Unknown command type:', command.type)
    }
  }

  return (
    <div className={`app ${isMobile ? 'mobile' : 'desktop'} ${isListening ? 'listening' : ''}`}>
      {/* Always show the MemoryPalace (skybox) as initial state */}
      <MemoryPalace 
        ref={memoryPalaceRef}
        wireframeEnabled={wireframeEnabled}
        nippleEnabled={nippleEnabled}
      />
      
      {/* Show loading overlay while initializing */}
      {isLoading && (
        <div className="app-loading">
          <div className="loading-content">
            <h1>Palais de Mémoire</h1>
            <div className="loading-spinner"></div>
            <p>Preparing your immersive memory palace...</p>
          </div>
        </div>
      )}
      
      {isMobile && (
        <MobileInterface 
          voiceEnabled={voiceEnabled}
          onVoiceToggle={handleVoiceToggle}
        />
      )}
      
      <VoiceInterface 
        enabled={voiceEnabled}
        isMobile={isMobile}
        onCommand={handleVoiceCommand}
        onListeningChange={handleListeningChange}
      />
      
      {/* Voice Status Indicator - only shown when listening */}
      {isListening && (
        <div className="voice-status">
          <div className="voice-indicator">
            <div className="pulse"></div>
            <span>Listening...</span>
          </div>
        </div>
      )}

      <SettingsPanel 
        onWireframeToggle={handleWireframeToggle}
        onNippleToggle={handleNippleToggle}
        wireframeEnabled={wireframeEnabled}
        nippleEnabled={nippleEnabled}
      />
      
      <div className="app-header">
        <h1>Palais de Mémoire</h1>
        <button 
          className="voice-toggle"
          onClick={() => handleVoiceToggle(!voiceEnabled)}
          aria-label={voiceEnabled ? 'Disable voice' : 'Enable voice'}
        >
          <FontAwesomeIcon icon={faMicrophone} />
        </button>
      </div>
    </div>
  )
}

export default App
