/**
 * Simple event emitter for application-wide event handling
 * Provides a centralized way for components to communicate
 */
export class EventEmitter {
  constructor() {
    this.listeners = new Map()
  }

  /**
   * Subscribe to an event
   * @param {string} event - Event name
   * @param {Function} callback - Event handler function
   * @returns {Function} Unsubscribe function
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    
    this.listeners.get(event).add(callback)
    
    // Return unsubscribe function
    return () => {
      const eventListeners = this.listeners.get(event)
      if (eventListeners) {
        eventListeners.delete(callback)
        if (eventListeners.size === 0) {
          this.listeners.delete(event)
        }
      }
    }
  }

  /**
   * Subscribe to an event only once
   * @param {string} event - Event name
   * @param {Function} callback - Event handler function
   * @returns {Function} Unsubscribe function
   */
  once(event, callback) {
    const unsubscribe = this.on(event, (...args) => {
      unsubscribe()
      callback(...args)
    })
    return unsubscribe
  }

  /**
   * Emit an event to all subscribers
   * @param {string} event - Event name
   * @param {...any} args - Arguments to pass to listeners
   */
  emit(event, ...args) {
    const eventListeners = this.listeners.get(event)
    if (eventListeners) {
      // Create array to avoid modification during iteration
      const listenersArray = [...eventListeners]
      listenersArray.forEach(callback => {
        try {
          callback(...args)
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error)
        }
      })
    }
  }

  /**
   * Remove all listeners for an event, or all listeners if no event specified
   * @param {string} [event] - Optional event name to clear
   */
  clear(event) {
    if (event) {
      this.listeners.delete(event)
    } else {
      this.listeners.clear()
    }
  }

  /**
   * Get the number of listeners for an event
   * @param {string} event - Event name
   * @returns {number} Number of listeners
   */
  listenerCount(event) {
    const eventListeners = this.listeners.get(event)
    return eventListeners ? eventListeners.size : 0
  }

  /**
   * Get all event names that have listeners
   * @returns {string[]} Array of event names
   */
  eventNames() {
    return [...this.listeners.keys()]
  }
}