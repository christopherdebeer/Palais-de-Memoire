import React, { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import * as THREE from 'three';

interface ThreeJSRendererProps {
  wireframeEnabled: boolean;
  currentRoom: any;
  onMount: (refs: {
    scene: THREE.Scene;
    renderer: THREE.WebGLRenderer;
    camera: THREE.PerspectiveCamera;
    wireframeSphere: THREE.Mesh;
    skyboxSphere: THREE.Mesh;
    skyboxMaterial: THREE.MeshBasicMaterial;
  }) => void;
}

interface ThreeJSRendererRef {
  cleanup: () => void;
  updateSkyboxForRoom: (room: any) => void;
}

const ThreeJSRenderer = forwardRef<ThreeJSRendererRef, ThreeJSRendererProps>(
  ({ wireframeEnabled, currentRoom, onMount }, ref) => {
    const mountRef = useRef<HTMLDivElement>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const wireframeSphereRef = useRef<THREE.Mesh | null>(null);
    const skyboxSphereRef = useRef<THREE.Mesh | null>(null);
    const skyboxMaterialRef = useRef<THREE.MeshBasicMaterial | null>(null);

    const initialize3DScene = () => {
      if (!mountRef.current) return;

      console.log('[ThreeJSRenderer] Initializing 3D scene');

      // Create scene
      const scene = new THREE.Scene();
      sceneRef.current = scene;

      // Create camera
      const camera = new THREE.PerspectiveCamera(
        75, // Default FOV
        mountRef.current.clientWidth / mountRef.current.clientHeight,
        0.1,
        1000
      );
      camera.position.set(0, 0, 0);
      cameraRef.current = camera;

      // Create renderer
      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
      renderer.setClearColor(0x000000);
      rendererRef.current = renderer;

      // Append renderer to DOM
      mountRef.current.appendChild(renderer.domElement);

      // Create skybox sphere (inside-out sphere for 360 view)
      const skyboxGeometry = new THREE.SphereGeometry(500, 60, 40);
      skyboxGeometry.scale(-1, 1, 1); // Invert normals for inside view

      const skyboxMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x000000,
        side: THREE.BackSide
      });
      skyboxMaterialRef.current = skyboxMaterial;

      const skyboxSphere = new THREE.Mesh(skyboxGeometry, skyboxMaterial);
      skyboxSphereRef.current = skyboxSphere;
      scene.add(skyboxSphere);

      // Create wireframe sphere
      const wireframeGeometry = new THREE.SphereGeometry(500, 32, 16);
      const wireframeMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x00ff00, 
        wireframe: true,
        transparent: true,
        opacity: 0.3
      });
      const wireframeSphere = new THREE.Mesh(wireframeGeometry, wireframeMaterial);
      wireframeSphere.visible = wireframeEnabled;
      wireframeSphereRef.current = wireframeSphere;
      scene.add(wireframeSphere);

      // Load default texture if not in wireframe mode
      if (!wireframeEnabled) {
        loadDefaultTexture();
      }

      // Call onMount with refs
      onMount({
        scene,
        renderer,
        camera,
        wireframeSphere,
        skyboxSphere,
        skyboxMaterial
      });

      console.log('[ThreeJSRenderer] 3D scene initialized successfully');
    };

    const loadDefaultTexture = () => {
      const textureLoader = new THREE.TextureLoader();
      const localSkyboxPath = '/default_skybox.png';
      
      textureLoader.load(
        localSkyboxPath,
        (texture) => {
          console.log('[ThreeJSRenderer] Default texture loaded successfully');
          texture.mapping = THREE.EquirectangularReflectionMapping;
          texture.wrapS = THREE.RepeatWrapping;
          texture.wrapT = THREE.ClampToEdgeWrapping;
          texture.offset.x = 0.5; // 180° offset for coordinate alignment
          
          if (skyboxMaterialRef.current) {
            skyboxMaterialRef.current.map = texture;
            skyboxMaterialRef.current.color.setHex(0xffffff);
            skyboxMaterialRef.current.needsUpdate = true;
          }
          
          if (wireframeSphereRef.current) {
            wireframeSphereRef.current.visible = false;
          }
        },
        undefined,
        (error) => {
          console.warn('[ThreeJSRenderer] Local texture failed, trying remote:', error);
          // Fallback to remote texture
          textureLoader.load(
            'https://page-images.websim.com/Create_a_360_degree_equirectangular_panoramic_image_in_21_9_aspect_ratio_showing__scene_____TECHNICA_694056a68c0178.jpg',
            (texture) => {
              console.log('[ThreeJSRenderer] Remote texture loaded successfully');
              texture.mapping = THREE.EquirectangularReflectionMapping;
              texture.wrapS = THREE.RepeatWrapping;
              texture.wrapT = THREE.ClampToEdgeWrapping;
              texture.offset.x = 0.5;
              
              if (skyboxMaterialRef.current) {
                skyboxMaterialRef.current.map = texture;
                skyboxMaterialRef.current.color.setHex(0xffffff);
                skyboxMaterialRef.current.needsUpdate = true;
              }
              
              if (wireframeSphereRef.current) {
                wireframeSphereRef.current.visible = false;
              }
            },
            undefined,
            (remoteError) => {
              console.error('[ThreeJSRenderer] Both textures failed:', remoteError);
            }
          );
        }
      );
    };

    const updateSkyboxForRoom = (room: any) => {
      if (!room || !skyboxMaterialRef.current) return;

      console.log('[ThreeJSRenderer] Updating skybox for room:', room);
      
      // If room has a skybox image, load it
      if (room.skybox_image_url) {
        const textureLoader = new THREE.TextureLoader();
        
        textureLoader.load(
          room.skybox_image_url,
          (texture) => {
            console.log('[ThreeJSRenderer] Room texture loaded successfully');
            texture.mapping = THREE.EquirectangularReflectionMapping;
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.ClampToEdgeWrapping;
            texture.offset.x = 0.5;
            
            if (skyboxMaterialRef.current) {
              // Dispose old texture
              if (skyboxMaterialRef.current.map) {
                skyboxMaterialRef.current.map.dispose();
              }
              
              skyboxMaterialRef.current.map = texture;
              skyboxMaterialRef.current.color.setHex(0xffffff);
              skyboxMaterialRef.current.needsUpdate = true;
            }
          },
          undefined,
          (error) => {
            console.error('[ThreeJSRenderer] Failed to load room texture:', error);
            // Fallback to default
            loadDefaultTexture();
          }
        );
      } else {
        // No room image, load default
        loadDefaultTexture();
      }
    };

    const cleanup = () => {
      console.log('[ThreeJSRenderer] Cleaning up 3D scene');

      // Clean up renderer
      if (rendererRef.current && mountRef.current) {
        mountRef.current.removeChild(rendererRef.current.domElement);
        rendererRef.current.dispose();
        rendererRef.current = null;
      }

      // Clean up textures
      if (skyboxMaterialRef.current?.map) {
        skyboxMaterialRef.current.map.dispose();
        skyboxMaterialRef.current.map = null;
      }

      // Clear references
      sceneRef.current = null;
      cameraRef.current = null;
      wireframeSphereRef.current = null;
      skyboxSphereRef.current = null;
      skyboxMaterialRef.current = null;
    };

    // Initialize scene on mount
    useEffect(() => {
      initialize3DScene();
      return cleanup;
    }, []);

    // Handle wireframe toggle
    useEffect(() => {
      if (wireframeSphereRef.current) {
        wireframeSphereRef.current.visible = wireframeEnabled;
      }

      // Handle texture loading/unloading based on wireframe state
      if (!wireframeEnabled && skyboxMaterialRef.current) {
        // Switching to textured mode - load textures if not already loaded
        if (!skyboxMaterialRef.current.map) {
          console.log('[ThreeJSRenderer] Switching to textured mode, loading textures');
          loadDefaultTexture();
        }
      } else if (wireframeEnabled && skyboxMaterialRef.current) {
        // Switching to wireframe mode - clear textures to save memory
        console.log('[ThreeJSRenderer] Switching to wireframe mode, disposing textures');
        if (skyboxMaterialRef.current.map) {
          skyboxMaterialRef.current.map.dispose();
          skyboxMaterialRef.current.map = null;
          skyboxMaterialRef.current.color.setHex(0x000000); // Black background for wireframe
          skyboxMaterialRef.current.needsUpdate = true;
        }
      }
    }, [wireframeEnabled]);

    // Handle room changes
    useEffect(() => {
      if (currentRoom) {
        updateSkyboxForRoom(currentRoom);
      }
    }, [currentRoom]);

    // Handle window resize
    useEffect(() => {
      const handleResize = () => {
        if (!mountRef.current || !cameraRef.current || !rendererRef.current) return;

        const width = mountRef.current.clientWidth;
        const height = mountRef.current.clientHeight;

        cameraRef.current.aspect = width / height;
        cameraRef.current.updateProjectionMatrix();
        
        rendererRef.current.setSize(width, height);
      };

      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }, []);

    useImperativeHandle(ref, () => ({
      cleanup,
      updateSkyboxForRoom
    }), []);

    return <div ref={mountRef} className="threejs-renderer" style={{ width: '100%', height: '100%' }} />;
  }
);

ThreeJSRenderer.displayName = 'ThreeJSRenderer';

export default ThreeJSRenderer;