/**
 * ROTTEN-MEAT-ZOMBIE.JS - Ranged zombie that throws rotten meat projectiles
 * Slower than normal zombies, keeps distance, throws projectiles that deal
 * immediate damage + poison damage over time.
 */

const ROTTEN_MEAT_STATE = {
    IDLE: 'IDLE',
    CHASE: 'CHASE',
    RANGED_ATTACK: 'RANGED_ATTACK',
    REPOSITION: 'REPOSITION',
    DEAD: 'DEAD'
};

class RottenMeatZombie extends Zombie3D {
    constructor(x, z, speed = CONFIG.ROTTEN_MEAT_ZOMBIE_SPEED, hp = CONFIG.ROTTEN_MEAT_ZOMBIE_HP) {
        super(x, z, speed, hp);

        this.type = 'rotten_meat';
        this.throwCooldown = CONFIG.ROTTEN_MEAT_THROW_COOLDOWN;
        this.lastThrowTime = 0;
        this.attackRange = CONFIG.ROTTEN_MEAT_ATTACK_RANGE || 20;
        this.preferredRange = CONFIG.ROTTEN_MEAT_PREFERRED_RANGE || 12;
        this.minRange = CONFIG.ROTTEN_MEAT_MIN_RANGE || 7;
        this.projectiles = [];
        this.rangedState = ROTTEN_MEAT_STATE.IDLE;
        this._repositionDir = 1;

        if (this.mesh3D) {
            this.mesh3D.traverse(child => {
                if (child.isMesh && child.material && child.material.color) {
                    if (!child._originalColorHex) child._originalColorHex = child.material.color.getHex();
                    child.material.color.setHex(0x4a6b3a);
                }
            });
        }

        console.log(`🥩 Rotten Meat Zombie xuất hiện tại (${x.toFixed(0)}, ${z.toFixed(0)}) | HP: ${hp}`);
    }

    update(deltaTime) {
        this._updateProjectiles(deltaTime);
        super.update(deltaTime);
    }

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

