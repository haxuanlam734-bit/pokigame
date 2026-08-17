/**
 * RENDERER-3D.JS - XÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Â­ lÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â½ render 3D dÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¹ng Three.js
 * TÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â¡o scene 3D, camera, lighting, vÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â  vÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â½ cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡c entity
 */

let Renderer3D = {
    scene: null,
    camera: null,
    renderer: null,
    canvas: null,

    fortress: null,
    walls: [],
    towers: [],
    zombies: [],
    minters: [],
    ground: null,
    player: null,

    // External GLB assets loaded from src/assets/models.
    _assetPromises: [],
    _externalModels: {},
    // Poki runs in a browser, so the first playable frame matters more than
    // loading cinematic source assets (the turret FBX alone is ~84 MB).
    webPerformanceMode: true,
    turretPreview: null,
    _turretAssets: null,

    cameraDistance: 20,
    cameraHeightOffset: 8,
    cameraLookAtHeight: 1.2,

    firstPersonThreshold: 0.8,
    eyeHeight: 1.5,
    isFirstPerson: false,
    _fpTransitionRange: 2.0,

    trees: [],
    rocks: [],

    groundSize: 600,
    worldCenterX: 250,
    worldCenterZ: 250,

    cameraSmoothness: 10.0,
    _smoothedCameraX: 0,
    _smoothedCameraY: 0,
    _smoothedCameraZ: 0,
    _smoothedLookAtX: 0,
    _smoothedLookAtY: 0,
    _smoothedLookAtZ: 0,

    // ---- Danh sÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ch mesh chÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â·n camera (cho collision) ----
    _collisionMeshes: [],
    _autoDefenseTurrets: [],
    _autoDefenseTracers: [],
    _hqInterior: null,
    _externalModels: [],
    _gltfLoader: null,

    // Animation System (Clips, Mixers, Actions)
    playerMixer: null,
    playerActions: {},
    currentPlayerAnim: 'idle',
    _zombieClips: [],
    _zombieModelTemplate: null,

    init: function() {
        console.log('ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€¦Ã‚Â½Ãƒâ€šÃ‚Â¨ KhÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€¦Ã‚Â¸i tÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â¡o Renderer 3D (Three.js)...');
        this.canvas = document.getElementById('gameCanvas');
        if (!this.canvas) {
            this.canvas = document.createElement('canvas');
            document.getElementById('game-container').insertBefore(this.canvas, document.getElementById('game-container').firstChild);
            this.canvas.id = 'gameCanvas';
        }

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color('#1c2a1c');
        this.scene.fog = new THREE.FogExp2('#1c2a1c', 0.012);

        const width = window.innerWidth;
        const height = window.innerHeight;
        this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
        this.camera.position.set(250, 10, 290);
        this.camera.lookAt(250, 1, 280);

        this.renderer = new THREE.WebGLRenderer({
            antialias: false,
            powerPreference: 'high-performance',
            canvas: this.canvas
        });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFShadowMap;
        this.renderer.outputEncoding = THREE.sRGBEncoding;

        // KhÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€¦Ã‚Â¸i tÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â¡o mÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â£ng collision
        this._collisionMeshes = [];
        this._autoDefenseTurrets = [];
        this._autoDefenseTracers = [];
        this._hqInterior = null;

        this.setupLighting();
        this.createGround();
        this.createBoundaryMountains();
        this.createRiver();

        // ---- Äáº I Báº¢N DOANH QUÃ‚N Sá»° ----
        this.buildGrandBase();
        this.preloadCharacterModels();
        this.createPlayer3D();
        this.createForestEnvironment();

        const defaultYaw = 0;
        const defaultPitch = 0.3;
        const horizontalDist = this.cameraDistance * Math.cos(defaultPitch);
        const verticalOffset = this.cameraDistance * Math.sin(defaultPitch) + this.cameraHeightOffset;
        const offsetX = horizontalDist * Math.sin(defaultYaw);
        const offsetZ = horizontalDist * Math.cos(defaultYaw);
        // DÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¹ng ÃƒÆ’Ã¢â‚¬Å¾ÃƒÂ¢Ã¢â€šÂ¬Ã‹Å“ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºng toÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â¡ ÃƒÆ’Ã¢â‚¬Å¾ÃƒÂ¢Ã¢â€šÂ¬Ã‹Å“ÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ spawn cÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Â§a player (250, 280) lÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â m ÃƒÆ’Ã¢â‚¬Å¾ÃƒÂ¢Ã¢â€šÂ¬Ã‹Å“iÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€ Ã¢â‚¬â„¢m neo camera ban
        // ÃƒÆ’Ã¢â‚¬Å¾ÃƒÂ¢Ã¢â€šÂ¬Ã‹Å“ÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â§u ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â spawn ÃƒÆ’Ã¢â‚¬Å¾ÃƒÂ¢Ã¢â€šÂ¬Ã‹Å“ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£ ÃƒÆ’Ã¢â‚¬Å¾ÃƒÂ¢Ã¢â€šÂ¬Ã‹Å“ÃƒÆ’Ã¢â‚¬Â Ãƒâ€šÃ‚Â°ÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Â£c dÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Âi ra sÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢n trÃƒÆ’Ã¢â‚¬Â Ãƒâ€šÃ‚Â°ÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»ÃƒÂ¢Ã¢â€šÂ¬Ã‚Âºc HQ ÃƒÆ’Ã¢â‚¬Å¾ÃƒÂ¢Ã¢â€šÂ¬Ã‹Å“ÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€ Ã¢â‚¬â„¢ cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ khoÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â£ng trÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»ÃƒÂ¢Ã¢â€šÂ¬Ã‹Å“ng, nÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â¿u vÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â«n
        // hardcode 250 ÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€¦Ã‚Â¸ ÃƒÆ’Ã¢â‚¬Å¾ÃƒÂ¢Ã¢â€šÂ¬Ã‹Å“ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢y thÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¬ camera lÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºc khÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€¦Ã‚Â¸i ÃƒÆ’Ã¢â‚¬Å¾ÃƒÂ¢Ã¢â€šÂ¬Ã‹Å“ÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ng sÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â½ lÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â¡i chÃƒÆ’Ã¢â‚¬Å¾Ãƒâ€šÃ‚Â©a ngÃƒÆ’Ã¢â‚¬Â Ãƒâ€šÃ‚Â°ÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Â£c vÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â o
        // xuyÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âªn tÃƒÆ’Ã¢â‚¬Â Ãƒâ€šÃ‚Â°ÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Âng nhÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â  chÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­nh GLB trÃƒÆ’Ã¢â‚¬Â Ãƒâ€šÃ‚Â°ÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»ÃƒÂ¢Ã¢â€šÂ¬Ã‚Âºc khi frame update ÃƒÆ’Ã¢â‚¬Å¾ÃƒÂ¢Ã¢â€šÂ¬Ã‹Å“ÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â§u tiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âªn chÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â¡y.
        this.camera.position.set(250 - offsetX, verticalOffset, 280 - offsetZ);
        this.camera.lookAt(250, this.cameraLookAtHeight, 280);

        this._smoothedCameraX = this.camera.position.x;
        this._smoothedCameraY = this.camera.position.y;
        this._smoothedCameraZ = this.camera.position.z;
        this._smoothedLookAtX = 250;
        this._smoothedLookAtY = this.cameraLookAtHeight;
        this._smoothedLookAtZ = 280;

        window.addEventListener('resize', this.onWindowResize.bind(this));
        console.log('ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ Renderer 3D khÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€¦Ã‚Â¸i tÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â¡o xong');
    },

    setupLighting: function() {
        const ambientLight = new THREE.AmbientLight(0x4a5d45, 0.85);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffe4b5, 0.95);
        directionalLight.position.set(this.worldCenterX + 140, 110, this.worldCenterZ + 50);
        directionalLight.target.position.set(this.worldCenterX, 0, this.worldCenterZ);
        this.scene.add(directionalLight.target);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 1024;
        directionalLight.shadow.mapSize.height = 1024;
        directionalLight.shadow.camera.far = 700;
        directionalLight.shadow.camera.left = -320;
        directionalLight.shadow.camera.right = 320;
        directionalLight.shadow.camera.top = 320;
        directionalLight.shadow.camera.bottom = -320;
        directionalLight.shadow.bias = -0.0005;
        this.scene.add(directionalLight);

        const hemiLight = new THREE.HemisphereLight(0x6b8e5a, 0x3d2f1f, 0.5);
        this.scene.add(hemiLight);
    },

    createGround: function() {
        const groundGeometry = new THREE.PlaneGeometry(this.groundSize, this.groundSize);
        const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x1d4a21 });
        this.ground = new THREE.Mesh(groundGeometry, groundMaterial);
        this.ground.rotation.x = -Math.PI / 2;
        this.ground.position.set(this.worldCenterX, 0, this.worldCenterZ);
        this.ground.castShadow = false;
        this.ground.receiveShadow = true;
        this.scene.add(this.ground);

        const gridHelper = new THREE.GridHelper(this.groundSize, 60, 0x2a6b30, 0x1b5720);
        gridHelper.position.set(this.worldCenterX, 0, this.worldCenterZ);
        this.scene.add(gridHelper);
    },

    createBoundaryMountains: function() {
        this.mountains = [];
        const rockColor = 0x3a3f47;
        const snowColor = 0x8a929e;
        const cx = this.worldCenterX;
        const cz = this.worldCenterZ;
        const boundaryHalf = 280;
        const spacing = 20;
        const jitter = 5;

        const addMountain = (x, z) => {
            const radius = 14 + Math.random() * 10;
            const height = 30 + Math.random() * 26;
            const sides = 5 + Math.floor(Math.random() * 2);
            const group = new THREE.Group();
            const bodyGeo = new THREE.ConeGeometry(radius, height, sides);
            const bodyMat = new THREE.MeshPhongMaterial({ color: rockColor, flatShading: true });
            const body = new THREE.Mesh(bodyGeo, bodyMat);
            body.position.y = height / 2;
            body.castShadow = true;
            body.receiveShadow = true;
            group.add(body);

            const snowHeight = height * (0.22 + Math.random() * 0.12);
            const snowGeo = new THREE.ConeGeometry(radius * 0.55, snowHeight, sides);
            const snowMat = new THREE.MeshPhongMaterial({ color: snowColor, flatShading: true });
            const snow = new THREE.Mesh(snowGeo, snowMat);
            snow.position.y = height - snowHeight * 0.45;
            snow.castShadow = true;
            group.add(snow);

            group.position.set(x + (Math.random() - 0.5) * jitter, 0, z + (Math.random() - 0.5) * jitter);
            group.rotation.y = Math.random() * Math.PI * 2;
            group.scale.setScalar(0.9 + Math.random() * 0.45);
            this.scene.add(group);
            this.mountains.push(group);
        };

        const min = -boundaryHalf;
        const max = boundaryHalf;
        for (let pos = min; pos <= max; pos += spacing) {
            addMountain(cx + pos, cz + min);
            addMountain(cx + pos, cz + max);
            addMountain(cx + min, cz + pos);
            addMountain(cx + max, cz + pos);
        }
        console.log('ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂºÃƒâ€šÃ‚Â°ÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ‚Â DÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£y nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºi biÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âªn map ÃƒÆ’Ã¢â‚¬Å¾ÃƒÂ¢Ã¢â€šÂ¬Ã‹Å“ÃƒÆ’Ã¢â‚¬Â Ãƒâ€šÃ‚Â°ÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Â£c tÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â¡o:', this.mountains.length, 'ngÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Ân nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºi');
    },

    createRiver: function() {
        const cx = this.worldCenterX;
        const cz = this.worldCenterZ;
        const riverWidth = 16;
        const segments = 24;
        const startX = cx - 220;
        const endX = cx + 220;
        const baseZ = cz + 190;

        const points = [];
        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const x = startX + (endX - startX) * t;
            const z = baseZ + Math.sin(t * Math.PI * 2.2) * 32 + Math.cos(t * Math.PI * 1.3) * 14;
            points.push(new THREE.Vector3(x, 0.05, z));
        }

        const positions = [];
        const uvs = [];
        for (let i = 0; i <= segments; i++) {
            const p = points[i];
            const prev = points[Math.max(0, i - 1)];
            const next = points[Math.min(segments, i + 1)];
            const dir = new THREE.Vector3().subVectors(next, prev).normalize();
            const normal = new THREE.Vector3(-dir.z, 0, dir.x);
            const left = new THREE.Vector3().copy(p).addScaledVector(normal, riverWidth / 2);
            const right = new THREE.Vector3().copy(p).addScaledVector(normal, -riverWidth / 2);
            positions.push(left.x, left.y, left.z);
            positions.push(right.x, right.y, right.z);
            uvs.push(0, i / segments);
            uvs.push(1, i / segments);
        }

        const indices = [];
        for (let i = 0; i < segments; i++) {
            const a = i * 2, b = i * 2 + 1, c = i * 2 + 2, d = i * 2 + 3;
            indices.push(a, b, c);
            indices.push(b, d, c);
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();

        const material = new THREE.MeshPhongMaterial({
            color: 0x2b7a78,
            transparent: true,
            opacity: 0.8,
            shininess: 110,
            specular: 0xbfffff,
            side: THREE.DoubleSide
        });

        this.river = new THREE.Mesh(geometry, material);
        this.river.receiveShadow = true;
        this.scene.add(this.river);
        console.log('ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€¦Ã¢â‚¬â„¢Ãƒâ€¦Ã‚Â  DÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â²ng sÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â´ng ÃƒÆ’Ã¢â‚¬Å¾ÃƒÂ¢Ã¢â€šÂ¬Ã‹Å“ÃƒÆ’Ã¢â‚¬Â Ãƒâ€šÃ‚Â°ÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Â£c tÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â¡o');
    },

    // ================================================================
    // ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€šÃ‚ÂÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ÂÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ‚Â ÃƒÆ’Ã¢â‚¬Å¾Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â I BÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â¢N DOANH QUÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡N SÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Â° (GRAND MILITARY BASE)
    // ================================================================

    buildGrandBase: function() {
        const cx = 250, cz = 250;
        console.log('ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€šÃ‚ÂÃƒâ€šÃ‚Â° XÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢y dÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Â±ng Military Complex mÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€¦Ã‚Â¸ rÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ng...');

        // BÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»ÃƒÂ¢Ã¢â€šÂ¬Ã‹Å“ cÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Â¥c tÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ng thÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€ Ã¢â‚¬â„¢ ~180x180, ÃƒÆ’Ã¢â‚¬Å¾ÃƒÂ¢Ã¢â€šÂ¬Ã‹Å“ÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Â§ rÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ng ÃƒÆ’Ã¢â‚¬Å¾ÃƒÂ¢Ã¢â€šÂ¬Ã‹Å“ÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€ Ã¢â‚¬â„¢ ngÃƒÆ’Ã¢â‚¬Â Ãƒâ€šÃ‚Â°ÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Âi chÃƒÆ’Ã¢â‚¬Â Ãƒâ€šÃ‚Â¡i cÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â£m nhÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â­n ÃƒÆ’Ã¢â‚¬Å¾ÃƒÂ¢Ã¢â€šÂ¬Ã‹Å“ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢y lÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â 
        // mÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢t khu cÃƒÆ’Ã¢â‚¬Å¾Ãƒâ€ Ã¢â‚¬â„¢n cÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Â© thÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â­t sÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Â± thay vÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¬ mÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢t "tycoon plot".
        this._militaryBaseBounds = { minX: cx - 88, maxX: cx + 88, minZ: cz - 88, maxZ: cz + 88 };

        // 1. NÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Ân cÃƒÆ’Ã¢â‚¬Å¾Ãƒâ€ Ã¢â‚¬â„¢n cÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Â© + sÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢n bÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âª tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â´ng theo tÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Â«ng phÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢n khu
        this._createConcreteBase(cx, cz, 176);
        this._createBaseRoadNetwork(cx, cz);
        this._createPerimeterLighting(cx, cz);
        this._createPerimeterDefense(cx, cz, 86);

        // 2. Khu trung tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢m: Command HQ + quÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â£ng trÃƒÆ’Ã¢â‚¬Â Ãƒâ€šÃ‚Â°ÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Âng + cÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢t cÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Â
        this._createCommandCenter(cx, cz - 18);
        this._createFlagpole(cx, cz - 3);
        this._createBasePlaza(cx, cz + 3);

        // 3. Khu quÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢n nhÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢n phÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢y
        this._createLargeBarracksArea(cx - 51, cz - 20);
        this._createMessHall(cx - 54, cz + 25);
        this._createMedicalBlock(cx - 25, cz + 27);

        // 4. Khu hÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â­u cÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â§n / kho bÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£i phÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a ÃƒÆ’Ã¢â‚¬Å¾ÃƒÂ¢Ã¢â€šÂ¬Ã‹Å“ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â´ng
        this._createLargeSupplyDepot(cx + 50, cz - 18);
        this._createFuelFarm(cx + 51, cz + 28);
        this._createMotorPool(cx + 50, cz + 55);

        // 5. Khu kÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Â¹ thuÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â­t / nghiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âªn cÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Â©u phÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a bÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â¯c
        this._createResearchFacility(cx + 3, cz - 59);
        this._createVehicleWorkshop(cx - 42, cz - 58);

        // 6. SÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢n huÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â¥n luyÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¡n phÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a nam
        this._createTrainingGround(cx - 42, cz + 58);
        this._createShootingRange(cx + 8, cz + 59);

        // 7. Radar + relay tower ÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€¦Ã‚Â¸ gÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³c cao, tÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â¡o silhouette rÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âµ khi nhÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¬n xa
        this._createRadarStation(cx + 72, cz - 70);
        this._createCommsTower(cx - 72, cz - 70);

        // 8. 4 thÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡p canh lÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»ÃƒÂ¢Ã¢â€šÂ¬Ã‚Âºn vÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â  cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡c chÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»ÃƒÂ¢Ã¢â€šÂ¬Ã‹Å“t phÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Â¥
        const towerOffsets = [
            [-78, -78], [78, -78], [78, 78], [-78, 78],
            [0, -84], [0, 84]
        ];
        towerOffsets.forEach(([dx, dz]) => {
            this._createGuardTower(cx + dx, cz + dz);
        });

        // 9. CÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ng chÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­nh 2 lÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»ÃƒÂ¢Ã¢â€šÂ¬Ã‚Âºp + nhÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â  kiÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€ Ã¢â‚¬â„¢m soÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡t
        this._createMainGate(cx, cz + 86);
        this._createSecondaryGate(cx, cz - 86);

        // 10. CÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â£nh quan quÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢n sÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Â± nhÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Â: sandbag, xe quÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢n sÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Â±, pallet, container
        this._createBaseProps(cx, cz);
        this._registerMilitaryInteractions(cx, cz);

        console.log('ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ Military Complex hoÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â n tÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â¥t!');
    },

    _registerMilitaryInteractions: function(cx, cz) {
        this._militaryInteractions = [
            { id: 'hq', name: 'COMMAND HQ', description: 'NÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ng cÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â¥p cÃƒÆ’Ã¢â‚¬Å¾Ãƒâ€ Ã¢â‚¬â„¢n cÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Â© vÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â  mÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€¦Ã‚Â¸ thÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âªm cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â´ng suÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â¥t kiÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â¿m tiÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Ân.', x: cx, z: cz - 18, radius: 11 },
            { id: 'barracks', name: 'BARRACKS', description: 'TuyÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€ Ã¢â‚¬â„¢n lÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­nh gÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡c vÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â  tÃƒÆ’Ã¢â‚¬Å¾Ãƒâ€ Ã¢â‚¬â„¢ng khÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â£ nÃƒÆ’Ã¢â‚¬Å¾Ãƒâ€ Ã¢â‚¬â„¢ng phÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â²ng thÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Â§ cÃƒÆ’Ã¢â‚¬Å¾Ãƒâ€ Ã¢â‚¬â„¢n cÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Â©.', x: cx - 51 + 6, z: cz - 20 + 6, radius: 10 },
            { id: 'mess', name: 'MESS HALL', description: 'ÃƒÆ’Ã¢â‚¬Å¾ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡n uÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»ÃƒÂ¢Ã¢â€šÂ¬Ã‹Å“ng, hÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œi stamina vÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â  nhÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â­n buff di chuyÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€ Ã¢â‚¬â„¢n.', x: cx - 54, z: cz + 25, radius: 9 },
            { id: 'medical', name: 'MEDICAL', description: 'HÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œi ÃƒÆ’Ã¢â‚¬Å¾ÃƒÂ¢Ã¢â€šÂ¬Ã‹Å“ÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â§y HP vÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â  nhÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â­n lÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ chÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â¯n y tÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â¿ tÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â¡m thÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Âi.', x: cx - 25, z: cz + 27, radius: 9 },
            { id: 'supply', name: 'SUPPLY DEPOT', description: 'Mua ammo vÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â  nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ng cÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â¥p vÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â© khÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­ hiÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¡n tÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â¡i.', x: cx + 50, z: cz - 18, radius: 10 },
            { id: 'fuel', name: 'FUEL FARM', description: 'ÃƒÆ’Ã¢â‚¬Å¾Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢i nhiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âªn liÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¡u thÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â nh tiÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Ân vÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â  tÃƒÆ’Ã¢â‚¬Å¾Ãƒâ€ Ã¢â‚¬â„¢ng thu nhÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â­p thÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Â¥ ÃƒÆ’Ã¢â‚¬Å¾ÃƒÂ¢Ã¢â€šÂ¬Ã‹Å“ÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ng.', x: cx + 51, z: cz + 28, radius: 9 },
            { id: 'motorPool', name: 'MOTOR POOL', description: 'TriÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¡u hÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œi xe vÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â  nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ng tÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»ÃƒÂ¢Ã¢â€šÂ¬Ã‹Å“c ÃƒÆ’Ã¢â‚¬Å¾ÃƒÂ¢Ã¢â€šÂ¬Ã‹Å“ÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ di chuyÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€ Ã¢â‚¬â„¢n.', x: cx + 50, z: cz + 55, radius: 10 },
            { id: 'lab', name: 'RESEARCH LAB', description: 'NghiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âªn cÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Â©u nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ng damage vÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â  hiÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¡u suÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â¥t mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡y in.', x: cx + 3, z: cz - 59, radius: 11 },
            { id: 'workshop', name: 'VEHICLE WORKSHOP', description: 'SÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Â­a xe vÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â  tÃƒÆ’Ã¢â‚¬Å¾Ãƒâ€ Ã¢â‚¬â„¢ng tÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»ÃƒÂ¢Ã¢â€šÂ¬Ã‹Å“c ÃƒÆ’Ã¢â‚¬Å¾ÃƒÂ¢Ã¢â€šÂ¬Ã‹Å“ÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢/giÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â£m cooldown phÃƒÆ’Ã¢â‚¬Â Ãƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â Ãƒâ€šÃ‚Â¡ng tiÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¡n.', x: cx - 42, z: cz - 58, radius: 10 },
            { id: 'training', name: 'TRAINING GROUND', description: 'LuyÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¡n tÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â­p ÃƒÆ’Ã¢â‚¬Å¾ÃƒÂ¢Ã¢â€šÂ¬Ã‹Å“ÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€ Ã¢â‚¬â„¢ tÃƒÆ’Ã¢â‚¬Å¾Ãƒâ€ Ã¢â‚¬â„¢ng weapon XP vÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â  damage.', x: cx - 42, z: cz + 58, radius: 13 },
            { id: 'range', name: 'SHOOTING RANGE', description: 'Test sÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºng, hÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œi ammo vÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â  nhÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â­n buff accuracy.', x: cx + 8, z: cz + 59, radius: 13 },
            { id: 'radar', name: 'RADAR STATION', description: 'QuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©t sÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ng zombie vÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â  phÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡t hiÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¡n boss sÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»ÃƒÂ¢Ã¢â€šÂ¬Ã‚Âºm.', x: cx + 72, z: cz - 70, radius: 9 },
            { id: 'comms', name: 'COMMS TOWER', description: 'NhÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â­n hÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Â£p ÃƒÆ’Ã¢â‚¬Å¾ÃƒÂ¢Ã¢â€šÂ¬Ã‹Å“ÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œng tiÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â¿p tÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â¿ vÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â  phÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â§n thÃƒÆ’Ã¢â‚¬Â Ãƒâ€šÃ‚Â°ÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€¦Ã‚Â¸ng tiÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Ân.', x: cx - 72, z: cz - 70, radius: 9 }
        ];
    },

    updateAutomatedDefenses: function(deltaTime, zombies) { this._updateAutomatedMachineGuns(deltaTime, zombies); },

    getNearbyMilitaryInteraction: function(x, z) {
        if (!Array.isArray(this._militaryInteractions)) return null;
        let best = null;
        let bestDist = Infinity;
        this._militaryInteractions.forEach(item => {
            const dx = x - item.x;
            const dz = z - item.z;
            const dist = Math.sqrt(dx * dx + dz * dz);
            if (dist <= item.radius && dist < bestDist) {
                best = { ...item, distance: dist };
                bestDist = dist;
            }
        });
        return best;
    },

    // --- Helper ÃƒÆ’Ã¢â‚¬Å¾ÃƒÂ¢Ã¢â€šÂ¬Ã‹Å“ÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€ Ã¢â‚¬â„¢ thÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âªm mesh vÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â o danh sÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ch collision ---
    _addCollisionMesh: function(mesh) {
        if (mesh && mesh.isMesh) {
            this._collisionMeshes.push(mesh);
        } else if (mesh && mesh.type === 'Group') {
            mesh.children.forEach(child => {
                if (child.isMesh) this._collisionMeshes.push(child);
            });
        }
    },

    _createConcreteBase: function(cx, cz, size) {
        const half = size / 2;
        const geo = new THREE.BoxGeometry(size, 0.4, size);
        const mat = new THREE.MeshPhongMaterial({ color: 0x2f3640 });
        const base = new THREE.Mesh(geo, mat);
        base.position.set(cx, 0.2, cz);
        base.receiveShadow = true;
        base.castShadow = true;
        this.scene.add(base);
        this._addCollisionMesh(base);

        const edgeMat = new THREE.MeshPhongMaterial({ color: 0x1e272e });
        const edges = new THREE.EdgesGeometry(geo);
        const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x1e272e }));
        line.position.copy(base.position);
        this.scene.add(line);
    },

    _createHelipad: function(cx, cz) {
        const ringGeo = new THREE.RingGeometry(5, 7, 48);
        const ringMat = new THREE.MeshPhongMaterial({ color: 0xfbc531, side: THREE.DoubleSide });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(cx, 0.5, cz);
        ring.receiveShadow = true;
        this.scene.add(ring);

        const hCanvas = document.createElement('canvas');
        hCanvas.width = 256;
        hCanvas.height = 256;
        const ctx = hCanvas.getContext('2d');
        ctx.fillStyle = 'rgba(0,0,0,0)';
        ctx.fillRect(0, 0, 256, 256);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 180px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('H', 128, 128);
        const hTexture = new THREE.CanvasTexture(hCanvas);
        const hMat = new THREE.MeshPhongMaterial({ map: hTexture, transparent: true, side: THREE.DoubleSide });
        const hMesh = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), hMat);
        hMesh.rotation.x = -Math.PI / 2;
        hMesh.position.set(cx, 0.51, cz);
        this.scene.add(hMesh);
    },

    _createBoxBuilding: function(x, z, width, height, depth, bodyColor, accentColor, labelColor, labelText) {
        const group = new THREE.Group();

        const body = new THREE.Mesh(
            new THREE.BoxGeometry(width, height, depth),
            new THREE.MeshPhongMaterial({ color: bodyColor })
        );
        body.position.y = height / 2;
        body.castShadow = true;
        body.receiveShadow = true;
        group.add(body);
        this._addCollisionMesh(body);

        const roof = new THREE.Mesh(
            new THREE.BoxGeometry(width + 0.5, 0.35, depth + 0.5),
            new THREE.MeshPhongMaterial({ color: 0x20252a })
        );
        roof.position.y = height + 0.18;
        roof.castShadow = true;
        group.add(roof);

        const accent = new THREE.Mesh(
            new THREE.BoxGeometry(width + 0.05, 0.18, 0.25),
            new THREE.MeshPhongMaterial({ color: accentColor, emissive: accentColor, emissiveIntensity: 0.15 })
        );
        accent.position.set(0, Math.min(height - 0.5, height * 0.75), depth / 2 + 0.14);
        accent.castShadow = true;
        group.add(accent);

        if (labelText) {
            const label = this._createBuildingSign(labelText, accentColor || 0x74e7ff, Math.min(width - 1.5, 8.0), 0.8);
            label.position.set(0, Math.min(height - 0.55, height * 0.78), depth / 2 + 0.18);
            group.add(label);
        }

        const door = new THREE.Mesh(
            new THREE.BoxGeometry(Math.min(2.2, width * 0.18), Math.min(2.8, height * 0.55), 0.12),
            new THREE.MeshPhongMaterial({ color: 0x11161a })
        );
        door.position.set(0, Math.min(1.4, height * 0.3), depth / 2 + 0.08);
        group.add(door);

        const windowMat = new THREE.MeshPhongMaterial({
            color: labelColor || 0x67d7ff,
            emissive: labelColor || 0x67d7ff,
            emissiveIntensity: 0.25
        });
        const windows = Math.max(2, Math.floor(width / 5));
        for (let i = 0; i < windows; i++) {
            const wx = -width / 2 + (i + 0.5) * (width / windows);
            const win = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.55, 0.1), windowMat);
            win.position.set(wx, height * 0.58, depth / 2 + 0.08);
            group.add(win);
        }

        group.position.set(x, 0, z);
        this.scene.add(group);
        return group;
    },

    _createPavedPad: function(x, z, width, depth, color = 0x353b40) {
        const pad = new THREE.Mesh(
            new THREE.BoxGeometry(width, 0.16, depth),
            new THREE.MeshPhongMaterial({ color })
        );
        pad.position.set(x, 0.08, z);
        pad.receiveShadow = true;
        pad.castShadow = true;
        this.scene.add(pad);
        return pad;
    },

    _createRoadSegment: function(x, z, width, depth, axis = 'x') {
        const road = this._createPavedPad(x, z, axis === 'x' ? width : depth, axis === 'x' ? depth : width, 0x252b30);
        const lineMat = new THREE.MeshPhongMaterial({ color: 0xcfd8dc, emissive: 0x202427, emissiveIntensity: 0.05 });
        const count = Math.max(1, Math.floor((axis === 'x' ? width : depth) / 7));
        for (let i = 0; i < count; i++) {
            const t = (i + 0.5) / count - 0.5;
            const marker = new THREE.Mesh(new THREE.BoxGeometry(
                axis === 'x' ? 3.2 : 0.18,
                0.025,
                axis === 'x' ? 0.18 : 3.2
            ), lineMat);
            if (axis === 'x') marker.position.set(x + t * width, 0.17, z);
            else marker.position.set(x, 0.17, z + t * depth);
            this.scene.add(marker);
        }
        return road;
    },

    _createBaseRoadNetwork: function(cx, cz) {
        this._createRoadSegment(cx, cz + 1, 170, 7, 'x');
        this._createRoadSegment(cx, cz - 38, 160, 7, 'x');
        this._createRoadSegment(cx, cz + 40, 160, 7, 'x');
        this._createRoadSegment(cx - 40, cz, 7, 170, 'z');
        this._createRoadSegment(cx + 40, cz, 7, 170, 'z');
        this._createRoadSegment(cx, cz + 74, 78, 9, 'x');

        const parkingMat = new THREE.MeshPhongMaterial({ color: 0xbfc5c8 });
        for (const side of [-1, 1]) {
            for (let i = -3; i <= 3; i++) {
                const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.025, 5.2), parkingMat);
                stripe.position.set(cx + i * 4.2, 0.18, cz + side * 51);
                this.scene.add(stripe);
            }
        }
    },

    _createBasePlaza: function(cx, cz) {
        const pad = this._createPavedPad(cx, cz + 3, 32, 28, 0x30373c);
        const ring = new THREE.Mesh(
            new THREE.RingGeometry(7.6, 8.2, 48),
            new THREE.MeshPhongMaterial({ color: 0xc7d0d4, side: THREE.DoubleSide })
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(cx, 0.18, cz + 3);
        this.scene.add(ring);

        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const light = new THREE.Mesh(
                new THREE.SphereGeometry(0.14, 8, 8),
                new THREE.MeshPhongMaterial({ color: 0x8de7ff, emissive: 0x8de7ff, emissiveIntensity: 0.75 })
            );
            light.position.set(cx + Math.cos(angle) * 7.9, 0.34, cz + 3 + Math.sin(angle) * 7.9);
            this.scene.add(light);
        }
    },

    _createLargeBarracksArea: function(cx, cz) {
        this._militaryBuildingFunctions = this._militaryBuildingFunctions || {};
        this._militaryBuildingFunctions.barracks = { name: 'Barracks', function: 'Troop housing / future guard NPCs' };
        for (let row = 0; row < 2; row++) {
            for (let col = 0; col < 2; col++) {
                const x = cx + col * 12;
                const z = cz + row * 12;
                this._createBoxBuilding(x, z, 9, 3.6, 7, 0x46504b, 0x6c8f77, 0x9ad1b3, 'BARRACKS');
            }
        }

        const canopy = new THREE.Mesh(
            new THREE.BoxGeometry(29, 0.25, 8),
            new THREE.MeshPhongMaterial({ color: 0x2c3430 })
        );
        canopy.position.set(cx + 5.5, 4.4, cz + 28);
        canopy.castShadow = true;
        this.scene.add(canopy);

        for (let i = 0; i < 6; i++) {
            const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 4.2, 6),
                new THREE.MeshPhongMaterial({ color: 0x707b73 }));
            post.position.set(cx - 7 + i * 5, 2.1, cz + 28);
            post.castShadow = true;
            this.scene.add(post);
        }
    },

    _createMessHall: function(cx, cz) {
        this._militaryBuildingFunctions = this._militaryBuildingFunctions || {};
        this._militaryBuildingFunctions.mess = { name: 'Mess Hall', function: 'Food / stamina systems' };
        this._createBoxBuilding(cx, cz, 15, 4.2, 9, 0x4c574f, 0x8c9d88, 0xb7d5c5, 'MESS HALL');
        const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.8, 2.4, 0.8), new THREE.MeshPhongMaterial({ color: 0x252a2d }));
        chimney.position.set(cx + 4.5, 5.3, cz - 2.0);
        chimney.castShadow = true;
        this.scene.add(chimney);
    },

    _createMedicalBlock: function(cx, cz) {
        this._militaryBuildingFunctions = this._militaryBuildingFunctions || {};
        this._militaryBuildingFunctions.medical = { name: 'Medical', function: 'Healing / respawn services' };
        this._createBoxBuilding(cx, cz, 14, 4.0, 9, 0x54615d, 0xff5555, 0xffffff, 'MEDICAL');
        const crossMat = new THREE.MeshPhongMaterial({ color: 0xf3f6f7, emissive: 0xf3f6f7, emissiveIntensity: 0.08 });
        const v = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.22, 0.28), crossMat);
        const h = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.22, 1.2), crossMat);
        v.position.set(cx, 2.8, cz + 4.55);
        h.position.set(cx, 2.8, cz + 4.55);
        this.scene.add(v, h);
    },

    _createLargeSupplyDepot: function(cx, cz) {
        this._militaryBuildingFunctions = this._militaryBuildingFunctions || {};
        this._militaryBuildingFunctions.supply = { name: 'Supply Depot', function: 'Ammo / equipment logistics' };
        this._createBoxBuilding(cx, cz, 18, 5.0, 12, 0x51575b, 0xd79b2b, 0xffd166, 'SUPPLY DEPOT');
        const awning = new THREE.Mesh(new THREE.BoxGeometry(17, 0.25, 4.8), new THREE.MeshPhongMaterial({ color: 0x2b3034 }));
        awning.position.set(cx, 5.2, cz + 8);
        awning.castShadow = true;
        this.scene.add(awning);

        for (let i = -2; i <= 2; i++) {
            const crate = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.2, 1.6), new THREE.MeshPhongMaterial({ color: i % 2 ? 0x8f6f43 : 0x6d7b58 }));
            crate.position.set(cx + i * 2.6, 0.65, cz + 10);
            crate.castShadow = true;
            this.scene.add(crate);
        }
    },

    _createFuelFarm: function(cx, cz) {
        this._militaryBuildingFunctions = this._militaryBuildingFunctions || {};
        this._militaryBuildingFunctions.fuel = { name: 'Fuel Farm', function: 'Vehicle fuel / generator economy' };
        const pad = this._createPavedPad(cx, cz, 22, 14, 0x2d3337);
        for (let i = -1; i <= 1; i++) {
            const tank = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 4.2, 24),
                new THREE.MeshPhongMaterial({ color: 0x68747a }));
            tank.rotation.z = Math.PI / 2;
            tank.position.set(cx + i * 7, 2.2, cz);
            tank.castShadow = true;
            tank.receiveShadow = true;
            this.scene.add(tank);

            const stripe = new THREE.Mesh(new THREE.TorusGeometry(2.21, 0.1, 8, 24),
                new THREE.MeshPhongMaterial({ color: 0xff9f43 }));
            stripe.rotation.y = Math.PI / 2;
            stripe.position.set(cx + i * 7, 2.2, cz);
            this.scene.add(stripe);
        }

        const sign = new THREE.Mesh(new THREE.BoxGeometry(5, 1.0, 0.15),
            new THREE.MeshPhongMaterial({ color: 0xffa502, emissive: 0xffa502, emissiveIntensity: 0.1 }));
        sign.position.set(cx, 4.8, cz + 7);
        this.scene.add(sign);
    },

    _createMotorPool: function(cx, cz) {
        this._militaryBuildingFunctions = this._militaryBuildingFunctions || {};
        this._militaryBuildingFunctions.motorPool = { name: 'Motor Pool', function: 'Vehicle storage / spawning' };
        this._createPavedPad(cx, cz, 28, 14, 0x2d3337);
        for (let i = -2; i <= 2; i++) {
            const vehicleBody = new THREE.Mesh(new THREE.BoxGeometry(4.3, 1.2, 2.4),
                new THREE.MeshPhongMaterial({ color: i % 2 ? 0x596b54 : 0x4a5a47 }));
            vehicleBody.position.set(cx + i * 5.1, 0.85, cz);
            vehicleBody.castShadow = true;
            this.scene.add(vehicleBody);

            for (const sx of [-1.5, 1.5]) {
                for (const sz of [-1.0, 1.0]) {
                    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.28, 12),
                        new THREE.MeshPhongMaterial({ color: 0x171a1c }));
                    wheel.rotation.z = Math.PI / 2;
                    wheel.position.set(cx + i * 5.1 + sx, 0.45, cz + sz);
                    wheel.castShadow = true;
                    this.scene.add(wheel);
                }
            }
        }
    },

    _createResearchFacility: function(cx, cz) {
        this._militaryBuildingFunctions = this._militaryBuildingFunctions || {};
        this._militaryBuildingFunctions.lab = { name: 'Research Lab', function: 'Zombie research / weapon upgrades' };
        this._createBoxBuilding(cx, cz, 19, 6.5, 13, 0x35454a, 0x45e0e9, 0x8ef6ff, 'RESEARCH LAB');
        const roofUnit = new THREE.Mesh(new THREE.BoxGeometry(7, 1.0, 4),
            new THREE.MeshPhongMaterial({ color: 0x22282b }));
        roofUnit.position.set(cx, 7.0, cz);
        roofUnit.castShadow = true;
        this.scene.add(roofUnit);

        for (let i = -2; i <= 2; i++) {
            const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 2.5, 10),
                new THREE.MeshPhongMaterial({ color: 0x9ae6ef, emissive: 0x4fc3d0, emissiveIntensity: 0.4 }));
            tube.position.set(cx + i * 1.4, 2.4, cz + 6.5);
            tube.castShadow = true;
            this.scene.add(tube);
        }
    },

    _createVehicleWorkshop: function(cx, cz) {
        this._militaryBuildingFunctions = this._militaryBuildingFunctions || {};
        this._militaryBuildingFunctions.workshop = { name: 'Vehicle Workshop', function: 'Vehicle repair / upgrades' };
        this._createBoxBuilding(cx, cz, 18, 5.2, 14, 0x4b514f, 0xf4c542, 0xffe082, 'VEHICLE WORKSHOP');
        const shutter = new THREE.Mesh(new THREE.BoxGeometry(7.5, 3.6, 0.18),
            new THREE.MeshPhongMaterial({ color: 0x252b2e }));
        shutter.position.set(cx, 1.9, cz + 7.05);
        this.scene.add(shutter);
    },

    _createTrainingGround: function(cx, cz) {
        this._militaryBuildingFunctions = this._militaryBuildingFunctions || {};
        this._militaryBuildingFunctions.training = { name: 'Training Ground', function: 'Weapon practice / aim training' };
        this._createPavedPad(cx, cz, 32, 18, 0x2e3437);
        const sandbagMat = new THREE.MeshPhongMaterial({ color: 0x806a4e });
        for (let i = -3; i <= 3; i++) {
            const bag = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.7, 1.0), sandbagMat);
            bag.position.set(cx + i * 4.0, 0.35, cz - 5);
            bag.rotation.y = i * 0.03;
            bag.castShadow = true;
            this.scene.add(bag);
        }

        const targetMat = new THREE.MeshPhongMaterial({ color: 0xdfe6e9 });
        for (let i = -2; i <= 2; i++) {
            const post = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2.6, 0.15), new THREE.MeshPhongMaterial({ color: 0x777f82 }));
            post.position.set(cx + i * 5.0, 1.3, cz + 4);
            post.castShadow = true;
            this.scene.add(post);

            const target = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.18, 16), targetMat);
            target.rotation.x = Math.PI / 2;
            target.position.set(cx + i * 5.0, 1.9, cz + 4);
            this.scene.add(target);
        }
    },

    _createShootingRange: function(cx, cz) {
        this._militaryBuildingFunctions = this._militaryBuildingFunctions || {};
        this._militaryBuildingFunctions.range = { name: 'Shooting Range', function: 'Weapon testing / target practice' };
        this._createPavedPad(cx, cz, 38, 16, 0x282e32);
        const laneMat = new THREE.MeshPhongMaterial({ color: 0xbdc3c7 });
        for (let i = -2; i <= 2; i++) {
            const lane = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 14),
                laneMat);
            lane.position.set(cx + i * 7, 0.18, cz);
            this.scene.add(lane);
        }
    },

    _createRadarStation: function(cx, cz) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.65, 14, 10),
            new THREE.MeshPhongMaterial({ color: 0x68737a }));
        pole.position.set(cx, 7, cz);
        pole.castShadow = true;
        this.scene.add(pole);

        const dish = new THREE.Mesh(new THREE.SphereGeometry(4.2, 20, 10, 0, Math.PI),
            new THREE.MeshPhongMaterial({ color: 0x95a2a8, side: THREE.DoubleSide }));
        dish.scale.y = 0.45;
        dish.position.set(cx, 13.5, cz);
        dish.rotation.z = -0.25;
        dish.castShadow = true;
        this.scene.add(dish);

        const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8),
            new THREE.MeshPhongMaterial({ color: 0xff3b30, emissive: 0xff3b30, emissiveIntensity: 1.0 }));
        beacon.position.set(cx, 16.2, cz);
        this.scene.add(beacon);
    },

    _createCommsTower: function(cx, cz) {
        const towerMat = new THREE.MeshPhongMaterial({ color: 0x6d777d });
        for (const [dx, dz] of [[-1.4,-1.4],[1.4,-1.4],[1.4,1.4],[-1.4,1.4]]) {
            const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 18, 6), towerMat);
            leg.position.set(cx + dx, 9, cz + dz);
            leg.castShadow = true;
            this.scene.add(leg);
        }
        for (let i = 1; i <= 5; i++) {
            const cross = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.07, 3.3), towerMat);
            cross.position.set(cx, i * 3.0, cz);
            cross.rotation.y = Math.PI / 4;
            cross.castShadow = true;
            this.scene.add(cross);
        }
        const light = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8),
            new THREE.MeshPhongMaterial({ color: 0xff3b30, emissive: 0xff3b30, emissiveIntensity: 0.9 }));
        light.position.set(cx, 18.4, cz);
        this.scene.add(light);
    },

    _createPerimeterLighting: function(cx, cz) {
        const poleMat = new THREE.MeshPhongMaterial({ color: 0x5d666b });
        const glowMat = new THREE.MeshPhongMaterial({ color: 0xffdd88, emissive: 0xffcc66, emissiveIntensity: 0.55 });
        const points = [
            [-55,-86], [-20,-86], [20,-86], [55,-86],
            [-86,-50], [-86,0], [-86,50],
            [86,-50], [86,0], [86,50],
            [-55,86], [-20,86], [20,86], [55,86]
        ];
        points.forEach(([dx,dz]) => {
            const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 7.0, 8), poleMat);
            pole.position.set(cx + dx, 3.5, cz + dz);
            pole.castShadow = true;
            this.scene.add(pole);

            const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 8), glowMat);
            lamp.position.set(cx + dx, 7.1, cz + dz);
            this.scene.add(lamp);
        });
    },

    _createPerimeterDefense: function(cx, cz, radius) {
        const wallMat = new THREE.MeshPhongMaterial({ color: 0x687177 });
        const braceMat = new THREE.MeshPhongMaterial({ color: 0x3a4145 });
        const segments = 72;

        for (let i = 0; i < segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            const next = ((i + 1) / segments) * Math.PI * 2;
            const x1 = cx + Math.cos(angle) * radius;
            const z1 = cz + Math.sin(angle) * radius;
            const x2 = cx + Math.cos(next) * radius;
            const z2 = cz + Math.sin(next) * radius;
            const midX = (x1 + x2) / 2;
            const midZ = (z1 + z2) / 2;
            const dist = Math.hypot(x2-x1, z2-z1);

            const wall = new THREE.Mesh(new THREE.BoxGeometry(dist, 4.2, 0.55), wallMat);
            wall.position.set(midX, 2.1, midZ);
            wall.lookAt(x2, 2.1, z2);
            wall.castShadow = true;
            wall.receiveShadow = true;
            this.scene.add(wall);
            this._addCollisionMesh(wall);

            if (i % 3 === 0) {
                const brace = new THREE.Mesh(new THREE.BoxGeometry(0.18, 5.0, 0.18), braceMat);
                brace.position.set(x1, 2.5, z1);
                brace.castShadow = true;
                this.scene.add(brace);
                this._addCollisionMesh(brace);
            }
        }

        const inner = radius - 3.5;
        for (let i = 0; i < segments; i += 2) {
            const angle = (i / segments) * Math.PI * 2;
            const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 2.6, 6),
                new THREE.MeshPhongMaterial({ color: 0x9aa2a7 }));
            post.position.set(cx + Math.cos(angle) * inner, 1.3, cz + Math.sin(angle) * inner);
            post.castShadow = true;
            this.scene.add(post);
        }
    },

    _createSecondaryGate: function(cx, cz) {
        const group = new THREE.Group();
        const gateMat = new THREE.MeshPhongMaterial({ color: 0x4b555a });
        const left = new THREE.Mesh(new THREE.BoxGeometry(7, 3.8, 0.45), gateMat);
        left.position.set(-3.7, 1.9, 0);
        const right = left.clone();
        right.position.x = 3.7;
        group.add(left, right);

        const sign = new THREE.Mesh(new THREE.BoxGeometry(12, 1.5, 0.5),
            new THREE.MeshPhongMaterial({ color: 0x1f272b }));
        sign.position.set(0, 5.0, 0);
        group.add(sign);

        const postMat = new THREE.MeshPhongMaterial({ color: 0x7b858a });
        for (const dx of [-8,8]) {
            const post = new THREE.Mesh(new THREE.BoxGeometry(0.6, 5.8, 0.6), postMat);
            post.position.set(dx, 2.9, 0);
            group.add(post);
        }

        group.position.set(cx, 0, cz);
        this.scene.add(group);
    },

    _createBaseProps: function(cx, cz) {
        const sandbagMat = new THREE.MeshPhongMaterial({ color: 0x75644d });
        const points = [
            [cx - 68, cz + 42], [cx + 67, cz + 43],
            [cx - 66, cz - 42], [cx + 65, cz - 43],
            [cx - 23, cz + 71], [cx + 24, cz + 71]
        ];
        points.forEach(([x,z]) => {
            for (let i = -2; i <= 2; i++) {
                const bag = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.55, 0.75), sandbagMat);
                bag.position.set(x + i * 1.6, 0.28, z);
                bag.rotation.y = i * 0.06;
                bag.castShadow = true;
                this.scene.add(bag);
            }
        });

        const crateMat = new THREE.MeshPhongMaterial({ color: 0x735d3e });
        for (let i = 0; i < 12; i++) {
            const crate = new THREE.Mesh(new THREE.BoxGeometry(1.25, 1.0, 1.25), crateMat);
            const x = cx - 69 + (i % 4) * 2.0;
            const z = cz + 53 + Math.floor(i / 4) * 1.8;
            crate.position.set(x, 0.5, z);
            crate.castShadow = true;
            this.scene.add(crate);
        }
    },

    preloadCharacterModels: function() {
        if (!this._gltfLoader) {
            if (typeof GLTFLoader !== 'undefined') this._gltfLoader = new GLTFLoader();
            else if (typeof THREE !== 'undefined' && typeof THREE.GLTFLoader !== 'undefined') this._gltfLoader = new THREE.GLTFLoader();
        }
        if (!this._gltfLoader) return;

        // 1. Preload Zombie Model Template & Animation Clips
        const zombiePath = 'src/assets/character/zombie/roblox_retro_zombie.glb';
        this._gltfLoader.load(zombiePath, (gltf) => {
            const root = gltf.scene || gltf;
            this._zombieClips = gltf.animations || [];
            if (this._zombieClips.length > 0) {
                console.log('🎬 Zombie GLB có', this._zombieClips.length, 'animation clips:', this._zombieClips.map(a => a.name));
            }

            root.traverse(c => {
                if (c.isMesh) {
                    c.castShadow = true;
                    c.receiveShadow = true;
                    c.frustumCulled = false;
                    if (c.material) {
                        c.material = c.material.clone();
                    }
                }
            });

            // Center & normalize scale (height = 1.75m)
            const box = new THREE.Box3().setFromObject(root);
            const size = new THREE.Vector3();
            const center = new THREE.Vector3();
            box.getSize(size);
            box.getCenter(center);
            const scale = 1.75 / Math.max(size.y, 0.01);
            root.scale.setScalar(scale);
            root.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);

            const wrapper = new THREE.Group();
            wrapper.add(root);
            this._zombieModelTemplate = wrapper;
            console.log('🧟 Đã load model Zombie GLB roblox_retro_zombie.glb');
        }, undefined, (err) => {
            console.warn('Không load được zombie GLB, dùng fallback procedural:', err?.message || err);
        });
    },

    createPlayer3D: function() {
        const group = new THREE.Group();
        group.position.set(250, 0, 280);

        // Visual Rig Container
        const rig = new THREE.Group();
        rig.name = 'playerRig';
        group.add(rig);

        this.scene.add(group);
        this.player = group;
        this.player.rig = rig;

        // Build procedural fallback rig immediately
        this._buildProceduralPlayerRig(rig);

        // Asynchronously load the upgraded Roblox player model GLB
        this._loadPlayerGLB(rig);

        console.log('🚶 Nhân vật Player 3D được khởi tạo');
    },

    setPlayerAnimation: function(name, duration = 0.2) {
        if (!this.playerMixer || !this.playerActions) return;
        const targetAction = this.playerActions[name] || this.playerActions['idle'];
        if (!targetAction || this.currentPlayerAnim === name) return;

        const prevAction = this.playerActions[this.currentPlayerAnim];
        if (prevAction && prevAction !== targetAction) {
            prevAction.fadeOut(duration);
        }
        targetAction.reset().fadeIn(duration).play();
        this.currentPlayerAnim = name;
    },

    updatePlayerAnimationMixer: function(deltaSec) {
        if (this.playerMixer) {
            this.playerMixer.update(deltaSec);
        }
    },

    _buildProceduralPlayerRig: function(rig) {
        const matShirt = new THREE.MeshPhongMaterial({ color: 0x0088ff });
        const matPants = new THREE.MeshPhongMaterial({ color: 0x223344 });
        const matSkin  = new THREE.MeshPhongMaterial({ color: 0xffcc88 });

        // Torso
        const torso = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.75, 0.4), matShirt);
        torso.position.set(0, 1.05, 0);
        torso.castShadow = true;
        rig.add(torso);
        rig.torso = torso;

        // Head
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.48, 0.48), matSkin);
        head.position.set(0, 1.68, 0);
        head.castShadow = true;
        rig.add(head);
        rig.head = head;

        // Right Arm Pivot & Mesh
        const rArmPivot = new THREE.Group();
        rArmPivot.position.set(-0.58, 1.40, 0);
        const rArm = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.75, 0.35), matShirt);
        rArm.position.set(0, -0.35, 0);
        rArm.castShadow = true;
        rArmPivot.add(rArm);
        rig.add(rArmPivot);
        rig.rightArm = rArmPivot;

        // Left Arm Pivot & Mesh
        const lArmPivot = new THREE.Group();
        lArmPivot.position.set(0.58, 1.40, 0);
        const lArm = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.75, 0.35), matShirt);
        lArm.position.set(0, -0.35, 0);
        lArm.castShadow = true;
        lArmPivot.add(lArm);
        rig.add(lArmPivot);
        rig.leftArm = lArmPivot;

        // Right Leg Pivot & Mesh
        const rLegPivot = new THREE.Group();
        rLegPivot.position.set(-0.22, 0.70, 0);
        const rLeg = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.70, 0.36), matPants);
        rLeg.position.set(0, -0.35, 0);
        rLeg.castShadow = true;
        rLegPivot.add(rLeg);
        rig.add(rLegPivot);
        rig.rightLeg = rLegPivot;

        // Left Leg Pivot & Mesh
        const lLegPivot = new THREE.Group();
        lLegPivot.position.set(0.22, 0.70, 0);
        const lLeg = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.70, 0.36), matPants);
        lLeg.position.set(0, -0.35, 0);
        lLeg.castShadow = true;
        lLegPivot.add(lLeg);
        rig.add(lLegPivot);
        rig.leftLeg = lLegPivot;

        // Dedicated Weapon Socket attached to Right Hand
        const rightHandSocket = new THREE.Group();
        rightHandSocket.name = 'rightHandSocket';
        rightHandSocket.position.set(0, -0.65, 0.2);
        rArmPivot.add(rightHandSocket);
        rig.rightHandSocket = rightHandSocket;
        if (this.player) {
            this.player.rightHandSocket = rightHandSocket;
            this.player.body = torso;
            this.player.head = head;
        }
    },

    _loadPlayerGLB: function(rig) {
        if (!this._gltfLoader) {
            if (typeof GLTFLoader !== 'undefined') this._gltfLoader = new GLTFLoader();
            else if (typeof THREE !== 'undefined' && typeof THREE.GLTFLoader !== 'undefined') this._gltfLoader = new THREE.GLTFLoader();
        }
        if (!this._gltfLoader) return;

        const path = 'src/assets/character/player/upgraded_roblox_model.glb';
        this._gltfLoader.load(path, (gltf) => {
            const root = gltf.scene || gltf;

            // 1. Duyệt toàn bộ node/bone của Player model và console.log ra F12
            const boneNames = [];
            root.traverse(c => {
                if (c.name) {
                    boneNames.push(c.name + (c.isBone ? ' [Bone]' : (c.isMesh ? ' [Mesh]' : ' [Group]')));
                }
                if (c.isMesh) {
                    c.castShadow = true;
                    c.receiveShadow = true;
                    c.frustumCulled = false;
                }
            });
            console.log('🦴 [Player Model] Danh sách Nodes / Bones:', boneNames);

            // 2. Khởi tạo AnimationMixer nếu model có Animation Clips
            if (gltf.animations && gltf.animations.length > 0) {
                this.playerMixer = new THREE.AnimationMixer(root);
                this.playerActions = {};
                console.log('🎬 Player GLTF có', gltf.animations.length, 'animation clips:', gltf.animations.map(a => a.name));
                gltf.animations.forEach((clip, idx) => {
                    const name = (clip.name || '').toLowerCase();
                    const action = this.playerMixer.clipAction(clip);
                    if (name.includes('idle')) this.playerActions['idle'] = action;
                    else if (name.includes('run') || name.includes('sprint')) this.playerActions['run'] = action;
                    else if (name.includes('walk')) this.playerActions['walk'] = action;
                    else if (name.includes('attack') || name.includes('shoot') || name.includes('slash')) this.playerActions['attack'] = action;

                    if (idx === 0 && !this.playerActions['idle']) this.playerActions['idle'] = action;
                    if (idx === 1 && !this.playerActions['walk']) this.playerActions['walk'] = action;
                    if (idx === 2 && !this.playerActions['run']) this.playerActions['run'] = action;
                    if (idx === 3 && !this.playerActions['attack']) this.playerActions['attack'] = action;
                });
                this.setPlayerAnimation('idle', 0.1);
            } else {
                console.log('ℹ️ Model Player không có sẵn animation clip, tự động kích hoạt Procedural Animation');
            }

            // 3. Dynamic Bone Matching cho Right Hand Socket
            // Thiết lập thang điểm ưu tiên rõ ràng để tìm node tay phải chính xác nhất, tránh bị khớp sớm vào các node cánh tay ở trên
            const handBones = [
                'righthand', 'mixamorigrighthand', 'mixamorig:righthand',
                'hand_r', 'hand.r', 'handr', 'bip001_r_hand', 'right_hand',
                'bone_righthand', 'dummy2.003_2'
            ];
            const forearmBones = [
                'rightforearm', 'mixamorigrightforearm', 'forearm_r', 'forearm.r', 
                'forearmr', 'right_forearm'
            ];
            const armBones = [
                'rightarm', 'mixamorigrightarm', 'arm_r', 'arm.r', 
                'armr', 'right_arm', 'dummy2_3'
            ];

            let targetBone = null;
            let bestScore = -1;

            root.traverse(c => {
                const name = (c.name || '').toLowerCase().trim();
                if (!name) return;

                let score = 0;
                
                // 1. Khớp chính xác (exact match) có điểm cao nhất trong nhóm của nó
                if (handBones.includes(name)) {
                    score = 100;
                } else if (forearmBones.includes(name)) {
                    score = 80;
                } else if (armBones.includes(name)) {
                    score = 60;
                }
                // 2. Khớp một phần (partial match) có điểm thấp hơn khớp chính xác
                else {
                    for (const target of handBones) {
                        if (name.includes(target)) {
                            score = 90;
                            break;
                        }
                    }
                    if (score === 0) {
                        for (const target of forearmBones) {
                            if (name.includes(target)) {
                                score = 70;
                                break;
                            }
                        }
                    }
                    if (score === 0) {
                        for (const target of armBones) {
                            if (name.includes(target)) {
                                score = 50;
                                break;
                            }
                        }
                    }
                }

                // 3. Khớp chung chung bằng từ khóa bổ trợ
                if (score === 0) {
                    if ((name.includes('hand') && (name.includes('right') || name.includes('_r') || name.includes('.r'))) ||
                        name.includes('righthand')) {
                        score = 40;
                    } else if (name.includes('forearm') && (name.includes('right') || name.includes('_r') || name.includes('.r'))) {
                        score = 30;
                    } else if (name.includes('arm') && (name.includes('right') || name.includes('_r') || name.includes('.r'))) {
                        score = 20;
                    }
                }

                if (score > bestScore) {
                    bestScore = score;
                    targetBone = c;
                }
            });

            // Fallback Layer 1: Nếu vẫn không tìm thấy bone nào khớp, tìm mesh tay phải thực tế
            if (!targetBone) {
                root.traverse(c => {
                    if (targetBone) return;
                    if (c.isMesh) {
                        const name = (c.name || '').toLowerCase();
                        if (name.includes('dummy2.003_2') || name.includes('rightarm') || name.includes('right_arm') || name.includes('r_arm') || name.includes('righthand') || name.includes('right_hand')) {
                            targetBone = c;
                        }
                    }
                });
            }

            // Extract Roblox limb nodes if modular
            let torsoMesh = null, headMesh = null;
            let rArmMesh = null, lArmMesh = null;
            let rLegMesh = null, lLegMesh = null;

            root.traverse(c => {
                const name = c.name || '';
                if (name.includes('dummy2_0')) torsoMesh = c;
                else if (name.includes('dummy2.001_1')) headMesh = c;
                else if (name.includes('dummy2.003_2')) rArmMesh = c;
                else if (name.includes('dummy2.007_5')) lArmMesh = c;
                else if (name.includes('dummy2.005_3')) rLegMesh = c;
                else if (name.includes('dummy2.006_4')) lLegMesh = c;
            });

            let rightHandSocket = null;

            if (torsoMesh && headMesh && rArmMesh && lArmMesh && rLegMesh && lLegMesh) {
                while (rig.children.length > 0) {
                    rig.remove(rig.children[0]);
                }

                const glbScale = 0.35;
                const glbContainer = new THREE.Group();
                glbContainer.scale.setScalar(glbScale);

                // Setup joint pivots
                // Torso (y = 3.115)
                const torsoPivot = new THREE.Group();
                torsoPivot.position.set(0, 0, 0);
                torsoPivot.add(torsoMesh);
                glbContainer.add(torsoPivot);
                rig.torso = torsoPivot;

                // Head (y = 4.692)
                const headPivot = new THREE.Group();
                headPivot.position.set(0, 4.692, 0);
                headMesh.position.y -= 4.692;
                headPivot.add(headMesh);
                glbContainer.add(headPivot);
                rig.head = headPivot;

                // Right Arm (x = -1.529, y = 3.115)
                const rArmPivot = new THREE.Group();
                rArmPivot.position.set(-1.529, 3.115, 0.023);
                rArmMesh.position.set(0, -1.0, 0);
                rArmPivot.add(rArmMesh);
                glbContainer.add(rArmPivot);
                rig.rightArm = rArmPivot;

                // Left Arm (x = 1.566, y = 3.115)
                const lArmPivot = new THREE.Group();
                lArmPivot.position.set(1.566, 3.115, 0.023);
                lArmMesh.position.set(0, -1.0, 0);
                lArmPivot.add(lArmMesh);
                glbContainer.add(lArmPivot);
                rig.leftArm = lArmPivot;

                // Right Leg (x = -0.479, y = 1.065)
                const rLegPivot = new THREE.Group();
                rLegPivot.position.set(-0.479, 1.065, 0.023);
                rLegMesh.position.set(0, -1.0, 0);
                rLegPivot.add(rLegMesh);
                glbContainer.add(rLegPivot);
                rig.rightLeg = rLegPivot;

                // Left Leg (x = 0.520, y = 1.065)
                const lLegPivot = new THREE.Group();
                lLegPivot.position.set(0.520, 1.065, 0.023);
                lLegMesh.position.set(0, -1.0, 0);
                lLegPivot.add(lLegMesh);
                glbContainer.add(lLegPivot);
                rig.leftLeg = lLegPivot;

                // Dedicated Weapon Socket attached to Right Hand
                rightHandSocket = new THREE.Group();
                rightHandSocket.name = 'rightHandSocket';
                rightHandSocket.position.set(0, -1.8, 0.8);
                rArmPivot.add(rightHandSocket);

                rig.add(glbContainer);
                if (this.player) {
                    this.player.body = torsoPivot;
                    this.player.head = headPivot;
                }

                console.log('✅ Đã ghép model Roblox Player vào Procedural Rig với Right Hand Socket');
            } else {
                const box = new THREE.Box3().setFromObject(root);
                const size = new THREE.Vector3();
                const center = new THREE.Vector3();
                box.getSize(size);
                box.getCenter(center);
                const scale = 1.8 / Math.max(size.y, 0.01);
                root.scale.setScalar(scale);
                root.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
                while (rig.children.length > 0) rig.remove(rig.children[0]);
                rig.add(root);
                rig.torso = root;
                if (this.player) this.player.body = root;

                if (targetBone) {
                    console.log('✅ Dynamic Bone Matching: Gắn vũ khí vào bone ->', targetBone.name);
                    rightHandSocket = new THREE.Group();
                    rightHandSocket.name = 'rightHandSocket';
                    rightHandSocket.position.set(0, 0, 0);
                    rightHandSocket.rotation.set(0, 0, 0);
                    targetBone.add(rightHandSocket);
                } else {
                    console.warn('⚠️ Dynamic Bone Matching: Không tìm thấy bone tay phải chuẩn, fallback gắn vào Root Model bằng toạ độ động');
                    rightHandSocket = new THREE.Group();
                    rightHandSocket.name = 'rightHandSocket';
                    
                    // Fallback Layer 2: Tính toán vị trí dựa trên kích thước bounding box thực tế của model (sau khi scale)
                    const scaledHeight = size.y * scale;
                    const scaledWidth = size.x * scale;
                    const scaledDepth = size.z * scale;
                    
                    const fallbackX = Math.max(scaledWidth * 0.25, scaledHeight * 0.25);
                    const fallbackY = scaledHeight * 0.33;
                    const fallbackZ = Math.max(scaledDepth * 0.15, scaledHeight * 0.08);
                    
                    rightHandSocket.position.set(fallbackX, fallbackY, fallbackZ);
                    root.add(rightHandSocket);
                }
            }

            rig.rightHandSocket = rightHandSocket;
            if (this.player) this.player.rightHandSocket = rightHandSocket;

            // Re-bind weapon holder if WeaponRenderer exists
            if (typeof WeaponRenderer !== 'undefined' && WeaponRenderer._weaponHolder) {
                rightHandSocket.add(WeaponRenderer._weaponHolder);
                WeaponRenderer._weaponHolder.position.set(0, 0, 0);
                WeaponRenderer._weaponHolder.rotation.set(0, 0, 0);
                WeaponRenderer._weaponHolder.visible = true;
                WeaponRenderer._weaponHolder.traverse(m => {
                    if (m.isMesh) {
                        m.frustumCulled = false;
                        m.visible = true;
                    }
                });
                if (typeof WeaponSystem !== 'undefined') {
                    WeaponRenderer._showModel(WeaponSystem.currentId);
                }
            }
        }, undefined, (err) => {
            console.warn('Lỗi load player GLB, giữ nguyên procedural rig:', err?.message || err);
        });
    },

    updatePlayerMesh: function(playerX, playerZ, rotationY, isMoving, jumpY, isCrouching, animOptions) {
        if (!this.player) return;
        this.player.position.x = playerX;
        this.player.position.z = playerZ;
        this.player.rotation.y = rotationY;

        const jumpOffset = jumpY || 0;
        const targetScaleY = isCrouching ? 0.70 : 1.0;
        if (typeof this.player._currentScaleY === 'undefined') this.player._currentScaleY = 1.0;
        this.player._currentScaleY += (targetScaleY - this.player._currentScaleY) * 0.2;

        const rig = this.player.rig;
        if (rig) {
            rig.scale.y = this.player._currentScaleY;
            rig.position.y = isCrouching ? -0.25 : 0;
        }

        const time = Date.now() * 0.008;
        const opts = animOptions || {};
        const isSprinting = opts.isSprinting || false;
        const isAttacking = opts.isAttacking || (typeof WeaponRenderer !== 'undefined' && WeaponRenderer._swingAnim);
        const currentWeapon = opts.currentWeapon || (typeof WeaponSystem !== 'undefined' ? WeaponSystem.currentId : 'pistol');

        if (isMoving) {
            const freq = isSprinting ? 1.6 : 1.0;
            const amp = isSprinting ? 0.75 : 0.50;
            this.player.position.y = Math.abs(Math.sin(time * freq * 1.5)) * (isCrouching ? 0.03 : 0.07) + jumpOffset;

            if (rig) {
                // Swing legs
                if (rig.leftLeg) rig.leftLeg.rotation.x = Math.sin(time * freq) * amp;
                if (rig.rightLeg) rig.rightLeg.rotation.x = -Math.sin(time * freq) * amp;

                // Swing left arm
                if (rig.leftArm) rig.leftArm.rotation.x = -Math.sin(time * freq) * amp;

                // Right arm: if not attacking, weapon stance or swing
                if (rig.rightArm && !isAttacking) {
                    if (currentWeapon === 'sword') {
                        rig.rightArm.rotation.x = -0.4 + Math.sin(time * freq) * 0.2;
                        rig.rightArm.rotation.z = -0.2;
                    } else {
                        // Gun aim forward
                        rig.rightArm.rotation.x = -Math.PI / 2.2 + Math.sin(time * freq) * 0.08;
                        rig.rightArm.rotation.z = 0;
                    }
                }

                // Torso slight forward lean when sprinting
                if (rig.torso) {
                    rig.torso.rotation.x = isSprinting ? 0.12 : 0.04;
                }
            }
        } else {
            // Idle breathing
            this.player.position.y = jumpOffset;
            if (rig) {
                const breath = Math.sin(time * 0.3) * 0.03;
                if (rig.leftLeg) rig.leftLeg.rotation.x = 0;
                if (rig.rightLeg) rig.rightLeg.rotation.x = 0;
                if (rig.torso) rig.torso.rotation.x = breath;
                if (rig.head) rig.head.rotation.x = -breath * 0.5;

                if (rig.leftArm) rig.leftArm.rotation.x = breath * 2;

                if (rig.rightArm && !isAttacking) {
                    if (currentWeapon === 'sword') {
                        rig.rightArm.rotation.x = -0.3 + breath;
                        rig.rightArm.rotation.z = -0.15;
                    } else {
                        // Holding gun forward
                        rig.rightArm.rotation.x = -Math.PI / 2.2 + breath;
                        rig.rightArm.rotation.z = 0;
                    }
                }
            }
        }

        // Melee attack animation for Right Arm
        if (rig && rig.rightArm && isAttacking && currentWeapon === 'sword') {
            const swingTimer = (typeof WeaponRenderer !== 'undefined' ? WeaponRenderer._swingTimer : 0) || 0;
            const slashPhase = Math.sin(swingTimer * Math.PI * 3);
            rig.rightArm.rotation.x = -Math.PI / 2 - slashPhase * 0.8;
            rig.rightArm.rotation.y = slashPhase * 0.6;
        }
    },

    create3DWall: function(x, z) {
        const wallWidth = 2;
        const wallHeight = 3;
        const wallDepth = 2;
        const geometry = new THREE.BoxGeometry(wallWidth, wallHeight, wallDepth);
        const material = new THREE.MeshPhongMaterial({ color: 0x00cc00 });
        const wall = new THREE.Mesh(geometry, material);
        wall.position.set(x, wallHeight / 2, z);
        wall.castShadow = true;
        wall.receiveShadow = true;
        this.scene.add(wall);
        this._addCollisionMesh(wall);
        return wall;
    },

    create3DTower: function(x, z) {
        const towerRadius = 1.5;
        const towerHeight = 5;
        const geometry = new THREE.CylinderGeometry(towerRadius, towerRadius, towerHeight, 16);
        const material = new THREE.MeshPhongMaterial({ color: 0x666666 });
        const tower = new THREE.Mesh(geometry, material);
        tower.position.set(x, towerHeight / 2, z);
        tower.castShadow = true;
        tower.receiveShadow = true;
        this.scene.add(tower);
        this._addCollisionMesh(tower);

        const coneGeometry = new THREE.ConeGeometry(towerRadius * 0.8, 2.5, 16);
        const coneMaterial = new THREE.MeshPhongMaterial({ color: 0x00ff00 });
        const cone = new THREE.Mesh(coneGeometry, coneMaterial);
        cone.position.set(x, towerHeight + 1.25, z);
        cone.castShadow = true;
        this.scene.add(cone);
        this._addCollisionMesh(cone);

        const group = new THREE.Group();
        group.add(tower);
        group.add(cone);
        group.tower = tower;
        group.cone = cone;
        group.position.set(x, 0, z);
        return group;
    },

    create3DMinter: function(x, z) {
        const minterSize = 3;
        const geometry = new THREE.BoxGeometry(minterSize, minterSize, minterSize);
        const material = new THREE.MeshPhongMaterial({ color: 0xffff00 });
        const minter = new THREE.Mesh(geometry, material);
        minter.position.set(x, minterSize / 2, z);
        minter.castShadow = true;
        minter.receiveShadow = true;
        this.scene.add(minter);
        this._addCollisionMesh(minter);

        const wheelGeometry = new THREE.CylinderGeometry(1, 1, 0.25, 16);
        const wheelMaterial = new THREE.MeshPhongMaterial({ color: 0x00ff00 });
        const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
        wheel.position.set(x, minterSize / 2, z);
        wheel.rotation.z = 0;
        wheel.castShadow = true;
        this.scene.add(wheel);

        const group = new THREE.Group();
        group.add(minter);
        group.add(wheel);
        group.minter = minter;
        group.wheel = wheel;
        return group;
    },

    create3DZombie: function(x, z) {
        const group = new THREE.Group();
        group.position.set(x, 0, z);

        if (this._zombieModelTemplate) {
            const zombieModel = this._zombieModelTemplate.clone(true);
            zombieModel.traverse(child => {
                if (child.isMesh) {
                    child.frustumCulled = false;
                    if (child.material) {
                        child.material = child.material.clone();
                    }
                }
            });
            group.add(zombieModel);
            group.model = zombieModel;
            group.body = zombieModel;

            // Khởi tạo AnimationMixer cho từng Zombie instance nếu có animation clips
            if (this._zombieClips && this._zombieClips.length > 0) {
                const mixer = new THREE.AnimationMixer(zombieModel);
                group.mixer = mixer;
                group.actions = {};
                this._zombieClips.forEach((clip, idx) => {
                    const name = (clip.name || '').toLowerCase();
                    const action = mixer.clipAction(clip);
                    if (name.includes('walk')) group.actions['walk'] = action;
                    else if (name.includes('run') || name.includes('chase')) group.actions['run'] = action;
                    else if (name.includes('attack') || name.includes('bite')) group.actions['attack'] = action;
                    else if (name.includes('death') || name.includes('die')) group.actions['death'] = action;
                    else if (name.includes('idle')) group.actions['idle'] = action;

                    if (idx === 0 && !group.actions['walk']) group.actions['walk'] = action;
                    if (idx === 1 && !group.actions['attack']) group.actions['attack'] = action;
                    if (idx === 2 && !group.actions['death']) group.actions['death'] = action;
                });
                const initial = group.actions['walk'] || group.actions['run'] || group.actions['idle'];
                if (initial) initial.play();
            }
        } else {
            const zombieWidth = 0.7;
            const zombieHeight = 1.4;
            const bodyGeometry = new THREE.BoxGeometry(zombieWidth, zombieHeight * 0.7, zombieWidth);
            const bodyMaterial = new THREE.MeshPhongMaterial({ color: 0x2e5c38 });
            const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
            body.position.y = zombieHeight * 0.35;
            body.castShadow = true;
            body.receiveShadow = true;

            const headSize = 0.52;
            const headGeometry = new THREE.BoxGeometry(headSize, headSize, headSize);
            const headMaterial = new THREE.MeshPhongMaterial({ color: 0x3d7a4a });
            const head = new THREE.Mesh(headGeometry, headMaterial);
            head.position.set(0, zombieHeight * 0.7 + headSize / 2, 0);
            head.castShadow = true;

            group.add(body);
            group.add(head);
            group.body = body;
            group.head = head;
        }

        this.scene.add(group);
        return group;
    },

    createLowPolyTree: function(x, z) {
        const scale = 0.7 + Math.random() * 0.8;
        const trunkHeight = (1.5 + Math.random() * 1.2) * scale;
        const trunkRadius = 0.15 * scale;
        const trunkGeometry = new THREE.CylinderGeometry(trunkRadius * 0.7, trunkRadius, trunkHeight, 6);
        const trunkMaterial = new THREE.MeshPhongMaterial({ color: 0x5a3a1b, flatShading: true });
        const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
        trunk.position.y = trunkHeight / 2;
        trunk.castShadow = true;
        trunk.receiveShadow = true;

        const tree = new THREE.Group();
        tree.add(trunk);

        const foliageColors = [0x2e7d32, 0x388e3c, 0x1b5e20, 0x43a047];
        const leafLayers = 2 + Math.floor(Math.random() * 2);
        let currentY = trunkHeight;
        let baseRadius = (0.9 + Math.random() * 0.6) * scale;

        for (let i = 0; i < leafLayers; i++) {
            const leafHeight = (1.2 + Math.random() * 0.8) * scale;
            const leafRadius = baseRadius * (1 - i * 0.22);
            const coneGeo = new THREE.ConeGeometry(leafRadius, leafHeight, 7);
            const coneMat = new THREE.MeshPhongMaterial({
                color: foliageColors[Math.floor(Math.random() * foliageColors.length)],
                flatShading: true
            });
            const cone = new THREE.Mesh(coneGeo, coneMat);
            cone.position.y = currentY + leafHeight * 0.35;
            cone.castShadow = true;
            cone.receiveShadow = true;
            tree.add(cone);
            currentY += leafHeight * 0.55;
        }

        tree.position.set(x, 0, z);
        tree.rotation.y = Math.random() * Math.PI * 2;
        return tree;
    },

    createLowPolyRock: function(x, z) {
        const useBox = Math.random() < 0.4;
        const scale = 0.5 + Math.random() * 1.2;
        const rockColors = [0x6b6b6b, 0x575757, 0x7a7a7a, 0x4a4a4a, 0x808070];
        const color = rockColors[Math.floor(Math.random() * rockColors.length)];

        let rock;
        if (useBox) {
            const w = (0.6 + Math.random() * 0.8) * scale;
            const h = (0.4 + Math.random() * 0.6) * scale;
            const d = (0.6 + Math.random() * 0.8) * scale;
            const boxGeo = new THREE.BoxGeometry(w, h, d);
            const boxMat = new THREE.MeshPhongMaterial({ color: color, flatShading: true });
            rock = new THREE.Mesh(boxGeo, boxMat);
            rock.position.y = h / 2;
        } else {
            const radius = (0.35 + Math.random() * 0.6) * scale;
            const dodecaGeo = new THREE.DodecahedronGeometry(radius, 0);
            const dodecaMat = new THREE.MeshPhongMaterial({ color: color, flatShading: true });
            rock = new THREE.Mesh(dodecaGeo, dodecaMat);
            rock.position.y = radius * 0.7;
            rock.scale.y = 0.6 + Math.random() * 0.4;
        }

        rock.castShadow = true;
        rock.receiveShadow = true;
        rock.rotation.y = Math.random() * Math.PI * 2;
        rock.rotation.x = (Math.random() - 0.5) * 0.3;
        rock.rotation.z = (Math.random() - 0.5) * 0.3;

        const group = new THREE.Group();
        group.add(rock);
        group.position.set(x, 0, z);
        return group;
    },

    createPineTree: function(x, z) {
        const scale = 0.7 + Math.random() * 0.8;
        const trunkHeight = (1.5 + Math.random() * 1.2) * scale;
        const trunkRadius = 0.15 * scale;
        const trunkGeometry = new THREE.CylinderGeometry(trunkRadius * 0.7, trunkRadius, trunkHeight, 6);
        const trunkMaterial = new THREE.MeshPhongMaterial({ color: 0x5a3a1b, flatShading: true });
        const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
        trunk.position.y = trunkHeight / 2;
        trunk.castShadow = true;
        trunk.receiveShadow = true;

        const tree = new THREE.Group();
        tree.add(trunk);

        const foliageColors = [0x1e3d2f, 0x234a37, 0x17301f];
        const leafLayers = 3 + Math.floor(Math.random() * 2);
        let currentY = trunkHeight;
        let baseRadius = (0.85 + Math.random() * 0.55) * scale;

        for (let i = 0; i < leafLayers; i++) {
            const leafHeight = (1.1 + Math.random() * 0.6) * scale;
            const leafRadius = baseRadius * (1 - i * 0.24);
            const coneGeo = new THREE.ConeGeometry(leafRadius, leafHeight, 7);
            const coneMat = new THREE.MeshPhongMaterial({
                color: foliageColors[Math.floor(Math.random() * foliageColors.length)],
                flatShading: true
            });
            const cone = new THREE.Mesh(coneGeo, coneMat);
            cone.position.y = currentY + leafHeight * 0.3;
            cone.castShadow = true;
            cone.receiveShadow = true;
            tree.add(cone);
            currentY += leafHeight * 0.48;
        }

        tree.position.set(x, 0, z);
        tree.rotation.y = Math.random() * Math.PI * 2;
        tree.scale.setScalar(0.8 + Math.random() * 0.5);
        return tree;
    },

    createOakTree: function(x, z) {
        const scale = 0.8 + Math.random() * 0.5;
        const trunkHeight = (1.6 + Math.random() * 1.0) * scale;
        const trunkRadius = 0.18 * scale;
        const trunkGeo = new THREE.CylinderGeometry(trunkRadius * 0.75, trunkRadius, trunkHeight, 6);
        const trunkMat = new THREE.MeshPhongMaterial({ color: 0x5c4033, flatShading: true });
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.y = trunkHeight / 2;
        trunk.castShadow = true;
        trunk.receiveShadow = true;

        const tree = new THREE.Group();
        tree.add(trunk);

        const canopyRadius = (1.1 + Math.random() * 0.6) * scale;
        const canopyMat = new THREE.MeshPhongMaterial({ color: 0x2d5a27, flatShading: true });
        const canopyGeo = new THREE.DodecahedronGeometry(canopyRadius, 0);
        const canopy = new THREE.Mesh(canopyGeo, canopyMat);
        canopy.position.y = trunkHeight + canopyRadius * 0.6;
        canopy.scale.y = 0.8 + Math.random() * 0.3;
        canopy.castShadow = true;
        canopy.receiveShadow = true;
        tree.add(canopy);

        const extraCount = Math.random() < 0.6 ? 1 : 2;
        for (let i = 0; i < extraCount; i++) {
            const r = canopyRadius * (0.5 + Math.random() * 0.3);
            const extra = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), canopyMat);
            const angle = Math.random() * Math.PI * 2;
            extra.position.set(
                Math.cos(angle) * canopyRadius * 0.6,
                trunkHeight + canopyRadius * 0.5 + (Math.random() - 0.5) * canopyRadius * 0.4,
                Math.sin(angle) * canopyRadius * 0.6
            );
            extra.castShadow = true;
            tree.add(extra);
        }

        tree.position.set(x, 0, z);
        tree.rotation.y = Math.random() * Math.PI * 2;
        tree.scale.setScalar(0.8 + Math.random() * 0.5);
        return tree;
    },

    createBush: function(x, z) {
        const radius = 0.5 + Math.random() * 0.4;
        const bushColors = [0x2d5a27, 0x1e3d2f, 0x3a6b30];
        const color = bushColors[Math.floor(Math.random() * bushColors.length)];
        const geo = new THREE.SphereGeometry(radius, 7, 5);
        const mat = new THREE.MeshPhongMaterial({ color, flatShading: true });
        const bush = new THREE.Mesh(geo, mat);
        bush.position.y = radius * 0.5;
        bush.scale.y = 0.55;
        bush.castShadow = true;
        bush.receiveShadow = true;
        bush.rotation.y = Math.random() * Math.PI * 2;

        const group = new THREE.Group();
        group.add(bush);
        group.position.set(x, 0, z);
        group.rotation.y = Math.random() * Math.PI * 2;
        group.scale.setScalar(0.8 + Math.random() * 0.5);
        return group;
    },

    createFallenLog: function(x, z) {
        const length = 1.8 + Math.random() * 1.4;
        const radius = 0.2 + Math.random() * 0.15;
        const geo = new THREE.CylinderGeometry(radius, radius * 0.9, length, 7);
        const mat = new THREE.MeshPhongMaterial({ color: 0x5c4033, flatShading: true });
        const log = new THREE.Mesh(geo, mat);
        log.rotation.z = Math.PI / 2;
        log.position.y = radius;
        log.castShadow = true;
        log.receiveShadow = true;

        const group = new THREE.Group();
        group.add(log);
        group.position.set(x, 0, z);
        group.rotation.y = Math.random() * Math.PI * 2;
        group.scale.setScalar(0.8 + Math.random() * 0.5);
        return group;
    },

    createForestEnvironment: function() {
        const centerX = this.worldCenterX;
        const centerZ = this.worldCenterZ;
        const safeHalf = 15;
        const minDistFromCenter = safeHalf + 3;
        const playFieldSize = 500;
        const padding = 8;
        const minX = 0 + padding;
        const maxX = playFieldSize - padding;
        const minZ = 0 + padding;
        const maxZ = playFieldSize - padding;
        const spanX = maxX - minX;
        const spanZ = maxZ - minZ;

        // Keep the environment readable without spending the opening frames
        // generating hundreds of individual draw calls on mobile browsers.
        const treeCount = this.webPerformanceMode ? 60 : 110;
        const rockCount = this.webPerformanceMode ? 20 : 40;
        let placed = 0;
        let attempts = 0;
        const maxAttempts = treeCount * 60;
        const positions = [];
        const minSpacing = 2.6;

        function isValidPosition(x, z) {
            const dx = x - centerX;
            const dz = z - centerZ;
            const distSqCenter = dx * dx + dz * dz;
            if (distSqCenter < minDistFromCenter * minDistFromCenter) return false;
            if (x < minX || x > maxX || z < minZ || z > maxZ) return false;
            for (let i = 0; i < positions.length; i++) {
                const ddx = x - positions[i].x;
                const ddz = z - positions[i].z;
                if (ddx * ddx + ddz * ddz < minSpacing * minSpacing) return false;
            }
            return true;
        }

        function randomPerimeterPosition() {
            const band = Math.random();
            if (band < 0.5) {
                const maxR = Math.min(spanX, spanZ) / 2;
                const r = minDistFromCenter + Math.random() * Math.max(1, (maxR - minDistFromCenter));
                const a = Math.random() * Math.PI * 2;
                return { x: centerX + Math.cos(a) * r, z: centerZ + Math.sin(a) * r };
            } else {
                return { x: minX + Math.random() * spanX, z: minZ + Math.random() * spanZ };
            }
        }

        const pickFloraCreator = () => {
            const r = Math.random();
            if (r < 0.35) return this.createPineTree;
            if (r < 0.65) return this.createOakTree;
            if (r < 0.85) return this.createBush;
            return this.createFallenLog;
        };

        while (placed < treeCount && attempts < maxAttempts) {
            attempts++;
            const pos = randomPerimeterPosition();
            if (isValidPosition(pos.x, pos.z)) {
                const creator = pickFloraCreator();
                const flora = creator.call(this, pos.x, pos.z);
                this.scene.add(flora);
                this.trees.push(flora);
                positions.push({ x: pos.x, z: pos.z });
                placed++;
            }
        }

        placed = 0;
        attempts = 0;
        while (placed < rockCount && attempts < maxAttempts) {
            attempts++;
            const pos = randomPerimeterPosition();
            if (isValidPosition(pos.x, pos.z)) {
                const rock = this.createLowPolyRock(pos.x, pos.z);
                this.scene.add(rock);
                this.rocks.push(rock);
                positions.push({ x: pos.x, z: pos.z });
                placed++;
            }
        }

        console.log('ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€¦Ã¢â‚¬â„¢Ãƒâ€šÃ‚Â² MÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â´i trÃƒÆ’Ã¢â‚¬Â Ãƒâ€šÃ‚Â°ÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Âng rÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Â«ng rÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â­m rÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â¡p ÃƒÆ’Ã¢â‚¬Å¾ÃƒÂ¢Ã¢â€šÂ¬Ã‹Å“ÃƒÆ’Ã¢â‚¬Â Ãƒâ€šÃ‚Â°ÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Â£c tÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â¡o:', this.trees.length, 'cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢y/bÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Â¥i/gÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â,', this.rocks.length, 'ÃƒÆ’Ã¢â‚¬Å¾ÃƒÂ¢Ã¢â€šÂ¬Ã‹Å“ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡');
    },

    /**
     * HÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â m xÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Â­ lÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â½ camera collision vÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»ÃƒÂ¢Ã¢â€šÂ¬Ã‚Âºi vÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â­t thÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€ Ã¢â‚¬â„¢ vÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â  mÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â·t ÃƒÆ’Ã¢â‚¬Å¾ÃƒÂ¢Ã¢â€šÂ¬Ã‹Å“ÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â¥t
     * TrÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â£ vÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Â vÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¹ trÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­ camera hÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Â£p lÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¡
     */
    _getSafeCameraPosition: function(fromPos, toPos, lookAtPos) {
        const direction = new THREE.Vector3().copy(toPos).sub(fromPos);
        const distance = direction.length();
        if (distance < 0.01) return toPos.clone();

        direction.normalize();

        // TÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â¡o ray tÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Â« nhÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢n vÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â­t ÃƒÆ’Ã¢â‚¬Å¾ÃƒÂ¢Ã¢â€šÂ¬Ã‹Å“ÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â¿n vÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¹ trÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­ camera mong muÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»ÃƒÂ¢Ã¢â€šÂ¬Ã‹Å“n
        const raycaster = new THREE.Raycaster(fromPos, direction, 0.1, distance);

        // KiÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€ Ã¢â‚¬â„¢m tra va chÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â¡m vÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»ÃƒÂ¢Ã¢â€šÂ¬Ã‚Âºi cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡c mesh trong danh sÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ch
        const intersects = raycaster.intersectObjects(this._collisionMeshes);

        let safePos = toPos.clone();

        if (intersects.length > 0) {
            // LÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â¥y ÃƒÆ’Ã¢â‚¬Å¾ÃƒÂ¢Ã¢â€šÂ¬Ã‹Å“iÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€ Ã¢â‚¬â„¢m va chÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â¡m gÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â§n nhÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â¥t
            const hit = intersects[0];
            const hitDistance = hit.distance;
            // LÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¹i lÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â¡i mÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢t chÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºt ÃƒÆ’Ã¢â‚¬Å¾ÃƒÂ¢Ã¢â€šÂ¬Ã‹Å“ÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€ Ã¢â‚¬â„¢ camera khÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â´ng bÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¹ dÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­nh vÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â o tÃƒÆ’Ã¢â‚¬Â Ãƒâ€šÃ‚Â°ÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Âng
            const offset = 0.3;
            const safeDistance = Math.max(0.1, hitDistance - offset);
            safePos.copy(fromPos).add(direction.clone().multiplyScalar(safeDistance));
        }

        // ChÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â·n camera khÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â´ng xuÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»ÃƒÂ¢Ã¢â€šÂ¬Ã‹Å“ng dÃƒÆ’Ã¢â‚¬Â Ãƒâ€šÃ‚Â°ÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»ÃƒÂ¢Ã¢â€šÂ¬Ã‚Âºi mÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â·t ÃƒÆ’Ã¢â‚¬Å¾ÃƒÂ¢Ã¢â€šÂ¬Ã‹Å“ÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â¥t (Y > 0.3)
        if (safePos.y < 0.3) {
            safePos.y = 0.3;
        }

        return safePos;
    },

    render: function() {
        if (this._radar) {
            this._radar.rotation.y += 0.005;
        }
        this.renderer.render(this.scene, this.camera);
    },

    onWindowResize: function() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
    },

    getRaycaster: function(mouseX, mouseY) {
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();
        mouse.x = (mouseX / window.innerWidth) * 2 - 1;
        mouse.y = -(mouseY / window.innerHeight) * 2 + 1;
        raycaster.setFromCamera(mouse, this.camera);
        return raycaster;
    },

    getGroundIntersection: function(raycaster) {
        const intersects = raycaster.intersectObject(this.ground);
        if (intersects.length > 0) {
            return intersects[0].point;
        }
        return null;
    },

    updateCameraToPlayer: function(playerX, playerZ, yaw, pitch, playerY) {
        const py = playerY || 0;
        const cosPitch = Math.cos(pitch);
        const sinPitch = Math.sin(pitch);
        const cosYaw = Math.cos(yaw);
        const sinYaw = Math.sin(yaw);

        const forwardX = sinYaw * cosPitch;
        const forwardY = -sinPitch;
        const forwardZ = cosYaw * cosPitch;

        const isFirstPerson = this.cameraDistance <= this.firstPersonThreshold;
        this.isFirstPerson = isFirstPerson;

        let targetCamX, targetCamY, targetCamZ;
        let targetLookX, targetLookY, targetLookZ;

        if (isFirstPerson) {
            if (this.player) this.player.visible = false;
            targetCamX = playerX;
            targetCamY = py + this.eyeHeight;
            targetCamZ = playerZ;
            targetLookX = targetCamX + forwardX;
            targetLookY = targetCamY + forwardY;
            targetLookZ = targetCamZ + forwardZ;
        } else {
            if (this.player) this.player.visible = true;
            const fadeT = Math.max(0, Math.min(1,
                (this.cameraDistance - this.firstPersonThreshold) / this._fpTransitionRange
            ));
            const effectiveHeightOffset = this.cameraHeightOffset * fadeT;
            const horizontalDist = this.cameraDistance * cosPitch;
            const verticalOffset = py + this.cameraDistance * sinPitch + effectiveHeightOffset;
            const offsetX = horizontalDist * sinYaw;
            const offsetZ = horizontalDist * cosYaw;

            // VÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¹ trÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­ camera mong muÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»ÃƒÂ¢Ã¢â€šÂ¬Ã‹Å“n
            let rawCamX = playerX - offsetX;
            let rawCamY = Math.max(py + 0.5, verticalOffset);
            let rawCamZ = playerZ - offsetZ;

            // ÃƒÆ’Ã¢â‚¬Å¾Ãƒâ€šÃ‚ÂiÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€ Ã¢â‚¬â„¢m tÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Â« nhÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢n vÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â­t ÃƒÆ’Ã¢â‚¬Å¾ÃƒÂ¢Ã¢â€šÂ¬Ã‹Å“ÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â¿n camera
            const fromPos = new THREE.Vector3(playerX, py + 0.5, playerZ);
            const toPos = new THREE.Vector3(rawCamX, rawCamY, rawCamZ);

            // ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âp dÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Â¥ng collision ÃƒÆ’Ã¢â‚¬Å¾ÃƒÂ¢Ã¢â€šÂ¬Ã‹Å“ÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€ Ã¢â‚¬â„¢ cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ vÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¹ trÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­ an toÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â n
            const safePos = this._getSafeCameraPosition(fromPos, toPos, new THREE.Vector3(playerX, py + this.cameraLookAtHeight, playerZ));
            targetCamX = safePos.x;
            targetCamY = safePos.y;
            targetCamZ = safePos.z;

            targetLookX = playerX;
            targetLookY = py + this.cameraLookAtHeight;
            targetLookZ = playerZ;
        }

        const now = performance.now();
        if (!this._lastCameraTime) this._lastCameraTime = now;
        const dt = Math.min((now - this._lastCameraTime) / 1000, 0.05);
        this._lastCameraTime = now;
        const smooth = 1 - Math.exp(-this.cameraSmoothness * dt);

        this._smoothedCameraX += (targetCamX - this._smoothedCameraX) * smooth;
        this._smoothedCameraY += (targetCamY - this._smoothedCameraY) * smooth;
        this._smoothedCameraZ += (targetCamZ - this._smoothedCameraZ) * smooth;
        this._smoothedLookAtX += (targetLookX - this._smoothedLookAtX) * smooth;
        this._smoothedLookAtY += (targetLookY - this._smoothedLookAtY) * smooth;
        this._smoothedLookAtZ += (targetLookZ - this._smoothedLookAtZ) * smooth;

        this.camera.position.set(
            this._smoothedCameraX,
            this._smoothedCameraY,
            this._smoothedCameraZ
        );
        this.camera.lookAt(
            this._smoothedLookAtX,
            this._smoothedLookAtY,
            this._smoothedLookAtZ
        );
    }
};


