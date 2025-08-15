/**
 * Command Parser Utilities
 * Handles parsing user input into structured commands
 */

/**
 * Parse command using simple pattern matching
 * @param {string} input - User input to parse
 * @returns {Object} Parsed command with action and parameters
 */
export function parseCommand(input) {
  const lower = input.toLowerCase()
  const words = lower.split(' ')
  
  // CREATE_ROOM patterns
  if (words.some(w => ['create', 'make', 'build'].includes(w)) && 
      words.some(w => ['room', 'space', 'place', 'area'].includes(w))) {
    return {
      action: 'CREATE_ROOM',
      parameters: {
        description: extractDescription(input, 'room'),
        name: extractName(input) || 'New Room'
      }
    }
  }
  
  // ADD_OBJECT patterns
  if (words.some(w => ['add', 'place', 'put', 'remember'].includes(w)) && 
      words.some(w => ['object', 'item', 'thing', 'memory'].includes(w))) {
    return {
      action: 'ADD_OBJECT',
      parameters: {
        name: extractName(input) || 'Memory Object',
        information: extractDescription(input, 'object')
      }
    }
  }
  
  // NAVIGATE patterns
  if (words.some(w => ['go', 'move', 'navigate', 'travel'].includes(w))) {
    return {
      action: 'NAVIGATE',
      parameters: {
        roomName: extractRoomName(input)
      }
    }
  }
  
  // LIST patterns
  if (words.some(w => ['list', 'show', 'tell'].includes(w))) {
    if (words.some(w => ['rooms', 'room'].includes(w))) {
      return { action: 'LIST_ROOMS', parameters: {} }
    } else {
      return { action: 'LIST_OBJECTS', parameters: {} }
    }
  }
  
  // DESCRIBE patterns
  if (words.some(w => ['describe', 'what', 'where'].includes(w))) {
    return { action: 'DESCRIBE', parameters: {} }
  }
  
  // Default CHAT response
  return {
    action: 'CHAT',
    parameters: { input }
  }
}

/**
 * Extract description from input
 * @param {string} input - Input text
 * @param {string} type - Type of description ('room' or 'object')
 * @returns {string} Extracted description
 */
export function extractDescription(input, type) {
  const patterns = {
    room: /(?:room|space|area)\s+(?:like|with|of|that)\s+(.+?)(?:\.|$)/i,
    object: /(?:object|item|thing)\s+(?:called|named|with|that)\s+(.+?)(?:\.|$)/i
  }
  
  const pattern = patterns[type]
  if (pattern) {
    const match = input.match(pattern)
    if (match) return match[1].trim()
  }
  
  return input.replace(/^(create|add|make|build)\s+/i, '').trim()
}

/**
 * Extract name from input
 * @param {string} input - Input text
 * @returns {string|null} Extracted name or null
 */
export function extractName(input) {
  const quotedMatch = input.match(/"([^"]+)"/i)
  if (quotedMatch) return quotedMatch[1]
  
  const namedMatch = input.match(/(?:called|named)\s+([a-zA-Z\s]+)/i)
  if (namedMatch) return namedMatch[1].trim()
  
  return null
}

/**
 * Extract room name from input
 * @param {string} input - Input text
 * @returns {string|null} Extracted room name or null
 */
export function extractRoomName(input) {
  const quotedMatch = input.match(/"([^"]+)"/i)
  if (quotedMatch) return quotedMatch[1]
  
  const toMatch = input.match(/(?:to|into)\s+([a-zA-Z\s]+)/i)
  if (toMatch) return toMatch[1].trim()
  
  return null
}

/**
 * Check if input contains spatial interaction keywords
 * @param {string} input - Input text
 * @returns {boolean} True if spatial interaction is implied
 */
export function isSpatialCommand(input) {
  const spatialKeywords = [
    'here', 'there', 'this location', 'this spot', 'this place',
    'at this position', 'right here', 'over there'
  ]
  
  const lower = input.toLowerCase()
  return spatialKeywords.some(keyword => lower.includes(keyword))
}

/**
 * Extract spatial references from input
 * @param {string} input - Input text
 * @returns {Object} Spatial reference information
 */
export function extractSpatialReference(input) {
  const lower = input.toLowerCase()
  
  if (lower.includes('here') || lower.includes('this location') || lower.includes('this spot')) {
    return { type: 'current_position', specificity: 'exact' }
  }
  
  if (lower.includes('there') || lower.includes('over there')) {
    return { type: 'distant_position', specificity: 'approximate' }
  }
  
  if (lower.includes('near') || lower.includes('close to')) {
    return { type: 'relative_position', specificity: 'approximate' }
  }
  
  return { type: 'none', specificity: 'none' }
}

