/**
 * OBSERVATION-HAKI.JS - Haki Quan Sát System
 * Player có thể bật/tắt Observation Haki bằng phím E để tự động né các đòn tấn công
 *
 * CINEMATIC DODGE VISUAL SYSTEM — "Peak"
 * 3-phase dodge animation, multi-layer black shadow afterimages,
 * staggered chain fade, additive offset on R6 pivots.
 *
 * GAMEPLAY LOGIC IS UNTOUCHED. Only visual presentation is upgraded.
 */

// ============================================================
// DEBUG FLAG (Set to true for visual verification)
// ============================================================
const OBSERVATION_VISUAL_DEBUG = true;

const ObservationHaki = {
    // ============================================================
    // HAKI STATE (unchanged gameplay logic)
    // ============================================================
    isActive: false,
    debug: true,
    dodgedAttacks: new Set(),

    // ============================================================
    // CINEMATIC DODGE ANIMATION SYSTEM
    // ============================================================
    // 3-phase: ANTICIPATION (0→15%) → SNAP (15%→65%) → RECOVERY (65%→100%)
    currentDodge: null,
    dodgeDuration: 220,     // ms — total dodge time
    dodgeTimer: 0,
    _dodgeVariation: 0,     // random seed [0..1] per dodge instance
    _dodgeCount: 0,         // consecutive dodge counter
    _lastDodgeTime: 0,      // timestamp of last dodge

    // Phase boundaries (fraction of dodgeDuration)
    _PHASE_ANTICIPATION_END: 0.15,
    _PHASE_SNAP_END: 0.65,
    // Recovery is 0.65 → 1.0

    // Pending dodge offset — computed in update(), applied in applyDodgeOverlay()
    _pendingDodgeOffsets: null,  // { pivotName: { px, py, pz, rx, ry, rz } }
    _hasPendingOverlay: false,
    _snapshotCaptured: false,   // flag to capture afterimage at end of anticipation

    // Debug logging throttling flags
    _loggedRigFound: false,
    _loggedOverlayApplied: false,
    _warnedMissingPivots: {},
    _lastLoggedPhase: null,

    // ============================================================
    // AFTERIMAGE POOL SYSTEM
    // ============================================================
    _shadowPool: [],
    _activeShadows: [],
    maxAfterimages: 6,          // max active ENTRIES (each contains hierarchy of 6 body parts)
    _poolInitialized: false,
    _sharedShadowMaterial: null,       // Layer A material
    _sharedEdgeMaterial: null,         // Layer B material
    _sharedSmearMaterial: null,        // Layer C material

    // Layer lifetimes (ms)
    _LAYER_A_LIFETIME: 180,
    _LAYER_B_LIFETIME: 120,
    _LAYER_C_LIFETIME: 80,

    // ============================================================
    // SYNTHESIZED SOUND
    // ============================================================
    _lastWhooshTime: 0,
    _WHOOSH_THROTTLE: 80,       // ms — minimum interval between whoosh sounds

    // ============================================================
    // CENTRALIZED TIMER MANAGEMENT
    // ============================================================
    _uiTimers: new Set(),        // Centralized timer management

    // ============================================================
    // RUNTIME RIG HELPER — SINGLE AUTHORITATIVE LOOKUP
    // Architecture: Renderer3D.player.rig.r6RuntimePivots
    // ============================================================
    _getRuntimePlayerRig: function() {
        const player = (typeof Renderer3D !== 'undefined') ? Renderer3D.player : null;
        const rig = player?.rig;

        if (!player || !rig || !rig.r6RuntimePivots) {
            return null;
        }

        if (OBSERVATION_VISUAL_DEBUG && !this._loggedRigFound) {
            this._loggedRigFound = true;
            console.log('[OBS VISUAL] Runtime R6 rig found');
            const p = rig.r6RuntimePivots;
            const hasAll = p.torsoPivot && p.headPivot && p.rightArmPivot && p.leftArmPivot && p.rightLegPivot && p.leftLegPivot;
            if (hasAll) {
                console.log('[OBS VISUAL] 6 runtime pivots found');
            } else {
                console.warn('[DODGE FX] Runtime R6 pivots missing some parts');
            }
        }

        return rig;
    },

    // ============================================================
    // INIT
    // ============================================================
    init: function() {
        console.log('[OBSERVATION] Khởi tạo Observation Haki System...');
        this._setupInput();
        console.log('[OBSERVATION] Khởi tạo xong');
    },





    // ============================================================
    // INPUT (unchanged)
    // ============================================================
    _setupInput: function() {
        this._eKeyPressed = false;

        document.addEventListener('keydown', (e) => {
            if (e.key.toLowerCase() === 'e' && !this._eKeyPressed) {
                this._eKeyPressed = true;
                this.toggle();
            }
        });

        document.addEventListener('keyup', (e) => {
            if (e.key.toLowerCase() === 'e') {
                this._eKeyPressed = false;
            }
        });
    },

    // ============================================================
    // TOGGLE (unchanged gameplay logic)
    // ============================================================
    toggle: function() {
        this.isActive = !this.isActive;

        if (this.isActive) {
            this._log('[OBSERVATION] ON');
            const hakiStatus = document.getElementById('haki-status');
            if (hakiStatus) hakiStatus.style.display = 'flex';
        } else {
            this._log('[OBSERVATION] OFF');
            this.cleanup();
            const hakiStatus = document.getElementById('haki-status');
            if (hakiStatus) hakiStatus.style.display = 'none';
        }
    },

    // ============================================================
    // TURN OFF (called on death/respawn — unchanged)
    // ============================================================
    turnOff: function() {
        if (this.isActive) {
            this.isActive = false;
            this._log('[OBSERVATION] OFF (forced)');
            this.cleanup();

            const hakiStatus = document.getElementById('haki-status');
            if (hakiStatus) hakiStatus.style.display = 'none';
        }
    },

    // ============================================================
    // CLEANUP
    // ============================================================
    cleanup: function() {
        this.dodgedAttacks.clear();
        this._clearAllAfterimages();

        if (this.currentDodge) {
            this.currentDodge = null;
            this.dodgeTimer = 0;
            this._pendingDodgeOffsets = null;
            this._hasPendingOverlay = false;
            this._snapshotCaptured = false;
        }

        this._dodgeCount = 0;
        this._loggedOverlayApplied = false;
        this._lastLoggedPhase = null;

        // Clear any pending debug/visual timers
        this._clearUiTimers();
    },

    // ============================================================
    // CENTRALIZED TIMER MANAGEMENT
    // ============================================================
    _scheduleUiTimer: function(callback, delay) {
        const timerId = setTimeout(() => {
            this._uiTimers.delete(timerId);
            callback();
        }, delay);
        this._uiTimers.add(timerId);
        return timerId;
    },

    _clearUiTimers: function() {
        this._uiTimers.forEach(timerId => {
            clearTimeout(timerId);
        });
        this._uiTimers.clear();
        
        if (OBSERVATION_VISUAL_DEBUG) {
            console.log('[HAKI UI] TIMER CLEANUP');
        }
    },

    // ============================================================
    // CLEAR ALL AFTERIMAGES
    // ============================================================
    _clearAllAfterimages: function() {
        for (let i = this._activeShadows.length - 1; i >= 0; i--) {
            this._releaseShadowEntry(this._activeShadows[i]);
        }
        this._activeShadows = [];
    },

    // ============================================================
    // MAIN UPDATE — called from game loop (BEFORE renderer)
    // Computes dodge offsets and updates afterimage fade.
    // Does NOT write to pivots directly. Stores offsets in _pendingDodgeOffsets.
    // ============================================================
    update: function(deltaTime) {
        const now = Date.now();

        // ---- Update afterimage fade ----
        this._updateAfterimages(now);

        // ---- Compute dodge animation offsets ----
        if (this.currentDodge) {
            this.dodgeTimer += deltaTime;

            if (this.dodgeTimer >= this.dodgeDuration) {
                // Dodge finished
                this.currentDodge = null;
                this.dodgeTimer = 0;
                this._pendingDodgeOffsets = null;
                this._hasPendingOverlay = false;
                this._snapshotCaptured = false;
                this._loggedOverlayApplied = false;
                this._lastLoggedPhase = null;
                if (OBSERVATION_VISUAL_DEBUG) console.log('[DODGE FX] END');
            } else {
                const progress = this.dodgeTimer / this.dodgeDuration;

                // Debug phase logging
                if (OBSERVATION_VISUAL_DEBUG) {
                    let currentPhase = null;
                    if (progress < this._PHASE_ANTICIPATION_END) {
                        currentPhase = 'ANTICIPATION';
                    } else if (progress < this._PHASE_SNAP_END) {
                        currentPhase = 'SNAP';
                    } else {
                        currentPhase = 'RECOVERY';
                    }
                    
                    if (currentPhase !== this._lastLoggedPhase) {
                        this._lastLoggedPhase = currentPhase;
                        console.log(`[DODGE FX] phase=${currentPhase}`);
                    }
                }

                // Capture afterimage snapshot at end of anticipation phase
                if (!this._snapshotCaptured && progress >= this._PHASE_ANTICIPATION_END) {
                    this._snapshotCaptured = true;
                    this._captureAfterimage();
                }

                // Compute additive offsets for each body part
                this._pendingDodgeOffsets = this._computeDodgeOffsets(this.currentDodge, progress);
                this._hasPendingOverlay = true;
            }
        }
    },

    // ============================================================
    // APPLY DODGE OVERLAY — called from game loop AFTER renderer
    // Reads current pivot transforms, adds dodge offsets additively.
    // ============================================================
    applyDodgeOverlay: function() {
        if (!this._hasPendingOverlay || !this._pendingDodgeOffsets) return;

        const rig = this._getRuntimePlayerRig();
        if (!rig) {
            if (OBSERVATION_VISUAL_DEBUG && !this._warnedNoRig) {
                this._warnedNoRig = true;
                console.warn('[DODGE FX] Runtime R6 pivots missing');
            }
            return;
        }

        const pivots = rig.r6RuntimePivots;
        const offsets = this._pendingDodgeOffsets;
        const pivotNames = ['torsoPivot', 'headPivot', 'rightArmPivot', 'leftArmPivot', 'rightLegPivot', 'leftLegPivot'];

        let appliedAny = false;

        for (let i = 0; i < pivotNames.length; i++) {
            const name = pivotNames[i];
            const pivot = pivots[name];
            const off = offsets[name];

            if (!pivot) {
                if (OBSERVATION_VISUAL_DEBUG && !this._warnedMissingPivots[name]) {
                    this._warnedMissingPivots[name] = true;
                    console.warn(`[DODGE FX] Missing pivot: ${name}`);
                }
                continue;
            }
            if (!off) continue;

            // ADDITIVE position offset: current + dodge offset
            if (off.px !== 0 || off.py !== 0 || off.pz !== 0) {
                pivot.position.x += off.px;
                pivot.position.y += off.py;
                pivot.position.z += off.pz;
                appliedAny = true;
            }

            // ADDITIVE rotation offset: current quaternion * dodge quaternion
            if (off.rx !== 0 || off.ry !== 0 || off.rz !== 0) {
                const offsetQuat = _tempQuat.setFromEuler(_tempEuler.set(off.rx, off.ry, off.rz, 'XYZ'));
                pivot.quaternion.multiply(offsetQuat);
                appliedAny = true;
            }

            pivot.updateMatrixWorld(true);
        }

        if (appliedAny && OBSERVATION_VISUAL_DEBUG && !this._loggedOverlayApplied) {
            this._loggedOverlayApplied = true;
            console.log('[DODGE FX] overlay applied');
        }
    },

    // ============================================================
    // COMPUTE DODGE OFFSETS — 3-phase with secondary motion delay
    // Returns { pivotName: { px, py, pz, rx, ry, rz } }
    // ============================================================
    _computeDodgeOffsets: function(direction, progress) {
        const offsets = {
            torsoPivot:    { px: 0, py: 0, pz: 0, rx: 0, ry: 0, rz: 0 },
            headPivot:     { px: 0, py: 0, pz: 0, rx: 0, ry: 0, rz: 0 },
            rightArmPivot: { px: 0, py: 0, pz: 0, rx: 0, ry: 0, rz: 0 },
            leftArmPivot:  { px: 0, py: 0, pz: 0, rx: 0, ry: 0, rz: 0 },
            rightLegPivot: { px: 0, py: 0, pz: 0, rx: 0, ry: 0, rz: 0 },
            leftLegPivot:  { px: 0, py: 0, pz: 0, rx: 0, ry: 0, rz: 0 }
        };

        // Secondary motion delay offsets (fraction of progress) - staggered for cinematic feel
        // Torso reacts first, then head, then arms, then legs
        const torsoDelay = 0;
        const headDelay = 0.07;   // ~15ms delay
        const armDelay = 0.12;    // ~26ms delay
        const legDelay = 0.16;    // ~35ms delay

        // Natural variation: ±15% rotation, ±10% timing
        const v = this._dodgeVariation;
        const vRot = 1.0 + (v - 0.5) * 0.30;   // 0.85 → 1.15
        const vTime = 1.0 + (v - 0.5) * 0.20;   // 0.90 → 1.10

        // Compute intensity per body part with delay
        const torsoIntensity = this._computePhaseIntensity(Math.max(0, progress - torsoDelay) * vTime);
        const headIntensity  = this._computePhaseIntensity(Math.max(0, progress - headDelay) * vTime);
        const armIntensity   = this._computePhaseIntensity(Math.max(0, progress - armDelay) * vTime);
        const legIntensity   = this._computePhaseIntensity(Math.max(0, progress - legDelay) * vTime);

        switch (direction) {
            case 'LEFT':
                this._computeDodgeLeftOffsets(offsets, torsoIntensity, headIntensity, armIntensity, legIntensity, vRot);
                break;
            case 'RIGHT':
                this._computeDodgeRightOffsets(offsets, torsoIntensity, headIntensity, armIntensity, legIntensity, vRot);
                break;
            case 'CROUCH':
                this._computeDodgeCrouchOffsets(offsets, torsoIntensity, headIntensity, armIntensity, legIntensity, vRot);
                break;
        }

        return offsets;
    },

    // ============================================================
    // 3-PHASE INTENSITY CURVE
    // Anticipation: 0→15% — subtle buildup (easeInQuad)
    // Snap: 15%→65% — fast peak with short hold (easeOutCubic to peak, then hold)
    // Recovery: 65%→100% — return to zero with slight elastic overshoot
    // ============================================================
    _computePhaseIntensity: function(progress) {
        if (progress <= 0) return 0;
        if (progress >= 1) return 0;

        const A_END = this._PHASE_ANTICIPATION_END;
        const S_END = this._PHASE_SNAP_END;
        const HOLD_START = 0.40;  // Hold starts at 40% of total duration (middle of snap)
        const HOLD_END = 0.48;    // Hold ends at 48% of total duration (short 8% hold)

        if (progress < A_END) {
            // ANTICIPATION: 0→15% — subtle micro-reaction (easeInQuad)
            const t = progress / A_END;
            return t * t * 0.15;  // max 15% of full intensity
        } else if (progress < HOLD_START) {
            // SNAP FIRST HALF: 15%→40% — fast rise (easeOutCubic)
            const t = (progress - A_END) / (HOLD_START - A_END);
            const snap = 1 - Math.pow(1 - t, 3);  // easeOutCubic
            return 0.15 + snap * 0.85;  // 15% → 100%
        } else if (progress < HOLD_END) {
            // PEAK HOLD: 40%→48% — short hold at peak intensity
            return 1.0;  // Maintain peak
        } else if (progress < S_END) {
            // SNAP SECOND HALF: 48%→65% — start recovery from peak
            const t = (progress - HOLD_END) / (S_END - HOLD_END);
            return 1.0 - t * 0.1;  // Slight dip from peak (100% → 90%)
        } else {
            // RECOVERY: 65%→100% — elastic return to zero with slight overshoot
            const t = (progress - S_END) / (1 - S_END);
            
            // Base easeInOutQuad curve
            const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
            
            // Add slight elastic overshoot: dip slightly below zero then return
            // Overshoot is very small (4% of amplitude) at ~75% progress
            const overshoot = Math.sin(t * Math.PI) * 0.04 * (1 - t);
            
            return Math.max(0, 0.9 - ease * 0.9 - overshoot);  // 90% → 0% with slight elastic
        }
    },

    // ============================================================
    // DODGE LEFT — Cinematic additive offsets with whole-body shift
    // ============================================================
    _computeDodgeLeftOffsets: function(off, tI, hI, aI, lI, vR) {
        // WHOLE-BODY VISUAL SHIFT - all parts share X offset for "lách" feel
        // Torso: strong lean left + twist + shared X shift
        off.torsoPivot.px = -0.48 * tI * vR;      // Stronger X shift
        off.torsoPivot.rz = 0.58 * tI * vR;       // Increased lean rotation
        off.torsoPivot.ry = 0.22 * tI * vR;       // Increased twist

        // Head: follows torso with delay, with slight overshoot and inertia
        // Head should lag slightly behind torso, then catch up
        off.headPivot.px = -0.38 * hI * vR;       // Increased head X shift
        off.headPivot.rz = 0.27 * hI * vR;        // Increased head lean
        off.headPivot.ry = 0.08 * hI * vR;        // Head twist follows torso

        // Arms: Shared X shift + distinct counter-motion
        // Left arm (inner side): follows lean with inertia
        off.leftArmPivot.px = -0.32 * aI * vR;    // Shared X shift
        off.leftArmPivot.rz = 0.42 * aI * vR;     // Follow lean with more weight
        off.leftArmPivot.rx = 0.25 * aI * vR;     // Inertia
        off.leftArmPivot.ry = 0.10 * aI * vR;     // Slight twist

        // Right arm (outer side): strong counter-reaction
        off.rightArmPivot.px = -0.32 * aI * vR;   // Shared X shift
        off.rightArmPivot.rz = -0.65 * aI * vR;   // Stronger counter-reaction
        off.rightArmPivot.rx = -0.38 * aI * vR;   // Stronger inertia
        off.rightArmPivot.ry = -0.12 * aI * vR;   // Counter twist

        // Legs: Shared X shift + counter-balance
        off.rightLegPivot.px = -0.25 * lI * vR;   // Shared X shift
        off.rightLegPivot.rz = 0.15 * lI * vR;    // Counter-balance
        off.rightLegPivot.ry = 0.05 * lI * vR;    // Slight twist

        off.leftLegPivot.px = -0.25 * lI * vR;    // Shared X shift
        off.leftLegPivot.rz = -0.10 * lI * vR;    // Counter-balance
        off.leftLegPivot.ry = -0.05 * lI * vR;    // Slight twist
    },

    // ============================================================
    // DODGE RIGHT — Mirror of left with slight variation
    // ============================================================
    _computeDodgeRightOffsets: function(off, tI, hI, aI, lI, vR) {
        // WHOLE-BODY VISUAL SHIFT - all parts share X offset for "lách" feel
        // Torso: strong lean right + twist + shared X shift
        off.torsoPivot.px = 0.48 * tI * vR;       // Stronger X shift
        off.torsoPivot.rz = -0.58 * tI * vR;      // Increased lean rotation
        off.torsoPivot.ry = -0.20 * tI * vR;      // Increased twist

        // Head: follows torso with delay, with slight overshoot and inertia
        off.headPivot.px = 0.38 * hI * vR;        // Increased head X shift
        off.headPivot.rz = -0.27 * hI * vR;       // Increased head lean
        off.headPivot.ry = -0.08 * hI * vR;       // Head twist follows torso

        // Arms: Shared X shift + distinct counter-motion
        // Right arm (inner side): follows lean with inertia
        off.rightArmPivot.px = 0.32 * aI * vR;    // Shared X shift
        off.rightArmPivot.rz = -0.42 * aI * vR;    // Follow lean with more weight
        off.rightArmPivot.rx = 0.22 * aI * vR;    // Inertia
        off.rightArmPivot.ry = -0.10 * aI * vR;   // Slight twist

        // Left arm (outer side): strong counter-reaction
        off.leftArmPivot.px = 0.32 * aI * vR;     // Shared X shift
        off.leftArmPivot.rz = 0.65 * aI * vR;     // Stronger counter-reaction
        off.leftArmPivot.rx = -0.35 * aI * vR;    // Stronger inertia
        off.leftArmPivot.ry = 0.12 * aI * vR;     // Counter twist

        // Legs: Shared X shift + counter-balance
        off.leftLegPivot.px = 0.25 * lI * vR;     // Shared X shift
        off.leftLegPivot.rz = -0.15 * lI * vR;    // Counter-balance
        off.leftLegPivot.ry = -0.05 * lI * vR;    // Slight twist

        off.rightLegPivot.px = 0.25 * lI * vR;    // Shared X shift
        off.rightLegPivot.rz = 0.10 * lI * vR;     // Counter-balance
        off.rightLegPivot.ry = 0.05 * lI * vR;     // Slight twist
    },

    // ============================================================
    // DODGE CROUCH — Fast drop with head clearing
    // ============================================================
    _computeDodgeCrouchOffsets: function(off, tI, hI, aI, lI, vR) {
        // Torso: strong drop + slight forward lean
        off.torsoPivot.py = -0.60 * tI * vR;      // Stronger Y drop
        off.torsoPivot.rx = 0.35 * tI * vR;      // Increased forward lean
        off.torsoPivot.rz = 0.05 * tI * vR * (this._dodgeVariation - 0.5) * 2;

        // Head: drops lower than torso for clear "duck" silhouette, follows with delay
        off.headPivot.py = -0.45 * hI * vR;      // Stronger head drop for clearing
        off.headPivot.rx = 0.25 * hI * vR;       // Increased head forward lean

        // Arms: secondary motion, protect head
        off.rightArmPivot.rx = 0.45 * aI * vR;   // Stronger arm raise
        off.rightArmPivot.rz = -0.18 * aI * vR;  // Slight inward motion
        off.leftArmPivot.rx = 0.45 * aI * vR;    // Stronger arm raise
        off.leftArmPivot.rz = 0.18 * aI * vR;   // Slight inward motion

        // Legs: compress more for crouch
        off.rightLegPivot.rx = 0.35 * lI * vR;   // Stronger leg compression
        off.leftLegPivot.rx = 0.35 * lI * vR;    // Stronger leg compression
    },

    // ============================================================
    // AFTERIMAGE UPDATE — fade and cleanup
    // ============================================================
    _updateAfterimages: function(now) {
        for (let i = this._activeShadows.length - 1; i >= 0; i--) {
            const entry = this._activeShadows[i];
            let allExpired = true;

            // Update each layer
            for (let li = 0; li < entry.layers.length; li++) {
                const layer = entry.layers[li];
                if (!layer.active) continue;

                const age = now - layer.createdAt - layer.staggerOffset;
                if (age < 0) {
                    allExpired = false;
                    continue;
                }

                if (age >= layer.lifetime) {
                    // Layer expired
                    layer.active = false;
                    if (layer.group) layer.group.visible = false;
                } else {
                    allExpired = false;
                    // easeOutCubic fade: opacity = start * (1 - t)^3
                    const t = age / layer.lifetime;
                    const opacity = layer.startOpacity * Math.pow(1 - t, 3);

                    // Apply opacity to all meshes in this layer
                    if (layer.group) {
                        layer.group.traverse(function(child) {
                            if (child.isMesh && child.material && child.material.transparent) {
                                child.material.opacity = opacity;
                            }
                        });
                    }
                }
            }

            if (allExpired) {
                this._releaseShadowEntry(entry);
                this._activeShadows.splice(i, 1);
                if (OBSERVATION_VISUAL_DEBUG) console.log('[SHADOW] CLEANUP');
            }
        }
    },



    // ============================================================
    // CAPTURE AFTERIMAGE — snapshot player R6 body parts at current pose
    // NO DOUBLE TRANSFORM: Mesh world matrices are captured directly
    // ============================================================
    _captureAfterimage: function() {
        const rig = this._getRuntimePlayerRig();

        if (!rig) {
            if (OBSERVATION_VISUAL_DEBUG) {
                console.log('[SHADOW] Runtime R6 rig missing');
            }
            return;
        }

        // Initialize pool on first use
        if (!this._poolInitialized) {
            this._initShadowPool();
        }

        // Limit active shadows
        if (this._activeShadows.length >= this.maxAfterimages) {
            const oldest = this._activeShadows.shift();
            this._releaseShadowEntry(oldest);
        }

        // Determine chain level
        const now = Date.now();
        const timeSinceLast = now - this._lastDodgeTime;
        let chainLevel = 0;
        if (timeSinceLast < 300) chainLevel = 1;
        if (timeSinceLast < 250 && this._dodgeCount >= 3) chainLevel = 2;

        // Acquire from pool
        const entry = this._acquireShadowEntry();
        if (!entry) return;

        // Ensure root group is at world identity (meshes hold exact world transform)
        entry.rootGroup.position.set(0, 0, 0);
        entry.rootGroup.quaternion.identity();
        entry.rootGroup.scale.set(1, 1, 1);
        entry.rootGroup.visible = true;

        // ---- LAYER A — Main Shadow (all body parts) ----
        this._snapshotLayerParts(entry.layers[0], rig, 0.85, 1.0, null);
        entry.layers[0].active = true;
        entry.layers[0].createdAt = now;
        entry.layers[0].lifetime = this._LAYER_A_LIFETIME;
        entry.layers[0].startOpacity = 0.85;
        entry.layers[0].staggerOffset = (this._activeShadows.length % 3) * 15;
        entry.layers[0].group.visible = true;

        if (OBSERVATION_VISUAL_DEBUG) console.log('[SHADOW] SPAWN layerA');

        // ---- LAYER B — Edge Shadow (chain ≥1) ----
        if (chainLevel >= 1 && entry.layers[1]) {
            this._snapshotLayerParts(entry.layers[1], rig, 0.45, 1.04, null);
            entry.layers[1].active = true;
            entry.layers[1].createdAt = now;
            entry.layers[1].lifetime = this._LAYER_B_LIFETIME;
            entry.layers[1].startOpacity = 0.45;
            entry.layers[1].staggerOffset = (this._activeShadows.length % 3) * 15 + 10;
            entry.layers[1].group.visible = true;

            if (OBSERVATION_VISUAL_DEBUG) console.log('[SHADOW] SPAWN layerB');
        }

        // ---- LAYER C — Motion Smear (chain ≥2) ----
        if (chainLevel >= 2 && entry.layers[2] && this.currentDodge) {
            this._snapshotLayerParts(entry.layers[2], rig, 0.25, 1.0, this.currentDodge);
            entry.layers[2].active = true;
            entry.layers[2].createdAt = now;
            entry.layers[2].lifetime = this._LAYER_C_LIFETIME;
            entry.layers[2].startOpacity = 0.25;
            entry.layers[2].staggerOffset = 0;
            entry.layers[2].group.visible = true;

            if (OBSERVATION_VISUAL_DEBUG) console.log('[SHADOW] SPAWN layerC');
        }

        // Add to scene if not already added
        if (Renderer3D.scene && !entry.rootGroup.parent) {
            Renderer3D.scene.add(entry.rootGroup);
        }

        this._activeShadows.push(entry);
    },

    // ============================================================
    // SNAPSHOT LAYER PARTS — Direct World Matrix Capture (No Double Transform)
    // ============================================================
    _snapshotLayerParts: function(layer, rig, opacity, scaleMultiplier, smearDirection) {
        if (!layer || !layer.group) return;

        layer.group.visible = true;

        const parts = rig.r6Parts;
        const partKeys = ['torsoMesh', 'headMesh', 'rightArmMesh', 'leftArmMesh', 'rightLegMesh', 'leftLegMesh'];

        // Smear offset in player space
        let smearWorldOffset = null;
        if (smearDirection && typeof InputManager !== 'undefined') {
            const yaw = InputManager.cameraYaw || 0;
            const cos = Math.cos(yaw);
            const sin = Math.sin(yaw);

            smearWorldOffset = new THREE.Vector3();
            if (smearDirection === 'LEFT') {
                // Negative player X
                smearWorldOffset.set(-cos * 0.08, 0, sin * 0.08);
            } else if (smearDirection === 'RIGHT') {
                // Positive player X
                smearWorldOffset.set(cos * 0.08, 0, -sin * 0.08);
            } else if (smearDirection === 'CROUCH') {
                smearWorldOffset.set(0, -0.06, 0);
            }
        }

        for (let i = 0; i < partKeys.length; i++) {
            const key = partKeys[i];
            const srcMesh = parts ? parts[key] : null;
            const shadowMesh = layer.partMeshes[key];

            if (!srcMesh || !shadowMesh) continue;

            // Force world matrix update on source mesh
            srcMesh.updateMatrixWorld(true);

            // Read world transform directly
            srcMesh.getWorldPosition(_tempPos);
            srcMesh.getWorldQuaternion(_tempQuat);
            srcMesh.getWorldScale(_tempScale);

            if (smearWorldOffset) {
                _tempPos.add(smearWorldOffset);
            }

            shadowMesh.position.copy(_tempPos);
            shadowMesh.quaternion.copy(_tempQuat);
            shadowMesh.scale.copy(_tempScale).multiplyScalar(scaleMultiplier);
            shadowMesh.visible = true;

            if (shadowMesh.material) {
                shadowMesh.material.opacity = opacity;
            }
        }
    },

    // ============================================================
    // SHADOW POOL — Initialization
    // ============================================================
    _initShadowPool: function() {
        if (this._poolInitialized) return;

        const rig = this._getRuntimePlayerRig();
        if (!rig) return;

        // Shared materials (unlit, dark)
        // Layer A — Main shadow: near-black, high opacity
        this._sharedShadowMaterial = new THREE.MeshBasicMaterial({
            color: 0x050508,
            transparent: true,
            opacity: 0.85,
            depthWrite: false,
            side: THREE.FrontSide,
            blending: THREE.NormalBlending
        });

        // Layer B — Edge: very dark navy, slight Haki hint, BackSide for outline effect
        this._sharedEdgeMaterial = new THREE.MeshBasicMaterial({
            color: 0x1a1a2e,
            transparent: true,
            opacity: 0.45,
            depthWrite: false,
            side: THREE.BackSide,
            blending: THREE.NormalBlending
        });

        // Layer C — Smear: dark, very transparent
        this._sharedSmearMaterial = new THREE.MeshBasicMaterial({
            color: 0x080810,
            transparent: true,
            opacity: 0.25,
            depthWrite: false,
            side: THREE.FrontSide,
            blending: THREE.NormalBlending
        });

        // Pre-create pool entries
        for (let p = 0; p < this.maxAfterimages; p++) {
            const entry = this._createShadowEntry(rig);
            if (entry) {
                this._shadowPool.push(entry);
            }
        }

        this._poolInitialized = true;

        if (OBSERVATION_VISUAL_DEBUG) console.log('[SHADOW] pool initialized');
    },

    // ============================================================
    // CREATE SHADOW ENTRY — Pre-build flat hierarchy using r6Parts geometries
    // ============================================================
    _createShadowEntry: function(rigParam) {
        const rig = rigParam || this._getRuntimePlayerRig();
        if (!rig || !rig.r6Parts) return null;

        const parts = rig.r6Parts;
        const partKeys = ['torsoMesh', 'headMesh', 'rightArmMesh', 'leftArmMesh', 'rightLegMesh', 'leftLegMesh'];

        const rootGroup = new THREE.Group();
        rootGroup.name = 'hakiShadowRoot';
        rootGroup.visible = false;
        rootGroup.renderOrder = 999;

        // Build 3 layers: A (main), B (edge), C (smear)
        const layers = [];

        for (let layerIdx = 0; layerIdx < 3; layerIdx++) {
            const materialTemplate = layerIdx === 0 ? this._sharedShadowMaterial :
                                     layerIdx === 1 ? this._sharedEdgeMaterial :
                                     this._sharedSmearMaterial;

            const layerGroup = new THREE.Group();
            layerGroup.name = 'shadowLayer_' + layerIdx;
            layerGroup.visible = false;
            rootGroup.add(layerGroup);

            const partMeshes = {};

            for (let i = 0; i < partKeys.length; i++) {
                const key = partKeys[i];
                const srcMesh = parts[key];
                if (!srcMesh || !srcMesh.geometry) continue;

                // Share geometry, create individual material instance
                const shadowMat = materialTemplate ? materialTemplate.clone() : new THREE.MeshBasicMaterial({
                    color: 0x050508,
                    transparent: true,
                    opacity: 0.85,
                    depthWrite: false
                });

                const shadowMesh = new THREE.Mesh(srcMesh.geometry, shadowMat);
                shadowMesh.name = 'shadow_' + key + '_' + layerIdx;
                shadowMesh.frustumCulled = false;
                shadowMesh.renderOrder = 999;
                shadowMesh.visible = false;
                layerGroup.add(shadowMesh);

                partMeshes[key] = shadowMesh;
            }

            layers.push({
                group: layerGroup,
                partMeshes: partMeshes,
                active: false,
                createdAt: 0,
                lifetime: 0,
                startOpacity: 0,
                staggerOffset: 0
            });
        }

        return {
            rootGroup: rootGroup,
            layers: layers,
            inUse: false
        };
    },

    // ============================================================
    // ACQUIRE / RELEASE POOL
    // ============================================================
    _acquireShadowEntry: function() {
        // Try to find unused entry in pool
        for (let i = 0; i < this._shadowPool.length; i++) {
            if (!this._shadowPool[i].inUse) {
                const entry = this._shadowPool[i];
                entry.inUse = true;
                entry.rootGroup.visible = true;

                // Reset all layers
                for (let li = 0; li < entry.layers.length; li++) {
                    entry.layers[li].active = false;
                    entry.layers[li].group.visible = false;
                }

                return entry;
            }
        }

        // Pool exhausted — recycle oldest active entry
        if (this._activeShadows.length > 0) {
            const recycled = this._activeShadows.shift();
            this._releaseShadowEntry(recycled);
            recycled.inUse = true;
            recycled.rootGroup.visible = true;
            return recycled;
        }

        // Fallback: create dynamic entry
        const newEntry = this._createShadowEntry();
        if (newEntry) {
            newEntry.inUse = true;
            this._shadowPool.push(newEntry);
            return newEntry;
        }
        return null;
    },

    _releaseShadowEntry: function(entry) {
        if (!entry) return;

        entry.inUse = false;
        entry.rootGroup.visible = false;

        if (entry.rootGroup.parent) {
            entry.rootGroup.parent.remove(entry.rootGroup);
        }

        for (let li = 0; li < entry.layers.length; li++) {
            entry.layers[li].active = false;
            entry.layers[li].group.visible = false;
        }
    },

    // ============================================================
    // TRY DODGE (unchanged gameplay logic — only visual hooks added)
    // ============================================================
    tryDodge: function(attackContext) {
        if (!this.isActive) {
            return false;
        }

        // Check stamina
        if (typeof GameState !== 'undefined') {
            if (GameState.stamina < 10) {
                this._log('[OBSERVATION] Not enough stamina to dodge');
                return false;
            }
        }

        // Check if this attack was already dodged
        const attackId = this._getAttackId(attackContext);
        if (this.dodgedAttacks.has(attackId)) {
            return false;
        }

        // Mark as dodged
        this.dodgedAttacks.add(attackId);

        // Consume stamina
        if (typeof GameState !== 'undefined') {
            const oldStamina = GameState.stamina;
            GameState.stamina = Math.max(0, GameState.stamina - 10);
            this._log(`[OBSERVATION] STAMINA ${oldStamina} -> ${GameState.stamina}`);
        }

        // Determine dodge direction based on attack
        const dodgeDirection = this._determineDodgeDirection(attackContext);

        // Trigger visual dodge
        this._triggerDodgeAnimation(dodgeDirection);

        this._log(`[OBSERVATION] DODGE ${dodgeDirection}`);
        this._log('[OBSERVATION] ATTACK DODGED');

        return true;
    },

    // ============================================================
    // GET ATTACK ID (unchanged)
    // ============================================================
    _getAttackId: function(attackContext) {
        if (attackContext.projectile) {
            return `proj_${attackContext.projectile.id || Date.now()}`;
        }
        if (attackContext.attackerX !== undefined && attackContext.attackerZ !== undefined) {
            return `melee_${attackContext.attackerX.toFixed(2)}_${attackContext.attackerZ.toFixed(2)}_${Date.now()}`;
        }
        return `attack_${Date.now()}_${Math.random()}`;
    },

    // ============================================================
    // DETERMINE DODGE DIRECTION (unchanged)
    // ============================================================
    _determineDodgeDirection: function(attackContext) {
        if (typeof PlayerController === 'undefined' || typeof InputManager === 'undefined') {
            return 'CROUCH';
        }

        const playerX = PlayerController.position.x;
        const playerZ = PlayerController.position.z;
        const cameraYaw = InputManager.cameraYaw;

        let attackFromX, attackFromZ;

        if (attackContext.attackerX !== undefined && attackContext.attackerZ !== undefined) {
            attackFromX = attackContext.attackerX;
            attackFromZ = attackContext.attackerZ;
        } else if (attackContext.projectile && attackContext.projectile.x !== undefined) {
            attackFromX = attackContext.projectile.x;
            attackFromZ = attackContext.projectile.z;
        } else {
            return 'CROUCH';
        }

        const dx = attackFromX - playerX;
        const dz = attackFromZ - playerZ;

        const cos = Math.cos(-cameraYaw);
        const sin = Math.sin(-cameraYaw);
        const relX = dx * cos - dz * sin;
        const relZ = dx * sin + dz * cos;

        if (Math.abs(relX) > Math.abs(relZ)) {
            return relX > 0 ? 'LEFT' : 'RIGHT';
        } else {
            return relZ > 0 ? 'CROUCH' : 'RIGHT';
        }
    },

    // ============================================================
    // TRIGGER DODGE ANIMATION — Start 3-phase visual
    // ============================================================
    _triggerDodgeAnimation: function(direction) {
        const now = Date.now();

        // Track chain
        const timeSinceLast = now - this._lastDodgeTime;
        if (timeSinceLast < 350) {
            this._dodgeCount++;
        } else {
            this._dodgeCount = 1;
        }
        this._lastDodgeTime = now;

        // Random variation seed
        this._dodgeVariation = Math.random();

        // Start new dodge (resets any existing)
        this.currentDodge = direction;
        this.dodgeTimer = 0;
        this._snapshotCaptured = false;
        this._loggedOverlayApplied = false;
        this._lastLoggedPhase = null;

        // Initial offsets (zero at start)
        this._pendingDodgeOffsets = this._computeDodgeOffsets(direction, 0);
        this._hasPendingOverlay = true;

        // Sound
        this._playDodgeWhoosh();

        if (OBSERVATION_VISUAL_DEBUG) console.log('[DODGE FX] ' + direction);
    },

    // ============================================================
    // SYNTHESIZED WHOOSH SOUND
    // Uses Web Audio API directly inside this module — no external files
    // ============================================================
    _playDodgeWhoosh: function() {
        const now = Date.now();
        if (now - this._lastWhooshTime < this._WHOOSH_THROTTLE) return;
        this._lastWhooshTime = now;

        let audioCtx = null;

        if (typeof AudioController !== 'undefined' && AudioController._audioContext) {
            audioCtx = AudioController._audioContext;
        }

        if (!audioCtx && this._ownAudioCtx) {
            audioCtx = this._ownAudioCtx;
        }

        if (!audioCtx) {
            try {
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                this._ownAudioCtx = audioCtx;
            } catch (e) {
                return;
            }
        }

        if (audioCtx.state === 'suspended') return;

        try {
            const t = audioCtx.currentTime;
            const duration = 0.06;

            const sampleRate = audioCtx.sampleRate;
            const samples = Math.floor(sampleRate * duration);
            const buffer = audioCtx.createBuffer(1, samples, sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < samples; i++) {
                data[i] = (Math.random() * 2 - 1) * 0.5;
            }

            const noise = audioCtx.createBufferSource();
            noise.buffer = buffer;

            const filter = audioCtx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(1200, t);
            filter.frequency.exponentialRampToValueAtTime(400, t + duration);
            filter.Q.value = 2.0;

            const gain = audioCtx.createGain();
            gain.gain.setValueAtTime(0.04, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

            noise.connect(filter);
            filter.connect(gain);
            gain.connect(audioCtx.destination);

            noise.start(t);
            noise.stop(t + duration);
        } catch (e) {
            // Silently ignore audio synthesis errors
        }
    },

    // ============================================================
    // DEBUG LOGGING (unchanged)
    // ============================================================
    _log: function(message) {
        if (this.debug) {
            console.log(message);
        }
    },

    // ============================================================
    // DEBUG TEST FUNCTIONS
    // ============================================================
    debugTestDodge: function() {
        if (!this.isActive) {
            console.log('[OBSERVATION DEBUG] Haki is OFF - enabling Haki for test...');
            this.toggle();
        }

        const testAttack = {
            source: 'debug_test',
            damage: 10,
            attackerX: (typeof PlayerController !== 'undefined') ? PlayerController.position.x + 5 : 5,
            attackerZ: (typeof PlayerController !== 'undefined') ? PlayerController.position.z : 0,
            timestamp: Date.now()
        };

        console.log('[OBSERVATION DEBUG] Triggering test dodge...');
        this.tryDodge(testAttack);
    },

    debugTestChainDodge: function(count = 6) {
        if (!this.isActive) {
            console.log('[OBSERVATION DEBUG] Haki is OFF - enabling Haki for test...');
            this.toggle();
        }

        console.log(`[OBSERVATION DEBUG] Triggering ${count} test dodges...`);

        for (let i = 0; i < count; i++) {
            this._scheduleUiTimer(() => {
                // Check if Haki is still active before triggering dodge
                if (!this.isActive) return;
                
                const playerX = (typeof PlayerController !== 'undefined') ? PlayerController.position.x : 0;
                const playerZ = (typeof PlayerController !== 'undefined') ? PlayerController.position.z : 0;

                const testAttack = {
                    source: 'debug_chain_test',
                    damage: 10,
                    attackerX: playerX + (Math.random() - 0.5) * 10,
                    attackerZ: playerZ + (Math.random() - 0.5) * 10,
                    timestamp: Date.now() + i
                };

                this.tryDodge(testAttack);
            }, i * 150);
        }
    }
};

// ============================================================
// TEMP OBJECTS & HELPERS — Reusable to avoid GC pressure
// ============================================================
const _tempQuat = typeof THREE !== 'undefined' ? new THREE.Quaternion() : { setFromEuler: function() { return this; } };
const _tempEuler = typeof THREE !== 'undefined' ? new THREE.Euler() : { set: function() { return this; } };
const _tempPos = typeof THREE !== 'undefined' ? new THREE.Vector3() : { set: function() { return this; }, add: function() { return this; } };
const _tempScale = typeof THREE !== 'undefined' ? new THREE.Vector3() : { set: function() { return this; } };

if (typeof window !== 'undefined') {
    window.ObservationHaki = ObservationHaki;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ObservationHaki;
}