/* ============================================================================
 * APOCALYPSE MILITARY COMPLEX ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â VISUAL OVERHAUL
 * Inspired by the user's references: brutalist concrete, asymmetrical towers,
 * cyan emergency lighting, rooftop control decks, dense functional districts.
 * ========================================================================== */

Renderer3D._apocalypseMaterials = function() {
    if (this._apocMats) return this._apocMats;
    this._apocMats = {
        concrete: new THREE.MeshPhongMaterial({ color: 0x505962, flatShading: true }),
        concreteDark: new THREE.MeshPhongMaterial({ color: 0x2a3137, flatShading: true }),
        concreteLight: new THREE.MeshPhongMaterial({ color: 0x707a80, flatShading: true }),
        metal: new THREE.MeshPhongMaterial({ color: 0x20272c, flatShading: true }),
        steel: new THREE.MeshPhongMaterial({ color: 0x85939a, flatShading: true }),
        military: new THREE.MeshPhongMaterial({ color: 0x39453f, flatShading: true }),
        olive: new THREE.MeshPhongMaterial({ color: 0x506052, flatShading: true }),
        glass: new THREE.MeshPhongMaterial({ color: 0x72d9ee, emissive: 0x1c8191, emissiveIntensity: 0.38, transparent: true, opacity: 0.72 }),
        cyan: new THREE.MeshPhongMaterial({ color: 0x62e8ff, emissive: 0x21c3d8, emissiveIntensity: 0.62 }),
        cyanSoft: new THREE.MeshPhongMaterial({ color: 0x315e66, emissive: 0x168a99, emissiveIntensity: 0.36 }),
        amber: new THREE.MeshPhongMaterial({ color: 0xffc857, emissive: 0xc87b0c, emissiveIntensity: 0.28 }),
        red: new THREE.MeshPhongMaterial({ color: 0xc94a4a, emissive: 0x6f1717, emissiveIntensity: 0.3 }),
        darkGlass: new THREE.MeshPhongMaterial({ color: 0x10181c, emissive: 0x0b2025, emissiveIntensity: 0.2, transparent: true, opacity: 0.86 }),
        hazard: new THREE.MeshPhongMaterial({ color: 0xd39b2f, emissive: 0x5a3d0c, emissiveIntensity: 0.14 }),
        sand: new THREE.MeshPhongMaterial({ color: 0x625648, flatShading: true })
    };
    return this._apocMats;
};

