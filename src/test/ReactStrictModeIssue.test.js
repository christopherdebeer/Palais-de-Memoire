/**
 * Test to reproduce the React StrictMode issue causing creation mode failure
 * 
 * React StrictMode deliberately double-mounts components in development to catch
 * side effects. This can cause issues with refs that aren't properly cleaned up.
 */

import { MemoryPalaceCore } from '../core/MemoryPalaceCore.js'

// Simulate React StrictMode behavior
class ReactStrictModeSimulator {
  constructor() {
    this.components = []
  }

  // Simulate React StrictMode double-mounting behavior
  async mountComponent(ComponentClass) {
    console.log('\n=== React StrictMode: First Mount ===')
    const firstInstance = new ComponentClass()
    this.components.push(firstInstance)
    
    // First mount - initialize
    await firstInstance.mount()
    
    console.log('\n=== React StrictMode: Unmount (cleanup) ===')
    // StrictMode unmounts to test cleanup
    await firstInstance.unmount()
    
    console.log('\n=== React StrictMode: Second Mount ===')
    // StrictMode remounts to test proper re-initialization
    const secondInstance = new ComponentClass()
    this.components.push(secondInstance)
    
    await secondInstance.mount()
    
    return secondInstance
  }
}

// Mock App component that simulates the actual App.jsx behavior
class MockReactAppComponent {
  constructor() {
    // State
    this.memoryPalaceCore = null
    this.coreInitialized = false
    this.isLoading = true
    
    // Ref - this persists across unmounts in React StrictMode
    this.coreInitializationRef = { current: false }
  }

  async mount() {
    console.log('[MockReactApp] Component mounting...')
    
    // Simulate useEffect for core initialization
    await this.initializeCore()
    
    // Simulate loading timeout
    setTimeout(() => {
      this.isLoading = false
      console.log('[MockReactApp] Loading complete')
    }, 1000)
  }

  async unmount() {
    console.log('[MockReactApp] Component unmounting...')
    
    // In React, refs persist across unmounts, but state gets reset
    // This is the KEY ISSUE: the ref stays true but state resets
    console.log('[MockReactApp] Before unmount - ref:', this.coreInitializationRef.current)
    
    // Reset state (like React does)
    this.memoryPalaceCore = null
    this.coreInitialized = false
    this.isLoading = true
    
    console.log('[MockReactApp] After unmount - ref still:', this.coreInitializationRef.current)
    console.log('[MockReactApp] State reset, but ref persists!')
  }

  async initializeCore() {
    console.log('[MockReactApp] initializeCore called')
    console.log('[MockReactApp] Current ref state:', this.coreInitializationRef.current)
    
    if (this.coreInitializationRef.current) {
      console.log('[MockReactApp] ❌ Core initialization already in progress, skipping...')
      console.log('[MockReactApp] This is the bug! Ref stayed true from previous mount')
      return
    }
    
    this.coreInitializationRef.current = true
    console.log('[MockReactApp] Set coreInitializationRef.current = true')
    
    try {
      const core = new MemoryPalaceCore({
        apiProvider: 'mock',
        persistence: 'localStorage',
        enableVoice: true,
        enableSpatialInteraction: true,
        autopilot: false
      })
      
      console.log('[MockReactApp] Calling core.initialize()...')
      const initialized = await core.initialize()
      console.log('[MockReactApp] Core initialization result:', initialized)
      
      if (initialized) {
        console.log('[MockReactApp] Starting core...')
        await core.start()
        
        console.log('[MockReactApp] Setting state: memoryPalaceCore and coreInitialized')
        this.memoryPalaceCore = core
        this.coreInitialized = true
        
        console.log('[MockReactApp] ✅ Core setup complete')
      } else {
        console.log('[MockReactApp] ❌ Initialization failed')
        this.coreInitializationRef.current = false
      }
    } catch (error) {
      console.error('[MockReactApp] Error during initialization:', error.message)
      this.coreInitializationRef.current = false
    }
  }

  // Test creation mode
  testCreationMode() {
    console.log('\n[MockReactApp] Testing creation mode...')
    console.log('[MockReactApp] Current state:', {
      memoryPalaceCore: !!this.memoryPalaceCore,
      coreInitialized: this.coreInitialized,
      coreInitializationRef: this.coreInitializationRef.current
    })
    
    // The problematic check
    if (!this.coreInitialized || !this.memoryPalaceCore) {
      console.log('[MockReactApp] ❌ Creation mode check failed!')
      console.log('[MockReactApp] This reproduces the exact bug from issue #37')
      return false
    }
    
    console.log('[MockReactApp] ✅ Creation mode would work')
    return true
  }
}

// Fixed version with proper cleanup
class FixedMockReactAppComponent extends MockReactAppComponent {
  async unmount() {
    console.log('[FixedMockReactApp] Component unmounting with proper cleanup...')
    
    // FIX: Reset the ref during unmount to allow re-initialization
    this.coreInitializationRef.current = false
    console.log('[FixedMockReactApp] Reset coreInitializationRef.current = false')
    
    // Reset state (like React does)
    this.memoryPalaceCore = null
    this.coreInitialized = false
    this.isLoading = true
    
    console.log('[FixedMockReactApp] ✅ Proper cleanup completed')
  }
}

async function testReactStrictModeIssue() {
  console.log('🧪 Testing React StrictMode Issue #37...\n')
  
  const simulator = new ReactStrictModeSimulator()
  
  console.log('=== Testing BROKEN version (current App.jsx) ===')
  const brokenApp = await simulator.mountComponent(MockReactAppComponent)
  const brokenResult = brokenApp.testCreationMode()
  
  console.log('\n=== Testing FIXED version (with proper cleanup) ===')
  const fixedApp = await simulator.mountComponent(FixedMockReactAppComponent)  
  const fixedResult = fixedApp.testCreationMode()
  
  console.log('\n=== ANALYSIS ===')
  console.log('Broken app creation mode:', brokenResult)
  console.log('Fixed app creation mode:', fixedResult)
  
  if (!brokenResult && fixedResult) {
    console.log('\n✅ ISSUE REPRODUCED AND SOLUTION IDENTIFIED!')
    console.log('The problem: coreInitializationRef persists across React StrictMode remounts')
    console.log('The solution: Reset ref in useEffect cleanup function')
  } else {
    console.log('\n❌ Could not reproduce the issue')
  }
  
  return { brokenResult, fixedResult }
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
  testReactStrictModeIssue().catch(console.error)
}

export { testReactStrictModeIssue }