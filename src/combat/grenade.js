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
    _initialized: false,
    _collisionIndicator: null,
    _bounceMarker: null,
    _trajectoryDots: null,
    _landingMarkerState: 'valid',
    _noiseBuffer: null,
    _lastDangerWarningTime: 0,

    GRENADE_THROW_SPEED: 22,
    GRENADE_GRAVITY: 22,
    GRENADE_FUSE_AFTER_LANDING: 1.0,
    GRENADE_EXPLOSION_RADIUS: 12,
    GRENADE_MAX_DAMAGE: 100,
    GRENADE_INNER_RADIUS: 4,
    GRENADE_FUTURE_NOISE_RADIUS: 20,
    DEBUG_GRENADE: false,

    TRAJECTORY_DOT_COUNT: 20,
    SELF_DAMAGE_WARNING_RADIUS: 4.0,
    BOUNCE_RESTITUTION: 0.4,
    BOUNCE_DAMPING: 0.8,
    MAX_BOUNCES: 1,

    TPS_THROW_MAX_YAW_OFFSET: Math.PI * 0.35,
    TPS_THROW_MIN_PITCH: 0.087,
    TPS_THROW_MAX_PITCH: 1.134,

    THROW_POWER_MIN: 0.35,
    THROW_POWER_DEFAULT: 0.70,
    THROW_POWER_MAX: 1.00,
    POWER_KEY_STEP: 0.01,
    POWER_HOLD_DELAY: 200,
    POWER_HOLD_RATE: 20,
    MIN_THROW_DISTANCE: 4.0,
    MAX_THROW_SPEED: 38.0,

    _throwPower: 0.70,
    _powerQHeld: false,
    _powerEHeld: false,
    _powerPrevQ: false,
    _powerPrevE: false,
    _powerRepeatTimer: 0,
    _cursorRaycaster: null,
    _cursorNdc: null,

    init: function() {
        this._grenades = [];
        this._activeGrenade = null;
        this._isAiming = false;
        this._throwPower = this.THROW_POWER_DEFAULT;
        this._powerQHeld = false;
        this._powerEHeld = false;
        this._powerPrevQ = false;
        this._powerPrevE = false;
        this._powerRepeatTimer = 0;
        this._createTrajectoryObjects();
        this._initialized = true;
        console.log('[GRENADE] initialized');
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
        if (this._trajectoryDots) {
            Renderer3D.scene.remove(this._trajectoryDots);
            this._trajectoryDots = null;
        }
        if (this._collisionIndicator) {
            Renderer3D.scene.remove(this._collisionIndicator);
            this._collisionIndicator = null;
        }
        if (this._bounceMarker) {
            Renderer3D.scene.remove(this._bounceMarker);
            this._bounceMarker = null;
        }

        const dotCount = this.TRAJECTORY_DOT_COUNT;
        const dotGeo = new THREE.BufferGeometry();
        const dotPositions = new Float32Array(dotCount * 3);
        dotGeo.setAttribute('position', new THREE.BufferAttribute(dotPositions, 3));

        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext('2d');
        ctx.beginPath();
        ctx.arc(16, 16, 14, 0, Math.PI * 2);
        ctx.fillStyle = '#ff2222';
        ctx.fill();
        const texture = new THREE.CanvasTexture(canvas);

        const dotMat = new THREE.PointsMaterial({
            color: 0xff2222,
            size: 0.35,
            map: texture,
            transparent: true,
            opacity: 0.95,
            depthTest: false,
            depthWrite: false,
            sizeAttenuation: true
        });
        this._trajectoryDots = new THREE.Points(dotGeo, dotMat);
        this._trajectoryDots.visible = false;
        this._trajectoryDots.frustumCulled = false;
        this._trajectoryDots.renderOrder = 999;
        Renderer3D.scene.add(this._trajectoryDots);

        const collisionGeo = new THREE.SphereGeometry(0.25, 8, 8);
        const collisionMat = new THREE.MeshBasicMaterial({
            color: 0xff6600,
            transparent: true,
            opacity: 0.9,
            depthTest: false,
            depthWrite: false
        });
        this._collisionIndicator = new THREE.Mesh(collisionGeo, collisionMat);
        this._collisionIndicator.visible = false;
        this._collisionIndicator.frustumCulled = false;
        this._collisionIndicator.renderOrder = 998;
        Renderer3D.scene.add(this._collisionIndicator);

        const bounceGeo = new THREE.RingGeometry(0.25, 0.4, 16);
        const bounceMat = new THREE.MeshBasicMaterial({
            color: 0xffee00,
            transparent: true,
            opacity: 0.9,
            depthTest: false,
            depthWrite: false,
            side: THREE.DoubleSide
        });
        this._bounceMarker = new THREE.Mesh(bounceGeo, bounceMat);
        this._bounceMarker.rotation.x = -Math.PI / 2;
        this._bounceMarker.visible = false;
        this._bounceMarker.frustumCulled = false;
        this._bounceMarker.renderOrder = 997;
        Renderer3D.scene.add(this._bounceMarker);

        const ringGeo = new THREE.RingGeometry(0.4, 0.55, 24);
        const ringMat = new THREE.MeshBasicMaterial({
            color: 0xff2222,
            transparent: true,
            opacity: 0.9,
            depthTest: false,
            depthWrite: false,
            side: THREE.DoubleSide
        });
        this._landingMarker = new THREE.Mesh(ringGeo, ringMat);
        this._landingMarker.rotation.x = -Math.PI / 2;
        this._landingMarker.visible = false;
        this._landingMarker.frustumCulled = false;
        this._landingMarker.renderOrder = 996;
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
        this._throwPower = this.THROW_POWER_DEFAULT;
        this._powerQHeld = false;
        this._powerEHeld = false;
        this._powerPrevQ = false;
        this._powerPrevE = false;
        this._powerRepeatTimer = 0;
        if (typeof WeaponSystem !== 'undefined') {
            WeaponSystem._grenadeAiming = true;
        }
        if (this._trajectoryDots) this._trajectoryDots.visible = true;
        if (this._landingMarker) this._landingMarker.visible = true;
        this._updatePowerHUD();
        this.updateTrajectoryPreview();
        this._playThrowableSFX('aimStart');
        console.log('[GRENADE] aim started');
    },

    cancelAiming: function() {
        if (!this._isAiming) {
            this._hidePowerHUD();
            return;
        }
        this._isAiming = false;
        this._powerQHeld = false;
        this._powerEHeld = false;
        this._powerPrevQ = false;
        this._powerPrevE = false;
        this._powerRepeatTimer = 0;
        if (typeof WeaponSystem !== 'undefined') {
            WeaponSystem._grenadeAiming = false;
        }
        if (this._trajectoryDots) this._trajectoryDots.visible = false;
        if (this._landingMarker) this._landingMarker.visible = false;
        if (this._collisionIndicator) this._collisionIndicator.visible = false;
        if (this._bounceMarker) this._bounceMarker.visible = false;
        if (this._debugRadiusRing) this._debugRadiusRing.visible = false;
        if (this._debugInnerRing) this._debugInnerRing.visible = false;
        this._trajectoryPoints = [];
        this._landingMarkerState = 'valid';
        this._hidePowerHUD();
    },

    throwGrenade: function() {
        if (!this._isAiming) return;
        if (this._activeGrenade) return;
        const infiniteAmmo = typeof GameState !== 'undefined' && GameState.adminInfiniteAmmo;
        if (!infiniteAmmo && typeof WeaponSystem !== 'undefined' && WeaponSystem._grenadeCount <= 0) return;

        console.log('[GRENADE] throw requested');
        const solution = this._computeThrowSolution();
        this.cancelAiming();
        this._playThrowableSFX('throw');
        if (typeof WeaponSystem !== 'undefined') {
            WeaponSystem._grenadeAiming = false;
            if (!infiniteAmmo && WeaponSystem._grenadeCount > 0) {
                WeaponSystem._grenadeCount--;
            }
            WeaponSystem._updateAmmoHUD();
            WeaponSystem._grenadeThrown = false;
        }

        const origin = solution.origin;
        const velocity = solution.velocity;

        const grenade = new GrenadeProjectile(
            origin.x, origin.y, origin.z,
            velocity.x, velocity.y, velocity.z,
            this.GRENADE_GRAVITY,
            this.GRENADE_FUSE_AFTER_LANDING,
            this.GRENADE_MAX_DAMAGE,
            this.GRENADE_EXPLOSION_RADIUS,
            this.GRENADE_INNER_RADIUS
        );

        this._grenades.push(grenade);
        this._activeGrenade = grenade;
        console.log('[GRENADE] projectile launched');
    },

    _getThrowOrigin: function() {
        const pos = new THREE.Vector3();
        if (typeof WeaponRenderer !== 'undefined' && WeaponRenderer._weaponHolder) {
            WeaponRenderer._weaponHolder.getWorldPosition(pos);

            const offset = new THREE.Vector3();
            if (typeof Renderer3D !== 'undefined' && Renderer3D.camera) {
                const camDir = new THREE.Vector3();
                Renderer3D.camera.getWorldDirection(camDir);
                const right = new THREE.Vector3();
                right.crossVectors(camDir, new THREE.Vector3(0, 1, 0)).normalize();
                const up = new THREE.Vector3();
                up.crossVectors(right, camDir).normalize();

                offset.addScaledVector(camDir, 0.3);
                offset.addScaledVector(right, 0.15);
                offset.addScaledVector(up, 0.1);
            }
            pos.add(offset);
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
            const isFPS = (typeof PlayerController !== 'undefined' && PlayerController.isFirstPersonMode);
            const isLocked = (typeof InputManager !== 'undefined' && InputManager.isPointerLocked);

            if (isFPS || isLocked) {
                Renderer3D.camera.getWorldDirection(dir);
                return dir.normalize();
            }

            const w = Math.max(1, window.innerWidth);
            const h = Math.max(1, window.innerHeight);
            const mouseX = (typeof InputManager !== 'undefined' && typeof InputManager.mouseX === 'number') ? InputManager.mouseX : w * 0.5;
            const mouseY = (typeof InputManager !== 'undefined' && typeof InputManager.mouseY === 'number') ? InputManager.mouseY : h * 0.5;

            const ndcX = (mouseX / w) * 2 - 1;
            const ndcY = -(mouseY / h) * 2 + 1;

            if (!this._cursorRaycaster) {
                this._cursorRaycaster = new THREE.Raycaster();
                this._cursorNdc = new THREE.Vector2();
            }
            this._cursorNdc.set(ndcX, ndcY);
            this._cursorRaycaster.setFromCamera(this._cursorNdc, Renderer3D.camera);

            dir.copy(this._cursorRaycaster.ray.direction).normalize();
            return dir;
        } else if (typeof InputManager !== 'undefined') {
            const yaw = InputManager.cameraYaw;
            const pitch = InputManager.cameraPitch;
            dir.set(
                Math.sin(yaw) * Math.cos(pitch),
                -Math.sin(pitch),
                Math.cos(yaw) * Math.cos(pitch)
            );
            return dir.normalize();
        }

        return dir;
    },

    _findCursorWorldTarget: function() {
        const origin = this._getThrowOrigin();
        const isFPS = (typeof PlayerController !== 'undefined' && PlayerController.isFirstPersonMode);
        const isLocked = (typeof InputManager !== 'undefined' && InputManager.isPointerLocked);

        if (!Renderer3D || !Renderer3D.camera) {
            return new THREE.Vector3(origin.x, 0, origin.z + 15);
        }

        if (!this._cursorRaycaster) {
            this._cursorRaycaster = new THREE.Raycaster();
            this._cursorNdc = new THREE.Vector2();
        }

        if (isFPS || isLocked) {
            this._cursorNdc.set(0, 0);
        } else {
            const w = Math.max(1, window.innerWidth);
            const h = Math.max(1, window.innerHeight);
            const mouseX = (typeof InputManager !== 'undefined' && typeof InputManager.mouseX === 'number') ? InputManager.mouseX : w * 0.5;
            const mouseY = (typeof InputManager !== 'undefined' && typeof InputManager.mouseY === 'number') ? InputManager.mouseY : h * 0.5;
            const ndcX = (mouseX / w) * 2 - 1;
            const ndcY = -(mouseY / h) * 2 + 1;
            this._cursorNdc.set(ndcX, ndcY);
        }

        this._cursorRaycaster.setFromCamera(this._cursorNdc, Renderer3D.camera);
        const ray = this._cursorRaycaster.ray;

        const candidateMeshes = [];
        if (Renderer3D.ground && Renderer3D.ground.visible) {
            candidateMeshes.push(Renderer3D.ground);
        }
        if (Renderer3D._collisionMeshes && Array.isArray(Renderer3D._collisionMeshes)) {
            for (let i = 0; i < Renderer3D._collisionMeshes.length; i++) {
                const m = Renderer3D._collisionMeshes[i];
                if (m && m.isMesh && m.visible) {
                    candidateMeshes.push(m);
                }
            }
        }

        let hitPoint = null;
        if (candidateMeshes.length > 0) {
            const intersects = this._cursorRaycaster.intersectObjects(candidateMeshes, false);
            if (intersects.length > 0) {
                hitPoint = intersects[0].point.clone();
            }
        }

        if (!hitPoint) {
            if (ray.direction.y < -0.0001) {
                const t = -ray.origin.y / ray.direction.y;
                if (t > 0 && t < 300) {
                    hitPoint = ray.origin.clone().addScaledVector(ray.direction, t);
                }
            }
        }

        if (!hitPoint) {
            const maxAimDist = 50.0;
            hitPoint = ray.origin.clone().addScaledVector(ray.direction, maxAimDist);
        }

        if (Renderer3D.getPlayerFloorHeight) {
            const floorY = Renderer3D.getPlayerFloorHeight(hitPoint.x, hitPoint.z);
            if (hitPoint.y < floorY) {
                hitPoint.y = floorY;
            }
        }

        return hitPoint;
    },

    _computeSelectedTarget: function(origin, fullTarget) {
        const power = this._throwPower;
        const minPower = this.THROW_POWER_MIN;
        const maxPower = this.THROW_POWER_MAX;

        const powerFactor = Math.max(0, Math.min(1, (power - minPower) / (maxPower - minPower)));

        const dx = fullTarget.x - origin.x;
        const dz = fullTarget.z - origin.z;
        const fullHorizDist = Math.hypot(dx, dz);

        if (fullHorizDist < 0.01) {
            return fullTarget.clone();
        }

        const normDirX = dx / fullHorizDist;
        const normDirZ = dz / fullHorizDist;

        const minThrowDist = this.MIN_THROW_DISTANCE;
        const nearDist = Math.min(minThrowDist, fullHorizDist * 0.4);

        const targetDist = nearDist + (fullHorizDist - nearDist) * powerFactor;

        const selX = origin.x + normDirX * targetDist;
        const selZ = origin.z + normDirZ * targetDist;

        const tDist = targetDist / fullHorizDist;
        let selY = origin.y + (fullTarget.y - origin.y) * tDist;

        if (Renderer3D && Renderer3D.getPlayerFloorHeight) {
            const floorY = Renderer3D.getPlayerFloorHeight(selX, selZ);
            if (selY < floorY) {
                selY = floorY;
            }
        }

        return new THREE.Vector3(selX, selY, selZ);
    },

    _solveBallisticVelocity: function(origin, target, gravity, maxSpeed) {
        const g = gravity || this.GRENADE_GRAVITY || 22;
        const V_max = maxSpeed || this.MAX_THROW_SPEED || 38;

        const dx = target.x - origin.x;
        const dz = target.z - origin.z;
        const dy = target.y - origin.y;
        const R = Math.hypot(dx, dz);

        if (R < 0.1) {
            const T = 0.4;
            const vY = (dy + 0.5 * g * T * T) / T;
            return {
                velocity: new THREE.Vector3(0, vY, 0),
                speed: Math.abs(vY),
                flightTime: T,
                reachable: true
            };
        }

        const dist3D = Math.hypot(R, dy);
        const vMinSq = g * (dy + dist3D);
        const vMin = Math.sqrt(Math.max(0.1, vMinSq));

        let reachable = true;
        let V;

        if (vMin > V_max) {
            reachable = false;
            V = V_max;
            const angle = Math.PI / 4 + Math.atan2(dy, R) * 0.5;
            const vHoriz = V * Math.cos(angle);
            const vY = V * Math.sin(angle);
            const vx = (dx / R) * vHoriz;
            const vz = (dz / R) * vHoriz;
            return {
                velocity: new THREE.Vector3(vx, vY, vz),
                speed: V,
                flightTime: R / Math.max(0.001, vHoriz),
                reachable: false
            };
        }

        const vDesired = Math.sqrt(g * R) * 1.18 + Math.max(0, dy * 0.45);
        V = Math.max(vMin * 1.05, Math.min(V_max, vDesired));

        const term = V * V * V * V - g * (g * R * R + 2 * dy * V * V);
        const D = Math.max(0, term);
        const tanTheta = (V * V - Math.sqrt(D)) / (g * R);

        const cosTheta = 1 / Math.sqrt(1 + tanTheta * tanTheta);
        const sinTheta = tanTheta * cosTheta;

        const vHoriz = V * cosTheta;
        const vY = V * sinTheta;

        const vx = (dx / R) * vHoriz;
        const vz = (dz / R) * vHoriz;
        const flightTime = R / Math.max(0.001, vHoriz);

        return {
            velocity: new THREE.Vector3(vx, vY, vz),
            speed: V,
            flightTime: flightTime,
            reachable: true
        };
    },

    _queryWorldCollision: function(pos, radius) {
        if (!Renderer3D || !Renderer3D._collisionMeshes) return null;
        const meshes = Renderer3D._collisionMeshes;
        const r = radius || 0.3;

        for (let i = 0; i < meshes.length; i++) {
            const mesh = meshes[i];
            if (!mesh || !mesh.isMesh || !mesh.visible) continue;
            const box = new THREE.Box3().setFromObject(mesh);
            if (box.isEmpty()) continue;
            if (box.max.y - box.min.y < 0.65) continue;

            const closestX = Math.max(box.min.x, Math.min(pos.x, box.max.x));
            const closestY = Math.max(box.min.y, Math.min(pos.y, box.max.y));
            const closestZ = Math.max(box.min.z, Math.min(pos.z, box.max.z));

            const dx = pos.x - closestX;
            const dy = pos.y - closestY;
            const dz = pos.z - closestZ;
            const distSq = dx * dx + dy * dy + dz * dz;

            if (distSq <= r * r) {
                let nx = 0, ny = 0, nz = 0;
                if (distSq > 0.0001) {
                    const len = Math.sqrt(distSq);
                    nx = dx / len;
                    ny = dy / len;
                    nz = dz / len;
                } else {
                    const penX = Math.max(box.min.x - pos.x, 0, pos.x - box.max.x);
                    const penY = Math.max(box.min.y - pos.y, 0, pos.y - box.max.y);
                    const penZ = Math.max(box.min.z - pos.z, 0, pos.z - box.max.z);
                    const minPen = Math.min(penX, penY, penZ);
                    if (minPen === penY) ny = pos.y < (box.min.y + box.max.y) * 0.5 ? -1 : 1;
                    else if (minPen === penX) nx = pos.x < (box.min.x + box.max.x) * 0.5 ? -1 : 1;
                    else nz = pos.z < (box.min.z + box.max.z) * 0.5 ? -1 : 1;
                }

                const type = (Math.abs(ny) > 0.5) ? 'floor' : 'wall';

                return {
                    hit: true,
                    point: new THREE.Vector3(closestX, closestY, closestZ),
                    normal: new THREE.Vector3(nx, ny, nz).normalize(),
                    mesh: mesh,
                    type: type
                };
            }
        }
        return null;
    },

    _simulateTrajectory: function(origin, velocity, options) {
        options = options || {};
        const gravity = this.GRENADE_GRAVITY;
        const dt = 0.016;
        const maxTime = options.maxTime || 3.0;
        const canBounce = options.canBounce || false;
        const restitution = options.bounceRestitution || this.BOUNCE_RESTITUTION;
        const damping = options.bounceDamping || this.BOUNCE_DAMPING;
        const maxBounces = options.maxBounces || this.MAX_BOUNCES;

        let x = origin.x, y = origin.y, z = origin.z;
        let vx = velocity.x, vy = velocity.y, vz = velocity.z;
        let landed = false;
        let landingY = 0;
        const points = [];
        let collisionPoint = null;
        const bouncePoints = [];

        let bounces = 0;
        for (let t = 0; t < maxTime; t += dt) {
            points.push(new THREE.Vector3(x, y, z));

            vy -= gravity * dt;
            x += vx * dt;
            y += vy * dt;
            z += vz * dt;

            const floorY = (Renderer3D && Renderer3D.getPlayerFloorHeight) ? Renderer3D.getPlayerFloorHeight(x, z) : 0;
            if (y <= floorY) {
                y = floorY;
                landed = true;
                landingY = floorY;
                if (!collisionPoint) collisionPoint = new THREE.Vector3(x, y, z);
                break;
            }

            const col = this._queryWorldCollision(new THREE.Vector3(x, y, z), 0.3);
            if (col && col.hit) {
                if (canBounce && bounces < maxBounces && col.type === 'wall') {
                    collisionPoint = col.point.clone();
                    bouncePoints.push(collisionPoint.clone());

                    const v = new THREE.Vector3(vx, vy, vz);
                    const dot = v.dot(col.normal);
                    const reflected = v.sub(col.normal.clone().multiplyScalar(2 * dot));
                    reflected.multiplyScalar(restitution);
                    reflected.multiplyScalar(damping);

                    vx = reflected.x;
                    vy = reflected.y;
                    vz = reflected.z;

                    x = col.point.x + col.normal.x * 0.35;
                    y = col.point.y + col.normal.y * 0.35;
                    z = col.point.z + col.normal.z * 0.35;

                    bounces++;
                } else {
                    landed = true;
                    landingY = y;
                    collisionPoint = col.point.clone();
                    break;
                }
            }

            if (x < 0 || x > 1600 || z < 0 || z > 1600) {
                landed = true;
                landingY = y;
                break;
            }
        }

        points.push(new THREE.Vector3(x, y, z));

        return {
            points: points,
            landingPoint: new THREE.Vector3(x, landed ? landingY : y, z),
            landed: landed,
            landingY: landingY,
            collisionPoint: collisionPoint,
            bouncePoints: bouncePoints
        };
    },

    _computeThrowSolution: function() {
        const origin = this._getThrowOrigin();
        const fullTarget = this._findCursorWorldTarget();
        const selectedTarget = this._computeSelectedTarget(origin, fullTarget);

        const def = (typeof WeaponSystem !== 'undefined' && WeaponSystem.getCurrentDef)
            ? WeaponSystem.getCurrentDef()
            : null;

        const gravity = (def && def.gravity) ? def.gravity : this.GRENADE_GRAVITY;
        const maxSpeed = this.MAX_THROW_SPEED || 38;

        const solve = this._solveBallisticVelocity(origin, selectedTarget, gravity, maxSpeed);
        const velocity = solve.velocity;
        const direction = velocity.clone().normalize();

        const options = def ? {
            canBounce: def.canBounce || false,
            bounceRestitution: def.bounceRestitution || this.BOUNCE_RESTITUTION,
            bounceDamping: def.bounceDamping || this.BOUNCE_DAMPING,
            maxBounces: def.maxBounces || this.MAX_BOUNCES,
            maxTime: Math.max(2.5, solve.flightTime + 1.0)
        } : {
            maxTime: Math.max(2.5, solve.flightTime + 1.0)
        };

        const trajectory = this._simulateTrajectory(origin, velocity, options);

        if (this.DEBUG_GRENADE) {
            console.log('[THROWABLE SOLUTION] power=' + this._throwPower.toFixed(2) + ' origin=' + origin.x.toFixed(1) + ',' + origin.y.toFixed(1) + ',' + origin.z.toFixed(1) + ' selected=' + selectedTarget.x.toFixed(1) + ',' + selectedTarget.y.toFixed(1) + ',' + selectedTarget.z.toFixed(1) + ' full=' + fullTarget.x.toFixed(1) + ',' + fullTarget.y.toFixed(1) + ',' + fullTarget.z.toFixed(1) + ' vel=' + velocity.x.toFixed(1) + ',' + velocity.y.toFixed(1) + ',' + velocity.z.toFixed(1) + ' landing=' + trajectory.landingPoint.x.toFixed(1) + ',' + trajectory.landingPoint.y.toFixed(1) + ',' + trajectory.landingPoint.z.toFixed(1));
        }

        return {
            origin: origin,
            fullTarget: fullTarget,
            selectedTarget: selectedTarget,
            direction: direction,
            velocity: velocity,
            speed: solve.speed,
            power: this._throwPower,
            reachable: solve.reachable,
            trajectory: trajectory
        };
    },

    _getLandingMarkerState: function(landingPoint, landed, collisionPoint, reachable) {
        if (reachable === false) {
            return 'blocked';
        }
        if (collisionPoint && !landed) {
            return 'blocked';
        }

        if (PlayerController && landingPoint) {
            const dx = landingPoint.x - PlayerController.position.x;
            const dz = landingPoint.z - PlayerController.position.z;
            const dist = Math.sqrt(dx * dx + dz * dz);
            if (dist < this.SELF_DAMAGE_WARNING_RADIUS) {
                return 'dangerous';
            }
        }

        return 'valid';
    },

    _updateLandingMarkerVisuals: function(state) {
        if (!this._landingMarker) return;

        const now = performance.now();
        switch (state) {
            case 'valid':
                this._landingMarker.material.color.setHex(0xff2222);
                this._landingMarker.material.opacity = 0.9;
                this._landingMarker.scale.setScalar(1);
                break;
            case 'blocked':
                this._landingMarker.material.color.setHex(0xff6600);
                this._landingMarker.material.opacity = 0.9;
                this._landingMarker.scale.setScalar(1.3);
                break;
            case 'dangerous':
                this._landingMarker.material.color.setHex(0xffaa00);
                this._landingMarker.material.opacity = 0.7 + 0.3 * Math.abs(Math.sin(now * 0.015));
                this._landingMarker.scale.setScalar(1.8);
                break;
        }
    },

    _updateCollisionIndicator: function(collisionPoint) {
        if (!this._collisionIndicator) return;

        if (collisionPoint) {
            this._collisionIndicator.position.copy(collisionPoint);
            this._collisionIndicator.visible = true;
            const pulse = 1 + 0.3 * Math.sin(performance.now() * 0.012);
            this._collisionIndicator.scale.setScalar(pulse);
        } else {
            this._collisionIndicator.visible = false;
        }
    },

    _updateBouncePreview: function(bouncePoints) {
        if (!this._bounceMarker) return;

        if (bouncePoints && bouncePoints.length > 0) {
            const lastBounce = bouncePoints[bouncePoints.length - 1];
            this._bounceMarker.position.copy(lastBounce);
            this._bounceMarker.position.y += 0.05;
            this._bounceMarker.visible = true;
        } else {
            this._bounceMarker.visible = false;
        }
    },

    _updateTrajectoryDots: function(points) {
        if (!this._trajectoryDots || points.length < 2) return;

        const positions = this._trajectoryDots.geometry.attributes.position.array;
        const count = this.TRAJECTORY_DOT_COUNT;
        const len = points.length;

        for (let i = 0; i < count; i++) {
            const t = len > 1 ? i / (count - 1) : 0;
            const idx = Math.min(Math.floor(t * (len - 1)), len - 1);
            const p = points[idx];
            positions[i * 3] = p.x;
            positions[i * 3 + 1] = p.y;
            positions[i * 3 + 2] = p.z;
        }

        this._trajectoryDots.geometry.attributes.position.needsUpdate = true;
        this._trajectoryDots.visible = true;
    },

    _playThrowableSFX: function(type) {
        if (typeof AudioController === 'undefined' || !AudioController._audioContext) return;
        if (AudioController._audioContext.state === 'suspended') return;

        try {
            const ctx = AudioController._audioContext;
            const now = ctx.currentTime;

            switch (type) {
                case 'aimStart':
                    this._playTone(ctx, now, 600, 0.06, 'sine', 0.02);
                    break;
                case 'danger':
                    this._playTone(ctx, now, 200, 0.12, 'sawtooth', 0.03);
                    break;
                case 'throw':
                    this._playNoiseBurst(ctx, now, 0.12, 0.06);
                    break;
                case 'bounce':
                    this._playTone(ctx, now, 120, 0.08, 'triangle', 0.04);
                    break;
                case 'land':
                    this._playTone(ctx, now, 80, 0.1, 'sine', 0.03);
                    break;
                case 'fuse':
                    this._playTone(ctx, now, 400, 0.03, 'square', 0.01);
                    break;
                case 'explosion':
                    this._playNoiseBurst(ctx, now, 0.35, 0.18);
                    this._playTone(ctx, now, 50, 0.25, 'sine', 0.12);
                    break;
            }
        } catch (e) {
            // ignore audio errors
        }
    },

    _playTone: function(ctx, now, freq, duration, type, volume) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(freq, now);
        osc.type = type;
        gain.gain.setValueAtTime(volume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
        osc.start(now);
        osc.stop(now + duration);
    },

    _playNoiseBurst: function(ctx, now, duration, volume) {
        if (!this._noiseBuffer) {
            const bufferSize = ctx.sampleRate * 0.5;
            this._noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const data = this._noiseBuffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }
        }
        const source = ctx.createBufferSource();
        source.buffer = this._noiseBuffer;
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1200, now);
        filter.frequency.exponentialRampToValueAtTime(80, now + duration);
        source.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        gain.gain.setValueAtTime(volume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
        source.start(now);
    },

    _processPowerKeys: function(deltaTime) {
        if (!this._isAiming) return;
        if (typeof InputManager === 'undefined' || !InputManager.keys) return;

        const qNow = !!(InputManager.keys['q'] || InputManager.keys['Q']);
        const eNow = !!(InputManager.keys['e'] || InputManager.keys['E']);

        const qJust = qNow && !this._powerPrevQ;
        const eJust = eNow && !this._powerPrevE;

        const step = this.POWER_KEY_STEP;

        if (qJust && !eNow) {
            this._adjustPower(step);
            this._powerQHeld = true;
            this._powerEHeld = false;
            this._powerRepeatTimer = 0;
        } else if (eJust && !qNow) {
            this._adjustPower(-step);
            this._powerEHeld = true;
            this._powerQHeld = false;
            this._powerRepeatTimer = 0;
        } else if (qJust && eNow) {
            this._powerQHeld = true;
            this._powerEHeld = false;
            this._powerRepeatTimer = 0;
        } else if (eJust && qNow) {
            this._powerEHeld = true;
            this._powerQHeld = false;
            this._powerRepeatTimer = 0;
        }

        if (this._powerQHeld && qNow && !eNow) {
            this._powerRepeatTimer += deltaTime;
            if (this._powerRepeatTimer >= this.POWER_HOLD_DELAY) {
                const elapsed = this._powerRepeatTimer - this.POWER_HOLD_DELAY;
                const interval = 1000 / this.POWER_HOLD_RATE;
                const steps = Math.floor(elapsed / interval);
                if (steps > 0) {
                    this._adjustPower(step * steps);
                    this._powerRepeatTimer = this.POWER_HOLD_DELAY + (elapsed % interval);
                }
            }
        } else if (this._powerEHeld && eNow && !qNow) {
            this._powerRepeatTimer += deltaTime;
            if (this._powerRepeatTimer >= this.POWER_HOLD_DELAY) {
                const elapsed = this._powerRepeatTimer - this.POWER_HOLD_DELAY;
                const interval = 1000 / this.POWER_HOLD_RATE;
                const steps = Math.floor(elapsed / interval);
                if (steps > 0) {
                    this._adjustPower(-step * steps);
                    this._powerRepeatTimer = this.POWER_HOLD_DELAY + (elapsed % interval);
                }
            }
        } else {
            this._powerQHeld = false;
            this._powerEHeld = false;
            this._powerRepeatTimer = 0;
        }

        this._powerPrevQ = qNow;
        this._powerPrevE = eNow;
    },

    _adjustPower: function(delta) {
        this._throwPower = Math.max(
            this.THROW_POWER_MIN,
            Math.min(this.THROW_POWER_MAX, Math.round((this._throwPower + delta) * 100) / 100)
        );
    },

    _updatePowerHUD: function() {
        const container = document.getElementById('throw-power-container');
        const powerBar = document.getElementById('throw-power-bar');
        const powerText = document.getElementById('throw-power-text');
        const powerHint = document.getElementById('throw-power-hint');

        if (!this._isAiming) {
            if (container) container.style.display = 'none';
            if (powerBar) powerBar.style.display = 'none';
            if (powerText) powerText.textContent = '';
            if (powerHint) powerHint.style.display = 'none';
            return;
        }

        const pct = Math.round(this._throwPower * 100);
        if (container) container.style.display = 'block';
        if (powerBar) {
            powerBar.style.display = 'block';
            powerBar.style.width = pct + '%';
        }
        if (powerText) powerText.textContent = pct + '%';
        if (powerHint) powerHint.style.display = 'block';
    },

    _hidePowerHUD: function() {
        const container = document.getElementById('throw-power-container');
        const powerBar = document.getElementById('throw-power-bar');
        const powerText = document.getElementById('throw-power-text');
        const powerHint = document.getElementById('throw-power-hint');
        if (container) container.style.display = 'none';
        if (powerBar) powerBar.style.display = 'none';
        if (powerText) powerText.textContent = '';
        if (powerHint) powerHint.style.display = 'none';
    },

    getThrowPower: function() {
        return this._throwPower;
    },

    updateTrajectoryPreview: function() {
        if (!this._isAiming || !Renderer3D || !Renderer3D.scene) return;

        const now = performance.now();

        const solution = this._computeThrowSolution();
        const points = solution.trajectory.points;
        const landingPoint = solution.trajectory.landingPoint;
        const landed = solution.trajectory.landed;
        const collisionPoint = solution.trajectory.collisionPoint;
        const bouncePoints = solution.trajectory.bouncePoints;
        const reachable = solution.reachable;

        this._updateTrajectoryDots(points);

        const markerState = this._getLandingMarkerState(landingPoint, landed, collisionPoint, reachable);
        this._landingMarkerState = markerState;

        if (markerState === 'dangerous') {
            const now = performance.now();
            if (now - this._lastDangerWarningTime > 1200) {
                this._lastDangerWarningTime = now;
                this._playThrowableSFX('danger');
            }
        }

        if (this._landingMarker) {
            this._landingMarker.position.copy(landingPoint);
            this._landingMarker.position.y += landed ? 0.05 : 0.02;
            this._landingMarker.visible = true;
            this._updateLandingMarkerVisuals(markerState);
        }

        this._updateCollisionIndicator(collisionPoint);
        this._updateBouncePreview(bouncePoints);

        if (this._debugInnerRing) {
            if (markerState === 'dangerous') {
                this._debugInnerRing.position.copy(landingPoint);
                this._debugInnerRing.position.y += landed ? 0.03 : 0.015;
                this._debugInnerRing.visible = true;
                this._debugInnerRing.material.color.setHex(0xffaa00);
                this._debugInnerRing.material.opacity = 0.5 + 0.3 * Math.abs(Math.sin(now * 0.02));
                this._debugInnerRing.scale.setScalar(1.4);
            } else {
                this._debugInnerRing.visible = false;
            }
        }

        if (this.DEBUG_GRENADE) {
            if (this._debugRadiusRing) {
                this._debugRadiusRing.position.copy(landingPoint);
                this._debugRadiusRing.position.y += landed ? 0.02 : 0.01;
                this._debugRadiusRing.visible = true;
            }
            if (this._debugInnerRing) {
                this._debugInnerRing.position.copy(landingPoint);
                this._debugInnerRing.position.y += landed ? 0.03 : 0.015;
                this._debugInnerRing.visible = true;
            }
            console.log('[GRENADE] trajectory updated');
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
            this._processPowerKeys(deltaTime);
            this._updatePowerHUD();
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
        this._playThrowableSFX('explosion');

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
                
                // Check Q-roll i-frame for explosion damage
                if (typeof PlayerController !== 'undefined' && PlayerController.isDodging) {
                    console.log('[GRENADE] player dodged explosion damage via Q-roll');
                    return;
                }

                // Check VIP Dash i-frame for explosion damage
                if (typeof PlayerController !== 'undefined' && PlayerController.isVipDashing) {
                    console.log('[GRENADE] player dodged explosion damage via VIP Dash');
                    return;
                }

                // Check Observation Haki dodge for explosion damage
                if (typeof ObservationHaki !== 'undefined' && ObservationHaki.isActive) {
                    const attackContext = {
                        source: 'grenade_explosion',
                        damage: damage,
                        attackerX: cx,
                        attackerZ: cz,
                        timestamp: Date.now()
                    };
                    
                    if (ObservationHaki.tryDodge(attackContext)) {
                        // Attack was dodged - skip damage
                        console.log('[GRENADE] player dodged explosion damage via Haki');
                        return;
                    }
                }
                
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
        if (this._trajectoryDots) this._trajectoryDots.visible = false;
        if (this._landingMarker) this._landingMarker.visible = false;
        if (this._collisionIndicator) this._collisionIndicator.visible = false;
        if (this._bounceMarker) this._bounceMarker.visible = false;
        if (this._debugRadiusRing) this._debugRadiusRing.visible = false;
        if (this._debugInnerRing) this._debugInnerRing.visible = false;
        this._landingMarkerState = 'valid';
        this._hidePowerHUD();
    }
};

