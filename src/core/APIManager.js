import { EventEmitter } from './EventEmitter.js'
import { EventTypes } from './types.js'

/**
 * Abstract base class for API providers
 * Defines the interface that all API providers must implement
 */
export class BaseAPIProvider {
  /**
   * Generate an image from a text description
   * @param {string} description - Text description of the image
   * @param {Object} options - Additional generation options
   * @returns {Promise<{success: boolean, data?: string, error?: string}>}
   */
  async generateImage(description, options = {}) {
    throw new Error('generateImage must be implemented by subclass')
  }

  /**
   * Generate text/chat completion
   * @param {string} prompt - Input prompt
   * @param {Object} options - Generation options (temperature, max_tokens, etc.)
   * @returns {Promise<{success: boolean, data?: string, error?: string}>}
   */
  async generateText(prompt, options = {}) {
    throw new Error('generateText must be implemented by subclass')
  }

  /**
   * Parse a command from natural language
   * @param {string} input - User input text
   * @param {Object} context - Current context (room, objects, etc.)
   * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
   */
  async parseCommand(input, context = {}) {
    throw new Error('parseCommand must be implemented by subclass')
  }
}

/**
 * Mock API provider for development and testing
 * Provides placeholder responses without external API calls
 */
export class MockAPIProvider extends BaseAPIProvider {
  constructor() {
    super()
    this.delay = 1000 // Simulate API delay
  }

  async generateImage(description, options = {}) {
    await this.simulateDelay()
    
    // Return a placeholder image URL based on description
    const seed = this.hashString(description)
    const width = options.width || 2048
    const height = options.height || 1024
    
    return {
      success: true,
      data: `https://picsum.photos/seed/${seed}/${width}/${height}`,
      metadata: {
        provider: 'mock',
        description,
        generatedAt: new Date().toISOString()
      }
    }
  }

  async generateText(prompt, options = {}) {
    await this.simulateDelay()
    
    // Simple mock responses based on prompt patterns
    const response = this.generateMockResponse(prompt, options)
    
    return {
      success: true,
      data: response,
      metadata: {
        provider: 'mock',
        prompt,
        generatedAt: new Date().toISOString()
      }
    }
  }

  async parseCommand(input, context = {}) {
    await this.simulateDelay(500) // Shorter delay for command parsing
    
    const command = this.mockCommandParser(input, context)
    
    return {
      success: true,
      data: command,
      metadata: {
        provider: 'mock',
        input,
        generatedAt: new Date().toISOString()
      }
    }
  }

  // Helper methods
  async simulateDelay(ms = null) {
    const delay = ms || this.delay
    return new Promise(resolve => setTimeout(resolve, delay))
  }

