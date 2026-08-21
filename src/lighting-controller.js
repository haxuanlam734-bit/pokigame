/**
 * LIGHTING-CONTROLLER.JS - Điều khiển ánh sáng theo phase
 * Continuous smooth interpolation dựa trên phaseProgress từ TimeCycle
 */

const LightingController = {
    _lights: {},
    _cachedColors: {},
    _emissiveBaseIntensities: null,

    _setSceneBackgroundColor: function(scene, r, g, b) {
        if (!(scene.background instanceof THREE.Color)) {
            scene.background = new THREE.Color();
        }
        scene.background.setRGB(r, g, b);
    },

    init: function() {
        this._cacheLights();
        this._parseColorCache();
        this._applyPhaseSettings(CONFIG.PHASE_DAY, 0, true);
        this._cacheEmissiveMaterials();
        console.log('💡 Lighting Controller đã khởi tạo');
    },

    _cacheLights: function() {
        if (!Renderer3D || !Renderer3D.scene) return;

        const scene = Renderer3D.scene;
        this._lights = {
            ambient: null,
            directional: null,
            hemisphere: null,
            scene: scene
        };

        scene.traverse(function(child) {
            if (child.isAmbientLight && !LightingController._lights.ambient) {
                LightingController._lights.ambient = child;
            }
            if (child.isDirectionalLight && !LightingController._lights.directional) {
                LightingController._lights.directional = child;
            }
            if (child.isHemisphereLight && !LightingController._lights.hemisphere) {
                LightingController._lights.hemisphere = child;
            }
            if (child.isDirectionalLight && child !== LightingController._lights.directional && !LightingController._lights.moon) {
                LightingController._lights.moon = child;
            }
        });
    },

    _parseColorCache: function() {
        this._cachedColors = {};
        const phases = ['day', 'sunset', 'night', 'dawn'];
        for (let i = 0; i < phases.length; i++) {
            const p = phases[i];
            const s = CONFIG.LIGHTING[p];
            this._cachedColors[p] = {
                background: new THREE.Color(s.background),
                fogColor: new THREE.Color(s.fogColor),
                fogNear: s.fogNear,
                fogFar: s.fogFar,
                ambientColor: new THREE.Color(s.ambientColor),
                ambientIntensity: s.ambientIntensity,
                directionalColor: new THREE.Color(s.directionalColor),
                directionalIntensity: s.directionalIntensity,
                hemiSkyColor: new THREE.Color(s.hemiSkyColor),
                hemiGroundColor: new THREE.Color(s.hemiGroundColor),
                hemiIntensity: s.hemiIntensity,
                sunPosition: { x: s.sunPosition.x, y: s.sunPosition.y, z: s.sunPosition.z },
                exposure: s.exposure,
                sunColor: new THREE.Color(s.sunColor),
                sunIntensity: s.sunIntensity,
                sunScale: s.sunScale,
                starOpacity: s.starOpacity,
                emissiveBoost: s.emissiveBoost,
                shadowBias: s.shadowBias,
                shadowNormalBias: s.shadowNormalBias,
                moonPosition: s.moonPosition ? { x: s.moonPosition.x, y: s.moonPosition.y, z: s.moonPosition.z } : (Renderer3D && Renderer3D.worldCenterX !== undefined ? { x: Renderer3D.worldCenterX, y: -30, z: Renderer3D.worldCenterZ } : { x: 500, y: -30, z: 500 }),
                moonIntensity: s.moonIntensity || 0,
                moonColor: new THREE.Color(s.moonColor || '#b8c8e0')
            };
        }
    },

    _cacheEmissiveMaterials: function() {
        this._emissiveBaseIntensities = [];
        if (!Renderer3D || !Renderer3D.scene) return;
        Renderer3D.scene.traverse((child) => {
            if (child.isMesh && child.material && child.material.emissive) {
                if (child.material._baseEmissiveIntensity === undefined) {
                    child.material._baseEmissiveIntensity = child.material.emissiveIntensity || 0.25;
                }
                this._emissiveBaseIntensities.push(child.material);
            }
        });
    },

    update: function() {
        if (!Renderer3D || !Renderer3D.scene) return;

        let phase, progress;
        if (typeof TimeCycle !== 'undefined' && TimeCycle.isRunning) {
            const info = TimeCycle.getPhaseInfo();
            phase = info.currentPhase;
            progress = info.phaseProgress || 0;
        } else {
            phase = CONFIG.PHASE_DAY;
            progress = 0;
        }

        this._updateContinuous(phase, progress);
        if (Renderer3D.updateSky) {
            Renderer3D.updateSky(phase, progress);
        }
    },

    _updateContinuous: function(phase, progress) {
        const from = this._cachedColors[phase];
        if (!from) return;

        const phases = [CONFIG.PHASE_DAY, CONFIG.PHASE_SUNSET, CONFIG.PHASE_NIGHT, CONFIG.PHASE_DAWN];
        const currentIndex = phases.indexOf(phase);
        const nextPhase = phases[(currentIndex + 1) % phases.length];
        const to = this._cachedColors[nextPhase];

        const t = this._smoothStep(Math.min(1, Math.max(0, progress)));

        this._applyInterpolatedSettings(from, to, t);
    },

    _applyPhaseSettings: function(phase, progress, immediate) {
        const settings = this._cachedColors[phase] || this._cachedColors[CONFIG.PHASE_DAY];
        this._applyInterpolatedSettings(settings, settings, 1);
    },

    _applyInterpolatedSettings: function(from, to, t) {
        const scene = this._lights.scene;
        if (!scene) return;

        this._setSceneBackgroundColor(scene,
            THREE.MathUtils.lerp(from.background.r, to.background.r, t),
            THREE.MathUtils.lerp(from.background.g, to.background.g, t),
            THREE.MathUtils.lerp(from.background.b, to.background.b, t)
        );

        if (scene.fog && scene.fog.color) {
            scene.fog.color.setRGB(
                THREE.MathUtils.lerp(from.fogColor.r, to.fogColor.r, t),
                THREE.MathUtils.lerp(from.fogColor.g, to.fogColor.g, t),
                THREE.MathUtils.lerp(from.fogColor.b, to.fogColor.b, t)
            );
            scene.fog.near = THREE.MathUtils.lerp(from.fogNear, to.fogNear, t);
            scene.fog.far = THREE.MathUtils.lerp(from.fogFar, to.fogFar, t);
        }

        if (this._lights.ambient) {
            this._lights.ambient.color.setRGB(
                THREE.MathUtils.lerp(from.ambientColor.r, to.ambientColor.r, t),
                THREE.MathUtils.lerp(from.ambientColor.g, to.ambientColor.g, t),
                THREE.MathUtils.lerp(from.ambientColor.b, to.ambientColor.b, t)
            );
            this._lights.ambient.intensity = THREE.MathUtils.lerp(from.ambientIntensity, to.ambientIntensity, t);
        }

        if (this._lights.directional) {
            this._lights.directional.color.setRGB(
                THREE.MathUtils.lerp(from.directionalColor.r, to.directionalColor.r, t),
                THREE.MathUtils.lerp(from.directionalColor.g, to.directionalColor.g, t),
                THREE.MathUtils.lerp(from.directionalColor.b, to.directionalColor.b, t)
            );
            this._lights.directional.intensity = THREE.MathUtils.lerp(from.directionalIntensity, to.directionalIntensity, t);

            this._lights.directional.shadow.bias = THREE.MathUtils.lerp(from.shadowBias, to.shadowBias, t);
            this._lights.directional.shadow.normalBias = THREE.MathUtils.lerp(from.shadowNormalBias, to.shadowNormalBias, t);
        }

        if (this._lights.hemisphere) {
            this._lights.hemisphere.color.setRGB(
                THREE.MathUtils.lerp(from.hemiSkyColor.r, to.hemiSkyColor.r, t),
                THREE.MathUtils.lerp(from.hemiSkyColor.g, to.hemiSkyColor.g, t),
                THREE.MathUtils.lerp(from.hemiSkyColor.b, to.hemiSkyColor.b, t)
            );

            this._lights.hemisphere.groundColor.setRGB(
                THREE.MathUtils.lerp(from.hemiGroundColor.r, to.hemiGroundColor.r, t),
                THREE.MathUtils.lerp(from.hemiGroundColor.g, to.hemiGroundColor.g, t),
                THREE.MathUtils.lerp(from.hemiGroundColor.b, to.hemiGroundColor.b, t)
            );
            this._lights.hemisphere.intensity = THREE.MathUtils.lerp(from.hemiIntensity, to.hemiIntensity, t);
        }

        if (Renderer3D.renderer && Renderer3D.renderer.toneMappingExposure !== undefined) {
            Renderer3D.renderer.toneMappingExposure = THREE.MathUtils.lerp(from.exposure, to.exposure, t);
        }

        this._updateEmissiveIntensity(from, to, t);

        if (this._lights.moon) {
            this._lights.moon.intensity = THREE.MathUtils.lerp(from.moonIntensity, to.moonIntensity, t);
            this._lights.moon.color.lerpColors(from.moonColor, to.moonColor, t);
        }

        this._baseEventDirectionalIntensity = this._lights.directional ? this._lights.directional.intensity : 0;
        this._baseEventMoonIntensity = this._lights.moon ? this._lights.moon.intensity : 0;
        this._applyEventLighting();
    },

    _applyEventLighting: function() {
        if (typeof SpecialEventManager === 'undefined' || !SpecialEventManager.currentEvent) return;
        const event = SpecialEventManager.currentEvent;
        const intensity = SpecialEventManager.eventLightIntensity || 1.0;
        const ambientBoost = SpecialEventManager.eventAmbientBoost || 0.0;

        if (event === 'ECLIPSE') {
            if (this._lights.ambient && ambientBoost > 0) {
                const c = new THREE.Color(0x303050);
                this._lights.ambient.color.lerp(c, ambientBoost * 0.45);
                this._lights.ambient.intensity = Math.max(0, this._lights.ambient.intensity + ambientBoost * 0.18);
            }
            if (this._lights.directional && intensity < 1.0) {
                this._lights.directional.intensity = this._baseEventDirectionalIntensity * intensity;
                const coolFill = new THREE.Color(0x7788aa);
                this._lights.directional.color.lerp(coolFill, 0.45);
            }
        } else if (event === 'BLOOD_MOON') {
            if (this._lights.ambient && ambientBoost > 0) {
                const c = new THREE.Color(0x4a0512);
                this._lights.ambient.color.lerp(c, ambientBoost * 0.50);
                this._lights.ambient.intensity = Math.max(0, this._lights.ambient.intensity + ambientBoost * 0.12);
            }
            if (this._lights.moon && intensity < 1.0) {
                const moonColor = new THREE.Color(CONFIG.SPECIAL_EVENT_CONFIG.bloodMoon.moonColor || '#8b0000');
                this._lights.moon.color.lerp(moonColor, 0.60);
                this._lights.moon.intensity = Math.max(0, this._baseEventMoonIntensity * intensity);
            }
            if (this._lights.hemisphere && ambientBoost > 0) {
                const hemiSky = new THREE.Color('#1a0512');
                const hemiGround = new THREE.Color('#0f0508');
                this._lights.hemisphere.color.lerp(hemiSky, ambientBoost * 0.40);
                this._lights.hemisphere.groundColor.lerp(hemiGround, ambientBoost * 0.35);
            }
        }
    },

    _updateEmissiveIntensity: function(from, to, t) {
        if (!this._emissiveBaseIntensities) return;
        const boost = THREE.MathUtils.lerp(from.emissiveBoost, to.emissiveBoost, t);
        for (let i = 0; i < this._emissiveBaseIntensities.length; i++) {
            const mat = this._emissiveBaseIntensities[i];
            mat.emissiveIntensity = mat._baseEmissiveIntensity * boost;
        }
    },

    _smoothStep: function(t) {
        return t * t * (3 - 2 * t);
    },

    applyImmediate: function(phase) {
        this._applyPhaseSettings(phase, 0, true);
    },

    getCurrentSettings: function() {
        if (typeof TimeCycle !== 'undefined') {
            const info = TimeCycle.getPhaseInfo();
            return CONFIG.LIGHTING[info.currentPhase] || CONFIG.LIGHTING.day;
        }
        return CONFIG.LIGHTING[CONFIG.PHASE_DAY];
    },

    onPhaseChanged: function(oldPhase, newPhase) {
        this.applyImmediate(newPhase);
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = LightingController;
}
