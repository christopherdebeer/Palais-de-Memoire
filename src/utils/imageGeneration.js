/**
 * Image Generation Utilities
 * Handles room image generation using Replicate API
 */

import replicateAPI from '../services/ReplicateAPI.js'

/**
 * Generate an image for a room
 * @param {Object} state - Application state
 * @param {string} roomId - Room ID
 * @param {string} description - Description for image generation
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<Object>} Generation result
 */
export async function generateRoomImage(state, roomId, description, onProgress = null) {
  const room = state.rooms.get(roomId)
  if (!room) {
    throw new Error(`Room ${roomId} not found`)
  }

  if (!replicateAPI.isConfigured()) {
    throw new Error('Replicate API is not configured. Please add your API key in settings.')
  }

  try {
    if (onProgress) onProgress({ status: 'starting', message: 'Starting image generation...' })
    
    const result = await replicateAPI.generateSkyboxImage(description, room.name)
    
    if (onProgress) onProgress({ status: 'completed', message: 'Image generation completed' })
    
    return {
      success: true,
      imageUrl: result.url,
      roomId,
      description
    }
  } catch (error) {
    if (onProgress) onProgress({ status: 'error', message: error.message })
    
    return {
      success: false,
      error: error.message,
      roomId,
      description
    }
  }
}

/**
 * Update room with generated image
 * @param {Object} state - Application state
 * @param {string} roomId - Room ID
 * @param {string} imageUrl - Generated image URL
 * @returns {Promise<Object>} Updated room
 */
export async function updateRoomImage(state, roomId, imageUrl) {
  const room = state.rooms.get(roomId)
  if (!room) {
    throw new Error(`Room ${roomId} not found`)
  }

  const updatedRoom = {
    ...room,
    imageUrl,
    lastImageGenerated: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }

  state.rooms.set(roomId, updatedRoom)
  
  // Import saveState here to avoid circular dependency
  const { saveState } = await import('./stateUtils.js')
  await saveState(state)

  return updatedRoom
}

/**
 * Generate and update room image in one operation
 * @param {Object} state - Application state
 * @param {string} roomId - Room ID
 * @param {string} description - Description for image generation
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<Object>} Result with updated room
 */
export async function generateAndUpdateRoomImage(state, roomId, description, onProgress = null) {
  try {
    const result = await generateRoomImage(state, roomId, description, onProgress)
    
    if (result.success) {
      const updatedRoom = await updateRoomImage(state, roomId, result.imageUrl)
      return {
        success: true,
        room: updatedRoom,
        imageUrl: result.imageUrl
      }
    } else {
      return result
    }
  } catch (error) {
    return {
      success: false,
      error: error.message,
      roomId,
      description
    }
  }
}

/**
 * Check if image generation is available
 * @returns {boolean} True if image generation is configured
 */
export function isImageGenerationAvailable() {
  return replicateAPI.isConfigured()
}

/**
 * Get image generation status message
 * @returns {string} Status message
 */
export function getImageGenerationStatus() {
  if (replicateAPI.isConfigured()) {
    return 'Image generation is available'
  } else {
    return 'Image generation requires Replicate API key configuration'
  }
}

