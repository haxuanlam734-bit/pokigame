# 🎮 GAME 3D - Hướng Dẫn Chơi (Fortress Defense - Phiên Bản Roblox)

## 📍 Khởi Động Game

### Bước 1: Chạy Server Local
```bash
cd pokigame
python -m http.server 8000
```

### Bước 2: Mở Trình Duyệt
Truy cập: **http://localhost:8000**

---

## 🕹️ Điều Khiển 3D (Roblox-Style)

### Di Chuyển Nhân Vật
| Phím | Hành Động |
|------|----------|
| **W** | Tiến Lên |
| **A** | Quay Trái |
| **S** | Lùi Lại |
| **D** | Quay Phải |
| **Chuột** | Xoay Camera Xung Quanh |

### Xây Dựng Công Trình
1. **Nhấp nút** 🧱 Tường / 🔫 Tháp / 💵 Máy In Tiền (dưới cùng)
2. **Nút sẽ bật sáng xanh** khi bạn có đủ tiền
3. **Nhấp chuột trên mặt đất** để đặt công trình
4. Công trình sẽ xuất hiện ở vị trí bạn chọn trong không gian 3D

### Xem Quảng Cáo
- Nhấp **📺 Xem QC (x2 Tiền)** để nhân đôi tiền hiện tại
- Áp dụng cho việc hồi sinh pháo đài hoặc nhận thêm tiền

---

## 🌞 Chu Kỳ Ngày/Đêm

### ☀️ NGÀY (60 giây)
- Không có zombie xuất hiện
- **Bạn có thể xây dựng** tường, tháp, máy in tiền
- Tiền tự sinh: **5💰/giây**
- Máy in tiền sinh tiền mỗi **3 giây**

### 🌙 ĐÊM (45 giây)
- **Zombie xuất hiện từ phía bên phải**
- Zombie di chuyển về phía pháo đài (bên trái)
- **Không thể xây dựng** vào lúc này
- Tháp pháo **tự động bắn** vào zombie gần nhất
- Tường chắn đường zombie

---

## 🏰 Hệ Thống Xây Dựng (Tycoon)

### Unlock Tree (Mở Khóa Theo Tuần Tự)

```
🧱 Tường Rào (50💰)
    ↓
    └──→ 🔫 Tháp Pháo (100💰)
             ↓
             └──→ 💵 Máy In Tiền (80💰)
```

**Cách thức:**
- Bắt đầu chỉ có thể xây **Tường**
- Sau khi xây **Tường**, mới **mở khóa Tháp**
- Sau khi xây **Tháp**, mới **mở khóa Máy In Tiền**

### Chi Phí Xây Dựng

| Công Trình | Giá | HP | Mô Tả |
|-----------|-----|-----|-------|
| 🧱 Tường | 50💰 | 30 | Chắn zombie, bảo vệ pháo đài |
| 🔫 Tháp | 100💰 | ∞ | Bắn laser tự động vào zombie |
| 💵 Máy In | 80💰 | ∞ | Sinh 25💰 mỗi 3 giây |

---

## 💀 Zombie Waves (Sóng Zombie)

Mỗi sóng zombie khó hơn:

| Sóng | Số Lượng | Tốc Độ | Máu |
|-----|---------|--------|-----|
| 1 | 3 | 60 px/s | 20 |
| 2 | 5 | 70 px/s | 20 |
| 3 | 8 | 80 px/s | 25 |
| 4 | 12 | 90 px/s | 25 |
| 5+ | 15+ | 100+ px/s | 25+ |

**Nhận thưởng khi giết zombie:**
- +10💰 tiền
- +100 điểm

---

## 📊 UI Display

### Góc Trên Trái - Thông Tin Pha
- **Pha:** ☀️ NGÀY / 🌙 ĐÊM
- **Sóng:** 1, 2, 3...
- **Thời Gian:** Đếm ngược 60s (ngày) hoặc 45s (đêm)

