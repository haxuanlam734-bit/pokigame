/**
 * ============================================================
 * VIP DASH VFX — BLACK FLASH STEP (TOJI-STYLE)
 * ============================================================
 * Visual hierarchy:
 *   PRIMARY (~70%): Multi-angle Black Speed Streaks / Ink Slashes
 *   SECONDARY (~30%): Dark R6 Silhouette Afterimage
 *
 * Sequence:
 *   1. prepareSnapshot(fromX, fromZ, dirVec) — MUST be called BEFORE player position changes
 *   2. player repositions to (toX, toZ)
 *   3. trigger(toX, toZ)                     — MUST be called AFTER player is at destination
 *   4. update(deltaMs)                       — called each frame from game-loop
 *
 * Fully pooled, zero memory leak, unlit charcoal/black materials,
 * multi-angle 3D ink blades visible from any camera perspective.
 * ============================================================
 */

console.log('[VIP DASH VFX] MODULE LOADED');

var VipDashVFX = (function () {
    'use strict';

    // ─────────────────────────────────────────────────────────────
    // TUNING CONFIGURATION
    // ─────────────────────────────────────────────────────────────
    var CFG = {
        // Point A: Vanish cluster (dominant burst)
        STREAK_COUNT_A        : 18,
        GROUND_STREAK_COUNT_A : 4,
        STREAK_A_LIFETIME     : 120, // ms

        // Point B: Reappear cluster (compact settle)
        STREAK_COUNT_B        : 10,
        GROUND_STREAK_COUNT_B : 2,
        STREAK_B_LIFETIME     : 90,  // ms

        // Streak dimensions (world units) — large, bold, sharp ink strokes
        STREAK_LEN_MIN        : 1.4,
        STREAK_LEN_MAX        : 4.2,
        STREAK_W_MIN          : 0.10,
        STREAK_W_MAX          : 0.42,
        STREAK_OPACITY_MIN    : 0.65,
        STREAK_OPACITY_MAX    : 0.95,
        STREAK_Y_MIN          : 0.10,
        STREAK_Y_MAX          : 2.10,
        STREAK_ANGLE_SPREAD   : 0.38, // rad

        // Ground slash dimensions
        GROUND_LEN_MIN        : 2.0,
        GROUND_LEN_MAX        : 4.5,
        GROUND_W_MIN          : 0.18,
        GROUND_W_MAX          : 0.50,

        // Silhouette (R6 snapshot)
        SILHOUETTE_OPACITY_A  : 0.72,
        SILHOUETTE_OPACITY_B  : 0.38,
        SILHOUETTE_STRETCH_A  : 1.15,
        SILHOUETTE_STRETCH_B  : 1.00,
        SILHOUETTE_A_LIFETIME : 110, // ms
        SILHOUETTE_B_LIFETIME : 75,  // ms

        // Total maximum event lifetime before forced pool recycle
        MAX_TOTAL_LIFETIME    : 150, // ms

        // Camera shake (reusing existing Renderer3D system)
        SHAKE_AMOUNT          : 0.035,
        SHAKE_DURATION        : 0.05, // s

        // Pool
        POOL_EVENTS           : 4,
        PART_KEYS             : ['torsoMesh', 'headMesh', 'rightArmMesh', 'leftArmMesh', 'rightLegMesh', 'leftLegMesh'],
        MIN_DISTANCE          : 0.2
    };

    // ─────────────────────────────────────────────────────────────
    // INTERNAL STATE
    // ─────────────────────────────────────────────────────────────
    var _initialized      = false;
    var _updateLogged     = false;
    var _eventPool        = [];
    var _activeEvents     = [];
    var _pendingSnapshot  = null;

    // Shared prototype materials
    var _matStreakShared      = null;
    var _matGroundStreakShared= null;
    var _matSilhouetteShared  = null;

    // ─────────────────────────────────────────────────────────────
    // INITIALIZATION & LAZY INIT
    // ─────────────────────────────────────────────────────────────
    function init() {
        if (_initialized) return true;
        if (typeof THREE === 'undefined') {
            console.warn('[VIP DASH VFX] THREE not loaded yet');
            return false;
        }
        if (typeof Renderer3D === 'undefined' || !Renderer3D.scene) {
            console.warn('[VIP DASH VFX] Renderer3D.scene unavailable during early init, will lazy-init on trigger');
            return false;
        }

        // Master materials (unlit, charcoal/ink, transparent, depthWrite: false)
        // NOTE: colors MUST keep luminance contrast against the DARKEST phase
        // background (night '#0a0a20' => RGB 10,10,32). Pure-black (0x050508)
        // is *darker* than the night sky, so the VFX rendered but was invisible.
        // These graphite/slate tones stay visibly dark on day yet read clearly on night.
        _matStreakShared = new THREE.MeshBasicMaterial({
            color       : 0x4b4b66,
            transparent : true,
            opacity     : 0.92,
            depthWrite  : false,
            depthTest   : true,
            side        : THREE.DoubleSide,
            blending    : THREE.NormalBlending
        });

        _matGroundStreakShared = new THREE.MeshBasicMaterial({
            color       : 0x3a3a52,
            transparent : true,
            opacity     : 0.88,
            depthWrite  : false,
            depthTest   : true,
            side        : THREE.DoubleSide,
            blending    : THREE.NormalBlending
        });

        _matSilhouetteShared = new THREE.MeshBasicMaterial({
            color       : 0x55556e,
            transparent : true,
            opacity     : 0.78,
            depthWrite  : false,
            depthTest   : true,
            side        : THREE.FrontSide,
            blending    : THREE.NormalBlending
        });

        // Pre-allocate pool
        _eventPool = [];
        for (var i = 0; i < CFG.POOL_EVENTS; i++) {
            _eventPool.push(_buildEventEntry());
        }

        _initialized = true;
        console.log('[VIP DASH VFX] Initialized successfully. Pool size=' + CFG.POOL_EVENTS);
        return true;
    }

    // ─────────────────────────────────────────────────────────────
    // STEP 1: PREPARE SNAPSHOT (BEFORE REPOSITION)
    // ─────────────────────────────────────────────────────────────
    function prepareSnapshot(fromX, fromZ, dirVec) {
        if (!_initialized && !init()) {
            console.error('[VIP DASH VFX] Renderer3D.scene unavailable in prepareSnapshot');
            return;
        }

        console.log('[VIP DASH VFX] SNAPSHOT');
        console.log('[VIP DASH VFX] SNAPSHOT A = (' + fromX.toFixed(1) + ', ' + fromZ.toFixed(1) + ')');

        var rig  = _getRig();
        var pose = rig ? _captureR6Pose(rig) : null;
        var seed = (Math.random() * 0xFFFFFF) | 0;

        _pendingSnapshot = {
            fromX  : fromX,
            fromZ  : fromZ,
            fromY  : _getPlayerY(),
            dirVec : dirVec ? new THREE.Vector3(dirVec.x, dirVec.y, dirVec.z).normalize() : new THREE.Vector3(0, 0, 1),
            pose   : pose,
            seed   : seed
        };
    }

    // ─────────────────────────────────────────────────────────────
    // STEP 2: TRIGGER VFX (AFTER REPOSITION TO B)
    // ─────────────────────────────────────────────────────────────
    function trigger(toX, toZ) {
        if (!_initialized && !init()) {
            console.error('[VIP DASH VFX] Renderer3D.scene unavailable in trigger');
            return;
        }

        var snap = _pendingSnapshot;
        _pendingSnapshot = null;

        if (!snap) {
            console.warn('[VIP DASH VFX] trigger() called without prepareSnapshot(), synthesizing snapshot');
            snap = {
                fromX  : toX,
                fromZ  : toZ,
                fromY  : _getPlayerY(),
                dirVec : new THREE.Vector3(0, 0, 1),
                pose   : null,
                seed   : (Math.random() * 0xFFFFFF) | 0
            };
        }

        var fromX  = snap.fromX;
        var fromZ  = snap.fromZ;
        var fromY  = snap.fromY;
        var dirVec = snap.dirVec;

        console.log('[VIP DASH VFX] TRIGGER from=(' + fromX.toFixed(1) + ',' + fromZ.toFixed(1) + ') to=(' + toX.toFixed(1) + ',' + toZ.toFixed(1) + ') direction=(' + dirVec.x.toFixed(2) + ',' + dirVec.z.toFixed(2) + ') scene=' + (!!Renderer3D.scene));
        console.log('[VIP DASH VFX] PLAYER AFTER TELEPORT = (' + toX.toFixed(1) + ', ' + toZ.toFixed(1) + ')');

        var dx   = toX - fromX;
        var dz   = toZ - fromZ;
        var dist = Math.sqrt(dx * dx + dz * dz);

        // Blocked dash edge case
        if (dist < CFG.MIN_DISTANCE) {
            _spawnBlockedFX(fromX, fromY, fromZ, dirVec, snap.seed);
            return;
        }

        console.log('[VIP DASH VFX] VANISH');
        console.log('[VIP DASH VFX] STREAK');

        var entry = _acquireEvent();
        if (!entry) {
            console.error('[VIP DASH VFX] Failed to acquire pool entry');
            return;
        }

        var now       = performance.now();
        var dashAngle = Math.atan2(dirVec.x, dirVec.z);
        var isFPS     = (typeof Renderer3D !== 'undefined') && Renderer3D.isFirstPerson;
        var fpsMult   = isFPS ? 0.45 : 1.0;

        // ── POINT A: Vanish cluster ──
        _activateStreakCluster(
            entry.streakGroupA, entry.streakMeshesA, entry.groundMeshesA,
            fromX, fromY, fromZ,
            dashAngle, CFG.STREAK_COUNT_A, CFG.GROUND_STREAK_COUNT_A,
            1.0, snap.seed, fpsMult
        );

        if (snap.pose) {
            _ensureSilhouetteMeshes(entry, 'A');
            if (entry.silhouetteMeshesA) {
                _applySilhouettePose(
                    entry.silhouetteGroupA, entry.silhouetteMeshesA,
                    snap.pose,
                    0, 0, 0, // offset is 0 for Point A (exact world coords captured)
                    CFG.SILHOUETTE_STRETCH_A,
                    CFG.SILHOUETTE_OPACITY_A * (isFPS ? 0.25 : 1.0)
                );
            }
        }

        // ── POINT B: Reappear cluster ──
        console.log('[VIP DASH VFX] REPOSITION');
        console.log('[VIP DASH VFX] REAPPEAR');

        var toY = _getPlayerY();
        var toOffset = {
            x: toX - fromX,
            y: toY - fromY,
            z: toZ - fromZ
        };

        _activateStreakCluster(
            entry.streakGroupB, entry.streakMeshesB, entry.groundMeshesB,
            toX, toY, toZ,
            dashAngle, CFG.STREAK_COUNT_B, CFG.GROUND_STREAK_COUNT_B,
            0.65, snap.seed ^ 0xCAFE, fpsMult * 0.75
        );

        if (snap.pose) {
            _ensureSilhouetteMeshes(entry, 'B');
            if (entry.silhouetteMeshesB) {
                _applySilhouettePose(
                    entry.silhouetteGroupB, entry.silhouetteMeshesB,
                    snap.pose,
                    toOffset.x, toOffset.y, toOffset.z,
                    CFG.SILHOUETTE_STRETCH_B,
                    CFG.SILHOUETTE_OPACITY_B * (isFPS ? 0.15 : 1.0)
                );
            }
        }

        // ── Scene Attachment & Visibility ──
        entry.inUse     = true;
        entry.startTime = now;
        entry.done      = false;

        if (Renderer3D.scene && !entry.rootGroup.parent) {
            Renderer3D.scene.add(entry.rootGroup);
        }
        entry.rootGroup.visible = true;

        console.log('[VIP DASH VFX] ATTACHED TO SCENE = ' + (!!entry.rootGroup.parent));

        _activeEvents.push(entry);

        // ── Camera Feedback ──
        if (typeof Renderer3D !== 'undefined' && Renderer3D.triggerCameraShake) {
            Renderer3D.triggerCameraShake(CFG.SHAKE_AMOUNT, CFG.SHAKE_DURATION);
        }
    }

    // ─────────────────────────────────────────────────────────────
    // STEP 3: UPDATE (LIFECYCLE, FADE, CLEANUP)
    // ─────────────────────────────────────────────────────────────
    function update(deltaMs) {
        if (!_updateLogged) {
            _updateLogged = true;
            console.log('[VIP DASH VFX] UPDATE ACTIVE');
        }

        if (!_initialized || _activeEvents.length === 0) return;

        var now = performance.now();

        for (var i = _activeEvents.length - 1; i >= 0; i--) {
            var entry = _activeEvents[i];
            var age   = now - entry.startTime;

            if (age >= CFG.MAX_TOTAL_LIFETIME) {
                _releaseEvent(entry);
                _activeEvents.splice(i, 1);
                console.log('[VIP DASH VFX] CLEANUP');
                continue;
            }

            // Streak A: fast cubic easeOut
            var tA  = Math.min(1, age / CFG.STREAK_A_LIFETIME);
            var opA = Math.pow(1 - tA, 2.2);
            _fadeMeshArray(entry.streakMeshesA, opA);
            _fadeMeshArray(entry.groundMeshesA, opA);

            // Silhouette A
            var tSA = Math.min(1, age / CFG.SILHOUETTE_A_LIFETIME);
            var opSA= Math.pow(1 - tSA, 2.2);
            _fadeMeshMap(entry.silhouetteMeshesA, opSA);

            // Streak B: slight delay before fade
            var ageB = Math.max(0, age - 8);
            var tB   = Math.min(1, ageB / CFG.STREAK_B_LIFETIME);
            var opB  = Math.pow(1 - tB, 2.2);
            _fadeMeshArray(entry.streakMeshesB, opB);
            _fadeMeshArray(entry.groundMeshesB, opB);

            // Silhouette B
            var tSB = Math.min(1, age / CFG.SILHOUETTE_B_LIFETIME);
            var opSB= Math.pow(1 - tSB, 2.2);
            _fadeMeshMap(entry.silhouetteMeshesB, opSB);
        }
    }

    // ─────────────────────────────────────────────────────────────
    // POOL MANAGEMENT
    // ─────────────────────────────────────────────────────────────
    function _acquireEvent() {
        for (var i = 0; i < _eventPool.length; i++) {
            if (!_eventPool[i].inUse) return _eventPool[i];
        }
        // Pool exhausted — recycle oldest active entry
        if (_activeEvents.length > 0) {
            var oldest = _activeEvents.shift();
            _releaseEvent(oldest);
            return oldest;
        }
        // Safety expansion
        var ne = _buildEventEntry();
        _eventPool.push(ne);
        return ne;
    }

    function _releaseEvent(entry) {
        if (!entry) return;
        entry.inUse     = false;
        entry.done      = true;
        entry.startTime = 0;
        entry.rootGroup.visible = false;

        entry.streakGroupA.visible = false;
        entry.streakGroupB.visible = false;
        if (entry.silhouetteGroupA) entry.silhouetteGroupA.visible = false;
        if (entry.silhouetteGroupB) entry.silhouetteGroupB.visible = false;

        _resetMeshArray(entry.streakMeshesA);
        _resetMeshArray(entry.groundMeshesA);
        _resetMeshArray(entry.streakMeshesB);
        _resetMeshArray(entry.groundMeshesB);
        _resetMeshMap(entry.silhouetteMeshesA);
        _resetMeshMap(entry.silhouetteMeshesB);

        if (entry.rootGroup.parent) {
            entry.rootGroup.parent.remove(entry.rootGroup);
        }
    }

    // ─────────────────────────────────────────────────────────────
    // BUILD POOL ENTRY
    // ─────────────────────────────────────────────────────────────
    function _buildEventEntry() {
        var rootGroup = new THREE.Group();
        rootGroup.name        = 'vipDashFX_root';
        rootGroup.visible     = false;
        rootGroup.renderOrder = 999;

        // Subgroups for Point A
        var sgA = new THREE.Group();
        sgA.name    = 'vipDashFX_streakA';
        sgA.visible = false;
        rootGroup.add(sgA);

        var smA = _buildStreakMeshes(CFG.STREAK_COUNT_A, sgA, _matStreakShared);
        var gmA = _buildGroundMeshes(CFG.GROUND_STREAK_COUNT_A, sgA, _matGroundStreakShared);

        var silGA = new THREE.Group();
        silGA.name    = 'vipDashFX_silA';
        silGA.visible = false;
        rootGroup.add(silGA);

        // Subgroups for Point B
        var sgB = new THREE.Group();
        sgB.name    = 'vipDashFX_streakB';
        sgB.visible = false;
        rootGroup.add(sgB);

        var smB = _buildStreakMeshes(CFG.STREAK_COUNT_B, sgB, _matStreakShared);
        var gmB = _buildGroundMeshes(CFG.GROUND_STREAK_COUNT_B, sgB, _matGroundStreakShared);

        var silGB = new THREE.Group();
        silGB.name    = 'vipDashFX_silB';
        silGB.visible = false;
        rootGroup.add(silGB);

        var entry = {
            rootGroup         : rootGroup,
            streakGroupA      : sgA,
            streakGroupB      : sgB,
            streakMeshesA     : smA,
            groundMeshesA     : gmA,
            streakMeshesB     : smB,
            groundMeshesB     : gmB,
            silhouetteGroupA  : silGA,
            silhouetteGroupB  : silGB,
            silhouetteMeshesA : null,
            silhouetteMeshesB : null,
            inUse             : false,
            startTime         : 0,
            done              : true
        };

        // Try building silhouette meshes if rig is ready
        _ensureSilhouetteMeshes(entry, 'A');
        _ensureSilhouetteMeshes(entry, 'B');

        return entry;
    }

    // ─────────────────────────────────────────────────────────────
    // STREAK MESH GENERATION (MULTI-ANGLE 3D INK SLASH BLADES)
    // ─────────────────────────────────────────────────────────────
    function _buildStreakMeshes(count, group, matTemplate) {
        var meshes = [];
        var geo    = _getTaperedBladeGeo();

        for (var i = 0; i < count; i++) {
            var mat  = matTemplate.clone();
            mat.opacity = 0;
            var mesh = new THREE.Mesh(geo, mat);
            mesh.frustumCulled = false;
            mesh.renderOrder   = 999;
            mesh.visible       = false;
            group.add(mesh);
            meshes.push(mesh);
        }
        return meshes;
    }

    function _buildGroundMeshes(count, group, matTemplate) {
        var meshes = [];
        var geo    = _getGroundSlashGeo();

        for (var i = 0; i < count; i++) {
            var mat  = matTemplate.clone();
            mat.opacity = 0;
            var mesh = new THREE.Mesh(geo, mat);
            mesh.frustumCulled = false;
            mesh.renderOrder   = 998;
            mesh.visible       = false;
            group.add(mesh);
            meshes.push(mesh);
        }
        return meshes;
    }

    // Cached geometries
    var _cachedBladeGeo  = null;
    var _cachedGroundGeo = null;

    /**
     * Tapered sharp blade geometry (2-sided needle slash)
     * Base at Y=0 (-0.5 to +0.5), Tip at Y=1 (0, 1, 0)
     */
    function _getTaperedBladeGeo() {
        if (_cachedBladeGeo) return _cachedBladeGeo;

        var geo = new THREE.BufferGeometry();
        var positions = new Float32Array([
            -0.5, 0.0, 0.0,
             0.5, 0.0, 0.0,
             0.0, 1.0, 0.0,

            // Second crossed diamond face for true 3D volume
             0.0, 0.0, -0.2,
             0.0, 0.0,  0.2,
             0.0, 1.0,  0.0
        ]);
        var normals = new Float32Array([
            0, 0, 1,   0, 0, 1,   0, 0, 1,
            1, 0, 0,   1, 0, 0,   1, 0, 0
        ]);
        var uvs = new Float32Array([
            0, 0,   1, 0,   0.5, 1,
            0, 0,   1, 0,   0.5, 1
        ]);
        var indices = new Uint16Array([0, 1, 2,  3, 4, 5]);

        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geo.setAttribute('normal',   new THREE.BufferAttribute(normals,   3));
        geo.setAttribute('uv',       new THREE.BufferAttribute(uvs,       2));
        geo.setIndex(new THREE.BufferAttribute(indices, 1));
        geo.computeBoundingSphere();

        _cachedBladeGeo = geo;
        return geo;
    }

    /**
     * Ground slash razor geometry (flat elongated diamond sweeping ground)
     */
    function _getGroundSlashGeo() {
        if (_cachedGroundGeo) return _cachedGroundGeo;

        var geo = new THREE.BufferGeometry();
        var positions = new Float32Array([
            -0.5, 0.0, 0.0,
             0.5, 0.0, 0.0,
             0.0, 1.0, 0.0
        ]);
        var normals = new Float32Array([0, 1, 0,  0, 1, 0,  0, 1, 0]);
        var uvs     = new Float32Array([0, 0,      1, 0,      0.5, 1]);
        var indices = new Uint16Array([0, 1, 2]);

        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geo.setAttribute('normal',   new THREE.BufferAttribute(normals,   3));
        geo.setAttribute('uv',       new THREE.BufferAttribute(uvs,       2));
        geo.setIndex(new THREE.BufferAttribute(indices, 1));
        geo.computeBoundingSphere();

        _cachedGroundGeo = geo;
        return geo;
    }

    /**
     * Activates a cluster of 3D multi-angle ink slashes + ground razor streaks.
     */
    function _activateStreakCluster(group, meshes, groundMeshes, cx, cy, cz, dashAngle, count, groundCount, scaleMult, seed, opacityMult) {
        var rng   = _makeRng(seed);
        var dashX = Math.sin(dashAngle);
        var dashZ = Math.cos(dashAngle);
        var perpX = -dashZ;
        var perpZ =  dashX;

        // ── 1. Main Air Slashes (Vertical, Diagonal, Horizontal Roll Angles) ──
        for (var i = 0; i < meshes.length; i++) {
            var mesh = meshes[i];
            if (i >= count) {
                mesh.visible          = false;
                mesh.material.opacity = 0;
                continue;
            }

            var length  = _lerp(CFG.STREAK_LEN_MIN, CFG.STREAK_LEN_MAX, _rng(rng)) * scaleMult;
            var width   = _lerp(CFG.STREAK_W_MIN,   CFG.STREAK_W_MAX,   _rng(rng)) * scaleMult;
            var opacity = _lerp(CFG.STREAK_OPACITY_MIN, CFG.STREAK_OPACITY_MAX, _rng(rng)) * opacityMult;

            // Height scatter across character
            var yOff          = _lerp(CFG.STREAK_Y_MIN, CFG.STREAK_Y_MAX, _rng(rng));
            var lateralSpread = (_rng(rng) - 0.5) * 0.70 * scaleMult;
            var forwardBias   = _lerp(-0.50, 0.65, _rng(rng)) * scaleMult;

            var px = cx + perpX * lateralSpread + dashX * forwardBias;
            var py = cy + yOff;
            var pz = cz + perpZ * lateralSpread + dashZ * forwardBias;

            mesh.position.set(px, py, pz);

            // Roll angles: evenly distributed vertical (-25..25 deg), diagonal (40..80 deg), horizontal (85..95 deg)
            var rollAngle;
            var rollType = i % 3;
            if (rollType === 0) {
                // Vertical blade
                rollAngle = (_rng(rng) - 0.5) * 0.5;
            } else if (rollType === 1) {
                // Diagonal slash
                rollAngle = (_rng(rng) > 0.5 ? 1 : -1) * _lerp(0.6, 1.2, _rng(rng));
            } else {
                // Near horizontal fan
                rollAngle = Math.PI * 0.5 + (_rng(rng) - 0.5) * 0.3;
            }

            var yawJitter   = (_rng(rng) - 0.5) * CFG.STREAK_ANGLE_SPREAD;
            var pitchJitter = (_rng(rng) - 0.5) * 0.25;

            // Tip of needle is +Y in local space.
            // RotX = PI/2 lays tip along world forward, then Y rotation yaws it to dashAngle.
            mesh.rotation.order = 'YXZ';
            mesh.rotation.set(
                Math.PI * 0.5 + pitchJitter,
                dashAngle + yawJitter,
                rollAngle
            );

            mesh.scale.set(width, length, 1);
            mesh.material.opacity  = opacity;
            mesh.material._vipBase = opacity;
            mesh.visible = true;
        }

        // ── 2. Ground Speed Slashes ──
        if (groundMeshes) {
            for (var g = 0; g < groundMeshes.length; g++) {
                var gMesh = groundMeshes[g];
                if (g >= groundCount) {
                    gMesh.visible          = false;
                    gMesh.material.opacity = 0;
                    continue;
                }

                var gLen = _lerp(CFG.GROUND_LEN_MIN, CFG.GROUND_LEN_MAX, _rng(rng)) * scaleMult;
                var gWid = _lerp(CFG.GROUND_W_MIN,   CFG.GROUND_W_MAX,   _rng(rng)) * scaleMult;
                var gOp  = _lerp(0.70, 0.90, _rng(rng)) * opacityMult;

                var gLatSpread = (_rng(rng) - 0.5) * 0.85 * scaleMult;
                var gFwdBias   = _lerp(-0.3, 0.8, _rng(rng)) * scaleMult;

                gMesh.position.set(
                    cx + perpX * gLatSpread + dashX * gFwdBias,
                    cy + 0.03 + g * 0.01, // right on floor
                    cz + perpZ * gLatSpread + dashZ * gFwdBias
                );

                // Lie flat on ground (rotX = PI/2), yawed toward dash
                gMesh.rotation.order = 'YXZ';
                gMesh.rotation.set(Math.PI * 0.5, dashAngle + (_rng(rng) - 0.5) * 0.2, 0);

                gMesh.scale.set(gWid, gLen, 1);
                gMesh.material.opacity  = gOp;
                gMesh.material._vipBase = gOp;
                gMesh.visible = true;
            }
        }

        group.visible = true;
    }

    // ─────────────────────────────────────────────────────────────
    // SILHOUETTE SNAPSHOT & POSE APPLICATION
    // ─────────────────────────────────────────────────────────────
    function _ensureSilhouetteMeshes(entry, target) {
        var groupKey = target === 'A' ? 'silhouetteGroupA' : 'silhouetteGroupB';
        var meshKey  = target === 'A' ? 'silhouetteMeshesA' : 'silhouetteMeshesB';

        if (entry[meshKey]) return; // already built

        var rig = _getRig();
        if (!rig) return;

        var partMap = _getPartMeshes(rig);
        if (!partMap) return;

        var meshes = {};
        var keys   = Object.keys(partMap);

        for (var i = 0; i < keys.length; i++) {
            var k       = keys[i];
            var srcMesh = partMap[k];
            if (!srcMesh || !srcMesh.geometry) continue;

            var mat = _matSilhouetteShared.clone();
            mat.opacity = 0;

            var m = new THREE.Mesh(srcMesh.geometry, mat);
            m.name          = 'vipDashSil_' + target + '_' + k;
            m.frustumCulled = false;
            m.renderOrder   = 997;
            m.visible       = false;

            entry[groupKey].add(m);
            meshes[k] = m;
        }

        entry[meshKey] = meshes;
    }

    /** Capture world transforms of all active body parts */
    function _captureR6Pose(rig) {
        var partMap = _getPartMeshes(rig);
        if (!partMap) return null;

        var pose = {};
        var keys = Object.keys(partMap);
        var tv3  = new THREE.Vector3();
        var tq   = new THREE.Quaternion();
        var ts   = new THREE.Vector3();

        for (var i = 0; i < keys.length; i++) {
            var k    = keys[i];
            var mesh = partMap[k];
            if (!mesh) continue;

            mesh.updateMatrixWorld(true);
            mesh.getWorldPosition(tv3);
            mesh.getWorldQuaternion(tq);
            mesh.getWorldScale(ts);

            pose[k] = {
                pos   : tv3.clone(),
                quat  : tq.clone(),
                scale : ts.clone()
            };
        }
        return pose;
    }

    /** Apply pose with offset and speed stretch */
    function _applySilhouettePose(group, meshes, pose, offX, offY, offZ, stretchY, opacity) {
        if (!pose || !meshes) return;

        var keys = Object.keys(pose);
        for (var i = 0; i < keys.length; i++) {
            var k = keys[i];
            var m = meshes[k];
            var p = pose[k];
            if (!m || !p) continue;

            m.position.set(
                p.pos.x + offX,
                p.pos.y + offY,
                p.pos.z + offZ
            );
            m.quaternion.copy(p.quat);
            m.scale.set(p.scale.x, p.scale.y * stretchY, p.scale.z);

            m.material.opacity  = opacity;
            m.material._vipBase = opacity;
            m.visible           = true;
        }
        group.visible = true;
    }

    // ─────────────────────────────────────────────────────────────
    // BLOCKED EFFECT (HIT WALL / NO MOVEMENT)
    // ─────────────────────────────────────────────────────────────
    function _spawnBlockedFX(fromX, fromY, fromZ, dirVec, seed) {
        var entry = _acquireEvent();
        if (!entry) return;

        var now       = performance.now();
        var dashAngle = Math.atan2(dirVec.x, dirVec.z);

        _activateStreakCluster(
            entry.streakGroupA, entry.streakMeshesA, entry.groundMeshesA,
            fromX, fromY, fromZ,
            dashAngle, 5, 1, 0.45, seed, 0.6
        );

        entry.streakGroupB.visible = false;
        if (entry.silhouetteGroupA) entry.silhouetteGroupA.visible = false;
        if (entry.silhouetteGroupB) entry.silhouetteGroupB.visible = false;

        entry.inUse     = true;
        entry.startTime = now;
        entry.done      = false;

        if (Renderer3D.scene && !entry.rootGroup.parent) {
            Renderer3D.scene.add(entry.rootGroup);
        }
        entry.rootGroup.visible = true;
        _activeEvents.push(entry);
    }

    // ─────────────────────────────────────────────────────────────
    // FADE & RESET HELPERS
    // ─────────────────────────────────────────────────────────────
    function _fadeMeshArray(meshArr, factor) {
        if (!meshArr) return;
        for (var i = 0; i < meshArr.length; i++) {
            var m = meshArr[i];
            if (!m || !m.visible || !m.material) continue;
            var base = (m.material._vipBase !== undefined) ? m.material._vipBase : m.material.opacity;
            m.material.opacity = Math.max(0, base * factor);
        }
    }

    function _fadeMeshMap(meshMap, factor) {
        if (!meshMap) return;
        var keys = Object.keys(meshMap);
        for (var i = 0; i < keys.length; i++) {
            var m = meshMap[keys[i]];
            if (!m || !m.visible || !m.material) continue;
            var base = (m.material._vipBase !== undefined) ? m.material._vipBase : m.material.opacity;
            m.material.opacity = Math.max(0, base * factor);
        }
    }

    function _resetMeshArray(meshArr) {
        if (!meshArr) return;
        for (var i = 0; i < meshArr.length; i++) {
            var m = meshArr[i];
            if (!m) continue;
            m.visible = false;
            if (m.material) {
                m.material.opacity = 0;
                delete m.material._vipBase;
            }
        }
    }

    function _resetMeshMap(meshMap) {
        if (!meshMap) return;
        var keys = Object.keys(meshMap);
        for (var i = 0; i < keys.length; i++) {
            var m = meshMap[keys[i]];
            if (!m) continue;
            m.visible = false;
            if (m.material) {
                m.material.opacity = 0;
                delete m.material._vipBase;
            }
        }
    }

    // ─────────────────────────────────────────────────────────────
    // RIG DETECTION (FBX MODULAR R6 & PROCEDURAL RIG)
    // ─────────────────────────────────────────────────────────────
    function _getRig() {
        if (typeof Renderer3D === 'undefined' || !Renderer3D.player) return null;
        var player = Renderer3D.player;
        return player.rig || player;
    }

    function _getPartMeshes(rig) {
        if (!rig) return null;

        // 1. Check rig.r6Parts or Renderer3D.player.r6Parts (FBX modular R6)
        var p = rig.r6Parts || (Renderer3D.player && Renderer3D.player.r6Parts);
        if (p && (p.torsoMesh || p.headMesh)) {
            return {
                torsoMesh    : p.torsoMesh,
                headMesh     : p.headMesh,
                rightArmMesh : p.rightArmMesh,
                leftArmMesh  : p.leftArmMesh,
                rightLegMesh : p.rightLegMesh,
                leftLegMesh  : p.leftLegMesh
            };
        }

        // 2. Check procedural fallback rig
        if (rig.torso && rig.head) {
            return {
                torsoMesh    : rig.torso,
                headMesh     : rig.head,
                rightArmMesh : rig.rightArm ? (rig.rightArm.children[0] || rig.rightArm) : null,
                leftArmMesh  : rig.leftArm ? (rig.leftArm.children[0] || rig.leftArm) : null,
                rightLegMesh : rig.rightLeg ? (rig.rightLeg.children[0] || rig.rightLeg) : null,
                leftLegMesh  : rig.leftLeg ? (rig.leftLeg.children[0] || rig.leftLeg) : null
            };
        }

        return null;
    }

    function _getPlayerY() {
        if (typeof PlayerController !== 'undefined' && PlayerController.position) {
            return PlayerController.position.y || 0;
        }
        return 0;
    }

    function _lerp(a, b, t) {
        return a + (b - a) * t;
    }

    // Mulberry32 deterministic seeded PRNG
    function _makeRng(seed) {
        return { s: seed >>> 0 };
    }
    function _rng(rng) {
        rng.s = (rng.s + 0x6D2B79F5) | 0;
        var t = Math.imul(rng.s ^ (rng.s >>> 15), 1 | rng.s);
        t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    // ─────────────────────────────────────────────────────────────
    // DEBUG TEST METHOD (STANDALONE VFX TEST)
    // ─────────────────────────────────────────────────────────────
    function debugTest() {
        console.log('[VIP DASH VFX] DEBUG TEST TRIGGERED');
        if (!_initialized && !init()) {
            console.error('[VIP DASH VFX] Failed to initialize in debugTest');
            return;
        }

        var px = (typeof PlayerController !== 'undefined' && PlayerController.position) ? PlayerController.position.x : 0;
        var pz = (typeof PlayerController !== 'undefined' && PlayerController.position) ? PlayerController.position.z : 0;

        var fwd = { x: 0, z: -1 };
        if (typeof PlayerController !== 'undefined' && PlayerController.getForwardDirection) {
            fwd = PlayerController.getForwardDirection();
        }

        var toX = px + fwd.x * 8.0;
        var toZ = pz + fwd.z * 8.0;

        prepareSnapshot(px, pz, fwd);
        trigger(toX, toZ);
    }

    // ─────────────────────────────────────────────────────────────
    // PUBLIC EXPORT
    // ─────────────────────────────────────────────────────────────
    return {
        init            : init,
        prepareSnapshot : prepareSnapshot,
        trigger         : trigger,
        update          : update,
        debugTest       : debugTest
    };

})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = VipDashVFX;
}
