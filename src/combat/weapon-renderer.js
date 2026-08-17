/**
 * WEAPON-RENDERER.JS - Load GLB weapon models, attach vao player, 
 * quan ly 3D Glowing Beam Tracer Object Pool, Muzzle Flash, Hit Sparks & Animations
 */

const WeaponRenderer = {
    // Three.js objects
    _weaponHolder:    null,   // THREE.Group gan vao player group tai vi tri tay phai
    _currentModel:    null,   // Model hien tai dang hien thi
    _models:          {},     // Cache cac model da load
    _loadPromises:    [],     // Used by the game loading screen to wait for GLB assets

    // Melee animation state
    _swingAnim:       false,
    _swingTimer:      0,
    _swingDuration:   0.32,

    // Muzzle flash
    _muzzleFlashTimer: 0,
    _muzzleFlashObj:  null,

    // ─── 3D Glowing Beam Tracer Pool (High Performance & Ultra Visible) ───
    _tracerPool:      [],
    _activeTracers:   [],
    _maxTracers:      30,

    init: function() {
        console.log('Khoi tao WeaponRenderer...');
        if (!Renderer3D || !Renderer3D.player) {
            console.warn('WeaponRenderer.init: Renderer3D.player chua co, thu lai sau...');
            setTimeout(function() { WeaponRenderer.init(); }, 200);
            return;
        }

        // Tao weapon holder gan vao rightHandSocket hoac player
        this._weaponHolder = new THREE.Group();
        this._weaponHolder.name = 'weaponHolder';
        if (Renderer3D.player && Renderer3D.player.rightHandSocket) {
            Renderer3D.player.rightHandSocket.add(this._weaponHolder);
            this._weaponHolder.position.set(0, 0, 0);
        } else {
            this._weaponHolder.position.set(0.45, 0.60, 0.15);
            Renderer3D.player.add(this._weaponHolder);
        }

        // Tao muzzle flash object
        this._createMuzzleFlash();

        // Khoi tao 3D Glowing Beam Tracer Pool
        this._initTracerPool();

        // Load model cho tat ca weapons
        this._preloadWeapons();

        console.log('WeaponRenderer san sang');
    },

    // ─── 3D Glowing Beam Tracer Pool ───
    _initTracerPool: function() {
        if (!Renderer3D || !Renderer3D.scene) return;

        for (let i = 0; i < this._maxTracers; i++) {
            // Beam core (ong tru 3D phat sang ro net o moi goc nhin)
            const radius = 0.07;
            const geo = new THREE.CylinderGeometry(radius, radius, 1, 6, 1, false);
            // Dat truc mac dinh cua cylinder theo Y huong len
            const mat = new THREE.MeshBasicMaterial({
                color: 0xffea00,
                transparent: true,
                opacity: 1.0,
                depthWrite: false
            });

            const beam = new THREE.Mesh(geo, mat);
            beam.visible = false;
            beam.frustumCulled = false;
            beam.name = 'tracer_beam_' + i;

            Renderer3D.scene.add(beam);

            this._tracerPool.push({
                mesh: beam,
                geometry: geo,
                material: mat,
                life: 0,
                maxLife: 0.10
            });
        }
    },

    /**
     * Ban tia sang 3D cuc ro tu startPos toi endPos
     */
    spawnTracer: function(startPos, endPos, config) {
        if (!startPos || !endPos || !Renderer3D || !Renderer3D.scene) return;

        let tracer = null;
        for (let i = 0; i < this._tracerPool.length; i++) {
            const item = this._tracerPool[i];
            if (!item.mesh.visible) {
                tracer = item;
                break;
            }
        }

        if (!tracer && this._activeTracers.length > 0) {
            tracer = this._activeTracers.shift();
        }

        if (!tracer) return;

        const cfg = config || {};
        const color = cfg.color || 0xffea00;
        const maxLife = cfg.lifetime || 0.10;

        const distance = startPos.distanceTo(endPos);
        if (distance < 0.1) return;

        const mid = new THREE.Vector3().addVectors(startPos, endPos).multiplyScalar(0.5);
        const dir = new THREE.Vector3().subVectors(endPos, startPos).normalize();

        // Dat vi tri o tam doan thang
        tracer.mesh.position.copy(mid);

        // Scale theo chieu dai doan thang
        tracer.mesh.scale.set(1, distance, 1);

        // Xoay cylinder (mac dinh doc Y) theo huong dir
        const up = new THREE.Vector3(0, 1, 0);
        tracer.mesh.quaternion.setFromUnitVectors(up, dir);

        tracer.material.color.setHex(color);
        tracer.material.opacity = 1.0;
        tracer.life = 0;
        tracer.maxLife = maxLife;
        tracer.mesh.visible = true;

        this._activeTracers.push(tracer);
    },

    _createMuzzleFlash: function() {
        const geo = new THREE.SphereGeometry(0.14, 8, 8);
        const mat = new THREE.MeshBasicMaterial({ color: 0xffea33, transparent: true, opacity: 0 });
        this._muzzleFlashObj = new THREE.Mesh(geo, mat);
        this._muzzleFlashObj.name = 'muzzleFlash';
    },

    _preloadWeapons: function() {
        if (typeof THREE === 'undefined' || !THREE.GLTFLoader) {
            console.warn('GLTFLoader chua co san, vu khi se dung placeholder');
            this._useFallbackForAll();
            return;
        }

        const loader = new THREE.GLTFLoader();
        const defs   = (typeof WEAPON_DEFS !== 'undefined') ? WEAPON_DEFS : {};

        for (const id in defs) {
            const def = defs[id];
            if (!def.modelPath) continue;
            this._loadModel(loader, id, def);
        }
    },

    _loadModel: function(loader, weaponId, def) {
        const self = this;
        const loadPromise = new Promise(function(resolve) {
        loader.load(
            def.modelPath,
            function(gltf) {
                const model = gltf.scene;
                model.traverse(function(child) {
                    if (child.isMesh) {
                        child.castShadow    = true;
                        child.receiveShadow = false;
                        if (!child.name) child.name = weaponId + '_mesh';
                    }
                });
                self._normalizeModel(model, def.attach);
                model.visible = false;
                self._models[weaponId] = model;
                self._weaponHolder.add(model);
                console.log('Load model thanh cong: ' + weaponId + ' (' + def.modelPath + ')');

                if (typeof WeaponSystem !== 'undefined' && WeaponSystem.currentId === weaponId) {
                    self._showModel(weaponId);
                }
                resolve(model);
            },
            undefined,
            function(err) {
                console.error('Loi load model ' + weaponId + ' (' + def.modelPath + '):', err);
                self._createFallbackModel(weaponId, def);
                resolve(null);
            }
        );
        });
        this._loadPromises.push(loadPromise);
    },

    // Models in the supplied GLBs use different native unit systems.  Scale
    // from the actual bounding box rather than a guessed number so a sword or
    // gun cannot end up microscopic or off-screen when its source is replaced.
    _normalizeModel: function(model, attach) {
        const targetSize = attach && attach.targetSize;
        if (!targetSize) return;

        model.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        box.getSize(size);
        box.getCenter(center);
        const largestDimension = Math.max(size.x, size.y, size.z);
        if (!Number.isFinite(largestDimension) || largestDimension <= 0.00001) return;

        const scale = targetSize / largestDimension;
        model.scale.setScalar(scale);
        // Centre the source model at the grip/attachment point.  This also
        // fixes GLBs whose geometry is exported far from their local origin.
        model.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
        model.traverse(function(child) {
            if (child.isMesh) child.frustumCulled = false;
        });
    },

    _createFallbackModel: function(weaponId, def) {
        let geo, mat, mesh;
        if (weaponId === 'sword') {
            geo  = new THREE.BoxGeometry(0.06, 0.9, 0.04);
            mat  = new THREE.MeshPhongMaterial({ color: 0xccccdd });
            mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(0, 0.45, 0);
            const guardGeo = new THREE.BoxGeometry(0.25, 0.04, 0.06);
            const guardMat = new THREE.MeshPhongMaterial({ color: 0x886633 });
            const guard    = new THREE.Mesh(guardGeo, guardMat);
            guard.position.set(0, 0, 0);
            const group = new THREE.Group();
            group.add(mesh);
            group.add(guard);
            group.name = weaponId + '_fallback';
            group.visible = false;
            this._models[weaponId] = group;
            this._weaponHolder.add(group);
        } else {
            geo  = new THREE.BoxGeometry(0.1, 0.12, 0.45);
            mat  = new THREE.MeshPhongMaterial({ color: weaponId === 'pistol' ? 0x333333 : 0x224422 });
            mesh = new THREE.Mesh(geo, mat);
            mesh.name = weaponId + '_fallback';
            mesh.visible = false;
            this._models[weaponId] = mesh;
            this._weaponHolder.add(mesh);
        }

        if (typeof WeaponSystem !== 'undefined' && WeaponSystem.currentId === weaponId) {
            this._showModel(weaponId);
        }
    },

    _useFallbackForAll: function() {
        const defs = (typeof WEAPON_DEFS !== 'undefined') ? WEAPON_DEFS : {};
        for (const id in defs) {
            this._createFallbackModel(id, defs[id]);
        }
    },

    onWeaponChanged: function(prevId, newId) {
        if (prevId && this._models[prevId]) {
            this._models[prevId].visible = false;
        }
        this._showModel(newId);
        this.resetMeleeAnim();
    },

    _showModel: function(weaponId) {
        const model = this._models[weaponId];
        const def   = (typeof WEAPON_DEFS !== 'undefined') ? WEAPON_DEFS[weaponId] : null;
        if (!model || !def) return;

        // Re-parent vao rightHandSocket neu model player da load
        if (Renderer3D && Renderer3D.player && Renderer3D.player.rightHandSocket) {
            if (this._weaponHolder && this._weaponHolder.parent !== Renderer3D.player.rightHandSocket) {
                Renderer3D.player.rightHandSocket.add(this._weaponHolder);
                this._weaponHolder.position.set(0, 0, 0);
            }
        }

        model.visible = true;

        const a = def.attach;
        if (a) {
            model.rotation.set(a.rx || 0, a.ry || 0, a.rz || 0);
            if (!Renderer3D.player || !Renderer3D.player.rightHandSocket) {
                this._weaponHolder.position.set(a.px || 0, a.py || 0, a.pz || 0);
            } else {
                this._weaponHolder.position.set(0, 0, 0);
            }
        }

        if (weaponId !== 'sword' && this._muzzleFlashObj) {
            model.add(this._muzzleFlashObj);
            this._muzzleFlashObj.position.set(0, 0, 0.45);
        }

        console.log('Hien thi model: ' + weaponId);
    },

    playMeleeSwingAnim: function() {
        this._swingAnim  = true;
        this._swingTimer = 0;
    },

    resetMeleeAnim: function() {
        this._swingAnim  = false;
        this._swingTimer = 0;
        if (this._weaponHolder) {
            this._weaponHolder.rotation.set(0, 0, 0);
        }
    },

    showMuzzleFlash: function() {
        if (!this._muzzleFlashObj) return;
        this._muzzleFlashObj.material.opacity = 1;
        this._muzzleFlashTimer = 0.06;
    },

    getMuzzleWorldPosition: function() {
        if (this._muzzleFlashObj && this._muzzleFlashObj.parent) {
            const pos = new THREE.Vector3();
            this._muzzleFlashObj.getWorldPosition(pos);
            return pos;
        }
        if (this._weaponHolder) {
            const pos = new THREE.Vector3();
            this._weaponHolder.getWorldPosition(pos);
            pos.y += 0.1;
            return pos;
        }
        return null;
    },

    // ─── Visual Impact Effects ───────────────
    createHitSpark: function(pos) {
        if (!Renderer3D || !Renderer3D.scene || !pos) return;
        const sparkGeo = new THREE.SphereGeometry(0.22, 6, 6);
        const sparkMat = new THREE.MeshBasicMaterial({ color: 0xff2211, transparent: true, opacity: 0.95 });
        const spark = new THREE.Mesh(sparkGeo, sparkMat);
        spark.position.copy(pos);
        Renderer3D.scene.add(spark);
        setTimeout(function() {
            if (Renderer3D && Renderer3D.scene) Renderer3D.scene.remove(spark);
        }, 90);
    },

    createWorldImpact: function(pos) {
        if (!Renderer3D || !Renderer3D.scene || !pos) return;
        const sparkGeo = new THREE.SphereGeometry(0.18, 6, 6);
        const sparkMat = new THREE.MeshBasicMaterial({ color: 0xffe055, transparent: true, opacity: 0.9 });
        const spark = new THREE.Mesh(sparkGeo, sparkMat);
        spark.position.copy(pos);
        Renderer3D.scene.add(spark);
        setTimeout(function() {
            if (Renderer3D && Renderer3D.scene) Renderer3D.scene.remove(spark);
        }, 75);
    },

    // ─── Update (goi moi frame) ──────────────
    update: function(deltaSec) {
        if (!this._weaponHolder) return;

        // 1. Swing animation (melee)
        if (this._swingAnim) {
            this._swingTimer += deltaSec;
            const t = Math.min(1, this._swingTimer / this._swingDuration);
            const angle = 0.4 - (0.4 + 1.2) * Math.sin(t * Math.PI);
            this._weaponHolder.rotation.x = angle;

            if (this._swingTimer >= this._swingDuration) {
                this._swingAnim = false;
                this._swingTimer = 0;
                this._weaponHolder.rotation.x = 0;
            }
        }

        // 2. Muzzle flash timer
        if (this._muzzleFlashTimer > 0 && this._muzzleFlashObj) {
            this._muzzleFlashTimer -= deltaSec;
            if (this._muzzleFlashTimer <= 0) {
                this._muzzleFlashObj.material.opacity = 0;
                this._muzzleFlashTimer = 0;
            }
        }

        // 3. Update Active Tracers (fade & return to pool)
        for (let i = this._activeTracers.length - 1; i >= 0; i--) {
            const tracer = this._activeTracers[i];
            tracer.life += deltaSec;
            const progress = tracer.life / tracer.maxLife;

            if (progress >= 1.0) {
                tracer.mesh.visible = false;
                tracer.material.opacity = 0;
                this._activeTracers.splice(i, 1);
            } else {
                tracer.material.opacity = Math.max(0, 1.0 - progress);
            }
        }

        // 4. Vu khi theo camera direction trong FPS mode & Crouch adjustment
        const isFPS = typeof PlayerController !== 'undefined' && PlayerController.isFirstPersonMode;
        const isCrouch = typeof PlayerController !== 'undefined' && PlayerController.isCrouching;

        const def = (typeof WeaponSystem !== 'undefined' && WeaponSystem.getCurrentDef)
            ? WeaponSystem.getCurrentDef() : null;
        const a = def && def.attach ? def.attach : { px: 0.45, py: 0.60, pz: 0.15 };
        if (isFPS) {
            this._weaponHolder.position.set(0.32, -0.22, -0.32);
        } else {
            this._weaponHolder.position.set(a.px || 0, isCrouch ? (a.py || 0) - 0.18 : (a.py || 0), a.pz || 0);
        }
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = WeaponRenderer;
}
