/**
 * GAME-LOOP.JS - V�ng l?p game ch�nh
 * C?p nh?t tr?ng th�i, v?, v� x? l� khung h�nh
 */

const GameLoop = {
    lastFrameTime: 0,
    isRunning: false,
    frameRate: 0,
    frameCount: 0,
    lastFpsUpdate: 0,
    _phaseNotificationTimer: 0,
    _currentNotificationPhase: null,
    _notificationHiding: false,

    // Damage flash state
    _damageFlashTimer: 0,
    _damageIndicatorTimeout: null,
    _lastDamageSoundTime: 0,
    _damageSoundCooldown: 120,

    /**
     * Kh?i d?ng v�ng l?p game
     */
    start: function() {
        console.log('?? Kh?i d?ng Game Loop...');
        this.isRunning = true;
        this.lastFrameTime = 0;
        this.frameCount = 0;
        this.lastFpsUpdate = 0;
        requestAnimationFrame(this.loop.bind(this));
        console.log('? Game Loop d� kh?i d?ng');
    },
    
    /**
     * D?ng v�ng l?p game
     */
    stop: function() {
        console.log('?? D?ng Game Loop');
        this.isRunning = false;
    },
    
    /**
     * V�ng l?p ch�nh
     * @param {number} timestamp - Th?i gian t? browser (performance.now())
     */
    loop: function(timestamp) {
        if (!this.isRunning) return;

        if (!this.lastFrameTime) {
            this.lastFrameTime = timestamp;
            this.lastFpsUpdate = timestamp;
        }

        let deltaTime = timestamp - this.lastFrameTime;
        this.lastFrameTime = timestamp;

        if (!(deltaTime >= 0)) deltaTime = 0;
        if (deltaTime > 250) deltaTime = 250;

        this.update(deltaTime);

        if (typeof PlayerController !== 'undefined' && PlayerController.update) {
            PlayerController.update(deltaTime);
        }

        // Update player animation mixer
        if (typeof Renderer3D !== 'undefined' && Renderer3D.updatePlayerAnimationMixer) {
            Renderer3D.updatePlayerAnimationMixer(deltaTime / 1000);
        }

        // Apply Observation Haki additive dodge visual overlay after locomotion pose is applied
        if (typeof ObservationHaki !== 'undefined' && ObservationHaki.applyDodgeOverlay) {
            ObservationHaki.applyDodgeOverlay();
        }

        this.updateUI();

        if (typeof Renderer3D !== 'undefined' && Renderer3D.render) {
            Renderer3D.render();
        }

        this.updateFPS(timestamp);

        requestAnimationFrame(this.loop.bind(this));
    },
    
    /**
     * C?p nh?t tr?ng th�i game
     * @param {number} deltaTime - Th?i gian delta (ms)
     */
    update: function(deltaTime) {
        if (!GameState.isRunning) return;

        if (typeof TimeCycle !== 'undefined' && TimeCycle.isRunning) {
            TimeCycle.update(deltaTime);
        }

        if (typeof GameState !== 'undefined' && GameState.update) {
            GameState.update(deltaTime);
        }

        if (typeof SpecialEventManager !== 'undefined' && SpecialEventManager.update) {
            SpecialEventManager.update(deltaTime);
        }

        if (typeof LightingController !== 'undefined' && LightingController.update) {
            LightingController.update();
        }

        if (typeof AudioController !== 'undefined' && AudioController.update) {
            AudioController.update();
        }

        // Lazy init grenade system n?u ch?a load
        if (
            typeof GrenadeSystem !== 'undefined' &&
            typeof WeaponSystem !== 'undefined' &&
            !GrenadeSystem._initialized &&
            WeaponSystem._tryInitGrenade
        ) {
            WeaponSystem._tryInitGrenade();
        }

        if (typeof GrenadeSystem !== 'undefined' && GrenadeSystem.update) {
            GrenadeSystem.update(deltaTime);
        }

        // Update Observation Haki afterimages
        if (typeof ObservationHaki !== 'undefined' && ObservationHaki.update) {
            ObservationHaki.update(deltaTime);
        }

        // Update VIP Dash VFX (black streak + silhouette lifetime/fade)
        if (typeof VipDashVFX !== 'undefined' && VipDashVFX.update) {
            VipDashVFX.update(deltaTime);
        }
    },
    
    /**
     * C?p nh?t FPS
     * @param {number} currentTime - Th?i gian hi?n t?i
     */
    updateFPS: function(currentTime) {
        this.frameCount++;
        if (currentTime - this.lastFpsUpdate >= 1000) {
            this.frameRate = this.frameCount;
            this.frameCount = 0;
            this.lastFpsUpdate = currentTime;
        }
    },

    /**
     * Trigger a red damage flash overlay
     */
    triggerDamageFlash: function() {
        const overlay = document.getElementById('damage-overlay');
        if (!overlay) return;

        // Clear any existing timeout to prevent premature fade
        if (this._damageFlashTimeout) {
            clearTimeout(this._damageFlashTimeout);
        }

        // Flash immediately
        overlay.classList.add('flash');
        this._damageFlashTimer = CONFIG.DAMAGE_FLASH_DURATION;

        // Start fade after brief delay
        this._damageFlashTimeout = setTimeout(() => {
            overlay.classList.remove('flash');
            this._damageFlashTimeout = null;
        }, 50);
    },

    /**
     * Show directional damage indicator toward attacker
     */
    showDamageIndicator: function(attackerX, attackerZ) {
        if (typeof PlayerController === 'undefined' || !PlayerController.position || PlayerController.isDead || PlayerController.isRespawning) return;

        const px = PlayerController.position.x;
        const pz = PlayerController.position.z;

        const dx = attackerX - px;
        const dz = attackerZ - pz;

        const camYaw = (typeof InputManager !== 'undefined') ? InputManager.cameraYaw : 0;

        const forwardX = Math.sin(camYaw);
        const forwardZ = Math.cos(camYaw);
        const rightX = Math.cos(camYaw);
        const rightZ = -Math.sin(camYaw);

        const forwardAmount = dx * forwardX + dz * forwardZ;
        const rightAmount = dx * rightX + dz * rightZ;

        let angle = Math.atan2(rightAmount, forwardAmount);
        if (angle < 0) angle += Math.PI * 2;

        const sectors = [
            { id: 'damage-indicator-top',       angle: 0 },
            { id: 'damage-indicator-topright',  angle: Math.PI / 4 },
            { id: 'damage-indicator-right',     angle: Math.PI / 2 },
            { id: 'damage-indicator-bottomright', angle: Math.PI * 3 / 4 },
            { id: 'damage-indicator-bottom',    angle: Math.PI },
            { id: 'damage-indicator-bottomleft', angle: Math.PI * 5 / 4 },
            { id: 'damage-indicator-left',      angle: Math.PI * 3 / 2 },
            { id: 'damage-indicator-topleft',   angle: Math.PI * 7 / 4 }
        ];

        let best = sectors[0];
        let bestDiff = Infinity;
        for (const s of sectors) {
            let diff = angle - s.angle;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            if (Math.abs(diff) < bestDiff) {
                bestDiff = Math.abs(diff);
                best = s;
            }
        }

        const el = document.getElementById(best.id);
        if (!el) return;

        el.classList.add('show');

        if (this._damageIndicatorTimeout) {
            clearTimeout(this._damageIndicatorTimeout);
        }
        this._damageIndicatorTimeout = setTimeout(() => {
            el.classList.remove('show');
            this._damageIndicatorTimeout = null;
        }, 350);
    },

    /**
     * Play short damage hit sound with cooldown
     */
    playDamageSound: function() {
        if (typeof AudioController === 'undefined' || !AudioController.playDamageSound) return;
        const now = performance.now();
        if (now - this._lastDamageSoundTime < this._damageSoundCooldown) return;
        this._lastDamageSoundTime = now;
        AudioController.playDamageSound();
    },

    /**
     * C?p nh?t UI display (3D version)
     */
    updateUI: function() {
        const phaseInfo = (typeof TimeCycle !== 'undefined' && TimeCycle.isRunning)
            ? TimeCycle.getPhaseInfo()
            : { currentPhase: GameState.phase, phaseTimeRemaining: GameState.phaseTimeRemaining };

        const currentPhase = phaseInfo.currentPhase || GameState.phase;

        const phaseBadge = document.getElementById('phase-badge');
        if (phaseBadge) {
            const displayName = (typeof TimeCycle !== 'undefined')
                ? TimeCycle.getPhaseDisplayName()
                : this._getLegacyPhaseDisplayName(currentPhase);
            phaseBadge.textContent = displayName;
            phaseBadge.className = 'phase-badge phase-' + currentPhase;
        }

        const waveDisplay = document.getElementById('wave-display');
        if (waveDisplay) {
            waveDisplay.textContent = GameState.currentWave;
        }

        const timeDisplay = document.getElementById('time-display');
        if (timeDisplay) {
            const remaining = Math.max(0, phaseInfo.phaseTimeRemaining || 0);
            const mins = Math.floor(remaining / 60);
            const secs = Math.floor(remaining % 60);
            timeDisplay.textContent = String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
        }

        this._updatePhaseNotification(currentPhase);

        if (typeof AdminPanel !== 'undefined' && AdminPanel.isOpen) {
            AdminPanel.updateTimeDisplay();
        }

        const moneyDisplay = document.getElementById('money-display');
        if (moneyDisplay) {
            moneyDisplay.textContent = Utils.formatMoney(GameState.money);
        }

        const hpDisplay = document.getElementById('hp-display');
        const hpLossDisplay = document.getElementById('hp-loss-display');
        const hpBar = document.getElementById('hp-bar');
        const hpLostBar = document.getElementById('hp-lost-bar');
        if (hpDisplay) hpDisplay.textContent = `${Math.ceil(GameState.playerHP)}/${Math.ceil(GameState.playerMaxHP)}`;
        if (hpLossDisplay) {
            const lost = Math.max(0, GameState.playerBaseMaxHP - GameState.playerMaxHP);
            hpLossDisplay.textContent = lost > 0 ? `-${lost} MAX` : 'FULL';
        }
        if (hpBar) {
            const percent = Math.max(0, Math.min(100, (GameState.playerHP / GameState.playerBaseMaxHP) * 100));
            hpBar.style.width = percent + '%';
        }
        if (hpLostBar) {
            const lostPercent = Math.max(0, Math.min(100, ((GameState.playerBaseMaxHP - GameState.playerMaxHP) / GameState.playerBaseMaxHP) * 100));
            hpLostBar.style.width = lostPercent + '%';
        }

        const staminaDisplay = document.getElementById('stamina-display');
        const staminaBar = document.getElementById('stamina-bar');
        if (staminaDisplay) staminaDisplay.textContent = `${Math.ceil(GameState.stamina)}`;
        if (staminaBar) staminaBar.style.width = Math.max(0, Math.min(100, (GameState.stamina / GameState.maxStamina) * 100)) + '%';

        const bandageCount = document.getElementById('bandage-count');
        const medkitCount = document.getElementById('medkit-count');
        const bandageBtn = document.getElementById('btn-bandage');
        const medkitBtn = document.getElementById('btn-medkit');
        if (bandageCount) bandageCount.textContent = GameState.bandages;
        if (medkitCount) medkitCount.textContent = GameState.medkits;
        if (bandageBtn) bandageBtn.classList.toggle('disabled', GameState.bandages <= 0 || GameState.playerMaxHP >= GameState.playerBaseMaxHP);
        if (medkitBtn) medkitBtn.classList.toggle('disabled', GameState.medkits <= 0);

        const ammoDisplay = document.getElementById('ammo-display');
        const weaponDisplay = document.getElementById('weapon-display');
        const elWeaponName = document.getElementById('weapon-name');
        const elWeaponMode = document.getElementById('weapon-mode');
        const elAmmoCurr   = document.getElementById('ammo-current');
        const elAmmoMax    = document.getElementById('ammo-max');

        if (typeof WeaponSystem !== 'undefined') {
            const def = WeaponSystem.getCurrentDef();
            const state = WeaponSystem.getCurrentState();
            const isRld = WeaponSystem.isReloading();
            if (def && state) {
                const isMelee  = def.fireMode === 'MELEE';
                const isThrowable = def.fireMode === 'THROWABLE';
                const modeName = def.fireMode === 'SEMI_AUTO' ? 'SEMI'
                               : def.fireMode === 'FULL_AUTO' ? 'AUTO'
                               : def.fireMode === 'BURST'     ? 'BURST'
                               : def.fireMode === 'THROWABLE' ? 'THROW'
                               : 'MELEE';
                if (ammoDisplay)  ammoDisplay.textContent  = isThrowable ? ('x' + (typeof WeaponSystem._grenadeCount !== 'undefined' ? WeaponSystem._grenadeCount : 0)) : (isMelee ? 'MELEE' : isRld ? 'RELOAD...' : `${state.currentAmmo}/${state.reserveAmmo}`);
                if (weaponDisplay) weaponDisplay.textContent = `${def.name} [${modeName}]`;
                if (elWeaponName) elWeaponName.textContent = def.name;
                if (elWeaponMode) elWeaponMode.textContent = isRld ? 'RELOAD...' : modeName;
                if (elAmmoCurr)   elAmmoCurr.textContent   = isThrowable ? (typeof WeaponSystem._grenadeCount !== 'undefined' ? WeaponSystem._grenadeCount : 0) : (isMelee ? '\u221e' : (isRld ? '\u2014' : state.currentAmmo));
                if (elAmmoMax)    elAmmoMax.textContent    = isMelee ? '' : state.reserveAmmo;
            }
        } else {
            if (ammoDisplay)  ammoDisplay.textContent  = `${Math.floor(GameState.ammo)}/${Math.floor(GameState.maxAmmo)}`;
            if (weaponDisplay) weaponDisplay.textContent = `T${GameState.weaponTier} \u2022 ${GameState.weaponDamage} DMG`;
            if (elAmmoCurr)   elAmmoCurr.textContent   = Math.floor(GameState.ammo);
            if (elAmmoMax)    elAmmoMax.textContent    = Math.floor(GameState.maxAmmo);
        }

        this.updateButtonStates();
    },

    _updatePhaseNotification: function(phase) {
        if (this._currentNotificationPhase !== phase) {
            this._currentNotificationPhase = phase;
            this._phaseNotificationTimer = 180;
            this._notificationHiding = false;
        }

        const notif = document.getElementById('phase-notification');
        if (!notif) return;

        if (this._phaseNotificationTimer > 0) {
            this._phaseNotificationTimer--;
            notif.style.display = 'flex';
            notif.style.opacity = Math.min(1, this._phaseNotificationTimer / 30);
            const phaseNames = {
                [CONFIG.PHASE_DAY]: '?? NG�Y',
                [CONFIG.PHASE_SUNSET]: '?? SUNSET',
                [CONFIG.PHASE_NIGHT]: '?? ��M',
                [CONFIG.PHASE_DAWN]: '?? DAWN'
            };
            notif.textContent = phaseNames[phase] || phase.toUpperCase();
        } else if (!this._notificationHiding) {
            this._notificationHiding = true;
            notif.style.opacity = '0';
            setTimeout(function() {
                if (notif.style.opacity === '0') {
                    notif.style.display = 'none';
                }
            }, 300);
        }
    },

    _getLegacyPhaseDisplayName: function(phase) {
        if (phase === CONFIG.PHASE_DAY || phase === CONFIG.PHASE_DAY_LEGACY) return '?? NG�Y';
        if (phase === CONFIG.PHASE_NIGHT || phase === CONFIG.PHASE_NIGHT_LEGACY) return '?? ��M';
        return phase.toUpperCase();
    },

    /**
     * C?p nh?t tr?ng th�i n�t (enable/disable + style)
     */
    updateButtonStates: function() {
        const buttons = {
            'btn-wall': 'wall',
            'btn-turret': 'tower',
            'btn-minter': 'minter',
            'btn-turel': 'turel',
            'btn-minigun': 'minigun'
        };

        for (const [btnId, type] of Object.entries(buttons)) {
            const btn = document.getElementById(btnId);
            if (!btn) continue;

            const def = GameState.getBuildingDef(type);
            const unlocked = GameState.hasUnlockedBuilding(type);
            const affordable = GameState.money >= def.cost;
            const canUse = unlocked && affordable;

            if (type === 'turel') {
                btn.textContent = `${def.emoji} ${def.name} ${GameState.builtBuildings.turel}/${def.maxCount} - ${Utils.formatMoney(def.cost)}`;
            }

            btn.classList.remove('available', 'active', 'disabled');
            
            if (GameState.buildingMode && GameState.buildingType === type) {
                btn.classList.add('active');
            } else if (canUse) {
                btn.classList.add('available');
            } else {
                btn.classList.add('disabled');
            }
        }

        const adsBtn = document.getElementById('btn-ads');
        if (adsBtn) {
            if (GameState.isGameOver) {
                adsBtn.classList.add('disabled');
            } else {
                adsBtn.classList.remove('disabled');
            }
        }
    }
};

// Xu?t GameLoop
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GameLoop;
}


