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

    init: function() {
        this._grenades = [];
        this._activeGrenade = null;
        this._isAiming = false;
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
        if (typeof WeaponSystem !== 'undefined') {
            WeaponSystem._grenadeAiming = true;
        }
        if (this._trajectoryDots) this._trajectoryDots.visible = true;
        if (this._landingMarker) this._landingMarker.visible = true;
        this.updateTrajectoryPreview();
        this._playThrowableSFX('aimStart');
        console.log('[GRENADE] aim started');
    },

    cancelAiming: function() {
        if (!this._isAiming) return;
        this._isAiming = false;
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
    },

    throwGrenade: function() {
        if (!this._isAiming) return;
        if (this._activeGrenade) return;
        const infiniteAmmo = typeof GameState !== 'undefined' && GameState.adminInfiniteAmmo;
        if (!infiniteAmmo && typeof WeaponSystem !== 'undefined' && WeaponSystem._grenadeCount <= 0) return;

        console.log('[GRENADE] throw requested');
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

        const solution = this._computeThrowSolution();
        const origin = solution.origin;
        const direction = solution.direction;
        const velocity = solution.velocity;
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
        console.log('[GRENADE] projectile visible=true');
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
                if (this.DEBUG_GRENADE) {
                    const origin = this._getThrowOrigin();
                    console.log('[THROWABLE AIM] mode=FPS mouseX=' + (typeof InputManager !== 'undefined' ? InputManager.mouseX : '?') + ' mouseY=' + (typeof InputManager !== 'undefined' ? InputManager.mouseY : '?') + ' yaw=' + (typeof InputManager !== 'undefined' ? InputManager.cameraYaw.toFixed(3) : '?') + ' pitch=' + (typeof InputManager !== 'undefined' ? InputManager.cameraPitch.toFixed(3) : '?') + ' origin=' + origin.x.toFixed(1) + ',' + origin.y.toFixed(1) + ',' + origin.z.toFixed(1));
                }
                return dir.normalize();
            }

            const w = Math.max(1, window.innerWidth);
            const h = Math.max(1, window.innerHeight);
            const mouseX = (typeof InputManager !== 'undefined' && typeof InputManager.mouseX === 'number') ? InputManager.mouseX : w * 0.5;
            const mouseY = (typeof InputManager !== 'undefined' && typeof InputManager.mouseY === 'number') ? InputManager.mouseY : h * 0.5;
            const normalizedX = mouseX / w;
            const normalizedY = mouseY / h;

            const baseYaw = (typeof InputManager !== 'undefined') ? InputManager.cameraYaw : 0;
            const yawOffset = (normalizedX - 0.5) * 2 * this.TPS_THROW_MAX_YAW_OFFSET;
            const yaw = baseYaw + yawOffset;

            const pitch = THREE.MathUtils.lerp(
                this.TPS_THROW_MAX_PITCH,
                this.TPS_THROW_MIN_PITCH,
                normalizedY
            );

            dir.set(
                Math.sin(yaw) * Math.cos(pitch),
                Math.sin(pitch),
                Math.cos(yaw) * Math.cos(pitch)
            );

            if (this.DEBUG_GRENADE) {
                const origin = this._getThrowOrigin();
                const velocity = dir.clone().multiplyScalar(this.GRENADE_THROW_SPEED);
                console.log('[THROWABLE AIM] mode=TPS mouseX=' + mouseX + ' mouseY=' + mouseY + ' yaw=' + yaw.toFixed(3) + ' pitch=' + pitch.toFixed(3) + ' origin=' + origin.x.toFixed(1) + ',' + origin.y.toFixed(1) + ',' + origin.z.toFixed(1) + ' velocity=' + velocity.x.toFixed(1) + ',' + velocity.y.toFixed(1) + ',' + velocity.z.toFixed(1));
            }

            return dir.normalize();
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

    _simulateTrajectory: function(origin, velocity, options) {
        options = options || {};
        const gravity = this.GRENADE_GRAVITY;
        const dt = 0.06;
        const maxTime = options.maxTime || 2.5;
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

        const collisionMeshes = (Renderer3D && Renderer3D._collisionMeshes) ? Renderer3D._collisionMeshes : [];
        const cachedBoxes = [];
        for (let i = 0; i < collisionMeshes.length; i++) {
            const mesh = collisionMeshes[i];
            if (!mesh || !mesh.isMesh || !mesh.visible) continue;
            const box = new THREE.Box3().setFromObject(mesh);
            if (box.isEmpty() || (box.max.y - box.min.y) < 0.65) continue;
            cachedBoxes.push(box);
        }

        let bounces = 0;
        for (let t = 0; t < maxTime; t += dt) {
            points.push(new THREE.Vector3(x, y, z));

            if (canBounce && bounces < maxBounces) {
                let nx = x + vx * dt;
                let ny = y + vy * dt;
                let nz = z + vz * dt;
                let bounced = false;

                for (let b = 0; b < cachedBoxes.length; b++) {
                    const box = cachedBoxes[b];
                    if (nx >= box.min.x - 0.1 && nx <= box.max.x + 0.1 &&
                        nz >= box.min.z - 0.1 && nz <= box.max.z + 0.1 &&
                        ny >= box.min.y - 0.1 && ny <= box.max.y + 0.1) {
                        bounced = true;
                        collisionPoint = new THREE.Vector3(x, y, z);
                        bouncePoints.push(collisionPoint.clone());

                        const penX = Math.max(box.min.x - x, 0, x - box.max.x);
                        const penY = Math.max(box.min.y - y, 0, y - box.max.y);
                        const penZ = Math.max(box.min.z - z, 0, z - box.max.z);

                        if (penY <= penX && penY <= penZ) {
                            vy = -vy * restitution;
                        } else if (penX <= penZ) {
                            vx = -vx * restitution;
                        } else {
                            vz = -vz * restitution;
                        }

                        vx *= damping;
                        vy *= damping;
                        vz *= damping;
                        bounces++;
                        break;
                    }
                }

                if (!bounced) {
                    x = nx;
                    y = ny;
                    z = nz;
                }
            } else {
                x += vx * dt;
                y += vy * dt;
                z += vz * dt;
            }

            vy -= gravity * dt;

            const floorY = Renderer3D.getPlayerFloorHeight ? Renderer3D.getPlayerFloorHeight(x, z) : 0;
            if (y <= floorY) {
                y = floorY;
                landed = true;
                landingY = floorY;
                if (!collisionPoint) collisionPoint = new THREE.Vector3(x, y, z);
                break;
            }

            for (let b = 0; b < cachedBoxes.length; b++) {
                const box = cachedBoxes[b];
                if (x >= box.min.x - 0.1 && x <= box.max.x + 0.1 &&
                    z >= box.min.z - 0.1 && z <= box.max.z + 0.1 &&
                    y >= box.min.y - 0.1 && y <= box.max.y + 0.1) {
                    landed = true;
                    landingY = y;
                    collisionPoint = new THREE.Vector3(x, y, z);
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
        const direction = this._getThrowDirection();
        const velocity = direction.clone().multiplyScalar(this.GRENADE_THROW_SPEED);

        const def = (typeof WeaponSystem !== 'undefined' && WeaponSystem.getCurrentDef)
            ? WeaponSystem.getCurrentDef()
            : null;
        const options = def ? {
            canBounce: def.canBounce || false,
            bounceRestitution: def.bounceRestitution || this.BOUNCE_RESTITUTION,
            bounceDamping: def.bounceDamping || this.BOUNCE_DAMPING,
            maxBounces: def.maxBounces || this.MAX_BOUNCES
        } : {};

        const trajectory = this._simulateTrajectory(origin, velocity, options);

        if (this.DEBUG_GRENADE) {
            console.log('[THROWABLE PROJECTILE] type=grenade origin=' + origin.x.toFixed(1) + ',' + origin.y.toFixed(1) + ',' + origin.z.toFixed(1) + ' velocity=' + velocity.x.toFixed(1) + ',' + velocity.y.toFixed(1) + ',' + velocity.z.toFixed(1) + ' landing=' + trajectory.landingPoint.x.toFixed(1) + ',' + trajectory.landingPoint.y.toFixed(1) + ',' + trajectory.landingPoint.z.toFixed(1) + ' landed=' + trajectory.landed);
        }

        return {
            origin: origin,
            direction: direction,
            velocity: velocity,
            trajectory: trajectory
        };
    },

    _getLandingMarkerState: function(landingPoint, landed, collisionPoint) {
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
                this._landingMarker.material.color.setHex(0xff0000);
                this._landingMarker.material.opacity = 0.65 + 0.35 * Math.abs(Math.sin(now * 0.008));
                this._landingMarker.scale.setScalar(1.6);
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

    updateTrajectoryPreview: function() {
        if (!this._isAiming || !Renderer3D || !Renderer3D.scene) return;

        const solution = this._computeThrowSolution();
        const points = solution.trajectory.points;
        const landingPoint = solution.trajectory.landingPoint;
        const landed = solution.trajectory.landed;
        const collisionPoint = solution.trajectory.collisionPoint;
        const bouncePoints = solution.trajectory.bouncePoints;

        this._updateTrajectoryDots(points);

        const markerState = this._getLandingMarkerState(landingPoint, landed, collisionPoint);
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
    }

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
                if (typeof GrenadeSystem !== 'undefined' && GrenadeSystem._playThrowableSFX) {
                    GrenadeSystem._playThrowableSFX('land');
                }
            }

            if (this._checkWorldCollision()) {
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
