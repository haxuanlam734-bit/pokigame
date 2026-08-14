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
    // RESOURCE & TYCOON PROGRESSION
    // =====================
    money: CONFIG.STARTING_MONEY,
    fortressHP: CONFIG.FORTRESS_MAX_HP,
    unlockedBuildings: {
        wall: true,
        tower: false,
        minter: false
    },
    builtBuildings: {
        wall: 0,
        tower: 0,
        minter: 0
    },

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
     * Bắt đầu chế độ xây dựng 3D
     * @param {string} type
     */
    startBuildMode: function(type) {
        if (!this.canBuildBuilding(type)) {
            console.log('❌ Không thể xây', type);
            return;
        }
        
        this.buildingMode = true;
        this.buildingType = type;
        console.log('🔨 Chế độ build 3D bắt đầu:', type);
    },

    /**
     * Kết thúc chế độ build
     */
    endBuildMode: function() {
        this.buildingMode = false;
        this.buildingType = null;
    },

    /**
     * Đặt building tại vị trí 3D
     * @param {number} x
     * @param {number} z
     * @param {string} type
     */
    placeBuilding: function(x, z, type) {
        if (!this.canBuildBuilding(type)) {
            console.log('❌ Không thể build:', type);
            return false;
        }

        const def = this.getBuildingDef(type);
        if (!this.spendMoney(def.cost)) {
            console.log('❌ Không đủ tiền');
            return false;
        }

        let building = null;
        
        if (type === 'wall') {
            building = new Wall3D(x, z);
            this.walls.push(building);
        } else if (type === 'tower') {
            building = new Tower3D(x, z);
            this.towers.push(building);
        } else if (type === 'minter') {
            building = new Minter3D(x, z);
            this.minters.push(building);
        }

        if (building) {
            this.builtBuildings[type]++;
            this.buildingsBuilt++;
            this.totalScore += 50;
            this.saveGame();
            console.log('✅ Đặt', type, 'tại', x.toFixed(0), z.toFixed(0));
            return true;
        }

        return false;
    },

    /**
     * Khởi tạo trạng thái game
     */
    init: function() {
        console.log('🎮 Khởi tạo GameState...');

        // Load save data nếu có, nhưng vẫn reset trạng thái cơ bản trước
        const saved = this.loadGame();

        // Reset trạng thái
        this.isRunning = true;
        this.isGameOver = false;
        this.phase = CONFIG.PHASE_DAY;
        this.currentWave = 1;
        this.phaseTime = CONFIG.DAY_DURATION;
        this.phaseTimeRemaining = CONFIG.DAY_DURATION;

        // Reset tài nguyên
        this.money = saved && typeof saved.money === 'number' ? saved.money : CONFIG.STARTING_MONEY;
        this.fortressHP = saved && typeof saved.fortressHP === 'number' ? saved.fortressHP : CONFIG.FORTRESS_MAX_HP;

        this.unlockedBuildings = {
            wall: true,
            tower: !!(saved && saved.unlockedBuildings && saved.unlockedBuildings.tower),
            minter: !!(saved && saved.unlockedBuildings && saved.unlockedBuildings.minter)
        };
        this.builtBuildings = {
            wall: 0,
            tower: 0,
            minter: 0
        };

        // Reset entities
        this.towers = [];
        this.walls = [];
        this.zombies = [];
        this.minters = [];
        this.bullets = [];

        // Reset stats
        this.totalScore = saved && typeof saved.totalScore === 'number' ? saved.totalScore : 0;
        this.zombiesKilled = saved && typeof saved.zombiesKilled === 'number' ? saved.zombiesKilled : 0;
        this.moneyEarned = saved && typeof saved.moneyEarned === 'number' ? saved.moneyEarned : 0;
        this.buildingsBuilt = saved && typeof saved.buildingsBuilt === 'number' ? saved.buildingsBuilt : 0;

        // Reset timing
        this.gameStartTime = Date.now();
        this.lastMoneyRegenTime = Date.now();
        this.lastZombieSpawnTime = Date.now();

        // Nếu có dữ liệu lưu nhưng không khôi phục chi tiết xây dựng, giữ an toàn
        if (saved && Array.isArray(saved.buildings)) {
            saved.buildings.forEach(item => {
                if (item.type === 'wall') this.builtBuildings.wall = item.count || 0;
                if (item.type === 'tower') this.builtBuildings.tower = item.count || 0;
                if (item.type === 'minter') this.builtBuildings.minter = item.count || 0;
            });
        }

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
     * Lấy thông tin công trình theo loại
     * @param {string} type
     * @returns {Object|null}
     */
    getBuildingDef: function(type) {
        return CONFIG.BUILDING_DEFS[type] || null;
    },

    /**
     * Kiểm tra công trình đã mở khóa chưa
     * @param {string} type
     * @returns {boolean}
     */
    hasUnlockedBuilding: function(type) {
        const def = this.getBuildingDef(type);
        if (!def) return false;
        return def.required.every(req => this.unlockedBuildings[req] || this.builtBuildings[req] > 0);
    },

    /**
     * Kiểm tra có thể mua/build công trình hay không
     * @param {string} type
     * @returns {boolean}
     */
    canBuildBuilding: function(type) {
        const def = this.getBuildingDef(type);
        if (!def) return false;
        if (!this.hasUnlockedBuilding(type)) return false;
        if (this.builtBuildings[type] >= def.maxCount) return false;
        if (this.phase !== CONFIG.PHASE_DAY) return false;
        return this.money >= def.cost;
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
            if (zombie.reachedFortress && zombie.reachedFortress()) {
                this.damagesFortress(zombie.damage);
                zombie.dispose();
                this.zombies.splice(i, 1);
                continue;
            }
            
            // Nếu zombie chết
            if (zombie.hp <= 0) {
                this.addMoney(CONFIG.MONEY_FROM_KILLED_ZOMBIE);
                this.zombiesKilled++;
                this.totalScore += 100;
                zombie.dispose();
                this.zombies.splice(i, 1);
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
     * Sinh zombie 3D
     * @param {number} deltaTime - Thời gian delta
     */
    spawnZombies: function(deltaTime) {
        const now = Date.now();
        const spawnInterval = 1000 / CONFIG.ZOMBIE_SPAWN_RATE;
        
        if (now - this.lastZombieSpawnTime >= spawnInterval) {
            const wave = CONFIG.ZOMBIE_WAVES[Math.min(this.currentWave - 1, CONFIG.ZOMBIE_WAVES.length - 1)];
            const zombie = new Zombie3D(
                CONFIG.ZOMBIE_SPAWN_X + Utils.randomInt(-50, 50),
                CONFIG.FORTRESS_Y + Utils.randomInt(-50, 50),
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
        const def = this.getBuildingDef('tower');
        if (!this.canBuildBuilding('tower')) {
            console.log('❌ Không thể xây tháp pháo. Kiểm tra unlock hoặc đủ tiền.');
            return false;
        }

        if (!this.spendMoney(def.cost)) {
            console.log('❌ Không đủ tiền để xây tháp');
            return false;
        }

        const tower = new Tower(x, y);
        this.towers.push(tower);
        this.builtBuildings.tower += 1;
        this.buildingsBuilt++;
        this.totalScore += 50;

        if (!this.unlockedBuildings.tower) this.unlockedBuildings.tower = true;
        this.unlockedBuildings.minter = this.hasUnlockedBuilding('minter') || this.unlockedBuildings.minter;

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
        const def = this.getBuildingDef('wall');
        if (!this.canBuildBuilding('wall')) {
            console.log('❌ Không thể xây tường rào.');
            return false;
        }

        if (!this.spendMoney(def.cost)) {
            console.log('❌ Không đủ tiền để xây tường');
            return false;
        }

        const wall = new Wall(x, y);
        this.walls.push(wall);
        this.builtBuildings.wall += 1;
        this.buildingsBuilt++;
        this.totalScore += 25;

        this.unlockedBuildings.wall = true;
        this.unlockedBuildings.tower = this.hasUnlockedBuilding('tower') || this.unlockedBuildings.tower;

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
        const def = this.getBuildingDef('minter');
        if (!this.canBuildBuilding('minter')) {
            console.log('❌ Không thể xây máy in tiền. Mở khóa theo dependency tree.');
            return false;
        }

        if (!this.spendMoney(def.cost)) {
            console.log('❌ Không đủ tiền để xây máy in');
            return false;
        }

        const minter = new Minter(x, y);
        this.minters.push(minter);
        this.builtBuildings.minter += 1;
        this.buildingsBuilt++;
        this.totalScore += 40;

        this.unlockedBuildings.minter = true;
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
            moneyEarned: this.moneyEarned,
            unlockedBuildings: this.unlockedBuildings,
            buildings: [
                { type: 'wall', count: this.builtBuildings.wall },
                { type: 'tower', count: this.builtBuildings.tower },
                { type: 'minter', count: this.builtBuildings.minter }
            ],
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
            if (saveData.unlockedBuildings) {
                this.unlockedBuildings = {
                    wall: true,
                    tower: !!saveData.unlockedBuildings.tower,
                    minter: !!saveData.unlockedBuildings.minter
                };
            }
            if (saveData.buildings) {
                saveData.buildings.forEach(item => {
                    if (item.type === 'wall') this.builtBuildings.wall = item.count || 0;
                    if (item.type === 'tower') this.builtBuildings.tower = item.count || 0;
                    if (item.type === 'minter') this.builtBuildings.minter = item.count || 0;
                });
            }
            return saveData;
        }

        return null;
    }
};

// Xuất GameState
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GameState;
}
