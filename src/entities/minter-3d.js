/**
 * MINTER-3D.JS - Máy in tiền trong 3D
 */

class Minter3D {
    /**
     * Khởi tạo máy in tiền 3D
     * @param {number} x
     * @param {number} z
     */
    constructor(x, z) {
        this.x = x;
        this.z = z;

        this.cycleProgress = 0;
        this.cycleTime = CONFIG.MINTER_CYCLE_TIME;
        this.rotation = 0;

        this.mesh3D = Renderer3D.create3DMinter(x, z);

        console.log('💵 Máy in tiền 3D được tạo');
    }

    /**
     * Cập nhật
     * @param {number} deltaTime
     */
    update(deltaTime) {
        this.cycleProgress += deltaTime / this.cycleTime;
        this.rotation += deltaTime / 20;

        if (this.rotation > Math.PI * 2) {
            this.rotation -= Math.PI * 2;
        }

        // Xoay bánh xe
        if (this.mesh3D.wheel) {
            this.mesh3D.wheel.rotation.y = this.rotation;
        }
    }

    /**
     * Xóa mesh
     */
    dispose() {
        if (this.mesh3D && this.mesh3D.parent) {
            Renderer3D.scene.remove(this.mesh3D);
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Minter3D;
}
