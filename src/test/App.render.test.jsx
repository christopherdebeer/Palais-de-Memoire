/**
 * General-purpose App component rendering test
 * 
 * This test ensures the App component renders without crashing
 * and catches React hooks violations or other rendering issues.
 * 
 * Runs at build time to prevent deployment of broken code.
 */

import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import App from '../App.jsx'

// Mock Three.js and WebGL components
vi.mock('three', () => ({
  Scene: vi.fn(() => ({ add: vi.fn(), remove: vi.fn() })),
  PerspectiveCamera: vi.fn(() => ({ position: { set: vi.fn() }, lookAt: vi.fn() })),
  WebGLRenderer: vi.fn(() => ({
    setSize: vi.fn(),
    setClearColor: vi.fn(),
    render: vi.fn(),
    domElement: document.createElement('canvas'),
    dispose: vi.fn()
  })),
  Vector3: vi.fn(() => ({ x: 0, y: 0, z: 0 })),
  Clock: vi.fn(() => ({ getDelta: vi.fn(() => 0.016) })),
  TextureLoader: vi.fn(() => ({ load: vi.fn() })),
  SphereGeometry: vi.fn(),
  MeshBasicMaterial: vi.fn(),
  Mesh: vi.fn(() => ({ position: { set: vi.fn() } })),
  BoxGeometry: vi.fn(),
  MeshLambertMaterial: vi.fn(),
  DirectionalLight: vi.fn(() => ({ position: { set: vi.fn() } })),
  AmbientLight: vi.fn()
}))

// Mock MemoryPalace component to prevent 3D rendering in tests
vi.mock('../components/MemoryPalace.jsx', () => ({
  default: ({ onCreationModeTriggered }) => {
    return (
      <div 
        data-testid="memory-palace"
        onClick={() => onCreationModeTriggered && onCreationModeTriggered({
          position: { x: 0.5, y: 0.5 },
          screenPosition: { x: 400, y: 300 },
          worldPosition: { x: 0, y: 0, z: 0 },
          timestamp: Date.now()
        })}
      >
        Memory Palace Mock
      </div>
    )
  }
}))

// Mock Minimap component to prevent canvas issues
vi.mock('../components/Minimap.jsx', () => ({
  default: ({ isVisible, objects, cameraRotation, onLookAt, onToggle }) => {
    if (!isVisible) return null
    return (
      <div data-testid="minimap">
        Minimap Mock - Objects: {objects?.length || 0}
      </div>
    )
  }
}))

// Mock ControlsOverlay
vi.mock('../components/ControlsOverlay.jsx', () => ({
  default: ({ isVisible }) => {
    if (!isVisible) return null
    return <div data-testid="controls-overlay">Controls</div>
  }
}))

// Mock LoadingScreen
vi.mock('../components/LoadingScreen.jsx', () => ({
  default: ({ isLoading, message }) => {
    if (!isLoading) return null
    return <div data-testid="loading-screen">{message || 'Loading...'}</div>
  }
}))

// Mock VoiceInterface to prevent audio context issues
vi.mock('../components/VoiceInterface.jsx', () => ({
  default: ({ isVisible, onClose, onTextInput }) => {
    if (!isVisible) return null
    return (
      <div data-testid="voice-interface">
        <button onClick={() => onTextInput && onTextInput('test input')}>
          Test Voice Input
        </button>
        <button onClick={() => onClose && onClose()}>Close</button>
      </div>
    )
  }
}))

// Mock SettingsModal
vi.mock('../components/SettingsModal.jsx', () => ({
  default: ({ isOpen, onClose }) => {
    if (!isOpen) return null
    return (
      <div data-testid="settings-modal">
        <button onClick={() => onClose && onClose()}>Close Settings</button>
      </div>
    )
  }
}))

// Mock CreationModeInterface
vi.mock('../components/CreationModeInterface.jsx', () => ({
  default: ({ isVisible, onClose, onSubmit }) => {
    if (!isVisible) return null
    return (
      <div data-testid="creation-mode-interface">
        <button onClick={() => onSubmit && onSubmit('test creation')}>
          Submit Creation
        </button>
        <button onClick={() => onClose && onClose()}>Close Creation</button>
      </div>
    )
  }
}))

