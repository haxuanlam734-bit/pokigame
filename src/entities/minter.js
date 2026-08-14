/**
 * MINTER.JS - Lớp Máy In Tiền
 * Sinh tiền định kỳ
 */

class Minter {
    /**
     * Khởi tạo máy in tiền
     * @param {number} x - Tọa độ X
     * @param {number} y - Tọa độ Y
     */
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = CONFIG.MINTER_WIDTH;
        this.height = CONFIG.MINTER_HEIGHT;
        
        // Chu kỳ sinh tiền
        this.cycleProgress = 0; // 0 -> 1
        this.cycleTime = CONFIG.MINTER_CYCLE_TIME; // ms
        
        // Animation
        this.rotation = 0;
        this.isActive = true;
        
        console.log('💵 Máy in tiền được tạo');
    }
    
    /**
     * Cập nhật máy in tiền
     * @param {number} deltaTime - Thời gian delta (ms)
     */
    update(deltaTime) {
        // Cập nhật tiến độ chu kỳ
        this.cycleProgress += deltaTime / this.cycleTime;
        
        // Animation xoay
        this.rotation += deltaTime / 20;
        if (this.rotation > Math.PI * 2) {
            this.rotation -= Math.PI * 2;
        }
    }
    
    /**
     * Vẽ máy in tiền
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     */
    draw(ctx) {
        // Vẽ thân máy (hình vuông)
        ctx.fillStyle = '#666666';
        ctx.fillRect(
            this.x - this.width / 2,
            this.y - this.height / 2,
            this.width,
            this.height
        );
        
        // Viền
        ctx.strokeStyle = '#ffff00';
        ctx.lineWidth = 2;
        ctx.strokeRect(
            this.x - this.width / 2,
            this.y - this.height / 2,
            this.width,
            this.height
        );
        
        // Vẽ bánh xe xoay (biểu tượng sinh tiền)
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        
        ctx.fillStyle = '#00ff00';
        ctx.beginPath();
        ctx.arc(0, 0, 12, 0, Math.PI * 2);
        ctx.fill();
        
        // Vẽ các cánh bánh xe
        ctx.strokeStyle = '#ffff00';
        ctx.lineWidth = 2;
        for (let i = 0; i < 4; i++) {
            const angle = (i / 4) * Math.PI * 2;
            const x1 = Math.cos(angle) * 5;
            const y1 = Math.sin(angle) * 5;
            const x2 = Math.cos(angle) * 12;
            const y2 = Math.sin(angle) * 12;
            
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
        }
        
        ctx.restore();
        
        // Vẽ thanh tiến độ
        this.drawProgressBar(ctx);
    }
    
    /**
     * Vẽ thanh tiến độ sinh tiền
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     */
    drawProgressBar(ctx) {
        const barWidth = 35;
        const barHeight = 3;
        const barX = this.x - barWidth / 2;
        const barY = this.y + this.height / 2 + 5;
        
        // Nền thanh (đen)
        ctx.fillStyle = '#000000';
        ctx.fillRect(barX, barY, barWidth, barHeight);
        
        // Tiến độ (xanh)
        const progress = Math.min(1, this.cycleProgress);
        ctx.fillStyle = '#00ff00';
        ctx.fillRect(barX, barY, barWidth * progress, barHeight);
        
        // Viền
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 1;
        ctx.strokeRect(barX, barY, barWidth, barHeight);
    }
}

// Xuất Minter
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Minter;
}
