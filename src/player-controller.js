/**
 * PLAYER-CONTROLLER.JS - Quản lý nhân vật và camera trong 3D
 * Di chuyển WASD theo đúng chuẩn Three.js Vector:
 *  - forward = camera.getWorldDirection(), flat on XZ plane
 *  - right = forward cross DefaultUp (cross product)
 *  - W = +forward, S = -forward, D = +right, A = -right
 *  - rotation.y = atan2(move.x, move.z)
 */

const PlayerController = {
    position: {
        x: 250,
        y: 0,
        z: 280
    },

    velocity: { x: 0, z: 0 },
    targetVelocity: { x: 0, z: 0 },
    speed: 6,
    normalSpeed: 6,
    sprintMultiplier: 1.65,
    sprintDrainPerSecond: 22,
    isSprinting: false,
    isCrouching: false,

    // Kích thước collision của nhân vật trên mặt phẳng XZ.
    playerRadius: 0.42,
    playerHeight: 1.8,
    collisionPadding: 0.06,

    movementSmoothness: 8.0,
    playerRotationSmoothness: 10.0,

    currentMoveAngle: 0,
    targetMoveAngle: 0,
    hasMovementInput: false,

    // --- Camera Zoom (lăn chuột) ---
    minZoomDistance: 0.1,
    maxZoomDistance: 40,
    currentZoomDistance: 15,

    // --- Tự động chuyển Góc Nhìn Thứ 1 (First-Person) khi zoom sát nhân vật ---
    // Khi currentZoomDistance <= firstPersonThreshold, camera "nhảy" vào bên trong
    // đầu nhân vật (tầm mắt) thay vì tiếp tục quỹ đạo camera thứ 3.
    firstPersonThreshold: 0.8, // mét
    eyeHeight: 1.5,            // độ cao mắt nhân vật so với mặt đất (m)

    // --- Auto Pointer Lock theo ngưỡng zoom (FPS Mode) ---
    isFirstPersonMode: false,        // true khi currentZoomDistance <= firstPersonThreshold
    _pointerWasLocked: false,        // trạng thái isPointerLocked của frame trước (để dò cạnh)
    _pointerLockReleasedByUser: false, // true khi người chơi tự thoát khóa (Esc) trong lúc vẫn cần khóa

    // --- Nhảy & Trọng lực ---
    velocityY: 0,
    gravity: 25,
    jumpForce: 10,
    isGrounded: true,

    // ==========================================
    // --- VU KHI (su dung WeaponSystem moi) ---
    // ==========================================
    // Weapon switching duoc xu ly boi WeaponSystem.equip()
    // Cac bien cu (weapons, currentWeaponKey, isReloading...) da duoc thay the
    // boi WeaponSystem._state[] va WeaponSystem.currentId

    _forwardVec: null,
    _rightVec: null,
    _moveVec: null,
    _camDir: null,

    init: function() {
        console.log('🚶 Khởi tạo Player Controller...');

        // Spawn ở khoảng sân trước HQ (cách xa mặt tường của model nhà chính
        // GLB ~15-20 units) để tránh player/camera bị kẹt bên trong khối nhà.
        this.position = { x: 250, y: 0, z: 280 };
        this.velocity = { x: 0, z: 0 };
        this.targetVelocity = { x: 0, z: 0 };
        this.currentMoveAngle = 0;
        this.targetMoveAngle = 0;
        this.hasMovementInput = false;

        this.velocityY = 0;
        this.isGrounded = true;
        this.position.y = 0;

        this._forwardVec = new THREE.Vector3();
        this._rightVec = new THREE.Vector3();
        this._moveVec = new THREE.Vector3();
        this._camDir = new THREE.Vector3();

        // Khởi tạo zoom camera + lắng nghe sự kiện lăn chuột
        this.currentZoomDistance = (Renderer3D && Renderer3D.cameraDistance) || 15;
        this.handleMouseWheel = this.handleMouseWheel.bind(this);
        window.addEventListener('wheel', this.handleMouseWheel, { passive: true });

        this.isFirstPersonMode = this.currentZoomDistance <= this.firstPersonThreshold;
        this._pointerWasLocked = false;
        this._pointerLockReleasedByUser = false;

        // Click lại vào màn hình để khóa chuột lại nếu đang ở FPS Mode nhưng
        // con trỏ đã bị nhả ra (ví dụ người chơi nhấn Esc)
        this._onScreenClick = this._onScreenClick.bind(this);
        document.addEventListener('click', this._onScreenClick);

        // --- LANG NGHE PHIM CHUYEN VU KHI VA NAP DAN ---
        // 1 = Sword (kiem), 2 = Pistol, 3 = AK/M4
        this._onWeaponKeyDown = function(e) {
            if (e.key === '1' && typeof WeaponSystem !== 'undefined') WeaponSystem.equip('sword');
            if (e.key === '2' && typeof WeaponSystem !== 'undefined') WeaponSystem.equip('pistol');
            if (e.key === '3' && typeof WeaponSystem !== 'undefined') WeaponSystem.equip('ak');
            // R duoc WeaponSystem xu ly trong update()
        };
        window.addEventListener('keydown', this._onWeaponKeyDown);

        console.log('Player Controller khoi tao xong');
    },

    /**
     * Click bất kỳ đâu trên màn hình: nếu đang ở FPS Mode mà con trỏ chưa
     * (hoặc không còn) bị khóa, chủ động khóa lại (đáp ứng yêu cầu re-lock
     * sau khi người chơi nhấn Esc thoát Pointer Lock).
     */
    _onScreenClick: function() {
        if (this.isFirstPersonMode && !InputManager.isPointerLocked) {
            this._pointerLockReleasedByUser = false;
            if (document.body.requestPointerLock) {
                document.body.requestPointerLock();
            }
        }
    },

    /**
     * Đồng bộ Pointer Lock theo ngưỡng zoom mỗi frame:
     *  - FPS Mode (currentZoomDistance <= firstPersonThreshold) -> luôn cần khóa chuột,
     *    kể cả khi KHÔNG giữ chuột phải, để movementX/Y xoay camera trực tiếp.
     *  - Third-Person -> chỉ cần khóa khi đang giữ chuột phải (orbit); nếu không,
     *    tự động mở khóa để hiện lại con trỏ.
     *  - Nếu người chơi tự thoát khóa bằng Esc trong lúc vẫn cần khóa, KHÔNG tự
     *    động lock lại ngay (tránh trình duyệt chặn do gọi liên tục mỗi frame) —
     *    việc lock lại chờ một cú click từ người chơi (_onScreenClick).
     */
    _syncPointerLockWithZoom: function() {
        const isFPSMode = this.currentZoomDistance <= this.firstPersonThreshold;
        const wantLock = isFPSMode || InputManager.isRightMouseDown;
        const isLocked = InputManager.isPointerLocked;

        // Phát hiện cạnh: đang khóa -> mất khóa trong khi vẫn cần khóa => người
        // chơi vừa nhấn Esc, đánh dấu để không spam requestPointerLock() nữa.
        if (this._pointerWasLocked && !isLocked && wantLock) {
            this._pointerLockReleasedByUser = true;
        }

        if (wantLock && !isLocked && !this._pointerLockReleasedByUser) {
            if (document.body.requestPointerLock) {
                document.body.requestPointerLock();
            }
        } else if (!wantLock && isLocked) {
            if (document.exitPointerLock) {
                document.exitPointerLock();
            }
        }

        // Rời hẳn FPS Mode -> reset cờ để lần zoom sát tiếp theo tự khóa lại bình thường
        if (!isFPSMode) {
            this._pointerLockReleasedByUser = false;
        }

        this._pointerWasLocked = isLocked;
        this.isFirstPersonMode = isFPSMode;
    },

    /**
     * Xử lý sự kiện lăn chuột để zoom camera vào/ra khỏi nhân vật
     */
    handleMouseWheel: function(event) {
        this.currentZoomDistance += event.deltaY * 0.02;

        // Clamp trong khoảng [minZoomDistance, maxZoomDistance]
        this.currentZoomDistance = Math.max(
            this.minZoomDistance,
            Math.min(this.maxZoomDistance, this.currentZoomDistance)
        );
    },

    /**
     * Tỷ lệ zoom hiện tại, chuẩn hóa về [0.0, 1.0]
     * 0.0 = đang zoom gần nhất (minZoomDistance)
     * 1.0 = đang zoom xa nhất (maxZoomDistance)
     */
    getZoomRatio: function() {
        const range = this.maxZoomDistance - this.minZoomDistance;
        if (range <= 0) return 1;
        const t = (this.currentZoomDistance - this.minZoomDistance) / range;
        return Math.max(0, Math.min(1, t));
    },

    // ==========================================
    // --- DA CHUYEN SANG WEAPONSYSTEM ---
    // Ham nay giu lai de khong break dependency cu nhung logic da chuyen sang WeaponSystem
    // ==========================================
    switchWeapon: function(weaponId) {
        if (typeof WeaponSystem !== 'undefined') {
            WeaponSystem.equip(weaponId);
        }
    },

    reloadWeapon: function() {
        if (typeof WeaponSystem !== 'undefined') {
            WeaponSystem.tryReload();
        }
    },

    shootWeapon: function() {
        // Legacy stub - WeaponSystem xu ly viec ban
        // Giu lai de khong break code nao dang goi ham nay
    },

    update: function(deltaTime) {
        const deltaSec = deltaTime / 1000;

        // Lam muot (lerp) goc xoay camera truoc khi dung - quan tinh Roblox-style
        // NOTE: InputManager.update() reset isMouseJustPressed/Released,
        // nen WeaponSystem.update() PHAI duoc goi TRUOC InputManager.update().
        if (typeof WeaponSystem !== 'undefined') {
            WeaponSystem.update(deltaSec);
        }
        if (typeof WeaponRenderer !== 'undefined' && WeaponRenderer._weaponHolder) {
            WeaponRenderer.update(deltaSec);
        }

        // Sau khi WeaponSystem doc xong mouse state, reset just-pressed flags
        InputManager.update();

        const moveInput = InputManager.getMovementVector();
        const inputW = moveInput.y < -0.01;
        const inputS = moveInput.y > 0.01;
        const inputA = moveInput.x < -0.01;
        const inputD = moveInput.x > 0.01;

        this._computeForwardRight();
        this._moveVec.set(0, 0, 0);
        if (inputW) this._moveVec.add(this._forwardVec);
        if (inputS) this._moveVec.sub(this._forwardVec);
        if (inputD) this._moveVec.add(this._rightVec);
        if (inputA) this._moveVec.sub(this._rightVec);

        this.hasMovementInput = this._moveVec.lengthSq() > 0.0001;

        // --- Cúi người (Crouch - phím C) ---
        this.isCrouching = InputManager.isKeyPressed('c');

        const wantsSprint = this.hasMovementInput && InputManager.isKeyPressed('shift') && !this.isCrouching;
        const canSprint = typeof GameState !== 'undefined' && GameState.stamina > 0;
        this.isSprinting = wantsSprint && canSprint;

        if (this.isCrouching) {
            this.speed = this.normalSpeed * 0.55;
        } else if (this.isSprinting) {
            this.speed = this.normalSpeed * this.sprintMultiplier;
        } else {
            this.speed = this.normalSpeed;
        }

        if (this.isSprinting && typeof GameState !== 'undefined') {
            GameState.stamina = Math.max(0, GameState.stamina - this.sprintDrainPerSecond * deltaSec);
            if (GameState.stamina <= 0) this.isSprinting = false;
        }

        if (this.hasMovementInput) {
            this._moveVec.normalize();

            this.targetVelocity.x = this._moveVec.x * this.speed;
            this.targetVelocity.z = this._moveVec.z * this.speed;

            this.targetMoveAngle = Math.atan2(this._moveVec.x, this._moveVec.z);
        } else {
            this.targetVelocity.x = 0;
            this.targetVelocity.z = 0;
        }

        const smoothFactor = 1 - Math.exp(-this.movementSmoothness * deltaSec);
        this.velocity.x += (this.targetVelocity.x - this.velocity.x) * smoothFactor;
        this.velocity.z += (this.targetVelocity.z - this.velocity.z) * smoothFactor;

        // Di chuyển có collision. Tách X/Z thành hai bước để nhân vật có thể
        // trượt dọc theo tường thay vì bị kẹt khi chạy chéo vào góc.
        const dx = this.velocity.x * deltaSec;
        const dz = this.velocity.z * deltaSec;
        this._moveWithCollision(dx, dz);

        const mapSize = 500;
        this.position.x = Math.max(0, Math.min(mapSize, this.position.x));
        this.position.z = Math.max(0, Math.min(mapSize, this.position.z));

        const floorY = (typeof Renderer3D !== 'undefined' && Renderer3D.getPlayerFloorHeight)
            ? Renderer3D.getPlayerFloorHeight(this.position.x, this.position.z) : 0;

        // --- Nhảy (Jump) ---
        if (InputManager.isKeyPressed('space') && this.isGrounded) {
            this.velocityY = this.jumpForce;
            this.isGrounded = false;
        }

        // --- Trọng lực (Gravity) ---
        if (!this.isGrounded) {
            this.velocityY -= this.gravity * deltaSec;
            this.position.y += this.velocityY * deltaSec;

            if (this.position.y <= floorY) {
                this.position.y = floorY;
                this.velocityY = 0;
                this.isGrounded = true;
            }
        } else {
            // Snapping theo sàn/ramp của HQ giúp có thể thực sự leo các cầu thang.
            this.position.y = floorY;
        }

        if (this.hasMovementInput) {
            let angleDiff = this.targetMoveAngle - this.currentMoveAngle;
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            const rotSmooth = 1 - Math.exp(-this.playerRotationSmoothness * deltaSec);
            this.currentMoveAngle += angleDiff * rotSmooth;
        }

        // Áp dụng khoảng cách zoom hiện tại cho camera trước khi cập nhật vị trí.
        // Zoom (currentZoomDistance) CHỈ thay đổi khoảng cách camera-nhân vật,
        // hoàn toàn độc lập với pitch/yaw — không còn bất kỳ logic nào ở đây
        // khóa hay bóp góc xoay theo mức zoom nữa.
        Renderer3D.cameraDistance = this.currentZoomDistance;
        Renderer3D.firstPersonThreshold = this.firstPersonThreshold;
        Renderer3D.eyeHeight = this.eyeHeight;

        // Tự động khóa/mở khóa con trỏ chuột theo ngưỡng zoom (FPS Mode)
        this._syncPointerLockWithZoom();

        Renderer3D.updateCameraToPlayer(
            this.position.x,
            this.position.z,
            InputManager.cameraYaw,
            InputManager.cameraPitch,
            this.position.y
        );

        Renderer3D.updatePlayerMesh(
            this.position.x,
            this.position.z,
            this.currentMoveAngle,
            this.hasMovementInput,
            this.position.y,
            this.isCrouching,
            {
                isSprinting: this.isSprinting && this.hasMovementInput,
                isGrounded: this.isGrounded,
                isCrouching: this.isCrouching,
                isAttacking: (typeof WeaponSystem !== 'undefined' && WeaponSystem._meleeAttacking) || (typeof WeaponRenderer !== 'undefined' && WeaponRenderer._swingAnim),
                currentWeapon: typeof WeaponSystem !== 'undefined' ? WeaponSystem.currentId : 'pistol',
                aimPitch: InputManager ? InputManager.cameraPitch : 0
            }
        );
    },

    /**
     * Di chuyển player với collision đơn giản theo AABB của các mesh
     * được Renderer3D đăng ký. Chỉ lấy các vật thể đủ cao để làm
     * chướng ngại vật; sàn/base mỏng sẽ không chặn player.
     */
    _moveWithCollision: function(dx, dz) {
        const renderer = (typeof Renderer3D !== 'undefined') ? Renderer3D : null;
        const meshes = renderer && Array.isArray(renderer._collisionMeshes)
            ? renderer._collisionMeshes
            : [];

        const tryMove = (moveX, moveZ) => {
            if (Math.abs(moveX) < 0.000001 && Math.abs(moveZ) < 0.000001) return;

            const nextX = this.position.x + moveX;
            const nextZ = this.position.z + moveZ;

            if (!this._playerCollidesAt(nextX, nextZ, meshes)) {
                this.position.x = nextX;
                this.position.z = nextZ;
            }
        };

        // Ưu tiên trục chính để cho cảm giác trượt mượt dọc theo vật thể.
        tryMove(dx, 0);
        tryMove(0, dz);
    },

    _playerCollidesAt: function(x, z, meshes) {
        const radius = this.playerRadius + this.collisionPadding;
        const feetY = this.position.y;
        const headY = feetY + this.playerHeight;

        for (let i = 0; i < meshes.length; i++) {
            const mesh = meshes[i];
            if (!mesh || !mesh.isMesh || !mesh.visible) continue;

            // Tính bounding box theo world transform để bắt cả mesh đã rotate.
            const box = new THREE.Box3().setFromObject(mesh);
            if (box.isEmpty()) continue;

            // Bỏ qua mặt sàn / nền mỏng.
            if (box.max.y - box.min.y < 0.65) continue;

            // Không va chạm với vật thể nằm hoàn toàn trên đầu hoặc dưới chân.
            if (box.max.y <= feetY + 0.05 || box.min.y >= headY + 0.05) continue;

            const closestX = Math.max(box.min.x, Math.min(x, box.max.x));
            const closestZ = Math.max(box.min.z, Math.min(z, box.max.z));
            const diffX = x - closestX;
            const diffZ = z - closestZ;

            if ((diffX * diffX + diffZ * diffZ) < radius * radius) {
                return true;
            }
        }

        return false;
    },

    _computeForwardRight: function() {
        if (!Renderer3D || !Renderer3D.camera) {
            const yaw = InputManager.cameraYaw;
            this._forwardVec.set(Math.sin(yaw), 0, Math.cos(yaw));
            this._rightVec.crossVectors(this._forwardVec, THREE.Object3D.DefaultUp).normalize();
            return;
        }

        Renderer3D.camera.getWorldDirection(this._camDir);
        this._forwardVec.copy(this._camDir);
        this._forwardVec.y = 0;
        this._forwardVec.normalize();

        this._rightVec.crossVectors(this._forwardVec, THREE.Object3D.DefaultUp).normalize();
    },

    getForwardDirection: function() {
        this._computeForwardRight();
        return {
            x: this._forwardVec.x,
            z: this._forwardVec.z
        };
    },

    getRaycaster: function() {
        return Renderer3D.getRaycaster(InputManager.mouseX, InputManager.mouseY);
    },

    getBuildPosition: function() {
        const raycaster = this.getRaycaster();
        return Renderer3D.getGroundIntersection(raycaster);
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = PlayerController;
}