/**
 * Object type enumeration for memory palace objects
 * Provides explicit typing to distinguish between different object types
 */
export enum ObjectType {
  OBJECT = 'object',
  DOOR = 'door'
}

/**
 * Interface for paint data associated with painted objects
 */
export interface PaintData {
  areas: PaintedArea[]
  canvasPosition: { x: number; y: number }
  color: string
  dimensions?: {
    width: number
    height: number
  }
}

/**
 * Interface for individual painted areas
 */
export interface PaintedArea {
  id: string | number
  center: { x: number; y: number }
  size: number
  color: string
  worldPosition: {
    x: number
    y: number
    z: number
  }
  metadata: {
    name: string
    info: string
  }
}

/**
 * Extended object interface with explicit type and paint data
 */
export interface MemoryPalaceObject {
  id: string
  type: ObjectType
  name: string
  information?: string
  description?: string
  position: {
    x: number
    y: number
    z: number
  }
  targetRoomId?: string
  isPaintedObject?: boolean
  isPaintedDoor?: boolean
  paintData?: PaintData
  needsConfiguration?: boolean
}