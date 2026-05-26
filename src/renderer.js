// ThreeRenderer
// All Three.js logic lives here. The renderer takes a validated scene spec
// (see parser.js) and turns it into a live 3D particle scene with pointer
// interaction, drag-to-rotate, and wheel-to-zoom.

import { clamp, hashText, seededRandom, fibonacciSphere } from './util.js';
import { sampleTextToPoints } from './text-canvas.js';

const THREE_MODULE = 'three';

export class ThreeRenderer {
    constructor(container) {
        this.container = container;
        this.THREE = null;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.world = null;
        this.points = null;
        this.particleData = [];
        this.graphRuntime = null;
        this.sceneSpec = null;
        this.voiceState = {
            mode: 'idle',
            inputLevel: 0,
            outputLevel: 0,
            energy: 0
        };
        this.pointer = {
            x: 0, y: 0,
            targetX: 0, targetY: 0,
            active: false,
            dragging: false,
            lastClientX: 0,
            lastClientY: 0
        };
        this.cameraOrbit = {
            yaw: 0,
            pitch: 0.28,
            distance: 72,
            targetYaw: 0,
            targetPitch: 0.28,
            targetDistance: 72
        };
        this.ready = false;
        this.loading = null;
    }

    async setScene(sceneSpec) {
        this.sceneSpec = sceneSpec;
        await this.ensureReady();
        this.buildScene(sceneSpec);
        this.resize();
    }

    async ensureReady() {
        if (this.ready) return;
        if (this.loading) return this.loading;

        this.loading = import(THREE_MODULE).then((module) => {
            this.THREE = module;
            this.scene = new this.THREE.Scene();
            this.scene.fog = new this.THREE.FogExp2(0x10151b, 0.013);

            this.camera = new this.THREE.PerspectiveCamera(62, 1, 0.1, 1200);
            this.camera.position.set(0, 22, 88);

            this.renderer = new this.THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
            this.renderer.setClearColor(0x0b0f14, 1);
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
            this.container.replaceChildren(this.renderer.domElement);
            this.bindPointerEvents();

            const ambient = new this.THREE.AmbientLight(0xffffff, 0.45);
            const key = new this.THREE.PointLight(0x6aa9ff, 80, 240);
            key.position.set(20, 40, 48);
            this.scene.add(ambient, key);

            this.world = new this.THREE.Group();
            this.scene.add(this.world);
            this.ready = true;
        });

        return this.loading;
    }

