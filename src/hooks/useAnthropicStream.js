/**
 * Anthropic SDK Stream Hook for Memory Palace
 * Handles streaming conversations with proper browser headers and tool calls
 */

import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import Anthropic from '@anthropic-ai/sdk'
import SettingsManager from '../services/SettingsManager.js'

// Create settings manager instance
const settingsManager = new SettingsManager()
import MemoryPalaceToolManager from '../utils/memoryPalaceTools.js'

export const useAnthropicStream = (onAddMessage, memoryPalaceCore = null, voiceInterface = null) => {
  const [status, setStatus] = useState('idle') // 'idle' | 'thinking' | 'streaming' | 'tool_use' | 'waiting_for_user'
  const [liveBlocks, setLiveBlocks] = useState(null)
  const [pendingTool, setPendingTool] = useState(null)
  const abortRef = useRef(null)
  
  // Cached anthropic client - created lazily when needed
  const anthropicRef = useRef(null)
  const lastApiKeyRef = useRef(null)

  // Get or create Anthropic client on demand
  const getAnthropicClient = useCallback(() => {

    const currentApiKey = settingsManager.get('anthropicApiKey')
    
    if (!currentApiKey) {
      throw new Error('Anthropic API key not configured')
    }

    // Return cached client if API key hasn't changed
    if (anthropicRef.current && lastApiKeyRef.current === currentApiKey) {
      return anthropicRef.current
    }

    // Create new client
    console.log('[useAnthropicStream] Creating Anthropic client')
    anthropicRef.current = new Anthropic({
      dangerouslyAllowBrowser: true,
      apiKey: currentApiKey,
      baseURL: 'https://api.anthropic.com',
      defaultHeaders: {
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
    })
    lastApiKeyRef.current = currentApiKey

    return anthropicRef.current
  }, [])

  // Merge delta helper for streaming content
  const mergeDelta = useCallback((block, delta) => {
    if (!delta) return
    
    switch (delta.type) {
      case 'text_delta':
        block.text = (block.text ?? '') + (delta.text ?? '')
        break
      case 'input_json_delta':
        block._input_json_str = (block._input_json_str ?? '') + (delta.partial_json ?? '')
        break
      default:
        console.warn('Unhandled delta type:', delta.type)
        Object.assign(block, delta)
    }
  }, [])

  // Build request body with memory palace context
  const buildRequestBody = useCallback((messages, context = {}) => {
    const systemPrompt = buildSystemPrompt(context)
    
    // Get available memory palace tools
    const tools = getMemoryPalaceTools()
    
    return {
      model: settingsManager.get('selectedModel') || 'claude-3-5-haiku-latest',
      max_tokens: 4000,
      temperature: settingsManager.get('responseTemperature') || 0.7,
      stream: true,
      system: systemPrompt,
      messages: messages,
      tools: tools.length > 0 ? tools : undefined,
    }
  }, [])

  // Build system prompt with memory palace context
  const buildSystemPrompt = useCallback((context = {}) => {
    console.log("[useAnthropicStream] buildSystemPromp context", {context, memoryPalaceCore});
    const basePrompt = settingsManager.get('systemPrompt') || 
      'You are a Memory Palace AI assistant. Help users create immersive 3D memory spaces using voice commands.'
    
    const { currentRoom, rooms = [], objects = [], isCreationMode = false, creationPosition = null, paintedAreaData = null } = context

    let contextPrompt = basePrompt + '\n\n'

    // Creation mode context
    if (isCreationMode && creationPosition) {
      contextPrompt += `🎯 CREATION MODE ACTIVE!\n`
      contextPrompt += `The user has DOUBLE-CLICKED on the skybox at position (${creationPosition.x.toFixed(2)}, ${creationPosition.y.toFixed(2)}, ${creationPosition.z.toFixed(2)}).\n`
      contextPrompt += `They want to create something at this specific location. Listen to their description and determine:\n`
      contextPrompt += `- If it's a MEMORY OBJECT (furniture, items, decorations, books, etc.) → use add_object_at_position\n`
      contextPrompt += `- If it's a DOOR/PASSAGE (doorway, portal, stairs, window to another room) → use create_door\n`
      contextPrompt += `IMPORTANT: Use the exact position coordinates provided in the creationPosition for the spatial tools.\n`
      
      // Add painted area context if available
      if (paintedAreaData && paintedAreaData.length > 0) {
        contextPrompt += `\n🎨 PAINTED AREAS DETECTED:\n`
        contextPrompt += `The user has painted areas on the skybox that define object dimensions and placement intentions:\n`
        paintedAreaData.forEach((area, index) => {
          contextPrompt += `- ${area.name || `Area ${index + 1}`}: ${area.dimensions.width.toFixed(0)}×${area.dimensions.height.toFixed(0)} world units\n`
          if (area.position) {
            contextPrompt += `  Position: (${area.position.x.toFixed(2)}, ${area.position.y.toFixed(2)}, ${area.position.z.toFixed(2)})\n`
          }
          contextPrompt += `  Type: ${area.paintedType || 'objects'}\n`
        })
        contextPrompt += `IMPORTANT: Consider these painted dimensions when creating objects - the user has visually indicated their intended size and placement.\n`
        contextPrompt += `When using add_object_at_position or create_door tools, include the dimensions parameter with the painted area's width and height values.\n`
        contextPrompt += `Example: dimensions: { width: 150, height: 200 } based on the painted area data above.\n`
      }
      
      contextPrompt += `\n`
    }

    // Current room context
    if (currentRoom) {
      contextPrompt += `CURRENT ROOM: ${currentRoom.name}\n`
      contextPrompt += `ROOM DESCRIPTION: ${currentRoom.description}\n`
      
      if (objects.length > 0) {
        contextPrompt += `OBJECTS IN THIS ROOM:\n${objects.map(obj => 
          `- ${obj.name}: ${obj.info || obj.information}`
        ).join('\n')}\n`
      } else {
        contextPrompt += `OBJECTS IN THIS ROOM: None yet\n`
      }
    } else {
      contextPrompt += `CURRENT ROOM: None (user needs to create a room first)\n`
    }

    // Available rooms context
    if (rooms.length > 0) {
      contextPrompt += `\nALL ROOMS IN PALACE (${rooms.length} total):\n${rooms.map(room => {
        const isCurrent = currentRoom && room.id === currentRoom.id
        return `- ${room.name}${isCurrent ? ' (CURRENT)' : ''}: ${room.description}`
      }).join('\n')}\n`
    } else {
      contextPrompt += `\nALL ROOMS IN PALACE: None yet (suggest creating the first room)\n`
    }

    contextPrompt += `
MEMORY PALACE TOOLS AVAILABLE:
- create_door: Create a door/connection that leads to a new room (automatically creates room and bidirectional connections). Accepts optional dimensions parameter.
- edit_room: Modify current room's description  
- go_to_room: Navigate to another existing room by name
- add_object: Add a memory object to the current room
- remove_object: Remove an object from the current room
- list_rooms: Show all available rooms with current room marked
- get_room_info: Get detailed info about current room and its objects
- add_object_at_position: Add memory object at specific spatial coordinates (for creation mode). Accepts optional dimensions parameter.
- narrate: Speak text aloud with speech synthesis and closed captions

CRITICAL NARRATION INSTRUCTIONS:
- ALWAYS use the 'narrate' tool for ALL spoken responses to the user
- NEVER include narrative text in your message content - use the narrate tool instead
- For actions: Use appropriate memory palace tools AND narrate tool to explain what happened
- For responses: Use ONLY the narrate tool, do not include text in message content
- For conversations: Use narrate tool for all speech output
- The narrate tool handles speech synthesis and captions automatically

AESTHETIC STYLE:
- When creating rooms, ensure that descriptions are visually detailed
- Ensure description aligns but does not repeat Aesthetic: "${settingsManager.get('aestheticPrompt')}"

IMPORTANT GUIDELINES:
- Always use tools to perform actions rather than just describing them
- If user wants to create a door/room, use create_door tool which automatically creates both room and connections
- If user wants to go somewhere, use go_to_room tool
- If user asks about current state, use get_room_info or list_rooms tools
- In CREATION MODE: Use spatial tools (add_object_at_position or create_door) with the provided coordinates
- Be conversational and helpful while taking concrete actions
- Encourage exploration and memory association techniques
- If a tool fails due to initialization issues, inform the user that the system is still initializing and to try again in a moment

CREATION MODE DECISION LOGIC:
When in creation mode, analyze the user's description:
- Objects: furniture, decorations, books, paintings, sculptures, plants, tools, personal items
- Doors: doorways, passages, stairs, windows leading elsewhere, portals, archways, gates

NOTE: The create_door tool is the ONLY way to create new rooms - rooms can only be created through door connections.

Use these tools actively to help users build and navigate their memory palace.`

    return contextPrompt
  }, [])

  // Memory palace tool manager with proper initialization check
  const toolManager = useMemo(() => {
    // Check if core is properly initialized before creating tool manager
    if (memoryPalaceCore && memoryPalaceCore.isInitialized && memoryPalaceCore.isRunning) {
      console.log('[useAnthropicStream] Creating tool manager with initialized core')
      return new MemoryPalaceToolManager(memoryPalaceCore, voiceInterface)
    } else {
      if (memoryPalaceCore) {
        console.warn('[useAnthropicStream] Memory Palace core provided but not fully initialized:', {
          hasCore: !!memoryPalaceCore,
          isInitialized: memoryPalaceCore?.isInitialized,
          isRunning: memoryPalaceCore?.isRunning
        })
      } else {
        console.log('[useAnthropicStream] No Memory Palace core provided')
      }
      return null
    }
  }, [memoryPalaceCore, voiceInterface])

  // Get memory palace tools for Claude
  const getMemoryPalaceTools = useCallback(() => {
    return MemoryPalaceToolManager.getToolDefinitions()
  }, [])

  // Execute memory palace tool calls
  const executeToolCall = useCallback(async (toolName, input, toolUseId, voiceInterface) => {
    console.log(`[useAnthropicStream] Executing tool: ${toolName}`, input)
    
    // Check if core is ready at execution time (in case it was initialized after hook mount)
    const isCoreReady = memoryPalaceCore && 
                        memoryPalaceCore.isInitialized && 
                        memoryPalaceCore.isRunning;
    
    if (toolManager && toolManager.isReady) {
      return await toolManager.executeTool(toolName, input, toolUseId)
    } else if (isCoreReady) {
      // Core is ready but toolManager wasn't created or updated yet
      // Create a new tool manager on-demand
      console.log('[useAnthropicStream] Creating on-demand tool manager for execution')
      const onDemandToolManager = new MemoryPalaceToolManager(memoryPalaceCore, voiceInterface)
      return await onDemandToolManager.executeTool(toolName, input, toolUseId)
    } else {
      // Fallback responses when memory palace core is not available
      console.log('[useAnthropicStream] Fallback responses when memory palace core is not available')
      switch (toolName) {
        case 'create_door':
          return `Door creation scheduled: "${input.description}" leading to "${input.targetRoomName}". Memory Palace core not connected.`
        
        case 'edit_room':
          return `Room editing scheduled: ${input.description}. Memory Palace core not connected.`
        
        case 'go_to_room':
          return `Navigation scheduled to room: ${input.roomName}. Memory Palace core not connected.`
        
        case 'add_object':
          return `Object creation scheduled: "${input.name}" with info: ${input.info}. Memory Palace core not connected.`
        
        case 'remove_object':
          return `Object removal scheduled: ${input.name}. Memory Palace core not connected.`
        
        case 'list_rooms':
          return 'Room listing not available - Memory Palace core not connected.'
        
        case 'narrate':
          return `Narration: ${input.text}`
        
        default:
          return `Unknown tool: ${toolName}`
      }
    }
  }, [toolManager, voiceInterface])

  // Assemble final message from streaming blocks
  const assembleMessage = useCallback((blocks) => {
    Object.values(blocks).forEach((block) => {
      if (block._input_json_str !== undefined) {
        try {
          block.input = JSON.parse(block._input_json_str)
        } catch {
          // Ignore parse errors
        }
        delete block._input_json_str
      }
    })

    const content = Object.keys(blocks)
      .map(Number)
      .sort((a, b) => a - b)
      .map((k) => {
        const { delta, _streaming, ...block } = blocks[k]
        return block
      })

    return { role: 'assistant', content }
  }, [])

  // Stream a single message
  const streamMessage = useCallback(async (messages, context = {}, voiceInterface = null) => {
    const anthropic = getAnthropicClient() // Get client on-demand

    const body = buildRequestBody(messages, context)
    console.log('[useAnthropicStream] Request body:', body)

    const ctrl = new AbortController()
    abortRef.current = ctrl

    try {
      const stream = await anthropic.messages.create(body, {
        signal: ctrl.signal,
      })

      const blocks = {}
      let stopReason = ''

      for await (const event of stream) {
        console.log('[useAnthropicStream] Stream event:', event.type)

        switch (event.type) {
          case 'content_block_start':
            blocks[event.index] = structuredClone(event.content_block)
            if (blocks[event.index].type === 'text' && blocks[event.index].text === undefined) {
              blocks[event.index].text = ''
            }
            break

          case 'content_block_delta':
            if (blocks[event.index]) {
              mergeDelta(blocks[event.index], event.delta)
            }
            break

          case 'message_delta':
            if (event.delta.stop_reason) {
              stopReason = event.delta.stop_reason
            }
            break

          case 'message_stop':
            break

          case 'error':
            console.error('[useAnthropicStream] Stream event error:', {
              error: event.error,
              timestamp: new Date().toISOString()
            })
            throw new Error(`Stream error: ${event.error.message}`)
        }

        // Update live preview
        if (event.type !== 'message_stop') {
          const preview = Object.keys(blocks)
            .map(Number)
            .sort((a, b) => a - b)
            .map((k) => ({
              ...blocks[k],
              _streaming: k === Math.max(...Object.keys(blocks).map(Number)),
            }))
          setLiveBlocks(preview)
        }
      }

      const finalMessage = assembleMessage(blocks)
      return { message: finalMessage, stopReason }

    } catch (error) {
      const streamErrorDetails = {
        error: error.message,
        stack: error.stack,
        messageCount: messages.length,
        hasContext: Object.keys(context).length > 0,
        timestamp: new Date().toISOString()
      }
      
      console.error('[useAnthropicStream] Streaming error:', streamErrorDetails)
      
      // Log specific streaming error context
      if (error.message.includes('abort')) {
        console.warn('[useAnthropicStream] Stream was aborted by user')
      } else if (error.message.includes('API key')) {
        console.error('[useAnthropicStream] API key error in streaming')
      } else {
        console.error('[useAnthropicStream] Unknown streaming error type')
      }
      
      throw error
    }
  }, [getAnthropicClient, buildRequestBody, mergeDelta, assembleMessage])

  // Main send function with tool use loop
  const send = useCallback(async (history, userText, context = {}, voiceInterface = null) => {
    // Client availability is checked in streamMessage via getAnthropicClient()
    if (status !== 'idle') {
      const error = 'Stream already in progress'
      console.warn('[useAnthropicStream] Send blocked:', { reason: error, currentStatus: status })
      throw new Error(error)
    }

    setStatus('thinking')

    const messages = history
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role, content: m.content }))
      .concat([{ role: 'user', content: userText }])

    let currentMessages = [...messages]
    const allNewMessages = []

    try {
      while (true) {
        setStatus('streaming')

        const { message, stopReason } = await streamMessage(currentMessages, context)
        if (!message.content || message.content.length === 0) {
          console.warn('[useAnthropicStream] Empty message content:', message)
          break;
        }
        // Add assistant message
        allNewMessages.push(message)
        currentMessages.push(message)

        if (onAddMessage) {
          console.log(`[useAntropicStream] on Message: `, message)
          

          onAddMessage({
            id: crypto.randomUUID(),
            role: message.role,
            content: message.content,
            timestamp: Date.now(),
          })
        }

        if (stopReason === 'tool_use') {
          setStatus('tool_use')

          // Execute all tool calls
          const toolResults = []
          for (const block of message.content) {
            if (block.type === 'tool_use') {
              try {
                const result = await executeToolCall(block.name, block.input, block.id, voiceInterface)
                toolResults.push({
                  type: 'tool_result',
                  tool_use_id: block.id,
                  content: result,
                })
              } catch (error) {
                console.error('[useAnthropicStream] Tool execution error:', {
                  toolName: block.name,
                  toolInput: block.input,
                  error: error.message,
                  stack: error.stack
                })
                toolResults.push({
                  type: 'tool_result',
                  tool_use_id: block.id,
                  content: `Error: ${error.message}`,
                  is_error: true,
                })
              }
            }
          }

          setLiveBlocks(null)

          const toolResultMessage = {
            role: 'user',
            content: toolResults,
          }

          allNewMessages.push(toolResultMessage)
          currentMessages.push(toolResultMessage)

          if (onAddMessage) {
            onAddMessage({
              id: crypto.randomUUID(),
              role: toolResultMessage.role,
              content: toolResultMessage.content,
              timestamp: Date.now(),
            })
          }

          continue
        } else {
          break
        }
      }
    } catch (error) {
      const errorDetails = {
        error: error.message,
        stack: error.stack,
        userText,
        status,
        hasAnthropicKey: !!settingsManager.get('anthropicApiKey'),
        timestamp: new Date().toISOString()
      }
      
      console.error('[useAnthropicStream] Send error:', errorDetails)
      
      // Log specific error context
      if (error.message.includes('API key')) {
        console.error('[useAnthropicStream] API key related error')
      } else if (error.message.includes('network') || error.message.includes('fetch')) {
        console.error('[useAnthropicStream] Network error in streaming')
      } else {
        console.error('[useAnthropicStream] Unknown streaming error')
      }
      
      throw error
    } finally {
      setStatus('idle')
      setLiveBlocks(null)
      setPendingTool(null)
      abortRef.current = null
    }

    return allNewMessages
  }, [status, streamMessage, executeToolCall, onAddMessage])

  // Abort helper
  const abort = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
    setStatus('idle')
    setLiveBlocks(null)
    if (pendingTool) {
      pendingTool.reject(new Error('Aborted by user'))
      setPendingTool(null)
    }
  }, [pendingTool])

  return {
    status,
    liveBlocks,
    pendingTool,
    send,
    abort,
    isConfigured: () => {
      try {
        getAnthropicClient()
        return true
      } catch {
        return false
      }
    },
  }
}

export default useAnthropicStream
