/**
 * PLAYER-CONTROLLER.JS - Quản lý nhân vật và camera trong 3D
 * Xử lý di chuyển WASD, mouse look, và va chạm
 */

const PlayerController = {
    // Vị trí nhân vật
    position: {
        x: 300,
        y: 0,
        z: 300
    },

    // Chuyển động
    velocity: { x: 0, z: 0 },
    speed: 150, // Pixel/giây

    // Camera
    cameraYaw: 0, // Góc xoay camera xung quanh nhân vật (radian)
    cameraPitch: 0.3, // Góc nhìn lên/xuống

    // Raycasting cho building placement
    mouseX: 0,
    mouseY: 0,

    /**
     * Khởi tạo player controller
     */
    init: function() {
        console.log('🚶 Khởi tạo Player Controller...');

        this.position = { x: 300, y: 0, z: 300 };
        this.velocity = { x: 0, z: 0 };
        this.cameraYaw = 0;
        this.cameraPitch = 0.3;

        // Lắng nghe sự kiện chuột (camera rotation)
        document.addEventListener('mousemove', this.onMouseMove.bind(this));

        console.log('✅ Player Controller khởi tạo xong');
    },

    /**
     * Xử lý di chuyển chuột (camera rotation)
     * @param {MouseEvent} event
     */
    onMouseMove: function(event) {
        // Nếu đang build, không xoay camera
        if (GameState.buildingMode) return;

        const deltaX = event.movementX || 0;
        const deltaY = event.movementY || 0;

        // Xoay camera theo chuột
        this.cameraYaw -= deltaX * 0.005;
        this.cameraPitch -= deltaY * 0.005;

        // Giới hạn pitch (-PI/2 đến PI/2)
        this.cameraPitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.cameraPitch));
    },

    /**
     * Cập nhật trạng thái nhân vật
     * @param {number} deltaTime - Thời gian delta (ms)
     */
    update: function(deltaTime) {
        const deltaSec = deltaTime / 1000;

        // Lấy input từ InputManager
        const moveInput = InputManager.getMovementVector();

        // Tính vector di chuyển theo camera yaw
        const forwardX = Math.cos(this.cameraYaw);
        const forwardZ = Math.sin(this.cameraYaw);
        const rightX = Math.cos(this.cameraYaw + Math.PI / 2);
        const rightZ = Math.sin(this.cameraYaw + Math.PI / 2);

        // Kết hợp input để tạo velocity
        this.velocity.x = (forwardX * moveInput.y + rightX * moveInput.x) * this.speed;
        this.velocity.z = (forwardZ * moveInput.y + rightZ * moveInput.x) * this.speed;

        // Cập nhật vị trí
        this.position.x += this.velocity.x * deltaSec;
        this.position.z += this.velocity.z * deltaSec;

        // Giới hạn vị trí trong bản đồ
        const mapSize = 500;
        this.position.x = Math.max(0, Math.min(mapSize, this.position.x));
        this.position.z = Math.max(0, Math.min(mapSize, this.position.z));

        // Cập nhật camera
        Renderer3D.updateCameraToPlayer(this.position.x, this.position.z);
    },

    /**
     * Lấy vector hướng nhìn của camera
     * @returns {{x: number, z: number}}
     */
    getForwardDirection: function() {
        return {
            x: Math.cos(this.cameraYaw),
            z: Math.sin(this.cameraYaw)
        };
    },

    /**
     * Lấy raycaster từ vị trí chuột hiện tại
     * @returns {THREE.Raycaster}
     */
    getRaycaster: function() {
        return Renderer3D.getRaycaster(this.mouseX, this.mouseY);
    },

    /**
     * Lấy vị trí build (ground intersection)
     * @returns {THREE.Vector3|null}
     */
    getBuildPosition: function() {
        const raycaster = this.getRaycaster();
        return Renderer3D.getGroundIntersection(raycaster);
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = PlayerController;
}