Renderer3D._apocBox = function(group, w, h, d, x, y, z, mat, collision = true) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    if (collision) this._addCollisionMesh(mesh);
    return mesh;
};

Renderer3D._apocStrip = function(group, x, y, z, w, d, mat, rotY = 0) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, 0.16, d), mat);
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotY;
    mesh.castShadow = false;
    group.add(mesh);
    return mesh;
};

Renderer3D._apocSlitWindow = function(group, x, y, z, w = 2.2, h = 0.7, depth = 0.08) {
    return this._apocBox(group, w, h, depth, x, y, z, this._apocalypseMaterials().darkGlass, false);
};

Renderer3D._apocRoof = function(group, w, d, y, lip = 0.8) {
    const mats = this._apocalypseMaterials();
    this._apocBox(group, w + lip, 0.36, d + lip, 0, y, 0, mats.concreteDark, true);
    this._apocStrip(group, 0, y + 0.25, d / 2 + 0.12, w - 1, 0.16, mats.cyan);
};

Renderer3D._createBuildingSign = function(text, color, width = 7, height = 0.85) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(10,14,16,0.85)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const hexColor = '#' + (color || 0x74e7ff).toString(16).padStart(6, '0');
    ctx.strokeStyle = hexColor;
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, canvas.width - 6, canvas.height - 6);
    ctx.fillStyle = hexColor;
    ctx.font = 'bold 64px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        side: THREE.DoubleSide
    });
    const geometry = new THREE.PlaneGeometry(width, height);
    const mesh = new THREE.Mesh(geometry, material);
    return mesh;
};

