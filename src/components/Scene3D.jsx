import React, { useEffect, useRef } from 'react'
import * as THREE from 'three'

/**
 * Scene3D - Simplified Three.js scene component
 * Direct Three.js integration following prototype patterns
 */
export default function Scene3D({ 
  objects = [],
  onObjectClick,
  wireframeEnabled = false,
  currentRoom,
  onPositionUpdate
}) {
  const mountRef = useRef(null)
  const sceneRef = useRef(null)
  const rendererRef = useRef(null)
  const cameraRef = useRef(null)
  const objectMeshes = useRef(new Map())
  
  // Mouse interaction state (following prototype pattern)
  const mouseRef = useRef({
    isUserInteracting: false,
    onPointerDownMouseX: 0,
    onPointerDownMouseY: 0,
    lon: -90,
    onPointerDownLon: 0,
    lat: 0,
    onPointerDownLat: 0,
    phi: 0,
    theta: 0
  })

  // Initialize Three.js scene
  useEffect(() => {
    if (!mountRef.current) return

    // Create scene
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x101030)
    sceneRef.current = scene

    // Create camera
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
    camera.position.set(0, 1.6, 0) // Human height
    cameraRef.current = camera

    // Create renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    rendererRef.current = renderer

    // Add basic lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6)
    scene.add(ambientLight)

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
    directionalLight.position.set(50, 50, 50)
    directionalLight.castShadow = true
    scene.add(directionalLight)

    // Create room environment (simple floor and walls)
    createRoomEnvironment(scene)

    // Mount renderer
    mountRef.current.appendChild(renderer.domElement)

    // Setup mouse controls
    setupMouseControls(renderer.domElement)

    // Start render loop
    const animate = () => {
      updateCamera()
      renderer.render(scene, camera)
      requestAnimationFrame(animate)
    }
    animate()

    // Handle window resize
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
    }
    window.addEventListener('resize', handleResize)

    // Cleanup
    return () => {
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement)
      }
      window.removeEventListener('resize', handleResize)
      renderer.dispose()
    }
  }, [])

  // Update objects in scene
  useEffect(() => {
    if (!sceneRef.current) return

    // Clear existing object meshes
    objectMeshes.current.forEach(mesh => {
      sceneRef.current.remove(mesh)
    })
    objectMeshes.current.clear()

    // Add new objects
    objects.forEach(object => {
      const mesh = createObjectMesh(object)
      sceneRef.current.add(mesh)
      objectMeshes.current.set(object.id, mesh)
    })
  }, [objects])

  // Update wireframe mode
  useEffect(() => {
    objectMeshes.current.forEach(mesh => {
      if (mesh.material) {
        mesh.material.wireframe = wireframeEnabled
      }
    })
  }, [wireframeEnabled])

  function createRoomEnvironment(scene) {
    // Simple floor
    const floorGeometry = new THREE.PlaneGeometry(20, 20)
    const floorMaterial = new THREE.MeshLambertMaterial({ 
      color: 0x333333,
      transparent: true,
      opacity: 0.8
    })
    const floor = new THREE.Mesh(floorGeometry, floorMaterial)
    floor.rotation.x = -Math.PI / 2
    floor.receiveShadow = true
    scene.add(floor)

    // Simple walls (wireframe for now)
    const wallMaterial = new THREE.MeshBasicMaterial({ 
      color: 0x666666,
      wireframe: true,
      opacity: 0.3,
      transparent: true
    })

    // Back wall
    const backWall = new THREE.Mesh(new THREE.PlaneGeometry(20, 10), wallMaterial)
    backWall.position.set(0, 5, -10)
    scene.add(backWall)

    // Side walls
    const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(20, 10), wallMaterial)
    leftWall.rotation.y = Math.PI / 2
    leftWall.position.set(-10, 5, 0)
    scene.add(leftWall)

    const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(20, 10), wallMaterial)
    rightWall.rotation.y = -Math.PI / 2
    rightWall.position.set(10, 5, 0)
    scene.add(rightWall)
  }

  function createObjectMesh(object) {
    // Simple cube for now (can be enhanced based on object type)
    const geometry = new THREE.BoxGeometry(1, 1, 1)
    const material = new THREE.MeshLambertMaterial({ 
      color: Math.random() * 0xffffff,
      transparent: true,
      opacity: 0.8
    })
    
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.set(object.position.x, object.position.y, object.position.z)
    mesh.castShadow = true
    mesh.receiveShadow = true
    
    // Store object data for click handling
    mesh.userData = { objectId: object.id, object }
    
    return mesh
  }

  function setupMouseControls(element) {
    const mouse = mouseRef.current

    element.addEventListener('pointerdown', onPointerDown)
    element.addEventListener('pointermove', onPointerMove)
    element.addEventListener('pointerup', onPointerUp)
    element.addEventListener('wheel', onWheel)

    function onPointerDown(event) {
      mouse.isUserInteracting = true
      mouse.onPointerDownMouseX = event.clientX
      mouse.onPointerDownMouseY = event.clientY
      mouse.onPointerDownLon = mouse.lon
      mouse.onPointerDownLat = mouse.lat
      element.setPointerCapture(event.pointerId)
    }

    function onPointerMove(event) {
      if (mouse.isUserInteracting) {
        mouse.lon = (mouse.onPointerDownMouseX - event.clientX) * 0.1 + mouse.onPointerDownLon
        mouse.lat = (event.clientY - mouse.onPointerDownMouseY) * 0.1 + mouse.onPointerDownLat
      }
    }

    function onPointerUp(event) {
      mouse.isUserInteracting = false
      element.releasePointerCapture(event.pointerId)
    }

    function onWheel(event) {
      // Simple zoom (move camera forward/backward)
      const camera = cameraRef.current
      if (camera) {
        camera.position.z += event.deltaY * 0.01
        camera.position.z = Math.max(0.1, Math.min(10, camera.position.z))
      }
    }
  }

  function updateCamera() {
    const mouse = mouseRef.current
    const camera = cameraRef.current
    
    if (!camera) return

    // Smooth camera rotation following prototype pattern
    mouse.lat = Math.max(-85, Math.min(85, mouse.lat))
    mouse.phi = THREE.MathUtils.degToRad(90 - mouse.lat)
    mouse.theta = THREE.MathUtils.degToRad(mouse.lon)

    camera.lookAt(
      Math.sin(mouse.phi) * Math.cos(mouse.theta),
      Math.cos(mouse.phi),
      Math.sin(mouse.phi) * Math.sin(mouse.theta)
    )

    // Notify parent of camera changes
    if (onPositionUpdate) {
      onPositionUpdate({
        position: camera.position,
        rotation: { yaw: mouse.lon, pitch: mouse.lat }
      })
    }
  }

  return <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
}