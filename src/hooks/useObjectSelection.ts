import React, { useRef, useCallback } from 'react';
import * as THREE from 'three';

interface ObjectSelectionHookReturn {
  objectMarkersRef: React.MutableRefObject<Map<string, THREE.Object3D>>;
  offScreenIndicatorsRef: React.MutableRefObject<Map<string, HTMLElement>>;
  updateObjectMarkers: (objects: any[]) => void;
  updateObjectIndicators: (objects: any[]) => void;
  cleanupObjectSelection: () => void;
}

export const useObjectSelection = (
  sceneRef: React.MutableRefObject<THREE.Scene | null>,
  particleManagerRef: React.MutableRefObject<any>,
  selectedObjectId: string | null,
  onObjectSelected?: (object: any) => void
): ObjectSelectionHookReturn => {
  const objectMarkersRef = useRef<Map<string, THREE.Object3D>>(new Map());
  const offScreenIndicatorsRef = useRef<Map<string, HTMLElement>>(new Map());

  const updateObjectMarkers = useCallback((objects: any[]) => {
    if (!sceneRef.current || !particleManagerRef.current) {
      console.warn('[useObjectSelection] Scene or particle manager not ready for marker updates');
      return;
    }

    console.log(`[useObjectSelection] Updating object markers for ${objects.length} objects`);

    // Get current markers
    const currentMarkers = objectMarkersRef.current;
    const newObjectIds = new Set(objects.map(obj => obj.id));

    // Remove markers for objects that no longer exist
    for (const [objectId, marker] of currentMarkers.entries()) {
      if (!newObjectIds.has(objectId)) {
        console.log(`[useObjectSelection] Removing marker for deleted object: ${objectId}`);
        sceneRef.current.remove(marker);
        
        // Dispose geometry and materials
        marker.traverse((child: THREE.Object3D) => {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose();
            if (Array.isArray(child.material)) {
              child.material.forEach((material: any) => material.dispose());
            } else {
              child.material.dispose();
            }
          }
        });
        
        currentMarkers.delete(objectId);
      }
    }

    // Add or update markers for current objects
    objects.forEach((object) => {
      const existingMarker = currentMarkers.get(object.id);
      
      if (existingMarker) {
        // Update existing marker position
        if (object.position) {
          existingMarker.position.set(
            object.position.x || 0,
            object.position.y || 0, 
            object.position.z || 0
          );
        }
        
        // Update selection state
        const isSelected = selectedObjectId === object.id;
        existingMarker.traverse((child: THREE.Object3D) => {
          if (child instanceof THREE.Mesh) {
            if (Array.isArray(child.material)) {
              child.material.forEach((material: any) => {
                if ('color' in material) {
                  (material as any).color.setHex(isSelected ? 0xff0000 : 0x00ff00);
                }
              });
            } else if ('color' in child.material) {
              (child.material as any).color.setHex(isSelected ? 0xff0000 : 0x00ff00);
            }
          }
        });
      } else {
        // Create new marker
        console.log(`[useObjectSelection] Creating marker for object: ${object.id}`);
        
        const markerGroup = new THREE.Group();
        
        // Create marker sphere
        const markerGeometry = new THREE.SphereGeometry(1.5, 16, 16);
        const isSelected = selectedObjectId === object.id;
        const markerMaterial = new THREE.MeshBasicMaterial({ 
          color: isSelected ? 0xff0000 : 0x00ff00,
          transparent: true,
          opacity: 0.8
        });
        
        const markerSphere = new THREE.Mesh(markerGeometry, markerMaterial);
        markerGroup.add(markerSphere);
        
        // Create pulsing animation
        const pulseAnimation = () => {
          const time = Date.now() * 0.005;
          const scale = 1 + Math.sin(time) * 0.2;
          markerSphere.scale.setScalar(scale);
        };
        
        // Store animation function for cleanup
        (markerGroup as any)._pulseAnimation = pulseAnimation;
        
        // Position the marker
        if (object.position) {
          markerGroup.position.set(
            object.position.x || 0,
            object.position.y || 0,
            object.position.z || 0
          );
        }
        
        // Store object data
        markerGroup.userData = {
          objectId: object.id,
          objectData: object,
          type: 'object_marker'
        };
        
        // Add click handler
        const handleMarkerClick = () => {
          if (onObjectSelected) {
            onObjectSelected(object);
          }
        };
        
        (markerGroup as any)._clickHandler = handleMarkerClick;
        
        // Add to scene and store reference
        if (sceneRef.current) {
          sceneRef.current.add(markerGroup);
        }
        currentMarkers.set(object.id, markerGroup);
      }
    });

    console.log(`[useObjectSelection] Object markers updated: ${currentMarkers.size} total markers`);
  }, [sceneRef, particleManagerRef, selectedObjectId, onObjectSelected]);

  const updateObjectIndicators = useCallback((objects: any[]) => {
    console.log(`[useObjectSelection] Updating off-screen indicators for ${objects.length} objects`);

    // Clear existing indicators
    const currentIndicators = offScreenIndicatorsRef.current;
    currentIndicators.forEach((indicator: HTMLElement) => {
      if (indicator.parentNode) {
        indicator.parentNode.removeChild(indicator);
      }
    });
    currentIndicators.clear();

    // Create new indicators for objects
    objects.forEach((object) => {
      if (!object.position) return;

      const indicator = document.createElement('div');
      indicator.className = 'off-screen-indicator';
      indicator.style.cssText = `
        position: fixed;
        width: 20px;
        height: 20px;
        background: ${selectedObjectId === object.id ? '#ff0000' : '#00ff00'};
        border: 2px solid white;
        border-radius: 50%;
        z-index: 1000;
        pointer-events: auto;
        cursor: pointer;
        opacity: 0;
        transition: opacity 0.3s ease;
      `;
      
      // Add click handler
      indicator.addEventListener('click', () => {
        if (onObjectSelected) {
          onObjectSelected(object);
        }
      });
      
      // Add tooltip
      indicator.title = object.name || `Object ${object.id}`;
      
      document.body.appendChild(indicator);
      currentIndicators.set(object.id, indicator);
    });

    console.log(`[useObjectSelection] Created ${currentIndicators.size} off-screen indicators`);
  }, [selectedObjectId, onObjectSelected]);

  const cleanupObjectSelection = useCallback(() => {
    console.log('[useObjectSelection] Cleaning up object selection');

    // Remove all markers from scene
    const currentMarkers = objectMarkersRef.current;
    if (sceneRef.current) {
      currentMarkers.forEach((marker: THREE.Object3D) => {
        sceneRef.current?.remove(marker);
        
        // Dispose geometry and materials
        marker.traverse((child: THREE.Object3D) => {
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
    currentMarkers.clear();

    // Remove all off-screen indicators
    const currentIndicators = offScreenIndicatorsRef.current;
    currentIndicators.forEach((indicator: HTMLElement) => {
      if (indicator.parentNode) {
        indicator.parentNode.removeChild(indicator);
      }
    });
    currentIndicators.clear();
  }, [sceneRef]);

  return {
    objectMarkersRef,
    offScreenIndicatorsRef,
    updateObjectMarkers,
    updateObjectIndicators,
    cleanupObjectSelection
  };
};