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

        // AI: mục tiêu hiện tại
        this.chasingPlayer = false;
        this.lastPlayerAttackTime = 0;

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

        // ============ AI CHỌN MỤC TIÊU ============
        let tx = CONFIG.FORTRESS_X;
        let tz = CONFIG.FORTRESS_Y;
        let targetPriority = 0;
        this.chasingPlayer = false;

        if (typeof PlayerController !== 'undefined' && PlayerController.position) {
            const px = PlayerController.position.x;
            const pz = PlayerController.position.z;
            const distToPlayer = Math.hypot(px - this.x, pz - this.z);
            const chaseR = CONFIG.ZOMBIE_PLAYER_CHASE_RADIUS || 120;
            if (distToPlayer <= chaseR) {
                tx = px;
                tz = pz;
                this.chasingPlayer = true;
                targetPriority = 1;
            }
        }

        // Tính hướng đến mục tiêu
        const dx = tx - this.x;
        const dz = tz - this.z;
        const dist = Math.hypot(dx, dz);

        let moveX = 0, moveZ = 0;
        if (dist > 1) {
            moveX = (dx / dist) * this.speed;
            moveZ = (dz / dist) * this.speed;
        }

        // ============ Tấn công người chơi nếu đủ gần ============
        if (this.chasingPlayer) {
            const attackR = CONFIG.ZOMBIE_PLAYER_ATTACK_RADIUS || 1.6;
            const distP = Math.hypot((PlayerController.position.x - this.x), (PlayerController.position.z - this.z));
            if (distP <= attackR) {
                const now = Date.now();
                if (now - this.lastPlayerAttackTime >= 1000) {
                    this.lastPlayerAttackTime = now;
                    if (typeof GameState !== 'undefined') {
                        GameState.damagePlayerFromZombie(CONFIG.ZOMBIE_PLAYER_DAMAGE || 12);
                    }
                }
            }
        }

        // --- Steering behavior: tránh tường ---
        let avoidanceX = 0, avoidanceZ = 0;
        if (GameState && GameState.walls && GameState.walls.length > 0) {
            const avoidanceRadius = 3.5;
            for (let wall of GameState.walls) {
                if (wall.isDestroyed()) continue;
                const wallDx = wall.x - this.x;
                const wallDz = wall.z - this.z;
                const wallDist = Math.hypot(wallDx, wallDz);
                if (wallDist < avoidanceRadius && wallDist > 0.1) {
                    const pushForce = 1.0 - (wallDist / avoidanceRadius);
                    const pushX = -(wallDx / wallDist) * pushForce;
                    const pushZ = -(wallDz / wallDist) * pushForce;
                    avoidanceX += pushX;
                    avoidanceZ += pushZ;
                }
            }
        }

        // Nếu đang đuổi player -> giảm weight tránh tường để zombie "dồn" vào player
        const blendFactor = this.chasingPlayer ? 0.88 : 0.7;
        this.vx = moveX * blendFactor + avoidanceX * (1 - blendFactor);
        this.vz = moveZ * blendFactor + avoidanceZ * (1 - blendFactor);

        this.x += this.vx * deltaSec;
        this.z += this.vz * deltaSec;

        if (this.mesh3D) {
            this.mesh3D.position.x = this.x;
            this.mesh3D.position.z = this.z;
            if ((this.vx * this.vx + this.vz * this.vz) > 0.01) {
                this.mesh3D.rotation.y = Math.atan2(this.vx, this.vz);
            }
        }

        this.animationFrame += deltaTime / 100;
        if (this.animationFrame > 4) {
            this.animationFrame = 0;
        }

        if (this.damageFlashTime > 0) {
            this.damageFlashTime -= deltaSec;
            if (this.damageFlashTime <= 0) {
                if (this.mesh3D && this.mesh3D.body) {
                    this.mesh3D.body.material.color.setHex(this.chasingPlayer ? 0xff1111 : 0xff3333);
                }
            }
        } else {
            if (this.mesh3D && this.mesh3D.body && this.chasingPlayer) {
                this.mesh3D.body.material.color.setHex(0xff1111);
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
