/**
 * Consolidated type definitions for the Memory Palace application
 * Provides comprehensive typing for objects, doors, and all related functionality
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
 * Core geometric types
 */
export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export type Position3D = Vector3;

/**
 * Object type enumeration for memory palace objects
 */
export enum ObjectType {
  OBJECT = 'object',
  DOOR = 'door'
}

/**
 * Interface for paint data associated with painted objects
 */
export interface PaintData {
  areas: PaintedArea[];
  canvasPosition: { x: number; y: number };
  color: string;
  dimensions?: {
    width: number;
    height: number;
    canvasWidth?: number;
    canvasHeight?: number;
  };
}

/**
 * Interface for individual painted areas
 */
export interface PaintedArea {
  id: string | number;
  center: { x: number; y: number };
  size: number;
  color: string;
  worldPosition: Vector3;
  metadata: {
    name: string;
    info: string;
  };
}

/**
 * Base interface for all memory palace objects
 */
export interface BaseMemoryObject {
  id: string;
  roomId: string | null;
  userId?: string;
  name: string;
  position: Vector3;
  objectCounter?: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Regular memory object (stores information/memories)
 */
export interface MemoryObject extends BaseMemoryObject {
  type: ObjectType.OBJECT;
  information: string;
  isPaintedObject?: boolean;
  paintData?: PaintData;
}

/**
 * Door object (connects to other rooms)
 */
export interface DoorObject extends BaseMemoryObject {
  type: ObjectType.DOOR;
  description?: string;
  information?: string;
  targetRoomId: string;
  isPaintedDoor?: boolean;
  paintData?: PaintData;
  needsConfiguration?: boolean;
}

/**
 * Discriminated union of all object types
 */
export type MemoryPalaceObject = MemoryObject | DoorObject;

/**
 * Type guard to check if an object is a door
 */
export function isDoorObject(obj: MemoryPalaceObject): obj is DoorObject {
  return obj.type === ObjectType.DOOR;
}

/**
 * Type guard to check if an object is a regular memory object
 */
export function isMemoryObject(obj: MemoryPalaceObject): obj is MemoryObject {
  return obj.type === ObjectType.OBJECT;
}

/**
 * Type guard to check if an object is painted
 */
export function isPaintedObject(obj: MemoryPalaceObject): boolean {
  return !!(obj as any).isPaintedObject || !!(obj as any).isPaintedDoor;
}

/**
 * Room interface
 */
export interface Room {
  id: string;
  name: string;
  description: string;
  imageUrl: string | null;
  roomCounter: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Connection interface (for room connections)
 */
export interface Connection {
  id: string;
  roomId: string;
  targetRoomId: string;
  description?: string;
  position: Vector3;
  paintData?: PaintData;
  createdAt: string;
  updatedAt: string;
}

/**
 * User state interface
 */
export interface UserState {
  id: string;
  currentRoomId: string | null;
  objectCounter: number;
  roomCounter: number;
  inventory: string[];
  settings?: Record<string, any>;
}

/**
 * Application state interface
 */
export interface ApplicationState {
  user: UserState;
  rooms: Map<string, Room>;
  objects: Map<string, MemoryPalaceObject>;
  connections: Map<string, Connection>;
  conversationHistory: Array<{
    role: string;
    content: string;
    timestamp: string;
  }>;
}

/**
 * Object creation parameters
 */
export interface CreateObjectParams {
  name: string;
  type: ObjectType;
  information?: string;
  description?: string;
  position?: Vector3;
  targetRoomId?: string;
  isPaintedObject?: boolean;
  isPaintedDoor?: boolean;
  paintData?: PaintData;
}

/**
 * Object update parameters
 */
export interface UpdateObjectParams {
  name?: string;
  information?: string;
  description?: string;
  position?: Vector3;
  targetRoomId?: string;
  paintData?: PaintData;
}

/**
 * Validation result interface
 */
export interface ValidationResult {
  valid: boolean;
  issues: string[];
}

/**
 * Object statistics interface
 */
export interface ObjectStatistics {
  count: number;
  averageDistance: number;
  spread: number;
  categories: Record<string, number>;
}

/**
 * Export/import interfaces
 */
export type ExportedObject = MemoryPalaceObject & {
  exportedAt: string;
};

export interface ImportOptions {
  regeneratePositions?: boolean;
  offsetPositions?: boolean;
}


export default {
  EventTypes,
  ObjectType
};
