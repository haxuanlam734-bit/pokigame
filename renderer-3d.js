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

    cameraDistance: 20,
    cameraHeightOffset: 8,
    cameraLookAtHeight: 1.2, // Tầm mắt nhân vật ~1.2m

    // --- Tự động chuyển Góc Nhìn Thứ 1 (First-Person) khi zoom sát nhân vật ---
    firstPersonThreshold: 0.8, // mét - dưới ngưỡng này camera chuyển sang FPS
    eyeHeight: 1.5,            // độ cao mắt nhân vật so với mặt đất (m)
    isFirstPerson: false,      // trạng thái hiện tại (dùng để biết khi nào cần ẩn/hiện mesh)
    _fpTransitionRange: 2.0,   // vùng đệm (m) để offset chiều cao rig TPS mờ dần về 0 khi tới gần ngưỡng FPS, tránh camera "giật"

    trees: [],
    rocks: [],

    // Kích thước & tâm bản đồ (dùng chung cho ground + rải cây/đá)
    groundSize: 600,        // Mặt đất 600x600 (thừa biên so với vùng rải cây 0-500)
    worldCenterX: 250,
    worldCenterZ: 250,

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
        // Màu nền trùng màu sương mù để hòa trộn mượt mà ở khoảng cách xa
        this.scene.background = new THREE.Color('#1c2a1c');
        this.scene.fog = new THREE.FogExp2('#1c2a1c', 0.012);

        // Tạo camera (Perspective Camera)
        const width = window.innerWidth;
        const height = window.innerHeight;
        this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
        this.camera.position.set(250, 10, 260);
        this.camera.lookAt(250, 1, 250);

        // Tạo WebGL renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true, canvas: this.canvas });
        this.renderer.setSize(width, height);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Bóng mềm, tự nhiên hơn cho cỏ/cây/tháp pháo
        this.renderer.outputEncoding = THREE.sRGBEncoding;

        // Thêm lighting
        this.setupLighting();

        // Tạo ground (mặt đất)
        this.createGround();

        // Dãy núi low-poly bao quanh viền map - chặn ra ngoài & che chân trời
        this.createBoundaryMountains();

        // Dòng sông uốn lượn cắt ngang bản đồ (xa khu căn cứ chính)
        this.createRiver();

        this.createFortress();

        this.createPlayer3D();

        // Tạo cây cối và đá trang trí xung quanh (rừng rậm, đa dạng thực vật)
        this.createForestEnvironment();

        {
            const defaultYaw = 0;
            const defaultPitch = 0.3;
            const horizontalDist = this.cameraDistance * Math.cos(defaultPitch);
            const verticalOffset = this.cameraDistance * Math.sin(defaultPitch) + this.cameraHeightOffset;
            const offsetX = horizontalDist * Math.sin(defaultYaw);
            const offsetZ = horizontalDist * Math.cos(defaultYaw);
            const px = 250, pz = 250;
            this.camera.position.set(px - offsetX, verticalOffset, pz - offsetZ);
            this.camera.lookAt(px, this.cameraLookAtHeight, pz);
        }

        this._smoothedCameraX = this.camera.position.x;
        this._smoothedCameraY = this.camera.position.y;
        this._smoothedCameraZ = this.camera.position.z;
        this._smoothedLookAtX = 250;
        this._smoothedLookAtY = this.cameraLookAtHeight;
        this._smoothedLookAtZ = 250;

        window.addEventListener('resize', this.onWindowResize.bind(this));

        console.log('✅ Renderer 3D khởi tạo xong');
    },

    /**
     * Setup lighting - Ánh sáng vàng nắng rừng len lỏi qua vòm lá
     */
    setupLighting: function() {
        // Ambient light (ánh sáng xung quanh rừng - xanh lá dịu)
        const ambientLight = new THREE.AmbientLight(0x4a5d45, 0.85);
        this.scene.add(ambientLight);

        // Directional light (ánh sáng vàng nắng ấm) - góc chiếu nghiêng nhẹ
        // để đổ bóng dài, tự nhiên lên nền cỏ, cây cối và tháp pháo.
        const directionalLight = new THREE.DirectionalLight(0xffe4b5, 0.95);
        directionalLight.position.set(
            this.worldCenterX + 140,
            110,
            this.worldCenterZ + 50
        );
        directionalLight.target.position.set(this.worldCenterX, 0, this.worldCenterZ);
        this.scene.add(directionalLight.target);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.far = 700;
        directionalLight.shadow.camera.left = -320;
        directionalLight.shadow.camera.right = 320;
        directionalLight.shadow.camera.top = 320;
        directionalLight.shadow.camera.bottom = -320;
        directionalLight.shadow.bias = -0.0005;
        this.scene.add(directionalLight);

        // Hemisphere light (ánh sáng từ trời xanh lá cây + đất nâu)
        const hemiLight = new THREE.HemisphereLight(0x6b8e5a, 0x3d2f1f, 0.5);
        this.scene.add(hemiLight);
    },

    /**
     * Tạo mặt đất - Xanh rừng rậm
     */
    createGround: function() {
        const groundGeometry = new THREE.PlaneGeometry(this.groundSize, this.groundSize);
        const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x1d4a21 });
        this.ground = new THREE.Mesh(groundGeometry, groundMaterial);
        this.ground.rotation.x = -Math.PI / 2;
        // Căn mặt đất trùng với tâm bản đồ (250, 250) - nơi pháo đài/nhân vật/cây cối
        // được đặt, tránh lệch khiến bản đồ "trôi" ra ngoài viền cỏ.
        this.ground.position.set(this.worldCenterX, 0, this.worldCenterZ);
        this.ground.castShadow = false;
        this.ground.receiveShadow = true;
        this.scene.add(this.ground);

        // Thêm grid helper (để debug, màu xanh lá dịu) - căn cùng tâm với ground
        const gridHelper = new THREE.GridHelper(this.groundSize, 60, 0x2a6b30, 0x1b5720);
        gridHelper.position.set(this.worldCenterX, 0, this.worldCenterZ);
        this.scene.add(gridHelper);
    },

    /**
     * Tạo dãy Núi Low-Poly bao quanh 4 cạnh viền map.
     * - Mỗi ngọn núi = 2 ConeGeometry (thân đá trầm + đỉnh xám sáng/tuyết).
     * - Xếp sát nhau dọc theo hình vuông bao quanh vùng chơi để chặn người
     *   chơi đi ra ngoài map và che bớt khoảng không trống phía xa.
     */
    createBoundaryMountains: function() {
        this.mountains = [];

        const rockColor = 0x3a3f47;  // Xám đá trầm
        const snowColor = 0x8a929e;  // Xám sáng / tuyết nhẹ

        const cx = this.worldCenterX;
        const cz = this.worldCenterZ;

        // Vành đai núi đặt ngay ngoài vùng chơi (playFieldSize=500 → bán kính ~250
        // tính từ tâm), xếp sát nhau (spacing nhỏ hơn đường kính chân núi trung bình).
        const boundaryHalf = 280;
        const spacing = 20;
        const jitter = 5;

        const addMountain = (x, z) => {
            const radius = 14 + Math.random() * 10;
            const height = 30 + Math.random() * 26;
            const sides = 5 + Math.floor(Math.random() * 2); // 5-6 cạnh (low-poly)

            const group = new THREE.Group();

            // Thân núi - đá trầm
            const bodyGeo = new THREE.ConeGeometry(radius, height, sides);
            const bodyMat = new THREE.MeshPhongMaterial({ color: rockColor, flatShading: true });
            const body = new THREE.Mesh(bodyGeo, bodyMat);
            body.position.y = height / 2;
            body.castShadow = true;
            body.receiveShadow = true;
            group.add(body);

            // Đỉnh núi - mảng xám sáng/tuyết nhẹ
            const snowHeight = height * (0.22 + Math.random() * 0.12);
            const snowGeo = new THREE.ConeGeometry(radius * 0.55, snowHeight, sides);
            const snowMat = new THREE.MeshPhongMaterial({ color: snowColor, flatShading: true });
            const snow = new THREE.Mesh(snowGeo, snowMat);
            snow.position.y = height - snowHeight * 0.45;
            snow.castShadow = true;
            group.add(snow);

            group.position.set(
                x + (Math.random() - 0.5) * jitter,
                0,
                z + (Math.random() - 0.5) * jitter
            );
            group.rotation.y = Math.random() * Math.PI * 2;
            group.scale.setScalar(0.9 + Math.random() * 0.45);

            this.scene.add(group);
            this.mountains.push(group);
        };

        const min = -boundaryHalf;
        const max = boundaryHalf;
        for (let pos = min; pos <= max; pos += spacing) {
            addMountain(cx + pos, cz + min); // cạnh Z-
            addMountain(cx + pos, cz + max); // cạnh Z+
            addMountain(cx + min, cz + pos); // cạnh X-
            addMountain(cx + max, cz + pos); // cạnh X+
        }

        console.log('⛰️ Dãy núi biên map được tạo:', this.mountains.length, 'ngọn núi');
    },

    /**
     * Tạo dòng sông chảy uốn lượn cắt ngang một phần bản đồ,
     * nằm xa khu vực căn cứ chính (center 250,250).
     * Được dựng thủ công dưới dạng dải ribbon (BufferGeometry) bám theo
     * một đường cong sin/cos để có hiệu ứng uốn nhẹ tự nhiên.
     */
    createRiver: function() {
        const cx = this.worldCenterX;
        const cz = this.worldCenterZ;

        const riverWidth = 16;
        const segments = 24;
        const startX = cx - 220;
        const endX = cx + 220;
        const baseZ = cz + 190; // lệch hẳn về một phía, xa căn cứ chính ở tâm map

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
            const normal = new THREE.Vector3(-dir.z, 0, dir.x); // Pháp tuyến trên mặt phẳng XZ

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

        console.log('🌊 Dòng sông được tạo');
    },

    /**
     * Tạo pháo đài (hình vuông 3D) - Co tỉ lệ phù hợp với nhân vật nhỏ
     */
    createFortress: function() {
        const fortressSize = 10;
        const fortressHeight = 12;

        const cx = 250;
        const cz = 250;

        // Thân pháo đài
        const geometry = new THREE.BoxGeometry(fortressSize, fortressHeight, fortressSize);
        const material = new THREE.MeshPhongMaterial({ color: 0xff9900 });
        this.fortress = new THREE.Mesh(geometry, material);
        this.fortress.position.set(cx, fortressHeight / 2, cz);
        this.fortress.castShadow = true;
        this.fortress.receiveShadow = true;
        this.scene.add(this.fortress);

        // Cờ trên pháo đài
        const flagPole = new THREE.CylinderGeometry(0.15, 0.15, 4, 8);
        const flagPoleMaterial = new THREE.MeshPhongMaterial({ color: 0xffff00 });
        const flagPoleObj = new THREE.Mesh(flagPole, flagPoleMaterial);
        flagPoleObj.position.set(cx, fortressHeight + 2, cz);
        flagPoleObj.castShadow = true;
        this.scene.add(flagPoleObj);

        // Lá cờ
        const flagGeometry = new THREE.PlaneGeometry(2.5, 1.5);
        const flagMaterial = new THREE.MeshPhongMaterial({ color: 0xff0000, side: THREE.DoubleSide });
        const flagObj = new THREE.Mesh(flagGeometry, flagMaterial);
        flagObj.position.set(cx + 1.5, fortressHeight + 2, cz);
        flagObj.castShadow = true;
        this.scene.add(flagObj);

        console.log('🏰 Pháo đài được tạo');
    },

    /**
     * Tạo nhân vật player - tỉ lệ Roblox 0.8m x 1.6m x 0.8m
     * Chân sát Y=0, offset Y chính xác
     */
    createPlayer3D: function() {
        const playerWidth = 0.8;
        const playerHeight = 1.6;
        const headSize = 0.6;

        const bodyGeometry = new THREE.BoxGeometry(playerWidth, playerHeight * 0.7, playerWidth);
        const bodyMaterial = new THREE.MeshPhongMaterial({ color: 0x0088ff });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = playerHeight * 0.35;
        body.castShadow = true;
        body.receiveShadow = true;

        const headGeometry = new THREE.BoxGeometry(headSize, headSize, headSize);
        const headMaterial = new THREE.MeshPhongMaterial({ color: 0xffcc99 });
        const head = new THREE.Mesh(headGeometry, headMaterial);
        head.position.set(0, playerHeight * 0.7 + headSize / 2, 0);
        head.castShadow = true;

        const indicatorGeometry = new THREE.ConeGeometry(0.12, 0.25, 4);
        const indicatorMaterial = new THREE.MeshPhongMaterial({ color: 0xff0000 });
        const indicator = new THREE.Mesh(indicatorGeometry, indicatorMaterial);
        indicator.position.set(0, playerHeight * 0.35, playerWidth * 0.6);
        indicator.rotation.x = -Math.PI / 2;
        indicator.castShadow = true;

        const group = new THREE.Group();
        group.add(body);
        group.add(head);
        group.add(indicator);
        group.position.set(250, 0, 250);
        group.body = body;
        group.head = head;
        group.indicator = indicator;
        this.scene.add(group);

        this.player = group;
        console.log('🧍 Nhân vật player được tạo (Roblox scale 0.8x1.6)');
    },

    updatePlayerMesh: function(playerX, playerZ, rotationY, isMoving, jumpY) {
        if (!this.player) return;
        this.player.position.x = playerX;
        this.player.position.z = playerZ;
        this.player.rotation.y = rotationY;

        const jumpOffset = jumpY || 0;

        if (isMoving) {
            const time = Date.now() * 0.01;
            this.player.position.y = Math.abs(Math.sin(time)) * 0.08 + jumpOffset;
            this.player.body.rotation.x = Math.sin(time) * 0.1;
        } else {
            this.player.position.y = jumpOffset;
            this.player.body.rotation.x = 0;
        }
    },

    /**
     * Tạo tường (wall) 3D - Co tỉ lệ phù hợp nhân vật
     * @param {number} x
     * @param {number} z
     * @returns {Object} 3D object
     */
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

        return wall;
    },

    /**
     * Tạo tháp 3D - Co tỉ lệ phù hợp nhân vật
     * @param {number} x
     * @param {number} z
     * @returns {Object} 3D object
     */
    create3DTower: function(x, z) {
        const towerRadius = 1.5;
        const towerHeight = 5;

        // Thân tháp (hình trụ)
        const geometry = new THREE.CylinderGeometry(towerRadius, towerRadius, towerHeight, 16);
        const material = new THREE.MeshPhongMaterial({ color: 0x666666 });
        const tower = new THREE.Mesh(geometry, material);
        tower.position.set(x, towerHeight / 2, z);
        tower.castShadow = true;
        tower.receiveShadow = true;
        this.scene.add(tower);

        // Nòng tháp (nón phía trên)
        const coneGeometry = new THREE.ConeGeometry(towerRadius * 0.8, 2.5, 16);
        const coneMaterial = new THREE.MeshPhongMaterial({ color: 0x00ff00 });
        const cone = new THREE.Mesh(coneGeometry, coneMaterial);
        cone.position.set(x, towerHeight + 1.25, z);
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
     * Tạo máy in tiền 3D - Co tỉ lệ phù hợp nhân vật
     * @param {number} x
     * @param {number} z
     * @returns {Object} 3D object
     */
    create3DMinter: function(x, z) {
        const minterSize = 3;

        const geometry = new THREE.BoxGeometry(minterSize, minterSize, minterSize);
        const material = new THREE.MeshPhongMaterial({ color: 0xffff00 });
        const minter = new THREE.Mesh(geometry, material);
        minter.position.set(x, minterSize / 2, z);
        minter.castShadow = true;
        minter.receiveShadow = true;
        this.scene.add(minter);

        // Bánh xe xoay (tròn quanh)
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

    /**
     * Tạo zombie 3D - Co tỉ lệ phù hợp nhân vật (hơi bé hơn player 1 chút)
     * @param {number} x
     * @param {number} z
     * @returns {Object} 3D object
     */
    create3DZombie: function(x, z) {
        const zombieWidth = 0.7;
        const zombieHeight = 1.4;

        // Thân zombie
        const bodyGeometry = new THREE.BoxGeometry(zombieWidth, zombieHeight * 0.7, zombieWidth);
        const bodyMaterial = new THREE.MeshPhongMaterial({ color: 0xff3333 });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = zombieHeight * 0.35;
        body.castShadow = true;
        body.receiveShadow = true;

        // Đầu zombie
        const headSize = 0.52;
        const headGeometry = new THREE.BoxGeometry(headSize, headSize, headSize);
        const headMaterial = new THREE.MeshPhongMaterial({ color: 0xff5555 });
        const head = new THREE.Mesh(headGeometry, headMaterial);
        head.position.set(0, zombieHeight * 0.7 + headSize / 2, 0);
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
     * Tạo cây Low-Poly đơn giản
     * - Thân cây: CylinderGeometry màu nâu
     * - Vòm lá: 2-3 khối ConeGeometry xanh lá xếp chồng
     * @param {number} x - Vị trí X
     * @param {number} z - Vị trí Z
     * @returns {THREE.Group} Cây 3D
     */
    createLowPolyTree: function(x, z) {
        const scale = 0.7 + Math.random() * 0.8;
        const trunkHeight = (1.5 + Math.random() * 1.2) * scale;
        const trunkRadius = 0.15 * scale;
        const trunkGeometry = new THREE.CylinderGeometry(
            trunkRadius * 0.7,
            trunkRadius,
            trunkHeight,
            6
        );
        const trunkMaterial = new THREE.MeshPhongMaterial({
            color: 0x5a3a1b,
            flatShading: true
        });
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

    /**
     * Tạo đá Low-Poly
     * - Dùng DodecahedronGeometry hoặc BoxGeometry xám xù xì
     * @param {number} x - Vị trí X
     * @param {number} z - Vị trí Z
     * @returns {THREE.Mesh|THREE.Group} Đá 3D
     */
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
            const boxMat = new THREE.MeshPhongMaterial({
                color: color,
                flatShading: true
            });
            rock = new THREE.Mesh(boxGeo, boxMat);
            rock.position.y = h / 2;
        } else {
            const radius = (0.35 + Math.random() * 0.6) * scale;
            const dodecaGeo = new THREE.DodecahedronGeometry(radius, 0);
            const dodecaMat = new THREE.MeshPhongMaterial({
                color: color,
                flatShading: true
            });
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

    /**
     * Cây Thông (Pine Tree) - Tán nón nhọn, nhiều lớp, xanh lá sẫm.
     * (Dựa trên form cây low-poly gốc, đổi bảng màu tán sang tông sẫm hơn.)
     * @param {number} x
     * @param {number} z
     * @returns {THREE.Group}
     */
    createPineTree: function(x, z) {
        const scale = 0.7 + Math.random() * 0.8;
        const trunkHeight = (1.5 + Math.random() * 1.2) * scale;
        const trunkRadius = 0.15 * scale;
        const trunkGeometry = new THREE.CylinderGeometry(
            trunkRadius * 0.7,
            trunkRadius,
            trunkHeight,
            6
        );
        const trunkMaterial = new THREE.MeshPhongMaterial({
            color: 0x5a3a1b,
            flatShading: true
        });
        const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
        trunk.position.y = trunkHeight / 2;
        trunk.castShadow = true;
        trunk.receiveShadow = true;

        const tree = new THREE.Group();
        tree.add(trunk);

        // Tán nón nhọn màu xanh lá sẫm
        const foliageColors = [0x1e3d2f, 0x234a37, 0x17301f];
        const leafLayers = 3 + Math.floor(Math.random() * 2); // 3-4 lớp cho dáng thông nhọn
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
        tree.scale.setScalar(0.8 + Math.random() * 0.5); // 0.8 - 1.3
        return tree;
    },

    /**
     * Cây Lá Tròn (Oak Tree) - Tán dạng khối đa diện (Dodecahedron) xanh tươi.
     * @param {number} x
     * @param {number} z
     * @returns {THREE.Group}
     */
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

        // 1-2 khối tán phụ để vòm lá trông rậm rạp, không đều tăm tắp
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
        tree.scale.setScalar(0.8 + Math.random() * 0.5); // 0.8 - 1.3
        return tree;
    },

    /**
     * Bụi cây - khối cầu dẹp rải sát đất.
     * @param {number} x
     * @param {number} z
     * @returns {THREE.Group}
     */
    createBush: function(x, z) {
        const radius = 0.5 + Math.random() * 0.4;
        const bushColors = [0x2d5a27, 0x1e3d2f, 0x3a6b30];
        const color = bushColors[Math.floor(Math.random() * bushColors.length)];

        const geo = new THREE.SphereGeometry(radius, 7, 5);
        const mat = new THREE.MeshPhongMaterial({ color, flatShading: true });
        const bush = new THREE.Mesh(geo, mat);
        bush.position.y = radius * 0.5;
        bush.scale.y = 0.55; // dẹp xuống sát đất
        bush.castShadow = true;
        bush.receiveShadow = true;
        bush.rotation.y = Math.random() * Math.PI * 2;

        const group = new THREE.Group();
        group.add(bush);
        group.position.set(x, 0, z);
        group.rotation.y = Math.random() * Math.PI * 2;
        group.scale.setScalar(0.8 + Math.random() * 0.5); // 0.8 - 1.3
        return group;
    },

    /**
     * Gỗ mục - khúc gỗ hình trụ nằm ngang màu nâu.
     * @param {number} x
     * @param {number} z
     * @returns {THREE.Group}
     */
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
        group.scale.setScalar(0.8 + Math.random() * 0.5); // 0.8 - 1.3
        return group;
    },

    /**
     * Rải cây cối và đá xung quanh rìa bản đồ
     * - Trung tâm 30m x 30m (từ 235-265, 235-265) giữ sạch sẻ để xây căn cứ
     * - Cây/đá rải xung quanh vùng ngoài ranh giới trung tâm
     * - Mật độ tăng gấp 2-3 lần so với trước, kết hợp 3 nhóm thực vật:
     *   Cây Thông, Cây Lá Tròn, Bụi cây & Gỗ mục — mỗi cây random góc xoay
     *   (rotation.y) và kích thước (scale 0.8-1.3) để rừng nhìn tự nhiên.
     */
    createForestEnvironment: function() {
        const centerX = this.worldCenterX;
        const centerZ = this.worldCenterZ;
        const safeHalf = 15; // 30m x 30m sạch sẻ ở giữa (center ± 15)

        const minDistFromCenter = safeHalf + 3;

        // Biên rải cây/đá = đúng vùng người chơi/zombie có thể di chuyển tới
        // (0..playFieldSize, giống clamp trong player-controller.js /
        // spawnZombies), trừ hao padding 8m ở mép. Vùng ground rộng hơn
        // (this.groundSize) chỉ để tạo viền cỏ đệm ngoài vùng chơi được, tránh
        // trường hợp trước đây ground lệch tâm khiến cây sinh ra ngoài viền cỏ.
        const playFieldSize = 500;
        const padding = 8;
        const minX = 0 + padding;
        const maxX = playFieldSize - padding;
        const minZ = 0 + padding;
        const maxZ = playFieldSize - padding;
        const spanX = maxX - minX;
        const spanZ = maxZ - minZ;

        // Mật độ tăng gấp ~2.8x so với bản cũ (38 cây → 110 cây/bụi/gỗ)
        const treeCount = 110;
        const rockCount = 40;

        let placed = 0;
        let attempts = 0;
        const maxAttempts = treeCount * 60;

        const positions = [];
        const minSpacing = 2.6; // Giảm so với bản cũ để chứa được mật độ dày hơn

        function isValidPosition(x, z) {
            const dx = x - centerX;
            const dz = z - centerZ;
            const distSqCenter = dx * dx + dz * dz;
            if (distSqCenter < minDistFromCenter * minDistFromCenter) return false;

            // Luôn phải nằm trong phạm vi nền đất thật (minX..maxX, minZ..maxZ)
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
                return {
                    x: centerX + Math.cos(a) * r,
                    z: centerZ + Math.sin(a) * r
                };
            } else {
                // Rải đều trong toàn bộ phạm vi nền đất (đã trừ vùng an toàn ở
                // isValidPosition), tránh phụ thuộc số cứng theo kích thước cũ.
                return {
                    x: minX + Math.random() * spanX,
                    z: minZ + Math.random() * spanZ
                };
            }
        }

        // Chọn ngẫu nhiên loại thực vật theo tỉ lệ: 35% Thông, 30% Lá tròn,
        // 20% Bụi cây, 15% Gỗ mục — tạo hệ thực vật rậm rạp, đa dạng.
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

        console.log('🌲 Môi trường rừng rậm rạp được tạo:', this.trees.length, 'cây/bụi/gỗ,', this.rocks.length, 'đá');
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

    /**
     * Tính vị trí camera theo tọa độ cầu (yaw, pitch, cameraDistance) quanh nhân vật,
     * rồi làm mượt bằng nội suy dạng lerp có hệ số phụ thuộc thời gian
     * (1 - e^(-k*dt)) thay vì lerp hệ số cố định — tránh camera bị "khựng"
     * khi framerate dao động, đồng thời vẫn tương đương lerp(desired, k~0.1-0.2)
     * ở framerate ổn định 60fps.
     */
    updateCameraToPlayer: function(playerX, playerZ, yaw, pitch, playerY) {
        const py = playerY || 0;
        const cosPitch = Math.cos(pitch);
        const sinPitch = Math.sin(pitch);
        const cosYaw = Math.cos(yaw);
        const sinYaw = Math.sin(yaw);

        // Hướng nhìn (forward) tính từ yaw/pitch, dùng chung cho cả 2 chế độ.
        const forwardX = sinYaw * cosPitch;
        const forwardY = -sinPitch;
        const forwardZ = cosYaw * cosPitch;

        const isFirstPerson = this.cameraDistance <= this.firstPersonThreshold;
        this.isFirstPerson = isFirstPerson;

        let targetCamX, targetCamY, targetCamZ;
        let targetLookX, targetLookY, targetLookZ;

        if (isFirstPerson) {
            // --- Góc Nhìn Thứ 1: camera đặt trùng vị trí mắt nhân vật ---
            // Ẩn mesh nhân vật để không bị khối đầu/thân che camera.
            if (this.player) this.player.visible = false;

            targetCamX = playerX;
            targetCamY = py + this.eyeHeight;
            targetCamZ = playerZ;

            // Nhìn theo hướng yaw/pitch trực tiếp từ vị trí mắt (không lookAt tâm nhân vật).
            targetLookX = targetCamX + forwardX;
            targetLookY = targetCamY + forwardY;
            targetLookZ = targetCamZ + forwardZ;
        } else {
            // --- Góc Nhìn Thứ 3: quỹ đạo camera quanh nhân vật theo tọa độ cầu ---
            if (this.player) this.player.visible = true;

            // Làm mờ dần offset chiều cao "rig" (cameraHeightOffset) về 0 khi
            // cameraDistance tiến gần firstPersonThreshold, để lúc chuyển đổi
            // giữa 2 chế độ vị trí camera không bị nhảy đột ngột (out-of-bounds).
            const fadeT = Math.max(0, Math.min(1,
                (this.cameraDistance - this.firstPersonThreshold) / this._fpTransitionRange
            ));
            const effectiveHeightOffset = this.cameraHeightOffset * fadeT;

            const horizontalDist = this.cameraDistance * cosPitch;
            const verticalOffset = this.cameraDistance * sinPitch + effectiveHeightOffset;

            const offsetX = horizontalDist * sinYaw;
            const offsetZ = horizontalDist * cosYaw;

            targetCamX = playerX - offsetX;
            targetCamY = verticalOffset;
            targetCamZ = playerZ - offsetZ;

            targetLookX = playerX;
            targetLookY = this.cameraLookAtHeight;
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

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Renderer3D;
}
