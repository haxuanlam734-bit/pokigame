/**
 * SPECIAL-EVENT-MANAGER.JS - Unified Eclipse + Blood Moon event system
 * Lifecycle: IDLE -> SCHEDULED -> WARNING -> ACTIVE -> PEAK -> ENDING -> IDLE
 * Built on top of existing TimeCycle, Renderer3D, LightingController, GameState
 */

const SpecialEventManager = {
    state: 'IDLE',
    currentEvent: null,
    autoMode: true,
    eventTimer: 0,
    eventEndTime: 0,
    warningTriggered: false,
    peakTriggered: false,
    bloodPulseTimer: 0,
    bloodPulseActive: false,
    bloodPulseEndTime: 0,
    peakTimer: 0,
    peakPulseTimer: 0,
    peakPulseActive: false,

    eclipseVisualScale: 1.0,
    bloodMoonColorLerp: 0.0,
    eventLightIntensity: 1.0,
    eventAmbientBoost: 0.0,

    _scheduledEvent: null,
    _scheduledTime: 0,
    _scheduledPhase: null,
    _phaseStartTime: 0,
    _phaseDuration: 0,
    _lastPhase: null,

    _listeners: [],

    eclipseDisc: null,
    eclipseCorona: null,
    eclipseHalo: null,
    eclipseRibbons: [],
    eclipseParticles: null,
    eclipseRays: [],
    bloodMoonDisc: null,
    bloodMoonCorona: null,
    bloodMoonHalo: null,
    bloodMoonParticles: null,
    bloodMoonAtmosphere: null,

    _particlePositions: null,
    _particleBasePositions: null,
    _ribbonBasePositions: [],
    _ribbonBaseRotations: [],
    _rayBaseRotations: [],
    _rayBaseLengths: [],
    _bloodParticlePositions: null,
    _bloodParticleBasePositions: null,

    init: function() {
        this.state = 'IDLE';
        this.currentEvent = null;
        this.autoMode = true;
        this.eventTimer = 0;
        this.eventEndTime = 0;
        this.warningTriggered = false;
        this.peakTriggered = false;
        this.bloodPulseTimer = 0;
        this.bloodPulseActive = false;
        this.bloodPulseEndTime = 0;
        this.peakTimer = 0;
        this.peakPulseTimer = 0;
        this.peakPulseActive = false;
        this.eclipseVisualScale = 1.0;
        this.bloodMoonColorLerp = 0.0;
        this.eventLightIntensity = 1.0;
        this.eventAmbientBoost = 0.0;
        this._scheduledEvent = null;
        this._scheduledTime = 0;
        this._scheduledPhase = null;
        this._phaseStartTime = 0;
        this._phaseDuration = 0;
        this._lastPhase = typeof TimeCycle !== 'undefined' ? TimeCycle.currentPhase : null;
        this._listeners = [];
        this.eclipseDisc = null;
        this.eclipseCorona = null;
        this.eclipseHalo = null;
        this.eclipseRibbons = [];
        this.eclipseParticles = null;
        this.eclipseRays = [];
        this.bloodMoonDisc = null;
        this.bloodMoonCorona = null;
        this.bloodMoonHalo = null;
        this.bloodMoonParticles = null;
        this.bloodMoonAtmosphere = null;
        this._particlePositions = null;
        this._particleBasePositions = null;
        this._ribbonBasePositions = [];
        this._ribbonBaseRotations = [];
        this._rayBaseRotations = [];
        this._rayBaseLengths = [];
        this._bloodParticlePositions = null;
        this._bloodParticleBasePositions = null;
        this._createEventVisuals();
        console.log('🌘 SpecialEventManager initialized');
    },

    _createEventVisuals: function() {
        if (!Renderer3D || !Renderer3D.scene) return;
        this._destroyEventVisuals();

        const cfg = CONFIG.SPECIAL_EVENT_CONFIG;

        this.eclipseDisc = this._createEclipseDisc();
        this.eclipseCorona = this._createEclipseCorona();
        this.eclipseHalo = this._createEclipseHalo();
        this.eclipseRays = this._createEclipseRays(cfg.eclipse.rayCount || 12);
        this.eclipseRibbons = this._createEclipseRibbons(cfg.eclipse.ribbonCount);
        this.eclipseParticles = this._createEclipseParticles(cfg.eclipse.particleCount);
        this.bloodMoonDisc = this._createBloodMoonDisc();
        this.bloodMoonCorona = this._createBloodMoonCorona();
        this.bloodMoonHalo = this._createBloodMoonHalo();
        this.bloodMoonParticles = this._createBloodMoonParticles(cfg.bloodMoon.particleCount || 40);
        this.bloodMoonAtmosphere = this._createBloodMoonAtmosphere();

        this._setEventVisibility(false);
    },

    _createEclipseDisc: function() {
        const size = 1024;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        const cx = size / 2;
        const cy = size / 2;
        const innerR = size * 0.30;

        ctx.clearRect(0, 0, size, size);

        const darkGrad = ctx.createRadialGradient(cx, cy, innerR * 0.05, cx, cy, innerR);
        darkGrad.addColorStop(0, '#010208');
        darkGrad.addColorStop(0.3, '#030510');
        darkGrad.addColorStop(0.6, '#060a18');
        darkGrad.addColorStop(0.85, '#0c1025');
        darkGrad.addColorStop(1, '#151a35');
        ctx.fillStyle = darkGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
        ctx.fill();

        const rimGrad = ctx.createRadialGradient(cx, cy, innerR * 0.92, cx, cy, innerR * 1.08);
        rimGrad.addColorStop(0, 'rgba(25,20,60,0.0)');
        rimGrad.addColorStop(0.3, 'rgba(45,35,100,0.50)');
        rimGrad.addColorStop(0.6, 'rgba(70,55,140,0.18)');
        rimGrad.addColorStop(0.85, 'rgba(90,70,160,0.05)');
        rimGrad.addColorStop(1, 'rgba(60,40,130,0.0)');
        ctx.fillStyle = rimGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, innerR * 1.08, 0, Math.PI * 2);
        ctx.fill();

        const texture = new THREE.CanvasTexture(canvas);
        const geo = new THREE.PlaneGeometry(32, 32);
        const mat = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            depthWrite: false,
            depthTest: true,
            fog: false,
            side: THREE.DoubleSide
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.visible = false;
        mesh.renderOrder = 1;
        Renderer3D.scene.add(mesh);
        return mesh;
    },

    _createEclipseCorona: function() {
        const size = 1024;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        const cx = size / 2;
        const cy = size / 2;

        const whiteRing = ctx.createRadialGradient(cx, cy, size * 0.16, cx, cy, size * 0.22);
        whiteRing.addColorStop(0, 'rgba(255,255,255,0.0)');
        whiteRing.addColorStop(0.15, 'rgba(250,248,255,0.70)');
        whiteRing.addColorStop(0.4, 'rgba(235,225,255,0.35)');
        whiteRing.addColorStop(0.7, 'rgba(210,195,255,0.08)');
        whiteRing.addColorStop(1, 'rgba(180,160,240,0.0)');
        ctx.fillStyle = whiteRing;
        ctx.fillRect(0, 0, size, size);

        const lavenderGrad = ctx.createRadialGradient(cx, cy, size * 0.20, cx, cy, size * 0.30);
        lavenderGrad.addColorStop(0, 'rgba(230,220,255,0.45)');
        lavenderGrad.addColorStop(0.3, 'rgba(200,185,255,0.28)');
        lavenderGrad.addColorStop(0.6, 'rgba(160,140,240,0.10)');
        lavenderGrad.addColorStop(1, 'rgba(120,100,220,0.0)');
        ctx.fillStyle = lavenderGrad;
        ctx.fillRect(0, 0, size, size);

        const violetGrad = ctx.createRadialGradient(cx, cy, size * 0.26, cx, cy, size * 0.42);
        violetGrad.addColorStop(0, 'rgba(140,120,240,0.18)');
        violetGrad.addColorStop(0.3, 'rgba(110,90,220,0.10)');
        violetGrad.addColorStop(0.6, 'rgba(80,60,200,0.04)');
        violetGrad.addColorStop(1, 'rgba(50,35,160,0.0)');
        ctx.fillStyle = violetGrad;
        ctx.fillRect(0, 0, size, size);

        const blueGrad = ctx.createRadialGradient(cx, cy, size * 0.34, cx, cy, size * 0.52);
        blueGrad.addColorStop(0, 'rgba(60,80,220,0.08)');
        blueGrad.addColorStop(0.3, 'rgba(45,65,200,0.04)');
        blueGrad.addColorStop(0.6, 'rgba(30,50,180,0.01)');
        blueGrad.addColorStop(1, 'rgba(20,35,140,0.0)');
        ctx.fillStyle = blueGrad;
        ctx.fillRect(0, 0, size, size);

        const texture = new THREE.CanvasTexture(canvas);
        const geo = new THREE.PlaneGeometry(52, 52);
        const mat = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            depthWrite: false,
            depthTest: true,
            fog: false,
            side: THREE.DoubleSide
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.visible = false;
        mesh.renderOrder = 0;
        Renderer3D.scene.add(mesh);
        return mesh;
    },

    _createEclipseHalo: function() {
        const size = 1024;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        const cx = size / 2;
        const cy = size / 2;

        const grad = ctx.createRadialGradient(cx, cy, size * 0.32, cx, cy, size * 0.50);
        grad.addColorStop(0, 'rgba(100,80,200,0.0)');
        grad.addColorStop(0.4, 'rgba(80,60,180,0.10)');
        grad.addColorStop(0.7, 'rgba(60,40,150,0.04)');
        grad.addColorStop(1, 'rgba(40,20,100,0.0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, size, size);

        const texture = new THREE.CanvasTexture(canvas);
        const geo = new THREE.PlaneGeometry(72, 72);
        const mat = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            depthWrite: false,
            depthTest: false,
            fog: false,
            side: THREE.DoubleSide
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.visible = false;
        mesh.renderOrder = -1;
        Renderer3D.scene.add(mesh);
        return mesh;
    },

    _createEclipseRays: function(count) {
        const rays = [];
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
            const length = 16 + Math.random() * 24;
            const width = 0.20 + Math.random() * 0.55;
            const geo = new THREE.PlaneGeometry(width, length);
            const canvas = document.createElement('canvas');
            canvas.width = 64;
            canvas.height = 256;
            const ctx = canvas.getContext('2d');
            const grad = ctx.createLinearGradient(0, 0, 0, 256);
            grad.addColorStop(0, 'rgba(255,252,255,0.0)');
            grad.addColorStop(0.10, 'rgba(240,235,255,0.55)');
            grad.addColorStop(0.25, 'rgba(200,190,255,0.30)');
            grad.addColorStop(0.50, 'rgba(140,120,240,0.10)');
            grad.addColorStop(0.75, 'rgba(80,60,200,0.02)');
            grad.addColorStop(1, 'rgba(50,30,150,0.0)');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, 64, 256);
            const texture = new THREE.CanvasTexture(canvas);
            const mat = new THREE.MeshBasicMaterial({
                map: texture,
                transparent: true,
                depthWrite: false,
                depthTest: true,
                fog: false,
                side: THREE.DoubleSide
            });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.visible = false;
            mesh.renderOrder = 1;
            Renderer3D.scene.add(mesh);
            rays.push(mesh);
            this._rayBaseRotations.push({ angle: angle, tilt: (Math.random() - 0.5) * 0.6 });
            this._rayBaseLengths.push(length);
        }
        return rays;
    },

    _createEclipseRibbons: function(count) {
        const ribbons = [];
        const geo = new THREE.PlaneGeometry(2.0, 28);
        for (let i = 0; i < count; i++) {
            const canvas = document.createElement('canvas');
            canvas.width = 64;
            canvas.height = 256;
            const ctx = canvas.getContext('2d');
            const grad = ctx.createLinearGradient(0, 0, 0, 256);
            grad.addColorStop(0, 'rgba(180,200,255,0.0)');
            grad.addColorStop(0.12, 'rgba(150,170,255,0.55)');
            grad.addColorStop(0.30, 'rgba(130,150,255,0.32)');
            grad.addColorStop(0.55, 'rgba(110,120,240,0.12)');
            grad.addColorStop(0.80, 'rgba(80,70,200,0.03)');
            grad.addColorStop(1, 'rgba(50,40,160,0.0)');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, 64, 256);

            const texture = new THREE.CanvasTexture(canvas);
            const mat = new THREE.MeshBasicMaterial({
                map: texture,
                transparent: true,
                depthWrite: false,
                depthTest: true,
                fog: false,
                side: THREE.DoubleSide
            });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.visible = false;
            mesh.renderOrder = 2;
            Renderer3D.scene.add(mesh);
            ribbons.push(mesh);
            this._ribbonBasePositions.push(new THREE.Vector3());
            this._ribbonBaseRotations.push({
                x: Math.random() * Math.PI * 2,
                y: Math.random() * Math.PI * 2,
                z: (Math.random() - 0.5) * 0.9,
                orbitSpeed: 0.12 + Math.random() * 0.30,
                waveSpeed: 0.7 + Math.random() * 1.1,
                waveAmp: 0.4 + Math.random() * 0.8
            });
        }
        return ribbons;
    },

    _createEclipseParticles: function(count) {
        const positions = new Float32Array(count * 3);
        const basePositions = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);
        const sizes = new Float32Array(count);

        for (let i = 0; i < count; i++) {
            const theta = Math.random() * Math.PI * 2;
            const phi = (Math.random() - 0.5) * Math.PI * 0.9;
            const r = 8 + Math.random() * 20;
            const x = Math.cos(theta) * Math.cos(phi) * r;
            const y = Math.sin(phi) * r;
            const z = Math.sin(theta) * Math.cos(phi) * r;
            positions[i * 3] = x;
            positions[i * 3 + 1] = y;
            positions[i * 3 + 2] = z;
            basePositions[i * 3] = x;
            basePositions[i * 3 + 1] = y;
            basePositions[i * 3 + 2] = z;

            const colorChoice = Math.random();
            if (colorChoice < 0.40) {
                colors[i * 3] = 0.7 + Math.random() * 0.3;
                colors[i * 3 + 1] = 0.7 + Math.random() * 0.3;
                colors[i * 3 + 2] = 1.0;
            } else if (colorChoice < 0.70) {
                colors[i * 3] = 0.6 + Math.random() * 0.3;
                colors[i * 3 + 1] = 0.5 + Math.random() * 0.3;
                colors[i * 3 + 2] = 0.95 + Math.random() * 0.05;
            } else if (colorChoice < 0.90) {
                colors[i * 3] = 1.0;
                colors[i * 3 + 1] = 0.92 + Math.random() * 0.08;
                colors[i * 3 + 2] = 0.88 + Math.random() * 0.12;
            } else {
                colors[i * 3] = 0.9 + Math.random() * 0.1;
                colors[i * 3 + 1] = 0.5 + Math.random() * 0.4;
                colors[i * 3 + 2] = 0.8 + Math.random() * 0.2;
            }
            sizes[i] = 0.05 + Math.random() * 0.12;
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

        const mat = new THREE.PointsMaterial({
            size: 0.22,
            vertexColors: true,
            transparent: true,
            opacity: 0.0,
            depthWrite: false,
            depthTest: true,
            fog: false,
            sizeAttenuation: true
        });

        const points = new THREE.Points(geo, mat);
        points.visible = false;
        points.renderOrder = 3;
        Renderer3D.scene.add(points);

        this._particlePositions = positions;
        this._particleBasePositions = basePositions;
        return points;
    },

    _createBloodMoonDisc: function() {
        const size = 1024;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        const cx = size / 2;
        const cy = size / 2;
        const r = size * 0.30;

        ctx.clearRect(0, 0, size, size);

        const coreGrad = ctx.createRadialGradient(cx, cy, r * 0.02, cx, cy, r * 0.90);
        coreGrad.addColorStop(0, '#2a0303');
        coreGrad.addColorStop(0.2, '#4a0808');
        coreGrad.addColorStop(0.45, '#6b1010');
        coreGrad.addColorStop(0.70, '#8b1a1a');
        coreGrad.addColorStop(0.88, '#a82020');
        coreGrad.addColorStop(1, '#5c0a0a');
        ctx.fillStyle = coreGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();

        const craterGrad = ctx.createRadialGradient(cx - r * 0.25, cy - r * 0.20, r * 0.04, cx, cy, r * 0.95);
        craterGrad.addColorStop(0, 'rgba(20,3,3,0.40)');
        craterGrad.addColorStop(0.4, 'rgba(50,8,8,0.20)');
        craterGrad.addColorStop(0.7, 'rgba(30,5,5,0.08)');
        craterGrad.addColorStop(1, 'rgba(0,0,0,0.0)');
        ctx.fillStyle = craterGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();

        const craterGrad2 = ctx.createRadialGradient(cx + r * 0.30, cy + r * 0.15, r * 0.03, cx, cy, r * 0.85);
        craterGrad2.addColorStop(0, 'rgba(15,2,2,0.35)');
        craterGrad2.addColorStop(0.5, 'rgba(40,6,6,0.15)');
        craterGrad2.addColorStop(1, 'rgba(0,0,0,0.0)');
        ctx.fillStyle = craterGrad2;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();

        const brightGrad = ctx.createRadialGradient(cx + r * 0.10, cy - r * 0.10, r * 0.05, cx, cy, r * 0.75);
        brightGrad.addColorStop(0, 'rgba(180,25,25,0.0)');
        brightGrad.addColorStop(0.3, 'rgba(160,20,20,0.12)');
        brightGrad.addColorStop(0.6, 'rgba(120,15,15,0.05)');
        brightGrad.addColorStop(1, 'rgba(0,0,0,0.0)');
        ctx.fillStyle = brightGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();

        const rimGrad = ctx.createRadialGradient(cx, cy, r * 0.88, cx, cy, r * 1.04);
        rimGrad.addColorStop(0, 'rgba(139,0,0,0.0)');
        rimGrad.addColorStop(0.4, 'rgba(200,25,25,0.65)');
        rimGrad.addColorStop(0.7, 'rgba(160,18,18,0.35)');
        rimGrad.addColorStop(0.9, 'rgba(100,10,10,0.10)');
        rimGrad.addColorStop(1, 'rgba(40,0,0,0.0)');
        ctx.fillStyle = rimGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, r * 1.04, 0, Math.PI * 2);
        ctx.fill();

        const texture = new THREE.CanvasTexture(canvas);
        const geo = new THREE.PlaneGeometry(28, 28);
        const mat = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            depthWrite: false,
            depthTest: true,
            fog: false,
            side: THREE.DoubleSide
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.visible = false;
        mesh.renderOrder = 1;
        Renderer3D.scene.add(mesh);
        return mesh;
    },

    _createBloodMoonCorona: function() {
        const size = 1024;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        const cx = size / 2;
        const cy = size / 2;

        const innerGrad = ctx.createRadialGradient(cx, cy, size * 0.20, cx, cy, size * 0.30);
        innerGrad.addColorStop(0, 'rgba(220,35,35,0.0)');
        innerGrad.addColorStop(0.15, 'rgba(240,50,50,0.60)');
        innerGrad.addColorStop(0.35, 'rgba(200,35,35,0.35)');
        innerGrad.addColorStop(0.60, 'rgba(150,20,20,0.12)');
        innerGrad.addColorStop(0.80, 'rgba(100,10,10,0.03)');
        innerGrad.addColorStop(1, 'rgba(60,0,0,0.0)');
        ctx.fillStyle = innerGrad;
        ctx.fillRect(0, 0, size, size);

        const outerGrad = ctx.createRadialGradient(cx, cy, size * 0.28, cx, cy, size * 0.48);
        outerGrad.addColorStop(0, 'rgba(180,25,25,0.25)');
        outerGrad.addColorStop(0.25, 'rgba(140,18,18,0.14)');
        outerGrad.addColorStop(0.50, 'rgba(100,12,20,0.05)');
        outerGrad.addColorStop(0.75, 'rgba(60,6,15,0.01)');
        outerGrad.addColorStop(1, 'rgba(30,0,8,0.0)');
        ctx.fillStyle = outerGrad;
        ctx.fillRect(0, 0, size, size);

        const falloffGrad = ctx.createRadialGradient(cx, cy, size * 0.40, cx, cy, size * 0.58);
        falloffGrad.addColorStop(0, 'rgba(100,10,30,0.08)');
        falloffGrad.addColorStop(0.4, 'rgba(60,5,20,0.03)');
        falloffGrad.addColorStop(0.7, 'rgba(30,2,10,0.01)');
        falloffGrad.addColorStop(1, 'rgba(15,0,5,0.0)');
        ctx.fillStyle = falloffGrad;
        ctx.fillRect(0, 0, size, size);

        const texture = new THREE.CanvasTexture(canvas);
        const geo = new THREE.PlaneGeometry(58, 58);
        const mat = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            depthWrite: false,
            depthTest: true,
            fog: false,
            side: THREE.DoubleSide
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.visible = false;
        mesh.renderOrder = 0;
        Renderer3D.scene.add(mesh);
        return mesh;
    },

    _createBloodMoonHalo: function() {
        const size = 1024;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        const cx = size / 2;
        const cy = size / 2;

        const grad = ctx.createRadialGradient(cx, cy, size * 0.34, cx, cy, size * 0.56);
        grad.addColorStop(0, 'rgba(100,12,22,0.0)');
        grad.addColorStop(0.2, 'rgba(90,10,20,0.10)');
        grad.addColorStop(0.4, 'rgba(70,8,18,0.06)');
        grad.addColorStop(0.6, 'rgba(50,5,15,0.03)');
        grad.addColorStop(0.8, 'rgba(30,2,8,0.01)');
        grad.addColorStop(1, 'rgba(15,0,4,0.0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, size, size);

        const texture = new THREE.CanvasTexture(canvas);
        const geo = new THREE.PlaneGeometry(110, 110);
        const mat = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            depthWrite: false,
            depthTest: false,
            fog: false,
            side: THREE.DoubleSide
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.visible = false;
        mesh.renderOrder = -1;
        Renderer3D.scene.add(mesh);
        return mesh;
    },

    _createBloodMoonParticles: function(count) {
        const positions = new Float32Array(count * 3);
        const basePositions = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);
        const sizes = new Float32Array(count);

        for (let i = 0; i < count; i++) {
            const theta = Math.random() * Math.PI * 2;
            const phi = (Math.random() - 0.5) * Math.PI * 0.7;
            const r = 4 + Math.random() * 14;
            const x = Math.cos(theta) * Math.cos(phi) * r;
            const y = Math.sin(phi) * r;
            const z = Math.sin(theta) * Math.cos(phi) * r;
            positions[i * 3] = x;
            positions[i * 3 + 1] = y;
            positions[i * 3 + 2] = z;
            basePositions[i * 3] = x;
            basePositions[i * 3 + 1] = y;
            basePositions[i * 3 + 2] = z;

            const colorChoice = Math.random();
            if (colorChoice < 0.35) {
                colors[i * 3] = 0.65 + Math.random() * 0.25;
                colors[i * 3 + 1] = 0.08 + Math.random() * 0.12;
                colors[i * 3 + 2] = 0.08 + Math.random() * 0.12;
            } else if (colorChoice < 0.65) {
                colors[i * 3] = 0.75 + Math.random() * 0.25;
                colors[i * 3 + 1] = 0.12 + Math.random() * 0.18;
                colors[i * 3 + 2] = 0.08 + Math.random() * 0.12;
            } else if (colorChoice < 0.85) {
                colors[i * 3] = 0.55 + Math.random() * 0.25;
                colors[i * 3 + 1] = 0.05 + Math.random() * 0.10;
                colors[i * 3 + 2] = 0.18 + Math.random() * 0.22;
            } else {
                colors[i * 3] = 0.35 + Math.random() * 0.25;
                colors[i * 3 + 1] = 0.03 + Math.random() * 0.08;
                colors[i * 3 + 2] = 0.30 + Math.random() * 0.25;
            }
            sizes[i] = 0.04 + Math.random() * 0.08;
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

        const mat = new THREE.PointsMaterial({
            size: 0.15,
            vertexColors: true,
            transparent: true,
            opacity: 0.0,
            depthWrite: false,
            depthTest: true,
            fog: false,
            sizeAttenuation: true
        });

        const points = new THREE.Points(geo, mat);
        points.visible = false;
        points.renderOrder = 3;
        Renderer3D.scene.add(points);

        this._bloodParticlePositions = positions;
        this._bloodParticleBasePositions = basePositions;
        return points;
    },

    _createBloodMoonAtmosphere: function() {
        const geo = new THREE.PlaneGeometry(160, 160);
        const mat = new THREE.MeshBasicMaterial({
            color: 0x1a0208,
            transparent: true,
            opacity: 0.0,
            depthWrite: false,
            depthTest: false,
            fog: false,
            side: THREE.DoubleSide
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.visible = false;
        mesh.renderOrder = -2;
        Renderer3D.scene.add(mesh);
        return mesh;
    },

    _setEventVisibility: function(visible) {
        const set = (obj, v) => { if (obj) obj.visible = v; };
        set(this.eclipseDisc, visible);
        set(this.eclipseCorona, visible);
        set(this.eclipseHalo, visible);
        this.eclipseRays.forEach(r => set(r, visible));
        this.eclipseRibbons.forEach(r => set(r, visible));
        set(this.eclipseParticles, visible);
        set(this.bloodMoonDisc, visible);
        set(this.bloodMoonCorona, visible);
        set(this.bloodMoonHalo, visible);
        set(this.bloodMoonParticles, visible);
        set(this.bloodMoonAtmosphere, visible);
    },

    _destroyEventVisuals: function() {
        const dispose = (obj) => {
            if (!obj) return;
            if (obj.parent) obj.parent.remove(obj);
            if (obj.geometry && obj.geometry !== Renderer3D.scene) obj.geometry.dispose();
            if (obj.material) {
                if (obj.material.map) obj.material.map.dispose();
                obj.material.dispose();
            }
        };
        dispose(this.eclipseDisc);
        dispose(this.eclipseCorona);
        dispose(this.eclipseHalo);
        this.eclipseRays.forEach(dispose);
        this.eclipseRibbons.forEach(dispose);
        dispose(this.eclipseParticles);
        dispose(this.bloodMoonDisc);
        dispose(this.bloodMoonCorona);
        dispose(this.bloodMoonHalo);
        dispose(this.bloodMoonParticles);
        dispose(this.bloodMoonAtmosphere);
        this.eclipseDisc = null;
        this.eclipseCorona = null;
        this.eclipseHalo = null;
        this.eclipseRays = [];
        this.eclipseRibbons = [];
        this.eclipseParticles = null;
        this.bloodMoonDisc = null;
        this.bloodMoonCorona = null;
        this.bloodMoonHalo = null;
        this.bloodMoonParticles = null;
        this.bloodMoonAtmosphere = null;
        this._particlePositions = null;
        this._particleBasePositions = null;
        this._ribbonBasePositions = [];
        this._ribbonBaseRotations = [];
        this._rayBaseRotations = [];
        this._rayBaseLengths = [];
        this._bloodParticlePositions = null;
        this._bloodParticleBasePositions = null;
    },

    onPhaseChanged: function(oldPhase, newPhase) {
        if (this.state === 'ACTIVE' || this.state === 'PEAK' || this.state === 'ENDING' || this.state === 'WARNING') {
            if (this._isEventIncompatibleWithPhase(newPhase)) {
                this.stopEvent();
                return;
            }
            this._phaseDuration = TimeCycle.PHASE_DURATIONS[newPhase] || 420;
            this._phaseStartTime = TimeCycle.cycleTime;
            return;
        }

        if (this.state === 'IDLE' || this.state === 'SCHEDULED') {
            if (this._scheduledEvent && this._scheduledPhase === oldPhase && oldPhase !== newPhase) {
                const elapsed = TimeCycle.cycleTime - this._phaseStartTime;
                if (elapsed < this._scheduledTime) {
                    this._scheduledEvent = null;
                    this._scheduledPhase = null;
                    this._scheduledTime = 0;
                    this.state = 'IDLE';
                    console.log('Scheduled ' + oldPhase.toUpperCase() + ' event cancelled - phase transition');
                    return;
                }
            }

            this._lastPhase = oldPhase;
            this._phaseDuration = TimeCycle.PHASE_DURATIONS[newPhase] || 420;
            this._phaseStartTime = TimeCycle.cycleTime;

            if (!this.autoMode) return;
            if (this._scheduledEvent && this._scheduledPhase === newPhase) {
                this._tryScheduleScheduled(newPhase);
                return;
            }
            this._tryRollNewEvent(newPhase);
        }
    },

    _isEventIncompatibleWithPhase: function(phase) {
        if (this.currentEvent === 'ECLIPSE' && phase !== CONFIG.PHASE_DAY) return true;
        if (this.currentEvent === 'BLOOD_MOON' && phase !== CONFIG.PHASE_NIGHT) return true;
        return false;
    },

    _tryRollNewEvent: function(phase) {
        if (phase === CONFIG.PHASE_DAY) {
            if (Math.random() < CONFIG.SPECIAL_EVENT_CONFIG.eclipseChance) {
                this._scheduledEvent = 'ECLIPSE';
                this._scheduledPhase = phase;
                this._scheduledTime = Math.random() * CONFIG.SPECIAL_EVENT_CONFIG.maxStartOffset;
                this.state = 'SCHEDULED';
                this._phaseStartTime = TimeCycle.cycleTime;
                this._phaseDuration = TimeCycle.PHASE_DURATIONS[phase];
                console.log('🌘 Eclipse scheduled for ' + this._scheduledTime.toFixed(1) + 's into DAY');
            }
        } else if (phase === CONFIG.PHASE_NIGHT) {
            if (Math.random() < CONFIG.SPECIAL_EVENT_CONFIG.bloodMoonChance) {
                this._scheduledEvent = 'BLOOD_MOON';
                this._scheduledPhase = phase;
                this._scheduledTime = Math.random() * CONFIG.SPECIAL_EVENT_CONFIG.maxStartOffset;
                this.state = 'SCHEDULED';
                this._phaseStartTime = TimeCycle.cycleTime;
                this._phaseDuration = TimeCycle.PHASE_DURATIONS[phase];
                console.log('🩸 Blood Moon scheduled for ' + this._scheduledTime.toFixed(1) + 's into NIGHT');
            }
        }
    },

    _tryScheduleScheduled: function(phase) {
        const elapsed = TimeCycle.cycleTime - this._phaseStartTime;
        if (elapsed >= this._scheduledTime) {
            this._startEvent(this._scheduledEvent);
            this._scheduledEvent = null;
            this._scheduledPhase = null;
            this._scheduledTime = 0;
        }
    },

    _startEvent: function(eventType) {
        this.currentEvent = eventType;
        this.state = 'WARNING';
        this.eventTimer = 0;
        this.eventEndTime = CONFIG.SPECIAL_EVENT_CONFIG.eventDuration;
        this.warningTriggered = false;
        this.peakTriggered = false;
        this.bloodPulseTimer = 0;
        this.bloodPulseActive = false;
        this.peakTimer = 0;
        this.peakPulseTimer = 0;
        this.peakPulseActive = false;
        this.eclipseVisualScale = 1.0;
        this.bloodMoonColorLerp = 0.0;
        this.eventLightIntensity = 1.0;
        this.eventAmbientBoost = 0.0;

        this._applyBaseEventLighting(eventType, 0.0);
        this._setEventVisibility(true);

        if (eventType === 'ECLIPSE') {
            this._showNotification('🌘 ECLIPSE APPROACHING');
        } else if (eventType === 'BLOOD_MOON') {
            this._showNotification('🩸 BLOOD MOON APPROACHING');
        }

        this._emit('started', { event: eventType });
        console.log(eventType + ' WARNING started');
    },

    update: function(deltaTimeMs) {
        const dt = deltaTimeMs / 1000;

        if (this.state === 'IDLE') {
            this._updateIdle(dt);
            return;
        }

        if (this.state === 'SCHEDULED') {
            this._updateScheduled(dt);
            return;
        }

        this.eventTimer += dt;

        if (this.state === 'WARNING') {
            this._updateWarning(dt);
        } else if (this.state === 'ACTIVE') {
            this._updateActive(dt);
        } else if (this.state === 'PEAK') {
            this._updatePeak(dt);
        } else if (this.state === 'ENDING') {
            this._updateEnding(dt);
        }

        this._updateVisuals(dt);
    },

    _updateIdle: function(dt) {
        if (this.state !== 'IDLE') return;
        if (typeof TimeCycle !== 'undefined' && TimeCycle.isRunning) {
            const phase = TimeCycle.currentPhase;
            if (this._lastPhase !== phase) {
                this._lastPhase = phase;
            }
        }
    },

    _updateScheduled: function(dt) {
        if (this.state !== 'SCHEDULED') return;
        const elapsed = TimeCycle.cycleTime - this._phaseStartTime;
        const remaining = this._scheduledTime - elapsed;
        if (remaining <= CONFIG.SPECIAL_EVENT_CONFIG.warningDuration && !this.warningTriggered) {
            this.warningTriggered = true;
            this._startEvent(this._scheduledEvent);
            this._scheduledEvent = null;
            this._scheduledPhase = null;
            this._scheduledTime = 0;
        }
    },

    _updateWarning: function(dt) {
        const warningDur = CONFIG.SPECIAL_EVENT_CONFIG.warningDuration;
        if (this.eventTimer >= warningDur) {
            this.eventTimer -= warningDur;
            this.state = 'ACTIVE';
            this._applyEventModifiers();
            this._emit('active', { event: this.currentEvent });
            console.log(this.currentEvent + ' ACTIVE');
        }
    },

    _updateActive: function(dt) {
        const cfg = CONFIG.SPECIAL_EVENT_CONFIG;
        const eclipseCfg = cfg.eclipse;

        if (this.currentEvent === 'ECLIPSE') {
            const peakStart = eclipseCfg.peakDuration;
            if (this.eventTimer >= peakStart && !this.peakTriggered) {
                this.peakTriggered = true;
                this.state = 'PEAK';
                this.peakTimer = 0;
                this.peakPulseTimer = 0;
                this.peakPulseActive = false;
                this._emit('peak', { event: 'ECLIPSE' });
                console.log('🌘 Eclipse PEAK');
            }
        } else if (this.currentEvent === 'BLOOD_MOON') {
            this.bloodPulseTimer += dt;
            if (this.bloodPulseTimer >= cfg.bloodMoon.pulseInterval && !this.bloodPulseActive) {
                this.bloodPulseActive = true;
                this.bloodPulseEndTime = this.eventTimer + cfg.bloodMoon.pulseDuration;
                this._applyBloodPulseModifiers();
                this._emit('bloodPulse', { event: 'BLOOD_MOON' });
                console.log('🩸 Blood Pulse triggered');
            }
            if (this.bloodPulseActive && this.eventTimer >= this.bloodPulseEndTime) {
                this.bloodPulseActive = false;
                this.bloodPulseTimer = 0;
                this._removeBloodPulseModifiers();
            }
        }

        if (this.eventTimer >= this.eventEndTime) {
            this._startEnding();
        }
    },

    _updatePeak: function(dt) {
        const eclipseCfg = CONFIG.SPECIAL_EVENT_CONFIG.eclipse;
        const peakDuration = eclipseCfg.peakDuration;
        if (this.eventTimer >= peakDuration + peakDuration) {
            this.state = 'ACTIVE';
            this.eventTimer = peakDuration + peakDuration;
            this.peakTriggered = true;
            this.peakTimer = 0;
            this.peakPulseTimer = 0;
            this.peakPulseActive = false;
            console.log('🌘 Eclipse recovery');
        }

        this.peakPulseTimer += dt;
        if (!this.peakPulseActive && this.peakPulseTimer >= 0.5 + Math.random() * 0.5) {
            this.peakPulseActive = true;
            this.peakPulseTimer = 0;
        }
        if (this.peakPulseActive && this.peakPulseTimer >= eclipseCfg.peakPulseDuration) {
            this.peakPulseActive = false;
            this.peakPulseTimer = 0;
        }

        if (this.eventTimer >= this.eventEndTime) {
            this._startEnding();
        }
    },

    _updateEnding: function(dt) {
        const endDur = 5.0;
        if (this.eventTimer >= endDur) {
            this.stopEvent();
            return;
        }
        const t = this.eventTimer / endDur;
        const smoothT = t * t * (3 - 2 * t);
        this.eclipseVisualScale = 1.0 + 0.15 * (1.0 - smoothT);
        this.eventLightIntensity = 1.0;
        this.eventAmbientBoost = 0.0;
        if (this.bloodPulseActive) {
            this._removeBloodPulseModifiers();
            this.bloodPulseActive = false;
        }
    },

    _startEnding: function() {
        this.state = 'ENDING';
        this.eventTimer = 0;
        this._removeEventModifiers();
        this._emit('ending', { event: this.currentEvent });
        console.log(this.currentEvent + ' ENDING');
    },

    stopEvent: function() {
        const wasActive = this.state === 'ACTIVE' || this.state === 'PEAK' || this.state === 'ENDING' || this.state === 'WARNING';
        this._removeEventModifiers();
        this.currentEvent = null;
        this.state = 'IDLE';
        this.eventTimer = 0;
        this.eventEndTime = 0;
        this.warningTriggered = false;
        this.peakTriggered = false;
        this.bloodPulseTimer = 0;
        this.bloodPulseActive = false;
        this.bloodPulseEndTime = 0;
        this.peakTimer = 0;
        this.peakPulseTimer = 0;
        this.peakPulseActive = false;
        this.eclipseVisualScale = 1.0;
        this.bloodMoonColorLerp = 0.0;
        this.eventLightIntensity = 1.0;
        this.eventAmbientBoost = 0.0;
        this._scheduledEvent = null;
        this._scheduledPhase = null;
        this._scheduledTime = 0;
        this._setEventVisibility(false);
        if (wasActive) this._emit('stopped', {});
        console.log('⏹ Event stopped');
    },

    forceStartEclipse: function() {
        if (typeof TimeCycle === 'undefined') return;
        if (TimeCycle.currentPhase !== CONFIG.PHASE_DAY) {
            TimeCycle.forcePhase(CONFIG.PHASE_DAY);
            if (typeof AudioController !== 'undefined' && AudioController.playTransitionSound) {
                AudioController.playTransitionSound(CONFIG.PHASE_DAY);
            }
        }
        this._scheduledEvent = null;
        this._scheduledPhase = null;
        this._scheduledTime = 0;
        this._startEvent('ECLIPSE');
    },

    forceStartBloodMoon: function() {
        if (typeof TimeCycle === 'undefined') return;
        if (TimeCycle.currentPhase !== CONFIG.PHASE_NIGHT) {
            TimeCycle.forcePhase(CONFIG.PHASE_NIGHT);
            if (typeof AudioController !== 'undefined' && AudioController.playTransitionSound) {
                AudioController.playTransitionSound(CONFIG.PHASE_NIGHT);
            }
        }
        this._scheduledEvent = null;
        this._scheduledPhase = null;
        this._scheduledTime = 0;
        this._startEvent('BLOOD_MOON');
    },

    triggerEclipsePeak: function() {
        if (this.currentEvent !== 'ECLIPSE' || this.state !== 'ACTIVE') return;
        this.state = 'PEAK';
        this.eventTimer = CONFIG.SPECIAL_EVENT_CONFIG.eclipse.peakDuration;
        this.peakTriggered = true;
        this.peakTimer = 0;
        this.peakPulseTimer = 0;
        this.peakPulseActive = false;
        this._emit('peak', { event: 'ECLIPSE' });
        console.log('⚡ Eclipse peak forced');
    },

    triggerBloodPulse: function() {
        if (this.currentEvent !== 'BLOOD_MOON' || this.state !== 'ACTIVE') return;
        if (this.bloodPulseActive) return;
        this.bloodPulseActive = true;
        this.bloodPulseEndTime = this.eventTimer + CONFIG.SPECIAL_EVENT_CONFIG.bloodMoon.pulseDuration;
        this._applyBloodPulseModifiers();
        this._emit('bloodPulse', { event: 'BLOOD_MOON' });
        console.log('🩸 Blood pulse forced');
    },

    setAutoMode: function(enabled) {
        this.autoMode = !!enabled;
        if (!enabled) {
            this._scheduledEvent = null;
            this._scheduledPhase = null;
            this._scheduledTime = 0;
            if (this.state === 'SCHEDULED') {
                this.state = 'IDLE';
            }
        }
        this._emit('autoModeChanged', { enabled: this.autoMode });
    },

    getStatus: function() {
        const info = {
            currentEvent: this.currentEvent,
            state: this.state,
            timeLeft: Math.max(0, this.eventEndTime - this.eventTimer),
            currentPhase: typeof TimeCycle !== 'undefined' ? TimeCycle.currentPhase : 'unknown',
            autoEvents: this.autoMode,
            eclipseChance: CONFIG.SPECIAL_EVENT_CONFIG.eclipseChance,
            bloodMoonChance: CONFIG.SPECIAL_EVENT_CONFIG.bloodMoonChance
        };
        return info;
    },

    _applyBaseEventLighting: function(eventType, intensity) {
        if (!LightingController || !LightingController._lights) return;
        if (eventType === 'ECLIPSE') {
            const eclipseCfg = CONFIG.SPECIAL_EVENT_CONFIG.eclipse;
            const sunIntensity = THREE.MathUtils.lerp(eclipseCfg.sunIntensityMax, eclipseCfg.sunIntensityMin, intensity);
            if (LightingController._lights.directional) {
                LightingController._lights.directional.intensity = sunIntensity * 2.2;
            }
        }
    },

    _applyEventModifiers: function() {
        if (!GameState) return;
        const cfg = CONFIG.SPECIAL_EVENT_CONFIG;
        if (this.currentEvent === 'ECLIPSE') {
            GameState._specialEventZombieModifiers = cfg.eclipse.zombieModifiers;
            GameState._specialEventPlayerModifiers = cfg.eclipse.playerModifiers;
            GameState._specialEventRewardMultiplier = cfg.eclipse.rewardMultiplier;
            this._scaleZombieHp(cfg.eclipse.zombieModifiers.hp || 1);
        } else if (this.currentEvent === 'BLOOD_MOON') {
            GameState._specialEventZombieModifiers = cfg.bloodMoon.zombieModifiers;
            GameState._specialEventPlayerModifiers = cfg.bloodMoon.playerModifiers;
            GameState._specialEventRewardMultiplier = cfg.bloodMoon.rewardMultiplier;
            this._scaleZombieHp(cfg.bloodMoon.zombieModifiers.hp || 1);
        }
    },

    _scaleZombieHp: function(multiplier) {
        if (!GameState || !GameState.zombies) return;
        GameState.zombies.forEach(zombie => {
            if (zombie._preEventHp === undefined) {
                zombie._preEventHp = zombie.hp;
                zombie._preEventMaxHp = zombie.maxHp;
            }
            zombie.maxHp = Math.max(1, Math.round(zombie._preEventMaxHp * multiplier));
            zombie.hp = Math.max(1, Math.round(zombie.hp / (zombie._preEventMaxHp || 1) * zombie.maxHp));
        });
    },

    _restoreZombieHp: function() {
        if (!GameState || !GameState.zombies) return;
        GameState.zombies.forEach(zombie => {
            if (zombie._preEventHp !== undefined) {
                zombie.hp = Math.max(1, zombie._preEventHp);
                zombie.maxHp = Math.max(1, zombie._preEventMaxHp);
                zombie._preEventHp = undefined;
                zombie._preEventMaxHp = undefined;
            }
        });
    },

    _removeEventModifiers: function() {
        if (!GameState) return;
        GameState._specialEventZombieModifiers = null;
        GameState._specialEventPlayerModifiers = null;
        GameState._specialEventRewardMultiplier = 1;
        if (this.bloodPulseActive) {
            this._removeBloodPulseModifiers();
            this.bloodPulseActive = false;
        }
        this._restoreZombieHp();
    },

    _applyBloodPulseModifiers: function() {
        if (!GameState) return;
        GameState._bloodPulseActive = true;
        GameState._bloodPulseZombieModifiers = CONFIG.SPECIAL_EVENT_CONFIG.bloodMoon.pulseZombieBuff;
    },

    _removeBloodPulseModifiers: function() {
        if (!GameState) return;
        GameState._bloodPulseActive = false;
        GameState._bloodPulseZombieModifiers = null;
    },

    _updateVisuals: function(dt) {
        if (!Renderer3D || !Renderer3D.scene || !Renderer3D.camera) return;

        this._updateEventLightingState();

        if (this.currentEvent === 'ECLIPSE' && this.eclipseDisc) {
            const sunPos = Renderer3D.sunMesh.position;
            const sunScale = Renderer3D.sunMesh.scale.x;
            const pos = sunPos.clone();
            const lookTarget = Renderer3D.camera.position;

            this.eclipseDisc.position.copy(pos);
            this.eclipseDisc.lookAt(lookTarget);
            this.eclipseCorona.position.copy(pos);
            this.eclipseCorona.lookAt(lookTarget);
            this.eclipseHalo.position.copy(pos);
            this.eclipseHalo.lookAt(lookTarget);

            const geometrySize = 32;
            const scale = sunScale * this.eclipseVisualScale;
            this.eclipseDisc.scale.setScalar(Math.max(0.001, scale));
            this.eclipseCorona.scale.setScalar(Math.max(0.001, scale * 1.45));
            this.eclipseHalo.scale.setScalar(Math.max(0.001, scale * 2.0));

            const t = this.eventTimer / CONFIG.SPECIAL_EVENT_CONFIG.eventDuration;
            let opacity = 0;
            if (this.state === 'WARNING') {
                opacity = 0.5 * (this.eventTimer / CONFIG.SPECIAL_EVENT_CONFIG.warningDuration);
            } else if (this.state === 'ACTIVE') {
                opacity = 0.5 + 0.5 * Math.min(1, this.eventTimer / 60);
            } else if (this.state === 'PEAK') {
                opacity = 1.0;
                if (this.peakPulseActive) {
                    opacity = 1.0 + 0.25 * Math.sin(this.peakPulseTimer / CONFIG.SPECIAL_EVENT_CONFIG.eclipse.peakPulseDuration * Math.PI);
                }
            } else if (this.state === 'ENDING') {
                opacity = Math.max(0, 1.0 - (this.eventTimer / 5.0));
            }
            const clampedOpacity = Math.max(0, Math.min(1, opacity));
            this.eclipseDisc.material.opacity = clampedOpacity;
            this.eclipseCorona.material.opacity = Math.max(0, Math.min(1, clampedOpacity * 0.95));
            this.eclipseHalo.material.opacity = Math.max(0, Math.min(1, clampedOpacity * 0.60));

            this.eclipseRays.forEach((ray, i) => {
                ray.visible = this.eclipseDisc.visible;
                ray.position.copy(pos);
                ray.lookAt(lookTarget);
                const rot = this._rayBaseRotations[i];
                ray.rotation.z = rot.angle + Math.sin(dt * 0.4 + i) * 0.15;
                ray.rotation.x = rot.tilt + Math.cos(dt * 0.3 + i * 0.7) * 0.1;
                const rayOpacity = Math.max(0, Math.min(1, clampedOpacity * (0.5 + 0.5 * Math.sin(dt * 0.9 + i * 1.1))));
                ray.material.opacity = rayOpacity;
                if (this.state === 'PEAK' && this.peakPulseActive) {
                    ray.material.opacity = Math.max(0, Math.min(1, ray.material.opacity * 1.4));
                }
            });

            this.eclipseRibbons.forEach((ribbon, i) => {
                ribbon.visible = this.eclipseDisc.visible;
                ribbon.position.copy(pos);
                ribbon.lookAt(lookTarget);
                const rot = this._ribbonBaseRotations[i];
                ribbon.rotation.x = rot.x + Math.sin(dt * rot.waveSpeed + i) * rot.waveAmp;
                ribbon.rotation.y = rot.y + dt * rot.orbitSpeed;
                ribbon.rotation.z = rot.z + Math.cos(dt * 0.7 + i * 1.5) * 0.25;
                const ribbonOpacity = Math.max(0, Math.min(1, clampedOpacity * 0.7 * (0.5 + 0.5 * Math.sin(dt * 1.0 + i * 1.5))));
                ribbon.material.opacity = ribbonOpacity;
                if (this.state === 'PEAK' && this.peakPulseActive) {
                    ribbon.material.opacity = Math.max(0, Math.min(1, ribbon.material.opacity * 1.35));
                }
            });

            if (this.eclipseParticles && this.eclipseParticles.visible) {
                const posAttr = this.eclipseParticles.geometry.attributes.position;
                const baseAttr = this._particleBasePositions;
                for (let i = 0; i < posAttr.count; i++) {
                    const bx = baseAttr[i * 3];
                    const by = baseAttr[i * 3 + 1];
                    const bz = baseAttr[i * 3 + 2];
                    const drift = Math.sin(dt * 0.7 + i * 0.25) * 0.6;
                    const driftY = Math.cos(dt * 0.5 + i * 0.35) * 0.4;
                    const driftZ = Math.cos(dt * 0.6 + i * 0.3) * 0.5;
                    posAttr.array[i * 3] = bx + drift;
                    posAttr.array[i * 3 + 1] = by + driftY;
                    posAttr.array[i * 3 + 2] = bz + driftZ;
                }
                posAttr.needsUpdate = true;
                const particleOpacity = Math.max(0, Math.min(1, clampedOpacity * 0.85));
                this.eclipseParticles.material.opacity = this.state === 'PEAK' && this.peakPulseActive ?
                    Math.min(1, particleOpacity * 1.2) : particleOpacity;
            }
        }

        if (this.currentEvent === 'BLOOD_MOON' && this.bloodMoonDisc) {
            const moonPos = Renderer3D.moonMesh.position;
            const pos = moonPos.clone();
            const lookTarget = Renderer3D.camera.position;

            this.bloodMoonDisc.position.copy(pos);
            this.bloodMoonDisc.lookAt(lookTarget);
            this.bloodMoonCorona.position.copy(pos);
            this.bloodMoonCorona.lookAt(lookTarget);
            this.bloodMoonHalo.position.copy(pos);
            this.bloodMoonHalo.lookAt(lookTarget);

            const baseScale = Renderer3D._getWorldSizeForScreenDiameter(pos, Renderer3D.MOON_TARGET_PIXEL_DIAMETER);
            if (baseScale) {
                const geometrySize = 28;
                const scale = (baseScale / geometrySize) * (CONFIG.SPECIAL_EVENT_CONFIG.bloodMoon.moonVisualScaleMultiplier || 1.15);
                this.bloodMoonDisc.scale.setScalar(Math.max(0.001, scale));
                this.bloodMoonCorona.scale.setScalar(Math.max(0.001, scale * 1.6));
                this.bloodMoonHalo.scale.setScalar(Math.max(0.001, scale * 2.2));
            }

            const warningDur = CONFIG.SPECIAL_EVENT_CONFIG.warningDuration;
            if (this.state === 'ENDING') {
                this.bloodMoonColorLerp = Math.max(0, this.bloodMoonColorLerp - dt / 5.0);
            } else if (this.state === 'WARNING') {
                this.bloodMoonColorLerp = Math.min(1.0, this.bloodMoonColorLerp + dt / 5.0);
            } else {
                this.bloodMoonColorLerp = 1.0;
            }
            const bmLerp = this.bloodMoonColorLerp;
            const pulse = this.bloodPulseActive ?
                0.20 * Math.sin((this.eventTimer - (this.bloodPulseEndTime - CONFIG.SPECIAL_EVENT_CONFIG.bloodMoon.pulseDuration)) / CONFIG.SPECIAL_EVENT_CONFIG.bloodMoon.pulseDuration * Math.PI) : 0;

            this.bloodMoonDisc.material.opacity = Math.max(0, Math.min(1, bmLerp));
            this.bloodMoonCorona.material.opacity = Math.max(0, Math.min(1, bmLerp * 0.85 + pulse * 0.3));
            this.bloodMoonHalo.material.opacity = Math.max(0, Math.min(1, bmLerp * 0.40 + pulse * 0.15));
            this.bloodMoonAtmosphere.material.opacity = Math.max(0, Math.min(1, bmLerp * 0.04 + pulse * 0.02));
            this.bloodMoonAtmosphere.position.copy(Renderer3D.camera.position);
            this.bloodMoonAtmosphere.lookAt(Renderer3D.camera.position);
            const dist = Renderer3D.cameraDistance * 0.5;
            this.bloodMoonAtmosphere.position.y -= dist * 0.25;
            this.bloodMoonAtmosphere.scale.setScalar(Math.max(1, dist * 1.1));

            if (this.bloodMoonParticles && this.bloodMoonParticles.visible) {
                const posAttr = this.bloodMoonParticles.geometry.attributes.position;
                const baseAttr = this._bloodParticleBasePositions;
                for (let i = 0; i < posAttr.count; i++) {
                    const bx = baseAttr[i * 3];
                    const by = baseAttr[i * 3 + 1];
                    const bz = baseAttr[i * 3 + 2];
                    const drift = Math.sin(dt * 0.5 + i * 0.4) * 0.35;
                    const driftY = Math.cos(dt * 0.4 + i * 0.5) * 0.25;
                    const driftZ = Math.cos(dt * 0.45 + i * 0.35) * 0.3;
                    posAttr.array[i * 3] = bx + drift;
                    posAttr.array[i * 3 + 1] = by + driftY;
                    posAttr.array[i * 3 + 2] = bz + driftZ;
                }
                posAttr.needsUpdate = true;
                const bpOpacity = Math.max(0, Math.min(1, bmLerp * 0.55));
                this.bloodMoonParticles.material.opacity = this.bloodPulseActive ?
                    Math.min(1, bpOpacity * 1.5) : bpOpacity;
            }
        }
    },

    _updateEventLightingState: function() {
        if (!this.currentEvent) {
            this.eventLightIntensity = 1.0;
            this.eventAmbientBoost = 0.0;
            return;
        }
        if (this.currentEvent === 'ECLIPSE') {
            if (this.state === 'WARNING') {
                this.eventLightIntensity = 1.0;
                this.eventAmbientBoost = 0.0;
            } else if (this.state === 'ACTIVE') {
                const activeTime = this.eventTimer - CONFIG.SPECIAL_EVENT_CONFIG.warningDuration;
                const activeDur = CONFIG.SPECIAL_EVENT_CONFIG.eclipse.peakDuration;
                const t = Math.min(1, Math.max(0, activeTime / activeDur));
                const smooth = t * t * (3 - 2 * t);
                this.eventLightIntensity = 1.0 - 0.75 * smooth;
                this.eventAmbientBoost = 0.22 * smooth;
            } else if (this.state === 'PEAK') {
                this.eventLightIntensity = 0.25;
                this.eventAmbientBoost = 0.22;
            } else if (this.state === 'ENDING') {
                const endDur = 5.0;
                const t = Math.min(1, this.eventTimer / endDur);
                const smooth = t * t * (3 - 2 * t);
                this.eventLightIntensity = 0.25 + 0.75 * smooth;
                this.eventAmbientBoost = 0.22 * (1.0 - smooth);
            }
        } else if (this.currentEvent === 'BLOOD_MOON') {
            if (this.state === 'WARNING') {
                this.eventLightIntensity = 1.0;
                this.eventAmbientBoost = 0.08 * Math.min(1, this.eventTimer / 5.0);
            } else if (this.state === 'ACTIVE' || this.state === 'PEAK') {
                this.eventLightIntensity = 1.0;
                this.eventAmbientBoost = 0.14;
                if (this.bloodPulseActive) {
                    this.eventAmbientBoost = Math.min(0.22, this.eventAmbientBoost + 0.08);
                }
            } else if (this.state === 'ENDING') {
                const endDur = 5.0;
                const t = Math.min(1, this.eventTimer / endDur);
                const smooth = t * t * (3 - 2 * t);
                this.eventLightIntensity = 1.0;
                this.eventAmbientBoost = 0.14 * (1.0 - smooth);
            }
        }
    },

    _showNotification: function(text) {
        const notif = document.getElementById('phase-notification');
        if (notif) {
            notif.textContent = text;
            notif.style.display = 'block';
            notif.style.opacity = '1';
            const fadeOut = () => {
                notif.style.opacity = '0';
                setTimeout(() => {
                    if (notif.style.opacity === '0') notif.style.display = 'none';
                }, 300);
            };
            setTimeout(fadeOut, 4000);
        }
    },

    on: function(event, callback) {
        if (typeof callback === 'function') {
            this._listeners.push({ event, callback });
        }
    },

    off: function(event, callback) {
        this._listeners = this._listeners.filter(l => l.event !== event || l.callback !== callback);
    },

    _emit: function(event, data) {
        this._listeners.forEach(l => {
            if (l.event === event) {
                try { l.callback(data); } catch (e) { console.error('SpecialEvent listener error:', e); }
            }
        });
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = SpecialEventManager;
}