/**
 * Determine command priority based on keywords
 * @param {string} input - Input text
 * @returns {number} Priority score (higher = more specific)
 */
export function getCommandPriority(input) {
  const lower = input.toLowerCase()
  let priority = 0
  
  // Exact action words get higher priority
  const exactActions = ['create', 'add', 'remove', 'delete', 'go', 'navigate', 'list', 'show']
  if (exactActions.some(action => lower.includes(action))) {
    priority += 10
  }
  
  // Quoted names/descriptions get higher priority
  if (input.includes('"')) {
    priority += 5
  }
  
  // Spatial references get moderate priority
  if (isSpatialCommand(input)) {
    priority += 3
  }
  
  // Longer, more descriptive inputs get slight priority
  if (input.length > 50) {
    priority += 1
  }
  
  return priority
}

/**
 * Validate command parameters
 * @param {Object} command - Parsed command
 * @returns {Object} Validation result
 */
export function validateCommand(command) {
  const { action, parameters } = command
  const issues = []
  
  switch (action) {
    case 'CREATE_ROOM':
      if (!parameters.name || parameters.name.trim().length === 0) {
        issues.push('Room name is required')
      }
      if (!parameters.description || parameters.description.trim().length === 0) {
        issues.push('Room description is required')
      }
      break
      
    case 'ADD_OBJECT':
      if (!parameters.name || parameters.name.trim().length === 0) {
        issues.push('Object name is required')
      }
      if (!parameters.information || parameters.information.trim().length === 0) {
        issues.push('Object information is required')
      }
      break
      
    case 'NAVIGATE':
      if (!parameters.roomName || parameters.roomName.trim().length === 0) {
        issues.push('Room name is required for navigation')
      }
      break
      
    default:
      // Other commands don't require validation
      break
  }
  
  return {
    valid: issues.length === 0,
    issues
  }
}

/**
 * Suggest corrections for invalid commands
 * @param {Object} command - Invalid command
 * @param {Object} validation - Validation result
 * @returns {string[]} Array of suggestions
 */
export function suggestCorrections(command, validation) {
  const suggestions = []
  
  if (!validation.valid) {
    validation.issues.forEach(issue => {
      switch (issue) {
        case 'Room name is required':
          suggestions.push('Try: "Create a room called [name]" or "Create a [name] room"')
          break
        case 'Room description is required':
          suggestions.push('Try: "Create a room with [description]" or add more details about the room')
          break
        case 'Object name is required':
          suggestions.push('Try: "Add an object called [name]" or "Remember [name]"')
          break
        case 'Object information is required':
          suggestions.push('Try: "Add [name] with information [details]" or provide more context')
          break
        case 'Room name is required for navigation':
          suggestions.push('Try: "Go to [room name]" or "Navigate to the [room name]"')
          break
        default:
          suggestions.push('Please provide more specific information')
          break
      }
    })
  }
  
  return suggestions
}

/**
 * Parse complex commands with multiple actions
 * @param {string} input - Input text
 * @returns {Object[]} Array of parsed commands
 */
export function parseMultipleCommands(input) {
  // Split on common separators
  const separators = [' and then ', ' then ', ', and ', '; ']
  let parts = [input]
  
  separators.forEach(separator => {
    const newParts = []
    parts.forEach(part => {
      newParts.push(...part.split(separator))
    })
    parts = newParts
  })
  
  // Parse each part as a separate command
  return parts
    .map(part => part.trim())
    .filter(part => part.length > 0)
    .map(part => parseCommand(part))
}

/**
 * Extract context clues from input
 * @param {string} input - Input text
 * @returns {Object} Context information
 */
export function extractContext(input) {
  const lower = input.toLowerCase()
  
  return {
    hasTimeReference: /\b(now|today|tomorrow|yesterday|later|soon|immediately)\b/.test(lower),
    hasLocationReference: /\b(here|there|nearby|far|close|distant)\b/.test(lower),
    hasQuantity: /\b(\d+|one|two|three|several|many|few|some)\b/.test(lower),
    hasEmotionalContext: /\b(important|urgent|remember|forget|love|hate|like|dislike)\b/.test(lower),
    isQuestion: input.includes('?') || /\b(what|where|when|why|how|who)\b/.test(lower),
    isImperative: /\b(please|can you|could you|would you)\b/.test(lower) || input.endsWith('!')
  }
}