  hashString(str) {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash)
  }

  generateMockResponse(prompt, options) {
    const lower = prompt.toLowerCase()
    
    if (lower.includes('create') && lower.includes('room')) {
      return 'I\'ll help you create a new room in your memory palace. What kind of environment would you like to visualize?'
    }
    
    if (lower.includes('add') && (lower.includes('object') || lower.includes('item'))) {
      return 'Great! Let\'s add a memory object to this room. What would you like to remember here?'
    }
    
    if (lower.includes('navigate') || lower.includes('go to')) {
      return 'I can help you navigate to a different room. Which room would you like to visit?'
    }
    
    if (lower.includes('describe') || lower.includes('what')) {
      return 'You\'re currently in your memory palace. I can see the immersive environment around you with various memory objects placed throughout the space.'
    }
    
    return 'I\'m here to help you build and navigate your memory palace. You can ask me to create rooms, add objects, or move between spaces.'
  }

  mockCommandParser(input, context) {
    const lower = input.toLowerCase()
    const words = lower.split(' ')
    
    // CREATE_ROOM patterns
    if (words.some(w => ['create', 'make', 'build'].includes(w)) && 
        words.some(w => ['room', 'space', 'place', 'area'].includes(w))) {
      return {
        action: 'CREATE_ROOM',
        parameters: {
          description: this.extractDescription(input, 'room'),
          name: this.extractName(input) || 'New Room'
        },
        originalText: input,
        response: 'Creating a new room in your memory palace...',
        confidence: 0.8
      }
    }
    
    // ADD_OBJECT patterns
    if (words.some(w => ['add', 'place', 'put', 'remember'].includes(w)) && 
        words.some(w => ['object', 'item', 'thing', 'memory'].includes(w))) {
      return {
        action: 'ADD_OBJECT',
        parameters: {
          name: this.extractName(input) || 'Memory Object',
          information: this.extractDescription(input, 'object'),
          position: { x: 0, y: 0, z: -400 } // Default position
        },
        originalText: input,
        response: 'Adding a memory object to this location...',
        confidence: 0.8
      }
    }
    
    // NAVIGATE patterns
    if (words.some(w => ['go', 'move', 'navigate', 'travel'].includes(w))) {
      return {
        action: 'NAVIGATE',
        parameters: {
          target: this.extractTarget(input, context)
        },
        originalText: input,
        response: 'Moving to the requested location...',
        confidence: 0.7
      }
    }
    
    // CREATE_DOOR patterns
    if (words.some(w => ['door', 'entrance', 'exit', 'connection'].includes(w))) {
      return {
        action: 'CREATE_DOOR',
        parameters: {
          description: this.extractDescription(input, 'door'),
          target: this.extractTarget(input, context)
        },
        originalText: input,
        response: 'Creating a new door connection...',
        confidence: 0.7
      }
    }
    
    // Default CHAT response
    return {
      action: 'CHAT',
      parameters: {},
      originalText: input,
      response: this.generateMockResponse(input),
      confidence: 0.5
    }
  }

  extractDescription(input, type) {
    // Simple extraction logic - in real implementation would be more sophisticated
    const patterns = {
      room: /(?:room|space|area)\s+(?:like|with|of|that)\s+(.+?)(?:\.|$)/i,
      object: /(?:object|item|thing)\s+(?:called|named|with|that)\s+(.+?)(?:\.|$)/i,
      door: /(?:door|entrance)\s+(?:to|leading|that)\s+(.+?)(?:\.|$)/i
    }
    
    const pattern = patterns[type]
    if (pattern) {
      const match = input.match(pattern)
      if (match) return match[1].trim()
    }
    
    // Fallback: return part of the input
    return input.replace(/^(create|add|make|build)\s+/i, '').trim()
  }

  extractName(input) {
    // Look for quoted names or names after "called/named"
    const quotedMatch = input.match(/"([^"]+)"/i)
    if (quotedMatch) return quotedMatch[1]
    
    const namedMatch = input.match(/(?:called|named)\s+([a-zA-Z\s]+)/i)
    if (namedMatch) return namedMatch[1].trim()
    
    return null
  }

  extractTarget(input, context) {
    // Look for room names or connections in the input
    if (context.connections) {
      for (const conn of context.connections) {
        if (input.toLowerCase().includes(conn.description.toLowerCase())) {
          return conn.targetRoomId
        }
      }
    }
    
    return null
  }
}

/**
 * WebSim API provider (for the original prototype)
 * Implements the WebSim-specific API calls
 */
export class WebSimAPIProvider extends BaseAPIProvider {
  constructor(baseUrl = 'https://websim.com/api') {
    super()
    this.baseUrl = baseUrl
  }

