# ✅ POKI SUBMISSION CHECKLIST

Danh sách kiểm tra hoàn chỉnh trước khi nộp game lên Poki.

## 📋 Pre-Submission (1-2 tuần trước)

### Game Development
- [ ] Core gameplay implemented (Day/Night phases)
- [ ] All entities working (Tower, Wall, Zombie, Minter)
- [ ] Score/reward system implemented
- [ ] Game over logic implemented
- [ ] Restart functionality working
- [ ] No critical bugs in console

### Technical Quality
- [ ] No console.error() or console.warn() that are actual errors
- [ ] Game runs smoothly (60 FPS target)
- [ ] No memory leaks after 30 min play
- [ ] All assets optimized (<50KB each if any)
- [ ] Code minified or commented cleanly
- [ ] index.html is valid HTML5

### Poki SDK Integration
- [ ] PokiSDK.init() called at startup
- [ ] PokiSDK.gameLoadingFinished() called after assets
- [ ] PokiSDK.gameplayStart() called when gameplay begins
- [ ] PokiSDK.gameplayStop() called on game over
- [ ] PokiSDK.rewardedBreak() integrated for ads
- [ ] Fallback behavior works offline

### Game Balance
- [ ] Starting money is sufficient (~500 coins)
- [ ] Building costs feel fair (50-100 coins)
- [ ] Money regeneration is balanced (5/sec + minters)
- [ ] Zombie difficulty increases gradually
- [ ] Game length is appropriate (2-5 min rounds)
- [ ] Winning/losing is challenging but possible

### User Experience
- [ ] UI buttons are clearly labeled
- [ ] Instructions clear (day=build, night=defend)
- [ ] Game over screen shows stats
- [ ] Restart button is obvious
- [ ] Loading screen shown at startup
- [ ] No lag or stuttering

### Mobile Optimization
- [ ] Game works on 375px width (mobile)
- [ ] Virtual joystick appears on touch devices
- [ ] All buttons tap-able on mobile
- [ ] No horizontal scroll
- [ ] Responsive UI scales properly
- [ ] Touch events work smoothly

### Browser Testing
- [ ] Chrome / Chromium ✅
- [ ] Firefox ✅
- [ ] Safari ✅
- [ ] Edge ✅
- [ ] Chrome Mobile ✅
- [ ] Safari iOS ✅

---

## 🎮 Game Testing (3-5 days before)

### Functional Testing

**Phase 1: Day Phase**
- [ ] Click "🧱 Tường" button → can place walls
- [ ] Click "🔫 Tháp" button → can place towers
- [ ] Click "💵 Máy In" button → can place miners
- [ ] Money increases over time
- [ ] Phase transitions to night after 60 seconds
- [ ] Phase bar counts down correctly

**Phase 2: Night Phase**
- [ ] Zombies spawn from right side
- [ ] Zombies move toward fortress (left)
- [ ] Towers auto-shoot at nearest zombie
- [ ] Towers rotate to face targets
- [ ] Walls block zombie damage
- [ ] Killed zombies drop money
- [ ] Fortress HP decreases when zombie reaches it
- [ ] Phase transitions to day after 45 seconds

**Game Over**
- [ ] Game ends when fortress HP = 0
- [ ] Game over screen appears
- [ ] Shows final stats (wave, money, score)
- [ ] Restart button works
- [ ] Game resets properly

### Save System Testing
- [ ] F12 → Application → LocalStorage
- [ ] Key "fortress-defense-save" exists
- [ ] Save data is valid JSON
- [ ] Contains: wave, money, fortressHP, timestamp
- [ ] Auto-save after each wave

### Ads Testing
- [ ] Click "📺 Xem QC" button
- [ ] Ads integration triggered
- [ ] Callback works (money x2)
- [ ] Game resumes after ad
- [ ] Offline fallback works

---

## 📦 Build & Package (1 week before)

