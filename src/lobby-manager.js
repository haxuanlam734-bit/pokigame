/**
 * LOBBY-MANAGER.JS - Main Lobby / Main Menu System
 * Handles 3D lobby scene, lobby UI, and lobby → gameplay transition
 */

const LobbyManager = {
    isLobbyActive: false,
    sceneRoot: null,
    lobbyCamera: null,
    lobbyPlayerMesh: null,
    crows: [],
    environmentObjects: [],
    
    // Lobby camera state
    cameraDriftTimer: 0,
    lobbyCameraAngle: 0,
    lobbyCameraPitch: 0.18,
    
    // Saved gameplay state for restoration
    savedGameplayState: null,
    
    // Lobby animation timers
    cameraDriftTimer: 0,
    crowAnimationTimer: 0,
    
    init: function() {
        console.log('🏔️ Initializing Lobby Manager...');

        // Create lobby scene root
        this.sceneRoot = new THREE.Group();
        this.sceneRoot.name = 'LobbyScene';

        // Create lobby camera
        this.lobbyCamera = new THREE.PerspectiveCamera(
            60, // FOV
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );

        // Handle window resize for lobby camera
        window.addEventListener('resize', () => {
            this.lobbyCamera.aspect = window.innerWidth / window.innerHeight;
            this.lobbyCamera.updateProjectionMatrix();
        });

        // Setup UI
        this.setupLobbyUI();

        console.log('✅ Lobby Manager initialized');
    },
    
    // ============================================================
    // LOBBY ENTRY / EXIT
    // ============================================================
    enterLobby: function() {
        if (this.isLobbyActive) return;

        console.log('🏔️ Entering Lobby...');

        // Save current gameplay state BEFORE freezing
        this._saveGameplayState();

        // Freeze gameplay simulation
        this._freezeGameplay();

        try {
            // Build lobby environment
            this._buildLobbyEnvironment();

            // Add lobby player
            this._addLobbyPlayer();

            // Add crows
            this._addCrows();

            // Set up lobby camera
            this._setupLobbyCamera();

            // Add lobby scene to renderer
            if (typeof Renderer3D !== 'undefined' && Renderer3D.scene) {
                Renderer3D.scene.add(this.sceneRoot);
            }

            // Show lobby UI
            this._showLobbyUI();

            // Hide gameplay HUD
            this._hideGameplayHUD();

            // Set lobby time (sunset)
            if (typeof TimeCycle !== 'undefined') {
                TimeCycle.debugForceSunset();
            }

            this.isLobbyActive = true;

            // Start lobby update loop
            this._startLobbyLoop();

            console.log('✅ Lobby active');
        } catch (error) {
            console.error('❌ Lobby initialization failed:', error);
            console.error('Error details:', error.message, error.stack);

            // Rollback: restore gameplay state immediately
            console.log('[LOBBY] Rolling back to gameplay due to error...');
            this._unfreezeGameplay();
            this._showGameplayHUD();
            this._cleanupLobbyEnvironment();

            // Ensure game is playable
            if (typeof GameState !== 'undefined') {
                GameState.isRunning = true;
            }

            // If the game hasn't started yet, start it
            if (typeof GameLoop !== 'undefined' && !GameLoop.isRunning) {
                GameLoop.start();
            }

            alert('Lobby initialization failed. Starting gameplay directly. Error: ' + error.message);
        }
    },
    
    exitLobby: function() {
        if (!this.isLobbyActive) return;
        
        console.log('🏔️ Exiting Lobby...');
        
        // Stop lobby loop
        this._stopLobbyLoop();
        
        // Remove lobby scene from renderer
        if (typeof Renderer3D !== 'undefined' && Renderer3D.scene) {
            Renderer3D.scene.remove(this.sceneRoot);
        }

        // Clean up lobby objects (this also restores player mesh)
        this._cleanupLobbyEnvironment();
        
        // Restore gameplay state
        this._restoreGameplayState();
        
        // Unfreeze gameplay simulation
        this._unfreezeGameplay();
        
        // Hide lobby UI
        this._hideLobbyUI();

        // Show gameplay HUD
        this._showGameplayHUD();

        // TimeCycle will resume naturally with gameplay

        this.isLobbyActive = false;
        
        console.log('✅ Returned to gameplay');
    },
    
    // ============================================================
    // GAMEPLAY STATE SAVE / RESTORE
    // ============================================================
    _saveGameplayState: function() {
        if (typeof PlayerController === 'undefined') return;
        
        this.savedGameplayState = {
            position: { ...PlayerController.position },
            velocity: { ...PlayerController.velocity },
            velocityY: PlayerController.velocityY,
            currentMoveAngle: PlayerController.currentMoveAngle,
            targetMoveAngle: PlayerController.targetMoveAngle,
            isGrounded: PlayerController.isGrounded,
            isSprinting: PlayerController.isSprinting,
            isCrouching: PlayerController.isCrouching,
            cameraYaw: InputManager.cameraYaw,
            cameraPitch: InputManager.cameraPitch,
            currentZoomDistance: PlayerController.currentZoomDistance,
            isFirstPersonMode: PlayerController.isFirstPersonMode,
            hasMovementInput: PlayerController.hasMovementInput
        };
        
        console.log('[LOBBY] Saved gameplay state');
    },
    
    _restoreGameplayState: function() {
        if (!this.savedGameplayState || typeof PlayerController === 'undefined') return;
        
        const state = this.savedGameplayState;
        
        // Restore player position
        PlayerController.position = { ...state.position };
        PlayerController.velocity = { ...state.velocity };
        PlayerController.velocityY = state.velocityY;
        PlayerController.currentMoveAngle = state.currentMoveAngle;
        PlayerController.targetMoveAngle = state.targetMoveAngle;
        PlayerController.isGrounded = state.isGrounded;
        PlayerController.isSprinting = state.isSprinting;
        PlayerController.isCrouching = state.isCrouching;
        PlayerController.hasMovementInput = state.hasMovementInput;
        
        // Restore camera
        InputManager.cameraYaw = state.cameraYaw;
        InputManager.cameraPitch = state.cameraPitch;
        PlayerController.currentZoomDistance = state.currentZoomDistance;
        PlayerController.isFirstPersonMode = state.isFirstPersonMode;
        
        // Restore renderer camera
        if (typeof Renderer3D !== 'undefined') {
            Renderer3D.cameraDistance = state.currentZoomDistance;
            Renderer3D.firstPersonThreshold = PlayerController.firstPersonThreshold;
            Renderer3D.eyeHeight = PlayerController.eyeHeight;
        }
        
        console.log('[LOBBY] Restored gameplay state');
    },
    
    // ============================================================
    // FREEZE / UNFREEZE GAMEPLAY
    // ============================================================
    _freezeGameplay: function() {
        if (typeof GameState !== 'undefined') {
            GameState.isRunning = false;
        }
        // TimeCycle doesn't have pause, but we force sunset so it stays there
        console.log('[LOBBY] Gameplay frozen');
    },

    _unfreezeGameplay: function() {
        if (typeof GameState !== 'undefined') {
            GameState.isRunning = true;
        }
        // TimeCycle will resume naturally
        console.log('[LOBBY] Gameplay unfrozen');
    },
    
    // ============================================================
    // BUILD LOBBY ENVIRONMENT
    // ============================================================
    _buildLobbyEnvironment: function() {
        // Clear existing
        this._cleanupLobbyEnvironment();
        
        // Create mountain cliff (foreground)
        this._createMountainCliff();
        
        // Create valley (midground)
        this._createValley();
        
        // Create distant mountains (background)
        this._createDistantMountains();
        
        // Create forest
        this._createForest();
        
        // Create water
        this._createWater();
        
        // Create distant ruins
        this._createDistantRuins();
        
        // Create subtle smoke
        this._createSmoke();
        
        console.log('[LOBBY] Environment built');
    },
    
    _createMountainCliff: function() {
        // Create rocky summit/foreground with irregular geometry
        const cliffGroup = new THREE.Group();
        cliffGroup.name = 'Cliff';

        const rockMat = new THREE.MeshStandardMaterial({
            color: 0x3a3530,
            roughness: 0.9,
            metalness: 0.0,
            flatShading: true
        });

        // Main summit platform - irregular deformed geometry
        const summitGeo = new THREE.ConeGeometry(15, 12, 7, 6, true);
        const summit = new THREE.Mesh(summitGeo, rockMat);
        summit.position.set(0, -10, 0);
        summit.rotation.x = Math.PI * 0.08;
        summit.scale.set(1.3, 0.8, 1.0);
        cliffGroup.add(summit);

        // Secondary rock formations for irregularity
        const rockPositions = [
            { x: 5, y: -11, z: 3, scale: 1.2 },
            { x: -4, y: -11.5, z: 2, scale: 0.9 },
            { x: 2, y: -10.5, z: -4, scale: 0.7 },
            { x: -6, y: -11, z: -2, scale: 1.0 },
            { x: 7, y: -10, z: -3, scale: 0.8 }
        ];

        rockPositions.forEach(pos => {
            const rockGeo = new THREE.DodecahedronGeometry(2 + Math.random(), 0);
            const rock = new THREE.Mesh(rockGeo, rockMat);
            rock.position.set(pos.x, pos.y, pos.z);
            rock.scale.setScalar(pos.scale);
            rock.rotation.set(
                Math.random() * 0.3,
                Math.random() * Math.PI,
                Math.random() * 0.3
            );
            cliffGroup.add(rock);
        });

        // Small foreground rocks near player edge
        for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2 + Math.random() * 0.3;
            const radius = 2 + Math.random() * 5;
            const smallRockGeo = new THREE.DodecahedronGeometry(0.3 + Math.random() * 0.8, 0);
            const smallRock = new THREE.Mesh(smallRockGeo, rockMat);
            smallRock.position.set(
                Math.cos(angle) * radius,
                -11.5 + Math.random() * 0.3,
                Math.sin(angle) * radius
            );
            smallRock.rotation.set(
                Math.random() * 0.5,
                Math.random() * Math.PI * 2,
                Math.random() * 0.5
            );
            cliffGroup.add(smallRock);
        }

        this.sceneRoot.add(cliffGroup);
        this.environmentObjects.push(cliffGroup);
    },
    
    _createValley: function() {
        // Create large valley with uneven terrain
        const valleyGroup = new THREE.Group();
        valleyGroup.name = 'Valley';

        const valleyMat = new THREE.MeshStandardMaterial({
            color: 0x2a3028,
            roughness: 0.95,
            metalness: 0.0,
            flatShading: true
        });

        // Main valley floor with undulation
        const valleyGeo = new THREE.PlaneGeometry(300, 200, 40, 30);
        const valley = new THREE.Mesh(valleyGeo, valleyMat);
        valley.rotation.x = -Math.PI / 2;
        valley.position.set(0, -15, -50);

        // Add some height variation to vertices
        const positions = valleyGeo.attributes.position;
        for (let i = 0; i < positions.count; i++) {
            const x = positions.getX(i);
            const y = positions.getY(i);
            // More variation near edges, less in center
            const distFromCenter = Math.sqrt(x * x + y * y);
            const variation = Math.sin(x * 0.05) * Math.cos(y * 0.05) * (distFromCenter * 0.02);
            positions.setZ(i, variation);
        }
        valleyGeo.computeVertexNormals();

        valleyGroup.add(valley);

        // Add terrain mounds/ridges
        const moundPositions = [
            { x: -30, z: -40, scale: 1.5 },
            { x: 40, z: -35, scale: 1.2 },
            { x: -20, z: -60, scale: 1.0 },
            { x: 25, z: -55, scale: 0.8 },
            { x: 0, z: -70, scale: 1.3 }
        ];

        moundPositions.forEach(pos => {
            const moundGeo = new THREE.ConeGeometry(8 + Math.random() * 4, 6 + Math.random() * 4, 6, 1, true);
            const mound = new THREE.Mesh(moundGeo, valleyMat);
            mound.position.set(pos.x, -13, pos.z);
            mound.scale.setScalar(pos.scale);
            mound.rotation.x = Math.PI * 0.1 + Math.random() * 0.1;
            valleyGroup.add(mound);
        });

        this.sceneRoot.add(valleyGroup);
        this.environmentObjects.push(valleyGroup);
    },
    
    _createDistantMountains: function() {
        // Create handcrafted layered mountain ranges
        const mountainGroup = new THREE.Group();
        mountainGroup.name = 'DistantMountains';

        // 3 layers with different characteristics
        const layers = [
            {
                distance: 70,
                baseColor: 0x2a2520,
                opacity: 0.85,
                mountains: [
                    { x: -40, z: -60, width: 20, height: 35, offset: 0 },
                    { x: 0, z: -65, width: 25, height: 45, offset: 0.2 },
                    { x: 45, z: -55, width: 18, height: 30, offset: -0.1 },
                    { x: -15, z: -70, width: 22, height: 40, offset: 0.15 }
                ]
            },
            {
                distance: 110,
                baseColor: 0x1f1a18,
                opacity: 0.65,
                mountains: [
                    { x: -60, z: -100, width: 30, height: 50, offset: 0 },
                    { x: 20, z: -105, width: 35, height: 55, offset: 0.1 },
                    { x: 70, z: -95, width: 25, height: 40, offset: -0.15 },
                    { x: -20, z: -110, width: 28, height: 48, offset: 0.05 },
                    { x: 50, z: -115, width: 32, height: 52, offset: 0 }
                ]
            },
            {
                distance: 160,
                baseColor: 0x151210,
                opacity: 0.4,
                mountains: [
                    { x: -80, z: -150, width: 40, height: 60, offset: 0 },
                    { x: 0, z: -155, width: 45, height: 65, offset: 0.1 },
                    { x: 90, z: -145, width: 35, height: 55, offset: -0.1 },
                    { x: -40, z: -160, width: 38, height: 58, offset: 0.05 },
                    { x: 60, z: -165, width: 42, height: 62, offset: 0 },
                    { x: 30, z: -170, width: 36, height: 56, offset: 0.15 }
                ]
            }
        ];

        layers.forEach((layer, layerIndex) => {
            const layerGroup = new THREE.Group();

            layer.mountains.forEach(mtn => {
                // Create irregular mountain shape using modified cone
                const mountainGeo = new THREE.ConeGeometry(
                    mtn.width,
                    mtn.height,
                    7 + Math.floor(Math.random() * 3),
                    5 + Math.floor(Math.random() * 2),
                    true
                );

                // Deform vertices for irregularity
                const positions = mountainGeo.attributes.position;
                for (let i = 0; i < positions.count; i++) {
                    const x = positions.getX(i);
                    const y = positions.getY(i);
                    const z = positions.getZ(i);
                    const noise = Math.sin(x * 0.5 + mtn.offset) * Math.cos(z * 0.5) * 2;
                    positions.setX(i, x + noise * 0.3);
                    positions.setZ(i, z + noise * 0.2);
                }
                mountainGeo.computeVertexNormals();

                const mountainMat = new THREE.MeshStandardMaterial({
                    color: layer.baseColor,
                    roughness: 0.9,
                    metalness: 0.0,
                    flatShading: true,
                    transparent: true,
                    opacity: layer.opacity
                });

                const mountain = new THREE.Mesh(mountainGeo, mountainMat);
                mountain.position.set(mtn.x, -15 + mtn.height * 0.4, mtn.z);
                mountain.rotation.x = Math.PI * 0.08 + Math.random() * 0.05;
                mountain.rotation.z = (Math.random() - 0.5) * 0.1;
                layerGroup.add(mountain);
            });

            mountainGroup.add(layerGroup);
        });

        this.sceneRoot.add(mountainGroup);
        this.environmentObjects.push(mountainGroup);
    },

    _createForest: function() {
        // Create varied, natural forest distribution
        const forestGroup = new THREE.Group();
        forestGroup.name = 'Forest';

        // Multiple tree clusters with different densities
        const treeClusters = [
            // Dense forest cluster left
            { x: -25, z: -35, count: 15, spread: 20 },
            // Sparse forest right
            { x: 30, z: -40, count: 8, spread: 15 },
            // Mid-distance forest left
            { x: -40, z: -55, count: 12, spread: 18 },
            // Mid-distance forest right
            { x: 35, z: -60, count: 10, spread: 16 },
            // Background forest line
            { x: 0, z: -75, count: 20, spread: 60 }
        ];

        treeClusters.forEach(cluster => {
            for (let i = 0; i < cluster.count; i++) {
                const angle = Math.random() * Math.PI * 2;
                const radius = Math.random() * cluster.spread;
                const x = cluster.x + Math.cos(angle) * radius;
                const z = cluster.z + Math.sin(angle) * radius;

                // Vary tree types
                const treeType = Math.random();
                let tree;
                if (treeType < 0.6) {
                    tree = this._createPineTree();
                } else if (treeType < 0.85) {
                    tree = this._createOakTree();
                } else {
                    tree = this._createBush();
                }

                tree.position.set(x, -14, z);
                tree.rotation.y = Math.random() * Math.PI * 2;
                const scale = 0.7 + Math.random() * 0.6;
                tree.scale.setScalar(scale);
                forestGroup.add(tree);
            }
        });

        this.sceneRoot.add(forestGroup);
        this.environmentObjects.push(forestGroup);
    },

    _createPineTree: function() {
        // Tall pine tree
        const treeGroup = new THREE.Group();

        const trunkMat = new THREE.MeshStandardMaterial({
            color: 0x2a2520,
            roughness: 0.9,
            metalness: 0.0,
            flatShading: true
        });

        const foliageMat = new THREE.MeshStandardMaterial({
            color: 0x1a3a1a,
            roughness: 0.95,
            metalness: 0.0,
            flatShading: true
        });

        // Trunk
        const trunkGeo = new THREE.CylinderGeometry(0.2, 0.4, 4, 6);
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.y = 2;
        treeGroup.add(trunk);

        // Foliage layers (3 cones)
        for (let i = 0; i < 3; i++) {
            const foliageGeo = new THREE.ConeGeometry(1.5 - i * 0.3, 2.5 - i * 0.5, 5, 1, true);
            const foliage = new THREE.Mesh(foliageGeo, foliageMat);
            foliage.position.y = 3.5 + i * 1.5;
            treeGroup.add(foliage);
        }

        return treeGroup;
    },

    _createOakTree: function() {
        // Broader oak tree
        const treeGroup = new THREE.Group();

        const trunkMat = new THREE.MeshStandardMaterial({
            color: 0x2a2520,
            roughness: 0.9,
            metalness: 0.0,
            flatShading: true
        });

        const foliageMat = new THREE.MeshStandardMaterial({
            color: 0x2a4020,
            roughness: 0.95,
            metalness: 0.0,
            flatShading: true
        });

        // Trunk
        const trunkGeo = new THREE.CylinderGeometry(0.3, 0.5, 3, 6);
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.y = 1.5;
        treeGroup.add(trunk);

        // Foliage (dodecahedron for rounder shape)
        const foliageGeo = new THREE.DodecahedronGeometry(2, 0);
        const foliage = new THREE.Mesh(foliageGeo, foliageMat);
        foliage.position.y = 3.5;
        foliage.scale.y = 0.8;
        treeGroup.add(foliage);

        return treeGroup;
    },

    _createBush: function() {
        // Low bush
        const bushMat = new THREE.MeshStandardMaterial({
            color: 0x1a351a,
            roughness: 0.95,
            metalness: 0.0,
            flatShading: true
        });

        const bushGeo = new THREE.DodecahedronGeometry(0.8 + Math.random() * 0.4, 0);
        const bush = new THREE.Mesh(bushGeo, bushMat);
        bush.position.y = 0.4;
        bush.scale.y = 0.6;

        const bushGroup = new THREE.Group();
        bushGroup.add(bush);
        return bushGroup;
    },
    
    _createWater: function() {
        // Create winding river in valley
        const waterGroup = new THREE.Group();
        waterGroup.name = 'Water';

        const waterMat = new THREE.MeshStandardMaterial({
            color: 0x1a2a3a,
            roughness: 0.1,
            metalness: 0.3,
            transparent: true,
            opacity: 0.7,
            flatShading: true
        });

        // Main river body - curved shape using multiple segments
        const riverSegments = [
            { x: -20, z: -30, width: 8 },
            { x: -10, z: -40, width: 10 },
            { x: 0, z: -50, width: 12 },
            { x: 10, z: -60, width: 10 },
            { x: 20, z: -70, width: 8 }
        ];

        riverSegments.forEach(seg => {
            const waterGeo = new THREE.PlaneGeometry(seg.width, 15, 8, 8);
            const water = new THREE.Mesh(waterGeo, waterMat);
            water.rotation.x = -Math.PI / 2;
            water.position.set(seg.x, -14.8, seg.z);
            water.rotation.z = Math.PI * 0.05; // Slight curve
            waterGroup.add(water);
        });

        // Small lake near mountains
        const lakeGeo = new THREE.CircleGeometry(15, 16);
        const lake = new THREE.Mesh(lakeGeo, waterMat);
        lake.rotation.x = -Math.PI / 2;
        lake.position.set(25, -14.7, -55);
        waterGroup.add(lake);

        this.sceneRoot.add(waterGroup);
        this.environmentObjects.push(waterGroup);
    },
    
    _createDistantRuins: function() {
        // Small distant ruins - signs of collapsed civilization
        const ruinsGroup = new THREE.Group();
        ruinsGroup.name = 'DistantRuins';
        
        // Small ruined building
        const ruinGeo = new THREE.BoxGeometry(3, 2, 4);
        const ruinMat = new THREE.MeshStandardMaterial({
            color: 0x2a2020,
            roughness: 0.9,
            metalness: 0.0,
            flatShading: true
        });
        
        const ruin = new THREE.Mesh(ruinGeo, ruinMat);
        ruin.position.set(25, -9, -55);
        ruin.rotation.y = Math.PI * 0.3;
        ruinsGroup.add(ruin);
        
        // Another ruin
        const ruin2 = new THREE.Mesh(ruinGeo, ruinMat.clone());
        ruin2.position.set(-30, -9, -60);
        ruin2.rotation.y = -Math.PI * 0.2;
        ruinsGroup.add(ruin2);
        
        this.sceneRoot.add(ruinsGroup);
        this.environmentObjects.push(ruinsGroup);
    },
    
    _createSmoke: function() {
        // Subtle smoke column from distant ruins
        const smokeGeo = new THREE.ConeGeometry(2, 8, 4, 8);
        const smokeMat = new THREE.MeshBasicMaterial({
            color: 0x333333,
            transparent: true,
            opacity: 0.15,
            depthWrite: false
        });
        
        const smoke = new THREE.Mesh(smokeGeo, smokeMat);
        smoke.position.set(25, -5, -55);
        smoke.rotation.x = Math.PI / 6;
        
        this.sceneRoot.add(smoke);
        this.environmentObjects.push(smoke);
    },
    
    _cleanupLobbyEnvironment: function() {
        // Remove all environment objects
        this.environmentObjects.forEach(obj => {
            this.sceneRoot.remove(obj);
        });
        this.environmentObjects = [];

        // Remove crows
        this.crows.forEach(crow => {
            this.sceneRoot.remove(crow);
        });
        this.crows = [];

        // Restore player mesh position
        if (this.lobbyPlayerMesh && this._originalPlayerMeshPosition) {
            this.lobbyPlayerMesh.position.copy(this._originalPlayerMeshPosition);
            this.lobbyPlayerMesh.rotation.copy(this._originalPlayerMeshRotation);
            console.log('[LOBBY] Player mesh position restored');
        }
    },
    
    // ============================================================
    // ADD LOBBY PLAYER
    // ============================================================
    _addLobbyPlayer: function() {
        // Temporarily move player to cliff position for lobby
        if (typeof Renderer3D !== 'undefined' && Renderer3D.playerMesh) {
            // Save original position in scene
            this._originalPlayerMeshPosition = Renderer3D.playerMesh.position.clone();
            this._originalPlayerMeshRotation = Renderer3D.playerMesh.rotation.clone();

            // Position player on cliff (foreground)
            Renderer3D.playerMesh.position.set(0, 0, 0);
            Renderer3D.playerMesh.rotation.set(0, Math.PI, 0); // Face sunset

            this.lobbyPlayerMesh = Renderer3D.playerMesh;
            console.log('[LOBBY] Player positioned on cliff');
        }
    },
    
    // ============================================================
    // ADD CROWS
    // ============================================================
    _addCrows: function() {
        // Create 8-12 flying crows for atmosphere
        const crowCount = 8 + Math.floor(Math.random() * 5);

        for (let i = 0; i < crowCount; i++) {
            const crow = this._createCrow();

            // Position crows in sky, preferably against sunset
            const x = -20 + Math.random() * 60; // Spread across width
            const z = -30 - Math.random() * 50; // Depth
            const y = 20 + Math.random() * 25; // Height

            crow.position.set(x, y, z);

            crow.userData = {
                baseX: x,
                baseY: y,
                baseZ: z,
                speedX: (Math.random() - 0.5) * 0.01,
                speedY: (Math.random() - 0.5) * 0.005,
                speedZ: -0.005 - Math.random() * 0.005, // Generally fly away
                amplitude: 1.5 + Math.random() * 2,
                phase: Math.random() * Math.PI * 2,
                flapSpeed: 6 + Math.random() * 4
            };

            this.crows.push(crow);
            this.sceneRoot.add(crow);
        }

        console.log('[LOBBY] Added ' + crowCount + ' crows');
    },
    
    _createCrow: function() {
        // Simple crow silhouette (dark, lightweight)
        const crowGroup = new THREE.Group();

        // Body
        const bodyGeo = new THREE.ConeGeometry(0.3, 1.2, 8);
        const bodyMat = new THREE.MeshBasicMaterial({
            color: 0x111111,
            depthWrite: false
        });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.rotation.x = Math.PI / 2;
        crowGroup.add(body);

        // Wings
        const wingGeo = new THREE.PlaneGeometry(1.5, 0.6);
        const wingMat = new THREE.MeshBasicMaterial({
            color: 0x111111,
            depthWrite: false,
            side: THREE.DoubleSide
        });
        
        const leftWing = new THREE.Mesh(wingGeo, wingMat);
        leftWing.position.set(-0.8, 0.3, 0.4);
        leftWing.rotation.y = -0.3;
        crowGroup.add(leftWing);
        
        const rightWing = new THREE.Mesh(wingGeo, wingMat.clone());
        rightWing.position.set(0.8, 0.3, 0.4);
        rightWing.rotation.y = 0.3;
        crowGroup.add(rightWing);
        
        crowGroup.scale.setScalar(0.8 + Math.random() * 0.4);
        
        return crowGroup;
    },
    
    // ============================================================
    // SETUP LOBBY CAMERA
    // ============================================================
    _setupLobbyCamera: function() {
        // Cinematic composition matching reference:
        // - Player lower-middle, slightly right of center
        // - Sun right-center near horizon
        // - Large sky above
        // - Menu on left side

        this.lobbyCamera.position.set(
            -12, // Offset left for menu space
            6, // Elevated view
            14 // Distance behind player
        );

        // Look toward sunset horizon
        this.lobbyCamera.lookAt(8, 1, -80);

        this.lobbyCameraAngle = Math.atan2(-12, 14);
        this.lobbyCameraPitch = 0.18;
    },
    
    // ============================================================
    // LOBBY UPDATE LOOP
    // ============================================================
    _startLobbyLoop: function() {
        if (this.lobbyLoopId) {
            cancelAnimationFrame(this.lobbyLoopId);
        }
        
        this._lastLobbyTime = performance.now();
        this._lobbyLoop();
    },
    
    _stopLobbyLoop: function() {
        if (this.lobbyLoopId) {
            cancelAnimationFrame(this.lobbyLoopId);
            this.lobbyLoopId = null;
        }
    },
    
    _lobbyLoop: function() {
        if (!this.isLobbyActive) return;

        const now = performance.now();
        const deltaTime = now - this._lastLobbyTime;
        this._lastLobbyTime = now;

        // Update camera drift (subtle motion)
        this._updateLobbyCamera(deltaTime);

        // Update crows
        this._updateCrows(deltaTime);

        // Render the scene with lobby camera
        if (typeof Renderer3D !== 'undefined' && Renderer3D.render) {
            Renderer3D.render();
        }

        // Continue loop
        this.lobbyLoopId = requestAnimationFrame(() => this._lobbyLoop());
    },
    
    _updateLobbyCamera: function(deltaTime) {
        // Subtle cinematic drift
        this.cameraDriftTimer += deltaTime;

        const driftSpeed = 0.0003; // Very slow
        const maxDrift = 0.03; // Small range

        // Horizontal drift
        const horizontalDrift = Math.sin(this.cameraDriftTimer * driftSpeed) * maxDrift;

        // Vertical drift
        const verticalDrift = Math.cos(this.cameraDriftTimer * driftSpeed * 0.7) * maxDrift * 0.5;

        // Apply drift to base position
        this.lobbyCamera.position.x = -12 + horizontalDrift;
        this.lobbyCamera.position.y = 6 + verticalDrift;

        // Look toward sunset with slight drift
        const targetX = 8 + horizontalDrift * 0.5;
        const targetY = 1 + verticalDrift * 0.3;
        this.lobbyCamera.lookAt(targetX, targetY, -80);
    },
    
    _updateCrows: function(deltaTime) {
        this.crowAnimationTimer += deltaTime;

        // Update each crow
        this.crows.forEach(crow => {
            const data = crow.userData;

            // Wing flap animation
            const flap = Math.sin(this.crowAnimationTimer * data.flapSpeed + data.phase) * data.amplitude;

            // Movement
            crow.position.x += data.speedX * deltaTime;
            crow.position.y += data.speedY * deltaTime;
            crow.position.z += data.speedZ * deltaTime;

            // Reset crow if it flies too far
            if (crow.position.z < -100) {
                crow.position.z = -20;
                crow.position.x = -20 + Math.random() * 60;
                crow.position.y = 20 + Math.random() * 25;
            }

            // Wing flap
            if (crow.children[1]) crow.children[1].rotation.z = flap;
            if (crow.children[2]) crow.children[2].rotation.z = -flap;
        });
    },
    
    // ============================================================
    // LOBBY UI
    // ============================================================
    setupLobbyUI: function() {
        // Create lobby UI if it doesn't exist
        if (!document.getElementById('lobby-ui')) {
            const lobbyUI = document.createElement('div');
            lobbyUI.id = 'lobby-ui';
            lobbyUI.innerHTML = `
                <!-- Left Menu -->
                <div class="lobby-menu">
                    <div class="lobby-logo">
                        <div class="logo-main">DEFEND</div>
                        <div class="logo-sub">THE BASE</div>
                        <div class="logo-3d">3D</div>
                    </div>
                    
                    <button class="lobby-btn primary" data-action="play">
                        <span class="btn-icon">▶</span>
                        <span class="btn-text">PLAY</span>
                        <span class="btn-sub">START SURVIVING</span>
                    </button>
                    
                    <button class="lobby-btn" data-action="character">
                        <span class="btn-icon">👤</span>
                        <span class="btn-text">CHARACTER</span>
                        <span class="btn-sub">SELECT YOUR HERO</span>
                    </button>
                    
                    <button class="lobby-btn" data-action="daily-reward">
                        <span class="btn-icon">🎁</span>
                        <span class="btn-text">DAILY REWARD</span>
                        <span class="btn-sub">CLAIM YOUR REWARD</span>
                    </button>
                    
                    <button class="lobby-btn" data-action="server-join">
                        <span class="btn-icon">🌐</span>
                        <span class="btn-text">SERVER JOIN</span>
                        <span class="btn-sub">PLAY WITH YOUR FRIENDS</span>
                    </button>
                    
                    <button class="lobby-btn" data-action="settings">
                        <span class="btn-icon">⚙️</span>
                        <span class="btn-text">SETTINGS</span>
                        <span class="btn-sub">GAME SETTINGS</span>
                    </button>
                    
                    <button class="lobby-btn danger" data-action="exit">
                        <span class="btn-icon">🚪</span>
                        <span class="btn-text">EXIT</span>
                        <span class="btn-sub">QUIT</span>
                    </button>
                </div>
                
                <!-- Right Profile -->
                <div class="lobby-profile">
                    <div class="profile-header">PLAYER PROFILE</div>
                    <div class="profile-stats">
                        <div class="stat-row">
                            <span class="stat-label">NAME</span>
                            <span class="stat-value">SURVIVOR</span>
                        </div>
                        <div class="stat-row">
                            <span class="stat-label">LEVEL</span>
                            <span class="stat-value">1</span>
                        </div>
                        <div class="stat-row">
                            <span class="stat-label">MONEY</span>
                            <span class="stat-value" id="lobby-money">0</span>
                        </div>
                        <div class="stat-row">
                            <span class="stat-label">HEALTH</span>
                            <span class="stat-value" id="lobby-health">100/100</span>
                        </div>
                        <div class="stat-row">
                            <span class="stat-label">STAMINA</span>
                            <span class="stat-value" id="lobby-stamina">100/100</span>
                        </div>
                    </div>
                </div>
                
                <!-- Character Modal -->
                <div class="lobby-modal" id="character-modal">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h2>CHARACTER</h2>
                            <button class="modal-close" data-close="character-modal">×</button>
                        </div>
                        <div class="modal-body">
                            <div class="character-preview">
                                <div class="preview-placeholder">CHARACTER PREVIEW</div>
                            </div>
                            <div class="character-info">
                                <h3>CURRENT CHARACTER</h3>
                                <p>Default Survivor</p>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button class="modal-btn primary" data-close="character-modal">SELECT</button>
                        </div>
                    </div>
                </div>
                
                <!-- Daily Reward Modal -->
                <div class="lobby-modal" id="daily-reward-modal">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h2>DAILY REWARD</h2>
                            <button class="modal-close" data-close="daily-reward-modal">×</button>
                        </div>
                        <div class="modal-body">
                            <div class="reward-content">
                                <div class="reward-icon">🎁</div>
                                <h3>DAILY REWARD</h3>
                                <p id="daily-reward-status">Checking...</p>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button class="modal-btn primary" id="claim-reward-btn">CLAIM</button>
                        </div>
                    </div>
                </div>
                
                <!-- Server Join Modal -->
                <div class="lobby-modal" id="server-join-modal">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h2>SERVER JOIN</h2>
                            <button class="modal-close" data-close="server-join-modal">×</button>
                        </div>
                        <div class="modal-body">
                            <div class="server-input-group">
                                <label>SERVER ID</label>
                                <input type="text" id="server-id-input" placeholder="Enter server ID..." maxlength="20">
                            </div>
                            <div class="server-status" id="server-status"></div>
                        </div>
                        <div class="modal-footer">
                            <button class="modal-btn primary" id="join-server-btn">JOIN SERVER</button>
                        </div>
                    </div>
                </div>
                
                <!-- Settings Modal -->
                <div class="lobby-modal" id="settings-modal">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h2>SETTINGS</h2>
                            <button class="modal-close" data-close="settings-modal">×</button>
                        </div>
                        <div class="modal-body">
                            <div class="settings-content">
                                <p>Settings will reuse existing game settings.</p>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button class="modal-btn primary" data-close="settings-modal">CLOSE</button>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.appendChild(lobbyUI);
            
            // Add CSS styles
            this._addLobbyStyles();
            
            // Bind events
            this._bindLobbyUIEvents();
            
            // Update profile stats
            this._updateProfileStats();
        }
    },
    
    _addLobbyStyles: function() {
        const style = document.createElement('style');
        style.textContent = `
            /* ===== LOBBY UI STYLES ===== */
            #lobby-ui {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                pointer-events: none;
                z-index: 100;
                display: none;
            }
            
            #lobby-ui.active {
                display: flex;
            }
            
            /* ===== LEFT MENU ===== */
            .lobby-menu {
                position: absolute;
                left: 40px;
                top: 50%;
                transform: translateY(-50%);
                display: flex;
                flex-direction: column;
                gap: 12px;
                pointer-events: auto;
            }
            
            .lobby-logo {
                margin-bottom: 30px;
                padding: 20px;
                background: rgba(12, 18, 24, 0.8);
                backdrop-filter: blur(20px);
                -webkit-backdrop-filter: blur(20px);
                border: 1px solid rgba(255, 255,255,0.1);
                border-radius: 12px;
                text-align: center;
            }
            
            .logo-main {
                font-family: 'Orbitron', monospace;
                font-size: 28px;
                font-weight: 800;
                letter-spacing: 2px;
                color: #ffcc00;
                text-shadow: 0 0 20px rgba(255, 204, 0, 0.3);
            }
            
            .logo-sub {
                font-family: 'Orbitron', monospace;
                font-size: 14px;
                font-weight: 600;
                letter-spacing: 3px;
                color: #88aaff;
                margin-top: 4px;
            }
            
            .logo-3d {
                font-family: 'Orbitron', monospace;
                font-size: 10px;
                font-weight: 700;
                letter-spacing: 2px;
                color: #ff6666;
                margin-top: 2px;
            }
            
            .lobby-btn {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 14px 20px;
                background: rgba(12, 18, 24, 0.75);
                backdrop-filter: blur(16px);
                -webkit-backdrop-filter: blur(16px);
                border: 1px solid rgba(255, 255,255,0.1);
                border-radius: 10px;
                cursor: pointer;
                transition: all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);
                pointer-events: auto;
            }
            
            .lobby-btn:hover {
                background: rgba(18, 24, 30, 0.85);
                border-color: rgba(255, 255,255,0.2);
                transform: scale(1.02);
            }
            
            .lobby-btn.primary {
                background: rgba(0, 100, 50, 0.2);
                border-color: rgba(0, 255, 100, 0.3);
            }
            
            .lobby-btn.primary:hover {
                background: rgba(0, 120, 60, 0.3);
                border-color: rgba(0, 255,100, 0.5);
            }
            
            .lobby-btn.danger {
                background: rgba(100, 30, 30, 0.2);
                border-color: rgba(255, 50, 50, 0.3);
            }
            
            .lobby-btn.danger:hover {
                background: rgba(120, 40, 40, 0.3);
                border-color: rgba(255, 70, 70, 0.5);
            }
            
            .btn-icon {
                font-size: 24px;
                line-height: 1;
            }
            
            .btn-text {
                font-family: 'Orbitron', monospace;
                font-size: 16px;
                font-weight: 700;
                letter-spacing: 1.5px;
                color: #ffffff;
            }
            
            .btn-sub {
                font-family: 'Rajdhani', sans-serif;
                font-size: 11px;
                font-weight: 500;
                color: rgba(255,255,255,0.6);
                letter-spacing: 0.5px;
            }
            
            /* ===== RIGHT PROFILE ===== */
            .lobby-profile {
                position: absolute;
                right: 40px;
                top: 40px;
                background: rgba(12, 18, 24, 0.8);
                backdrop-filter: blur(20px);
                -webkit-backdrop-filter: blur(20px);
                border: 1px solid rgba(255,255,255,0.1);
                border-radius: 12px;
                padding: 20px;
                pointer-events: auto;
                min-width: 180px;
            }
            
            .profile-header {
                font-family: 'Orbitron', monospace;
                font-size: 12px;
                font-weight: 700;
                letter-spacing: 1.5px;
                color: #88aaff;
                margin-bottom: 16px;
                padding-bottom: 12px;
                border-bottom: 1px solid rgba(255,255,255,0.1);
            }
            
            .profile-stats {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            
            .stat-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .stat-label {
                font-family: 'Rajdhani', sans-serif;
                font-size: 11px;
                font-weight: 500;
                color: rgba(255,255,255,0.5);
            }
            
            .stat-value {
                font-family: 'Orbitron', monospace;
                font-size: 12px;
                font-weight: 600;
                color: #00ff88;
            }
            
            /* ===== MODALS ===== */
            .lobby-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.8);
                backdrop-filter: blur(8px);
                -webkit-backdrop-filter: blur(8px);
                display: none;
                justify-content: center;
                align-items: center;
                z-index: 200;
                pointer-events: auto;
            }
            
            .lobby-modal.active {
                display: flex;
            }
            
            .modal-content {
                background: rgba(12, 18, 24, 0.95);
                backdrop-filter: blur(24px);
                -webkit-backdrop-filter: blur(24px);
                border: 1px solid rgba(255,255,255,0.15);
                border-radius: 16px;
                padding: 30px;
                max-width: 400px;
                width: 90%;
            }
            
            .modal-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 20px;
                padding-bottom: 15px;
                border-bottom: 1px solid rgba(255,255,255,0.1);
            }
            
            .modal-header h2 {
                font-family: 'Orbitron', monospace;
                font-size: 18px;
                font-weight: 700;
                letter-spacing: 2px;
                color: #ffcc00;
                margin: 0;
            }
            
            .modal-close {
            background: transparent;
            border: 1px solid rgba(255,255,255,0.2);
            color: rgba(255,255,255,0.6);
            font-size: 20px;
            width: 32px;
            height: 32px;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .modal-close:hover {
            background: rgba(255,50,50,0.1);
            border-color: rgba(255,50,50,0.4);
            color: rgba(255,255,255,0.9);
        }

        .modal-body {
                color: #ffffff;
                font-family: 'Rajdhani', sans-serif;
            }
            
            .modal-body h3 {
                font-family: 'Orbitron', monospace;
                font-size: 16px;
                font-weight: 600;
                color: #88aaff;
                margin-bottom: 8px;
            }
            
            .modal-body p {
                color: rgba(255,255,255,0.7);
                line-height: 1.5;
            }
            
            .character-preview,
            .reward-content {
                background: rgba(0,0,0,0.3);
                border-radius: 12px;
                padding: 30px;
                text-align: center;
                margin-bottom: 16px;
            }
            
            .preview-placeholder {
                font-family: 'Orbitron', monospace;
                font-size:14px;
                color: rgba(255,255,255,0.3);
                padding: 40px 20px;
                border: 1px dashed rgba(255,255,255,0.2);
            }
            
            .reward-icon {
                font-size: 48px;
                margin-bottom: 12px;
            }
            
            .server-input-group {
                margin-bottom: 16px;
            }
            
            .server-input-group label {
                display: block;
                font-family: 'Rajdhani', sans-serif;
                font-size: 12px;
                font-weight: 500;
                color: rgba(255,255,255,0.6);
                margin-bottom: 8px;
            }
            
            #server-id-input {
                width: 100%;
                padding: 12px 16px;
                background: rgba(0,0,0,0.4);
                border: 1px solid rgba(255,255,255,0.1);
                border-radius: 8px;
                color: #ffffff;
                font-family: 'Rajdhani', sans-serif;
                font-size: 14px;
                outline: none;
            }
            
            #server-id-input:focus {
                border-color: rgba(0,100,50,0.5);
            }
            
            .server-status {
                font-family: 'Rajdhani', sans-serif;
                font-size: 12px;
                color: rgba(255,255,255,0.5);
                margin-top: 8px;
            }
            
            .modal-footer {
                display: flex;
                justify-content: flex-end;
                padding-top: 20px;
                border-top: 1px solid rgba(255,255,255,0.1);
            }
            
            .modal-btn {
                padding: 10px 24px;
                background: rgba(0, 100, 50, 0.2);
                border: 1px solid rgba(0,255,100,0.3);
                border-radius: 8px;
                color: #ffffff;
                font-family: 'Orbitron', monospace;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s;
            }
            
            .modal-btn:hover {
                background: rgba(0,120,60,0.3);
                border-color: rgba(0,255,100,0.5);
            }
            
            /* ===== RESPONSIVE ===== */
            @media (max-width: 1280px) {
                .lobby-menu {
                    left: 20px;
                }
                
                .lobby-profile {
                    right: 20px;
                    top: 20px;
                    min-width: 150px;
                }
                
                .lobby-btn {
                    padding: 12px 16px;
                }
                
                .btn-text {
                    font-size: 14px;
                }
                
                .btn-sub {
                    font-size: 10px;
                }
            }
            
            @media (max-width: 768px) {
                .lobby-menu {
                    left: 10px;
                    gap: 8px;
                }
                
                .lobby-profile {
                    right: 10px;
                    top: 10px;
                    min-width: 130px;
                }
                
                .lobby-logo {
                    padding: 15px;
                }
                
                .logo-main {
                    font-size: 22px;
                }
                
                .logo-sub {
                    font-size: 12px;
                }
                
                .logo-3d {
                    font-size: 9px;
                }
                
                .lobby-btn {
                    padding: 10px 14px;
                }
                
                .btn-icon {
                    font-size: 20px;
                }
                
                .btn-text {
                    font-size: 13px;
                }
                
                .btn-sub {
                    display: none;
                }
            }
        `;
        document.head.appendChild(style);
    },
    
    _bindLobbyUIEvents: function() {
        // Button clicks
        document.querySelectorAll('.lobby-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = btn.dataset.action;
                this._handleLobbyAction(action);
            });
        });
        
        // Modal close buttons
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modalId = btn.dataset.close;
                this._closeModal(modalId);
            });
        });
        
        // Claim reward button
        const claimBtn = document.getElementById('claim-reward-btn');
        if (claimBtn) {
            claimBtn.addEventListener('click', () => this._claimDailyReward());
        }
        
        // Join server button
        const joinBtn = document.getElementById('join-server-btn');
        if (joinBtn) {
            joinBtn.addEventListener('click', () => this._joinServer());
        }
        
        // Server input
        const serverInput = document.getElementById('server-id-input');
        if (serverInput) {
            serverInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    this._joinServer();
                }
            });
        }
    },
    
    _handleLobbyAction: function(action) {
        console.log('[LOBBY] Action:', action);
        
        switch (action) {
            case 'play':
                this._startGameplay();
                break;
            case 'character':
                this._openModal('character-modal');
                break;
            case 'daily-reward':
                this._openModal('daily-reward-modal');
                this._checkDailyReward();
                break;
            case 'server-join':
                this._openModal('server-join-modal');
                break;
            case 'settings':
                this._openModal('settings-modal');
                break;
            case 'exit':
                this._exitGame();
                break;
        }
    },
    
    _openModal: function(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
        }
    },
    
    _closeModal: function(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
        }
    },
    
    _checkDailyReward: function() {
        const statusEl = document.getElementById('daily-reward-status');
        const claimBtn = document.getElementById('claim-reward-btn');

        if (!statusEl) return;

        // Check localStorage for last claim date
        const lastClaim = localStorage.getItem('dailyRewardLastClaim');
        const today = new Date().toDateString();

        if (lastClaim === today) {
            statusEl.textContent = 'Already claimed today';
            statusEl.style.color = '#ff6666';
            if (claimBtn) claimBtn.disabled = true;
            return;
        }

        statusEl.textContent = 'Reward available!';
        statusEl.style.color = '#00ff88';
        if (claimBtn) claimBtn.disabled = false;
    },

    _claimDailyReward: function() {
        const statusEl = document.getElementById('daily-reward-status');
        const claimBtn = document.getElementById('claim-reward-btn');

        if (!statusEl || !claimBtn) return;

        const today = new Date().toDateString();

        // Check if already claimed
        const lastClaim = localStorage.getItem('dailyRewardLastClaim');
        if (lastClaim === today) {
            statusEl.textContent = 'Already claimed today';
            statusEl.style.color = '#ff6666';
            return;
        }

        // Award reward
        if (typeof GameState !== 'undefined') {
            GameState.money += 100;
            GameState.saveGame();
        }

        // Mark as claimed
        localStorage.setItem('dailyRewardLastClaim', today);

        statusEl.textContent = 'Claimed!';
        statusEl.style.color = '#00ff88';
        if (claimBtn) claimBtn.disabled = true;

        console.log('[LOBBY] Daily reward claimed: +100 money');
    },
    
    _joinServer: function() {
        const serverInput = document.getElementById('server-id-input');
        const statusEl = document.getElementById('server-status');
        
        if (!serverInput || !statusEl) return;
        
        const serverId = serverInput.value.trim();
        
        if (!serverId) {
            statusEl.textContent = 'Please enter a server ID';
            statusEl.style.color = '#ff6666';
            return;
        }
        
        // For now, show that multiplayer is not available
        statusEl.textContent = 'Multiplayer not available';
        statusEl.style.color = '#ff6666';
        
        console.log('[LOBBY] Server join requested:', serverId);
    },
    
    _startGameplay: function() {
        console.log('[LOBBY] Starting gameplay...');

        // Disable buttons
        document.querySelectorAll('.lobby-btn').forEach(btn => {
            btn.disabled = true;
            btn.style.opacity = '0.5';
        });

        // Fade out lobby UI
        const lobbyUI = document.getElementById('lobby-ui');
        if (lobbyUI) {
            lobbyUI.style.transition = 'opacity 0.5s ease';
            lobbyUI.style.opacity = '0';
        }

        // Transition animation
        this._animateToGameplay();
    },

    _animateToGameplay: function() {
        const duration = 800; // ms
        const startTime = performance.now();
        const startPos = this.lobbyCamera.position.clone();
        const endPos = new THREE.Vector3(-5, 3, 5);

        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Smooth camera movement
            this.lobbyCamera.position.lerpVectors(startPos, endPos, progress);

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                // Transition complete
                setTimeout(() => {
                    this.exitLobby();
                    // Start gameplay after exitLobby completes
                    setTimeout(() => {
                        if (typeof PokiManager !== 'undefined') {
                            PokiManager.gameplayStart();
                        }
                        if (typeof GameLoop !== 'undefined') {
                            GameLoop.start();
                        }
                    }, 100);
                }, 100);
            }
        };

        requestAnimationFrame(animate);
    },
    
    _exitGame: function() {
        console.log('[LOBBY] Exiting game...');
        
        // For now, just show a message
        if (typeof Game !== 'undefined' && Game.showMilitaryToast) {
            Game.showMilitaryToast({
                title: 'EXIT',
                message: 'The game will close in your browser.',
                success: false
            });
        }
        
        // In a real scenario, this would use:
        // window.close() if permitted
        // or show a quit confirmation
    },
    
    // ============================================================
    // SHOW / HIDE UI
    // ============================================================
    _showLobbyUI: function() {
        const lobbyUI = document.getElementById('lobby-ui');
        if (lobbyUI) {
            lobbyUI.classList.add('active');
            lobbyUI.style.opacity = '1';
        }

        // Re-enable buttons
        document.querySelectorAll('.lobby-btn').forEach(btn => {
            btn.disabled = false;
            btn.style.opacity = '1';
        });

        // Update profile stats
        this._updateProfileStats();
    },
    
    _hideLobbyUI: function() {
        const lobbyUI = document.getElementById('lobby-ui');
        if (lobbyUI) {
            lobbyUI.classList.remove('active');
        }
        
        // Close any open modals
        document.querySelectorAll('.lobby-modal.active').forEach(modal => {
            modal.classList.remove('active');
        });
    },
    
    _updateProfileStats: function() {
        if (typeof GameState !== 'undefined') {
            const moneyEl = document.getElementById('lobby-money');
            const healthEl = document.getElementById('lobby-health');
            const staminaEl = document.getElementById('lobby-stamina');
            
            if (moneyEl) moneyEl.textContent = GameState.money;
            if (healthEl) healthEl.textContent = `${GameState.playerHP}/${GameState.playerMaxHP}`;
            if (staminaEl) staminaEl.textContent = `${GameState.stamina}/${GameState.maxStamina}`;
        }
    },
    
    _hideGameplayHUD: function() {
        // Hide gameplay-only HUD
        const gameplayElements = [
            'ui-overlay',
            'wave-hud',
            'weapon-mode',
            'weapon-ammo',
            'crosshair',
            'building-toolbar',
            'grenade-controls',
            'medical-controls',
            'death-overlay',
            'low-health-overlay',
            'low-health-vignette',
            'low-health-text',
            'military-interaction'
        ];
        
        gameplayElements.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });
    },
    
    _showGameplayHUD: function() {
        // Restore gameplay HUD
        const gameplayElements = [
            'ui-overlay',
            'wave-hud',
            'weapon-mode',
            'weapon-ammo',
            'crosshair',
            'building-toolbar',
            'grenade-controls',
            'medical-controls'
        ];

        gameplayElements.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = '';
        });
    }
};

// Export LobbyManager
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LobbyManager;
}
