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

/**
 * Validate description for image generation
 * @param {string} description - Description to validate
 * @returns {Object} Validation result
 */
export function validateImageDescription(description) {
  const issues = []
  
  if (!description || description.trim().length === 0) {
    issues.push('Description is required for image generation')
  }
  
  if (description && description.length < 10) {
    issues.push('Description should be at least 10 characters long for better results')
  }
  
  if (description && description.length > 500) {
    issues.push('Description should be less than 500 characters for optimal processing')
  }
  
  // Check for potentially problematic content
  const problematicWords = ['nsfw', 'explicit', 'violent', 'gore', 'disturbing']
  const lowerDesc = description.toLowerCase()
  const foundProblematic = problematicWords.filter(word => lowerDesc.includes(word))
  
  if (foundProblematic.length > 0) {
    issues.push(`Description contains potentially problematic content: ${foundProblematic.join(', ')}`)
  }
  
  return {
    valid: issues.length === 0,
    issues,
    suggestions: generateDescriptionSuggestions(description)
  }
}

/**
 * Generate suggestions for improving image descriptions
 * @param {string} description - Original description
 * @returns {string[]} Array of suggestions
 */
export function generateDescriptionSuggestions(description) {
  const suggestions = []
  
  if (!description || description.length < 20) {
    suggestions.push('Add more details about lighting, colors, and atmosphere')
    suggestions.push('Include architectural details like walls, floors, and ceiling')
    suggestions.push('Describe the mood or feeling of the space')
  }
  
  const lowerDesc = description.toLowerCase()
  
  if (!lowerDesc.includes('light') && !lowerDesc.includes('bright') && !lowerDesc.includes('dark')) {
    suggestions.push('Consider adding lighting details (bright, dim, natural light, etc.)')
  }
  
  if (!lowerDesc.includes('color') && !lowerDesc.includes('red') && !lowerDesc.includes('blue') && 
      !lowerDesc.includes('green') && !lowerDesc.includes('yellow') && !lowerDesc.includes('brown')) {
    suggestions.push('Add color descriptions to make the scene more vivid')
  }
  
  if (!lowerDesc.includes('wall') && !lowerDesc.includes('floor') && !lowerDesc.includes('ceiling')) {
    suggestions.push('Include architectural elements like walls, floors, or ceiling details')
  }
  
  return suggestions
}

/**
 * Enhance description for better image generation
 * @param {string} description - Original description
 * @returns {string} Enhanced description
 */
export function enhanceDescription(description) {
  if (!description) return description
  
  let enhanced = description.trim()
  
  // Add common enhancements for better skybox generation
  const enhancements = []
  
  // Add 360-degree context if not present
  if (!enhanced.toLowerCase().includes('360') && !enhanced.toLowerCase().includes('panoramic')) {
    enhancements.push('360-degree panoramic view')
  }
  
  // Add skybox context if not present
  if (!enhanced.toLowerCase().includes('skybox') && !enhanced.toLowerCase().includes('environment')) {
    enhancements.push('immersive environment')
  }
  
  // Add quality indicators
  enhancements.push('high quality', 'detailed')
  
  if (enhancements.length > 0) {
    enhanced = `${enhanced}, ${enhancements.join(', ')}`
  }
  
  return enhanced
}

/**
 * Get estimated generation time
 * @param {string} description - Description for generation
 * @returns {Object} Time estimate
 */
export function getEstimatedGenerationTime(description) {
  // Base time estimate
  let estimatedSeconds = 30
  
  // Longer descriptions might take more time
  if (description && description.length > 100) {
    estimatedSeconds += 10
  }
  
  // Complex descriptions might take more time
  const complexityKeywords = ['detailed', 'intricate', 'complex', 'elaborate', 'ornate']
  const lowerDesc = description.toLowerCase()
  const complexityCount = complexityKeywords.filter(keyword => lowerDesc.includes(keyword)).length
  
  estimatedSeconds += complexityCount * 5
  
  return {
    seconds: estimatedSeconds,
    range: `${estimatedSeconds - 10}-${estimatedSeconds + 20} seconds`,
    message: `Estimated generation time: ${estimatedSeconds} seconds`
  }
}

/**
 * Create progress tracker for image generation
 * @param {Function} onUpdate - Update callback
 * @returns {Object} Progress tracker
 */
export function createProgressTracker(onUpdate) {
  let currentStep = 0
  const steps = [
    'Initializing generation...',
    'Processing description...',
    'Generating image...',
    'Finalizing result...'
  ]
  
  return {
    nextStep() {
      if (currentStep < steps.length) {
        onUpdate({
          step: currentStep + 1,
          total: steps.length,
          message: steps[currentStep],
          progress: ((currentStep + 1) / steps.length) * 100
        })
        currentStep++
      }
    },
    
    complete() {
      onUpdate({
        step: steps.length,
        total: steps.length,
        message: 'Generation completed!',
        progress: 100,
        completed: true
      })
    },
    
    error(message) {
      onUpdate({
        step: currentStep,
        total: steps.length,
        message: `Error: ${message}`,
        progress: 0,
        error: true
      })
    }
  }
}
