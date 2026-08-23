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

    // Melee slash visual
    _slashGroup:      null,
    _slashTimer:      0,
    _slashDuration:   0.28,
    _slashPeakTime:   0.18,

    // Debug
    _debugKatanaHitbox: false,
    _debugHitboxMesh:   null,

    // Muzzle flash
    _muzzleFlashTimer: 0,
    _muzzleFlashObj:  null,

    // ─── 3D Glowing Beam Tracer Pool (High Performance & Ultra Visible) ───
    _tracerPool:      [],
    _activeTracers:   [],
    _maxTracers:      30,

    // Grip system
    _gripMarkers:     {},
    _weaponScales:    {},
    _showGripDebug:   false,
    _pendingEquip:    null,

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

        // Apply any weapon change that arrived before _weaponHolder existed
        if (this._pendingEquip) {
            const pending = this._pendingEquip;
            this._pendingEquip = null;
            this.onWeaponChanged(null, pending);
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
                self._normalizeModel(model, def.attach, weaponId);
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
    _normalizeModel: function(model, attach, weaponId) {
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
        model.position.set(-center.x * scale, -center.y * scale, -center.z * scale);

        const grips = (typeof WEAPON_GRIPS !== 'undefined' && WEAPON_GRIPS[weaponId]) ? WEAPON_GRIPS[weaponId] : null;
        const primary = grips && grips.primary;
        if (primary) {
            model.position.set(
                model.position.x - primary.x * scale,
                model.position.y - primary.y * scale,
                model.position.z - primary.z * scale
            );
        }

        model.traverse(function(child) {
            if (child.isMesh) child.frustumCulled = false;
        });

        this._weaponScales = this._weaponScales || {};
        this._weaponScales[weaponId] = scale;
        this._createGripMarkers(weaponId, model, grips, scale);
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
            this._createFallbackGripMarkers(weaponId, group);
        } else {
            geo  = new THREE.BoxGeometry(0.1, 0.12, 0.45);
            mat  = new THREE.MeshPhongMaterial({ color: weaponId === 'pistol' ? 0x333333 : 0x224422 });
            mesh = new THREE.Mesh(geo, mat);
            mesh.name = weaponId + '_fallback';
            mesh.visible = false;
            this._models[weaponId] = mesh;
            this._weaponHolder.add(mesh);
            this._createFallbackGripMarkers(weaponId, mesh);
        }

        if (typeof WeaponSystem !== 'undefined' && WeaponSystem.currentId === weaponId) {
            this._showModel(weaponId);
        }
    },

    _createGripMarkers: function(weaponId, model, grips, scale) {
        const markers = {};
        const primaryMarker = new THREE.Object3D();
        primaryMarker.name = 'PrimaryGrip';
        primaryMarker.position.set(0, 0, 0);
        this._weaponHolder.add(primaryMarker);
        markers.primary = primaryMarker;

        if (this._showGripDebug) {
            const sphere = new THREE.Mesh(
                new THREE.SphereGeometry(0.03, 8, 8),
                new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.6 })
            );
            primaryMarker.add(sphere);
        }

        if (grips && grips.support) {
            const supportMarker = new THREE.Object3D();
            supportMarker.name = 'SecondaryGrip';
            const sx = (grips.support.x - (grips.primary ? grips.primary.x : 0)) * scale;
            const sy = (grips.support.y - (grips.primary ? grips.primary.y : 0)) * scale;
            const sz = (grips.support.z - (grips.primary ? grips.primary.z : 0)) * scale;
            supportMarker.position.set(sx, sy, sz);
            this._weaponHolder.add(supportMarker);
            markers.support = supportMarker;

            if (this._showGripDebug) {
                const sphere = new THREE.Mesh(
                    new THREE.SphereGeometry(0.03, 8, 8),
                    new THREE.MeshBasicMaterial({ color: 0x0088ff, transparent: true, opacity: 0.6 })
                );
                supportMarker.add(sphere);
            }
        }

        this._gripMarkers[weaponId] = markers;
    },

    _createFallbackGripMarkers: function(weaponId, model) {
        const markers = {};
        const marker = new THREE.Object3D();
        marker.name = 'PrimaryGrip';
        marker.position.set(0, 0, 0);
        this._weaponHolder.add(marker);
        markers.primary = marker;

        if (this._showGripDebug) {
            const sphere = new THREE.Mesh(
                new THREE.SphereGeometry(0.03, 8, 8),
                new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.6 })
            );
            marker.add(sphere);
        }

        this._gripMarkers[weaponId] = markers;
    },

    getGripWorldPosition: function(weaponId, gripType) {
        const markers = this._gripMarkers && this._gripMarkers[weaponId];
        if (!markers || !markers[gripType]) return null;
        const marker = markers[gripType];
        const pos = new THREE.Vector3();
        marker.getWorldPosition(pos);
        return pos;
    },

    refreshGripDebug: function() {
        Object.values(this._gripMarkers).forEach(markers => {
            Object.values(markers).forEach(marker => {
                while (marker.children.length > 0) {
                    marker.remove(marker.children[0]);
                }
                if (this._showGripDebug) {
                    const color = marker.name === 'PrimaryGrip' ? 0xff0000 : 0x0088ff;
                    const sphere = new THREE.Mesh(
                        new THREE.SphereGeometry(0.03, 8, 8),
                        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6 })
                    );
                    marker.add(sphere);
                }
            });
        });
    },

    _useFallbackForAll: function() {
        const defs = (typeof WEAPON_DEFS !== 'undefined') ? WEAPON_DEFS : {};
        for (const id in defs) {
            this._createFallbackModel(id, defs[id]);
        }
    },

    onWeaponChanged: function(prevId, newId) {
        if (!this._weaponHolder) {
            this._pendingEquip = newId;
            return;
        }
        if (prevId && this._models[prevId]) {
            this._models[prevId].visible = false;
        }
        this._showModel(newId);
        this.resetMeleeAnim();
        console.log('[WEAPON] Switch:', prevId, '->', newId, 'holderParent=', this._weaponHolder.parent ? this._weaponHolder.parent.name : 'null');
    },

    _showModel: function(weaponId) {
        const model = this._models[weaponId];
        const def   = (typeof WEAPON_DEFS !== 'undefined') ? WEAPON_DEFS[weaponId] : null;
        if (!model || !def) return;

        const rightSocket = (Renderer3D && Renderer3D.player && Renderer3D.player.rightHandSocket) ? Renderer3D.player.rightHandSocket : null;
        if (rightSocket && this._weaponHolder && this._weaponHolder.parent !== rightSocket) {
            rightSocket.add(this._weaponHolder);
            this._weaponHolder.position.set(0, 0, 0);
            this._weaponHolder.rotation.set(0, 0, 0);
        }

        model.visible = true;

        const a = def.attach;
        if (a) {
            model.rotation.set(a.rx || 0, a.ry || 0, a.rz || 0);
        }

        if (weaponId !== 'sword' && this._muzzleFlashObj) {
            if (this._muzzleFlashObj.parent !== model) {
                model.add(this._muzzleFlashObj);
                this._muzzleFlashObj.position.set(0, 0, 0.45);
            }
        }

        this._currentModel = model;
        console.log('[WEAPON] Hien thi model: ' + weaponId + ' parent=' + (this._weaponHolder.parent ? this._weaponHolder.parent.name : 'null') + ' visible=' + model.visible);
    },

    playMeleeSwingAnim: function() {
        this._swingAnim  = true;
        this._swingTimer = 0;
        this._createCinematicSlash();
        if (Renderer3D && Renderer3D.triggerCameraShake) {
            Renderer3D.triggerCameraShake(0.06, 0.15);
        }
    },

    resetMeleeAnim: function() {
        this._swingAnim  = false;
        this._swingTimer = 0;
        if (this._weaponHolder) {
            this._weaponHolder.rotation.set(0, 0, 0);
        }
        this._clearSlashArc();
        if (this._debugHitboxMesh) {
            if (this._debugHitboxMesh.parent) this._debugHitboxMesh.parent.remove(this._debugHitboxMesh);
            this._debugHitboxMesh = null;
        }
        if (Renderer3D && Renderer3D._shakeTimer) {
            Renderer3D._shakeTimer = 0;
        }
    },

    _createCinematicSlash: function() {
        this._clearSlashArc();
        if (!Renderer3D || !Renderer3D.scene || !PlayerController) return;

        const yaw = InputManager.cameraYaw;
        const forwardX = Math.sin(yaw);
        const forwardZ = Math.cos(yaw);
        const rightX = Math.cos(yaw);
        const rightZ = -Math.sin(yaw);
        const px = PlayerController.position.x;
        const pz = PlayerController.position.z;
        const py = PlayerController.position.y + 1.2;

        const innerR = 0.7;
        const outerR = 2.6;
        const halfArc = Math.PI * 0.275;
        const segments = 28;

        const path = [];
        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const r = innerR + (outerR - innerR) * t;
            const angle = -halfArc + t * halfArc * 2;
            const x = px + forwardX * r * Math.cos(angle) + rightX * r * Math.sin(angle);
            const z = pz + forwardZ * r * Math.cos(angle) + rightZ * r * Math.sin(angle);
            path.push({ x, y: py, z, t });
        }

        const buildRibbonGeo = (baseWidth, taperExp) => {
            const verts = [];
            const idx = [];
            for (let i = 0; i <= segments; i++) {
                const t = path[i].t;
                const envelope = Math.sin(t * Math.PI);
                const width = baseWidth * Math.pow(envelope, taperExp);
                let tx, tz;
                if (i === 0) {
                    tx = path[1].x - path[0].x;
                    tz = path[1].z - path[0].z;
                } else if (i === segments) {
                    tx = path[i].x - path[i - 1].x;
                    tz = path[i].z - path[i - 1].z;
                } else {
                    tx = path[i + 1].x - path[i - 1].x;
                    tz = path[i + 1].z - path[i - 1].z;
                }
                const len = Math.hypot(tx, tz) || 1;
                tx /= len;
                tz /= len;
                const nx = -tz;
                const nz = tx;
                verts.push(path[i].x + nx * width, path[i].y, path[i].z + nz * width);
                verts.push(path[i].x - nx * width, path[i].y, path[i].z - nz * width);
            }
            for (let i = 0; i < segments; i++) {
                const a = i * 2;
                const b = i * 2 + 1;
                const c = (i + 1) * 2;
                const d = (i + 1) * 2 + 1;
                idx.push(a, c, b, b, c, d);
            }
            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
            geo.setIndex(idx);
            geo.computeVertexNormals();
            return geo;
        };

        const mainGeo = buildRibbonGeo(0.16, 1.0);
        const mainMat = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 1.0,
            depthTest: true,
            depthWrite: false,
            side: THREE.DoubleSide
        });
        const mainMesh = new THREE.Mesh(mainGeo, mainMat);
        mainMesh.renderOrder = 999;
        mainMesh.frustumCulled = false;
        mainMesh.name = 'slashMain';

        const glowGeo = buildRibbonGeo(0.34, 0.7);
        const glowMat = new THREE.MeshBasicMaterial({
            color: 0xd0ffff,
            transparent: true,
            opacity: 0.4,
            depthTest: true,
            depthWrite: false,
            side: THREE.DoubleSide
        });
        const glowMesh = new THREE.Mesh(glowGeo, glowMat);
        glowMesh.renderOrder = 998;
        glowMesh.frustumCulled = false;
        glowMesh.name = 'slashGlow';

        const streakGeo = buildRibbonGeo(0.06, 1.4);
        const streakMat = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.7,
            depthTest: true,
            depthWrite: false,
            side: THREE.DoubleSide
        });
        const streakMesh = new THREE.Mesh(streakGeo, streakMat);
        streakMesh.renderOrder = 997;
        streakMesh.frustumCulled = false;
        streakMesh.name = 'slashStreak';

        const group = new THREE.Group();
        group.add(mainMesh);
        group.add(glowMesh);
        group.add(streakMesh);
        group.userData.materials = [mainMat, glowMat, streakMat];
        group.userData.geometries = [mainGeo, glowGeo, streakGeo];

        Renderer3D.scene.add(group);
        this._slashGroup = group;
        this._slashTimer = 0;
    },

    _clearSlashArc: function() {
        if (this._slashGroup) {
            if (this._slashGroup.parent) this._slashGroup.parent.remove(this._slashGroup);
            this._slashGroup.traverse(node => {
                if (node.geometry) node.geometry.dispose();
                if (node.material) node.material.dispose();
            });
            this._slashGroup = null;
        }
    },

    _updateCinematicSlash: function(deltaSec) {
        if (!this._slashGroup) return;
        this._slashTimer += deltaSec;
        const progress = this._slashTimer / this._slashDuration;
        if (progress >= 1) {
            this._clearSlashArc();
            return;
        }
        const peak = this._slashPeakTime;
        const materials = this._slashGroup.userData.materials;
        if (!materials || materials.length < 3) return;

        const mainMat = materials[0];
        const glowMat = materials[1];
        const streakMat = materials[2];

        let mainOp, glowOp, streakOp;
        if (this._slashTimer < peak) {
            const ramp = this._slashTimer / peak;
            mainOp = Math.min(1.0, ramp);
            glowOp = 0.35 * ramp;
            streakOp = 0.6 * ramp;
        } else {
            const tail = 1.0 - (this._slashTimer - peak) / (this._slashDuration - peak);
            const fade = Math.max(0, tail);
            mainOp = 1.0 * fade;
            glowOp = 0.35 * fade;
            streakOp = 0.6 * fade * fade;
        }

        mainMat.opacity = mainOp;
        glowMat.opacity = glowOp;
        streakMat.opacity = streakOp;

        const scale = this._slashTimer < peak
            ? 0.6 + 0.4 * (this._slashTimer / peak)
            : 1.0;
        this._slashGroup.scale.setScalar(scale);
    },

    _updateDebugKatanaHitbox: function() {
        if (!this._debugKatanaHitbox) {
            if (this._debugHitboxMesh) {
                if (this._debugHitboxMesh.parent) this._debugHitboxMesh.parent.remove(this._debugHitboxMesh);
                this._debugHitboxMesh = null;
            }
            return;
        }
        if (!PlayerController || !GameState || !Renderer3D || !Renderer3D.scene) return;

        const def = WeaponSystem.getCurrentDef();
        if (!def || def.fireMode !== FIRE_MODE.MELEE) {
            if (this._debugHitboxMesh) {
                if (this._debugHitboxMesh.parent) this._debugHitboxMesh.parent.remove(this._debugHitboxMesh);
                this._debugHitboxMesh = null;
            }
            return;
        }

        const px = PlayerController.position.x;
        const pz = PlayerController.position.z;
        const py = PlayerController.position.y + 1.2;
        const yaw = InputManager.cameraYaw;
        const forwardX = Math.sin(yaw);
        const forwardZ = Math.cos(yaw);
        const rightX = Math.cos(yaw);
        const rightZ = -Math.sin(yaw);
        const innerR = def.meleeInnerRadius || 0.7;
        const outerR = def.meleeOuterRadius || def.range || 2.8;
        const halfArc = (def.meleeSwingArc || Math.PI * 0.5) / 2;

        const shape = new THREE.Shape();
        const segments = 32;
        const outerPoints = [];
        const innerPoints = [];
        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const angle = -halfArc + t * halfArc * 2;
            outerPoints.push({ x: Math.cos(angle) * outerR, y: Math.sin(angle) * outerR });
            innerPoints.push({ x: Math.cos(angle) * innerR, y: Math.sin(angle) * innerR });
        }
        shape.moveTo(outerPoints[0].x, outerPoints[0].y);
        for (let i = 1; i < outerPoints.length; i++) shape.lineTo(outerPoints[i].x, outerPoints[i].y);
        for (let i = innerPoints.length - 1; i >= 0; i--) shape.lineTo(innerPoints[i].x, innerPoints[i].y);
        shape.closePath();

        const geometry = new THREE.ShapeGeometry(shape);
        const material = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0.15,
            depthTest: true,
            depthWrite: false,
            side: THREE.DoubleSide
        });

        if (!this._debugHitboxMesh) {
            this._debugHitboxMesh = new THREE.Mesh(geometry, material);
            this._debugHitboxMesh.renderOrder = 1000;
            this._debugHitboxMesh.frustumCulled = false;
            Renderer3D.scene.add(this._debugHitboxMesh);
        } else {
            this._debugHitboxMesh.geometry.dispose();
            this._debugHitboxMesh.geometry = geometry;
            this._debugHitboxMesh.material = material;
        }

        this._debugHitboxMesh.position.set(px, py, pz);
        this._debugHitboxMesh.rotation.set(-Math.PI / 2, -yaw, 0);
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

        if (!this._weaponHolder.parent) {
            const rightSocket = (Renderer3D && Renderer3D.player && Renderer3D.player.rightHandSocket) ? Renderer3D.player.rightHandSocket : null;
            if (rightSocket) {
                rightSocket.add(this._weaponHolder);
                this._weaponHolder.position.set(0, 0, 0);
            }
        }

        const model = this._currentModel || (typeof WeaponSystem !== 'undefined' ? this._models[WeaponSystem.currentId] : null);
        if (model && !model.visible) {
            model.visible = true;
        }

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

        // 2. Slash arc visual
        this._updateCinematicSlash(deltaSec);

        // 3. Debug katana hitbox
        this._updateDebugKatanaHitbox();

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

        // 4. Compensate for parent scale and set weaponHolder position
        let parentScale = new THREE.Vector3(1, 1, 1);
        if (this._weaponHolder.parent) {
            this._weaponHolder.parent.getWorldScale(parentScale);
        }
        // Avoid division by zero
        const safeScale = new THREE.Vector3(
            parentScale.x === 0 ? 1 : parentScale.x,
            parentScale.y === 0 ? 1 : parentScale.y,
            parentScale.z === 0 ? 1 : parentScale.z
        );
        // Set weaponHolder's local scale so that its world scale is 1
        this._weaponHolder.scale.set(
            1 / safeScale.x,
            1 / safeScale.y,
            1 / safeScale.z
        );

        // Now set the weaponHolder's local position so that its world position offset from parent is the attach config's position
        const isFPS = typeof PlayerController !== 'undefined' && PlayerController.isFirstPersonMode;
        const isCrouch = typeof PlayerController !== 'undefined' && PlayerController.isCrouching;

        const def = (typeof WeaponSystem !== 'undefined' && WeaponSystem.getCurrentDef)
            ? WeaponSystem.getCurrentDef() : null;
        const a = def && def.attach ? def.attach : { px: 0.45, py: 0.60, pz: 0.15 };
        let offsetX = a.px || 0;
        let offsetY = a.py || 0;
        let offsetZ = a.pz || 0;
        if (isFPS) {
            offsetX = 0.32;
            offsetY = -0.22;
            offsetZ = -0.32;
        } else {
            if (isCrouch) {
                offsetY -= 0.18;
            }
        }
        this._weaponHolder.position.set(
            offsetX / safeScale.x,
            offsetY / safeScale.y,
            offsetZ / safeScale.z
        );
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = WeaponRenderer;
}



