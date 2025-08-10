/**
 * Memory Palace Core - Main exports
 * Provides the complete core system for the Memory Palace application
 */

// Core system
export { MemoryPalaceCore, getMemoryPalaceCore, createMemoryPalaceCore } from './MemoryPalaceCore.js'

// Individual managers
export { StateManager } from './StateManager.js'
export { APIManager, MockAPIProvider, BaseAPIProvider, WebSimAPIProvider } from './APIManager.js'
export { RoomManager } from './RoomManager.js'
export { ObjectManager } from './ObjectManager.js'
export { InteractionController } from './InteractionController.js'

// Utilities
export { EventEmitter } from './EventEmitter.js'

// Types and constants
export { 
  CommandActions, 
  StateKeys, 
  EventTypes, 
  DefaultSettings 
} from './types.js'

/**
 * Quick setup function for basic usage
 * @param {Object} config - Configuration options
 * @returns {Promise<MemoryPalaceCore>} Initialized core instance
 */
export async function setupMemoryPalace(config = {}) {
  const { createMemoryPalaceCore } = await import('./MemoryPalaceCore.js')
  
  const core = createMemoryPalaceCore({
    apiProvider: 'mock',
    persistence: 'localStorage',
    enableVoice: true,
    enableSpatialInteraction: true,
    ...config
  })
  
  const success = await core.initialize()
  if (!success) {
    throw new Error('Failed to initialize Memory Palace Core')
  }
  
  await core.start()
  return core
}

/**
 * Version information
 */
export const VERSION = '0.1.0'

/**
 * Feature flags for progressive enhancement
 */
export const FEATURES = {
  VOICE_SYNTHESIS: typeof window !== 'undefined' && 'speechSynthesis' in window,
  VOICE_RECOGNITION: typeof window !== 'undefined' && 'webkitSpeechRecognition' in window,
  DEVICE_ORIENTATION: typeof window !== 'undefined' && 'DeviceOrientationEvent' in window,
  WEB_GL: typeof window !== 'undefined' && !!window.WebGLRenderingContext,
  LOCAL_STORAGE: typeof window !== 'undefined' && 'localStorage' in window,
  INDEX_DB: typeof window !== 'undefined' && 'indexedDB' in window
}

/**
 * Default configuration
 */
export const DEFAULT_CONFIG = {
  apiProvider: 'mock',
  persistence: 'localStorage',
  enableVoice: FEATURES.VOICE_SYNTHESIS && FEATURES.VOICE_RECOGNITION,
  enableSpatialInteraction: true,
  autopilot: false,
  maxRooms: 100,
  maxObjectsPerRoom: 50,
  maxConversationHistory: 10
}

// Import for default export
import { MemoryPalaceCore, getMemoryPalaceCore, createMemoryPalaceCore } from './MemoryPalaceCore.js'

// Default export
const MemoryPalace = {
  MemoryPalaceCore,
  getMemoryPalaceCore,
  createMemoryPalaceCore,
  setupMemoryPalace,
  VERSION,
  FEATURES,
  DEFAULT_CONFIG
}

export default MemoryPalace