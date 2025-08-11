import React, { useState, useEffect, useRef } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBars, faCog, faTimes, faHome, faPlus, faList, faInfo } from '@fortawesome/free-solid-svg-icons'
import MemoryPalace from './components/MemoryPalace'
import VoiceInterface from './components/VoiceInterface'
import SettingsPanel from './components/SettingsPanel'
import './styles/App.css'

function App() {
  const [isLoading, setIsLoading] = useState(true)
  const [isMobile, setIsMobile] = useState(false)
  const [voiceEnabled, setVoiceEnabled] = useState(true) // Voice enabled by default
  const [wireframeEnabled, setWireframeEnabled] = useState(true) // Start with wireframe enabled for debugging
  const [nippleEnabled, setNippleEnabled] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [captionText, setCaptionText] = useState('')
  const [captionMode, setCaptionMode] = useState(null) // 'recognition', 'synthesis', null
  const [captionsEnabled, setCaptionsEnabled] = useState(true)
  const memoryPalaceRef = useRef()
  const captionTimeoutRef = useRef(null)

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

    // Load caption preferences - default to enabled
    const savedCaptions = localStorage.getItem('memoryCaptionsEnabled')
    if (savedCaptions !== null) {
      setCaptionsEnabled(JSON.parse(savedCaptions))
    } else {
      // Default to enabled for better user experience
      setCaptionsEnabled(true)
      localStorage.setItem('memoryCaptionsEnabled', JSON.stringify(true))
    }
    
    return () => {
      window.removeEventListener('resize', checkMobile)
      if (captionTimeoutRef.current) {
        clearTimeout(captionTimeoutRef.current)
      }
    }
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

  const handleMenuToggle = () => {
    setIsMenuOpen(!isMenuOpen)
  }

  const handleSettingsToggle = () => {
    setIsSettingsOpen(!isSettingsOpen)
  }

  const handleSettingsClose = () => {
    setIsSettingsOpen(false)
  }

  const handleMenuClose = () => {
    setIsMenuOpen(false)
  }

  const handleMenuCommand = (command) => {
    console.log('Menu command:', command)
    setIsMenuOpen(false)
    // Handle menu commands here
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

  const handleCaptionUpdate = (text, mode) => {
    console.log('[App] Caption update:', { text, mode, captionsEnabled })
    
    if (!captionsEnabled) {
      console.log('[App] Captions disabled - not showing')
      return
    }
    
    if (captionTimeoutRef.current) {
      clearTimeout(captionTimeoutRef.current)
    }
    
    setCaptionText(text)
    setCaptionMode(mode)
    
    // Auto-hide after 4 seconds for recognition, longer for synthesis
    const hideDelay = mode === 'synthesis' ? 6000 : 4000
    captionTimeoutRef.current = setTimeout(() => {
      console.log('[App] Auto-hiding caption')
      setCaptionText('')
      setCaptionMode(null)
    }, hideDelay)
  }

  const handleCaptionToggle = (enabled) => {
    setCaptionsEnabled(enabled)
    localStorage.setItem('memoryCaptionsEnabled', JSON.stringify(enabled))
    
    // Hide captions immediately if disabled
    if (!enabled) {
      setCaptionText('')
      setCaptionMode(null)
      if (captionTimeoutRef.current) {
        clearTimeout(captionTimeoutRef.current)
      }
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
      
      
      <VoiceInterface 
        enabled={voiceEnabled}
        isMobile={isMobile}
        onCommand={handleVoiceCommand}
        onListeningChange={handleListeningChange}
        onCaptionUpdate={handleCaptionUpdate}
        onCaptionToggle={handleCaptionToggle}
        captionsEnabled={captionsEnabled}
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

      {/* Global Closed Caption Display - positioned at App level for maximum visibility */}
      {captionText && captionsEnabled && (
        <div className="app-caption-overlay" aria-live="polite" aria-atomic="true">
          <div className="app-caption-content">
            <p 
              className={`app-caption-text ${captionMode || ''}`}
              dangerouslySetInnerHTML={{ __html: captionText }}
            />
          </div>
        </div>
      )}

      <SettingsPanel 
        onWireframeToggle={handleWireframeToggle}
        onNippleToggle={handleNippleToggle}
        wireframeEnabled={wireframeEnabled}
        nippleEnabled={nippleEnabled}
        isOpen={isSettingsOpen}
        onClose={handleSettingsClose}
      />

      {/* Main Menu */}
      {isMenuOpen && (
        <>
          <div className="menu-backdrop" onClick={handleMenuClose} />
          <div className="main-menu">
            <div className="menu-header">
              <h3>Menu</h3>
              <button 
                className="close-menu-btn"
                onClick={handleMenuClose}
                aria-label="Close menu"
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>
            
            <div className="menu-content">
              <div className="menu-section">
                <h4>Navigation</h4>
                <button 
                  className="menu-item"
                  onClick={() => handleMenuCommand('home')}
                >
                  <FontAwesomeIcon icon={faHome} />
                  <span>Home</span>
                </button>
                <button 
                  className="menu-item"
                  onClick={() => handleMenuCommand('list-rooms')}
                >
                  <FontAwesomeIcon icon={faList} />
                  <span>List Rooms</span>
                </button>
              </div>

              <div className="menu-section">
                <h4>Actions</h4>
                <button 
                  className="menu-item"
                  onClick={() => handleMenuCommand('create-room')}
                >
                  <FontAwesomeIcon icon={faPlus} />
                  <span>Create Room</span>
                </button>
                <button 
                  className="menu-item"
                  onClick={() => handleMenuCommand('add-object')}
                >
                  <FontAwesomeIcon icon={faPlus} />
                  <span>Add Object</span>
                </button>
              </div>

              <div className="menu-section">
                <h4>Help</h4>
                <button 
                  className="menu-item"
                  onClick={() => handleMenuCommand('about')}
                >
                  <FontAwesomeIcon icon={faInfo} />
                  <span>About</span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}
      
      <div className="app-header">
        <h1>Palais de Mémoire</h1>
        <div className="header-buttons">
          <button 
            className="menu-toggle"
            onClick={handleMenuToggle}
            aria-label="Toggle menu"
          >
            <FontAwesomeIcon icon={faBars} />
          </button>
          <button 
            className="settings-toggle"
            onClick={handleSettingsToggle}
            aria-label="Toggle settings"
          >
            <FontAwesomeIcon icon={faCog} />
          </button>
        </div>
      </div>
    </div>
  )
}

export default App
