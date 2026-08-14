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
            
            // 3. Khởi tạo Renderer
            Renderer.init();
            
            // 4. Khởi tạo GameState
            GameState.init();
            
            // 5. Setup các nút bấm UI
            this.setupButtons();
            
            // 6. Setup game over screen
            this.setupGameOverScreen();
            
            // 7. Báo cho Poki rằng game tải xong
            await this.waitForAssets();
            PokiManager.gameLoadingFinished();
            
            // 8. Ẩn màn hình loading
            this.hideLoadingScreen();
            
            // 9. Báo cho Poki rằng gameplay bắt đầu
            PokiManager.gameplayStart();
            
            // 10. Khởi động game loop
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
        
        // Nút Tường
        const btnWall = document.getElementById('btn-wall');
        if (btnWall) {
            btnWall.addEventListener('click', () => {
                this.startBuildMode('wall');
            });
        }
        
        // Nút Tháp
        const btnTurret = document.getElementById('btn-turret');
        if (btnTurret) {
            btnTurret.addEventListener('click', () => {
                this.startBuildMode('tower');
            });
        }
        
        // Nút Máy in tiền
        const btnMinter = document.getElementById('btn-minter');
        if (btnMinter) {
            btnMinter.addEventListener('click', () => {
                this.startBuildMode('minter');
            });
        }
        
        // Nút Xem quảng cáo
        const btnAds = document.getElementById('btn-ads');
        if (btnAds) {
            btnAds.addEventListener('click', () => {
                this.showRewardedAd();
            });
        }
    },
    
    /**
     * Bắt đầu chế độ xây dựng
     * @param {string} type - Loại: 'wall', 'tower', 'minter'
     */
    startBuildMode: function(type) {
        if (GameState.phase !== CONFIG.PHASE_DAY) {
            console.log('❌ Chỉ có thể xây dựng vào NGÀY');
            return;
        }
        
        console.log('🔨 Bắt đầu chế độ xây dựng: ' + type);
        
        // Lắng nghe click chuột để đặt building
        const canvas = Renderer.canvas;
        const clickHandler = (event) => {
            const rect = canvas.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            
            // Kiểm tra nếu trong khu vực xây dựng
            const zone = type === 'minter' ? CONFIG.MINTER_PLACEMENT_ZONE || CONFIG.WALL_PLACEMENT_ZONE : CONFIG.WALL_PLACEMENT_ZONE;
            
            if (x >= zone.x1 && x <= zone.x2 && y >= zone.y1 && y <= zone.y2) {
                // Xây dựng
                if (type === 'wall') {
                    GameState.buildWall(x, y);
                } else if (type === 'tower') {
                    GameState.buildTower(x, y);
                } else if (type === 'minter') {
                    GameState.buildMinter(x, y);
                }
            } else {
                console.log('❌ Vị trí xây dựng không hợp lệ');
            }
            
            // Bỏ lắng nghe
            canvas.removeEventListener('click', clickHandler);
            console.log('✅ Chế độ xây dựng kết thúc');
        };
        
        canvas.addEventListener('click', clickHandler);
        console.log('💡 Nhấp chuột trên canvas để đặt ' + type);
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
