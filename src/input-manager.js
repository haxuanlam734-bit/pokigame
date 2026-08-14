/**
 * INPUT-MANAGER.JS - Quản lý input từ bàn phím và cảm ứng
 * Hỗ trợ WASD cho PC và Virtual Joystick cho Mobile
 */

const InputManager = {
    keys: {},
    
    joystick: {
        x: 0,
        y: 0,
        active: false,
        startX: 0,
        startY: 0
    },
    
    mouseX: 0,
    mouseY: 0,
    cameraYaw: 0,
    cameraPitch: 0.3,

    isRightMouseDown: false,
    lastMouseX: 0,
    lastMouseY: 0,

    // --- Giới hạn Pitch động theo khoảng cách Zoom (chuẩn Roblox) ---
    // Zoom xa (zoomRatio -> 1): pitch tự do trong [pitchFarMin, pitchFarMax]
    // Zoom gần (zoomRatio -> 0): pitch bị khóa dần về góc cố định pitchCloseFixed
    pitchFarMin: -10 * Math.PI / 180,
    pitchFarMax: 75 * Math.PI / 180,
    pitchCloseFixed: 18 * Math.PI / 180,

    init: function() {
        console.log('⌨️ Khởi tạo Input Manager...');
        
        document.addEventListener('keydown', this.onKeyDown.bind(this));
        document.addEventListener('keyup', this.onKeyUp.bind(this));
        
        document.addEventListener('contextmenu', function(e) { e.preventDefault(); });
        
        document.addEventListener('mousedown', this.onMouseDown.bind(this));
        document.addEventListener('mousemove', this.onMouseMove.bind(this));
        document.addEventListener('mouseup', this.onMouseUp.bind(this));
        
        document.addEventListener('touchstart', this.onPointerDown.bind(this));
        document.addEventListener('touchmove', this.onPointerMove.bind(this));
        document.addEventListener('touchend', this.onPointerUp.bind(this));
        
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

        // Bắt phím Space (Dấu cách) để nhảy - dùng event.code cho chính xác
        // và tránh xung đột với ký tự ' ' khi key bị trùng do layout bàn phím
        if (event.code === 'Space') {
            this.keys['space'] = true;
            event.preventDefault(); // Chặn cuộn trang khi nhấn Space
        }
    },
    
    onKeyUp: function(event) {
        const key = event.key.toLowerCase();
        this.keys[key] = false;

        if (event.code === 'Space') {
            this.keys['space'] = false;
        }
    },

    onMouseDown: function(event) {
        if (event.button === 2) {
            this.isRightMouseDown = true;
            this.lastMouseX = event.clientX;
            this.lastMouseY = event.clientY;
            event.preventDefault();
            return;
        }
        this.onPointerDown(event);
    },

    onMouseMove: function(event) {
        this.mouseX = event.clientX;
        this.mouseY = event.clientY;

        if (this.isRightMouseDown) {
            const deltaX = event.clientX - this.lastMouseX;
            const deltaY = event.clientY - this.lastMouseY;
            this.lastMouseX = event.clientX;
            this.lastMouseY = event.clientY;

            const sensitivity = 0.005;

            // Yaw: xoay ngang 360 độ tự do, KHÔNG clamp
            this.cameraYaw -= deltaX * sensitivity;

            // Pitch: cộng dồn rồi clamp theo giới hạn động (phụ thuộc zoom)
            this.cameraPitch += deltaY * sensitivity;
            this.clampPitchToZoom();
            return;
        }

        if (this.joystick.active) {
            this.onPointerMove(event);
        }
    },

    /**
     * Nội suy tuyến tính (lerp) đơn giản
     */
    _lerp: function(a, b, t) {
        return a + (b - a) * t;
    },

    /**
     * Clamp cameraPitch theo giới hạn động, phụ thuộc zoomRatio hiện tại của PlayerController.
     * zoomRatio = 0 (zoom gần)  -> pitch khóa cố định quanh pitchCloseFixed
     * zoomRatio = 1 (zoom xa)   -> pitch tự do trong [pitchFarMin, pitchFarMax]
     * Được gọi cả khi kéo chuột (đổi pitch) VÀ mỗi frame trong PlayerController.update
     * (để zoom bằng lăn chuột cũng tự khóa/lới lỏng pitch ngay cả khi không kéo chuột).
     */
    clampPitchToZoom: function() {
        const zoomRatio = (typeof PlayerController !== 'undefined' && PlayerController && PlayerController.getZoomRatio)
            ? PlayerController.getZoomRatio()
            : 1;

        const effectiveMinPitch = this._lerp(this.pitchCloseFixed, this.pitchFarMin, zoomRatio);
        const effectiveMaxPitch = this._lerp(this.pitchCloseFixed, this.pitchFarMax, zoomRatio);

        this.cameraPitch = Math.max(effectiveMinPitch, Math.min(effectiveMaxPitch, this.cameraPitch));
    },

    onMouseUp: function(event) {
        if (event.button === 2) {
            this.isRightMouseDown = false;
            return;
        }
        this.onPointerUp(event);
    },
    
    onPointerDown: function(event) {
        const joystickContainer = document.getElementById('joystick-container');
        if (!joystickContainer) return;
        
        const rect = joystickContainer.getBoundingClientRect();
        const clientX = event.touches ? event.touches[0].clientX : event.clientX;
        const clientY = event.touches ? event.touches[0].clientY : event.clientY;
        
        const x = clientX - rect.left;
        const y = clientY - rect.top;
        
        const dist = Math.sqrt(x * x + y * y);
        if (dist < 70) {
            this.joystick.active = true;
            this.joystick.startX = x;
            this.joystick.startY = y;
            event.preventDefault?.();
        }
    },
    
    onPointerMove: function(event) {
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
        
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        
        let dx = x - centerX;
        let dy = y - centerY;
        
        const dist = Math.sqrt(dx * dx + dy * dy);
        const maxDist = 50;
        
        if (dist > maxDist) {
            dx = (dx / dist) * maxDist;
            dy = (dy / dist) * maxDist;
        }
        
        this.joystick.x = dx;
        this.joystick.y = dy;
        
        const thumb = document.getElementById('joystick-thumb');
        if (thumb) {
            thumb.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
        }
        
        event.preventDefault?.();
    },
    
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
