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
        
        // Cập nhật
        this.update(clampedDeltaTime);
        
        // Vẽ
        Renderer.render();
        
        // Cập nhật UI
        Renderer.updateUI();
        
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
    }
};

// Xuất GameLoop
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GameLoop;
}
