/**
 * ADMIN-PANEL.JS - Admin Control Panel with 2-layer security
 * Layer 1: Keyword (InputManager._appendCheatChar)
 * Layer 2: Password panel
 */

const AdminPanel = {
    isOpen: false,
    securityModalOpen: false,

    els: {},

    init: function() {
        this.cacheElements();
        this.bindEvents();
        this.updateButtonVisibility();
    },

    cacheElements: function() {
        this.els.adminBtn = document.getElementById('admin-btn');
        this.els.securityModal = document.getElementById('admin-security-modal');
        this.els.adminPanel = document.getElementById('admin-panel');
        this.els.passwordInput = document.getElementById('admin-password-input');
        this.els.pwToggleVis = document.getElementById('admin-pw-toggle-vis');
        this.els.errorMsg = document.getElementById('admin-error-msg');
        this.els.unlockBtn = document.getElementById('admin-unlock-btn');
        this.els.cancelBtn = document.getElementById('admin-cancel-btn');
        this.els.secCloseBtn = document.getElementById('admin-sec-close');
        this.els.panelCloseBtn = document.getElementById('admin-panel-close');

        this.els.toggleMoney = document.getElementById('admin-toggle-money');
        this.els.toggleHealth = document.getElementById('admin-toggle-health');
        this.els.toggleStamina = document.getElementById('admin-toggle-stamina');
        this.els.toggleAmmo = document.getElementById('admin-toggle-ammo');
        this.els.toggleGod = document.getElementById('admin-toggle-god');
        this.els.toggleFly = document.getElementById('admin-toggle-fly');

        this.els.phaseDay = document.getElementById('admin-phase-day');
        this.els.phaseSunset = document.getElementById('admin-phase-sunset');
        this.els.phaseNight = document.getElementById('admin-phase-night');
        this.els.phaseDawn = document.getElementById('admin-phase-dawn');

        this.els.scale01 = document.getElementById('admin-scale-0.1');
        this.els.scale05 = document.getElementById('admin-scale-0.5');
        this.els.scale1 = document.getElementById('admin-scale-1');
        this.els.scale2 = document.getElementById('admin-scale-2');
        this.els.scale5 = document.getElementById('admin-scale-5');
        this.els.scale10 = document.getElementById('admin-scale-10');

        this.els.currentPhase = document.getElementById('admin-current-phase');
        this.els.currentTime = document.getElementById('admin-current-time');
        this.els.timeRemaining = document.getElementById('admin-time-remaining');
        this.els.cycleTime = document.getElementById('admin-cycle-time');

        this.els.flyIndicator = document.getElementById('fly-indicator');
    },

    bindEvents: function() {
        if (this.els.adminBtn) {
            this.els.adminBtn.addEventListener('click', () => {
                if (typeof GameState !== 'undefined' && GameState.isAdmin) {
                    this.showSecurityModal();
                }
            });
        }

        if (this.els.unlockBtn) {
            this.els.unlockBtn.addEventListener('click', () => this.submitPassword());
        }
        if (this.els.cancelBtn) {
            this.els.cancelBtn.addEventListener('click', () => this.hideSecurityModal());
        }
        if (this.els.secCloseBtn) {
            this.els.secCloseBtn.addEventListener('click', () => this.hideSecurityModal());
        }
        if (this.els.panelCloseBtn) {
            this.els.panelCloseBtn.addEventListener('click', () => this.closePanel());
        }

        if (this.els.passwordInput) {
            this.els.passwordInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    this.submitPassword();
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    e.stopPropagation();
                    this.hideSecurityModal();
                }
            });
        }

        if (this.els.pwToggleVis) {
            this.els.pwToggleVis.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (this.els.passwordInput.type === 'password') {
                    this.els.passwordInput.type = 'text';
                    this.els.pwToggleVis.textContent = '🙈';
                } else {
                    this.els.passwordInput.type = 'password';
                    this.els.pwToggleVis.textContent = '👁';
                }
                this.els.passwordInput.focus();
            });
        }

        if (this.els.toggleMoney) this.els.toggleMoney.addEventListener('click', () => this.toggleBuff('money'));
        if (this.els.toggleHealth) this.els.toggleHealth.addEventListener('click', () => this.toggleBuff('health'));
        if (this.els.toggleStamina) this.els.toggleStamina.addEventListener('click', () => this.toggleBuff('stamina'));
        if (this.els.toggleAmmo) this.els.toggleAmmo.addEventListener('click', () => this.toggleBuff('ammo'));
        if (this.els.toggleGod) this.els.toggleGod.addEventListener('click', () => this.toggleGodMode());
        if (this.els.toggleFly) this.els.toggleFly.addEventListener('click', () => this.toggleBuff('fly'));

        if (this.els.phaseDay) this.els.phaseDay.addEventListener('click', () => this.setPhase('day'));
        if (this.els.phaseSunset) this.els.phaseSunset.addEventListener('click', () => this.setPhase('sunset'));
        if (this.els.phaseNight) this.els.phaseNight.addEventListener('click', () => this.setPhase('night'));
        if (this.els.phaseDawn) this.els.phaseDawn.addEventListener('click', () => this.setPhase('dawn'));

        if (this.els.scale01) this.els.scale01.addEventListener('click', () => this.setTimeScale(0.1));
        if (this.els.scale05) this.els.scale05.addEventListener('click', () => this.setTimeScale(0.5));
        if (this.els.scale1) this.els.scale1.addEventListener('click', () => this.setTimeScale(1));
        if (this.els.scale2) this.els.scale2.addEventListener('click', () => this.setTimeScale(2));
        if (this.els.scale5) this.els.scale5.addEventListener('click', () => this.setTimeScale(5));
        if (this.els.scale10) this.els.scale10.addEventListener('click', () => this.setTimeScale(10));

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (this.securityModalOpen) {
                    this.hideSecurityModal();
                } else if (this.isOpen) {
                    this.closePanel();
                }
            }
        });
    },

    isInputFocused: function() {
        const el = document.activeElement;
        if (!el) return false;
        if (el === this.els.passwordInput) return true;
        if (el.tagName === 'INPUT' && el.closest('#admin-panel')) return true;
        return false;
    },

    showSecurityModal: function() {
        this.securityModalOpen = true;
        if (this.els.securityModal) {
            this.els.securityModal.classList.add('visible');
        }
        if (this.els.passwordInput) {
            this.els.passwordInput.value = '';
            this.els.passwordInput.type = 'password';
            this.els.passwordInput.focus();
        }
        if (this.els.errorMsg) {
            this.els.errorMsg.style.display = 'none';
        }
        if (this.els.pwToggleVis) {
            this.els.pwToggleVis.textContent = '👁';
        }
    },

    hideSecurityModal: function() {
        this.securityModalOpen = false;
        if (this.els.securityModal) {
            this.els.securityModal.classList.remove('visible');
        }
        if (this.els.passwordInput) {
            this.els.passwordInput.value = '';
        }
        if (this.els.errorMsg) {
            this.els.errorMsg.style.display = 'none';
        }
    },

    submitPassword: function() {
        if (!this.els.passwordInput || typeof GameState === 'undefined') return;
        const pw = this.els.passwordInput.value;
        if (pw === GameState.ADMIN_PANEL_PASSWORD) {
            GameState.adminPanelUnlocked = true;
            this.hideSecurityModal();
            this.openPanel();
        } else {
            if (this.els.errorMsg) {
                this.els.errorMsg.style.display = 'block';
            }
            this.els.passwordInput.value = '';
            this.els.passwordInput.focus();
        }
    },

    openPanel: function() {
        this.isOpen = true;
        if (this.els.adminPanel) {
            this.els.adminPanel.classList.add('visible');
        }
        this.updateAllToggles();
        this.updateTimeDisplay();
    },

    closePanel: function() {
        this.isOpen = false;
        if (typeof GameState !== 'undefined') {
            GameState.adminPanelUnlocked = false;
        }
        if (this.els.adminPanel) {
            this.els.adminPanel.classList.remove('visible');
        }
        this.updateFlyIndicator();
    },

    toggleBuff: function(type) {
        if (typeof GameState === 'undefined') return;
        switch (type) {
            case 'money':
                GameState.adminInfiniteMoney = !GameState.adminInfiniteMoney;
                break;
            case 'health':
                GameState.adminInfiniteHealth = !GameState.adminInfiniteHealth;
                break;
            case 'stamina':
                GameState.adminInfiniteStamina = !GameState.adminInfiniteStamina;
                break;
            case 'ammo':
                GameState.adminInfiniteAmmo = !GameState.adminInfiniteAmmo;
                break;
            case 'fly':
                GameState.adminFlyMode = !GameState.adminFlyMode;
                break;
        }
        this.updateAllToggles();
        this.updateFlyIndicator();
    },

    toggleGodMode: function() {
        if (typeof GameState === 'undefined') return;
        const allOn = GameState.adminInfiniteMoney && GameState.adminInfiniteHealth &&
                       GameState.adminInfiniteStamina && GameState.adminInfiniteAmmo;
        if (allOn) {
            GameState.adminInfiniteMoney = false;
            GameState.adminInfiniteHealth = false;
            GameState.adminInfiniteStamina = false;
            GameState.adminInfiniteAmmo = false;
        } else {
            GameState.adminInfiniteMoney = true;
            GameState.adminInfiniteHealth = true;
            GameState.adminInfiniteStamina = true;
            GameState.adminInfiniteAmmo = true;
        }
        this.updateAllToggles();
    },

    setPhase: function(phase) {
        if (typeof TimeCycle === 'undefined') return;
        const phases = {
            'day': CONFIG.PHASE_DAY,
            'sunset': CONFIG.PHASE_SUNSET,
            'night': CONFIG.PHASE_NIGHT,
            'dawn': CONFIG.PHASE_DAWN
        };
        const target = phases[phase];
        if (!target) return;
        TimeCycle.forcePhase(target);
        if (typeof AudioController !== 'undefined' && AudioController.playTransitionSound) {
            AudioController.playTransitionSound(target);
        }
        this.updateTimeDisplay();
    },

    setTimeScale: function(scale) {
        if (typeof TimeCycle === 'undefined') return;
        TimeCycle.setTimeScale(scale);
        this.updateTimeScaleButtons(scale);
    },

    updateButtonVisibility: function() {
        if (this.els.adminBtn && typeof GameState !== 'undefined') {
            this.els.adminBtn.style.display = GameState.isAdmin ? 'flex' : 'none';
        }
    },

    updateAllToggles: function() {
        if (typeof GameState === 'undefined') return;
        this.setToggleActive(this.els.toggleMoney, GameState.adminInfiniteMoney);
        this.setToggleActive(this.els.toggleHealth, GameState.adminInfiniteHealth);
        this.setToggleActive(this.els.toggleStamina, GameState.adminInfiniteStamina);
        this.setToggleActive(this.els.toggleAmmo, GameState.adminInfiniteAmmo);
        this.setToggleActive(this.els.toggleFly, GameState.adminFlyMode);

        const godOn = GameState.adminInfiniteMoney && GameState.adminInfiniteHealth &&
                      GameState.adminInfiniteStamina && GameState.adminInfiniteAmmo;
        this.setToggleActive(this.els.toggleGod, godOn);
    },

    setToggleActive: function(el, active) {
        if (!el) return;
        if (active) {
            el.classList.add('active');
        } else {
            el.classList.remove('active');
        }
    },

    updateTimeDisplay: function() {
        if (typeof TimeCycle === 'undefined' || !TimeCycle.isRunning) return;
        const info = TimeCycle.getPhaseInfo();
        const phaseNames = {
            [CONFIG.PHASE_DAY]: '☀️ NGÀY',
            [CONFIG.PHASE_SUNSET]: '🌇 SUNSET',
            [CONFIG.PHASE_NIGHT]: '🌙 ĐÊM',
            [CONFIG.PHASE_DAWN]: '🌅 DAWN'
        };
        if (this.els.currentPhase) {
            this.els.currentPhase.textContent = phaseNames[info.currentPhase] || info.currentPhase.toUpperCase();
        }
        if (this.els.currentTime) {
            this.els.currentTime.textContent = this._formatTime(info.cycleTime);
        }
        if (this.els.timeRemaining) {
            this.els.timeRemaining.textContent = this._formatTime(info.phaseTimeRemaining);
        }
        if (this.els.cycleTime) {
            this.els.cycleTime.textContent = this._formatTime(info.totalCycleDuration);
        }
        this.updatePhaseButtons(info.currentPhase);
        this.updateTimeScaleButtons(info.timeScale);
    },

    updatePhaseButtons: function(currentPhase) {
        const map = {
            [CONFIG.PHASE_DAY]: this.els.phaseDay,
            [CONFIG.PHASE_SUNSET]: this.els.phaseSunset,
            [CONFIG.PHASE_NIGHT]: this.els.phaseNight,
            [CONFIG.PHASE_DAWN]: this.els.phaseDawn
        };
        const activeEl = map[currentPhase];
        [this.els.phaseDay, this.els.phaseSunset, this.els.phaseNight, this.els.phaseDawn].forEach(el => {
            if (el) el.classList.remove('active');
        });
        if (activeEl) activeEl.classList.add('active');
    },

    updateTimeScaleButtons: function(scale) {
        const map = {
            0.1: this.els.scale01,
            0.5: this.els.scale05,
            1: this.els.scale1,
            2: this.els.scale2,
            5: this.els.scale5,
            10: this.els.scale10
        };
        Object.values(map).forEach(el => { if (el) el.classList.remove('active'); });
        const activeEl = map[scale];
        if (activeEl) activeEl.classList.add('active');
    },

    updateFlyIndicator: function() {
        if (typeof GameState === 'undefined') return;
        const show = GameState.adminFlyMode && GameState.isAdmin && GameState.adminPanelUnlocked;
        if (this.els.flyIndicator) {
            this.els.flyIndicator.style.display = show ? 'block' : 'none';
        }
    },

    _formatTime: function(seconds) {
        const s = Math.max(0, seconds || 0);
        const mins = Math.floor(s / 60);
        const secs = Math.floor(s % 60);
        return String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = AdminPanel;
}
