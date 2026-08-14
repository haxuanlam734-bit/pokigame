/**
 * RENDERER.JS - Xử lý vẽ game
 * Vẽ tất cả các entity và UI
 */

const Renderer = {
    canvas: null,
    ctx: null,
    
    /**
     * Khởi tạo renderer
     */
    init: function() {
        console.log('🎨 Khởi tạo Renderer...');
        
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Đặt kích thước canvas
        this.canvas.width = CONFIG.CANVAS_WIDTH;
        this.canvas.height = CONFIG.CANVAS_HEIGHT;
        
        console.log('✅ Renderer khởi tạo xong (' + CONFIG.CANVAS_WIDTH + 'x' + CONFIG.CANVAS_HEIGHT + ')');
    },
    
    /**
     * Vẽ khung hình
     */
    render: function() {
        // Xóa canvas
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Vẽ nền game
        this.drawGameBackground();
        
        // Vẽ pháo đài
        this.drawFortress();
        
        // Vẽ các tường rào
        GameState.walls.forEach(wall => {
            wall.update(0);
            wall.draw(this.ctx);
        });
        
        // Vẽ các tháp pháo
        GameState.towers.forEach(tower => {
            tower.draw(this.ctx);
        });
        
        // Vẽ các máy in tiền
        GameState.minters.forEach(minter => {
            minter.draw(this.ctx);
        });
        
        // Vẽ các zombie
        GameState.zombies.forEach(zombie => {
            zombie.draw(this.ctx);
        });
        
        // Vẽ các đạn
        GameState.bullets.forEach(bullet => {
            this.drawBullet(bullet);
        });
        
        // Vẽ hiệu ứng
        this.drawEffects();
    },
    
    /**
     * Vẽ nền game
     */
    drawGameBackground: function() {
        // Vẽ khu vực xây dựng
        const zone = CONFIG.WALL_PLACEMENT_ZONE;
        
        if (GameState.phase === CONFIG.PHASE_DAY) {
            // Ngày: màu xanh nhạt
            this.ctx.fillStyle = 'rgba(0, 100, 0, 0.2)';
        } else {
            // Đêm: màu tím nhạt
            this.ctx.fillStyle = 'rgba(50, 0, 100, 0.2)';
        }
        
        this.ctx.fillRect(zone.x1, zone.y1, zone.x2 - zone.x1, zone.y2 - zone.y1);
        
        // Viền khu vực
        this.ctx.strokeStyle = '#00ff00';
        this.ctx.lineWidth = 1;
        this.ctx.setLineDash([5, 5]);
        this.ctx.strokeRect(zone.x1, zone.y1, zone.x2 - zone.x1, zone.y2 - zone.y1);
        this.ctx.setLineDash([]);
    },
    
    /**
     * Vẽ pháo đài
     */
    drawFortress: function() {
        const x = CONFIG.FORTRESS_X;
        const y = CONFIG.FORTRESS_Y;
        const w = CONFIG.FORTRESS_WIDTH;
        const h = CONFIG.FORTRESS_HEIGHT;
        
        // Màu pháo đài
        let color = '#ff6600';
        if (GameState.fortressHP < CONFIG.FORTRESS_MAX_HP * 0.5) {
            color = '#ff3333';
        }
        
        // Vẽ thân pháo đài
        this.ctx.fillStyle = color;
        this.ctx.fillRect(x - w / 2, y - h / 2, w, h);
        
        // Viền
        this.ctx.strokeStyle = '#ffff00';
        this.ctx.lineWidth = 3;
        this.ctx.strokeRect(x - w / 2, y - h / 2, w, h);
        
        // Vẽ cờ
        this.drawFortressFlag(x, y - h / 2);
        
        // Vẽ thanh máu pháo đài
        this.drawFortressHealthBar(x, y);
    },
    
    /**
     * Vẽ cờ pháo đài
     * @param {number} x - Tọa độ X
     * @param {number} y - Tọa độ Y
     */
    drawFortressFlag: function(x, y) {
        // Cột cờ
        this.ctx.strokeStyle = '#ffff00';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(x, y);
        this.ctx.lineTo(x, y - 30);
        this.ctx.stroke();
        
        // Lá cờ (hình chữ nhật)
        this.ctx.fillStyle = '#ff0000';
        this.ctx.fillRect(x, y - 30, 20, 12);
    },
    
    /**
     * Vẽ thanh máu pháo đài
     * @param {number} x - Tọa độ X
     * @param {number} y - Tọa độ Y
     */
    drawFortressHealthBar: function(x, y) {
        const barWidth = 80;
        const barHeight = 6;
        const barX = x - barWidth / 2;
        const barY = y + CONFIG.FORTRESS_HEIGHT / 2 + 10;
        
        // Nền thanh máu (đỏ)
        this.ctx.fillStyle = '#ff0000';
        this.ctx.fillRect(barX, barY, barWidth, barHeight);
        
        // HP hiện tại (xanh)
        const hpPercent = Math.max(0, GameState.fortressHP / CONFIG.FORTRESS_MAX_HP);
        this.ctx.fillStyle = '#00ff00';
        this.ctx.fillRect(barX, barY, barWidth * hpPercent, barHeight);
        
        // Viền
        this.ctx.strokeStyle = '#ffff00';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(barX, barY, barWidth, barHeight);
    },
    
    /**
     * Vẽ đạn
     * @param {Bullet} bullet - Đạn
     */
    drawBullet: function(bullet) {
        // Vẽ đạn (tròn nhỏ màu xanh)
        this.ctx.fillStyle = '#00ff00';
        this.ctx.beginPath();
        this.ctx.arc(bullet.x, bullet.y, CONFIG.BULLET_RADIUS, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Hiệu ứng ánh sáng xung quanh
        this.ctx.strokeStyle = 'rgba(0, 255, 0, 0.5)';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.arc(bullet.x, bullet.y, CONFIG.BULLET_RADIUS + 2, 0, Math.PI * 2);
        this.ctx.stroke();
    },
    
    /**
     * Vẽ hiệu ứng
     */
    drawEffects: function() {
        // Tối ưu: hiệu ứng được xử lý riêng nếu cần
    },
    
    /**
     * Cập nhật UI hiển thị
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

            const label = def ? `${def.emoji} ${def.name} - ${Utils.formatMoney(def.cost)}` : btn.textContent;
            btn.textContent = label;
        }

        // Nút xem quảng cáo luôn bật
        const adsBtn = document.getElementById('btn-ads');
        if (adsBtn) {
            adsBtn.disabled = false;
            adsBtn.style.background = '#1a4d1a';
        }
    }
};

// Xuất Renderer
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Renderer;
}