  async generateImage(description, options = {}) {
    try {
      // WebSim image generation API call
      const response = await fetch(`${this.baseUrl}/images/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt: description,
          ...options
        })
      })
      
      const data = await response.json()
      
      if (response.ok) {
        return {
          success: true,
          data: data.image_url,
          metadata: data
        }
      } else {
        return {
          success: false,
          error: data.error || 'Image generation failed'
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  }

  async generateText(prompt, options = {}) {
    try {
      // WebSim chat completion API call
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt,
          temperature: options.temperature || 0.7,
          max_tokens: options.maxTokens || 500,
          ...options
        })
      })
      
      const data = await response.json()
      
      if (response.ok) {
        return {
          success: true,
          data: data.completion,
          metadata: data
        }
      } else {
        return {
          success: false,
          error: data.error || 'Text generation failed'
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  }

  async parseCommand(input, context = {}) {
    // Use text generation for command parsing
    const systemPrompt = `
You are a command parser for a memory palace application. Parse the user's input and respond with a JSON object containing:
{
  "action": "CREATE_ROOM|ADD_OBJECT|CREATE_DOOR|NAVIGATE|DESCRIBE|LIST|CHAT",
  "parameters": {...},
  "response": "User-friendly response text",
  "confidence": 0.0-1.0
}

Current context: ${JSON.stringify(context)}
User input: "${input}"
`
    
    const result = await this.generateText(systemPrompt, { temperature: 0.1 })
    
    if (result.success) {
      try {
        const parsed = JSON.parse(result.data)
        return {
          success: true,
          data: {
            ...parsed,
            originalText: input
          }
        }
      } catch (error) {
        return {
          success: false,
          error: 'Failed to parse command response'
        }
      }
    } else {
      return result
    }
  }
}

/**
 * API Manager - Centralized API management with provider abstraction
 * Handles all external API calls through pluggable providers
 */
export class APIManager extends EventEmitter {
  constructor() {
    super()
    this.provider = null
    this.requestQueue = []
    this.isProcessingQueue = false
    this.rateLimiter = {
      requests: 0,
      windowStart: Date.now(),
      maxRequests: 60, // per minute
      windowMs: 60000
    }
  }

  /**
   * Initialize with a specific API provider
   * @param {BaseAPIProvider} provider - API provider instance
   */
  initialize(provider) {
    if (!(provider instanceof BaseAPIProvider)) {
      throw new Error('Provider must extend BaseAPIProvider')
    }
    
    this.provider = provider
    this.emit(EventTypes.API_REQUEST, { type: 'provider_initialized', provider: provider.constructor.name })
  }

  /**
   * Generate an image with rate limiting and error handling
   * @param {string} description - Image description
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} API response
   */
  async generateImage(description, options = {}) {
    return this.makeRequest('generateImage', [description, options])
  }

  /**
   * Generate text with rate limiting and error handling
   * @param {string} prompt - Text prompt
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} API response
   */
  async generateText(prompt, options = {}) {
    return this.makeRequest('generateText', [prompt, options])
  }

  /**
   * Parse a command with rate limiting and error handling
   * @param {string} input - User input
   * @param {Object} context - Current context
   * @returns {Promise<Object>} API response
   */
  async parseCommand(input, context = {}) {
    return this.makeRequest('parseCommand', [input, context])
  }

  /**
   * Make an API request with rate limiting and error handling
   * @param {string} method - Method name to call on provider
   * @param {Array} args - Arguments to pass to method
   * @returns {Promise<Object>} API response
   */
  async makeRequest(method, args) {
    if (!this.provider) {
      return {
        success: false,
        error: 'No API provider configured'
      }
    }

    // Check rate limiting
    if (!this.checkRateLimit()) {
      return {
        success: false,
        error: 'Rate limit exceeded. Please wait before making another request.'
      }
    }

    try {
      this.emit(EventTypes.API_REQUEST, { method, args })
      
      const result = await this.provider[method](...args)
      
      this.emit(EventTypes.API_RESPONSE, { method, args, result })
      
      return result
    } catch (error) {
      const errorResult = {
        success: false,
        error: error.message
      }
      
      this.emit(EventTypes.API_RESPONSE, { method, args, result: errorResult, error })
      this.emit(EventTypes.ERROR_OCCURRED, { type: 'api_error', method, error })
      
      return errorResult
    }
  }

  /**
   * Check if request is within rate limits
   * @returns {boolean} True if request is allowed
   */
  checkRateLimit() {
    const now = Date.now()
    
    // Reset window if enough time has passed
    if (now - this.rateLimiter.windowStart >= this.rateLimiter.windowMs) {
      this.rateLimiter.requests = 0
      this.rateLimiter.windowStart = now
    }
    
    // Check if under limit
    if (this.rateLimiter.requests >= this.rateLimiter.maxRequests) {
      return false
    }
    
    this.rateLimiter.requests++
    return true
  }

  /**
   * Get current rate limit status
   * @returns {Object} Rate limit information
   */
  getRateLimitStatus() {
    const now = Date.now()
    const timeRemaining = this.rateLimiter.windowMs - (now - this.rateLimiter.windowStart)
    
    return {
      requests: this.rateLimiter.requests,
      maxRequests: this.rateLimiter.maxRequests,
      requestsRemaining: this.rateLimiter.maxRequests - this.rateLimiter.requests,
      windowResetMs: Math.max(0, timeRemaining)
    }
  }

  /**
   * Create a mock provider instance
   * @returns {MockAPIProvider} Mock provider
   */
  static createMockProvider() {
    return new MockAPIProvider()
  }

  /**
   * Create a WebSim provider instance
   * @param {string} baseUrl - Base URL for WebSim API
   * @returns {WebSimAPIProvider} WebSim provider
   */
  static createWebSimProvider(baseUrl) {
    return new WebSimAPIProvider(baseUrl)
  }
}