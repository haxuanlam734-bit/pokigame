/**
 * ARCHITECTURE-3D.md - Kiến Trúc Hệ Thống Game 3D
 * Hướng Dẫn Công Nghệ cho Lập Trình Viên
 */

# 🏗️ Kiến Trúc Game 3D Fortress Defense (Roblox-Style)

## 📐 Tổng Quan Công Nghệ

```
┌─────────────────────────────────────┐
│      index.html (Entry Point)       │
│   - Load Three.js CDN              │
│   - Load tất cả .js files          │
└────────────┬────────────────────────┘
             │
    ┌────────┴─────────┐
    │                  │
┌───▼────────┐    ┌───▼──────────────┐
│ Core Logic │    │ 3D Rendering     │
├────────────┤    ├──────────────────┤
│- Config    │    │- Renderer3D      │
│- Utils     │    │- PlayerController│
│- GameState │    │- 3D Entities     │
│- GameLoop  │    │- Three.js Scene  │
│- Input     │    │- WebGL Canvas    │
└────────────┘    └──────────────────┘
```

---

## 🎬 Game Loop (60 FPS Target)

```javascript
requestAnimationFrame(loop) → {
  1. Tính deltaTime
  2. PlayerController.update(deltaTime)  // WASD + Camera
  3. GameState.update(deltaTime)         // Logic game
  4. Renderer3D.render()                 // Vẽ scene
  5. GameLoop.updateUI()                 // Cập nhật HUD
  6. updateFPS()                         // Tính FPS
  7. requestAnimationFrame(loop)         // Lặp lại
}
```

---

## 📦 Các Module Chính

### 1. **renderer-3d.js** - Công Cụ Render 3D
**Trách Nhiệm:**
- Khởi tạo Three.js Scene, Camera, WebGL Renderer
- Tạo các 3D mesh cho công trình
- Quản lý lighting, fog, ground
- Raycasting để tìm vị trí click trên mặt đất

**Các Hàm Chính:**
```javascript
Renderer3D.init()                    // Khởi tạo Three.js
Renderer3D.create3DWall(x, z)       // Tạo tường
Renderer3D.create3DTower(x, z)      // Tạo tháp
Renderer3D.create3DMinter(x, z)     // Tạo máy in
Renderer3D.create3DZombie(x, z)     // Tạo zombie
Renderer3D.render()                  // Render frame
Renderer3D.getRaycaster(x, y)       // Lấy raycaster
Renderer3D.getGroundIntersection(raycaster)  // Lấy điểm trên mặt đất
Renderer3D.updateCameraToPlayer(x, z)       // Theo dõi player
```

---

### 2. **player-controller.js** - Điều Khiển Nhân Vật
**Trách Nhiệm:**
- Di chuyển nhân vật theo WASD
- Xoay camera xung quanh nhân vật
- Giới hạn vị trí trong bản đồ
- Raycasting để lấy vị trí build

**Các Hàm Chính:**
```javascript
PlayerController.init()           // Khởi tạo
PlayerController.update(deltaTime) // Cập nhật vị trí/camera
PlayerController.getRaycaster()   // Raycaster từ chuột
PlayerController.getBuildPosition() // Vị trí build trên đất
PlayerController.getForwardDirection() // Vector hướng camera
```

---

### 3. **game-state.js** - Logic Game
**Trách Nhiệm:**
- Quản lý trạng thái game (ngày/đêm, sóng, tiền)
- Xây dựng công trình
- Spawn zombie
- Xử lý damage, collision
- Lưu/tải game

**Các Hàm Chính (Mới cho 3D):**
```javascript
GameState.startBuildMode(type)      // Bắt đầu chế độ build
GameState.endBuildMode()            // Kết thúc build mode
GameState.placeBuilding(x, z, type) // Đặt building tại vị trí 3D
GameState.getBuildingDef(type)      // Lấy định nghĩa công trình
GameState.hasUnlockedBuilding(type) // Kiểm tra có mở khóa
GameState.canBuildBuilding(type)    // Kiểm tra có thể xây
```

