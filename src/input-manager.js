/**
 * INPUT-MANAGER.JS - Quản lý input từ bàn phím và cảm ứng
 * Hỗ trợ WASD cho PC và Virtual Joystick cho Mobile
 */

const InputManager = {
    // Trạng thái phím
    keys: {},
    
    // Trạng thái joystick
    joystick: {
        x: 0,
        y: 0,
        active: false,
        startX: 0,
        startY: 0
    },
    
    // Mouse position (cho raycasting 3D)
    mouseX: 0,
    mouseY: 0,
    cameraYaw: 0,

    /**
     * Khởi tạo input manager
     */
    init: function() {
        console.log('⌨️ Khởi tạo Input Manager...');
        
        // Lắng nghe sự kiện bàn phím
        document.addEventListener('keydown', this.onKeyDown.bind(this));
        document.addEventListener('keyup', this.onKeyUp.bind(this));
        
        // Lắng nghe sự kiện chuột / cảm ứng
        document.addEventListener('mousedown', this.onPointerDown.bind(this));
        document.addEventListener('mousemove', this.onPointerMove.bind(this));
        document.addEventListener('mouseup', this.onPointerUp.bind(this));
        
        document.addEventListener('touchstart', this.onPointerDown.bind(this));
        document.addEventListener('touchmove', this.onPointerMove.bind(this));
        document.addEventListener('touchend', this.onPointerUp.bind(this));
        
        // Hiển thị joystick nếu là mobile
        if (Utils.isMobile()) {
            const joystickContainer = document.getElementById('joystick-container');
            if (joystickContainer) {
                joystickContainer.style.display = 'block';
            }
        }
        
        console.log('✅ Input Manager khởi tạo xong');
    },
    
    /**
     * Xử lý keydown
     * @param {KeyboardEvent} event - Sự kiện bàn phím
     */
    onKeyDown: function(event) {
        const key = event.key.toLowerCase();
        this.keys[key] = true;
    },
    
    /**
     * Xử lý keyup
     * @param {KeyboardEvent} event - Sự kiện bàn phím
     */
    onKeyUp: function(event) {
        const key = event.key.toLowerCase();
        this.keys[key] = false;
    },
    
    /**
     * Xử lý pointer down (chuột hoặc cảm ứng)
     * @param {Event} event - Sự kiện
     */
    onPointerDown: function(event) {
        const joystickContainer = document.getElementById('joystick-container');
        if (!joystickContainer) return;
        
        const rect = joystickContainer.getBoundingClientRect();
        const clientX = event.touches ? event.touches[0].clientX : event.clientX;
        const clientY = event.touches ? event.touches[0].clientY : event.clientY;
        
        const x = clientX - rect.left;
        const y = clientY - rect.top;
        
        // Kiểm tra nếu click vào joystick
        const dist = Math.sqrt(x * x + y * y);
        if (dist < 70) {
            this.joystick.active = true;
            this.joystick.startX = x;
            this.joystick.startY = y;
            event.preventDefault?.();
        }
    },
    
    /**
     * Xử lý pointer move
     * @param {Event} event - Sự kiện
     */
    onPointerMove: function(event) {
        // Cập nhật vị trí chuột cho raycasting 3D
        this.mouseX = event.clientX || (event.touches ? event.touches[0].clientX : 0);
        this.mouseY = event.clientY || (event.touches ? event.touches[0].clientY : 0);

        if (!this.joystick.active) return;
        
        const joystickContainer = document.getElementById('joystick-container');
        if (!joystickContainer) return;
        
        const rect = joystickContainer.getBoundingClientRect();
        const clientX = event.touches ? event.touches[0].clientX : event.clientX;
        const clientY = event.touches ? event.touches[0].clientY : event.clientY;
        
        const x = clientX - rect.left;
        const y = clientY - rect.top;
        
        // Tính độ lệch từ tâm
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        
        let dx = x - centerX;
        let dy = y - centerY;
        
        // Giới hạn trong bán kính
        const dist = Math.sqrt(dx * dx + dy * dy);
        const maxDist = 50;
        
        if (dist > maxDist) {
            dx = (dx / dist) * maxDist;
            dy = (dy / dist) * maxDist;
        }
        
        // Cập nhật vị trí joystick
        this.joystick.x = dx;
        this.joystick.y = dy;
        
        // Cập nhật vị trí thumb
        const thumb = document.getElementById('joystick-thumb');
        if (thumb) {
            thumb.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
        }
        
        event.preventDefault?.();
    },
    
    /**
     * Xử lý pointer up
     * @param {Event} event - Sự kiện
     */
    onPointerUp: function(event) {
        this.joystick.active = false;
        this.joystick.x = 0;
        this.joystick.y = 0;
        
        const thumb = document.getElementById('joystick-thumb');
        if (thumb) {
            thumb.style.transform = 'translate(-50%, -50%)';
        }
    },
    
    /**
     * Lấy vector di chuyển từ input
     * Kết hợp WASD keyboard và joystick
     * @returns {Object} {x, y} vector di chuyển
     */
    getMovementVector: function() {
        let x = 0;
        let y = 0;
        
        // Xử lý WASD
        if (this.keys['w'] || this.keys['arrowup']) y -= 1;
        if (this.keys['s'] || this.keys['arrowdown']) y += 1;
        if (this.keys['a'] || this.keys['arrowleft']) x -= 1;
        if (this.keys['d'] || this.keys['arrowright']) x += 1;
        
        // Xử lý joystick
        const joystickX = this.joystick.x / 50; // Chuẩn hóa
        const joystickY = this.joystick.y / 50;
        
        x += joystickX;
        y += joystickY;
        
        // Chuẩn hóa vector
        const dist = Math.sqrt(x * x + y * y);
        if (dist > 1) {
            x /= dist;
            y /= dist;
        }
        
        return { x, y };
    },
    
    /**
     * Kiểm tra nếu phím nào đó được nhấn
     * @param {string|string[]} keys - Phím hoặc mảng phím
     * @returns {boolean} Được nhấn?
     */
    isKeyPressed: function(keys) {
        if (typeof keys === 'string') {
            return this.keys[keys.toLowerCase()] || false;
        }
        
        return keys.some(key => this.keys[key.toLowerCase()]);
    }
};

// Xuất InputManager
if (typeof module !== 'undefined' && module.exports) {
    module.exports = InputManager;
}
