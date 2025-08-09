// Memory Palace Voice-First Application
import { WebsimSocket } from '@websim/websim-socket';
import * as THREE from 'three';
import { ParticleSystemManager } from './ParticleSystemManager.js';

// Initialize database connection
const room = new WebsimSocket();

class MemoryPalace {
    constructor() {
        // Initialize Eruda dev console
        this.initializeDevConsole();
        this.log('🏰 Memory Palace initializing...');
        
        this.rooms = new Map();
        this.currentRoomId = null;
        this.roomCounter = 0;
        this.objectCounter = 0;
        this.currentUser = null;
        
        // Three.js scene setup
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.sphere = null;
        this.isUserInteracting = false;
        this.onPointerDownMouseX = 0;
        this.onPointerDownMouseY = 0;
        this.lon = -90;
        this.onPointerDownLon = 0;
        this.lat = -90;
        this.onPointerDownLat = 0;
        this.phi = 0;
        this.theta = 0;
        
        // Initialize particle system manager
        this.particleManager = new ParticleSystemManager();
        
        // Voice recognition and synthesis setup
        this.recognition = null;
        this.synthesis = window.speechSynthesis;
        this.isListening = false;
        this.isProcessing = false;
        this.conversationContext = [];
        this.audioInitialized = false;
        
        // Autopilot mode
        this.isAutopilot = false;
        this.autopilotSteps = 0;
        this.maxAutopilotSteps = 5;
        this.autopilotPrompt = '';
        
        // Settings and preferences
        this.settings = this.loadSettings();
        this.availableVoices = [];
        
        this.initializeUI();
        this.initializeThreeJS();
        this.setupVoiceRecognition();
        this.setupEventListeners();
        this.loadVoices();
        
        // Initialize database and load user data
        this.initializeDatabase();
        
        this.log('✅ Memory Palace initialized successfully');
    }

    loadSettings() {
        const defaultSettings = {
            voice: '',
            speechRate: 0.9,
            speechPitch: 1.0,
            systemPrompt: `You are an AI assistant for a Memory Palace application. Users can create rooms, add memory objects, and navigate between rooms.

IMPORTANT: Start your response with exactly one of these commands:
- COMMAND:CREATE_ROOM - to create a new room
- COMMAND:EDIT_ROOM - to edit/update the current room description
- COMMAND:ADD_OBJECT - to add a memory object to current room  
- COMMAND:CREATE_DOOR - to create a door/connection to another room
- COMMAND:NAVIGATE - to move through an existing door to a different room
- COMMAND:DESCRIBE - to describe current room or objects
- COMMAND:LIST - to list available exits from current room
- COMMAND:CHAT - for general conversation

After the command, provide a natural conversational response.

SPATIAL PLACEMENT LOGIC:
When user describes something to place at a clicked location, determine if it should be:
1. ADD_OBJECT - for items, furniture, decorative elements, books, paintings, etc.
2. CREATE_DOOR - for doorways, passages, windows leading elsewhere, stairs, portals, etc.

Base decision on the description's nature:
- Objects are things you examine, interact with, or remember information about
- Doors are passages, openings, or connections that lead to other spaces

NAVIGATION INSTRUCTIONS:
When a user wants to navigate, you must decide between two actions:

1. COMMAND:NAVIGATE - Use existing door/connection
   - User describes going through a door that matches an existing door description
   - User mentions going to a room that's directly connected
   - Always include: CONNECTION_ID: [exact connection ID from available exits]

2. COMMAND:CREATE_DOOR - Create missing connection or new room
   - User describes a door/passage that could reasonably exist in the current room
   - User wants to go to a room that doesn't have a direct connection
   - User wants to go somewhere completely new
   - Include: DOOR_DESCRIPTION, TARGET_ROOM_NAME, TARGET_ROOM_DESCRIPTION

DECISION PROCESS:
1. Read the user's navigation request carefully
2. Compare it against existing door descriptions from current room
3. If user mentions a room name that appears in existing connections, use NAVIGATE
4. If user describes a door that matches existing door descriptions, use NAVIGATE
5. If user describes a door that could exist but has no connection, use CREATE_DOOR
6. If user wants to go somewhere completely new, use CREATE_DOOR

CONTEXT PROVIDED:
- Current room name and COMPLETE description
- ONLY doors that exist from current room with their descriptions and destinations
- You have NO knowledge of other rooms in the palace except connected room names

Your job is to intelligently match user intent to the right action using this complete context.

For CREATE_ROOM commands, include these details after your response:
ROOM_NAME: [room name]
ROOM_DESCRIPTION: [detailed room description for image generation]

For EDIT_ROOM commands, include:
ROOM_DESCRIPTION: [updated detailed room description for image generation]

For ADD_OBJECT commands, include:
OBJECT_NAME: [object name]
OBJECT_INFO: [information to remember]

For CREATE_DOOR commands, include:
DOOR_DESCRIPTION: [description of the door/entrance]
TARGET_ROOM_NAME: [name of new room to create] (if creating new room)
TARGET_ROOM_DESCRIPTION: [description of new room] (if creating new room)
TARGET_ROOM_ID: [existing room ID] (if connecting to existing room)

For NAVIGATE commands, include:
CONNECTION_ID: [exact connection ID from available exits]`,
            responseTemperature: 0.7,
            aestheticPrompt: 'Dark, pre-rendered graphics (myst style).'
        };

        try {
            const saved = localStorage.getItem('memoryPalaceSettings');
            if (saved) {
                return { ...defaultSettings, ...JSON.parse(saved) };
            }
        } catch (error) {
            this.error('Error loading settings:', error);
        }
        
        return defaultSettings;
    }

    saveSettings() {
        try {
            localStorage.setItem('memoryPalaceSettings', JSON.stringify(this.settings));
            this.log('💾 Settings saved to localStorage');
        } catch (error) {
            this.error('Error saving settings:', error);
        }
    }

    resetSettings() {
        try {
            localStorage.removeItem('memoryPalaceSettings');
            this.settings = this.loadSettings();
            this.updateSettingsUI();
            this.log('🔄 Settings reset to defaults');
        } catch (error) {
            this.error('Error resetting settings:', error);
        }
    }

    loadVoices() {
        const loadVoicesHandler = () => {
            this.availableVoices = this.synthesis.getVoices();
            this.log('🔊 Loaded voices:', this.availableVoices.length, this.availableVoices);
            this.updateVoiceSelect();
        };

        if (this.availableVoices.length === 0) {
            this.synthesis.addEventListener('voiceschanged', loadVoicesHandler);
        } else {
            loadVoicesHandler();
        }
    }

    updateVoiceSelect() {
        const voiceSelect = document.getElementById('voice-select');
        if (!voiceSelect) return;

        voiceSelect.innerHTML = '<option value="">Default Voice</option>';
        
        this.availableVoices.forEach((voice, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = `${voice.name} (${voice.lang})`;
            if (this.settings.voice == index) {
                option.selected = true;
            }
            voiceSelect.appendChild(option);
        });
    }

    updateSettingsUI() {
        document.getElementById('voice-select').value = this.settings.voice;
        document.getElementById('speech-rate').value = this.settings.speechRate;
        document.getElementById('rate-value').textContent = this.settings.speechRate;
        document.getElementById('speech-pitch').value = this.settings.speechPitch;
        document.getElementById('pitch-value').textContent = this.settings.speechPitch;
        document.getElementById('system-prompt').value = this.settings.systemPrompt;
        document.getElementById('response-temperature').value = this.settings.responseTemperature;
        document.getElementById('temperature-value').textContent = this.settings.responseTemperature;
        document.getElementById('aesthetic-prompt').value = this.settings.aestheticPrompt;
    }

    async initializeDatabase() {
        this.log('💾 Initializing database connection...');
        
        try {
            // Get current user
            this.currentUser = await window.websim.getCurrentUser();
            this.log('👤 Current user loaded:', this.currentUser.username);
            
            // Load user state and existing data
            await this.loadUserData();
            
        } catch (error) {
            this.error('Database initialization failed:', error);
            // Show welcome state if database fails
            this.showWelcomeState();
        }
    }

    async loadUserData() {
        this.log('📚 Loading user data from database...');
        
        try {
            // Load user state
            const userStates = await room.collection('user_state').filter({ id: this.currentUser.id }).getList();
            let userState = userStates[0];
            
            if (!userState) {
                // Create initial user state
                userState = await room.collection('user_state').upsert({
                    id: this.currentUser.id,
                    current_room_id: null,
                    room_counter: 0,
                    object_counter: 0
                });
                this.log('🆕 Created new user state');
            }
            
            this.roomCounter = userState.room_counter || 0;
            this.objectCounter = userState.object_counter || 0;
            
            // Load all rooms for this user
            const roomsData = await room.collection('rooms').filter({ user_id: this.currentUser.id }).getList();
            this.log('🏠 Loaded rooms from database:', roomsData.length);
            
            // Load all objects for this user
            const objectsData = await room.collection('objects').filter({ user_id: this.currentUser.id }).getList();
            this.log('📦 Loaded objects from database:', objectsData.length);
            
            // Load all connections for this user
            const connectionsData = await room.collection('connections').filter({ user_id: this.currentUser.id }).getList();
            this.log('🔗 Loaded connections from database:', connectionsData.length);
            
            // Reconstruct rooms map
            for (const roomData of roomsData) {
                const roomObj = {
                    id: roomData.id,
                    name: roomData.name,
                    description: roomData.description,
                    imageUrl: roomData.image_url,
                    objects: new Map(),
                    connections: new Map()
                };
                
                // Add objects to this room with 3D coordinates (including doors with targetRoomId)
                const roomObjects = objectsData.filter(obj => obj.room_id === roomData.id);
                for (const objData of roomObjects) {
                    const objectEntry = {
                        id: objData.id,
                        name: objData.name,
                        information: objData.information,
                        position: { 
                            x: objData.position_x, 
                            y: objData.position_y,
                            z: objData.position_z || 0 // Handle legacy objects without Z coordinate
                        }
                    };
                    
                    // Check if this object is actually a door (has target_room_id in information or name)
                    if (objData.information && objData.information.includes('Door leading to')) {
                        // Try to find the target room ID from connections
                        const matchingConnection = connectionsData.find(conn => 
                            conn.room_id === roomData.id && 
                            (conn.description === objData.name || 
                             objData.information.includes('another room') ||
                             objData.name.toLowerCase().includes('door'))
                        );
                        
                        if (matchingConnection) {
                            objectEntry.targetRoomId = matchingConnection.target_room_id;
                            this.log('🚪 Restored door object with targetRoomId:', objData.name, matchingConnection.target_room_id);
                        }
                    }
                    
                    roomObj.objects.set(objData.id, objectEntry);
                }
                
                // Add connections from this room
                const roomConnections = connectionsData.filter(conn => conn.room_id === roomData.id);
                for (const connData of roomConnections) {
                    roomObj.connections.set(connData.id, {
                        id: connData.id,
                        description: connData.description,
                        targetRoomId: connData.target_room_id,
                        bidirectional: connData.bidirectional
                    });
                }
                
                this.rooms.set(roomData.id, roomObj);
            }
            
            // Set current room if exists
            if (userState.current_room_id && this.rooms.has(userState.current_room_id)) {
                this.currentRoomId = userState.current_room_id;
                this.displayRoom(this.rooms.get(this.currentRoomId));
                this.log('🎯 Set current room:', userState.current_room_id);
            } else {
                this.showWelcomeState();
            }
            
        } catch (error) {
            this.error('Error loading user data:', error);
            this.showWelcomeState();
        }
    }

    async saveUserState() {
        try {
            await room.collection('user_state').upsert({
                id: this.currentUser.id,
                current_room_id: this.currentRoomId,
                room_counter: this.roomCounter,
                object_counter: this.objectCounter
            });
            this.log('💾 User state saved');
        } catch (error) {
            this.error('Error saving user state:', error);
        }
    }

    async saveRoom(roomObj) {
        try {
            await room.collection('rooms').upsert({
                id: roomObj.id,
                name: roomObj.name,
                description: roomObj.description,
                image_url: roomObj.imageUrl,
                room_counter: this.roomCounter
            });
            this.log('🏠 Room saved to database:', roomObj.id);
        } catch (error) {
            this.error('Error saving room:', error);
        }
    }

