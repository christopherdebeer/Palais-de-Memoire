/**
 * Mobile Motion Controller
 * Handles device orientation and motion for camera control
 */

export class MobileMotionController {
  constructor(onRotationChange) {
    this.onRotationChange = onRotationChange
    this.isEnabled = false
    this.isCalibrated = false
    this.hasPermission = false
    
    // Calibration values
    this.calibrationAlpha = 0
    this.calibrationBeta = 0
    this.calibrationGamma = 0
    
    // Current orientation
    this.currentAlpha = 0
    this.currentBeta = 0
    this.currentGamma = 0
    
    // Settings
    this.sensitivity = 0.5
    this.smoothing = 0.8
    this.deadZone = 2 // degrees
    
    // Smoothed values
    this.smoothedYaw = 0
    this.smoothedPitch = 0
    
    // Bind methods
    this.handleDeviceOrientation = this.handleDeviceOrientation.bind(this)
    this.handleDeviceMotion = this.handleDeviceMotion.bind(this)
  }

  /**
   * Check if device motion is supported
   */
  isSupported() {
    return 'DeviceOrientationEvent' in window && 'DeviceMotionEvent' in window
  }

  /**
   * Request permission for device motion (iOS 13+)
   */
  async requestPermission() {
    console.log('[MobileMotionController] Requesting device motion permission...')
    
    if (!this.isSupported()) {
      console.warn('[MobileMotionController] Device motion not supported')
      return false
    }

    try {
      // Check if permission is required (iOS 13+)
      if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        console.log('[MobileMotionController] iOS 13+ detected, requesting permission')
        
        const permission = await DeviceOrientationEvent.requestPermission()
        console.log('[MobileMotionController] Permission result:', permission)
        
        if (permission === 'granted') {
          this.hasPermission = true
          return true
        } else {
          console.warn('[MobileMotionController] Permission denied')
          return false
        }
      } else {
        // Android or older iOS - no permission required
        console.log('[MobileMotionController] No permission required for this device')
        this.hasPermission = true
        return true
      }
    } catch (error) {
      console.error('[MobileMotionController] Error requesting permission:', error)
      return false
    }
  }

  /**
   * Enable motion control
   */
  async enable() {
    console.log('[MobileMotionController] Enabling motion control...')
    
    if (!this.isSupported()) {
      console.warn('[MobileMotionController] Device motion not supported')
      return false
    }

    if (!this.hasPermission) {
      const granted = await this.requestPermission()
      if (!granted) {
        console.warn('[MobileMotionController] Permission not granted')
        return false
      }
    }

    this.isEnabled = true
    
    // Add event listeners
    window.addEventListener('deviceorientation', this.handleDeviceOrientation, true)
    window.addEventListener('devicemotion', this.handleDeviceMotion, true)
    
    console.log('[MobileMotionController] Motion control enabled')
    return true
  }

  /**
   * Disable motion control
   */
  disable() {
    console.log('[MobileMotionController] Disabling motion control...')
    
    this.isEnabled = false
    this.isCalibrated = false
    
    // Remove event listeners
    window.removeEventListener('deviceorientation', this.handleDeviceOrientation, true)
    window.removeEventListener('devicemotion', this.handleDeviceMotion, true)
    
    console.log('[MobileMotionController] Motion control disabled')
  }

  /**
   * Calibrate the device orientation
   */
  calibrate() {
    console.log('[MobileMotionController] Calibrating device orientation...')
    
    this.calibrationAlpha = this.currentAlpha
    this.calibrationBeta = this.currentBeta
    this.calibrationGamma = this.currentGamma
    
    this.isCalibrated = true
    
    console.log('[MobileMotionController] Calibration complete:', {
      alpha: this.calibrationAlpha,
      beta: this.calibrationBeta,
      gamma: this.calibrationGamma
    })
  }

  /**
   * Handle device orientation events
   */
  handleDeviceOrientation(event) {
    if (!this.isEnabled) return

    // Store raw values
    this.currentAlpha = event.alpha || 0
    this.currentBeta = event.beta || 0
    this.currentGamma = event.gamma || 0

    // Auto-calibrate on first reading
    if (!this.isCalibrated) {
      this.calibrate()
      return
    }

    // Calculate relative rotation from calibration
    let deltaAlpha = this.currentAlpha - this.calibrationAlpha
    let deltaBeta = this.currentBeta - this.calibrationBeta
    let deltaGamma = this.currentGamma - this.calibrationGamma

    // Handle alpha wraparound (0-360 degrees)
    if (deltaAlpha > 180) deltaAlpha -= 360
    if (deltaAlpha < -180) deltaAlpha += 360

    // Apply dead zone
    if (Math.abs(deltaAlpha) < this.deadZone) deltaAlpha = 0
    if (Math.abs(deltaBeta) < this.deadZone) deltaBeta = 0
    if (Math.abs(deltaGamma) < this.deadZone) deltaGamma = 0

    // Convert to camera rotation
    // Alpha = compass heading (yaw)
    // Beta = front-to-back tilt (pitch)
    // Gamma = left-to-right tilt (roll - not used for camera)
    
    let targetYaw = -deltaAlpha * this.sensitivity
    let targetPitch = deltaBeta * this.sensitivity

    // Constrain rotation ranges (matching MemoryPalace constraints)
    targetYaw = Math.max(-135, Math.min(135, targetYaw))
    targetPitch = Math.max(-85, Math.min(85, targetPitch))

    // Apply smoothing
    this.smoothedYaw = this.smoothedYaw * this.smoothing + targetYaw * (1 - this.smoothing)
    this.smoothedPitch = this.smoothedPitch * this.smoothing + targetPitch * (1 - this.smoothing)

    // Notify callback
    if (this.onRotationChange) {
      this.onRotationChange({
        yaw: this.smoothedYaw,
        pitch: this.smoothedPitch,
        raw: {
          alpha: this.currentAlpha,
          beta: this.currentBeta,
          gamma: this.currentGamma
        },
        delta: {
          alpha: deltaAlpha,
          beta: deltaBeta,
          gamma: deltaGamma
        }
      })
    }
  }

  /**
   * Handle device motion events (for additional data)
   */
  handleDeviceMotion(event) {
    if (!this.isEnabled) return

    // Could be used for additional motion data like acceleration
    // For now, we primarily use orientation data
    
    // Log motion data for debugging (throttled)
    if (Math.random() < 0.01) { // Log ~1% of events
      console.log('[MobileMotionController] Motion data:', {
        acceleration: event.acceleration,
        rotationRate: event.rotationRate,
        interval: event.interval
      })
    }
  }

  /**
   * Update sensitivity setting
   */
  setSensitivity(value) {
    this.sensitivity = Math.max(0.1, Math.min(2.0, value))
    console.log('[MobileMotionController] Sensitivity updated:', this.sensitivity)
  }

  /**
   * Update smoothing setting
   */
  setSmoothing(value) {
    this.smoothing = Math.max(0.0, Math.min(0.95, value))
    console.log('[MobileMotionController] Smoothing updated:', this.smoothing)
  }

  /**
   * Update dead zone setting
   */
  setDeadZone(value) {
    this.deadZone = Math.max(0, Math.min(10, value))
    console.log('[MobileMotionController] Dead zone updated:', this.deadZone)
  }

  /**
   * Get current status
   */
  getStatus() {
    return {
      isSupported: this.isSupported(),
      hasPermission: this.hasPermission,
      isEnabled: this.isEnabled,
      isCalibrated: this.isCalibrated,
      sensitivity: this.sensitivity,
      smoothing: this.smoothing,
      deadZone: this.deadZone,
      currentRotation: {
        yaw: this.smoothedYaw,
        pitch: this.smoothedPitch
      }
    }
  }

  /**
   * Reset calibration and smoothed values
   */
  reset() {
    console.log('[MobileMotionController] Resetting controller state...')
    
    this.isCalibrated = false
    this.smoothedYaw = 0
    this.smoothedPitch = 0
    this.calibrationAlpha = 0
    this.calibrationBeta = 0
    this.calibrationGamma = 0
    
    console.log('[MobileMotionController] Controller state reset')
  }

  /**
   * Cleanup resources
   */
  dispose() {
    console.log('[MobileMotionController] Disposing controller...')
    
    this.disable()
    this.onRotationChange = null
    
    console.log('[MobileMotionController] Controller disposed')
  }
}

export default MobileMotionController
