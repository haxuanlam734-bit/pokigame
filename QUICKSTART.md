# ⚡ QUICK START GUIDE

Hướng dẫn nhanh để chạy và phát triển game **Pháo Đài Chống Zombie**.

## 🚀 Chạy Game Ngay Lập Tức

### Cách 1: Python (Khuyên Dùng)

```bash
# Mở Command Prompt / Terminal
cd pokigame
python -m http.server 8000

# Truy cập: http://localhost:8000
```

### Cách 2: Node.js

```bash
# Cài http-server (lần đầu)
npm install -g http-server

# Chạy
cd pokigame
http-server

# Truy cập: http://localhost:8080
```

### Cách 3: VS Code Live Server (Nhất Dễ)

```
1. Cài Extension "Live Server"
2. Chuột phải index.html
3. Chọn "Open with Live Server"
4. Tự động mở browser
```

## 🎮 Gameplay Hướng Dẫn

### Pha 1: NGÀY (60 giây)

```
☀️ NGÀY: Xây dựng & kiếm tiền
- Không có zombie
- Nhấp nút để xây dựng
- Hoặc nhấp canvas để đặt building
```

**Các Loại Building:**

| Building | Chi Phí | Tác Dụng |
|----------|---------|---------|
| 🧱 Tường | 50💰 | Chắn zombie, có 30 HP |
| 🔫 Tháp | 100💰 | Bắn zombie gần nhất, damage 10 |
| 💵 Máy In | 80💰 | Sinh 25💰 mỗi 3 giây |

### Pha 2: ĐÊM (45 giây)

```
🌙 ĐÊM: Chống Zombie
- Zombie chạy từ phải sang trái
- Tháp pháo bắn tự động
- Tường rào chắn sát thương
- Giết zombie → +10💰
- HP pháo đài → 0 = GAME OVER
```

### Thu Tiền

```
💰 Tiền/Giây: 5💰
💰 Máy In: 25💰/3 giây
💰 Giết Zombie: 10💰/con
💰 Xem Quảng Cáo: x2 tiền
```

## 🔧 Phát Triển

### Cấu Trúc Dự Án

```
pokigame/
├── index.html              # Main entry
├── src/
│   ├── config.js          # Tất cả hằng số
│   ├── utils.js           # Hàm tiện ích
│   ├── poki-manager.js    # Poki SDK
│   ├── input-manager.js   # Input
│   ├── game-state.js      # Game Logic
│   ├── game-loop.js       # Loop
│   ├── main.js            # Khởi tạo
│   ├── entities/          # Game Objects
│   └── rendering/         # Canvas
```

### Thay Đổi Cấu Hình

Chỉnh `src/config.js`:

```javascript
// Thay đổi thời gian pha
DAY_DURATION: 60,      // Ngày 60 giây
NIGHT_DURATION: 45,    // Đêm 45 giây

// Thay đổi giá xây dựng
COST_WALL: 50,        // Tường 50 tiền
COST_TOWER: 100,      // Tháp 100 tiền
COST_MINTER: 80,      // Máy in 80 tiền

// Thay đổi sóng zombie
ZOMBIE_WAVES: [
    { count: 3, speed: 60 },   // Sóng 1: 3 con, speed 60
    { count: 5, speed: 70 },   // Sóng 2: 5 con, speed 70
    // ... thêm sóng
]
```

### Debug Console

Nhấp **F12** để mở DevTools

```javascript
// Xem logs
// Mở Console tab

// Kiểm tra LocalStorage
localStorage.getItem('fortress-defense-save')

// Test Poki SDK
window.PokiSDK  // undefined = offline (ok)
```

## ✅ Checklist Trước Ship

```
[ ] Game chạy ok
[ ] Không có console errors
[ ] Xây dựng hoạt động
[ ] Zombie spawn đêm
[ ] Tháp bắn tự động
[ ] Tiền tính toán đúng
[ ] Game over khi HP = 0
[ ] Xem ads x2 tiền
[ ] Auto-save hoạt động
[ ] Mobile responsive
[ ] < 30MB
```

## 📦 Build & Submit

### Tạo ZIP

```bash
# Run build script
build.bat

# Hoặc manual:
# 1. Copy pokigame/ → fortress-defense-submission/
# 2. Xóa .git, node_modules
# 3. Zip lại
# 4. Kiểm tra size < 30MB
```

### Nộp Poki

```
1. https://poki.com/dev
2. Create New Game
3. Upload fortress-defense-poki.zip
4. Entry point: index.html
5. Submit & Wait Review
```

## 🐛 Troubleshooting

### Game không load

```
❌ Vấn đề: Canvas trống
✅ Giải pháp:
   1. Mở F12 Console
   2. Kiểm tra errors
   3. Kiểm tra tất cả file src load
   4. Reload page
```

### Tháp không bắn

```
❌ Vấn đề: Tháp không bắn zombie
✅ Giải pháp:
   1. Kiểm tra zombie spawn
   2. Kiểm tra tháp được xây
   3. Kiểm tra tháp trong tầm
   4. Check console log
```

### Tiền không tăng

```
❌ Vấn đề: Money không tăng
✅ Giải pháp:
   1. Kiểm tra game running
   2. Kiểm tra phase là DAY
   3. Kiểm tra machines spawn
   4. Check game loop update
```

## 💡 Tips & Tricks

### Testing Tips

```javascript
// F12 Console: Test nhanh
GameState.money += 1000          // Thêm tiền
GameState.fortressHP -= 50       // Test damage
GameState.currentWave = 10       // Bỏ qua sóng
GameState.spawnZombies(0)        // Spawn zombie ngay
```

### Performance

```javascript
// Check FPS
// F12 → Performance tab
// Record 5 giây
// Xem FPS graph
```

## 🎓 Learning Path

Nếu bạn muốn học phát triển:

1. **Đọc config.js** - Hiểu constants
2. **Đọc game-state.js** - Hiểu logic game
3. **Đọc entities/** - Hiểu các object
4. **Đọc renderer.js** - Hiểu vẽ
5. **Modify + Test** - Thử thay đổi

## 📚 Tài Liệu

- [README.md](./README.md) - Tổng quan
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Chi tiết deploy
- [Poki Docs](https://poki.com/en/dev/docs)

---

**Ready to ship!** 🚀

Next step: [DEPLOYMENT.md](./DEPLOYMENT.md)