                if (this._distToPlayer > this.attackRange) {
                    this.rangedState = ROTTEN_MEAT_STATE.CHASE;
                } else if (this._distToPlayer < this.minRange) {
                    this.rangedState = ROTTEN_MEAT_STATE.REPOSITION;
                } else {
                    this.rangedState = ROTTEN_MEAT_STATE.RANGED_ATTACK;
                }
            } else {
                this._targetX = tx;
                this._targetZ = tz;
                this.rangedState = ROTTEN_MEAT_STATE.IDLE;
            }
        } else {
            this._targetX = tx;
            this._targetZ = tz;
            this._distToPlayer = Infinity;
            this.rangedState = ROTTEN_MEAT_STATE.IDLE;
        }
    }

    _updateMovement(deltaSec) {
        let tx = this._targetX !== undefined ? this._targetX : (CONFIG.FORTRESS_X || 250);
        let tz = this._targetZ !== undefined ? this._targetZ : (CONFIG.FORTRESS_Y || 250);

        if (this.chasingPlayer && typeof PlayerController !== 'undefined' && PlayerController.position && !PlayerController.isDead && !PlayerController.isRespawning) {
            const px = PlayerController.position.x;
            const pz = PlayerController.position.z;
            const dx = px - this.x;
            const dz = pz - this.z;
            const dist = Math.hypot(dx, dz);

            if (dist > 0.1) {
                switch (this.rangedState) {
                    case ROTTEN_MEAT_STATE.CHASE:
                        tx = px;
                        tz = pz;
                        break;
                    case ROTTEN_MEAT_STATE.RANGED_ATTACK:
                        tx = this.x;
                        tz = this.z;
                        break;
                    case ROTTEN_MEAT_STATE.REPOSITION:
                        const backX = this.x - (dx / dist) * 8;
                        const backZ = this.z - (dz / dist) * 8;
                        const perpX = -dz / dist;
                        const perpZ = dx / dist;
                        tx = backX + perpX * 3 * this._repositionDir;
                        tz = backZ + perpZ * 3 * this._repositionDir;
                        break;
                    default:
                        tx = px;
                        tz = pz;
                }
            }
        }

        const dx = tx - this.x;
        const dz = tz - this.z;
        const dist = Math.hypot(dx, dz);

        let moveX = 0, moveZ = 0;
        const stopDistance = this.rangedState === ROTTEN_MEAT_STATE.RANGED_ATTACK ? 0.5 : 2.0;

        if (dist > stopDistance) {
            const speed = this._frameSpeedOverride || this.speed;
            moveX = (dx / dist) * speed;
            moveZ = (dz / dist) * speed;
        }

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

        this.x += this.vx * deltaSec;
        this.z += this.vz * deltaSec;
    }

    _updateAttack(deltaTime) {
        if (this.rangedState === ROTTEN_MEAT_STATE.RANGED_ATTACK && typeof PlayerController !== 'undefined' && !PlayerController.isDead && !PlayerController.isRespawning) {
            const now = Date.now();
            if (now - this.lastThrowTime >= this.throwCooldown * 1000) {
                this._tryThrowProjectile();
            }
        }
    }

    _tryThrowProjectile() {
        const now = Date.now();
        if (now - this.lastThrowTime < this.throwCooldown * 1000) return;

        this.lastThrowTime = now;

        const px = PlayerController.position.x;
        const py = PlayerController.position.y + 1.2;
        const pz = PlayerController.position.z;

        const sx = this.x;
        const sy = this.y + 1.2;
        const sz = this.z;

        const projectile = new RottenMeatProjectile(
            sx, sy, sz,
            px, py, pz,
            (typeof GameState !== 'undefined' && GameState._specialEventZombieModifiers && GameState._specialEventZombieModifiers.damage) ? GameState._specialEventZombieModifiers.damage : 1
        );

        this.projectiles.push(projectile);
        this.attackTimer = 0.5;
    }

    _updateProjectiles(deltaTime) {
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const proj = this.projectiles[i];
            proj.update(deltaTime);

            if (!proj.hasHit && typeof PlayerController !== 'undefined' && !PlayerController.isDead && !PlayerController.isRespawning) {
                const dx = proj.x - PlayerController.position.x;
                const dz = proj.z - PlayerController.position.z;
                const dist = Math.hypot(dx, dz);

                if (dist <= CONFIG.ROTTEN_MEAT_PROJECTILE_HIT_RADIUS) {
                    proj.hasHit = true;
                    this._onProjectileHit(proj);
                }
            }

            if (proj.isExpired()) {
                proj.dispose();
                this.projectiles.splice(i, 1);
            }
        }
    }

    _onProjectileHit(projectile) {
        // Check Observation Haki dodge first for projectile-specific context
        if (typeof ObservationHaki !== 'undefined' && ObservationHaki.isActive) {
            const attackContext = {
                source: 'rotten_meat_projectile',
                damage: CONFIG.ROTTEN_MEAT_IMPACT_DAMAGE * projectile.damageMultiplier,
                projectile: projectile,
                attackerX: projectile.startX,
                attackerZ: projectile.startZ,
                timestamp: Date.now()
            };
            
            if (ObservationHaki.tryDodge(attackContext)) {
                // Attack was dodged - skip damage and poison
                return;
            }
        }

        if (typeof GameState !== 'undefined') {
            GameState.damagePlayer(
                CONFIG.ROTTEN_MEAT_IMPACT_DAMAGE * projectile.damageMultiplier,
                'rotten_meat_impact',
                projectile.x,
                projectile.z
            );

            GameState.applyPoison(
                CONFIG.ROTTEN_MEAT_POISON_TOTAL_DAMAGE * projectile.damageMultiplier,
                CONFIG.ROTTEN_MEAT_POISON_DURATION
            );
        }

        if (typeof Renderer3D !== 'undefined' && Renderer3D.createSplatterEffect) {
            Renderer3D.createSplatterEffect(projectile.x, projectile.y, projectile.z);
        }
    }

    dispose() {
        this.projectiles.forEach(proj => proj.dispose());
        this.projectiles = [];
        super.dispose();
    }
};

