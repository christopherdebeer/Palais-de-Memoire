import React, { useRef, useState, useCallback } from 'react';
import * as THREE from 'three';

interface PaintModeHookReturn {
  paintCanvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
  paintTextureRef: React.MutableRefObject<THREE.CanvasTexture | null>;
  paintContextRef: React.MutableRefObject<CanvasRenderingContext2D | null>;
  paintedGroups: Map<string, any>;
  setPaintedGroups: React.Dispatch<React.SetStateAction<Map<string, any>>>;
  paintModeEnabledRef: React.MutableRefObject<boolean>;
  paintInitializedRef: React.MutableRefObject<boolean>;
  initializePaintCanvas: () => void;
  enablePaintMode: () => void;
  disablePaintMode: () => void;
  createPaintedObjectGroup: (spherePositions: THREE.Vector3[], paintType: string, aiObjectProperties?: any) => void;
  cleanupPaintMode: () => void;
}

export const usePaintMode = (
  paintModeEnabled: boolean,
  paintModeType: string,
  skyboxMaterialRef: React.MutableRefObject<THREE.MeshBasicMaterial | null>,
  sceneRef: React.MutableRefObject<THREE.Scene | null>,
  onPaintedObjectCreated?: (group: any) => void,
  onPaintedAreasChange?: (areas: Map<string, any>) => void
): PaintModeHookReturn => {
  const paintCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const paintTextureRef = useRef<THREE.CanvasTexture | null>(null);
  const paintContextRef = useRef<CanvasRenderingContext2D | null>(null);
  const [paintedGroups, setPaintedGroups] = useState<Map<string, any>>(new Map());
  const paintModeEnabledRef = useRef<boolean>(paintModeEnabled);
  const paintInitializedRef = useRef<boolean>(false);

  const initializePaintCanvas = useCallback(() => {
    if (paintCanvasRef.current || paintInitializedRef.current) return;
    
    paintInitializedRef.current = true;
    console.log('[usePaintMode] Initializing paint canvas system');
    
    // Create canvas for painting - high resolution for detail
    const canvas = document.createElement('canvas');
    canvas.width = 4096;
    canvas.height = 2048;
    
    const context = canvas.getContext('2d');
    if (!context) return;
    
    // Initialize with transparent base
    context.fillStyle = 'rgba(0, 0, 0, 0)';
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    // Add subtle grid pattern for debugging
    context.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    context.lineWidth = 2;
    
    const gridSpacing = 200;
    for (let x = 0; x < canvas.width; x += gridSpacing) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, canvas.height);
      context.stroke();
    }
    for (let y = 0; y < canvas.height; y += gridSpacing) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(canvas.width, y);
      context.stroke();
    }
    
    // Store references
    paintCanvasRef.current = canvas;
    paintContextRef.current = context;
    
    // Create Three.js texture from canvas
    const paintTexture = new THREE.CanvasTexture(canvas);
    paintTexture.mapping = THREE.EquirectangularReflectionMapping;
    paintTexture.wrapS = THREE.RepeatWrapping;
    paintTexture.wrapT = THREE.ClampToEdgeWrapping;
    paintTexture.offset.x = 0.5;
    paintTexture.needsUpdate = true;
    
    paintTextureRef.current = paintTexture;
    
    console.log('[usePaintMode] Paint canvas system initialized');
  }, []);

  const enablePaintMode = useCallback(() => {
    console.log('[usePaintMode] Enabling paint mode');
    initializePaintCanvas();
    
    if (paintTextureRef.current && skyboxMaterialRef.current) {
      // Create overlay material that combines skybox with paint overlay
      const overlayMaterial = skyboxMaterialRef.current.clone();
      
      // Set up alpha blending for paint overlay
      overlayMaterial.transparent = true;
      overlayMaterial.opacity = 1.0;
      
      // If there's already a base texture, we'll need to composite
      if (skyboxMaterialRef.current.map) {
        // For now, just use the paint texture as an overlay
        // TODO: Implement proper texture compositing
        console.log('[usePaintMode] Paint overlay enabled over existing texture');
      } else {
        // No base texture, use paint texture directly
        overlayMaterial.map = paintTextureRef.current;
        overlayMaterial.needsUpdate = true;
      }
      
      skyboxMaterialRef.current.copy(overlayMaterial);
    }
  }, [initializePaintCanvas, skyboxMaterialRef]);

  const disablePaintMode = useCallback(() => {
    console.log('[usePaintMode] Disabling paint mode');
    
    if (skyboxMaterialRef.current && paintTextureRef.current) {
      // Remove paint overlay, restore original skybox texture
      skyboxMaterialRef.current.transparent = false;
      skyboxMaterialRef.current.opacity = 1.0;
      
      // Clear the paint texture from material if it was set
      if (skyboxMaterialRef.current.map === paintTextureRef.current) {
        skyboxMaterialRef.current.map = null;
        skyboxMaterialRef.current.needsUpdate = true;
      }
    }
  }, [skyboxMaterialRef]);

  const createPaintedObjectGroup = useCallback((
    spherePositions: THREE.Vector3[], 
    paintType: string, 
    aiObjectProperties?: any
  ) => {
    if (!sceneRef.current || spherePositions.length === 0) return;

    console.log(`[usePaintMode] Creating painted object group with ${spherePositions.length} spheres`);

    // Create a group to hold all the painted spheres
    const group = new THREE.Group();
    group.userData = {
      type: 'painted_object_group',
      paintType,
      createdAt: Date.now(),
      sphereCount: spherePositions.length,
      aiObjectProperties: aiObjectProperties || null
    };

    // Add spheres to the group
    spherePositions.forEach((position, index) => {
      const sphereGeometry = new THREE.SphereGeometry(2, 16, 16);
      
      // Use different colors based on paint type
      let sphereColor = 0xff0000; // Default red
      if (paintType === 'objects') sphereColor = 0x00ff00; // Green for objects
      if (paintType === 'navigation') sphereColor = 0x0000ff; // Blue for navigation
      
      const sphereMaterial = new THREE.MeshBasicMaterial({ 
        color: sphereColor,
        transparent: true,
        opacity: 0.8
      });
      
      const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
      sphere.position.copy(position);
      sphere.userData = {
        type: 'paint_sphere',
        paintType,
        index,
        groupId: group.uuid
      };
      
      group.add(sphere);
    });

    // Add group to scene
    sceneRef.current.add(group);

    // Store in painted groups map
    const newGroups = new Map<string, any>(paintedGroups);
    newGroups.set(group.uuid, {
      group,
      paintType,
      sphereCount: spherePositions.length,
      createdAt: Date.now(),
      aiObjectProperties
    });
    
    setPaintedGroups(newGroups);

    // Notify callbacks
    if (onPaintedObjectCreated) {
      onPaintedObjectCreated(group);
    }
    
    if (onPaintedAreasChange) {
      onPaintedAreasChange(newGroups);
    }

    console.log(`[usePaintMode] Created painted object group: ${group.uuid}`);
    return group;
  }, [sceneRef, paintedGroups, setPaintedGroups, onPaintedObjectCreated, onPaintedAreasChange]);

  const cleanupPaintMode = useCallback(() => {
    console.log('[usePaintMode] Cleaning up paint mode');

    // Remove all painted groups from scene
    if (sceneRef.current) {
      paintedGroups.forEach((groupData: any) => {
        sceneRef.current?.remove(groupData.group);
        groupData.group.traverse((child: THREE.Object3D) => {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose();
            if (Array.isArray(child.material)) {
              child.material.forEach((material: any) => material.dispose());
            } else {
              child.material.dispose();
            }
          }
        });
      });
    }

    // Dispose paint texture
    if (paintTextureRef.current) {
      paintTextureRef.current.dispose();
      paintTextureRef.current = null;
    }

    // Clear canvas references
    paintCanvasRef.current = null;
    paintContextRef.current = null;
    setPaintedGroups(new Map());
    paintInitializedRef.current = false;
  }, [sceneRef, paintedGroups]);

  return {
    paintCanvasRef,
    paintTextureRef,
    paintContextRef,
    paintedGroups,
    setPaintedGroups,
    paintModeEnabledRef,
    paintInitializedRef,
    initializePaintCanvas,
    enablePaintMode,
    disablePaintMode,
    createPaintedObjectGroup,
    cleanupPaintMode
  };
};