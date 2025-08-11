import React, { useState, useEffect, useRef } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBars, faCog, faTimes, faHome, faPlus, faList, faInfo, faEdit, faArrowRight, faTrash, faEye } from '@fortawesome/free-solid-svg-icons'
import MemoryPalace from './components/MemoryPalace'
import VoiceInterface from './components/VoiceInterface'
import SettingsPanel from './components/SettingsPanel'
import ActionFormModal from './components/ActionFormModal'
import { MemoryPalaceCore } from './core/MemoryPalaceCore.js'
import './styles/App.css'
import './styles/ActionFormModal.css'

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
  const [memoryPalaceCore, setMemoryPalaceCore] = useState(null)
  const [coreInitialized, setCoreInitialized] = useState(false)
  const [currentPalaceState, setCurrentPalaceState] = useState(null)
  const [actionModalOpen, setActionModalOpen] = useState(false)
  const [currentAction, setCurrentAction] = useState(null)
  const [isProcessingAction, setIsProcessingAction] = useState(false)
  const memoryPalaceRef = useRef()
  const captionTimeoutRef = useRef(null)

  useEffect(() => {
    // Check if running on mobile
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent))
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    
    // Initialize Memory Palace Core
    const initializeCore = async () => {
      console.log('[App] Initializing Memory Palace Core...')
      
      try {
        const core = new MemoryPalaceCore({
          apiProvider: 'mock', // Start with mock provider for development
          persistence: 'localStorage',
          enableVoice: true,
          enableSpatialInteraction: true,
          autopilot: false
        })
        
        const initialized = await core.initialize()
        if (initialized) {
          await core.start()
          setMemoryPalaceCore(core)
          setCoreInitialized(true)
          
          // Set up event listeners for state updates
          core.on('room_created', (room) => {
            console.log('[App] Room created:', room)
            updatePalaceState(core)
          })
          
          core.on('object_created', (object) => {
            console.log('[App] Object created:', object)
            updatePalaceState(core)
          })
          
          core.on('room_navigated', (room) => {
            console.log('[App] Navigated to room:', room)
            updatePalaceState(core)
          })
          
          // Initial state update
          updatePalaceState(core)
          
          console.log('[App] Memory Palace Core initialized successfully')
        } else {
          console.error('[App] Failed to initialize Memory Palace Core')
        }
      } catch (error) {
        console.error('[App] Error initializing Memory Palace Core:', error)
      }
    }
    
    // Initialize core and then finish loading
    initializeCore().then(() => {
      setTimeout(() => {
        setIsLoading(false)
      }, 1000)
    })

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
      // Clean up memory palace core
      if (memoryPalaceCore) {
        memoryPalaceCore.dispose()
      }
    }
  }, [])

  // Helper function to update palace state
  const updatePalaceState = (core) => {
    if (core) {
      const state = core.getCurrentState()
      setCurrentPalaceState(state)
      console.log('[App] Palace state updated:', state)
    }
  }

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

  const handleMenuCommand = async (command) => {
    console.log('[App] Menu command:', command)
    setIsMenuOpen(false)
    
    // Handle direct actions (no parameters required)
    if (command === 'list-rooms' || command === 'get-room-info') {
      if (!memoryPalaceCore || !coreInitialized) {
        console.warn('[App] Memory Palace Core not initialized')
        return
      }
      
      try {
        setIsProcessingAction(true)
        
        // Execute the action directly
        const toolName = command === 'list-rooms' ? 'list_rooms' : 'get_room_info'
        const result = await memoryPalaceCore.roomManager ? 
          (await import('./utils/memoryPalaceTools.js')).default.prototype.executeTool.call(
            { core: memoryPalaceCore, roomManager: memoryPalaceCore.roomManager, objectManager: memoryPalaceCore.objectManager },
            toolName, {}, null
          ) : 'Memory Palace not fully initialized'
        
        console.log('[App] Direct action result:', result)
        
        // Show result in a simple alert for now (could be enhanced with a result modal)
        alert(result)
        
      } catch (error) {
        console.error('[App] Error executing direct action:', error)
        alert(`Error: ${error.message}`)
      } finally {
        setIsProcessingAction(false)
      }
      return
    }
    
    // Handle form-based actions
    const formActions = ['create-room', 'edit-room', 'go-to-room', 'add-object', 'remove-object']
    if (formActions.includes(command)) {
      const actionMap = {
        'create-room': 'create_room',
        'edit-room': 'edit_room', 
        'go-to-room': 'go_to_room',
        'add-object': 'add_object',
        'remove-object': 'remove_object'
      }
      
      setCurrentAction(actionMap[command])
      setActionModalOpen(true)
      return
    }
    
    // Handle other menu commands
    switch (command) {
      case 'home':
        console.log('[App] Home command - could navigate to welcome state')
        break
      case 'about':
        alert('Palais de Mémoire - An immersive 3D memory palace application powered by AI voice interaction.')
        break
      default:
        console.log('[App] Unknown menu command:', command)
    }
  }

  const handleVoiceCommand = async (command) => {
    console.log('[App] Voice command received:', {
      type: command.type,
      parameters: command.parameters,
      originalInput: command.originalInput,
      aiResponse: command.aiResponse
    })
    
    if (!memoryPalaceCore || !coreInitialized) {
      console.warn('[App] Memory Palace Core not initialized, cannot process command')
      return
    }
    
    try {
      // Handle different command types with actual core operations
      switch (command.type) {
        case 'create_room':
          console.log('[App] Processing CREATE_ROOM command:', command.parameters)
          if (command.parameters.name && command.parameters.description) {
            const room = await memoryPalaceCore.createRoom(
              command.parameters.name,
              command.parameters.description
            )
            console.log('[App] Room created successfully:', room)
            updatePalaceState(memoryPalaceCore)
          }
          break
        
        case 'add_object':
          console.log('[App] Processing ADD_OBJECT command:', command.parameters)
          if (command.parameters.name && command.parameters.info) {
            const object = await memoryPalaceCore.addObject(
              command.parameters.name,
              command.parameters.info,
              command.parameters.position || null
            )
            console.log('[App] Object added successfully:', object)
            updatePalaceState(memoryPalaceCore)
          }
          break
        
        case 'go_to_room':
          console.log('[App] Processing GO_TO_ROOM command:', command.parameters)
          if (command.parameters.roomName) {
            const rooms = memoryPalaceCore.getAllRooms()
            const targetRoom = rooms.find(room => 
              room.name.toLowerCase().includes(command.parameters.roomName.toLowerCase())
            )
            if (targetRoom) {
              await memoryPalaceCore.navigateToRoom(targetRoom.id)
              console.log('[App] Navigated to room successfully:', targetRoom)
              updatePalaceState(memoryPalaceCore)
            } else {
              console.warn('[App] Room not found:', command.parameters.roomName)
            }
          }
          break
        
        case 'edit_room':
          console.log('[App] Processing EDIT_ROOM command:', command.parameters)
          if (command.parameters.description && currentPalaceState?.currentRoom) {
            // Update room description through core
            await memoryPalaceCore.roomManager.updateRoom(
              currentPalaceState.currentRoom.id,
              { description: command.parameters.description }
            )
            console.log('[App] Room updated successfully')
            updatePalaceState(memoryPalaceCore)
          }
          break
        
        case 'list_rooms':
          console.log('[App] Processing LIST_ROOMS command')
          const rooms = memoryPalaceCore.getAllRooms()
          console.log('[App] Available rooms:', rooms)
          // The response is already handled by the AI, just log for debugging
          break
        
        case 'get_room_info':
          console.log('[App] Processing GET_ROOM_INFO command')
          const currentObjects = memoryPalaceCore.getCurrentRoomObjects()
          console.log('[App] Current room objects:', currentObjects)
          // The response is already handled by the AI, just log for debugging
          break
        
        case 'FALLBACK':
          console.log('[App] Processing fallback command:', command.parameters.input)
          // Handle basic fallback logic - no core operations needed
          break
        
        default:
          console.log('[App] Unknown command type:', command.type)
      }
    } catch (error) {
      console.error('[App] Error processing voice command:', error)
    }
  }

  const handleActionFormSubmit = async (action, formData) => {
    console.log('[App] Action form submitted:', { action, formData })
    
    if (!memoryPalaceCore || !coreInitialized) {
      console.warn('[App] Memory Palace Core not initialized')
      alert('Memory Palace not initialized. Please wait for initialization to complete.')
      return
    }
    
    try {
      setIsProcessingAction(true)
      
      // Execute the action through the tool manager
      const MemoryPalaceToolManager = (await import('./utils/memoryPalaceTools.js')).default
      const toolManager = new MemoryPalaceToolManager(memoryPalaceCore)
      
      const result = await toolManager.executeTool(action, formData, null)
      console.log('[App] Action result:', result)
      
      // Update palace state
      updatePalaceState(memoryPalaceCore)
      
      // Close modal and show result
      setActionModalOpen(false)
      setCurrentAction(null)
      
      // Show success message (could be enhanced with a toast notification)
      alert(`Success: ${result}`)
      
    } catch (error) {
      console.error('[App] Error executing action:', error)
      alert(`Error: ${error.message}`)
    } finally {
      setIsProcessingAction(false)
    }
  }

  const handleActionModalClose = () => {
    if (!isProcessingAction) {
      setActionModalOpen(false)
      setCurrentAction(null)
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
        memoryPalaceCore={memoryPalaceCore}
        currentPalaceState={currentPalaceState}
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

      {/* Action Form Modal */}
      <ActionFormModal
        isOpen={actionModalOpen}
        onClose={handleActionModalClose}
        onSubmit={handleActionFormSubmit}
        action={currentAction}
        currentPalaceState={currentPalaceState}
        isProcessing={isProcessingAction}
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
                <h4>Quick Actions</h4>
                <button 
                  className="menu-item"
                  onClick={() => handleMenuCommand('list-rooms')}
                  disabled={isProcessingAction}
                >
                  <FontAwesomeIcon icon={faList} />
                  <span>List All Rooms</span>
                </button>
                <button 
                  className="menu-item"
                  onClick={() => handleMenuCommand('get-room-info')}
                  disabled={isProcessingAction}
                >
                  <FontAwesomeIcon icon={faEye} />
                  <span>Current Room Info</span>
                </button>
              </div>

              <div className="menu-section">
                <h4>Room Actions</h4>
                <button 
                  className="menu-item"
                  onClick={() => handleMenuCommand('create-room')}
                  disabled={isProcessingAction}
                >
                  <FontAwesomeIcon icon={faPlus} />
                  <span>Create New Room</span>
                </button>
                <button 
                  className="menu-item"
                  onClick={() => handleMenuCommand('edit-room')}
                  disabled={isProcessingAction || !currentPalaceState?.currentRoom}
                >
                  <FontAwesomeIcon icon={faEdit} />
                  <span>Edit Current Room</span>
                </button>
                <button 
                  className="menu-item"
                  onClick={() => handleMenuCommand('go-to-room')}
                  disabled={isProcessingAction || !currentPalaceState?.stats?.totalRooms}
                >
                  <FontAwesomeIcon icon={faArrowRight} />
                  <span>Navigate to Room</span>
                </button>
              </div>

              <div className="menu-section">
                <h4>Object Actions</h4>
                <button 
                  className="menu-item"
                  onClick={() => handleMenuCommand('add-object')}
                  disabled={isProcessingAction || !currentPalaceState?.currentRoom}
                >
                  <FontAwesomeIcon icon={faPlus} />
                  <span>Add Memory Object</span>
                </button>
                <button 
                  className="menu-item"
                  onClick={() => handleMenuCommand('remove-object')}
                  disabled={isProcessingAction || !currentPalaceState?.stats?.totalObjects}
                >
                  <FontAwesomeIcon icon={faTrash} />
                  <span>Remove Object</span>
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
