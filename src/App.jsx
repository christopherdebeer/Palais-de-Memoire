import React, { useState, useEffect, useRef } from 'react'
import Scene3D from './components/Scene3D'
import SimpleVoiceInterface from './components/SimpleVoiceInterface'
import SimpleUI from './components/SimpleUI'
import { PalaceController } from './PalaceController'
import { settings } from './utils/settings'
import './styles/App.css'

/**
 * SimpleApp - Streamlined main application component
 * Replaces complex App.jsx with direct, simple approach
 */
function App() {
  // Core application state
  const [palaceController, setPalaceController] = useState(null)
  const [currentRoom, setCurrentRoom] = useState(null)
  const [rooms, setRooms] = useState([])
  const [objects, setObjects] = useState([])
  const [appSettings, setAppSettings] = useState(settings.getAll())
  const [isLoading, setIsLoading] = useState(true)

  // UI state
  const [voiceStatus, setVoiceStatus] = useState({ listening: false })
  const voiceRef = useRef(null)

  // Initialize application
  useEffect(() => {
    initializeApp()
  }, [])

  // Settings changes
  useEffect(() => {
    const handleSettingsChange = (key, value, allSettings) => {
      setAppSettings(allSettings)
    }
    
    settings.onChange(handleSettingsChange)
    return () => settings.offChange(handleSettingsChange)
  }, [])

  const initializeApp = async () => {
    try {
      // Initialize palace controller
      const controller = new PalaceController({
        enableVoice: appSettings.voiceEnabled,
        enableSpatialInteraction: true
      })

      // Setup event listeners
      controller.on('roomChanged', (room) => {
        setCurrentRoom(room)
        if (room) {
          setObjects(controller.getObjectsInRoom(room.id))
        }
      })

      controller.on('objectAdded', () => {
        if (currentRoom) {
          setObjects(controller.getObjectsInRoom(currentRoom.id))
        }
      })

      controller.on('objectRemoved', () => {
        if (currentRoom) {
          setObjects(controller.getObjectsInRoom(currentRoom.id))
        }
      })

      controller.on('stateUpdated', () => {
        setRooms(controller.getRooms())
        if (currentRoom) {
          setObjects(controller.getObjectsInRoom(currentRoom.id))
        }
      })

      // Load initial state
      setRooms(controller.getRooms())
      const current = controller.getCurrentRoom()
      if (current) {
        setCurrentRoom(current)
        setObjects(controller.getObjectsInRoom(current.id))
      }

      setPalaceController(controller)
      setIsLoading(false)

    } catch (error) {
      console.error('Failed to initialize app:', error)
      setIsLoading(false)
    }
  }

  // Voice command handler
  const handleVoiceCommand = async (command) => {
    if (!palaceController) return

    try {
      const result = palaceController.processVoiceCommand(command)
      
      // Provide voice feedback
      if (voiceRef.current) {
        if (result.name) {
          voiceRef.current.speak(`Created ${result.name}`)
        } else if (result.message) {
          voiceRef.current.speak(result.message)
        }
      }

    } catch (error) {
      console.error('Voice command error:', error)
      if (voiceRef.current) {
        voiceRef.current.speak('Sorry, I could not process that command')
      }
    }
  }

  // Room management
  const handleCreateRoom = () => {
    if (!palaceController) return

    const name = prompt('Enter room name:')
    if (name) {
      const room = palaceController.createRoom(name.trim())
      palaceController.setCurrentRoom(room.id)
    }
  }

  const handleSelectRoom = (roomId) => {
    if (palaceController) {
      palaceController.setCurrentRoom(roomId)
    }
  }

  // Object management
  const handleCreateObject = () => {
    if (!palaceController || !currentRoom) return

    const name = prompt('Enter object name:')
    if (name) {
      const position = {
        x: (Math.random() - 0.5) * 10,
        y: 1.5,
        z: (Math.random() - 0.5) * 10
      }
      palaceController.createObject(currentRoom.id, name.trim(), '', position)
    }
  }

  // Settings handlers
  const handleToggleWireframe = () => {
    settings.set('wireframeEnabled', !appSettings.wireframeEnabled)
  }

  const handleToggleSetting = (key, value) => {
    settings.set(key, value)
  }

  // Object interaction
  const handleObjectClick = (objectId) => {
    const object = palaceController?.getObject(objectId)
    if (object) {
      console.log('Object clicked:', object)
      // Add object inspection logic here if needed
    }
  }

  if (isLoading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <p>Initializing Memory Palace...</p>
      </div>
    )
  }

  return (
    <div className="simple-app">
      {/* 3D Scene */}
      <Scene3D
        objects={objects}
        onObjectClick={handleObjectClick}
        wireframeEnabled={appSettings.wireframeEnabled}
        currentRoom={currentRoom}
      />

      {/* UI Controls */}
      <SimpleUI
        currentRoom={currentRoom}
        rooms={rooms}
        objects={objects}
        settings={appSettings}
        onCreateRoom={handleCreateRoom}
        onSelectRoom={handleSelectRoom}
        onCreateObject={handleCreateObject}
        onToggleWireframe={handleToggleWireframe}
        onToggleSetting={handleToggleSetting}
      />

      {/* Voice Interface */}
      <SimpleVoiceInterface
        ref={voiceRef}
        enabled={appSettings.voiceEnabled}
        onCommand={handleVoiceCommand}
        onStatusChange={setVoiceStatus}
        captionsEnabled={appSettings.captionsEnabled}
      />

      {/* Status Indicators */}
      {voiceStatus.listening && (
        <div className="status-indicator voice-listening">
          🎤 Listening...
        </div>
      )}

      <style>{`
        .simple-app {
          position: relative;
          width: 100vw;
          height: 100vh;
          overflow: hidden;
          background: var(--color-bg-primary, #000);
        }

        .loading-screen {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          width: 100vw;
          height: 100vh;
          background: var(--color-bg-primary, #000);
          color: var(--color-text-primary, white);
        }

        .loading-spinner {
          width: 40px;
          height: 40px;
          border: 3px solid var(--color-bg-secondary, rgba(255, 255, 255, 0.1));
          border-top: 3px solid var(--color-primary, #007acc);
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-bottom: 20px;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .status-indicator {
          position: fixed;
          bottom: 90px;
          right: 20px;
          padding: 8px 16px;
          background: var(--color-bg-secondary, rgba(0, 0, 0, 0.8));
          color: var(--color-text-primary, white);
          border-radius: 20px;
          font-size: 14px;
          backdrop-filter: blur(10px);
          z-index: 999;
        }

        .voice-listening {
          background: var(--color-primary, #007acc);
        }
      `}</style>
    </div>
  )
}

export default App