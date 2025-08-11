import React, { useRef, useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faMap, faCompass, faExpand, faCompress, faCrosshairs } from '@fortawesome/free-solid-svg-icons'

const Minimap = ({ 
  isVisible = true,
  objects = [],
  cameraRotation = { yaw: 0, pitch: 0 },
  onLookAt = null,
  onToggle = null,
  isCollapsed = false,
  position = { x: 20, y: 20 },
  onPositionChange = null
}) => {
  const canvasRef = useRef(null)
  const minimapRef = useRef(null)
  const [hoveredObject, setHoveredObject] = useState(null)
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })

  // Minimap dimensions
  const MINIMAP_SIZE = isCollapsed ? 120 : 200
  const ROOM_RADIUS = MINIMAP_SIZE * 0.4
  const CENTER_X = MINIMAP_SIZE / 2
  const CENTER_Y = MINIMAP_SIZE / 2

  useEffect(() => {
    if (!isVisible) return

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1

    // Set canvas size for high DPI displays
    canvas.width = MINIMAP_SIZE * dpr
    canvas.height = MINIMAP_SIZE * dpr
    canvas.style.width = `${MINIMAP_SIZE}px`
    canvas.style.height = `${MINIMAP_SIZE}px`
    ctx.scale(dpr, dpr)

    // Clear canvas
    ctx.clearRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE)

    // Draw room boundary (circle)
    ctx.strokeStyle = '#444444'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(CENTER_X, CENTER_Y, ROOM_RADIUS, 0, Math.PI * 2)
    ctx.stroke()

    // Fill room background
    ctx.fillStyle = 'rgba(26, 26, 46, 0.3)'
    ctx.fill()

    // Draw cardinal directions
    if (!isCollapsed) {
      ctx.fillStyle = '#666666'
      ctx.font = '12px Arial'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      
      // North
      ctx.fillText('N', CENTER_X, CENTER_Y - ROOM_RADIUS - 15)
      // South  
      ctx.fillText('S', CENTER_X, CENTER_Y + ROOM_RADIUS + 15)
      // East
      ctx.fillText('E', CENTER_X + ROOM_RADIUS + 15, CENTER_Y)
      // West
      ctx.fillText('W', CENTER_X - ROOM_RADIUS - 15, CENTER_Y)
    }

    // Draw distance rings
    if (!isCollapsed) {
      ctx.strokeStyle = 'rgba(68, 68, 68, 0.3)'
      ctx.lineWidth = 1
      for (let i = 1; i <= 3; i++) {
        const radius = (ROOM_RADIUS / 3) * i
        ctx.beginPath()
        ctx.arc(CENTER_X, CENTER_Y, radius, 0, Math.PI * 2)
        ctx.stroke()
      }
    }

    // Draw objects
    objects.forEach((obj, index) => {
      if (!obj.position) return

      // Convert 3D position to 2D minimap coordinates
      // Assuming the room is centered at origin and objects are positioned around it
      const scale = ROOM_RADIUS / 500 // Scale factor (500 is the skybox radius)
      const x = CENTER_X + (obj.position.x * scale)
      const y = CENTER_Y - (obj.position.z * scale) // Flip Z for top-down view

      // Check if object is within room bounds
      const distanceFromCenter = Math.sqrt(
        Math.pow(x - CENTER_X, 2) + Math.pow(y - CENTER_Y, 2)
      )
      
      if (distanceFromCenter <= ROOM_RADIUS) {
        // Determine object color based on type
        let color = '#4dabf7' // Default blue for objects
        if (obj.targetRoomId) {
          color = '#ffd700' // Gold for doors
        }

        // Draw object dot
        ctx.fillStyle = color
        ctx.beginPath()
        ctx.arc(x, y, isCollapsed ? 3 : 4, 0, Math.PI * 2)
        ctx.fill()

        // Add object outline
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 1
        ctx.stroke()

        // Draw object label (only if not collapsed and object is hovered)
        if (!isCollapsed && hoveredObject === index) {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'
          ctx.fillRect(x - 30, y - 25, 60, 15)
          
          ctx.fillStyle = '#ffffff'
          ctx.font = '10px Arial'
          ctx.textAlign = 'center'
          ctx.fillText(obj.name.substring(0, 12), x, y - 17)
        }
      }
    })

    // Draw camera direction indicator
    const cameraAngle = (cameraRotation.yaw * Math.PI) / 180
    const indicatorLength = isCollapsed ? 15 : 25
    const endX = CENTER_X + Math.cos(cameraAngle - Math.PI / 2) * indicatorLength
    const endY = CENTER_Y + Math.sin(cameraAngle - Math.PI / 2) * indicatorLength

    // Camera direction line
    ctx.strokeStyle = '#ff6600'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(CENTER_X, CENTER_Y)
    ctx.lineTo(endX, endY)
    ctx.stroke()

    // Camera position dot
    ctx.fillStyle = '#ff6600'
    ctx.beginPath()
    ctx.arc(CENTER_X, CENTER_Y, isCollapsed ? 3 : 4, 0, Math.PI * 2)
    ctx.fill()

    // Camera direction arrow
    if (!isCollapsed) {
      const arrowSize = 6
      const arrowAngle1 = cameraAngle - Math.PI / 2 + Math.PI / 6
      const arrowAngle2 = cameraAngle - Math.PI / 2 - Math.PI / 6
      
      ctx.beginPath()
      ctx.moveTo(endX, endY)
      ctx.lineTo(
        endX - Math.cos(arrowAngle1) * arrowSize,
        endY - Math.sin(arrowAngle1) * arrowSize
      )
      ctx.moveTo(endX, endY)
      ctx.lineTo(
        endX - Math.cos(arrowAngle2) * arrowSize,
        endY - Math.sin(arrowAngle2) * arrowSize
      )
      ctx.stroke()
    }

  }, [isVisible, objects, cameraRotation, isCollapsed, hoveredObject, MINIMAP_SIZE, ROOM_RADIUS])

  const handleCanvasClick = (event) => {
    if (!onLookAt) return

    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top

    // Convert click position to world coordinates
    const relativeX = (x - CENTER_X) / (ROOM_RADIUS / 500)
    const relativeZ = -(y - CENTER_Y) / (ROOM_RADIUS / 500) // Flip Z back

    // Calculate angle to look at this position
    const angle = Math.atan2(relativeZ, relativeX)
    const yaw = (angle * 180) / Math.PI + 90 // Convert to degrees and adjust

    onLookAt({ yaw, pitch: 0 })
  }

  const handleCanvasMouseMove = (event) => {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top

    setMousePosition({ x, y })

    // Check if hovering over an object
    let hoveredIndex = null
    objects.forEach((obj, index) => {
      if (!obj.position) return

      const scale = ROOM_RADIUS / 500
      const objX = CENTER_X + (obj.position.x * scale)
      const objY = CENTER_Y - (obj.position.z * scale)

      const distance = Math.sqrt(Math.pow(x - objX, 2) + Math.pow(y - objY, 2))
      if (distance <= 8) { // 8px hover radius
        hoveredIndex = index
      }
    })

    setHoveredObject(hoveredIndex)
  }

  const handleCanvasMouseLeave = () => {
    setHoveredObject(null)
  }

  // Drag handlers for minimap repositioning
  const handleHeaderMouseDown = (event) => {
    if (event.target.closest('.minimap-btn')) {
      // Don't start dragging if clicking on a button
      return
    }
    
    setIsDragging(true)
    const rect = minimapRef.current.getBoundingClientRect()
    setDragOffset({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    })
    event.preventDefault()
  }

  const handleMouseMove = (event) => {
    if (!isDragging || !onPositionChange) return

    const newX = event.clientX - dragOffset.x
    const newY = event.clientY - dragOffset.y

    // Keep minimap within viewport bounds
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const minimapWidth = isCollapsed ? 140 : 220
    const minimapHeight = isCollapsed ? 160 : 280

    const clampedX = Math.max(0, Math.min(newX, viewportWidth - minimapWidth))
    const clampedY = Math.max(0, Math.min(newY, viewportHeight - minimapHeight))

    onPositionChange({ x: clampedX, y: clampedY })
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  // Add global mouse event listeners for dragging
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = 'grabbing'
      document.body.style.userSelect = 'none'
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
    }
  }, [isDragging, dragOffset, onPositionChange, isCollapsed])

  if (!isVisible) return null

  return (
    <div 
      ref={minimapRef}
      className={`minimap ${isCollapsed ? 'collapsed' : 'expanded'} ${isDragging ? 'dragging' : ''}`}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`
      }}
    >
      <div 
        className="minimap-header"
        onMouseDown={handleHeaderMouseDown}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      >
        <div className="minimap-title">
          <FontAwesomeIcon icon={faMap} />
          {!isCollapsed && <span>Room Map</span>}
        </div>
        <div className="minimap-controls">
          {!isCollapsed && (
            <button
              className="minimap-btn"
              onClick={() => onLookAt && onLookAt({ yaw: 0, pitch: 0 })}
              title="Reset camera to center"
            >
              <FontAwesomeIcon icon={faCrosshairs} />
            </button>
          )}
          <button
            className="minimap-btn"
            onClick={onToggle}
            title={isCollapsed ? 'Expand minimap' : 'Collapse minimap'}
          >
            <FontAwesomeIcon icon={isCollapsed ? faExpand : faCompress} />
          </button>
        </div>
      </div>

      <div className="minimap-canvas-container">
        <canvas
          ref={canvasRef}
          className="minimap-canvas"
          onClick={handleCanvasClick}
          onMouseMove={handleCanvasMouseMove}
          onMouseLeave={handleCanvasMouseLeave}
          style={{ cursor: onLookAt ? 'crosshair' : 'default' }}
        />
        
        {!isCollapsed && hoveredObject !== null && objects[hoveredObject] && (
          <div 
            className="minimap-tooltip"
            style={{
              left: mousePosition.x + 10,
              top: mousePosition.y - 30
            }}
          >
            <div className="tooltip-name">{objects[hoveredObject].name}</div>
            <div className="tooltip-type">
              {objects[hoveredObject].targetRoomId ? 'Door' : 'Object'}
            </div>
          </div>
        )}
      </div>

      {!isCollapsed && (
        <div className="minimap-legend">
          <div className="legend-item">
            <div className="legend-dot object-dot"></div>
            <span>Objects</span>
          </div>
          <div className="legend-item">
            <div className="legend-dot door-dot"></div>
            <span>Doors</span>
          </div>
          <div className="legend-item">
            <div className="legend-dot camera-dot"></div>
            <span>You</span>
          </div>
        </div>
      )}
    </div>
  )
}

export default Minimap
