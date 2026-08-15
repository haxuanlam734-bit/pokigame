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

    // External GLB assets loaded from src/assets/models.
    _assetPromises: [],
    _externalModels: {},

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
    _autoDefenseTurrets: [],
    _autoDefenseTracers: [],
    _hqInterior: null,

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
        this._autoDefenseTurrets = [];
        this._autoDefenseTracers = [];
        this._hqInterior = null;

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
        this._registerMilitaryInteractions(cx, cz);

        console.log('✅ Military Complex hoàn tất!');
    },

    _registerMilitaryInteractions: function(cx, cz) {
        this._militaryInteractions = [
            { id: 'hq', name: 'COMMAND HQ', description: 'Nâng cấp căn cứ và mở thêm công suất kiếm tiền.', x: cx, z: cz - 18, radius: 11 },
            { id: 'barracks', name: 'BARRACKS', description: 'Tuyển lính gác và tăng khả năng phòng thủ căn cứ.', x: cx - 51 + 6, z: cz - 20 + 6, radius: 10 },
            { id: 'mess', name: 'MESS HALL', description: 'Ăn uống, hồi stamina và nhận buff di chuyển.', x: cx - 54, z: cz + 25, radius: 9 },
            { id: 'medical', name: 'MEDICAL', description: 'Hồi đầy HP và nhận lá chắn y tế tạm thời.', x: cx - 25, z: cz + 27, radius: 9 },
            { id: 'supply', name: 'SUPPLY DEPOT', description: 'Mua ammo và nâng cấp vũ khí hiện tại.', x: cx + 50, z: cz - 18, radius: 10 },
            { id: 'fuel', name: 'FUEL FARM', description: 'Đổi nhiên liệu thành tiền và tăng thu nhập thụ động.', x: cx + 51, z: cz + 28, radius: 9 },
            { id: 'motorPool', name: 'MOTOR POOL', description: 'Triệu hồi xe và nâng tốc độ di chuyển.', x: cx + 50, z: cz + 55, radius: 10 },
            { id: 'lab', name: 'RESEARCH LAB', description: 'Nghiên cứu nâng damage và hiệu suất máy in.', x: cx + 3, z: cz - 59, radius: 11 },
            { id: 'workshop', name: 'VEHICLE WORKSHOP', description: 'Sửa xe và tăng tốc độ/giảm cooldown phương tiện.', x: cx - 42, z: cz - 58, radius: 10 },
            { id: 'training', name: 'TRAINING GROUND', description: 'Luyện tập để tăng weapon XP và damage.', x: cx - 42, z: cz + 58, radius: 13 },
            { id: 'range', name: 'SHOOTING RANGE', description: 'Test súng, hồi ammo và nhận buff accuracy.', x: cx + 8, z: cz + 59, radius: 13 },
            { id: 'radar', name: 'RADAR STATION', description: 'Quét sóng zombie và phát hiện boss sớm.', x: cx + 72, z: cz - 70, radius: 9 },
            { id: 'comms', name: 'COMMS TOWER', description: 'Nhận hợp đồng tiếp tế và phần thưởng tiền.', x: cx - 72, z: cz - 70, radius: 9 }
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

        // Tòa trung tâm lớn hơn hẳn các khu còn lại: 3 tầng, sân trong rộng,
        // tầng 1 để build minter/conveyor, tầng 2 là command floor, tầng 3 là
        // operations / VIP floor. Các tầng trên mang tính trình diễn nhưng
        // vẫn có cầu thang để sau này mở rộng gameplay.
        const W = 30;
        const D = 22;
        const floorH = 3.8;
        const wallT = 0.65;
        const floorMat = new THREE.MeshPhongMaterial({ color: 0x343a40 });
        const wallMat = new THREE.MeshPhongMaterial({ color: 0x4b555c });
        const trimMat = new THREE.MeshPhongMaterial({ color: 0x7a8a92 });
        const darkMat = new THREE.MeshPhongMaterial({ color: 0x20262a });
        const glassMat = new THREE.MeshPhongMaterial({
            color: 0x7fe8ff,
            emissive: 0x2f93a8,
            emissiveIntensity: 0.3,
            transparent: true,
            opacity: 0.72
        });

        const addBox = (geo, mat, x, y, z, collision = true) => {
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(x, y, z);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            group.add(mesh);
            if (collision) this._addCollisionMesh(mesh);
            return mesh;
        };

        // Sàn 3 tầng (tầng 1 chừa hẳn không gian build).
        [0.16, floorH + 0.12, floorH * 2 + 0.12].forEach(y => {
            addBox(new THREE.BoxGeometry(W, 0.28, D), floorMat, 0, y, 0, false);
        });

        // Tường tầng 1: mặt trước có cửa lớn 7m, phần còn lại tạo cảm giác
        // đại sảnh mở để đặt máy in tiền/conveyor.
        const frontSide = (yBase, h) => {
            const gap = 7.0;
            const sideW = (W - gap) / 2;
            addBox(new THREE.BoxGeometry(sideW, h, wallT), wallMat, -(gap + sideW) / 2, yBase + h / 2, D / 2, true);
            addBox(new THREE.BoxGeometry(sideW, h, wallT), wallMat, (gap + sideW) / 2, yBase + h / 2, D / 2, true);
            // header phía trên cửa
            addBox(new THREE.BoxGeometry(gap, 0.9, wallT), wallMat, 0, yBase + h - 0.45, D / 2, true);
        };
        const fullWall = (x, yBase, z, w, h, d, mat = wallMat) => {
            addBox(new THREE.BoxGeometry(w, h, d), mat, x, yBase + h / 2, z, true);
        };

        frontSide(0.28, floorH - 0.2);
        fullWall(0, 0.28, -D / 2, W, floorH - 0.2, wallT);
        fullWall(-W / 2, 0.28, 0, wallT, floorH - 0.2, D);
        fullWall(W / 2, 0.28, 0, wallT, floorH - 0.2, D);

        // Tầng 2 + tầng 3 khép kín hơn, làm silhouette thật của HQ.
        for (let level = 1; level <= 2; level++) {
            const yBase = level * floorH + 0.28;
            frontSide(yBase, floorH - 0.2);
            fullWall(0, yBase, -D / 2, W, floorH - 0.2, wallT);
            fullWall(-W / 2, yBase, 0, wallT, floorH - 0.2, D);
            fullWall(W / 2, yBase, 0, wallT, floorH - 0.2, D);
        }

        // Dải cửa kính cho cả 3 tầng.
        for (let level = 0; level < 3; level++) {
            const y = 1.75 + level * floorH;
            const frontZ = D / 2 + 0.02;
            for (let i = -2; i <= 2; i++) {
                if (level === 0 && i === 0) continue; // cửa chính tầng 1
                const win = addBox(new THREE.BoxGeometry(3.2, 1.2, 0.12), glassMat,
                    i * 4.7, y, frontZ, false);
                win.castShadow = false;
            }
            for (let i = -2; i <= 2; i++) {
                const winL = addBox(new THREE.BoxGeometry(0.12, 1.1, 3.0), glassMat,
                    -W / 2 - 0.02, y, i * 3.6, false);
                const winR = addBox(new THREE.BoxGeometry(0.12, 1.1, 3.0), glassMat,
                    W / 2 + 0.02, y, i * 3.6, false);
                winL.castShadow = winR.castShadow = false;
            }
        }

        // Cửa chính kiểu military airlock.
        const doorOuter = addBox(new THREE.BoxGeometry(6.4, 3.0, 0.18), darkMat, 0, 1.62, D / 2 + 0.18, false);
        doorOuter.castShadow = false;
        const doorGlow = addBox(new THREE.BoxGeometry(5.2, 2.35, 0.08),
            new THREE.MeshPhongMaterial({ color: 0x26363a, emissive: 0x4cc9dc, emissiveIntensity: 0.12 }),
            0, 1.55, D / 2 + 0.29, false);
        doorGlow.castShadow = false;

        // Mái đua + tầng mái, làm công trình nổi bật từ xa.
        addBox(new THREE.BoxGeometry(W + 1.8, 0.38, D + 1.8), darkMat, 0, floorH * 3 + 0.35, 0, true);
        addBox(new THREE.BoxGeometry(18, 1.0, 9), new THREE.MeshPhongMaterial({ color: 0x30373c }), 0, floorH * 3 + 1.0, -0.5, true);
        addBox(new THREE.BoxGeometry(20, 0.28, 11), trimMat, 0, floorH * 3 + 1.48, -0.5, true);

        // Cờ hiệu + logo HQ trên mặt tiền.
        const sign = this._createBuildingSign('COMMAND HQ', 0x74e7ff, 8.5, 1.8);
        sign.position.set(0, 5.9, D / 2 + 0.42);
        group.add(sign);

        const subSign = this._createBuildingSign('BASE OPERATIONS', 0xf1c40f, 7.3, 1.25);
        subSign.position.set(0, 2.8, D / 2 + 0.42);
        group.add(subSign);

        // Nội thất tầng 1: các khu build minter cố định, rộng và thoáng.
        const interiorPadMat = new THREE.MeshPhongMaterial({ color: 0x263238 });
        const laneMat = new THREE.MeshPhongMaterial({ color: 0x40545b });
        const mintGlowMat = new THREE.MeshPhongMaterial({ color: 0x7bed9f, emissive: 0x2ecc71, emissiveIntensity: 0.3 });

        for (let row = 0; row < 2; row++) {
            for (let col = 0; col < 3; col++) {
                const x = -8.5 + col * 8.5;
                const z = -4.0 + row * 7.0;
                const pad = addBox(new THREE.BoxGeometry(6.8, 0.12, 4.9), interiorPadMat, x, 0.40, z, false);
                pad.userData = { buildZone: 'minter', slot: `${row}-${col}` };

                const inner = addBox(new THREE.BoxGeometry(5.7, 0.05, 3.8), laneMat, x, 0.48, z, false);
                inner.userData = { buildZone: 'minter' };

                // Viền slot màu xanh + điểm sáng, báo cho player đây là khu build tiền.
                for (const edge of [[5.9,0.06,0.08,0],[5.9,0.06,0.08,Math.PI], [0.08,0.06,3.9,0],[0.08,0.06,3.9,0]]) {
                    // Khung nhẹ; không collision để player đi qua.
                }
                const marker = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.22), mintGlowMat);
                marker.position.set(x - 2.65, 0.58, z - 1.8);
                marker.castShadow = true;
                group.add(marker);
            }
        }

        // Trục giao thông trong sảnh.
        addBox(new THREE.BoxGeometry(1.0, 0.05, D - 2.0),
            new THREE.MeshPhongMaterial({ color: 0x92a1a8 }), 0, 0.55, 1.6, false);

        // Cầu thang bên hông nối lên tầng 2/3 (đẹp và có thể mở gameplay sau).
        const stairMat = new THREE.MeshPhongMaterial({ color: 0x59666d });
        for (let level = 0; level < 2; level++) {
            for (let i = 0; i < 9; i++) {
                const step = addBox(new THREE.BoxGeometry(4.8, 0.28 + i * 0.04, 0.8), stairMat,
                    W / 2 - 4.0, 0.62 + level * floorH + i * 0.18, -7.6 + i * 0.85, true);
                step.rotation.y = 0;
            }
        }

        // Hai terminal chức năng ở sảnh.
        this._createTerminalKiosk(group, -11.0, 1.2, 5.0, 0x54a0ff, 'BASE UPGRADES');
        this._createTerminalKiosk(group, 11.0, 1.2, 5.0, 0xffc857, 'MONEY CONTROL');

        // Đèn/strips dưới mái.
        for (let side of [-1, 1]) {
            const strip = addBox(new THREE.BoxGeometry(W + 0.4, 0.18, 0.18),
                new THREE.MeshPhongMaterial({ color: 0x64dff0, emissive: 0x33c7df, emissiveIntensity: 0.35 }),
                0, floorH * 3 + 0.62, side * (D / 2 + 0.16), false);
            strip.castShadow = false;
        }

        group.position.set(cx, 0, cz);
        this.scene.add(group);

        this._createInteriorBuildSign(cx, cz, W, D);
        this._militaryBuildingFunctions = this._militaryBuildingFunctions || {};
        this._militaryBuildingFunctions.command = {
            name: 'Command HQ',
            function: 'Base upgrades + money production hub',
            buildZone: 'minter'
        };
    },

    _createBuildingSign: function(text, color, width = 6, height = 1.4) {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#11181d';
        ctx.fillRect(8, 8, 496, 112);
        ctx.strokeStyle = '#' + color.toString(16).padStart(6, '0');
        ctx.lineWidth = 6;
        ctx.strokeRect(10, 10, 492, 108);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 42px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 256, 66);
        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        const mat = new THREE.MeshPhongMaterial({ map: texture, transparent: true, side: THREE.DoubleSide });
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat);
        mesh.castShadow = false;
        return mesh;
    },

    _createInteriorBuildSign: function(cx, cz, width, depth) {
        const sign = this._createBuildingSign('BUILD MONEY MACHINES', 0x2ecc71, 9.4, 1.1);
        sign.position.set(cx, 3.8, cz + depth / 2 + 0.36);
        sign.rotation.y = Math.PI;
        this.scene.add(sign);
    },

    _createTerminalKiosk: function(group, x, y, z, color, label) {
        const base = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.6, 1.2), new THREE.MeshPhongMaterial({ color: 0x252c31 }));
        base.position.set(x, y, z);
        base.castShadow = true;
        group.add(base);
        const screen = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.1, 0.12), new THREE.MeshPhongMaterial({
            color,
            emissive: color,
            emissiveIntensity: 0.28
        }));
        screen.position.set(x, y + 0.78, z - 0.18);
        screen.castShadow = true;
        group.add(screen);
        const sign = this._createBuildingSign(label, color, 3.8, 0.62);
        sign.position.set(x, y + 1.55, z + 0.06);
        sign.rotation.x = -0.12;
        group.add(sign);
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


