/**
 * WALL.JS - Lớp Tường Rào
 * Có thanh máu, chắn đường zombie
 */

class Wall {
    /**
     * Khởi tạo tường rào
     * @param {number} x - Tọa độ X
     * @param {number} y - Tọa độ Y
     */
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = CONFIG.WALL_WIDTH;
        this.height = CONFIG.WALL_HEIGHT;
        
        // Máu
        this.hp = CONFIG.WALL_MAX_HP;
        this.maxHp = CONFIG.WALL_MAX_HP;
        
        // Hiệu ứng
        this.damageFlashTime = 0;
        
        console.log('🧱 Tường rào được tạo');
    }
    
    /**
     * Tường nhận sát thương
     * @param {number} damage - Lượng sát thương
     */
    takeDamage(damage) {
        this.hp -= damage;
        this.damageFlashTime = 0.2; // 200ms flash
        
        if (this.hp <= 0) {
            console.log('💥 Tường rào bị phá hủy');
        }
    }
    
    /**
     * Cập nhật tường (hiệu ứng flash)
     * @param {number} deltaTime - Thời gian delta (ms)
     */
    update(deltaTime) {
        if (this.damageFlashTime > 0) {
            this.damageFlashTime -= deltaTime / 1000;
        }
    }
    
    /**
     * Kiểm tra xem tường có bị tiêu diệt không
     * @returns {boolean} Bị tiêu diệt?
     */
    isDestroyed() {
        return this.hp <= 0;
    }
    
    /**
     * Vẽ tường rào
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     */
    draw(ctx) {
        // Màu thay đổi dựa trên HP
        let color = '#00ff00'; // Xanh khi khỏe
        if (this.hp < this.maxHp * 0.5) {
            color = '#ffff00'; // Vàng khi nửa máu
        }
        if (this.hp < this.maxHp * 0.25) {
            color = '#ff6600'; // Cam khi yếu
        }
        
        // Flash nếu vừa bị sát thương
        if (this.damageFlashTime > 0) {
            color = '#ff0000';
        }
        
        // Vẽ tường
        ctx.fillStyle = color;
        ctx.fillRect(
            this.x - this.width / 2,
            this.y - this.height / 2,
            this.width,
            this.height
        );
        
        // Viền
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(
            this.x - this.width / 2,
            this.y - this.height / 2,
            this.width,
            this.height
        );
        
        // Vẽ thanh máu
        this.drawHealthBar(ctx);
    }
    
    /**
     * Vẽ thanh máu phía trên tường
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     */
    drawHealthBar(ctx) {
        const barWidth = 40;
        const barHeight = 4;
        const barX = this.x - barWidth / 2;
        const barY = this.y - this.height / 2 - 10;
        
        // Nền thanh máu (đỏ)
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(barX, barY, barWidth, barHeight);
        
        // HP hiện tại (xanh)
        const hpPercent = Math.max(0, this.hp / this.maxHp);
        ctx.fillStyle = '#00ff00';
        ctx.fillRect(barX, barY, barWidth * hpPercent, barHeight);
        
        // Viền
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.strokeRect(barX, barY, barWidth, barHeight);
    }
}

// Xuất Wall
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Wall;
}
