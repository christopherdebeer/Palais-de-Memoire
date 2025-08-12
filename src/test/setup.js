import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock Three.js module completely
vi.mock('three', () => {
  const createMockClass = (name) => {
    return class MockThreeClass {
      constructor(...args) {
        if (args.length > 0 && typeof args[0] === 'object') {
          Object.assign(this, args[0])
        }
        this.position = { x: 0, y: 0, z: 0, set: () => {} }
        this.rotation = { x: 0, y: 0, z: 0, set: () => {} }
        this.children = []
        this.domElement = document.createElement('canvas')
        this.shadowMap = { enabled: false, type: null }
        this.userData = {}
      }
      
      add() { return this }
      remove() { return this }
      dispose() { return this }
      updateProjectionMatrix() { return this }
      setSize() { return this }
      render() { return this }
      lookAt() { return this }
    }
  }

  return {
    Scene: createMockClass('Scene'),
    Color: createMockClass('Color'),
    PerspectiveCamera: createMockClass('PerspectiveCamera'),
    WebGLRenderer: createMockClass('WebGLRenderer'),
    AmbientLight: createMockClass('AmbientLight'),
    DirectionalLight: createMockClass('DirectionalLight'),
    PlaneGeometry: createMockClass('PlaneGeometry'),
    BoxGeometry: createMockClass('BoxGeometry'),
    MeshLambertMaterial: createMockClass('MeshLambertMaterial'),
    MeshBasicMaterial: createMockClass('MeshBasicMaterial'),
    Mesh: createMockClass('Mesh'),
    PCFSoftShadowMap: 1,
    MathUtils: {
      degToRad: (degrees) => degrees * Math.PI / 180
    }
  }
})

// Mock WebGL context for Three.js tests
class WebGLRenderingContext {}
global.WebGLRenderingContext = WebGLRenderingContext

// Mock Three.js WebGL context
Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
  value: (contextType) => {
    if (contextType === 'webgl' || contextType === 'webgl2') {
      return {
        getExtension: () => null,
        getParameter: () => null,
        createShader: () => null,
        shaderSource: () => null,
        compileShader: () => null,
        createProgram: () => null,
        attachShader: () => null,
        linkProgram: () => null,
        useProgram: () => null,
        createBuffer: () => null,
        bindBuffer: () => null,
        bufferData: () => null,
        enableVertexAttribArray: () => null,
        vertexAttribPointer: () => null,
        drawArrays: () => null,
        viewport: () => null,
        clearColor: () => null,
        clear: () => null,
        enable: () => null,
        disable: () => null,
        depthFunc: () => null,
        blendFunc: () => null,
        getUniformLocation: () => null,
        uniform1i: () => null,
        uniform1f: () => null,
        uniform2f: () => null,
        uniform3f: () => null,
        uniform4f: () => null,
        uniformMatrix4fv: () => null,
        canvas: document.createElement('canvas')
      }
    }
    return null
  },
  writable: true
})

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {}
  })
})

// Mock AudioContext for voice interface tests
global.AudioContext = class AudioContext {
  constructor() {
    this.state = 'suspended'
    this.sampleRate = 44100
    this.destination = {}
    this.listener = {}
  }
  
  createAnalyser() {
    return {
      connect: () => {},
      disconnect: () => {},
      frequencyBinCount: 1024,
      getByteFrequencyData: () => {},
      getByteTimeDomainData: () => {}
    }
  }
  
  createGain() {
    return {
      connect: () => {},
      disconnect: () => {},
      gain: { value: 1 }
    }
  }
  
  createMediaStreamSource() {
    return {
      connect: () => {},
      disconnect: () => {}
    }
  }
  
  resume() {
    return Promise.resolve()
  }
  
  close() {
    return Promise.resolve()
  }
}

global.webkitAudioContext = global.AudioContext

// Mock navigator.mediaDevices
Object.defineProperty(navigator, 'mediaDevices', {
  writable: true,
  value: {
    getUserMedia: () => Promise.resolve({
      getTracks: () => [],
      getVideoTracks: () => [],
      getAudioTracks: () => []
    })
  }
})

// Suppress console warnings for tests
const originalConsoleWarn = console.warn
console.warn = (...args) => {
  // Suppress Three.js and other expected warnings in tests
  const message = args[0]
  if (
    typeof message === 'string' && (
      message.includes('THREE.WebGLRenderer') ||
      message.includes('WebGL') ||
      message.includes('canvas') ||
      message.includes('MediaDevices')
    )
  ) {
    return
  }
  originalConsoleWarn.apply(console, args)
}