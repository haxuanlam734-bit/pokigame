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
    constructor(x, z, speed = CONFIG.ZOMBIE_SPEED, hp = CONFIG.ZOMBIE_MAX_HP) {
        // Constructor logic
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
    this.attackCooldown = 1.0;
    this.lastPlayerAttackTime = 0;
    this.attackTimer = 0;

    // Máu & Sát thương
    this.hp = hp;
    this.maxHp = hp;
        this.damage = CONFIG.ZOMBIE_PLAYER_DAMAGE || 12;
    this.isDead = false;
    this.deathTimer = 0;
        this.deathDuration = 0.8; // 0.8 giây hiệu ứng ngã gục khi chết
    this.damageFlashTime = 0;
    this.animTime = Math.random() * 10;
    this._frameSpeedOverride = null;
    this._frameDamageOverride = null;

    // 3D Visual Mesh
    if (typeof Renderer3D !== 'undefined' && Renderer3D.create3DZombie) {
        this.mesh3D = Renderer3D.create3DZombie(x, z);
    } else {
        console.warn('Renderer3D not available, zombie will not have visual mesh');
        this.mesh3D = null;
    }
    this._originalEmissive = {};
    this._eventColorPhase = 0;
    this._eclipseEmissive = new THREE.Color(0x220033);
    this._bloodEmissive = new THREE.Color(0x550000);
    this._defaultEmissive = new THREE.Color(0x000000);

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
            this._updateDeath(deltaSec);
            return;
        }

        // ============ AI QUYẾT ĐỊNH MỤC TIÊU & STATE ============
        this._updateAI(deltaTime);

        // ============ HƯỚNG DI CHUYỂN & STEERING BEHAVIOR ============
        this._updateMovement(deltaSec);

        // ============ TẤN CÔNG PLAYER NẾU Ở GẦN ============
        this._updateAttack(deltaTime);

        // ============ XOAY VÀ ANIMATION ============
        this._updateVisuals(deltaSec);

        // ============ XỬ LÝ EVENT VISUAL ============
        this._updateEventVisuals(deltaSec);
    }

    /**
     * Update death animation - called when zombie is dead
     */
    _updateDeath(deltaSec) {
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
    }

    /**
     * Update AI target decision - can be overridden by subclasses
     */
    _updateAI(deltaTime) {
        const tx = CONFIG.FORTRESS_X || 250;
        const tz = CONFIG.FORTRESS_Y || 250;
        this.chasingPlayer = false;

        if (typeof PlayerController !== 'undefined' && PlayerController.position && !PlayerController.isDead && !PlayerController.isRespawning) {
            const px = PlayerController.position.x;
            const pz = PlayerController.position.z;
            this._distToPlayer = Math.hypot(px - this.x, pz - this.z);
            const chaseR = CONFIG.ZOMBIE_PLAYER_CHASE_RADIUS || 120;

            if (this._distToPlayer <= chaseR) {
                this._targetX = px;
                this._targetZ = pz;
                this.chasingPlayer = true;
                this.state = ZOMBIE_STATE.CHASE;
            } else {
                this._targetX = tx;
                this._targetZ = tz;
                this.state = ZOMBIE_STATE.IDLE;
            }
        } else {
            this._targetX = tx;
            this._targetZ = tz;
            this._distToPlayer = Infinity;
        }
    }

    /**
     * Update movement - can be overridden by subclasses
     */
    _updateMovement(deltaSec) {
        const tx = this._targetX !== undefined ? this._targetX : (CONFIG.FORTRESS_X || 250);
        const tz = this._targetZ !== undefined ? this._targetZ : (CONFIG.FORTRESS_Y || 250);

        const dx = tx - this.x;
        const dz = tz - this.z;
        const dist = Math.hypot(dx, dz);

        let moveX = 0, moveZ = 0;
        const stopDistance = this.chasingPlayer ? (CONFIG.ZOMBIE_PLAYER_ATTACK_RADIUS || 1.6) : 2.0;

        if (dist > stopDistance) {
            moveX = (dx / dist) * (this._frameSpeedOverride || this.speed);
            moveZ = (dz / dist) * (this._frameSpeedOverride || this.speed);
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
    }

    /**
     * Update attack behavior - can be overridden by subclasses
     */
    _updateAttack(deltaTime) {
        if (this.chasingPlayer && typeof PlayerController !== 'undefined' && !PlayerController.isDead && !PlayerController.isRespawning) {
            const attackRange = CONFIG.ZOMBIE_PLAYER_ATTACK_RADIUS || 1.8;
            if (this._distToPlayer <= attackRange) {
                this.state = ZOMBIE_STATE.ATTACK;
                const now = Date.now();
                if (now - this.lastPlayerAttackTime >= (this.attackCooldown * 1000)) {
                    this.lastPlayerAttackTime = now;
                    this.attackTimer = 0.35;

                    if (typeof GameState !== 'undefined' && GameState.damagePlayerFromZombie) {
                        GameState.damagePlayerFromZombie(this.damage, this.x, this.z);
                    }
                }
            }
        }
    }

    /**
     * Update visuals and animation
     */
    _updateVisuals(deltaSec) {
        if (!this.mesh3D) return;

        this.mesh3D.position.x = this.x;
        this.mesh3D.position.z = this.z;

        // Cố định Y-plane khi Zombie hướng về phía Player
        let targetAngle = this.currentAngle;
        if (this.chasingPlayer && typeof PlayerController !== 'undefined' && PlayerController.position && !PlayerController.isDead && !PlayerController.isRespawning) {
            const px = PlayerController.position.x;
            const pz = PlayerController.position.z;
            targetAngle = Math.atan2(px - this.x, pz - this.z);
        } else {
            const currentSpeedSq = this.vx * this.vx + this.vz * this.vz;
            if (currentSpeedSq > 0.05) {
                targetAngle = Math.atan2(this.vx, this.vz);
            }
        }

        // Xoay mượt theo góc mục tiêu
        let diff = targetAngle - this.currentAngle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this.currentAngle += diff * Math.min(1.0, this.rotationSpeed * deltaSec);
        this.mesh3D.rotation.y = this.currentAngle;

        // Cập nhật AnimationMixer nếu model 3D có clip animation
        if (this.mesh3D.mixer) {
            this.mesh3D.mixer.update(deltaSec);
            let desiredAction = 'idle';
            if (this.isDead) {
                desiredAction = 'death';
            } else if (this.attackTimer > 0) {
                desiredAction = 'attack';
            } else if (this.chasingPlayer) {
                desiredAction = (this.mesh3D.actions && this.mesh3D.actions['run']) ? 'run' : 'walk';
            } else {
                desiredAction = 'walk';
            }

            if (this.mesh3D.actions) {
                const act = this.mesh3D.actions[desiredAction] || this.mesh3D.actions['walk'] || this.mesh3D.actions['idle'];
                if (act && !act.isRunning()) {
                    Object.values(this.mesh3D.actions).forEach(a => a.stop());
                    act.reset().play();
                }
            }
        } else {
            // Fallback Procedural Animation
            const currentSpeedSq = this.vx * this.vx + this.vz * this.vz;
            if (currentSpeedSq > 0.1) {
                const stepFreq = this.speed * 1.8;
                this.mesh3D.position.y = Math.abs(Math.sin(this.animTime * stepFreq)) * 0.08;
                this.mesh3D.rotation.z = Math.sin(this.animTime * stepFreq * 0.5) * 0.06;
                this.mesh3D.rotation.x = 0.08;
            } else {
                this.mesh3D.position.y = 0;
                this.mesh3D.rotation.z = 0;
                this.mesh3D.rotation.x = Math.sin(this.animTime * 2.0) * 0.02;
            }
        }

        // Hoạt ảnh vung tay khi tấn công
        if (this.attackTimer > 0) {
            this.attackTimer -= deltaSec;
            const lunge = Math.sin(this.attackTimer * Math.PI * 3) * 0.15;
            this.mesh3D.position.z += Math.cos(this.currentAngle) * lunge;
            this.mesh3D.position.x += Math.sin(this.currentAngle) * lunge;
        }
    }

    /**
     * Update event visual effects
     */
    _updateEventVisuals(deltaSec) {
        if (!this.isDead && this.mesh3D && typeof SpecialEventManager !== 'undefined' && SpecialEventManager.currentEvent) {
            const event = SpecialEventManager.currentEvent;
            this._eventColorPhase += deltaSec;
            if (event === 'ECLIPSE') {
                this.mesh3D.traverse(child => {
                    if (child.isMesh && child.material && child.material.emissive) {
                        if (!this._originalEmissive[child.uuid]) {
                            this._originalEmissive[child.uuid] = {
                                emissive: child.material.emissive.getHex(),
                                emissiveIntensity: child.material.emissiveIntensity || 0
                            };
                        }
                        const pulse = 0.5 + 0.5 * Math.sin(this._eventColorPhase * 2.0);
                        child.material.emissive.copy(this._eclipseEmissive);
                        child.material.emissiveIntensity = 0.15 + pulse * 0.10;
                    }
                });
            } else if (event === 'BLOOD_MOON') {
                this.mesh3D.traverse(child => {
                    if (child.isMesh && child.material && child.material.emissive) {
                        if (!this._originalEmissive[child.uuid]) {
                            this._originalEmissive[child.uuid] = {
                                emissive: child.material.emissive.getHex(),
                                emissiveIntensity: child.material.emissiveIntensity || 0
                            };
                        }
                        const pulse = 0.5 + 0.5 * Math.sin(this._eventColorPhase * 1.8);
                        child.material.emissive.copy(this._bloodEmissive);
                        child.material.emissiveIntensity = 0.25 + pulse * 0.18;
                    }
                });
            }
        } else if (!this.isDead && this.mesh3D && this._originalEmissive) {
            this.mesh3D.traverse(child => {
                if (child.isMesh && child.material && child.material.emissive && this._originalEmissive[child.uuid]) {
                    child.material.emissive.setHex(this._originalEmissive[child.uuid].emissive);
                    child.material.emissiveIntensity = this._originalEmissive[child.uuid].emissiveIntensity;
                }
            });
            this._originalEmissive = {};
        }
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

