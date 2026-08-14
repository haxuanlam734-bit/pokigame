/**
 * PLAYER-CONTROLLER.JS - Quản lý nhân vật và camera trong 3D
 * Xử lý di chuyển WASD theo hướng camera, orbit camera, va chạm
 */

const PlayerController = {
    position: {
        x: 300,
        y: 0,
        z: 300
    },

    velocity: { x: 0, z: 0 },
    targetVelocity: { x: 0, z: 0 },
    speed: 150,

    movementSmoothness: 8.0,
    playerRotationSmoothness: 10.0,

    currentMoveAngle: 0,
    targetMoveAngle: 0,
    hasMovementInput: false,

    mouseX: 0,
    mouseY: 0,

    init: function() {
        console.log('🚶 Khởi tạo Player Controller...');

        this.position = { x: 300, y: 0, z: 300 };
        this.velocity = { x: 0, z: 0 };
        this.targetVelocity = { x: 0, z: 0 };
        this.currentMoveAngle = 0;
        this.targetMoveAngle = 0;
        this.hasMovementInput = false;

        console.log('✅ Player Controller khởi tạo xong');
    },

    update: function(deltaTime) {
        const deltaSec = deltaTime / 1000;

        const moveInput = InputManager.getMovementVector();

        const yaw = InputManager.cameraYaw;
        const forwardX = -Math.sin(yaw);
        const forwardZ = -Math.cos(yaw);
        const rightX = Math.cos(yaw);
        const rightZ = -Math.sin(yaw);

        const rawMoveX = forwardX * (-moveInput.y) + rightX * moveInput.x;
        const rawMoveZ = forwardZ * (-moveInput.y) + rightZ * moveInput.x;

        const inputMag = Math.sqrt(moveInput.x * moveInput.x + moveInput.y * moveInput.y);
        this.hasMovementInput = inputMag > 0.01;

        if (this.hasMovementInput) {
            const moveMag = Math.sqrt(rawMoveX * rawMoveX + rawMoveZ * rawMoveZ);
            if (moveMag > 0.0001) {
                const normX = rawMoveX / moveMag;
                const normZ = rawMoveZ / moveMag;
                this.targetVelocity.x = normX * this.speed;
                this.targetVelocity.z = normZ * this.speed;

                this.targetMoveAngle = Math.atan2(normX, normZ);
            }
        } else {
            this.targetVelocity.x = 0;
            this.targetVelocity.z = 0;
        }

        const smoothFactor = 1 - Math.exp(-this.movementSmoothness * deltaSec);
        this.velocity.x += (this.targetVelocity.x - this.velocity.x) * smoothFactor;
        this.velocity.z += (this.targetVelocity.z - this.velocity.z) * smoothFactor;

        this.position.x += this.velocity.x * deltaSec;
        this.position.z += this.velocity.z * deltaSec;

        const mapSize = 500;
        this.position.x = Math.max(0, Math.min(mapSize, this.position.x));
        this.position.z = Math.max(0, Math.min(mapSize, this.position.z));

        if (this.hasMovementInput) {
            let angleDiff = this.targetMoveAngle - this.currentMoveAngle;
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            const rotSmooth = 1 - Math.exp(-this.playerRotationSmoothness * deltaSec);
            this.currentMoveAngle += angleDiff * rotSmooth;
        }

        Renderer3D.updateCameraToPlayer(
            this.position.x,
            this.position.z,
            InputManager.cameraYaw,
            InputManager.cameraPitch
        );

        Renderer3D.updatePlayerMesh(
            this.position.x,
            this.position.z,
            this.currentMoveAngle,
            this.hasMovementInput
        );
    },

    getForwardDirection: function() {
        const yaw = InputManager.cameraYaw;
        return {
            x: -Math.sin(yaw),
            z: -Math.cos(yaw)
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