    bindPointerEvents() {
        this.container.addEventListener('pointermove', (event) => {
            const rect = this.container.getBoundingClientRect();
            this.pointer.targetX = ((event.clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1;
            this.pointer.targetY = ((event.clientY - rect.top) / Math.max(rect.height, 1)) * 2 - 1;
            this.pointer.active = true;

            if (this.pointer.dragging) {
                const dx = event.clientX - this.pointer.lastClientX;
                const dy = event.clientY - this.pointer.lastClientY;
                this.cameraOrbit.targetYaw -= dx * 0.006;
                this.cameraOrbit.targetPitch = clamp(this.cameraOrbit.targetPitch + dy * 0.004, -0.85, 0.95);
                this.pointer.lastClientX = event.clientX;
                this.pointer.lastClientY = event.clientY;
            }
        });

        this.container.addEventListener('pointerdown', (event) => {
            this.pointer.dragging = true;
            this.pointer.lastClientX = event.clientX;
            this.pointer.lastClientY = event.clientY;
            this.container.classList.add('is-dragging');
            this.container.setPointerCapture?.(event.pointerId);
        });

        this.container.addEventListener('pointerup', (event) => {
            this.pointer.dragging = false;
            this.container.classList.remove('is-dragging');
            this.container.releasePointerCapture?.(event.pointerId);
        });

        this.container.addEventListener('pointerleave', () => {
            this.pointer.targetX = 0;
            this.pointer.targetY = 0;
            this.pointer.active = false;
            this.pointer.dragging = false;
            this.container.classList.remove('is-dragging');
        });

        this.container.addEventListener('wheel', (event) => {
            event.preventDefault();
            this.cameraOrbit.targetDistance = clamp(this.cameraOrbit.targetDistance + event.deltaY * 0.05, 28, 140);
        }, { passive: false });
    }

    updateCameraOrbit() {
        this.cameraOrbit.yaw += (this.cameraOrbit.targetYaw - this.cameraOrbit.yaw) * 0.12;
        this.cameraOrbit.pitch += (this.cameraOrbit.targetPitch - this.cameraOrbit.pitch) * 0.12;
        this.cameraOrbit.distance += (this.cameraOrbit.targetDistance - this.cameraOrbit.distance) * 0.1;
    }

    applyCameraOrbit({ shake = 0, time = 0 } = {}) {
        const distance = this.cameraOrbit.distance;
        const yaw = this.cameraOrbit.yaw;
        const pitch = this.cameraOrbit.pitch;
        const horizontal = Math.cos(pitch) * distance;
        this.camera.position.set(
            Math.sin(yaw) * horizontal + Math.sin(time * 34) * shake,
            Math.sin(pitch) * distance + Math.cos(time * 27) * shake,
            Math.cos(yaw) * horizontal
        );
        this.camera.lookAt(0, 0, 0);
    }

    setCameraDistance(distance) {
        this.cameraOrbit.targetDistance = distance;
        this.cameraOrbit.distance = distance;
    }

    setVoiceState(state = {}) {
        this.voiceState = {
            ...this.voiceState,
            ...state
        };
    }

    updatePointerField() {
        this.pointer.x += (this.pointer.targetX - this.pointer.x) * 0.08;
        this.pointer.y += (this.pointer.targetY - this.pointer.y) * 0.08;
        this.updateCameraOrbit();
    }

    buildScene(sceneSpec) {
        if (!this.ready) return;
        this.world.clear();
        this.particleData = [];
        this.points = null;
        this.graphRuntime = null;

        if (sceneSpec.kind === 'scene_graph') this.buildSceneGraphScene(sceneSpec);
        else if (sceneSpec.kind === 'black_hole_3d') this.buildBlackHoleScene(sceneSpec);
        else if (sceneSpec.kind === 'orbital_3d') this.buildOrbitalScene(sceneSpec);
        else this.buildParticleScene(sceneSpec);
    }

    // ---- Legacy non-graph scenes ------------------------------------------

    buildParticleScene(sceneSpec) {
        const THREE = this.THREE;
        this.setCameraDistance(72);
        const count = sceneSpec.particleCount;
        const random = seededRandom(sceneSpec.seed);
        const positions = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);

        for (let i = 0; i < count; i += 1) {
            const radius = 8 + random() * 42;
            const angle = random() * Math.PI * 2;
            const layer = random() * 2 - 1;
            const y = layer * 18 + Math.sin(angle * 3) * 4;

            positions[i * 3] = Math.cos(angle) * radius;
            positions[i * 3 + 1] = y;
            positions[i * 3 + 2] = Math.sin(angle) * radius;

            const color = new THREE.Color(sceneSpec.palette[i % sceneSpec.palette.length]);
            colors[i * 3] = color.r;
            colors[i * 3 + 1] = color.g;
            colors[i * 3 + 2] = color.b;

            this.particleData.push({
                angle,
                radius,
                layer,
                phase: random() * Math.PI * 2,
                drift: 0.4 + random() * 1.2
            });
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const material = new THREE.PointsMaterial({
            size: 0.32 + sceneSpec.intensity * 0.38,
            vertexColors: true,
            transparent: true,
            opacity: 0.88,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });

        this.points = new THREE.Points(geometry, material);
        this.world.add(this.points);

        // Keep the Casberry-style flow clean: no isolated decorative center dot.
    }

    buildOrbitalScene(sceneSpec) {
        const THREE = this.THREE;
        this.setCameraDistance(78);
        const primary = this.createParticleBall({
            radius: 5.4, count: 900, color: sceneSpec.palette[0],
            size: 0.18, opacity: 0.92, seed: sceneSpec.seed + 5
        });
        this.world.add(primary);

        for (let i = 0; i < 3; i += 1) {
            const ring = this.createParticleRing({
                radius: 18 + i * 10, count: 260,
                color: sceneSpec.palette[(i + 1) % sceneSpec.palette.length],
                size: 0.11, opacity: 0.42, seed: sceneSpec.seed + 100 + i
            });
            ring.rotation.x = Math.PI / 2 + i * 0.28;
            ring.rotation.y = i * 0.22;
            ring.userData.spin = 0.04 + i * 0.018;
            this.world.add(ring);
        }

        for (let i = 0; i < 3; i += 1) {
            const body = this.createParticleBall({
                radius: 1.5 + i * 0.45, count: 220,
                color: sceneSpec.palette[(i + 1) % sceneSpec.palette.length],
                size: 0.13, opacity: 0.9, seed: sceneSpec.seed + 20 + i
            });
            body.userData = {
                orbitRadius: 18 + i * 10,
                speed: (0.55 + i * 0.18) * sceneSpec.speed,
                phase: i * 2.1,
                tilt: i * 0.32
            };
            this.world.add(body);
        }

        this.buildParticleScene({ ...sceneSpec, particleCount: Math.min(sceneSpec.particleCount, 1800), intensity: sceneSpec.intensity * 0.75 });
    }

    buildBlackHoleScene(sceneSpec) {
        const THREE = this.THREE;
        this.setCameraDistance(92);
        const diskSpec = { ...sceneSpec, particleCount: Math.min(sceneSpec.particleCount + 1200, 200000) };
        const count = diskSpec.particleCount;
        const random = seededRandom(diskSpec.seed);
        const positions = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);

        for (let i = 0; i < count; i += 1) {
            const distribution = random() ** 0.62;
            const radius = 7.5 + distribution * 48;
            const angle = random() * Math.PI * 2;
            const diskHeight = (random() - 0.5) * (0.7 + distribution * 3.2);
            const spiralOffset = distribution * 3.4;

            positions[i * 3] = Math.cos(angle + spiralOffset) * radius;
            positions[i * 3 + 1] = diskHeight;
            positions[i * 3 + 2] = Math.sin(angle + spiralOffset) * radius * 0.72;

            const heat = 1 - distribution;
            const inner = new THREE.Color(diskSpec.palette[0]);
            const outer = new THREE.Color(diskSpec.palette[2] || diskSpec.palette[1]);
            const color = inner.lerp(outer, distribution * 0.85);
            color.offsetHSL(0, 0, heat * 0.22);
            colors[i * 3] = color.r;
            colors[i * 3 + 1] = color.g;
            colors[i * 3 + 2] = color.b;

            this.particleData.push({
                motion: 'black_hole',
                angle, radius, phase: random() * Math.PI * 2, diskHeight,
                eccentricity: 0.64 + random() * 0.22,
                precession: spiralOffset,
                turbulence: 0.25 + random() * 0.9
            });
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const material = new THREE.PointsMaterial({
            size: 0.22 + diskSpec.intensity * 0.24,
            vertexColors: true,
            transparent: true,
            opacity: 0.92,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });

        this.points = new THREE.Points(geometry, material);
        this.points.rotation.x = -0.34;
        this.world.add(this.points);

        const horizon = this.createParticleBall({ radius: 5.4, count: 700, color: '#020204', size: 0.22, opacity: 0.96, seed: diskSpec.seed + 60 });
        this.world.add(horizon);

        const photonRing = this.createParticleRing({ radius: 6.2, count: 360, color: diskSpec.palette[0], size: 0.18, opacity: 0.78, seed: diskSpec.seed + 150 });
        photonRing.rotation.x = Math.PI / 2;
        photonRing.userData.spin = 0.018;
        this.world.add(photonRing);

        const outerDisk = this.createParticleRing({ radius: 26, count: 520, color: diskSpec.palette[1], size: 0.12, opacity: 0.28, seed: diskSpec.seed + 180 });
        outerDisk.rotation.x = Math.PI / 2 - 0.34;
        outerDisk.scale.z = 0.68;
        outerDisk.userData.spin = 0.004;
        this.world.add(outerDisk);

        const jetTop = this.createParticleJet({ direction: 1, color: diskSpec.palette[2] || '#78a6ff', seed: diskSpec.seed + 90 });
        const jetBottom = this.createParticleJet({ direction: -1, color: diskSpec.palette[2] || '#78a6ff', seed: diskSpec.seed + 120 });
        this.world.add(jetTop, jetBottom);

        this.applyCameraOrbit();
    }

    // ---- Scene-graph driven scenes ---------------------------------------

    buildSceneGraphScene(sceneSpec) {
        const graph = sceneSpec.sceneGraph;
        const runtime = {
            duration: graph.duration || 10,
            objects: new Map(),
            motions: graph.motions || [],
            forces: graph.forces || [],
            trails: [],
            events: graph.events || [],
            effects: {},
            camera: graph.camera || {},
            debris: null
        };

        (graph.objects || []).forEach((spec) => this.buildSceneObject(spec, sceneSpec, runtime));
        (graph.effects || []).forEach((spec) => this.buildSceneEffect(spec, sceneSpec, runtime));

        this.graphRuntime = runtime;
        this.setCameraDistance(runtime.camera.distance || 58);
        this.applyCameraOrbit();
    }

    buildSceneObject(objectSpec, sceneSpec, runtime) {
        switch (objectSpec.type) {
            case 'sphere': {
                const mesh = this.createGraphSphere(objectSpec);
                runtime.objects.set(objectSpec.id, { spec: objectSpec, mesh, basePosition: mesh.position.clone() });
                this.world.add(mesh);

                if (objectSpec.material?.atmosphere) {
                    const atmosphere = this.createParticleBall({
                        radius: (objectSpec.radius || 10) * 1.07,
                        count: 900, color: '#62d7ff',
                        size: 0.08, opacity: 0.2,
                        seed: sceneSpec.seed + 300
                    });
                    atmosphere.position.copy(mesh.position);
                    this.world.add(atmosphere);
                    runtime.objects.set(`${objectSpec.id}:atmosphere`, {
                        spec: { type: 'atmosphere', role: 'particle_shell' },
                        mesh: atmosphere
                    });
                }
                return;
            }

            case 'particle_cloud': {
                const cloud = this.createGraphParticleCloud(objectSpec, sceneSpec.seed);
                this.world.add(cloud.points);
                runtime.objects.set(objectSpec.id, {
                    spec: objectSpec,
                    mesh: cloud.points,
                    basePosition: cloud.points.position.clone(),
                    particles: cloud.particles,
                    kind: 'particle_cloud'
                });
                return;
            }

            case 'field_lines': {
                const field = this.createMagneticFieldLines(objectSpec, sceneSpec.seed);
                this.world.add(field.points);
                runtime.objects.set(objectSpec.id, {
                    spec: objectSpec, mesh: field.points,
                    particles: field.particles, kind: 'field_lines'
                });
                return;
            }

            case 'particle_shape': {
                const shape = this.createGraphParticleShape(objectSpec, sceneSpec.seed);
                this.world.add(shape.points);
                runtime.objects.set(objectSpec.id, {
                    spec: objectSpec, mesh: shape.points,
                    basePosition: shape.points.position.clone(),
                    particles: shape.particles, kind: 'particle_shape'
                });
                return;
            }

            case 'projectile': {
                const projectile = this.createProjectile(objectSpec, sceneSpec);
                this.world.add(projectile.mesh);
                if (projectile.trail) this.world.add(projectile.trail.line);
                runtime.trails.push(projectile.trail);
                runtime.objects.set(objectSpec.id, projectile);
                return;
            }

            case 'star_body': {
                const star = this.createStarBody(objectSpec, sceneSpec.seed);
                this.world.add(star.group);
                runtime.objects.set(objectSpec.id, {
                    spec: objectSpec, mesh: star.group,
                    basePosition: star.group.position.clone(),
                    kind: 'star_body',
                    core: star.core, corona: star.corona
                });
                return;
            }

            case 'wheel': {
                const wheel = this.createWheel(objectSpec, sceneSpec.seed);
                this.world.add(wheel.group);
                runtime.objects.set(objectSpec.id, {
                    spec: objectSpec, mesh: wheel.group,
                    basePosition: wheel.group.position.clone(),
                    kind: 'wheel'
                });
                return;
            }

            case 'car_part': {
                const part = this.createCarPart(objectSpec, sceneSpec.seed);
                this.world.add(part.points);
                runtime.objects.set(objectSpec.id, {
                    spec: objectSpec, mesh: part.points,
                    basePosition: part.points.position.clone(),
                    kind: 'car_part'
                });
                return;
            }

            case 'glow_point': {
                const point = this.createParticleBall({
                    radius: objectSpec.radius || 0.4, count: 220,
                    color: objectSpec.material?.color || '#f5f7fb',
                    size: 0.1, opacity: 0.95,
                    seed: sceneSpec.seed + 999
                });
                point.position.set(...(objectSpec.position || [0, 0, 0]));
                this.world.add(point);
                runtime.objects.set(objectSpec.id, {
                    spec: objectSpec, mesh: point,
                    basePosition: point.position.clone(),
                    kind: 'glow_point'
                });
                return;
            }

            case 'text_particles': {
                const txt = this.createTextParticles(objectSpec, sceneSpec.seed);
                this.world.add(txt.points);
                runtime.objects.set(objectSpec.id, {
                    spec: objectSpec, mesh: txt.points,
                    basePosition: txt.points.position.clone(),
                    particles: txt.particles, kind: 'text_particles'
                });
                return;
            }
            case 'model_points': {
                const model = this.createModelParticles(objectSpec, sceneSpec.seed);
                this.world.add(model.points);
                runtime.objects.set(objectSpec.id, {
                    spec: objectSpec, mesh: model.points,
                    basePosition: model.points.position.clone(),
                    particles: model.particles, kind: 'model_points',
                    morphStartTime: null,
                    morphDuration: model.morphDuration || 0,
                    morphViaAt: model.morphViaAt || 0.5
                });
                return;
            }
            default:
                // unknown object type — skip silently
                return;
        }
    }

    buildSceneEffect(effectSpec, sceneSpec, runtime) {
        const THREE = this.THREE;

        if (effectSpec.type === 'starfield') {
            const starfield = this.createStarfield(effectSpec, sceneSpec.seed);
            this.world.add(starfield);
            runtime.effects[effectSpec.id] = { spec: effectSpec, mesh: starfield };
            return;
        }

        if (effectSpec.type === 'particle_bridge') {
            const count = clamp(Number(effectSpec.count) || 600, 100, 1600);
            const geometry = new THREE.BufferGeometry();
            const positions = new Float32Array(count * 3);
            const colors = new Float32Array(count * 3);
            const color = new THREE.Color(effectSpec.color || '#f2e7ff');
            const random = seededRandom(sceneSpec.seed + 760);

            for (let i = 0; i < count; i += 1) {
                positions[i * 3] = (random() - 0.5) * 18;
                positions[i * 3 + 1] = (random() - 0.5) * 10;
                positions[i * 3 + 2] = (random() - 0.5) * 10;
                colors[i * 3] = color.r;
                colors[i * 3 + 1] = color.g;
                colors[i * 3 + 2] = color.b;
            }

            geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
            geometry.setAttribute('basePosition', new THREE.BufferAttribute(positions.slice(), 3));
            const points = new THREE.Points(
                geometry,
                new THREE.PointsMaterial({
                    size: 0.12, vertexColors: true,
                    transparent: true, opacity: 0.48,
                    depthWrite: false, blending: THREE.AdditiveBlending
                })
            );
            points.userData.isInteractiveParticleObject = true;
            this.world.add(points);
            runtime.effects[effectSpec.id] = { spec: effectSpec, points, randomSeed: sceneSpec.seed + 760 };
            return;
        }

        if (effectSpec.type === 'glow_core') {
            return;
        }

        if (effectSpec.type === 'hologram_stage') {
            const group = new THREE.Group();
            const color = effectSpec.color || '#27f5d3';
            const accent = effectSpec.accent || '#6aa9ff';
            const brightness = effectSpec.brightness || 1;

            if (effectSpec.showRings !== false) {
                const topRing = this.createParticleRing({ radius: 18, count: 520, color, size: 0.07, opacity: 0.24 * brightness, seed: sceneSpec.seed + 1400 });
                topRing.position.y = 19;
                topRing.userData.spin = 0.0025;
                const bottomRing = this.createParticleRing({ radius: 18, count: 520, color, size: 0.07, opacity: 0.24 * brightness, seed: sceneSpec.seed + 1410 });
                bottomRing.position.y = -19;
                bottomRing.userData.spin = -0.002;

                const midRing = this.createParticleRing({ radius: 23, count: 720, color: accent, size: 0.055, opacity: 0.12 * brightness, seed: sceneSpec.seed + 1420 });
                midRing.rotation.x = Math.PI / 2;
                midRing.userData.spin = 0.0014;
                group.add(topRing, bottomRing, midRing);
            }

            if (effectSpec.showGrid !== false) {
                group.add(this.createHologramGrid(effectSpec, sceneSpec.seed + 1430));
            }
            this.world.add(group);
            runtime.effects[effectSpec.id] = { spec: effectSpec, group };
            return;
        }

        if (effectSpec.type === 'voice_stage') {
            const group = new THREE.Group();
            const color = effectSpec.color || '#27f5d3';
            const accent = effectSpec.accent || '#6aa9ff';
            const brightness = effectSpec.brightness || 1;
            const rings = [
                this.createParticleRing({ radius: 24, count: 860, color, size: 0.055, opacity: 0.11 * brightness, seed: sceneSpec.seed + 1470 }),
                this.createParticleRing({ radius: 29, count: 940, color: accent, size: 0.052, opacity: 0.085 * brightness, seed: sceneSpec.seed + 1480 }),
                this.createParticleRing({ radius: 34, count: 1020, color: '#f5f7fb', size: 0.045, opacity: 0.055 * brightness, seed: sceneSpec.seed + 1490 })
            ];
            rings[0].rotation.x = Math.PI / 2;
            rings[1].rotation.y = Math.PI / 2;
            rings[2].rotation.x = Math.PI / 2.6;
            rings.forEach((ring, index) => {
                ring.userData.waveIndex = index;
                ring.userData.baseOpacity = ring.material.opacity;
                group.add(ring);
            });
            this.world.add(group);
            runtime.effects[effectSpec.id] = { spec: effectSpec, group, rings };
            return;
        }

        if (effectSpec.type === 'orbit_rings') {
            const group = new THREE.Group();
            (effectSpec.targets || []).forEach((targetId, index) => {
                const motion = runtime.motions.find((c) => c.target === targetId && c.type === 'orbit_body');
                const target = runtime.objects.get(targetId);
                const radius = motion?.radius || Math.hypot(target?.mesh.position.x || 20, target?.mesh.position.z || 0);
                const ring = this.createParticleRing({
                    radius, count: 220,
                    color: effectSpec.color || '#f5f7fb',
                    size: 0.07, opacity: 0.2,
                    seed: sceneSpec.seed + 930 + index
                });
                ring.rotation.x = Math.PI / 2 + (motion?.tilt || 0);
                group.add(ring);
            });
            this.world.add(group);
            runtime.effects[effectSpec.id] = { spec: effectSpec, group };
            return;
        }

        if (effectSpec.type === 'speed_trail') {
            const count = clamp(Number(effectSpec.count) || 600, 160, 1800);
            const geometry = new THREE.BufferGeometry();
            const positions = new Float32Array(count * 3);
            const colors = new Float32Array(count * 3);
            const color = new THREE.Color(effectSpec.color || '#f5f7fb');
            const random = seededRandom(sceneSpec.seed + hashText(effectSpec.id || 'speed_trail'));

            for (let i = 0; i < count; i += 1) {
                const lane = i % 4;
                const t = random();
                positions[i * 3] = -7 - t * (effectSpec.length || 36);
                positions[i * 3 + 1] = -1.2 + (random() - 0.5) * 3.4;
                positions[i * 3 + 2] = (lane - 1.5) * 2.8 + (random() - 0.5) * 1.2;
                const heat = 0.45 + 0.55 * (1 - t);
                colors[i * 3] = color.r * heat;
                colors[i * 3 + 1] = color.g * heat;
                colors[i * 3 + 2] = color.b;
            }

            geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
            geometry.setAttribute('basePosition', new THREE.BufferAttribute(positions.slice(), 3));
            const points = new THREE.Points(
                geometry,
                new THREE.PointsMaterial({
                    size: 0.11, vertexColors: true,
                    transparent: true, opacity: 0.44,
                    depthWrite: false, blending: THREE.AdditiveBlending
                })
            );
            points.userData.isInteractiveParticleObject = true;
            this.world.add(points);
            runtime.effects[effectSpec.id] = { spec: effectSpec, points, randomSeed: sceneSpec.seed + 1060 };
            return;
        }

        // Event-driven effects (flash, shockwave, debris)
        const event = runtime.events.find((c) => c.id === effectSpec.event);
        const eventPosition = event?.position || [0, 0, 0];
        const position = new THREE.Vector3(...eventPosition);
        const normal = position.clone().normalize();
        const random = seededRandom(sceneSpec.seed + hashText(effectSpec.id || 'evt'));

        if (effectSpec.type === 'flash') {
            const flash = this.createParticleBall({
                radius: 1, count: 700,
                color: effectSpec.color || '#ffb454',
                size: 0.16, opacity: 0,
                seed: sceneSpec.seed + 520
            });
            flash.position.copy(position);
            flash.visible = false;
            this.world.add(flash);
            runtime.effects[effectSpec.id] = { spec: effectSpec, mesh: flash, event };
        }

        if (effectSpec.type === 'shockwave') {
            const shockwave = this.createParticleRing({
                radius: 1, count: 260,
                color: effectSpec.color || '#ffb454',
                size: 0.18, opacity: 0,
                seed: sceneSpec.seed + 620
            });
            shockwave.position.copy(position.clone().multiplyScalar(1.01));
            shockwave.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
            shockwave.visible = false;
            this.world.add(shockwave);
            runtime.effects[effectSpec.id] = { spec: effectSpec, mesh: shockwave, event };
        }

        if (effectSpec.type === 'debris') {
            const count = clamp(Number(effectSpec.count) || 300, 80, 1200);
            const geometry = new THREE.BufferGeometry();
            const positions = new Float32Array(count * 3);
            const colors = new Float32Array(count * 3);
            const color = new THREE.Color(effectSpec.color || '#ff6b4a');
            const particles = [];

            for (let i = 0; i < count; i += 1) {
                positions[i * 3] = position.x;
                positions[i * 3 + 1] = position.y;
                positions[i * 3 + 2] = position.z;
                colors[i * 3] = color.r;
                colors[i * 3 + 1] = color.g;
                colors[i * 3 + 2] = color.b;

                const tangent = new THREE.Vector3(random() - 0.5, random() - 0.5, random() - 0.5)
                    .cross(normal).normalize().multiplyScalar(2 + random() * 8);
                const velocity = normal.clone().multiplyScalar(3 + random() * 12).add(tangent);
                particles.push({ velocity, drag: 0.72 + random() * 0.2 });
            }

            geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
            const points = new THREE.Points(
                geometry,
                new THREE.PointsMaterial({
                    size: 0.26, vertexColors: true,
                    transparent: true, opacity: 0,
                    depthWrite: false, blending: THREE.AdditiveBlending
                })
            );
            this.world.add(points);
            runtime.effects[effectSpec.id] = { spec: effectSpec, points, event, origin: position, particles };
            runtime.debris = runtime.effects[effectSpec.id];
        }
    }

    // ---- object factories -------------------------------------------------

    createGraphSphere(objectSpec) {
        const THREE = this.THREE;
        const radius = objectSpec.radius || 8;
        const count = objectSpec.material?.preset === 'earthlike' ? 2400 : 1000;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);
        // Fibonacci sphere for stable surface coverage (less random feeling).
        const fib = fibonacciSphere(count, 1);
        const random = seededRandom(hashText(objectSpec.id || 'sphere'));
        const ocean = new THREE.Color(objectSpec.material?.color || '#2e7cff');
        const land = new THREE.Color('#1f9d74');
        const ice = new THREE.Color('#dff7ff');

        for (let i = 0; i < count; i += 1) {
            const [fx, fy, fz] = fib[i];
            const surfaceJitter = 1 + (random() - 0.5) * 0.012;

            positions[i * 3] = fx * radius * surfaceJitter;
            positions[i * 3 + 1] = fy * radius * surfaceJitter;
            positions[i * 3 + 2] = fz * radius * surfaceJitter;

            let color = new THREE.Color(objectSpec.material?.color || '#8fc7ff');
            if (objectSpec.material?.preset === 'earthlike') {
                const theta = Math.atan2(fz, fx);
                const continentNoise = Math.sin(theta * 2.7 + fy * 5.2) + Math.cos(theta * 4.3 - fy * 3.4);
                color = Math.abs(fy) > 0.82 ? ice : continentNoise > 0.56 ? land : ocean;
            }
            colors[i * 3] = color.r;
            colors[i * 3 + 1] = color.g;
            colors[i * 3 + 2] = color.b;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('basePosition', new THREE.BufferAttribute(positions.slice(), 3));

        const points = new THREE.Points(
            geometry,
            new THREE.PointsMaterial({
                size: objectSpec.material?.preset === 'earthlike' ? 0.12 : 0.16,
                vertexColors: true, transparent: true, opacity: 0.94,
                depthWrite: false, blending: THREE.AdditiveBlending
            })
        );
        points.position.set(...(objectSpec.position || [0, 0, 0]));
        points.userData.isInteractiveParticleObject = true;
        return points;
    }

    createGraphParticleCloud(objectSpec, seed) {
        const THREE = this.THREE;
        const count = clamp(Number(objectSpec.particleCount) || 1000, 200, 200000);
        const radius = objectSpec.radius || 8;
        const random = seededRandom(seed + hashText(objectSpec.id || 'cloud'));
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);
        const color = new THREE.Color(objectSpec.material?.color || '#b48cff');
        const particles = [];
        // Structured: combine Fibonacci surface direction with cube-root radius
        // to fill the volume with low-discrepancy points.
        const directions = fibonacciSphere(count, 1);
        const shell = objectSpec.distribution === 'shell';

        for (let i = 0; i < count; i += 1) {
            const [dx, dy, dz] = directions[i];
            const r = shell
                ? radius * (0.985 + (random() - 0.5) * 0.035)
                : radius * Math.cbrt((i + 0.5) / count) * (0.85 + random() * 0.18);
            const x = dx * r;
            const y = dy * r;
            const z = dz * r;
            positions[i * 3] = x;
            positions[i * 3 + 1] = y;
            positions[i * 3 + 2] = z;
            colors[i * 3] = color.r;
            colors[i * 3 + 1] = color.g;
            colors[i * 3 + 2] = color.b;
            particles.push({
                base: new THREE.Vector3(x, y, z),
                phase: random() * Math.PI * 2,
                radius: r,
                angle: Math.atan2(z, x),
                zAngle: Math.acos(dy)
            });
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('basePosition', new THREE.BufferAttribute(positions.slice(), 3));

        const points = new THREE.Points(
            geometry,
            new THREE.PointsMaterial({
                size: objectSpec.material?.pointSize || 0.13,
                vertexColors: true,
                transparent: true,
                opacity: objectSpec.material?.opacity || 0.88,
                depthWrite: false, blending: THREE.AdditiveBlending
            })
        );
        points.position.set(...(objectSpec.position || [0, 0, 0]));
        points.userData.isInteractiveParticleObject = true;
        points.userData.preserveParticleShape = true;

        return { points, particles };
    }

    // --- Star body: a dense Fibonacci-sphere core + soft outer corona.
    //     This is what makes the binary-star scene read as "two stars".
    createStarBody(objectSpec, seed) {
        const THREE = this.THREE;
        const group = new THREE.Group();
        const coreRadius = objectSpec.radius || 4;
        const coronaRadius = objectSpec.material?.coronaRadius || coreRadius * 2;
        const baseColor = objectSpec.material?.color || '#ffcf6b';
        const coronaColor = objectSpec.material?.corona || baseColor;

        // Dense solid core (Fibonacci surface for a clean spherical look).
        const core = this.createParticleBall({
            radius: coreRadius,
            count: 1100,
            color: baseColor,
            size: 0.22,
            opacity: 0.96,
            seed: seed + hashText(objectSpec.id + ':core'),
            structured: true,
            fill: 0.55      // thin shell for hard edge
        });
        // Soft glowing corona around it.
        const corona = this.createParticleBall({
            radius: coronaRadius,
            count: 700,
            color: coronaColor,
            size: 0.22,
            opacity: 0.32,
            seed: seed + hashText(objectSpec.id + ':corona'),
            structured: true,
            fill: 1.0
        });
        group.add(core, corona);
        group.position.set(...(objectSpec.position || [0, 0, 0]));
        group.userData.starBody = true;
        return { group, core, corona };
    }

    // --- Wheel: Fibonacci disk for tyre + small inner rim + 5 spokes.
    //     Lives in its own object so we can spin it independently.
    createWheel(objectSpec, seed) {
        const THREE = this.THREE;
        const group = new THREE.Group();
        const radius = objectSpec.radius || 1.5;
        const count = clamp(Number(objectSpec.particleCount) || 240, 80, 1000);
        const random = seededRandom(seed + hashText(objectSpec.id || 'wheel'));
        const tyreColor = new THREE.Color(objectSpec.material?.tyre || '#1a1d22');
        const rimColor = new THREE.Color(objectSpec.material?.rim || '#9aa6b8');
        const spokeColor = new THREE.Color(objectSpec.material?.spokes || '#f5f7fb');

        const tyreCount = Math.floor(count * 0.55);
        const rimCount = Math.floor(count * 0.25);
        const spokeCount = count - tyreCount - rimCount;
        const positions = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);
        let cursor = 0;

        // Tyre ring (a thick disk at r ≈ radius).
        for (let i = 0; i < tyreCount; i += 1) {
            const angle = (i / tyreCount) * Math.PI * 2;
            const r = radius * (0.92 + random() * 0.1);
            const w = (random() - 0.5) * 0.5; // tyre width
            positions[cursor * 3] = Math.cos(angle) * r;
            positions[cursor * 3 + 1] = Math.sin(angle) * r;
            positions[cursor * 3 + 2] = w;
            colors[cursor * 3] = tyreColor.r;
            colors[cursor * 3 + 1] = tyreColor.g;
            colors[cursor * 3 + 2] = tyreColor.b;
            cursor += 1;
        }

        // Inner rim ring
        for (let i = 0; i < rimCount; i += 1) {
            const angle = (i / rimCount) * Math.PI * 2;
            const r = radius * (0.45 + random() * 0.08);
            positions[cursor * 3] = Math.cos(angle) * r;
            positions[cursor * 3 + 1] = Math.sin(angle) * r;
            positions[cursor * 3 + 2] = (random() - 0.5) * 0.3;
            colors[cursor * 3] = rimColor.r;
            colors[cursor * 3 + 1] = rimColor.g;
            colors[cursor * 3 + 2] = rimColor.b;
            cursor += 1;
        }

        // 5 spokes radiating outward
        const spokes = 5;
        const perSpoke = Math.ceil(spokeCount / spokes);
        for (let s = 0; s < spokes; s += 1) {
            const angle = (s / spokes) * Math.PI * 2;
            for (let i = 0; i < perSpoke && cursor < count; i += 1) {
                const t = i / Math.max(perSpoke - 1, 1);
                const r = radius * (0.12 + t * 0.78);
                positions[cursor * 3] = Math.cos(angle) * r;
                positions[cursor * 3 + 1] = Math.sin(angle) * r;
                positions[cursor * 3 + 2] = (random() - 0.5) * 0.05;
                colors[cursor * 3] = spokeColor.r;
                colors[cursor * 3 + 1] = spokeColor.g;
                colors[cursor * 3 + 2] = spokeColor.b;
                cursor += 1;
            }
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('basePosition', new THREE.BufferAttribute(positions.slice(), 3));

        const points = new THREE.Points(
            geometry,
            new THREE.PointsMaterial({
                size: 0.13, vertexColors: true,
                transparent: true, opacity: 0.95,
                depthWrite: false, blending: THREE.AdditiveBlending
            })
        );
        // Orient the wheel disk so its rotation axis is the local Z
        // (forward direction of the car). The car runs along x, so the
        // wheel's rolling rotation should happen around z.
        // We build it in the XY plane and rotate it so XY -> YZ, leaving x as
        // the disk normal? Actually for a car on the highway:
        //   car forward = +x, wheel rolls around z-axis (lateral)
        // Easier: build the disk in YZ plane (already in XY), rotate around Y
        // by 90° so the disk faces +x.
        points.rotation.y = Math.PI / 2;
        group.add(points);
        group.position.set(...(objectSpec.position || [0, 0, 0]));
        group.userData.wheel = true;
        return { group };
    }

    // --- Car part: cuboid sampling for a single named part (chassis, cabin,
    //     front_light, tail_light). Lights are baked as small bricks.
    createCarPart(objectSpec, seed) {
        const THREE = this.THREE;
        const preset = objectSpec.preset || 'chassis';
        const count = clamp(Number(objectSpec.particleCount) || 2000, 80, 6000);
        const color = new THREE.Color(objectSpec.material?.color || '#4fd8ff');
        const random = seededRandom(seed + hashText(objectSpec.id || preset));
        const size = (() => {
            if (preset === 'chassis') return [26, 4.4, 8.6];
            if (preset === 'cabin') return [10.8, 4.4, 6.4];
            if (preset === 'front_light' || preset === 'tail_light') return [0.5, 1.1, 6.8];
            return [4, 1.5, 4];
        })();
        const positions = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);

        for (let i = 0; i < count; i += 1) {
            // Sample mostly on the shell of the cuboid for a more "drawn" feel.
            const face = Math.floor(random() * 6);
            const j = 0.06;
            let x = (random() - 0.5) * size[0];
            let y = (random() - 0.5) * size[1];
            let z = (random() - 0.5) * size[2];
            if (face === 0) x = size[0] / 2;
            if (face === 1) x = -size[0] / 2;
            if (face === 2) y = size[1] / 2;
            if (face === 3) y = -size[1] / 2;
            if (face === 4) z = size[2] / 2;
            if (face === 5) z = -size[2] / 2;
            positions[i * 3] = x + (random() - 0.5) * j;
            positions[i * 3 + 1] = y + (random() - 0.5) * j;
            positions[i * 3 + 2] = z + (random() - 0.5) * j;
            colors[i * 3] = color.r;
            colors[i * 3 + 1] = color.g;
            colors[i * 3 + 2] = color.b;
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('basePosition', new THREE.BufferAttribute(positions.slice(), 3));
        const points = new THREE.Points(
            geometry,
            new THREE.PointsMaterial({
                size: preset === 'front_light' || preset === 'tail_light' ? 0.18 : 0.14,
                vertexColors: true, transparent: true,
                opacity: preset === 'front_light' || preset === 'tail_light' ? 0.98 : 0.92,
                depthWrite: false, blending: THREE.AdditiveBlending
            })
        );
        points.position.set(...(objectSpec.position || [0, 0, 0]));
        points.userData.isInteractiveParticleObject = true;
        return { points };
    }

    // --- Generic shape (used now only for the highway preset).
    createGraphParticleShape(objectSpec, seed) {
        const THREE = this.THREE;
        const preset = objectSpec.preset || 'highway';
        const count = clamp(Number(objectSpec.particleCount) || 1200, 200, 80000);
        const random = seededRandom(seed + hashText(objectSpec.id || preset));
        const positions = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);

        if (preset === 'highway') {
            const asphalt = new THREE.Color(objectSpec.material?.asphalt || '#384150');
            const lane = new THREE.Color(objectSpec.material?.lane || '#f5f7fb');
            const edge = new THREE.Color(objectSpec.material?.edge || '#45d7ff');
            for (let i = 0; i < count; i += 1) {
                const laneMark = i % 9 === 0;
                const edgeMark = i % 13 === 0;
                const x = (random() - 0.5) * 110;
                const z = laneMark
                    ? (random() > 0.5 ? 3.6 : -3.6) + (random() - 0.5) * 0.16
                    : edgeMark
                        ? (random() > 0.5 ? 13.2 : -13.2) + (random() - 0.5) * 0.2
                        : (random() - 0.5) * 28;
                const c = laneMark ? lane : edgeMark ? edge : asphalt;
                positions[i * 3] = x;
                positions[i * 3 + 1] = (random() - 0.5) * 0.04;
                positions[i * 3 + 2] = z;
                colors[i * 3] = c.r;
                colors[i * 3 + 1] = c.g;
                colors[i * 3 + 2] = c.b;
            }
        }

        if (preset === 'city') {
            const body = new THREE.Color(objectSpec.material?.color || '#45d7ff');
            const windowColor = new THREE.Color(objectSpec.material?.window || '#f5f7fb');
            const accent = new THREE.Color(objectSpec.material?.accent || '#6aa9ff');
            const columns = 26;
            const depths = 7;
            for (let i = 0; i < count; i += 1) {
                const column = Math.floor(random() * columns);
                const depth = Math.floor(random() * depths);
                const xCenter = (column / Math.max(columns - 1, 1) - 0.5) * 58;
                const zCenter = (depth / Math.max(depths - 1, 1) - 0.5) * 18;
                const height = 7 + ((Math.sin(column * 1.73) + 1) * 0.5) * 17 + random() * 5;
                const width = 1.2 + random() * 1.6;
                const x = xCenter + (random() - 0.5) * width;
                const z = zCenter + (random() - 0.5) * (1 + random() * 1.4);
                const y = random() * height;
                const litWindow = random() > 0.82 && y > 2;
                const c = litWindow ? windowColor : random() > 0.72 ? accent : body;
                positions[i * 3] = x;
                positions[i * 3 + 1] = y;
                positions[i * 3 + 2] = z;
                colors[i * 3] = c.r;
                colors[i * 3 + 1] = c.g;
                colors[i * 3 + 2] = c.b;
            }
        }

        if (preset === 'ocean') {
            const water = new THREE.Color(objectSpec.material?.color || '#45d7ff');
            const accent = new THREE.Color(objectSpec.material?.accent || '#27f5d3');
            const foam = new THREE.Color(objectSpec.material?.foam || '#f5f7fb');
            for (let i = 0; i < count; i += 1) {
                const x = (random() - 0.5) * 76;
                const z = (random() - 0.5) * 42;
                const wave = Math.sin(x * 0.18) * 1.4 + Math.cos(z * 0.22) * 1.1;
                const c = wave > 1.5 ? foam : random() > 0.68 ? accent : water;
                positions[i * 3] = x;
                positions[i * 3 + 1] = wave + (random() - 0.5) * 0.35;
                positions[i * 3 + 2] = z;
                colors[i * 3] = c.r;
                colors[i * 3 + 1] = c.g;
                colors[i * 3 + 2] = c.b;
            }
        }

        if (preset === 'mountain') {
            const baseColor = new THREE.Color(objectSpec.material?.color || '#8fe7ff');
            const accent = new THREE.Color(objectSpec.material?.accent || '#27f5d3');
            const snow = new THREE.Color(objectSpec.material?.snow || '#f5f7fb');
            for (let i = 0; i < count; i += 1) {
                const x = (random() - 0.5) * 72;
                const z = (random() - 0.5) * 34;
                const ridge = Math.exp(-(x * x) / 520) * 22;
                const side = Math.exp(-((x - 22) ** 2) / 260) * 12 + Math.exp(-((x + 24) ** 2) / 320) * 14;
                const y = Math.max(0, ridge + side - Math.abs(z) * 0.48 + Math.sin(x * 0.27 + z * 0.14) * 1.8);
                const c = y > 20 ? snow : y > 10 ? accent : baseColor;
                positions[i * 3] = x;
                positions[i * 3 + 1] = y + (random() - 0.5) * 0.35;
                positions[i * 3 + 2] = z;
                colors[i * 3] = c.r;
                colors[i * 3 + 1] = c.g;
                colors[i * 3 + 2] = c.b;
            }
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('basePosition', new THREE.BufferAttribute(positions.slice(), 3));
        const points = new THREE.Points(
            geometry,
            new THREE.PointsMaterial({
                size: preset === 'highway' ? 0.08 : 0.095,
                vertexColors: true,
                transparent: true,
                opacity: preset === 'highway' ? 0.56 : 0.72,
                depthWrite: false, blending: THREE.AdditiveBlending
            })
        );
        points.position.set(...(objectSpec.position || [0, 0, 0]));
        points.userData.isInteractiveParticleObject = true;
        return { points, particles: [] };
    }

    createProjectile(objectSpec, sceneSpec) {
        const THREE = this.THREE;
        const color = objectSpec.material?.color || sceneSpec.palette[2] || '#ffb454';
        const mesh = this.createParticleBall({
            radius: objectSpec.radius || 1, count: 320,
            color, size: 0.13, opacity: 0.95,
            seed: sceneSpec.seed + 420
        });
        this.world.add(mesh);

        const projectile = {
            spec: objectSpec, mesh,
            start: new THREE.Vector3(...objectSpec.start),
            end: new THREE.Vector3(...objectSpec.end),
            impactAt: objectSpec.impactAt || 4,
            trail: null
        };

        if (objectSpec.trail?.enabled) {
            const trailCount = objectSpec.trail.length || 36;
            const trailGeometry = new THREE.BufferGeometry();
            trailGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(trailCount * 3), 3));
            const trail = new THREE.Points(
                trailGeometry,
                new THREE.PointsMaterial({
                    color: objectSpec.trail.color || color,
                    size: 0.34, transparent: true, opacity: 0.72,
                    blending: THREE.AdditiveBlending, depthWrite: false
                })
            );
            projectile.trail = { line: trail, count: trailCount };
        }
        return projectile;
    }

