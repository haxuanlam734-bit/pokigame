/**
 * GAME-STATE.JS - Qu?n l� tr?ng th�i game
 * Theo d�i ti?n, HP, s�ng, vv...
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
    // TIME CYCLE INTEGRATION
    // =====================
    _timeCycleSubscribed: false,

    // =====================
    // ADMIN MODE
    // =====================
    isAdmin: false,
    adminPanelUnlocked: false,
    ADMIN_PASSWORD: 'Lam15052010@1505',
    ADMIN_PANEL_PASSWORD: 'Huydepzai17092009@123',
    adminInfiniteMoney: false,
    adminInfiniteAmmo: false,
    adminInfiniteHealth: false,
    adminInfiniteStamina: false,
    adminFlyMode: false,
    adminVipDash: false,

    /**
     * K�ch ho?t ch? d? Admin - ch? unlock quy?n truy c?p, kh�ng buff ngay
     */
    activateAdmin: function() {
        this.isAdmin = true;
        if (typeof AdminPanel !== 'undefined' && AdminPanel.updateButtonVisibility) {
            AdminPanel.updateButtonVisibility();
        }
        console.log('?? ADMIN ACCESS UNLOCKED! Nh?n n�t ADMIN d? m? Control Panel.');
        if (typeof Game !== 'undefined' && Game.showMilitaryToast) {
            Game.showMilitaryToast({
                title: '?? ADMIN ACCESS',
                message: 'Nh?n n�t ADMIN d? m? Control Panel.',
                success: true
            });
        }
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
    towers: [],      // Danh s�ch th�p ph�o (thu?ng)
    turelList: [],   // Danh s�ch th�p ph�o Turel (model 3D)
    walls: [],       // Danh s�ch tu?ng r�o
    zombies: [],     // Danh s�ch zombie
    minters: [],     // Danh s�ch m�y in ti?n
    minigunList: [], // Danh s�ch m�y s�ng Minigun (h?p)
    bullets: [],     // Danh s�ch d?n
    relocatingTurret: null,

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
    _staminaRegenDelay: 0,
    _STAMINA_REGEN_DELAY: 0.6,
    _STAMINA_REGEN_PER_SECOND: 15,
    _STAMINA_DRAIN_PER_SECOND: 11,
    bandages: 3,
    medkits: 1,
    playerBiteCooldownUntil: 0,

    // =====================
    // POISON SYSTEM
    // =====================
    poisonDamageRemaining: 0,
    poisonTimeRemaining: 0,
    poisonTickTimer: 0,

    // =====================
    // DAMAGE FEEDBACK
    // =====================
    lastDamageTime: 0,

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

    _specialEventZombieModifiers: null,
    _specialEventPlayerModifiers: null,
    _specialEventRewardMultiplier: 1,
    _bloodPulseActive: false,
    _bloodPulseZombieModifiers: null,

    // =====================
    // TIMING
    // =====================
    gameStartTime: 0,
    lastMoneyRegenTime: 0,
    lastZombieSpawnTime: 0,
    
    /**
     * B?t d?u ch? d? x�y d?ng 3D
     * @param {string} type
     */
    startBuildMode: function(type) {
        if (!this.canBuildBuilding(type)) {
            console.log('? Kh�ng th? x�y', type);
            return;
        }
        
        this.buildingMode = true;
        this.buildingType = type;
        if (type === 'turel' && typeof Renderer3D !== 'undefined' && Renderer3D.beginTurretPreview) {
            Renderer3D.beginTurretPreview();
        }
        console.log('?? Ch? d? build 3D b?t d?u:', type);
    },

    /**
     * K?t th�c ch? d? build
     */
    endBuildMode: function() {
        if ((this.buildingType === 'turel' || this.buildingType === 'turel-relocate') && typeof Renderer3D !== 'undefined' && Renderer3D.endTurretPreview) {
            Renderer3D.endTurretPreview();
        }
        this.buildingMode = false;
        this.buildingType = null;
        if (this.relocatingTurret && this.relocatingTurret.mesh3D) this.relocatingTurret.mesh3D.visible = true;
        this.relocatingTurret = null;
    },

    /**
     * �?t building t?i v? tr� 3D
     * @param {number} x
     * @param {number} z
     * @param {string} type
     */
    placeBuilding: function(x, z, type) {
        if (!this.canBuildBuilding(type, x, z)) {
            console.log('? Kh�ng th? build:', type);
            return false;
        }

        const def = this.getBuildingDef(type);
        if (!this.spendMoney(def.cost)) {
            console.log('? Kh�ng d? ti?n');
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
            console.log('? �?t', type, 't?i', x.toFixed(0), z.toFixed(0));
            return true;
        }

        return false;
    },

    /**
     * Kh?i t?o tr?ng th�i game
     */
    init: function() {
        console.log('?? Kh?i t?o GameState...');

        const saved = this.loadGame();

        this.isRunning = true;
        this.isGameOver = false;
        this.currentWave = 1;

        if (typeof TimeCycle !== 'undefined' && TimeCycle.isRunning) {
            this.phase = TimeCycle.currentPhase;
            this.phaseTimeRemaining = TimeCycle.phaseTimeRemaining;
        } else {
            this.phase = CONFIG.PHASE_DAY;
            this.phaseTimeRemaining = CONFIG.DAY_DURATION;
        }

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

        this.towers = [];
        this.turelList = [];
        this.walls = [];
        this.zombies = [];
        this.minters = [];
        this.minigunList = [];
        this.bullets = [];

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

        // Reset poison state
        this.poisonDamageRemaining = 0;
        this.poisonTimeRemaining = 0;
        this.poisonTickTimer = 0;

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

        this._specialEventZombieModifiers = null;
        this._specialEventPlayerModifiers = null;
        this._specialEventRewardMultiplier = 1;
        this._bloodPulseActive = false;
        this._bloodPulseZombieModifiers = null;

        this.gameStartTime = Date.now();
        this.lastMoneyRegenTime = Date.now();
        this.lastZombieSpawnTime = Date.now();

        if (saved && Array.isArray(saved.buildings)) {
            saved.buildings.forEach(item => {
                if (item.type === 'wall') this.builtBuildings.wall = item.count || 0;
                if (item.type === 'tower') this.builtBuildings.tower = item.count || 0;
                if (item.type === 'minter') this.builtBuildings.minter = item.count || 0;
                if (item.type === 'turel') this.builtBuildings.turel = Math.min(item.count || 0, CONFIG.BUILDING_DEFS.turel.maxCount);
                if (item.type === 'minigun') this.builtBuildings.minigun = item.count || 0;
            });
        }

        if (!this._timeCycleSubscribed && typeof TimeCycle !== 'undefined') {
            TimeCycle.onPhaseChanged(function(oldPhase, newPhase) {
                GameState.handlePhaseChange(oldPhase, newPhase);
            });
            this._timeCycleSubscribed = true;

            if (TimeCycle.isRunning) {
                this.phase = TimeCycle.currentPhase;
                this.phaseTimeRemaining = TimeCycle.phaseTimeRemaining;
            }
        }

        console.log('? GameState kh?i t?o xong');
    },
    
    /**
     * C?p nh?t tr?ng th�i game theo th?i gian
     * @param {number} deltaTime - Th?i gian delta (ms)
     */
    update: function(deltaTime) {
        if (!this.isRunning) return;

        if (typeof TimeCycle !== 'undefined' && TimeCycle.isRunning) {
            this.phase = TimeCycle.currentPhase;
            this.phaseTimeRemaining = TimeCycle.phaseTimeRemaining;
        } else {
            this.phaseTimeRemaining -= deltaTime / 1000;
            if (this.phaseTimeRemaining <= 0) {
                this._legacySwitchPhase();
            }
        }

        if (typeof PlayerController !== 'undefined' && !PlayerController.isDead && !PlayerController.isRespawning) {
            const isSprinting = PlayerController.isSprinting;
            const infiniteStamina = this.adminInfiniteStamina;

            if (infiniteStamina) {
                this.stamina = this.maxStamina;
                this._staminaRegenDelay = 0;
            } else if (isSprinting) {
                let drainMult = 1;
                if (this._specialEventPlayerModifiers && this._specialEventPlayerModifiers.staminaDrain) {
                    drainMult = this._specialEventPlayerModifiers.staminaDrain;
                }
                this.stamina = Math.max(0, this.stamina - this._STAMINA_DRAIN_PER_SECOND * drainMult * (deltaTime / 1000));
                this._staminaRegenDelay = this._STAMINA_REGEN_DELAY;
                if (this.stamina <= 0) {
                    PlayerController.isSprinting = false;
                }
            } else {
                if (this._staminaRegenDelay > 0) {
                    this._staminaRegenDelay = Math.max(0, this._staminaRegenDelay - deltaTime / 1000);
                } else {
                    let regenMult = 1;
                    if (this._specialEventPlayerModifiers && this._specialEventPlayerModifiers.staminaRegen) {
                        regenMult = this._specialEventPlayerModifiers.staminaRegen;
                    }
                    this.stamina = Math.min(this.maxStamina, this.stamina + this._STAMINA_REGEN_PER_SECOND * regenMult * (deltaTime / 1000));
                }
            }
        }

        this._hpRegenTimer = (this._hpRegenTimer || 0) + deltaTime;
        if (this._hpRegenTimer >= 5000) {
            this._hpRegenTimer = 0;
            if (this.playerHP < this.playerMaxHP) {
                let healMult = 1;
                if (this._specialEventPlayerModifiers && this._specialEventPlayerModifiers.healingEffectiveness) {
                    healMult = this._specialEventPlayerModifiers.healingEffectiveness;
                }
                this.playerHP = Math.min(this.playerMaxHP, this.playerHP + 1 * healMult);
            }
        }

        // Update poison damage over time
        this._updatePoison(deltaTime);

        // Update low health state display
        this._updateLowHealthState();

        this.updateMoneyRegen(deltaTime);
        
        this.updateMinters(deltaTime);
        
        this.updateTowers(deltaTime);
    
        this.updateTurelList(deltaTime);
    
        this.updateMinigunList(deltaTime);
    
        if (typeof Renderer3D !== 'undefined' && Renderer3D.updateAutomatedDefenses) {
            Renderer3D.updateAutomatedDefenses(deltaTime, this.zombies);
        }
        
        this.updateZombies(deltaTime);
        
        this.updateBullets(deltaTime);
        
        this.checkCollisions();
        
        this.spawnZombies(deltaTime);
    },

    handlePhaseChange: function(oldPhase, newPhase) {
        this.phase = newPhase;
        this.lastZombieSpawnTime = Date.now();
    },

    _legacySwitchPhase: function() {
        if (this.phase === CONFIG.PHASE_DAY || this.phase === CONFIG.PHASE_DAY_LEGACY) {
            this.phase = CONFIG.PHASE_NIGHT;
            this.phaseTimeRemaining = CONFIG.NIGHT_DURATION_LEGACY;
        } else {
            this.phase = CONFIG.PHASE_DAY;
            this.phaseTimeRemaining = CONFIG.DAY_DURATION_LEGACY;
            this.currentWave++;
            this.saveGame();
        }
    },
    
    /**
     * L?y th�ng tin c�ng tr�nh theo lo?i
     * @param {string} type
     * @returns {Object|null}
     */
    getBuildingDef: function(type) {
        return CONFIG.BUILDING_DEFS[type] || null;
    },

    /**
     * L?y v�ng placement cho m?t lo?i building (zone ho?c m?ng zone). 
     * T?a d? world 2D/3D chung, y tuong ?ng z trong 3D.
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

    _isInZone: function(x, z, zone) {
        if (!zone) return false;
        if (Array.isArray(zone)) {
            return zone.some(z => x >= z.x1 && x <= z.x2 && z >= z.y1 && z <= z.y2);
        }
        return x >= zone.x1 && x <= zone.x2 && z >= zone.y1 && z <= zone.y2;
    },

    _getFuturePlotZones: function() {
        if (!CONFIG.WORLD_ZONES || !CONFIG.WORLD_ZONES.BASE_PLOTS) return [];
        const half = (CONFIG.WORLD.BASE_PLOT_SIZE || 240) / 2 + (CONFIG.WORLD.BASE_PLOT_BUFFER || 40);
        return CONFIG.WORLD_ZONES.BASE_PLOTS.map(plot => ({
            x1: plot.x - half,
            y1: plot.z - half,
            x2: plot.x + half,
            y2: plot.z + half
        }));
    },

    /**
     * Ki?m tra t?a d? x, z c� n?m trong placement zone kh�ng.
     */
    isInPlacementZone: function(type, x, z) {
        const zc = this.getBuildingPlacementZone(type);
        if (!zc) return true;
        
        // Ki?m tra zone ch�nh
        if (this._isInZone(x, z, zc)) return true;
        
        // Ki?m tra future plot zones cho walls, towers, minters
        const futureTypes = ['wall', 'tower', 'minter'];
        if (futureTypes.includes(type)) {
            const futureZones = this._getFuturePlotZones();
            if (this._isInZone(x, z, futureZones)) return true;
        }
        
        return false;
    },

    /**
     * G?i sau khi place building th�nh c�ng d? m? kh�a c�c building k? ti?p
     */
    unlockChain: function(type) {
        const def = this.getBuildingDef(type);
        if (!def || !def.unlocks || !def.unlocks.length) return;
        for (const next of def.unlocks) {
            if (!this.unlockedBuildings[next]) {
                this.unlockedBuildings[next] = true;
                console.log('?? �� m? kh�a:', next);
            }
        }
    },

    /**
     * Ki?m tra c�ng tr�nh d� m? kh�a chua
     * @param {string} type
     * @returns {boolean}
     */
    hasUnlockedBuilding: function(type) {
        const def = this.getBuildingDef(type);
        if (!def) return false;
        return def.required.every(req => this.unlockedBuildings[req] || this.builtBuildings[req] > 0);
    },

    /**
     * Ki?m tra c� th? mua/build c�ng tr�nh hay kh�ng
     * @param {string} type
     * @param {number} [x] - T�y ch?n: n?u c� s? ki?m tra c? placement zone
     * @param {number} [z]
     * @returns {boolean}
     */
    canBuildBuilding: function(type, x, z) {
        const def = this.getBuildingDef(type);
        if (!def) return false;
        if (!this.hasUnlockedBuilding(type)) return false;
        if (type === 'minter' && this.builtBuildings[type] >= this.maxMinterSlots) return false;
        if (this.builtBuildings[type] >= def.maxCount) return false;
        // Shop accessible day AND night
        if (typeof x === 'number' && typeof z === 'number' && !this.isInPlacementZone(type, x, z)) return false;
        return this.money >= def.cost;
    },

    /**
     * Chuy?n sang pha ti?p theo - legacy fallback
     */
    switchPhase: function() {
        if (this.phase === CONFIG.PHASE_DAY) {
            console.log('?? Chuy?n sang ��M - S�ng ' + this.currentWave);
            this.phase = CONFIG.PHASE_NIGHT;
            this.phaseTime = CONFIG.NIGHT_DURATION;
            this.phaseTimeRemaining = CONFIG.NIGHT_DURATION;
            this.lastZombieSpawnTime = Date.now();
        } else {
            console.log('?? Chuy?n sang NG�Y - S�ng ' + (this.currentWave + 1));
            this.phase = CONFIG.PHASE_DAY;
            this.phaseTime = CONFIG.DAY_DURATION;
            this.phaseTimeRemaining = CONFIG.DAY_DURATION;
            this.currentWave++;

            // Luu game
            this.saveGame();
        }
    },

    _legacySwitchPhase: function() {
        if (this.phase === CONFIG.PHASE_DAY) {
            this.phase = CONFIG.PHASE_NIGHT;
            this.phaseTimeRemaining = CONFIG.NIGHT_DURATION_LEGACY;
        } else {
            this.phase = CONFIG.PHASE_DAY;
            this.phaseTimeRemaining = CONFIG.DAY_DURATION_LEGACY;
            this.currentWave++;
            this.saveGame();
        }
    },
    
    /**
     * C?p nh?t sinh ti?n t? d?ng
     */
    updateMoneyRegen: function() {
        if (this.adminInfiniteStamina) {
            this.stamina = this.maxStamina;
        }
        if (this.adminInfiniteAmmo) {
            this.ammo = this.maxAmmo;
        }
        if (this.adminInfiniteHealth) {
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
     * C?p nh?t m�y in ti?n
     * @param {number} deltaTime - Th?i gian delta
     */
    updateMinters: function(deltaTime) {
        this.minters.forEach(minter => {
            minter.update(deltaTime);
            
            // N?u ho�n th�nh chu k?, c?ng ti?n
            if (minter.cycleProgress >= 1) {
                this.addMoney(CONFIG.MINTER_MONEY_PER_CYCLE * this.productionMultiplier * this.moneyMultiplier);
                minter.cycleProgress = 0;
            }
        });
    },
    
    /**
     * C?p nh?t th�p ph�o
     * @param {number} deltaTime - Th?i gian delta
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
     * C?p nh?t zombie
     * @param {number} deltaTime - Th?i gian delta
     */
    updateZombies: function(deltaTime) {
        const phaseMod = CONFIG.ZOMBIE_PHASE_MODIFIERS[this.phase] || CONFIG.ZOMBIE_PHASE_MODIFIERS.day;
        const eventZombieMod = this._specialEventZombieModifiers || {};
        const bloodPulseMod = this._bloodPulseActive ? (this._bloodPulseZombieModifiers || {}) : {};
        const totalSpeedMult = (phaseMod.speedMultiplier || 1) * (eventZombieMod.speed || 1) * (bloodPulseMod.speed ? (1 + bloodPulseMod.speed) : 1);
        const totalDamageMult = (eventZombieMod.damage || 1) * (bloodPulseMod.damage ? (1 + bloodPulseMod.damage) : 1);

        for (let i = this.zombies.length - 1; i >= 0; i--) {
            const zombie = this.zombies[i];
            zombie._frameSpeedOverride = zombie.speed * totalSpeedMult;
            zombie._frameDamageOverride = zombie.damage * totalDamageMult;
            zombie.update(deltaTime);

            if (zombie.isDead) {
                if (zombie.isDestroyed && zombie.isDestroyed()) {
                    this.zombies.splice(i, 1);
                }
                continue;
            }

            if (typeof PlayerController !== 'undefined' && this.playerHP > 0 && !PlayerController.isDead && !PlayerController.isRespawning) {
                const dx = zombie.x - PlayerController.position.x;
                const dz = zombie.z - PlayerController.position.z;
                const biteRange = 1.35;
                const distSq = dx * dx + dz * dz;
                if (distSq <= biteRange * biteRange) {
                    if (Date.now() >= this.playerBiteCooldownUntil) {
                        let dmg = CONFIG.ZOMBIE_PLAYER_DAMAGE;
                        if (eventZombieMod.damage) dmg *= eventZombieMod.damage;
                        if (bloodPulseMod.damage) dmg *= (1 + bloodPulseMod.damage);
                        this.damagePlayerFromZombie(dmg, zombie.x, zombie.z);
                    }
                }
            }
            
            if (zombie.reachedFortress && zombie.reachedFortress()) {
                const fortressDmg = zombie._frameDamageOverride || zombie.damage;
                this.damagesFortress(fortressDmg);
                zombie.dispose();
                this.zombies.splice(i, 1);
                continue;
            }
            
            if (zombie.hp <= 0) {
                let reward = CONFIG.MONEY_FROM_KILLED_ZOMBIE;
                if (this._specialEventRewardMultiplier) reward *= this._specialEventRewardMultiplier;
                this.addMoney(reward);
                this.zombiesKilled++;
                this.totalScore += 100;
            }
        }
    },
    
    /**
     * C?p nh?t d?n
     * @param {number} deltaTime - Th?i gian delta
     */
    updateBullets: function(deltaTime) {
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const bullet = this.bullets[i];
            bullet.update(deltaTime);
            
            // 3D world uses X/Z; the old 2D Y check meant turret bullets
            // never collided with zombies and could accumulate indefinitely.
            if (bullet.traveled >= bullet.maxDistance || bullet.x < CONFIG.WORLD.MIN_X || bullet.x > CONFIG.WORLD.MAX_X || bullet.z < CONFIG.WORLD.MIN_Z || bullet.z > CONFIG.WORLD.MAX_Z) {
                this.bullets.splice(i, 1);
            }
        }
    },
    
    /**
     * Ki?m tra va ch?m gi?a d?n v� zombie
     */
    checkCollisions: function() {
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const bullet = this.bullets[i];
            
            for (let j = this.zombies.length - 1; j >= 0; j--) {
                const zombie = this.zombies[j];
                
                const hitRadius = CONFIG.BULLET_RADIUS + CONFIG.ZOMBIE_WIDTH / 2;
                if (Math.hypot(bullet.x - zombie.x, bullet.z - zombie.z) <= hitRadius) {
                    // Zombie b? tr�ng d?n
                    zombie.takeDamage(bullet.damage || CONFIG.TOWER_DAMAGE);
                    
                    // X�a d?n
                    this.bullets.splice(i, 1);
                    break;
                }
            }
        }
    },

    findNearbyTurret: function(x, z, radius = 5.5) {
        let closest = null;
        let closestDistance = radius;
        this.turelList.forEach(turret => {
            const distance = Math.hypot(turret.x - x, turret.z - z);
            if (distance <= closestDistance) {
                closest = turret;
                closestDistance = distance;
            }
        });
        return closest ? { turret: closest, distance: closestDistance } : null;
    },

    upgradeTurret: function(turret) {
        if (!turret || turret.level >= (CONFIG.TUREL_MAX_LEVEL || 5)) return { success: false, title: 'TURRET', message: 'Turret d� d?t c?p t?i da.' };
        const cost = turret.getUpgradeCost();
        if (!this.spendMoney(cost)) return { success: false, title: 'TURRET', message: `C?n ${cost}?? d? n�ng c?p.` };
        turret.upgrade();
        return { success: true, title: 'TURRET UPGRADED', message: `Lv.${turret.level}: ${turret.damage} damage, t?m ${turret.range}m.` };
    },

    sellTurret: function(turret) {
        const index = this.turelList.indexOf(turret);
        if (index < 0) return { success: false, title: 'TURRET', message: 'Kh�ng t�m th?y turret.' };
        const refund = Math.floor(CONFIG.BUILDING_DEFS.turel.cost * (CONFIG.TUREL_SELL_REFUND || 0.65) + turret.upgradeSpent * 0.5);
        turret.dispose();
        this.turelList.splice(index, 1);
        this.builtBuildings.turel = Math.max(0, this.builtBuildings.turel - 1);
        this.addMoney(refund);
        return { success: true, title: 'TURRET SOLD', message: `�� b�n turret, nh?n ${refund}??.` };
    },

    startTurretRelocation: function(turret) {
        if (!turret) return false;
        this.endBuildMode();
        this.relocatingTurret = turret;
        this.buildingMode = true;
        this.buildingType = 'turel-relocate';
        if (turret.mesh3D) turret.mesh3D.visible = false;
        if (Renderer3D && Renderer3D.beginTurretPreview) Renderer3D.beginTurretPreview();
        return true;
    },

    relocateTurret: function(x, z) {
        const turret = this.relocatingTurret;
        if (!turret || !this.isInPlacementZone('turel', x, z)) return false;
        turret.setPosition(x, z);
        return true;
    },
    
    /**
     * Sinh zombie 3D li�n t?c t? 4 r�a ngo�i b?n d?
     * Kh�ng d?a tr�n wave, spawn d?u d?n trong m?i phase
     * @param {number} deltaTime - Th?i gian delta
     */
    spawnZombies: function(deltaTime) {
        const now = Date.now();

        let spawnRate = CONFIG.ZOMBIE_SPAWN_RATE;
        if (typeof TimeCycle !== 'undefined' && TimeCycle.isRunning) {
            const modifiers = CONFIG.ZOMBIE_PHASE_MODIFIERS[TimeCycle.currentPhase] || CONFIG.ZOMBIE_PHASE_MODIFIERS.day;
            spawnRate = CONFIG.ZOMBIE_SPAWN_RATE * modifiers.speedMultiplier;
        }

        const spawnInterval = 1000 / spawnRate;
        
        if (now - this.lastZombieSpawnTime >= spawnInterval) {
            const waveIndex = Math.min(this.currentWave - 1, CONFIG.ZOMBIE_WAVES.length - 1);
            const wave = CONFIG.ZOMBIE_WAVES[waveIndex] || CONFIG.ZOMBIE_WAVES[0];

            const edge = Math.floor(Math.random() * 4);
            const margin = 10;
            const mapSize = CONFIG.WORLD.MAX_X;
            let x, z;

            switch (edge) {
                case 0:
                    x = CONFIG.WORLD.MIN_X + 10 + Math.random() * (mapSize - 20);
                    z = CONFIG.WORLD.MIN_Z + margin + Math.random() * 5;
                    break;
                case 1:
                    x = CONFIG.WORLD.MIN_X + 10 + Math.random() * (mapSize - 20);
                    z = mapSize - margin - Math.random() * 5;
                    break;
                case 2:
                    x = CONFIG.WORLD.MIN_X + margin + Math.random() * 5;
                    z = CONFIG.WORLD.MIN_Z + 10 + Math.random() * (mapSize - 20);
                    break;
                case 3:
                default:
                    x = mapSize - margin - Math.random() * 5;
                    z = CONFIG.WORLD.MIN_Z + 10 + Math.random() * (mapSize - 20);
                    break;
            }

            const hp = wave.count > 10 ? 25 : 20;

            // Defensive guard: skip spawn if Zombie3D is not available
            if (typeof Zombie3D === 'undefined') {
                console.warn('Zombie3D not available, skipping zombie spawn');
                this.lastZombieSpawnTime = now;
                return;
            }

            // Determine zombie type - rotten meat zombie spawns with configured chance
            const isRottenMeat = Math.random() < CONFIG.ROTTEN_MEAT_ZOMBIE_SPAWN_CHANCE;

            let zombie;
            if (isRottenMeat && typeof RottenMeatZombie !== 'undefined') {
                zombie = new RottenMeatZombie(x, z, CONFIG.ROTTEN_MEAT_ZOMBIE_SPEED, CONFIG.ROTTEN_MEAT_ZOMBIE_HP);
            } else {
                zombie = new Zombie3D(x, z, wave.speed, hp);
            }
            this.zombies.push(zombie);
            this.lastZombieSpawnTime = now;
        }
    },

    /**
     * Th�m ti?n
     */
    addMoney: function(amount) {
        this.money += amount;
        this.moneyEarned += amount;
        this.totalScore += Math.floor(amount);
    },

    /**
     * Tr? ti?n
     */
    spendMoney: function(amount) {
        if (this.adminInfiniteMoney) return true;
        if (this.money >= amount) {
            this.money -= amount;
            return true;
        }
        return false;
    },

    /**
     * T?o th�p ph�o
     */
    buildTower: function(x, y) {
        const def = this.getBuildingDef('tower');
        if (!this.canBuildBuilding('tower')) {
            console.log('? Kh�ng th? x�y th�p ph�o. Ki?m tra unlock ho?c d? ti?n.');
            return false;
        }
        if (!this.spendMoney(def.cost)) {
            console.log('? Kh�ng d? ti?n d? x�y th�p');
            return false;
        }
        const tower = new Tower(x, y);
        this.towers.push(tower);
        this.builtBuildings.tower += 1;
        this.buildingsBuilt++;
        this.totalScore += 50;
        if (!this.unlockedBuildings.tower) this.unlockedBuildings.tower = true;
        this.unlockedBuildings.minter = this.hasUnlockedBuilding('minter') || this.unlockedBuildings.minter;
        console.log('?? X�y th�p ph�o t?i (' + x + ', ' + y + ')');
        return true;
    },

    /**
     * T?o tu?ng r�o
     */
    buildWall: function(x, y) {
        const def = this.getBuildingDef('wall');
        if (!this.canBuildBuilding('wall')) {
            console.log('? Kh�ng th? x�y tu?ng r�o.');
            return false;
        }
        if (!this.spendMoney(def.cost)) {
            console.log('? Kh�ng d? ti?n d? x�y tu?ng');
            return false;
        }
        const wall = new Wall(x, y);
        this.walls.push(wall);
        this.builtBuildings.wall += 1;
        this.buildingsBuilt++;
        this.totalScore += 25;
        this.unlockedBuildings.wall = true;
        this.unlockedBuildings.tower = this.hasUnlockedBuilding('tower') || this.unlockedBuildings.tower;
        console.log('?? X�y tu?ng r�o t?i (' + x + ', ' + y + ')');
        return true;
    },

    /**
     * T?o m�y in ti?n
     */
    buildMinter: function(x, y) {
        const def = this.getBuildingDef('minter');
        if (!this.canBuildBuilding('minter')) {
            console.log('? Kh�ng th? x�y m�y in ti?n.');
            return false;
        }
        if (!this.spendMoney(def.cost)) {
            console.log('? Kh�ng d? ti?n d? x�y m�y in');
            return false;
        }
        const minter = new Minter(x, y);
        this.minters.push(minter);
        this.builtBuildings.minter += 1;
        this.buildingsBuilt++;
        this.totalScore += 40;
        this.unlockedBuildings.minter = true;
        console.log('?? X�y m�y in ti?n t?i (' + x + ', ' + y + ')');
        return true;
    },

    /**
     * G�y s�t thuong cho ph�o d�i
     */
    damagesFortress: function(damage) {
        this.fortressHP = Math.max(0, this.fortressHP - damage);
        if (this.fortressHP <= 0) {
            this.endGame();
        }
    },

    /**
     * Apply damage to player from any source (centralized entry point)
     * @param {number} damage - Raw damage amount
     * @param {string} source - Source identifier
     * @returns {boolean} - True if damage was actually applied
     */
    damagePlayer: function(damage, source, attackerX, attackerZ) {
        return this._applyDamage(damage, source, attackerX, attackerZ);
    },

    /**
     * Player nh?n s�t thuong t? zombie bite.
     * M?t HP hi?n t?i theo damage.
     * C� 5% co h?i gi?m playerMaxHP di 1 (kh�ng bao gi? xu?ng du?i 1).
     * 95% tru?ng h?p maxHP kh�ng b? ?nh hu?ng.
     */
    damagePlayerFromZombie: function(damage = 10, attackerX, attackerZ) {
        this._applyDamage(damage, 'zombie_bite', attackerX, attackerZ);
    },

    /**
     * Centralized damage function - routes all damage through here
     * @param {number} damage - Raw damage amount
     * @param {string} source - Source identifier ('zombie_bite', 'rotten_meat_impact', 'rotten_meat_poison', 'turret')
     * @returns {boolean} - True if damage was actually applied
     */
    _applyDamage: function(damage, source, attackerX, attackerZ) {
        if (this.adminInfiniteHealth) return false;
        if (this.playerHP <= 0) return false;
        if (typeof PlayerController !== 'undefined' && (PlayerController.isDead || PlayerController.isRespawning)) return false;

        // Check Q-roll dodge i-frame before applying damage
        if (typeof PlayerController !== 'undefined' && PlayerController.isDodging) {
            // Player is dodging - damage is ignored (i-frame)
            return false;
        }

        // Check VIP Dash i-frame before applying damage
        if (typeof PlayerController !== 'undefined' && PlayerController.isVipDashing) {
            // Player is VIP dashing - damage is ignored (i-frame)
            return false;
        }

        // Check Observation Haki dodge before applying damage
        if (typeof ObservationHaki !== 'undefined' && ObservationHaki.isActive) {
            const attackContext = {
                source: source,
                damage: damage,
                attackerX: attackerX,
                attackerZ: attackerZ,
                timestamp: Date.now()
            };
            
            if (ObservationHaki.tryDodge(attackContext)) {
                // Attack was dodged - skip damage
                return false;
            }
        }

        const amount = Math.max(1, Math.round(damage));
        this.playerHP = Math.max(0, this.playerHP - amount);
        this.lastDamageTime = Date.now();

        // Trigger damage flash
        if (typeof GameLoop !== 'undefined' && GameLoop.triggerDamageFlash) {
            GameLoop.triggerDamageFlash();
        }

        // Trigger directional damage indicator
        if (attackerX !== undefined && attackerZ !== undefined) {
            if (typeof GameLoop !== 'undefined' && GameLoop.showDamageIndicator) {
                GameLoop.showDamageIndicator(attackerX, attackerZ);
            }
        }

        // Play damage sound
        if (typeof GameLoop !== 'undefined' && GameLoop.playDamageSound) {
            GameLoop.playDamageSound();
        }

        // Update low health state
        this._updateLowHealthState();

        // Zombie bite has 5% chance to reduce max HP
        if (source === 'zombie_bite' && Math.random() < 0.05) {
            this.playerMaxHP = Math.max(1, this.playerMaxHP - 1);
            this.playerHP = Math.min(this.playerHP, this.playerMaxHP);
            if (typeof Game !== 'undefined' && Game.showMilitaryToast) {
                Game.showMilitaryToast({ title: '?? ZOMBIE BITE', message: `Nhi?m khu?n! Max HP gi?m c�n ${this.playerMaxHP}`, success: false });
            }
        }

        this.playerBiteCooldownUntil = Date.now() + 1000;

        if (this.playerHP <= 0) {
            this._handlePlayerDeath();
        }

        return true;
    },

    /**
     * Apply poison damage over time
     */
    _applyPoisonTick: function() {
        if (this.adminInfiniteHealth) return;
        if (this.playerHP <= 0) return;
        if (typeof PlayerController !== 'undefined' && (PlayerController.isDead || PlayerController.isRespawning)) return;

        // Check Q-roll dodge i-frame before applying poison damage
        if (typeof PlayerController !== 'undefined' && PlayerController.isDodging) {
            // Player is dodging - poison damage is ignored
            return;
        }

        // Check VIP Dash i-frame before applying poison damage
        if (typeof PlayerController !== 'undefined' && PlayerController.isVipDashing) {
            // Player is VIP dashing - poison damage is ignored
            return;
        }

        const tickDamage = Math.max(1, Math.round(this.poisonDamageRemaining / Math.max(1, this.poisonTimeRemaining / CONFIG.ROTTEN_MEAT_POISON_TICK_INTERVAL)));
        this.playerHP = Math.max(0, this.playerHP - tickDamage);
        this.poisonDamageRemaining = Math.max(0, this.poisonDamageRemaining - tickDamage);
        this.lastDamageTime = Date.now();

        // Trigger damage flash
        if (typeof GameLoop !== 'undefined' && GameLoop.triggerDamageFlash) {
            GameLoop.triggerDamageFlash();
        }

        // Play damage sound
        if (typeof GameLoop !== 'undefined' && GameLoop.playDamageSound) {
            GameLoop.playDamageSound();
        }

        // Update low health state
        this._updateLowHealthState();

        if (this.playerHP <= 0) {
            this._handlePlayerDeath();
        }
    },

    /**
     * Apply poison effect to player (from rotten meat)
     */
    applyPoison: function(totalDamage, duration) {
        if (this.adminInfiniteHealth) return;

        // Refresh existing poison or add new stack (refresh strategy)
        if (this.poisonTimeRemaining > 0) {
            // Refresh duration and add remaining damage
            this.poisonDamageRemaining = Math.max(this.poisonDamageRemaining, totalDamage);
            this.poisonTimeRemaining = duration;
            this.poisonTickTimer = 0;
        } else {
            this.poisonDamageRemaining = totalDamage;
            this.poisonTimeRemaining = duration;
            this.poisonTickTimer = 0;
        }
    },

    /**
     * Update poison damage over time
     */
    _updatePoison: function(deltaTime) {
        if (this.poisonTimeRemaining <= 0) return;

        this.poisonTimeRemaining -= deltaTime / 1000;
        this.poisonTickTimer -= deltaTime / 1000;

        if (this.poisonTickTimer <= 0) {
            this.poisonTickTimer = CONFIG.ROTTEN_MEAT_POISON_TICK_INTERVAL;
            if (this.poisonDamageRemaining > 0) {
                this._applyPoisonTick();
            }
        }

        if (this.poisonTimeRemaining <= 0) {
            this.poisonDamageRemaining = 0;
            this.poisonTimeRemaining = 0;
            this.poisonTickTimer = 0;
        }
    },

    /**
     * Update low health warning state
     */
    _updateLowHealthState: function() {
        const lowHealthOverlay = document.getElementById('low-health-overlay');
        const lowHealthVignette = document.getElementById('low-health-vignette');
        const lowHealthText = document.getElementById('low-health-text');

        if (!lowHealthOverlay || !lowHealthVignette || !lowHealthText) return;

        const hpRatio = this.playerHP / this.playerMaxHP;
        const isLow = hpRatio > 0 && hpRatio < CONFIG.LOW_HEALTH_THRESHOLD;

        if (isLow) {
            lowHealthOverlay.style.display = 'block';
            lowHealthVignette.style.display = 'block';
            lowHealthText.style.display = 'block';
        } else {
            lowHealthOverlay.style.display = 'none';
            lowHealthVignette.style.display = 'none';
            lowHealthText.style.display = 'none';
        }
    },

    /**
     * Handle player death - trigger respawn sequence
     */
    _handlePlayerDeath: function() {
        if (typeof PlayerController !== 'undefined' && PlayerController.die) {
            PlayerController.die();
        }
    },

    useBandage: function() {
        if (this.bandages <= 0) return { success: false, message: 'H?t bandage.' };
        if (this.playerMaxHP >= this.playerBaseMaxHP && this.playerHP >= this.playerMaxHP) {
            return { success: false, message: 'HP d� d?y.' };
        }
        this.bandages -= 1;
        this.playerMaxHP = Math.min(this.playerBaseMaxHP, this.playerMaxHP + 10);
        this.playerHP = Math.min(this.playerMaxHP, this.playerHP + 10);
        this._updateLowHealthState();
        return { success: true, message: `Bandage: +10 HP capacity. C�n ${this.bandages}.` };
    },

    useMedkit: function() {
        if (this.medkits <= 0) return { success: false, message: 'H?t h?p c?p c?u.' };
        this.medkits -= 1;
        this.playerMaxHP = this.playerBaseMaxHP;
        this.playerHP = this.playerBaseMaxHP;
        // Clear poison
        this.poisonDamageRemaining = 0;
        this.poisonTimeRemaining = 0;
        this.poisonTickTimer = 0;
        this._updateLowHealthState();
        return { success: true, message: 'H?p c?p c?u d� kh�i ph?c HP v? 100%.', full: true };
    },
    
    /**
     * X�a zombie
     * @param {number} index - Index
     */
    removeZombie: function(index) {
        this.zombies.splice(index, 1);
    },
    
    /**
     * K?t th�c game
     */
    endGame: function() {
        this.isRunning = false;
        this.isGameOver = true;
        
        PokiManager.gameplayStop();
        console.log('?? GAME OVER! S�ng: ' + this.currentWave + ', Ti?n: ' + Math.floor(this.money) + ', �i?m: ' + this.totalScore);
    },
    
    /**
     * H?i sinh ph�o d�i (d�ng qu?ng c�o)
     */
    reviveFortress: function() {
        if (!this.isGameOver) return;
        
        console.log('?? H?i sinh ph�o d�i...');
        this.fortressHP = CONFIG.FORTRESS_MAX_HP;
        this.isGameOver = false;
        this.isRunning = true;
        
        // D?n s?ch zombie
        this.zombies = [];
        this.bullets = [];
        
        PokiManager.gameplayStart();
    },
    
    /**
     * Tang ti?n x2 (d�ng qu?ng c�o)
     */
    doubleMoneyFromAd: function() {
        this.addMoney(this.money);
        console.log('?? Ti?n du?c nh�n d�i! T?ng: ' + Math.floor(this.money));
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
                if (this.baseLevel >= 8) return fail('COMMAND HQ', 'Can c? d� d?t c?p t?i da.');
                if (!this.spendMoney(cost)) return fail('COMMAND HQ', `C?n ${cost}?? d? n�ng c?p HQ.`);
                this.baseLevel += 1;
                this.maxMinterSlots = Math.min(8, 5 + this.baseLevel);
                this.moneyMultiplier = 1 + (this.baseLevel - 1) * 0.08;
                this.fortressHP = Math.min(CONFIG.FORTRESS_MAX_HP + (this.baseLevel - 1) * 15, this.fortressHP + 15);
                return { success: true, title: 'COMMAND HQ', message: `HQ l�n c?p ${this.baseLevel}. M? th�m c�ng su?t m�y in v� +${Math.round((this.moneyMultiplier - 1) * 100)}% thu nh?p.`, reward: 0 };
            }
            case 'barracks': {
                const cost = 350 + this.guards * 180;
                if (!this.spendMoney(cost)) return fail('BARRACKS', `C?n ${cost}?? d? tuy?n m?t l�nh g�c.`);
                this.guards += 1;
                this.totalScore += 100;
                return { success: true, title: 'BARRACKS', message: `�� tuy?n l�nh g�c #${this.guards}. Ph�ng th? can c? +${this.guards * 2}%.`, reward: 0 };
            }
            case 'mess': {
                if (!this._serviceCooldownReady('mess', 12000)) return fail('MESS HALL', 'B?p dang chu?n b? su?t ti?p theo.');
                this.lastServiceAction.mess = Date.now();
                this.stamina = this.maxStamina;
                return { success: true, title: 'MESS HALL', message: '�� d�ng su?t an. Stamina d?y. HP kh�ng t? h?i.', reward: 0 };
            }
            case 'medical': {
                if (!this._serviceCooldownReady('medical', 15000)) return fail('MEDICAL', 'Medical bay dang t�i t?o thi?t b?.');
                this.lastServiceAction.medical = Date.now();
                const med = this.useMedkit();
                if (!med.success) return fail('MEDICAL', med.message);
                this.fortressHP = Math.min(CONFIG.FORTRESS_MAX_HP + (this.baseLevel - 1) * 15, this.fortressHP + 25);
                return { success: true, title: 'MEDICAL', message: '�� h?i d?y HP c� nh�n v� s?a ch?a +25 Fortress HP.', reward: 0 };
            }
            case 'supply': {
                const cost = 150 + (this.weaponTier - 1) * 250;
                if (!this.spendMoney(cost)) return fail('SUPPLY DEPOT', `C?n ${cost}?? d? n�ng c?p vu kh�.`);
                if (this.weaponTier >= 6) {
                    this.ammo = this.maxAmmo;
                    return { success: true, title: 'SUPPLY DEPOT', message: 'Kho d?t c?p t?i da. Ammo d� du?c n?p d?y.', reward: 0 };
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
                if (!this._serviceCooldownReady('fuel', 8000)) return fail('FUEL FARM', 'Bom nhi�n li?u dang h?i.');
                this.lastServiceAction.fuel = Date.now();
                const reward = 120 + this.vehicleLevel * 60;
                this.addMoney(reward);
                this.productionMultiplier = Math.min(2.5, this.productionMultiplier + 0.03);
                return { success: true, title: 'FUEL FARM', message: `B�n nhi�n li?u nh?n ${reward}?? v� +3% hi?u su?t production t?m th?i.`, reward };
            }
            case 'motorPool': {
                this.vehicleActive = true;
                this.vehicleLevel = Math.min(5, this.vehicleLevel + 1);
                if (typeof PlayerController !== 'undefined') {
                    PlayerController.normalSpeed = 6 + this.vehicleLevel * 0.7;
                    PlayerController.speed = PlayerController.normalSpeed;
                }
                return { success: true, title: 'MOTOR POOL', message: `Xe d� s?n s�ng. Vehicle Level ${this.vehicleLevel}; t?c d? di chuy?n tang.`, reward: 0 };
            }
            case 'lab': {
                const cost = 300 + this.weaponLevel * 220;
                if (!this.spendMoney(cost)) return fail('RESEARCH LAB', `C?n ${cost}?? d? ho�n th�nh nghi�n c?u.`);
                this.weaponLevel += 1;
                this.weaponDamage += 4;
                this.productionMultiplier = Math.min(3, this.productionMultiplier + 0.1);
                return { success: true, title: 'RESEARCH LAB', message: `Nghi�n c?u ho�n t?t. Weapon Lv.${this.weaponLevel}, +4 damage, +10% production.`, reward: 0 };
            }
            case 'workshop': {
                const cost = 250 + this.vehicleLevel * 180;
                if (!this.spendMoney(cost)) return fail('VEHICLE WORKSHOP', `C?n ${cost}?? d? n�ng c?p phuong ti?n.`);
                this.vehicleLevel = Math.min(8, this.vehicleLevel + 1);
                this.maxStamina = Math.min(180, this.maxStamina + 10);
                this.stamina = this.maxStamina;
                return { success: true, title: 'VEHICLE WORKSHOP', message: `Workshop c?p ${this.vehicleLevel}. Xe m?nh hon v� stamina t?i da +10.`, reward: 0 };
            }
            case 'training': {
                this.weaponXP += 25;
                if (this.weaponXP >= this.weaponLevel * 100) {
                    this.weaponXP = 0;
                    this.weaponLevel += 1;
                    this.weaponDamage += 3;
                }
                this.stamina = Math.min(this.maxStamina, this.stamina + 30);
                return { success: true, title: 'TRAINING GROUND', message: `+25 Weapon XP. T?ng XP ${this.weaponXP}/${this.weaponLevel * 100}.`, reward: 0 };
            }
            case 'range': {
                this.ammo = this.maxAmmo;
                this.weaponDamage += 2;
                this.lastServiceAction.range = Date.now();
                return { success: true, title: 'SHOOTING RANGE', message: 'Ammo d?y v� nh?n +2 damage t? luy?n b?n.', reward: 0 };
            }
            case 'radar': {
                const detected = this.zombies.length;
                this.radarLevel = Math.min(5, this.radarLevel + 1);
                return { success: true, title: 'RADAR STATION', message: `Radar Level ${this.radarLevel}. Ph�t hi?n ${detected} zombie tr�n b?n d?.`, reward: 0 };
            }
            case 'comms': {
                if (!this.commsReady) return fail('COMMS TOWER', 'H?p d?ng ti?p t? chua s?n s�ng.');
                this.commsReady = false;
                const reward = 250 + this.currentWave * 40;
                this.addMoney(reward);
                setTimeout(() => { this.commsReady = true; }, 20000);
                return { success: true, title: 'COMMS TOWER', message: `H?p d?ng ti?p t? ho�n t?t. +${reward}??.`, reward };
            }
            default:
                return fail('MILITARY BASE', 'T�a nh� n�y chua c� ch?c nang.');
        }
    },

    /**
     * Luu game v�o LocalStorage
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
                { type: 'minter', count: this.builtBuildings.minter },
                { type: 'turel', count: this.builtBuildings.turel },
                { type: 'minigun', count: this.builtBuildings.minigun }
            ],
            timestamp: Date.now()
        };

        Utils.saveToStorage('fortress-defense-save', saveData);
        console.log('?? Game du?c luu');
    },
    
    /**
     * T?i game t? LocalStorage
     */
    loadGame: function() {
        const saveData = Utils.loadFromStorage('fortress-defense-save', null);

        if (saveData) {
            console.log('?? T?i game du?c luu');
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
                    if (item.type === 'turel') this.builtBuildings.turel = Math.min(item.count || 0, CONFIG.BUILDING_DEFS.turel.maxCount);
                    if (item.type === 'minigun') this.builtBuildings.minigun = item.count || 0;
                });
            }
            return saveData;
        }

        return null;
    }
};

// Xu?t GameState
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GameState;
}


