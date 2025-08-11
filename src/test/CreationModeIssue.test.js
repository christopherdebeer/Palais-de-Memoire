/**
 * Test to reproduce the exact creation mode failure from issue #37
 * 
 * This test simulates the App component initialization flow to identify
 * where the state synchronization breaks down between:
 * - MemoryPalaceCore.initialize() result 
 * - App component state updates
 * - Creation mode checks
 */

import { MemoryPalaceCore } from '../core/MemoryPalaceCore.js'

// Simulate React-like state management
class MockAppComponent {
  constructor() {
    this.memoryPalaceCore = null
    this.coreInitialized = false
    this.coreInitializationRef = { current: false }
    this.isLoading = true
  }

  // Simulate the App component's initializeCore function
  async initializeCore() {
    console.log('[MockApp] Starting core initialization...')
    
    if (this.coreInitializationRef.current) {
      console.log('[MockApp] Core already initializing, skipping')
      return
    }

    this.coreInitializationRef.current = true
    console.log('[MockApp] Set coreInitializationRef.current = true')

    try {
      const core = new MemoryPalaceCore({
        apiProvider: 'mock',
        persistence: 'localStorage',
        enableVoice: true,
        enableSpatialInteraction: true,
        autopilot: false
      })

      console.log('[MockApp] Calling core.initialize()...')
      const initializeResult = await core.initialize()
      
      console.log('[MockApp] Core initialization result:', initializeResult)
      console.log('[MockApp] Direct core state after initialize():', {
        isInitialized: core.isInitialized,
        isRunning: core.isRunning,
        hasRoomManager: !!core.roomManager,
        hasObjectManager: !!core.objectManager
      })

      if (initializeResult) {
        console.log('[MockApp] Setting App state: memoryPalaceCore and coreInitialized = true')
        this.memoryPalaceCore = core
        this.coreInitialized = true
        
        console.log('[MockApp] Calling core.start()...')
        await core.start()
        console.log('[MockApp] Core started successfully')
      } else {
        console.log('[MockApp] ❌ Core initialization failed, not updating App state')
      }

    } catch (error) {
      console.error('[MockApp] ❌ Error during initialization:', error.message)
      this.coreInitializationRef.current = false
    }

    this.isLoading = false
    console.log('[MockApp] Initialization complete. Final state:', {
      memoryPalaceCore: !!this.memoryPalaceCore,
      coreInitialized: this.coreInitialized,
      coreInitializationRef: this.coreInitializationRef.current,
      isLoading: this.isLoading
    })
  }

  // Simulate the creation mode trigger check
  handleCreationModeTriggered(eventData) {
    console.log('\n[MockApp] Creation mode triggered:', eventData)
    console.log('[MockApp] Current state check:', {
      memoryPalaceCore: !!this.memoryPalaceCore,
      coreInitialized: this.coreInitialized,
      coreInitializationRef: this.coreInitializationRef.current,
      memoryPalaceCoreInitialized: this.memoryPalaceCore?.isInitialized,
      memoryPalaceCoreRunning: this.memoryPalaceCore?.isRunning
    })

    // This is the problematic check from the original code
    if (!this.coreInitializationRef.current || !this.memoryPalaceCore) {
      console.log('[MockApp] ❌ Memory Palace Core not initialized, cannot enter creation mode')
      console.log('[MockApp] Debug info:', {
        memoryPalaceCore: !!this.memoryPalaceCore,
        coreInitialized: this.coreInitialized,
        coreInitializationRef: this.coreInitializationRef.current,
        memoryPalaceCoreState: this.memoryPalaceCore ? "initialized" : "null"
      })
      return false
    }

    // Alternative check that was proposed as fix
    if (!this.coreInitialized || !this.memoryPalaceCore) {
      console.log('[MockApp] ❌ Alternative check also fails (coreInitialized || memoryPalaceCore)')
      return false
    }

    console.log('[MockApp] ✅ Creation mode checks passed!')
    return true
  }
}

async function testCreationModeIssue() {
  console.log('🧪 Testing Creation Mode Issue #37...\n')

  const mockApp = new MockAppComponent()
  
  // Step 1: Initialize the core (simulate app startup)
  console.log('=== STEP 1: App Component Initialization ===')
  await mockApp.initializeCore()
  
  // Step 2: Simulate double-tap creation mode trigger
  console.log('\n=== STEP 2: Creation Mode Double-Tap ===')
  const creationModeEvent = {
    position: { x: 0.5, y: 0.3 },
    screenPosition: { x: 400, y: 200 },
    worldPosition: { x: 10, y: 5, z: -2 },
    timestamp: Date.now()
  }
  
  const creationModeSuccess = mockApp.handleCreationModeTriggered(creationModeEvent)
  
  console.log('\n=== ANALYSIS ===')
  console.log('Creation mode success:', creationModeSuccess)
  
  if (!creationModeSuccess) {
    console.log('\n❌ REPRODUCED THE BUG!')
    console.log('The issue is in the state synchronization between:')
    console.log('- Core initialization result')
    console.log('- App component state updates') 
    console.log('- Creation mode checks')
  } else {
    console.log('\n✅ Creation mode works correctly')
  }
  
  return creationModeSuccess
}

// Run the test when this file is executed
if (import.meta.url === `file://${process.argv[1]}`) {
  testCreationModeIssue().catch(console.error)
}

export { testCreationModeIssue, MockAppComponent }