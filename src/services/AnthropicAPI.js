/**
 * Anthropic API Service for Claude LLM Integration
 * Handles conversation, command processing, and structured responses
 */

import settingsManager from './SettingsManager.js'

export class AnthropicAPI {
  constructor() {
    this.baseURL = 'https://api.anthropic.com/v1/messages'
    this.model = 'claude-3-sonnet-20240229'
    this.maxTokens = 1000
  }

  /**
   * Check if API is configured
   */
  isConfigured() {
    return !!settingsManager.get('anthropicApiKey')
  }

  /**
   * Process user input and return structured response
   */
  async processInput(userInput, context = {}) {
    if (!this.isConfigured()) {
      throw new Error('Anthropic API key not configured')
    }

    const systemPrompt = this.buildSystemPrompt(context)
    
    try {
      const response = await fetch(this.baseURL, {
        method: 'POST',
        headers: settingsManager.getAnthropicHeaders(),
        body: JSON.stringify({
          model: this.model,
          max_tokens: this.maxTokens,
          temperature: settingsManager.get('responseTemperature'),
          system: systemPrompt,
          messages: [
            {
              role: 'user',
              content: userInput
            }
          ]
        })
      })

      if (!response.ok) {
        throw new Error(`Anthropic API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      return this.parseResponse(data.content[0].text)
      
    } catch (error) {
      console.error('Anthropic API request failed:', error)
      throw error
    }
  }

  /**
   * Build comprehensive system prompt with context
   */
  buildSystemPrompt(context = {}) {
    const basePrompt = settingsManager.get('systemPrompt')
    const { currentRoom, rooms = [], objects = [] } = context

    let contextPrompt = basePrompt + '\n\n'

    // Add current context
    if (currentRoom) {
      contextPrompt += `CURRENT ROOM: ${currentRoom.name}\n`
      contextPrompt += `ROOM DESCRIPTION: ${currentRoom.description}\n`
    }

    if (rooms.length > 0) {
      contextPrompt += `\nAVAILABLE ROOMS:\n${rooms.map(room => 
        `- ${room.name}: ${room.description}`
      ).join('\n')}\n`
    }

    if (objects.length > 0) {
      contextPrompt += `\nOBJECTS IN CURRENT ROOM:\n${objects.map(obj => 
        `- ${obj.name}: ${obj.info}`
      ).join('\n')}\n`
    }

    contextPrompt += `
AVAILABLE COMMANDS:
- CREATE_ROOM: Create a new room
- EDIT_ROOM: Modify current room description
- GO_TO_ROOM: Navigate to another room
- ADD_OBJECT: Add memory object to current room
- REMOVE_OBJECT: Remove object from room
- LIST_ROOMS: Show available rooms
- GET_ROOM_INFO: Get details about current room
- HELP: Show available commands

Your job is to intelligently match user intent to the right action using this complete context.

For CREATE_ROOM commands, include these details after your response:
ROOM_NAME: [room name]
ROOM_DESCRIPTION: [detailed room description for image generation]

For EDIT_ROOM commands, include:
ROOM_DESCRIPTION: [updated detailed room description for image generation]

For ADD_OBJECT commands, include:
OBJECT_NAME: [object name]
OBJECT_INFO: [information to remember]

For GO_TO_ROOM commands, include:
TARGET_ROOM: [room name to navigate to]

Respond conversationally and then provide the structured command data.`

    return contextPrompt
  }

  /**
   * Parse API response and extract commands
   */
  parseResponse(responseText) {
    const response = {
      text: responseText,
      command: null,
      parameters: {}
    }

    // Extract structured command data
    const lines = responseText.split('\n')
    let currentCommand = null

    for (const line of lines) {
      const trimmed = line.trim()
      
      // Look for command indicators
      if (trimmed.includes('CREATE_ROOM') || trimmed.includes('EDIT_ROOM') || 
          trimmed.includes('ADD_OBJECT') || trimmed.includes('GO_TO_ROOM')) {
        if (trimmed.includes('CREATE_ROOM')) currentCommand = 'CREATE_ROOM'
        else if (trimmed.includes('EDIT_ROOM')) currentCommand = 'EDIT_ROOM'
        else if (trimmed.includes('ADD_OBJECT')) currentCommand = 'ADD_OBJECT'
        else if (trimmed.includes('GO_TO_ROOM')) currentCommand = 'GO_TO_ROOM'
      }

      // Extract parameters
      if (trimmed.startsWith('ROOM_NAME:')) {
        response.parameters.roomName = trimmed.replace('ROOM_NAME:', '').trim()
        response.command = currentCommand || 'CREATE_ROOM'
      }
      else if (trimmed.startsWith('ROOM_DESCRIPTION:')) {
        response.parameters.roomDescription = trimmed.replace('ROOM_DESCRIPTION:', '').trim()
        response.command = currentCommand || 'CREATE_ROOM'
      }
      else if (trimmed.startsWith('OBJECT_NAME:')) {
        response.parameters.objectName = trimmed.replace('OBJECT_NAME:', '').trim()
        response.command = currentCommand || 'ADD_OBJECT'
      }
      else if (trimmed.startsWith('OBJECT_INFO:')) {
        response.parameters.objectInfo = trimmed.replace('OBJECT_INFO:', '').trim()
        response.command = currentCommand || 'ADD_OBJECT'
      }
      else if (trimmed.startsWith('TARGET_ROOM:')) {
        response.parameters.targetRoom = trimmed.replace('TARGET_ROOM:', '').trim()
        response.command = currentCommand || 'GO_TO_ROOM'
      }
    }

    // Detect commands from natural language if no structured output
    if (!response.command) {
      const lowercaseText = responseText.toLowerCase()
      
      if (lowercaseText.includes('create') && (lowercaseText.includes('room') || lowercaseText.includes('space'))) {
        response.command = 'CREATE_ROOM'
      }
      else if (lowercaseText.includes('go to') || lowercaseText.includes('navigate') || lowercaseText.includes('enter')) {
        response.command = 'GO_TO_ROOM'
      }
      else if (lowercaseText.includes('add') && lowercaseText.includes('object')) {
        response.command = 'ADD_OBJECT'
      }
      else if (lowercaseText.includes('list') && lowercaseText.includes('room')) {
        response.command = 'LIST_ROOMS'
      }
    }

    return response
  }

  /**
   * Generate a conversational response for testing
   */
  async generateTestResponse(userInput) {
    // Mock response for testing without API key
    if (!this.isConfigured()) {
      return {
        text: `I understand you said: "${userInput}". However, I need an Anthropic API key to provide full responses. Please configure your API key in the settings panel.`,
        command: null,
        parameters: {}
      }
    }
    
    return this.processInput(userInput)
  }
}

export const anthropicAPI = new AnthropicAPI()
export default anthropicAPI