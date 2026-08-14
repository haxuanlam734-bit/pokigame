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
        
        // Bắt đầu vòng lặp
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
        
        // Tính delta time
        const currentTime = Date.now();
        const deltaTime = currentTime - this.lastFrameTime;
        this.lastFrameTime = currentTime;
        
        // Giới hạn deltaTime (tránh lag spike)
        const clampedDeltaTime = Math.min(deltaTime, 50); // Max 50ms per frame
        
        // Cập nhật player
        if (PlayerController) {
            PlayerController.update(clampedDeltaTime);
        }
        
        // Cập nhật game state
        this.update(clampedDeltaTime);
        
        // Render 3D
        if (Renderer3D) {
            Renderer3D.render();
        }
        
        // Cập nhật UI
        this.updateUI();
        
        // Cập nhật FPS
        this.updateFPS(currentTime);
        
        // Tiếp tục vòng lặp
        requestAnimationFrame(this.loop.bind(this));
    },
    
    /**
     * Cập nhật trạng thái game
     * @param {number} deltaTime - Thời gian delta (ms)
     */
    update: function(deltaTime) {
        if (!GameState.isRunning) return;
        
        // Cập nhật trạng thái game
        GameState.update(deltaTime);
    },
    
    /**
     * Cập nhật FPS
     * @param {number} currentTime - Thời gian hiện tại
     */
    updateFPS: function(currentTime) {
        this.frameCount++;
        
        // Cập nhật mỗi 1 giây
        if (currentTime - this.lastFpsUpdate >= 1000) {
            this.frameRate = this.frameCount;
            this.frameCount = 0;
            this.lastFpsUpdate = currentTime;
            
            // Log FPS nếu cần debug
            // console.log('FPS: ' + this.frameRate);
        }
    },

    /**
     * Cập nhật UI display (3D version)
     */
    updateUI: function() {
        // Cập nhật pha
        const phaseDisplay = document.getElementById('phase-display');
        if (phaseDisplay) {
            phaseDisplay.textContent = GameState.phase === CONFIG.PHASE_DAY ? '☀️ NGÀY' : '🌙 ĐÊM';
        }

        // Cập nhật sóng
        const waveDisplay = document.getElementById('wave-display');
        if (waveDisplay) {
            waveDisplay.textContent = GameState.currentWave;
        }

        // Cập nhật thời gian
        const timeDisplay = document.getElementById('time-display');
        if (timeDisplay) {
            const timeLeft = Math.ceil(GameState.phaseTimeRemaining);
            timeDisplay.textContent = timeLeft + 's';
        }

        // Cập nhật tiền
        const moneyDisplay = document.getElementById('money-display');
        if (moneyDisplay) {
            moneyDisplay.textContent = Utils.formatMoney(GameState.money);
        }

        // Cập nhật HP pháo đài
        const hpDisplay = document.getElementById('hp-display');
        if (hpDisplay) {
            hpDisplay.textContent = Math.ceil(GameState.fortressHP);
        }

        // Cập nhật trạng thái nút
        this.updateButtonStates();
    },

    /**
     * Cập nhật trạng thái nút (enable/disable)
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
            const canUse = unlocked && affordable && GameState.phase === CONFIG.PHASE_DAY;

            btn.disabled = !canUse;
            btn.style.background = canUse ? '#1a4d1a' : '#3a1a1a';
            btn.style.borderColor = canUse ? '#00ff00' : '#ff4d4d';
            btn.style.color = canUse ? '#00ff00' : '#ffaaaa';

            if (GameState.buildingMode && GameState.buildingType === type) {
                btn.style.background = '#00ff00';
                btn.style.color = '#000';
            }
        }

        // Nút xem quảng cáo luôn bật
        const adsBtn = document.getElementById('btn-ads');
        if (adsBtn) {
            adsBtn.disabled = false;
            adsBtn.style.background = '#1a4d1a';
        }
    }

};

// Xuất GameLoop
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GameLoop;
}
