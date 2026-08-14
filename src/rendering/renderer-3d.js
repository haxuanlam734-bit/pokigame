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
        this.scene.background = new THREE.Color(0x2b4222); // Xanh rừng tối (phù hợp sương mù)
        this.scene.fog = new THREE.FogExp2('#2b4222', 0.012);

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
        this.renderer.shadowMap.type = THREE.PCFShadowShadowMap;
        this.renderer.outputEncoding = THREE.sRGBEncoding;

        // Thêm lighting
        this.setupLighting();

        // Tạo ground (mặt đất)
        this.createGround();

        this.createFortress();

        this.createPlayer3D();

        // Tạo cây cối và đá trang trí xung quanh
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

        // Directional light (ánh sáng vàng nắng ấm)
        const directionalLight = new THREE.DirectionalLight(0xffe4b5, 0.9);
        directionalLight.position.set(80, 160, 60);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.far = 600;
        directionalLight.shadow.camera.left = -300;
        directionalLight.shadow.camera.right = 300;
        directionalLight.shadow.camera.top = 300;
        directionalLight.shadow.camera.bottom = -300;
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
     * Rải cây cối và đá xung quanh rìa bản đồ
     * - Trung tâm 30m x 30m (từ 235-265, 235-265) giữ sạch sẻ để xây căn cứ
     * - Cây/đá rải xung quanh vùng ngoài ranh giới trung tâm
     * - Tổng 40-60 cây + đá
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

        const treeCount = 38;
        const rockCount = 17;

        let placed = 0;
        let attempts = 0;
        const maxAttempts = treeCount * 50;

        const positions = [];
        const minSpacing = 3.5;

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

        while (placed < treeCount && attempts < maxAttempts) {
            attempts++;
            const pos = randomPerimeterPosition();
            if (isValidPosition(pos.x, pos.z)) {
                const tree = this.createLowPolyTree(pos.x, pos.z);
                this.scene.add(tree);
                this.trees.push(tree);
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

        console.log('🌲 Môi trường rừng được tạo:', this.trees.length, 'cây,', this.rocks.length, 'đá');
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