    async saveObject(roomId, objData) {
        try {
            await room.collection('objects').upsert({
                id: objData.id,
                room_id: roomId,
                name: objData.name,
                information: objData.information,
                position_x: objData.position.x,
                position_y: objData.position.y,
                position_z: objData.position.z || 0, // Add Z coordinate
                object_counter: this.objectCounter
            });
            this.log('📦 Object saved to database:', objData.id);
        } catch (error) {
            this.error('Error saving object:', error);
        }
    }

    async saveConnection(roomId, connData) {
        try {
            await room.collection('connections').upsert({
                id: connData.id,
                room_id: roomId,
                target_room_id: connData.targetRoomId,
                description: connData.description,
                bidirectional: connData.bidirectional
            });
            this.log('🔗 Connection saved to database:', connData.id);
        } catch (error) {
            this.error('Error saving connection:', error);
        }
    }

    initializeDevConsole() {
        if (typeof eruda !== 'undefined') {
            eruda.init();
            this.devConsole = console; // Eruda enhances native console
            this.log('🔧 Eruda dev console initialized');
        } else {
            // Fallback to regular console
            this.devConsole = console;
            this.log('⚠️ Eruda not available, using regular console');
        }
    }

    log(message, data = null) {
        const timestamp = new Date().toLocaleTimeString();
        const logMessage = `[${timestamp}] ${message}`;
        
        if (this.devConsole && this.devConsole.log) {
            if (data) {
                this.devConsole.log(logMessage, data);
            } else {
                this.devConsole.log(logMessage);
            }
        } else {
            console.log(logMessage, data);
        }
    }

    error(message, error = null) {
        const timestamp = new Date().toLocaleTimeString();
        const errorMessage = `[${timestamp}] ❌ ${message}`;
        
        if (this.devConsole && this.devConsole.error) {
            if (error) {
                this.devConsole.error(errorMessage, error);
            } else {
                this.devConsole.error(errorMessage);
            }
        } else {
            console.error(errorMessage, error);
        }
    }

    initializeUI() {
        // Main UI elements
        this.roomTitle = document.getElementById('room-title');
        this.roomImage = document.getElementById('room-image');
        this.imageOverlay = document.getElementById('image-overlay');
        this.roomCount = document.getElementById('room-count');
        this.objectCount = document.getElementById('object-count');
        
        // Voice and text interface
        this.voiceInputBtn = document.getElementById('voice-input-btn');
        this.voiceLabel = document.getElementById('voice-label');
        this.textInput = document.getElementById('text-input');
        this.sendTextBtn = document.getElementById('send-text-btn');
        this.voiceFeedback = document.getElementById('voice-feedback');
        this.listeningIndicator = document.getElementById('listening-indicator');
        this.responseText = document.getElementById('response-text');
        
        // Loading overlay
        this.loadingOverlay = document.getElementById('loading-overlay');
        this.loadingText = document.getElementById('loading-text');
        
        // Settings elements
        this.settingsPanel = document.getElementById('settings-panel');
        this.settingsMenuBtn = document.getElementById('settings-menu-btn');

        // Caption elements
        this.captionContainer = document.getElementById('caption-container');
        this.captionText = document.getElementById('caption-text');
        this.captionToggleBtn = document.getElementById('caption-toggle-btn');
        
        // Add caption state tracking
        this.captionMode = null; // 'recognition' or 'synthesis'
        this.captionsEnabled = this.loadCaptionPreference();
        this.updateCaptionToggleUI();
    }

    loadCaptionPreference() {
        try {
            const saved = localStorage.getItem('memoryCaptionsEnabled');
            return saved !== null ? JSON.parse(saved) : true; // Default to enabled
        } catch (error) {
            this.error('Error loading caption preference:', error);
            return true;
        }
    }

    saveCaptionPreference() {
        try {
            localStorage.setItem('memoryCaptionsEnabled', JSON.stringify(this.captionsEnabled));
            this.log('💾 Caption preference saved:', this.captionsEnabled);
        } catch (error) {
            this.error('Error saving caption preference:', error);
        }
    }

    updateCaptionToggleUI() {
        if (this.captionToggleBtn) {
            if (this.captionsEnabled) {
                this.captionToggleBtn.classList.add('active');
                this.captionToggleBtn.title = 'Disable Closed Captions';
            } else {
                this.captionToggleBtn.classList.remove('active');
                this.captionToggleBtn.title = 'Enable Closed Captions';
            }
        }
    }

    toggleCaptions() {
        this.captionsEnabled = !this.captionsEnabled;
        this.saveCaptionPreference();
        this.updateCaptionToggleUI();
        
        // Hide captions immediately if disabled
        if (!this.captionsEnabled) {
            this.captionContainer.style.display = 'none';
            this.captionText.innerHTML = '';
            this.captionMode = null;
        }
        
        this.log('🔄 Captions toggled:', this.captionsEnabled ? 'enabled' : 'disabled');
        
        // Provide audio feedback
        const message = this.captionsEnabled ? 'Closed captions enabled' : 'Closed captions disabled';
        this.speakResponse(message);
    }

    initializeThreeJS() {
        this.log('🎨 Initializing Three.js renderer...');
        
        const container = this.roomImage;
        
        // Create scene
        this.scene = new THREE.Scene();
        
        // Create camera
        this.camera = new THREE.PerspectiveCamera(80, container.clientWidth / container.clientHeight, 0.1, 1000);
        
        // Create renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        
        // Create sphere geometry for skybox
        const geometry = new THREE.SphereGeometry(1000, 60, 40);
        geometry.scale(-1, 1, 1); // Flip inside out
        
        const material = new THREE.MeshBasicMaterial();
        this.sphere = new THREE.Mesh(geometry, material);
        this.scene.add(this.sphere);
        
        // Create ground-plane compass
        this.createGroundCompass();
        
        // Create mist particle system
        this.createMistSystem();
        
        // Clear container and add canvas
        container.innerHTML = '';
        container.appendChild(this.renderer.domElement);

        // Initialize camera to look straight ahead (center of skybox)
        this.lon = 0;   // Center horizontally
        this.lat = 0;   // Center vertically
        
        // Set initial camera position manually to ensure it's centered
        this.camera.position.set(0, 0, 0);
        this.camera.lookAt(1,0,0); // Look along positive X axis (center of equirectangular)
        
        // Set up interaction controls
        this.setupThreeJSEventListeners();
        
        // Start render loop
        this.animate();
        
        this.log('✅ Three.js renderer initialized');
    }

    createMistSystem() {
        this.log('🌫️ Creating atmospheric mist particle system...');
        
        // Create mist particle system at scene origin
        this.mistSystem = this.particleManager.createParticleSystem(
            new THREE.Vector3(0, 0, 0), // Center of the scene
            false, // not a door
            true   // is mist
        );
        
        // Position mist system at scene center and add to scene
        this.scene.add(this.mistSystem);
        
        this.log('✅ Atmospheric mist system created with 800 particles');
    }

