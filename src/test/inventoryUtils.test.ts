import { describe, it, expect, beforeEach } from 'vitest'
import { addToInventory, placeFromInventory, getInventory } from '../utils/inventoryUtils.js'
import { ensureDefaultState, generateId } from '../utils/stateUtils.js'
import { ObjectType } from '../types/index.js'

// Stub localStorage for tests
const mockStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {}
}

describe('inventory utilities', () => {
  let state: any
  let objectId: string
  let roomId: string

  beforeEach(() => {
    // @ts-ignore
    globalThis.localStorage = mockStorage

    state = ensureDefaultState({
      user: null,
      rooms: new Map(),
      objects: new Map(),
      connections: new Map(),
      conversationHistory: []
    })

    roomId = generateId()
    state.rooms.set(roomId, {
      id: roomId,
      name: 'Room',
      description: '',
      imageUrl: null,
      roomCounter: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })
    state.user.currentRoomId = roomId

    objectId = generateId()
    state.objects.set(objectId, {
      id: objectId,
      roomId,
      userId: state.user.id,
      name: 'Test Object',
      position: { x: 0, y: 0, z: 0 },
      objectCounter: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      type: ObjectType.OBJECT,
      information: ''
    })
  })

  it('adds object to inventory', async () => {
    await addToInventory(state, objectId)
    expect(state.user.inventory).toContain(objectId)
    expect(state.objects.get(objectId)?.roomId).toBeNull()
  })

  it('places object from inventory into room', async () => {
    await addToInventory(state, objectId)
    await placeFromInventory(state, objectId, roomId, { x: 1, y: 0, z: 0 })
    expect(state.user.inventory).not.toContain(objectId)
    const obj = state.objects.get(objectId)
    expect(obj?.roomId).toBe(roomId)
    expect(obj?.position.x).toBe(1)
  })

  it('getInventory lists stored objects', async () => {
    await addToInventory(state, objectId)
    const inv = getInventory(state)
    expect(inv.length).toBe(1)
    expect(inv[0]?.id).toBe(objectId)
  })
})

