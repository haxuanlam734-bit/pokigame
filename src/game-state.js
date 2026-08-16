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
    // ADMIN MODE
    // =====================
    isAdmin: false,
    ADMIN_PASSWORD: 'Lam15052010@1505',

    /**
     * Kích hoạt chế độ Admin với đặc quyền vô hạn tiền
     */
    activateAdmin: function() {
        this.isAdmin = true;
        this.money = 999999999;
        this.playerHP = this.playerMaxHP;
        this.stamina = this.maxStamina;
        this.ammo = this.maxAmmo;
        console.log('👑 CHẾ ĐỘ ADMIN ĐƯỢC KÍCH HOẠT! Vô hạn tiền, HP đầy, Stamina đầy, Ammo đầy.');
    },

    // =====================
    // RESOURCE & TYCOON PROGRESSION
    // =====================
    money: CONFIG.STARTING_MONEY,
    fortressHP: CONFIG.FORTRESS_MAX_HP,
    unlockedBuildings: {
        wall: true,
        tower: false,
        minter: false,
        turel: false,
        minigun: false
    },
    builtBuildings: {
        wall: 0,
        tower: 0,
        minter: 0,
        turel: 0,
        minigun: 0
    },

    // =====================
    // ENTITIES
    // =====================
    towers: [],      // Danh sách tháp pháo (thường)
    turelList: [],   // Danh sách tháp pháo Turel (model 3D)
    walls: [],       // Danh sách tường rào
    zombies: [],     // Danh sách zombie
    minters: [],     // Danh sách máy in tiền
    minigunList: [], // Danh sách máy súng Minigun (hộp)
    bullets: [],     // Danh sách đạn

    // =====================
    // SCORE & STATS
    // =====================
    totalScore: 0,
    zombiesKilled: 0,
    moneyEarned: 0,
    buildingsBuilt: 0,

    // =====================
    // PLAYER / MILITARY SERVICES
    // =====================
    playerHP: 100,
    playerMaxHP: 100,
    playerBaseMaxHP: 100,
    stamina: 100,
    maxStamina: 100,
    bandages: 3,
    medkits: 1,
    playerBiteCooldownUntil: 0,
    ammo: 120,
    maxAmmo: 120,
    weaponTier: 1,
    weaponDamage: 10,
    weaponXP: 0,
    weaponLevel: 1,
    guards: 0,
    baseLevel: 1,
    maxMinterSlots: 6,
    moneyMultiplier: 1,
    productionMultiplier: 1,
    vehicleLevel: 1,
    vehicleActive: false,
    radarLevel: 1,
    commsReady: true,
    lastServiceAction: {},

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
        if (!this.canBuildBuilding(type, x, z)) {
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
        } else if (type === 'turel') {
            building = new Turel3D(x, z);
            this.turelList.push(building);
        } else if (type === 'minigun') {
            building = new Minigun3D(x, z);
            this.minigunList.push(building);
        }

        if (building) {
            this.builtBuildings[type]++;
            this.buildingsBuilt++;
            this.totalScore += (type === 'turel' || type === 'minigun') ? 250 : 50;
            this.unlockChain(type);
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
            minter: !!(saved && saved.unlockedBuildings && saved.unlockedBuildings.minter),
            turel: !!(saved && saved.unlockedBuildings && saved.unlockedBuildings.turel),
            minigun: !!(saved && saved.unlockedBuildings && saved.unlockedBuildings.minigun)
        };
        this.builtBuildings = {
            wall: 0,
            tower: 0,
            minter: 0,
            turel: 0,
            minigun: 0
        };

        // Reset entities
        this.towers = [];
        this.turelList = [];
        this.walls = [];
        this.zombies = [];
        this.minters = [];
        this.minigunList = [];
        this.bullets = [];

        // Reset stats
        this.totalScore = saved && typeof saved.totalScore === 'number' ? saved.totalScore : 0;
        this.zombiesKilled = saved && typeof saved.zombiesKilled === 'number' ? saved.zombiesKilled : 0;
        this.moneyEarned = saved && typeof saved.moneyEarned === 'number' ? saved.moneyEarned : 0;
        this.buildingsBuilt = saved && typeof saved.buildingsBuilt === 'number' ? saved.buildingsBuilt : 0;

        this.playerHP = saved && typeof saved.playerHP === 'number' ? saved.playerHP : 100;
        this.playerBaseMaxHP = 100;
        this.playerMaxHP = saved && typeof saved.playerMaxHP === 'number' ? saved.playerMaxHP : this.playerBaseMaxHP;
        this.playerMaxHP = Math.max(0, Math.min(this.playerBaseMaxHP, this.playerMaxHP));
        this.playerHP = Math.max(0, Math.min(this.playerMaxHP, this.playerHP));
        this.stamina = saved && typeof saved.stamina === 'number' ? saved.stamina : 100;
        this.maxStamina = saved && typeof saved.maxStamina === 'number' ? saved.maxStamina : 100;
        this.bandages = saved && typeof saved.bandages === 'number' ? saved.bandages : 3;
        this.medkits = saved && typeof saved.medkits === 'number' ? saved.medkits : 1;
        this.playerBiteCooldownUntil = 0;
        this.ammo = saved && typeof saved.ammo === 'number' ? saved.ammo : 120;
        this.maxAmmo = saved && typeof saved.maxAmmo === 'number' ? saved.maxAmmo : 120;
        this.weaponTier = saved && typeof saved.weaponTier === 'number' ? saved.weaponTier : 1;
        this.weaponDamage = saved && typeof saved.weaponDamage === 'number' ? saved.weaponDamage : 10;
        this.weaponXP = saved && typeof saved.weaponXP === 'number' ? saved.weaponXP : 0;
        this.weaponLevel = saved && typeof saved.weaponLevel === 'number' ? saved.weaponLevel : 1;
        this.guards = saved && typeof saved.guards === 'number' ? saved.guards : 0;
        this.baseLevel = saved && typeof saved.baseLevel === 'number' ? saved.baseLevel : 1;
        this.maxMinterSlots = saved && typeof saved.maxMinterSlots === 'number' ? saved.maxMinterSlots : 6;
        this.moneyMultiplier = saved && typeof saved.moneyMultiplier === 'number' ? saved.moneyMultiplier : 1;
        this.productionMultiplier = saved && typeof saved.productionMultiplier === 'number' ? saved.productionMultiplier : 1;
        this.vehicleLevel = saved && typeof saved.vehicleLevel === 'number' ? saved.vehicleLevel : 1;
        this.vehicleActive = false;
        this.radarLevel = saved && typeof saved.radarLevel === 'number' ? saved.radarLevel : 1;
        this.commsReady = true;
        this.lastServiceAction = {};

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

        // Stamina tự hồi chỉ khi không sprint; HP tuyệt đối KHÔNG tự hồi.
        if (typeof PlayerController !== 'undefined' && !PlayerController.isSprinting) {
            this.stamina = Math.min(this.maxStamina, this.stamina + 12 * (deltaTime / 1000));
        }
        
        // Chuyển pha nếu hết thời gian
        if (this.phaseTimeRemaining <= 0) {
            this.switchPhase();
        }
        
        // Regen tiền
        this.updateMoneyRegen();
        
        // Cập nhật máy in tiền
        this.updateMinters(deltaTime);
        
        // Cập nhật tháp pháo do người chơi xây
        this.updateTowers(deltaTime);

        // Cập nhật Turel (tháp pháo model 3D)
        this.updateTurelList(deltaTime);

        // Cập nhật Minigun (hộp súng máy)
        this.updateMinigunList(deltaTime);

        // Cập nhật mạng súng máy tự động của đại bản doanh
        if (typeof Renderer3D !== 'undefined' && Renderer3D.updateAutomatedDefenses) {
            Renderer3D.updateAutomatedDefenses(deltaTime, this.zombies);
        }
        
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
     * Lấy vùng placement cho một loại building (x1, y1, x2, y2). 
     * Tọa độ world 2D/3D chung, y tương ứng z trong 3D.
     */
    getBuildingPlacementZone: function(type) {
        switch (type) {
            case 'wall': return CONFIG.WALL_PLACEMENT_ZONE;
            case 'tower': return CONFIG.TOWER_PLACEMENT_ZONE;
            case 'minter': return CONFIG.MINTER_PLACEMENT_ZONE;
            case 'turel': return CONFIG.TUREL_PLACEMENT_ZONE;
            case 'minigun': return CONFIG.MINIGUN_PLACEMENT_ZONE;
            default: return null;
        }
    },

    /**
     * Kiểm tra tọa độ x, z có nằm trong placement zone không.
     */
    isInPlacementZone: function(type, x, z) {
        if (this.isAdmin) return true;
        const zc = this.getBuildingPlacementZone(type);
        if (!zc) return true;
        return x >= zc.x1 && x <= zc.x2 && z >= zc.y1 && z <= zc.y2;
    },

    /**
     * Gọi sau khi place building thành công để mở khóa các building kế tiếp
     */
    unlockChain: function(type) {
        const def = this.getBuildingDef(type);
        if (!def || !def.unlocks || !def.unlocks.length) return;
        for (const next of def.unlocks) {
            if (!this.unlockedBuildings[next]) {
                this.unlockedBuildings[next] = true;
                console.log('🔓 Đã mở khóa:', next);
            }
        }
    },

    /**
     * Nhận sát thương từ zombie (tấn công người chơi)
     */
    damagePlayerFromZombie: function(damage) {
        if (this.isAdmin) return;
        const now = Date.now();
        if (now < this.playerBiteCooldownUntil) return;
        this.playerBiteCooldownUntil = now + 500;
        this.playerHP = Math.max(0, this.playerHP - damage);
        if (this.playerHP <= 0) {
            this.isGameOver = true;
            console.log('💀 Người chơi chết do zombie cắn.');
        }
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
     * @param {number} [x] - Tùy chọn: nếu có sẽ kiểm tra cả placement zone
     * @param {number} [z]
     * @returns {boolean}
     */
    canBuildBuilding: function(type, x, z) {
        const def = this.getBuildingDef(type);
        if (!def) return false;
        if (!this.hasUnlockedBuilding(type)) return false;
        if (type === 'minter' && this.builtBuildings[type] >= this.maxMinterSlots) return false;
        if (this.builtBuildings[type] >= def.maxCount) return false;
        if (this.phase !== CONFIG.PHASE_DAY) return false;
        if (typeof x === 'number' && typeof z === 'number' && !this.isInPlacementZone(type, x, z)) return false;
        if (this.isAdmin) return true;
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
        if (this.isAdmin) {
            this.money = 999999999;
            this.stamina = this.maxStamina;
            this.ammo = this.maxAmmo;
            this.playerHP = Math.min(this.playerHP, this.playerMaxHP);
        }
        const now = Date.now();
        if (now - this.lastMoneyRegenTime >= CONFIG.MONEY_REGEN_INTERVAL) {
            let moneyPerSec = CONFIG.MONEY_REGEN * this.moneyMultiplier;
            moneyPerSec += this.minters.length * 8.33 * this.productionMultiplier;
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
                this.addMoney(CONFIG.MINTER_MONEY_PER_CYCLE * this.productionMultiplier * this.moneyMultiplier);
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

    updateTurelList: function(deltaTime) {
        this.turelList.forEach(turel => {
            turel.update(deltaTime, this.zombies, this.bullets);
        });
    },

    updateMinigunList: function(deltaTime) {
        this.minigunList.forEach(minigun => {
            minigun.update(deltaTime, this.zombies, this.bullets);
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

            // Zombie có thể cắn player khi ở đủ gần. Mỗi lần cắn làm mất 1 segment HP
            // (10 HP) và đồng thời giảm trần HP vĩnh viễn cho tới khi dùng vật tư y tế.
            if (typeof PlayerController !== 'undefined' && this.playerHP > 0) {
                const dx = zombie.x - PlayerController.position.x;
                const dz = zombie.z - PlayerController.position.z;
                const biteRange = 1.35;
                const distSq = dx * dx + dz * dz;
                if (distSq <= biteRange * biteRange) {
                    if (Date.now() >= this.playerBiteCooldownUntil) {
                        this.damagePlayerFromZombie(10);
                    }
                }
            }
            
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
     * Sinh zombie 3D từ 4 rìa ngoài bản đồ ngẫu nhiên
     * @param {number} deltaTime - Thời gian delta
     */
    spawnZombies: function(deltaTime) {
        const now = Date.now();
        const spawnInterval = 1000 / CONFIG.ZOMBIE_SPAWN_RATE;
        
        if (now - this.lastZombieSpawnTime >= spawnInterval) {
            const wave = CONFIG.ZOMBIE_WAVES[Math.min(this.currentWave - 1, CONFIG.ZOMBIE_WAVES.length - 1)];

            const edge = Math.floor(Math.random() * 4);
            const margin = 10;
            const mapSize = 500;
            let x, z;

            switch (edge) {
                case 0:
                    x = 10 + Math.random() * 480;
                    z = 0 + margin + Math.random() * 5;
                    break;
                case 1:
                    x = 10 + Math.random() * 480;
                    z = mapSize - margin - Math.random() * 5;
                    break;
                case 2:
                    x = 0 + margin + Math.random() * 5;
                    z = 10 + Math.random() * 480;
                    break;
                case 3:
                default:
                    x = mapSize - margin - Math.random() * 5;
                    z = 10 + Math.random() * 480;
                    break;
            }

            const hp = wave.count > 10 ? 25 : 20;
            const zombie = new Zombie3D(x, z, wave.speed, hp);

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
        if (this.isAdmin) {
            return true;
        }
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
     * Player nhận sát thương từ zombie: mất HP hiện tại và mất luôn cùng lượng HP
     * ở trần hồi phục. Không có natural regen cho HP.
     */
    damagePlayerFromZombie: function(damage = 10) {
        if (this.playerHP <= 0) return;
        const amount = Math.max(1, Math.min(10, Math.round(damage)));
        this.playerHP = Math.max(0, this.playerHP - amount);
        this.playerMaxHP = Math.max(0, this.playerMaxHP - amount);
        this.playerHP = Math.min(this.playerHP, this.playerMaxHP);
        this.playerBiteCooldownUntil = Date.now() + 1000;

        if (typeof Game !== 'undefined' && Game.showMilitaryToast) {
            Game.showMilitaryToast({ title: '🧟 ZOMBIE BITE', message: `-1 thanh HP • ${this.playerMaxHP} HP còn hồi được`, success: false });
        }

        if (this.playerHP <= 0 || this.playerMaxHP <= 0) {
            this.endGame();
        }
    },

    useBandage: function() {
        if (this.bandages <= 0) return { success: false, message: 'Hết bandage.' };
        if (this.playerMaxHP >= this.playerBaseMaxHP && this.playerHP >= this.playerMaxHP) {
            return { success: false, message: 'HP đã đầy.' };
        }
        this.bandages -= 1;
        this.playerMaxHP = Math.min(this.playerBaseMaxHP, this.playerMaxHP + 10);
        this.playerHP = Math.min(this.playerMaxHP, this.playerHP + 10);
        return { success: true, message: `Bandage: +10 HP capacity. Còn ${this.bandages}.` };
    },

    useMedkit: function() {
        if (this.medkits <= 0) return { success: false, message: 'Hết hộp cấp cứu.' };
        this.medkits -= 1;
        this.playerMaxHP = this.playerBaseMaxHP;
        this.playerHP = this.playerBaseMaxHP;
        return { success: true, message: 'Hộp cấp cứu đã khôi phục HP về 100%.', full: true };
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
    
    _serviceCooldownReady: function(id, cooldownMs) {
        const now = Date.now();
        const last = this.lastServiceAction[id] || 0;
        return now - last >= cooldownMs;
    },

    interactWithMilitaryBuilding: function(id) {
        const results = {
            success: false,
            title: '',
            message: '',
            reward: 0
        };
        const fail = (title, message) => ({ success: false, title, message, reward: 0 });

        switch (id) {
            case 'hq': {
                const cost = Math.floor(500 * Math.pow(1.85, this.baseLevel - 1));
                if (this.baseLevel >= 8) return fail('COMMAND HQ', 'Căn cứ đã đạt cấp tối đa.');
                if (!this.spendMoney(cost)) return fail('COMMAND HQ', `Cần ${cost}💰 để nâng cấp HQ.`);
                this.baseLevel += 1;
                this.maxMinterSlots = Math.min(8, 5 + this.baseLevel);
                this.moneyMultiplier = 1 + (this.baseLevel - 1) * 0.08;
                this.fortressHP = Math.min(CONFIG.FORTRESS_MAX_HP + (this.baseLevel - 1) * 15, this.fortressHP + 15);
                return { success: true, title: 'COMMAND HQ', message: `HQ lên cấp ${this.baseLevel}. Mở thêm công suất máy in và +${Math.round((this.moneyMultiplier - 1) * 100)}% thu nhập.`, reward: 0 };
            }
            case 'barracks': {
                const cost = 350 + this.guards * 180;
                if (!this.spendMoney(cost)) return fail('BARRACKS', `Cần ${cost}💰 để tuyển một lính gác.`);
                this.guards += 1;
                this.totalScore += 100;
                return { success: true, title: 'BARRACKS', message: `Đã tuyển lính gác #${this.guards}. Phòng thủ căn cứ +${this.guards * 2}%.`, reward: 0 };
            }
            case 'mess': {
                if (!this._serviceCooldownReady('mess', 12000)) return fail('MESS HALL', 'Bếp đang chuẩn bị suất tiếp theo.');
                this.lastServiceAction.mess = Date.now();
                this.stamina = this.maxStamina;
                return { success: true, title: 'MESS HALL', message: 'Đã dùng suất ăn. Stamina đầy. HP không tự hồi.', reward: 0 };
            }
            case 'medical': {
                if (!this._serviceCooldownReady('medical', 15000)) return fail('MEDICAL', 'Medical bay đang tái tạo thiết bị.');
                this.lastServiceAction.medical = Date.now();
                const med = this.useMedkit();
                if (!med.success) return fail('MEDICAL', med.message);
                this.fortressHP = Math.min(CONFIG.FORTRESS_MAX_HP + (this.baseLevel - 1) * 15, this.fortressHP + 25);
                return { success: true, title: 'MEDICAL', message: 'Đã hồi đầy HP cá nhân và sửa chữa +25 Fortress HP.', reward: 0 };
            }
            case 'supply': {
                const cost = 150 + (this.weaponTier - 1) * 250;
                if (!this.spendMoney(cost)) return fail('SUPPLY DEPOT', `Cần ${cost}💰 để nâng cấp vũ khí.`);
                if (this.weaponTier >= 6) {
                    this.ammo = this.maxAmmo;
                    return { success: true, title: 'SUPPLY DEPOT', message: 'Kho đạt cấp tối đa. Ammo đã được nạp đầy.', reward: 0 };
                }
                this.weaponTier += 1;
                this.weaponDamage += 7;
                this.maxAmmo += 25;
                this.ammo = this.maxAmmo;
                this.bandages = Math.min(9, this.bandages + 1);
                if (this.weaponTier >= 4) this.medkits = Math.min(3, this.medkits + 1);
                return { success: true, title: 'SUPPLY DEPOT', message: `Weapon Tier ${this.weaponTier}: damage ${this.weaponDamage}, ammo ${this.maxAmmo}.`, reward: 0 };
            }
            case 'fuel': {
                if (!this._serviceCooldownReady('fuel', 8000)) return fail('FUEL FARM', 'Bơm nhiên liệu đang hồi.');
                this.lastServiceAction.fuel = Date.now();
                const reward = 120 + this.vehicleLevel * 60;
                this.addMoney(reward);
                this.productionMultiplier = Math.min(2.5, this.productionMultiplier + 0.03);
                return { success: true, title: 'FUEL FARM', message: `Bán nhiên liệu nhận ${reward}💰 và +3% hiệu suất production tạm thời.`, reward };
            }
            case 'motorPool': {
                this.vehicleActive = true;
                this.vehicleLevel = Math.min(5, this.vehicleLevel + 1);
                if (typeof PlayerController !== 'undefined') {
                    PlayerController.normalSpeed = 6 + this.vehicleLevel * 0.7;
                    PlayerController.speed = PlayerController.normalSpeed;
                }
                return { success: true, title: 'MOTOR POOL', message: `Xe đã sẵn sàng. Vehicle Level ${this.vehicleLevel}; tốc độ di chuyển tăng.`, reward: 0 };
            }
            case 'lab': {
                const cost = 300 + this.weaponLevel * 220;
                if (!this.spendMoney(cost)) return fail('RESEARCH LAB', `Cần ${cost}💰 để hoàn thành nghiên cứu.`);
                this.weaponLevel += 1;
                this.weaponDamage += 4;
                this.productionMultiplier = Math.min(3, this.productionMultiplier + 0.1);
                return { success: true, title: 'RESEARCH LAB', message: `Nghiên cứu hoàn tất. Weapon Lv.${this.weaponLevel}, +4 damage, +10% production.`, reward: 0 };
            }
            case 'workshop': {
                const cost = 250 + this.vehicleLevel * 180;
                if (!this.spendMoney(cost)) return fail('VEHICLE WORKSHOP', `Cần ${cost}💰 để nâng cấp phương tiện.`);
                this.vehicleLevel = Math.min(8, this.vehicleLevel + 1);
                this.maxStamina = Math.min(180, this.maxStamina + 10);
                this.stamina = this.maxStamina;
                return { success: true, title: 'VEHICLE WORKSHOP', message: `Workshop cấp ${this.vehicleLevel}. Xe mạnh hơn và stamina tối đa +10.`, reward: 0 };
            }
            case 'training': {
                this.weaponXP += 25;
                if (this.weaponXP >= this.weaponLevel * 100) {
                    this.weaponXP = 0;
                    this.weaponLevel += 1;
                    this.weaponDamage += 3;
                }
                this.stamina = Math.min(this.maxStamina, this.stamina + 30);
                return { success: true, title: 'TRAINING GROUND', message: `+25 Weapon XP. Tổng XP ${this.weaponXP}/${this.weaponLevel * 100}.`, reward: 0 };
            }
            case 'range': {
                this.ammo = this.maxAmmo;
                this.weaponDamage += 2;
                this.lastServiceAction.range = Date.now();
                return { success: true, title: 'SHOOTING RANGE', message: 'Ammo đầy và nhận +2 damage từ luyện bắn.', reward: 0 };
            }
            case 'radar': {
                const detected = this.zombies.length;
                this.radarLevel = Math.min(5, this.radarLevel + 1);
                return { success: true, title: 'RADAR STATION', message: `Radar Level ${this.radarLevel}. Phát hiện ${detected} zombie trên bản đồ.`, reward: 0 };
            }
            case 'comms': {
                if (!this.commsReady) return fail('COMMS TOWER', 'Hợp đồng tiếp tế chưa sẵn sàng.');
                this.commsReady = false;
                const reward = 250 + this.currentWave * 40;
                this.addMoney(reward);
                setTimeout(() => { this.commsReady = true; }, 20000);
                return { success: true, title: 'COMMS TOWER', message: `Hợp đồng tiếp tế hoàn tất. +${reward}💰.`, reward };
            }
            default:
                return fail('MILITARY BASE', 'Tòa nhà này chưa có chức năng.');
        }
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
            playerHP: this.playerHP,
            playerMaxHP: this.playerMaxHP,
            stamina: this.stamina,
            maxStamina: this.maxStamina,
            bandages: this.bandages,
            medkits: this.medkits,
            ammo: this.ammo,
            maxAmmo: this.maxAmmo,
            weaponTier: this.weaponTier,
            weaponDamage: this.weaponDamage,
            weaponXP: this.weaponXP,
            weaponLevel: this.weaponLevel,
            guards: this.guards,
            baseLevel: this.baseLevel,
            maxMinterSlots: this.maxMinterSlots,
            moneyMultiplier: this.moneyMultiplier,
            productionMultiplier: this.productionMultiplier,
            vehicleLevel: this.vehicleLevel,
            radarLevel: this.radarLevel,
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
