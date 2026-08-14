/**
 * WALL-3D.JS - Tường rào trong 3D
 */

class Wall3D {
    /**
     * Khởi tạo tường 3D
     * @param {number} x - Tọa độ X
     * @param {number} z - Tọa độ Z
     */
    constructor(x, z) {
        this.x = x;
        this.z = z;

        // Logic
        this.hp = CONFIG.WALL_MAX_HP;
        this.maxHp = CONFIG.WALL_MAX_HP;
        this.damageFlashTime = 0;

        // 3D object
        this.mesh3D = Renderer3D.create3DWall(x, z);

        console.log('🧱 Tường rào 3D được tạo');
    }

    /**
     * Tường nhận sát thương
     * @param {number} damage
     */
    takeDamage(damage) {
        this.hp -= damage;
        this.damageFlashTime = 0.2;

        if (this.hp <= 0) {
            console.log('💥 Tường rào bị phá hủy');
            this.dispose();
        } else {
            // Flash hiệu ứng
            this.mesh3D.material.color.setHex(0xff0000);
        }
    }

    /**
     * Cập nhật
     * @param {number} deltaTime
     */
    update(deltaTime) {
        if (this.damageFlashTime > 0) {
            this.damageFlashTime -= deltaTime / 1000;
            
            if (this.damageFlashTime <= 0) {
                // Khôi phục màu
                this.mesh3D.material.color.setHex(0x00cc00);
            }
        }
    }

    /**
     * Kiểm tra bị tiêu diệt
     */
    isDestroyed() {
        return this.hp <= 0;
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
    module.exports = Wall3D;
}
