/**
 * ZOMBIE-3D.JS - Zombie trong 3D
 * Chạy về phía pháo đài
 */

class Zombie3D {
    /**
     * Khởi tạo zombie 3D
     * @param {number} x
     * @param {number} z
     * @param {number} speed
     * @param {number} hp
     */
    constructor(x, z, speed = CONFIG.ZOMBIE_SPEED, hp = CONFIG.ZOMBIE_MAX_HP) {
        this.x = x;
        this.z = z;
        this.width = CONFIG.ZOMBIE_WIDTH;
        this.height = CONFIG.ZOMBIE_HEIGHT;

        // Chuyển động
        this.speed = speed;
        this.targetX = CONFIG.FORTRESS_X;
        this.targetZ = CONFIG.FORTRESS_Y;
        this.vx = 0;
        this.vz = 0;

        // Máu
        this.hp = hp;
        this.maxHp = hp;
        this.damage = 10;

        // Hiệu ứng
        this.damageFlashTime = 0;
        this.animationFrame = 0;

        // 3D object
        this.mesh3D = Renderer3D.create3DZombie(x, z);

        console.log('🧟 Zombie 3D được tạo tại x=' + x + ', z=' + z);
    }

    /**
     * Zombie nhận sát thương
     * @param {number} damage
     */
    takeDamage(damage) {
        this.hp -= damage;
        this.damageFlashTime = 0.1;

        if (this.mesh3D && this.mesh3D.body) {
            this.mesh3D.body.material.color.setHex(0xffff00);
        }

        if (this.hp <= 0) {
            console.log('💀 Zombie bị tiêu diệt');
            this.dispose();
        }
    }

    /**
     * Cập nhật zombie (chuyển động)
     * @param {number} deltaTime
     */
    update(deltaTime) {
        const deltaSec = deltaTime / 1000;

        // Tính hướng đến pháo đài
        const dx = CONFIG.FORTRESS_X - this.x;
        const dz = CONFIG.FORTRESS_Y - this.z;
        const dist = Math.hypot(dx, dz);

        let moveX = 0, moveZ = 0;

        if (dist > 1) {
            moveX = (dx / dist) * this.speed;
            moveZ = (dz / dist) * this.speed;
        }

        // --- Steering behavior: tránh tường ---
        let avoidanceX = 0, avoidanceZ = 0;
        
        if (GameState && GameState.walls && GameState.walls.length > 0) {
            const avoidanceRadius = 3.5; // Khoảng cách phát hiện tường
            
            for (let wall of GameState.walls) {
                if (wall.isDestroyed()) continue;
                
                const wallDx = wall.x - this.x;
                const wallDz = wall.z - this.z;
                const wallDist = Math.hypot(wallDx, wallDz);
                
                if (wallDist < avoidanceRadius && wallDist > 0.1) {
                    // Tương tác tránh: đẩy zombie ra xa khỏi tường
                    const pushForce = 1.0 - (wallDist / avoidanceRadius); // 0-1
                    const pushX = -(wallDx / wallDist) * pushForce;
                    const pushZ = -(wallDz / wallDist) * pushForce;
                    
                    avoidanceX += pushX;
                    avoidanceZ += pushZ;
                }
            }
        }

        // Kết hợp chuyển động mục tiêu với tránh tường
        const blendFactor = 0.7; // Ưu tiên di chuyển tới pháo đài (70%) hơn tránh tường (30%)
        this.vx = moveX * blendFactor + avoidanceX * (1 - blendFactor);
        this.vz = moveZ * blendFactor + avoidanceZ * (1 - blendFactor);

        // Di chuyển
        this.x += this.vx * deltaSec;
        this.z += this.vz * deltaSec;

        // Cập nhật vị trí mesh 3D
        if (this.mesh3D) {
            this.mesh3D.position.x = this.x;
            this.mesh3D.position.z = this.z;
        }

        // Animation
        this.animationFrame += deltaTime / 100;
        if (this.animationFrame > 4) {
            this.animationFrame = 0;
        }

        // Giảm flash time
        if (this.damageFlashTime > 0) {
            this.damageFlashTime -= deltaSec;
            
            if (this.damageFlashTime <= 0) {
                // Khôi phục màu
                if (this.mesh3D && this.mesh3D.body) {
                    this.mesh3D.body.material.color.setHex(0xff3333);
                }
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
     * Kiểm tra xem zombie đã đến pháo đài chưa
     */
    reachedFortress() {
        const fortressPos = { x: CONFIG.FORTRESS_X, z: CONFIG.FORTRESS_Y };
        const dist = Math.hypot(this.x - fortressPos.x, this.z - fortressPos.z);
        return dist < 8;
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
    module.exports = Zombie3D;
}
