/**
 * MAIN.JS - Điểm vào chính của game
 * Khởi tạo tất cả các hệ thống và quản lý vòng đời game
 */

const Game = {
    /**
     * Khởi tạo và khởi động game
     */
    init: async function() {
        console.log('%c🎮 PHÁO ĐÀI CHỐNG ZOMBIE - Khởi tạo...', 'color: #00ff00; font-size: 16px; font-weight: bold;');
        
        try {
            // 1. Khởi tạo Poki SDK
            PokiManager.init();
            
            // 2. Khởi tạo Input Manager
            InputManager.init();
            
            // 3. Khởi tạo 3D Renderer (Three.js)
            Renderer3D.init();
            
            // 4. Khởi tạo Player Controller
            PlayerController.init();
            
            // 5. Khởi tạo GameState
            GameState.init();
            
            // 6. Setup các nút bấm UI
            this.setupButtons();
            
            // 7. Setup game over screen
            this.setupGameOverScreen();
            
            // 8. Setup build mode input
            this.setupBuildModeInput();
            
            // 9. Báo cho Poki rằng game tải xong
            await this.waitForAssets();
            PokiManager.gameLoadingFinished();
            
            // 10. Ẩn màn hình loading
            this.hideLoadingScreen();
            
            // 11. Báo cho Poki rằng gameplay bắt đầu
            PokiManager.gameplayStart();
            
            // 12. Khởi động game loop
            GameLoop.start();
            
            console.log('%c✅ Game khởi tạo thành công!', 'color: #00ff00; font-size: 14px;');
        } catch (error) {
            console.error('❌ Lỗi khởi tạo game:', error);
            this.hideLoadingScreen();
        }
    },
    
    /**
     * Chờ tài nguyên tải xong
     * @returns {Promise} Promise hoàn tất
     */
    waitForAssets: async function() {
        // Giả sử mọi asset đã tải xong (không có assets bên ngoài)
        return new Promise(resolve => {
            setTimeout(resolve, 100);
        });
    },
    
    /**
     * Ẩn màn hình loading
     */
    hideLoadingScreen: function() {
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.style.display = 'none';
        }
    },
    
    /**
     * Setup các nút bấm
     */
    setupButtons: function() {
        console.log('🔘 Setup buttons...');

        const buttonMap = {
            'wall': document.getElementById('btn-wall'),
            'tower': document.getElementById('btn-turret'),
            'minter': document.getElementById('btn-minter')
        };

        Object.entries(buttonMap).forEach(([type, button]) => {
            if (!button) return;

            const def = GameState.getBuildingDef(type);
            if (def) {
                const label = `${def.emoji} ${def.name} - ${Utils.formatMoney(def.cost)}`;
                button.setAttribute('data-build-type', type);
                button.textContent = label;
            }

            button.addEventListener('click', () => {
                if (!GameState.canBuildBuilding(type)) {
                    console.log('❌ Công trình chưa mở khóa hoặc không đủ tiền:', type);
                    return;
                }
                if (GameState.phase !== CONFIG.PHASE_DAY) {
                    console.log('❌ Chỉ có thể xây dựng vào NGÀY');
                    return;
                }
                // Bật chế độ build 3D (raycasting sẽ được xử lý bởi setupBuildModeInput)
                GameState.startBuildMode(type);
            });
        });

        const btnAds = document.getElementById('btn-ads');
        if (btnAds) {
            btnAds.addEventListener('click', () => {
                this.showRewardedAd();
            });
        }

        const useMedical = (type) => {
            const result = type === 'bandage' ? GameState.useBandage() : GameState.useMedkit();
            this.showMilitaryToast({
                title: type === 'bandage' ? 'BANDAGE' : 'MEDICAL KIT',
                message: result.message,
                success: result.success
            });
            if (result.success) GameState.saveGame();
        };

        const bandageBtn = document.getElementById('btn-bandage');
        const medkitBtn = document.getElementById('btn-medkit');
        if (bandageBtn) bandageBtn.addEventListener('click', () => useMedical('bandage'));
        if (medkitBtn) medkitBtn.addEventListener('click', () => useMedical('medkit'));

        document.addEventListener('keydown', (event) => {
            if (event.repeat) return;
            if (event.key === '1') useMedical('bandage');
            if (event.key === '2') useMedical('medkit');
        });
    },
    
    /**
     * Setup build mode input (3D)
     * Lắng nghe click chuột trên canvas 3D, raycast xuống mặt đất (ground)
     * để xác định vị trí (x, z) và đặt công trình tương ứng khi
     * GameState.buildingMode đang bật.
     * Được gọi 1 lần trong Game.init() -> KHÔNG bind lại nhiều listener.
     */
    setupBuildModeInput: function() {
        console.log('🏗️ Setup Build Mode Input (3D)...');

        const canvas = Renderer3D.canvas;
        if (!canvas) {
            console.warn('⚠️ Không tìm thấy canvas 3D, bỏ qua setupBuildModeInput');
            return;
        }

        canvas.addEventListener('click', (event) => {
            // Chỉ xử lý khi đang ở chế độ xây dựng
            if (!GameState.buildingMode || !GameState.buildingType) return;

            const type = GameState.buildingType;

            // Raycast từ vị trí click chuột xuống mặt đất 3D
            const raycaster = Renderer3D.getRaycaster(event.clientX, event.clientY);
            const point = Renderer3D.getGroundIntersection(raycaster);

            if (!point) {
                console.log('❌ Không xác định được vị trí đặt công trình trên mặt đất');
                return;
            }

            const placed = GameState.placeBuilding(point.x, point.z, type);
            if (placed) {
                GameState.saveGame();
                console.log('✅ Đã đặt ' + type + ' tại (' + point.x.toFixed(0) + ', ' + point.z.toFixed(0) + ')');
            }

            // Thoát chế độ xây dựng sau khi đặt (hoặc thử đặt) xong
            GameState.endBuildMode();
        });

        // Nhấn ESC để hủy chế độ xây dựng
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && GameState.buildingMode) {
                GameState.endBuildMode();
                console.log('✅ Đã hủy chế độ xây dựng');
            }
        });

        console.log('✅ Build Mode Input đã sẵn sàng');
    },
    
    updateMilitaryInteraction: function() {
        const prompt = document.getElementById('military-interaction');
        const title = document.getElementById('military-interaction-title');
        const desc = document.getElementById('military-interaction-desc');
        const action = document.getElementById('military-interaction-action');
        if (!prompt || typeof Renderer3D === 'undefined' || !Renderer3D.getNearbyMilitaryInteraction) return;

        const near = Renderer3D.getNearbyMilitaryInteraction(PlayerController.position.x, PlayerController.position.z);
        this.nearMilitaryInteraction = near;
        if (!near || GameState.isGameOver) {
            prompt.classList.remove('visible');
            return;
        }

        title.textContent = near.name;
        desc.textContent = near.description;
        action.textContent = 'E  ·  VÀO KHU';
        prompt.classList.add('visible');
    },

    interactWithNearbyMilitaryBuilding: function() {
        const near = this.nearMilitaryInteraction;
        if (!near) return;
        const result = GameState.interactWithMilitaryBuilding(near.id);
        this.showMilitaryToast(result);
    },

    showMilitaryToast: function(result) {
        const toast = document.getElementById('military-toast');
        if (!toast) return;
        toast.querySelector('.toast-title').textContent = result.title || 'MILITARY BASE';
        toast.querySelector('.toast-message').textContent = result.message || '';
        toast.classList.add('visible');
        clearTimeout(this._militaryToastTimer);
        this._militaryToastTimer = setTimeout(() => toast.classList.remove('visible'), 2600);
    },

    /**
     * Hiển thị quảng cáo có phần thưởng
     */
    showRewardedAd: function() {
        console.log('📺 Yêu cầu hiển thị quảng cáo có phần thưởng...');
        
        if (!GameState.isRunning) {
            console.log('❌ Game đã kết thúc');
            return;
        }
        
        // Tạm dừng game
        GameLoop.stop();
        
        // Hiển thị ads
        PokiManager.rewardedBreak(
            // onSuccess: Player xem ads xong
            () => {
                console.log('✅ Player xem ads xong, nhân phần thưởng');
                GameState.doubleMoneyFromAd();
                GameState.saveGame();
                
                // Tiếp tục game
                GameLoop.start();
            },
            // onError: Player đóng ads hoặc lỗi
            () => {
                console.log('⚠️ Ads bị đóng hoặc lỗi');
                
                // Tiếp tục game
                GameLoop.start();
            }
        );
    },
    
    /**
     * Setup game over screen
     */
    setupGameOverScreen: function() {
        document.addEventListener('keydown', (event) => {
            if ((event.key === 'e' || event.key === 'E') && !event.repeat) {
                this.interactWithNearbyMilitaryBuilding();
            }
        });

        const interactButton = document.getElementById('military-interaction-action');
        if (interactButton) {
            interactButton.addEventListener('click', () => this.interactWithNearbyMilitaryBuilding());
        }

        const restartBtn = document.getElementById('restart-button');
        if (restartBtn) {
            restartBtn.addEventListener('click', () => {
                this.restart();
            });
        }
    },
    
    /**
     * Hiển thị game over screen
     */
    showGameOverScreen: function() {
        const gameOverScreen = document.getElementById('game-over-screen');
        if (gameOverScreen) {
            // Cập nhật stats
            document.getElementById('final-wave').textContent = GameState.currentWave;
            document.getElementById('final-money').textContent = Math.floor(GameState.money);
            document.getElementById('final-score').textContent = GameState.totalScore;
            
            gameOverScreen.style.display = 'flex';
        }
    },
    
    /**
     * Khởi động lại game
     */
    restart: function() {
        console.log('🔄 Khởi động lại game...');
        
        GameLoop.stop();
        
        const gameOverScreen = document.getElementById('game-over-screen');
        if (gameOverScreen) {
            gameOverScreen.style.display = 'none';
        }
        
        // Reset state
        GameState.init();
        
        // Báo cho Poki
        PokiManager.gameplayStart();
        
        // Khởi động lại game loop
        GameLoop.start();
    }
};

// ===================================
// SETUP GAME STATE LISTENER
// ===================================

// Lắng nghe thay đổi trạng thái game (game over)
setInterval(() => {
    if (GameState.isGameOver && document.getElementById('game-over-screen').style.display !== 'flex') {
        Game.showGameOverScreen();
    }
}, 100);

// ===================================
// KHỞI ĐỘNG GAME KHI TRANG TẢI XONG
// ===================================

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        Game.init();
    });
} else {
    Game.init();
}

// Xuất Game
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Game;
}
