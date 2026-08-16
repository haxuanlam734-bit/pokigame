/**
 * WEAPON-SYSTEM.JS - He thong vu khi hoan chinh
 * Ho tro: Melee | Semi-Auto | Full-Auto | Burst
 * Tich hop Free-Aim TPS, Fixed-Aim FPS, Crouch Zero-Spread (Phim C), 3D Tracers & Hit Marker
 */

// CONSTANTS / ENUMS
const FIRE_MODE = {
    MELEE:     'MELEE',
    SEMI_AUTO: 'SEMI_AUTO',
    FULL_AUTO: 'FULL_AUTO',
    BURST:     'BURST'
};

// WEAPON DEFINITIONS (Giam do lech tam toi thieu de ban chuan xac)
const WEAPON_DEFS = {
    sword: {
        id:              'sword',
        name:            'Katana',
        fireMode:        FIRE_MODE.MELEE,
        damage:          55,
        range:           2.8,
        attackCooldown:  0.70,
        hitWindowStart:  0.12,
        hitWindowEnd:    0.38,
        crosshairType:   'melee',
        modelPath:       'src/assets/weapon/MeleeWeapon.js/katana_low_poly.glb',
        // Visual-only attachment data. targetSize normalizes the GLB's native
        // units so it remains visible and proportional to the 1.6-unit player.
        attach: { px: 0.48, py: 0.58, pz: 0.12, rx: 0, ry: -Math.PI / 4, rz: -Math.PI / 6, targetSize: 1.25 }
    },
    pistol: {
        id:              'pistol',
        name:            'Desert Eagle',
        fireMode:        FIRE_MODE.SEMI_AUTO,
        damage:          45,
        fireRate:        0.32,
        range:           130,
        magazineSize:    8,
        reserveAmmo:     40,
        reloadTime:      1.60,
        // Độ lệch tâm rất nhỏ, bắn cực kỳ chuẩn
        baseSpread:      0.002,
        movementSpread:  0.004,
        fireSpread:      0.005,
        maxSpread:       0.014,
        spreadRecoveryRate: 0.08,
        recoil:          { vertical: 0.008, horizontal: 0.002 },
        falloffStart:    40,
        falloffEnd:      100,
        minDamageMult:   0.35,
        headshotMult:    2.2,
        tracer: {
            enabled:  true,
            color:    0xfff033,
            lifetime: 0.10
        },
        crosshairType:   'gun',
        modelPath:       'src/assets/weapon/RangedWeapon.js/free_fire_gun_desert_eagle.glb',
        attach: { px: 0.50, py: 0.60, pz: 0.16, rx: 0, ry: Math.PI / 2, rz: 0, targetSize: 0.72 }
    },
    ak: {
        id:              'ak',
        name:            'M4A1',
        fireMode:        FIRE_MODE.FULL_AUTO,
        damage:          28,
        fireRate:        0.10,
        range:           160,
        magazineSize:    30,
        reserveAmmo:     120,
        reloadTime:      2.20,
        // Độ lệch tâm rất nhỏ, sấy chụm và rõ ràng
        baseSpread:      0.0025,
        movementSpread:  0.005,
        fireSpread:      0.0012,
        maxSpread:       0.018,
        spreadRecoveryRate: 0.05,
        spreadCooldown:  0.4,
        recoil:          { vertical: 0.005, horizontal: 0.002 },
        falloffStart:    45,
        falloffEnd:      130,
        minDamageMult:   0.30,
        headshotMult:    1.8,
        tracer: {
            enabled:  true,
            color:    0xff8811,
            lifetime: 0.11
        },
        crosshairType:   'gun',
        modelPath:       'src/assets/weapon/RangedWeapon.js/gun_m4a1.glb',
        attach: { px: 0.50, py: 0.60, pz: 0.16, rx: 0, ry: Math.PI / 2, rz: 0, targetSize: 1.10 }
    }
};

