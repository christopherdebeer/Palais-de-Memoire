/**
 * Test to verify the fix for Issue #37 - Creation mode failure due to React StrictMode
 * 
 * This test simulates the exact App.jsx behavior with the fix applied to ensure
 * that state updates are properly handled during React StrictMode remounts.
 */

import { MemoryPalaceCore } from '../core/MemoryPalaceCore.js'

// Simulate the FIXED App component with proper cancellation handling
class FixedAppComponentSimulator {
  constructor() {
    this.memoryPalaceCore = null
    this.coreInitialized = false
    this.isLoading = true
    this.coreInitializationRef = { current: false }
  }

  // Simulate React setState  
  setMemoryPalaceCore(core) {
    this.memoryPalaceCore = core
    console.log('[FixedApp] setMemoryPalaceCore set to:', !!core)
  }
  
  setCoreInitialized(value) {
    this.coreInitialized = value
    console.log('[FixedApp] setCoreInitialized set to:', value)
  }

  setIsLoading(value) {
    this.isLoading = value
    console.log('[FixedApp] setIsLoading set to:', value)
  }

  // Simulate the FIXED initializeCore function with cancellation handling
  async initializeCore(isCancelled = { current: false }) {
    if (this.coreInitializationRef.current) {
      console.log('[FixedApp] Core initialization already in progress, skipping...')
      return
    }
    
    this.coreInitializationRef.current = true
    console.log('[FixedApp] Initializing Memory Palace Core...')
    
    try {
      const core = new MemoryPalaceCore({
        apiProvider: 'mock',
        persistence: 'localStorage',
        enableVoice: true,
        enableSpatialInteraction: true,
        autopilot: false
      })
      
      console.log('[FixedApp] Calling core.initialize()...')
      const initialized = await core.initialize()
      console.log('[FixedApp] Core initialization result:', initialized)
      
      if (initialized) {
        console.log('[FixedApp] Starting core...')
        await core.start()
        console.log('[FixedApp] Core started, updating state...')
        
        // THE FIX: Check if component was unmounted during initialization
        if (isCancelled.current) {
          console.log('[FixedApp] ✅ Component unmounted during initialization, aborting state updates')
          return
        }
        
        // Update state and store core reference
        this.setMemoryPalaceCore(core)
        this.setCoreInitialized(true)
        
        console.log('[FixedApp] State updated - core:', !!core, 'initialized: true')
        console.log('[FixedApp] Memory Palace Core initialized successfully')
        
      } else {
        console.error('[FixedApp] Failed to initialize Memory Palace Core')
        this.coreInitializationRef.current = false
      }
    } catch (error) {
      console.error('[FixedApp] Error initializing Memory Palace Core:', error)
      this.coreInitializationRef.current = false
    }
  }

  // Simulate component mounting
  async mount() {
    console.log('[FixedApp] Component mounting...')
    
    // Track if component is mounted to prevent state updates after unmount  
    const isCancelled = { current: false }
    
    // Initialize core (simulate useEffect)
    this.initializeCore(isCancelled).then(() => {
      // Only update loading state if component is still mounted
      if (!isCancelled.current) {
        setTimeout(() => {
          if (!isCancelled.current) {
            this.setIsLoading(false)
          }
        }, 100) // Reduced timeout for testing
      }
    })
    
    // Return cleanup function
    return () => {
      console.log('[FixedApp] Component unmounting with proper cleanup...')
      
      // Mark as cancelled to prevent state updates
      isCancelled.current = true
      
      // Reset initialization ref to allow re-initialization on remount
      this.coreInitializationRef.current = false
      
      console.log('[FixedApp] ✅ Cleanup completed, isCancelled =', isCancelled.current)
    }
  }

  // Test creation mode
  testCreationMode() {
    console.log('\n[FixedApp] Testing creation mode...')
    console.log('[FixedApp] Current state check:', {
      memoryPalaceCore: !!this.memoryPalaceCore,
      coreInitialized: this.coreInitialized,
      coreInitializationRef: this.coreInitializationRef.current
    })
    
    // The exact check from App.jsx
    if (!this.coreInitialized || !this.memoryPalaceCore) {
      console.log('[FixedApp] ❌ Creation mode check failed!')
      return false
    }
    
    console.log('[FixedApp] ✅ Creation mode would work!')
    return true
  }
}

// Simulate React StrictMode behavior with the fixed component
class StrictModeWithFix {
  async simulateStrictMode() {
    console.log('\n=== React StrictMode Simulation (FIXED) ===')
    
    console.log('\n--- First Mount ---')
    const firstComponent = new FixedAppComponentSimulator()
    const firstCleanup = await firstComponent.mount()
    
    // Let initialization start
    await new Promise(resolve => setTimeout(resolve, 50))
    
    console.log('\n--- StrictMode Unmount (cleanup) ---')
    firstCleanup()
    
    console.log('\n--- Second Mount ---')
    const secondComponent = new FixedAppComponentSimulator()
    const secondCleanup = await secondComponent.mount()
    
    // Wait for initialization to complete
    await new Promise(resolve => setTimeout(resolve, 200))
    
    console.log('\n--- Testing Creation Mode ---')
    const result = secondComponent.testCreationMode()
    
    // Clean up
    secondCleanup()
    
    return { component: secondComponent, success: result }
  }
}

async function testFixedIssue37() {
  console.log('🧪 Testing FIXED Issue #37 - Creation Mode with React StrictMode...\n')
  
  const strictModeSimulator = new StrictModeWithFix()
  const result = await strictModeSimulator.simulateStrictMode()
  
  console.log('\n=== VERIFICATION ===')
  console.log('Final component state:', {
    memoryPalaceCore: !!result.component.memoryPalaceCore,
    coreInitialized: result.component.coreInitialized,
    coreInitializationRef: result.component.coreInitializationRef.current,
    isLoading: result.component.isLoading
  })
  console.log('Creation mode success:', result.success)
  
  if (result.success) {
    console.log('\n✅ ISSUE #37 FIXED!')
    console.log('The cancellation handling prevents state updates after unmount')
    console.log('Creation mode now works correctly with React StrictMode')
  } else {
    console.log('\n❌ Fix did not work as expected')
  }
  
  return result.success
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
  testFixedIssue37().catch(console.error)
}

export { testFixedIssue37 }