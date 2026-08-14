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

        this.setupLighting();
        this.createGround();
        this.createBoundaryMountains();
        this.createRiver();

        // ---- ĐẠI BẢN DOANH QUÂN SỰ MỚI ----
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
        console.log('🏰 Xây dựng Đại Bản Doanh Quân Sự...');

        // 1. Nền bê tông tổng thể (rộng hơn)
        const baseSize = 80;
        this._createConcreteBase(cx, cz, baseSize);

        // 2. Sân đáp trực thăng mở rộng (Helipad)
        this._createHelipad(cx, cz);

        // 3. Tòa nhà chỉ huy trung tâm (Command Center)
        this._createCommandCenter(cx, cz - 12);

        // 4. Tường rào kép + chướng ngại vật
        this._createDoubleWalls(cx, cz, 34);

        // 5. 4 Tháp canh nâng cấp
        const offsets = [
            [-34, -34], [34, -34], [34, 34], [-34, 34]
        ];
        offsets.forEach(([dx, dz]) => {
            this._createGuardTower(cx + dx, cz + dz);
        });

        // 6. Khu doanh trại (4 lều + lối đi)
        this._createBarracks(cx - 20, cz + 18);

        // 7. Kho bãi (container, thùng đạn, phi dầu)
        this._createSupplyDepot(cx + 24, cz + 22);

        // 8. Cổng chính + bốt gác
        this._createMainGate(cx, cz + 38);

        // 9. Cột cờ trung tâm
        this._createFlagpole(cx, cz - 6);

        console.log('✅ Đại Bản Doanh hoàn tất!');
    },

    // -------------------- Các hàm con --------------------

    _createConcreteBase: function(cx, cz, size) {
        const half = size / 2;
        const geo = new THREE.BoxGeometry(size, 0.4, size);
        const mat = new THREE.MeshPhongMaterial({ color: 0x2f3640 });
        const base = new THREE.Mesh(geo, mat);
        base.position.set(cx, 0.2, cz);
        base.receiveShadow = true;
        base.castShadow = true;
        this.scene.add(base);

        // Viền gạch
        const edgeMat = new THREE.MeshPhongMaterial({ color: 0x1e272e });
        const edges = new THREE.EdgesGeometry(geo);
        const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x1e272e }));
        line.position.copy(base.position);
        this.scene.add(line);
    },

    _createHelipad: function(cx, cz) {
        // Vòng tròn vàng lớn
        const ringGeo = new THREE.RingGeometry(5, 7, 48);
        const ringMat = new THREE.MeshPhongMaterial({ color: 0xfbc531, side: THREE.DoubleSide });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(cx, 0.5, cz);
        ring.receiveShadow = true;
        this.scene.add(ring);

        // Chữ "H" trắng lớn
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

        // Đèn LED vàng nhỏ xung quanh
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

        // Tầng 1 (boong-ke)
        const mat1 = new THREE.MeshPhongMaterial({ color: 0x3a3f47 });
        const floor1 = new THREE.Mesh(new THREE.BoxGeometry(16, 4, 12), mat1);
        floor1.position.set(0, 2, 0);
        floor1.castShadow = true;
        floor1.receiveShadow = true;
        group.add(floor1);

        // Tầng 2 (lùi vào)
        const mat2 = new THREE.MeshPhongMaterial({ color: 0x4a5059 });
        const floor2 = new THREE.Mesh(new THREE.BoxGeometry(12, 3.5, 9), mat2);
        floor2.position.set(0, 5.75, 0);
        floor2.castShadow = true;
        floor2.receiveShadow = true;
        group.add(floor2);

        // Tầng 3 (thu nhỏ hơn)
        const mat3 = new THREE.MeshPhongMaterial({ color: 0x5a6069 });
        const floor3 = new THREE.Mesh(new THREE.BoxGeometry(8, 3, 6), mat3);
        floor3.position.set(0, 9, 0);
        floor3.castShadow = true;
        floor3.receiveShadow = true;
        group.add(floor3);

        // Điểm nhấn rêu quân đội (trang trí)
        const accentMat = new THREE.MeshPhongMaterial({ color: 0x2e8b57 });
        const accent = new THREE.Mesh(new THREE.BoxGeometry(16, 0.2, 12), accentMat);
        accent.position.set(0, 4.1, 0);
        accent.castShadow = true;
        accent.receiveShadow = true;
        group.add(accent);

        // Cửa chính (mặt Z dương)
        const doorMat = new THREE.MeshPhongMaterial({ color: 0x1e272e });
        const door = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.8, 0.15), doorMat);
        door.position.set(0, 2.0, 6.1);
        door.castShadow = true;
        group.add(door);

        // Cửa sổ tầng 2
        const winMat = new THREE.MeshPhongMaterial({ color: 0x1e272e, emissive: 0x1e272e, emissiveIntensity: 0.15 });
        for (let i = -1; i <= 1; i += 2) {
            const win = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 0.1), winMat);
            win.position.set(i * 2.5, 6.2, 4.55);
            win.castShadow = true;
            group.add(win);
        }

        // Tháp Radar xoay (trên nóc)
        const radarGroup = new THREE.Group();
        const baseRadar = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 1.2, 8),
            new THREE.MeshPhongMaterial({ color: 0x7f8c8d }));
        baseRadar.position.y = 0.6;
        baseRadar.castShadow = true;
        radarGroup.add(baseRadar);

        // Đĩa radar chính
        const dishMat = new THREE.MeshPhongMaterial({ color: 0x95a5a6, side: THREE.DoubleSide });
        const dish = new THREE.Mesh(new THREE.CircleGeometry(1.6, 16), dishMat);
        dish.position.y = 1.6;
        dish.rotation.x = -Math.PI / 4;
        dish.castShadow = true;
        radarGroup.add(dish);

        // Thanh anten
        const antMat = new THREE.MeshPhongMaterial({ color: 0x2c3e50 });
        const ant = new THREE.Mesh(new THREE.BoxGeometry(0.05, 2.0, 0.05), antMat);
        ant.position.set(0, 2.8, 0);
        ant.castShadow = true;
        radarGroup.add(ant);

        // Quả cầu đỉnh
        const ball = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 6),
            new THREE.MeshPhongMaterial({ color: 0xe74c3c, emissive: 0xe74c3c, emissiveIntensity: 0.3 }));
        ball.position.set(0, 3.8, 0);
        ball.castShadow = true;
        radarGroup.add(ball);

        radarGroup.position.set(0, 10.5, 0);
        group.add(radarGroup);

        // Lưu tham chiếu để xoay radar mỗi frame
        this._radar = radarGroup;

        // Cột ăng-ten phát sóng cao (bên cạnh)
        const towerMat = new THREE.MeshPhongMaterial({ color: 0x7f8c8d });
        const towerGeo = new THREE.CylinderGeometry(0.2, 0.3, 14, 6);
        const tower = new THREE.Mesh(towerGeo, towerMat);
        tower.position.set(6, 7, 4);
        tower.castShadow = true;
        group.add(tower);

        // Thêm các thanh ngang
        for (let i = 1; i < 5; i++) {
            const bar = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.04, 0.8),
                new THREE.MeshPhongMaterial({ color: 0x95a5a6 }));
            bar.position.set(6, i * 2.8 + 1, 4);
            bar.castShadow = true;
            group.add(bar);
        }

        // Đèn tín hiệu trên đỉnh cột
        const signal = new THREE.Mesh(new THREE.SphereGeometry(0.15, 6, 6),
            new THREE.MeshPhongMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 0.5 }));
        signal.position.set(6, 14.2, 4);
        signal.castShadow = true;
        group.add(signal);

        group.position.set(cx, 0, cz);
        this.scene.add(group);
    },

    _createDoubleWalls: function(cx, cz, radius) {
        // Tường bê tông ngoài (dày, cao)
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

            // Đoạn tường
            const wall = new THREE.Mesh(new THREE.BoxGeometry(dist, wallHeight, wallThick), wallMat);
            wall.position.set(midX, wallHeight / 2, midZ);
            wall.lookAt(x2, wallHeight / 2, z2);
            wall.castShadow = true;
            wall.receiveShadow = true;
            this.scene.add(wall);
        }

        // Hàng rào thép bên trong (lưới thép)
        const innerRadius = radius - 1.2;
        const fenceMat = new THREE.MeshPhongMaterial({ color: 0xa4b0be });
        for (let i = 0; i < segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            const x = cx + Math.cos(angle) * innerRadius;
            const z = cz + Math.sin(angle) * innerRadius;
            // Cọc
            const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 2.0, 6), fenceMat);
            post.position.set(x, 1.0, z);
            post.castShadow = true;
            post.receiveShadow = true;
            this.scene.add(post);

            // Thanh ngang (cách 2 cọc)
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

        // Chướng ngại vật: Czech hedgehogs và Jersey barriers
        const hedgehogMat = new THREE.MeshPhongMaterial({ color: 0x6b6b6b });
        const barrierMat = new THREE.MeshPhongMaterial({ color: 0x8e8e8e });
        for (let i = 0; i < 20; i++) {
            const angle = Math.random() * Math.PI * 2;
            const r = radius - 2 - Math.random() * 3;
            const x = cx + Math.cos(angle) * r;
            const z = cz + Math.sin(angle) * r;

            if (Math.random() < 0.5) {
                // Czech hedgehog (3 thanh gỗ chéo)
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
            } else {
                // Jersey barrier (khối bê tông)
                const barrier = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.6), barrierMat);
                barrier.position.set(x, 0.2, z);
                barrier.castShadow = true;
                barrier.receiveShadow = true;
                this.scene.add(barrier);
            }
        }
    },

    _createGuardTower: function(x, z) {
        const group = new THREE.Group();

        // 4 cột thép
        const colMat = new THREE.MeshPhongMaterial({ color: 0x57606f });
        const colPos = [[-1.2, -1.2], [1.2, -1.2], [1.2, 1.2], [-1.2, 1.2]];
        colPos.forEach(([dx, dz]) => {
            const col = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 6.0, 6), colMat);
            col.position.set(dx, 3.0, dz);
            col.castShadow = true;
            col.receiveShadow = true;
            group.add(col);
        });

        // Sàn quan sát
        const floor = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.15, 3.0),
            new THREE.MeshPhongMaterial({ color: 0x2f3542 }));
        floor.position.set(0, 5.5, 0);
        floor.castShadow = true;
        floor.receiveShadow = true;
        group.add(floor);

        // Lan can
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

        // Mái che
        const roof = new THREE.Mesh(new THREE.ConeGeometry(2.2, 0.8, 4),
            new THREE.MeshPhongMaterial({ color: 0x2f3542 }));
        roof.position.set(0, 6.5, 0);
        roof.rotation.y = Math.PI / 4;
        roof.castShadow = true;
        roof.receiveShadow = true;
        group.add(roof);

        // Đèn pha
        const light = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 8),
            new THREE.MeshPhongMaterial({ color: 0xfbc531, emissive: 0xfbc531, emissiveIntensity: 0.5 }));
        light.position.set(0, 6.8, 0);
        light.castShadow = true;
        group.add(light);

        // Đĩa radar
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
        // 4 lều xếp song song
        for (let i = -1; i <= 1; i += 2) {
            for (let j = -1; j <= 1; j += 2) {
                const x = cx + i * 3.5;
                const z = cz + j * 4.0;
                this._createTent(x, z);
            }
        }

        // Lối đi bê tông giữa các lều
        const pathMat = new THREE.MeshPhongMaterial({ color: 0x7f8c8d });
        for (let i = -1; i <= 1; i += 2) {
            const path = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 6),
                pathMat);
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

        // Đáy
        const base = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 2.2),
            new THREE.MeshPhongMaterial({ color: 0x1b4332 }));
        base.rotation.x = -Math.PI / 2;
        base.position.set(0, 0.02, 0);
        base.receiveShadow = true;
        group.add(base);

        // Cọc
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
        // Container đỏ sẫm
        const contMat = new THREE.MeshPhongMaterial({ color: 0xc0392b });
        const cont = new THREE.Mesh(new THREE.BoxGeometry(4.0, 2.5, 2.5), contMat);
        cont.position.set(cx - 3, 1.25, cz);
        cont.castShadow = true;
        cont.receiveShadow = true;
        this.scene.add(cont);

        // Container xanh dương
        const contMat2 = new THREE.MeshPhongMaterial({ color: 0x2980b9 });
        const cont2 = new THREE.Mesh(new THREE.BoxGeometry(4.0, 2.5, 2.5), contMat2);
        cont2.position.set(cx + 3, 1.25, cz);
        cont2.castShadow = true;
        cont2.receiveShadow = true;
        this.scene.add(cont2);

        // Xếp chồng thêm 1 container nhỏ
        const small = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.2, 1.8),
            new THREE.MeshPhongMaterial({ color: 0xe67e22 }));
        small.position.set(cx - 1.5, 3.0, cz - 1.5);
        small.castShadow = true;
        small.receiveShadow = true;
        this.scene.add(small);

        // Thùng đạn gỗ
        const woodMat = new THREE.MeshPhongMaterial({ color: 0x8e7538 });
        for (let i = -1; i <= 1; i += 2) {
            const box = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 0.8), woodMat);
            box.position.set(cx + i * 1.5, 0.3, cz + 3.5);
            box.castShadow = true;
            box.receiveShadow = true;
            this.scene.add(box);
        }

        // Phi dầu khí (thùng tròn cam)
        const oilMat = new THREE.MeshPhongMaterial({ color: 0xe67e22 });
        for (let i = 0; i < 3; i++) {
            const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.8, 8), oilMat);
            barrel.position.set(cx + i * 1.2 - 1.2, 0.4, cz - 3.2);
            barrel.castShadow = true;
            barrel.receiveShadow = true;
            this.scene.add(barrel);
            // Vành
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

        // 2 bốt gác
        const boothMat = new THREE.MeshPhongMaterial({ color: 0x34495e });
        for (let i = -1; i <= 1; i += 2) {
            const booth = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.0, 1.2), boothMat);
            booth.position.set(i * 3.0, 1.0, 0);
            booth.castShadow = true;
            booth.receiveShadow = true;
            group.add(booth);

            // Mái
            const roof = new THREE.Mesh(new THREE.ConeGeometry(0.9, 0.4, 4),
                new THREE.MeshPhongMaterial({ color: 0x2c3e50 }));
            roof.position.set(i * 3.0, 2.2, 0);
            roof.rotation.y = Math.PI / 4;
            roof.castShadow = true;
            group.add(roof);
        }

        // Barrier đỏ-trắng
        const barMat = new THREE.MeshPhongMaterial({ color: 0xe74c3c });
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 5.0), barMat);
        bar.position.set(0, 0.6, 0);
        bar.castShadow = true;
        bar.receiveShadow = true;
        group.add(bar);

        // Sọc trắng
        const whiteMat = new THREE.MeshPhongMaterial({ color: 0xecf0f1 });
        for (let i = -2; i <= 2; i += 1.5) {
            const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.15, 0.5), whiteMat);
            stripe.position.set(0, 0.6, i);
            stripe.castShadow = true;
            group.add(stripe);
        }

        // Cột barrier
        const poleMat = new THREE.MeshPhongMaterial({ color: 0x7f8c8d });
        for (let i = -1; i <= 1; i += 2) {
            const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.2, 6), poleMat);
            pole.position.set(i * 2.6, 0.6, 0);
            pole.castShadow = true;
            group.add(pole);
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

        const top = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8),
            new THREE.MeshPhongMaterial({ color: 0xf1c40f }));
        top.position.set(0, 10.1, 0);
        top.castShadow = true;
        group.add(top);

        // Lá cờ (vẽ canvas)
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

    // ================================================================
    // PHẦN CŨ: PLAYER, FOREST, VÀ CÁC HÀM KHÁC
    // (Giữ nguyên)
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

        const coneGeometry = new THREE.ConeGeometry(towerRadius * 0.8, 2.5, 16);
        const coneMaterial = new THREE.MeshPhongMaterial({ color: 0x00ff00 });
        const cone = new THREE.Mesh(coneGeometry, coneMaterial);
        cone.position.set(x, towerHeight + 1.25, z);
        cone.castShadow = true;
        this.scene.add(cone);

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

    // Hàm tạo cây, đá (giữ nguyên)
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

    render: function() {
        // Xoay radar mỗi frame
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