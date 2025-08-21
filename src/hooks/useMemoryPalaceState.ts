import React, { useRef, useCallback } from 'react';
import * as THREE from 'three';
import SettingsManager from '../services/SettingsManager';
import SimpleParticleManager from '../utils/SimpleParticleManager';

interface CameraRotation {
  yaw: number;
  pitch: number;
}

interface MemoryPalaceStateHookReturn {
  cameraRotationRef: React.MutableRefObject<CameraRotation>;
  animationFrameRef: React.MutableRefObject<number | null>;
  settingsManagerRef: React.MutableRefObject<SettingsManager>;
  particleManagerRef: React.MutableRefObject<SimpleParticleManager | null>;
  updateCameraFov: (fov: number) => void;
  startAnimationLoop: (renderCallback: () => void) => void;
  stopAnimationLoop: () => void;
  cleanupState: () => void;
}

export const useMemoryPalaceState = (
  cameraRef: React.MutableRefObject<THREE.PerspectiveCamera | null>,
  sceneRef: React.MutableRefObject<THREE.Scene | null>,
  rendererRef: React.MutableRefObject<THREE.WebGLRenderer | null>
): MemoryPalaceStateHookReturn => {
  const cameraRotationRef = useRef<CameraRotation>({ yaw: 0, pitch: 0 });
  const animationFrameRef = useRef<number | null>(null);
  const settingsManagerRef = useRef<SettingsManager>(new SettingsManager());
  const particleManagerRef = useRef<SimpleParticleManager | null>(null);

  const updateCameraFov = useCallback((fov: number) => {
    if (!cameraRef.current) return;
    
    console.log(`[useMemoryPalaceState] Updating camera FOV to: ${fov}`);
    cameraRef.current.fov = fov;
    cameraRef.current.updateProjectionMatrix();
  }, [cameraRef]);

  const startAnimationLoop = useCallback((renderCallback: () => void) => {
    if (animationFrameRef.current) {
      console.warn('[useMemoryPalaceState] Animation loop already running');
      return;
    }

    console.log('[useMemoryPalaceState] Starting animation loop');
    
    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);
      
      // Update particle system if it exists
      if (particleManagerRef.current) {
        particleManagerRef.current.updateParticleSystems();
      }
      
      // Apply camera rotation
      if (cameraRef.current) {
        const rotation = cameraRotationRef.current;
        cameraRef.current.rotation.order = 'YXZ';
        cameraRef.current.rotation.y = rotation.yaw;
        cameraRef.current.rotation.x = rotation.pitch;
      }
      
      // Execute custom render callback
      renderCallback();
      
      // Render scene
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };
    
    animate();
  }, [cameraRef, sceneRef, rendererRef, particleManagerRef]);

  const stopAnimationLoop = useCallback(() => {
    if (animationFrameRef.current) {
      console.log('[useMemoryPalaceState] Stopping animation loop');
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  const initializeParticleManager = useCallback(() => {
    if (!sceneRef.current) {
      console.warn('[useMemoryPalaceState] Cannot initialize particle manager - no scene');
      return;
    }

    if (particleManagerRef.current) {
      console.log('[useMemoryPalaceState] Particle manager already initialized');
      return;
    }

    console.log('[useMemoryPalaceState] Initializing particle manager');
    
    try {
      const particleManager = new SimpleParticleManager();
      particleManagerRef.current = particleManager;
      console.log('[useMemoryPalaceState] Particle manager initialized successfully');
    } catch (error) {
      console.error('[useMemoryPalaceState] Failed to initialize particle manager:', error);
    }
  }, [sceneRef]);

  const cleanupState = useCallback(() => {
    console.log('[useMemoryPalaceState] Cleaning up state');
    
    // Stop animation loop
    stopAnimationLoop();
    
    // Cleanup particle manager
    if (particleManagerRef.current) {
      console.log('[useMemoryPalaceState] Disposing particle manager');
      if (typeof particleManagerRef.current.dispose === 'function') {
        particleManagerRef.current.dispose();
      }
      particleManagerRef.current = null;
    }
    
    // Reset camera rotation
    cameraRotationRef.current = { yaw: 0, pitch: 0 };
  }, [stopAnimationLoop]);

  // Initialize particle manager when scene is available
  const initializeParticleManagerIfNeeded = useCallback(() => {
    if (sceneRef.current && !particleManagerRef.current) {
      initializeParticleManager();
    }
  }, [initializeParticleManager, sceneRef]);

  return {
    cameraRotationRef,
    animationFrameRef,
    settingsManagerRef,
    particleManagerRef: {
      ...particleManagerRef,
      // Add a getter that auto-initializes
      get current() {
        initializeParticleManagerIfNeeded();
        return particleManagerRef.current;
      },
      set current(value) {
        particleManagerRef.current = value;
      }
    } as any,
    updateCameraFov,
    startAnimationLoop,
    stopAnimationLoop,
    cleanupState
  };
};