    createGroundCompass() {
    this.log('🧭 Creating ground-plane compass...');
    
    // Create compass group
    this.compassGroup = new THREE.Group();
    this.compassGroup.position.set(0, -20, 0); // Position at feet level
    
    // Load compass rose texture
    const textureLoader = new THREE.TextureLoader();
    const compassTexture = textureLoader.load('/compass-rose.jpg');
    compassTexture.wrapS = THREE.ClampToEdgeWrapping;
    compassTexture.wrapT = THREE.ClampToEdgeWrapping;
    compassTexture.minFilter = THREE.LinearFilter;
    compassTexture.magFilter = THREE.LinearFilter;
    
    // Create compass plane geometry (larger to match the previous compass size)
    const compassRadius = 15;
    const compassGeometry = new THREE.PlaneGeometry(compassRadius * 2, compassRadius * 2);
    
    // Create compass material with color inversion (black to white, white to transparent)
    const compassMaterial = new THREE.MeshBasicMaterial({
        map: compassTexture,
        transparent: true,
        opacity: 0.4, // Adjust as needed
        depthTest: false,
        depthWrite: false,
        side: THREE.DoubleSide,
        // Invert colors: make black areas white and white areas transparent
        color: 0xffffff, // Base white color
        alphaTest: 0.1, // Remove pixels below this alpha threshold
        // Use a custom shader material for proper color inversion
    });
    
    // Alternative approach using a shader material for better color inversion with glow
    const compassShaderMaterial = new THREE.ShaderMaterial({
        uniforms: {
            map: { value: compassTexture },
            opacity: { value: 0.25 },
            glowIntensity: { value: 12.0 },
            glowColor: { value: new THREE.Color(0.8, 1.0, 1.0) } // Cyan-ish white glow
        },
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform sampler2D map;
            uniform float opacity;
            uniform float glowIntensity;
            uniform vec3 glowColor;
            varying vec2 vUv;
            
            void main() {
                vec4 texColor = texture2D(map, vUv);
                
                // Calculate luminance to determine if pixel is black or white
                float luminance = dot(texColor.rgb, vec3(0.299, 0.587, 0.114));
                
                // Invert: make dark areas glow and light areas transparent
                float intensity = (1.0 - luminance);
                float alpha = intensity * opacity;
                
                // Create glowing effect by boosting the color intensity
                vec3 color = glowColor * glowIntensity * intensity;
                
                // Add some bloom-like effect
                float bloom = pow(intensity, 0.5) * 0.3;
                color += vec3(bloom);
                
                gl_FragColor = vec4(color, alpha);
            }
        `,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending // This creates the glow effect
    });
    
    // Create compass mesh using the shader material for color inversion
    this.compassPlane = new THREE.Mesh(compassGeometry, compassShaderMaterial);
    this.compassPlane.rotation.x = -Math.PI / 2; // Lay flat on ground
    this.compassPlane.rotation.z = -Math.PI / 2; // Rotate 90 degrees counter-clockwise to align North forward
    this.compassPlane.position.y = 0.1;
    this.compassGroup.add(this.compassPlane);
    
    // Add compass to scene
    this.scene.add(this.compassGroup);
    
    this.log('✅ Compass created with proper rotation and color inversion');
}

    setupVoiceRecognition() {
        this.log('🎤 Setting up voice recognition...');
        
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            this.recognition = new SpeechRecognition();
            
            this.recognition.continuous = false;
            this.recognition.interimResults = false;
            this.recognition.lang = 'en-US';
            
            this.recognition.onstart = () => {
                this.log('🎤 Voice recognition started');
                this.isListening = true;
                this.showListeningState();
            };
            
            this.recognition.onresult = async (event) => {
                const transcript = event.results[0][0].transcript;
                this.log('🗣️ Voice input received:', transcript);
                await this.processVoiceInput(transcript);
            };
            
            this.recognition.onerror = (event) => {
                this.error('Speech recognition error:', event.error);
                this.resetVoiceState();
            };
            
            this.recognition.onend = () => {
                this.log('🎤 Voice recognition ended');
                if (!this.isProcessing && this.isListening) {
                    this.resetVoiceState();
                }
            };
            
            this.log('✅ Voice recognition setup complete');
        } else {
            this.error('Speech recognition not supported in this browser');
            this.voiceInputBtn.style.display = 'none';
        }
    }

    setupEventListeners() {
        this.voiceInputBtn.addEventListener('click', async () => {
            this.log('🎯 Voice button clicked');
            
            // Test and initialize audio on first interaction
            if (!this.audioInitialized) {
                await this.initializeAudio();
            }
            
            if (this.isListening) {
                this.log('⏹️ Stopping voice input');
                this.stopListening();
            } else {
                this.log('▶️ Starting voice input');
                this.startListening();
            }
        });

        // Text input handlers
        this.sendTextBtn.addEventListener('click', async () => {
            const text = this.textInput.value.trim();
            if (text) {
                this.log('📝 Text input submitted:', text);
                this.textInput.value = '';
                await this.processTextInput(text);
            }
        });

        this.textInput.addEventListener('keypress', async (e) => {
            if (e.key === 'Enter') {
                const text = this.textInput.value.trim();
                if (text) {
                    this.log('📝 Text input submitted via Enter:', text);
                    this.textInput.value = '';
                    await this.processTextInput(text);
                }
            }
        });

        // Update send button state based on text input
        this.textInput.addEventListener('input', () => {
            const hasText = this.textInput.value.trim().length > 0;
            this.sendTextBtn.disabled = !hasText;
            this.sendTextBtn.style.opacity = hasText ? '1' : '0.5';
        });

        // Focus text input when clicking on it or the container
        this.textInput.addEventListener('focus', () => {
            if (this.isListening) {
                this.stopListening();
            }
        });

        // Image clicking for object creation - Update for Three.js
        this.renderer.domElement.addEventListener('click', (e) => {
            if (this.currentRoomId && !this.isUserInteracting) {
                // Only trigger object creation if user wasn't dragging
                const timeSincePointerDown = Date.now() - (this.pointerDownTime || 0);
                if (timeSincePointerDown > 200) return; // Was dragging
                
                this.log('🖱️ Skybox clicked for object creation');
                this.handleSkyboxClick(e);
            }
        });

        // Settings menu events
        this.settingsMenuBtn.addEventListener('click', () => {
            this.log('⚙️ Settings menu opened');
            this.settingsPanel.style.display = 'flex';
            this.updateSettingsUI();
        });

        document.getElementById('close-settings-btn').addEventListener('click', () => {
            this.log('❌ Settings menu closed');
            this.settingsPanel.style.display = 'none';
        });

        // Info button events
        document.getElementById('info-btn').addEventListener('click', () => {
            this.log('ℹ️ Info panel opened');
            this.updateRoomInfo();
            document.getElementById('room-info-panel').style.display = 'flex';
        });

        document.getElementById('close-info-btn').addEventListener('click', () => {
            this.log('❌ Info panel closed');
            document.getElementById('room-info-panel').style.display = 'none';
        });

        // Close info panel when clicking outside
        document.getElementById('room-info-panel').addEventListener('click', (e) => {
            if (e.target === document.getElementById('room-info-panel')) {
                document.getElementById('room-info-panel').style.display = 'none';
            }
        });

        // Export/Import functionality
        document.getElementById('export-palace-btn').addEventListener('click', async () => {
            this.log('📤 Palace export requested');
            await this.exportPalace();
        });

        document.getElementById('import-palace-btn').addEventListener('click', () => {
            this.log('📥 Palace import requested');
            document.getElementById('import-file-input').click();
        });

        document.getElementById('import-file-input').addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                this.log('📁 Import file selected:', file.name);
                await this.importPalace(file);
                // Clear the input so the same file can be selected again
                e.target.value = '';
            }
        });

        // Caption toggle events
        this.captionToggleBtn.addEventListener('click', () => {
            this.log('🔄 Caption toggle clicked');
            this.toggleCaptions();
        });

        // Settings panel events
        document.getElementById('save-settings-btn').addEventListener('click', () => {
            this.log('💾 Saving settings...');
            
            // Update settings from UI
            this.settings.voice = document.getElementById('voice-select').value;
            this.settings.speechRate = parseFloat(document.getElementById('speech-rate').value);
            this.settings.speechPitch = parseFloat(document.getElementById('speech-pitch').value);
            this.settings.systemPrompt = document.getElementById('system-prompt').value;
            this.settings.responseTemperature = parseFloat(document.getElementById('response-temperature').value);
            this.settings.aestheticPrompt = document.getElementById('aesthetic-prompt').value;
            
            this.saveSettings();
            this.speakResponse('Settings saved successfully.');
        });

        document.getElementById('reset-settings-btn').addEventListener('click', () => {
            if (confirm('Reset all settings to defaults? This cannot be undone.')) {
                this.resetSettings();
                this.speakResponse('Settings reset to defaults.');
            }
        });

        document.getElementById('delete-palace-btn').addEventListener('click', async () => {
            if (confirm('⚠️ DELETE YOUR ENTIRE MEMORY PALACE?\n\nThis will permanently delete all rooms, objects, and connections. This cannot be undone!\n\nType "DELETE" to confirm:')) {
                await this.deletePalace();
            }
        });

        // Range input updates
        document.getElementById('speech-rate').addEventListener('input', (e) => {
            document.getElementById('rate-value').textContent = e.target.value;
        });

        document.getElementById('speech-pitch').addEventListener('input', (e) => {
            document.getElementById('pitch-value').textContent = e.target.value;
        });

        document.getElementById('response-temperature').addEventListener('input', (e) => {
            document.getElementById('temperature-value').textContent = e.target.value;
        });

        // Close settings when clicking outside
        this.settingsPanel.addEventListener('click', (e) => {
            if (e.target === this.settingsPanel) {
                this.settingsPanel.style.display = 'none';
            }
        });

        // Initialize device orientation for mobile
        if (window.DeviceOrientationEvent) {
            this.initializeDeviceOrientation();
        }
    }

    initializeDeviceOrientation() {
        this.log('📱 Initializing device orientation support...');
        
        // Check if we need to request permission (iOS 13+)
        if (typeof DeviceOrientationEvent.requestPermission === 'function') {
            // iOS 13+ requires permission
            const requestPermission = async () => {
                try {
                    const permission = await DeviceOrientationEvent.requestPermission();
                    if (permission === 'granted') {
                        this.setupDeviceOrientationListener();
                    } else {
                        this.log('⚠️ Device orientation permission denied');
                    }
                } catch (error) {
                    this.error('Error requesting device orientation permission:', error);
                }
            };
            
            // Add button to request permission on first user interaction
            this.pendingOrientationPermission = requestPermission;
        } else {
            // Other platforms don't need permission
            this.setupDeviceOrientationListener();
        }
    }

  async imageGen(description) {
    const res = await websim.imageGen({
                prompt: `Create a 360-degree equirectangular panoramic image in 21:9 aspect ratio showing [scene]. 

TECHNICAL REQUIREMENTS:
- Equirectangular projection for spherical mapping
- 21:9 aspect ratio (closest available to 2:1)
- 360-degree horizontal coverage with seamless left-right edges
- Maximum vertical field of view possible
- Spherical distortion and warping for skybox rendering

SCENE DESCRIPTION: ${description}

AESTHETIC: ${this.settings.aestheticPrompt}

Note: Optimize for Three.js skybox despite non-standard aspect ratio.. Equirectangular projection, seamless spherical panorama, immersive virtual reality environment suitable for memory palace navigation. Ensure left and right sides of the image match perfectly!`,
                height: 2048,
                aspect_ratio: "21:9"
            });
    this.log(' Image generated', res);
    return res;
  }

    setupDeviceOrientationListener() {
        this.log('🧭 Setting up device orientation listener...');
        
        let alpha = 0, beta = 0, gamma = 0;
        let isFirstOrientation = true;
        
        window.addEventListener('deviceorientation', (event) => {
            if (event.alpha !== null && event.beta !== null && event.gamma !== null) {
                // Convert device orientation to camera rotation
                if (isFirstOrientation) {
                    // Set initial orientation
                    alpha = event.alpha;
                    beta = event.beta;
                    gamma = event.gamma;
                    isFirstOrientation = false;
                    this.log('📱 Initial device orientation set');
                    return;
                }
                
                // Calculate rotation deltas
                const deltaAlpha = event.alpha - alpha;
                const deltaBeta = event.beta - beta;
                
                // Apply orientation changes to camera
                this.lon -= deltaAlpha * 0.5; // Horizontal rotation
                this.lat += deltaBeta * 0.5;  // Vertical rotation
                
                // Constrain horizontal rotation to 90% freedom (prevent viewing directly behind)
                this.lon = Math.max(-135, Math.min(135, this.lon));
                
                // Clamp vertical rotation
                this.lat = Math.max(-85, Math.min(85, this.lat));
                
                // Update stored values
                alpha = event.alpha;
                beta = event.beta;
                gamma = event.gamma;
            }
        });
    }

    updateRoomInfo() {
        const currentRoom = this.currentRoomId ? this.rooms.get(this.currentRoomId) : null;
        
        if (!currentRoom) {
            document.getElementById('info-room-name').textContent = 'No Current Room';
            document.getElementById('info-room-description').textContent = 'Create a room to begin your memory palace journey.';
            document.getElementById('info-connections').innerHTML = '<p class="no-connections">No doors have been created yet.</p>';
            document.getElementById('info-objects').innerHTML = '<p class="no-objects">No objects have been placed yet.</p>';
            return;
        }

        // Update room info
        document.getElementById('info-room-name').textContent = currentRoom.name;
        document.getElementById('info-room-description').textContent = currentRoom.description;

        // Update connections
        const connectionsContainer = document.getElementById('info-connections');
        if (currentRoom.connections.size === 0) {
            connectionsContainer.innerHTML = '<p class="no-connections">No doors have been created yet.</p>';
        } else {
            const connectionsHTML = Array.from(currentRoom.connections.values()).map(conn => {
                const targetRoom = this.rooms.get(conn.targetRoomId);
                return `
                    <div class="connection-item">
                        <div class="connection-desc">${conn.description}</div>
                        <div class="connection-target">→ ${targetRoom ? targetRoom.name : 'Unknown Room'}</div>
                    </div>
                `;
            }).join('');
            connectionsContainer.innerHTML = connectionsHTML;
        }

        // Update objects
        const objectsContainer = document.getElementById('info-objects');
        if (currentRoom.objects.size === 0) {
            objectsContainer.innerHTML = '<p class="no-objects">No objects have been placed yet.</p>';
        } else {
            const objectsHTML = Array.from(currentRoom.objects.values()).map(obj => `
                <div class="object-item">
                    <div class="object-name">${obj.name}</div>
                    <div class="object-info">${obj.information}</div>
                </div>
            `).join('');
            objectsContainer.innerHTML = objectsHTML;
        }

        this.log('ℹ️ Room info updated for:', currentRoom.name);
    }

    async initializeAudio() {
        this.log('🔊 Initializing audio system...');
        
        try {
            // Test speech synthesis with a silent utterance
            const testUtterance = new SpeechSynthesisUtterance('');
            testUtterance.volume = 0;
            testUtterance.rate = 10;
            
            return new Promise((resolve) => {
                testUtterance.onend = () => {
                    this.audioInitialized = true;
                    this.log('✅ Audio system initialized successfully');
                    resolve();
                };
                
                testUtterance.onerror = () => {
                    this.error('Audio initialization failed');
                    this.audioInitialized = true; // Continue anyway
                    resolve();
                };
                
                // Force load voices on iOS
                if (this.synthesis.getVoices().length === 0) {
                    this.synthesis.addEventListener('voiceschanged', () => {
                        this.log('🔊 Voices loaded:', this.synthesis.getVoices().length);
                        this.synthesis.speak(testUtterance);
                    }, { once: true });
                } else {
                    this.synthesis.speak(testUtterance);
                }
                
                // Fallback timeout
                setTimeout(() => {
                    this.audioInitialized = true;
                    this.log('⚠️ Audio initialization timeout - continuing anyway');
                    resolve();
                }, 2000);
            });
        } catch (error) {
            this.error('Audio initialization error:', error);
            this.audioInitialized = true; // Continue anyway
        }
    }

    startListening() {
        if (!this.recognition || this.isListening) return;
        
        try {
            this.log('🎤 Starting speech recognition...');
            this.recognition.start();
        } catch (error) {
            this.error('Error starting recognition:', error);
        }
    }

    stopListening() {
        if (this.recognition && this.isListening) {
            this.log('🛑 Stopping speech recognition...');
            this.recognition.stop();
            this.isListening = false;
            this.resetVoiceState();
        }
    }

    showListeningState() {
        this.voiceInputBtn.classList.add('active');
        //this.voiceLabel.textContent = 'Tap to cancel';
        this.voiceFeedback.style.display = 'block';
        this.listeningIndicator.style.display = 'flex';
        this.responseText.style.display = 'none';
        
        // Blur text input when voice starts
        this.textInput.blur();
    }

    resetVoiceState() {
        this.isListening = false;
        this.isProcessing = false;
        this.voiceInputBtn.classList.remove('active');
        //this.voiceLabel.textContent = 'Tap to speak';
        this.voiceFeedback.style.display = 'none';
    }

    showProcessingState() {
        this.isProcessing = true;
        this.listeningIndicator.style.display = 'none';
        this.responseText.style.display = 'block';
        this.responseText.textContent = 'Processing your request...';
    }

    async processTextInput(text) {
        this.log('📝 Processing text input:', text);
        this.showProcessingState();
        
        try {
            // Use the same processing pipeline as voice input
            await this.processInput(text);
        } catch (error) {
            this.error('Error processing text input:', error);
            this.responseText.textContent = 'Sorry, I had trouble processing that. Please try again.';
            await this.speakResponse('Sorry, I had trouble processing that. Please try again.');
        }
        
        // Reset after a delay
        setTimeout(() => {
            this.resetVoiceState();
        }, 3000);
    }

    async processVoiceInput(transcript) {
        this.log('🧠 Processing voice input:', transcript);
        this.showProcessingState();
        
        // Show voice recognition result in captions only if captions are enabled and not already showing synthesis
        if (this.captionsEnabled && this.captionMode !== 'synthesis') {
            this.captionMode = 'recognition';
            this.captionText.textContent = `You said: "${transcript}"`;
            this.captionContainer.style.display = 'block';
        }
        
        try {
            await this.processInput(transcript);
        } catch (error) {
            this.error('Error processing voice input:', error);
            this.responseText.textContent = 'Sorry, I had trouble processing that. Please try again.';
            await this.speakResponse('Sorry, I had trouble processing that. Please try again.');
        }
        
        // Hide recognition caption after processing if still showing recognition
        setTimeout(() => {
            if (this.captionMode === 'recognition') {
                this.captionContainer.style.display = 'none';
                this.captionText.innerHTML = '';
                this.captionMode = null;
            }
        }, 1500);
        
        // Reset after a delay
        setTimeout(() => {
            this.resetVoiceState();
        }, 3000);
    }

    async processInput(inputText) {
        this.log('🧠 Processing input:', inputText);
        
        // Check for autopilot activation
        if (inputText.toLowerCase().includes('autopilot') || inputText.toLowerCase().includes('auto pilot')) {
            this.log('🤖 Autopilot mode requested');
            await this.startAutopilot(inputText);
            return;
        }
        
        // Build context for the AI
        const context = this.buildConversationContext(inputText);
        this.log('📝 Built context for AI:', { 
            roomCount: context.totalRooms, 
            objectCount: context.totalObjects,
            currentRoom: context.currentRoom?.name 
        });
        
        // Get AI response
        this.log('🤖 Requesting AI response...', context);
        const response = await this.getAIResponse(context);
        this.log('💬 AI response received:', response);
        
        // Execute any actions
        // Show and speak response if there's text content
        if (response.text && !this.isAutopilot) {
            this.responseText.textContent = response.text;
            this.log('🔊 Speaking response...');
            this.speakResponse(response.text);
        }
      
        let actionExecuted = false;
        if (response.action) {
            this.log('⚡ Executing action:', response);
            actionExecuted = await this.executeAction(response.action, response.parameters);
            this.log('✅ Action execution result:', actionExecuted);
        }
        
        // Update conversation context
        this.conversationContext.push({
            user: inputText,
            assistant: response.text || 'Action completed',
            timestamp: Date.now()
        });
        
        // Keep only last 5 interactions
        if (this.conversationContext.length > 5) {
            this.conversationContext = this.conversationContext.slice(-5);
        }
        
        this.log('📚 Updated conversation context, length:', this.conversationContext.length);
        
        // Continue autopilot if active
        if (this.isAutopilot && actionExecuted) {
            await this.continueAutopilot();
        }
    }

    buildConversationContext(userInput) {
        const currentRoom = this.currentRoomId ? this.rooms.get(this.currentRoomId) : null;
        
        return {
            userInput,
            currentRoom: currentRoom ? {
                name: currentRoom.name,
                description: currentRoom.description,
                availableExits: Array.from(currentRoom.connections.values()).map(conn => ({
                    connectionId: conn.id,
                    doorDescription: conn.description,
                    targetRoomName: this.rooms.get(conn.targetRoomId)?.name
                })),
                objects: Array.from(currentRoom.objects.values()).map(obj => ({
                    name: obj.name,
                    information: obj.information
                }))
            } : null,
            totalRooms: this.rooms.size,
            totalObjects: Array.from(this.rooms.values()).reduce((total, room) => total + room.objects.size, 0),
            conversationHistory: this.conversationContext
        };
    }

    async getAIResponse(context) {
        const completion = await websim.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: this.buildSystemPrompt(context)
                },
                {
                    role: "user",
                    content: `User said: "${context.userInput}"`
                }
            ],
            temperature: this.settings.responseTemperature
        });

        const responseText = completion.content;
        this.log('📚 AI response content', responseText);
        
        // Parse structured response
        let action = null;
        let parameters = {};
        let cleanResponse = responseText;
        
        // Extract command
        const commandMatch = responseText.match(/COMMAND:(\w+)/);
        if (commandMatch) {
            action = commandMatch[1];
            cleanResponse = responseText.replace(/COMMAND:\w+\s*/, '');
        }
        
        // Extract parameters for CREATE_ROOM
        if (action === 'CREATE_ROOM') {
            const nameMatch = responseText.match(/ROOM_NAME:\s*(.+?)(?:\n|$)/);
            const descMatch = responseText.match(/ROOM_DESCRIPTION:\s*(.+?)(?:\n|$)/);
            
            if (nameMatch && descMatch) {
                parameters.name = nameMatch[1].trim();
                parameters.description = descMatch[1].trim();
                // Clean these from the response
                cleanResponse = cleanResponse.replace(/ROOM_NAME:\s*.+?(?:\n|$)/, '');
                cleanResponse = cleanResponse.replace(/ROOM_DESCRIPTION:\s*.+?(?:\n|$)/, '');
            }
        }
        
        // Extract parameters for EDIT_ROOM
        if (action === 'EDIT_ROOM') {
            const descMatch = responseText.match(/ROOM_DESCRIPTION:\s*(.+?)(?:\n|$)/);
            
            if (descMatch) {
                parameters.description = descMatch[1].trim();
                // Clean this from the response
                cleanResponse = cleanResponse.replace(/ROOM_DESCRIPTION:\s*.+?(?:\n|$)/, '');
            }
        }
        
        // Extract parameters for ADD_OBJECT
        if (action === 'ADD_OBJECT') {
            const nameMatch = responseText.match(/OBJECT_NAME:\s*(.+?)(?:\n|$)/);
            const infoMatch = responseText.match(/OBJECT_INFO:\s*(.+?)(?:\n|$)/);
            
            if (nameMatch && infoMatch) {
                parameters.name = nameMatch[1].trim();
                parameters.information = infoMatch[1].trim();
                parameters.position = this.pendingCreationPosition || { x: 0, y: 0, z: 500 };
                // Clean these from the response
                cleanResponse = cleanResponse.replace(/OBJECT_NAME:\s*.+?(?:\n|$)/, '');
                cleanResponse = cleanResponse.replace(/OBJECT_INFO:\s*.+?(?:\n|$)/, '');
            }
        }

        // Extract parameters for CREATE_DOOR
        if (action === 'CREATE_DOOR') {
            const doorMatch = responseText.match(/DOOR_DESCRIPTION:\s*(.+?)(?:\n|$)/);
            const targetNameMatch = responseText.match(/TARGET_ROOM_NAME:\s*(.+?)(?:\n|$)/);
            const targetDescMatch = responseText.match(/TARGET_ROOM_DESCRIPTION:\s*(.+?)(?:\n|$)/);
            const targetIdMatch = responseText.match(/TARGET_ROOM_ID:\s*(.+?)(?:\n|$)/);
            
            if (doorMatch) {
                parameters.description = doorMatch[1].trim();
                cleanResponse = cleanResponse.replace(/DOOR_DESCRIPTION:\s*.+?(?:\n|$)/, '');
            }
            
            if (targetNameMatch && targetDescMatch) {
                parameters.targetRoomName = targetNameMatch[1].trim();
                parameters.targetRoomDescription = targetDescMatch[1].trim();
                cleanResponse = cleanResponse.replace(/TARGET_ROOM_NAME:\s*.+?(?:\n|$)/, '');
                cleanResponse = cleanResponse.replace(/TARGET_ROOM_DESCRIPTION:\s*.+?(?:\n|$)/, '');
            } else if (targetIdMatch) {
                parameters.targetRoomId = targetIdMatch[1].trim();
                cleanResponse = cleanResponse.replace(/TARGET_ROOM_ID:\s*.+?(?:\n|$)/, '');
            }
        }

        // Extract parameters for NAVIGATE
        if (action === 'NAVIGATE') {
            const connectionMatch = responseText.match(/CONNECTION_ID:\s*(.+?)(?:\n|$)/);
            
            if (connectionMatch) {
                parameters.connectionId = connectionMatch[1].trim();
                cleanResponse = cleanResponse.replace(/CONNECTION_ID:\s*.+?(?:\n|$)/, '');
            }
        }

        return {
            text: cleanResponse.trim(),
            action,
            parameters
        };
    }

    buildSystemPrompt(context) {
        const basePrompt = `You are an AI assistant for a Memory Palace application. Users can create rooms, add memory objects, and navigate between rooms.

IMPORTANT: Start your response with exactly one of these commands:
- COMMAND:CREATE_ROOM - to create a new room
- COMMAND:EDIT_ROOM - to edit/update the current room description
- COMMAND:ADD_OBJECT - to add a memory object to current room  
- COMMAND:CREATE_DOOR - to create a door/connection to another room
- COMMAND:NAVIGATE - to move through an existing door to a different room
- COMMAND:DESCRIBE - to describe current room or objects
- COMMAND:LIST - to list available exits from current room
- COMMAND:CHAT - for general conversation

After the command, provide a natural conversational response.

SPATIAL PLACEMENT LOGIC:
When user describes something to place at a clicked location, determine if it should be:
1. ADD_OBJECT - for items, furniture, decorative elements, books, paintings, etc.
2. CREATE_DOOR - for doorways, passages, windows leading elsewhere, stairs, portals, etc.

Base decision on the description's nature:
- Objects are things you examine, interact with, or remember information about
- Doors are passages, openings, or connections that lead to other spaces

NAVIGATION INSTRUCTIONS:
When a user wants to navigate, you must decide between two actions:

1. COMMAND:NAVIGATE - Use existing door/connection
   - User describes going through a door that matches an existing door description
   - User mentions going to a room that's directly connected
   - Always include: CONNECTION_ID: [exact connection ID from available exits]

2. COMMAND:CREATE_DOOR - Create missing connection or new room
   - User describes a door/passage that could reasonably exist in the current room
   - User wants to go to a room that doesn't have a direct connection
   - User wants to go somewhere completely new
   - Include: DOOR_DESCRIPTION, TARGET_ROOM_NAME, TARGET_ROOM_DESCRIPTION

DECISION PROCESS:
1. Read the user's navigation request carefully
2. Compare it against existing door descriptions from current room
3. If user mentions a room name that appears in existing connections, use NAVIGATE
4. If user describes a door that matches existing door descriptions, use NAVIGATE
5. If user describes a door that could exist but has no connection, use CREATE_DOOR
6. If user wants to go somewhere completely new, use CREATE_DOOR

CONTEXT PROVIDED:
- Current room name and COMPLETE description
- ONLY doors that exist from current room with their descriptions and destinations
- You have NO knowledge of other rooms in the palace except connected room names

Your job is to intelligently match user intent to the right action using this complete context.

For CREATE_ROOM commands, include these details after your response:
ROOM_NAME: [room name]
ROOM_DESCRIPTION: [detailed room description for image generation]

For EDIT_ROOM commands, include:
ROOM_DESCRIPTION: [updated detailed room description for image generation]

For ADD_OBJECT commands, include:
OBJECT_NAME: [object name]
OBJECT_INFO: [information to remember]

For CREATE_DOOR commands, include:
DOOR_DESCRIPTION: [description of the door/entrance]
TARGET_ROOM_NAME: [name of new room to create] (if creating new room)
TARGET_ROOM_DESCRIPTION: [description of new room] (if creating new room)
TARGET_ROOM_ID: [existing room ID] (if connecting to existing room)

For NAVIGATE commands, include:
CONNECTION_ID: [exact connection ID from available exits]`;

        const contextInfo = `

${context.currentRoom ? `
CURRENT ROOM DETAILS:
Name: "${context.currentRoom.name}"
Complete Description: "${context.currentRoom.description}"

EXISTING DOORS/EXITS FROM THIS ROOM:
${context.currentRoom.availableExits.length > 0 ? 
    context.currentRoom.availableExits.map(exit => 
        `CONNECTION_ID: ${exit.connectionId}
Door Description: "${exit.doorDescription}"
Leads to Room: "${exit.targetRoomName}"`
    ).join('\n\n') : 'No doors exist yet - any navigation request will require creating a new door.'}

OBJECTS IN THIS ROOM:
${context.currentRoom.objects.map(obj => `"${obj.name}" - ${obj.information}`).join('\n') || 'No objects yet'}
` : 'USER HAS NO CURRENT ROOM - suggest creating one first!'}

RECENT CONVERSATION CONTEXT:
${context.conversationHistory.map(conv => `User: "${conv.user}"\nAssistant: "${conv.assistant}"`).join('\n')}

IMPORTANT: You only know about the current room and its direct connections. You have no knowledge of the broader palace layout.`;

        return basePrompt + contextInfo;
    }

    async speakResponse(text) {
        this.log('🗣️ Speaking response:', text.substring(0, 50) + '...');
        
        return new Promise((resolve) => {
            if (!this.synthesis) {
                this.error('Speech synthesis not available');
                resolve();
                return;
            }

            // Cancel any ongoing speech
            this.synthesis.cancel();

            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = this.settings.speechRate;
            utterance.pitch = this.settings.speechPitch;
            utterance.volume = 0.8;

            // Set voice if specified
            if (this.settings.voice && this.availableVoices[this.settings.voice]) {
                utterance.voice = this.availableVoices[this.settings.voice];
                this.log('🎯 Using selected voice:', utterance.voice.name);
            }

            // 🎬 1. Show the full text right away in captions, override any recognition caption (only if captions enabled)
            if (this.captionsEnabled) {
                this.captionMode = 'synthesis';
                this.captionText.textContent = text;
                this.captionContainer.style.display = 'block';
            }

            // 2. Set up incremental word highlighting (optional but nice)
            let wordIndex = 0;
            const words = text.split(/\s+/);

            utterance.onboundary = (e) => {
                // boundary fires for every word and punctuation
                if (e.name === 'word' && this.captionMode === 'synthesis' && this.captionsEnabled) {
                    wordIndex++;
                    const spoken = words.slice(0, wordIndex).join(' ');
                    const remain = words.slice(wordIndex).join(' ');
                    // bold the spoken part for a karaoke effect
                    this.captionText.innerHTML =
                        `<span class="spoken">${spoken}</span> ${remain}`;
                }
            };

            // iOS compatibility: Wait for voices to load
            const setVoiceAndSpeak = () => {
                utterance.onstart = () => {
                    this.log('🔊 Speech started');
                };

                utterance.onend = () => {
                    this.log('✅ Speech completed');
                    // 3. Hide after a small delay so people can read the last line (only if captions enabled)
                    if (this.captionsEnabled) {
                        setTimeout(() => {
                            if (this.captionMode === 'synthesis') {
                                this.captionContainer.style.display = 'none';
                                this.captionText.innerHTML = '';
                                this.captionMode = null;
                            }
                        }, 1500);
                    }
                    resolve();
                };
                
                utterance.onerror = (error) => {
                    this.error('Speech synthesis error:', error);
                    // Hide captions on error (only if captions enabled)
                    if (this.captionsEnabled && this.captionMode === 'synthesis') {
                        this.captionContainer.style.display = 'none';
                        this.captionText.innerHTML = '';
                        this.captionMode = null;
                    }
                    resolve();
                };

                this.synthesis.speak(utterance);
            };

            // Check if voices are already loaded
            if (this.synthesis.getVoices().length > 0 || this.settings.voice === '') {
                setVoiceAndSpeak();
            } else {
                this.log('⏳ Waiting for voices to load...');
                // Wait for voices to load (iOS requirement)
                this.synthesis.addEventListener('voiceschanged', setVoiceAndSpeak, { once: true });
                // Fallback timeout for iOS
                setTimeout(setVoiceAndSpeak, 100);
            }
        });
    }

    async executeAction(action, parameters) {
        this.log('🎬 Executing action:', action, parameters);
        
        switch (action) {
            case 'CREATE_ROOM':
                if (parameters.name && parameters.description) {
                    try {
                        this.log('🏗️ Creating room:', parameters.name);
                        await this.generateRoom(parameters.description, parameters.name);
                        return true;
                    } catch (error) {
                        this.error('Error creating room:', error);
                        await this.speakResponse('Sorry, I had trouble creating that room. Please try again.');
                        return false;
                    }
                }
                break;
                
            case 'EDIT_ROOM':
                if (parameters.description && this.currentRoomId) {
                    try {
                        this.log('✏️ Editing room description:', parameters.description);
                        await this.editRoom(parameters.description);
                        return true;
                    } catch (error) {
                        this.error('Error editing room:', error);
                        await this.speakResponse('Sorry, I had trouble updating that room. Please try again.');
                        return false;
                    }
                } else if (!this.currentRoomId) {
                    this.log('⚠️ Cannot edit room - no current room');
                    await this.speakResponse('You need to create a room first before editing it.');
                    return false;
                }
                break;
                
            case 'ADD_OBJECT':
                if (parameters.name && parameters.information && this.currentRoomId) {
                    this.log('📦 Adding object:', parameters.name);
                    const position = this.pendingCreationPosition || parameters.position || { x: 0, y: 0, z: 500 };
                    await this.createObject(parameters.name, parameters.information, position);
                    this.pendingCreationPosition = null; // Clear pending position
                    return true;
                } else if (!this.currentRoomId) {
                    this.log('⚠️ Cannot add object - no current room');
                    await this.speakResponse('You need to create a room first before adding objects.');
                    return false;
                }
                break;
                
            case 'CREATE_DOOR':
                if (parameters.description && this.currentRoomId) {
                    try {
                        this.log('🚪 Creating door connection:', parameters.description);
                        
                        if (parameters.targetRoomName && parameters.targetRoomDescription) {
                            // Creating a new room and connecting to it
                            const newRoomId = await this.generateConnectedRoom(
                                parameters.targetRoomDescription, 
                                parameters.targetRoomName,
                                parameters.description
                            );
                            await this.speakResponse(`Door created to ${parameters.targetRoomName}. You are now in the new room. You can go back by clicking the door or saying "go to ${this.rooms.get(this.currentRoomId === newRoomId ? Array.from(this.rooms.get(newRoomId).connections.values()).find(c => c.targetRoomId !== newRoomId)?.targetRoomId : this.currentRoomId)?.name || 'the previous room'}.`);
                        } else if (parameters.targetRoomId) {
                            // Connecting to existing room
                            await this.createConnection(parameters.description, parameters.targetRoomId);
                            const targetRoom = this.rooms.get(parameters.targetRoomId);
                            await this.speakResponse(`Door created to ${targetRoom.name}. You can now navigate between rooms by clicking the door.`);
                        }
                        return true;
                    } catch (error) {
                        this.error('Error creating door:', error);
                        await this.speakResponse('Sorry, I had trouble creating that door connection. Please try again.');
                        return false;
                    }
                } else if (!this.currentRoomId) {
                    this.log('⚠️ Cannot create door - no current room');
                    await this.speakResponse('You need to create a room first before adding doors.');
                    return false;
                }
                break;
                
