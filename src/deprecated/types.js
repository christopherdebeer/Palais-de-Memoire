// Core type definitions and interfaces for the Memory Palace application

/**
 * @typedef {Object} Room
 * @property {string} id - Unique identifier for the room
 * @property {string} userId - User who owns this room
 * @property {string} name - Display name of the room
 * @property {string} description - Detailed description for image generation
 * @property {string|null} imageUrl - Generated panoramic image URL
 * @property {number} roomCounter - Sequential room number
 * @property {Date} createdAt - Room creation timestamp
 * @property {Date} updatedAt - Last modification timestamp
 */

/**
 * @typedef {Object} MemoryObject
 * @property {string} id - Unique identifier for the object
 * @property {string} roomId - Room containing this object
 * @property {string} userId - User who owns this object
 * @property {string} name - Object name/label
 * @property {string} information - Memory content associated with object
 * @property {Vector3} position - 3D position in the room
 * @property {number} objectCounter - Sequential object number
 * @property {Date} createdAt - Object creation timestamp
 * @property {Date} updatedAt - Last modification timestamp
 */

/**
 * @typedef {Object} Connection
 * @property {string} id - Unique identifier for the connection
 * @property {string} roomId - Source room ID
 * @property {string} userId - User who owns this connection
 * @property {string} targetRoomId - Destination room ID
 * @property {string} description - Description of the door/entrance
 * @property {boolean} bidirectional - Whether connection works both ways
 * @property {Vector3} position - 3D position of the door in source room
 * @property {Date} createdAt - Connection creation timestamp
 */

/**
 * @typedef {Object} Vector3
 * @property {number} x - X coordinate
 * @property {number} y - Y coordinate 
 * @property {number} z - Z coordinate
 */

/**
 * @typedef {Object} UserState
 * @property {string} id - User identifier
 * @property {string|null} currentRoomId - ID of currently active room
 * @property {number} roomCounter - Counter for room numbering
 * @property {number} objectCounter - Counter for object numbering
 * @property {Object} settings - User preferences and configuration
 */

/**
 * @typedef {Object} Command
 * @property {string} action - Primary action type (CREATE_ROOM, ADD_OBJECT, etc.)
 * @property {Object} parameters - Structured command parameters
 * @property {string} originalText - Original user input
 * @property {string} response - AI-generated response text
 * @property {number} confidence - Command parsing confidence (0-1)
 */

/**
 * @typedef {Object} APIResponse
 * @property {boolean} success - Whether the API call succeeded
 * @property {any} data - Response data (varies by endpoint)
 * @property {string|null} error - Error message if failed
 * @property {Object} metadata - Additional response metadata
 */

/**
 * Command action types
 */
export const CommandActions = {
  CREATE_ROOM: 'CREATE_ROOM',
  EDIT_ROOM: 'EDIT_ROOM',
  ADD_OBJECT: 'ADD_OBJECT',
  CREATE_DOOR: 'CREATE_DOOR',
  NAVIGATE: 'NAVIGATE',
  DESCRIBE: 'DESCRIBE',
  LIST: 'LIST',
  CHAT: 'CHAT',
  DELETE_OBJECT: 'DELETE_OBJECT',
  DELETE_ROOM: 'DELETE_ROOM'
}

/**
 * Application state keys
 */
export const StateKeys = {
  USER_STATE: 'user_state',
  ROOMS: 'rooms',
  OBJECTS: 'objects',
  CONNECTIONS: 'connections',
  SETTINGS: 'settings',
  CONVERSATION_CONTEXT: 'conversation_context'
}

/**
 * Event types for the application event system
 */
export const EventTypes = {
  ROOM_CREATED: 'room_created',
  ROOM_UPDATED: 'room_updated',
  ROOM_DELETED: 'room_deleted',
  ROOM_CHANGED: 'room_changed',
  ROOM_NAVIGATED: 'room_navigated',
  OBJECT_CREATED: 'object_created',
  OBJECT_UPDATED: 'object_updated',
  OBJECT_DELETED: 'object_deleted',
  CONNECTION_CREATED: 'connection_created',
  CONNECTION_DELETED: 'connection_deleted',
  COMMAND_PROCESSED: 'command_processed',
  STATE_CHANGED: 'state_changed',
  API_REQUEST: 'api_request',
  API_RESPONSE: 'api_response',
  ERROR_OCCURRED: 'error_occurred'
}

/**
 * Default settings object
 */
export const DefaultSettings = {
  voice: {
    enabled: true,
    selectedVoice: null,
    speechRate: 0.9,
    speechPitch: 1.0
  },
  ai: {
    systemPrompt: 'You are a helpful memory palace assistant.',
    responseTemperature: 0.7,
    aestheticPrompt: 'photorealistic, high quality, immersive'
  },
  rendering: {
    quality: 'high',
    enableParticles: true,
    compassVisible: true
  },
  accessibility: {
    captions: false,
    highContrast: false,
    reducedMotion: false
  }
}

export default {
  CommandActions,
  StateKeys, 
  EventTypes,
  DefaultSettings
}