Renderer3D._apocLabel = function(group, text, color, x, y, z, width = 7, height = 0.85, rotY = 0) {
    const sign = this._createBuildingSign(text, color, width, height);
    sign.position.set(x, y, z);
    sign.rotation.y = rotY;
    group.add(sign);
    return sign;
};

Renderer3D._createApocalypseBlock = function(x, z, cfg = {}) {
    const mats = this._apocalypseMaterials();
    const w = cfg.width || 16, h = cfg.height || 6, d = cfg.depth || 12;
    const group = new THREE.Group();

    // Main concrete mass + offset upper volume for the asymmetric post-apocalypse silhouette.
    this._apocBox(group, w, h, d, 0, h / 2, 0, cfg.bodyMat || mats.concrete, true);
    if (cfg.upper !== false) {
        const uw = cfg.upperWidth || Math.max(7, w * 0.54);
        const uh = cfg.upperHeight || 2.3;
        const ud = cfg.upperDepth || Math.max(5, d * 0.58);
        const ux = cfg.upperOffsetX || -w * 0.18;
        const uz = cfg.upperOffsetZ || -d * 0.08;
        this._apocBox(group, uw, uh, ud, ux, h + uh / 2 - 0.15, uz, cfg.upperMat || mats.concreteLight, true);
    }

    // Deep entrance / service bay.
    const doorW = cfg.doorWidth || Math.min(4.8, w * 0.33);
    const doorH = cfg.doorHeight || Math.min(3.4, h * 0.62);
    this._apocBox(group, doorW + 0.65, doorH + 0.65, 0.22, 0, doorH / 2 - 0.05, d / 2 + 0.13, mats.metal, false);
    this._apocBox(group, doorW, doorH, 0.1, 0, doorH / 2, d / 2 + 0.27, mats.darkGlass, false);

    // Vertical facade ribs.
    const ribCount = Math.max(3, Math.floor(w / 3.4));
    for (let i = 0; i < ribCount; i++) {
        const rx = -w / 2 + 1.5 + i * ((w - 3) / Math.max(1, ribCount - 1));
        this._apocBox(group, 0.18, h - 0.7, 0.24, rx, h / 2 + 0.05, d / 2 + 0.16, mats.concreteDark, false);
    }

    // Cyan architectural strip + segmented windows.
    const stripY = Math.min(h - 0.9, h * 0.73);
    this._apocStrip(group, 0, stripY, d / 2 + 0.2, w - 1.2, 0.15, cfg.accentMat || mats.cyan);
    const windows = Math.max(3, Math.floor(w / 3.2));
    for (let i = 0; i < windows; i++) {
        const wx = -w / 2 + 1.8 + i * ((w - 3.6) / Math.max(1, windows - 1));
        this._apocSlitWindow(group, wx, h * 0.54, d / 2 + 0.19, 1.45, 0.48);
    }

    // Side emergency windows.
    for (let side of [-1, 1]) {
        for (let i = 0; i < Math.max(2, Math.floor(d / 4)); i++) {
            const zz = -d / 2 + 2.4 + i * ((d - 4.8) / Math.max(1, Math.floor(d / 4) - 1));
            const win = this._apocBox(group, 0.08, 0.55, 1.8, side * (w / 2 + 0.1), h * 0.53, zz, mats.glass, false);
        }
    }

    this._apocRoof(group, w, d, h + 0.25, 0.8);
    this._apocLabel(group, cfg.label || 'FACILITY', cfg.labelColor || 0x62e8ff, 0, Math.min(h - 0.8, h * 0.76), d / 2 + 0.28, Math.min(7.6, w - 1.6), 0.7);

    group.position.set(x, 0, z);
    this.scene.add(group);

    if (cfg.pad !== false) this._createPavedPad(x, z, w + 5, d + 5, 0x2d3337);
    return group;
};