### Góc Trên Phải - Tài Nguyên
- **💰 Tiền:** $1K, $1.5K, $1M (định dạng friendly)
- **❤️ HP:** Máu pháo đài còn bao nhiêu

### Dưới Cùng - Nút Xây Dựng
- Xanh 🟢 = Có thể xây (đủ tiền + ngày)
- Đỏ 🔴 = Không thể xây (chưa mở khóa / chưa đủ tiền / đêm rồi)

---

## 🎯 Mục Tiêu Game

1. **Xây dựng pháo đài mạnh** bằng tường và tháp
2. **Chống lại zombie waves** đêm hôm
3. **Kiếm tiền** từ:
   - Tự sinh: 5💰/s
   - Giết zombie: 10💰/con
   - Máy in tiền: 25💰 mỗi 3s
4. **Tích luỹ điểm** càng cao càng tốt
5. **Giữ pháo đài sống** (HP > 0)

---

## 💾 Lưu Game

- **Tự động lưu** vào LocalStorage mỗi khi kết thúc sóng (chuyển từ đêm → ngày)
- Dữ liệu lưu: tiền, sóng, HP, tất cả công trình đã xây

---

## ⚙️ Tính Năng Thêm

### Color-Coded Buttons
- **Xanh (#00ff00)** = Sẵn sàng xây
- **Đỏ (#ff4d4d)** = Không thể xây
- **Vàng** = Đang chế độ build

### Raycasting 3D
- Click chuột chính xác trên mặt đất để đặt building
- Camera theo dõi nhân vật tự động

### Mobile Friendly
- Virtual Joystick xuất hiện trên điện thoại
- Touch-friendly buttons

---

## 🚀 Poki Integration

Game đã tích hợp **Poki SDK** hoàn toàn:
- ✅ `PokiSDK.init()`
- ✅ `PokiSDK.gameLoadingFinished()`
- ✅ `PokiSDK.gameplayStart()` / `gameplayStop()`
- ✅ `PokiSDK.rewardedBreak()` (xem quảng cáo để nhân đôi tiền)

---

## 📁 Cấu Trúc File 3D

```
pokigame/
├── src/
│   ├── rendering/
│   │   ├── renderer.js       (2D - cũ, có thể xóa)
│   │   └── renderer-3d.js    (3D - Three.js render)
│   ├── player-controller.js  (Camera + Di chuyển nhân vật)
│   ├── entities/
│   │   ├── tower-3d.js       (Tháp 3D)
│   │   ├── wall-3d.js        (Tường 3D)
│   │   ├── zombie-3d.js      (Zombie 3D)
│   │   └── minter-3d.js      (Máy in tiền 3D)
│   ├── game-state.js         (Logic game - dùng cho 3D)
│   ├── game-loop.js          (3D game loop)
│   └── main.js               (Khởi tạo)
└── index.html                (Load Three.js CDN)
```

---

## 🐛 Gỡ Lỗi

### Mở Console (F12)
- Xem logs chi tiết
- Kiểm tra lỗi JavaScript

### Kiểm Tra LocalStorage
```javascript
// Trong Console:
localStorage.getItem('fortress-defense-save')
```

---

## 🎨 Thiết Kế Blocky Roblox

Tất cả công trình dùng hình khối đơn giản:
- 🧱 Tường = Box #00cc00
- 🔫 Tháp = Cylinder #666666 + Cone #00ff00
- 💵 Máy In = Box #ffff00 + Wheel xoay
- 🧟 Zombie = Box #ff3333 + Box đầu #ff5555
- 🏰 Pháo Đài = Box #ff9900 + Cờ đỏ #ff0000

**Ánh Sáng:** Sun + Ambient + Hemisphere = Sáng tự nhiên

---

## 📝 Ghi Chú Phát Triển

- **Phiên bản:** 1.0 - 3D Beta
- **Nền tảng:** Web3D (Three.js)
- **Mục tiêu:** Poki Gaming Platform
- **Tối ưu:** Sạch code, không lỗi, Poki SDK hoàn chỉnh

---

**Chúc bạn chơi vui! 🎮✨**
