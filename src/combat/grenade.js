/**
 * GRENADE.JS - Grenade weapon system
 * Integrated with existing WeaponSystem, WeaponRenderer, GameState, Renderer3D
 * Handles: trajectory preview, throw physics, landing, fuse, explosion, area damage
 */

const GrenadeSystem = {
    _grenades: [],
    _activeGrenade: null,
    _trajectoryLine: null,
    _landingMarker: null,
    _trajectoryPoints: [],
    _throwOrigin: new THREE.Vector3(),
    _throwDirection: new THREE.Vector3(),
    _isAiming: false,

    GRENADE_THROW_SPEED: 22,
    GRENADE_GRAVITY: 22,
    GRENADE_FUSE_AFTER_LANDING: 1.0,
    GRENADE_EXPLOSION_RADIUS: 12,
    GRENADE_MAX_DAMAGE: 100,
    GRENADE_INNER_RADIUS: 4,
    GRENADE_FUTURE_NOISE_RADIUS: 20,
    DEBUG_GRENADE: false,

    init: function() {
        this._grenades = [];
        this._activeGrenade = null;
        this._isAiming = false;
        this._createTrajectoryObjects();
        console.log('GrenadeSystem initialized');
    },

    _createTrajectoryObjects: function() {
        if (!Renderer3D || !Renderer3D.scene) return;

        if (this._trajectoryLine) {
            Renderer3D.scene.remove(this._trajectoryLine);
            this._trajectoryLine = null;
        }
        if (this._landingMarker) {
            Renderer3D.scene.remove(this._landingMarker);
            this._landingMarker = null;
        }
        if (this._debugRadiusRing) {
            Renderer3D.scene.remove(this._debugRadiusRing);
            this._debugRadiusRing = null;
        }
        if (this._debugInnerRing) {
            Renderer3D.scene.remove(this._debugInnerRing);
            this._debugInnerRing = null;
        }

        const lineGeo = new THREE.BufferGeometry();
        const lineMat = new THREE.LineBasicMaterial({
            color: 0xff2222,
            transparent: true,
            opacity: 0.8,
            depthTest: true,
            depthWrite: false
        });
        this._trajectoryLine = new THREE.Line(lineGeo, lineMat);
        this._trajectoryLine.visible = false;
        this._trajectoryLine.frustumCulled = false;
        this._trajectoryLine.renderOrder = 999;
        Renderer3D.scene.add(this._trajectoryLine);

        const ringGeo = new THREE.RingGeometry(0.4, 0.55, 24);
        const ringMat = new THREE.MeshBasicMaterial({
            color: 0xff2222,
            transparent: true,
            opacity: 0.9,
            depthTest: true,
            depthWrite: false,
            side: THREE.DoubleSide
        });
        this._landingMarker = new THREE.Mesh(ringGeo, ringMat);
        this._landingMarker.rotation.x = -Math.PI / 2;
        this._landingMarker.visible = false;
        this._landingMarker.frustumCulled = false;
        this._landingMarker.renderOrder = 998;
        Renderer3D.scene.add(this._landingMarker);

        const debugRadiusGeo = new THREE.RingGeometry(this.GRENADE_EXPLOSION_RADIUS - 0.15, this.GRENADE_EXPLOSION_RADIUS + 0.15, 32);
        const debugRadiusMat = new THREE.MeshBasicMaterial({
            color: 0xff6600,
            transparent: true,
            opacity: 0.3,
            depthTest: true,
            depthWrite: false,
            side: THREE.DoubleSide
        });
        this._debugRadiusRing = new THREE.Mesh(debugRadiusGeo, debugRadiusMat);
        this._debugRadiusRing.rotation.x = -Math.PI / 2;
        this._debugRadiusRing.visible = false;
        this._debugRadiusRing.frustumCulled = false;
        this._debugRadiusRing.renderOrder = 997;
        Renderer3D.scene.add(this._debugRadiusRing);

        const debugInnerGeo = new THREE.RingGeometry(this.GRENADE_INNER_RADIUS - 0.1, this.GRENADE_INNER_RADIUS + 0.1, 24);
        const debugInnerMat = new THREE.MeshBasicMaterial({
            color: 0xff2222,
            transparent: true,
            opacity: 0.5,
            depthTest: true,
            depthWrite: false,
            side: THREE.DoubleSide
        });
        this._debugInnerRing = new THREE.Mesh(debugInnerGeo, debugInnerMat);
        this._debugInnerRing.rotation.x = -Math.PI / 2;
        this._debugInnerRing.visible = false;
        this._debugInnerRing.frustumCulled = false;
        this._debugInnerRing.renderOrder = 996;
        Renderer3D.scene.add(this._debugInnerRing);
    },

    startAiming: function() {
        if (this._isAiming) return;
        if (typeof WeaponSystem !== 'undefined' && WeaponSystem._grenadeAiming) return;
        if (this._activeGrenade) return;

        this._isAiming = true;
        if (typeof WeaponSystem !== 'undefined') {
            WeaponSystem._grenadeAiming = true;
        }
        if (this._trajectoryLine) this._trajectoryLine.visible = true;
        if (this._landingMarker) this._landingMarker.visible = true;
    },

    cancelAiming: function() {
        if (!this._isAiming) return;
        this._isAiming = false;
        if (typeof WeaponSystem !== 'undefined') {
            WeaponSystem._grenadeAiming = false;
        }
        if (this._trajectoryLine) this._trajectoryLine.visible = false;
        if (this._landingMarker) this._landingMarker.visible = false;
        if (this._debugRadiusRing) this._debugRadiusRing.visible = false;
        if (this._debugInnerRing) this._debugInnerRing.visible = false;
        this._trajectoryPoints = [];
    },

    throwGrenade: function() {
        if (!this._isAiming) return;
        if (this._activeGrenade) return;
        const infiniteAmmo = typeof GameState !== 'undefined' && GameState.adminInfiniteAmmo;
        if (!infiniteAmmo && typeof WeaponSystem !== 'undefined' && WeaponSystem._grenadeCount <= 0) return;

        console.log('[GRENADE] throw requested');
        this.cancelAiming();
        if (typeof WeaponSystem !== 'undefined') {
            WeaponSystem._grenadeAiming = false;
            if (!infiniteAmmo && WeaponSystem._grenadeCount > 0) {
                WeaponSystem._grenadeCount--;
            }
            WeaponSystem._updateAmmoHUD();
            WeaponSystem._grenadeThrown = false;
        }

        const origin = this._getThrowOrigin();
        const direction = this._getThrowDirection();
        console.log('[GRENADE] projectile spawned at', origin.x.toFixed(1), origin.y.toFixed(1), origin.z.toFixed(1));
        const grenade = new GrenadeProjectile(
            origin.x, origin.y, origin.z,
            direction.x, direction.y, direction.z,
            this.GRENADE_THROW_SPEED,
            this.GRENADE_GRAVITY,
            this.GRENADE_FUSE_AFTER_LANDING,
            this.GRENADE_MAX_DAMAGE,
            this.GRENADE_EXPLOSION_RADIUS,
            this.GRENADE_INNER_RADIUS
        );

        this._grenades.push(grenade);
        this._activeGrenade = grenade;
    },

    _getThrowOrigin: function() {
        const pos = new THREE.Vector3();
        if (typeof WeaponRenderer !== 'undefined' && WeaponRenderer._weaponHolder) {
            WeaponRenderer._weaponHolder.getWorldPosition(pos);
        } else if (typeof PlayerController !== 'undefined') {
            pos.set(
                PlayerController.position.x + 0.3,
                PlayerController.position.y + 1.2,
                PlayerController.position.z + 0.2
            );
        }
        return pos;
    },

    _getThrowDirection: function() {
        const dir = new THREE.Vector3();
        if (typeof Renderer3D !== 'undefined' && Renderer3D.camera) {
            Renderer3D.camera.getWorldDirection(dir);
        } else if (typeof InputManager !== 'undefined') {
            const yaw = InputManager.cameraYaw;
            const pitch = InputManager.cameraPitch;
            dir.set(
                Math.sin(yaw) * Math.cos(pitch),
                -Math.sin(pitch),
                Math.cos(yaw) * Math.cos(pitch)
            );
        }
        dir.normalize();
        return dir;
    },

    updateTrajectoryPreview: function() {
        if (!this._isAiming || !Renderer3D || !Renderer3D.scene) return;

        const origin = this._getThrowOrigin();
        const direction = this._getThrowDirection();
        const speed = this.GRENADE_THROW_SPEED;
        const gravity = this.GRENADE_GRAVITY;
        const dt = 0.06;
        const maxTime = 2.5;

        const points = [];
        let x = origin.x, y = origin.y, z = origin.z;
        let vx = direction.x * speed;
        let vy = direction.y * speed;
        let vz = direction.z * speed;
        let landed = false;
        let landingY = 0;

        const collisionMeshes = (Renderer3D && Renderer3D._collisionMeshes) ? Renderer3D._collisionMeshes : [];
        const cachedBoxes = [];
        for (let i = 0; i < collisionMeshes.length; i++) {
            const mesh = collisionMeshes[i];
            if (!mesh || !mesh.isMesh || !mesh.visible) continue;
            const box = new THREE.Box3().setFromObject(mesh);
            if (box.isEmpty() || (box.max.y - box.min.y) < 0.65) continue;
            cachedBoxes.push(box);
        }

        for (let t = 0; t < maxTime; t += dt) {
            points.push(new THREE.Vector3(x, y, z));

            x += vx * dt;
            y += vy * dt;
            z += vz * dt;
            vy -= gravity * dt;

            const floorY = Renderer3D.getPlayerFloorHeight ? Renderer3D.getPlayerFloorHeight(x, z) : 0;
            if (y <= floorY) {
                y = floorY;
                landed = true;
                landingY = floorY;
                break;
            }

            for (let b = 0; b < cachedBoxes.length; b++) {
                const box = cachedBoxes[b];
                if (x >= box.min.x - 0.1 && x <= box.max.x + 0.1 &&
                    z >= box.min.z - 0.1 && z <= box.max.z + 0.1 &&
                    y >= box.min.y - 0.1 && y <= box.max.y + 0.1) {
                    landed = true;
                    landingY = y;
                    break;
                }
            }
            if (landed) break;

            if (x < 0 || x > 1600 || z < 0 || z > 1600) {
                landed = true;
                landingY = y;
                break;
            }
        }

        points.push(new THREE.Vector3(x, y, z));

        if (points.length > 1 && this._trajectoryLine) {
            const geo = new THREE.BufferGeometry().setFromPoints(points);
            this._trajectoryLine.geometry.dispose();
            this._trajectoryLine.geometry = geo;
            this._trajectoryLine.visible = true;
        }

        if (this._landingMarker) {
            this._landingMarker.position.set(x, landed ? landingY + 0.05 : y, z);
            this._landingMarker.visible = true;
        }

        if (this.DEBUG_GRENADE) {
            if (this._debugRadiusRing) {
                this._debugRadiusRing.position.set(x, landed ? landingY + 0.02 : y, z);
                this._debugRadiusRing.visible = true;
            }
            if (this._debugInnerRing) {
                this._debugInnerRing.position.set(x, landed ? landingY + 0.03 : y, z);
                this._debugInnerRing.visible = true;
            }
        }
    },

    update: function(deltaTime) {
        const deltaSec = deltaTime / 1000;

        for (let i = this._grenades.length - 1; i >= 0; i--) {
            const g = this._grenades[i];
            g.update(deltaTime);

            if (g.exploded) {
                this._onGrenadeExploded(g);
                g.dispose();
                this._grenades.splice(i, 1);
                if (this._activeGrenade === g) {
                    this._activeGrenade = null;
                    if (typeof WeaponSystem !== 'undefined') {
                        WeaponSystem._grenadeThrown = false;
                    }
                }
            } else if (g.expired) {
                g.dispose();
                this._grenades.splice(i, 1);
                if (this._activeGrenade === g) {
                    this._activeGrenade = null;
                    if (typeof WeaponSystem !== 'undefined') {
                        WeaponSystem._grenadeThrown = false;
                    }
                }
            }
        }

        if (this._isAiming && !this._activeGrenade) {
            this.updateTrajectoryPreview();
        }
    },

    _onGrenadeExploded: function(grenade) {
        const cx = grenade.x;
        const cy = grenade.y;
        const cz = grenade.z;
        const radius = grenade.explosionRadius;
        const maxDamage = grenade.maxDamage;
        const innerRadius = grenade.innerRadius;
        console.log('[GRENADE] explode at', cx.toFixed(1), cy.toFixed(1), cz.toFixed(1));

        if (typeof Renderer3D !== 'undefined' && Renderer3D.scene) {
            this._createExplosionVFX(cx, cy, cz, radius);
        }

        let zombieHits = 0;
        const zombies = (typeof GameState !== 'undefined') ? (GameState.zombies || []) : [];
        for (let i = 0; i < zombies.length; i++) {
            const z = zombies[i];
            if (!z || z.hp <= 0) continue;
            const dx = z.x - cx;
            const dz = z.z - cz;
            const dist = Math.sqrt(dx * dx + dz * dz);
            if (dist <= radius) {
                let damage;
                if (dist <= innerRadius) {
                    damage = maxDamage;
                } else {
                    const t = (dist - innerRadius) / (radius - innerRadius);
                    const falloff = 1 - t;
                    damage = maxDamage * falloff * falloff;
                }
                damage = Math.max(1, Math.round(damage));
                z.takeDamage(damage);
                zombieHits++;
                if (typeof WeaponSystem !== 'undefined' && WeaponSystem.spawnDamageNumber) {
                    const pos = z.mesh3D ? new THREE.Vector3(z.mesh3D.position.x, z.mesh3D.position.y + 1.2, z.mesh3D.position.z) : new THREE.Vector3(z.x, z.y + 1.2, z.z);
                    WeaponSystem.spawnDamageNumber(damage, false, pos);
                }
            }
        }
        console.log('[GRENADE] damage applied to', zombieHits, 'zombies');

        if (typeof GameState !== 'undefined' && typeof PlayerController !== 'undefined' && !PlayerController.isDead && !PlayerController.isRespawning) {
            const dx = PlayerController.position.x - cx;
            const dz = PlayerController.position.z - cz;
            const dist = Math.sqrt(dx * dx + dz * dz);
            if (dist <= radius) {
                let damage;
                if (dist <= innerRadius) {
                    damage = maxDamage;
                } else {
                    const t = (dist - innerRadius) / (radius - innerRadius);
                    const falloff = 1 - t;
                    damage = maxDamage * falloff * falloff;
                }
                damage = Math.max(1, Math.round(damage));
                GameState.damagePlayer(damage, 'grenade', cx, cz);
                console.log('[GRENADE] player self-damage', damage);
            }
        }

        if (typeof NoiseSystem !== 'undefined' && typeof NoiseSystem.emit === 'function') {
            NoiseSystem.emit({
                x: cx,
                z: cz,
                radius: this.GRENADE_FUTURE_NOISE_RADIUS,
                intensity: 1.0,
                type: 'explosion',
                source: 'grenade'
            });
        }
    },

    _createExplosionVFX: function(x, y, z, radius) {
        if (!Renderer3D || !Renderer3D.scene) return;

        const flashGeo = new THREE.SphereGeometry(0.6, 8, 8);
        const flashMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1.0, depthWrite: false });
        const flash = new THREE.Mesh(flashGeo, flashMat);
        flash.position.set(x, y, z);
        flash.renderOrder = 1000;
        flash.frustumCulled = false;
        Renderer3D.scene.add(flash);

        const fireballGeo = new THREE.SphereGeometry(radius * 0.5, 12, 12);
        const fireballMat = new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.9, depthWrite: false });
        const fireball = new THREE.Mesh(fireballGeo, fireballMat);
        fireball.position.set(x, y, z);
        fireball.renderOrder = 999;
        fireball.frustumCulled = false;
        Renderer3D.scene.add(fireball);

        const smokeGeo = new THREE.RingGeometry(radius * 0.3, radius * 0.9, 24);
        const smokeMat = new THREE.MeshBasicMaterial({ color: 0x444444, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide });
        const smoke = new THREE.Mesh(smokeGeo, smokeMat);
        smoke.rotation.x = -Math.PI / 2;
        smoke.position.set(x, y + 0.1, z);
        smoke.renderOrder = 997;
        smoke.frustumCulled = false;
        Renderer3D.scene.add(smoke);

        const shockGeo = new THREE.RingGeometry(radius * 0.1, radius * 0.4, 24);
        const shockMat = new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide });
        const shock = new THREE.Mesh(shockGeo, shockMat);
        shock.rotation.x = -Math.PI / 2;
        shock.position.set(x, y + 0.05, z);
        shock.renderOrder = 998;
        shock.frustumCulled = false;
        Renderer3D.scene.add(shock);

        const debris = [];
        for (let i = 0; i < 8; i++) {
            const dGeo = new THREE.BoxGeometry(0.08, 0.08, 0.08);
            const dMat = new THREE.MeshBasicMaterial({ color: 0x553311, transparent: true, opacity: 0.9, depthWrite: false });
            const dMesh = new THREE.Mesh(dGeo, dMat);
            dMesh.position.set(
                x + (Math.random() - 0.5) * radius * 0.5,
                y + Math.random() * radius * 0.3,
                z + (Math.random() - 0.5) * radius * 0.5
            );
            dMesh.renderOrder = 1001;
            dMesh.frustumCulled = false;
            dMesh.userData.vel = new THREE.Vector3(
                (Math.random() - 0.5) * 6,
                Math.random() * 8 + 2,
                (Math.random() - 0.5) * 6
            );
            Renderer3D.scene.add(dMesh);
            debris.push(dMesh);
        }

        const startTime = performance.now();
        const duration = 700;

        const animateExplosion = () => {
            const elapsed = performance.now() - startTime;
            const progress = Math.min(1, elapsed / duration);

            if (progress < 0.15) {
                const p = progress / 0.15;
                flash.scale.setScalar(1 + p * 2);
                flashMat.opacity = 1 - p;
            } else {
                flash.visible = false;
            }

            if (progress < 0.4) {
                const p = progress / 0.4;
                fireball.scale.setScalar(1 + p * 1.5);
                fireballMat.opacity = 0.9 * (1 - p);
            } else {
                fireball.visible = false;
            }

            if (progress < 0.7) {
                const p = (progress - 0.3) / 0.4;
                smoke.scale.setScalar(1 + p * 2);
                smokeMat.opacity = 0.6 * (1 - p);
            } else {
                smoke.visible = false;
            }

            if (progress < 0.5) {
                const p = progress / 0.5;
                shock.scale.setScalar(1 + p * 3);
                shockMat.opacity = 0.8 * (1 - p);
            } else {
                shock.visible = false;
            }

            for (let i = 0; i < debris.length; i++) {
                const d = debris[i];
                d.position.x += d.userData.vel.x * 0.016;
                d.position.y += d.userData.vel.y * 0.016;
                d.position.z += d.userData.vel.z * 0.016;
                d.userData.vel.y -= 15 * 0.016;
                if (d.position.y < y) {
                    d.position.y = y;
                    d.userData.vel.y = 0;
                    d.userData.vel.x *= 0.8;
                    d.userData.vel.z *= 0.8;
                }
                d.material.opacity = Math.max(0, 0.9 - progress * 1.2);
            }

            if (progress < 1) {
                requestAnimationFrame(animateExplosion);
            } else {
                Renderer3D.scene.remove(flash);
                Renderer3D.scene.remove(fireball);
                Renderer3D.scene.remove(smoke);
                Renderer3D.scene.remove(shock);
                debris.forEach(d => Renderer3D.scene.remove(d));
                flashGeo.dispose(); flashMat.dispose();
                fireballGeo.dispose(); fireballMat.dispose();
                smokeGeo.dispose(); smokeMat.dispose();
                shockGeo.dispose(); shockMat.dispose();
                debris.forEach(d => {
                    d.geometry.dispose();
                    d.material.dispose();
                });
            }
        };

        requestAnimationFrame(animateExplosion);
    },

    getActiveGrenade: function() {
        return this._activeGrenade;
    },

    isAiming: function() {
        return this._isAiming;
    },

    reset: function() {
        this._grenades.forEach(g => g.dispose());
        this._grenades = [];
        this._activeGrenade = null;
        this._isAiming = false;
        if (typeof WeaponSystem !== 'undefined') {
            WeaponSystem._grenadeAiming = false;
            WeaponSystem._grenadeThrown = false;
        }
        if (this._trajectoryLine) this._trajectoryLine.visible = false;
        if (this._landingMarker) this._landingMarker.visible = false;
        if (this._debugRadiusRing) this._debugRadiusRing.visible = false;
        if (this._debugInnerRing) this._debugInnerRing.visible = false;
    }
};

