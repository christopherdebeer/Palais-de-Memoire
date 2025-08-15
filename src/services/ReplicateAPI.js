/**
 * Replicate API Service for Image Generation
 * Handles skybox generation for memory palace rooms
 */

import SettingsManager from './SettingsManager.js'

// Create settings manager instance
const settingsManager = new SettingsManager()

export class ReplicateAPI {
  constructor() {
    // Using Val Town proxy instead of direct Replicate API access
    this.proxyBaseURL = 'https://c15r--0198a9984b17726982b6acf56e51be94.web.val.run'
    // Original Replicate API for reference
    this.replicateURL = 'https://api.replicate.com/v1/predictions'
    // Using black-forest-labs/flux-schnell for fast image generation
    this.model = 'black-forest-labs/flux-schnell'
    this.version = '6a29d7c19bce0f68f5a09ceb8e10fab8a3a3dce81ba99d7b5d8ad32bb3b6d4b9'
  }

  /**
   * Check if API is configured
   */
  isConfigured() {
    return !!settingsManager.get('replicateApiKey')
  }

  /**
   * Generate 360-degree skybox image for memory palace room
   * @param {string} description - The description of the room to generate
   * @param {string} roomName - Optional room name for reference
   * @param {object} options - Optional additional parameters for the image generation
   * @returns {Promise<object>} The generation result with image URL
   */
  async generateSkyboxImage(description, roomName = '', options = {}) {
    if (!this.isConfigured()) {
      throw new Error('Replicate API key not configured')
    }

    const aestheticPrompt = settingsManager.get('aestheticPrompt')
    const fullPrompt = this.buildImagePrompt(description, aestheticPrompt)

    try {
      // Prepare the request using the full API control format
      const requestBody = {
        input: {
          prompt: fullPrompt,
          // Default parameters optimized for skybox generation
          aspect_ratio: "21:9",
          height: 2048,
          output_format: "png",
          num_inference_steps: 4,
          guidance_scale: 3.5,
          extra_lora_scale: 0.8,
          num_inference_steps: 10,
          seed: Math.floor(Math.random() * 1000000),
          // Override with any user-provided options
          ...options
        }
      }

      // Use the proxy API instead of direct Replicate API
      const response = await fetch(`${this.proxyBaseURL}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Replicate-Token': settingsManager.get('replicateApiKey')
        },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        throw new Error(`Image generation API error: ${response.status} ${response.statusText}`)
      }

      const result = await response.json()

      console.log('Image generation API response:', result)
      
      // The proxy returns the image URL directly
      return {
        success: true,
        url: result.imageUrl,
        prediction_id: result.id || 'proxy-gen', // The proxy might return an ID
        prompt: fullPrompt,
        room_name: roomName,
        // Include the parameters used for generation
        parameters: requestBody.input
      }

    } catch (error) {
      console.error('Image generation API request failed:', error)
      throw error
    }
  }

  /**
   * Build comprehensive image generation prompt
   */
  buildImagePrompt(description, aestheticPrompt) {
    return `${description}

${aestheticPrompt}

360 view in the style of TOK`
  }

  /**
   * Wait for prediction to complete (used with direct Replicate API only)
   * Note: This is no longer used with the proxy approach but kept for reference
   */
  async waitForCompletion(predictionId, maxAttempts = 30, interval = 2000) {
    let attempts = 0
    
    while (attempts < maxAttempts) {
      try {
        const response = await fetch(`${this.replicateURL}/${predictionId}`, {
          headers: settingsManager.getReplicateHeaders()
        })

        if (!response.ok) {
          throw new Error(`Failed to get prediction status: ${response.status}`)
        }

        const prediction = await response.json()
        
        if (prediction.status === 'succeeded') {
          return prediction
        }
        
        if (prediction.status === 'failed') {
          throw new Error(`Image generation failed: ${prediction.error}`)
        }
        
        if (prediction.status === 'canceled') {
          throw new Error('Image generation was canceled')
        }
        
        // Still processing, wait and try again
        await this.sleep(interval)
        attempts++
        
      } catch (error) {
        if (attempts >= maxAttempts - 1) {
          throw error
        }
        await this.sleep(interval)
        attempts++
      }
    }
    
    throw new Error('Image generation timed out')
  }

  /**
   * Generate test image with mock response
   * @param {string} description - The description of the image to generate
   * @param {object} options - Optional generation parameters
   * @returns {Promise<object>} The generation result
   */
  async generateTestImage(description, options = {}) {
    if (!this.isConfigured()) {
      // Return a placeholder response for testing
      return {
        success: false,
        error: 'Replicate API key not configured',
        mockDescription: description,
        message: 'Configure your Replicate API key in settings to generate room images'
      }
    }

    return this.generateSkyboxImage(description, 'test', options)
  }

  /**
   * Cancel a running prediction
   * Note: May not be supported with the proxy approach
   */
  async cancelPrediction(_predictionId) {
    if (!this.isConfigured()) {
      throw new Error('Replicate API key not configured')
    }

    console.warn('Cancellation may not be supported with the proxy API')

    // The proxy might not support cancellation
    // This method is kept for API compatibility
    return { status: 'canceled' }
  }

  /**
   * Get prediction status
   * Note: May not be supported with the proxy approach
   */
  async getPredictionStatus(_predictionId) {
    if (!this.isConfigured()) {
      throw new Error('Replicate API key not configured')
    }

    console.warn('Status checking may not be supported with the proxy API')

    // The proxy might not support status checking
    // This method is kept for API compatibility
    return { status: 'unknown' }
  }

  /**
   * Utility function for delays
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

export const replicateAPI = new ReplicateAPI()
export default replicateAPI