    createMagneticFieldLines(objectSpec, seed) {
        const THREE = this.THREE;
        const lineCount = clamp(Number(objectSpec.lineCount) || 16, 6, 40);
        const pointsPerLine = clamp(Number(objectSpec.pointsPerLine) || 80, 24, 160);
        const count = lineCount * pointsPerLine;
        const radius = objectSpec.radius || 24;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);
        const color = new THREE.Color(objectSpec.material?.color || '#45d7ff');
        const particles = [];
        const random = seededRandom(seed + hashText(objectSpec.id || 'field'));

        let idx = 0;
        for (let line = 0; line < lineCount; line += 1) {
            const azimuth = (line / lineCount) * Math.PI * 2;
            const phase = random() * Math.PI * 2;
            for (let step = 0; step < pointsPerLine; step += 1) {
                const t = step / Math.max(pointsPerLine - 1, 1);
                const polar = (t - 0.5) * Math.PI;
                const loopRadius = Math.cos(polar) * radius * (0.36 + 0.45 * Math.sin(line + 1));
                const y = Math.sin(polar) * radius * 0.78;
                const twist = Math.sin(t * Math.PI) * 0.8;
                const angle = azimuth + twist;
                const x = Math.cos(angle) * loopRadius;
                const z = Math.sin(angle) * loopRadius;
                positions[idx * 3] = x;
                positions[idx * 3 + 1] = y;
                positions[idx * 3 + 2] = z;
                colors[idx * 3] = color.r;
                colors[idx * 3 + 1] = color.g;
                colors[idx * 3 + 2] = color.b;
                particles.push({ line, step, t, azimuth, phase, radius: loopRadius, y });
                idx += 1;
            }
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('basePosition', new THREE.BufferAttribute(positions.slice(), 3));
        const points = new THREE.Points(
            geometry,
            new THREE.PointsMaterial({
                size: 0.11, vertexColors: true,
                transparent: true, opacity: 0.62,
                depthWrite: false, blending: THREE.AdditiveBlending
            })
        );
        points.position.set(...(objectSpec.position || [0, 0, 0]));
        points.userData.isInteractiveParticleObject = true;
        return { points, particles };
    }

