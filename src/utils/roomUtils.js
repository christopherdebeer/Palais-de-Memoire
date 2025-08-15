/**
 * Room Management Utilities
 * Handles room creation, editing, navigation, and room-related operations
 */

import { generateId, saveState } from './stateUtils.js'

/**
 * Create a new room
 * @param {Object} state - Application state
 * @param {string} name - Room name
 * @param {string} description - Room description
 * @param {Object} options - Additional options
 * @returns {Object} Created room object
 */
export async function createRoom(state, name, description, options = {}) {
  const roomId = generateId()
  const roomCounter = state.user.roomCounter + 1

  const room = {
    id: roomId,
    userId: state.user.id,
    name: name || `Room ${roomCounter}`,
    description,
    imageUrl: options.imageUrl || null,
    roomCounter,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }

  // Save room
  state.rooms.set(roomId, room)
  state.user.roomCounter = roomCounter
  state.user.currentRoomId = roomId
  
  await saveState(state)
  
  return room
}

/**
 * Edit an existing room
 * @param {Object} state - Application state
 * @param {string} roomId - Room ID to edit
 * @param {Object} updates - Updates to apply
 * @returns {Object} Updated room object
 */
export async function editRoom(state, roomId, updates) {
  const room = state.rooms.get(roomId)
  if (!room) {
    throw new Error(`Room ${roomId} not found`)
  }

  const updatedRoom = {
    ...room,
    ...updates,
    updatedAt: new Date().toISOString()
  }

  state.rooms.set(roomId, updatedRoom)
  await saveState(state)

  return updatedRoom
}

/**
 * Delete a room and its associated data
 * @param {Object} state - Application state
 * @param {string} roomId - Room ID to delete
 * @returns {boolean} Success status
 */
export async function deleteRoom(state, roomId) {
  const room = state.rooms.get(roomId)
  if (!room) {
    return false
  }

  // If deleting current room, navigate to another room or clear current
  if (state.user.currentRoomId === roomId) {
    const allRooms = getAllRooms(state).filter(r => r.id !== roomId)
    const newCurrentRoomId = allRooms.length > 0 ? allRooms[0].id : null
    await navigateToRoom(state, newCurrentRoomId)
  }

  // Remove room
  state.rooms.delete(roomId)
  
  // Remove associated objects
  for (const [objId, obj] of state.objects.entries()) {
    if (obj.roomId === roomId) {
      state.objects.delete(objId)
    }
  }
  
  // Remove associated connections
  for (const [connId, conn] of state.connections.entries()) {
    if (conn.roomId === roomId || conn.targetRoomId === roomId) {
      state.connections.delete(connId)
    }
  }
  
  await saveState(state)
  
  return true
}

/**
 * Navigate to a room
 * @param {Object} state - Application state
 * @param {string|null} roomId - Room ID to navigate to, or null to clear current room
 * @returns {Object|null} Target room object
 */
export async function navigateToRoom(state, roomId) {
  let targetRoom = null
  
  if (roomId) {
    targetRoom = state.rooms.get(roomId)
    if (!targetRoom) {
      throw new Error(`Room ${roomId} not found`)
    }
  }

  state.user.currentRoomId = roomId
  await saveState(state)

  return targetRoom
}

/**
 * Get current room
 * @param {Object} state - Application state
 * @returns {Object|null} Current room or null
 */
export function getCurrentRoom(state) {
  if (!state.user.currentRoomId) return null
  return state.rooms.get(state.user.currentRoomId)
}

/**
 * Get all rooms
 * @param {Object} state - Application state
 * @returns {Object[]} Array of all rooms sorted by room counter
 */
export function getAllRooms(state) {
  return Array.from(state.rooms.values()).sort((a, b) => a.roomCounter - b.roomCounter)
}

/**
 * Find room by name (fuzzy search)
 * @param {Object} state - Application state
 * @param {string} name - Room name to search for
 * @returns {Object|null} Found room or null
 */
export function findRoomByName(state, name) {
  const rooms = getAllRooms(state)
  const lowerName = name.toLowerCase()
  
  // Exact match first
  let found = rooms.find(r => r.name.toLowerCase() === lowerName)
  if (found) return found
  
  // Partial match
  found = rooms.find(r => r.name.toLowerCase().includes(lowerName))
  if (found) return found
  
  // Description match
  found = rooms.find(r => r.description.toLowerCase().includes(lowerName))
  return found || null
}

