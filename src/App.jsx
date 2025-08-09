import React, { useState, useEffect } from 'react'
import MemoryPalace from './components/MemoryPalace'
import MobileInterface from './components/MobileInterface'
import VoiceInterface from './components/VoiceInterface'
import './styles/App.css'

function App() {
  const [isLoading, setIsLoading] = useState(true)
  const [isMobile, setIsMobile] = useState(false)
  const [voiceEnabled, setVoiceEnabled] = useState(false)

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

  if (isLoading) {
    return (
      <div className="app-loading">
        <div className="loading-content">
          <h1>Palais de Mémoire</h1>
          <div className="loading-spinner"></div>
          <p>Preparing your immersive memory palace...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`app ${isMobile ? 'mobile' : 'desktop'}`}>
      <MemoryPalace />
      
      {isMobile && (
        <MobileInterface 
          voiceEnabled={voiceEnabled}
          onVoiceToggle={handleVoiceToggle}
        />
      )}
      
      <VoiceInterface 
        enabled={voiceEnabled}
        isMobile={isMobile}
      />
      
      <div className="app-header">
        <h1>Palais de Mémoire</h1>
        <button 
          className="voice-toggle"
          onClick={() => handleVoiceToggle(!voiceEnabled)}
          aria-label={voiceEnabled ? 'Disable voice' : 'Enable voice'}
        >
          🎤
        </button>
      </div>
    </div>
  )
}

export default App