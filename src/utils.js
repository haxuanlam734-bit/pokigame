/**
 * UTILS.JS - Các hàm tiện ích chung
 * Toán học, hình học, ngẫu nhiên, etc.
 */

const Utils = {
    /**
     * Tính khoảng cách giữa hai điểm
     * @param {number} x1 - X của điểm 1
     * @param {number} y1 - Y của điểm 1
     * @param {number} x2 - X của điểm 2
     * @param {number} y2 - Y của điểm 2
     * @returns {number} Khoảng cách
     */
    distance: function(x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        return Math.sqrt(dx * dx + dy * dy);
    },

    /**
     * Tính góc giữa hai điểm (radian)
     * @param {number} fromX - X điểm gốc
     * @param {number} fromY - Y điểm gốc
     * @param {number} toX - X điểm đích
     * @param {number} toY - Y điểm đích
     * @returns {number} Góc (radian)
     */
    getAngle: function(fromX, fromY, toX, toY) {
        return Math.atan2(toY - fromY, toX - fromX);
    },

    /**
     * Tính vận tốc theo góc
     * @param {number} angle - Góc (radian)
     * @param {number} speed - Tốc độ
     * @returns {Object} {vx, vy}
     */
    getVelocity: function(angle, speed) {
        return {
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed
        };
    },

    /**
     * Kiểm tra va chạm hình tròn - hình tròn
     * @param {number} x1 - X của hình tròn 1
     * @param {number} y1 - Y của hình tròn 1
     * @param {number} r1 - Bán kính 1
     * @param {number} x2 - X của hình tròn 2
     * @param {number} y2 - Y của hình tròn 2
     * @param {number} r2 - Bán kính 2
     * @returns {boolean} Va chạm?
     */
    circleCollision: function(x1, y1, r1, x2, y2, r2) {
        const dist = this.distance(x1, y1, x2, y2);
        return dist < r1 + r2;
    },

    /**
     * Kiểm tra va chạm hình chữ nhật - hình chữ nhật
     * @param {Object} rect1 - {x, y, w, h}
     * @param {Object} rect2 - {x, y, w, h}
     * @returns {boolean} Va chạm?
     */
    rectCollision: function(rect1, rect2) {
        return rect1.x < rect2.x + rect2.w &&
               rect1.x + rect1.w > rect2.x &&
               rect1.y < rect2.y + rect2.h &&
               rect1.y + rect1.h > rect2.y;
    },

    /**
     * Làm trơn giá trị (lerp)
     * @param {number} current - Giá trị hiện tại
     * @param {number} target - Giá trị đích
     * @param {number} factor - Hệ số làm trơn (0-1)
     * @returns {number} Giá trị làm trơn
     */
    lerp: function(current, target, factor) {
        return current + (target - current) * factor;
    },

    /**
     * Làm trơn góc (giới hạn tốc độ xoay)
     * @param {number} current - Góc hiện tại
     * @param {number} target - Góc đích
     * @param {number} maxChange - Thay đổi tối đa
     * @returns {number} Góc mới
     */
    lerpAngle: function(current, target, maxChange) {
        let diff = target - current;
        
        // Chuẩn hóa góc
        while (diff > Math.PI) diff -= 2 * Math.PI;
        while (diff < -Math.PI) diff += 2 * Math.PI;
        
        return current + Math.max(-maxChange, Math.min(maxChange, diff));
    },

    /**
     * Tạo số ngẫu nhiên trong khoảng
     * @param {number} min - Giá trị tối thiểu
     * @param {number} max - Giá trị tối đa
     * @returns {number} Số ngẫu nhiên
     */
    random: function(min, max) {
        return Math.random() * (max - min) + min;
    },

    /**
     * Tạo số ngẫu nhiên nguyên trong khoảng
     * @param {number} min - Giá trị tối thiểu
     * @param {number} max - Giá trị tối đa
     * @returns {number} Số ngẫu nhiên nguyên
     */
    randomInt: function(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    },

    /**
     * Giới hạn giá trị
     * @param {number} value - Giá trị
     * @param {number} min - Tối thiểu
     * @param {number} max - Tối đa
     * @returns {number} Giá trị sau khi giới hạn
     */
    clamp: function(value, min, max) {
        return Math.max(min, Math.min(max, value));
    },

    /**
     * Định dạng số tiền
     * @param {number} amount - Số tiền
     * @returns {string} Chuỗi định dạng
     */
    formatMoney: function(amount) {
        return Math.floor(amount).toString();
    },

    /**
     * Lưu dữ liệu vào LocalStorage
     * @param {string} key - Khóa
     * @param {*} value - Giá trị
     */
    saveToStorage: function(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
            console.warn('Không thể lưu vào LocalStorage:', e);
        }
    },

    /**
     * Tải dữ liệu từ LocalStorage
     * @param {string} key - Khóa
     * @param {*} defaultValue - Giá trị mặc định
     * @returns {*} Giá trị lưu hoặc giá trị mặc định
     */
    loadFromStorage: function(key, defaultValue) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (e) {
            console.warn('Không thể tải từ LocalStorage:', e);
            return defaultValue;
        }
    },

    /**
     * Xóa dữ liệu từ LocalStorage
     * @param {string} key - Khóa
     */
    removeFromStorage: function(key) {
        try {
            localStorage.removeItem(key);
        } catch (e) {
            console.warn('Không thể xóa từ LocalStorage:', e);
        }
    },

    /**
     * Kiểm tra nếu là thiết bị mobile
     * @returns {boolean} Có phải mobile?
     */
    isMobile: function() {
        return window.innerWidth <= CONFIG.MOBILE_THRESHOLD || 
               /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }
};

// Xuất Utils
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Utils;
}