/**
 * Get rooms connected to a specific room
 * @param {Object} state - Application state
 * @param {string} roomId - Source room ID
 * @returns {Object[]} Array of connected rooms with connection info
 */
export function getConnectedRooms(state, roomId) {
  const connections = Array.from(state.connections.values()).filter(conn => conn.roomId === roomId)
  const connectedRooms = []

  for (const connection of connections) {
    const targetRoom = state.rooms.get(connection.targetRoomId)
    if (targetRoom) {
      connectedRooms.push({
        ...targetRoom,
        connection
      })
    }
  }

  return connectedRooms
}

/**
 * Get room statistics
 * @param {Object} state - Application state
 * @param {string} [roomId] - Specific room ID, or current room if not specified
 * @returns {Object} Room statistics
 */
export function getRoomStats(state, roomId = null) {
  const targetRoomId = roomId || state.user.currentRoomId
  if (!targetRoomId) {
    return {
      objectCount: 0,
      connectionCount: 0,
      hasImage: false,
      room: null
    }
  }

  const objects = Array.from(state.objects.values()).filter(obj => obj.roomId === targetRoomId)
  const connections = Array.from(state.connections.values()).filter(conn => conn.roomId === targetRoomId)
  const room = state.rooms.get(targetRoomId)

  return {
    objectCount: objects.length,
    connectionCount: connections.length,
    hasImage: Boolean(room?.imageUrl),
    room
  }
}

/**
 * Export room data
 * @param {Object} state - Application state
 * @param {string} roomId - Room ID to export
 * @returns {Object|null} Exportable room data
 */
export function exportRoom(state, roomId) {
  const room = state.rooms.get(roomId)
  if (!room) return null

  const objects = Array.from(state.objects.values()).filter(obj => obj.roomId === roomId)
  const connections = Array.from(state.connections.values()).filter(conn => conn.roomId === roomId)

  return {
    room,
    objects,
    connections,
    exportedAt: new Date().toISOString()
  }
}

/**
 * Import room data
 * @param {Object} state - Application state
 * @param {Object} roomData - Room data to import
 * @returns {string} Imported room ID
 */
export async function importRoom(state, roomData) {
  const { room, objects = [], connections = [] } = roomData
  
  // Generate new IDs to avoid conflicts
  const newRoomId = generateId()
  const roomCounter = state.user.roomCounter + 1

  // Import room
  const newRoom = {
    ...room,
    id: newRoomId,
    userId: state.user.id,
    roomCounter,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
  
  state.rooms.set(newRoomId, newRoom)
  state.user.roomCounter = roomCounter

  // Import objects
  const objectIdMap = new Map()
  for (const obj of objects) {
    const newObjectId = generateId()
    objectIdMap.set(obj.id, newObjectId)
    
    const newObject = {
      ...obj,
      id: newObjectId,
      roomId: newRoomId,
      userId: state.user.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    
    state.objects.set(newObjectId, newObject)
  }

  // Import connections
  for (const conn of connections) {
    const newConnectionId = generateId()
    
    const newConnection = {
      ...conn,
      id: newConnectionId,
      roomId: newRoomId,
      userId: state.user.id,
      createdAt: new Date().toISOString()
    }
    
    state.connections.set(newConnectionId, newConnection)
  }

  await saveState(state)
  return newRoomId
}

/**
 * Apply initial configuration and ensure default room exists
 * @param {Object} state - Application state
 * @returns {Object|null} Default room if created
 */
export async function applyConfiguration(state) {
  // Ensure a default room exists if no rooms are present
  if (state.rooms.size === 0) {
    console.log('[roomUtils] No rooms found, creating default room...')
    
    const defaultRoom = await createRoom(
      state,
      'Study',
      'A large study, with a desk with various papers and objects, the floor is covered with a old persian rug, bookshelfs and wooden filing cabnets line to walls, with a fireplace to the right, and a few closed wooden doors leading to ajoining rooms. There is a window, with heavy curtains open, revealing a snowy forrest at night.',
      { imageUrl: '/default_skybox.png' } 
    )
    
    console.log('[roomUtils] Default room created:', defaultRoom)
    return defaultRoom
  }
  
  // If rooms exist but no current room is set, navigate to the first room
  if (!state.user.currentRoomId && state.rooms.size > 0) {
    const firstRoom = Array.from(state.rooms.values())[0]
    console.log('[roomUtils] No current room set, navigating to first room:', firstRoom.name)
    await navigateToRoom(state, firstRoom.id)
    return firstRoom
  }
  
  return null
}
