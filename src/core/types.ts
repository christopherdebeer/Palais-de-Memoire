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
} as const;

export type EventType = typeof EventTypes[keyof typeof EventTypes];

/**
 * Core type definitions
 */

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface Room {
  id: string;
  name: string;
  description: string;
  imageUrl: string | null;
  roomCounter: number;
  createdAt: string;
  updatedAt: string;
}

export interface MemoryObject {
  id: string;
  roomId: string;
  name: string;
  information: string;
  position: Vector3;
  objectCounter: number;
  createdAt: string;
  updatedAt: string;
}

export default {
  EventTypes
};