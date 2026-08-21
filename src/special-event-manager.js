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
    eclipsePeakIntensity: 0.0,
    bloodMoonColorLerp: 0.0,
    bloodPeakIntensity: 0.0,
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

    _visualTime: 0,
    _moonWasVisible: false,
    _moonOriginalMaterial: null,
    _moonOriginalColor: null,
    _moonOriginalOpacity: 0,
    _moonOriginalScale: new THREE.Vector3(),
    _sunWasVisible: false,
    _sunOriginalMaterial: null,
    _sunOriginalColor: null,
    _sunOriginalOpacity: 0,
    _sunOriginalScale: new THREE.Vector3(),

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
        this.eclipseVisualScale = CONFIG.SPECIAL_EVENT_CONFIG.eclipse.visualScaleMultiplier || 1.15;
        this.eclipsePeakIntensity = 0.0;
        this.bloodPeakIntensity = 0.0;
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
        this._visualTime = 0;
        this._moonWasVisible = false;
        this._moonOriginalMaterial = null;
        this._moonOriginalColor = null;
        this._moonOriginalOpacity = 0;
        this._moonOriginalScale = new THREE.Vector3();
        this._sunWasVisible = false;
        this._sunOriginalMaterial = null;
        this._sunOriginalColor = null;
        this._sunOriginalOpacity = 0;
        this._sunOriginalScale = new THREE.Vector3();
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

        this._disableAllSpecialEventVisuals();
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

        const darkGrad = ctx.createRadialGradient(cx, cy, innerR * 0.02, cx, cy, innerR);
        darkGrad.addColorStop(0, '#010208');
        darkGrad.addColorStop(0.2, '#02040d');
        darkGrad.addColorStop(0.5, '#04071a');
        darkGrad.addColorStop(0.8, '#080d2a');
        darkGrad.addColorStop(1, '#0c1238');
        ctx.fillStyle = darkGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
        ctx.fill();

        const rimGrad = ctx.createRadialGradient(cx, cy, innerR * 0.88, cx, cy, innerR * 1.12);
        rimGrad.addColorStop(0, 'rgba(20,18,60,0.0)');
        rimGrad.addColorStop(0.2, 'rgba(40,32,100,0.55)');
        rimGrad.addColorStop(0.5, 'rgba(60,48,140,0.22)');
        rimGrad.addColorStop(0.8, 'rgba(80,64,170,0.06)');
        rimGrad.addColorStop(1, 'rgba(50,38,130,0.0)');
        ctx.fillStyle = rimGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, innerR * 1.12, 0, Math.PI * 2);
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

        const whiteRing = ctx.createRadialGradient(cx, cy, size * 0.14, cx, cy, size * 0.22);
        whiteRing.addColorStop(0, 'rgba(255,255,255,0.0)');
        whiteRing.addColorStop(0.10, 'rgba(255,252,255,0.85)');
        whiteRing.addColorStop(0.25, 'rgba(245,240,255,0.55)');
        whiteRing.addColorStop(0.45, 'rgba(225,215,255,0.20)');
        whiteRing.addColorStop(0.70, 'rgba(190,175,245,0.05)');
        whiteRing.addColorStop(1, 'rgba(160,140,230,0.0)');
        ctx.fillStyle = whiteRing;
        ctx.fillRect(0, 0, size, size);

        const lavenderGrad = ctx.createRadialGradient(cx, cy, size * 0.18, cx, cy, size * 0.30);
        lavenderGrad.addColorStop(0, 'rgba(235,225,255,0.60)');
        lavenderGrad.addColorStop(0.20, 'rgba(210,195,255,0.40)');
        lavenderGrad.addColorStop(0.45, 'rgba(170,150,245,0.15)');
        lavenderGrad.addColorStop(0.70, 'rgba(130,110,225,0.04)');
        lavenderGrad.addColorStop(1, 'rgba(100,80,200,0.0)');
        ctx.fillStyle = lavenderGrad;
        ctx.fillRect(0, 0, size, size);

        const violetGrad = ctx.createRadialGradient(cx, cy, size * 0.24, cx, cy, size * 0.44);
        violetGrad.addColorStop(0, 'rgba(150,130,245,0.25)');
        violetGrad.addColorStop(0.25, 'rgba(120,100,230,0.14)');
        violetGrad.addColorStop(0.50, 'rgba(90,70,210,0.05)');
        violetGrad.addColorStop(0.75, 'rgba(60,45,180,0.01)');
        violetGrad.addColorStop(1, 'rgba(40,28,150,0.0)');
        ctx.fillStyle = violetGrad;
        ctx.fillRect(0, 0, size, size);

        const blueGrad = ctx.createRadialGradient(cx, cy, size * 0.32, cx, cy, size * 0.54);
        blueGrad.addColorStop(0, 'rgba(70,90,230,0.12)');
        blueGrad.addColorStop(0.25, 'rgba(55,75,215,0.06)');
        blueGrad.addColorStop(0.55, 'rgba(40,60,190,0.02)');
        blueGrad.addColorStop(0.80, 'rgba(25,40,160,0.005)');
        blueGrad.addColorStop(1, 'rgba(15,25,130,0.0)');
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

        const grad = ctx.createRadialGradient(cx, cy, size * 0.28, cx, cy, size * 0.52);
        grad.addColorStop(0, 'rgba(90,75,210,0.0)');
        grad.addColorStop(0.30, 'rgba(75,60,190,0.14)');
        grad.addColorStop(0.55, 'rgba(55,40,160,0.06)');
        grad.addColorStop(0.75, 'rgba(35,25,120,0.02)');
        grad.addColorStop(1, 'rgba(20,12,80,0.0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, size, size);

        const texture = new THREE.CanvasTexture(canvas);
        const geo = new THREE.PlaneGeometry(80, 80);
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
        const sharedCanvas = document.createElement('canvas');
        sharedCanvas.width = 64;
        sharedCanvas.height = 256;
        const ctx = sharedCanvas.getContext('2d');
        const grad = ctx.createLinearGradient(0, 0, 0, 256);
        grad.addColorStop(0, 'rgba(255,252,255,0.0)');
        grad.addColorStop(0.08, 'rgba(245,240,255,0.65)');
        grad.addColorStop(0.20, 'rgba(210,200,255,0.38)');
        grad.addColorStop(0.40, 'rgba(150,130,245,0.14)');
        grad.addColorStop(0.65, 'rgba(100,80,210,0.04)');
        grad.addColorStop(0.85, 'rgba(60,40,170,0.01)');
        grad.addColorStop(1, 'rgba(40,25,140,0.0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 64, 256);
        const sharedTexture = new THREE.CanvasTexture(sharedCanvas);

        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.6;
            const length = 18 + Math.random() * 28;
            const width = 0.35 + Math.random() * 0.85;
            const geo = new THREE.PlaneGeometry(width, length);
            const mat = new THREE.MeshBasicMaterial({
                map: sharedTexture,
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
            this._rayBaseRotations.push({ angle: angle, tilt: (Math.random() - 0.5) * 0.7 });
            this._rayBaseLengths.push(length);
        }
        return rays;
    },

    _createEclipseRibbons: function(count) {
        const ribbons = [];
        const sharedCanvas = document.createElement('canvas');
        sharedCanvas.width = 64;
        sharedCanvas.height = 256;
        const ctx = sharedCanvas.getContext('2d');
        const grad = ctx.createLinearGradient(0, 0, 0, 256);
        grad.addColorStop(0, 'rgba(200,220,255,0.0)');
        grad.addColorStop(0.10, 'rgba(170,190,255,0.60)');
        grad.addColorStop(0.25, 'rgba(140,160,255,0.35)');
        grad.addColorStop(0.45, 'rgba(120,130,245,0.12)');
        grad.addColorStop(0.70, 'rgba(90,80,215,0.03)');
        grad.addColorStop(0.90, 'rgba(60,45,180,0.01)');
        grad.addColorStop(1, 'rgba(40,28,150,0.0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 64, 256);
        const sharedTexture = new THREE.CanvasTexture(sharedCanvas);

        for (let i = 0; i < count; i++) {
            const segments = 12;
            const length = 20 + Math.random() * 16;
            const widthBase = 1.2 + Math.random() * 2.5;
            const geo = new THREE.BufferGeometry();
            const positions = new Float32Array((segments + 1) * 2 * 3);
            const uvs = new Float32Array((segments + 1) * 2 * 2);
            const indices = [];
            for (let s = 0; s <= segments; s++) {
                const t = s / segments;
                const y = t * length;
                const wave = Math.sin(t * Math.PI * 2.5) * 1.8;
                const w = widthBase * (1.0 - t * 0.5) * (0.7 + 0.3 * Math.sin(t * Math.PI));
                for (let side = -1; side <= 1; side += 2) {
                    const idx = (s * 2 + (side === -1 ? 0 : 1));
                    positions[idx * 3] = wave * side;
                    positions[idx * 3 + 1] = y;
                    positions[idx * 3 + 2] = side * w / 2;
                    uvs[idx * 2] = side === -1 ? 0 : 1;
                    uvs[idx * 2 + 1] = t;
                }
                if (s < segments) {
                    const a = s * 2, b = s * 2 + 1, c = (s + 1) * 2, d = (s + 1) * 2 + 1;
                    indices.push(a, c, b, b, c, d);
                }
            }
            geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
            geo.setIndex(indices);
            geo.computeVertexNormals();

            const mat = new THREE.MeshBasicMaterial({
                map: sharedTexture,
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
                orbitSpeed: 0.08 + Math.random() * 0.22,
                waveSpeed: 0.5 + Math.random() * 0.9,
                waveAmp: 0.3 + Math.random() * 0.7,
                waveFreq: 2.0 + Math.random() * 1.5
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
            const r = 6 + Math.random() * 22;
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
                colors[i * 3] = 0.75 + Math.random() * 0.25;
                colors[i * 3 + 1] = 0.75 + Math.random() * 0.25;
                colors[i * 3 + 2] = 1.0;
            } else if (colorChoice < 0.60) {
                colors[i * 3] = 0.65 + Math.random() * 0.35;
                colors[i * 3 + 1] = 0.55 + Math.random() * 0.35;
                colors[i * 3 + 2] = 0.95 + Math.random() * 0.05;
            } else if (colorChoice < 0.85) {
                colors[i * 3] = 1.0;
                colors[i * 3 + 1] = 0.90 + Math.random() * 0.10;
                colors[i * 3 + 2] = 0.85 + Math.random() * 0.15;
            } else {
                colors[i * 3] = 0.95 + Math.random() * 0.05;
                colors[i * 3 + 1] = 0.55 + Math.random() * 0.40;
                colors[i * 3 + 2] = 0.85 + Math.random() * 0.15;
            }
            sizes[i] = 0.06 + Math.random() * 0.14;
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

        const mat = new THREE.PointsMaterial({
            size: 0.24,
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

        const coreGrad = ctx.createRadialGradient(cx, cy, r * 0.02, cx, cy, r * 0.92);
        coreGrad.addColorStop(0, '#1a0202');
        coreGrad.addColorStop(0.15, '#3a0505');
        coreGrad.addColorStop(0.35, '#5b0c0c');
        coreGrad.addColorStop(0.55, '#7a1515');
        coreGrad.addColorStop(0.75, '#951f1f');
        coreGrad.addColorStop(0.92, '#6b1010');
        coreGrad.addColorStop(1, '#4a0808');
        ctx.fillStyle = coreGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();

        const craterGrad = ctx.createRadialGradient(cx - r * 0.28, cy - r * 0.22, r * 0.05, cx, cy, r * 0.95);
        craterGrad.addColorStop(0, 'rgba(12,2,2,0.50)');
        craterGrad.addColorStop(0.35, 'rgba(35,6,6,0.28)');
        craterGrad.addColorStop(0.65, 'rgba(25,4,4,0.12)');
        craterGrad.addColorStop(1, 'rgba(0,0,0,0.0)');
        ctx.fillStyle = craterGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();

        const craterGrad2 = ctx.createRadialGradient(cx + r * 0.32, cy + r * 0.18, r * 0.04, cx, cy, r * 0.88);
        craterGrad2.addColorStop(0, 'rgba(10,1,1,0.45)');
        craterGrad2.addColorStop(0.40, 'rgba(30,4,4,0.20)');
        craterGrad2.addColorStop(0.75, 'rgba(18,2,2,0.06)');
        craterGrad2.addColorStop(1, 'rgba(0,0,0,0.0)');
        ctx.fillStyle = craterGrad2;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();

        const brightGrad = ctx.createRadialGradient(cx + r * 0.12, cy - r * 0.12, r * 0.06, cx, cy, r * 0.78);
        brightGrad.addColorStop(0, 'rgba(160,20,20,0.0)');
        brightGrad.addColorStop(0.25, 'rgba(140,18,18,0.18)');
        brightGrad.addColorStop(0.55, 'rgba(100,12,12,0.08)');
        brightGrad.addColorStop(1, 'rgba(0,0,0,0.0)');
        ctx.fillStyle = brightGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();

        const rimGrad = ctx.createRadialGradient(cx, cy, r * 0.85, cx, cy, r * 1.06);
        rimGrad.addColorStop(0, 'rgba(100,0,0,0.0)');
        rimGrad.addColorStop(0.30, 'rgba(180,22,22,0.70)');
        rimGrad.addColorStop(0.60, 'rgba(140,16,16,0.40)');
        rimGrad.addColorStop(0.85, 'rgba(90,10,10,0.12)');
        rimGrad.addColorStop(1, 'rgba(35,0,0,0.0)');
        ctx.fillStyle = rimGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, r * 1.06, 0, Math.PI * 2);
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

        const innerGrad = ctx.createRadialGradient(cx, cy, size * 0.18, cx, cy, size * 0.30);
        innerGrad.addColorStop(0, 'rgba(240,45,45,0.0)');
        innerGrad.addColorStop(0.10, 'rgba(245,55,55,0.75)');
        innerGrad.addColorStop(0.30, 'rgba(220,40,40,0.48)');
        innerGrad.addColorStop(0.55, 'rgba(170,28,28,0.18)');
        innerGrad.addColorStop(0.75, 'rgba(120,18,18,0.05)');
        innerGrad.addColorStop(1, 'rgba(80,8,8,0.0)');
        ctx.fillStyle = innerGrad;
        ctx.fillRect(0, 0, size, size);

        const middleGrad = ctx.createRadialGradient(cx, cy, size * 0.26, cx, cy, size * 0.48);
        middleGrad.addColorStop(0, 'rgba(200,30,30,0.35)');
        middleGrad.addColorStop(0.20, 'rgba(170,25,25,0.22)');
        middleGrad.addColorStop(0.45, 'rgba(130,18,22,0.09)');
        middleGrad.addColorStop(0.70, 'rgba(90,10,16,0.03)');
        middleGrad.addColorStop(1, 'rgba(50,4,10,0.0)');
        ctx.fillStyle = middleGrad;
        ctx.fillRect(0, 0, size, size);

        const outerGrad = ctx.createRadialGradient(cx, cy, size * 0.38, cx, cy, size * 0.60);
        outerGrad.addColorStop(0, 'rgba(120,15,35,0.12)');
        outerGrad.addColorStop(0.30, 'rgba(90,10,28,0.06)');
        outerGrad.addColorStop(0.60, 'rgba(60,5,20,0.02)');
        outerGrad.addColorStop(0.85, 'rgba(35,2,12,0.005)');
        outerGrad.addColorStop(1, 'rgba(20,0,6,0.0)');
        ctx.fillStyle = outerGrad;
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

        const grad = ctx.createRadialGradient(cx, cy, size * 0.30, cx, cy, size * 0.58);
        grad.addColorStop(0, 'rgba(120,15,25,0.0)');
        grad.addColorStop(0.15, 'rgba(110,12,22,0.14)');
        grad.addColorStop(0.35, 'rgba(90,10,20,0.10)');
        grad.addColorStop(0.55, 'rgba(70,8,18,0.06)');
        grad.addColorStop(0.75, 'rgba(50,5,14,0.02)');
        grad.addColorStop(0.90, 'rgba(30,2,8,0.006)');
        grad.addColorStop(1, 'rgba(15,0,4,0.0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, size, size);

        const texture = new THREE.CanvasTexture(canvas);
        const geo = new THREE.PlaneGeometry(130, 130);
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
            const r = 4 + Math.random() * 16;
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
                colors[i * 3] = 0.70 + Math.random() * 0.30;
                colors[i * 3 + 1] = 0.10 + Math.random() * 0.15;
                colors[i * 3 + 2] = 0.08 + Math.random() * 0.12;
            } else if (colorChoice < 0.65) {
                colors[i * 3] = 0.80 + Math.random() * 0.20;
                colors[i * 3 + 1] = 0.15 + Math.random() * 0.20;
                colors[i * 3 + 2] = 0.08 + Math.random() * 0.12;
            } else if (colorChoice < 0.85) {
                colors[i * 3] = 0.60 + Math.random() * 0.30;
                colors[i * 3 + 1] = 0.06 + Math.random() * 0.12;
                colors[i * 3 + 2] = 0.22 + Math.random() * 0.25;
            } else {
                colors[i * 3] = 0.40 + Math.random() * 0.30;
                colors[i * 3 + 1] = 0.04 + Math.random() * 0.10;
                colors[i * 3 + 2] = 0.35 + Math.random() * 0.30;
            }
            sizes[i] = 0.05 + Math.random() * 0.10;
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

        const mat = new THREE.PointsMaterial({
            size: 0.18,
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

    _disableAllSpecialEventVisuals: function() {
        const set = (obj, v) => { if (obj) obj.visible = v; };
        set(this.eclipseDisc, false);
        set(this.eclipseCorona, false);
        set(this.eclipseHalo, false);
        this.eclipseRays.forEach(r => set(r, false));
        this.eclipseRibbons.forEach(r => set(r, false));
        set(this.eclipseParticles, false);
        set(this.bloodMoonDisc, false);
        set(this.bloodMoonCorona, false);
        set(this.bloodMoonHalo, false);
        set(this.bloodMoonParticles, false);
    },

    _enableEclipseVisuals: function() {
        this._disableAllSpecialEventVisuals();
        const set = (obj, v) => { if (obj) obj.visible = v; };
        set(this.eclipseDisc, true);
        set(this.eclipseCorona, true);
        set(this.eclipseHalo, true);
        this.eclipseRays.forEach(r => set(r, true));
        this.eclipseRibbons.forEach(r => set(r, true));
        set(this.eclipseParticles, true);
    },

    _enableBloodMoonVisuals: function() {
        this._disableAllSpecialEventVisuals();
        const set = (obj, v) => { if (obj) obj.visible = v; };
        set(this.bloodMoonDisc, true);
        set(this.bloodMoonCorona, true);
        set(this.bloodMoonHalo, true);
        set(this.bloodMoonParticles, true);
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
        const previousEvent = this.currentEvent;
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
        this.eclipseVisualScale = CONFIG.SPECIAL_EVENT_CONFIG.eclipse.visualScaleMultiplier || 1.15;
        this.eclipsePeakIntensity = 0.0;
        this.bloodPeakIntensity = 0.0;
        this.bloodMoonColorLerp = 0.0;
        this.eventLightIntensity = 1.0;
        this.eventAmbientBoost = 0.0;
        this._visualTime = 0;

        this._disableAllSpecialEventVisuals();
        if (previousEvent && this._moonOriginalMaterial) {
            this._restoreCelestialState();
        }
        this._preserveCelestialState();

        if (eventType === 'ECLIPSE') {
            this._enableEclipseVisuals();
            Renderer3D.sunMesh.visible = false;
            this._showNotification('🌘 ECLIPSE APPROACHING');
        } else if (eventType === 'BLOOD_MOON') {
            this._enableBloodMoonVisuals();
            Renderer3D.moonMesh.visible = false;
            this._showNotification('🩸 BLOOD MOON APPROACHING');
        }

        this._applyBaseEventLighting(eventType, 0.0);
        this._emit('started', { event: eventType });
        console.log(eventType + ' WARNING started');
    },

    update: function(deltaTimeMs) {
        const dt = deltaTimeMs / 1000;

        if (this.state === 'IDLE') {
            this._updateIdle(dt);
            return;
        }

        this._visualTime += dt;

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
            this.bloodPeakIntensity = 1.0;
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
            this.eclipseVisualScale = eclipseCfg.visualScaleMultiplier || 1.15;
            this.eclipsePeakIntensity = 0.0;
            console.log('🌘 Eclipse recovery');
        }

        const localPeakT = Math.min(1, Math.max(0, (this.eventTimer - peakDuration) / peakDuration));
        this.eclipsePeakIntensity = Math.sin(localPeakT * Math.PI);

        this.peakPulseTimer += dt;
        if (!this.peakPulseActive && this.peakPulseTimer >= 0.6) {
            this.peakPulseActive = true;
            this.peakPulseTimer = 0;
        }
        if (this.peakPulseActive && this.peakPulseTimer >= eclipseCfg.peakPulseDuration) {
            this.peakPulseActive = false;
            this.peakPulseTimer = 0;
        }

        if (this.peakPulseActive) {
            const pulseT = this.peakPulseTimer / eclipseCfg.peakPulseDuration;
            const pulse = Math.sin(pulseT * Math.PI);
            this.eclipseVisualScale = (eclipseCfg.visualScaleMultiplier || 1.15) + 0.08 * pulse;
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
        if (this.currentEvent === 'ECLIPSE') {
            this.eclipsePeakIntensity = Math.max(0, this.eclipsePeakIntensity - smoothT * this.eclipsePeakIntensity);
        } else if (this.currentEvent === 'BLOOD_MOON') {
            this.bloodPeakIntensity = Math.max(0, this.bloodPeakIntensity - smoothT * this.bloodPeakIntensity);
        }
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
        this._restoreCelestialState();
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
        this.eclipseVisualScale = CONFIG.SPECIAL_EVENT_CONFIG.eclipse.visualScaleMultiplier || 1.15;
        this.eclipsePeakIntensity = 0.0;
        this.bloodPeakIntensity = 0.0;
        this.bloodMoonColorLerp = 0.0;
        this.eventLightIntensity = 1.0;
        this.eventAmbientBoost = 0.0;
        this._scheduledEvent = null;
        this._scheduledPhase = null;
        this._scheduledTime = 0;
        this._disableAllSpecialEventVisuals();
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
            const baseScale = sunScale * this.eclipseVisualScale;
            const discScale = baseScale * (1.0 + this.eclipsePeakIntensity * 0.12);
            this.eclipseDisc.scale.setScalar(Math.max(0.001, discScale));
            this.eclipseCorona.scale.setScalar(Math.max(0.001, baseScale * 1.45 * (1.0 + this.eclipsePeakIntensity * 0.20)));
            this.eclipseHalo.scale.setScalar(Math.max(0.001, baseScale * 2.0 * (1.0 + this.eclipsePeakIntensity * 0.15)));

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
            this.eclipseCorona.material.opacity = Math.max(0, Math.min(1, clampedOpacity * 0.95 * (1.0 + this.eclipsePeakIntensity * 0.30)));
            this.eclipseHalo.material.opacity = Math.max(0, Math.min(1, clampedOpacity * 0.60 * (1.0 + this.eclipsePeakIntensity * 0.25)));

            this.eclipseRays.forEach((ray, i) => {
                ray.visible = this.eclipseDisc.visible;
                ray.position.copy(pos);
                ray.lookAt(lookTarget);
                const rot = this._rayBaseRotations[i];
                ray.rotation.z = rot.angle + Math.sin(this._visualTime * 0.4 + i) * 0.15;
                ray.rotation.x = rot.tilt + Math.cos(this._visualTime * 0.3 + i * 0.7) * 0.1;
                const rayOpacity = Math.max(0, Math.min(1, clampedOpacity * (0.5 + 0.5 * Math.sin(this._visualTime * 0.9 + i * 1.1)) * (1.0 + this.eclipsePeakIntensity * 0.35)));
                ray.material.opacity = rayOpacity;
                ray.scale.set(1, 1 + this.eclipsePeakIntensity * 0.25, 1);
                if (this.state === 'PEAK' && this.peakPulseActive) {
                    ray.material.opacity = Math.max(0, Math.min(1, ray.material.opacity * 1.4));
                }
            });

            this.eclipseRibbons.forEach((ribbon, i) => {
                ribbon.visible = this.eclipseDisc.visible;
                ribbon.position.copy(pos);
                ribbon.lookAt(lookTarget);
                const rot = this._ribbonBaseRotations[i];
                ribbon.rotation.x = rot.x + Math.sin(this._visualTime * rot.waveSpeed + i) * rot.waveAmp;
                ribbon.rotation.y = rot.y + this._visualTime * rot.orbitSpeed;
                ribbon.rotation.z = rot.z + Math.cos(this._visualTime * 0.7 + i * 1.5) * 0.25;
                const ribbonOpacity = Math.max(0, Math.min(1, clampedOpacity * 0.7 * (0.5 + 0.5 * Math.sin(this._visualTime * 1.0 + i * 1.5)) * (1.0 + this.eclipsePeakIntensity * 0.30)));
                ribbon.material.opacity = ribbonOpacity;
                ribbon.scale.set(1 + this.eclipsePeakIntensity * 0.20, 1, 1);
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
                    const drift = Math.sin(this._visualTime * 0.7 + i * 0.25) * 0.6;
                    const driftY = Math.cos(this._visualTime * 0.5 + i * 0.35) * 0.4;
                    const driftZ = Math.cos(this._visualTime * 0.6 + i * 0.3) * 0.5;
                    posAttr.array[i * 3] = bx + drift;
                    posAttr.array[i * 3 + 1] = by + driftY;
                    posAttr.array[i * 3 + 2] = bz + driftZ;
                }
                posAttr.needsUpdate = true;
                const particleOpacity = Math.max(0, Math.min(1, clampedOpacity * 0.85 * (1.0 + this.eclipsePeakIntensity * 0.25)));
                this.eclipseParticles.material.opacity = this.state === 'PEAK' && this.peakPulseActive ?
                    Math.min(1, particleOpacity * 1.2) : particleOpacity;
                this.eclipseParticles.material.size = 0.24 * (1.0 + this.eclipsePeakIntensity * 0.20);
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

            const baseScale = Renderer3D.moonMesh.scale.x;
            if (baseScale > 0.001) {
                const scale = baseScale * (CONFIG.SPECIAL_EVENT_CONFIG.bloodMoon.moonVisualScaleMultiplier || 1.15) * (1.0 + this.bloodPeakIntensity * 0.10);
                this.bloodMoonDisc.scale.setScalar(Math.max(0.001, scale));
                this.bloodMoonCorona.scale.setScalar(Math.max(0.001, scale * 1.6 * (1.0 + this.bloodPeakIntensity * 0.20)));
                this.bloodMoonHalo.scale.setScalar(Math.max(0.001, scale * 2.2 * (1.0 + this.bloodPeakIntensity * 0.25)));
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
            this.bloodMoonCorona.material.opacity = Math.max(0, Math.min(1, bmLerp * 0.85 + pulse * 0.3 + this.bloodPeakIntensity * 0.20));
            this.bloodMoonHalo.material.opacity = Math.max(0, Math.min(1, bmLerp * 0.40 + pulse * 0.15 + this.bloodPeakIntensity * 0.15));

            if (this.bloodMoonParticles && this.bloodMoonParticles.visible) {
                const posAttr = this.bloodMoonParticles.geometry.attributes.position;
                const baseAttr = this._bloodParticleBasePositions;
                for (let i = 0; i < posAttr.count; i++) {
                    const bx = baseAttr[i * 3];
                    const by = baseAttr[i * 3 + 1];
                    const bz = baseAttr[i * 3 + 2];
                    const drift = Math.sin(this._visualTime * 0.5 + i * 0.4) * 0.35;
                    const driftY = Math.cos(this._visualTime * 0.4 + i * 0.5) * 0.25;
                    const driftZ = Math.cos(this._visualTime * 0.45 + i * 0.35) * 0.3;
                    posAttr.array[i * 3] = bx + drift;
                    posAttr.array[i * 3 + 1] = by + driftY;
                    posAttr.array[i * 3 + 2] = bz + driftZ;
                }
                posAttr.needsUpdate = true;
                const bpOpacity = Math.max(0, Math.min(1, bmLerp * 0.55 + this.bloodPeakIntensity * 0.20));
                this.bloodMoonParticles.material.opacity = this.bloodPulseActive ?
                    Math.min(1, bpOpacity * 1.5) : bpOpacity;
                this.bloodMoonParticles.material.size = 0.18 * (1.0 + this.bloodPeakIntensity * 0.20);
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
                this.eventAmbientBoost = 0.30 + this.eclipsePeakIntensity * 0.20;
            } else if (this.state === 'PEAK') {
                this.eventLightIntensity = 0.20;
                this.eventAmbientBoost = 0.45 + this.eclipsePeakIntensity * 0.20;
            } else if (this.state === 'ENDING') {
                const endDur = 5.0;
                const t = Math.min(1, Math.max(0, this.eventTimer / endDur));
                const smooth = t * t * (3 - 2 * t);
                this.eventLightIntensity = 0.25 + 0.75 * smooth;
                this.eventAmbientBoost = (0.45 + (this.eclipsePeakIntensity || 0) * 0.20) * (1.0 - smooth);
            }
        } else if (this.currentEvent === 'BLOOD_MOON') {
            if (this.state === 'WARNING') {
                this.eventLightIntensity = 1.0;
                this.eventAmbientBoost = 0.12 * Math.min(1, this.eventTimer / 5.0);
            } else if (this.state === 'ACTIVE' || this.state === 'PEAK') {
                this.eventLightIntensity = 1.0;
                this.eventAmbientBoost = 0.45 + this.bloodPeakIntensity * 0.20;
                if (this.bloodPulseActive) {
                    this.eventAmbientBoost = Math.min(0.65, this.eventAmbientBoost + 0.20);
                }
            } else if (this.state === 'ENDING') {
                const endDur = 5.0;
                const t = Math.min(1, this.eventTimer / endDur);
                const smooth = t * t * (3 - 2 * t);
                this.eventLightIntensity = 1.0;
                this.eventAmbientBoost = (0.45 + (this.bloodPeakIntensity || 0) * 0.20) * (1.0 - smooth);
            }
        }
    },

    _preserveCelestialState: function() {
        if (Renderer3D.moonMesh) {
            this._moonWasVisible = Renderer3D.moonMesh.visible;
            this._moonOriginalMaterial = Renderer3D.moonMesh.material;
            this._moonOriginalColor = Renderer3D.moonMesh.material.color.getHex();
            this._moonOriginalOpacity = Renderer3D.moonMesh.material.opacity;
            this._moonOriginalScale.copy(Renderer3D.moonMesh.scale);
        }
        if (Renderer3D.sunMesh) {
            this._sunWasVisible = Renderer3D.sunMesh.visible;
            this._sunOriginalMaterial = Renderer3D.sunMesh.material;
            this._sunOriginalColor = Renderer3D.sunMesh.material.color.getHex();
            this._sunOriginalOpacity = Renderer3D.sunMesh.material.opacity;
            this._sunOriginalScale.copy(Renderer3D.sunMesh.scale);
        }
    },

    _restoreCelestialState: function() {
        if (Renderer3D.moonMesh && this._moonOriginalMaterial) {
            Renderer3D.moonMesh.visible = this._moonWasVisible;
            Renderer3D.moonMesh.material = this._moonOriginalMaterial;
            if (this._moonOriginalColor !== null) Renderer3D.moonMesh.material.color.setHex(this._moonOriginalColor);
            Renderer3D.moonMesh.material.opacity = this._moonOriginalOpacity;
            Renderer3D.moonMesh.scale.copy(this._moonOriginalScale);
        }
        if (Renderer3D.sunMesh && this._sunOriginalMaterial) {
            Renderer3D.sunMesh.visible = this._sunWasVisible;
            Renderer3D.sunMesh.material = this._sunOriginalMaterial;
            if (this._sunOriginalColor !== null) Renderer3D.sunMesh.material.color.setHex(this._sunOriginalColor);
            Renderer3D.sunMesh.material.opacity = this._sunOriginalOpacity;
            Renderer3D.sunMesh.scale.copy(this._sunOriginalScale);
        }
        this._moonOriginalMaterial = null;
        this._sunOriginalMaterial = null;
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
