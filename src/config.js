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
    // GAME PHASES
    // =====================
    PHASE_DAY: 'day',
    PHASE_NIGHT: 'night',
    DAY_DURATION: 60,
    NIGHT_DURATION: 45,

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
            maxCount: 12,
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
            unlocks: ['minter'],
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
        }
    },

    // Alias giữ tương thích với code cũ
    COST_WALL: 50,
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
