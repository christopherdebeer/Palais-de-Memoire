/**
 * Replicate API Service for Image Generation
 * Handles skybox generation for memory palace rooms
 */

import settingsManager from './SettingsManager.js'

export class ReplicateAPI {
  constructor() {
    this.baseURL = 'https://api.replicate.com/v1/predictions'
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
   */
  async generateSkyboxImage(description, roomName = '') {
    if (!this.isConfigured()) {
      throw new Error('Replicate API key not configured')
    }

    const aestheticPrompt = settingsManager.get('aestheticPrompt')
    const fullPrompt = this.buildImagePrompt(description, aestheticPrompt)

    try {
      // Create prediction
      const response = await fetch(this.baseURL, {
        method: 'POST',
        headers: settingsManager.getReplicateHeaders(),
        body: JSON.stringify({
          version: this.version,
          input: {
            prompt: fullPrompt,
            width: 1024,
            height: 1024,
            num_inference_steps: 4,
            guidance_scale: 0,
            seed: Math.floor(Math.random() * 1000000)
          }
        })
      })

      if (!response.ok) {
        throw new Error(`Replicate API error: ${response.status} ${response.statusText}`)
      }

      const prediction = await response.json()
      
      // Poll for completion
      const result = await this.waitForCompletion(prediction.id)
      
      return {
        success: true,
        url: result.output?.[0] || result.output,
        prediction_id: prediction.id,
        prompt: fullPrompt,
        room_name: roomName
      }

    } catch (error) {
      console.error('Replicate API request failed:', error)
      throw error
    }
  }

  /**
   * Build comprehensive image generation prompt
   */
  buildImagePrompt(description, aestheticPrompt) {
    return `${description}

${aestheticPrompt}

360-degree panoramic view, equirectangular projection, immersive virtual reality environment, seamless spherical panorama suitable for Three.js skybox texture mapping, architectural photography, high detail, professional interior design, soft natural lighting`
  }

  /**
   * Wait for prediction to complete
   */
  async waitForCompletion(predictionId, maxAttempts = 30, interval = 2000) {
    let attempts = 0
    
    while (attempts < maxAttempts) {
      try {
        const response = await fetch(`${this.baseURL}/${predictionId}`, {
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
   */
  async generateTestImage(description) {
    if (!this.isConfigured()) {
      // Return a placeholder response for testing
      return {
        success: false,
        error: 'Replicate API key not configured',
        mockDescription: description,
        message: 'Configure your Replicate API key in settings to generate room images'
      }
    }

    return this.generateSkyboxImage(description)
  }

  /**
   * Cancel a running prediction
   */
  async cancelPrediction(predictionId) {
    if (!this.isConfigured()) {
      throw new Error('Replicate API key not configured')
    }

    try {
      const response = await fetch(`${this.baseURL}/${predictionId}/cancel`, {
        method: 'POST',
        headers: settingsManager.getReplicateHeaders()
      })

      if (!response.ok) {
        throw new Error(`Failed to cancel prediction: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Failed to cancel prediction:', error)
      throw error
    }
  }

  /**
   * Get prediction status
   */
  async getPredictionStatus(predictionId) {
    if (!this.isConfigured()) {
      throw new Error('Replicate API key not configured')
    }

    try {
      const response = await fetch(`${this.baseURL}/${predictionId}`, {
        headers: settingsManager.getReplicateHeaders()
      })

      if (!response.ok) {
        throw new Error(`Failed to get prediction status: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Failed to get prediction status:', error)
      throw error
    }
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