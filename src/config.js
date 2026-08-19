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
    // LIGHTING PRESETS - Cài đặt ánh sáng cho từng phase
    // =====================
    LIGHTING: {
        day: {
            background: '#8aa8c8',
            fogColor: '#a0b8cc',
            fogNear: 200,
            fogFar: 800,
            ambientColor: '#c8d4dc',
            ambientIntensity: 0.5,
            directionalColor: '#fffaf0',
            directionalIntensity: 1.4,
            hemiSkyColor: '#c4d4e4',
            hemiGroundColor: '#6a7a5a',
            hemiIntensity: 0.3,
            sunPosition: { x: 150, y: 140, z: 50 },
            exposure: 1.15,
            saturation: 1.05,
            sunColor: '#fffbe6',
            sunIntensity: 1.5,
            sunScale: 2.2,
            starOpacity: 0.0,
            emissiveBoost: 1.0,
            shadowBias: -0.0003,
            shadowNormalBias: 0.01
        },
        sunset: {
            background: '#a08070',
            fogColor: '#a88878',
            fogNear: 120,
            fogFar: 650,
            ambientColor: '#dcc8a8',
            ambientIntensity: 0.35,
            directionalColor: '#ffdd99',
            directionalIntensity: 1.1,
            hemiSkyColor: '#e0c8a0',
            hemiGroundColor: '#4a3828',
            hemiIntensity: 0.28,
            sunPosition: { x: 350, y: 18, z: 50 },
            exposure: 0.95,
            saturation: 1.05,
            sunColor: '#ffe4b5',
            sunIntensity: 1.4,
            sunScale: 2.3,
            starOpacity: 0.0,
            emissiveBoost: 1.5,
            shadowBias: -0.0002,
            shadowNormalBias: 0.02
        },
        night: {
            background: '#060a10',
            fogColor: '#080e16',
            fogNear: 60,
            fogFar: 380,
            ambientColor: '#1a2636',
            ambientIntensity: 0.2,
            directionalColor: '#2a3a50',
            directionalIntensity: 0.1,
            hemiSkyColor: '#162030',
            hemiGroundColor: '#080c12',
            hemiIntensity: 0.16,
            sunPosition: { x: 250, y: -30, z: 50 },
            exposure: 0.8,
            saturation: 0.9,
            sunColor: '#141e2c',
            sunIntensity: 0.0,
            sunScale: 0.0,
            starOpacity: 0.75,
            emissiveBoost: 3.2,
            shadowBias: -0.0006,
            shadowNormalBias: 0.05
        },
        dawn: {
            background: '#6a7a8a',
            fogColor: '#7a8a7a',
            fogNear: 140,
            fogFar: 700,
            ambientColor: '#a8b8c8',
            ambientIntensity: 0.4,
            directionalColor: '#ffe8cc',
            directionalIntensity: 0.9,
            hemiSkyColor: '#a0b0c0',
            hemiGroundColor: '#3a4a50',
            hemiIntensity: 0.28,
            sunPosition: { x: 150, y: 28, z: 50 },
            exposure: 0.95,
            saturation: 1.0,
            sunColor: '#ffd8c0',
            sunIntensity: 1.2,
            sunScale: 2.0,
            starOpacity: 0.2,
            emissiveBoost: 2.0,
            shadowBias: -0.0003,
            shadowNormalBias: 0.02
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
    // FORTRESS (PHÁO ĐÀI) - Tọa độ 3D world, trung tâm map 250,250
    // =====================
    FORTRESS_X: 250,
    FORTRESS_Y: 250,
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
        x1: 20,
        y1: 20,
        x2: 480,
        y2: 480
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
        x1: 20,
        y1: 20,
        x2: 480,
        y2: 480
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
        x1: 162,
        y1: 162,
        x2: 338,
        y2: 338
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
        x1: 162,
        y1: 162,
        x2: 338,
        y2: 338
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
    ZOMBIE_SPAWN_X: 480,
    ZOMBIE_TARGET_X: 250,

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
        x1: 20,
        y1: 20,
        x2: 480,
        y2: 480
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
