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

        // ---- HP ----
        const hpDisplay = document.getElementById('hp-display');
        if (hpDisplay) {
            const hp = Math.ceil(GameState.fortressHP);
            hpDisplay.textContent = hp;
        }

        // ---- HP Bar ----
        const hpBar = document.getElementById('hp-bar');
        if (hpBar) {
            const percent = Math.max(0, (GameState.fortressHP / CONFIG.FORTRESS_MAX_HP) * 100);
            hpBar.style.width = percent + '%';
            // Màu tự động theo gradient đã định sẵn trong CSS
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
            'btn-minter': 'minter'
        };

        for (const [btnId, type] of Object.entries(buttons)) {
            const btn = document.getElementById(btnId);
            if (!btn) continue;

            const def = GameState.getBuildingDef(type);
            const unlocked = GameState.hasUnlockedBuilding(type);
            const affordable = GameState.money >= def.cost;
            const isDay = GameState.phase === CONFIG.PHASE_DAY;
            const canUse = unlocked && affordable && isDay;

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