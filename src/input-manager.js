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

    // --- FPS Toggle (phím F) ---
    fpsTogglePressed: false,

    // --- Camera xoay kiểu Roblox: Pointer Lock + Spherical Orbit ---
    // targetYaw/targetPitch = giá trị "thô" cộng dồn trực tiếp từ movementX/movementY.
    // cameraYaw/cameraPitch = giá trị đã làm mượt (lerp) mỗi frame, đây mới là giá trị
    // thực sự được PlayerController/Renderer3D dùng để đặt vị trí camera.
    targetYaw: 0,
    targetPitch: 0.3,
    cameraYaw: 0,
    cameraPitch: 0.3,

    // Độ mượt quán tính khi lerp currentYaw/currentPitch -> targetYaw/targetPitch mỗi frame
    cameraRotateLerp: 0.15,

    // Pitch Clamp: khóa góc nhìn dọc trong khoảng an toàn [-80°, 80°]
    // để nhân vật không bao giờ bị "lật ngược đầu" khi kéo chuột lên/xuống hết cỡ.
    // Yaw (xoay ngang) vẫn giữ nguyên tự do 360 độ, KHÔNG clamp.
    minPitch: -80 * (Math.PI / 180),
    maxPitch: 80 * (Math.PI / 180),

    isRightMouseDown: false,
    isPointerLocked: false,
    lastMouseX: 0,
    lastMouseY: 0,

    init: function() {
        console.log('⌨️ Khởi tạo Input Manager...');
        
        document.addEventListener('keydown', this.onKeyDown.bind(this));
        document.addEventListener('keyup', this.onKeyUp.bind(this));
        
        document.addEventListener('contextmenu', function(e) { e.preventDefault(); });
        
        document.addEventListener('mousedown', this.onMouseDown.bind(this));
        document.addEventListener('mousemove', this.onMouseMove.bind(this));
        document.addEventListener('mouseup', this.onMouseUp.bind(this));

        // Theo dõi trạng thái Pointer Lock (kể cả khi người chơi nhấn Esc để thoát)
        document.addEventListener('pointerlockchange', this.onPointerLockChange.bind(this));

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

        // Phím F để toggle First-Person View
        if (key === 'f') {
            this.fpsTogglePressed = true;
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

            // Giữ chuột phải -> khóa con trỏ (Pointer Lock) đúng chuẩn Roblox:
            // con trỏ biến mất và event.movementX/Y có thể xoay vô hạn mà
            // không bao giờ "chạm mép" màn hình.
            if (document.body.requestPointerLock) {
                document.body.requestPointerLock();
            }

            event.preventDefault();
            return;
        }
        this.onPointerDown(event);
    },

    onMouseMove: function(event) {
        this.mouseX = event.clientX;
        this.mouseY = event.clientY;

        if (this.isRightMouseDown || this.isPointerLocked) {
            // Dùng movementX/movementY (chuẩn Pointer Lock API) thay vì tọa độ
            // chuột tuyệt đối, để xoay camera vô tận không bị giới hạn viewport.
            const deltaX = event.movementX || 0;
            const deltaY = event.movementY || 0;

            const sensitivity = 0.0025;

            // Yaw: xoay ngang 360 độ tự do, KHÔNG clamp
            this.targetYaw -= deltaX * sensitivity;

            // Pitch: Chuột lên/xuống điều khiển nhìn lên/xuống (chuẩn game 3D)
            this.targetPitch += deltaY * sensitivity;
            this.targetPitch = Math.max(this.minPitch, Math.min(this.maxPitch, this.targetPitch));
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
     * Gọi mỗi frame (từ PlayerController.update): làm mượt cameraYaw/cameraPitch
     * tiến dần về targetYaw/targetPitch bằng lerp, tạo cảm giác "quán tính"
     * xoay camera đặc trưng của Roblox thay vì xoay giật cứng theo chuột.
     */
    update: function() {
        this.cameraYaw = this._lerp(this.cameraYaw, this.targetYaw, this.cameraRotateLerp);
        this.cameraPitch = this._lerp(this.cameraPitch, this.targetPitch, this.cameraRotateLerp);
    },

    /**
     * Kiểm tra xem phím F (toggle FPS) có được nhấn không
     * @returns {boolean}
     */
    getFPSToggle: function() {
        const result = this.fpsTogglePressed;
        this.fpsTogglePressed = false; // Reset sau khi đọc
        return result;
    },

    onMouseUp: function(event) {
        if (event.button === 2) {
            this.isRightMouseDown = false;

            // KHÔNG tự exitPointerLock() ở đây nữa: nếu người chơi đang ở FPS Mode
            // (zoom sát), con trỏ vẫn cần khóa dù đã nhả chuột phải. Việc mở khóa
            // được PlayerController quyết định mỗi frame dựa trên cả zoom lẫn
            // trạng thái chuột phải (xem PlayerController._syncPointerLockWithZoom).
            return;
        }
        this.onPointerUp(event);
    },

    /**
     * Theo dõi trạng thái Pointer Lock. Xử lý cả trường hợp người chơi nhấn
     * phím Esc để thoát khóa con trỏ đột ngột (không qua onMouseUp).
     */
    onPointerLockChange: function() {
        this.isPointerLocked = (document.pointerLockElement === document.body);
        if (!this.isPointerLocked) {
            this.isRightMouseDown = false;
        }
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
