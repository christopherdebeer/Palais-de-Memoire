import { ApplicationState, MemoryPalaceObject, Position3D } from '../types/index.js'
import { saveState } from './stateUtils.js'

/**
 * Add an object to the user's inventory
 */
export async function addToInventory(
  state: ApplicationState,
  objectId: string
): Promise<MemoryPalaceObject | null> {
  const object = state.objects.get(objectId)
  if (!object) {
    return null
  }

  if (!state.user.inventory.includes(objectId)) {
    state.user.inventory.push(objectId)
  }

  object.roomId = null
  object.updatedAt = new Date().toISOString()

  await saveState(state)
  return object
}

/**
 * Place an object from inventory into a room
 */
export async function placeFromInventory(
  state: ApplicationState,
  objectId: string,
  targetRoomId: string,
  position: Position3D | null = null
): Promise<MemoryPalaceObject | null> {
  const object = state.objects.get(objectId)
  if (!object) {
    return null
  }

  const index = state.user.inventory.indexOf(objectId)
  if (index === -1) {
    return null
  }

  state.user.inventory.splice(index, 1)
  object.roomId = targetRoomId
  if (position) {
    object.position = position
  }
  object.updatedAt = new Date().toISOString()

  await saveState(state)
  return object
}

/**
 * Get all objects currently in the user's inventory
 */
export function getInventory(state: ApplicationState): MemoryPalaceObject[] {
  return state.user.inventory
    .map(id => state.objects.get(id) || null)
    .filter((obj): obj is MemoryPalaceObject => obj !== null)
}

