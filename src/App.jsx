import React, { useState, useEffect, useRef } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBars, faCog, faTimes, faHome, faPlus, faList, faInfo, faEdit, faArrowRight, faTrash, faEye } from '@fortawesome/free-solid-svg-icons'
import MemoryPalace from './components/MemoryPalace'
import VoiceInterface from './components/VoiceInterface'
import voiceManager from './utils/VoiceManager.js'
import SettingsPanel from './components/SettingsPanel'
import ActionFormModal from './components/ActionFormModal'
import ObjectInspector from './components/ObjectInspector'
import Minimap from './components/Minimap'
import { EventTypes } from './core/types.js'
import MobileMotionController from './utils/MobileMotionController.js'
import SettingsManager from './services/SettingsManager.js'

// Create settings manager instance
const settingsManager = new SettingsManager()
import './styles/App.css'
import './styles/ActionFormModal.css'

function App({core}) {
  const [isLoading, setIsLoading] = useState(true)
  const [isMobile, setIsMobile] = useState(false)
  const [voiceEnabled, setVoiceEnabled] = useState(true) // Voice enabled by default
  const [wireframeEnabled, setWireframeEnabled] = useState(settingsManager.get('wireframeMode')) // Read from settings
  const [nippleEnabled, setNippleEnabled] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  // captions and TTS
  const [captionText, setCaptionText] = useState('')
  const [captionMode, setCaptionMode] = useState(null) // 'recognition', 'synthesis', null
  const [captionsEnabled, setCaptionsEnabled] = useState(true)

  
  const [memoryPalaceCore, setMemoryPalaceCore] = useState(core)
  const [currentPalaceState, setCurrentPalaceState] = useState(null)
  const coreInitializationRef = useRef(false)
  const [actionModalOpen, setActionModalOpen] = useState(false)
  const [currentAction, setCurrentAction] = useState(null)
  const [isProcessingAction, setIsProcessingAction] = useState(false)
  const [isCreationMode, setIsCreationMode] = useState(false)
  const [pendingCreationPosition, setPendingCreationPosition] = useState(null)
  
  // Object interaction state
  const [selectedObject, setSelectedObject] = useState(null)
  const [objectInspectorOpen, setObjectInspectorOpen] = useState(false)
  const [isProcessingObjectAction, setIsProcessingObjectAction] = useState(false)
  
  // Minimap state
  const [showMinimap, setShowMinimap] = useState(false)
  const [minimapCollapsed, setMinimapCollapsed] = useState(true) // Start collapsed by default
  const [minimapPosition, setMinimapPosition] = useState({ x: 20, y: 20 }) // Default position
  const [cameraRotation, setCameraRotation] = useState({ yaw: 0, pitch: 0 })
  
  // Mobile motion control state
  const [motionControlEnabled, setMotionControlEnabled] = useState(false)
  const [motionController, setMotionController] = useState(null)
  
  const memoryPalaceRef = useRef()
  const captionTimeoutRef = useRef(null)
  
  // Cancellation ref for preventing state updates after unmount - MUST be at top level
  const isCancelledRef = useRef(false)

  useEffect(() => {
    console.log('[App] useEffect triggered, checking initialization state:', {
      isLoading,
      coreInitializationRef: coreInitializationRef.current,
      isCancelled: isCancelledRef.current,
      memoryPalaceCore: !!memoryPalaceCore
    })
    
    // Check if running on mobile
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent))
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    
    // Initialize Memory Palace Core - prevent multiple initializations
    const initializeCore = async (isCancelledParam = isCancelledRef) => {
      if (coreInitializationRef.current) {
        console.log('[App] Core initialization already in progress, skipping...')
        return
      }
      
      coreInitializationRef.current = true
      console.log('[App] Initializing Memory Palace Core...')
      console.log('[App] Core state before initialization:', {
        memoryPalaceCore: !!memoryPalaceCore,
        coreIsInitialized: memoryPalaceCore?.isInitialized,
        coreIsRunning: memoryPalaceCore?.isRunning
      })
      
      try {
        // Set up event listeners for state updates BEFORE initialization
        // This ensures we don't miss any events during the initialization process
        const setupEventListeners = (core) => {
          // Store unsubscribe functions to prevent memory leaks
          const unsubscribers = [];
          
          unsubscribers.push(core.on('room_created', (room) => {
            console.log('[App] Room created:', room)
            updatePalaceState(core)
          }));
          
          unsubscribers.push(core.on('object_created', (object) => {
            console.log('[App] Object created:', object)
            updatePalaceState(core)
          }));
          
          unsubscribers.push(core.on('room_navigated', (room) => {
            console.log('[App] Navigated to room:', room)
            updatePalaceState(core)
          }));

          // Listen for ROOM_CHANGED events for TTS/captions
          unsubscribers.push(core.on(EventTypes.ROOM_CHANGED, (roomChangeData) => {
            console.log('[App] Room changed:', roomChangeData)
            updatePalaceState(core)
            
            // Play TTS and show captions for new room description
            if (roomChangeData.currentRoom?.description) {
              const roomName = roomChangeData.currentRoom.name
              const roomDescription = roomChangeData.currentRoom.description
              const ttsText = `Entering ${roomName}. ${roomDescription}`
              
              console.log('[App] Playing room TTS:', ttsText)
              
              // Show captions
              handleCaptionUpdate(`Entering: ${roomName}`, 'synthesis')
              
              // Play TTS
              if (window.speechSynthesis) {
                window.speechSynthesis.cancel()
                const utterance = new SpeechSynthesisUtterance(ttsText)
                utterance.rate = 0.9
                utterance.pitch = 1.0
                utterance.volume = 0.8
                window.speechSynthesis.speak(utterance)
              }
            }
          }));
          
          // Add error event listener
          unsubscribers.push(core.on(EventTypes.ERROR_OCCURRED, (error) => {
            console.error('[App] Core error:', error)
            // Provide user feedback for critical errors
            if (error.type === 'initialization_error' || error.type === 'startup_error') {
              handleCaptionUpdate(`Error: ${error.error}. Please try refreshing the application.`, 'synthesis')
            }
          }));
          
          // Return unsubscribe function that cleans up all listeners
          return () => unsubscribers.forEach(unsubscribe => unsubscribe());
        };
        
        // Setup event listeners and store cleanup function
        const cleanupListeners = setupEventListeners(memoryPalaceCore);
        
        // Initialize the core
        console.log('[App] About to call memoryPalaceCore.initialize()...')
        const initialized = await memoryPalaceCore.initialize()
        console.log('[App] Core initialization result:', initialized)
        console.log('[App] Core state after initialization:', {
          isInitialized: memoryPalaceCore?.isInitialized,
          isRunning: memoryPalaceCore?.isRunning,
          hasRoomManager: !!memoryPalaceCore?.roomManager,
          hasObjectManager: !!memoryPalaceCore?.objectManager
        })
        
        if (initialized) {
          console.log('[App] Starting core...')
          await memoryPalaceCore.start()
          console.log('[App] Core started, updating state...')
          console.log('[App] Core state after start:', {
            isInitialized: memoryPalaceCore?.isInitialized,
            isRunning: memoryPalaceCore?.isRunning
          })
          
          // Check if component was unmounted during initialization
          if (isCancelledParam.current) {
            console.log('[App] Component unmounted during initialization, aborting state updates')
            return
          }
          
          // Update state and store core reference
          setMemoryPalaceCore(memoryPalaceCore)
          
          console.log('[App] State updated - core:', !!memoryPalaceCore, 'initialized: true')
          
          // Initial state update
          updatePalaceState(memoryPalaceCore)
          
          console.log('[App] ❇️ Memory Palace Core initialized successfully')
          
        } else {
          console.error('[App] Failed to initialize Memory Palace Core')
          coreInitializationRef.current = false
        }
      } catch (error) {
        console.error('[App] Error initializing Memory Palace Core:', error)
        coreInitializationRef.current = false
      }
    }
    
    // Load caption preferences - default to enabled
    const savedCaptions = localStorage.getItem('memoryCaptionsEnabled')
    if (savedCaptions !== null) {
      setCaptionsEnabled(JSON.parse(savedCaptions))
    } else {
      // Default to enabled for better user experience
      setCaptionsEnabled(true)
      localStorage.setItem('memoryCaptionsEnabled', JSON.stringify(true))
    }

    // Simplified initialization with faster fallback
    const initWithTimeout = async () => {
      const initTimeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Initialization timeout - taking too long')), 3000) // Reduced to 3 seconds
      )
      
      try {
        await Promise.race([initializeCore(isCancelledRef), initTimeout])
        console.log('[App] Core initialization completed successfully')
        if (!isCancelledRef.current) {
          console.log('[App] Setting loading to false after successful initialization')
          setIsLoading(false)
        }
      } catch (error) {
        console.error('[App] Core initialization failed or timed out:', error)
        console.log('[App] Attempting emergency fallback - setting loading to false immediately')
        
        // Emergency fallback - just show the UI even if core isn't fully ready
        if (!isCancelledRef.current) {
          setIsLoading(false)
          
          if (error.message.includes('timeout')) {
            console.warn('[App] Using emergency mode due to timeout')
            // Show simple alert instead of caption since caption system might not be ready
            setTimeout(() => alert('Loading took too long. App is in emergency mode - some features may not work.'), 100)
          } else {
            console.warn('[App] Using emergency mode due to initialization error')  
            setTimeout(() => alert('Initialization failed. App is in emergency mode - please refresh if issues persist.'), 100)
          }
        }
      }
    }
    
    initWithTimeout()
    
    return () => {
      // Mark as cancelled to prevent state updates
      // isCancelledRef.current = true
      
      window.removeEventListener('resize', checkMobile)
      if (captionTimeoutRef.current) {
        clearTimeout(captionTimeoutRef.current)
      }
      // // Clean up memory palace core
      // if (memoryPalaceCore) {
      //   memoryPalaceCore.dispose()
      // }
      // // Reset initialization ref to allow re-initialization on remount
      // coreInitializationRef.current = false
    }
  }, [memoryPalaceCore])

  // Helper function to update palace state
  const updatePalaceState = (core) => {
    if (core) {
      try {
        const state = core.getCurrentState()
        setCurrentPalaceState(state)
        console.log('[App] Palace state updated:', state)
      } catch (error) {
        console.error('[App] Error updating palace state:', error)
      }
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
    if (command === 'list-rooms' || command === 'get-room-info' || command === 'regenerate-image') {
      if (!memoryPalaceCore || !memoryPalaceCore.isInitialized) {
        console.warn('[App] Memory Palace Core not initialized')
        return
      }
      
      try {
        setIsProcessingAction(true)
        
        // Execute the action directly
        let toolName
        if (command === 'list-rooms') {
          toolName = 'list_rooms'
        } else if (command === 'get-room-info') {
          toolName = 'get_room_info'
        } else if (command === 'regenerate-image') {
          toolName = 'regenerate_room_image'
        }
        
        let result
        
        if (memoryPalaceCore.roomManager) {
          const MemoryPalaceToolManager = (await import('./utils/memoryPalaceTools.js')).default
          const toolManager = new MemoryPalaceToolManager(memoryPalaceCore)
          result = await toolManager.executeTool(toolName, {}, null)
        } else {
          result = 'Memory Palace not fully initialized'
        }
        
        console.log('[App] Direct action result:', result)
        
        // Convert result to string if it's an object
        const resultText = typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result)
        
        // Trigger TTS and captions using speakResponse for consistency
        speakResponse(resultText)
        
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

  const speakResponse = async (text) => {
      console.log('[App] Speaking response:', {
        text,
        speechSynthesisSupported: 'speechSynthesis' in window,
        audioFeedbackEnabled: settingsManager.get('audioFeedback')
      })
      
      if ('speechSynthesis' in window && settingsManager.get('audioFeedback')) {
        // Cancel any existing speech
        window.speechSynthesis.cancel()
        
        const utterance = new SpeechSynthesisUtterance(text)
        utterance.rate = settingsManager.get('speechRate') || 1.0
        utterance.pitch = settingsManager.get('speechPitch') || 1.0
        utterance.volume = 0.8
        
        console.log('[App] TTS settings:', {
          rate: utterance.rate,
          pitch: utterance.pitch,
          volume: utterance.volume
        })
  
        // iOS Safari detection for voice handling workaround
        const isIOSSafari = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                           (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
        
        console.log('[App] iOS Safari detection:', { isIOSSafari, userAgent: navigator.userAgent })
        
        // Only set voice if not on iOS Safari to avoid boundary event issues
        if (true || !isIOSSafari) {
          // Use configured voice with VoiceManager for better voice handling
          const selectedVoiceName = settingsManager.get('voice')
          console.log('[App] Voice selection:', {
            selectedVoiceName,
            voiceManagerLoaded: !voiceManager.isLoading()
          })
          
          if (selectedVoiceName) {
            try {
              const selectedVoice = await voiceManager.findVoiceByName(selectedVoiceName)
              if (selectedVoice) {
                utterance.voice = selectedVoice
                console.log('[App] Using voice from VoiceManager:', {
                  name: selectedVoice.name,
                  lang: selectedVoice.lang,
                  localService: selectedVoice.localService
                })
              } else {
                console.warn('[App] Selected voice not found:', selectedVoiceName)
                // Fallback to default voice for the language
                //const defaultVoice = await voiceManager.getDefaultVoiceForLanguage('en')
                //if (defaultVoice) {
                  //utterance.voice = defaultVoice
                  console.log('[App] Using default voice fallback')
                //}
              }
            } catch (error) {
              console.error('[App] Error setting voice:', error)
            }
          } else {
            // No voice selected, use system default or get a recommended voice
            try {
              const defaultVoice = await voiceManager.getDefaultVoiceForLanguage('en')
              if (defaultVoice) {
                utterance.voice = defaultVoice
                console.log('[App] Using system default voice:', defaultVoice.name)
              }
            } catch (error) {
              console.warn('[App] Could not set default voice:', error)
            }
          }
        } else {
          console.log('[App] iOS Safari detected - skipping voice assignment to avoid boundary event issues')
        }
  
        // Enhanced caption display with karaoke-style highlighting
        if (captionsEnabled) {
          console.log('[App] Setting up TTS captions for:', text.substring(0, 50) + '...')
          handleCaptionUpdate(text, 'synthesis')
          
          // Set up word-by-word highlighting
          let wordIndex = 0
          const words = text.split(/\s+/)
          
          utterance.onboundary = (event) => {
            // console.log('[App] TTS boundary event:', event.name, 'wordIndex:', wordIndex)
            if (event.name === 'word' && captionsEnabled) {
              wordIndex++
              const spoken = words.slice(0, wordIndex).join(' ')
              const remaining = words.slice(wordIndex).join(' ')
              
              // Create karaoke-style highlighting
              const highlightedText = remaining.length > 0 
                ? `<span class="spoken">${spoken}</span> ${remaining}`
                : `<span class="spoken">${spoken}</span>`
              
              // console.log('[App] Updating caption with highlighting:', highlightedText.substring(0, 50) + '...')
              handleCaptionUpdate(highlightedText, 'synthesis')
            }
          }
        } else {
          console.log('[App] Captions disabled, not showing TTS captions')
        }
        
        utterance.onstart = () => {
          console.log('[App] TTS started')
        }
        
        utterance.onend = () => {
          console.log('[App] TTS ended')
          // Caption hiding is now handled at App level
        }
        
        utterance.onerror = (event) => {
          console.error('[VoiceInterface] TTS error:', {
            error: event.error,
            type: event.type,
            stack: new Error().stack
          })
          // Caption hiding is now handled at App level
        }
  
        window.speechSynthesis.speak(utterance)
      } else {
        console.log('[App] TTS skipped - not supported or audio feedback disabled')
      }
    }

  const handleVoiceCommand = async (command) => {
    console.log('[App] Voice command received:', {
      type: command.type,
      parameters: command.parameters,
      originalInput: command.originalInput,
      aiResponse: command.aiResponse,
      isCreationMode: isCreationMode
    })
    
    if (!memoryPalaceCore || !memoryPalaceCore.isInitialized) {
      console.warn('[App] Memory Palace Core not initialized, cannot process command')
      return
    }
    
    try {
      // Handle different command types with actual core operations
      switch (command.type.toLowerCase()) {
        case 'create_room':
          console.log('[App] Processing CREATE_ROOM command:', command.parameters)
          if (command.parameters.name && command.parameters.description) {
            const room = await memoryPalaceCore.createRoom(
              command.parameters.name,
              command.parameters.description
            )
            console.log('[App] Room created successfully:', room)
            updatePalaceState(memoryPalaceCore)
            
            // Exit creation mode if this was triggered by creation mode
            if (isCreationMode) {
              handleCreationModeComplete()
            }
          }
          break
        
        case 'add_object':
          console.log('[App] Processing ADD_OBJECT command:', command.parameters)
          if (command.parameters.name && command.parameters.info) {
            // Use pending creation position if in creation mode
            const position = isCreationMode ? pendingCreationPosition : (command.parameters.position || null)
            const object = await memoryPalaceCore.addObject(
              command.parameters.name,
              command.parameters.info,
              position
            )
            console.log('[App] Object added successfully:', object)
            updatePalaceState(memoryPalaceCore)
            
            // Exit creation mode if this was triggered by creation mode
            if (isCreationMode) {
              handleCreationModeComplete()
            }
          }
          break
        
        case 'remove_object':
          console.log('[App] Processing REMOVE_OBJECT command:', command.parameters)
          if (command.parameters.name) {
            const currentObjects = memoryPalaceCore.getCurrentRoomObjects()
            const targetObject = currentObjects.find(obj => 
              obj.name.toLowerCase().includes(command.parameters.name.toLowerCase())
            )
            if (targetObject) {
              await memoryPalaceCore.deleteObject(targetObject.id)
              console.log('[App] Object removed successfully:', targetObject)
              updatePalaceState(memoryPalaceCore)
            } else {
              console.warn('[App] Object not found:', command.parameters.name)
            }
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
            await memoryPalaceCore.editRoom(
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
        
        case 'regenerate_room_image':
          console.log('[App] Processing REGENERATE_ROOM_IMAGE command')
          // The image regeneration is handled by the tool manager and AI response
          // Just log for debugging - the actual work is done in the tool
          if (currentPalaceState?.currentRoom) {
            console.log('[App] Regenerating image for room:', currentPalaceState.currentRoom.name)
          }
          break
        
        case 'response':
          console.log('[App] Processing AI RESPONSE command:', command.parameters)
          // Handle general AI responses that don't require specific actions
          // The response text is already handled by TTS in VoiceInterface
          if (command.parameters?.text) {
            console.log('[App] AI response text:', command.parameters.text.substring(0, 100) + '...')
          }
          break
        
        case 'fallback':
          console.log('[App] Processing fallback command:', command.parameters?.input || 'no input')
          // Handle basic fallback logic - no core operations needed
          // The fallback response is already handled by TTS in VoiceInterface
          break
        
        default:
          console.warn('[App] Unknown command type:', {
            type: command.type,
            originalType: command.type,
            lowercaseType: command.type.toLowerCase(),
            parameters: command.parameters,
            availableCommands: [
              'create_room', 'add_object', 'remove_object', 'go_to_room', 
              'edit_room', 'list_rooms', 'get_room_info', 'response', 'fallback'
            ]
          })
          // Don't throw error, just log for debugging
          break
      }
    } catch (error) {
      console.error('[App] Error processing voice command:', error)
    }
  }

  const handleActionFormSubmit = async (action, formData) => {
    console.log('[App] Action form submitted:', { action, formData })
    
    if (!memoryPalaceCore || !memoryPalaceCore.isInitialized) {
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
      
      // Convert result to string if it's an object
      const resultText = typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result)
      
      // Trigger TTS and captions using speakResponse for consistency
      speakResponse(`Success: ${resultText}`)
      
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

  const handleCaptionUpdate = (text, mode, disableTimeout) => {
    // console.log('[App] Caption update:', { text, mode, captionsEnabled })
    
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
    if (!disableTimeout) captionTimeoutRef.current = setTimeout(() => {
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

  const handleCreationModeTriggered = (creationData) => {
    console.log('[App] Creation mode triggered:', creationData)
    console.log('[App] Current state check:', {
      memoryPalaceCore: !!memoryPalaceCore,
      coreInitialized: memoryPalaceCore.isInitialized,
      coreInitializationRef: coreInitializationRef.current,
      memoryPalaceCoreInitialized: memoryPalaceCore?.isInitialized,
      memoryPalaceCoreRunning: memoryPalaceCore?.isRunning
    })
    
    // Check if core initialization is complete using state
    if (!memoryPalaceCore.isInitialized || !memoryPalaceCore) {
      console.warn('[App] Memory Palace Core not initialized, cannot enter creation mode')
      console.warn('[App] Debug info:', {
        memoryPalaceCore: !!memoryPalaceCore,
        coreInitialized: memoryPalaceCore.isInitialized,
        coreInitializationRef: coreInitializationRef.current,
        memoryPalaceCoreState: memoryPalaceCore ? {
          isInitialized: memoryPalaceCore.isInitialized,
          isRunning: memoryPalaceCore.isRunning,
          hasRoomManager: !!memoryPalaceCore.roomManager,
          hasObjectManager: !!memoryPalaceCore.objectManager
        } : 'null'
      })
      return
    }
    
    console.log('[App] ✅ Memory Palace Core is ready - entering creation mode')
    
    // Store the creation position and enter creation mode
    setPendingCreationPosition(creationData.position)
    setIsCreationMode(true)
    
    // Show visual feedback
    handleCaptionUpdate('Double-click detected! Describe what you want to create at this location.', 'synthesis')
    
    // Auto-start voice listening for creation mode
    if (voiceEnabled) {
      console.log('[App] Auto-starting voice input for creation mode')
      // The VoiceInterface will detect creation mode and auto-start listening
    }
    
    // Auto-exit creation mode after 10 seconds if no voice input
    setTimeout(() => {
      if (isCreationMode) {
        console.log('[App] Creation mode timeout - exiting')
        setIsCreationMode(false)
        setPendingCreationPosition(null)
      }
    }, 10000)
  }

  const handleCreationModeComplete = () => {
    console.log('[App] Creation mode complete')
    setIsCreationMode(false)
    setPendingCreationPosition(null)
  }

  // Object interaction handlers
  const handleObjectSelected = (objectId) => {
    console.log('[App] Object selected:', objectId)
    if (!memoryPalaceCore || !memoryPalaceCore.isInitialized) return
    
    const objects = memoryPalaceCore.getCurrentRoomObjects()
    const object = objects.find(obj => obj.id === objectId)
    
    if (object) {
      setSelectedObject(object)
      setObjectInspectorOpen(true)
    }
  }

  const handleObjectEdit = async (updatedObject) => {
    console.log('[App] Object edit:', updatedObject)
    if (!memoryPalaceCore || !memoryPalaceCore.isInitialized) return
    
    try {
      setIsProcessingObjectAction(true)
      
      // Update object through core
      await memoryPalaceCore.updateObject(updatedObject.id, {
        name: updatedObject.name,
        information: updatedObject.information
      })
      
      // Update local state
      setSelectedObject(updatedObject)
      updatePalaceState(memoryPalaceCore)
      
      handleCaptionUpdate(`Object "${updatedObject.name}" updated successfully`, 'synthesis')
      
    } catch (error) {
      console.error('[App] Error updating object:', error)
      alert(`Error updating object: ${error.message}`)
    } finally {
      setIsProcessingObjectAction(false)
    }
  }

  const handleObjectDelete = async (objectId) => {
    console.log('[App] Object delete:', objectId)
    if (!memoryPalaceCore || !memoryPalaceCore.isInitialized) return
    
    try {
      setIsProcessingObjectAction(true)
      
      // Delete object through core
      await memoryPalaceCore.deleteObject(objectId)
      
      // Close inspector and update state
      setObjectInspectorOpen(false)
      setSelectedObject(null)
      updatePalaceState(memoryPalaceCore)
      
      handleCaptionUpdate('Object deleted successfully', 'synthesis')
      
    } catch (error) {
      console.error('[App] Error deleting object:', error)
      alert(`Error deleting object: ${error.message}`)
    } finally {
      setIsProcessingObjectAction(false)
    }
  }

  const handleObjectMove = (objectId) => {
    console.log('[App] Object move:', objectId)
    // TODO: Implement object moving functionality
    // This could enter a "move mode" where the user clicks to place the object
    handleCaptionUpdate('Object moving not yet implemented', 'synthesis')
  }

  const handleObjectInspectorClose = () => {
    setObjectInspectorOpen(false)
    setSelectedObject(null)
  }

  // Minimap handlers
  const handleMinimapToggle = () => {
    setMinimapCollapsed(!minimapCollapsed)
  }

  const handleMinimapLookAt = (rotation) => {
    console.log('[App] Minimap look at:', rotation)
    setCameraRotation(rotation)
    
    // Update camera in MemoryPalace component
    if (memoryPalaceRef.current && memoryPalaceRef.current.setCameraRotation) {
      memoryPalaceRef.current.setCameraRotation(rotation)
    }
  }

  // Mobile motion control handlers
  const handleMotionControlToggle = async (enabled) => {
    console.log('[App] Motion control toggle:', enabled)
    
    if (enabled) {
      if (!motionController) {
        // Create motion controller
        const controller = new MobileMotionController((rotation) => {
          setCameraRotation(rotation)
          // Update camera in MemoryPalace component
          if (memoryPalaceRef.current && memoryPalaceRef.current.setCameraRotation) {
            memoryPalaceRef.current.setCameraRotation(rotation)
          }
        })
        
        setMotionController(controller)
        
        const success = await controller.enable()
        if (success) {
          setMotionControlEnabled(true)
          handleCaptionUpdate('Motion control enabled - tilt your device to look around', 'synthesis')
        } else {
          handleCaptionUpdate('Motion control permission denied or not supported', 'synthesis')
        }
      } else {
        const success = await motionController.enable()
        if (success) {
          setMotionControlEnabled(true)
          handleCaptionUpdate('Motion control enabled', 'synthesis')
        }
      }
    } else {
      if (motionController) {
        motionController.disable()
        setMotionControlEnabled(false)
        handleCaptionUpdate('Motion control disabled', 'synthesis')
      }
    }
  }

  const handleMotionControlCalibrate = () => {
    if (motionController && motionControlEnabled) {
      motionController.calibrate()
      handleCaptionUpdate('Motion control calibrated', 'synthesis')
    }
  }

  return (
    <div className={`app ${isMobile ? 'mobile' : 'desktop'} ${isListening ? 'listening' : ''}`}>
      {/* Always show the MemoryPalace (skybox) as initial state */}
      <MemoryPalace 
        ref={memoryPalaceRef}
        wireframeEnabled={wireframeEnabled}
        nippleEnabled={nippleEnabled}
        onCreationModeTriggered={handleCreationModeTriggered}
        onObjectSelected={handleObjectSelected}
        selectedObjectId={selectedObject?.id}
        cameraRotation={cameraRotation}
        onCameraRotationChange={setCameraRotation}
        currentRoom={currentPalaceState?.currentRoom}
        objects={currentPalaceState?.objects || []}
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
        speakResponse={speakResponse}
        onCaptionToggle={handleCaptionToggle}
        memoryPalaceCore={memoryPalaceCore}
        currentPalaceState={currentPalaceState}
        isCreationMode={isCreationMode}
        pendingCreationPosition={pendingCreationPosition}
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

      {/* Object Inspector Modal */}
      <ObjectInspector
        isOpen={objectInspectorOpen}
        object={selectedObject}
        onClose={handleObjectInspectorClose}
        onEdit={handleObjectEdit}
        onDelete={handleObjectDelete}
        onMove={handleObjectMove}
        isProcessing={isProcessingObjectAction}
      />

      {/* Minimap */}
      {showMinimap && (
        <Minimap
          isVisible={showMinimap}
          objects={currentPalaceState?.objects || []}
          cameraRotation={cameraRotation}
          onLookAt={handleMinimapLookAt}
          onToggle={handleMinimapToggle}
          isCollapsed={minimapCollapsed}
          position={minimapPosition}
          onPositionChange={setMinimapPosition}
        />
      )}

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
                  <div className="menu-item-content">
                    <FontAwesomeIcon icon={faList} />
                    <span>List All Rooms</span>
                  </div>
                </button>
                <button 
                  className="menu-item"
                  onClick={() => handleMenuCommand('get-room-info')}
                  disabled={isProcessingAction}
                >
                  <div className="menu-item-content">
                    <FontAwesomeIcon icon={faEye} />
                    <span>Current Room Info</span>
                  </div>
                </button>
              </div>

              <div className="menu-section">
                <h4>Room Actions</h4>
                <button 
                  className="menu-item"
                  onClick={() => handleMenuCommand('create-room')}
                  disabled={isProcessingAction}
                >
                  <div className="menu-item-content">
                    <FontAwesomeIcon icon={faPlus} />
                    <span>Create New Room</span>
                  </div>
                </button>
                <button 
                  className="menu-item"
                  onClick={() => handleMenuCommand('edit-room')}
                  disabled={isProcessingAction || !currentPalaceState?.currentRoom}
                >
                  <div className="menu-item-content">
                    <FontAwesomeIcon icon={faEdit} />
                    <span>Edit Current Room</span>
                  </div>
                  {(isProcessingAction || !currentPalaceState?.currentRoom) && (
                    <small className="disabled-reason">
                      {isProcessingAction ? 'Processing...' : 'No current room'}
                    </small>
                  )}
                </button>
                <button 
                  className="menu-item"
                  onClick={() => handleMenuCommand('go-to-room')}
                  disabled={isProcessingAction || !currentPalaceState?.stats?.totalRooms}
                >
                  <div className="menu-item-content">
                    <FontAwesomeIcon icon={faArrowRight} />
                    <span>Navigate to Room</span>
                  </div>
                  {(isProcessingAction || !currentPalaceState?.stats?.totalRooms) && (
                    <small className="disabled-reason">
                      {isProcessingAction ? 'Processing...' : 'No rooms available'}
                    </small>
                  )}
                </button>
                <button 
                  className="menu-item"
                  onClick={() => handleMenuCommand('regenerate-image')}
                  disabled={isProcessingAction || !currentPalaceState?.currentRoom}
                >
                  <div className="menu-item-content">
                    <FontAwesomeIcon icon={faEdit} />
                    <span>Regenerate Room Image</span>
                  </div>
                  {(isProcessingAction || !currentPalaceState?.currentRoom) && (
                    <small className="disabled-reason">
                      {isProcessingAction ? 'Processing...' : 'No current room'}
                    </small>
                  )}
                </button>
              </div>

              <div className="menu-section">
                <h4>Object Actions</h4>
                <button 
                  className="menu-item"
                  onClick={() => handleMenuCommand('add-object')}
                  disabled={isProcessingAction || !currentPalaceState?.currentRoom}
                >
                  <div className="menu-item-content">
                    <FontAwesomeIcon icon={faPlus} />
                    <span>Add Memory Object</span>
                  </div>
                  {(isProcessingAction || !currentPalaceState?.currentRoom) && (
                    <small className="disabled-reason">
                      {isProcessingAction ? 'Processing...' : 'No current room'}
                    </small>
                  )}
                </button>
                <button 
                  className="menu-item"
                  onClick={() => handleMenuCommand('remove-object')}
                  disabled={isProcessingAction || !currentPalaceState?.stats?.totalObjects}
                >
                  <div className="menu-item-content">
                    <FontAwesomeIcon icon={faTrash} />
                    <span>Remove Object</span>
                  </div>
                  {(isProcessingAction || !currentPalaceState?.stats?.totalObjects) && (
                    <small className="disabled-reason">
                      {isProcessingAction ? 'Processing...' : 'No objects to remove'}
                    </small>
                  )}
                </button>
              </div>

              <div className="menu-section">
                <h4>Help</h4>
                <button 
                  className="menu-item"
                  onClick={() => handleMenuCommand('about')}
                >
                  <div className="menu-item-content">
                    <FontAwesomeIcon icon={faInfo} />
                    <span>About</span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </>
      )}
      
      <div className="app-header">
        <h1>{memoryPalaceCore?.getCurrentState()?.currentRoom?.name || "Palais de Mémoire"}</h1>
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
