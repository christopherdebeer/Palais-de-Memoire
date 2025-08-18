/**
 * Object Management Utilities
 * Handles memory objects within rooms - creation, editing, positioning, and spatial operations
 * Now with proper TypeScript support and explicit object type handling
 */

import { generateId, saveState } from './stateUtils.js';
import {
  ObjectType,
  MemoryPalaceObject,
  MemoryObject,
  DoorObject,
  CreateObjectParams,
  UpdateObjectParams,
  ValidationResult,
  ObjectStatistics,
  ExportedObject,
  ImportOptions,
  Position3D,
  ApplicationState,
  isDoorObject,
  isMemoryObject
} from '../types/index.js';

/**
 * Add a memory object to a room with explicit type support
 */
export async function addObject(
  state: ApplicationState,
  name: string,
  information: string,
  position: Position3D | null = null,
  type: ObjectType = ObjectType.OBJECT
): Promise<MemoryPalaceObject> {
  const currentRoomId = state.user.currentRoomId;
  if (!currentRoomId) {
    throw new Error('No current room');
  }
  
  const objectId = generateId();
  const objectCounter = state.user.objectCounter + 1;

  // Use provided position or generate default
  const objectPosition = position || generateDefaultPosition(state, currentRoomId);

  const baseObject = {
    id: objectId,
    roomId: currentRoomId,
    userId: state.user.id,
    name: name || `${type === ObjectType.DOOR ? 'Door' : 'Object'} ${objectCounter}`,
    position: objectPosition,
    objectCounter,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  let object: MemoryPalaceObject;

  if (type === ObjectType.DOOR) {
    object = {
      ...baseObject,
      type: ObjectType.DOOR,
      description: information || '',
      information: information || '',
      targetRoomId: '', // Will need to be set later
      needsConfiguration: true
    } as DoorObject;
  } else {
    object = {
      ...baseObject,
      type: ObjectType.OBJECT,
      information: information || ''
    } as MemoryObject;
  }

  // Save object
  state.objects.set(objectId, object);
  state.user.objectCounter = objectCounter;
  
  await saveState(state);
  
  return object;
}

/**
 * Create object with comprehensive parameters (new preferred method)
 */
export async function createObject(
  state: ApplicationState,
  params: CreateObjectParams
): Promise<MemoryPalaceObject> {
  const currentRoomId = state.user.currentRoomId;
  if (!currentRoomId) {
    throw new Error('No current room');
  }
  
  const objectId = generateId();
  const objectCounter = state.user.objectCounter + 1;

  // Use provided position or generate default
  const objectPosition = params.position || generateDefaultPosition(state, currentRoomId);

  const baseObject = {
    id: objectId,
    roomId: currentRoomId,
    userId: state.user.id,
    name: params.name || `${params.type === ObjectType.DOOR ? 'Door' : 'Object'} ${objectCounter}`,
    position: objectPosition,
    objectCounter,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  let object: MemoryPalaceObject;

  if (params.type === ObjectType.DOOR) {
    object = {
      ...baseObject,
      type: ObjectType.DOOR,
      description: params.description || params.information || '',
      information: params.information || params.description || '',
      targetRoomId: params.targetRoomId || '',
      isPaintedDoor: params.isPaintedDoor,
      paintData: params.paintData,
      needsConfiguration: !params.targetRoomId
    } as DoorObject;
  } else {
    object = {
      ...baseObject,
      type: ObjectType.OBJECT,
      information: params.information || '',
      isPaintedObject: params.isPaintedObject,
      paintData: params.paintData
    } as MemoryObject;
  }

  // Save object
  state.objects.set(objectId, object);
  state.user.objectCounter = objectCounter;
  
  await saveState(state);
  
  return object;
}

/**
 * Update an existing object
 */
export async function updateObject(
  state: ApplicationState,
  objectId: string,
  updates: UpdateObjectParams
): Promise<MemoryPalaceObject> {
  const object = state.objects.get(objectId);
  if (!object) {
    throw new Error(`Object ${objectId} not found`);
  }

  const updatedObject: MemoryPalaceObject = {
    ...object,
    ...updates,
    updatedAt: new Date().toISOString()
  } as MemoryPalaceObject;

  state.objects.set(objectId, updatedObject);
  await saveState(state);
  
  return updatedObject;
}

/**
 * Delete an object
 */
export async function deleteObject(state: ApplicationState, objectId: string): Promise<boolean> {
  const object = state.objects.get(objectId);
  if (!object) {
    return false;
  }

  state.objects.delete(objectId);
  await saveState(state);
  
  return true;
}

/**
 * Get objects in current room
 */
export function getCurrentRoomObjects(state: ApplicationState): MemoryPalaceObject[] {
  const currentRoomId = state?.user?.currentRoomId;
  const objects = currentRoomId ? getRoomObjects(state, currentRoomId) : [];
    
  // Get connections for current room and transform them to door objects
  const connections = Array.from(state.connections.values())
    .filter(conn => conn.roomId === state.user.currentRoomId)
    .map(conn => ({
      id: conn.id,
      roomId: conn.roomId,
      userId: state.user.id,
      name: conn.description || 'Door',
      position: conn.position,
      objectCounter: 0,
      createdAt: conn.createdAt,
      updatedAt: conn.updatedAt,
      type: ObjectType.DOOR,
      description: conn.description || 'Door leading to another room',
      information: `Door leading to another room`,
      targetRoomId: conn.targetRoomId
    } as DoorObject));
    
  // Combine objects and door connections
  const allRoomItems = [...objects, ...connections];
  return allRoomItems;
}

/**
 * Get objects in a specific room
 */
export function getRoomObjects(state: ApplicationState, roomId: string): MemoryPalaceObject[] {
  return Array.from(state.objects.values()).filter(obj => obj.roomId === roomId);
}

/**
 * Get a specific object by ID
 */
export function getObject(state: ApplicationState, objectId: string): MemoryPalaceObject | null {
  return state.objects.get(objectId) || null;
}

/**
 * Find objects by name (fuzzy search)
 */
export function findObjectsByName(
  state: ApplicationState,
  name: string,
  roomId: string | null = null
): MemoryPalaceObject[] {
  const objects = roomId ? getRoomObjects(state, roomId) : Array.from(state.objects.values());
  const lowerName = name.toLowerCase();
  
  return objects.filter(obj => {
    const information = isDoorObject(obj) ? (obj.description || obj.information || '') : obj.information;
    return obj.name.toLowerCase().includes(lowerName) ||
           information.toLowerCase().includes(lowerName);
  }).sort((a, b) => {
    // Prioritize exact name matches
    const aExact = a.name.toLowerCase() === lowerName;
    const bExact = b.name.toLowerCase() === lowerName;
    if (aExact && !bExact) return -1;
    if (!aExact && bExact) return 1;
    return a.name.localeCompare(b.name);
  });
}

/**
 * Move an object to a new position
 */
export async function moveObject(
  state: ApplicationState,
  objectId: string,
  newPosition: Position3D
): Promise<MemoryPalaceObject> {
  return updateObject(state, objectId, { position: newPosition });
}

/**
 * Move an object to a different room
 */
export async function moveObjectToRoom(
  state: ApplicationState,
  objectId: string,
  targetRoomId: string,
  position: Position3D | null = null
): Promise<MemoryPalaceObject> {
  const targetRoom = state.rooms.get(targetRoomId);
  if (!targetRoom) {
    throw new Error(`Target room ${targetRoomId} not found`);
  }

  const newPosition = position || generateDefaultPosition(state, targetRoomId);
  
  return updateObject(state, objectId, {
    position: newPosition
  });
}

/**
 * Generate a default position for a new object in a room
 */
export function generateDefaultPosition(state: ApplicationState, roomId: string): Position3D {
  const existingObjects = getRoomObjects(state, roomId);
  
  // Create a spiral pattern around the room
  const radius = 400;
  const angle = (existingObjects.length * 60) * (Math.PI / 180); // 60 degrees apart
  const height = Math.sin(existingObjects.length * 0.3) * 50; // Slight height variation
  
  return {
    x: Math.cos(angle) * radius,
    y: height,
    z: Math.sin(angle) * radius
  };
}

/**
 * Perform ray casting from screen coordinates to find sphere intersection
 */
export function performRayCasting(
  clientX: number,
  clientY: number,
  camera: any,
  sphere: any
): Position3D | null {
  if (typeof window === 'undefined' || !(window as any).THREE) {
    return null;
  }
  
  const THREE = (window as any).THREE;
  
  // Convert screen coordinates to normalized device coordinates (-1 to +1)
  const mouse = new THREE.Vector2();
  mouse.x = (clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(clientY / window.innerHeight) * 2 + 1;

  // Create raycaster and find intersection
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mouse, camera);
  
  const intersects = raycaster.intersectObject(sphere);
  
  if (intersects.length > 0) {
    const intersectionPoint = intersects[0].point;
    return {
      x: intersectionPoint.x,
      y: intersectionPoint.y,
      z: intersectionPoint.z
    };
  }
  
  return null;
}

/**
 * Convert screen coordinates to world position on sphere surface using ray casting
 */
export function screenToWorldPosition(
  screenX: number,
  screenY: number,
  sphereRadius: number = 500,
  camera: any = null
): Position3D {
  // If camera is available, use proper ray casting (preferred method)
  if (camera && typeof window !== 'undefined' && (window as any).THREE) {
    const THREE = (window as any).THREE;
    
    // Convert normalized screen coordinates to NDC (-1 to +1)
    const mouse = new THREE.Vector2();
    mouse.x = screenX * 2 - 1;
    mouse.y = -(screenY * 2 - 1);
    
    // Create raycaster
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);
    
    // Create sphere geometry for intersection testing
    const sphereGeometry = new THREE.SphereGeometry(sphereRadius, 32, 16);
    const sphereMesh = new THREE.Mesh(sphereGeometry);
    
    // Find intersection with sphere
    const intersects = raycaster.intersectObject(sphereMesh);
    
    // Cleanup
    sphereGeometry.dispose();
    
    if (intersects.length > 0) {
      const intersectionPoint = intersects[0].point;
      return {
        x: intersectionPoint.x,
        y: intersectionPoint.y, 
        z: intersectionPoint.z
      };
    }
  }
  
  // Fallback: Improved spherical coordinate conversion
  // This assumes a forward-facing camera at origin (0,0,0)
  
  // Convert screen coordinates to spherical angles
  // Map screen coordinates to sphere surface more accurately
  const phi = (screenX - 0.5) * Math.PI * 1.8;  // Horizontal (reduced from 2π for better distribution)
  const theta = (screenY - 0.5) * Math.PI * 0.9; // Vertical (reduced to avoid poles)
  
  // Convert spherical to Cartesian coordinates
  // Using standard spherical coordinate system: (r, θ, φ)
  // where θ is polar angle from positive Y, φ is azimuthal angle from positive X
  const polarAngle = Math.PI/2 + theta;  // Offset so center of screen maps to horizon
  
  return {
    x: sphereRadius * Math.sin(polarAngle) * Math.cos(phi),
    y: sphereRadius * Math.cos(polarAngle), 
    z: sphereRadius * Math.sin(polarAngle) * Math.sin(phi)
  };
}

/**
 * Position an object on the sphere surface
 */
export function positionOnSphere(
  position: Position3D,
  sphereRadius: number = 500,
  offsetMultiplier: number = 1.0
): Position3D {
  if (typeof window !== 'undefined' && (window as any).THREE) {
    const THREE = (window as any).THREE;
    
    // Normalize position to sphere surface
    const direction = new THREE.Vector3(position.x, position.y, position.z).normalize();
    const finalPosition = direction.multiplyScalar(sphereRadius * offsetMultiplier);
    
    return {
      x: finalPosition.x,
      y: finalPosition.y,
      z: finalPosition.z
    };
  }
  
  // Fallback without THREE.js
  const magnitude = Math.sqrt(position.x * position.x + position.y * position.y + position.z * position.z);
  if (magnitude === 0) {
    return { x: sphereRadius * offsetMultiplier, y: 0, z: 0 };
  }
  
  const normalizedRadius = (sphereRadius * offsetMultiplier) / magnitude;
  return {
    x: position.x * normalizedRadius,
    y: position.y * normalizedRadius,
    z: position.z * normalizedRadius
  };
}

/**
 * Get objects within a certain distance of a position
 */
export function getObjectsNearPosition(
  state: ApplicationState,
  position: Position3D,
  radius: number,
  roomId: string | null = null
): Array<MemoryPalaceObject & { distance: number }> {
  const objects = roomId ? getRoomObjects(state, roomId) : Array.from(state.objects.values());
  
  return objects
    .map(obj => ({
      ...obj,
      distance: calculateDistance(position, obj.position)
    }))
    .filter(obj => obj.distance <= radius)
    .sort((a, b) => a.distance - b.distance);
}

/**
 * Calculate distance between two 3D points
 */
export function calculateDistance(pos1: Position3D, pos2: Position3D): number {
  const dx = pos1.x - pos2.x;
  const dy = pos1.y - pos2.y;
  const dz = pos1.z - pos2.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Validate object position
 */
export function validatePosition(
  state: ApplicationState,
  position: Position3D,
  roomId: string
): ValidationResult {
  const issues: string[] = [];
  
  // Check if position is too close to other objects
  const nearby = getObjectsNearPosition(state, position, 50, roomId);
  if (nearby.length > 0) {
    issues.push('Position is too close to existing objects');
  }
  
  // Check if position is within reasonable bounds
  const distance = Math.sqrt(position.x * position.x + position.y * position.y + position.z * position.z);
  if (distance > 500) {
    issues.push('Position is too far from center');
  }
  
  if (distance < 100) {
    issues.push('Position is too close to center');
  }
  
  return {
    valid: issues.length === 0,
    issues
  };
}

/**
 * Get object statistics for a room
 */
export function getRoomObjectStats(state: ApplicationState, roomId: string): ObjectStatistics {
  const objects = getRoomObjects(state, roomId);
  
  if (objects.length === 0) {
    return {
      count: 0,
      averageDistance: 0,
      spread: 0,
      categories: {}
    };
  }
  
  // Calculate distances from center
  const distances = objects.map(obj => {
    const pos = obj.position;
    return Math.sqrt(pos.x * pos.x + pos.y * pos.y + pos.z * pos.z);
  });
  
  const averageDistance = distances.reduce((sum, d) => sum + d, 0) / distances.length;
  const spread = Math.max(...distances) - Math.min(...distances);
  
  // Categorize objects by name patterns (simple classification)
  const categories: Record<string, number> = {};
  objects.forEach(obj => {
    const category = classifyObject(obj);
    categories[category] = (categories[category] || 0) + 1;
  });
  
  return {
    count: objects.length,
    averageDistance: Math.round(averageDistance),
    spread: Math.round(spread),
    categories
  };
}

/**
 * Simple object classification based on name/content
 */
export function classifyObject(object: MemoryPalaceObject): string {
  const information = isDoorObject(object) ? (object.description || object.information || '') : object.information;
  const text = `${object.name} ${information}`.toLowerCase();
  
  if (isDoorObject(object)) {
    return 'doors';
  } else if (text.includes('book') || text.includes('document') || text.includes('paper')) {
    return 'documents';
  } else if (text.includes('person') || text.includes('people') || text.includes('name')) {
    return 'people';
  } else if (text.includes('number') || text.includes('date') || text.includes('time')) {
    return 'data';
  } else if (text.includes('place') || text.includes('location') || text.includes('address')) {
    return 'places';
  } else {
    return 'other';
  }
}

/**
 * Export objects from a room
 */
export function exportRoomObjects(state: ApplicationState, roomId: string): ExportedObject[] {
  return getRoomObjects(state, roomId).map(obj => ({
    ...obj,
    exportedAt: new Date().toISOString()
  }));
}

/**
 * Import objects into a room
 */
export async function importObjects(
  state: ApplicationState,
  roomId: string,
  objectsData: Array<MemoryPalaceObject>,
  options: ImportOptions = {}
): Promise<MemoryPalaceObject[]> {
  const room = state.rooms.get(roomId);
  if (!room) {
    throw new Error(`Room ${roomId} not found`);
  }
  
  const imported: MemoryPalaceObject[] = [];
  
  for (const objData of objectsData) {
    try {
      // Generate new position if needed to avoid conflicts
      let position = objData.position;
      if (options.regeneratePositions) {
        position = generateDefaultPosition(state, roomId);
      } else if (options.offsetPositions) {
        position = {
          x: objData.position.x + (Math.random() - 0.5) * 100,
          y: objData.position.y + (Math.random() - 0.5) * 50,
          z: objData.position.z + (Math.random() - 0.5) * 100
        };
      }
      
      // Temporarily set current room for createObject
      const originalRoomId = state.user.currentRoomId;
      state.user.currentRoomId = roomId;
      
      const createParams: CreateObjectParams = {
        name: objData.name,
        type: objData.type,
        position
      };

      if (isDoorObject(objData)) {
        createParams.description = objData.description;
        createParams.information = objData.information;
        createParams.targetRoomId = objData.targetRoomId;
        createParams.isPaintedDoor = objData.isPaintedDoor;
        createParams.paintData = objData.paintData;
      } else {
        createParams.information = objData.information;
        createParams.isPaintedObject = objData.isPaintedObject;
        createParams.paintData = objData.paintData;
      }
      
      const importedObj = await createObject(state, createParams);
      
      // Restore original current room
      state.user.currentRoomId = originalRoomId;
      
      imported.push(importedObj);
    } catch (error) {
      console.error('Failed to import object:', objData.name, error);
    }
  }
  
  return imported;
}