/* ============================================================================
 * APOCALYPSE MILITARY COMPLEX — VISUAL OVERHAUL
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
    console.log('🏰 Building modern post-apocalypse military complex...');

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

    // Main HQ: use the supplied game-ready GLB as the centerpiece, replacing
    // the old procedural HQ mesh. The existing HQ gameplay/interior systems
    // remain active so interaction logic does not break.
    this._loadMainHQAndTent(cx, cz);

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
    console.log('✅ Modern post-apocalypse base complete');
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

Renderer3D._loadGLBAsset = function(url, key, options = {}) {
    if (typeof THREE.GLTFLoader !== 'function') {
        console.warn('⚠️ GLTFLoader chưa được nạp, bỏ qua asset:', key);
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
                console.error('❌ Không tải được GLB:', key, error);
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
    this._apocLabel(group, 'MONEY DECK • BUILD HERE', 0x42e8a1, 0, 2.15, 15.7, 14.0, 0.82);

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

    // Soft interior illumination — cool emergency strips + warm task lights.
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
    if(!this._autoDefenseTurrets || !zombies) return;
    const now=Date.now();
    for(const turret of this._autoDefenseTurrets) {
        let target=null, best=turret.range;
        for(const z of zombies) {
            const d=Math.hypot(z.x-turret.x,z.z-turret.z);
            if(d<best){best=d;target=z;}
        }
        if(target) {
            const desired=Math.atan2(target.x-turret.x,target.z-turret.z);
            let diff=desired-turret.angle;
            while(diff>Math.PI) diff-=Math.PI*2;
            while(diff<-Math.PI) diff+=Math.PI*2;
            turret.angle += Math.max(-0.08,Math.min(0.08,diff));
            const local=turret.angle-turret.homeAngle;
            turret.head.rotation.y=local;
            turret.barrel.rotation.y=local;
            turret.barrel2.rotation.y=local;
            if(now-turret.lastShot>=turret.fireRate) {
                if(typeof target.takeDamage==='function') target.takeDamage(turret.damage);
                turret.lastShot=now;
                this._createAutoTracer(turret,target);
            }
        }
    }
};

Renderer3D._createAutoTracer = function(turret,target) {
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

Renderer3D.getPlayerFloorHeight = function(x,z) {
    if(!this._hqInterior) return 0;
    const dx=x-this._hqInterior.cx, dz=z-this._hqInterior.cz;
    // Lobby-to-first-floor ramp.
    if(Math.abs(dx)<=5.2 && dz>=8.0 && dz<=15.0) return 2.52*(15.0-dz)/7.0;
    // First floor main hall.
    if(Math.abs(dx)<=11.0 && dz>=-7.5 && dz<=8.0) return 2.52;
    // Stair to level 2 on east side.
    if(dx>=6.8 && dx<=10.9 && dz>=-9.0 && dz<=-1.8) return 2.52 + (6.77-2.52)*((-1.8-dz)/7.2);
    // Level 2.
    if(Math.abs(dx)<=10.8 && dz>=-9.0 && dz<=-1.8) return 6.77;
    // Stair to level 3 on west side.
    if(dx<=-6.8 && dx>=-10.9 && dz>=-14.0 && dz<=-7.0) return 6.77 + (11.02-6.77)*((-7.0-dz)/7.0);
    // Level 3 war room.
    if(Math.abs(dx)<=10.8 && dz>=-14.0 && dz<=-9.0) return 11.02;
    return 0;
};

Renderer3D._createApocalypseBarracksArea = function(cx, cz) {
    const mats = this._apocalypseMaterials();
    this._militaryBuildingFunctions.barracks = { name: 'Barracks', function: 'Troop housing / guard NPCs' };
    [[0,0],[16,0],[0,15],[16,15]].forEach(([dx,dz], i) => {
        this._createApocalypseBlock(cx+dx, cz+dz, {
            width: 13, height: 5.4, depth: 9,
            label: i === 0 ? 'BARRACKS' : 'QUARTERS',
            labelColor: 0x9ee7b6,
            bodyMat: i % 2 ? mats.military : mats.concrete,
            upperWidth: 7,
            upperOffsetX: i % 2 ? 2.0 : -1.5,
            pad: true
        });
    });
    // Covered walkway / lights.
    const canopy = new THREE.Group();
    this._apocBox(canopy, 31, 0.26, 2.6, 7.5, 4.3, 26.0, mats.metal, false);
    for (let i = 0; i < 7; i++) {
        const p = this._apocBox(canopy, 0.14, 4.0, 0.14, -7 + i * 4.8, 2.0, 24.8, mats.steel, false);
        const l = this._apocBox(canopy, 0.28, 0.16, 1.4, -7 + i * 4.8, 4.12, 24.8, mats.cyan, false);
        l.castShadow = false;
    }
    canopy.position.set(cx, 0, cz);
    this.scene.add(canopy);
};

Renderer3D._createApocalypseSupplyDepot = function(cx, cz) {
    const mats = this._apocalypseMaterials();
    this._militaryBuildingFunctions.supply = { name: 'Supply Depot', function: 'Ammo, weapons and logistics' };
    this._createApocalypseBlock(cx, cz, { width: 23, height: 7, depth: 15, label: 'SUPPLY DEPOT', labelColor: 0xffc857, bodyMat: mats.concrete, upperWidth: 12, upperOffsetX: 4 });
    // Container lanes and loading dock.
    const colors = [0x57636a, 0x45545c, 0x6a4f3e, 0x3c5662];
    for (let i = 0; i < 4; i++) {
        const cont = new THREE.Mesh(new THREE.BoxGeometry(6, 2.4, 2.6), new THREE.MeshPhongMaterial({ color: colors[i] }));
        cont.position.set(cx - 8.5 + i * 5.7, 1.2, cz + 11.0);
        cont.rotation.y = i % 2 ? 0.02 : -0.01;
        cont.castShadow = true; cont.receiveShadow = true;
        this.scene.add(cont); this._addCollisionMesh(cont);
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.08, 0.16), mats.amber);
        stripe.position.set(cont.position.x, 2.15, cont.position.z - 1.35);
        this.scene.add(stripe);
    }
};

Renderer3D._createApocalypseMotorPool = function(cx, cz) {
    const mats = this._apocalypseMaterials();
    this._militaryBuildingFunctions.motorPool = { name: 'Motor Pool', function: 'Vehicle storage / spawning' };
    this._createApocalypseBlock(cx, cz, { width: 28, height: 6.8, depth: 16, label: 'MOTOR POOL', labelColor: 0x62e8ff, bodyMat: mats.military, upperWidth: 14, upperOffsetX: -4 });
    for (let i = -2; i <= 2; i++) {
        const vehicle = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.15, 2.2), new THREE.MeshPhongMaterial({ color: i % 2 ? 0x536256 : 0x3e4b43 }));
        vehicle.position.set(cx + i * 5.0, 0.85, cz + 11.0); vehicle.castShadow = true;
        this.scene.add(vehicle);
        for (const dx of [-1.35, 1.35]) {
            const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.42,0.42,0.28,10), mats.metal);
            wheel.rotation.z = Math.PI/2; wheel.position.set(cx + i*5 + dx, 0.45, cz + 11.0);
            this.scene.add(wheel);
        }
    }
};

Renderer3D._createApocalypseResearchFacility = function(cx, cz) {
    const mats = this._apocalypseMaterials();
    this._militaryBuildingFunctions.lab = { name: 'Research Lab', function: 'Zombie research / weapon upgrades' };
    this._createApocalypseBlock(cx, cz, { width: 24, height: 7.2, depth: 15, label: 'RESEARCH LAB', labelColor: 0x65ecff, bodyMat: mats.concreteLight, upperWidth: 14, upperOffsetX: -3 });
    // Containment tanks.
    for (let i = -2; i <= 2; i++) {
        const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 0.92, 4.0, 18), new THREE.MeshPhongMaterial({ color: 0x203037, transparent:true, opacity:0.95 }));
        tank.position.set(cx + i * 3.2, 2.0, cz + 11.0); tank.castShadow = true;
        this.scene.add(tank);
        const fluid = new THREE.Mesh(new THREE.CylinderGeometry(0.62,0.62,2.5,16), new THREE.MeshPhongMaterial({ color:0x52d7e8, emissive:0x1c7c89, emissiveIntensity:0.5, transparent:true, opacity:0.62 }));
        fluid.position.set(cx + i*3.2, 1.55, cz + 11.0); this.scene.add(fluid);
    }
};

Renderer3D._createApocalypseTrainingGround = function(cx, cz) {
    const mats = this._apocalypseMaterials();
    this._militaryBuildingFunctions.training = { name: 'Training Ground', function: 'Weapon practice / aim training' };
    this._createPavedPad(cx, cz, 38, 24, 0x2a3034);
    this._createApocObstacleCourse(cx, cz);
    for (let i = -2; i <= 2; i++) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 3.0, 0.16), mats.steel);
        post.position.set(cx + i * 6.4, 1.5, cz + 8); this.scene.add(post);
        const target = new THREE.Mesh(new THREE.CylinderGeometry(0.9,0.9,0.18,18), mats.ambient || new THREE.MeshPhongMaterial({color:0xe0e5e7}));
        target.rotation.x = Math.PI/2; target.position.set(cx+i*6.4,2.2,cz+8); this.scene.add(target);
    }
    this._apocLabel(this.scene, 'TRAINING GROUND', 0x9ee7b6, cx, 0.1, cz - 10.6, 9, 0.8);
};

Renderer3D._createApocalypseShootingRange = function(cx, cz) {
    const mats = this._apocalypseMaterials();
    this._militaryBuildingFunctions.range = { name: 'Shooting Range', function: 'Weapon testing / target practice' };
    this._createPavedPad(cx, cz, 42, 22, 0x252b2e);
    for (let lane = -2; lane <= 2; lane++) {
        const line = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.03, 18), mats.steel);
        line.position.set(cx + lane*7.5, 0.18, cz); this.scene.add(line);
        const target = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.8, 0.20), mats.darkGlass);
        target.position.set(cx + lane*7.5, 1.4, cz + 7.5); this.scene.add(target);
        this._addCollisionMesh(target);
        this._apocStrip(this.scene, cx + lane*7.5, 2.8, cz+7.66, 1.7, 0.10, mats.cyan);
    }
    this._apocLabel(this.scene, 'LIVE FIRE', 0xff6b6b, cx, 3.5, cz - 10.8, 7.0, 0.8);
};

Renderer3D._createApocObstacleCourse = function(cx, cz) {
    const mats = this._apocalypseMaterials();
    for (let i = -2; i <= 2; i++) {
        const block = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.1 + Math.abs(i)*0.25, 1.2), mats.concreteDark);
        block.position.set(cx + i*5.5, block.geometry.parameters.height/2, cz - 4); block.castShadow = true;
        this.scene.add(block); this._addCollisionMesh(block);
    }
    for (let i = -2; i <= 2; i++) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08,0.10,2.4,6), mats.steel);
        pole.position.set(cx + i*4.5, 1.2, cz - 8); this.scene.add(pole);
        const rope = new THREE.Mesh(new THREE.BoxGeometry(3.8,0.05,0.05), mats.amber);
        rope.position.set(cx + i*4.5, 2.25, cz - 8); this.scene.add(rope);
    }
};

Renderer3D._createApocalypseRadarStation = function(cx, cz) {
    const mats = this._apocalypseMaterials();
    this._militaryBuildingFunctions.radar = { name: 'Radar Station', function: 'Detect zombie waves / players' };
    const base = this._apocBox(new THREE.Group(), 10, 0.6, 10, 0, 0.3, 0, mats.concreteDark, false);
    const group = base.parent;
    // Easier: create dedicated group after base helper side effect.
    const g = new THREE.Group();
    this._apocBox(g, 10, 0.6, 10, 0, 0.3, 0, mats.concreteDark, true);
    this._apocBox(g, 2.0, 10, 2.0, 0, 5.3, 0, mats.steel, true);
    const dish = new THREE.Mesh(new THREE.SphereGeometry(3.7, 20, 12, 0, Math.PI), new THREE.MeshPhongMaterial({ color: 0x7f8c8d, flatShading:true }));
    dish.position.set(0,10.7,0); dish.rotation.x = -Math.PI/2.6; dish.castShadow = true; g.add(dish);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,8,8), mats.cyan);
    beam.position.set(0,14.5,0); g.add(beam);
    this._apocLabel(g,'RADAR',0x62e8ff,0,2.0,5.15,5.6,0.72);
    g.position.set(cx,0,cz); this.scene.add(g);
};

Renderer3D._createApocalypseCommsTower = function(cx, cz) {
    const mats = this._apocalypseMaterials();
    this._militaryBuildingFunctions.comms = { name: 'Comms Tower', function: 'Contracts / supply dispatch' };
    const g = new THREE.Group();
    const pts = [[-2,-2],[2,-2],[2,2],[-2,2]];
    pts.forEach(([x,z])=>this._apocBox(g,0.18,18,0.18,x,9,z,mats.steel,true));
    for (let y=3;y<=16;y+=3) {
        this._apocBox(g,4.6,0.12,0.12,0,y,-2,mats.steel,false);
        this._apocBox(g,4.6,0.12,0.12,0,y,2,mats.steel,false);
    }
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.3,8,8), mats.red); beacon.position.set(0,18.4,0); g.add(beacon);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.3,0.06,8,32), mats.cyan); ring.rotation.x=Math.PI/2; ring.position.set(0,13.4,0); g.add(ring);
    this._apocLabel(g,'COMMS',0xffc857,0,2.0,4.9,6.0,0.72);
    g.position.set(cx,0,cz); this.scene.add(g);
};

Renderer3D._createApocalypseGuardTower = function(x,z) {
    const mats = this._apocalypseMaterials();
    const g = new THREE.Group();
    this._apocBox(g,4.2,7.8,4.2,0,3.9,0,mats.concrete,true);
    this._apocBox(g,5.0,0.45,5.0,0,8.0,0,mats.concreteDark,true);
    this._apocBox(g,3.8,1.6,3.8,0,8.85,0,mats.concreteLight,true);
    for (let side of [-1,1]) {
        this._apocSlitWindow(g,side*1.91,8.8,0,0.08,0.7,3.0);
    }
    this._apocStrip(g,0,8.02,0,4.2,0.16,mats.cyan);
    const lamp=new THREE.Mesh(new THREE.SphereGeometry(0.20,8,8),mats.amber);lamp.position.set(0,9.8,0);g.add(lamp);
    g.position.set(x,0,z); this.scene.add(g);
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

Renderer3D._createApocalypseBaseProps = function(cx,cz) {
    const mats=this._apocalypseMaterials();
    // Containers, wrecked barriers, sandbags and pallets make the base feel inhabited.
    for(let i=0;i<14;i++){
        const side=i%2===0?-1:1;
        const x=cx+side*(68+(i%4)*5.5);
        const z=cz-48+Math.floor(i/4)*4.2;
        const crate=new THREE.Mesh(new THREE.BoxGeometry(2.4,1.3,1.8), i%3===0?mats.olive:mats.military);
        crate.position.set(x,0.65,z); crate.rotation.y=(i%5)*0.12; crate.castShadow=true; crate.receiveShadow=true; this.scene.add(crate); this._addCollisionMesh(crate);
    }
    const sand=mats.sand;
    for(const [dx,dz] of [[-78,48],[76,48],[-72,-46],[72,-42],[-24,87],[28,87]]){
        for(let j=-2;j<=2;j++){
            const bag=new THREE.Mesh(new THREE.BoxGeometry(1.9,0.55,0.75),sand);
            bag.position.set(cx+dx+j*1.5,0.28,cz+dz+(j%2)*0.10); bag.rotation.y=j*0.05; bag.castShadow=true; this.scene.add(bag);
        }
    }
    // Flood lights along major roads.
    for(let i=-5;i<=5;i++){
        for(const side of [-1,1]){
            const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.08,0.11,5.8,6),mats.steel);
            pole.position.set(cx+i*18,2.9,cz+side*45); this.scene.add(pole);
            const lamp=new THREE.Mesh(new THREE.BoxGeometry(0.48,0.18,0.7),mats.cyan); lamp.position.set(cx+i*18,5.65,cz+side*45); this.scene.add(lamp);
        }
    }
};

Renderer3D._registerApocalypseMilitaryInteractions = function(cx,cz) {
    this._militaryInteractions = [
        { id:'hq', name:'COMMAND HQ', description:'Nâng cấp căn cứ và mở các máy kiếm tiền.', x:cx, z:cz-9, radius:14 },
        { id:'barracks', name:'BARRACKS', description:'Tuyển lính gác và tăng phòng thủ.', x:cx-55, z:cz-28, radius:12 },
        { id:'mess', name:'MESS HALL', description:'Hồi stamina và nhận buff.', x:cx-38, z:cz+36, radius:10 },
        { id:'medical', name:'MEDICAL', description:'Sử dụng vật tư y tế.', x:cx-38, z:cz+36, radius:10 },
        { id:'supply', name:'SUPPLY DEPOT', description:'Mua ammo và nâng cấp vũ khí.', x:cx+53, z:cz-30, radius:12 },
        { id:'fuel', name:'FUEL FARM', description:'Quản lý nhiên liệu và income.', x:cx+62, z:cz+17, radius:10 },
        { id:'motorPool', name:'MOTOR POOL', description:'Triệu hồi và nâng cấp vehicle.', x:cx+49, z:cz+57, radius:13 },
        { id:'lab', name:'RESEARCH LAB', description:'Nghiên cứu zombie và weapon.', x:cx+3, z:cz-73, radius:13 },
        { id:'workshop', name:'VEHICLE WORKSHOP', description:'Sửa và nâng cấp vehicle.', x:cx-49, z:cz-73, radius:12 },
        { id:'training', name:'TRAINING GROUND', description:'Luyện weapon XP.', x:cx-42, z:cz+70, radius:15 },
        { id:'range', name:'SHOOTING RANGE', description:'Test súng và accuracy.', x:cx+30, z:cz+70, radius:15 },
        { id:'radar', name:'RADAR', description:'Phát hiện zombie wave và boss.', x:cx+86, z:cz-78, radius:10 },
        { id:'comms', name:'COMMS', description:'Nhận supply contracts.', x:cx-84, z:cz-78, radius:10 }
    ];
};

// Keep old gameplay functions but route visuals to the new architecture.
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

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Renderer3D;
}