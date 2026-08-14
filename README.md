# 🏰 Pháo Đài Chống Zombie - Fortress Defense Tower Defense Game

**Tựa game:** Pháo Đài Chống Zombie (Fortress Defense)
**Nền tảng:** Poki Gaming Platform
**Thể loại:** Tower Defense / Strategy
**Kích thước:** < 30MB (ready for Poki submission)

## 📋 Mục Lục

- [Tổng Quan](#tổng-quan)
- [Cấu Trúc Thư Mục](#cấu-trúc-thư-mục)
- [Cài Đặt & Chạy](#cài-đặt--chạy)
- [Gameplay](#gameplay)
- [Tích Hợp Poki SDK](#tích-hợp-poki-sdk)
- [Build & Deploy](#build--deploy)

## 🎮 Tổng Quan

Pháo Đài Chống Zombie là một game Tower Defense cổ điển với cơ chế:
- **Ngày (Build Phase):** Xây dựng tháp pháo, tường rào, máy in tiền
- **Đêm (Wave Phase):** Chống lại các sóng zombie tấn công

### Tính Năng Chính
✅ Hệ thống xây dựng động (Tower, Wall, Money Minter)
✅ AI zombie tự động tấn công pháo đài
✅ Hệ thống tài nguyên và kinh tế
✅ Tích hợp Poki SDK đầy đủ
✅ Hỗ trợ đa nền tảng (Desktop + Mobile)
✅ Auto-save vào LocalStorage
✅ Responsive UI với WASD + Virtual Joystick

## 📁 Cấu Trúc Thư Mục

```
pokigame/
├── index.html                 # File HTML chính
├── README.md                  # Tài liệu này
├── .gitignore                 # Git ignore file
├── src/
│   ├── config.js             # ⚙️ Cấu hình
│   ├── utils.js              # 🛠️ Utilities
│   ├── poki-manager.js       # 🎮 Poki SDK
│   ├── input-manager.js      # ⌨️ Input
│   ├── game-state.js         # 📊 Game State
│   ├── game-loop.js          # ▶️ Game Loop
│   ├── main.js               # 🚀 Entry Point
│   ├── entities/
│   │   ├── tower.js          # 🔫 Tower
│   │   ├── wall.js           # 🧱 Wall
│   │   ├── zombie.js         # 🧟 Zombie
│   │   └── minter.js         # 💵 Money Minter
│   └── rendering/
│       └── renderer.js       # 🎨 Canvas Rendering
```

## ⚙️ Cài Đặt & Chạy

### Chạy Local
```bash
# Python 3
cd pokigame && python -m http.server 8000

# Node.js
http-server

# Truy cập: http://localhost:8000
```

## 🎮 Gameplay

**Pha NGÀY (60s):** Xây dựng + kiếm tiền
**Pha ĐÊM (45s):** Chống zombie waves

**Xây dựng:**
- 🧱 Tường (50💰) - Chắn zombie
- 🔫 Tháp (100💰) - Bắn tự động
- 💵 Máy in (80💰) - Sinh tiền

**Hệ Thống:**
- Tiền tự sinh: 5💰/s
- Giết zombie: 10💰/con
- Xem ads: x2 tiền (via Poki)

## 🎮 Poki SDK Integration

✅ `PokiSDK.init()` - Khởi tạo
✅ `PokiSDK.gameLoadingFinished()` - Báo tải xong
✅ `PokiSDK.gameplayStart()` / `gameplayStop()` - Control gameplay
✅ `PokiSDK.rewardedBreak()` - Quảng cáo x2 tiền
✅ Auto-save vào LocalStorage

## 🚀 Build & Deploy Poki

```bash
# Tạo ZIP < 30MB
zip -r fortress-defense.zip pokigame/

# Upload lên Poki Developer Dashboard
# Entry Point: index.html
```

### Checklist Poki
- [x] Poki SDK integrated
- [x] gameLoadingFinished() called
- [x] gameplayStart/Stop implemented
- [x] rewardedBreak() for ads
- [x] Auto-save working
- [x] Mobile responsive
- [x] < 30MB size

## 📱 Mobile

- Virtual Joystick (auto-show on mobile)
- Touch-friendly buttons
- Responsive layout

## 🐛 Debug

```javascript
// Check LocalStorage
localStorage.getItem('fortress-defense-save')

// Check Console (F12)
```

---
**Version:** 1.0.0 | **Last Updated:** 2024-08-14