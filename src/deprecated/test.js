/**
 * Basic test script for the Memory Palace Core
 * Tests core functionality without external dependencies
 */

import { MemoryPalaceCore, setupMemoryPalace } from './index.js'

async function runTests() {
  console.log('🧪 Testing Memory Palace Core...\n')

  try {
    // Test 1: Core initialization
    console.log('1️⃣ Testing core initialization...')
    const core = new MemoryPalaceCore({
      apiProvider: 'mock',
      persistence: 'localStorage'
    })

    const initSuccess = await core.initialize()
    if (!initSuccess) {
      throw new Error('Initialization failed')
    }
    console.log('✅ Core initialized successfully')

    // Test 2: Start system
    console.log('\n2️⃣ Testing system startup...')
    const startSuccess = await core.start()
    if (!startSuccess) {
      throw new Error('Startup failed')
    }
    console.log('✅ System started successfully')

    // Test 3: Create a room
    console.log('\n3️⃣ Testing room creation...')
    const room = await core.createRoom('Test Library', 'A cozy library with wooden shelves and warm lighting')
    if (!room || !room.id) {
      throw new Error('Room creation failed')
    }
    console.log(`✅ Room created: "${room.name}" (ID: ${room.id})`)

    // Test 4: Add an object
    console.log('\n4️⃣ Testing object creation...')
    const object = await core.addObject('Red Book', 'Contains important memories about my childhood')
    if (!object || !object.id) {
      throw new Error('Object creation failed')
    }
    console.log(`✅ Object created: "${object.name}" (ID: ${object.id})`)

    // Test 5: Process natural language input
    console.log('\n5️⃣ Testing natural language processing...')
    const result = await core.processInput('Describe the current room')
    if (!result || !result.success) {
      throw new Error('Input processing failed')
    }
    console.log(`✅ Input processed: "${result.response}"`)

    // Test 6: Spatial interaction
    console.log('\n6️⃣ Testing spatial interaction...')
    const spatialResult = await core.processSpatialInteraction(0.5, 0.3, 'click')
    if (!spatialResult || !spatialResult.success) {
      throw new Error('Spatial interaction failed')
    }
    console.log(`✅ Spatial interaction: "${spatialResult.response}"`)

    // Test 7: State retrieval
    console.log('\n7️⃣ Testing state retrieval...')
    const state = core.getCurrentState()
    if (!state || !state.stats) {
      throw new Error('State retrieval failed')
    }
    console.log(`✅ State retrieved - Rooms: ${state.stats.totalRooms}, Objects: ${state.stats.totalObjects}`)

    // Test 8: Export/Import
    console.log('\n8️⃣ Testing export/import...')
    const exportData = core.exportPalace()
    if (!exportData || !exportData.data) {
      throw new Error('Export failed')
    }
    
    const importSuccess = await core.importPalace(exportData)
    if (!importSuccess) {
      throw new Error('Import failed')
    }
    console.log('✅ Export/import successful')

    // Test 9: Settings management
    console.log('\n9️⃣ Testing settings management...')
    const settings = core.getSettings()
    const updatedSettings = await core.updateSettings({
      voice: { ...settings.voice, speechRate: 1.2 }
    })
    if (!updatedSettings || updatedSettings.voice.speechRate !== 1.2) {
      throw new Error('Settings update failed')
    }
    console.log('✅ Settings updated successfully')

    // Test 10: Error handling
    console.log('\n🔟 Testing error handling...')
    try {
      await core.navigateToRoom('nonexistent-room-id')
      throw new Error('Should have thrown an error for invalid room')
    } catch (error) {
      if (error.message.includes('not found')) {
        console.log('✅ Error handling works correctly')
      } else {
        throw error
      }
    }

    // Test 11: Cleanup
    console.log('\n🧹 Testing cleanup...')
    const stopSuccess = await core.stop()
    if (!stopSuccess) {
      throw new Error('Stop failed')
    }
    console.log('✅ System stopped successfully')

    console.log('\n🎉 All tests passed! Memory Palace Core is working correctly.\n')

    // Performance summary
    const metrics = core.getMetrics()
    console.log('📊 Performance Metrics:')
    console.log(`   - Initialization time: ${metrics.initTime.toFixed(2)}ms`)
    console.log(`   - Commands processed: ${metrics.commandsProcessed}`)
    console.log(`   - Rooms created: ${metrics.roomsCreated}`)
    console.log(`   - Objects created: ${metrics.objectsCreated}`)
    console.log(`   - API calls performed: ${metrics.apiCallsPerformed}`)

  } catch (error) {
    console.error('\n❌ Test failed:', error.message)
    console.error('Stack trace:', error.stack)
    process.exit(1)
  }
}

// Test setup function
async function testSetupFunction() {
  console.log('\n🚀 Testing setup function...')
  
  try {
    const core = await setupMemoryPalace({
      autopilot: false
    })
    
    const state = core.getCurrentState()
    if (!state.isRunning) {
      throw new Error('Setup function did not start the system')
    }
    
    console.log('✅ Setup function works correctly')
    await core.stop()
    
  } catch (error) {
    console.error('❌ Setup function test failed:', error.message)
    throw error
  }
}

// Run all tests
async function main() {
  await runTests()
  await testSetupFunction()
  console.log('🏆 All tests completed successfully!')
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error)
}

export { runTests, testSetupFunction }