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
    // FORTRESS (PHÁO ĐÀI)
    // =====================
    FORTRESS_X: 150,
    FORTRESS_Y: 300,
    FORTRESS_WIDTH: 80,
    FORTRESS_HEIGHT: 100,
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
    // WALL (TƯỜNG RÀO)
    // =====================
    WALL_WIDTH: 40,
    WALL_HEIGHT: 80,
    WALL_MAX_HP: 30,
    WALL_PLACEMENT_ZONE: {
        x1: 300,
        y1: 150,
        x2: 1100,
        y2: 550
    },

    // =====================
    // TOWER (THÁP PHÁO)
    // =====================
    TOWER_WIDTH: 50,
    TOWER_HEIGHT: 50,
    TOWER_RANGE: 200,
    TOWER_FIRE_RATE: 500,
    TOWER_DAMAGE: 10,
    TOWER_ROTATION_SPEED: 0.1,
    TOWER_PLACEMENT_ZONE: {
        x1: 300,
        y1: 150,
        x2: 1100,
        y2: 550
    },

    // =====================
    // BULLET (ĐẠN)
    // =====================
    BULLET_SPEED: 400,
    BULLET_RADIUS: 5,

    // =====================
    // ZOMBIE (ZOMBIE)
    // =====================
    ZOMBIE_WIDTH: 35,
    ZOMBIE_HEIGHT: 50,
    ZOMBIE_MAX_HP: 20,
    ZOMBIE_SPEED: 60,
    ZOMBIE_SPAWN_RATE: 2,
    ZOMBIE_SPAWN_X: 1100,
    ZOMBIE_TARGET_X: 150,

    ZOMBIE_WAVES: [
        { count: 3, speed: 60 },
        { count: 5, speed: 70 },
        { count: 8, speed: 80 },
        { count: 12, speed: 90 },
        { count: 15, speed: 100 },
    ],

    // =====================
    // MONEY PRINTER (MÁY IN TIỀN)
    // =====================
    MINTER_WIDTH: 40,
    MINTER_HEIGHT: 40,
    MINTER_MONEY_PER_CYCLE: 25,
    MINTER_CYCLE_TIME: 3000,
    MINTER_PLACEMENT_ZONE: {
        x1: 300,
        y1: 150,
        x2: 1100,
        y2: 550
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
