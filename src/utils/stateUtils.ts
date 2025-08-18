/**
 * State Management Utilities
 * Handles state persistence, serialization, and basic state operations
 */

import { ApplicationState, UserState, Room, MemoryPalaceObject, Connection } from '../types/index.js'

/**
 * State keys for localStorage persistence
 */
export const StateKeys = {
  USER_STATE: 'user',
  ROOMS: 'rooms', 
  OBJECTS: 'objects',
  CONNECTIONS: 'connections',
  CONVERSATION_HISTORY: 'conversationHistory'
}

/**
 * Generate a unique ID
 * @returns {string} Unique identifier
 */
export function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Load state from localStorage
 * @returns {Object} Loaded state object
 */
export async function loadState(): Promise<ApplicationState> {
  const state = {
    user: null,
    rooms: new Map(),
    objects: new Map(), 
    connections: new Map(),
    conversationHistory: []
  }

  try {
    const keys = Object.values(StateKeys)
    
    keys.forEach((key: string) => {
      const stored = localStorage.getItem(`palais_${key}`)
      if (stored) {
        try {
          const parsed = JSON.parse(stored)
          if (key === 'rooms' || key === 'objects' || key === 'connections') {
            (state as any)[key] = new Map(Object.entries(parsed))
          } else {
            (state as any)[key] = parsed
          }
        } catch (error: unknown) {
          console.warn(`Failed to parse stored state for ${key}:`, error)
        }
      }
    })
  } catch (error: unknown) {
    console.error('Failed to load state:', error)
  }

  return state
}

/**
 * Save state to localStorage
 * @param {Object} state - State object to save
 * @param {string} [specificKey] - Optional specific key to save
 */
export async function saveState(state: ApplicationState, specificKey: string | null = null): Promise<void> {
  try {
    const keysToSave = specificKey ? [specificKey] : Object.values(StateKeys)
    
    keysToSave.forEach((key: string) => {
      const value = (state as any)[key]
      if (value !== undefined) {
        let serializable = value
        if (value instanceof Map) {
          serializable = Object.fromEntries(value)
        }
        localStorage.setItem(`palais_${key}`, JSON.stringify(serializable))
      }
    })
  } catch (error: unknown) {
    console.error('Failed to save state:', error)
  }
}

/**
 * Ensure default state structure exists
 * @param {Object} state - State object to validate
 * @returns {Object} State with defaults applied
 */
export function ensureDefaultState(state: ApplicationState): ApplicationState {
  // Initialize user state if not exists
  if (!state.user) {
    state.user = {
      id: generateId(),
      currentRoomId: null,
      roomCounter: 0,
      objectCounter: 0,
      settings: {}
    }
  }

  // Ensure user has an ID
  if (!state.user.id) {
    state.user.id = generateId()
  }

  // Initialize collections if not exist
  const collections = ['rooms', 'objects', 'connections']
  collections.forEach((key: string) => {
    if (!(state as any)[key]) {
      (state as any)[key] = new Map()
    } else if (!((state as any)[key] instanceof Map)) {
      // Convert plain objects back to Maps if loaded from storage
      (state as any)[key] = new Map(Object.entries((state as any)[key] || {}))
    }
  })

  // Initialize conversation history
  if (!state.conversationHistory) {
    state.conversationHistory = []
  }

  return state
}

/**
 * Clear all state from localStorage
 */
export async function clearState() {
  try {
    Object.values(StateKeys).forEach(key => {
      localStorage.removeItem(`palais_${key}`)
    })
  } catch (error) {
    console.error('Failed to clear state:', error)
  }
}

/**
 * Export state for backup/sharing
 * @param {Object} state - State object to export
 * @returns {Object} Serializable state object
 */
export function exportState(state) {
  const exportData = {}
  
  Object.values(StateKeys).forEach(key => {
    const value = state[key]
    if (value !== undefined) {
      if (value instanceof Map) {
        exportData[key] = Object.fromEntries(value)
      } else {
        exportData[key] = value
      }
    }
  })
  
  return {
    version: '0.1.0',
    exportedAt: new Date().toISOString(),
    data: exportData
  }
}

/**
 * Import state from backup
 * @param {Object} importData - State data to import
 * @returns {Object} Imported state object
 */
export function importState(importData) {
  const state = {
    user: null,
    rooms: new Map(),
    objects: new Map(),
    connections: new Map(), 
    conversationHistory: []
  }

  try {
    const data = importData.data || importData
    
    Object.entries(data).forEach(([key, value]) => {
      if (key === 'rooms' || key === 'objects' || key === 'connections') {
        state[key] = new Map(Object.entries(value || {}))
      } else {
        state[key] = value
      }
    })
  } catch (error) {
    console.error('Failed to import state:', error)
  }

  return ensureDefaultState(state)
}

/**
 * Add message to conversation history
 * @param {Object} state - State object
 * @param {string} role - Message role ('user' or 'assistant')
 * @param {string} content - Message content
 */
export function addToHistory(state, role, content) {
  if (!state.conversationHistory) {
    state.conversationHistory = []
  }

  state.conversationHistory.push({
    role,
    content,
    timestamp: new Date().toISOString()
  })
  
  // Trim history if too long
  if (state.conversationHistory.length > 10) {
    state.conversationHistory = state.conversationHistory.slice(-10)
  }
}
