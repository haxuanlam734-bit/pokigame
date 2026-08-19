/**
 * TIME-CYCLE-CONTROLLER.JS - Hệ thống quản lý chu kỳ ngày/đêm
 * Trung tâm điều khiển thời gian, phase, và event system
 */

const TimeCycle = {
    cycleTime: 0,
    currentPhase: CONFIG.PHASE_DAY,
    previousPhase: null,
    phaseStartTime: 0,
    phaseTimeRemaining: CONFIG.DAY_DURATION,
    timeScale: CONFIG.TIME_SCALE,
    isRunning: false,
    _listeners: [],
    _lastFrameTime: 0,

    PHASE_DURATIONS: null,

    init: function() {
        this.PHASE_DURATIONS = {
            [CONFIG.PHASE_DAY]: CONFIG.DAY_DURATION,
            [CONFIG.PHASE_SUNSET]: CONFIG.SUNSET_DURATION,
            [CONFIG.PHASE_NIGHT]: CONFIG.NIGHT_DURATION,
            [CONFIG.PHASE_DAWN]: CONFIG.DAWN_DURATION
        };
        this.currentPhase = CONFIG.PHASE_DAY;
        this.phaseStartTime = 0;
        this.phaseTimeRemaining = CONFIG.DAY_DURATION;
        this.cycleTime = 0;
        this.timeScale = CONFIG.TIME_SCALE;
        this.isRunning = true;
        this._listeners = [];
        this._lastFrameTime = 0;
        console.log('⏰ TimeCycle Controller khởi tạo - Chu kỳ 16 phút');
        this._logPhase('DAY');
    },

    update: function(deltaTimeMs) {
        if (!this.isRunning) return;

        const dt = (deltaTimeMs / 1000) * this.timeScale;
        this.cycleTime += dt;
        this.phaseTimeRemaining -= dt;

        if (this.phaseTimeRemaining <= 0) {
            this._advancePhase();
        }
    },

    _advancePhase: function() {
        const phases = [CONFIG.PHASE_DAY, CONFIG.PHASE_SUNSET, CONFIG.PHASE_NIGHT, CONFIG.PHASE_DAWN];
        const currentIndex = phases.indexOf(this.currentPhase);
        const nextIndex = (currentIndex + 1) % phases.length;
        const nextPhase = phases[nextIndex];

        const overflow = -this.phaseTimeRemaining;
        const oldPhase = this.currentPhase;
        this.currentPhase = nextPhase;
        this.phaseStartTime = this.cycleTime;
        this.phaseTimeRemaining = this.PHASE_DURATIONS[nextPhase] - overflow;

        if (this.cycleTime >= CONFIG.TOTAL_CYCLE_DURATION) {
            this.cycleTime = this.cycleTime % CONFIG.TOTAL_CYCLE_DURATION;
        }

        this.previousPhase = oldPhase;
        this._emitPhaseChanged(oldPhase, nextPhase);
        this._logPhase(nextPhase.toUpperCase());
    },

    _logPhase: function(phaseName) {
        if (!CONFIG.DEBUG_MODE) return;
        console.log('[' + phaseName + '] Started | Cycle: ' + this._formatTime(this.cycleTime) + ' | Remaining: ' + this._formatTime(this.phaseTimeRemaining));
    },

    _emitPhaseChanged: function(oldPhase, newPhase) {
        for (let i = 0; i < this._listeners.length; i++) {
            try {
                this._listeners[i](oldPhase, newPhase);
            } catch (e) {
                console.error('Lỗi trong phase listener:', e);
            }
        }
    },

    onPhaseChanged: function(callback) {
        if (typeof callback === 'function') {
            this._listeners.push(callback);
        }
        return this;
    },

    removePhaseListener: function(callback) {
        this._listeners = this._listeners.filter(fn => fn !== callback);
        return this;
    },

    getPhaseInfo: function() {
        return {
            currentPhase: this.currentPhase,
            previousPhase: this.previousPhase,
            cycleTime: this.cycleTime,
            phaseTimeRemaining: Math.max(0, this.phaseTimeRemaining),
            phaseProgress: 1 - Math.max(0, this.phaseTimeRemaining) / this.PHASE_DURATIONS[this.currentPhase],
            totalCycleDuration: CONFIG.TOTAL_CYCLE_DURATION,
            timeScale: this.timeScale
        };
    },

    getTimeUntilPhase: function(targetPhase) {
        const phases = [CONFIG.PHASE_DAY, CONFIG.PHASE_SUNSET, CONFIG.PHASE_NIGHT, CONFIG.PHASE_DAWN];
        const currentIndex = phases.indexOf(this.currentPhase);
        const targetIndex = phases.indexOf(targetPhase);

        if (targetIndex === -1) return 0;

        let timeUntil = 0;
        if (targetIndex > currentIndex) {
            timeUntil = this.phaseTimeRemaining;
            for (let i = currentIndex + 1; i < targetIndex; i++) {
                timeUntil += this.PHASE_DURATIONS[phases[i]];
            }
        } else if (targetIndex < currentIndex) {
            timeUntil = this.phaseTimeRemaining;
            for (let i = currentIndex + 1; i < phases.length; i++) {
                timeUntil += this.PHASE_DURATIONS[phases[i]];
            }
            for (let i = 0; i < targetIndex; i++) {
                timeUntil += this.PHASE_DURATIONS[phases[i]];
            }
        } else {
            timeUntil = this.PHASE_DURATIONS[targetPhase];
        }

        return Math.max(0, timeUntil);
    },

    forcePhase: function(phase) {
        const validPhases = [CONFIG.PHASE_DAY, CONFIG.PHASE_SUNSET, CONFIG.PHASE_NIGHT, CONFIG.PHASE_DAWN];
        if (!validPhases.includes(phase)) {
            console.warn('Phase không hợp lệ:', phase);
            return this;
        }

        const oldPhase = this.currentPhase;
        this.currentPhase = phase;
        this.phaseStartTime = this.cycleTime;
        this.phaseTimeRemaining = this.PHASE_DURATIONS[phase];
        this.previousPhase = oldPhase;
        this._emitPhaseChanged(oldPhase, phase);
        this._logPhase(phase.toUpperCase());
        return this;
    },

    setCycleTime: function(seconds) {
        const clamped = Math.max(0, seconds % CONFIG.TOTAL_CYCLE_DURATION);
        this.cycleTime = clamped;

        let elapsed = clamped;
        const phases = [CONFIG.PHASE_DAY, CONFIG.PHASE_SUNSET, CONFIG.PHASE_NIGHT, CONFIG.PHASE_DAWN];
        const durations = [CONFIG.DAY_DURATION, CONFIG.SUNSET_DURATION, CONFIG.NIGHT_DURATION, CONFIG.DAWN_DURATION];

        let phaseIndex = 0;
        let remaining = 0;

        for (let i = 0; i < phases.length; i++) {
            if (elapsed < durations[i]) {
                phaseIndex = i;
                remaining = durations[i] - elapsed;
                break;
            }
            elapsed -= durations[i];
            if (i === phases.length - 1) {
                phaseIndex = 0;
                remaining = durations[0];
            }
        }

        const oldPhase = this.currentPhase;
        this.currentPhase = phases[phaseIndex];
        this.phaseStartTime = this.cycleTime;
        this.phaseTimeRemaining = remaining;
        this.previousPhase = oldPhase;

        if (oldPhase !== this.currentPhase) {
            this._emitPhaseChanged(oldPhase, this.currentPhase);
        }
        this._logPhase(this.currentPhase.toUpperCase());
        return this;
    },

    setTimeScale: function(scale) {
        this.timeScale = Math.max(0.1, parseFloat(scale) || 1);
        console.log('⏱️ TimeScale đặt thành: ' + this.timeScale + 'x');
        return this;
    },

    reset: function() {
        this.cycleTime = 0;
        this.currentPhase = CONFIG.PHASE_DAY;
        this.previousPhase = null;
        this.phaseStartTime = 0;
        this.phaseTimeRemaining = CONFIG.DAY_DURATION;
        this.timeScale = CONFIG.TIME_SCALE;
        this._logPhase('DAY');
        return this;
    },

    _formatTime: function(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
    },

    getPhaseDisplayName: function() {
        const names = {
            [CONFIG.PHASE_DAY]: '☀️ NGÀY',
            [CONFIG.PHASE_SUNSET]: '🌇 SUNSET',
            [CONFIG.PHASE_NIGHT]: '🌙 ĐÊM',
            [CONFIG.PHASE_DAWN]: '🌅 DAWN'
        };
        return names[this.currentPhase] || this.currentPhase;
    },

    getPhaseIcon: function() {
        const icons = {
            [CONFIG.PHASE_DAY]: '☀️',
            [CONFIG.PHASE_SUNSET]: '🌇',
            [CONFIG.PHASE_NIGHT]: '🌙',
            [CONFIG.PHASE_DAWN]: '🌅'
        };
        return icons[this.currentPhase] || '';
    },

    debugForceDay: function() { return this.forcePhase(CONFIG.PHASE_DAY); },
    debugForceSunset: function() { return this.forcePhase(CONFIG.PHASE_SUNSET); },
    debugForceNight: function() { return this.forcePhase(CONFIG.PHASE_NIGHT); },
    debugForceDawn: function() { return this.forcePhase(CONFIG.PHASE_DAWN); },

    getDebugInfo: function() {
        const info = this.getPhaseInfo();
        return '[TIME CYCLE] Phase: ' + info.currentPhase.toUpperCase() +
               ' | CycleTime: ' + this._formatTime(info.cycleTime) +
               ' | Remaining: ' + this._formatTime(info.phaseTimeRemaining) +
               ' | Progress: ' + Math.round(info.phaseProgress * 100) + '%' +
               ' | TimeScale: ' + info.timeScale + 'x';
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = TimeCycle;
}