class GrenadeProjectile {
    constructor(x, y, z, dirX, dirY, dirZ, speed, gravity, fuseAfterLand, maxDamage, explosionRadius, innerRadius) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.vx = dirX * speed;
        this.vy = dirY * speed;
        this.vz = dirZ * speed;
        this.gravity = gravity;
        this.fuseAfterLand = fuseAfterLand;
        this.maxDamage = maxDamage;
        this.explosionRadius = explosionRadius;
        this.innerRadius = innerRadius;
        this.collisionRadius = 0.3;
        this.landed = false;
        this.fuseTimer = 0;
        this.exploded = false;
        this.expired = false;
        this.angularVelX = (Math.random() - 0.5) * 12;
        this.angularVelY = (Math.random() - 0.5) * 12;
        this.angularVelZ = (Math.random() - 0.5) * 12;

        this.mesh = this._createMesh();
    }

    _createMesh() {
        const group = new THREE.Group();

        const loadedModel = (typeof WeaponRenderer !== 'undefined' && WeaponRenderer._models && WeaponRenderer._models['grenade'])
            ? WeaponRenderer._models['grenade']
            : null;

        if (loadedModel && loadedModel.clone) {
            const clone = loadedModel.clone(true);
            clone.visible = true;
            group.add(clone);
            console.log('[GRENADE] Using loaded GLB model for projectile');
        } else {
            const bodyGeo = new THREE.CylinderGeometry(0.08, 0.09, 0.18, 8);
            const bodyMat = new THREE.MeshStandardMaterial({ color: 0x3d4a2e, roughness: 0.7, metalness: 0.3 });
            const body = new THREE.Mesh(bodyGeo, bodyMat);
            body.rotation.z = Math.PI / 2;
            group.add(body);

            const capGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.04, 8);
            const capMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5, metalness: 0.6 });
            const capTop = new THREE.Mesh(capGeo, capMat);
            capTop.position.set(0, 0.11, 0);
            capTop.rotation.z = Math.PI / 2;
            group.add(capTop);

            const fuseGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.06, 6);
            const fuseMat = new THREE.MeshStandardMaterial({ color: 0xcc8844, roughness: 0.9, metalness: 0.1 });
            const fuse = new THREE.Mesh(fuseGeo, fuseMat);
            fuse.position.set(0, 0.14, 0);
            fuse.rotation.z = Math.PI / 2;
            group.add(fuse);

            const bandGeo = new THREE.TorusGeometry(0.095, 0.015, 6, 8);
            const bandMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.4, metalness: 0.7 });
            const band = new THREE.Mesh(bandGeo, bandMat);
            band.rotation.y = Math.PI / 2;
            group.add(band);

            console.warn('[GRENADE] Loaded model not available, using procedural fallback');
        }

        group.position.set(this.x, this.y, this.z);
        if (Renderer3D && Renderer3D.scene) {
            Renderer3D.scene.add(group);
        }
        return group;
    }

    _checkWorldCollision() {
        if (!Renderer3D || !Renderer3D._collisionMeshes) return false;
        const meshes = Renderer3D._collisionMeshes;
        const r = this.collisionRadius || 0.3;
        for (let i = 0; i < meshes.length; i++) {
            const mesh = meshes[i];
            if (!mesh || !mesh.isMesh || !mesh.visible) continue;
            const box = new THREE.Box3().setFromObject(mesh);
            if (box.isEmpty()) continue;
            if (box.max.y - box.min.y < 0.65) continue;

            const closestX = Math.max(box.min.x, Math.min(this.x, box.max.x));
            const closestY = Math.max(box.min.y, Math.min(this.y, box.max.y));
            const closestZ = Math.max(box.min.z, Math.min(this.z, box.max.z));

            const dx = this.x - closestX;
            const dy = this.y - closestY;
            const dz = this.z - closestZ;
            const distSq = dx * dx + dy * dy + dz * dz;

            if (distSq <= r * r) {
                return true;
            }
        }
        return false;
    },

    update(deltaTime) {
        if (this.exploded || this.expired) return;

        const deltaSec = deltaTime / 1000;

        if (!this.landed) {
            this.vy -= this.gravity * deltaSec;
            this.x += this.vx * deltaSec;
            this.y += this.vy * deltaSec;
            this.z += this.vz * deltaSec;

            const floorY = Renderer3D.getPlayerFloorHeight ? Renderer3D.getPlayerFloorHeight(this.x, this.z) : 0;
            if (this.y <= floorY) {
                this.y = floorY;
                this.landed = true;
                this.vx = 0;
                this.vy = 0;
                this.vz = 0;
                this.fuseTimer = this.fuseAfterLand;
                console.log('[GRENADE] landed at', this.x.toFixed(1), this.y.toFixed(1), this.z.toFixed(1), 'fuse=' + this.fuseAfterLand + 's');
            }

            if (this._checkWorldCollision()) {
                this.landed = true;
                this.vx = 0;
                this.vy = 0;
                this.vz = 0;
                this.fuseTimer = this.fuseAfterLand;
                console.log('[GRENADE] hit obstacle at', this.x.toFixed(1), this.y.toFixed(1), this.z.toFixed(1), 'fuse=' + this.fuseAfterLand + 's');
            }

            if (this.x < 0 || this.x > 1600 || this.z < 0 || this.z > 1600) {
                this.expired = true;
            }
        } else {
            this.fuseTimer -= deltaSec;
            if (this.fuseTimer <= 0) {
                console.log('[GRENADE] fuse done, explode');
                this.explode();
            }
        }

        if (this.mesh) {
            this.mesh.position.set(this.x, this.y, this.z);
            this.mesh.rotation.x += this.angularVelX * deltaSec;
            this.mesh.rotation.y += this.angularVelY * deltaSec;
            this.mesh.rotation.z += this.angularVelZ * deltaSec;
        }
    }

    explode() {
        this.exploded = true;
    }

    dispose() {
        if (this.mesh && Renderer3D && Renderer3D.scene) {
            Renderer3D.scene.remove(this.mesh);
            this.mesh.traverse(node => {
                if (node.geometry) node.geometry.dispose();
            });
            this.mesh = null;
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GrenadeSystem: GrenadeSystem, GrenadeProjectile: GrenadeProjectile };
}