Renderer3D.buildGrandBase = function() {
    const cx = this.worldCenterX, cz = this.worldCenterZ;
    const mats = this._apocalypseMaterials();
    console.log('ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€šÃ‚ÂÃƒâ€šÃ‚Â° Building modern post-apocalypse military complex...');

    this._militaryBaseBounds = { minX: cx - 108, maxX: cx + 108, minZ: cz - 108, maxZ: cz + 108 };
    this._militaryBuildingFunctions = {};

    // Large compound slab and road grid.
    this._createConcreteBase(cx, cz, 214);
    this._createRoadSegment(cx, cz + 1, 206, 9, 'x');
    this._createRoadSegment(cx, cz - 57, 198, 8, 'x');
    this._createRoadSegment(cx, cz + 58, 198, 8, 'x');
    this._createRoadSegment(cx - 55, cz, 8, 202, 'z');
    this._createRoadSegment(cx + 55, cz, 8, 202, 'z');
    this._createBasePlaza(cx, cz + 9);
    this._createPerimeterLighting(cx, cz);
    this._createPerimeterDefense(cx, cz, 103);

    // Imported HQ assets are optional visual upgrades. Do not request them in
    // the web build: their 40+ MB download would keep Poki players on the
    // loading screen long after the procedural base is ready.
    if (!this.webPerformanceMode) this._loadMainHQAndTent(cx, cz);

    // West residential / medical district.
    this._createApocalypseBarracksArea(cx - 55, cz - 28);
    this._createApocalypseBlock(cx - 38, cz + 36, { width: 18, height: 6.2, depth: 12, label: 'MEDICAL WING', labelColor: 0x69f0ae, bodyMat: mats.concreteLight, upperWidth: 10, upperOffsetX: 2 });
    this._createMedicalBlock(cx - 38, cz + 36);

    // East logistics / vehicle district.
    this._createApocalypseSupplyDepot(cx + 53, cz - 30);
    this._createFuelFarm(cx + 62, cz + 17);
    this._createApocalypseMotorPool(cx + 49, cz + 57);

    // North technical district.
    this._createApocalypseBlock(cx - 49, cz - 73, { width: 23, height: 7, depth: 14, label: 'VEHICLE WORKSHOP', labelColor: 0xffc857, bodyMat: mats.military, upperWidth: 12, upperOffsetX: 3 });
    this._createVehicleWorkshop(cx - 49, cz - 73);
    this._createApocalypseResearchFacility(cx + 3, cz - 73);

    // South combat/training district.
    this._createApocalypseTrainingGround(cx - 42, cz + 70);
    this._createApocalypseShootingRange(cx + 30, cz + 70);

    // Long-range communications and surveillance silhouette.
    this._createApocalypseRadarStation(cx + 86, cz - 78);
    this._createApocalypseCommsTower(cx - 84, cz - 78);

    // Guard towers, gatehouse, checkpoints and visual clutter.
    [[-98,-98],[98,-98],[98,98],[-98,98],[-38,-101],[38,-101],[-38,101],[38,101]].forEach(([dx,dz]) => this._createApocalypseGuardTower(cx+dx, cz+dz));
    this._createApocalypseMainGate(cx, cz + 104);
    this._createApocalypseSecondaryGate(cx, cz - 104);
    this._createApocalypseBaseProps(cx, cz);
    this._createHQInterior(cx, cz - 9);
    this._createAutomatedMachineGunNetwork(cx, cz);

    this._registerApocalypseMilitaryInteractions(cx, cz);
    console.log('ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ Modern post-apocalypse base complete');
};

Renderer3D._prepareImportedModel = function(root, options = {}) {
    root.traverse((obj) => {
        if (!obj.isMesh) return;
        obj.castShadow = options.castShadow !== false;
        obj.receiveShadow = options.receiveShadow !== false;
        if (obj.material) {
            const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
            mats.forEach((mat) => {
                if (!mat) return;
                if (mat.map) mat.map.encoding = THREE.sRGBEncoding;
                if (mat.emissiveMap) mat.emissiveMap.encoding = THREE.sRGBEncoding;
                mat.needsUpdate = true;
            });
        }
    });
    return root;
};

Renderer3D._fitModelToGround = function(object, targetX, targetZ, rotationY, scale) {
    object.scale.setScalar(scale);
    object.rotation.y = rotationY || 0;
    object.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(object);
    const center = box.getCenter(new THREE.Vector3());
    const minY = box.min.y;

    object.position.x += targetX - center.x;
    object.position.z += targetZ - center.z;
    object.position.y += -minY;
    object.updateMatrixWorld(true);
};

Renderer3D._prepareExternalModel = function(root, options = {}) {
    root.traverse((child) => {
        if (!child.isMesh) return;
        child.castShadow = options.castShadow !== false;
        child.receiveShadow = options.receiveShadow !== false;
        if (child.material && child.material.map) child.material.map.anisotropy = 2;
    });
    return root;
};

Renderer3D._normalizeImportedModel = function(root, targetHeight) {
    const box = new THREE.Box3().setFromObject(root);
    if (!box.isEmpty()) {
        const center = box.getCenter(new THREE.Vector3());
        root.position.sub(center);
        const floorBox = new THREE.Box3().setFromObject(root);
        root.position.y -= floorBox.min.y;
    }
    if (targetHeight) {
        const box2 = new THREE.Box3().setFromObject(root);
        const h = box2.max.y - box2.min.y;
        if (h > 0.001) root.scale.multiplyScalar(targetHeight / h);
        const floorBox2 = new THREE.Box3().setFromObject(root);
        root.position.y -= floorBox2.min.y;
    }
    return root;
};

Renderer3D._addModelCollisionBox = function(centerX, centerZ, width, height, depth) {
    const geo = new THREE.BoxGeometry(width, Math.max(1, height), depth);
    const mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
    const box = new THREE.Mesh(geo, mat);
    box.position.set(centerX, Math.max(1, height) / 2, centerZ);
    box.visible = false;
    this.scene.add(box);
    if (this._collisionMeshes) this._collisionMeshes.push(box);
    return box;
};

// TÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â¡o collision box KHÃƒÆ’Ã†â€™Ãƒâ€šÃ‚ÂT vÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»ÃƒÂ¢Ã¢â€šÂ¬Ã‚Âºi kÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­ch thÃƒÆ’Ã¢â‚¬Â Ãƒâ€šÃ‚Â°ÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»ÃƒÂ¢Ã¢â€šÂ¬Ã‚Âºc thÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â­t (world-space) cÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Â§a model ÃƒÆ’Ã¢â‚¬Å¾ÃƒÂ¢Ã¢â€šÂ¬Ã‹Å“ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£
// load, thay vÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¬ dÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¹ng sÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»ÃƒÂ¢Ã¢â€šÂ¬Ã‹Å“ liÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¡u ÃƒÆ’Ã¢â‚¬Å¾ÃƒÂ¢Ã¢â€šÂ¬Ã‹Å“oÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡n cÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Â©ng ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â trÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡nh trÃƒÆ’Ã¢â‚¬Â Ãƒâ€šÃ‚Â°ÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Âng hÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Â£p box quÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ to
// (chÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â·n nhÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â§m cÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â£ khu vÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Â±c trÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»ÃƒÂ¢Ã¢â€šÂ¬Ã‹Å“ng, hoÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â·c "nuÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»ÃƒÂ¢Ã¢â€šÂ¬Ã‹Å“t" luÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â´n ÃƒÆ’Ã¢â‚¬Å¾ÃƒÂ¢Ã¢â€šÂ¬Ã‹Å“iÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€ Ã¢â‚¬â„¢m spawn cÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Â§a ngÃƒÆ’Ã¢â‚¬Â Ãƒâ€šÃ‚Â°ÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Âi chÃƒÆ’Ã¢â‚¬Â Ãƒâ€šÃ‚Â¡i).
Renderer3D._addModelCollisionBoxFromObject = function(root, centerX, centerZ, opts = {}) {
    const margin = opts.margin != null ? opts.margin : 1.0; // hÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¡ sÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»ÃƒÂ¢Ã¢â€šÂ¬Ã‹Å“ nÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»ÃƒÂ¢Ã¢â€šÂ¬Ã‚Âºi nhÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â¹, 1.0 = khÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­t
    const minWidth = opts.minWidth || 2;
    const minDepth = opts.minDepth || 2;
    const box3 = new THREE.Box3().setFromObject(root);
    if (box3.isEmpty()) {
        console.warn('Model rÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Âng, bÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Â qua tÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â¡o collision box:', root.name);
        return null;
    }
    const size = box3.getSize(new THREE.Vector3());
    const width = Math.max(minWidth, size.x * margin);
    const depth = Math.max(minDepth, size.z * margin);
    const height = Math.max(1, size.y);
    return this._addModelCollisionBox(centerX, centerZ, width, height, depth);
};

Renderer3D._loadMainHQModel = function(cx, cz) {
    if (typeof THREE.GLTFLoader === 'undefined') {
        console.error('GLTFLoader chÃƒÆ’Ã¢â‚¬Â Ãƒâ€šÃ‚Â°a ÃƒÆ’Ã¢â‚¬Å¾ÃƒÂ¢Ã¢â€šÂ¬Ã‹Å“ÃƒÆ’Ã¢â‚¬Â Ãƒâ€šÃ‚Â°ÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Â£c tÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â£i; khÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â´ng thÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€ Ã¢â‚¬â„¢ load model_game_ready.glb');
        return;
    }
    this._gltfLoader = this._gltfLoader || new THREE.GLTFLoader();
    const url = 'src/assets/models/model_game_ready.glb';
    console.log('ÃƒÆ’Ã¢â‚¬Å¾Ãƒâ€šÃ‚Âang tÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â£i nhÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â  chÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­nh GLB:', url);
    this._gltfLoader.load(url, (gltf) => {
        const root = this._prepareImportedModel(gltf.scene, { castShadow: true, receiveShadow: true });
        this._normalizeImportedModel(root, 25);
        root.position.set(cx, 0, cz);
        root.name = 'MainHQImportedGLB';
        this.scene.add(root);
        this._externalModels.push(root);
        // Collision box khÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»ÃƒÂ¢Ã¢â€šÂ¬Ã‚Âºp ÃƒÆ’Ã¢â‚¬Å¾ÃƒÂ¢Ã¢â€šÂ¬Ã‹Å“ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºng kÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­ch thÃƒÆ’Ã¢â‚¬Â Ãƒâ€šÃ‚Â°ÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»ÃƒÂ¢Ã¢â€šÂ¬Ã‚Âºc thÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â­t sau khi scale/normalize,
        // trÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡nh chÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â·n nhÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â§m ÃƒÆ’Ã¢â‚¬Å¾ÃƒÂ¢Ã¢â€šÂ¬Ã‹Å“iÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€ Ã¢â‚¬â„¢m spawn cÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Â§a ngÃƒÆ’Ã¢â‚¬Â Ãƒâ€šÃ‚Â°ÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Âi chÃƒÆ’Ã¢â‚¬Â Ãƒâ€šÃ‚Â¡i (250,250) ÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€¦Ã‚Â¸ gÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â§n ÃƒÆ’Ã¢â‚¬Å¾ÃƒÂ¢Ã¢â€šÂ¬Ã‹Å“ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³.
        this._addModelCollisionBoxFromObject(root, cx, cz, { margin: 1.02, minWidth: 20, minDepth: 10 });
        if (this._militaryBuildingFunctions) this._militaryBuildingFunctions.command = { name: 'Command HQ', function: 'Base upgrades + money production hub', x: cx, z: cz - 9, radius: 20 };
        console.log('NhÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â  chÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­nh GLB ÃƒÆ’Ã¢â‚¬Å¾ÃƒÂ¢Ã¢â€šÂ¬Ã‹Å“ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£ ÃƒÆ’Ã¢â‚¬Å¾ÃƒÂ¢Ã¢â€šÂ¬Ã‹Å“ÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â·t tÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â¡i trung tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢m');
    }, undefined, (err) => {
        console.error('KhÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â´ng tÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â£i ÃƒÆ’Ã¢â‚¬Å¾ÃƒÂ¢Ã¢â€šÂ¬Ã‹Å“ÃƒÆ’Ã¢â‚¬Â Ãƒâ€šÃ‚Â°ÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Â£c nhÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â  chÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­nh GLB:', url, err);
    });
};

Renderer3D._loadTentModel = function(x, z) {
    if (typeof THREE.GLTFLoader === 'undefined') {
        console.error('GLTFLoader chÃƒÆ’Ã¢â‚¬Â Ãƒâ€šÃ‚Â°a ÃƒÆ’Ã¢â‚¬Å¾ÃƒÂ¢Ã¢â€šÂ¬Ã‹Å“ÃƒÆ’Ã¢â‚¬Â Ãƒâ€šÃ‚Â°ÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Â£c tÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â£i; khÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â´ng thÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€ Ã¢â‚¬â„¢ load base_hq.glb');
        return;
    }
    this._gltfLoader = this._gltfLoader || new THREE.GLTFLoader();
    const url = 'src/assets/models/base_hq.glb';
    console.log('ÃƒÆ’Ã¢â‚¬Å¾Ãƒâ€šÃ‚Âang tÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â£i lÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Âu/outpost GLB:', url);
    this._gltfLoader.load(url, (gltf) => {
        const root = this._prepareImportedModel(gltf.scene, { castShadow: true, receiveShadow: true });
        this._normalizeImportedModel(root, 9);
        root.position.set(x, 0, z);
        root.rotation.y = Math.PI * 0.5;
        root.name = 'TentOutpostImportedGLB';
        this.scene.add(root);
        this._externalModels.push(root);
        // VÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¬ lÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Âu xoay 90ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°, chiÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Âu rÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ng/sÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢u thÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Â±c tÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â¿ trÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âªn trÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Â¥c X/Z bÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¹ hoÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡n ÃƒÆ’Ã¢â‚¬Å¾ÃƒÂ¢Ã¢â€šÂ¬Ã‹Å“ÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢i so
        // vÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»ÃƒÂ¢Ã¢â€šÂ¬Ã‚Âºi bbox gÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»ÃƒÂ¢Ã¢â€šÂ¬Ã‹Å“c ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­nh lÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â¡i collision box SAU khi ÃƒÆ’Ã¢â‚¬Å¾ÃƒÂ¢Ã¢â€šÂ¬Ã‹Å“ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£ xoay ÃƒÆ’Ã¢â‚¬Å¾ÃƒÂ¢Ã¢â€šÂ¬Ã‹Å“ÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€ Ã¢â‚¬â„¢ khÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»ÃƒÂ¢Ã¢â€šÂ¬Ã‚Âºp thÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â­t.
        this._addModelCollisionBoxFromObject(root, x, z, { margin: 1.02, minWidth: 6, minDepth: 6 });
        console.log('LÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Âu/outpost GLB ÃƒÆ’Ã¢â‚¬Å¾ÃƒÂ¢Ã¢â€šÂ¬Ã‹Å“ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£ ÃƒÆ’Ã¢â‚¬Å¾ÃƒÂ¢Ã¢â€šÂ¬Ã‹Å“ÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â·t tÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â¡i:', x, z);
    }, undefined, (err) => {
        console.error('KhÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â´ng tÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â£i ÃƒÆ’Ã¢â‚¬Å¾ÃƒÂ¢Ã¢â€šÂ¬Ã‹Å“ÃƒÆ’Ã¢â‚¬Â Ãƒâ€šÃ‚Â°ÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Â£c lÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Âu/outpost GLB:', url, err);
    });
};

Renderer3D._loadGLBAsset = function(url, key, options = {}) {
    if (typeof THREE.GLTFLoader !== 'function') {
        console.warn('ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã‚Â¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ‚Â GLTFLoader chÃƒÆ’Ã¢â‚¬Â Ãƒâ€šÃ‚Â°a ÃƒÆ’Ã¢â‚¬Å¾ÃƒÂ¢Ã¢â€šÂ¬Ã‹Å“ÃƒÆ’Ã¢â‚¬Â Ãƒâ€šÃ‚Â°ÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Â£c nÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â¡p, bÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Â qua asset:', key);
        return Promise.resolve(null);
    }

    const loader = new THREE.GLTFLoader();
    const promise = new Promise((resolve, reject) => {
        loader.load(
            url,
            (gltf) => {
                const root = this._prepareExternalModel(gltf.scene, options);
                root.name = options.name || key;
                this._externalModels[key] = root;
                this.scene.add(root);
                resolve(root);
            },
            undefined,
            (error) => {
                console.error('ÃƒÆ’Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒâ€¦Ã¢â‚¬â„¢ KhÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â´ng tÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â£i ÃƒÆ’Ã¢â‚¬Å¾ÃƒÂ¢Ã¢â€šÂ¬Ã‹Å“ÃƒÆ’Ã¢â‚¬Â Ãƒâ€šÃ‚Â°ÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Â£c GLB:', key, error);
                // Asset failure should not kill the whole game.
                resolve(null);
            }
        );
    });

    this._assetPromises.push(promise);
    return promise;
};

Renderer3D._loadMainHQAndTent = function(cx, cz) {
    const mainHQPromise = this._loadGLBAsset('src/assets/models/model_game_ready.glb', 'mainHQModel', {
        name: 'MainHQModel',
        castShadow: true,
        receiveShadow: true
    }).then((root) => {
        if (!root) return null;
        // model_game_ready.glb is a wide, low-profile structure. This scale
        // keeps it proportionate to the existing central compound.
        this._fitModelToGround(root, cx, cz - 9, 0, 0.42);
        this._createPavedPad(cx, cz - 9, 58, 24, 0x30363b);

        // Keep the gameplay interaction point at the visual HQ center.
        this._militaryBuildingFunctions.command = {
            name: 'Command HQ',
            function: 'Base upgrades + money production hub'
        };
        return root;
    });

    const tentPromise = this._loadGLBAsset('src/assets/models/base_hq.glb', 'militaryHutModel', {
        name: 'MilitaryHutModel',
        castShadow: true,
        receiveShadow: true
    }).then((root) => {
        if (!root) return null;

        // Place the hut in the south-west support area, away from the HQ and
        // the main road lanes. It reads as a field command/survivor outpost.
        const x = cx - 39;
        const z = cz + 22;
        this._fitModelToGround(root, x, z, 0, 0.62);
        this._createPavedPad(x, z, 17, 25, 0x2a3034);

        // Add a small beacon/light to integrate it into the base layout.
        const beacon = new THREE.Mesh(
            new THREE.SphereGeometry(0.18, 8, 8),
            new THREE.MeshPhongMaterial({
                color: 0xffc857,
                emissive: 0xff9f1a,
                emissiveIntensity: 0.75
            })
        );
        beacon.position.set(x, 4.15, z - 8.0);
        beacon.castShadow = false;
        this.scene.add(beacon);
        return root;
    });

    return Promise.all([mainHQPromise, tentPromise]);
};

Renderer3D._createApocalypseCommandCenter = function(cx, cz) {
    const mats = this._apocalypseMaterials();
    const group = new THREE.Group();
    const W = 42, D = 30, H = 4.25;
    const towerW = 9, towerD = 13, towerH = 16.5;

    // Wide lower podium.
    this._apocBox(group, W, 1.2, D + 4, 0, 0.6, 0, mats.concreteDark, true);
    this._apocBox(group, 35, 2.1, 25.5, 0, 1.6, 0, mats.concrete, true);

    // Open central three-storey atrium: side masses frame the money-production hall.
    this._apocBox(group, 8.5, H * 3, 23.5, -14.2, H * 1.5 + 2.0, 0, mats.concrete, true);
    this._apocBox(group, 8.5, H * 3, 23.5, 14.2, H * 1.5 + 2.0, 0, mats.concrete, true);
    this._apocBox(group, 28.3, 0.7, 23.7, 0, H * 3 + 2.0, 0, mats.concreteDark, true);

    // Rear command core.
    this._apocBox(group, 25, H * 2.25, 6.5, 0, H * 1.12 + 1.0, -8.2, mats.concreteLight, true);

    // Two brutalist towers with observation slits, like the reference.
    for (const side of [-1, 1]) {
        const tx = side * 18;
        this._apocBox(group, towerW, towerH, towerD, tx, towerH / 2 + 2.15, -1.3, mats.concreteLight, true);
        // Tower cap and offset roof.
        this._apocBox(group, towerW + 1.2, 0.55, towerD + 1.2, tx, towerH + 2.42, -1.3, mats.concreteDark, true);
        this._apocBox(group, towerW + 2.1, 0.35, towerD + 2.0, tx, towerH + 2.8, -1.3, mats.concrete, true);

        // Vertical cyan strip under tower cap.
        this._apocStrip(group, tx, towerH - 0.2, -1.3, towerW - 1.5, 0.18, mats.cyan);

        // Dark observation slots on front/rear and one side.
        for (let y of [5.4, 9.0, 12.6, 16.0]) {
            this._apocSlitWindow(group, tx, y, 5.37, 4.6, 0.62);
        }
        this._apocSlitWindow(group, tx + side * 4.58, 11.3, -1.3, 0.08, 3.9, 3.4);
    }

    // Central glass atrium and the huge entrance airlock.
    for (let side of [-1, 1]) {
        const glass = this._apocBox(group, 7.8, 10.2, 0.22, side * 8.2, H * 1.18 + 1.6, 12.75, mats.glass, false);
        glass.castShadow = false;
        const frame = this._apocBox(group, 8.6, 0.24, 0.35, side * 8.2, 8.3, 12.82, mats.cyanSoft, false);
        frame.castShadow = false;
    }
    this._apocBox(group, 10.5, 5.1, 0.3, 0, 2.9, 15.25, mats.metal, false);
    this._apocBox(group, 8.8, 4.2, 0.16, 0, 2.7, 15.47, mats.darkGlass, false);
    this._apocStrip(group, 0, 5.2, 15.48, 8.4, 0.16, mats.cyan);

    // Floors visible through atrium + bright edge strips.
    for (let level = 0; level < 3; level++) {
        const y = 0.7 + level * H;
        this._apocBox(group, 25.5, 0.26, 23.2, 0, y, 0, mats.metal, false);
        this._apocStrip(group, 0, y + 0.22, 11.9, 24.4, 0.12, level === 0 ? mats.amber : mats.cyan);
    }

    // First floor money machine lanes: 8 slots, open, clean and intentionally spacious.
    const padMat = new THREE.MeshPhongMaterial({ color: 0x263136 });
    const laneMat = new THREE.MeshPhongMaterial({ color: 0x39484f });
    const edgeMat = new THREE.MeshPhongMaterial({ color: 0x48e0b2, emissive: 0x1c9a78, emissiveIntensity: 0.34 });
    const starts = [-9.2, -3.05, 3.05, 9.2];
    for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 4; col++) {
            const x = starts[col], z = -7 + row * 9.2;
            const pad = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.14, 6.1), padMat);
            pad.position.set(x, 2.42, z);
            pad.receiveShadow = true;
            group.add(pad);
            pad.userData = { buildZone: 'minter', slot: `${row}-${col}`, label: `MONEY MACHINE ${row*4+col+1}` };
            const lane = new THREE.Mesh(new THREE.BoxGeometry(4.1, 0.06, 5.1), laneMat);
            lane.position.set(x, 2.52, z);
            group.add(lane);
            lane.userData = { buildZone: 'minter', slot: `${row}-${col}` };
            for (const [dx, dz, w, d] of [[-2.2,-2.8,4.4,0.10],[-2.2,2.8,4.4,0.10],[2.2,-2.8,4.4,0.10],[2.2,2.8,4.4,0.10],[-2.45,0,0.10,5.5],[2.45,0,0.10,5.5]]) {
                const edge = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, d), edgeMat);
                edge.position.set(x + dx, 2.57, z + dz);
                group.add(edge);
            }
            const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), mats.cyan);
            beacon.position.set(x - 1.9, 2.72, z - 2.4);
            group.add(beacon);
        }
    }

    // Upper floors: control rooms / operations windows visible from outside.
    for (let level = 1; level <= 2; level++) {
        const y = 4.1 + level * H;
        for (let side = -1; side <= 1; side += 2) {
            this._apocBox(group, 7.2, 2.0, 0.22, side * 8.6, y + 0.4, 12.74, mats.glass, false);
            this._apocBox(group, 7.2, 0.16, 0.22, side * 8.6, y - 0.75, 12.9, mats.cyanSoft, false);
        }
    }

    // Rooftop command deck, beacon mast and antenna cluster.
    this._apocBox(group, 14, 0.55, 8.5, 0, H * 3 + 3.3, 0, mats.concreteDark, true);
    this._apocBox(group, 11.5, 0.28, 6.0, 0, H * 3 + 3.72, 0, mats.steel, false);
    this._apocStrip(group, 0, H * 3 + 4.0, 3.02, 9.8, 0.16, mats.cyan);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 8.0, 8), mats.steel);
    mast.position.set(0, H * 3 + 7.8, 0);
    mast.castShadow = true;
    group.add(mast);
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 10), mats.red);
    beacon.position.set(0, H * 3 + 11.8, 0);
    group.add(beacon);
    for (let i = -2; i <= 2; i++) {
        const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 2.4, 6), mats.steel);
        antenna.position.set(i * 1.7, H * 3 + 6.0, -2.3);
        group.add(antenna);
    }

    // Side stairs / ramps.
    for (let side of [-1, 1]) {
        for (let i = 0; i < 8; i++) {
            const step = this._apocBox(group, 4.4, 0.24, 0.85, side * 11.7, 2.5 + i * 0.32, -10 + i * 0.95, mats.steel, true);
            step.rotation.y = side < 0 ? -0.06 : 0.06;
        }
    }

    this._apocLabel(group, 'COMMAND HQ', 0x62e8ff, 0, 10.7, 15.62, 12.0, 1.25);
    this._apocLabel(group, 'BASE OPERATIONS', 0xffc857, 0, 6.9, 15.64, 9.0, 0.9);
    this._apocLabel(group, 'MONEY DECK ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ BUILD HERE', 0x42e8a1, 0, 2.15, 15.7, 14.0, 0.82);

    // Strong architectural diagonals to emulate the carved/brutalist reference.
    for (let side of [-1, 1]) {
        const brace = this._apocBox(group, 1.05, 14.5, 1.05, side * 10.8, 9.0, 10.6, mats.concreteDark, true);
        brace.rotation.z = side * -0.17;
    }

    group.position.set(cx, 0, cz);
    this.scene.add(group);

    this._createPavedPad(cx, cz + 1, W + 14, D + 16, 0x30363b);
    this._militaryBuildingFunctions.command = { name: 'Command HQ', function: 'Base upgrades + money production hub' };
};