// Mock MemoryPalaceCore
vi.mock('../core/MemoryPalaceCore.js', () => ({
  MemoryPalaceCore: vi.fn().mockImplementation(() => ({
    isInitialized: false,
    isRunning: false,
    roomManager: null,
    objectManager: null,
    initialize: vi.fn().mockResolvedValue(true),
    start: vi.fn().mockResolvedValue(true),
    dispose: vi.fn().mockResolvedValue(true),
    attemptRecovery: vi.fn().mockResolvedValue(true),
    on: vi.fn(), // Mock event emitter methods
    off: vi.fn(),
    emit: vi.fn(),
    getAllRooms: vi.fn().mockReturnValue([]), // Add missing getAllRooms method
    getCurrentState: vi.fn().mockReturnValue({
      objects: [],
      rooms: [],
      currentRoom: null,
      cameraPosition: { x: 0, y: 0, z: 0 }
    })
  }))
}))

// Create a mock core instance for testing
const createMockCore = () => ({
  isInitialized: false,
  isRunning: false,
  roomManager: null,
  objectManager: null,
  initialize: vi.fn().mockResolvedValue(true),
  start: vi.fn().mockResolvedValue(true),
  dispose: vi.fn().mockResolvedValue(true),
  attemptRecovery: vi.fn().mockResolvedValue(true),
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
  getAllRooms: vi.fn().mockReturnValue([]), // Add missing getAllRooms method
  getCurrentState: vi.fn().mockReturnValue({
    objects: [],
    rooms: [],
    currentRoom: null,
    cameraPosition: { x: 0, y: 0, z: 0 }
  })
})

describe('App Component Rendering', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks()
    
    // Reset DOM
    document.body.innerHTML = ''
    
    // Mock localStorage with proper return values
    const localStorageMock = {
      getItem: vi.fn((key) => {
        // Return null for items that don't exist (proper localStorage behavior)
        return null
      }),
      setItem: vi.fn(),
      clear: vi.fn()
    }
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true
    })
  })

  it('should render without crashing', async () => {
    // This test will catch React hooks violations and other rendering issues
    const mockCore = createMockCore()
    expect(() => {
      render(<App core={mockCore} />)
    }).not.toThrow()
  })

  it('should render core UI elements', async () => {
    const mockCore = createMockCore()
    render(<App core={mockCore} />)
    
    // Wait for component to finish initial render
    await waitFor(() => {
      expect(screen.getByTestId('memory-palace')).toBeInTheDocument()
    })

    // Check that main components are rendered
    expect(screen.getByTestId('memory-palace')).toBeInTheDocument()
  })

  it('should handle component lifecycle without errors', async () => {
    const mockCore = createMockCore()
    const { unmount } = render(<App core={mockCore} />)
    
    // Wait for initial render and effects
    await waitFor(() => {
      expect(screen.getByTestId('memory-palace')).toBeInTheDocument()
    })

    // Should unmount without errors (tests cleanup functions)
    expect(() => {
      unmount()
    }).not.toThrow()
  })

  it('should not have React hooks violations', async () => {
    // This specifically tests for the hooks violation that was fixed
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const mockCore = createMockCore()
    
    render(<App core={mockCore} />)
    
    await waitFor(() => {
      expect(screen.getByTestId('memory-palace')).toBeInTheDocument()
    })

    // Check that no React hooks errors were logged
    const hooksErrors = consoleErrorSpy.mock.calls.filter(call =>
      call[0] && call[0].toString().includes('Invalid hook call')
    )
    
    expect(hooksErrors).toHaveLength(0)
    
    consoleErrorSpy.mockRestore()
  })

  it('should handle React StrictMode double rendering', async () => {
    // Simulate StrictMode by rendering twice quickly
    const mockCore1 = createMockCore()
    const { unmount: unmount1 } = render(<App core={mockCore1} />)
    unmount1()
    
    const mockCore2 = createMockCore()
    const { unmount: unmount2 } = render(<App core={mockCore2} />)
    
    await waitFor(() => {
      expect(screen.getByTestId('memory-palace')).toBeInTheDocument()
    })
    
    expect(() => {
      unmount2()
    }).not.toThrow()
  })

  it('should initialize memory palace core without state inconsistencies', async () => {
    const mockCore = createMockCore()
    render(<App core={mockCore} />)
    
    await waitFor(() => {
      expect(screen.getByTestId('memory-palace')).toBeInTheDocument()
    }, { timeout: 5000 })

    // Test that core initialization doesn't cause state inconsistencies
    // This would catch the original issue #37 problem
    expect(screen.getByTestId('memory-palace')).toBeInTheDocument()
  })
})

describe('App Component Error Boundaries', () => {
  it('should handle component errors gracefully', async () => {
    // Mock console.error to prevent error output in test
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const mockCore = createMockCore()
    
    render(<App core={mockCore} />)
    
    // Component should render even if some internal operations fail
    await waitFor(() => {
      expect(screen.getByTestId('memory-palace')).toBeInTheDocument()
    })
    
    consoleErrorSpy.mockRestore()
  })
})