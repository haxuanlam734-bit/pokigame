/**
 * TOWER-3D.JS - Tháp pháo trong 3D
 * Kế thừa logic từ Tower, nhưng render bằng Three.js
 */

class Tower3D {
    /**
     * Khởi tạo tháp 3D
     * @param {number} x - Tọa độ X
     * @param {number} z - Tọa độ Z
     */
    constructor(x, z) {
        this.x = x;
        this.z = z;

        // Logic từ Tower cũ
        this.angle = 0;
        this.targetAngle = 0;
        this.lastShotTime = 0;
        this.fireRate = CONFIG.TOWER_FIRE_RATE;

        // 3D object
        this.mesh3D = Renderer3D.create3DTower(x, z);

        console.log('🔫 Tháp pháo 3D được tạo');
    }

    /**
     * Tìm zombie gần nhất trong tầm
     * @param {Array} zombies - Danh sách zombie
     * @returns {Zombie3D|null}
     */
    findNearestZombie(zombies) {
        let nearest = null;
        let minDistance = CONFIG.TOWER_RANGE;

        for (const zombie of zombies) {
            const dist = Math.hypot(
                (this.x - zombie.x),
                (this.z - zombie.z)
            );

            if (dist < minDistance) {
                minDistance = dist;
                nearest = zombie;
            }
        }

        return nearest;
    }

    /**
     * Cập nhật tháp (xoay và bắn)
     * @param {number} deltaTime - Thời gian delta
     * @param {Array} zombies - Danh sách zombie
     * @param {Array} bullets - Danh sách đạn
     */
    update(deltaTime, zombies, bullets) {
        if (zombies.length === 0) return;

        const target = this.findNearestZombie(zombies);

        if (target) {
            // Tính góc tới mục tiêu
            this.targetAngle = Math.atan2(target.z - this.z, target.x - this.x);

            // Làm trơn xoay
            let diff = this.targetAngle - this.angle;
            while (diff > Math.PI) diff -= 2 * Math.PI;
            while (diff < -Math.PI) diff += 2 * Math.PI;
            this.angle += Math.max(-CONFIG.TOWER_ROTATION_SPEED, Math.min(CONFIG.TOWER_ROTATION_SPEED, diff));

            // Xoay mesh 3D
            if (this.mesh3D.cone) {
                this.mesh3D.cone.rotation.y = this.angle;
            }

            // Bắn
            const now = Date.now();
            if (now - this.lastShotTime >= this.fireRate) {
                this.shoot(bullets, target);
                this.lastShotTime = now;
            }
        }
    }

    /**
     * Bắn laser/đạn vào mục tiêu
     * @param {Array} bullets - Danh sách đạn
     * @param {Zombie3D} target - Mục tiêu
     */
    shoot(bullets, target) {
        const bullet = {
            x: this.x,
            z: this.z,
            targetX: target.x,
            targetZ: target.z,
            speed: CONFIG.BULLET_SPEED,
            damage: CONFIG.TOWER_DAMAGE,
            traveled: 0,
            maxDistance: CONFIG.TOWER_RANGE * 1.5,

            update: function(deltaTime) {
                const deltaSec = deltaTime / 1000;
                const dist = Math.hypot(this.targetX - this.x, this.targetZ - this.z);
                
                if (dist > 0.1) {
                    const vx = (this.targetX - this.x) / dist * this.speed;
                    const vz = (this.targetZ - this.z) / dist * this.speed;
                    
                    this.x += vx * deltaSec;
                    this.z += vz * deltaSec;
                    this.traveled += this.speed * deltaSec;
                }
            }
        };

        bullets.push(bullet);
    }

    /**
     * Xóa mesh 3D
     */
    dispose() {
        if (this.mesh3D && this.mesh3D.parent) {
            Renderer3D.scene.remove(this.mesh3D);
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Tower3D;
}