            case 'NAVIGATE':
                if (parameters.connectionId && this.currentRoomId) {
                    const currentRoom = this.rooms.get(this.currentRoomId);
                    const connection = currentRoom.connections.get(parameters.connectionId);
                    
                    if (connection) {
                        this.navigateToRoom(connection.targetRoomId);
                        const targetRoom = this.rooms.get(connection.targetRoomId);
                        await this.speakResponse(`You go through ${connection.description} and enter ${targetRoom.name}.`);
                        return true;
                    } else {
                        await this.speakResponse('I cannot find that door. Please describe the door you want to use.');
                        return false;
                    }
                } else if (!this.currentRoomId) {
                    this.log('⚠️ Cannot navigate - no current room');
                    await this.speakResponse('You need to create a room first before navigating.');
                    return false;
                }
                break;
                
            case 'DESCRIBE':
                this.log('📖 Describe action requested');
                if (this.currentRoomId) {
                    const room = this.rooms.get(this.currentRoomId);
                    const objectsList = Array.from(room.objects.values()).map(obj => obj.name).join(', ');
                    const connectionsList = Array.from(room.connections.values()).map(conn => {
                        const targetRoom = this.rooms.get(conn.targetRoomId);
                        return `${conn.description} to ${targetRoom.name}`;
                    }).join(', ');
                    
                    let description = `You are in ${room.name}. ${room.description}. `;
                    if (room.objects.size > 0) {
                        description += `Objects here include: ${objectsList}. `;
                    }
                    if (room.connections.size > 0) {
                        description += `You can go through: ${connectionsList}.`;
                    } else {
                        description += 'No doors have been created yet.';
                    }
                    
                    await this.speakResponse(description);
                } else {
                    await this.speakResponse('You haven\'t created any rooms yet. Say "create a room" to get started.');
                }
                return true;
                
