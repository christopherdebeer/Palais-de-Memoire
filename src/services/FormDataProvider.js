/**
 * FormDataProvider - Provides data for form components
 * Encapsulates data access patterns used by forms
 */

export class FormDataProvider {
  constructor(core) {
    this.core = core
  }

  /**
   * Get room options for select dropdowns
   */
  getRoomOptions(state) {
    const rooms = this._getRooms(state)
    return rooms.map(room => ({
      value: room.name,
      label: `${room.name} - ${room.description.substring(0, 30)}...`
    }))
  }

  /**
   * Get object options for select dropdowns
   */
  getObjectOptions(state) {
    const objects = this._getObjects(state)
    return objects.map(obj => ({
      value: obj.name,
      label: obj.name
    }))
  }

  /**
   * Get rooms using multiple access patterns as fallback
   * @private
   */
  _getRooms(state) {
    // Try primary access pattern
    if (state?.roomManager) {
      return state.roomManager.getAllRooms() || []
    }
    
    // Try alternative access pattern
    if (state?.core?.getAllRooms) {
      return state.core.getAllRooms() || []
    }
    
    // Try core instance method
    if (this.core?.getAllRooms) {
      return this.core.getAllRooms()
    }
    
    // Try global fallback (last resort)
    if (typeof window !== 'undefined' && window.memoryPalaceCore?.getAllRooms) {
      return window.memoryPalaceCore.getAllRooms()
    }
    
    console.warn('Could not retrieve rooms for form')
    return []
  }

  /**
   * Get objects using multiple access patterns as fallback
   * @private
   */
  _getObjects(state) {
    // Try primary access pattern
    if (state?.currentRoom && state?.core?.getCurrentRoomObjects) {
      return state.core.getCurrentRoomObjects() || []
    }
    
    // Try core instance method
    if (this.core?.getCurrentRoomObjects) {
      return this.core.getCurrentRoomObjects()
    }
    
    // Try global fallback (last resort)
    if (typeof window !== 'undefined' && window.memoryPalaceCore?.getCurrentRoomObjects) {
      return window.memoryPalaceCore.getCurrentRoomObjects()
    }
    
    console.warn('Could not retrieve objects for form')
    return []
  }
}

// Create singleton instance (will be initialized when core is available)
let formDataProvider = null

export function getFormDataProvider(core = null) {
  if (!formDataProvider && core) {
    formDataProvider = new FormDataProvider(core)
  } else if (!formDataProvider && typeof window !== 'undefined' && window.memoryPalaceCore) {
    formDataProvider = new FormDataProvider(window.memoryPalaceCore)
  }
  
  return formDataProvider || new FormDataProvider(null)
}

export default FormDataProvider