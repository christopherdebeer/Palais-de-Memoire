import { useRef, useCallback } from 'react'
import * as THREE from 'three'

export default function useCameraControls(cameraRef) {
  const cameraRotationRef = useRef({ yaw: 0, pitch: 0 })

  const applyRotation = useCallback((deltaX, deltaY) => {
    cameraRotationRef.current.yaw -= deltaX
    cameraRotationRef.current.pitch += deltaY

    cameraRotationRef.current.yaw = Math.max(-135, Math.min(135, cameraRotationRef.current.yaw))
    cameraRotationRef.current.pitch = Math.max(-85, Math.min(85, cameraRotationRef.current.pitch))

    if (cameraRef.current) {
      const phi = THREE.MathUtils.degToRad(90 - cameraRotationRef.current.pitch)
      const theta = THREE.MathUtils.degToRad(cameraRotationRef.current.yaw)
      const x = 500 * Math.sin(phi) * Math.cos(theta)
      const y = 500 * Math.cos(phi)
      const z = 500 * Math.sin(phi) * Math.sin(theta)
      cameraRef.current.lookAt(x, y, z)
    }
  }, [cameraRef])

  return { cameraRotationRef, applyRotation }
}
