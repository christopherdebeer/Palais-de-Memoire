/**
 * Anthropic SDK Stream Hook for Memory Palace
 * Handles streaming conversations with proper browser headers and tool calls
 */

import { useState, useCallback, useRef, useMemo } from 'react'
import Anthropic from '@anthropic-ai/sdk'
import settingsManager from '../services/SettingsManager.js'
import MemoryPalaceToolManager from '../utils/memoryPalaceTools.js'

export const useAnthropicStream = (onAddMessage, memoryPalaceCore = null) => {
  const [status, setStatus] = useState('idle') // 'idle' | 'thinking' | 'streaming' | 'tool_use' | 'waiting_for_user'
  const [liveBlocks, setLiveBlocks] = useState(null)
  const [pendingTool, setPendingTool] = useState(null)
  const abortRef = useRef(null)

  // Anthropic SDK instance with proper browser configuration
  const anthropic = useMemo(() => {
    const apiKey = settingsManager.get('anthropicApiKey')
    if (!apiKey) return null
    
    return new Anthropic({
      dangerouslyAllowBrowser: true,
      apiKey: apiKey,
      baseURL: 'https://api.anthropic.com',
      defaultHeaders: {
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
    })
  }, [settingsManager.get('anthropicApiKey')])

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
    const basePrompt = settingsManager.get('systemPrompt') || 
      'You are a Memory Palace AI assistant. Help users create immersive 3D memory spaces using voice commands.'
    
    const { currentRoom, rooms = [], objects = [] } = context

    let contextPrompt = basePrompt + '\n\n'

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
MEMORY PALACE TOOLS AVAILABLE:
- create_room: Create a new memory room
- edit_room: Modify current room description  
- go_to_room: Navigate to another room
- add_object: Add memory object to current room
- remove_object: Remove object from room
- list_rooms: Show available rooms
- get_room_info: Get details about current room

Use these tools to help users build and navigate their memory palace.`

    return contextPrompt
  }, [])

  // Memory palace tool manager
  const toolManager = useMemo(() => {
    return memoryPalaceCore ? new MemoryPalaceToolManager(memoryPalaceCore) : null
  }, [memoryPalaceCore])

  // Get memory palace tools for Claude
  const getMemoryPalaceTools = useCallback(() => {
    return MemoryPalaceToolManager.getToolDefinitions()
  }, [])

  // Execute memory palace tool calls
  const executeToolCall = useCallback(async (toolName, input, toolUseId) => {
    console.log(`[useAnthropicStream] Executing tool: ${toolName}`, input)
    
    if (toolManager) {
      return await toolManager.executeTool(toolName, input, toolUseId)
    } else {
      // Fallback responses when memory palace core is not available
      switch (toolName) {
        case 'create_room':
          return `Room creation scheduled: "${input.name}" with description: ${input.description}. Memory Palace core not connected.`
        
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
        
        default:
          return `Unknown tool: ${toolName}`
      }
    }
  }, [toolManager])

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
  const streamMessage = useCallback(async (messages, context = {}) => {
    if (!anthropic) {
      const fallbackReason = 'Anthropic API key not configured in useAnthropicStream'
      console.error('[useAnthropicStream] Stream fallback triggered:', {
        reason: fallbackReason,
        hasApiKey: !!settingsManager.get('anthropicApiKey'),
        timestamp: new Date().toISOString()
      })
      throw new Error(fallbackReason)
    }

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
  }, [anthropic, buildRequestBody, mergeDelta, assembleMessage])

  // Main send function with tool use loop
  const send = useCallback(async (history, userText, context = {}) => {
    if (!anthropic) {
      const fallbackReason = 'Anthropic API key not configured in useAnthropicStream send'
      console.error('[useAnthropicStream] Send fallback triggered:', {
        reason: fallbackReason,
        userText,
        hasApiKey: !!settingsManager.get('anthropicApiKey'),
        timestamp: new Date().toISOString()
      })
      throw new Error(fallbackReason)
    }
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

        // Add assistant message
        allNewMessages.push(message)
        currentMessages.push(message)

        if (onAddMessage) {
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
                const result = await executeToolCall(block.name, block.input, block.id)
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
  }, [anthropic, status, streamMessage, executeToolCall, onAddMessage])

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
    isConfigured: !!anthropic,
  }
}

export default useAnthropicStream
