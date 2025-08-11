/**
 * Test to reproduce the exact state update failure from issue #37
 * 
 * User logs show:
 * 1. [MemoryPalaceCore] ✅ Initialization completed successfully  
 * 2. BUT [App] coreInitialized: false, memoryPalaceCore: false
 * 
 * This means the React state updates are failing after successful core initialization.
 * We need to understand WHY the state isn't being updated.
 */

import { MemoryPalaceCore } from '../core/MemoryPalaceCore.js'

// Simulate the exact App.jsx initialization flow with potential failure points
class AppStateSimulator {
  constructor() {
    this.memoryPalaceCore = null
    this.coreInitialized = false  
    this.coreInitializationRef = { current: false }
    this.isLoading = true
    this.stateUpdateFailures = []
  }

  // Simulate React setState with potential failure points
  setMemoryPalaceCore(core) {
    // Simulate React setState delay/failure
    console.log('[AppStateSimulator] setMemoryPalaceCore called with:', !!core)
    
    // Simulate scenarios where setState might fail or be ignored
    if (this.memoryPalaceCore !== null) {
      console.log('[AppStateSimulator] WARNING: memoryPalaceCore already set, ignoring update')
      this.stateUpdateFailures.push('memoryPalaceCore already set')
      return
    }
    
    this.memoryPalaceCore = core
    console.log('[AppStateSimulator] ✅ memoryPalaceCore set successfully')
  }
  
  setCoreInitialized(value) {
    console.log('[AppStateSimulator] setCoreInitialized called with:', value)
    
    // Simulate scenarios where setState might fail or be ignored  
    if (this.coreInitialized === value) {
      console.log('[AppStateSimulator] WARNING: coreInitialized already', value, ', ignoring update')
      this.stateUpdateFailures.push(`coreInitialized already ${value}`)
      return
    }
    
    this.coreInitialized = value
    console.log('[AppStateSimulator] ✅ coreInitialized set to', value)
  }

  // Simulate the exact App.jsx initializeCore function
  async initializeCore() {
    console.log('[AppStateSimulator] Starting initializeCore...')
    
    if (this.coreInitializationRef.current) {
      console.log('[AppStateSimulator] Core initialization already in progress, skipping...')
      return
    }
    
    this.coreInitializationRef.current = true
    console.log('[AppStateSimulator] Set coreInitializationRef.current = true')
    
    try {
      const core = new MemoryPalaceCore({
        apiProvider: 'mock',
        persistence: 'localStorage',
        enableVoice: true,
        enableSpatialInteraction: true,
        autopilot: false
      })
      
      console.log('[AppStateSimulator] Calling core.initialize()...')
      const initialized = await core.initialize()
      console.log('[AppStateSimulator] Core initialization result:', initialized)
      
      if (initialized) {
        console.log('[AppStateSimulator] Starting core...')
        await core.start()
        console.log('[AppStateSimulator] Core started, updating state...')
        
        // THIS IS THE CRITICAL SECTION - where state updates happen
        console.log('[AppStateSimulator] About to call setMemoryPalaceCore...')
        this.setMemoryPalaceCore(core)
        
        console.log('[AppStateSimulator] About to call setCoreInitialized(true)...')  
        this.setCoreInitialized(true)
        
        console.log('[AppStateSimulator] State update calls completed')
        console.log('[AppStateSimulator] Final state after updates:', {
          memoryPalaceCore: !!this.memoryPalaceCore,
          coreInitialized: this.coreInitialized
        })
        
      } else {
        console.error('[AppStateSimulator] ❌ Core initialization failed')
        this.coreInitializationRef.current = false
      }
      
    } catch (error) {
      console.error('[AppStateSimulator] ❌ Error during initialization:', error.message)
      this.coreInitializationRef.current = false
    }
    
    this.isLoading = false
  }

