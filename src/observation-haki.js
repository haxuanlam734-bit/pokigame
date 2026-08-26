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
    overlayElement: null,
    crackImage: null,          // PNG crack overlay image element (Layer A - Main)
    glowImage: null,           // Soft glow duplicate (Layer B)
    shimmerImage: null,       // Energy shimmer layer (Layer C)
    edgeAura: null,            // Edge aura layer
    particles: [],            // Micro particles (Layer D)
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
    // OVERLAY PULSE
    // ============================================================
    _overlayPulseTimer: 0,
    _overlayBaseOpacity: 0,       // Base opacity for PNG crack overlay (0 when OFF, 0.62 when ON)

    // ============================================================
    // CINEMATIC ENERGY SYSTEM
    // ============================================================
    _breathingTimer: 0,          // Breathing animation timer
    _breathingPhase: 0,          // Current breathing phase (0-1)
    _breathingDuration: 3500,    // Base breathing duration (ms)
    _glowPhaseOffset: 0,         // Fixed glow phase offset (set once, reused)
    _shimmerTimer: 0,            // Next shimmer trigger timer
    _shimmerCooldown: 2800,      // Base shimmer cooldown (ms)
    _nodePulseTimer: 0,          // Next node pulse timer
    _nodePulseCooldown: 1050,    // Base node pulse cooldown (ms)
    _nodePulseIntensity: 0,      // Current node pulse intensity (0-1)
    _nodePulseDecay: 0,          // Node pulse decay rate per ms
    _dodgePulseIntensity: 0,     // Current dodge pulse intensity (0-1)
    _dodgePulseDecay: 0,         // Dodge pulse decay rate per ms
    _shimmerGeneration: 0,       // Shimmer generation counter for latest-event-wins
    _shimmerRaf: null,           // requestAnimationFrame handle for shimmer movement
    _isActivating: false,        // Flag for activation sequence
    _activationTimer: 0,         // Activation sequence timer
    _awakenSequence: false,      // Flag for awaken animation
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
        this._createOverlay();
        this._setupInput();
        console.log('[OBSERVATION] Khởi tạo xong');
    },

    // ============================================================
    // OVERLAY (visual only) — PNG crack overlay with cinematic layers
    // ============================================================
    _createOverlay: function() {
        this.overlayElement = document.createElement('div');
        this.overlayElement.id = 'haki-overlay';
        this.overlayElement.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 1000;
            opacity: 0;
            transition: opacity 0.2s ease;
        `;
        document.body.appendChild(this.overlayElement);

        // Layer A - Main PNG crack artwork
        this.crackImage = document.createElement('img');
        this.crackImage.className = 'haki-crack-overlay';
        this.crackImage.src = 'src/assets/haki-crack-overlay.png';
        this.crackImage.style.cssText = `
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
            display: block;
            pointer-events: none;
            user-select: none;
            object-fit: contain;
            opacity: 0;
            z-index: 10;
            transform: none;
        `;
        this.overlayElement.appendChild(this.crackImage);

        // Layer B - Soft glow duplicate
        this.glowImage = document.createElement('img');
        this.glowImage.className = 'haki-crack-glow';
        this.glowImage.src = 'src/assets/haki-crack-overlay.png';
        this.glowImage.style.cssText = `
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
            display: block;
            pointer-events: none;
            user-select: none;
            object-fit: contain;
            opacity: 0;
            filter: blur(6px);
            mix-blend-mode: screen;
            z-index: 5;
            transform: none;
        `;
        this.overlayElement.appendChild(this.glowImage);

        // Layer C - Energy shimmer (initially hidden)
        this.shimmerImage = document.createElement('img');
        this.shimmerImage.className = 'haki-crack-shimmer';
        this.shimmerImage.src = 'src/assets/haki-crack-overlay.png';
        this.shimmerImage.style.cssText = `
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
            display: block;
            pointer-events: none;
            user-select: none;
            object-fit: contain;
            opacity: 0;
            filter: blur(2px);
            mix-blend-mode: screen;
            z-index: 8;
            transform: none;
            --shimmer-x: 50%;
            --shimmer-y: 50%;
            --shimmer-size: 15%;
            mask-image: radial-gradient(circle var(--shimmer-size) at var(--shimmer-x) var(--shimmer-y), rgba(255,255,255,1) 0%, rgba(255,255,255,0.85) 25%, rgba(255,255,255,0.45) 50%, rgba(255,255,255,0) 75%);
            -webkit-mask-image: radial-gradient(circle var(--shimmer-size) at var(--shimmer-x) var(--shimmer-y), rgba(255,255,255,1) 0%, rgba(255,255,255,0.85) 25%, rgba(255,255,255,0.45) 50%, rgba(255,255,255,0) 75%);
            mask-size: 100% 100%;
            -webkit-mask-size: 100% 100%;
        `;
        this.overlayElement.appendChild(this.shimmerImage);

        // Layer D - Edge aura
        this.edgeAura = document.createElement('div');
        this.edgeAura.className = 'haki-edge-aura';
        this.edgeAura.style.cssText = `
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            user-select: none;
            background: radial-gradient(circle at center, transparent 60%, rgba(100, 200, 255, 0.05) 90%, rgba(80, 180, 255, 0.08) 100%);
            opacity: 0;
            z-index: 3;
        `;
        this.overlayElement.appendChild(this.edgeAura);

        // Create micro particles (8-15 particles)
        this._createParticles();

        if (OBSERVATION_VISUAL_DEBUG) {
            console.log('[HAKI UI] crack overlay initialized');
        }
    },

    // ============================================================
    // CREATE MICRO PARTICLES
    // ============================================================
    _createParticles: function() {
        const particleCount = 12; // 8-15 particles
        
        for (let i = 0; i < particleCount; i++) {
            const particle = document.createElement('div');
            particle.className = 'haki-particle';
            
            // Random position along edges
            const edge = Math.floor(Math.random() * 4); // 0: top, 1: right, 2: bottom, 3: left
            let x, y;
            
            switch (edge) {
                case 0: // top
                    x = Math.random() * 100;
                    y = Math.random() * 15;
                    break;
                case 1: // right
                    x = 85 + Math.random() * 15;
                    y = Math.random() * 100;
                    break;
                case 2: // bottom
                    x = Math.random() * 100;
                    y = 85 + Math.random() * 15;
                    break;
                case 3: // left
                    x = Math.random() * 15;
                    y = Math.random() * 100;
                    break;
            }
            
            const size = 1 + Math.random() * 1.5; // 1-2.5px
            const baseOpacity = 0.08 + Math.random() * 0.22; // 0.08-0.30
            
            particle.style.cssText = `
                position: absolute;
                left: ${x}%;
                top: ${y}%;
                width: ${size}px;
                height: ${size}px;
                background: rgba(100, 200, 255, ${baseOpacity});
                border-radius: 50%;
                pointer-events: none;
                opacity: 0;
                z-index: 15;
            `;
            
            this.overlayElement.appendChild(particle);
            
            this.particles.push({
                element: particle,
                baseOpacity: baseOpacity,
                phase: Math.random() * Math.PI * 2,
                speed: 0.3 + Math.random() * 0.4,
                active: false,
                timer: Math.random() * 3000,
                duration: 2000 + Math.random() * 2000
            });
        }
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
            
            // Start activation "awaken" sequence
            this._isActivating = true;
            this._activationTimer = 0;
            this._breathingTimer = 0;
            this._breathingPhase = 0;
            this._glowPhaseOffset = 0.08 + Math.random() * 0.12; // Set once, reuse for entire session
            this._shimmerTimer = 1500 + Math.random() * 1500; // Initial shimmer delay
            this._nodePulseTimer = 500 + Math.random() * 500; // Initial node pulse delay
            this._nodePulseIntensity = 0;
            this._dodgePulseIntensity = 0;
            this._shimmerGeneration = 0;
            
            // Clear any stale timers from previous session
            this._clearUiTimers();
            
            // Set overlay visible immediately
            this.overlayElement.style.transition = 'opacity 0.05s ease-out';
            this.overlayElement.style.opacity = '1';
            
            // Reset layers to hidden state
            if (this.crackImage) {
                this.crackImage.style.opacity = '0';
            }
            if (this.glowImage) {
                this.glowImage.style.opacity = '0';
                this.glowImage.style.transform = 'scale(1)';
            }
            if (this.shimmerImage) {
                this._cancelShimmerAnimation();
                this.shimmerImage.style.opacity = '0';
                this.shimmerImage.style.setProperty('--shimmer-x', '50%');
                this.shimmerImage.style.setProperty('--shimmer-y', '50%');
                this.shimmerImage.style.setProperty('--shimmer-size', '15%');
                this.shimmerImage.style.maskImage = 'radial-gradient(circle var(--shimmer-size) at var(--shimmer-x) var(--shimmer-y), rgba(255,255,255,1) 0%, rgba(255,255,255,0.85) 25%, rgba(255,255,255,0.45) 50%, rgba(255,255,255,0) 75%)';
                this.shimmerImage.style.webkitMaskImage = 'radial-gradient(circle var(--shimmer-size) at var(--shimmer-x) var(--shimmer-y), rgba(255,255,255,1) 0%, rgba(255,255,255,0.85) 25%, rgba(255,255,255,0.45) 50%, rgba(255,255,255,0) 75%)';
            }
            if (this.edgeAura) this.edgeAura.style.opacity = '0';
            
            if (OBSERVATION_VISUAL_DEBUG) {
                console.log('[HAKI UI] AWAKEN');
            }

            const hakiStatus = document.getElementById('haki-status');
            if (hakiStatus) hakiStatus.style.display = 'flex';
        } else {
            this._log('[OBSERVATION] OFF');
            // Use faster fade-out for OFF state
            this.overlayElement.style.transition = 'opacity 0.19s ease-in';
            this.overlayElement.style.opacity = '0';
            this._overlayBaseOpacity = 0;
            
            // Fade all layers
            if (this.crackImage) {
                this.crackImage.style.opacity = '0';
            }
            if (this.glowImage) {
                this.glowImage.style.opacity = '0';
                this.glowImage.style.transform = 'scale(1)';
            }
            if (this.shimmerImage) {
                this._cancelShimmerAnimation();
                this.shimmerImage.style.opacity = '0';
                this.shimmerImage.style.setProperty('--shimmer-x', '50%');
                this.shimmerImage.style.setProperty('--shimmer-y', '50%');
                this.shimmerImage.style.setProperty('--shimmer-size', '15%');
                this.shimmerImage.style.maskImage = 'radial-gradient(circle var(--shimmer-size) at var(--shimmer-x) var(--shimmer-y), rgba(255,255,255,1) 0%, rgba(255,255,255,0.85) 25%, rgba(255,255,255,0.45) 50%, rgba(255,255,255,0) 75%)';
                this.shimmerImage.style.webkitMaskImage = 'radial-gradient(circle var(--shimmer-size) at var(--shimmer-x) var(--shimmer-y), rgba(255,255,255,1) 0%, rgba(255,255,255,0.85) 25%, rgba(255,255,255,0.45) 50%, rgba(255,255,255,0) 75%)';
            }
            if (this.edgeAura) this.edgeAura.style.opacity = '0';
            
            // Deactivate particles
            this.particles.forEach(p => {
                p.active = false;
                p.element.style.opacity = '0';
            });
            
            this._isActivating = false;
            this._nodePulseIntensity = 0;
            this._dodgePulseIntensity = 0;
            this._shimmerGeneration = 0;
            
            if (OBSERVATION_VISUAL_DEBUG) {
                console.log('[HAKI UI] FADE OUT');
            }
            
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
            
            // Use faster fade-out for forced OFF
            this.overlayElement.style.transition = 'opacity 0.19s ease-in';
            this.overlayElement.style.opacity = '0';
            this._overlayBaseOpacity = 0;
            
            // Fade all layers with transform reset
            if (this.crackImage) {
                this.crackImage.style.opacity = '0';
            }
            if (this.glowImage) {
                this.glowImage.style.opacity = '0';
                this.glowImage.style.transform = 'scale(1)';
            }
            if (this.shimmerImage) {
                this._cancelShimmerAnimation();
                this.shimmerImage.style.opacity = '0';
                this.shimmerImage.style.setProperty('--shimmer-x', '50%');
                this.shimmerImage.style.setProperty('--shimmer-y', '50%');
                this.shimmerImage.style.setProperty('--shimmer-size', '15%');
                this.shimmerImage.style.maskImage = 'radial-gradient(circle var(--shimmer-size) at var(--shimmer-x) var(--shimmer-y), rgba(255,255,255,1) 0%, rgba(255,255,255,0.85) 25%, rgba(255,255,255,0.45) 50%, rgba(255,255,255,0) 75%)';
                this.shimmerImage.style.webkitMaskImage = 'radial-gradient(circle var(--shimmer-size) at var(--shimmer-x) var(--shimmer-y), rgba(255,255,255,1) 0%, rgba(255,255,255,0.85) 25%, rgba(255,255,255,0.45) 50%, rgba(255,255,255,0) 75%)';
            }
            if (this.edgeAura) this.edgeAura.style.opacity = '0';
            
            // Deactivate particles
            this.particles.forEach(p => {
                p.active = false;
                p.element.style.opacity = '0';
            });
            
            this._isActivating = false;
            this._nodePulseIntensity = 0;
            this._dodgePulseIntensity = 0;
            this._shimmerGeneration = 0;
            
            if (OBSERVATION_VISUAL_DEBUG) {
                console.log('[HAKI UI] FADE OUT');
            }
            
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
        this._nodePulseIntensity = 0;
        this._nodePulseDecay = 0;
        this._dodgePulseIntensity = 0;
        this._dodgePulseDecay = 0;
        this._shimmerGeneration = 0;
        this._cancelShimmerAnimation();
        
        // Clear all UI timers
        this._clearUiTimers();
        
        // Reset cinematic timers
        this._isActivating = false;
        this._activationTimer = 0;
        this._breathingTimer = 0;
        this._breathingPhase = 0;
        this._shimmerTimer = 0;
        this._nodePulseTimer = 0;
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
    // UPDATE CINEMATIC ENERGY SYSTEM
    // ============================================================
    _updateCinematicEnergy: function(deltaTime) {
        // Skip during activation sequence
        if (this._isActivating) {
            this._updateActivationSequence(deltaTime);
            return;
        }

        // ---- Energy Breathing ----
        this._breathingTimer += deltaTime;
        this._breathingPhase = (this._breathingTimer % this._breathingDuration) / this._breathingDuration;
        
        // Smooth sine wave breathing for main crack
        const breathingSine = Math.sin(this._breathingPhase * Math.PI * 2);
        
        // Phase offset for glow (150-350ms offset) - use fixed offset set during activation
        const glowPhase = (this._breathingPhase + this._glowPhaseOffset) % 1;
        const glowSine = Math.sin(glowPhase * Math.PI * 2);
        
        // ---- Node Pulse Decay ----
        if (this._nodePulseIntensity > 0) {
            this._nodePulseIntensity = Math.max(0, this._nodePulseIntensity - this._nodePulseDecay * deltaTime);
        }
        
        // ---- Dodge Pulse Decay ----
        if (this._dodgePulseIntensity > 0) {
            this._dodgePulseIntensity = Math.max(0, this._dodgePulseIntensity - this._dodgePulseDecay * deltaTime);
        }
        
        // ---- Compute final multipliers ----
        const nodeMultiplier = 1 + this._nodePulseIntensity * 0.15; // +0-15%
        const dodgeMultiplier = 1 + this._dodgePulseIntensity * 0.25; // +0-25%
        
        // ---- Apply composite opacity ----
        // Main: breathing base * dodge pulse
        const mainBase = 0.62 + breathingSine * 0.03; // 0.59 → 0.65
        const mainOpacity = Math.min(0.86, mainBase * dodgeMultiplier);
        
        // Glow: breathing base * node pulse * dodge pulse
        const glowBase = 0.12 + glowSine * 0.04; // 0.08 → 0.16
        const glowOpacity = Math.min(0.30, glowBase * nodeMultiplier * dodgeMultiplier);
        
        // Multi-scale breathing for glow
        const glowScale = 1.0 + glowSine * 0.006; // 1.00 → 1.012
        
        // Apply breathing directly (no per-frame transition)
        if (this.crackImage) {
            this.crackImage.style.opacity = String(mainOpacity);
        }
        if (this.glowImage) {
            this.glowImage.style.opacity = String(glowOpacity);
            this.glowImage.style.transform = `scale(${glowScale})`;
        }

        if (this.edgeAura) {
            this.edgeAura.style.opacity = String(0.05 + breathingSine * 0.02);
        }

        // Log breathing occasionally
        if (OBSERVATION_VISUAL_DEBUG && Math.random() < 0.001) {
            console.log('[HAKI UI] BREATH');
        }

        // ---- Energy Shimmer ----
        this._shimmerTimer -= deltaTime;
        if (this._shimmerTimer <= 0) {
            this._triggerShimmer();
            this._shimmerTimer = this._shimmerCooldown * (0.7 + Math.random() * 0.6); // 1.8-4.5s
        }

        // ---- Fracture Node Pulse ----
        this._nodePulseTimer -= deltaTime;
        if (this._nodePulseTimer <= 0) {
            this._triggerNodePulse();
            this._nodePulseTimer = this._nodePulseCooldown * (0.7 + Math.random() * 0.8); // 0.7-1.4s
        }

        // ---- Update Particles ----
        this._updateParticles(deltaTime);
    },

    // ============================================================
    // SHIMMER HELPERS
    // ============================================================
    _cancelShimmerAnimation: function() {
        if (this._shimmerRaf !== null) {
            cancelAnimationFrame(this._shimmerRaf);
            this._shimmerRaf = null;
        }
    },

    _animateShimmer: function(startX, startY, endX, endY, duration, generation) {
        if (!this.shimmerImage) return;

        this._cancelShimmerAnimation();

        const startTime = performance.now();
        const img = this.shimmerImage;

        img.style.opacity = '0';
        img.style.setProperty('--shimmer-x', startX + '%');
        img.style.setProperty('--shimmer-y', startY + '%');
        img.style.setProperty('--shimmer-size', '15%');

        const tick = function(now) {
            if (generation !== img.__owner?._shimmerGeneration) return;
            if (!img.isConnected) return;

            let t = (now - startTime) / duration;
            if (t > 1) t = 1;

            const eased = 1 - Math.pow(1 - t, 3);
            const cx = startX + (endX - startX) * eased;
            const cy = startY + (endY - startY) * eased;

            img.style.setProperty('--shimmer-x', cx + '%');
            img.style.setProperty('--shimmer-y', cy + '%');

            if (t < 1) {
                img.__owner._shimmerRaf = requestAnimationFrame(tick);
            } else {
                img.__owner._shimmerRaf = null;
            }
        };

        img.__owner = this;
        this._shimmerRaf = requestAnimationFrame(tick);
    },

    // ============================================================
    // TRIGGER ENERGY SHIMMER — MOVING HOTSPOT
    // ============================================================
    _triggerShimmer: function() {
        if (!this.shimmerImage) return;

        this._shimmerGeneration++;
        const generation = this._shimmerGeneration;

        const directions = ['top-left', 'top-right', 'left', 'right', 'bottom-left', 'bottom-right'];
        const direction = directions[Math.floor(Math.random() * directions.length)];

        let startPos = { x: 50, y: 50 };
        let endPos = { x: 50, y: 50 };

        switch (direction) {
            case 'top-left':
                startPos = { x: 5, y: 5 };
                endPos = { x: 22, y: 22 };
                break;
            case 'top-right':
                startPos = { x: 95, y: 5 };
                endPos = { x: 78, y: 22 };
                break;
            case 'left':
                startPos = { x: 3, y: 50 };
                endPos = { x: 18, y: 50 };
                break;
            case 'right':
                startPos = { x: 97, y: 50 };
                endPos = { x: 82, y: 50 };
                break;
            case 'bottom-left':
                startPos = { x: 5, y: 95 };
                endPos = { x: 22, y: 78 };
                break;
            case 'bottom-right':
                startPos = { x: 95, y: 95 };
                endPos = { x: 78, y: 78 };
                break;
        }

        const duration = 300 + Math.random() * 250;

        this.shimmerImage.style.transition = 'opacity 0.08s ease-out';
        this.shimmerImage.style.opacity = '0.30';

        this._animateShimmer(startPos.x, startPos.y, endPos.x, endPos.y, duration, generation);

        this._scheduleUiTimer(function() {
            if (generation === this._shimmerGeneration && this.shimmerImage) {
                this.shimmerImage.style.transition = 'opacity 0.18s ease-in';
                this.shimmerImage.style.opacity = '0';
            }
        }.bind(this), duration + 40);
    },

    // ============================================================
    // TRIGGER FRACTURE NODE PULSE
    // ============================================================
    _triggerNodePulse: function() {
        if (!this.glowImage) return;

        // Set pulse intensity and decay rate
        this._nodePulseIntensity = 1;
        this._nodePulseDecay = 8 + Math.random() * 6; // 8-14 per second (decays to 0 in ~80-140ms)
        
        if (OBSERVATION_VISUAL_DEBUG) {
            console.log('[HAKI UI] NODE PULSE');
        }
    },

    // ============================================================
    // UPDATE PARTICLES
    // ============================================================
    _updateParticles: function(deltaTime) {
        for (let i = 0; i < this.particles.length; i++) {
            const particle = this.particles[i];
            
            particle.timer -= deltaTime;
            
            if (particle.timer <= 0) {
                // Toggle particle state
                particle.active = !particle.active;
                particle.timer = particle.active ? particle.duration : 2000 + Math.random() * 3000;
                
                if (particle.active) {
                    particle.element.style.transition = 'opacity 0.5s ease-out';
                    particle.element.style.opacity = String(particle.baseOpacity);
                } else {
                    particle.element.style.transition = 'opacity 0.3s ease-in';
                    particle.element.style.opacity = '0';
                }
            }
            
            // Slight drift for active particles
            if (particle.active) {
                particle.phase += particle.speed * deltaTime * 0.001;
                const drift = Math.sin(particle.phase) * 3;
                particle.element.style.transform = `translateY(${drift}px)`;
            }
        }
    },

    // ============================================================
    // UPDATE ACTIVATION SEQUENCE
    // ============================================================
    _updateActivationSequence: function(deltaTime) {
        this._activationTimer += deltaTime;
        const progress = this._activationTimer / 280; // 280ms total sequence
        
        if (progress >= 1) {
            this._isActivating = false;
            this._activationTimer = 0;
            // Reset pulse states when activation completes
            this._nodePulseIntensity = 0;
            this._dodgePulseIntensity = 0;
            return;
        }

        // Sequence: 0 → faint → visible → peak → normal
        if (progress < 0.35) {
            // 0-100ms: faint crack appears
            const opacity = progress * 0.35; // 0 → 0.12
            if (this.crackImage) this.crackImage.style.opacity = String(opacity);
            if (this.glowImage) this.glowImage.style.opacity = String(opacity * 0.2);
        } else if (progress < 0.64) {
            // 100-180ms: crack + glow become visible
            const opacity = 0.12 + (progress - 0.35) * 1.53; // 0.12 → 0.62
            if (this.crackImage) this.crackImage.style.opacity = String(opacity);
            if (this.glowImage) this.glowImage.style.opacity = String(opacity * 0.19);
        } else {
            // 180-280ms: peak reveal → normal breathing
            const opacity = 0.62 + (progress - 0.64) * 0.05; // 0.62 → 0.64
            if (this.crackImage) this.crackImage.style.opacity = String(opacity);
            if (this.glowImage) this.glowImage.style.opacity = String(opacity * 0.19);
        }
    },

    // ============================================================
    // MAIN UPDATE — called from game loop (BEFORE renderer)
    // Computes dodge offsets and updates afterimage fade.
    // Does NOT write to pivots directly. Stores offsets in _pendingDodgeOffsets.
    // ============================================================
    update: function(deltaTime) {
        const now = Date.now();

        // ---- Update cinematic energy system ----
        if (this.isActive) {
            this._updateCinematicEnergy(deltaTime);
        }

        // ---- Update afterimage fade ----
        this._updateAfterimages(now);

        // ---- Update overlay pulse ----
        this._updateOverlayPulse(deltaTime);

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
    // UPDATE OVERLAY PULSE
    // ============================================================
    _updateOverlayPulse: function(deltaTime) {
        if (this._overlayPulseTimer > 0) {
            this._overlayPulseTimer -= deltaTime;
            if (this._overlayPulseTimer <= 0) {
                this._overlayPulseTimer = 0;
                // Do NOT hard-set opacity - let breathing system regain control
                // The dodge multiplier will naturally decay back to 1
            }
        }
    },

    // ============================================================
    // TRIGGER OVERLAY PULSE — directional crack pulse when dodging
    // ============================================================
    _triggerOverlayPulse: function(direction) {
        if (!this.overlayElement || !this.isActive) return;

        // Set dodge pulse intensity and decay rate
        this._dodgePulseIntensity = 1;
        this._dodgePulseDecay = 10 + Math.random() * 5; // 10-15 per second (decays to 0 in ~80-120ms)
        
        // Keep pulse timer for compatibility with existing logic
        this._overlayPulseTimer = 100;  // 100ms pulse duration
        
        // Trigger dodge shimmer
        this._triggerDodgeShimmer(direction);

        if (OBSERVATION_VISUAL_DEBUG) {
            console.log(`[HAKI UI] DODGE PULSE ${direction}`);
        }
    },

    // ============================================================
    // TRIGGER DODGE SHIMMER — MOVING HOTSPOT
    // ============================================================
    _triggerDodgeShimmer: function(direction) {
        if (!this.shimmerImage) return;

        this._shimmerGeneration++;
        const generation = this._shimmerGeneration;

        let startPos = { x: 50, y: 50 };
        let endPos = { x: 50, y: 50 };

        if (direction === 'LEFT') {
            startPos = { x: 3, y: 50 };
            endPos = { x: 18, y: 50 };
        } else if (direction === 'RIGHT') {
            startPos = { x: 97, y: 50 };
            endPos = { x: 82, y: 50 };
        } else if (direction === 'CROUCH') {
            startPos = { x: 50, y: 95 };
            endPos = { x: 50, y: 80 };
        }

        const duration = 80 + Math.random() * 40;

        this.shimmerImage.style.transition = 'opacity 0.06s ease-out';
        this.shimmerImage.style.opacity = '0.40';

        this._animateShimmer(startPos.x, startPos.y, endPos.x, endPos.y, duration, generation);

        this._scheduleUiTimer(function() {
            if (generation === this._shimmerGeneration && this.shimmerImage) {
                this.shimmerImage.style.transition = 'opacity 0.12s ease-in';
                this.shimmerImage.style.opacity = '0';
            }
        }.bind(this), duration + 20);
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

        // Overlay pulse with direction
        this._triggerOverlayPulse(direction);

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