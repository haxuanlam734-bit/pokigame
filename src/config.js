/**
 * CONFIG.JS - Cấu hình chung cho game
 * Tất cả các hằng số và tham số chính của game
 */

const CONFIG = {
    // =====================
    // CANVAS & DISPLAY
    // =====================
    CANVAS_WIDTH: 1200,
    CANVAS_HEIGHT: 600,

    // =====================
    // WORLD - Open world military base (1600x1600)
    // =====================
    WORLD: {
        SIZE: 1600,
        MIN_X: 0,
        MAX_X: 1600,
        MIN_Z: 0,
        MAX_Z: 1600,
        CENTER_X: 800,
        CENTER_Z: 800,
        BASE_CENTER_X: 800,
        BASE_CENTER_Z: 800,
        HALF: 800,
        BUILD_BUFFER: 12,
        BASE_PLOT_SIZE: 240,
        BASE_PLOT_BUFFER: 40,
        CENTER_ZONE_RADIUS: 110,
        SEED: 17092009
    },

    // =====================
    // TIME CYCLE - CHU KỲ NGÀY/ĐÊM 16 PHÚT
    // =====================
    PHASE_DAY: 'day',
    PHASE_SUNSET: 'sunset',
    PHASE_NIGHT: 'night',
    PHASE_DAWN: 'dawn',

    DAY_DURATION: 420,
    SUNSET_DURATION: 60,
    NIGHT_DURATION: 420,
    DAWN_DURATION: 60,

    TOTAL_CYCLE_DURATION: 960,

    TIME_SCALE: 1,

    DEBUG_MODE: false,

    // =====================
    // LIGHTING PRESETS - Cinematic low-poly art direction
    // =====================
    LIGHTING: {
        day: {
            background: '#6a9abf',
            fogColor: '#8aa5b8',
            fogNear: 350,
            fogFar: 2200,
            ambientColor: '#8a9aaa',
            ambientIntensity: 0.12,
            directionalColor: '#fff2d9',
            directionalIntensity: 2.0,
            hemiSkyColor: '#8fafc5',
            hemiGroundColor: '#4a5a52',
            hemiIntensity: 0.10,
            sunPosition: { x: 1010, y: 145, z: 800 },
            exposure: 1.0,
            saturation: 1.08,
            sunColor: '#fff5e6',
            sunIntensity: 1.3,
            sunScale: 2.2,
            groundColor: '#4a5a52',
            starOpacity: 0.0,
            emissiveBoost: 1.0,
            shadowBias: -0.00025,
            shadowNormalBias: 0.025,
            moonPosition: { x: 800, y: -30, z: 800 },
            moonIntensity: 0.0,
            moonColor: '#e0e8ff'
        },
        sunset: {
            background: '#7a6878',
            fogColor: '#b0988c',
            fogNear: 320,
            fogFar: 2000,
            ambientColor: '#6e6263',
            ambientIntensity: 0.10,
            directionalColor: '#ffd4a0',
            directionalIntensity: 1.8,
            hemiSkyColor: '#a89098',
            hemiGroundColor: '#5a4f42',
            hemiIntensity: 0.08,
            sunPosition: { x: 590, y: 26, z: 800 },
            exposure: 0.95,
            saturation: 1.10,
            sunColor: '#ffe0b8',
            sunIntensity: 1.3,
            sunScale: 2.3,
            groundColor: '#5a5548',
            starOpacity: 0.0,
            emissiveBoost: 1.3,
            shadowBias: -0.0002,
            shadowNormalBias: 0.025,
            moonPosition: { x: 1010, y: 20, z: 800 },
            moonIntensity: 0.15,
            moonColor: '#c8d0e0'
        },
        night: {
            background: '#162840',
            fogColor: '#1e3348',
            fogNear: 280,
            fogFar: 1900,
            ambientColor: '#2a3d55',
            ambientIntensity: 0.35,
            directionalColor: '#8aa8c4',
            directionalIntensity: 0.30,
            hemiSkyColor: '#2a3d55',
            hemiGroundColor: '#1a2830',
            hemiIntensity: 0.40,
            sunPosition: { x: 800, y: -40, z: 800 },
            exposure: 0.90,
            saturation: 1.02,
            sunColor: '#8aa8c4',
            sunIntensity: 0.0,
            sunScale: 0.0,
            groundColor: '#252f35',
            starOpacity: 0.85,
            emissiveBoost: 2.8,
            shadowBias: -0.00035,
            shadowNormalBias: 0.03,
            moonPosition: { x: 800, y: 100, z: 800 },
            moonIntensity: 0.55,
            moonColor: '#b8c8e0'
        },
        dawn: {
            background: '#6a7d95',
            fogColor: '#7a8d9d',
            fogNear: 320,
            fogFar: 2100,
            ambientColor: '#7a8898',
            ambientIntensity: 0.10,
            directionalColor: '#ffe0c8',
            directionalIntensity: 1.4,
            hemiSkyColor: '#98b0c8',
            hemiGroundColor: '#4a5a52',
            hemiIntensity: 0.10,
            sunPosition: { x: 1010, y: 30, z: 800 },
            exposure: 0.9,
            saturation: 1.06,
            sunColor: '#ffe0c8',
            sunIntensity: 1.15,
            sunScale: 2.2,
            groundColor: '#4d6357',
            starOpacity: 0.15,
            emissiveBoost: 1.65,
            shadowBias: -0.00025,
            shadowNormalBias: 0.025,
            moonPosition: { x: 590, y: 10, z: 800 },
            moonIntensity: 0.1,
            moonColor: '#c0c8d8'
        }
    },

    // =====================
    // AUDIO - Cấu hình âm thanh phase
    // =====================
    AUDIO: {
        day: {
            ambience: 'day_ambience',
            volume: 0.6,
            fadeTime: 2.0
        },
        sunset: {
            ambience: 'sunset_ambience',
            volume: 0.5,
            fadeTime: 2.0
        },
        night: {
            ambience: 'night_ambience',
            volume: 0.7,
            fadeTime: 2.0
        },
        dawn: {
            ambience: 'dawn_ambience',
            volume: 0.5,
            fadeTime: 2.0
        }
    },

    // =====================
    // ZOMBIE AI - Điều chỉnh theo phase
    // =====================
    ZOMBIE_PHASE_MODIFIERS: {
        day: {
            detectionRadius: 1.0,
            speedMultiplier: 1.0,
            aggressionMultiplier: 1.0
        },
        sunset: {
            detectionRadius: 1.3,
            speedMultiplier: 1.2,
            aggressionMultiplier: 1.3
        },
        night: {
            detectionRadius: 1.6,
            speedMultiplier: 1.4,
            aggressionMultiplier: 1.6
        },
        dawn: {
            detectionRadius: 1.2,
            speedMultiplier: 1.1,
            aggressionMultiplier: 1.1
        }
    },

    // Alias giữ tương thích với code cũ
    PHASE_DAY_LEGACY: 'day',
    PHASE_NIGHT_LEGACY: 'night',
    DAY_DURATION_LEGACY: 60,
    NIGHT_DURATION_LEGACY: 45,

    // =====================
    // FORTRESS (PHÁO ĐÀI) - Tọa độ 3D world, trung tâm map 800,800
    // =====================
    FORTRESS_X: 800,
    FORTRESS_Y: 800,
    FORTRESS_WIDTH: 10,
    FORTRESS_HEIGHT: 12,
    FORTRESS_MAX_HP: 100,

    // =====================
    // RESOURCES (TIỀN)
    // =====================
    STARTING_MONEY: 500,
    MONEY_REGEN: 5,
    MONEY_REGEN_INTERVAL: 1000,
    MONEY_FROM_KILLED_ZOMBIE: 10,

    // =====================
    // BUILDING TYCOON CATALOG
    // =====================
    BUILDING_DEFS: {
        wall: {
            id: 'wall',
            name: 'Tường Rào',
            cost: 50,
            emoji: '🧱',
            maxCount: 999,
            required: [],
            unlocks: ['tower'],
            description: 'Chặn đường zombie và giữ thành.'
        },
        tower: {
            id: 'tower',
            name: 'Tháp Pháo',
            cost: 100,
            emoji: '🔫',
            maxCount: 10,
            required: ['wall'],
            unlocks: ['minter', 'turel'],
            description: 'Bắn laser tự động vào zombie gần nhất.'
        },
        minter: {
            id: 'minter',
            name: 'Máy In Tiền',
            cost: 80,
            emoji: '💵',
            maxCount: 8,
            required: ['tower'],
            unlocks: [],
            description: 'Sinh tiền đều đặn theo chu kỳ.'
        },
        turel: {
            id: 'turel',
            name: 'Turret',
            cost: 250,
            emoji: '🗼',
            maxCount: 20,
            required: [],
            unlocks: ['minigun'],
            restrictToBase: true,
            description: 'Turret 3D đặt trong căn cứ. Mua khi đủ tiền; tối đa 20 turret/căn cứ.'
        },
        minigun: {
            id: 'minigun',
            name: 'Máy Súng Minigun',
            cost: 600,
            emoji: '⚙️',
            maxCount: 16,
            required: ['turel'],
            unlocks: [],
            cratePurchase: true,
            description: 'Mua trong hộp, tốc độ bắn cực nhanh, sát thương cao.'
        }
    },

    // Alias giữ tương thích với code cũ
    COST_WALL: 50,
    COST_TOWER: 100,
    COST_TOWER: 100,
    COST_MINTER: 80,

    // =====================
    // WALL (TƯỜNG RÀO) - 3D world scale
    // =====================
    WALL_WIDTH: 2,
    WALL_HEIGHT: 3,
    WALL_MAX_HP: 30,
    WALL_PLACEMENT_ZONE: {
        x1: 540,
        y1: 540,
        x2: 1060,
        y2: 1060
    },

    // =====================
    // TOWER (THÁP PHÁO) - 3D world scale
    // =====================
    TOWER_WIDTH: 3,
    TOWER_HEIGHT: 7.5,
    TOWER_RANGE: 20,
    TOWER_FIRE_RATE: 500,
    TOWER_DAMAGE: 10,
    TOWER_ROTATION_SPEED: 0.1,
    TOWER_PLACEMENT_ZONE: {
        x1: 540,
        y1: 540,
        x2: 1060,
        y2: 1060
    },

    // =====================
    // TUREL (MODEL 3D) - Pháo đài model Turel.fbx
    // =====================
    TUREL_WIDTH: 4,
    TUREL_HEIGHT: 6.5,
    TUREL_RANGE: 38,
    TUREL_FIRE_RATE: 320,
    TUREL_DAMAGE: 22,
    TUREL_ROTATION_SPEED: 0.18,
    TUREL_MAX_LEVEL: 5,
    TUREL_UPGRADE_BASE_COST: 180,
    TUREL_SELL_REFUND: 0.65,
    TUREL_PLACEMENT_ZONE: {
        x1: 700,
        y1: 700,
        x2: 900,
        y2: 900
    },

    // =====================
    // MINIGUN (MODEL 3D) - Súng máy minign.fbx trong hộp
    // =====================
    MINIGUN_WIDTH: 2.5,
    MINIGUN_HEIGHT: 3,
    MINIGUN_RANGE: 32,
    MINIGUN_FIRE_RATE: 90,
    MINIGUN_DAMAGE: 8,
    MINIGUN_ROTATION_SPEED: 0.3,
    MINIGUN_PLACEMENT_ZONE: {
        x1: 700,
        y1: 700,
        x2: 900,
        y2: 900
    },

    // =====================
    // ZOMBIE AI - Phạm vi phát hiện người chơi
    // =====================
    ZOMBIE_PLAYER_CHASE_RADIUS: 120,
    ZOMBIE_PLAYER_ATTACK_RADIUS: 1.6,
    ZOMBIE_PLAYER_DAMAGE: 12,

    // =====================
    // BULLET (ĐẠN) - 3D world scale (m/s)
    // =====================
    BULLET_SPEED: 40,
    BULLET_RADIUS: 0.2,

    // =====================
    // ZOMBIE (ZOMBIE) - 3D world scale
    // =====================
    ZOMBIE_WIDTH: 0.7,
    ZOMBIE_HEIGHT: 1.4,
    ZOMBIE_MAX_HP: 20,
    ZOMBIE_SPEED: 3,
    ZOMBIE_SPAWN_RATE: 2,
    ZOMBIE_SPAWN_X: 1550,
    ZOMBIE_TARGET_X: 800,

    ZOMBIE_WAVES: [
        { count: 3, speed: 2.5 },
        { count: 5, speed: 3 },
        { count: 8, speed: 3.5 },
        { count: 12, speed: 4 },
        { count: 15, speed: 4.5 },
    ],

    // =====================
    // MONEY PRINTER (MÁY IN TIỀN) - 3D world scale
    // =====================
    MINTER_WIDTH: 3,
    MINTER_HEIGHT: 3,
    MINTER_MONEY_PER_CYCLE: 25,
    MINTER_CYCLE_TIME: 3000,
    MINTER_PLACEMENT_ZONE: {
        x1: 540,
        y1: 540,
        x2: 1060,
        y2: 1060
    },

    // =====================
    // WORLD ZONES - Future base plots and world layout
    // =====================
    WORLD_ZONES: {
        BASE_PLOTS: [
            { id: 'P1', x: 280, z: 280, name: 'Base Alpha' },
            { id: 'P2', x: 1320, z: 280, name: 'Base Bravo' },
            { id: 'P3', x: 300, z: 800, name: 'Base Charlie' },
            { id: 'P4', x: 1280, z: 800, name: 'Base Delta' },
            { id: 'P5', x: 400, z: 1250, name: 'Base Echo' },
            { id: 'P6', x: 1200, z: 1250, name: 'Base Foxtrot' },
            { id: 'P7', x: 800, z: 300, name: 'Base Golf' },
            { id: 'P8', x: 800, z: 1300, name: 'Base Hotel' },
            { id: 'P9', x: 500, z: 500, name: 'Base India' },
            { id: 'P10', x: 1100, z: 1100, name: 'Base Juliet' }
        ],
        CENTER_ZONE: { x: 800, z: 800, radius: 110 },
        RIVER_ZONE: { startX: 580, endX: 1020, baseZ: 990, width: 18 },
        FOREST_ZONES: [
            { x: 150, z: 150, radius: 180, density: 0.7 },
            { x: 1450, z: 150, radius: 180, density: 0.7 },
            { x: 150, z: 1450, radius: 180, density: 0.7 },
            { x: 1450, z: 1450, radius: 180, density: 0.7 },
            { x: 300, z: 500, radius: 140, density: 0.5 },
            { x: 1300, z: 500, radius: 140, density: 0.5 },
            { x: 500, z: 1300, radius: 140, density: 0.5 },
            { x: 1100, z: 1300, radius: 140, density: 0.5 }
        ],
        ROCKY_ZONES: [
            { x: 600, z: 400, radius: 90 },
            { x: 1000, z: 400, radius: 90 },
            { x: 400, z: 1000, radius: 90 },
            { x: 1000, z: 1000, radius: 90 }
        ],
        LANDMARKS: [
            { x: 800, z: 100, type: 'lookout', name: 'North Lookout' },
            { x: 800, z: 1500, type: 'radio_tower', name: 'South Relay' },
            { x: 100, z: 800, type: 'water_tower', name: 'West Reservoir' },
            { x: 1500, z: 800, type: 'bunker', name: 'East Bunker' },
            { x: 500, z: 250, type: 'ruins', name: 'Old Outpost' },
            { x: 1100, z: 250, type: 'bridge', name: 'Creek Bridge' }
        ]
    },

    // =====================
    // UI & TEXT
    // =====================
    TEXT_COLOR: '#00ff00',
    TEXT_SHADOW_COLOR: '#000000',
    FONT_SIZE: 18,
    FONT_FAMILY: 'Arial, sans-serif',

    // =====================
    // MOBILE DETECTION
    // =====================
    MOBILE_THRESHOLD: 768,

    // =====================
    // ADS & REWARDS
    // =====================
    AD_REWARD_MULTIPLIER: 2,
};

// Xuất CONFIG để các file khác sử dụng
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}