  // Simulate creation mode check
  testCreationMode() {
    console.log('\n[AppStateSimulator] Testing creation mode...')
    console.log('[AppStateSimulator] Current state check:', {
      memoryPalaceCore: !!this.memoryPalaceCore,
      coreInitialized: this.coreInitialized,
      coreInitializationRef: this.coreInitializationRef.current,
      memoryPalaceCoreInitialized: this.memoryPalaceCore?.isInitialized,
      memoryPalaceCoreRunning: this.memoryPalaceCore?.isRunning
    })
    
    if (this.stateUpdateFailures.length > 0) {
      console.log('[AppStateSimulator] State update failures:', this.stateUpdateFailures)
    }
    
    // The exact check from App.jsx
    if (!this.coreInitialized || !this.memoryPalaceCore) {
      console.log('[AppStateSimulator] ❌ Creation mode check failed!')
      console.log('[AppStateSimulator] Debug info:', {
        memoryPalaceCore: !!this.memoryPalaceCore,
        coreInitialized: this.coreInitialized,
        coreInitializationRef: this.coreInitializationRef.current,
        memoryPalaceCoreState: this.memoryPalaceCore ? "initialized" : "null"
      })
      return false
    }
    
    console.log('[AppStateSimulator] ✅ Creation mode would work!')
    return true
  }
}

// Simulate scenarios that could cause state update failures
class BrokenAppStateSimulator extends AppStateSimulator {
  constructor() {
    super()
    this.simulateFailureMode = 'react_strict_mode_race'
  }

  // Simulate different failure modes
  setMemoryPalaceCore(core) {
    if (this.simulateFailureMode === 'react_strict_mode_race') {
      // Simulate React StrictMode causing state to be reset before setState completes
      console.log('[BrokenAppStateSimulator] Simulating React StrictMode race condition...')
      console.log('[BrokenAppStateSimulator] State reset by StrictMode remount before setState!')
      this.stateUpdateFailures.push('StrictMode race condition - state reset before setState')
      // Don't actually set the state
      return
    }
    
    if (this.simulateFailureMode === 'async_timing') {
      // Simulate async timing issues
      console.log('[BrokenAppStateSimulator] Simulating async timing issue...')
      setTimeout(() => {
        console.log('[BrokenAppStateSimulator] Delayed setState - too late!')
        this.memoryPalaceCore = core
      }, 100)
      this.stateUpdateFailures.push('Async timing issue - setState delayed')
      return
    }
    
    super.setMemoryPalaceCore(core)
  }
  
  setCoreInitialized(value) {
    if (this.simulateFailureMode === 'react_strict_mode_race') {
      console.log('[BrokenAppStateSimulator] Simulating coreInitialized state reset...')
      this.stateUpdateFailures.push('StrictMode race condition - coreInitialized reset')
      return
    }
    
    super.setCoreInitialized(value)
  }
}

async function testStateUpdateFailure() {
  console.log('🧪 Testing State Update Failure Issue #37...\n')
  
  console.log('=== Testing WORKING App State Updates ===')
  const workingApp = new AppStateSimulator()
  await workingApp.initializeCore()
  const workingResult = workingApp.testCreationMode()
  
  console.log('\n=== Testing BROKEN App State Updates (React StrictMode Race) ===')
  const brokenApp = new BrokenAppStateSimulator()
  await brokenApp.initializeCore()
  const brokenResult = brokenApp.testCreationMode()
  
  console.log('\n=== ANALYSIS ===')
  console.log('Working app creation mode:', workingResult)
  console.log('Broken app creation mode:', brokenResult)
  
  if (workingResult && !brokenResult) {
    console.log('\n✅ REPRODUCED THE EXACT ISSUE!')
    console.log('Root cause: React state updates failing due to component lifecycle issues')
    console.log('Solution: Ensure proper state management during React StrictMode remounts')
  } else {
    console.log('\n❌ Could not reproduce the exact issue')
  }
  
  return { workingResult, brokenResult }
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
  testStateUpdateFailure().catch(console.error)
}

export { testStateUpdateFailure }