class RottenMeatProjectile {
    constructor(fromX, fromY, fromZ, targetX, targetY, targetZ, damageMultiplier = 1) {
        this.id = `proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.startX = fromX;
        this.startY = fromY;
        this.startZ = fromZ;
        this.x = fromX;
        this.y = fromY;
        this.z = fromZ;
        this.targetX = targetX;
        this.targetY = targetY;
        this.targetZ = targetZ;
        this.damageMultiplier = damageMultiplier;
        this.hasHit = false;
        this.travelTime = 0;
        this.maxLifetime = CONFIG.ROTTEN_MEAT_PROJECTILE_LIFETIME;

        const dx = targetX - fromX;
        const dz = targetZ - fromZ;
        this.distance = Math.hypot(dx, dz);
        this.directionX = dx / this.distance;
        this.directionZ = dz / this.distance;

        const speed = CONFIG.ROTTEN_MEAT_PROJECTILE_SPEED;
        this.flightTime = this.distance / speed;
        this.velocityY = (targetY - fromY) / this.flightTime + 4.0 * this.flightTime;

        this.mesh = this._createMesh();
    }

    _createMesh() {
        const group = new THREE.Group();

        const baseMat = new THREE.MeshStandardMaterial({
            color: 0x5c2e1a,
            roughness: 0.9,
            metalness: 0.0,
            emissive: 0x2a0a00,
            emissiveIntensity: 0.3
        });

        const spotMat = new THREE.MeshStandardMaterial({
            color: 0x3d1f0f,
            roughness: 0.95,
            metalness: 0.0,
            emissive: 0x1a0800,
            emissiveIntensity: 0.2
        });

        const rotMat = new THREE.MeshStandardMaterial({
            color: 0x4a6b3a,
            roughness: 0.92,
            metalness: 0.0,
            emissive: 0x1a2a10,
            emissiveIntensity: 0.25
        });

        const main = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22, 0), baseMat);
        main.scale.set(1, 0.7, 1.1);
        group.add(main);

        const chunk1 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.12, 0), spotMat);
        chunk1.position.set(0.15, 0.05, 0.1);
        group.add(chunk1);

        const chunk2 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.09, 0), spotMat);
        chunk2.position.set(-0.12, -0.03, -0.14);
        group.add(chunk2);

        const chunk3 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.07, 0), rotMat);
        chunk3.position.set(0.05, -0.08, -0.05);
        group.add(chunk3);

        const chunk4 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.06, 0), rotMat);
        chunk4.position.set(-0.08, 0.06, 0.12);
        group.add(chunk4);

        group.position.set(this.x, this.y, this.z);

        if (typeof Renderer3D !== 'undefined' && Renderer3D.scene) {
            Renderer3D.scene.add(group);
        }

        return group;
    }

    update(deltaTime) {
        if (this.hasHit) return;

        const deltaSec = deltaTime / 1000;
        this.travelTime += deltaSec;

        const speed = CONFIG.ROTTEN_MEAT_PROJECTILE_SPEED;
        const moveDist = speed * deltaSec;
        this.x += this.directionX * moveDist;
        this.z += this.directionZ * moveDist;

        const progress = Math.min(1, this.travelTime / this.flightTime);
        this.y = this.startY + this.velocityY * this.travelTime - 4.0 * this.travelTime * this.travelTime;

        if (this.mesh) {
            this.mesh.position.set(this.x, Math.max(0.15, this.y), this.z);
            this.mesh.rotation.x += deltaSec * 6;
            this.mesh.rotation.y += deltaSec * 4;
            this.mesh.rotation.z += deltaSec * 3;
        }
    }

    isExpired() {
        return this.travelTime >= this.maxLifetime || this.hasHit;
    }

    dispose() {
        if (this.mesh) {
            if (typeof Renderer3D !== 'undefined' && Renderer3D.scene) {
                Renderer3D.scene.remove(this.mesh);
            }
            this.mesh.traverse(node => {
                if (node.geometry) node.geometry.dispose();
                if (node.material) node.material.dispose();
            });
            this.mesh = null;
        }
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { RottenMeatZombie, RottenMeatProjectile };
}

