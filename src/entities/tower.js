/**
 * TOWER.JS - Lớp Tháp Pháo
 * Tự động xoay nòng và bắn vào zombie gần nhất
 */

class Tower {
    /**
     * Khởi tạo tháp pháo
     * @param {number} x - Tọa độ X
     * @param {number} y - Tọa độ Y
     */
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = CONFIG.TOWER_WIDTH;
        this.height = CONFIG.TOWER_HEIGHT;
        
        // Góc nòng
        this.angle = 0;
        this.targetAngle = 0;
        
        // Bắn
        this.lastShotTime = 0;
        this.fireRate = CONFIG.TOWER_FIRE_RATE;
        
        console.log('🔫 Tháp pháo được tạo');
    }
    
    /**
     * Tìm zombie gần nhất trong tầm
     * @param {Zombie[]} zombies - Danh sách zombie
     * @returns {Zombie|null} Zombie gần nhất hoặc null
     */
    findNearestZombie(zombies) {
        let nearest = null;
        let minDistance = CONFIG.TOWER_RANGE;
        
        for (const zombie of zombies) {
            const dist = Utils.distance(this.x, this.y, zombie.x, zombie.y);
            
            if (dist < minDistance) {
                minDistance = dist;
                nearest = zombie;
            }
        }
        
        return nearest;
    }
    
    /**
     * Cập nhật tháp (xoay và bắn)
     * @param {number} deltaTime - Thời gian delta (ms)
     * @param {Zombie[]} zombies - Danh sách zombie
     * @param {Bullet[]} bullets - Danh sách đạn
     */
    update(deltaTime, zombies, bullets) {
        if (zombies.length === 0) return;
        
        // Tìm zombie gần nhất
        const target = this.findNearestZombie(zombies);
        
        if (target) {
            // Tính góc tới mục tiêu
            this.targetAngle = Utils.getAngle(this.x, this.y, target.x, target.y);
            
            // Làm trơn xoay nòng
            this.angle = Utils.lerpAngle(
                this.angle,
                this.targetAngle,
                CONFIG.TOWER_ROTATION_SPEED
            );
            
            // Bắn nếu đã đến lúc
            const now = Date.now();
            if (now - this.lastShotTime >= this.fireRate) {
                this.shoot(bullets);
                this.lastShotTime = now;
            }
        }
    }
    
    /**
     * Bắn đạn
     * @param {Bullet[]} bullets - Danh sách đạn để thêm vào
     */
    shoot(bullets) {
        // Tạo vận tốc
        const velocity = Utils.getVelocity(this.angle, CONFIG.BULLET_SPEED);
        
        // Tạo đạn
        const bullet = {
            x: this.x,
            y: this.y,
            vx: velocity.vx,
            vy: velocity.vy,
            speed: CONFIG.BULLET_SPEED,
            
            /**
             * Cập nhật vị trí đạn
             * @param {number} deltaTime - Thời gian delta
             */
            update: function(deltaTime) {
                const deltaSec = deltaTime / 1000;
                this.x += this.vx * deltaSec;
                this.y += this.vy * deltaSec;
            }
        };
        
        bullets.push(bullet);
    }
    
    /**
     * Vẽ tháp pháo
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     */
    draw(ctx) {
        // Vẽ thân tháp (hình vuông)
        ctx.fillStyle = '#666666';
        ctx.fillRect(
            this.x - this.width / 2,
            this.y - this.height / 2,
            this.width,
            this.height
        );
        
        // Vẽ viền
        ctx.strokeStyle = '#ffff00';
        ctx.lineWidth = 2;
        ctx.strokeRect(
            this.x - this.width / 2,
            this.y - this.height / 2,
            this.width,
            this.height
        );
        
        // Vẽ nòng (đường tròn + đường kéo dài)
        ctx.fillStyle = '#00ff00';
        ctx.beginPath();
        ctx.arc(this.x, this.y, 8, 0, Math.PI * 2);
        ctx.fill();
        
        // Nòng (đường thẳng)
        const barrelLength = 30;
        const barrelEndX = this.x + Math.cos(this.angle) * barrelLength;
        const barrelEndY = this.y + Math.sin(this.angle) * barrelLength;
        
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(barrelEndX, barrelEndY);
        ctx.stroke();
    }
}

// Xuất Tower
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Tower;
}