---

### 4. **Entity Classes - 3D** (tower-3d, wall-3d, zombie-3d, minter-3d)

#### **Tower3D** (Tháp Pháo)
```javascript
class Tower3D {
  constructor(x, z)           // Tạo tháp tại x, z
  findNearestZombie(zombies)  // Tìm zombie gần nhất
  update(deltaTime, zombies, bullets)
  shoot(bullets, target)      // Bắn vào target
  dispose()                   // Xóa mesh
}
```
**Mesh:**
- Thân: Cylinder #666666
- Nòng: Cone #00ff00

#### **Wall3D** (Tường Rào)
```javascript
class Wall3D {
  constructor(x, z)
  takeDamage(damage)          // Nhận sát thương
  update(deltaTime)
  isDestroyed()
  dispose()
}
```
**Mesh:** Box #00cc00 (chuyển đỏ khi bị đạn)

#### **Zombie3D** (Zombie)
```javascript
class Zombie3D {
  constructor(x, z, speed, hp)
  takeDamage(damage)
  update(deltaTime)           // Di chuyển về pháo đài
  reachedFortress()          // Kiểm tra đến pháo đài
  isDestroyed()
  dispose()
}
```
**Mesh:** Box thân #ff3333, Box đầu #ff5555

#### **Minter3D** (Máy In Tiền)
```javascript
class Minter3D {
  constructor(x, z)
  update(deltaTime)           // Xoay bánh xe
  dispose()
}
```
**Mesh:** Box #ffff00, Wheel xoay

---

### 5. **game-loop.js** - Vòng Lặp Game
**Trách Nhiệm:**
- Gọi update() cho tất cả hệ thống
- Render 3D
- Cập nhật UI
- Tính FPS

**Các Hàm Chính:**
```javascript
GameLoop.start()              // Bắt đầu game loop
GameLoop.stop()               // Dừng game loop
GameLoop.loop(timestamp)      // Hàm callback chính
GameLoop.update(deltaTime)
GameLoop.updateUI()           // Cập nhật HUD
GameLoop.updateButtonStates() // Cập nhật màu nút
GameLoop.updateFPS()
```

---

### 6. **input-manager.js** - Quản Lý Input
**Thay Đổi Cho 3D:**
- Thêm `mouseX`, `mouseY` để tracking chuột
- Thêm `cameraYaw` cho xoay camera

```javascript
InputManager.onMouseMove(event) // Cập nhật vị trí chuột
InputManager.getMovementVector() // WASD → vector di chuyển
InputManager.getRaycaster()      // Lấy raycaster từ chuột
```

---

## 🔄 Chu Kỳ Xây Dựng 3D (Build Mode)

```
Nhấp Nút Build
    ↓
GameState.startBuildMode(type)  // buildingMode = true
    ↓
Canvas đã sẵn sàng nhận click
    ↓
Người chơi nhấp chuột trên canvas
    ↓
getRaycaster() + getGroundIntersection()
    ↓
Lấy điểm (x, z) trên mặt đất
    ↓
GameState.placeBuilding(x, z, type)
    ↓
Tạo Tower3D/Wall3D/Minter3D  → thêm vào Renderer3D.scene
    ↓
Thêm vào GameState.towers/walls/minters
    ↓
Cộng tiền, cập nhật unlock
    ↓
Lưu game vào LocalStorage
```

---

## 📐 Hệ Tọa Độ 3D

### Mặt Phẳng XZ (Từ Trên Nhìn Xuống)
```
(0, 0, 0) ──────────────── (500, 0, 0)
  Z ↓                       │
  │   Khu Vực Xây Dựng      │
  │  [300 - 1100]          │
  ↓   [150 - 550]          │
(0, 0, 500) ──────────────── (500, 0, 500)
                │
          🏰 Pháo Đài
         (150, Y, 150)
            
Zombie sinh: X=1100, Z=150±50
Chạy về: X=150, Z=150
```

