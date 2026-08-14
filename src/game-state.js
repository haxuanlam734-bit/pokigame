/**
 * GAME-STATE.JS - Quản lý trạng thái game
 * Theo dõi tiền, HP, sóng, vv...
 */

const GameState = {
    // =====================
    // GAME STATUS
    // =====================
    isRunning: false,
    isGameOver: false,
    phase: CONFIG.PHASE_DAY,
    currentWave: 1,
    phaseTime: CONFIG.DAY_DURATION,
    phaseTimeRemaining: CONFIG.DAY_DURATION,
    
    // =====================
    // RESOURCES
    // =====================
    money: CONFIG.STARTING_MONEY,
    fortressHP: CONFIG.FORTRESS_MAX_HP,
    
    // =====================
    // ENTITIES
    // =====================
    towers: [],      // Danh sách tháp pháo
    walls: [],       // Danh sách tường rào
    zombies: [],     // Danh sách zombie
    minters: [],     // Danh sách máy in tiền
    bullets: [],     // Danh sách đạn
    
    // =====================
    // SCORE & STATS
    // =====================
    totalScore: 0,
    zombiesKilled: 0,
    moneyEarned: 0,
    buildingsBuilt: 0,
    
    // =====================
    // TIMING
    // =====================
    gameStartTime: 0,
    lastMoneyRegenTime: 0,
    lastZombieSpawnTime: 0,
    
    /**
     * Khởi tạo trạng thái game
     */
    init: function() {
        console.log('🎮 Khởi tạo GameState...');
        
        // Reset trạng thái
        this.isRunning = true;
        this.isGameOver = false;
        this.phase = CONFIG.PHASE_DAY;
        this.currentWave = 1;
        this.phaseTime = CONFIG.DAY_DURATION;
        this.phaseTimeRemaining = CONFIG.DAY_DURATION;
        
        // Reset tài nguyên
        this.money = CONFIG.STARTING_MONEY;
        this.fortressHP = CONFIG.FORTRESS_MAX_HP;
        
        // Reset entities
        this.towers = [];
        this.walls = [];
        this.zombies = [];
        this.minters = [];
        this.bullets = [];
        
        // Reset stats
        this.totalScore = 0;
        this.zombiesKilled = 0;
        this.moneyEarned = 0;
        this.buildingsBuilt = 0;
        
        // Reset timing
        this.gameStartTime = Date.now();
        this.lastMoneyRegenTime = Date.now();
        this.lastZombieSpawnTime = Date.now();
        
        console.log('✅ GameState khởi tạo xong');
    },
    
    /**
     * Cập nhật trạng thái game theo thời gian
     * @param {number} deltaTime - Thời gian delta (ms)
     */
    update: function(deltaTime) {
        if (!this.isRunning) return;
        
        // Cập nhật thời gian pha
        this.phaseTimeRemaining -= deltaTime / 1000;
        
        // Chuyển pha nếu hết thời gian
        if (this.phaseTimeRemaining <= 0) {
            this.switchPhase();
        }
        
        // Regen tiền
        this.updateMoneyRegen();
        
        // Cập nhật máy in tiền
        this.updateMinters(deltaTime);
        
        // Cập nhật tháp pháo (quay nòng và bắn)
        this.updateTowers(deltaTime);
        
        // Cập nhật zombie
        this.updateZombies(deltaTime);
        
        // Cập nhật đạn
        this.updateBullets(deltaTime);
        
        // Kiểm tra va chạm
        this.checkCollisions();
        
        // Sinh zombie nếu đang đêm
        if (this.phase === CONFIG.PHASE_NIGHT) {
            this.spawnZombies(deltaTime);
        }
    },
    
    /**
     * Chuyển sang pha tiếp theo
     */
    switchPhase: function() {
        if (this.phase === CONFIG.PHASE_DAY) {
            console.log('🌙 Chuyển sang ĐÊM - Sóng ' + this.currentWave);
            this.phase = CONFIG.PHASE_NIGHT;
            this.phaseTime = CONFIG.NIGHT_DURATION;
            this.phaseTimeRemaining = CONFIG.NIGHT_DURATION;
            this.lastZombieSpawnTime = Date.now();
        } else {
            console.log('☀️ Chuyển sang NGÀY - Sóng ' + (this.currentWave + 1));
            this.phase = CONFIG.PHASE_DAY;
            this.phaseTime = CONFIG.DAY_DURATION;
            this.phaseTimeRemaining = CONFIG.DAY_DURATION;
            this.currentWave++;
            
            // Lưu game
            this.saveGame();
        }
    },
    
    /**
     * Cập nhật sinh tiền tự động
     */
    updateMoneyRegen: function() {
        const now = Date.now();
        if (now - this.lastMoneyRegenTime >= CONFIG.MONEY_REGEN_INTERVAL) {
            // Tiền từ sinh ra
            let moneyPerSec = CONFIG.MONEY_REGEN;
            
            // Tiền từ máy in
            moneyPerSec += this.minters.length * 8.33; // (25 / 3 giây)
            
            this.addMoney(moneyPerSec);
            this.lastMoneyRegenTime = now;
        }
    },
    
    /**
     * Cập nhật máy in tiền
     * @param {number} deltaTime - Thời gian delta
     */
    updateMinters: function(deltaTime) {
        this.minters.forEach(minter => {
            minter.update(deltaTime);
            
            // Nếu hoàn thành chu kỳ, cộng tiền
            if (minter.cycleProgress >= 1) {
                this.addMoney(CONFIG.MINTER_MONEY_PER_CYCLE);
                minter.cycleProgress = 0;
            }
        });
    },
    
    /**
     * Cập nhật tháp pháo
     * @param {number} deltaTime - Thời gian delta
     */
    updateTowers: function(deltaTime) {
        this.towers.forEach(tower => {
            tower.update(deltaTime, this.zombies, this.bullets);
        });
    },
    
    /**
     * Cập nhật zombie
     * @param {number} deltaTime - Thời gian delta
     */
    updateZombies: function(deltaTime) {
        for (let i = this.zombies.length - 1; i >= 0; i--) {
            const zombie = this.zombies[i];
            zombie.update(deltaTime);
            
            // Nếu zombie chạm tới pháo đài
            if (zombie.x <= CONFIG.FORTRESS_X + CONFIG.FORTRESS_WIDTH) {
                this.damagesFortress(zombie.damage);
                this.removeZombie(i);
            }
            
            // Nếu zombie chết
            if (zombie.hp <= 0) {
                this.addMoney(CONFIG.MONEY_FROM_KILLED_ZOMBIE);
                this.zombiesKilled++;
                this.totalScore += 100;
                this.removeZombie(i);
            }
        }
    },
    
    /**
     * Cập nhật đạn
     * @param {number} deltaTime - Thời gian delta
     */
    updateBullets: function(deltaTime) {
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const bullet = this.bullets[i];
            bullet.update(deltaTime);
            
            // Xóa đạn nếu ra khỏi màn hình
            if (bullet.x < 0 || bullet.x > CONFIG.CANVAS_WIDTH) {
                this.bullets.splice(i, 1);
            }
        }
    },
    
    /**
     * Kiểm tra va chạm giữa đạn và zombie
     */
    checkCollisions: function() {
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const bullet = this.bullets[i];
            
            for (let j = this.zombies.length - 1; j >= 0; j--) {
                const zombie = this.zombies[j];
                
                // Kiểm tra va chạm hình tròn
                if (Utils.circleCollision(
                    bullet.x, bullet.y, CONFIG.BULLET_RADIUS,
                    zombie.x, zombie.y, CONFIG.ZOMBIE_WIDTH / 2
                )) {
                    // Zombie bị trúng đạn
                    zombie.takeDamage(CONFIG.TOWER_DAMAGE);
                    
                    // Xóa đạn
                    this.bullets.splice(i, 1);
                    break;
                }
            }
        }
    },
    
    /**
     * Sinh zombie
     * @param {number} deltaTime - Thời gian delta
     */
    spawnZombies: function(deltaTime) {
        const now = Date.now();
        const spawnInterval = 1000 / CONFIG.ZOMBIE_SPAWN_RATE;
        
        if (now - this.lastZombieSpawnTime >= spawnInterval) {
            const wave = CONFIG.ZOMBIE_WAVES[Math.min(this.currentWave - 1, CONFIG.ZOMBIE_WAVES.length - 1)];
            const zombie = new Zombie(
                CONFIG.ZOMBIE_SPAWN_X + Utils.randomInt(-50, 50),
                CONFIG.FORTRESS_Y,
                wave.speed,
                wave.count > 10 ? 25 : 20
            );
            
            this.zombies.push(zombie);
            this.lastZombieSpawnTime = now;
        }
    },
    
    /**
     * Thêm tiền
     * @param {number} amount - Số lượng
     */
    addMoney: function(amount) {
        this.money += amount;
        this.moneyEarned += amount;
        this.totalScore += Math.floor(amount);
    },
    
    /**
     * Trừ tiền
     * @param {number} amount - Số lượng
     * @returns {boolean} Có đủ tiền?
     */
    spendMoney: function(amount) {
        if (this.money >= amount) {
            this.money -= amount;
            return true;
        }
        return false;
    },
    
    /**
     * Tạo tháp pháo
     * @param {number} x - Tọa độ X
     * @param {number} y - Tọa độ Y
     * @returns {boolean} Thành công?
     */
    buildTower: function(x, y) {
        if (!this.spendMoney(CONFIG.COST_TOWER)) {
            console.log('❌ Không đủ tiền để xây tháp');
            return false;
        }
        
        const tower = new Tower(x, y);
        this.towers.push(tower);
        this.buildingsBuilt++;
        this.totalScore += 50;
        
        console.log('🔫 Xây tháp pháo tại (' + x + ', ' + y + ')');
        return true;
    },
    
    /**
     * Tạo tường rào
     * @param {number} x - Tọa độ X
     * @param {number} y - Tọa độ Y
     * @returns {boolean} Thành công?
     */
    buildWall: function(x, y) {
        if (!this.spendMoney(CONFIG.COST_WALL)) {
            console.log('❌ Không đủ tiền để xây tường');
            return false;
        }
        
        const wall = new Wall(x, y);
        this.walls.push(wall);
        this.buildingsBuilt++;
        this.totalScore += 25;
        
        console.log('🧱 Xây tường rào tại (' + x + ', ' + y + ')');
        return true;
    },
    
    /**
     * Tạo máy in tiền
     * @param {number} x - Tọa độ X
     * @param {number} y - Tọa độ Y
     * @returns {boolean} Thành công?
     */
    buildMinter: function(x, y) {
        if (!this.spendMoney(CONFIG.COST_MINTER)) {
            console.log('❌ Không đủ tiền để xây máy in');
            return false;
        }
        
        const minter = new Minter(x, y);
        this.minters.push(minter);
        this.buildingsBuilt++;
        this.totalScore += 40;
        
        console.log('💵 Xây máy in tiền tại (' + x + ', ' + y + ')');
        return true;
    },
    
    /**
     * Gây sát thương cho pháo đài
     * @param {number} damage - Lượng sát thương
     */
    damagesFortress: function(damage) {
        this.fortressHP -= damage;
        console.log('💥 Pháo đài bị sát thương ' + damage + ', còn ' + this.fortressHP + ' HP');
        
        if (this.fortressHP <= 0) {
            this.endGame();
        }
    },
    
    /**
     * Xóa zombie
     * @param {number} index - Index
     */
    removeZombie: function(index) {
        this.zombies.splice(index, 1);
    },
    
    /**
     * Kết thúc game
     */
    endGame: function() {
        this.isRunning = false;
        this.isGameOver = true;
        
        PokiManager.gameplayStop();
        console.log('💀 GAME OVER! Sóng: ' + this.currentWave + ', Tiền: ' + Math.floor(this.money) + ', Điểm: ' + this.totalScore);
    },
    
    /**
     * Hồi sinh pháo đài (dùng quảng cáo)
     */
    reviveFortress: function() {
        if (!this.isGameOver) return;
        
        console.log('🔧 Hồi sinh pháo đài...');
        this.fortressHP = CONFIG.FORTRESS_MAX_HP;
        this.isGameOver = false;
        this.isRunning = true;
        
        // Dọn sạch zombie
        this.zombies = [];
        this.bullets = [];
        
        PokiManager.gameplayStart();
    },
    
    /**
     * Tăng tiền x2 (dùng quảng cáo)
     */
    doubleMoneyFromAd: function() {
        this.addMoney(this.money);
        console.log('💰 Tiền được nhân đôi! Tổng: ' + Math.floor(this.money));
    },
    
    /**
     * Lưu game vào LocalStorage
     */
    saveGame: function() {
        const saveData = {
            wave: this.currentWave,
            money: this.money,
            fortressHP: this.fortressHP,
            zombiesKilled: this.zombiesKilled,
            buildingsBuilt: this.buildingsBuilt,
            totalScore: this.totalScore,
            timestamp: Date.now()
        };
        
        Utils.saveToStorage('fortress-defense-save', saveData);
        console.log('💾 Game được lưu');
    },
    
    /**
     * Tải game từ LocalStorage
     */
    loadGame: function() {
        const saveData = Utils.loadFromStorage('fortress-defense-save', null);
        
        if (saveData) {
            console.log('📂 Tải game được lưu');
            // Có thể dùng để restore partial state nếu cần
            return saveData;
        }
        
        return null;
    }
};

// Xuất GameState
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GameState;
}