Renderer3D._createHQInterior = function(cx, cz) {
    const mats = this._apocalypseMaterials();
    const g = new THREE.Group();
    this._hqInterior = { cx, cz, floor1Y: 2.52, floor2Y: 6.77, floor3Y: 11.02 };

    // Soft interior illumination ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â cool emergency strips + warm task lights.
    const addPoint = (x,y,z,color,intensity,distance) => {
        const light = new THREE.PointLight(color, intensity, distance);
        light.position.set(x,y,z); g.add(light); return light;
    };
    [[0,3.0,5.2,0x62e8ff,1.7,16],[0,7.0,3.5,0x62e8ff,1.4,14],[-6,11.0,-4,0xffc857,1.3,13],[7,11.0,-4,0x62e8ff,1.2,12]].forEach(v=>addPoint(...v));

    // Ground-floor security lobby and reception.
    this._apocLabel(g, 'SECURITY / CHECK-IN', 0x62e8ff, 0, 3.0, 11.92, 11.2, 0.68);
    this._apocBox(g, 8.5, 1.15, 2.1, 0, 3.05, 7.0, mats.metal, false);
    this._apocBox(g, 7.6, 0.18, 1.7, 0, 3.64, 7.0, mats.darkGlass, false);
    for (let x of [-2.6,0,2.6]) {
        this._apocBox(g, 1.5, 1.6, 0.7, x, 3.95, 6.3, mats.concreteDark, false);
        this._apocStrip(g, x, 4.45, 5.92, 0.85, 0.06, mats.cyan);
    }
    // Two CCTV screens.
    for (let x of [-4.7,4.7]) {
        this._apocBox(g, 3.2, 1.6, 0.12, x, 4.9, 7.9, mats.darkGlass, false);
        this._apocStrip(g, x, 5.0, 7.83, 2.4, 0.08, mats.cyanSoft);
    }

    // Floor 1: money production hall / armory corridor.
    this._apocLabel(g, 'MONEY PRODUCTION DECK', 0x42e8a1, 0, 5.28, 11.9, 12.6, 0.66);
    this._apocBox(g, 0.18, 3.2, 21.0, -11.7, 4.2, -0.2, mats.steel, false);
    this._apocBox(g, 0.18, 3.2, 21.0, 11.7, 4.2, -0.2, mats.steel, false);
    // Armory glass cases / weapon racks on side corridors.
    for (let side of [-1,1]) {
        for (let i=0;i<5;i++) {
            const x = side*10.5, z=-7.7+i*3.5;
            this._apocBox(g, 2.1, 1.85, 0.35, x, 3.65, z, mats.darkGlass, false);
            this._apocBox(g, 0.12, 1.5, 2.5, side*9.32, 3.6, z, mats.steel, false);
            for(let k=0;k<3;k++) {
                const rifle=this._apocBox(g, 0.12, 1.0, 0.12, side*10.5, 3.55+k*0.34, z-0.55+k*0.12, mats.cyanSoft, false);
                rifle.rotation.z = side*0.1;
            }
        }
    }

    // Central staircase from lobby to upper operations deck.
    this._createInteriorStair(g, -9.0, 4.95, 6.0, -3.0, 2.52, 4.95, mats);
    this._createInteriorStair(g, 9.0, -2.0, -7.0, -9.0, 4.95, 6.77, mats);
    this._createInteriorStair(g, -9.0, -7.0, 0.0, -14.0, 6.77, 11.02, mats);

    // Floor 2 command / intelligence suite.
    this._apocLabel(g, 'COMMAND & INTELLIGENCE', 0xffc857, 0, 9.55, 11.92, 13.5, 0.66);
    this._apocBox(g, 13.5, 0.28, 5.2, 0, 6.98, 4.0, mats.steel, false);
    for (let i=-2;i<=2;i++) {
        this._apocBox(g, 3.4, 2.0, 0.18, i*3.2, 8.15, 3.4, mats.darkGlass, false);
        this._apocStrip(g, i*3.2, 8.2, 3.30, 2.5, 0.08, i===0?mats.amber:mats.cyan);
    }
    // Central hologram / tactical table.
    this._apocBox(g, 6.8, 0.9, 3.8, 0, 7.48, -1.5, mats.metal, false);
    this._apocBox(g, 5.8, 0.15, 2.8, 0, 7.98, -1.5, mats.glass, false);
    for(let i=-2;i<=2;i++) this._apocStrip(g, i*1.0, 8.08, -1.5, 0.46, 2.1, mats.cyanSoft, 0);
    // Server cabinets.
    for(let side of [-1,1]) {
        for(let i=0;i<4;i++) {
            const rack=this._apocBox(g, 1.3, 3.4, 1.0, side*9.2, 8.47, -5.9+i*2.1, mats.metal, false);
            this._apocStrip(g, side*9.2, 8.5, -5.9+i*2.1+0.56, 0.85, 0.06, mats.cyan);
        }
    }

    // Floor 3: commander suite / war room / rooftop access.
    this._apocLabel(g, 'COMMAND DECK / WAR ROOM', 0x62e8ff, 0, 13.8, 11.92, 13.5, 0.66);
    this._apocBox(g, 14.0, 0.42, 7.0, 0, 11.25, -3.0, mats.metal, false);
    for(let i=-3;i<=3;i++) {
        const chair=this._apocBox(g, 1.0, 0.8, 0.8, i*1.9, 11.75, 1.2, mats.military, false);
        chair.rotation.y = Math.PI;
    }
    this._apocBox(g, 10.5, 0.18, 0.65, 0, 13.0, -7.7, mats.darkGlass, false);
    this._apocStrip(g, 0, 13.12, -7.34, 8.8, 0.08, mats.amber);
    this._apocLabel(g, 'ROOFTOP ACCESS', 0xffc857, 0, 11.45, -0.5, 9.5, 0.55);

    // Elevator / lift shaft with animated-style door frame.
    this._apocBox(g, 3.2, 12.3, 2.5, -6.1, 6.15, -10.0, mats.metal, false);
    for(let floor=0;floor<3;floor++) {
        const y=2.45+floor*4.25;
        this._apocBox(g, 2.4, 3.35, 0.12, -6.1, y+1.45, -8.68, mats.darkGlass, false);
        this._apocStrip(g, -6.1, y+2.8, -8.58, 1.8, 0.08, mats.cyan);
    }
    this._apocLabel(g, 'LIFT', 0x42e8a1, -6.1, 3.0, -8.5, 3.5, 0.45);

    // Emergency lighting strips along every level.
    [2.52,6.77,11.02].forEach((y,idx)=>{
        this._apocStrip(g, 0, y+0.12, 11.82, 22, 0.07, idx===0?mats.amber:mats.cyan);
    });

    g.position.set(cx,0,cz);
    this.scene.add(g);
};

Renderer3D._createInteriorStair = function(group, x, zStart, zEnd, x2, yStart, yEnd, mats) {
    const steps=12;
    for(let i=0;i<steps;i++) {
        const t=i/(steps-1);
        const xPos=x+(x2-x)*t;
        const zPos=zStart+(zEnd-zStart)*t;
        const y=yStart+(yEnd-yStart)*t;
        const step=this._apocBox(group, 3.1, 0.22, 0.72, xPos, y, zPos, mats.steel, false);
        step.rotation.y=Math.atan2(zEnd-zStart,x2-x);
        const lamp=this._apocBox(group, 2.4, 0.06, 0.06, xPos, y+0.15, zPos-0.3, mats.cyanSoft, false);
    }
    const railL=this._apocBox(group, 0.10, 1.2, Math.hypot(x2-x,zEnd-zStart), x, yStart+0.72, (zStart+zEnd)/2, mats.steel, false);
    railL.rotation.y=Math.atan2(zEnd-zStart,x2-x);
};

Renderer3D._createAutomatedMachineGunNetwork = function(cx, cz) {
    this._autoDefenseTurrets = [];
    const spots = [
        [-92,92, 12], [92,92,-12], [-92,-92,18], [92,-92,-18],
        [-70,5,0], [70,5,Math.PI], [0,99,0], [0,-99,Math.PI],
        [-53,-30,0.4], [53,-30,Math.PI-0.4], [-84,-78,0.3], [86,-78,Math.PI-0.3]
    ];
    spots.forEach(([dx,dz,rot])=>this._createAutomatedMachineGun(cx+dx, cz+dz, rot));
};

Renderer3D._createAutomatedMachineGun = function(x,z,rotationY=0) {
    const mats=this._apocalypseMaterials();
    const g=new THREE.Group();
    this._apocBox(g,2.2,0.55,2.2,0,0.28,0,mats.concreteDark,false);
    const pedestal=this._apocBox(g,1.1,1.5,1.1,0,1.0,0,mats.steel,false);
    const head=this._apocBox(g,1.35,0.65,1.15,0,1.95,0,mats.military,false);
    const barrel=this._apocBox(g,0.32,0.28,2.8,0,1.95,-1.2,mats.metal,false);
    const barrel2=this._apocBox(g,0.22,0.22,2.65,0.45,1.95,-1.2,mats.metal,false);
    const sensor=new THREE.Mesh(new THREE.SphereGeometry(0.16,8,8),mats.red);
    sensor.position.set(0,2.35,0); g.add(sensor);
    this._apocStrip(g,0,2.18,-0.61,0.9,0.08,mats.cyan);
    g.position.set(x,0,z); g.rotation.y=rotationY; this.scene.add(g);
    const turret={x,z,y:1.95,group:g,head,barrel,barrel2,range:29,fireRate:380,damage:8,lastShot:0,angle:rotationY,homeAngle:rotationY};
    this._autoDefenseTurrets.push(turret);
    return turret;
};

Renderer3D._updateAutomatedMachineGuns = function(deltaTime, zombies) {
    if (!this._autoDefenseTurrets || !zombies) return;
    const now = Date.now();
    for (const turret of this._autoDefenseTurrets) {
        let target = null, best = turret.range;
        for (const z of zombies) {
            const d = Math.hypot(z.x - turret.x, z.z - turret.z);
            if (d < best) { best = d; target = z; }
        }
        if (target) {
            const desired = Math.atan2(target.x - turret.x, target.z - turret.z);
            let diff = desired - turret.angle;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            turret.angle += Math.max(-0.08, Math.min(0.08, diff));
            const local = turret.angle - turret.homeAngle;
            turret.head.rotation.y = local;
            turret.barrel.rotation.y = local;
            turret.barrel2.rotation.y = local;
            if (now - turret.lastShot >= turret.fireRate) {
                if (typeof target.takeDamage === 'function') target.takeDamage(turret.damage);
                turret.lastShot = now;
                this._createAutoTracer(turret, target);
            }
        }
    }
};

Renderer3D._createAutoTracer = function(turret, target) {
    const start=new THREE.Vector3(turret.x,2.0,turret.z);
    const end=new THREE.Vector3(target.x,1.0,target.z);
    const geometry=new THREE.BufferGeometry().setFromPoints([start,end]);
    const material=new THREE.LineBasicMaterial({color:0xffd86b,transparent:true,opacity:0.9});
    const line=new THREE.Line(geometry,material);
    this.scene.add(line);
    setTimeout(()=>{
        if(line.parent) line.parent.remove(line);
        geometry.dispose(); material.dispose();
    },70);
};

Renderer3D._createApocalypseBarracksArea = function(cx, cz) {
    const mats = this._apocalypseMaterials();
    this._militaryBuildingFunctions.barracks = { name: 'Barracks', function: 'Troop housing' };
    [[0,0],[16,0],[0,15],[16,15]].forEach(([dx,dz], i) => {
        this._createApocalypseBlock(cx+dx, cz+dz, {
            width: 13, height: 5.4, depth: 9,
            label: i === 0 ? 'BARRACKS' : 'QUARTERS',
            labelColor: 0x9ee7b6,
            bodyMat: i % 2 ? mats.military : mats.concrete,
            upperWidth: 7, upperOffsetX: i % 2 ? 2.0 : -1.5, pad: true
        });
    });
    const canopy = new THREE.Group();
    this._apocBox(canopy, 31, 0.26, 2.6, 7.5, 4.3, 26.0, mats.metal, false);
    for (let i = 0; i < 7; i++) {
        this._apocBox(canopy, 0.14, 4.0, 0.14, -7 + i * 4.8, 2.0, 24.8, mats.steel, false);
        const l = this._apocBox(canopy, 0.28, 0.16, 1.4, -7 + i * 4.8, 4.12, 24.8, mats.cyan, false);
        l.castShadow = false;
    }
    canopy.position.set(cx, 0, cz); this.scene.add(canopy);
};

Renderer3D._createApocalypseSupplyDepot = function(cx, cz) {
    const mats = this._apocalypseMaterials();
    this._militaryBuildingFunctions.supply = { name: 'Supply Depot', function: 'Ammo and logistics' };
    this._createApocalypseBlock(cx, cz, { width: 23, height: 7, depth: 15, label: 'SUPPLY DEPOT', labelColor: 0xffc857, bodyMat: mats.concrete, upperWidth: 12, upperOffsetX: 4 });
    const colors = [0x57636a, 0x45545c, 0x6a4f3e, 0x3c5662];
    for (let i = 0; i < 4; i++) {
        const cont = new THREE.Mesh(new THREE.BoxGeometry(6, 2.4, 2.6), new THREE.MeshPhongMaterial({ color: colors[i] }));
        cont.position.set(cx - 8.5 + i * 5.7, 1.2, cz + 11.0);
        cont.rotation.y = i % 2 ? 0.02 : -0.01; cont.castShadow = true; cont.receiveShadow = true;
        this.scene.add(cont); this._addCollisionMesh(cont);
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.08, 0.16), mats.amber);
        stripe.position.set(cont.position.x, 2.15, cont.position.z - 1.35); this.scene.add(stripe);
    }
};

Renderer3D._createApocalypseMotorPool = function(cx, cz) {
    const mats = this._apocalypseMaterials();
    this._militaryBuildingFunctions.motorPool = { name: 'Motor Pool', function: 'Vehicle storage' };
    this._createApocalypseBlock(cx, cz, { width: 28, height: 6.8, depth: 16, label: 'MOTOR POOL', labelColor: 0x62e8ff, bodyMat: mats.military, upperWidth: 14, upperOffsetX: -4 });
    for (let i = -2; i <= 2; i++) {
        const vehicle = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.15, 2.2), new THREE.MeshPhongMaterial({ color: i%2 ? 0x536256 : 0x3e4b43 }));
        vehicle.position.set(cx + i*5.0, 0.85, cz + 11.0); vehicle.castShadow = true; this.scene.add(vehicle);
        for (const dx of [-1.35, 1.35]) {
            const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.42,0.42,0.28,10), mats.metal);
            wheel.rotation.z = Math.PI/2; wheel.position.set(cx + i*5 + dx, 0.45, cz + 11.0); this.scene.add(wheel);
        }
    }
};

Renderer3D._createApocalypseResearchFacility = function(cx, cz) {
    const mats = this._apocalypseMaterials();
    this._militaryBuildingFunctions.lab = { name: 'Research Lab', function: 'Zombie research' };
    this._createApocalypseBlock(cx, cz, { width: 24, height: 7.2, depth: 15, label: 'RESEARCH LAB', labelColor: 0x65ecff, bodyMat: mats.concreteLight, upperWidth: 14, upperOffsetX: -3 });
    for (let i = -2; i <= 2; i++) {
        const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.92,0.92,4.0,18), new THREE.MeshPhongMaterial({ color:0x203037, transparent:true, opacity:0.95 }));
        tank.position.set(cx + i*3.2, 2.0, cz + 11.0); tank.castShadow = true; this.scene.add(tank);
        const fluid = new THREE.Mesh(new THREE.CylinderGeometry(0.62,0.62,2.5,16), new THREE.MeshPhongMaterial({ color:0x52d7e8, emissive:0x1c7c89, emissiveIntensity:0.5, transparent:true, opacity:0.62 }));
        fluid.position.set(cx + i*3.2, 1.55, cz + 11.0); this.scene.add(fluid);
    }
};

Renderer3D._createApocObstacleCourse = function(cx, cz) {
    const mats = this._apocalypseMaterials();
    for (let i = -2; i <= 2; i++) {
        const h = 1.1 + Math.abs(i)*0.25;
        const block = new THREE.Mesh(new THREE.BoxGeometry(2.2, h, 1.2), mats.concreteDark);
        block.position.set(cx + i*5.5, h/2, cz - 4); block.castShadow = true;
        this.scene.add(block); this._addCollisionMesh(block);
    }
    for (let i = -2; i <= 2; i++) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08,0.10,2.4,6), mats.steel);
        pole.position.set(cx + i*4.5, 1.2, cz - 8); this.scene.add(pole);
        const rope = new THREE.Mesh(new THREE.BoxGeometry(3.8,0.05,0.05), mats.amber);
        rope.position.set(cx + i*4.5, 2.25, cz - 8); this.scene.add(rope);
    }
};

Renderer3D._createApocalypseTrainingGround = function(cx, cz) {
    const mats = this._apocalypseMaterials();
    this._militaryBuildingFunctions.training = { name: 'Training Ground', function: 'Weapon practice' };
    this._createPavedPad(cx, cz, 38, 24, 0x2a3034);
    this._createApocObstacleCourse(cx, cz);
    for (let i = -2; i <= 2; i++) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.16,3.0,0.16), mats.steel);
        post.position.set(cx + i*6.4, 1.5, cz + 8); this.scene.add(post);
        const target = new THREE.Mesh(new THREE.CylinderGeometry(0.9,0.9,0.18,18), new THREE.MeshPhongMaterial({color:0xe0e5e7}));
        target.rotation.x = Math.PI/2; target.position.set(cx+i*6.4, 2.2, cz+8); this.scene.add(target);
    }
    this._apocLabel(this.scene, 'TRAINING GROUND', 0x9ee7b6, cx, 0.1, cz - 10.6, 9, 0.8);
};

Renderer3D._createApocalypseShootingRange = function(cx, cz) {
    const mats = this._apocalypseMaterials();
    this._militaryBuildingFunctions.range = { name: 'Shooting Range', function: 'Weapon testing' };
    this._createPavedPad(cx, cz, 42, 22, 0x252b2e);
    for (let lane = -2; lane <= 2; lane++) {
        const line = new THREE.Mesh(new THREE.BoxGeometry(0.10,0.03,18), mats.steel);
        line.position.set(cx + lane*7.5, 0.18, cz); this.scene.add(line);
        const target = new THREE.Mesh(new THREE.BoxGeometry(2.2,2.8,0.20), mats.darkGlass);
        target.position.set(cx + lane*7.5, 1.4, cz + 7.5); this.scene.add(target);
        this._addCollisionMesh(target);
        this._apocStrip(this.scene, cx + lane*7.5, 2.8, cz+7.66, 1.7, 0.10, mats.cyan);
    }
    this._apocLabel(this.scene, 'LIVE FIRE', 0xff6b6b, cx, 3.5, cz - 10.8, 7.0, 0.8);
};

Renderer3D._createApocalypseRadarStation = function(cx, cz) {
    const mats = this._apocalypseMaterials();
    this._militaryBuildingFunctions.radar = { name: 'Radar Station', function: 'Detect waves' };
    const g = new THREE.Group();
    this._apocBox(g, 10, 0.6, 10, 0, 0.3, 0, mats.concreteDark, true);
    this._apocBox(g, 2.0, 10, 2.0, 0, 5.3, 0, mats.steel, true);
    const dish = new THREE.Mesh(new THREE.SphereGeometry(3.7,20,12,0,Math.PI), new THREE.MeshPhongMaterial({ color:0x7f8c8d, flatShading:true }));
    dish.position.set(0,10.7,0); dish.rotation.x = -Math.PI/2.6; dish.castShadow = true; g.add(dish);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,8,8), mats.cyan);
    beam.position.set(0,14.5,0); g.add(beam);
    this._apocLabel(g,'RADAR',0x62e8ff,0,2.0,5.15,5.6,0.72);
    g.position.set(cx,0,cz); this.scene.add(g);
};

Renderer3D._createApocalypseCommsTower = function(cx, cz) {
    const mats = this._apocalypseMaterials();
    this._militaryBuildingFunctions.comms = { name: 'Comms Tower', function: 'Contracts' };
    const g = new THREE.Group();
    [[-2,-2],[2,-2],[2,2],[-2,2]].forEach(([x,z]) => this._apocBox(g,0.18,18,0.18,x,9,z,mats.steel,true));
    for (let y=3; y<=16; y+=3) {
        this._apocBox(g,4.6,0.12,0.12,0,y,-2,mats.steel,false);
        this._apocBox(g,4.6,0.12,0.12,0,y, 2,mats.steel,false);
    }
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.3,8,8), mats.red); beacon.position.set(0,18.4,0); g.add(beacon);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.3,0.06,8,32), mats.cyan); ring.rotation.x=Math.PI/2; ring.position.set(0,13.4,0); g.add(ring);
    this._apocLabel(g,'COMMS',0xffc857,0,2.0,4.9,6.0,0.72);
    g.position.set(cx,0,cz); this.scene.add(g);
};

Renderer3D._createApocalypseGuardTower = function(x, z) {
    const mats = this._apocalypseMaterials();
    const g = new THREE.Group();
    this._apocBox(g,4.2,7.8,4.2,0,3.9,0,mats.concrete,true);
    this._apocBox(g,5.0,0.45,5.0,0,8.0,0,mats.concreteDark,true);
    this._apocBox(g,3.8,1.6,3.8,0,8.85,0,mats.concreteLight,true);
    for (const side of [-1,1]) { this._apocSlitWindow(g,side*1.91,8.8,0,0.08,0.7,3.0); }
    this._apocStrip(g,0,8.02,0,4.2,0.16,mats.cyan);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.20,8,8), mats.amber); lamp.position.set(0,9.8,0); g.add(lamp);
    g.position.set(x,0,z); this.scene.add(g);
};

Renderer3D._createApocalypseBaseProps = function(cx, cz) {
    const mats = this._apocalypseMaterials();
    for (let i = 0; i < 14; i++) {
        const side = i%2===0 ? -1 : 1;
        const x = cx + side*(68 + (i%4)*5.5);
        const z = cz - 48 + Math.floor(i/4)*4.2;
        const crate = new THREE.Mesh(new THREE.BoxGeometry(2.4,1.3,1.8), i%3===0 ? mats.olive : mats.military);
        crate.position.set(x,0.65,z); crate.rotation.y=(i%5)*0.12; crate.castShadow=true; crate.receiveShadow=true;
        this.scene.add(crate); this._addCollisionMesh(crate);
    }
    const sand = mats.sand;
    for (const [dx,dz] of [[-78,48],[76,48],[-72,-46],[72,-42],[-24,87],[28,87]]) {
        for (let j=-2; j<=2; j++) {
            const bag = new THREE.Mesh(new THREE.BoxGeometry(1.9,0.55,0.75), sand);
            bag.position.set(cx+dx+j*1.5, 0.28, cz+dz+(j%2)*0.10); bag.rotation.y=j*0.05; bag.castShadow=true; this.scene.add(bag);
        }
    }
    for (let i=-5; i<=5; i++) {
        for (const side of [-1,1]) {
            const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08,0.11,5.8,6), mats.steel);
            pole.position.set(cx+i*18, 2.9, cz+side*45); this.scene.add(pole);
            const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.48,0.18,0.7), mats.cyan);
            lamp.position.set(cx+i*18, 5.65, cz+side*45); this.scene.add(lamp);
        }
    }
};

Renderer3D._createApocalypseMainGate = function(cx,cz) {
    const mats=this._apocalypseMaterials();
    const g=new THREE.Group();
    this._apocBox(g,12,8,5, -10,4,0,mats.concrete,true);
    this._apocBox(g,12,8,5, 10,4,0,mats.concrete,true);
    this._apocBox(g,8,1.2,5,0,7.2,0,mats.concreteDark,true);
    this._apocBox(g,7.2,4.2,0.45,0,2.8,0,mats.metal,false);
    this._apocBox(g,0.18,4.6,0.55,0,2.7,0,mats.cyanSoft,false);
    this._apocLabel(g,'SECURITY GATE',0x62e8ff,0,6.25,0.28,10,0.8);
    g.position.set(cx,0,cz); this.scene.add(g);
};

