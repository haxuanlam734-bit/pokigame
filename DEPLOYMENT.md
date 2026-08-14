# 🚀 HƯỚNG DẪN DEPLOY LÊN POKI

Tài liệu chi tiết về cách nộp game **Pháo Đài Chống Zombie** lên Poki Platform.

## 📋 Checklist Trước Deploy

Trước khi nộp, hãy đảm bảo tất cả những điều sau:

### ✅ Kiểm Tra Kỹ Thuật

```bash
# 1. Kiểm tra kích thước file
du -sh pokigame/
# → Phải < 30MB (hiện tại ~200KB)

# 2. Kiểm tra index.html tồn tại
ls -la pokigame/index.html

# 3. Kiểm tra tất cả file src/
ls -la pokigame/src/

# 4. Đảm bảo không có file tạm
find pokigame/ -name "*.tmp" -o -name "*.swp"
```

### ✅ Kiểm Tra Game

- [ ] Game chạy tốt ở localhost
- [ ] Không có lỗi JavaScript (F12 Console)
- [ ] Poki SDK được load (kiểm tra Network tab)
- [ ] Build hoạt động
- [ ] Tường rào tạo được
- [ ] Tháp pháo bắn được
- [ ] Máy in tiền sinh tiền
- [ ] Zombie spawn đêm
- [ ] Game Over khi pháo đài HP = 0
- [ ] Xem quảng cáo x2 tiền
- [ ] Auto-save hoạt động

### ✅ Kiểm Tra Mobile

- [ ] Hiển thị trên mobile (screen 375px)
- [ ] Virtual Joystick xuất hiện
- [ ] Buttons có thể bấm
- [ ] Không có scroll ngang

## 📦 Bước 1: Chuẩn Bị ZIP File

### Tạo Folder Deploy

```bash
# Windows PowerShell
mkdir fortress-defense-submission
Copy-Item pokigame/* fortress-defense-submission -Recurse

# macOS/Linux
mkdir fortress-defense-submission
cp -r pokigame/* fortress-defense-submission/
```

### Xóa File Không Cần

```bash
# Windows PowerShell
Remove-Item fortress-defense-submission/.git -Recurse -Force
Remove-Item fortress-defense-submission/node_modules -Recurse -Force
Remove-Item fortress-defense-submission/.gitignore

# macOS/Linux
rm -rf fortress-defense-submission/.git
rm -rf fortress-defense-submission/node_modules
rm fortress-defense-submission/.gitignore
```

### Tạo ZIP

```bash
# Windows PowerShell
Compress-Archive -Path fortress-defense-submission -DestinationPath fortress-defense-poki.zip

# macOS/Linux
zip -r fortress-defense-poki.zip fortress-defense-submission/

# Kiểm tra kích thước
ls -lh fortress-defense-poki.zip
# → Phải < 30MB
```

## 🎮 Bước 2: Tạo Tài Khoản Developer Poki

1. Truy cập: **https://poki.com/en/dev**
2. Nhấp "Sign Up" hoặc "Log In"
3. Điền thông tin cá nhân
4. Xác thực email
5. Điền thông tin developer

## 📝 Bước 3: Tạo Dự Án Game

### Dashboard Poki

```
1. Login vào https://poki.com/dev
2. Dashboard → "Create New Game"
3. Điền thông tin:
```

### Thông Tin Game

| Trường | Giá Trị |
|--------|---------|
| **Game Name** | Pháo Đài Chống Zombie |
| **Slug** | fortress-defense-zombie (lowercase, no spaces) |
| **Description** | Tower Defense game với Zombie waves. Xây tháp, tường, bảo vệ pháo đài từ những sóng zombie. |
| **Category** | Strategy / Tower Defense |
| **Tags** | tower-defense, zombie, strategy |
| **Release Date** | (để sau hoặc chọn ngày) |

## 📤 Bước 4: Upload Game

### Upload ZIP

```
1. Vào Dashboard Game của bạn
2. Tab "Build" hoặc "Upload"
3. Chọn "Upload Build"
4. Chọn file: fortress-defense-poki.zip
5. Nhấp "Upload"
6. Chờ processing...
```

### Entry Point

```
Poki sẽ hỏi:
- Entry Point: index.html ✅
- Keep Default Settings
```

## ✅ Bước 5: Poki SDK Verification

Poki sẽ tự động kiểm tra:

### Bắt Buộc Phải Có

```javascript
✅ PokiSDK.init()                    // Khởi tạo
✅ PokiSDK.gameLoadingFinished()     // Báo tải xong
✅ PokiSDK.gameplayStart()           // Bắt đầu gameplay
✅ PokiSDK.gameplayStop()            // Dừng gameplay
✅ PokiSDK.rewardedBreak()           // Ads có phần thưởng
```