            case 'LIST':
                this.log('📋 List action requested');
                if (this.currentRoomId) {
                    const room = this.rooms.get(this.currentRoomId);
                    if (room.connections.size > 0) {
                        const connectionsList = Array.from(room.connections.values()).map(conn => {
                            const targetRoom = this.rooms.get(conn.targetRoomId);
                            return `${conn.description} leads to ${targetRoom.name}`;
                        }).join(', ');
                        await this.speakResponse(`From ${room.name}, you can go through: ${connectionsList}`);
                    } else {
                        await this.speakResponse('There are no doors from this room yet. Say "create a door" to add connections.');
                    }
                } else {
                    await this.speakResponse('You need to create a room first.');
                }
                return true;
        }
        return false;
    }

    async generateRoom(description, name) {
        this.log('🎨 Generating 360-degree skybox for:', name);
        this.showLoading('Creating your immersive memory room...');
        
        try {
            // Generate 360-degree skybox image with aesthetic prompt
            const imageResult = await this.imageGen(description);
            
            this.log('✅ 360-degree skybox generated successfully');
            
            // Create the room object
            const roomId = `room_${++this.roomCounter}`;
            const room = {
                id: roomId,
                name: name,
                description: description,
                imageUrl: imageResult.url,
                objects: new Map(),
                connections: new Map()
            };
            
            this.rooms.set(roomId, room);
            this.currentRoomId = roomId;
            
            // Save to database
            await this.saveRoom(room);
            await this.saveUserState();
            
            this.log('🏰 Room created and set as current:', roomId);
            this.displayRoom(room);
            
        } catch (error) {
            this.error('Error generating room:', error);
            throw error;
        } finally {
            this.hideLoading();
        }
    }

    async editRoom(newDescription) {
        if (!this.currentRoomId) return;
        
        const room = this.rooms.get(this.currentRoomId);
        this.log('✏️ Editing room:', room.name, 'with new description:', newDescription);
        this.showLoading('Updating your immersive memory room...');
        
        try {
            // Generate new 360-degree skybox with updated description and aesthetic prompt
            const imageResult = await this.imageGen(newDescription)
            
            this.log('✅ Updated 360-degree skybox generated successfully');
            
            // Update room description and image
            room.description = newDescription;
            room.imageUrl = imageResult.url;
            
            // Save to database
            await this.saveRoom(room);
            
            this.log('🏰 Room updated successfully:', room.id);
            this.displayRoom(room);
            
        } catch (error) {
            this.error('Error editing room:', error);
            throw error;
        } finally {
            this.hideLoading();
        }
    }

    async generateConnectedRoom(description, name, doorDescription) {
        this.log('🎨 Generating connected 360-degree skybox room:', name);
        this.showLoading('Creating connected immersive room...');
        
        try {
            // Generate 360-degree skybox image with aesthetic prompt
            const imageResult = await this.imageGen(description);
            
            this.log('✅ Connected 360-degree skybox generated successfully');
            
            // Create the new room object
            const newRoomId = `room_${++this.roomCounter}`;
            const currentRoom = this.rooms.get(this.currentRoomId);
            
            const newRoom = {
                id: newRoomId,
                name: name,
                description: description,
                imageUrl: imageResult.url,
                objects: new Map(),
                connections: new Map()
            };
            
            this.rooms.set(newRoomId, newRoom);
            
            // Create bidirectional connections
            const connectionId1 = `conn_${Date.now()}_1`;
            const connectionId2 = `conn_${Date.now()}_2`;
            
            // Connection from current room to new room
            const forwardConnection = {
                id: connectionId1,
                description: doorDescription,
                targetRoomId: newRoomId,
                bidirectional: true
            };
            
            // Connection from new room back to current room
            const backConnection = {
                id: connectionId2,
                description: `Door back to ${currentRoom.name}`,
                targetRoomId: this.currentRoomId,
                bidirectional: true
            };
            
            currentRoom.connections.set(connectionId1, forwardConnection);
            newRoom.connections.set(connectionId2, backConnection);
            
            // Create spatial door marker in current room at clicked position
            if (this.pendingCreationPosition) {
                await this.createDoorMarker(doorDescription, newRoomId, this.pendingCreationPosition);
            }
            
            // Create corresponding door marker in new room (position it opposite)
            const backDoorPosition = this.pendingCreationPosition ? {
                x: -this.pendingCreationPosition.x * 0.8,
                y: this.pendingCreationPosition.y,
                z: -this.pendingCreationPosition.z * 0.8
            } : { x: 0, y: 0, z: -500 };
            
            const backDoorObject = {
                id: `door_${Date.now()}_back`,
                name: `Door back to ${currentRoom.name}`,
                information: `Door leading back to ${currentRoom.name}`,
                position: backDoorPosition,
                targetRoomId: this.currentRoomId
            };
            
            newRoom.objects.set(backDoorObject.id, backDoorObject);
            await this.saveObject(newRoomId, backDoorObject);
            
            this.pendingCreationPosition = null;
            
            // Save to database
            await this.saveRoom(newRoom);
            await this.saveConnection(this.currentRoomId, forwardConnection);
            await this.saveConnection(newRoomId, backConnection);
            await this.saveUserState();
            
            this.log('🔗 Bidirectional connections created between rooms');
            
            // Automatically navigate to the new room
            this.currentRoomId = newRoomId;
            this.displayRoom(newRoom);
            await this.saveUserState();
            
            this.log('🚶 Automatically navigated to new room:', name);
            
            return newRoomId;
            
        } catch (error) {
            this.error('Error generating connected room:', error);
            throw error;
        } finally {
            this.hideLoading();
        }
    }

    async createDoorMarker(description, targetRoomId, position) {
        if (!this.currentRoomId) return;
        
        const roomObj = this.rooms.get(this.currentRoomId);
        const doorId = `door_${Date.now()}`;
        
        // Create door object with spatial position and special targetRoomId property
        const doorObject = {
            id: doorId,
            name: description,
            information: `Door leading to ${this.rooms.get(targetRoomId)?.name || 'another room'}`,
            position: position || { x: 0, y: 0, z: 500 }, // Updated default position
            targetRoomId: targetRoomId // This marks it as a door for rendering
        };
        
        roomObj.objects.set(doorId, doorObject);
        
        // Add 3D marker immediately
        this.add3DObjectMarker(doorObject);
        this.updateCounts();
        
        // Save door marker as an object with special properties
        await this.saveObject(this.currentRoomId, doorObject);
        
        this.log('🚪 Door marker created and rendered:', { id: doorId, description, targetRoomId, position });
    }

    async createConnection(description, targetRoomId) {
        if (!this.currentRoomId || !this.rooms.has(targetRoomId)) return;
        
        const currentRoom = this.rooms.get(this.currentRoomId);
        const targetRoom = this.rooms.get(targetRoomId);
        
        // Create bidirectional connections
        const connectionId1 = `conn_${Date.now()}_1`;
        const connectionId2 = `conn_${Date.now()}_2`;
        
        // Connection from current room to target room
        const forwardConnection = {
            id: connectionId1,
            description: description,
            targetRoomId: targetRoomId,
            bidirectional: true
        };
        
        // Connection from target room back to current room
        const backConnection = {
            id: connectionId2,
            description: `Door back to ${currentRoom.name}`,
            targetRoomId: this.currentRoomId,
            bidirectional: true
        };
        
        currentRoom.connections.set(connectionId1, forwardConnection);
        targetRoom.connections.set(connectionId2, backConnection);
        
        // Create spatial door marker in current room at clicked position
        if (this.pendingCreationPosition) {
            await this.createDoorMarker(description, targetRoomId, this.pendingCreationPosition);
            
            // Create corresponding door marker in target room
            const backDoorPosition = {
                x: -this.pendingCreationPosition.x * 0.8,
                y: this.pendingCreationPosition.y,
                z: -this.pendingCreationPosition.z * 0.8
            };
            
            const backDoorObject = {
                id: `door_${Date.now()}_back`,
                name: `Door back to ${currentRoom.name}`,
                information: `Door leading back to ${currentRoom.name}`,
                position: backDoorPosition,
                targetRoomId: this.currentRoomId
            };
            
            targetRoom.objects.set(backDoorObject.id, backDoorObject);
            await this.saveObject(targetRoomId, backDoorObject);
            
            this.pendingCreationPosition = null;
        }
        
        // Save to database
        await this.saveConnection(this.currentRoomId, forwardConnection);
        await this.saveConnection(targetRoomId, backConnection);
        
        this.log('🔗 Bidirectional connection created between existing rooms');
        
        // Update display to show the new door marker
        this.displayRoom(currentRoom);
    }

    navigateToRoom(roomId) {
        if (!this.rooms.has(roomId)) return;
        
        this.currentRoomId = roomId;
        const room = this.rooms.get(roomId);
        this.displayRoom(room);
        
        // Save current room state
        this.saveUserState();
        
        this.log('🚶 Navigated to room:', room.name);
    }

    showWelcomeState() {
        this.roomTitle.textContent = 'Memory Palace';
        
        // Show placeholder in Three.js scene
        if (this.sphere && this.sphere.material) {
            this.sphere.material.map = null;
            this.sphere.material.needsUpdate = true;
        }
        
        // Add welcome text overlay
        const welcomeOverlay = document.createElement('div');
        welcomeOverlay.className = 'placeholder-text';
        welcomeOverlay.textContent = "Say \"Create a room…\" to begin your immersive memory palace";
        welcomeOverlay.style.position = 'absolute';
        welcomeOverlay.style.top = '50%';
        welcomeOverlay.style.left = '50%';
        welcomeOverlay.style.transform = 'translate(-50%, -50%)';
        welcomeOverlay.style.zIndex = '10';
        welcomeOverlay.style.pointerEvents = 'none';
        
        this.roomImage.appendChild(welcomeOverlay);
        
        this.updateCounts();
    }

    updateCounts() {
        const totalObjects = Array.from(this.rooms.values()).reduce((total, room) => total + room.objects.size, 0);
        this.roomCount.textContent = `${this.rooms.size} rooms`;
        this.objectCount.textContent = `${totalObjects} objects`;
        
        // Update autopilot status
        const autopilotStatus = document.getElementById('autopilot-status');
        if (this.isAutopilot) {
            autopilotStatus.textContent = `🤖 Autopilot ${this.autopilotSteps}/${this.maxAutopilotSteps}`;
            autopilotStatus.style.display = 'inline';
        } else {
            autopilotStatus.style.display = 'none';
        }
    }

    showLoading(message) {
        this.loadingText.textContent = message;
        this.loadingOverlay.style.display = 'flex';
    }

    hideLoading() {
        this.loadingOverlay.style.display = 'none';
    }

    displayRoom(room) {
        this.log(`🖼️ Displaying 360-degree skybox room: [${room.name}] ${room.imageUrl}`, room);
        this.roomTitle.textContent = room.name;
        
        // Remove any welcome overlay
        const existingOverlay = this.roomImage.querySelector('.placeholder-text');
        if (existingOverlay) {
            existingOverlay.remove();
        }
        
        // Load skybox texture
        this.loadSkyboxTexture(room.imageUrl);
        
        // Clear existing 3D object markers
        this.clearObjectMarkers();
        
        // Add 3D object markers for each object in the room (including doors)
        room.objects.forEach(obj => {
            this.add3DObjectMarker(obj);
            this.log('📍 Added marker for:', obj.name, 'isDoor:', !!obj.targetRoomId);
        });
        
        this.roomImage.setAttribute('data-url', room.imageUrl);
        
        this.updateCounts();
        this.log('✅ Skybox room display updated with', room.objects.size, '3D markers (objects + doors)');
    }

    clearObjectMarkers() {
        // Remove existing object markers from scene
        if (this.objectMarkers) {
            this.objectMarkers.forEach(marker => {
                this.scene.remove(marker);
                
                // Remove associated particle system
                if (marker.userData.particleSystem) {
                    this.scene.remove(marker.userData.particleSystem);
                    if (marker.userData.particleSystem.geometry) marker.userData.particleSystem.geometry.dispose();
                    if (marker.userData.particleSystem.material) marker.userData.particleSystem.material.dispose();
                }
                
                if (marker.geometry) marker.geometry.dispose();
                if (marker.material) marker.material.dispose();
            });
        }
        this.objectMarkers = [];
    }

    add3DObjectMarker(obj) {
        // Determine marker type based on object properties
        const isDoor = obj.targetRoomId !== undefined;
        
        // Create appropriate geometry for marker type
        let markerGeometry, markerMaterial;
        
        if (isDoor) {
            // Door markers are larger, rectangular, and golden - dramatically increased scale
            markerGeometry = new THREE.BoxGeometry(200, 300, 10);
            markerMaterial = new THREE.MeshBasicMaterial({
                color: 0xffd700,
                transparent: true,
                opacity: 0.0,
                depthTest: false,
                depthWrite: false,
                wireframe: true,
            });
        } else {
            // Object markers are smaller, spherical, and blue - dramatically increased scale
            markerGeometry = new THREE.SphereGeometry(50, 8, 6);
            markerMaterial = new THREE.MeshBasicMaterial({
                color: 0x4dabf7,
                transparent: true,
                opacity: 0.0,
                depthTest: false,
                depthWrite: false,
                wireframe: true,
            });
        }
        
        const marker = new THREE.Mesh(markerGeometry, markerMaterial);
        
        // Position marker just outside sphere surface for better particle effect visibility
        const baseRadius = 500; // Extended beyond the 500 radius sphere
        
        if (obj.position.x !== undefined && obj.position.y !== undefined && obj.position.z !== undefined) {
            // Use stored 3D coordinates but extend them outward
            const direction = new THREE.Vector3(obj.position.x, obj.position.y, obj.position.z).normalize();
            marker.position.copy(direction.multiplyScalar(baseRadius));
        } else {
            // Convert legacy 2D percentage coordinates to 3D sphere coordinates
            const phi = (obj.position.y / 100) * Math.PI; // Vertical angle
            const theta = ((obj.position.x / 100) * 2 - 1) * Math.PI; // Horizontal angle
            
            marker.position.x = baseRadius * Math.sin(phi) * Math.cos(theta);
            marker.position.y = baseRadius * Math.cos(phi);
            marker.position.z = baseRadius * Math.sin(phi) * Math.sin(theta);
        }
        
        // Create particle system for this marker using the particle manager
        const particleSystem = this.particleManager.createParticleSystem(marker.position, isDoor, false, obj.id);
        this.scene.add(particleSystem);
        
        // Create pulsing animation
        marker.userData = {
            originalScale: marker.scale.clone(),
            objectData: obj,
            isDoor: isDoor,
            time: Math.random() * Math.PI * 2, // Random phase offset
            particleSystem: particleSystem
        };
        
        // Add click interaction
        if (isDoor) {
            marker.userData.onClick = () => {
                this.log('🚪 Door clicked, navigating to:', obj.targetRoomId);
                this.navigateToRoom(obj.targetRoomId);
                const targetRoom = this.rooms.get(obj.targetRoomId);
                this.speakResponse(`Going through ${obj.name}`);
            };
        } else {
            marker.userData.onClick = () => {
                this.speakResponse(`${obj.name}: ${obj.information}`);
            };
        }
        
        this.scene.add(marker);
        
        if (!this.objectMarkers) this.objectMarkers = [];
        this.objectMarkers.push(marker);
        
        this.log('📍 Added 3D marker with particles for:', obj.name, 'type:', isDoor ? 'door' : 'object', 'at position:', marker.position);
    }

    updateObjectMarkers() {
        if (!this.objectMarkers) return;
        
        const time = Date.now() * 0.001;
        
        this.objectMarkers.forEach(marker => {
            // Different pulsing for doors vs objects
            const pulseSpeed = marker.userData.isDoor ? 1.5 : 2;
            const pulseAmount = marker.userData.isDoor ? 0.15 : 0.1;
            
            const pulse = 1; //1 + Math.sin(time * pulseSpeed + marker.userData.time) * pulseAmount;
            marker.scale.copy(marker.userData.originalScale).multiplyScalar(pulse);
            
            // Make markers always face the camera
            marker.lookAt(this.camera.position);
            
            // Update particle system using the particle manager
            if (marker.userData.particleSystem) {
                this.particleManager.updateParticleSystem(marker.userData.particleSystem, time);
            }
        });
        
        // Update mist particle system
        if (this.mistSystem) {
            this.particleManager.updateParticleSystem(this.mistSystem);
        }
    }

    setupThreeJSEventListeners() {
        const canvas = this.renderer.domElement;
        
        // Mouse events
        canvas.addEventListener('pointerdown', this.onPointerDown.bind(this));
        canvas.addEventListener('pointermove', this.onPointerMove.bind(this));
        canvas.addEventListener('pointerup', this.onPointerUp.bind(this));
        
        // Click event for 3D object interaction
        canvas.addEventListener('click', this.on3DObjectClick.bind(this));
        
        // Touch events for mobile
        canvas.addEventListener('touchstart', this.onTouchStart.bind(this));
        canvas.addEventListener('touchmove', this.onTouchMove.bind(this));
        canvas.addEventListener('touchend', this.onTouchEnd.bind(this));
        
        // Prevent context menu
        canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        
        // Handle window resize
        window.addEventListener('resize', this.onWindowResize.bind(this));
        
        // Set initial cursor
        canvas.style.cursor = 'grab';
    }

    onPointerDown(event) {
        if (event.isPrimary === false) return;
        
        this.isUserInteracting = true;
        this.pointerDownTime = Date.now();
        this.onPointerDownMouseX = event.clientX;
        this.onPointerDownMouseY = event.clientY;
        this.onPointerDownLon = this.lon;
        this.onPointerDownLat = this.lat;
        
        this.renderer.domElement.style.cursor = 'grabbing';
        
        // Request device orientation permission on first interaction if needed
        if (this.pendingOrientationPermission) {
            this.pendingOrientationPermission();
            this.pendingOrientationPermission = null;
        }
    }

    onPointerMove(event) {
        if (event.isPrimary === false) return;
        if (!this.isUserInteracting) return;
        
        const deltaX = this.onPointerDownMouseX - event.clientX;
        const deltaY = event.clientY - this.onPointerDownMouseY;
        
        this.lon = deltaX * 0.2 + this.onPointerDownLon;
        this.lat = deltaY * 0.2 + this.onPointerDownLat;
        
        // Constrain horizontal rotation to 90% freedom (prevent viewing directly behind)
        this.lon = Math.max(-135, Math.min(135, this.lon));
        
        // Clamp vertical rotation
        this.lat = Math.max(-85, Math.min(85, this.lat));
    }

    onPointerUp(event) {
        if (event.isPrimary === false) return;
        
        this.isUserInteracting = false;
        this.renderer.domElement.style.cursor = 'grab';
    }

    handleSkyboxClick(e) {
        if (!this.currentRoomId) return;
        
        this.log('🎯 Skybox clicked for object/door creation');
        
        // Calculate mouse coordinates relative to canvas
        const rect = this.renderer.domElement.getBoundingClientRect();
        const mouse = new THREE.Vector2();
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        
        // Raycast to find intersection with skybox sphere
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, this.camera);
        
        const intersects = raycaster.intersectObject(this.sphere);
        
        if (intersects.length > 0) {
            // Store the 3D position where user clicked
            const intersectionPoint = intersects[0].point;
            
            /* @tweakable Distance multiplier for positioning objects/doors outside the skybox sphere */
            const positionMultiplier = 1.02;
            
            // Position object/door slightly outside the sphere surface
            this.pendingCreationPosition = {
                x: intersectionPoint.x * positionMultiplier,
                y: intersectionPoint.y * positionMultiplier, 
                z: intersectionPoint.z * positionMultiplier
            };
            
            this.log('📍 Stored click position for object/door creation:', this.pendingCreationPosition);
            
            // Start voice input to ask user what they want to create
            this.startListening();
            
        } else {
            this.log('⚠️ No skybox intersection found');
            
            /* @tweakable Default fallback position when skybox click fails */
            this.pendingCreationPosition = { x: 0, y: 0, z: 500 };
            
            // Still start voice input with fallback position
            this.startListening();
        }
    }

    on3DObjectClick(e) {
        if (this.isUserInteracting) return; // Don't trigger during drag
        
        const timeSincePointerDown = Date.now() - (this.pointerDownTime || 0);
        if (timeSincePointerDown > 200) return; // Was dragging
        
        const rect = this.renderer.domElement.getBoundingClientRect();
        const mouse = new THREE.Vector2();
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        
        // Raycast to check for object marker clicks first
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, this.camera);
        
        if (this.objectMarkers && this.objectMarkers.length > 0) {
            const intersects = raycaster.intersectObjects(this.objectMarkers);
            if (intersects.length > 0) {
                // Clicked on an object marker
                const clickedMarker = intersects[0].object;
                if (clickedMarker.userData.onClick) {
                    clickedMarker.userData.onClick();
                    return; // Don't proceed to skybox click handling
                }
            }
        }
        
        // If no object was clicked, handle skybox click for new object creation
        if (this.currentRoomId) {
            this.handleSkyboxClick(e);
        }
    }

    onTouchStart(event) {
        if (event.touches.length === 1) {
            this.isUserInteracting = true;
            this.pointerDownTime = Date.now();
            this.onPointerDownMouseX = event.touches[0].clientX;
            this.onPointerDownMouseY = event.touches[0].clientY;
            this.onPointerDownLon = this.lon;
            this.onPointerDownLat = this.lat;
            
            // Request device orientation permission on first touch if needed
            if (this.pendingOrientationPermission) {
                this.pendingOrientationPermission();
                this.pendingOrientationPermission = null;
            }
        }
    }

    onTouchMove(event) {
        if (event.touches.length === 1 && this.isUserInteracting) {
            event.preventDefault();
            
            const deltaX = this.onPointerDownMouseX - event.touches[0].clientX;
            const deltaY = event.touches[0].clientY - this.onPointerDownMouseY;
            
            this.lon = deltaX * 0.2 + this.onPointerDownLon;
            this.lat = deltaY * 0.2 + this.onPointerDownLat;
            
            // Constrain horizontal rotation to 90% freedom (prevent viewing directly behind)
            this.lon = Math.max(-135, Math.min(135, this.lon));
            
            // Clamp vertical rotation
            this.lat = Math.max(-85, Math.min(85, this.lat));
        }
    }

    onTouchEnd(event) {
        this.isUserInteracting = false;
    }

    onWindowResize() {
        const container = this.roomImage;
        this.camera.aspect = container.clientWidth / container.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(container.clientWidth, container.clientHeight);
    }

    animate() {
        requestAnimationFrame(this.animate.bind(this));
        this.update();
        this.updateObjectMarkers();
        this.renderer.render(this.scene, this.camera);
    }

    update() {
        // Constrain horizontal rotation to 90% freedom (prevent viewing directly behind)
        this.lon = Math.max(-135, Math.min(135, this.lon));
        
        // Clamp vertical rotation
        this.lat = Math.max(-85, Math.min(85, this.lat));
        this.phi = THREE.MathUtils.degToRad(90 - this.lat);
        this.theta = THREE.MathUtils.degToRad(this.lon);
        
        const x = 500 * Math.sin(this.phi) * Math.cos(this.theta);
        const y = 500 * Math.cos(this.phi);
        const z = 500 * Math.sin(this.phi) * Math.sin(this.theta);
        
        this.camera.lookAt(x, y, z);
        
        // Update compass visibility and direction
        if (this.compassGroup) {
            this.updateCompass();
        }
    }

    updateCompass() {
        // Calculate compass visibility based on camera pitch (looking down - negative values)
        const lookDownAngle = Math.max(0, -this.lat * Math.PI / 180); // Convert degrees to radians, only negative values
        const compassOpacity = Math.min(0.9, lookDownAngle / 0.5); // Fade in over ~30 degrees, max 90% opacity
        
        // Update compass plane opacity
        if (this.compassPlane && this.compassPlane.material) {
            this.compassPlane.material.opacity = compassOpacity;
        }
        
        // Update center indicator opacity
        if (this.compassCenter && this.compassCenter.material) {
            this.compassCenter.material.opacity = compassOpacity * 0.6;
        }
        
        // Update direction indicator
        if (this.directionIndicator) {
            // Point in current facing direction (convert lon to radians)
            this.directionIndicator.rotation.z = -this.lon * Math.PI / 180 + Math.PI / 2;
            this.directionIndicator.material.opacity = compassOpacity * 0.9;
            
            // Position slightly ahead of center
            const indicatorDistance = 4;
            const facingAngle = -this.lon * Math.PI / 180 + Math.PI / 2;
            this.directionIndicator.position.x = Math.cos(facingAngle) * indicatorDistance;
            this.directionIndicator.position.z = Math.sin(facingAngle) * indicatorDistance;
        }
        
        // Keep compass centered under camera
        if (this.compassGroup) {
            this.compassGroup.position.x = this.camera.position.x;
            this.compassGroup.position.z = this.camera.position.z;
        }
    }

    async deletePalace() {
        this.log('🗑️ Starting palace deletion process...');
        this.showLoading('Deleting your Memory Palace...');
        
        try {
            // Get all data for this user
            const rooms = await room.collection('rooms').filter({ user_id: this.currentUser.id }).getList();
            const objects = await room.collection('objects').filter({ user_id: this.currentUser.id }).getList();
            const connections = await room.collection('connections').filter({ user_id: this.currentUser.id }).getList();
            
            this.log('🗑️ Found data to delete:', {
                rooms: rooms.length,
                objects: objects.length,
                connections: connections.length
            });
            
            // Delete all rooms
            for (const roomData of rooms) {
                await room.collection('rooms').delete(roomData.id);
                this.log('🏠 Deleted room:', roomData.name);
            }
            
            // Delete all objects
            for (const objectData of objects) {
                await room.collection('objects').delete(objectData.id);
                this.log('📦 Deleted object:', objectData.name);
            }
            
            // Delete all connections
            for (const connectionData of connections) {
                await room.collection('connections').delete(connectionData.id);
                this.log('🔗 Deleted connection:', connectionData.id);
            }
            
            // Reset user state
            await room.collection('user_state').upsert({
                id: this.currentUser.id,
                current_room_id: null,
                room_counter: 0,
                object_counter: 0
            });
            
            // Reset local state
            this.rooms.clear();
            this.currentRoomId = null;
            this.roomCounter = 0;
            this.objectCounter = 0;
            this.conversationContext = [];
            
            // Reset UI
            this.showWelcomeState();
            this.roomImage.innerHTML = '<div class="placeholder-text">Say "Create a room" to begin your memory palace</div>';
            this.imageOverlay.innerHTML = '';
            
            // Close settings panel
            this.settingsPanel.style.display = 'none';
            this.hideLoading();
            this.log('✅ Palace deletion completed successfully');
            
            // Speak confirmation
            await this.speakResponse('Your Memory Palace has been completely deleted. You can now create a new one by saying "create a room".');
            
        } catch (error) {
            this.error('Error deleting palace:', error);
            await this.speakResponse('Sorry, there was an error deleting your Memory Palace. Please try again.');
        } finally {
            this.hideLoading();
        }
    }

    async exportPalace() {
        this.log('📤 Starting palace export...');
        
        try {
            // Collect all palace data
            const exportData = {
                version: '1.0',
                exportDate: new Date().toISOString(),
                user: this.currentUser.username,
                palace: {
                    roomCounter: this.roomCounter,
                    objectCounter: this.objectCounter,
                    currentRoomId: this.currentRoomId,
                    rooms: {},
                    settings: this.settings
                }
            };
            
            // Export rooms with all their data
            for (const [roomId, roomObj] of this.rooms) {
                exportData.palace.rooms[roomId] = {
                    id: roomObj.id,
                    name: roomObj.name,
                    description: roomObj.description,
                    imageUrl: roomObj.imageUrl,
                    objects: {},
                    connections: {}
                };
                
                // Export objects
                for (const [objId, obj] of roomObj.objects) {
                    exportData.palace.rooms[roomId].objects[objId] = {
                        id: obj.id,
                        name: obj.name,
                        information: obj.information,
                        position: obj.position
                    };
                }
                
                // Export connections
                for (const [connId, conn] of roomObj.connections) {
                    exportData.palace.rooms[roomId].connections[connId] = {
                        id: conn.id,
                        description: conn.description,
                        targetRoomId: conn.targetRoomId,
                        bidirectional: conn.bidirectional
                    };
                }
            }
            
            // Create and download JSON file
            const jsonString = JSON.stringify(exportData, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `memory-palace-${this.currentUser.username}-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            this.log('✅ Palace exported successfully');
            await this.speakResponse('Your Memory Palace has been exported successfully. The file has been downloaded to your device.');
            
        } catch (error) {
            this.error('Error exporting palace:', error);
            await this.speakResponse('Sorry, there was an error exporting your Memory Palace. Please try again.');
        }
    }

    async importPalace(file) {
        this.log('📥 Starting palace import from file:', file.name);
        this.showLoading('Importing Memory Palace...');
        
        try {
            const fileContent = await this.readFileAsText(file);
            const importData = JSON.parse(fileContent);
            
            this.log('📊 Import data parsed:', {
                version: importData.version,
                roomCount: Object.keys(importData.palace.rooms || {}).length,
                exportUser: importData.user
            });
            
            // Validate import data structure
            if (!importData.palace || !importData.palace.rooms) {
                throw new Error('Invalid Memory Palace export file format');
            }
            
            // Confirm import (will overwrite existing palace)
            const roomCount = Object.keys(importData.palace.rooms).length;
            const confirmation = confirm(
                `Import Memory Palace from ${importData.user || 'unknown user'}?\n\n` +
                `This will replace your current palace with:\n` +
                `- ${roomCount} rooms\n` +
                `- Export date: ${new Date(importData.exportDate).toLocaleString()}\n\n` +
                `⚠️ Your current palace will be completely replaced!`
            );
            
            if (!confirmation) {
                this.log('❌ Import cancelled by user');
                this.hideLoading();
                return;
            }
            
            // Clear existing palace first
            await this.clearPalaceForImport();
            
            // Import settings if available
            if (importData.palace.settings) {
                this.settings = { ...this.settings, ...importData.palace.settings };
                this.saveSettings();
                this.updateSettingsUI();
                this.log('⚙️ Settings imported and applied');
            }
            
            // Set counters
            this.roomCounter = importData.palace.roomCounter || 0;
            this.objectCounter = importData.palace.objectCounter || 0;
            
            // Import rooms
            const roomsToGenerate = [];
            for (const [roomId, roomData] of Object.entries(importData.palace.rooms)) {
                this.log('🏠 Importing room:', roomData.name);
                
                const roomObj = {
                    id: roomData.id,
                    name: roomData.name,
                    description: roomData.description,
                    imageUrl: roomData.image_url,
                    objects: new Map(),
                    connections: new Map()
                };
                
                // Import objects
                for (const [objId, objData] of Object.entries(roomData.objects || {})) {
                    roomObj.objects.set(objId, {
                        id: objData.id,
                        name: objData.name,
                        information: objData.information,
                        position: { 
                            x: objData.position_x, 
                            y: objData.position_y,
                            z: objData.position_z || 0 // Handle legacy objects without Z coordinate
                        }
                    });
                }
                
                // Import connections
                for (const [connId, connData] of Object.entries(roomData.connections || {})) {
                    roomObj.connections.set(connId, {
                        id: connData.id,
                        description: connData.description,
                        targetRoomId: connData.target_room_id,
                        bidirectional: connData.bidirectional
                    });
                }
                
                this.rooms.set(roomId, roomObj);
                
                // If room has no image URL, mark it for generation
                if (!roomData.image_url) {
                    roomsToGenerate.push(roomObj);
                    this.log('🎨 Room marked for image generation:', roomData.name);
                }
                
                // Save room to database
                await this.saveRoom(roomObj);
                
                // Save objects to database
                for (const objData of roomObj.objects.values()) {
                    await this.saveObject(roomId, objData);
                }
                
                // Save connections to database
                for (const connData of roomObj.connections.values()) {
                    await this.saveConnection(roomId, connData);
                }
            }
            
            // Generate images for rooms that don't have them
            if (roomsToGenerate.length > 0) {
                this.log('🎨 Generating images for', roomsToGenerate.length, 'rooms...');
                
                for (let i = 0; i < roomsToGenerate.length; i++) {
                    const roomObj = roomsToGenerate[i];
                    this.loadingText.textContent = `Generating images... (${i + 1}/${roomsToGenerate.length})`;
                    
                    try {
                        
                        const imageResult = await this.imageGen(roomObj.description);
                        
                        roomObj.imageUrl = imageResult.url;
                        await this.saveRoom(roomObj);
                        
                        this.log('✅ Image generated for room:', roomObj.name);
                        
                    } catch (error) {
                        this.error('Error generating image for room:', roomObj.name, error);
                        // Continue with other rooms even if one fails
                    }
                }
            }
            
            // Set current room
            if (importData.palace.currentRoomId && this.rooms.has(importData.palace.currentRoomId)) {
                this.currentRoomId = importData.palace.currentRoomId;
                this.displayRoom(this.rooms.get(this.currentRoomId));
            } else if (this.rooms.size > 0) {
                // Set first room as current if specified room doesn't exist
                const firstRoomId = Array.from(this.rooms.keys())[0];
                this.currentRoomId = firstRoomId;
                this.displayRoom(this.rooms.get(firstRoomId));
            } else {
                this.showWelcomeState();
            }
            
            // Save user state
            await this.saveUserState();
            
            this.log('✅ Palace import completed successfully');
            
            // Close settings panel
            this.settingsPanel.style.display = 'none';
            
            await this.speakResponse(
                `Memory Palace imported successfully! ${this.rooms.size} rooms have been loaded. ` +
                (roomsToGenerate.length > 0 ? `Generated ${roomsToGenerate.length} new room images. ` : '') +
                'You can now explore your imported palace.'
            );
            
        } catch (error) {
            this.error('Error importing palace:', error);
            let errorMessage = 'Sorry, there was an error importing your Memory Palace.';
            
            if (error.message.includes('Invalid')) {
                errorMessage = 'The selected file is not a valid Memory Palace export.';
            } else if (error instanceof SyntaxError) {
                errorMessage = 'The import file appears to be corrupted or invalid JSON.';
            }
            
            await this.speakResponse(errorMessage + ' Please check the file and try again.');
        } finally {
            this.hideLoading();
        }
    }

    async clearPalaceForImport() {
        this.log('🧹 Clearing existing palace for import...');
        
        try {
            // Get all existing data for this user
            const rooms = await room.collection('rooms').filter({ user_id: this.currentUser.id }).getList();
            const objects = await room.collection('objects').filter({ user_id: this.currentUser.id }).getList();
            const connections = await room.collection('connections').filter({ user_id: this.currentUser.id }).getList();
            
            // Delete all existing data
            for (const roomData of rooms) {
                await room.collection('rooms').delete(roomData.id);
            }
            
            for (const objectData of objects) {
                await room.collection('objects').delete(objectData.id);
            }
            
            for (const connectionData of connections) {
                await room.collection('connections').delete(connectionData.id);
            }
            
            // Clear local state
            this.rooms.clear();
            this.currentRoomId = null;
            this.conversationContext = [];
            
            this.log('✅ Existing palace cleared successfully');
            
        } catch (error) {
            this.error('Error clearing existing palace:', error);
            throw error;
        }
    }

    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                resolve(e.target.result);
            };
            
            reader.onerror = () => {
                reject(new Error('Failed to read file'));
            };
            
            reader.readAsText(file);
        });
    }

    async startAutopilot(initialPrompt) {
        this.log('🚀 Starting autopilot mode with prompt:', initialPrompt);
        
        this.isAutopilot = true;
        this.autopilotSteps = 0;
        this.autopilotPrompt = initialPrompt;
        
        // Show autopilot status
        this.responseText.textContent = `Autopilot mode activated! Creating memory palace based on: "${initialPrompt}"`;
        await this.speakResponse('Autopilot mode activated. I will now automatically create and explore your memory palace.');
        
        // Start the autopilot sequence
        await this.continueAutopilot();
    }

    async continueAutopilot() {
        if (!this.isAutopilot || this.autopilotSteps >= this.maxAutopilotSteps) {
            this.log('🏁 Autopilot sequence completed');
            this.isAutopilot = false;
            this.autopilotSteps = 0;
            
            this.responseText.textContent = 'Autopilot sequence completed. You can now explore your memory palace manually.';
            await this.speakResponse('Autopilot sequence completed. You can now explore your memory palace manually.');
            
            // Reset after a delay
            setTimeout(() => {
                this.resetVoiceState();
            }, 3000);
            
            return;
        }
        
        this.autopilotSteps++;
        this.log(`🤖 Autopilot step ${this.autopilotSteps}/${this.maxAutopilotSteps}`);
        
        // Brief delay between steps
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Get next action from LLM
        const nextAction = await this.getAutopilotAction();
        
        if (nextAction) {
            this.log('🎭 Autopilot executing:', nextAction);
            
            // Show what autopilot is doing
            this.responseText.textContent = `Autopilot step ${this.autopilotSteps}: ${nextAction}`;
            
            // Process the generated action as if it was user input
            await this.processInput(nextAction);
        } else {
            this.log('⚠️ No autopilot action generated, ending sequence');
            this.isAutopilot = false;
            this.autopilotSteps = 0;
        }
    }

    async getAutopilotAction() {
        try {
            const context = this.buildConversationContext('');
            
            const autopilotSystemPrompt = `You are controlling a Memory Palace application in autopilot mode. Generate natural user commands to build and explore a memory palace.

INITIAL USER REQUEST: "${this.autopilotPrompt}"

CURRENT STEP: ${this.autopilotSteps}/${this.maxAutopilotSteps}

AUTOPILOT OBJECTIVES:
1. Create rooms based on the user's initial request
2. Add meaningful memory objects to rooms
3. Create logical connections between rooms
4. Navigate through the palace
5. Enhance existing rooms with more details

CURRENT STATE:
${context.currentRoom ? `
Current Room: "${context.currentRoom.name}"
Description: "${context.currentRoom.description}"
Objects: ${context.currentRoom.objects.map(obj => obj.name).join(', ') || 'None'}
Exits: ${context.currentRoom.availableExits.map(exit => `${exit.doorDescription} to ${exit.targetRoomName}`).join(', ') || 'No doors exist yet - any navigation request will require creating a new door.'}
` : 'No current room - should create one first'}

Total Rooms: ${context.totalRooms}
Total Objects: ${context.totalObjects}

RESPOND WITH A SINGLE NATURAL USER COMMAND that would be appropriate for this step. Examples:
- "Create a cozy library with wooden shelves and a fireplace"
- "Add a red leather book about astronomy to the shelf"
- "Create a door leading to the garden"
- "Go through the wooden door to the garden"
- "Edit this room to add more magical elements"

Respond with only the user command, no explanations.`;

            const completion = await websim.chat.completions.create({
                messages: [
                    {
                        role: "system",
                        content: autopilotSystemPrompt
                    },
                    {
                        role: "user",
                        content: "Generate the next autopilot action:"
                    }
                ],
                temperature: 0.8
            });

            const action = completion.content.trim();
            this.log('🎯 Generated autopilot action:', action);
            
            return action;
            
        } catch (error) {
            this.error('Error generating autopilot action:', error);
            return null;
        }
    }

    async createObject(name, information, position) {
        if (!this.currentRoomId) return;
        
        const roomObj = this.rooms.get(this.currentRoomId);
        const objectId = `obj_${++this.objectCounter}`;
        
        const memoryObject = {
            id: objectId,
            name: name,
            information: information,
            position: position || { x: 0, y: 0, z: 500 } // Default 3D position
        };
        
        roomObj.objects.set(objectId, memoryObject);
        this.add3DObjectMarker(memoryObject);
        this.updateCounts();
        
        // Save to database with 3D coordinates
        await this.saveObject(this.currentRoomId, memoryObject);
        await this.saveUserState();
        
        this.log('📦 Memory object created:', { id: objectId, name, position });
    }

    async loadSkyboxTexture(imageUrl) {
        const loader = new THREE.TextureLoader();
        loader.load(
            imageUrl,
            (texture) => {
                texture.mapping = THREE.EquirectangularReflectionMapping;
                texture.wrapS = THREE.RepeatWrapping;
                texture.wrapT = THREE.ClampToEdgeWrapping;
                texture.offset.x = 0.5; // Shift texture to center the view
                this.sphere.material.map = texture;
                this.sphere.material.needsUpdate = true;
                
                this.log('✅ Skybox texture loaded successfully');
            },
            (progress) => {
                this.log('🔄 Loading skybox texture...', (progress.loaded / progress.total * 100) + '%');
            },
            (error) => {
                this.error(`Error loading skybox texture:`, error);
            }
        );
    }
}

// Initialize the Memory Palace when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.mp = new MemoryPalace();
});
