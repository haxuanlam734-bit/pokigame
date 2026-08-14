/**
 * RENDERER-3D.JS - Xử lý render 3D dùng Three.js
 * Tạo scene 3D, camera, lighting, và vẽ các entity
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

    cameraDistance: 120,
    cameraHeightOffset: 20,
    cameraLookAtHeight: 20,

    cameraSmoothness: 10.0,
    _smoothedCameraX: 0,
    _smoothedCameraY: 0,
    _smoothedCameraZ: 0,
    _smoothedLookAtX: 0,
    _smoothedLookAtY: 0,
    _smoothedLookAtZ: 0,

    /**
     * Khởi tạo Three.js renderer
     */
    init: function() {
        console.log('🎨 Khởi tạo Renderer 3D (Three.js)...');

        // Lấy canvas từ DOM
        this.canvas = document.getElementById('gameCanvas');
        if (!this.canvas) {
            this.canvas = document.createElement('canvas');
            document.getElementById('game-container').insertBefore(this.canvas, document.getElementById('game-container').firstChild);
            this.canvas.id = 'gameCanvas';
        }

        // Tạo scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87ceeb); // Xanh trời
        this.scene.fog = new THREE.Fog(0x87ceeb, 500, 1000);

        // Tạo camera (Perspective Camera)
        const width = window.innerWidth;
        const height = window.innerHeight;
        this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
        this.camera.position.set(150, 100, 200);
        this.camera.lookAt(150, 0, 150);

        // Tạo WebGL renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true, canvas: this.canvas });
        this.renderer.setSize(width, height);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFShadowShadowMap;
        this.renderer.outputEncoding = THREE.sRGBEncoding;

        // Thêm lighting
        this.setupLighting();

        // Tạo ground (mặt đất)
        this.createGround();

        this.createFortress();

        this.createPlayer3D();

        {
            const defaultYaw = 0;
            const defaultPitch = 0.3;
            const horizontalDist = this.cameraDistance * Math.cos(defaultPitch);
            const verticalOffset = this.cameraDistance * Math.sin(defaultPitch) + this.cameraHeightOffset;
            const offsetX = horizontalDist * Math.sin(defaultYaw);
            const offsetZ = horizontalDist * Math.cos(defaultYaw);
            const px = 300, pz = 300;
            this.camera.position.set(px - offsetX, verticalOffset, pz - offsetZ);
            this.camera.lookAt(px, this.cameraLookAtHeight, pz);
        }

        this._smoothedCameraX = this.camera.position.x;
        this._smoothedCameraY = this.camera.position.y;
        this._smoothedCameraZ = this.camera.position.z;
        this._smoothedLookAtX = 300;
        this._smoothedLookAtY = 20;
        this._smoothedLookAtZ = 300;

        window.addEventListener('resize', this.onWindowResize.bind(this));

        console.log('✅ Renderer 3D khởi tạo xong');
    },

    /**
     * Setup lighting
     */
    setupLighting: function() {
        // Ambient light (ánh sáng xung quanh)
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
        this.scene.add(ambientLight);

        // Directional light (ánh sáng mặt trời)
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(200, 200, 200);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.far = 500;
        directionalLight.shadow.camera.left = -300;
        directionalLight.shadow.camera.right = 300;
        directionalLight.shadow.camera.top = 300;
        directionalLight.shadow.camera.bottom = -300;
        this.scene.add(directionalLight);

        // Hemisphere light (ánh sáng từ trên)
        const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x654321, 0.4);
        this.scene.add(hemiLight);
    },

    /**
     * Tạo mặt đất
     */
    createGround: function() {
        const groundGeometry = new THREE.PlaneGeometry(500, 500);
        const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x2d5016 });
        this.ground = new THREE.Mesh(groundGeometry, groundMaterial);
        this.ground.rotation.x = -Math.PI / 2;
        this.ground.castShadow = false;
        this.ground.receiveShadow = true;
        this.scene.add(this.ground);

        // Thêm grid helper (để debug)
        const gridHelper = new THREE.GridHelper(500, 50, 0x444444, 0x888888);
        this.scene.add(gridHelper);
    },

    /**
     * Tạo pháo đài (hình vuông 3D)
     */
    createFortress: function() {
        const fortressSize = 80;
        const fortressHeight = 100;

        // Thân pháo đài
        const geometry = new THREE.BoxGeometry(fortressSize, fortressHeight, fortressSize);
        const material = new THREE.MeshPhongMaterial({ color: 0xff9900 });
        this.fortress = new THREE.Mesh(geometry, material);
        this.fortress.position.set(150, fortressHeight / 2, 150);
        this.fortress.castShadow = true;
        this.fortress.receiveShadow = true;
        this.scene.add(this.fortress);

        // Cờ trên pháo đài
        const flagPole = new THREE.CylinderGeometry(2, 2, 40, 8);
        const flagPoleMaterial = new THREE.MeshPhongMaterial({ color: 0xffff00 });
        const flagPoleObj = new THREE.Mesh(flagPole, flagPoleMaterial);
        flagPoleObj.position.set(150, fortressHeight + 20, 150);
        flagPoleObj.castShadow = true;
        this.scene.add(flagPoleObj);

        // Lá cờ
        const flagGeometry = new THREE.PlaneGeometry(30, 20);
        const flagMaterial = new THREE.MeshPhongMaterial({ color: 0xff0000, side: THREE.DoubleSide });
        const flagObj = new THREE.Mesh(flagGeometry, flagMaterial);
        flagObj.position.set(175, fortressHeight + 20, 150);
        flagObj.castShadow = true;
        this.scene.add(flagObj);

        console.log('🏰 Pháo đài được tạo');
    },

    createPlayer3D: function() {
        const playerHeight = 50;
        const playerWidth = 30;

        const bodyGeometry = new THREE.BoxGeometry(playerWidth, playerHeight, playerWidth);
        const bodyMaterial = new THREE.MeshPhongMaterial({ color: 0x0088ff });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = playerHeight / 2;
        body.castShadow = true;
        body.receiveShadow = true;

        const headGeometry = new THREE.BoxGeometry(playerWidth * 0.75, playerWidth * 0.75, playerWidth * 0.75);
        const headMaterial = new THREE.MeshPhongMaterial({ color: 0xffcc99 });
        const head = new THREE.Mesh(headGeometry, headMaterial);
        head.position.set(0, playerHeight + playerWidth * 0.4, 0);
        head.castShadow = true;

        const indicatorGeometry = new THREE.ConeGeometry(playerWidth * 0.3, playerWidth * 0.5, 4);
        const indicatorMaterial = new THREE.MeshPhongMaterial({ color: 0xff0000 });
        const indicator = new THREE.Mesh(indicatorGeometry, indicatorMaterial);
        indicator.position.set(0, playerHeight / 2, playerWidth * 0.6);
        indicator.rotation.x = -Math.PI / 2;
        indicator.castShadow = true;

        const group = new THREE.Group();
        group.add(body);
        group.add(head);
        group.add(indicator);
        group.position.set(300, 0, 300);
        group.body = body;
        group.head = head;
        group.indicator = indicator;
        this.scene.add(group);

        this.player = group;
        console.log('🧍 Nhân vật player được tạo');
    },

    updatePlayerMesh: function(playerX, playerZ, rotationY, isMoving) {
        if (!this.player) return;
        this.player.position.x = playerX;
        this.player.position.z = playerZ;
        this.player.rotation.y = rotationY;

        if (isMoving) {
            const time = Date.now() * 0.01;
            this.player.position.y = Math.abs(Math.sin(time)) * 4;
            this.player.body.rotation.x = Math.sin(time) * 0.1;
        } else {
            this.player.position.y = 0;
            this.player.body.rotation.x = 0;
        }
    },

    /**
     * Tạo tường (wall) 3D
     * @param {number} x
     * @param {number} z
     * @returns {Object} 3D object
     */
    create3DWall: function(x, z) {
        const wallWidth = 40;
        const wallHeight = 80;
        const wallDepth = 40;

        const geometry = new THREE.BoxGeometry(wallWidth, wallHeight, wallDepth);
        const material = new THREE.MeshPhongMaterial({ color: 0x00cc00 });
        const wall = new THREE.Mesh(geometry, material);
        wall.position.set(x, wallHeight / 2, z);
        wall.castShadow = true;
        wall.receiveShadow = true;
        this.scene.add(wall);

        return wall;
    },

    /**
     * Tạo tháp 3D
     * @param {number} x
     * @param {number} z
     * @returns {Object} 3D object
     */
    create3DTower: function(x, z) {
        const towerRadius = 25;
        const towerHeight = 50;

        // Thân tháp (hình trụ)
        const geometry = new THREE.CylinderGeometry(towerRadius, towerRadius, towerHeight, 16);
        const material = new THREE.MeshPhongMaterial({ color: 0x666666 });
        const tower = new THREE.Mesh(geometry, material);
        tower.position.set(x, towerHeight / 2, z);
        tower.castShadow = true;
        tower.receiveShadow = true;
        this.scene.add(tower);

        // Nòng tháp (nón phía trên)
        const coneGeometry = new THREE.ConeGeometry(towerRadius * 0.8, 30, 16);
        const coneMaterial = new THREE.MeshPhongMaterial({ color: 0x00ff00 });
        const cone = new THREE.Mesh(coneGeometry, coneMaterial);
        cone.position.set(x, towerHeight + 15, z);
        cone.castShadow = true;
        this.scene.add(cone);

        // Group để dễ xoay
        const group = new THREE.Group();
        group.add(tower);
        group.add(cone);
        group.tower = tower;
        group.cone = cone;
        group.position.set(x, 0, z);

        return group;
    },

    /**
     * Tạo máy in tiền 3D
     * @param {number} x
     * @param {number} z
     * @returns {Object} 3D object
     */
    create3DMinter: function(x, z) {
        const minterSize = 40;

        const geometry = new THREE.BoxGeometry(minterSize, minterSize, minterSize);
        const material = new THREE.MeshPhongMaterial({ color: 0xffff00 });
        const minter = new THREE.Mesh(geometry, material);
        minter.position.set(x, minterSize / 2, z);
        minter.castShadow = true;
        minter.receiveShadow = true;
        this.scene.add(minter);

        // Bánh xe xoay (tròn quanh)
        const wheelGeometry = new THREE.CylinderGeometry(15, 15, 3, 16);
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

    /**
     * Tạo zombie 3D
     * @param {number} x
     * @param {number} z
     * @returns {Object} 3D object
     */
    create3DZombie: function(x, z) {
        const zombieHeight = 50;
        const zombieWidth = 35;

        // Thân zombie
        const bodyGeometry = new THREE.BoxGeometry(zombieWidth, zombieHeight, zombieWidth);
        const bodyMaterial = new THREE.MeshPhongMaterial({ color: 0xff3333 });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = zombieHeight / 2;
        body.castShadow = true;
        body.receiveShadow = true;

        // Đầu zombie
        const headGeometry = new THREE.BoxGeometry(zombieWidth * 0.8, zombieWidth * 0.8, zombieWidth * 0.8);
        const headMaterial = new THREE.MeshPhongMaterial({ color: 0xff5555 });
        const head = new THREE.Mesh(headGeometry, headMaterial);
        head.position.set(0, zombieHeight + 20, 0);
        head.castShadow = true;

        const group = new THREE.Group();
        group.add(body);
        group.add(head);
        group.position.set(x, 0, z);
        group.body = body;
        group.head = head;
        this.scene.add(group);

        return group;
    },

    /**
     * Render frame
     */
    render: function() {
        this.renderer.render(this.scene, this.camera);
    },

    /**
     * Xử lý resize window
     */
    onWindowResize: function() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    },

    /**
     * Lấy raycaster để kiểm tra va chạm / picking
     * @param {number} mouseX - Vị trí chuột X (0-1)
     * @param {number} mouseY - Vị trí chuột Y (0-1)
     * @returns {THREE.Raycaster}
     */
    getRaycaster: function(mouseX, mouseY) {
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();
        mouse.x = (mouseX / window.innerWidth) * 2 - 1;
        mouse.y = -(mouseY / window.innerHeight) * 2 + 1;
        raycaster.setFromCamera(mouse, this.camera);
        return raycaster;
    },

    /**
     * Lấy vị trí đất (ground) từ raycaster
     * @param {THREE.Raycaster} raycaster
     * @returns {THREE.Vector3|null}
     */
    getGroundIntersection: function(raycaster) {
        const intersects = raycaster.intersectObject(this.ground);
        if (intersects.length > 0) {
            return intersects[0].point;
        }
        return null;
    },

    updateCameraToPlayer: function(playerX, playerZ, yaw, pitch) {
        const cosPitch = Math.cos(pitch);
        const sinPitch = Math.sin(pitch);
        const cosYaw = Math.cos(yaw);
        const sinYaw = Math.sin(yaw);

        const horizontalDist = this.cameraDistance * cosPitch;
        const verticalOffset = this.cameraDistance * sinPitch + this.cameraHeightOffset;

        const offsetX = horizontalDist * sinYaw;
        const offsetZ = horizontalDist * cosYaw;

        const targetCamX = playerX - offsetX;
        const targetCamY = verticalOffset;
        const targetCamZ = playerZ - offsetZ;

        const targetLookX = playerX;
        const targetLookY = this.cameraLookAtHeight;
        const targetLookZ = playerZ;

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

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Renderer3D;
}