### Xác Nhận Trong Game

Poki dashboard sẽ show:
- ✅ SDK Version: v2
- ✅ Ads Integration: IMPLEMENTED
- ✅ Auto-save: IMPLEMENTED
- ✅ Analytics: READY

## 🧪 Bước 6: Test Trên Staging

### Play Staging Build

```
1. Poki tạo staging build
2. URL: https://poki.com/games/fortress-defense-zombie?utm_source=staging
3. Test tất cả tính năng:
```

### Test Checklist

- [ ] Game load xong (loading screen ẩn)
- [ ] Canvas hiển thị tốt
- [ ] Buttons hoạt động
- [ ] Xây dựng hoạt động
- [ ] Zombie spawn
- [ ] Bắn hoạt động
- [ ] Tiền tăng
- [ ] Sóng chuyển đổi
- [ ] Game over hoạt động
- [ ] Restart hoạt động
- [ ] Ads button clickable

## 🚀 Bước 7: Phát Hành (Release)

### Submit to Review

```
1. Khi staging test OK
2. Tab "Release"
3. Nhấp "Submit for Review"
4. Poki team review (1-2 tuần)
```

### Poki Review Criteria

Poki sẽ kiểm tra:
- ✅ Game không có lỗi
- ✅ Poki SDK được gọi đúng
- ✅ Ads hoạt động
- ✅ Không vi phạm policy (18+, bạo lực, v.v.)
- ✅ Tập 18+ tuổi trở lên
- ✅ Thời gian chơi > 2 phút

## 🎉 Bước 8: LIVE!

Khi được duyệt:

```
✅ Game live trên Poki
📊 URL: https://poki.com/en/g/fortress-defense-zombie
📈 Xem stats, players, revenue
💰 Kiếm tiền từ ads
```

## 📊 Monitoring

### Poki Analytics

```
Dashboard → Analytics
- Plays / Day
- Players
- Retention
- Revenue
- Ads Watched
```

### Revenue

- Poki giữ 30-50%
- Bạn nhận 50-70% từ ads
- Thanh toán hàng tháng

## 🐛 Troubleshooting

### Game không load

```
❌ Problem: Canvas không hiển thị
✅ Solution:
   1. Kiểm tra F12 Console
   2. Kiểm tra index.html syntax
   3. Kiểm tra tất cả file src load ok
   4. Reload page (Ctrl+R)
```

### Poki SDK không được phát hiện

```
❌ Problem: PokiSDK undefined
✅ Solution:
   1. Kiểm tra <script> tag tại bottom index.html
   2. Đảm bảo cdn.poki.com không bị block
   3. Kiểm tra Network tab (F12)
   4. Thử offline mode
```

### Ads không hiện

```
❌ Problem: rewardedBreak() không làm gì
✅ Solution:
   1. Chắc chắn khi offline fallback hoạt động
   2. Kiểm tra console log
   3. Poki staging có thể không enable ads
   4. Live version sẽ có real ads
```

### Game quá chậm

```
❌ Problem: FPS < 30
✅ Solution:
   1. Giảm số zombie sinh
   2. Optimize rendering
   3. Giảm effect/particles
   4. Profile với DevTools (F12 → Performance)
```

## 📞 Support

### Nếu Có Vấn Đề

```
📧 Email: support@poki.com
💬 Discord: https://discord.gg/poki
📖 Docs: https://poki.com/en/dev/docs
```

## 🎯 Tiếp Theo

### Sau Khi Live

1. **Monitor Analytics:** Xem players, retention
2. **Gather Feedback:** Nghe feedback từ players
3. **Update & Fix:** Bug fixes, improvements
4. **New Features:** Thêm content (6-12 tháng sau)
5. **Cross-Promotion:** Quảng cáo game khác

### Update Game

```
1. Push update từ Dashboard
2. Poki review nhanh (1-2 ngày)
3. Live update trên platform
```

---

## ✨ Final Checklist

```
PRE-SUBMISSION
[ ] Game plays 5 min + without crashing
[ ] No console errors
[ ] Poki SDK all functions working
[ ] File size < 30MB
[ ] index.html is main entry point
[ ] Mobile responsive
[ ] All buttons clickable
[ ] Auto-save working

SUBMISSION
[ ] ZIP file created correctly
[ ] Developer account created
[ ] Game details filled accurately
[ ] ZIP uploaded successfully
[ ] Staging build tested
[ ] Ready for review

POST-SUBMISSION
[ ] Review approved
[ ] Live on Poki
[ ] Analytics monitored
[ ] Revenue tracked
```

---

**Last Updated:** 2024-08-14
**Poki SDK Version:** v2
**Game Version:** 1.0.0
