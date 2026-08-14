/**
 * POKI-MANAGER.JS - Quản lý tích hợp Poki SDK
 * Xử lý tất cả các hàm Poki SDK bắt buộc
 */

const PokiManager = {
    /**
     * Khởi tạo Poki SDK
     * Gọi lần đầu tiên khi game khởi động
     */
    init: function() {
        console.log('🎮 Khởi tạo Poki SDK...');
        
        // Kiểm tra nếu PokiSDK có sẵn
        if (typeof PokiSDK === 'undefined') {
            console.warn('⚠️ Poki SDK không được tải. Game vẫn chạy ở chế độ offline.');
            return;
        }
        
        try {
            // Gọi PokiSDK.init()
            PokiSDK.init();
            console.log('✅ Poki SDK đã khởi tạo thành công');
        } catch (e) {
            console.error('❌ Lỗi khởi tạo Poki SDK:', e);
        }
    },

    /**
     * Báo cho Poki biết game đã tải xong
     * Ẩn màn hình tải của Poki
     */
    gameLoadingFinished: function() {
        console.log('🎮 Game tải xong, báo Poki...');
        
        if (typeof PokiSDK === 'undefined') {
            return;
        }
        
        try {
            PokiSDK.gameLoadingFinished();
            console.log('✅ Poki được thông báo game tải xong');
        } catch (e) {
            console.error('❌ Lỗi gameLoadingFinished:', e);
        }
    },

    /**
     * Báo cho Poki rằng game đã bắt đầu
     * Tạm dừng các ads, bắt đầu tính thời gian chơi
     */
    gameplayStart: function() {
        console.log('▶️ Game bắt đầu, báo Poki...');
        
        if (typeof PokiSDK === 'undefined') {
            return;
        }
        
        try {
            PokiSDK.gameplayStart();
            console.log('✅ Poki được thông báo game bắt đầu');
        } catch (e) {
            console.error('❌ Lỗi gameplayStart:', e);
        }
    },

    /**
     * Báo cho Poki rằng game đã dừng
     * Cho phép hiển thị ads giữa các lần chơi
     */
    gameplayStop: function() {
        console.log('⏸️ Game dừng, báo Poki...');
        
        if (typeof PokiSDK === 'undefined') {
            return;
        }
        
        try {
            PokiSDK.gameplayStop();
            console.log('✅ Poki được thông báo game dừng');
        } catch (e) {
            console.error('❌ Lỗi gameplayStop:', e);
        }
    },

    /**
     * Yêu cầu hiển thị quảng cáo có điều kiện
     * Player xem ads để nhận phần thưởng
     * @param {Function} onSuccess - Callback khi ads hoàn tất
     * @param {Function} onError - Callback khi ads bị đóng/lỗi
     */
    rewardedBreak: function(onSuccess, onError) {
        console.log('📺 Yêu cầu hiển thị quảng cáo có phần thưởng...');
        
        if (typeof PokiSDK === 'undefined') {
            console.warn('⚠️ Poki SDK không khả dụng, bỏ qua ads');
            if (onSuccess) onSuccess();
            return;
        }
        
        try {
            PokiSDK.rewardedBreak(onSuccess, onError);
            console.log('✅ Đã yêu cầu hiển thị quảng cáo');
        } catch (e) {
            console.error('❌ Lỗi rewardedBreak:', e);
            if (onError) onError();
        }
    },

    /**
     * Yêu cầu hiển thị quảng cáo thường (midroll)
     * Hiển thị giữa các level
     * @param {Function} onFinish - Callback khi ads kết thúc
     */
    midrollBreak: function(onFinish) {
        console.log('📺 Yêu cầu hiển thị quảng cáo midroll...');
        
        if (typeof PokiSDK === 'undefined') {
            console.warn('⚠️ Poki SDK không khả dụng, bỏ qua ads');
            if (onFinish) onFinish();
            return;
        }
        
        try {
            PokiSDK.commercialBreak(onFinish);
            console.log('✅ Đã yêu cầu hiển thị quảng cáo midroll');
        } catch (e) {
            console.error('❌ Lỗi midrollBreak:', e);
            if (onFinish) onFinish();
        }
    },

    /**
     * Kiểm tra nếu Poki SDK có sẵn
     * @returns {boolean} Poki SDK có khả dụng?
     */
    isAvailable: function() {
        return typeof PokiSDK !== 'undefined';
    }
};

// Xuất PokiManager
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PokiManager;
}
