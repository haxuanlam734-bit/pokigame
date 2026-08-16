/**
 * GAME-LOOP.JS - Vòng lặp game chính
 * Cập nhật trạng thái, vẽ, và xử lý khung hình
 */

const GameLoop = {
    lastFrameTime: 0,
    isRunning: false,
    frameRate: 0,
    frameCount: 0,
    lastFpsUpdate: 0,
    
    /**
     * Khởi động vòng lặp game
     */
    start: function() {
        console.log('▶️ Khởi động Game Loop...');
        this.isRunning = true;
        this.lastFrameTime = Date.now();
        this.frameCount = 0;
        this.lastFpsUpdate = this.lastFrameTime;
        requestAnimationFrame(this.loop.bind(this));
        console.log('✅ Game Loop đã khởi động');
    },
    
    /**
     * Dừng vòng lặp game
     */
    stop: function() {
        console.log('⏸️ Dừng Game Loop');
        this.isRunning = false;
    },
    
    /**
     * Vòng lặp chính
     * @param {number} timestamp - Thời gian từ browser
     */
    loop: function(timestamp) {
        if (!this.isRunning) return;
        
        const currentTime = Date.now();
        const deltaTime = currentTime - this.lastFrameTime;
        this.lastFrameTime = currentTime;
        const clampedDeltaTime = Math.min(deltaTime, 50);
        
        if (PlayerController) {
            PlayerController.update(clampedDeltaTime);
        }
        
        this.update(clampedDeltaTime);
        
        if (Renderer3D) {
            Renderer3D.render();
        }
        
        this.updateUI();
        if (Game && Game.updateMilitaryInteraction) {
            Game.updateMilitaryInteraction();
        }
        this.updateFPS(currentTime);
        requestAnimationFrame(this.loop.bind(this));
    },
    
    /**
     * Cập nhật trạng thái game
     * @param {number} deltaTime - Thời gian delta (ms)
     */
    update: function(deltaTime) {
        if (!GameState.isRunning) return;
        GameState.update(deltaTime);
    },
    
    /**
     * Cập nhật FPS
     * @param {number} currentTime - Thời gian hiện tại
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
     * Cập nhật UI display (3D version)
     */
    updateUI: function() {
        // ---- Phase ----
        const phaseBadge = document.getElementById('phase-badge');
        if (phaseBadge) {
            const isDay = GameState.phase === CONFIG.PHASE_DAY;
            phaseBadge.textContent = isDay ? '☀️ NGÀY' : '🌙 ĐÊM';
            phaseBadge.className = 'phase-badge' + (isDay ? '' : ' night');
        }

        // ---- Wave ----
        const waveDisplay = document.getElementById('wave-display');
        if (waveDisplay) {
            waveDisplay.textContent = GameState.currentWave;
        }

        // ---- Time ----
        const timeDisplay = document.getElementById('time-display');
        if (timeDisplay) {
            const timeLeft = Math.ceil(GameState.phaseTimeRemaining);
            timeDisplay.textContent = timeLeft + 's';
        }

        // ---- Money ----
        const moneyDisplay = document.getElementById('money-display');
        if (moneyDisplay) {
            moneyDisplay.textContent = Utils.formatMoney(GameState.money);
        }

        // ---- Player HP / permanent HP loss ----
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

        // ---- Stamina ----
        const staminaDisplay = document.getElementById('stamina-display');
        const staminaBar = document.getElementById('stamina-bar');
        if (staminaDisplay) staminaDisplay.textContent = `${Math.ceil(GameState.stamina)}`;
        if (staminaBar) staminaBar.style.width = Math.max(0, Math.min(100, (GameState.stamina / GameState.maxStamina) * 100)) + '%';

        // ---- Medical items ----
        const bandageCount = document.getElementById('bandage-count');
        const medkitCount = document.getElementById('medkit-count');
        const bandageBtn = document.getElementById('btn-bandage');
        const medkitBtn = document.getElementById('btn-medkit');
        if (bandageCount) bandageCount.textContent = GameState.bandages;
        if (medkitCount) medkitCount.textContent = GameState.medkits;
        if (bandageBtn) bandageBtn.classList.toggle('disabled', GameState.bandages <= 0 || GameState.playerMaxHP >= GameState.playerBaseMaxHP);
        if (medkitBtn) medkitBtn.classList.toggle('disabled', GameState.medkits <= 0);

        // ---- Combat / Weapon stats ----
        const ammoDisplay = document.getElementById('ammo-display');
        const weaponDisplay = document.getElementById('weapon-display');
        if (typeof WeaponSystem !== 'undefined') {
            const def = WeaponSystem.getCurrentDef();
            const state = WeaponSystem.getCurrentState();
            if (def && state) {
                if (ammoDisplay) {
                    if (def.fireMode === 'MELEE') {
                        ammoDisplay.textContent = 'MELEE';
                    } else if (WeaponSystem.isReloading()) {
                        ammoDisplay.textContent = 'RELOAD...';
                    } else {
                        ammoDisplay.textContent = `${state.currentAmmo}/${state.reserveAmmo}`;
                    }
                }
                if (weaponDisplay) {
                    const modeName = def.fireMode === 'SEMI_AUTO' ? 'SEMI'
                                   : def.fireMode === 'FULL_AUTO' ? 'AUTO'
                                   : def.fireMode === 'BURST'     ? 'BURST'
                                   : 'MELEE';
                    weaponDisplay.textContent = `${def.name} [${modeName}]`;
                }
            }
        } else {
            if (ammoDisplay) ammoDisplay.textContent = `${Math.floor(GameState.ammo)}/${Math.floor(GameState.maxAmmo)}`;
            if (weaponDisplay) weaponDisplay.textContent = `T${GameState.weaponTier} • ${GameState.weaponDamage} DMG`;
        }

        // ---- Update Buttons ----
        this.updateButtonStates();
    },

    /**
     * Cập nhật trạng thái nút (enable/disable + style)
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
            const isDay = GameState.phase === CONFIG.PHASE_DAY;
            const canUse = unlocked && affordable && isDay;

            if (type === 'turel') {
                btn.textContent = `${def.emoji} ${def.name} ${GameState.builtBuildings.turel}/${def.maxCount} - ${Utils.formatMoney(def.cost)}`;
            }

            // Xóa các class cũ
            btn.classList.remove('available', 'active', 'disabled');
            
            if (GameState.buildingMode && GameState.buildingType === type) {
                btn.classList.add('active');
            } else if (canUse) {
                btn.classList.add('available');
            } else {
                btn.classList.add('disabled');
            }
        }

        // Nút quảng cáo luôn sẵn sàng (chỉ disable nếu game over)
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

// Xuất GameLoop
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GameLoop;
}