### Chiều Cao Y
```
Y = 0   : Mặt đất (Ground)
Y = 30  : Tường rào, Máy in tiền
Y = 50  : Nửa cao tháp
Y = 100 : Pháo đài (chiều cao 100)
Y = 150 : Camera nhìn từ trên
```

---

## 🎨 Three.js Scene Setup

### Lighting
```javascript
AmbientLight    // Ánh sáng xung quanh (50%)
DirectionalLight // Mặt trời (50%) + Shadow maps
HemisphereLight  // Bầu trời xanh
```

### Materials
```javascript
MeshPhongMaterial  // Cho tất cả entities (phản chiếu ánh sáng)
MeshLambertMaterial // Cho ground (matte)
```

### Camera
```javascript
PerspectiveCamera
  fov: 60°
  aspect: window.innerWidth / window.innerHeight
  near: 0.1
  far: 1000
  position: (150 + offsetX, 80, 150 + offsetZ)
  lookAt: (150, 20, 150)
```

---

## 💾 Data Structure - LocalStorage

```javascript
fortress-defense-save {
  wave: 1,
  money: 500,
  fortressHP: 100,
  zombiesKilled: 5,
  buildingsBuilt: 3,
  totalScore: 1250,
  moneyEarned: 450,
  unlockedBuildings: {
    wall: true,
    tower: true,
    minter: false
  },
  buildings: [
    { type: 'wall', count: 2 },
    { type: 'tower', count: 1 },
    { type: 'minter', count: 0 }
  ],
  timestamp: 1692000000000
}
```

---

## 🐛 Debugging Tips

### Browser Console
```javascript
// Kiểm tra scene
console.log(Renderer3D.scene)

// Kiểm tra game state
console.log(GameState)

// Kiểm tra player position
console.log(PlayerController.position)

// Kiểm tra saved data
console.log(localStorage.getItem('fortress-defense-save'))

// Kiểm tra tower list
console.log(GameState.towers)
```

### Debug Helpers
- Thêm `GridHelper` để thấy lưới
- Thêm `AxesHelper` để thấy trục XYZ
- `console.log()` mỗi bước cập nhật

---

## 🚀 Tối Ưu Hóa

### Performance
- **InstancedMesh** cho nhiều zombie (nếu cần)
- **LOD (Level of Detail)** cho camera từ xa
- **Frustum Culling** tự động của Three.js
- Giới hạn 50ms/frame (deltaTime capping)

### Memory
- Gọi `dispose()` khi xóa mesh
- Tránh memory leak khi destroy entities
- Clear raycaster sau mỗi lần dùng

---

## 📝 Các Lỗi Thường Gặp & Cách Khắc Phục

| Lỗi | Nguyên Nhân | Khắc Phục |
|-----|-----------|----------|
| Không thấy gì trên màn hình | Camera position sai | Check `camera.position` |
| Building không xuất hiện | Raycaster sai | Check `getRaycaster()` |
| Game lag | Quá nhiều zombie | Giới hạn spawn rate |
| Nút không click được | Input event sai | Check `addEventListener` |
| Zombie không chuyển động | Update không gọi | Check `GameLoop.update()` |

---

## 🎓 Tài Liệu Tham Khảo

- **Three.js Docs:** https://threejs.org/docs/
- **Poki SDK:** https://pokiapi.dev/
- **WebGL Performance:** https://threejs.org/examples/

---

**Phiên Bản:** 1.0 - 3D Beta  
**Cập Nhật:** 2026-08-14  
**Công Nghệ:** Three.js r128 + Vanilla JavaScript (No Framework)

---

*Viết bởi AI Assistant - Đăng ký Poki Ready* ✅
