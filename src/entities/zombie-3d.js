/**
 * ZOMBIE-3D.JS - Enemy Zombie Controller trong 3D
 * Tích hợp MODEL ZOMBIE mới (roblox_retro_zombie.glb)
 * State Machine hoàn chỉnh: IDLE | DETECT | CHASE | ATTACK | HURT | DEATH
 * Di chuyển mượt mà, tránh tường, hoạt ảnh shambling và tấn công tự nhiên
 */

const ZOMBIE_STATE = {
    IDLE:   'IDLE',
    DETECT: 'DETECT',
    CHASE:  'CHASE',
    ATTACK: 'ATTACK',
    HURT:   'HURT',
    DEATH:  'DEATH'
};

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
        this.y = 0;
        this.width = CONFIG.ZOMBIE_WIDTH || 0.8;
        this.height = CONFIG.ZOMBIE_HEIGHT || 1.75;

        // Chuyển động & Vận tốc
        this.speed = speed;
        this.targetX = CONFIG.FORTRESS_X || 250;
        this.targetZ = CONFIG.FORTRESS_Y || 250;
        this.vx = 0;
        this.vz = 0;
        this.currentAngle = 0;
        this.targetAngle = 0;
        this.rotationSpeed = 6.0;

        // State Machine
        this.state = ZOMBIE_STATE.IDLE;
        this.chasingPlayer = false;
        this.attackCooldown = 1.0; // 1 giây mỗi đòn đánh
        this.lastPlayerAttackTime = 0;
        this.attackTimer = 0;

        // Máu & Sát thương
        this.hp = hp;
        this.maxHp = hp;
        this.damage = CONFIG.ZOMBIE_PLAYER_DAMAGE || 12;

        // Hiệu ứng & Animation
        this.damageFlashTime = 0;
        this.animTime = Math.random() * 10;
        this.deathTimer = 0;
        this.deathDuration = 0.8; // 0.8 giây hiệu ứng ngã gục khi chết
        this.isDead = false;

        // 3D Visual Mesh
        this.mesh3D = Renderer3D.create3DZombie(x, z);

        console.log(`🧟 Zombie 3D xuất hiện tại (${x.toFixed(0)}, ${z.toFixed(0)}) | HP: ${hp}`);
    }

    /**
     * Zombie nhận sát thương
     * @param {number} damage
     */
    takeDamage(damage) {
        if (this.isDead) return;

        this.hp -= damage;
        this.damageFlashTime = 0.12;

        // Hiệu ứng chớp sáng khi trúng đòn
        if (this.mesh3D) {
            this.mesh3D.traverse(child => {
                if (child.isMesh && child.material && child.material.color) {
                    if (!child._originalColorHex) child._originalColorHex = child.material.color.getHex();
                    child.material.color.setHex(0xffff44);
                }
            });
        }

        if (this.hp <= 0) {
            this.die();
        }
    }

    /**
     * Kích hoạt trạng thái chết với animation gục ngã
     */
    die() {
        if (this.isDead) return;
        this.isDead = true;
        this.state = ZOMBIE_STATE.DEATH;
        this.deathTimer = 0;

        console.log('💀 Zombie bị tiêu diệt');
    }

    /**
     * Cập nhật zombie mỗi frame
     * @param {number} deltaTime
     */
    update(deltaTime) {
        const deltaSec = deltaTime / 1000;
        this.animTime += deltaSec;

        // ============ XỬ LÝ TRẠNG THÁI CHẾT ============
        if (this.isDead) {
            this.deathTimer += deltaSec;
            if (this.mesh3D) {
                // Ngã ngửa ra sau (-90 độ quanh trục X) và hạ dần xuống đất
                const progress = Math.min(1.0, this.deathTimer / 0.4);
                this.mesh3D.rotation.x = -progress * (Math.PI / 2);
                this.mesh3D.position.y = Math.max(0.1, 0.4 * (1 - progress));

                // Fade mờ dần trước khi biến mất
                const fadeProgress = Math.max(0, (this.deathTimer - 0.4) / (this.deathDuration - 0.4));
                if (fadeProgress > 0) {
                    this.mesh3D.traverse(child => {
                        if (child.isMesh && child.material) {
                            child.material.transparent = true;
                            child.material.opacity = Math.max(0, 1.0 - fadeProgress);
                        }
                    });
                }
            }

            if (this.deathTimer >= this.deathDuration) {
                this.dispose();
            }
            return;
        }

        // ============ AI QUYẾT ĐỊNH MỤC TIÊU & STATE ============
        let tx = CONFIG.FORTRESS_X || 250;
        let tz = CONFIG.FORTRESS_Y || 250;
        this.chasingPlayer = false;

        let distToPlayer = Infinity;
        if (typeof PlayerController !== 'undefined' && PlayerController.position) {
            const px = PlayerController.position.x;
            const pz = PlayerController.position.z;
            distToPlayer = Math.hypot(px - this.x, pz - this.z);
            const chaseR = CONFIG.ZOMBIE_PLAYER_CHASE_RADIUS || 120;

            if (distToPlayer <= chaseR) {
                tx = px;
                tz = pz;
                this.chasingPlayer = true;
                this.state = ZOMBIE_STATE.CHASE;
            } else {
                this.state = ZOMBIE_STATE.IDLE;
            }
        }

        // ============ HƯỚNG DI CHUYỂN & STEERING BEHAVIOR ============
        const dx = tx - this.x;
        const dz = tz - this.z;
        const dist = Math.hypot(dx, dz);

        let moveX = 0, moveZ = 0;
        const stopDistance = this.chasingPlayer ? (CONFIG.ZOMBIE_PLAYER_ATTACK_RADIUS || 1.6) : 2.0;

        if (dist > stopDistance) {
            moveX = (dx / dist) * this.speed;
            moveZ = (dz / dist) * this.speed;
        }

        // Tránh tường căn cứ (Steering Avoidance)
        let avoidanceX = 0, avoidanceZ = 0;
        if (typeof GameState !== 'undefined' && GameState.walls && GameState.walls.length > 0) {
            const avoidanceRadius = 3.5;
            for (let wall of GameState.walls) {
                if (wall.isDestroyed && wall.isDestroyed()) continue;
                const wallDx = wall.x - this.x;
                const wallDz = wall.z - this.z;
                const wallDist = Math.hypot(wallDx, wallDz);
                if (wallDist < avoidanceRadius && wallDist > 0.1) {
                    const pushForce = 1.0 - (wallDist / avoidanceRadius);
                    avoidanceX += -(wallDx / wallDist) * pushForce;
                    avoidanceZ += -(wallDz / wallDist) * pushForce;
                }
            }
        }

        const blend = this.chasingPlayer ? 0.88 : 0.70;
        this.vx = moveX * blend + avoidanceX * (1 - blend);
        this.vz = moveZ * blend + avoidanceZ * (1 - blend);

        // Áp dụng vị trí
        this.x += this.vx * deltaSec;
        this.z += this.vz * deltaSec;

        // ============ TẤN CÔNG PLAYER NẾU Ở GẦN ============
        if (this.chasingPlayer) {
            const attackRange = CONFIG.ZOMBIE_PLAYER_ATTACK_RADIUS || 1.8;
            if (distToPlayer <= attackRange) {
                this.state = ZOMBIE_STATE.ATTACK;
                const now = Date.now();
                if (now - this.lastPlayerAttackTime >= (this.attackCooldown * 1000)) {
                    this.lastPlayerAttackTime = now;
                    this.attackTimer = 0.35; // Thời gian vung tay tấn công

                    if (typeof GameState !== 'undefined' && GameState.damagePlayerFromZombie) {
                        GameState.damagePlayerFromZombie(this.damage);
                    }
                }
            }
        }

        // ============ XOAY VÀ ANIMATION SHAMBLING ============
        if (this.mesh3D) {
            this.mesh3D.position.x = this.x;
            this.mesh3D.position.z = this.z;

            // Xoay mượt theo hướng chuyển động
            const currentSpeedSq = this.vx * this.vx + this.vz * this.vz;
            if (currentSpeedSq > 0.05) {
                this.targetAngle = Math.atan2(this.vx, this.vz);
                let diff = this.targetAngle - this.currentAngle;
                while (diff > Math.PI) diff -= Math.PI * 2;
                while (diff < -Math.PI) diff += Math.PI * 2;
                this.currentAngle += diff * Math.min(1.0, this.rotationSpeed * deltaSec);
                this.mesh3D.rotation.y = this.currentAngle;
            }

            // Hoạt ảnh Shambling (bước đi lắc lư của zombie)
            if (currentSpeedSq > 0.1) {
                const stepFreq = this.speed * 1.8;
                // Nhấp nhô trục Y khi bước đi
                this.mesh3D.position.y = Math.abs(Math.sin(this.animTime * stepFreq)) * 0.08;
                // Lắc lư thân mình sang hai bên (Z-tilt)
                this.mesh3D.rotation.z = Math.sin(this.animTime * stepFreq * 0.5) * 0.06;
                // Nghiêng nhẹ người về phía trước
                this.mesh3D.rotation.x = 0.08;
            } else {
                // Đứng yên thở
                this.mesh3D.position.y = 0;
                this.mesh3D.rotation.z = 0;
                this.mesh3D.rotation.x = Math.sin(this.animTime * 2.0) * 0.02;
            }

            // Hoạt ảnh vung tay khi tấn công
            if (this.attackTimer > 0) {
                this.attackTimer -= deltaSec;
                const lunge = Math.sin(this.attackTimer * Math.PI * 3) * 0.15;
                this.mesh3D.position.z += Math.cos(this.currentAngle) * lunge;
                this.mesh3D.position.x += Math.sin(this.currentAngle) * lunge;
            }
        }

        // ============ XỬ LÝ DAMAGE FLASH ============
        if (this.damageFlashTime > 0) {
            this.damageFlashTime -= deltaSec;
            if (this.damageFlashTime <= 0 && this.mesh3D) {
                this.mesh3D.traverse(child => {
                    if (child.isMesh && child.material && child.material.color && child._originalColorHex) {
                        child.material.color.setHex(child._originalColorHex);
                    }
                });
            }
        }
    }

    /**
     * Kiểm tra bị tiêu diệt
     */
    isDestroyed() {
        return this.hp <= 0 && this.deathTimer >= this.deathDuration;
    }

    /**
     * Kiểm tra xem zombie đã đến pháo đài chưa
     */
    reachedFortress() {
        const fortressPos = { x: CONFIG.FORTRESS_X || 250, z: CONFIG.FORTRESS_Y || 250 };
        const dist = Math.hypot(this.x - fortressPos.x, this.z - fortressPos.z);
        return dist < 8;
    }

    /**
     * Dọn dẹp và xóa mesh khỏi Three.js scene
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
