/**
 * Essential type definitions for the Memory Palace application
 * Simplified to reduce over-abstraction while maintaining functionality
 */

/**
 * Event types for the application event system
 */
export const EventTypes = {
  // Core system events
  ROOM_CREATED: 'room_created',
  ROOM_UPDATED: 'room_updated',
  ROOM_DELETED: 'room_deleted',
  ROOM_CHANGED: 'room_changed',
  
  OBJECT_CREATED: 'object_created',
  OBJECT_UPDATED: 'object_updated',
  OBJECT_DELETED: 'object_deleted',
  
  CONNECTION_CREATED: 'connection_created',
  
  COMMAND_PROCESSED: 'command_processed',
  STATE_CHANGED: 'state_changed',
  
  ERROR_OCCURRED: 'error_occurred'
}

/**
 * Basic type definitions for JSDoc (simplified)
 */

/**
 * @typedef {Object} Room
 * @property {string} id
 * @property {string} name
 * @property {string} description
 * @property {string|null} imageUrl
 * @property {number} roomCounter
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * @typedef {Object} MemoryObject
 * @property {string} id
 * @property {string} roomId
 * @property {string} name
 * @property {string} information
 * @property {Vector3} position
 * @property {number} objectCounter
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * @typedef {Object} Vector3
 * @property {number} x
 * @property {number} y
 * @property {number} z
 */

export default {
  EventTypes
}