    // --- Text rasterised into a Points geometry.
    createTextParticles(objectSpec, seed) {
        const THREE = this.THREE;
        const samples = sampleTextToPoints({
            text: objectSpec.text || 'SPIRIT',
            font: objectSpec.font,
            targetCount: objectSpec.particleCount || 4000,
            height: 220,
            scale: 0.075,
            depthJitter: 1.2
        });
        const count = samples.length;
        if (count === 0) {
            // Fallback: nothing to render — emit one offscreen point.
            samples.push([0, 0, 0]);
        }
        const positions = new Float32Array(samples.length * 3);
        const colors = new Float32Array(samples.length * 3);
        const color = new THREE.Color(objectSpec.material?.color || '#20d6b5');
        const accent = new THREE.Color(objectSpec.material?.accent || '#6aa9ff');
        const particles = [];
        const random = seededRandom(seed + hashText(objectSpec.id || 'text'));

        for (let i = 0; i < samples.length; i += 1) {
            const [x, y, z] = samples[i];
            positions[i * 3] = x;
            positions[i * 3 + 1] = y;
            positions[i * 3 + 2] = z;
            // Subtle horizontal gradient using the X position so the text
            // reads as two-tone instead of flat.
            const mix = clamp((x + 12) / 24, 0, 1);
            const c = color.clone().lerp(accent, mix);
            colors[i * 3] = c.r;
            colors[i * 3 + 1] = c.g;
            colors[i * 3 + 2] = c.b;
            particles.push({
                base: new THREE.Vector3(x, y, z),
                phase: random() * Math.PI * 2
            });
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('basePosition', new THREE.BufferAttribute(positions.slice(), 3));
        const points = new THREE.Points(
            geometry,
            new THREE.PointsMaterial({
                size: 0.18, vertexColors: true,
                transparent: true, opacity: 0.94,
                depthWrite: false, blending: THREE.AdditiveBlending
            })
        );
        points.position.set(...(objectSpec.position || [0, 0, 0]));
        points.userData.isInteractiveParticleObject = true;
        points.userData.preserveParticleShape = true;
        return { points, particles };
    }

    createModelParticles(objectSpec, seed) {
        const THREE = this.THREE;
        const source = Array.isArray(objectSpec.vertices) ? objectSpec.vertices : [];
        const sourceNormals = Array.isArray(objectSpec.normals) ? objectSpec.normals : [];
        const morphSource = Array.isArray(objectSpec.morphFromVertices) ? objectSpec.morphFromVertices : [];
        const morphNormals = Array.isArray(objectSpec.morphFromNormals) ? objectSpec.morphFromNormals : [];
        const morphVia = Array.isArray(objectSpec.morphViaVertices) ? objectSpec.morphViaVertices : [];
        const morphViaNormals = Array.isArray(objectSpec.morphViaNormals) ? objectSpec.morphViaNormals : [];
        const count = clamp(Number(objectSpec.particleCount) || source.length || 2000, 400, 200000);
        const random = seededRandom(seed + hashText(objectSpec.id || 'model'));
        const positions = new Float32Array(count * 3);
        const targetPositions = new Float32Array(count * 3);
        const viaPositions = morphVia.length ? new Float32Array(count * 3) : null;
        const colors = new Float32Array(count * 3);
        const normals = new Float32Array(count * 3);
        const particles = [];
        const color = new THREE.Color(objectSpec.material?.color || '#27f5d3');
        const accent = new THREE.Color(objectSpec.material?.accent || '#6aa9ff');
        const highlight = new THREE.Color(objectSpec.material?.highlight || '#f5f7fb');
        const brightness = Number(objectSpec.material?.brightness) || 1;

        const targetBounds = getModelBounds(source);
        const startBounds = morphSource.length ? getModelBounds(morphSource) : targetBounds;
        const viaBounds = morphVia.length ? getModelBounds(morphVia) : targetBounds;

        for (let i = 0; i < count; i += 1) {
            const vertex = source.length
                ? source[Math.floor((i / count) * source.length) % source.length]
                : [0, 0, 0];
            const startVertex = morphSource.length
                ? morphSource[Math.floor((i / count) * morphSource.length) % morphSource.length]
                : vertex;
            const viaVertex = morphVia.length
                ? morphVia[Math.floor((i / count) * morphVia.length) % morphVia.length]
                : vertex;
            const normalSource = sourceNormals.length
                ? sourceNormals[Math.floor((i / count) * sourceNormals.length) % sourceNormals.length]
                : null;
            const startNormalSource = morphNormals.length
                ? morphNormals[Math.floor((i / count) * morphNormals.length) % morphNormals.length]
                : normalSource;
            const viaNormalSource = morphViaNormals.length
                ? morphViaNormals[Math.floor((i / count) * morphViaNormals.length) % morphViaNormals.length]
                : normalSource;
            const nx = Number(normalSource?.[0]) || 0;
            const ny = Number(normalSource?.[1]) || 1;
            const nz = Number(normalSource?.[2]) || 0;
            const snx = Number(startNormalSource?.[0]) || nx;
            const sny = Number(startNormalSource?.[1]) || ny;
            const snz = Number(startNormalSource?.[2]) || nz;
            const vnx = Number(viaNormalSource?.[0]) || nx;
            const vny = Number(viaNormalSource?.[1]) || ny;
            const vnz = Number(viaNormalSource?.[2]) || nz;
            const jitter = objectSpec.sampled ? 0.006 : source.length < count ? 0.08 : 0.015;
            const target = normalizeModelVertex(vertex, targetBounds);
            const start = normalizeModelVertex(startVertex, startBounds);
            const via = normalizeModelVertex(viaVertex, viaBounds);
            const x = start.x + snx * jitter * (random() - 0.5);
            const y = start.y + sny * jitter * (random() - 0.5);
            const z = start.z + snz * jitter * (random() - 0.5);
            const vx = via.x + vnx * jitter * (random() - 0.5);
            const vy = via.y + vny * jitter * (random() - 0.5);
            const vz = via.z + vnz * jitter * (random() - 0.5);
            const tx = target.x + nx * jitter * (random() - 0.5);
            const ty = target.y + ny * jitter * (random() - 0.5);
            const tz = target.z + nz * jitter * (random() - 0.5);
            positions[i * 3] = x;
            positions[i * 3 + 1] = y;
            positions[i * 3 + 2] = z;
            targetPositions[i * 3] = tx;
            targetPositions[i * 3 + 1] = ty;
            targetPositions[i * 3 + 2] = tz;
            if (viaPositions) {
                viaPositions[i * 3] = vx;
                viaPositions[i * 3 + 1] = vy;
                viaPositions[i * 3 + 2] = vz;
            }
            normals[i * 3] = nx;
            normals[i * 3 + 1] = ny;
            normals[i * 3 + 2] = nz;

            const light = clamp((0.58 + nx * -0.16 + ny * 0.22 + nz * 0.2) * brightness, 0.18, 1.8);
            const mix = clamp((ty + 17) / 34, 0, 1);
            const rim = clamp(Math.abs(nx) * 0.22 + Math.max(ny, 0) * 0.22, 0, 0.42);
            const c = color.clone().lerp(accent, mix * 0.8).lerp(highlight, rim);
            colors[i * 3] = Math.min(c.r * light, 1);
            colors[i * 3 + 1] = Math.min(c.g * light, 1);
            colors[i * 3 + 2] = Math.min(c.b * light, 1);
            const phase = random() * Math.PI * 2;
            const scatter = new THREE.Vector3(random() - 0.5, random() - 0.35, random() - 0.5).normalize();
            particles.push({
                base: new THREE.Vector3(tx, ty, tz),
                normal: new THREE.Vector3(nx, ny, nz),
                startNormal: new THREE.Vector3(snx, sny, snz),
                scatter,
                phase,
                radius: Math.hypot(tx, ty, tz)
            });
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('normalHint', new THREE.BufferAttribute(normals, 3));
        geometry.setAttribute('basePosition', new THREE.BufferAttribute(positions.slice(), 3));
        geometry.setAttribute('targetPosition', new THREE.BufferAttribute(targetPositions, 3));
        if (viaPositions) geometry.setAttribute('viaPosition', new THREE.BufferAttribute(viaPositions, 3));
        const points = new THREE.Points(
            geometry,
            new THREE.PointsMaterial({
                size: objectSpec.material?.pointSize || (count >= 50000 ? 0.085 : 0.12),
                vertexColors: true,
                transparent: true,
                opacity: objectSpec.material?.opacity || 0.96,
                depthWrite: false,
                depthTest: true,
                blending: THREE.NormalBlending
            })
        );
        points.position.set(...(objectSpec.position || [0, 0, 0]));
        points.userData.isInteractiveParticleObject = true;
        points.userData.preserveParticleShape = true;
        return {
            points,
            particles,
            morphDuration: Number(objectSpec.morphDuration) || 0,
            morphViaAt: clamp(Number(objectSpec.morphViaAt) || 0.5, 0.12, 0.88)
        };

        function getModelBounds(points) {
            let minX = Infinity, minY = Infinity, minZ = Infinity;
            let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
            points.forEach((point) => {
                const [x, y, z] = point;
                if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return;
                minX = Math.min(minX, x); minY = Math.min(minY, y); minZ = Math.min(minZ, z);
                maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); maxZ = Math.max(maxZ, z);
            });
            return {
                cx: ((minX + maxX) * 0.5) || 0,
                cy: ((minY + maxY) * 0.5) || 0,
                cz: ((minZ + maxZ) * 0.5) || 0,
                scale: 34 / Math.max(maxX - minX, maxY - minY, maxZ - minZ, 1)
            };
        }

        function normalizeModelVertex(point, bounds) {
            return {
                x: ((Number(point?.[0]) || 0) - bounds.cx) * bounds.scale,
                y: ((Number(point?.[1]) || 0) - bounds.cy) * bounds.scale,
                z: ((Number(point?.[2]) || 0) - bounds.cz) * bounds.scale
            };
        }
    }

    createStarfield(effectSpec, seed) {
        const THREE = this.THREE;
        const count = clamp(Number(effectSpec.count) || 600, 100, 3000);
        const radius = effectSpec.radius || 80;
        const fib = fibonacciSphere(count, 1);
        const positions = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);
        const color = new THREE.Color(effectSpec.color || '#f5f7fb');
        const random = seededRandom(seed + 4242);
        for (let i = 0; i < count; i += 1) {
            const [x, y, z] = fib[i];
            const r = radius * (0.85 + random() * 0.3);
            positions[i * 3] = x * r;
            positions[i * 3 + 1] = y * r;
            positions[i * 3 + 2] = z * r;
            const tw = 0.55 + random() * 0.45;
            colors[i * 3] = color.r * tw;
            colors[i * 3 + 1] = color.g * tw;
            colors[i * 3 + 2] = color.b * tw;
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        const material = new THREE.PointsMaterial({
            size: 0.18, vertexColors: true,
            transparent: true, opacity: 0.7,
            depthWrite: false, blending: THREE.AdditiveBlending
        });
        const stars = new THREE.Points(geometry, material);
        stars.userData.backgroundStars = true;
        return stars;
    }

    createHologramGrid(effectSpec, seed) {
        const THREE = this.THREE;
        const gridSize = 44;
        const lines = 34;
        const count = lines * lines;
        const color = new THREE.Color(effectSpec.accent || '#6aa9ff');
        const brightness = effectSpec.brightness || 1;
        const positions = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);
        const random = seededRandom(seed);
        let cursor = 0;

        for (let x = 0; x < lines; x += 1) {
            for (let z = 0; z < lines; z += 1) {
                const px = (x / (lines - 1) - 0.5) * gridSize;
                const pz = (z / (lines - 1) - 0.5) * gridSize;
                const fade = 1 - clamp(Math.hypot(px, pz) / (gridSize * 0.62), 0, 1);
                const twinkle = 0.36 + random() * 0.34;
                positions[cursor * 3] = px;
                positions[cursor * 3 + 1] = -22;
                positions[cursor * 3 + 2] = pz;
                colors[cursor * 3] = color.r * fade * twinkle * brightness;
                colors[cursor * 3 + 1] = color.g * fade * twinkle * brightness;
                colors[cursor * 3 + 2] = color.b * fade * brightness;
                cursor += 1;
            }
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('basePosition', new THREE.BufferAttribute(positions.slice(), 3));
        const points = new THREE.Points(
            geometry,
            new THREE.PointsMaterial({
                size: 0.08,
                vertexColors: true,
                transparent: true,
                opacity: 0.5,
                depthWrite: false,
                blending: THREE.AdditiveBlending
            })
        );
        points.userData.isInteractiveParticleObject = true;
        return points;
    }

    createParticleBall({
        radius = 1, count = 300, color = '#ffffff',
        size = 0.12, opacity = 0.9, seed = 1,
        structured = true, fill = 1.0
    } = {}) {
        const THREE = this.THREE;
        const random = seededRandom(seed);
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);
        const particleColor = new THREE.Color(color);
        const fib = structured ? fibonacciSphere(count, 1) : null;

        for (let i = 0; i < count; i += 1) {
            let x, y, z;
            // fill=1 ⇒ full volume; fill=0.5 ⇒ thinner outer shell.
            const shell = fill >= 1 ? Math.cbrt((i + 0.5) / count) : (1 - (1 - fill) * random());
            if (structured) {
                const [fx, fy, fz] = fib[i];
                x = fx * radius * shell;
                y = fy * radius * shell;
                z = fz * radius * shell;
            } else {
                const u = random();
                const v = random();
                const theta = 2 * Math.PI * u;
                const phi = Math.acos(2 * v - 1);
                const r = radius * (0.72 + random() * 0.28);
                x = Math.sin(phi) * Math.cos(theta) * r;
                y = Math.cos(phi) * r;
                z = Math.sin(phi) * Math.sin(theta) * r;
            }
            positions[i * 3] = x;
            positions[i * 3 + 1] = y;
            positions[i * 3 + 2] = z;
            colors[i * 3] = particleColor.r;
            colors[i * 3 + 1] = particleColor.g;
            colors[i * 3 + 2] = particleColor.b;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('basePosition', new THREE.BufferAttribute(positions.slice(), 3));

        const points = new THREE.Points(
            geometry,
            new THREE.PointsMaterial({
                size, vertexColors: true,
                transparent: true, opacity,
                depthWrite: false, blending: THREE.AdditiveBlending
            })
        );
        points.userData.isInteractiveParticleObject = true;
        return points;
    }

    createParticleRing({ radius = 1, count = 180, color = '#ffffff', size = 0.14, opacity = 0.8, seed = 1 } = {}) {
        const THREE = this.THREE;
        const random = seededRandom(seed);
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);
        const particleColor = new THREE.Color(color);

        for (let i = 0; i < count; i += 1) {
            const angle = (i / count) * Math.PI * 2;
            const jitter = 1 + (random() - 0.5) * 0.05;
            positions[i * 3] = Math.cos(angle) * radius * jitter;
            positions[i * 3 + 1] = Math.sin(angle) * radius * jitter;
            positions[i * 3 + 2] = (random() - 0.5) * 0.08;
            colors[i * 3] = particleColor.r;
            colors[i * 3 + 1] = particleColor.g;
            colors[i * 3 + 2] = particleColor.b;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('basePosition', new THREE.BufferAttribute(positions.slice(), 3));
        const ring = new THREE.Points(
            geometry,
            new THREE.PointsMaterial({
                size, vertexColors: true,
                transparent: true, opacity,
                depthWrite: false, blending: THREE.AdditiveBlending
            })
        );
        ring.userData.isInteractiveParticleObject = true;
        return ring;
    }

    createParticleJet({ direction = 1, color = '#78a6ff', seed = 1 } = {}) {
        const THREE = this.THREE;
        const count = 520;
        const random = seededRandom(seed);
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);
        const particleColor = new THREE.Color(color);

        for (let i = 0; i < count; i += 1) {
            const t = random();
            const spread = (1 - t) * 2.5 + 0.15;
            const angle = random() * Math.PI * 2;
            positions[i * 3] = Math.cos(angle) * spread * random();
            positions[i * 3 + 1] = direction * (6 + t * 42);
            positions[i * 3 + 2] = Math.sin(angle) * spread * random();
            colors[i * 3] = particleColor.r;
            colors[i * 3 + 1] = particleColor.g;
            colors[i * 3 + 2] = particleColor.b;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('basePosition', new THREE.BufferAttribute(positions.slice(), 3));
        const jet = new THREE.Points(
            geometry,
            new THREE.PointsMaterial({
                size: 0.18, vertexColors: true,
                transparent: true, opacity: 0.26,
                depthWrite: false, blending: THREE.AdditiveBlending
            })
        );
        jet.userData.isInteractiveParticleObject = true;
        return jet;
    }

    // ---- pointer interaction ---------------------------------------------

    applyPointerToPoints(points, strength = 1) {
        if (!points?.geometry?.attributes?.basePosition) return;
        const base = points.geometry.attributes.basePosition;
        const positions = points.geometry.attributes.position;
        const pointerX = this.pointer.x * 30;
        const pointerY = -this.pointer.y * 20;
        const activeScale = this.pointer.active ? 1 : 0.35;

        for (let i = 0; i < positions.count; i += 1) {
            const bx = base.getX(i);
            const by = base.getY(i);
            const bz = base.getZ(i);
            const worldX = bx + points.position.x;
            const worldY = by + points.position.y;
            const dx = worldX - pointerX;
            const dy = worldY - pointerY;
            const influence = Math.exp(-(dx * dx + dy * dy) / 360) * strength * activeScale;
            positions.setXYZ(
                i,
                bx + dx * influence * 0.12,
                by + dy * influence * 0.12,
                bz + influence * 3.2
            );
        }
        positions.needsUpdate = true;
    }

    applyPointerToInteractiveObjects(strength = 1) {
        this.world.traverse((child) => {
            if (child.userData?.isInteractiveParticleObject) {
                if (child.userData?.preserveParticleShape) return;
                this.applyPointerToPoints(child, strength);
            }
        });
    }

    resize() {
        if (!this.ready) return;
        const rect = this.container.getBoundingClientRect();
        this.camera.aspect = rect.width / Math.max(rect.height, 1);
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(rect.width, rect.height, false);
    }

    // ---- scene-graph runtime ---------------------------------------------

    renderSceneGraph(time, paused) {
        const runtime = this.graphRuntime;
        const localTime = time % runtime.duration;
        const smoothstep = (v) => { const x = clamp(v, 0, 1); return x * x * (3 - 2 * x); };

        // Per-object updates (projectiles, planet self-rotation)
        runtime.objects.forEach((entry) => {
            if (entry.spec?.type === 'projectile') {
                const impactAt = entry.impactAt;
                const progress = smoothstep(localTime / impactAt) ** 1.22;
                const visible = localTime <= impactAt + 0.25;
                entry.mesh.visible = visible;
                entry.mesh.position.copy(entry.start).lerp(entry.end, progress);

                if (entry.trail) {
                    const positions = entry.trail.line.geometry.attributes.position;
                    for (let i = 0; i < entry.trail.count; i += 1) {
                        const tp = clamp(progress - i * 0.018, 0, 1);
                        const pt = entry.start.clone().lerp(entry.end, tp);
                        const tailLift = Math.sin(i * 0.55 + time) * 0.22 * (1 - i / entry.trail.count);
                        positions.setXYZ(i, pt.x, pt.y + tailLift, pt.z);
                    }
                    positions.needsUpdate = true;
                    entry.trail.line.visible = visible;
                }
            }

            if (entry.spec?.role === 'planet' && !paused) entry.mesh.rotation.y += 0.0025;
            if (entry.kind === 'star_body' && !paused) {
                // Subtle pulsation of the corona to feel alive.
                const pulse = 1 + Math.sin(time * 0.8 + (entry.spec?.material?.coronaRadius || 0)) * 0.04;
                entry.corona.scale.set(pulse, pulse, pulse);
                entry.core.rotation.y += 0.002;
            }
        });

        this.updateGraphMotions(runtime, localTime, time, paused);
        this.updateGraphForces(runtime, localTime, time, paused);

        Object.values(runtime.effects).forEach((effect) => {
            if (effect.spec.type === 'particle_bridge') {
                this.updateParticleBridge(effect, runtime, time);
                return;
            }
            if (effect.spec.type === 'glow_core') {
                if (!paused) effect.mesh.rotation.y += 0.006;
                if (effect.spec.attachedTo) {
                    const target = runtime.objects.get(effect.spec.attachedTo);
                    if (target) effect.mesh.position.copy(target.mesh.position);
                }
                return;
            }
            if (effect.spec.type === 'speed_trail') {
                this.updateSpeedTrail(effect, runtime, time, paused);
                return;
            }
            if (effect.spec.type === 'starfield') {
                if (!paused) effect.mesh.rotation.y += 0.0004;
                return;
            }
            if (effect.spec.type === 'hologram_stage') {
                if (!paused) {
                    effect.group.children.forEach((child) => {
                        if (child.userData?.spin) child.rotation.z += child.userData.spin;
                    });
                }
                return;
            }
            if (effect.spec.type === 'voice_stage') {
                this.updateVoiceStage(effect, time, paused);
                return;
            }

            const start = effect.event?.at || 0;
            const elapsed = localTime - start;
            const duration = effect.spec.duration || 2;
            const active = elapsed >= 0 && elapsed <= duration;

            if (effect.mesh) effect.mesh.visible = active;

            if (effect.spec.type === 'flash') {
                const p = clamp(elapsed / duration, 0, 1);
                const opacity = active ? (1 - p) ** 1.8 : 0;
                effect.mesh.scale.setScalar(1 + p * 9);
                effect.mesh.material.opacity = opacity * 0.82;
            }
            if (effect.spec.type === 'shockwave') {
                const p = clamp(elapsed / duration, 0, 1);
                const r = 0.4 + p * (effect.spec.maxRadius || 18);
                effect.mesh.scale.set(r, r, r);
                effect.mesh.material.opacity = active ? (1 - p) * 0.62 : 0;
            }
            if (effect.spec.type === 'debris') {
                effect.points.visible = elapsed >= 0;
                const p = Math.max(elapsed, 0);
                effect.points.material.opacity = elapsed >= 0 ? clamp(1 - p / 5, 0, 0.86) : 0;
                const positions = effect.points.geometry.attributes.position;
                const gravity = new this.THREE.Vector3(0, -0.45 * p * p, 0);
                effect.particles.forEach((particle, i) => {
                    const drift = particle.velocity.clone().multiplyScalar(p * particle.drag).add(gravity);
                    const pos = effect.origin.clone().add(drift);
                    positions.setXYZ(i, pos.x, pos.y, pos.z);
                });
                positions.needsUpdate = true;
            }
        });

        this.applyPointerToInteractiveObjects(0.9);

        const impact = runtime.events.find((e) => e.type === 'collision');
        const shakeStart = runtime.camera.shakeAt || impact?.at || 0;
        const shakeElapsed = localTime - shakeStart;
        const shake = shakeElapsed > 0 && shakeElapsed < 0.7 ? (1 - shakeElapsed / 0.7) * 1.4 : 0;
        this.applyCameraOrbit({ shake, time });
    }

    updateGraphMotions(runtime, localTime, time, paused) {
        if (paused) return;

        runtime.motions.forEach((motion) => {
            switch (motion.type) {
                case 'orbit': {
                    if (!Array.isArray(motion.targets)) return;
                    const radius = motion.radius || 18;
                    const speed = motion.speed || 0.5;
                    motion.targets.forEach((id, index) => {
                        const entry = runtime.objects.get(id);
                        if (!entry) return;
                        const angle = time * speed + index * Math.PI;
                        entry.mesh.position.set(
                            Math.cos(angle) * radius,
                            Math.sin(angle * 1.2) * 3,
                            Math.sin(angle) * radius * 0.7
                        );
                    });
                    return;
                }
                case 'binary_orbit': {
                    // Two stars orbit a shared barycenter at [0,0,0] in a
                    // single plane (tilted by `tilt`). Each star's distance
                    // from the barycenter is inversely proportional to its
                    // massRatio so the heavier star stays closer to centre.
                    if (!Array.isArray(motion.targets) || motion.targets.length < 2) return;
                    const [idA, idB] = motion.targets;
                    const a = runtime.objects.get(idA);
                    const b = runtime.objects.get(idB);
                    if (!a || !b) return;
                    const semiMajor = motion.semiMajor || 18;
                    const speed = motion.speed || 0.5;
                    const tilt = motion.tilt || 0;
                    const massA = a.spec.massRatio || 1;
                    const massB = b.spec.massRatio || 1;
                    const total = massA + massB;
                    const rA = semiMajor * (massB / total);
                    const rB = semiMajor * (massA / total);
                    const angle = time * speed;
                    const cosA = Math.cos(angle), sinA = Math.sin(angle);
                    a.mesh.position.set( cosA * rA,  sinA * rA * Math.sin(tilt),  sinA * rA * Math.cos(tilt));
                    b.mesh.position.set(-cosA * rB, -sinA * rB * Math.sin(tilt), -sinA * rB * Math.cos(tilt));
                    return;
                }
                case 'orbit_body': {
                    const entry = runtime.objects.get(motion.target);
                    if (!entry) return;
                    const center = runtime.objects.get(motion.center);
                    const centerPos = center?.mesh.position || new this.THREE.Vector3(0, 0, 0);
                    const angle = time * (motion.speed || 0.6) + (motion.phase || 0);
                    const radius = motion.radius || 20;
                    const tilt = motion.tilt || 0;
                    entry.mesh.position.set(
                        centerPos.x + Math.cos(angle) * radius,
                        centerPos.y + Math.sin(angle) * radius * Math.sin(tilt),
                        centerPos.z + Math.sin(angle) * radius * Math.cos(tilt)
                    );
                    return;
                }
                case 'wobble': {
                    const entry = runtime.objects.get(motion.target);
                    if (!entry) return;
                    const angle = time * (motion.speed || 0.8);
                    const radius = motion.radius || 1;
                    entry.mesh.position.x = Math.cos(angle) * radius;
                    entry.mesh.position.z = Math.sin(angle) * radius * 0.5;
                    return;
                }
                case 'helix_flow': {
                    const entry = runtime.objects.get(motion.target);
                    if (!entry) return;
                    this.updateHelixFlow(entry, time, motion);
                    return;
                }
                case 'spiral': {
                    const entry = runtime.objects.get(motion.target);
                    if (!entry) return;
                    // Simple spiral spin around y-axis; vortex force handles inward drift.
                    entry.mesh.rotation.y += (motion.speed || 0.5) * 0.005;
                    return;
                }
                case 'slow_orbit': {
                    const entry = runtime.objects.get(motion.target);
                    if (!entry) return;
                    entry.mesh.rotation.y += (motion.speed || 0.4) * 0.0022;
                    entry.mesh.rotation.x = Math.sin(time * (motion.speed || 0.4) * 0.35) * 0.035;
                    return;
                }
                case 'speed_pulse': {
                    const entry = runtime.objects.get(motion.target);
                    if (!entry) return;
                    const basePos = entry.basePosition || entry.mesh.position;
                    const pulse = Math.sin(time * (motion.speed || 5));
                    entry.mesh.position.set(
                        basePos.x,
                        basePos.y + pulse * (motion.amplitude || 0.12),
                        basePos.z
                    );
                    entry.mesh.rotation.z = pulse * 0.012;
                    return;
                }
                case 'spin': {
                    const entry = runtime.objects.get(motion.target);
                    if (!entry) return;
                    const axis = (motion.axis || 'z').toLowerCase();
                    const speed = motion.speed || 4;
                    // Drive rotation directly off elapsed time so spinning is
                    // smooth and independent of frame rate.
                    const angle = time * speed;
                    if (axis === 'x') entry.mesh.rotation.x = angle;
                    else if (axis === 'y') entry.mesh.rotation.y = angle;
                    else entry.mesh.rotation.z = angle;
                    return;
                }
                case 'road_scroll': {
                    const entry = runtime.objects.get(motion.target);
                    if (!entry) return;
                    this.updateRoadScroll(entry, time, motion);
                    return;
                }
                case 'wave_surface': {
                    const entry = runtime.objects.get(motion.target);
                    if (!entry) return;
                    this.updateWaveSurface(entry, time, motion);
                    return;
                }
                case 'float': {
                    const entry = runtime.objects.get(motion.target);
                    if (!entry) return;
                    const basePos = entry.basePosition || new this.THREE.Vector3();
                    const amp = motion.amplitude || 0.4;
                    const sp = motion.speed || 0.6;
                    entry.mesh.position.set(
                        basePos.x,
                        basePos.y + Math.sin(time * sp) * amp,
                        basePos.z
                    );
                    entry.mesh.rotation.y = Math.sin(time * sp * 0.4) * 0.08;
                    return;
                }
                case 'model_flow': {
                    const entry = runtime.objects.get(motion.target);
                    if (!entry) return;
                    this.updateModelFlow(entry, time, motion);
                    return;
                }
                default:
                    return;
            }
        });
    }

    updateGraphForces(runtime, localTime, time, paused) {
        runtime.forces.forEach((force) => {
            if (force.type === 'attraction') {
                const [aId, bId] = force.targets || [];
                const a = runtime.objects.get(aId);
                const b = runtime.objects.get(bId);
                if (!a || !b) return;
                const center = a.mesh.position.clone().add(b.mesh.position).multiplyScalar(0.5);
                const pulse = 0.5 + 0.5 * Math.sin(time * 0.9);
                const pull = (force.strength || 0.6) * (0.25 + pulse * 0.35);
                a.mesh.position.lerp(center, pull * 0.018);
                b.mesh.position.lerp(center, pull * 0.018);
                this.updateAttractionCloud(a, b.mesh.position, time, force.spiral || 0.4, 1);
                this.updateAttractionCloud(b, a.mesh.position, time, force.spiral || 0.4, -1);
            }
            if (force.type === 'vortex') {
                const entry = runtime.objects.get(force.target);
                if (!entry) return;
                this.updateVortexCloud(entry, time, force);
            }
            if (force.type === 'breathing_sphere') {
                const entry = runtime.objects.get(force.target);
                if (!entry) return;
                this.updateBreathingSphere(entry, time, force);
            }
            if (force.type === 'magnetic') {
                const entry = runtime.objects.get(force.target);
                if (!entry) return;
                this.updateMagneticFlow(entry, time, force);
            }
        });
    }

    updateAttractionCloud(entry, targetPosition, time, spiral, direction) {
        const positions = entry.mesh.geometry?.attributes?.position;
        const base = entry.mesh.geometry?.attributes?.basePosition;
        if (!positions || !base) return;
        const localTarget = targetPosition.clone().sub(entry.mesh.position);

        for (let i = 0; i < positions.count; i += 1) {
            const bx = base.getX(i);
            const by = base.getY(i);
            const bz = base.getZ(i);
            const phase = entry.particles?.[i]?.phase || 0;
            const swirl = Math.sin(time * 1.2 + phase) * spiral;
            const mix = 0.12 + 0.08 * Math.sin(time * 0.7 + phase);
            const x = bx * (1 - mix) + localTarget.x * mix + Math.cos(time + phase) * swirl * direction;
            const y = by * (1 - mix) + localTarget.y * mix * 0.5 + Math.sin(time * 1.3 + phase) * swirl;
            const z = bz * (1 - mix) + localTarget.z * mix + Math.sin(time + phase) * swirl * direction;
            positions.setXYZ(i, x, y, z);
        }
        positions.needsUpdate = true;
    }

    updateVortexCloud(entry, time, force) {
        const positions = entry.mesh.geometry?.attributes?.position;
        const base = entry.mesh.geometry?.attributes?.basePosition;
        if (!positions || !base) return;
        const strength = force.strength || 1;
        const voiceEnergy = Math.max(this.voiceState.inputLevel || 0, this.voiceState.outputLevel || 0, this.voiceState.energy || 0);
        const voiceModeScale = this.voiceState.mode === 'speaking' ? 1.65 : this.voiceState.mode === 'listening' ? 1.05 : 0.42;
        const voicePulse = voiceEnergy * voiceModeScale;

        for (let i = 0; i < positions.count; i += 1) {
            const bx = base.getX(i);
            const by = base.getY(i);
            const bz = base.getZ(i);
            const radius = Math.hypot(bx, bz);
            const baseAngle = Math.atan2(bz, bx);
            const depth = radius / 30;
            const phase = entry.particles?.[i]?.phase || 0;
            const voiceWave = Math.sin(time * 5.2 + phase + depth * 2.4) * voicePulse;
            const angle = baseAngle + time * strength * (1.4 - depth * 0.65) + voiceWave * 0.12;
            const inward = 1 - 0.22 * Math.sin(time * 0.8 + depth * 4) - voicePulse * 0.045;
            const yWave = by
                + Math.sin(time * 1.5 + radius * 0.18) * 2.2
                + Math.sin(time * 4.4 + phase) * voicePulse * 3.2;
            positions.setXYZ(
                i,
                Math.cos(angle) * radius * inward,
                yWave,
                Math.sin(angle) * radius * inward
            );
        }
        entry.mesh.scale.setScalar(1 + voicePulse * 0.028);
        positions.needsUpdate = true;
    }

    updateBreathingSphere(entry, time, force) {
        const positions = entry.mesh.geometry?.attributes?.position;
        const base = entry.mesh.geometry?.attributes?.basePosition;
        if (!positions || !base) return;
        const strength = force.strength || 0.7;
        const waveStrength = force.wave || 0.42;
        const voiceEnergy = Math.max(this.voiceState.inputLevel || 0, this.voiceState.outputLevel || 0, this.voiceState.energy || 0);
        const voiceModeScale = this.voiceState.mode === 'speaking' ? 2.1 : this.voiceState.mode === 'listening' ? 1.15 : 0.36;
        const voicePulse = voiceEnergy * voiceModeScale;

        for (let i = 0; i < positions.count; i += 1) {
            const bx = base.getX(i);
            const by = base.getY(i);
            const bz = base.getZ(i);
            const radius = Math.max(Math.hypot(bx, by, bz), 0.001);
            const nx = bx / radius;
            const ny = by / radius;
            const nz = bz / radius;
            const phase = entry.particles?.[i]?.phase || 0;
            const lat = Math.atan2(by, Math.hypot(bx, bz));
            const lon = Math.atan2(bz, bx);
            const slowBreath = Math.sin(time * 0.78 + phase * 0.18) * strength;
            const surfaceRipple = Math.sin(lon * 5.2 + time * 1.4) * Math.cos(lat * 4.5 - time * 0.85) * waveStrength;
            const voiceRipple = Math.sin(lon * 8.0 + lat * 5.5 + time * 5.4 + phase) * voicePulse * 1.65;
            const targetRadius = radius + slowBreath + surfaceRipple + voiceRipple + voicePulse * 1.25;
            positions.setXYZ(i, nx * targetRadius, ny * targetRadius, nz * targetRadius);
        }
        entry.mesh.scale.setScalar(1 + voicePulse * 0.018);
        positions.needsUpdate = true;
    }

    updateHelixFlow(entry, time, motion) {
        const positions = entry.mesh.geometry?.attributes?.position;
        if (!positions) return;
        const speed = motion.speed || 0.9;
        const radius = motion.radius || 18;

        for (let i = 0; i < positions.count; i += 1) {
            const phase = entry.particles?.[i]?.phase || 0;
            const t = ((i / positions.count) + time * speed * 0.08 + phase * 0.01) % 1;
            const angle = t * Math.PI * 10 + phase;
            const streamRadius = radius * (0.25 + 0.55 * ((i % 23) / 23));
            positions.setXYZ(i, Math.cos(angle) * streamRadius, (t - 0.5) * 48, Math.sin(angle) * streamRadius);
        }
        positions.needsUpdate = true;
    }

    updateMagneticFlow(entry, time, force) {
        const positions = entry.mesh.geometry?.attributes?.position;
        if (!positions) return;
        const strength = force.strength || 1;
        for (let i = 0; i < positions.count; i += 1) {
            const x = positions.getX(i);
            const y = positions.getY(i);
            const z = positions.getZ(i);
            const bend = Math.sin(time * 1.4 + y * 0.08 + i * 0.01) * strength * 0.08;
            positions.setXYZ(
                i,
                x * Math.cos(bend) - z * Math.sin(bend),
                y,
                x * Math.sin(bend) + z * Math.cos(bend)
            );
        }
        positions.needsUpdate = true;
    }

    updateRoadScroll(entry, time, motion) {
        const positions = entry.mesh.geometry?.attributes?.position;
        const base = entry.mesh.geometry?.attributes?.basePosition;
        if (!positions || !base) return;
        const length = motion.length || 86;
        const offset = (time * (motion.speed || 1) * 22) % length;

        for (let i = 0; i < positions.count; i += 1) {
            let x = base.getX(i) - offset;
            while (x < -length * 0.62) x += length;
            positions.setXYZ(i, x, base.getY(i), base.getZ(i));
        }
        positions.needsUpdate = true;
    }

    updateWaveSurface(entry, time, motion) {
        const positions = entry.mesh.geometry?.attributes?.position;
        const base = entry.mesh.geometry?.attributes?.basePosition;
        if (!positions || !base) return;
        const speed = motion.speed || 1;
        const amplitude = motion.amplitude || 1.6;
        const voiceEnergy = Math.max(this.voiceState.inputLevel || 0, this.voiceState.outputLevel || 0, this.voiceState.energy || 0);
        const voiceBoost = this.voiceState.mode === 'speaking' ? voiceEnergy * 2.2 : voiceEnergy * 0.9;

        for (let i = 0; i < positions.count; i += 1) {
            const x = base.getX(i);
            const y = base.getY(i);
            const z = base.getZ(i);
            const wave = Math.sin(x * 0.2 + time * speed * 1.8)
                + Math.cos(z * 0.24 + time * speed * 1.2)
                + Math.sin((x + z) * 0.08 + time * speed * 2.4) * 0.45;
            positions.setXYZ(i, x, y + wave * (amplitude * 0.42 + voiceBoost), z);
        }
        positions.needsUpdate = true;
    }

    updateVoiceStage(effect, time, paused) {
        if (!effect.rings) return;
        const energy = Math.max(this.voiceState.inputLevel || 0, this.voiceState.outputLevel || 0, this.voiceState.energy || 0);
        const mode = this.voiceState.mode || 'idle';
        const modeScale = mode === 'speaking' ? 1.85 : mode === 'listening' ? 1.05 : mode === 'thinking' ? 0.72 : 0.28;
        const pulse = energy * modeScale;

        effect.rings.forEach((ring, index) => {
            const wave = Math.sin(time * (2.2 + index * 0.55) + index * 1.7);
            const listenBreath = mode === 'listening' ? Math.sin(time * 1.35 + index) * 0.035 : 0;
            const speakingWave = mode === 'speaking' ? Math.max(0, wave) * (0.08 + pulse * 0.1) : 0;
            const thinkingTension = mode === 'thinking' ? Math.sin(time * 0.9 + index) * 0.018 : 0;
            ring.scale.setScalar(1 + listenBreath + speakingWave + thinkingTension + pulse * (0.025 + index * 0.01));
            ring.material.opacity = clamp((ring.userData.baseOpacity || 0.08) * (1 + pulse * 2.8 + Math.max(0, wave) * 0.45), 0.025, 0.34);
            if (!paused) {
                ring.rotation.z += (0.0016 + index * 0.0008) * (mode === 'speaking' ? 2.4 : 1);
            }
        });
    }

    updateModelFlow(entry, time, motion) {
        const positions = entry.mesh.geometry?.attributes?.position;
        const base = entry.mesh.geometry?.attributes?.basePosition;
        const target = entry.mesh.geometry?.attributes?.targetPosition;
        const via = entry.mesh.geometry?.attributes?.viaPosition;
        if (!positions || !base) return;
        const speed = motion.speed || 0.8;
        const amplitude = motion.amplitude || 0.8;
        const voiceEnergy = Math.max(this.voiceState.inputLevel || 0, this.voiceState.outputLevel || 0, this.voiceState.energy || 0);
        const voicePulse = (this.voiceState.mode === 'speaking' ? 1.5 : this.voiceState.mode === 'listening' ? 0.8 : 0.35) * voiceEnergy;
        if (entry.morphStartTime === null) entry.morphStartTime = time;
        const rawMorph = entry.morphDuration > 0
            ? clamp((time - entry.morphStartTime) / entry.morphDuration, 0, 1)
            : 1;
        const morph = rawMorph * rawMorph * (3 - 2 * rawMorph);
        const split = entry.morphViaAt || 0.5;
        const transitionBurst = via
            ? (morph < split
                ? Math.sin((morph / split) * Math.PI)
                : Math.sin(((morph - split) / Math.max(1 - split, 0.001)) * Math.PI))
            : Math.sin(morph * Math.PI);

        for (let i = 0; i < positions.count; i += 1) {
            const sx = base.getX(i);
            const sy = base.getY(i);
            const sz = base.getZ(i);
            const tx = target ? target.getX(i) : sx;
            const ty = target ? target.getY(i) : sy;
            const tz = target ? target.getZ(i) : sz;
            const vx = via ? via.getX(i) : tx;
            const vy = via ? via.getY(i) : ty;
            const vz = via ? via.getZ(i) : tz;
            const phase = entry.particles?.[i]?.phase || 0;
            let bx;
            let by;
            let bz;
            if (via) {
                if (morph < split) {
                    const segment = morph / split;
                    const ease = segment * segment * (3 - 2 * segment);
                    bx = sx * (1 - ease) + vx * ease;
                    by = sy * (1 - ease) + vy * ease;
                    bz = sz * (1 - ease) + vz * ease;
                } else {
                    const segment = (morph - split) / Math.max(1 - split, 0.001);
                    const ease = segment * segment * (3 - 2 * segment);
                    bx = vx * (1 - ease) + tx * ease;
                    by = vy * (1 - ease) + ty * ease;
                    bz = vz * (1 - ease) + tz * ease;
                }
            } else {
                bx = sx * (1 - morph) + tx * morph;
                by = sy * (1 - morph) + ty * morph;
                bz = sz * (1 - morph) + tz * morph;
            }
            const radius = Math.max(entry.particles?.[i]?.radius || Math.hypot(bx, by, bz), 0.001);
            const normal = entry.particles?.[i]?.normal;
            const nx = normal?.x || bx / radius;
            const ny = normal?.y || by / radius;
            const nz = normal?.z || bz / radius;
            const breathe = Math.sin(time * speed + phase) * (amplitude + voicePulse * 0.9);
            const stream = Math.sin(time * speed * 1.7 + by * 0.18 + phase) * 0.18;
            const pointer = this.pointerInfluence(bx, by) * (motion.pointerStrength || 1);
            const scatter = entry.particles?.[i]?.scatter;
            const burst = transitionBurst * (5.5 + Math.sin(phase * 3.1) * 2.2);
            const voiceLift = voicePulse * (1.2 + Math.sin(phase + time * 4) * 0.6);
            positions.setXYZ(
                i,
                bx + nx * (breathe + pointer * 3.4 + voiceLift) + (scatter?.x || 0) * burst + Math.cos(phase + time) * stream,
                by + ny * (breathe + pointer * 2.2 + voiceLift),
                bz + nz * (breathe + pointer * 3.4 + voiceLift) + (scatter?.z || 0) * burst + Math.sin(phase + time) * stream
            );
        }
        entry.mesh.rotation.y += (motion.rotationSpeed || 0) * 0.003 * speed;
        entry.mesh.scale.setScalar(1 + voicePulse * 0.018);
        positions.needsUpdate = true;
    }

    updateSpeedTrail(effect, runtime, time, paused) {
        if (paused) return;
        const target = runtime.objects.get(effect.spec.target);
        if (!target) return;
        const positions = effect.points.geometry.attributes.position;
        const base = effect.points.geometry.attributes.basePosition;
        const length = effect.spec.length || 36;

        for (let i = 0; i < positions.count; i += 1) {
            const phase = i / Math.max(positions.count - 1, 1);
            const stream = (phase + time * 0.82) % 1;
            const flutter = Math.sin(time * 7 + i * 0.21) * 0.18;
            positions.setXYZ(
                i,
                target.mesh.position.x - 6 - stream * length,
                target.mesh.position.y + base.getY(i) + flutter,
                target.mesh.position.z + base.getZ(i) * (0.55 + stream * 0.45)
            );
        }
        effect.points.material.opacity = 0.28 + 0.18 * Math.sin(time * 3.4) ** 2;
        positions.needsUpdate = true;
    }

    updateParticleBridge(effect, runtime, time) {
        const [aId, bId] = effect.spec.targets || [];
        const a = runtime.objects.get(aId);
        const b = runtime.objects.get(bId);
        if (!a || !b) return;
        const positions = effect.points.geometry.attributes.position;
        for (let i = 0; i < positions.count; i += 1) {
            const t = i / Math.max(positions.count - 1, 1);
            const wave = Math.sin(t * Math.PI * 8 + time * 3) * 1.2;
            const point = a.mesh.position.clone().lerp(b.mesh.position, t);
            positions.setXYZ(i, point.x, point.y + wave, point.z + Math.cos(t * Math.PI * 6 + time * 2) * 1.4);
        }
        positions.needsUpdate = true;
    }

    render(time, paused) {
        if (!this.ready || !this.sceneSpec) return;
        const sceneSpec = this.sceneSpec;
        this.updatePointerField();

        if (this.graphRuntime) {
            this.renderSceneGraph(time, paused);
            this.renderer.render(this.scene, this.camera);
            return;
        }

        if (!paused) {
            this.world.rotation.y += sceneSpec.controls.autoRotate ? 0.0018 * sceneSpec.speed : 0;
        }

        if (this.points && !paused) {
            const positions = this.points.geometry.attributes.position;
            for (let i = 0; i < this.particleData.length; i += 1) {
                const p = this.particleData[i];
                if (p.motion === 'black_hole') {
                    const kepler = 22 / Math.pow(p.radius, 1.5);
                    const frameDrag = 0.32 / Math.max(p.radius, 1);
                    const angle = p.angle + time * sceneSpec.speed * (kepler + frameDrag) * 7.5;
                    const inwardPulse = Math.sin(time * 1.6 + p.phase) * sceneSpec.intensity * 0.42;
                    const radius = p.radius - inwardPulse;
                    const warp = Math.sin(angle * 2 + time * 0.7 + p.phase) * p.turbulence;
                    let x = Math.cos(angle + p.precession) * radius;
                    let y = p.diskHeight + warp;
                    let z = Math.sin(angle + p.precession) * radius * p.eccentricity;
                    const influence = this.pointerInfluence(x, y);
                    x += (x - this.pointer.x * 30) * influence * 0.08;
                    y += (y + this.pointer.y * 20) * influence * 0.08;
                    z += influence * 5;
                    positions.setXYZ(i, x, y, z);
                } else {
                    const angle = p.angle + time * sceneSpec.speed * p.drift * 0.24;
                    const pulse = Math.sin(time * 0.8 + p.phase) * sceneSpec.intensity * 4;
                    const radius = p.radius + pulse;
                    let x = Math.cos(angle) * radius;
                    let y = p.layer * 18 + Math.sin(angle * 2.2 + time) * 4.2;
                    let z = Math.sin(angle) * radius;
                    const influence = this.pointerInfluence(x, y);
                    x += (x - this.pointer.x * 30) * influence * 0.1;
                    y += (y + this.pointer.y * 20) * influence * 0.1;
                    z += influence * 5.5;
                    positions.setXYZ(i, x, y, z);
                }
            }
            positions.needsUpdate = true;
        }

        this.applyPointerToInteractiveObjects(0.45);

        this.world.children.forEach((child) => {
            if (child.userData?.spin && !paused) child.rotation.z += child.userData.spin || 0;
            if (child.userData?.orbitRadius && !paused) {
                const a = time * child.userData.speed + child.userData.phase;
                child.position.set(
                    Math.cos(a) * child.userData.orbitRadius,
                    Math.sin(a * 1.4) * child.userData.tilt * 6,
                    Math.sin(a) * child.userData.orbitRadius * 0.72
                );
            }
        });

        this.applyCameraOrbit({ time });
        this.renderer.render(this.scene, this.camera);
    }

    pointerInfluence(x, y) {
        const pointerX = this.pointer.x * 30;
        const pointerY = -this.pointer.y * 20;
        const dx = x - pointerX;
        const dy = y - pointerY;
        const activeScale = this.pointer.active ? 1 : 0.25;
        return Math.exp(-(dx * dx + dy * dy) / 420) * activeScale;
    }
}
