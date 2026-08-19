/**
 * AUDIO-CONTROLLER.JS - Hệ thống âm thanh theo phase
 * Quản lý ambience và transition âm thanh giữa các phase
 */

const AudioController = {
    _currentAmbience: null,
    _currentVolume: 0,
    _targetVolume: 0,
    _fadeStartTime: 0,
    _fadeDuration: 0,
    _isFading: false,
    _audioContext: null,
    _gainNode: null,
    _oscillator: null,

    init: function() {
        this._currentAmbience = null;
        this._currentVolume = 0;
        this._targetVolume = 0;
        this._isFading = false;

        try {
            this._audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this._gainNode = this._audioContext.createGain();
            this._gainNode.connect(this._audioContext.destination);
            this._gainNode.gain.value = 0;
            console.log('🔊 Audio Controller đã khởi tạo');
        } catch (e) {
            console.warn('Không thể khởi tạo Web Audio API:', e);
        }
    },

    onPhaseChanged: function(oldPhase, newPhase) {
        const newConfig = CONFIG.AUDIO[newPhase] || CONFIG.AUDIO.day;
        this._crossfadeAmbience(newConfig.ambience, newConfig.volume, newConfig.fadeTime);
    },

    _crossfadeAmbience: function(ambienceName, targetVolume, fadeTime) {
        this._targetVolume = targetVolume || 0.5;
        this._fadeStartTime = performance.now();
        this._fadeDuration = fadeTime || 2.0;
        this._isFading = true;
        this._currentAmbience = ambienceName;

        if (CONFIG.DEBUG_MODE) {
            console.log('🔊 Audio crossfade -> ' + ambienceName + ' @ ' + this._targetVolume);
        }
    },

    update: function() {
        if (!this._isFading) return;

        const elapsed = (performance.now() - this._fadeStartTime) / 1000;
        const t = Math.min(1, elapsed / this._fadeDuration);

        const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        const volume = eased * this._targetVolume;

        if (this._gainNode) {
            this._gainNode.gain.value = volume;
        }

        if (t >= 1) {
            this._isFading = false;
            this._currentVolume = this._targetVolume;
        }
    },

    playTransitionSound: function(phase) {
        if (!this._audioContext || this._audioContext.state === 'suspended') return;

        try {
            const osc = this._audioContext.createOscillator();
            const gain = this._audioContext.createGain();
            osc.connect(gain);
            gain.connect(this._audioContext.destination);

            const now = this._audioContext.currentTime;
            osc.frequency.setValueAtTime(phase === CONFIG.PHASE_NIGHT ? 80 : 200, now);
            osc.type = 'sine';
            gain.gain.setValueAtTime(0.03, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
            osc.start(now);
            osc.stop(now + 0.5);
        } catch (e) {
            console.warn('Không thể phát transition sound:', e);
        }
    },

    resume: function() {
        if (this._audioContext && this._audioContext.state === 'suspended') {
            this._audioContext.resume();
        }
    },

    suspend: function() {
        if (this._audioContext && this._audioContext.state === 'running') {
            this._audioContext.suspend();
        }
    },

    getCurrentAmbience: function() {
        return this._currentAmbience;
    },

    getCurrentVolume: function() {
        return this._currentVolume;
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = AudioController;
}