Renderer3D._createApocalypseSecondaryGate = function(cx,cz) {
    const mats=this._apocalypseMaterials();
    const g=new THREE.Group();
    this._apocBox(g,7,6,4,-6,3,0,mats.concrete,true);
    this._apocBox(g,7,6,4,6,3,0,mats.concrete,true);
    this._apocBox(g,5.5,0.8,4,0,5.8,0,mats.concreteDark,true);
    this._apocLabel(g,'SERVICE GATE',0xffc857,0,5.0,0.25,8,0.7);
    g.position.set(cx,0,cz); this.scene.add(g);
};

Renderer3D._registerApocalypseMilitaryInteractions = function(cx,cz) {
    this._militaryInteractions = [
        { id:'hq', name:'COMMAND HQ', description:'NÃƒÂ¢ng cÃ¡ÂºÂ¥p cÃ„Æ’n cÃ¡Â»Â© vÃƒÂ  mÃ¡Â»Å¸ cÃƒÂ¡c mÃƒÂ¡y kiÃ¡ÂºÂ¿m tiÃ¡Â»Ân.', x:cx, z:cz-9, radius:14 },
        { id:'barracks', name:'BARRACKS', description:'TuyÃ¡Â»Æ’n lÃƒÂ­nh gÃƒÂ¡c vÃƒÂ  tÃ„Æ’ng phÃƒÂ²ng thÃ¡Â»Â§.', x:cx-55, z:cz-28, radius:12 },
        { id:'mess', name:'MESS HALL', description:'HÃ¡Â»â€œi stamina vÃƒÂ  nhÃ¡ÂºÂ­n buff.', x:cx-38, z:cz+36, radius:10 },
        { id:'medical', name:'MEDICAL', description:'SÃ¡Â»Â­ dÃ¡Â»Â¥ng vÃ¡ÂºÂ­t tÃ†Â° y tÃ¡ÂºÂ¿.', x:cx-38, z:cz+36, radius:10 },
        { id:'supply', name:'SUPPLY DEPOT', description:'Mua ammo vÃƒÂ  nÃƒÂ¢ng cÃ¡ÂºÂ¥p vÃ…Â© khÃƒÂ­.', x:cx+53, z:cz-30, radius:12 },
        { id:'fuel', name:'FUEL FARM', description:'QuÃ¡ÂºÂ£n lÃƒÂ½ nhiÃƒÂªn liÃ¡Â»â€¡u vÃƒÂ  income.', x:cx+62, z:cz+17, radius:10 },
        { id:'motorPool', name:'MOTOR POOL', description:'TriÃ¡Â»â€¡u hÃ¡Â»â€œi vÃƒÂ  nÃƒÂ¢ng cÃ¡ÂºÂ¥p vehicle.', x:cx+49, z:cz+57, radius:13 },
        { id:'lab', name:'RESEARCH LAB', description:'NghiÃƒÂªn cÃ¡Â»Â©u zombie vÃƒÂ  weapon.', x:cx+3, z:cz-73, radius:13 },
        { id:'workshop', name:'VEHICLE WORKSHOP', description:'SÃ¡Â»Â­a vÃƒÂ  nÃƒÂ¢ng cÃ¡ÂºÂ¥p vehicle.', x:cx-49, z:cz-73, radius:12 },
        { id:'training', name:'TRAINING GROUND', description:'LuyÃ¡Â»â€¡n weapon XP.', x:cx-42, z:cz+70, radius:15 },
        { id:'range', name:'SHOOTING RANGE', description:'Test sÃƒÂºng vÃƒÂ  accuracy.', x:cx+30, z:cz+70, radius:15 },
        { id:'radar', name:'RADAR', description:'PhÃƒÂ¡t hiÃ¡Â»â€¡n zombie wave vÃƒÂ  boss.', x:cx+86, z:cz-78, radius:10 },
        { id:'comms', name:'COMMS', description:'NhÃ¡ÂºÂ­n supply contracts.', x:cx-84, z:cz-78, radius:10 }
    ];
};

Renderer3D._registerMilitaryInteractions = Renderer3D._registerApocalypseMilitaryInteractions;
Renderer3D._createCommandCenter = Renderer3D._createApocalypseCommandCenter;
Renderer3D._createLargeBarracksArea = Renderer3D._createApocalypseBarracksArea;
Renderer3D._createLargeSupplyDepot = Renderer3D._createApocalypseSupplyDepot;
Renderer3D._createResearchFacility = Renderer3D._createApocalypseResearchFacility;
Renderer3D._createVehicleWorkshop = function(cx,cz) { return Renderer3D._createApocalypseBlock.call(this,cx,cz,{width:23,height:7,depth:14,label:'VEHICLE WORKSHOP',labelColor:0xffc857,bodyMat:this._apocalypseMaterials().military,upperWidth:12,upperOffsetX:3}); };
Renderer3D._createTrainingGround = Renderer3D._createApocalypseTrainingGround;
Renderer3D._createShootingRange = Renderer3D._createApocalypseShootingRange;
Renderer3D._createGuardTower = Renderer3D._createApocalypseGuardTower;
Renderer3D._createMainGate = Renderer3D._createApocalypseMainGate;
Renderer3D._createSecondaryGate = Renderer3D._createApocalypseSecondaryGate;

// ================================================================
// EXTERNAL MODELS (base_hq.glb, Turel.fbx, minign.fbx) Loader
// ================================================================
Renderer3D.loadExternalModels = function() {
    if (!this._externalModels) this._externalModels = {};
    this._modelLoadStatus = { turel: false, minigun: false, hq: false };

    const paths = {
        hq:     'src/assets/models/base_hq.glb',
        turel:  'src/assets/models/Turel.fbx',
        minigun:'src/assets/models/minign.fbx'
    };

    if (typeof GLTFLoader !== 'undefined' && !this._gltfLoader) this._gltfLoader = new GLTFLoader();
    if (typeof THREE.FBXLoader !== 'undefined' && !this._fbxLoader) this._fbxLoader = new THREE.FBXLoader();

    // GLB -> base_hq
    if (this._gltfLoader) {
        try {
            this._gltfLoader.load(paths.hq, (gltf) => {
                const root = gltf.scene || gltf;
                root.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; }});
                this._externalModels.hq = root;
                this._modelLoadStatus.hq = true;
                this._applyHQModelOverride(root);
                console.log('ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€šÃ‚ÂÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂºÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ‚Â ÃƒÆ’Ã¢â‚¬Å¾Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£ load model base_hq.glb');
            }, undefined, (err) => {
                console.warn('ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã‚Â¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ‚Â KhÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â´ng load ÃƒÆ’Ã¢â‚¬Å¾ÃƒÂ¢Ã¢â€šÂ¬Ã‹Å“ÃƒÆ’Ã¢â‚¬Â Ãƒâ€šÃ‚Â°ÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Â£c base_hq.glb, giÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Â¯ HQ dÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Â±ng bÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â±ng code:', err?.message || err);
            });
        } catch(e) { console.warn('GLTFLoader error', e); }
    }

    // FBX -> Turel & Minigun (tÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â¡o fallback geometry nÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â¿u FBXLoader chÃƒÆ’Ã¢â‚¬Â Ãƒâ€šÃ‚Â°a cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³)
    const loadFBX = (key, path, onSuccess) => {
        try {
            if (this._fbxLoader) {
                this._fbxLoader.load(path, (obj) => {
                    obj.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; }});
                    this._externalModels[key] = obj;
                    this._modelLoadStatus[key] = true;
                    if (onSuccess) onSuccess(obj);
                    console.log(`ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒâ€šÃ‚Â¦ ÃƒÆ’Ã¢â‚¬Å¾Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£ load FBX model ${key}`);
                }, undefined, (err) => {
                    console.warn(`ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã‚Â¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ‚Â KhÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â´ng load ÃƒÆ’Ã¢â‚¬Å¾ÃƒÂ¢Ã¢â€šÂ¬Ã‹Å“ÃƒÆ’Ã¢â‚¬Â Ãƒâ€šÃ‚Â°ÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Â£c ${key} FBX, dÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¹ng mesh tÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â¡o bÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â±ng code thay thÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â¿.`);
                    this._modelLoadStatus[key] = false;
                });
            } else {
                this._modelLoadStatus[key] = false;
            }
        } catch(e) {
            console.warn(`FBXLoader lÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Âi (${key}):`, e);
            this._modelLoadStatus[key] = false;
        }
    };

    loadFBX('turel', paths.turel);
    loadFBX('minigun', paths.minigun);
};

Renderer3D._applyHQModelOverride = function(hqModel) {
    const cx = 250, cz = 250 - 18;
    try {
        const model = hqModel.clone(true);
        const box = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3();
        box.getSize(size);
        const scale = Math.min(30 / Math.max(size.x, 0.01), 14 / Math.max(size.y, 0.01), 25 / Math.max(size.z, 0.01));
        model.scale.setScalar(scale);
        const b2 = new THREE.Box3().setFromObject(model);
        const center = new THREE.Vector3();
        b2.getCenter(center);
        model.position.set(cx - center.x, -b2.min.y, cz - center.z);
        this.scene.add(model);
        this._addCollisionMesh(model);
        this._hqExternalModel = model;
    } catch(e) { console.warn('HQ Model alignment error', e); }
};

Renderer3D._getTurretAssets = function() {
    if (this._turretAssets) return this._turretAssets;
    this._turretAssets = {
        basePlatform:   new THREE.CylinderGeometry(2.0, 2.4, 0.6, 8),
        baseRing:       new THREE.CylinderGeometry(1.5, 1.7, 0.4, 8),
        turretCollar:   new THREE.CylinderGeometry(1.1, 1.3, 0.8, 8),
        housingGeo:     new THREE.BoxGeometry(2.2, 1.3, 2.0),
        armorPlateGeo:  new THREE.BoxGeometry(2.4, 0.9, 1.2),
        barrelGeo:      new THREE.CylinderGeometry(0.13, 0.16, 3.2, 8),
        muzzleBrakeGeo: new THREE.CylinderGeometry(0.20, 0.20, 0.5, 8),
        radarGeo:       new THREE.SphereGeometry(0.35, 6, 6),
        lensGeo:        new THREE.CylinderGeometry(0.12, 0.12, 0.15, 6),

        matBaseDark:    new THREE.MeshLambertMaterial({ color: 0x222a30 }),
        matArmorMetal:  new THREE.MeshPhongMaterial({ color: 0x3a4852, specular: 0x556677, shininess: 25 }),
        matGunMetal:    new THREE.MeshPhongMaterial({ color: 0x1a2024, specular: 0x334455, shininess: 40 }),
        matOpticLens:   new THREE.MeshBasicMaterial({ color: 0x00ff88 }),
        matDetailSteel: new THREE.MeshLambertMaterial({ color: 0x4f5d68 })
    };
    return this._turretAssets;
};

Renderer3D.loadTurretModelDeferred = function() {
    // Kept for backward compatibility
};

Renderer3D._upgradeExistingTurretVisuals = function() {
    // No-op
};

Renderer3D.create3DTurel = function(x, z) {
    const group = new THREE.Group();
    const assets = this._getTurretAssets();

    // 1. ChÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢n ÃƒÆ’Ã¢â‚¬Å¾ÃƒÂ¢Ã¢â€šÂ¬Ã‹Å“ÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â¿ bÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡t giÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡c bÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Âc thÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©p
    const base = new THREE.Mesh(assets.basePlatform, assets.matBaseDark);
    base.position.y = 0.3;
    base.receiveShadow = true;
    group.add(base);

    const baseRing = new THREE.Mesh(assets.baseRing, assets.matDetailSteel);
    baseRing.position.y = 0.7;
    group.add(baseRing);

    // 2. CÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ xoay trÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Â£ lÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Â±c
    const collar = new THREE.Mesh(assets.turretCollar, assets.matBaseDark);
    collar.position.y = 1.2;
    group.add(collar);

    // 3. ÃƒÆ’Ã¢â‚¬Å¾Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â§u thÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡p phÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡o xoay (Turret Head)
    const headGroup = new THREE.Group();
    headGroup.position.y = 1.9;

    // VÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Â bÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Âc thÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©p khoang phÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡o
    const housing = new THREE.Mesh(assets.housingGeo, assets.matArmorMetal);
    housing.position.set(0, 0.4, 0);
    housing.castShadow = true;
    headGroup.add(housing);

    // TÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â¥m giÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡p vÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡t trÃƒÆ’Ã¢â‚¬Â Ãƒâ€šÃ‚Â°ÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»ÃƒÂ¢Ã¢â€šÂ¬Ã‚Âºc
    const armorPlate = new THREE.Mesh(assets.armorPlateGeo, assets.matDetailSteel);
    armorPlate.position.set(0.6, 0.5, 0);
    armorPlate.rotation.z = -0.3;
    headGroup.add(armorPlate);

    // CÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â·p nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â²ng phÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡o ÃƒÆ’Ã¢â‚¬Å¾ÃƒÂ¢Ã¢â€šÂ¬Ã‹Å“ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â´i hÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â¡ng nÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â·ng (Dual Heavy Autocannons)
    const barrelL = new THREE.Mesh(assets.barrelGeo, assets.matGunMetal);
    barrelL.rotation.z = Math.PI / 2;
    barrelL.position.set(1.7, 0.35, -0.45);
    barrelL.castShadow = true;
    headGroup.add(barrelL);

    const brakeL = new THREE.Mesh(assets.muzzleBrakeGeo, assets.matDetailSteel);
    brakeL.rotation.z = Math.PI / 2;
    brakeL.position.set(3.2, 0.35, -0.45);
    headGroup.add(brakeL);

    const barrelR = new THREE.Mesh(assets.barrelGeo, assets.matGunMetal);
    barrelR.rotation.z = Math.PI / 2;
    barrelR.position.set(1.7, 0.35, 0.45);
    barrelR.castShadow = true;
    headGroup.add(barrelR);

    const brakeR = new THREE.Mesh(assets.muzzleBrakeGeo, assets.matDetailSteel);
    brakeR.rotation.z = Math.PI / 2;
    brakeR.position.set(3.2, 0.35, 0.45);
    headGroup.add(brakeR);

    // MÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â¯t radar / cÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â£m biÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â¿n quang hÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Âc ngÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â¯m bÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â¯n
    const radar = new THREE.Mesh(assets.radarGeo, assets.matDetailSteel);
    radar.position.set(-0.3, 1.2, 0);
    headGroup.add(radar);

    const statusLens = new THREE.Mesh(assets.lensGeo, assets.matOpticLens.clone());
    statusLens.rotation.z = Math.PI / 2;
    statusLens.position.set(0.9, 0.85, 0);
    headGroup.add(statusLens);

    group.add(headGroup);
    group.turretHead = headGroup;
    group.statusLight = statusLens;

    group.position.set(x, 0, z);
    this.scene.add(group);
    return group;
};

// A preview uses only four low-poly meshes and never joins collision/shadow
// lists. It is deliberately separate from the placed model so moving the
// cursor cannot trigger FBX cloning or a shader/material compilation hitch.
Renderer3D.beginTurretPreview = function() {
    this.endTurretPreview();
    const group = new THREE.Group();
    const validMaterial = new THREE.MeshBasicMaterial({ color: 0x42f5a7, transparent: true, opacity: 0.42, depthWrite: false });
    const invalidMaterial = new THREE.MeshBasicMaterial({ color: 0xff4d5d, transparent: true, opacity: 0.42, depthWrite: false });
    const add = (geometry, y, rotationZ, x) => {
        const mesh = new THREE.Mesh(geometry, validMaterial);
        mesh.position.set(x || 0, y, 0);
        if (rotationZ) mesh.rotation.z = rotationZ;
        group.add(mesh);
    };
    add(new THREE.CylinderGeometry(1.8, 2.2, 1.2, 12), 0.6);
    add(new THREE.CylinderGeometry(0.9, 1.1, 3.2, 12), 2.8);
    add(new THREE.BoxGeometry(2.4, 1.3, 1.8), 4.4);
    add(new THREE.CylinderGeometry(0.16, 0.2, 3.4, 8), 4.4, Math.PI / 2, 1.7);
    group.renderOrder = 10;
    group.userData.previewMaterials = { valid: validMaterial, invalid: invalidMaterial };
    group.position.y = 0.03; // prevents z-fighting while keeping the base on ground
    this.turretPreview = group;
    this.scene.add(group);
};

Renderer3D.updateTurretPreview = function(x, z, valid) {
    if (!this.turretPreview) return;
    this.turretPreview.position.set(x, 0.03, z);
    const material = valid ? this.turretPreview.userData.previewMaterials.valid : this.turretPreview.userData.previewMaterials.invalid;
    this.turretPreview.children.forEach(mesh => { mesh.material = material; });
    this.turretPreview.visible = true;
};

Renderer3D.endTurretPreview = function() {
    const preview = this.turretPreview;
    if (!preview) return;
    if (preview.parent) preview.parent.remove(preview);
    preview.traverse(node => {
        if (node.geometry) node.geometry.dispose();
    });
    const materials = preview.userData.previewMaterials;
    if (materials) {
        materials.valid.dispose();
        materials.invalid.dispose();
    }
    this.turretPreview = null;
};

Renderer3D.create3DMinigun = function(x, z) {
    const group = new THREE.Group();
    // HÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢p (crate) ÃƒÆ’Ã¢â‚¬Å¾ÃƒÂ¢Ã¢â€šÂ¬Ã‹Å“ÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Â±ng minigun
    const crateW = 3.0, crateH = 1.35, crateD = 3.0;
    const crate = new THREE.Mesh(
        new THREE.BoxGeometry(crateW, crateH, crateD),
        new THREE.MeshPhongMaterial({ color: 0x6b4a2b }));
    crate.position.y = crateH / 2;
    crate.castShadow = true; crate.receiveShadow = true;
    group.add(crate); this._addCollisionMesh(crate);

    // CÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡c dÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â£i kim loÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â¡i trÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âªn hÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢p
    const bandMat = new THREE.MeshPhongMaterial({ color: 0x2e2a25 });
    for (const [dx, dz] of [[-0.6, 0], [0.6, 0], [0, -0.6], [0, 0.6]]) {
        const g = dx !== 0 ? new THREE.BoxGeometry(0.08, crateH + 0.02, crateD)
                            : new THREE.BoxGeometry(crateW, crateH + 0.02, 0.08);
        const b = new THREE.Mesh(g, bandMat);
        b.position.set(dx || 0, crateH / 2, dz || 0);
        group.add(b);
    }

    if (this._externalModels && this._externalModels.minigun) {
        try {
            const model = this._externalModels.minigun.clone(true);
            const box = new THREE.Box3().setFromObject(model);
            const size = new THREE.Vector3(); box.getSize(size);
            const scale = Math.min(2.2 / Math.max(size.x, 0.1), 1.8 / Math.max(size.y, 0.1), 2.2 / Math.max(size.z, 0.1));
            model.scale.setScalar(scale);
            const b2 = new THREE.Box3().setFromObject(model);
            model.position.set(0, crateH - b2.min.y - 0.1, 0);
            model.traverse(c => { if (c.isMesh) c.castShadow = true; });

            const gunHead = new THREE.Group();
            gunHead.add(model);
            group.add(gunHead);

            let barrel = null;
            model.traverse(c => {
                if (!barrel && c.isMesh) {
                    const bb = new THREE.Box3().setFromObject(c);
                    if ((bb.max.x - bb.min.x) > 0.5 || (bb.max.z - bb.min.z) > 0.5) barrel = c;
                }
            });
            if (!barrel) barrel = model;
            group.gunHead = gunHead;
            group.barrel = barrel;
            group.position.set(x, 0, z);
            this.scene.add(group);
            return group;
        } catch(e) { console.warn('Minigun model lÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Âi, fallback geometry', e); }
    }

    // Fallback: Minigun dÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Â±ng bÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â±ng code trÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âªn ÃƒÆ’Ã¢â‚¬Å¾ÃƒÂ¢Ã¢â€šÂ¬Ã‹Å“ÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â°nh hÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢p
    const gunHead = new THREE.Group();
    gunHead.position.y = crateH + 0.2;

    const baseBlock = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.5, 1.0),
        new THREE.MeshPhongMaterial({ color: 0x202428 }));
    baseBlock.castShadow = true; gunHead.add(baseBlock);

    const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.9, 12),
        new THREE.MeshPhongMaterial({ color: 0x181b1e }));
    motor.rotation.z = Math.PI / 2; motor.position.x = 0.6; motor.castShadow = true;
    gunHead.add(motor);

    const barrel = new THREE.Group();
    for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const t = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.3, 8),
            new THREE.MeshPhongMaterial({ color: 0x111416 }));
        t.position.set(Math.cos(a) * 0.17, Math.sin(a) * 0.17, 0);
        t.rotation.z = Math.PI / 2;
        barrel.add(t);
    }
    barrel.position.x = 1.6;
    gunHead.add(barrel);
    group.add(gunHead);

    group.gunHead = gunHead;
    group.barrel = barrel;

    group.position.set(x, 0, z);
    this.scene.add(group);
    return group;
};

// GÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Âi loader trong init() cÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Â§a main sÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â½ lÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â m cho scene tÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œn tÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â¡i, ta nhÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºng vÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â o cuÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»ÃƒÂ¢Ã¢â€šÂ¬Ã‹Å“i init
// -> gÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Âi loadExternalModels() ÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€¦Ã‚Â¸ cuÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»ÃƒÂ¢Ã¢â€šÂ¬Ã‹Å“i hÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â m init() (patch ngay dÃƒÆ’Ã¢â‚¬Â Ãƒâ€šÃ‚Â°ÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»ÃƒÂ¢Ã¢â€šÂ¬Ã‚Âºi ÃƒÆ’Ã¢â‚¬Å¾ÃƒÂ¢Ã¢â€šÂ¬Ã‹Å“ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢y)
(function() {
    const origInit = Renderer3D.init.bind(Renderer3D);
    Renderer3D.init = function() {
        origInit();
        // The high-poly FBX files are intentionally not preloaded for Poki.
        // The lightweight procedural turrets are immediately playable.
        if (!Renderer3D.webPerformanceMode) {
            try { Renderer3D.loadExternalModels(); } catch(e) { console.warn('loadExternalModels failed', e); }
        }
    };
})();

Renderer3D.getPlayerFloorHeight = function(x, z) {
    return 0;
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Renderer3D;
}



