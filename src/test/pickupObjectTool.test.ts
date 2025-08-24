import { describe, it, expect, beforeEach } from 'vitest'
import MemoryPalaceCore from '../core/MemoryPalaceCore.js'
import MemoryPalaceToolManager from '../utils/memoryPalaceTools.js'
import { ensureDefaultState, generateId } from '../utils/stateUtils.js'
import { ObjectType } from '../types/index.js'

// Stub localStorage for tests
const mockStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {}
}

describe('pickup_object tool', () => {
  let core: any
  let tool: any
  let objectId: string

  beforeEach(() => {
    // @ts-ignore
    globalThis.localStorage = mockStorage

    core = new MemoryPalaceCore({ enableImageGeneration: false })
    core.state = ensureDefaultState(core.state)
    core.isInitialized = true

    const roomId = generateId()
    const now = new Date().toISOString()
    core.state.rooms.set(roomId, {
      id: roomId,
      name: 'Room',
      description: '',
      imageUrl: null,
      roomCounter: 1,
      createdAt: now,
      updatedAt: now
    })
    core.state.user.currentRoomId = roomId

    objectId = generateId()
    core.state.objects.set(objectId, {
      id: objectId,
      roomId,
      userId: core.state.user.id,
      name: 'Key',
      position: { x: 0, y: 0, z: 0 },
      objectCounter: 1,
      createdAt: now,
      updatedAt: now,
      type: ObjectType.OBJECT,
      information: ''
    })

    tool = new MemoryPalaceToolManager(core)
  })

  it('moves object from room to inventory', async () => {
    const message = await tool.executeTool('pickup_object', { name: 'Key' })
    expect(message).toContain('Picked up')
    expect(core.state.user.inventory).toContain(objectId)
    expect(core.state.objects.get(objectId)?.roomId).toBeNull()
  })
})
