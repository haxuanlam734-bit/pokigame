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

    // ---- Danh sách mesh chặn camera (cho collision) ----
    _collisionMeshes: [],

    init: function() {
        console.log('🎨 Khởi tạo Renderer 3D (Three.js)...');
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
        this.camera.position.set(250, 10, 260);
        this.camera.lookAt(250, 1, 250);

        this.renderer = new THREE.WebGLRenderer({ antialias: true, canvas: this.canvas });
        this.renderer.setSize(width, height);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.outputEncoding = THREE.sRGBEncoding;

        // Khởi tạo mảng collision
        this._collisionMeshes = [];

        this.setupLighting();
        this.createGround();
        this.createBoundaryMountains();
        this.createRiver();

        // ---- ĐẠI BẢN DOANH QUÂN SỰ ----
        this.buildGrandBase();

        this.createPlayer3D();
        this.createForestEnvironment();

        const defaultYaw = 0;
        const defaultPitch = 0.3;
        const horizontalDist = this.cameraDistance * Math.cos(defaultPitch);
        const verticalOffset = this.cameraDistance * Math.sin(defaultPitch) + this.cameraHeightOffset;
        const offsetX = horizontalDist * Math.sin(defaultYaw);
        const offsetZ = horizontalDist * Math.cos(defaultYaw);
        this.camera.position.set(250 - offsetX, verticalOffset, 250 - offsetZ);
        this.camera.lookAt(250, this.cameraLookAtHeight, 250);

        this._smoothedCameraX = this.camera.position.x;
        this._smoothedCameraY = this.camera.position.y;
        this._smoothedCameraZ = this.camera.position.z;
        this._smoothedLookAtX = 250;
        this._smoothedLookAtY = this.cameraLookAtHeight;
        this._smoothedLookAtZ = 250;

        window.addEventListener('resize', this.onWindowResize.bind(this));
        console.log('✅ Renderer 3D khởi tạo xong');
    },

    setupLighting: function() {
        const ambientLight = new THREE.AmbientLight(0x4a5d45, 0.85);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffe4b5, 0.95);
        directionalLight.position.set(this.worldCenterX + 140, 110, this.worldCenterZ + 50);
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
        console.log('⛰️ Dãy núi biên map được tạo:', this.mountains.length, 'ngọn núi');
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
        console.log('🌊 Dòng sông được tạo');
    },

    // ================================================================
    // 🏗️ ĐẠI BẢN DOANH QUÂN SỰ (GRAND MILITARY BASE)
    // ================================================================

    buildGrandBase: function() {
        const cx = 250, cz = 250;
        console.log('🏰 Xây dựng Military Complex mở rộng...');

        // Bố cục tổng thể ~180x180, đủ rộng để người chơi cảm nhận đây là
        // một khu căn cứ thật sự thay vì một "tycoon plot".
        this._militaryBaseBounds = { minX: cx - 88, maxX: cx + 88, minZ: cz - 88, maxZ: cz + 88 };

        // 1. Nền căn cứ + sân bê tông theo từng phân khu
        this._createConcreteBase(cx, cz, 176);
        this._createBaseRoadNetwork(cx, cz);
        this._createPerimeterLighting(cx, cz);
        this._createPerimeterDefense(cx, cz, 86);

        // 2. Khu trung tâm: Command HQ + quảng trường + cột cờ
        this._createCommandCenter(cx, cz - 18);
        this._createFlagpole(cx, cz - 3);
        this._createBasePlaza(cx, cz + 3);

        // 3. Khu quân nhân phía tây
        this._createLargeBarracksArea(cx - 51, cz - 20);
        this._createMessHall(cx - 54, cz + 25);
        this._createMedicalBlock(cx - 25, cz + 27);

        // 4. Khu hậu cần / kho bãi phía đông
        this._createLargeSupplyDepot(cx + 50, cz - 18);
        this._createFuelFarm(cx + 51, cz + 28);
        this._createMotorPool(cx + 50, cz + 55);

        // 5. Khu kỹ thuật / nghiên cứu phía bắc
        this._createResearchFacility(cx + 3, cz - 59);
        this._createVehicleWorkshop(cx - 42, cz - 58);

        // 6. Sân huấn luyện phía nam
        this._createTrainingGround(cx - 42, cz + 58);
        this._createShootingRange(cx + 8, cz + 59);

        // 7. Radar + relay tower ở góc cao, tạo silhouette rõ khi nhìn xa
        this._createRadarStation(cx + 72, cz - 70);
        this._createCommsTower(cx - 72, cz - 70);

        // 8. 4 tháp canh lớn và các chốt phụ
        const towerOffsets = [
            [-78, -78], [78, -78], [78, 78], [-78, 78],
            [0, -84], [0, 84]
        ];
        towerOffsets.forEach(([dx, dz]) => {
            this._createGuardTower(cx + dx, cz + dz);
        });

        // 9. Cổng chính 2 lớp + nhà kiểm soát
        this._createMainGate(cx, cz + 86);
        this._createSecondaryGate(cx, cz - 86);

        // 10. Cảnh quan quân sự nhỏ: sandbag, xe quân sự, pallet, container
        this._createBaseProps(cx, cz);

        console.log('✅ Military Complex hoàn tất!');
    },

    // --- Helper để thêm mesh vào danh sách collision ---
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
        const hPlane = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 4.5), hMat);
        hPlane.rotation.x = -Math.PI / 2;
        hPlane.position.set(cx, 0.51, cz);
        hPlane.receiveShadow = true;
        this.scene.add(hPlane);

        const ledMat = new THREE.MeshPhongMaterial({ color: 0xfbc531, emissive: 0xfbc531, emissiveIntensity: 0.3 });
        for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2;
            const r = 7.5;
            const x = cx + Math.cos(angle) * r;
            const z = cz + Math.sin(angle) * r;
            const led = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 6), ledMat);
            led.position.set(x, 0.55, z);
            led.castShadow = true;
            this.scene.add(led);
        }
    },

    _createCommandCenter: function(cx, cz) {
        const group = new THREE.Group();

        // Tầng 1
        const mat1 = new THREE.MeshPhongMaterial({ color: 0x3a3f47 });
        const floor1 = new THREE.Mesh(new THREE.BoxGeometry(16, 4, 12), mat1);
        floor1.position.set(0, 2, 0);
        floor1.castShadow = true;
        floor1.receiveShadow = true;
        group.add(floor1);
        this._addCollisionMesh(floor1);

        // Tầng 2
        const mat2 = new THREE.MeshPhongMaterial({ color: 0x4a5059 });
        const floor2 = new THREE.Mesh(new THREE.BoxGeometry(12, 3.5, 9), mat2);
        floor2.position.set(0, 5.75, 0);
        floor2.castShadow = true;
        floor2.receiveShadow = true;
        group.add(floor2);
        this._addCollisionMesh(floor2);

        // Tầng 3
        const mat3 = new THREE.MeshPhongMaterial({ color: 0x5a6069 });
        const floor3 = new THREE.Mesh(new THREE.BoxGeometry(8, 3, 6), mat3);
        floor3.position.set(0, 9, 0);
        floor3.castShadow = true;
        floor3.receiveShadow = true;
        group.add(floor3);
        this._addCollisionMesh(floor3);

        const accentMat = new THREE.MeshPhongMaterial({ color: 0x2e8b57 });
        const accent = new THREE.Mesh(new THREE.BoxGeometry(16, 0.2, 12), accentMat);
        accent.position.set(0, 4.1, 0);
        accent.castShadow = true;
        accent.receiveShadow = true;
        group.add(accent);

        // Cửa chính
        const doorMat = new THREE.MeshPhongMaterial({ color: 0x1e272e });
        const door = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.8, 0.15), doorMat);
        door.position.set(0, 2.0, 6.1);
        door.castShadow = true;
        group.add(door);

        // Cửa sổ
        const winMat = new THREE.MeshPhongMaterial({ color: 0x1e272e, emissive: 0x1e272e, emissiveIntensity: 0.15 });
        for (let i = -1; i <= 1; i += 2) {
            const win = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 0.1), winMat);
            win.position.set(i * 2.5, 6.2, 4.55);
            win.castShadow = true;
            group.add(win);
        }

        // Radar
        const radarGroup = new THREE.Group();
        const baseRadar = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 1.2, 8),
            new THREE.MeshPhongMaterial({ color: 0x7f8c8d }));
        baseRadar.position.y = 0.6;
        baseRadar.castShadow = true;
        radarGroup.add(baseRadar);

        const dishMat = new THREE.MeshPhongMaterial({ color: 0x95a5a6, side: THREE.DoubleSide });
        const dish = new THREE.Mesh(new THREE.CircleGeometry(1.6, 16), dishMat);
        dish.position.y = 1.6;
        dish.rotation.x = -Math.PI / 4;
        dish.castShadow = true;
        radarGroup.add(dish);

        const antMat = new THREE.MeshPhongMaterial({ color: 0x2c3e50 });
        const ant = new THREE.Mesh(new THREE.BoxGeometry(0.05, 2.0, 0.05), antMat);
        ant.position.set(0, 2.8, 0);
        ant.castShadow = true;
        radarGroup.add(ant);

        const ball = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 6),
            new THREE.MeshPhongMaterial({ color: 0xe74c3c, emissive: 0xe74c3c, emissiveIntensity: 0.3 }));
        ball.position.set(0, 3.8, 0);
        ball.castShadow = true;
        radarGroup.add(ball);

        radarGroup.position.set(0, 10.5, 0);
        group.add(radarGroup);
        this._radar = radarGroup;

        // Cột ăng-ten
        const towerMat = new THREE.MeshPhongMaterial({ color: 0x7f8c8d });
        const towerGeo = new THREE.CylinderGeometry(0.2, 0.3, 14, 6);
        const tower = new THREE.Mesh(towerGeo, towerMat);
        tower.position.set(6, 7, 4);
        tower.castShadow = true;
        group.add(tower);
        this._addCollisionMesh(tower);

        for (let i = 1; i < 5; i++) {
            const bar = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.04, 0.8),
                new THREE.MeshPhongMaterial({ color: 0x95a5a6 }));
            bar.position.set(6, i * 2.8 + 1, 4);
            bar.castShadow = true;
            group.add(bar);
        }

        const signal = new THREE.Mesh(new THREE.SphereGeometry(0.15, 6, 6),
            new THREE.MeshPhongMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 0.5 }));
        signal.position.set(6, 14.2, 4);
        signal.castShadow = true;
        group.add(signal);

        group.position.set(cx, 0, cz);
        this.scene.add(group);
    },

    _createDoubleWalls: function(cx, cz, radius) {
        const wallMat = new THREE.MeshPhongMaterial({ color: 0x7f8c8d });
        const wallHeight = 3.0;
        const wallThick = 0.5;
        const segments = 48;

        // Vòng ngoài
        for (let i = 0; i < segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            const nextAngle = ((i + 1) / segments) * Math.PI * 2;
            const x1 = cx + Math.cos(angle) * radius;
            const z1 = cz + Math.sin(angle) * radius;
            const x2 = cx + Math.cos(nextAngle) * radius;
            const z2 = cz + Math.sin(nextAngle) * radius;
            const midX = (x1 + x2) / 2;
            const midZ = (z1 + z2) / 2;
            const dist = Math.hypot(x2 - x1, z2 - z1);

            const wall = new THREE.Mesh(new THREE.BoxGeometry(dist, wallHeight, wallThick), wallMat);
            wall.position.set(midX, wallHeight / 2, midZ);
            wall.lookAt(x2, wallHeight / 2, z2);
            wall.castShadow = true;
            wall.receiveShadow = true;
            this.scene.add(wall);
            this._addCollisionMesh(wall);
        }

        // Hàng rào thép bên trong (không chặn camera vì là lưới thép mỏng, nhưng vẫn thêm để an toàn)
        const innerRadius = radius - 1.2;
        const fenceMat = new THREE.MeshPhongMaterial({ color: 0xa4b0be });
        for (let i = 0; i < segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            const x = cx + Math.cos(angle) * innerRadius;
            const z = cz + Math.sin(angle) * innerRadius;
            const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 2.0, 6), fenceMat);
            post.position.set(x, 1.0, z);
            post.castShadow = true;
            post.receiveShadow = true;
            this.scene.add(post);
            this._addCollisionMesh(post);

            if (i % 2 === 0) {
                const nextAngle = ((i + 1) % segments) / segments * Math.PI * 2;
                const nx = cx + Math.cos(nextAngle) * innerRadius;
                const nz = cz + Math.sin(nextAngle) * innerRadius;
                const midX = (x + nx) / 2;
                const midZ = (z + nz) / 2;
                const dist = Math.hypot(nx - x, nz - z);
                const bar = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, dist), fenceMat);
                bar.position.set(midX, 0.8, midZ);
                bar.lookAt(nx, 0.8, nz);
                bar.castShadow = true;
                bar.receiveShadow = true;
                this.scene.add(bar);
                const bar2 = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, dist), fenceMat);
                bar2.position.set(midX, 1.6, midZ);
                bar2.lookAt(nx, 1.6, nz);
                bar2.castShadow = true;
                bar2.receiveShadow = true;
                this.scene.add(bar2);
            }
        }

        // Chướng ngại vật (hedgehog + barrier)
        const hedgehogMat = new THREE.MeshPhongMaterial({ color: 0x6b6b6b });
        const barrierMat = new THREE.MeshPhongMaterial({ color: 0x8e8e8e });
        for (let i = 0; i < 20; i++) {
            const angle = Math.random() * Math.PI * 2;
            const r = radius - 2 - Math.random() * 3;
            const x = cx + Math.cos(angle) * r;
            const z = cz + Math.sin(angle) * r;

            if (Math.random() < 0.5) {
                const hGroup = new THREE.Group();
                const barLen = 1.2;
                const bar = new THREE.Mesh(new THREE.BoxGeometry(barLen, 0.06, 0.06), hedgehogMat);
                bar.position.set(0, 0, 0);
                bar.castShadow = true;
                hGroup.add(bar);
                const bar2 = new THREE.Mesh(new THREE.BoxGeometry(barLen, 0.06, 0.06), hedgehogMat);
                bar2.rotation.x = Math.PI / 2;
                bar2.position.set(0, 0, 0);
                bar2.castShadow = true;
                hGroup.add(bar2);
                const bar3 = new THREE.Mesh(new THREE.BoxGeometry(barLen, 0.06, 0.06), hedgehogMat);
                bar3.rotation.z = Math.PI / 2;
                bar3.position.set(0, 0, 0);
                bar3.castShadow = true;
                hGroup.add(bar3);
                hGroup.position.set(x, 0.6, z);
                hGroup.rotation.y = Math.random() * Math.PI * 2;
                this.scene.add(hGroup);
                hGroup.children.forEach(child => this._addCollisionMesh(child));
            } else {
                const barrier = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.6), barrierMat);
                barrier.position.set(x, 0.2, z);
                barrier.castShadow = true;
                barrier.receiveShadow = true;
                this.scene.add(barrier);
                this._addCollisionMesh(barrier);
            }
        }
    },

    _createGuardTower: function(x, z) {
        const group = new THREE.Group();

        const colMat = new THREE.MeshPhongMaterial({ color: 0x57606f });
        const colPos = [[-1.2, -1.2], [1.2, -1.2], [1.2, 1.2], [-1.2, 1.2]];
        const cols = [];
        colPos.forEach(([dx, dz]) => {
            const col = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 6.0, 6), colMat);
            col.position.set(dx, 3.0, dz);
            col.castShadow = true;
            col.receiveShadow = true;
            group.add(col);
            cols.push(col);
            this._addCollisionMesh(col);
        });

        const floor = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.15, 3.0),
            new THREE.MeshPhongMaterial({ color: 0x2f3542 }));
        floor.position.set(0, 5.5, 0);
        floor.castShadow = true;
        floor.receiveShadow = true;
        group.add(floor);
        this._addCollisionMesh(floor);

        const railMat = new THREE.MeshPhongMaterial({ color: 0x7f8c8d });
        for (let i = 0; i < 4; i++) {
            const angle = (i / 4) * Math.PI * 2;
            const r = 1.5;
            const x1 = Math.cos(angle) * r;
            const z1 = Math.sin(angle) * r;
            const x2 = Math.cos((i + 1) / 4 * Math.PI * 2) * r;
            const z2 = Math.sin((i + 1) / 4 * Math.PI * 2) * r;
            const midX = (x1 + x2) / 2;
            const midZ = (z1 + z2) / 2;
            const dist = Math.hypot(x2 - x1, z2 - z1);
            const bar = new THREE.Mesh(new THREE.BoxGeometry(dist, 0.05, 0.05), railMat);
            bar.position.set(midX, 6.2, midZ);
            bar.lookAt(x2, 6.2, z2);
            bar.castShadow = true;
            group.add(bar);
        }

        const roof = new THREE.Mesh(new THREE.ConeGeometry(2.2, 0.8, 4),
            new THREE.MeshPhongMaterial({ color: 0x2f3542 }));
        roof.position.set(0, 6.5, 0);
        roof.rotation.y = Math.PI / 4;
        roof.castShadow = true;
        roof.receiveShadow = true;
        group.add(roof);
        this._addCollisionMesh(roof);

        const light = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 8),
            new THREE.MeshPhongMaterial({ color: 0xfbc531, emissive: 0xfbc531, emissiveIntensity: 0.5 }));
        light.position.set(0, 6.8, 0);
        light.castShadow = true;
        group.add(light);

        const dish = new THREE.Mesh(new THREE.CircleGeometry(0.4, 8),
            new THREE.MeshPhongMaterial({ color: 0x95a5a6, side: THREE.DoubleSide }));
        dish.position.set(0, 6.6, 1.2);
        dish.rotation.x = -Math.PI / 2;
        dish.castShadow = true;
        group.add(dish);

        group.position.set(x, 0, z);
        this.scene.add(group);
    },

    _createBarracks: function(cx, cz) {
        for (let i = -1; i <= 1; i += 2) {
            for (let j = -1; j <= 1; j += 2) {
                const x = cx + i * 3.5;
                const z = cz + j * 4.0;
                this._createTent(x, z);
            }
        }

        const pathMat = new THREE.MeshPhongMaterial({ color: 0x7f8c8d });
        for (let i = -1; i <= 1; i += 2) {
            const path = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 6), pathMat);
            path.position.set(cx + i * 1.8, 0.03, cz);
            path.receiveShadow = true;
            path.castShadow = true;
            this.scene.add(path);
        }
    },

    _createTent: function(x, z) {
        const group = new THREE.Group();
        const tentMat = new THREE.MeshPhongMaterial({
            color: 0x1b4332,
            side: THREE.DoubleSide,
            flatShading: true
        });
        const tent = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 3.5, 8, 1, true, 0, Math.PI), tentMat);
        tent.rotation.z = Math.PI / 2;
        tent.position.set(0, 1.0, 0);
        tent.castShadow = true;
        tent.receiveShadow = true;
        group.add(tent);
        this._addCollisionMesh(tent);

        const base = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 2.2),
            new THREE.MeshPhongMaterial({ color: 0x1b4332 }));
        base.rotation.x = -Math.PI / 2;
        base.position.set(0, 0.02, 0);
        base.receiveShadow = true;
        group.add(base);

        const stakeMat = new THREE.MeshPhongMaterial({ color: 0x718093 });
        for (let i = -1; i <= 1; i += 2) {
            const stake = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.4, 4), stakeMat);
            stake.position.set(i * 2.4, 0.2, 1.4);
            stake.castShadow = true;
            group.add(stake);
        }

        group.position.set(x, 0, z);
        group.rotation.y = (Math.random() - 0.5) * 0.3;
        this.scene.add(group);
    },

    _createSupplyDepot: function(cx, cz) {
        const contMat = new THREE.MeshPhongMaterial({ color: 0xc0392b });
        const cont = new THREE.Mesh(new THREE.BoxGeometry(4.0, 2.5, 2.5), contMat);
        cont.position.set(cx - 3, 1.25, cz);
        cont.castShadow = true;
        cont.receiveShadow = true;
        this.scene.add(cont);
        this._addCollisionMesh(cont);

        const contMat2 = new THREE.MeshPhongMaterial({ color: 0x2980b9 });
        const cont2 = new THREE.Mesh(new THREE.BoxGeometry(4.0, 2.5, 2.5), contMat2);
        cont2.position.set(cx + 3, 1.25, cz);
        cont2.castShadow = true;
        cont2.receiveShadow = true;
        this.scene.add(cont2);
        this._addCollisionMesh(cont2);

        const small = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.2, 1.8),
            new THREE.MeshPhongMaterial({ color: 0xe67e22 }));
        small.position.set(cx - 1.5, 3.0, cz - 1.5);
        small.castShadow = true;
        small.receiveShadow = true;
        this.scene.add(small);
        this._addCollisionMesh(small);

        const woodMat = new THREE.MeshPhongMaterial({ color: 0x8e7538 });
        for (let i = -1; i <= 1; i += 2) {
            const box = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 0.8), woodMat);
            box.position.set(cx + i * 1.5, 0.3, cz + 3.5);
            box.castShadow = true;
            box.receiveShadow = true;
            this.scene.add(box);
            this._addCollisionMesh(box);
        }

        const oilMat = new THREE.MeshPhongMaterial({ color: 0xe67e22 });
        for (let i = 0; i < 3; i++) {
            const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.8, 8), oilMat);
            barrel.position.set(cx + i * 1.2 - 1.2, 0.4, cz - 3.2);
            barrel.castShadow = true;
            barrel.receiveShadow = true;
            this.scene.add(barrel);
            this._addCollisionMesh(barrel);
            const rim = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.03, 6, 8),
                new THREE.MeshPhongMaterial({ color: 0x7f8c8d }));
            rim.position.set(cx + i * 1.2 - 1.2, 0.8, cz - 3.2);
            rim.rotation.x = Math.PI / 2;
            rim.castShadow = true;
            this.scene.add(rim);
        }
    },

    _createMainGate: function(cx, cz) {
        const group = new THREE.Group();

        const boothMat = new THREE.MeshPhongMaterial({ color: 0x34495e });
        for (let i = -1; i <= 1; i += 2) {
            const booth = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.0, 1.2), boothMat);
            booth.position.set(i * 3.0, 1.0, 0);
            booth.castShadow = true;
            booth.receiveShadow = true;
            group.add(booth);
            this._addCollisionMesh(booth);

            const roof = new THREE.Mesh(new THREE.ConeGeometry(0.9, 0.4, 4),
                new THREE.MeshPhongMaterial({ color: 0x2c3e50 }));
            roof.position.set(i * 3.0, 2.2, 0);
            roof.rotation.y = Math.PI / 4;
            roof.castShadow = true;
            group.add(roof);
            this._addCollisionMesh(roof);
        }

        const barMat = new THREE.MeshPhongMaterial({ color: 0xe74c3c });
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 5.0), barMat);
        bar.position.set(0, 0.6, 0);
        bar.castShadow = true;
        bar.receiveShadow = true;
        group.add(bar);
        this._addCollisionMesh(bar);

        const whiteMat = new THREE.MeshPhongMaterial({ color: 0xecf0f1 });
        for (let i = -2; i <= 2; i += 1.5) {
            const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.15, 0.5), whiteMat);
            stripe.position.set(0, 0.6, i);
            stripe.castShadow = true;
            group.add(stripe);
        }

        const poleMat = new THREE.MeshPhongMaterial({ color: 0x7f8c8d });
        for (let i = -1; i <= 1; i += 2) {
            const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.2, 6), poleMat);
            pole.position.set(i * 2.6, 0.6, 0);
            pole.castShadow = true;
            group.add(pole);
            this._addCollisionMesh(pole);
        }

        group.position.set(cx, 0, cz);
        this.scene.add(group);
    },

    _createFlagpole: function(cx, cz) {
        const group = new THREE.Group();

        const poleMat = new THREE.MeshPhongMaterial({ color: 0xbdc3c7 });
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 10, 8), poleMat);
        pole.position.set(0, 5, 0);
        pole.castShadow = true;
        pole.receiveShadow = true;
        group.add(pole);
        this._addCollisionMesh(pole);

        const top = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8),
            new THREE.MeshPhongMaterial({ color: 0xf1c40f }));
        top.position.set(0, 10.1, 0);
        top.castShadow = true;
        group.add(top);

        const flagCanvas = document.createElement('canvas');
        flagCanvas.width = 128;
        flagCanvas.height = 80;
        const ctx = flagCanvas.getContext('2d');
        ctx.fillStyle = '#e74c3c';
        ctx.fillRect(0, 0, 128, 80);
        ctx.fillStyle = '#f1c40f';
        ctx.font = 'bold 50px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('★', 64, 44);
        const flagTexture = new THREE.CanvasTexture(flagCanvas);
        const flagMat = new THREE.MeshPhongMaterial({ map: flagTexture, side: THREE.DoubleSide, transparent: true });
        const flag = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2.0), flagMat);
        flag.position.set(1.6, 8.5, 0);
        flag.rotation.y = -0.2;
        flag.castShadow = true;
        group.add(flag);

        group.position.set(cx, 0, cz);
        this.scene.add(group);
    },


    _createBoxBuilding: function(x, z, width, height, depth, bodyColor, accentColor, labelColor) {
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
        for (let row = 0; row < 2; row++) {
            for (let col = 0; col < 2; col++) {
                const x = cx + col * 12;
                const z = cz + row * 12;
                this._createBoxBuilding(x, z, 9, 3.6, 7, 0x46504b, 0x6c8f77);
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
        this._createBoxBuilding(cx, cz, 15, 4.2, 9, 0x4c574f, 0x8c9d88);
        const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.8, 2.4, 0.8), new THREE.MeshPhongMaterial({ color: 0x252a2d }));
        chimney.position.set(cx + 4.5, 5.3, cz - 2.0);
        chimney.castShadow = true;
        this.scene.add(chimney);
    },

    _createMedicalBlock: function(cx, cz) {
        this._createBoxBuilding(cx, cz, 14, 4.0, 9, 0x54615d, 0xff5555);
        const crossMat = new THREE.MeshPhongMaterial({ color: 0xf3f6f7, emissive: 0xf3f6f7, emissiveIntensity: 0.08 });
        const v = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.22, 0.28), crossMat);
        const h = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.22, 1.2), crossMat);
        v.position.set(cx, 2.8, cz + 4.55);
        h.position.set(cx, 2.8, cz + 4.55);
        this.scene.add(v, h);
    },

    _createLargeSupplyDepot: function(cx, cz) {
        this._createBoxBuilding(cx, cz, 18, 5.0, 12, 0x51575b, 0xd79b2b);
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
        this._createBoxBuilding(cx, cz, 19, 6.5, 13, 0x35454a, 0x45e0e9, 0x8ef6ff);
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
        this._createBoxBuilding(cx, cz, 18, 5.2, 14, 0x4b514f, 0xf4c542);
        const shutter = new THREE.Mesh(new THREE.BoxGeometry(7.5, 3.6, 0.18),
            new THREE.MeshPhongMaterial({ color: 0x252b2e }));
        shutter.position.set(cx, 1.9, cz + 7.05);
        this.scene.add(shutter);
    },

    _createTrainingGround: function(cx, cz) {
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

        // Hàng rào dây thép phía trong tạo cảm giác "2 lớp phòng thủ"
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

    // ================================================================
    // PHẦN CŨ: PLAYER, FOREST, VÀ CÁC HÀM KHÁC
    // ================================================================

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
        console.log('🧍 Nhân vật player được tạo');
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
        const zombieWidth = 0.7;
        const zombieHeight = 1.4;
        const bodyGeometry = new THREE.BoxGeometry(zombieWidth, zombieHeight * 0.7, zombieWidth);
        const bodyMaterial = new THREE.MeshPhongMaterial({ color: 0xff3333 });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = zombieHeight * 0.35;
        body.castShadow = true;
        body.receiveShadow = true;

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

    // Hàm tạo cây, đá (không chặn camera vì không nên chặn)
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

        const treeCount = 110;
        const rockCount = 40;
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

        console.log('🌲 Môi trường rừng rậm rạp được tạo:', this.trees.length, 'cây/bụi/gỗ,', this.rocks.length, 'đá');
    },

    /**
     * Hàm xử lý camera collision với vật thể và mặt đất
     * Trả về vị trí camera hợp lệ
     */
    _getSafeCameraPosition: function(fromPos, toPos, lookAtPos) {
        const direction = new THREE.Vector3().copy(toPos).sub(fromPos);
        const distance = direction.length();
        if (distance < 0.01) return toPos.clone();

        direction.normalize();

        // Tạo ray từ nhân vật đến vị trí camera mong muốn
        const raycaster = new THREE.Raycaster(fromPos, direction, 0.1, distance);

        // Kiểm tra va chạm với các mesh trong danh sách
        const intersects = raycaster.intersectObjects(this._collisionMeshes);

        let safePos = toPos.clone();

        if (intersects.length > 0) {
            // Lấy điểm va chạm gần nhất
            const hit = intersects[0];
            const hitDistance = hit.distance;
            // Lùi lại một chút để camera không bị dính vào tường
            const offset = 0.3;
            const safeDistance = Math.max(0.1, hitDistance - offset);
            safePos.copy(fromPos).add(direction.clone().multiplyScalar(safeDistance));
        }

        // Chặn camera không xuống dưới mặt đất (Y > 0.3)
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
            const verticalOffset = this.cameraDistance * sinPitch + effectiveHeightOffset;
            const offsetX = horizontalDist * sinYaw;
            const offsetZ = horizontalDist * cosYaw;

            // Vị trí camera mong muốn
            let rawCamX = playerX - offsetX;
            let rawCamY = verticalOffset;
            let rawCamZ = playerZ - offsetZ;

            // Điểm từ nhân vật đến camera
            const fromPos = new THREE.Vector3(playerX, py + 0.5, playerZ);
            const toPos = new THREE.Vector3(rawCamX, rawCamY, rawCamZ);

            // Áp dụng collision để có vị trí an toàn
            const safePos = this._getSafeCameraPosition(fromPos, toPos, new THREE.Vector3(playerX, this.cameraLookAtHeight, playerZ));
            targetCamX = safePos.x;
            targetCamY = safePos.y;
            targetCamZ = safePos.z;

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