class GrenadeProjectile {
    constructor(x, y, z, velX, velY, velZ, gravity, fuseAfterLand, maxDamage, explosionRadius, innerRadius) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.vx = velX;
        this.vy = velY;
        this.vz = velZ;
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
        this._bounced = false;

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

            const box = new THREE.Box3().setFromObject(clone);
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            if (maxDim > 0.0001) {
                const targetSize = 0.25;
                const scale = targetSize / maxDim;
                clone.scale.setScalar(scale);
            }

            group.add(clone);
            console.log('[GRENADE] Using loaded GLB model for projectile, normalized scale');
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

    update(deltaTime) {
        if (this.exploded || this.expired) return;

        const deltaSec = deltaTime / 1000;

        if (!this.landed) {
            this.vy -= this.gravity * deltaSec;
            this.x += this.vx * deltaSec;
            this.y += this.vy * deltaSec;
            this.z += this.vz * deltaSec;

            const floorY = (Renderer3D && Renderer3D.getPlayerFloorHeight) ? Renderer3D.getPlayerFloorHeight(this.x, this.z) : 0;
            if (this.y <= floorY) {
                this.y = floorY;
                this.landed = true;
                this.vx = 0;
                this.vy = 0;
                this.vz = 0;
                this.fuseTimer = this.fuseAfterLand;
                console.log('[GRENADE] landed at', this.x.toFixed(1), this.y.toFixed(1), this.z.toFixed(1), 'fuse=' + this.fuseAfterLand + 's');
                if (typeof GrenadeSystem !== 'undefined' && GrenadeSystem._playThrowableSFX) {
                    GrenadeSystem._playThrowableSFX('land');
                }
            }

            const col = GrenadeSystem._queryWorldCollision(new THREE.Vector3(this.x, this.y, this.z), this.collisionRadius || 0.3);
            if (col && col.hit && !this.landed) {
                const def = (typeof WeaponSystem !== 'undefined' && WeaponSystem.getCurrentDef) ? WeaponSystem.getCurrentDef() : null;
                const canBounce = def ? (def.canBounce || false) : false;
                const maxBounces = def ? (def.maxBounces || 1) : 1;
                const restitution = def ? (def.bounceRestitution || 0.55) : 0.55;
                const damping = def ? (def.bounceDamping || 0.82) : 0.82;

                if (canBounce && !this._bounced && col.type === 'wall') {
                    const v = new THREE.Vector3(this.vx, this.vy, this.vz);
                    const dot = v.dot(col.normal);
                    const reflected = v.sub(col.normal.clone().multiplyScalar(2 * dot));
                    reflected.multiplyScalar(restitution);
                    reflected.multiplyScalar(damping);

                    this.vx = reflected.x;
                    this.vy = reflected.y;
                    this.vz = reflected.z;

                    this.x = col.point.x + col.normal.x * 0.35;
                    this.y = col.point.y + col.normal.y * 0.35;
                    this.z = col.point.z + col.normal.z * 0.35;

                    this._bounced = true;
                    console.log('[GRENADE] bounced at', this.x.toFixed(1), this.y.toFixed(1), this.z.toFixed(1));
                    if (typeof GrenadeSystem !== 'undefined' && GrenadeSystem._playThrowableSFX) {
                        GrenadeSystem._playThrowableSFX('bounce');
                    }
                } else {
                    this.landed = true;
                    this.vx = 0;
                    this.vy = 0;
                    this.vz = 0;
                    this.fuseTimer = this.fuseAfterLand;
                    console.log('[GRENADE] hit obstacle at', this.x.toFixed(1), this.y.toFixed(1), this.z.toFixed(1), 'fuse=' + this.fuseAfterLand + 's');
                    if (typeof GrenadeSystem !== 'undefined' && GrenadeSystem._playThrowableSFX) {
                        GrenadeSystem._playThrowableSFX('bounce');
                    }
                }
            }

            if (this.x < 0 || this.x > 1600 || this.z < 0 || this.z > 1600) {
                this.expired = true;
            }
        } else {
            if (this.fuseTimer === this.fuseAfterLand && typeof GrenadeSystem !== 'undefined' && GrenadeSystem._playThrowableSFX) {
                GrenadeSystem._playThrowableSFX('fuse');
            }
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