### File Organization
- [ ] Delete .git directory
- [ ] Delete node_modules (if any)
- [ ] Delete temporary files (.tmp, .swp)
- [ ] Keep only necessary files
- [ ] Verify index.html exists
- [ ] Verify all src/*.js files exist
- [ ] No broken file references

### Size Check
- [ ] Total project < 30MB
- [ ] Actual size ~200KB (very safe)
- [ ] No large unoptimized images
- [ ] No large audio files
- [ ] No build artifacts

### ZIP Creation
- [ ] Use standard ZIP format
- [ ] Top-level: index.html (not in subfolder)
- [ ] Folder structure preserved
- [ ] Test unzip in new folder
- [ ] Verify structure after unzip
- [ ] File: fortress-defense-poki.zip

### Final Code Review
- [ ] No hardcoded API keys
- [ ] No personal information
- [ ] No console.log() spam (only important ones)
- [ ] No commented-out code (if too much)
- [ ] All function names are clear
- [ ] Variable names are meaningful
- [ ] No typos in comments

---

## 🌐 Poki Developer Setup (1 week before)

### Account Creation
- [ ] Email account created
- [ ] Email verified
- [ ] Developer profile filled
- [ ] Payment info added (optional for initial submission)

### Game Profile
- [ ] Game name: "Pháo Đài Chống Zombie" or "Fortress Defense"
- [ ] Slug: "fortress-defense-zombie" (lowercase)
- [ ] Category: Strategy or Tower Defense
- [ ] Short description written
- [ ] Tags: tower-defense, strategy, zombie
- [ ] Thumbnail/icon prepared (if required)

### Dashboard Access
- [ ] Can login to Poki dev dashboard
- [ ] Can see "Create New Game" button
- [ ] Can navigate to Build/Upload section
- [ ] Understand Poki dashboard layout

---

## 📤 Submission Process (Day of submission)

### Upload
- [ ] ZIP file ready: fortress-defense-poki.zip
- [ ] Login to Poki dev dashboard
- [ ] Click "Create New Game" or "Upload Build"
- [ ] Fill in game information
- [ ] Select ZIP file
- [ ] Verify file before upload
- [ ] Click "Upload"
- [ ] Wait for processing (usually 5-10 min)

### Staging Build
- [ ] Staging URL provided by Poki
- [ ] Test on staging URL
- [ ] Play through 2-3 rounds
- [ ] Verify all features work
- [ ] Check Poki SDK integration
- [ ] Test ads functionality
- [ ] Verify mobile responsiveness
- [ ] Check for console errors
- [ ] Document any issues

### Poki SDK Verification
Poki will automatically check:
- [ ] ✅ PokiSDK.init() present
- [ ] ✅ gameLoadingFinished() present
- [ ] ✅ gameplayStart() present
- [ ] ✅ gameplayStop() present
- [ ] ✅ rewardedBreak() present
- [ ] ✅ SDK version v2

### Issue Resolution
If issues found:
- [ ] Fix issues locally
- [ ] Rebuild ZIP
- [ ] Reupload to staging
- [ ] Retest all features
- [ ] Report back to Poki support

---

## ✨ Quality Gate (Before Going Live)

### Gameplay Quality
- [ ] Game is fun to play (subjective but important)
- [ ] Difficulty feels balanced
- [ ] No unfair deaths or mechanics
- [ ] Progression feels rewarding
- [ ] Wins/losses are satisfying

### Technical Requirements
- [ ] Zero critical bugs
- [ ] No console errors
- [ ] Stable 60 FPS
- [ ] Quick load time (< 2 sec)
- [ ] Responsive controls
- [ ] Save works properly

### Compliance
- [ ] No NSFW content
- [ ] No hate speech or discrimination
- [ ] No illegal content
- [ ] No excessive violence
- [ ] Follows Poki community guidelines
- [ ] Age rating appropriate (18+? E10+?)

### Documentation
- [ ] README.md explains game
- [ ] Instructions clear in-game
- [ ] Controls explained
- [ ] No unexplained mechanics

---

## 🎉 Post-Submission

### Waiting Period
- [ ] Game submitted for review
- [ ] Typical review time: 1-2 weeks
- [ ] Poki may request changes
- [ ] Be responsive to feedback

### If Approved
- [ ] Game set to live
- [ ] Monitor first 24 hours
- [ ] Check analytics dashboard
- [ ] Monitor player feedback
- [ ] Respond to comments

### If Rejected
- [ ] Read Poki feedback carefully
- [ ] Fix issues mentioned
- [ ] Resubmit corrected version
- [ ] Usually 2-3 iteration cycles needed

---

## 📊 Launch Monitoring (First Month)

### Week 1: Soft Launch
- [ ] Players: Monitor daily active users
- [ ] Stability: No crash reports
- [ ] Feedback: Read player comments
- [ ] Issues: Fix any critical bugs quickly
- [ ] Performance: Check server load

### Week 2-4: Post-Launch
- [ ] Retention: Track DAU / WAU
- [ ] Engagement: Monitor session length
- [ ] Monetization: Track ad revenue
- [ ] Quality: Maintain 4.0+ rating
- [ ] Updates: Plan bug fix updates

---

## 🔄 Update Cycle

### When to Update
- [ ] Critical bugs (game-breaking)
- [ ] Major balance issues
- [ ] Poki SDK updates
- [ ] Security patches

### Update Process
1. Fix issue locally
2. Thoroughly test
3. Rebuild ZIP
4. Reupload to Poki staging
5. Request update
6. Poki quick-reviews (1-2 days)
7. Goes live

---

## 📞 Support Contacts

### Poki Support
- Email: support@poki.com
- Discord: https://discord.gg/poki
- Docs: https://poki.com/en/dev/docs

### Documentation
- Poki SDK Docs: https://poki.com/en/dev/docs/sdk
- HTML5 Reference: MDN Web Docs
- GitHub Issues: Your repo

---

## ✅ Final Checklist

### Before Upload
```
[ ] Game tested 5+ times
[ ] No console errors
[ ] Poki SDK working
[ ] Mobile responsive
[ ] All 3 building types work
[ ] Zombies spawn correctly
[ ] Towers shoot
[ ] Game over works
[ ] Restart works
[ ] Ads work
[ ] Save works
[ ] File size OK
[ ] ZIP created
```

### Before Submission
```
[ ] Developer account ready
[ ] Game info filled accurately
[ ] ZIP file valid
[ ] Tested on local server
[ ] All URLs correct
[ ] index.html is entry point
[ ] No broken links
[ ] Ready to upload
```

### After Submission
```
[ ] Staging build tested
[ ] All features verified
[ ] No issues found
[ ] Ready for review
[ ] Monitoring setup
[ ] Update plan ready
```

---

**Last Updated:** 2024-08-14

**Status:** ✅ READY FOR POKI SUBMISSION

Next: See [DEPLOYMENT.md](./DEPLOYMENT.md) for step-by-step guide
