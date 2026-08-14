/**
 * ZOMBIE.JS - Lớp Zombie
 * Chạy từ phải sang trái về phía pháo đài
 */

class Zombie {
    /**
     * Khởi tạo zombie
     * @param {number} x - Tọa độ X
     * @param {number} y - Tọa độ Y
     * @param {number} speed - Tốc độ
     * @param {number} hp - Máu
     */
    constructor(x, y, speed = CONFIG.ZOMBIE_SPEED, hp = CONFIG.ZOMBIE_MAX_HP) {
        this.x = x;
        this.y = y;
        this.width = CONFIG.ZOMBIE_WIDTH;
        this.height = CONFIG.ZOMBIE_HEIGHT;
        
        // Chuyển động
        this.speed = speed;
        this.vx = -this.speed; // Chạy sang trái
        this.vy = 0;
        
        // Máu
        this.hp = hp;
        this.maxHp = hp;
        this.damage = 10; // Sát thương gây ra cho pháo đài
        
        // Hiệu ứng
        this.damageFlashTime = 0;
        this.animationFrame = 0;
        
        console.log('🧟 Zombie được tạo tại x=' + x);
    }
    
    /**
     * Zombie nhận sát thương
     * @param {number} damage - Lượng sát thương
     */
    takeDamage(damage) {
        this.hp -= damage;
        this.damageFlashTime = 0.1; // 100ms flash
        
        if (this.hp <= 0) {
            console.log('💀 Zombie bị tiêu diệt');
        }
    }
    
    /**
     * Cập nhật zombie (chuyển động, animation)
     * @param {number} deltaTime - Thời gian delta (ms)
     */
    update(deltaTime) {
        const deltaSec = deltaTime / 1000;
        
        // Chuyển động
        this.x += this.vx * deltaSec;
        this.y += this.vy * deltaSec;
        
        // Animation
        this.animationFrame += deltaTime / 100;
        if (this.animationFrame > 4) {
            this.animationFrame = 0;
        }
        
        // Giảm thời gian flash
        if (this.damageFlashTime > 0) {
            this.damageFlashTime -= deltaSec;
        }
    }
    
    /**
     * Kiểm tra xem zombie có bị tiêu diệt không
     * @returns {boolean} Bị tiêu diệt?
     */
    isDestroyed() {
        return this.hp <= 0;
    }
    
    /**
     * Vẽ zombie
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     */
    draw(ctx) {
        // Màu thay đổi dựa trên HP và flash
        let color = '#ff3333'; // Đỏ bình thường
        
        if (this.damageFlashTime > 0) {
            color = '#ffff00'; // Vàng khi bị trúng đạn
        }
        
        // Vẽ thân zombie
        ctx.fillStyle = color;
        ctx.fillRect(
            this.x - this.width / 2,
            this.y - this.height / 2,
            this.width,
            this.height
        );
        
        // Viền
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.strokeRect(
            this.x - this.width / 2,
            this.y - this.height / 2,
            this.width,
            this.height
        );
        
        // Vẽ mắt
        ctx.fillStyle = '#000000';
        const eyeY = this.y - 10;
        const eyeX1 = this.x - 8;
        const eyeX2 = this.x + 8;
        
        ctx.fillRect(eyeX1 - 3, eyeY - 3, 6, 6);
        ctx.fillRect(eyeX2 - 3, eyeY - 3, 6, 6);
        
        // Vẽ miệng (nếu đang ăn)
        if (this.x < CONFIG.FORTRESS_X + 100) {
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(this.x, this.y + 10, 5, 0, Math.PI);
            ctx.stroke();
        }
        
        // Vẽ thanh máu
        this.drawHealthBar(ctx);
    }
    
    /**
     * Vẽ thanh máu phía trên zombie
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     */
    drawHealthBar(ctx) {
        const barWidth = 30;
        const barHeight = 3;
        const barX = this.x - barWidth / 2;
        const barY = this.y - this.height / 2 - 8;
        
        // Nền thanh máu (đỏ)
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(barX, barY, barWidth, barHeight);
        
        // HP hiện tại (xanh)
        const hpPercent = Math.max(0, this.hp / this.maxHp);
        ctx.fillStyle = '#00ff00';
        ctx.fillRect(barX, barY, barWidth * hpPercent, barHeight);
        
        // Viền
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(barX, barY, barWidth, barHeight);
    }
}

// Xuất Zombie
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Zombie;
}