const WeaponSystem = {
    currentId:          'pistol',
    _state:             {},
    _meleeAttacking:    false,
    _meleeAttackTimer:  0,
    _meleeHitDealt:     null,
    _reloading:         false,
    _reloadTimer:       0,
    _fireCooldown:      0,
    _firingContinuous:  false,
    _semiConsumed:      false,
    _burstActive:       false,
    _burstShotsLeft:    0,
    _burstTimer:        0,

    // Dynamic Spread State
    _currentFireSpread: 0,
    _totalSpread:       0.0025,
    _spreadCooldownTimer: 0,
    _recoilQueue:       { vertical: 0, horizontal: 0 },

    // Hit Marker State
    _hitMarkerTimer:    0,
    _hitMarkerDuration: 0.12,

    // Callbacks
    onShoot:            null,
    onHit:              null,
    onMeleeSwing:       null,
    onMeleeHit:         null,
    onReloadStart:      null,
    onReloadEnd:        null,
    onEmptyClick:       null,

    init: function() {
        console.log('\u{1F5E1}\uFE0F Khoi tao WeaponSystem...');
        this._meleeHitDealt = new Set();
        for (const id in WEAPON_DEFS) {
            const def = WEAPON_DEFS[id];
            this._state[id] = {
                currentAmmo: def.magazineSize || 0,
                reserveAmmo: def.reserveAmmo  || 0,
                lastShotTime: -9999
            };
        }

        // Set default VFX handlers
        this.onShoot = function(def, muzzlePos) {
            if (typeof WeaponRenderer !== 'undefined' && WeaponRenderer.showMuzzleFlash) {
                WeaponRenderer.showMuzzleFlash();
            }
        };
        this.onHit = function(def, hitInfo) {
            if (typeof WeaponRenderer !== 'undefined' && hitInfo && hitInfo.point) {
                WeaponRenderer.createHitSpark(hitInfo.point);
            }
        };
        this.onMeleeHit = function(def, hitInfo) {
            if (typeof WeaponRenderer !== 'undefined' && hitInfo && hitInfo.zombie && hitInfo.zombie.mesh3D) {
                WeaponRenderer.createHitSpark(hitInfo.zombie.mesh3D.position);
            }
        };

        this.equip('pistol');
        console.log('\u2705 WeaponSystem san sang. Vu khi:', this.currentId);
    },

    equip: function(weaponId) {
        if (!WEAPON_DEFS[weaponId]) {
            console.warn('\u26A0\uFE0F WeaponSystem.equip: khong tim thay weapon', weaponId);
            return;
        }
        this._stopAllActions();
        const prev = this.currentId;
        this.currentId = weaponId;
        if (typeof WeaponRenderer !== 'undefined') {
            WeaponRenderer.onWeaponChanged(prev, weaponId);
        }
        this._currentFireSpread = 0;
        this._reloading         = false;
        this._reloadTimer       = 0;
        this._fireCooldown      = 0;
        this._updateAmmoHUD();
        console.log('\u{1F52B} Doi vu khi: ' + prev + ' -> ' + weaponId + ' (' + WEAPON_DEFS[weaponId].name + ')');
    },

    _stopAllActions: function() {
        this._firingContinuous = false;
        this._semiConsumed     = false;
        this._burstActive      = false;
        this._burstShotsLeft   = 0;
        this._burstTimer       = 0;
        this._meleeAttacking   = false;
        this._meleeAttackTimer = 0;
        if (this._meleeHitDealt) this._meleeHitDealt.clear();
    },

    update: function(deltaSec) {
        const def   = this.getCurrentDef();
        const state = this.getCurrentState();
        if (!def || !state) return;

        this._recoverRecoil(deltaSec);
        this._updateDynamicSpread(def, deltaSec);
        this._updateHitMarker(deltaSec);

        if (this._reloading) {
            this._reloadTimer -= deltaSec;
            if (this._reloadTimer <= 0) this._finishReload();
            return;
        }

        this._fireCooldown = Math.max(0, this._fireCooldown - deltaSec);

        switch (def.fireMode) {
            case FIRE_MODE.MELEE:     this._updateMelee(def, state, deltaSec);    break;
            case FIRE_MODE.SEMI_AUTO: this._updateSemiAuto(def, state, deltaSec); break;
            case FIRE_MODE.FULL_AUTO: this._updateFullAuto(def, state, deltaSec); break;
            case FIRE_MODE.BURST:     this._updateBurst(def, state, deltaSec);    break;
        }

        if (InputManager.isKeyPressed('r')) this.tryReload();
    },

    // ─── Dynamic Spread & Crouch Calculation ──────────
    _updateDynamicSpread: function(def, deltaSec) {
        if (def.fireMode === FIRE_MODE.MELEE) {
            this._totalSpread = 0;
            this._updateCrosshairUI(def);
            return;
        }

        // KHI CÚI NGƯỜI (PHÍM C): ZERO SPREAD - KHÔNG HỀ LỆCH TÂM!
        const isCrouching = (typeof PlayerController !== 'undefined' && PlayerController.isCrouching);
        if (isCrouching) {
            this._totalSpread = 0;
            this._currentFireSpread = 0;
            this._updateCrosshairUI(def, true);
            return;
        }

        const isMoving = (typeof PlayerController !== 'undefined' && PlayerController.hasMovementInput);
        const moveSpread = isMoving ? (def.movementSpread || 0.005) : 0;
        const base = def.baseSpread || 0.0025;

        // Spread recovery when not firing
        if (!InputManager.isMouseDown) {
            const recoveryRate = def.spreadRecoveryRate || 0.06;
            this._currentFireSpread = Math.max(0, this._currentFireSpread - recoveryRate * deltaSec);
        }

        this._totalSpread = Math.min(def.maxSpread || 0.02, base + moveSpread + this._currentFireSpread);
        this._updateCrosshairUI(def, false);
    },

    // ─── Crosshair UI & Free-Aim Positioning ──────────
    _updateCrosshairUI: function(def, isCrouching) {
        const ch = document.getElementById('combat-crosshair');
        if (!ch) return;

        // 1. POSITIONING: Free-Aim in TPS vs Center in FPS / Pointer Lock
        const isFPS = (typeof PlayerController !== 'undefined' && PlayerController.isFirstPersonMode);
        const isLocked = (typeof InputManager !== 'undefined' && InputManager.isPointerLocked);

        if (isFPS || isLocked) {
            // Tam khoa o chinh giua man hinh
            ch.style.left = '50%';
            ch.style.top  = '50%';
        } else {
            // Goc nhin thu 3 (TPS) tu do: Tam di chuyen theo chuot
            const mx = (typeof InputManager !== 'undefined' && InputManager.mouseX) || (window.innerWidth / 2);
            const my = (typeof InputManager !== 'undefined' && InputManager.mouseY) || (window.innerHeight / 2);
            ch.style.left = mx + 'px';
            ch.style.top  = my + 'px';
        }

        // 2. MELEE MODE
        if (def.fireMode === FIRE_MODE.MELEE) {
            ch.classList.add('melee-mode');
            ch.style.setProperty('--crosshair-gap', '3px');
            return;
        }
        ch.classList.remove('melee-mode');

        // 3. SPREAD GAP: Zero gap when crouching
        if (isCrouching) {
            ch.style.setProperty('--crosshair-gap', '2px');
            return;
        }

        const max = def.maxSpread || 0.02;
        const ratio = Math.max(0, Math.min(1, this._totalSpread / max));
        // Gap in pixels: from 3px at min spread to 14px at max spread (khong lech nhieu)
        const gapPx = Math.round(3 + ratio * 11);
        ch.style.setProperty('--crosshair-gap', gapPx + 'px');
    },

    // ─── Hit Marker System ───────────────────
    showHitMarker: function(isHeadshot) {
        this._hitMarkerTimer = this._hitMarkerDuration;
        const hm = document.getElementById('hit-marker');
        if (hm) {
            // Position hit marker at current crosshair location
            const isFPS = (typeof PlayerController !== 'undefined' && PlayerController.isFirstPersonMode);
            const isLocked = (typeof InputManager !== 'undefined' && InputManager.isPointerLocked);
            if (isFPS || isLocked) {
                hm.style.left = '50%';
                hm.style.top  = '50%';
            } else {
                const mx = (typeof InputManager !== 'undefined' && InputManager.mouseX) || (window.innerWidth / 2);
                const my = (typeof InputManager !== 'undefined' && InputManager.mouseY) || (window.innerHeight / 2);
                hm.style.left = mx + 'px';
                hm.style.top  = my + 'px';
            }

            hm.classList.remove('active', 'headshot');
            void hm.offsetWidth;
            hm.classList.add('active');
            if (isHeadshot) {
                hm.classList.add('headshot');
                this._showHeadshotToast();
            }
        }
    },

    _showHeadshotToast: function() {
        const toast = document.getElementById('headshot-toast');
        if (toast) {
            const isFPS = (typeof PlayerController !== 'undefined' && PlayerController.isFirstPersonMode);
            const isLocked = (typeof InputManager !== 'undefined' && InputManager.isPointerLocked);
            if (isFPS || isLocked) {
                toast.style.left = '50%';
                toast.style.top  = 'calc(50% - 35px)';
            } else {
                const mx = (typeof InputManager !== 'undefined' && InputManager.mouseX) || (window.innerWidth / 2);
                const my = (typeof InputManager !== 'undefined' && InputManager.mouseY) || (window.innerHeight / 2);
                toast.style.left = mx + 'px';
                toast.style.top  = (my - 35) + 'px';
            }

            toast.classList.remove('show');
            void toast.offsetWidth;
            toast.classList.add('show');
            setTimeout(function() {
                if (toast) toast.classList.remove('show');
            }, 600);
        }
    },

    _updateHitMarker: function(deltaSec) {
        if (this._hitMarkerTimer > 0) {
            this._hitMarkerTimer -= deltaSec;
            if (this._hitMarkerTimer <= 0) {
                const hm = document.getElementById('hit-marker');
                if (hm) hm.classList.remove('active', 'headshot');
            }
        }
    },

    // ─────────────── MELEE ───────────────────
    _updateMelee: function(def, state, deltaSec) {
        if (this._meleeAttacking) {
            this._meleeAttackTimer += deltaSec;
            if (this._meleeAttackTimer >= def.hitWindowStart && this._meleeAttackTimer <= def.hitWindowEnd) {
                this._performMeleeHitDetection(def);
            }
            if (this._meleeAttackTimer >= def.attackCooldown) {
                this._meleeAttacking   = false;
                this._meleeAttackTimer = 0;
                this._meleeHitDealt.clear();
                if (typeof WeaponRenderer !== 'undefined') WeaponRenderer.resetMeleeAnim();
            }
        } else {
            if (InputManager.isMouseJustPressed) {
                this._meleeAttacking   = true;
                this._meleeAttackTimer = 0;
                this._meleeHitDealt.clear();
                if (typeof WeaponRenderer !== 'undefined') WeaponRenderer.playMeleeSwingAnim();
                if (this.onMeleeSwing) this.onMeleeSwing(def);
            }
        }
    },

    _performMeleeHitDetection: function(def) {
        if (!PlayerController || !GameState) return;
        const px  = PlayerController.position.x;
        const pz  = PlayerController.position.z;
        const yaw = InputManager.cameraYaw;
        const forwardX = -Math.sin(yaw);
        const forwardZ = -Math.cos(yaw);
        const zombies = GameState.zombies || [];
        for (let i = 0; i < zombies.length; i++) {
            const zombie = zombies[i];
            if (!zombie || zombie.hp <= 0) continue;
            if (this._meleeHitDealt.has(zombie)) continue;
            const dx = zombie.x - px;
            const dz = zombie.z - pz;
            const dist = Math.sqrt(dx * dx + dz * dz);
            if (dist > def.range) continue;
            const dot = (dx / dist) * forwardX + (dz / dist) * forwardZ;
            if (dot < -0.1) continue;
            this._meleeHitDealt.add(zombie);
            zombie.takeDamage(def.damage);
            const hitInfo = { zombie: zombie, dist: dist, damage: def.damage };
            if (this.onMeleeHit) this.onMeleeHit(def, hitInfo);
            this.showHitMarker(false);
            console.log('\u{1F5E1}\uFE0F Melee hit! Dist=' + dist.toFixed(1) + ' Dmg=' + def.damage);
        }
    },

    // ─────────────── SEMI-AUTO ───────────────
    _updateSemiAuto: function(def, state, deltaSec) {
        if (InputManager.isMouseJustPressed && !this._semiConsumed) {
            this._semiConsumed = true;
            if (this._fireCooldown <= 0) this._attemptFire(def, state);
        }
        if (!InputManager.isMouseDown) this._semiConsumed = false;
    },

    // ─────────────── FULL-AUTO ───────────────
    _updateFullAuto: function(def, state, deltaSec) {
        if (InputManager.isMouseDown) {
            if (this._fireCooldown <= 0) this._attemptFire(def, state);
            this._firingContinuous = true;
        } else {
            if (this._firingContinuous) {
                this._spreadCooldownTimer = def.spreadCooldown || 0.4;
                this._firingContinuous    = false;
            }
        }
    },

    // ─────────────── BURST ───────────────────
    _updateBurst: function(def, state, deltaSec) {
        if (this._burstActive) {
            this._burstTimer -= deltaSec;
            if (this._burstTimer <= 0 && this._burstShotsLeft > 0) {
                this._attemptFire(def, state);
                this._burstShotsLeft--;
                this._burstTimer = def.burstInterval || 0.08;
                if (this._burstShotsLeft <= 0) { this._burstActive = false; this._burstTimer = 0; }
            }
        } else {
            if (InputManager.isMouseJustPressed && this._fireCooldown <= 0) {
                this._burstActive    = true;
                this._burstShotsLeft = (def.burstCount || 3) - 1;
                this._burstTimer     = def.burstInterval || 0.08;
                this._attemptFire(def, state);
            }
        }
    },

    // ─────────────── FIRE (UNIFIED AIM & TRACER) ────────────
    _attemptFire: function(def, state) {
        if (state.currentAmmo <= 0) {
            if (this.onEmptyClick) this.onEmptyClick(def);
            console.log('Het dan! ' + def.name + ' - Nhan R de nap');
            this.tryReload();
            return;
        }
        state.currentAmmo--;
        this._fireCooldown = def.fireRate;

        // Increase spread on shot (tru khi dang cui nguoi)
        const isCrouching = (typeof PlayerController !== 'undefined' && PlayerController.isCrouching);
        if (!isCrouching) {
            this._currentFireSpread = Math.min(def.maxSpread || 0.02, this._currentFireSpread + (def.fireSpread || 0.0012));
        } else {
            this._currentFireSpread = 0;
        }

        state.lastShotTime = performance.now();

        // Perform unified raycast (TPS Free-Aim / FPS Center)
        this._doUnifiedHitscan(def);

        // Apply weapon recoil (giam recoil khi cui nguoi)
        if (!isCrouching) {
            this._applyRecoil(def);
        }

        // Hook muzzle flash
        if (this.onShoot) {
            const muzzlePos = (typeof WeaponRenderer !== 'undefined') ? WeaponRenderer.getMuzzleWorldPosition() : null;
            this.onShoot(def, muzzlePos);
        }

        if (state.currentAmmo === 0) this.tryReload();
        this._updateAmmoHUD();
    },

    /**
     * UNIFIED HITSCAN & FREE-AIM SYSTEM (TPS & FPS)
     * - O FPS / Pointer Lock: raycast tu tam man hinh (0, 0)
     * - O TPS tu do: raycast tu dung vi tri chuot (mouseX, mouseY) tren man hinh
     * - Ban tia tracer 3D cuc ro net tu Muzzle toi AimPoint
     */
    _doUnifiedHitscan: function(def) {
        if (!Renderer3D || !Renderer3D.camera) return;

        const isFPS = (typeof PlayerController !== 'undefined' && PlayerController.isFirstPersonMode);
        const isLocked = (typeof InputManager !== 'undefined' && InputManager.isPointerLocked);

        // 1. Calculate screen NDC coordinates
        let baseNdcX = 0;
        let baseNdcY = 0;

        if (!isFPS && !isLocked && typeof InputManager !== 'undefined') {
            const w = Math.max(1, window.innerWidth);
            const h = Math.max(1, window.innerHeight);
            baseNdcX = (InputManager.mouseX / w) * 2 - 1;
            baseNdcY = -(InputManager.mouseY / h) * 2 + 1;
        }

        // Apply spread (spread = 0 khi cui nguoi)
        const spread = this._totalSpread;
        const spreadX = (Math.random() - 0.5) * 2 * spread;
        const spreadY = (Math.random() - 0.5) * 2 * spread;

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(baseNdcX + spreadX, baseNdcY + spreadY), Renderer3D.camera);
        raycaster.far = def.range || 160;

        // 2. Gather targets: zombies + collision world meshes + ground
        const zombieMeshes = [];
        const zombies = (typeof GameState !== 'undefined') ? (GameState.zombies || []) : [];
        for (let i = 0; i < zombies.length; i++) {
            const z = zombies[i];
            if (z && z.mesh3D && z.hp > 0) zombieMeshes.push(z.mesh3D);
        }

        const worldMeshes = (Renderer3D._collisionMeshes || []);
        if (Renderer3D.ground) worldMeshes.push(Renderer3D.ground);

        const allTargets = zombieMeshes.concat(worldMeshes);

        // 3. Find hit intersection
        const intersects = raycaster.intersectObjects(allTargets, true);

        let aimPoint = null;
        let hitObject = null;
        let hitDistance = def.range || 160;

        if (intersects.length > 0) {
            const hit = intersects[0];
            aimPoint = hit.point;
            hitObject = hit.object;
            hitDistance = hit.distance;
        } else {
            // Miss: point at max range
            aimPoint = raycaster.ray.origin.clone().add(raycaster.ray.direction.clone().multiplyScalar(def.range || 160));
        }

        // 4. Muzzle World Position
        let muzzlePos = null;
        if (typeof WeaponRenderer !== 'undefined' && WeaponRenderer.getMuzzleWorldPosition) {
            muzzlePos = WeaponRenderer.getMuzzleWorldPosition();
        }
        if (!muzzlePos) {
            muzzlePos = new THREE.Vector3(
                PlayerController.position.x + 0.3,
                PlayerController.position.y + 0.8,
                PlayerController.position.z + 0.2
            );
        }

        // 5. Spawn 3D Glowing Beam Bullet Tracer (Muzzle -> AimPoint)
        if (typeof WeaponRenderer !== 'undefined' && WeaponRenderer.spawnTracer) {
            WeaponRenderer.spawnTracer(muzzlePos, aimPoint, def.tracer);
        }

        // 6. If hit zombie, process damage and hit marker
        if (hitObject) {
            const zombie = this._findZombieFromMesh(hitObject, zombies);
            if (zombie) {
                const headshot = this._isHeadshot(hitObject);
                const damage = this._calculateDamage(def, hitDistance, headshot);

                zombie.takeDamage(damage);
                this.showHitMarker(headshot);

                const hitInfo = { zombie: zombie, dist: hitDistance, damage: damage, point: aimPoint, isHeadshot: headshot };
                if (this.onHit) this.onHit(def, hitInfo);

                console.log('\u{1F3AF} ' + def.name + ' trung zombie! ' + (headshot ? '[HEADSHOT] ' : '') + 'Dist=' + hitDistance.toFixed(1) + 'm Dmg=' + damage);
            } else {
                if (typeof WeaponRenderer !== 'undefined' && WeaponRenderer.createWorldImpact) {
                    WeaponRenderer.createWorldImpact(aimPoint);
                }
            }
        }
    },

    _findZombieFromMesh: function(mesh, zombies) {
        for (let i = 0; i < zombies.length; i++) {
            const z = zombies[i];
            if (!z || !z.mesh3D) continue;
            let found = false;
            z.mesh3D.traverse(function(child) { if (child === mesh) found = true; });
            if (found) return z;
        }
        return null;
    },

    _isHeadshot: function(hitMesh) {
        if (!hitMesh) return false;
        let obj = hitMesh;
        while (obj) {
            const name = (obj.name || '').toLowerCase();
            if (name.includes('head') || name.includes('skull')) return true;
            obj = obj.parent;
            if (!obj || obj.type === 'Scene') break;
        }
        return false;
    },

    _calculateDamage: function(def, dist, isHeadshot) {
        let damage = def.damage;
        if (isHeadshot && def.headshotMult) {
            damage *= def.headshotMult;
        }
        if (def.falloffStart && def.falloffEnd && dist > def.falloffStart) {
            const t    = Math.min(1, (dist - def.falloffStart) / (def.falloffEnd - def.falloffStart));
            const mult = 1 - t * (1 - (def.minDamageMult || 0.3));
            damage *= mult;
        }
        return Math.max(1, Math.round(damage));
    },

    _applyRecoil: function(def) {
        if (!def.recoil) return;
        this._recoilQueue.vertical   += def.recoil.vertical;
        this._recoilQueue.horizontal += (Math.random() - 0.5) * 2 * def.recoil.horizontal;
        InputManager.targetPitch -= this._recoilQueue.vertical * 0.25;
        InputManager.targetYaw   += this._recoilQueue.horizontal * 0.15;
        InputManager.targetPitch  = Math.max(InputManager.minPitch, Math.min(InputManager.maxPitch, InputManager.targetPitch));
    },

    _recoverRecoil: function(deltaSec) {
        const recovery = 1 - Math.exp(-8 * deltaSec);
        this._recoilQueue.vertical   *= (1 - recovery * 0.4);
        this._recoilQueue.horizontal *= (1 - recovery * 0.5);
        if (Math.abs(this._recoilQueue.vertical)   < 0.001) this._recoilQueue.vertical   = 0;
        if (Math.abs(this._recoilQueue.horizontal)  < 0.001) this._recoilQueue.horizontal = 0;
    },

    tryReload: function() {
        if (this._reloading) return;
        const def   = this.getCurrentDef();
        const state = this.getCurrentState();
        if (!def || !state) return;
        if (def.fireMode === FIRE_MODE.MELEE) return;
        if (state.currentAmmo >= def.magazineSize) return;
        if (state.reserveAmmo <= 0) { console.log('Het dan du phong'); return; }
        this._firingContinuous = false;
        this._burstActive      = false;
        this._semiConsumed     = false;
        this._reloading   = true;
        this._reloadTimer = def.reloadTime;
        if (this.onReloadStart) this.onReloadStart(def);
        console.log('Nap dan ' + def.name + '... (' + def.reloadTime + 's)');
        this._updateAmmoHUD(true);
    },

    _finishReload: function() {
        const def   = this.getCurrentDef();
        const state = this.getCurrentState();
        if (!def || !state) return;
        const needed   = def.magazineSize - state.currentAmmo;
        const transfer = Math.min(needed, state.reserveAmmo);
        state.currentAmmo  += transfer;
        state.reserveAmmo  -= transfer;
        this._reloading   = false;
        this._reloadTimer = 0;
        if (this.onReloadEnd) this.onReloadEnd(def);
        console.log('Reload xong! [' + state.currentAmmo + '/' + state.reserveAmmo + ']');
        this._updateAmmoHUD();
    },

    _updateAmmoHUD: function(isReloading) {
        const def   = this.getCurrentDef();
        const state = this.getCurrentState();
        if (!def) return;
        const ammoEl = document.getElementById('ammo-display');
        if (ammoEl) {
            if (def.fireMode === FIRE_MODE.MELEE)      ammoEl.textContent = 'MELEE';
            else if (isReloading)                       ammoEl.textContent = 'RELOAD...';
            else                                        ammoEl.textContent = state.currentAmmo + '/' + state.reserveAmmo;
        }
        const weaponEl = document.getElementById('weapon-display');
        if (weaponEl) {
            const modeName = def.fireMode === FIRE_MODE.SEMI_AUTO ? 'SEMI'
                           : def.fireMode === FIRE_MODE.FULL_AUTO ? 'AUTO'
                           : def.fireMode === FIRE_MODE.BURST     ? 'BURST'
                           : 'MELEE';
            weaponEl.textContent = def.name + ' [' + modeName + ']';
        }
        ['sword', 'pistol', 'ak'].forEach(id => {
            const slot = document.getElementById('slot-' + id);
            if (slot) slot.classList.toggle('active', this.currentId === id);
        });
    },

    getCurrentDef:   function() { return WEAPON_DEFS[this.currentId] || null; },
    getCurrentState: function() { return this._state[this.currentId] || null; },
    isReloading:     function() { return this._reloading; },
    getAmmoText:     function() {
        const def = this.getCurrentDef(); const state = this.getCurrentState();
        if (!def || !state) return '';
        if (def.fireMode === FIRE_MODE.MELEE) return 'MELEE';
        if (this._reloading) return 'RELOAD...';
        return state.currentAmmo + '/' + state.reserveAmmo;
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { WeaponSystem: WeaponSystem, WEAPON_DEFS: WEAPON_DEFS, FIRE_MODE: FIRE_MODE };
}
