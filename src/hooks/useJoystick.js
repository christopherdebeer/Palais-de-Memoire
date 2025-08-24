import { useRef, useEffect, useCallback } from 'react'
import nipplejs from 'nipplejs'

export default function useJoystick({ nippleEnabled, cameraRef, applyRotation }) {
  const nippleManagerRef = useRef(null)
  const nippleContainerRef = useRef(null)

  const cleanupNipple = useCallback(() => {
    if (nippleManagerRef.current) {
      nippleManagerRef.current.destroy()
      nippleManagerRef.current = null
    }
    if (nippleContainerRef.current) {
      document.body.removeChild(nippleContainerRef.current)
      nippleContainerRef.current = null
    }
  }, [])

  const initializeNipple = useCallback(() => {
    if (nippleManagerRef.current || !nippleEnabled) return

    if (!nippleContainerRef.current) {
      const container = document.createElement('div')
      container.className = 'nipple-container'
      document.body.appendChild(container)
      nippleContainerRef.current = container
    }

    const manager = nipplejs.create({
      zone: nippleContainerRef.current,
      mode: 'static',
      position: { left: '50%', top: '50%' },
      color: 'rgba(255, 255, 255, 0.8)',
      size: 100
    })

    nippleManagerRef.current = manager

    manager.on('move', (evt, data) => {
      const force = data.force
      const angle = data.angle.radian
      const rotationSpeed = 1000 * force
      const deltaX = Math.cos(angle) * rotationSpeed
      const deltaY = Math.sin(angle) * rotationSpeed
      applyRotation(deltaX, deltaY)
    })
  }, [nippleEnabled, applyRotation])

  useEffect(() => {
    if (nippleEnabled) {
      const timeout = setTimeout(initializeNipple, 100)
      return () => {
        clearTimeout(timeout)
        cleanupNipple()
      }
    } else {
      cleanupNipple()
    }
  }, [nippleEnabled, initializeNipple, cleanupNipple])

  return { initializeNipple, cleanupNipple }
}
