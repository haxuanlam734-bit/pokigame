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
        z: 250
    },

    velocity: { x: 0, z: 0 },
    targetVelocity: { x: 0, z: 0 },
    speed: 6,

    movementSmoothness: 8.0,
    playerRotationSmoothness: 10.0,

    currentMoveAngle: 0,
    targetMoveAngle: 0,
    hasMovementInput: false,

    _forwardVec: null,
    _rightVec: null,
    _moveVec: null,
    _camDir: null,

    init: function() {
        console.log('🚶 Khởi tạo Player Controller...');

        this.position = { x: 250, y: 0, z: 250 };
        this.velocity = { x: 0, z: 0 };
        this.targetVelocity = { x: 0, z: 0 };
        this.currentMoveAngle = 0;
        this.targetMoveAngle = 0;
        this.hasMovementInput = false;

        this._forwardVec = new THREE.Vector3();
        this._rightVec = new THREE.Vector3();
        this._moveVec = new THREE.Vector3();
        this._camDir = new THREE.Vector3();

        console.log('✅ Player Controller khởi tạo xong');
    },

    update: function(deltaTime) {
        const deltaSec = deltaTime / 1000;

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
