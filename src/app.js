const stage = document.querySelector('.stage');
const threeStage = document.getElementById('threeStage');
const promptForm = document.getElementById('promptForm');
const promptInput = document.getElementById('promptInput');
const sceneSpec = document.getElementById('sceneSpec');
const sceneKind = document.getElementById('sceneKind');
const sceneTitle = document.getElementById('sceneTitle');
const pauseBtn = document.getElementById('pauseBtn');
const pauseIcon = document.getElementById('pauseIcon');

const DEFAULT_SCENE = {
    renderer: '3d',
    kind: 'particle_nebula',
    title: 'Particle Nebula',
    palette: ['#20d6b5', '#6aa9ff', '#f5f7fb'],
    particleCount: 2400,
    speed: 0.86,
    intensity: 0.82,
    labels: ['central attractor', 'orbital flow'],
    seed: 108,
    controls: {
        trail: true,
        glow: true,
        autoRotate: true
    }
};

const appState = {
    scene: null,
    activeRenderer: null,
    time: 0,
    lastFrame: performance.now(),
    paused: false
};

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function hashText(text) {
    let hash = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return Math.abs(hash);
}

function seededRandom(seed) {
    let value = seed || 1;
    return () => {
        value = Math.imul(48271, value) % 2147483647;
        return (value & 2147483647) / 2147483647;
    };
}

function parseScenePrompt(prompt) {
    const text = prompt.trim().toLowerCase();
    const seed = hashText(text);

    const wants3d = true;
    const wantsImpact = /(comet|meteor|asteroid|impact|crash|collide|彗星|陨石|小行星|撞击|碰撞)/.test(text);
    const wantsAttraction = /(attract|pull together|converge|spiral inward|soul|energy clouds|互相吸引|吸引|靠近|灵魂|能量球|汇聚)/.test(text);
    const wantsVortex = /(vortex|spiral|whirlpool|tornado|swirl|漩涡|旋涡|螺旋|龙卷|旋转场)/.test(text);
    const wantsBinary = /(binary star|double star|two stars|双星|双恒星|双星系统)/.test(text);
    const wantsMagnetic = /(magnetic|magnet|electromagnetic|lorentz|charged particles|磁场|电磁|洛伦兹|带电粒子)/.test(text);
    const wantsSolar = /(solar system|planets orbiting|sun and planets|太阳系|行星|绕太阳)/.test(text);
    const wantsEarthMoon = /(earth and moon|earth moon|moon orbit|地月|月球|地球和月球)/.test(text);
    const wantsVehicle = /(car|automobile|vehicle|sports car|highway|freeway|road|speeding|racing|汽车|轿车|跑车|车辆|高速|公路|疾驰|飞驰)/.test(text);
    let renderer = '3d';
    let kind = 'particle_nebula';
    let title = 'Particle Nebula';
    let labels = ['depth field', 'orbital drift'];

    if (/(electric|charge|charged|field|电场|电荷)/.test(text)) {
        renderer = '3d';
        kind = 'field_cloud';
        title = 'Spatial Field Cloud';
        labels = ['positive charge', 'negative charge', 'field lines'];
    } else if (/(pendulum|swing|oscillat|摆|单摆)/.test(text)) {
        renderer = '3d';
        kind = 'particle_nebula';
        title = 'Pendulum Particle Trace';
        labels = ['pivot', 'restoring force', 'energy trail'];
    } else if (/(orbit|planet|solar|gravity|black hole|引力|轨道|黑洞)/.test(text)) {
        renderer = '3d';
        kind = /(black hole|黑洞)/.test(text) ? 'black_hole_3d' : 'orbital_3d';
        title = /(black hole|黑洞)/.test(text) ? 'Black Hole Field' : 'Orbital System';
        labels = /(black hole|黑洞)/.test(text)
            ? ['event horizon', 'accretion disk', 'relativistic flow']
            : ['primary body', 'orbital path', 'gravity well'];
    } else if (/(wave|interference|ripple|standing|波|干涉)/.test(text)) {
        renderer = '3d';
        kind = 'field_cloud';
        title = 'Wave Particle Field';
        labels = ['source A', 'source B', 'interference bands'];
    }

    const bright = /(bright|glow|neon|luminous|发光|明亮)/.test(text);
    const slow = /(slow|gentle|calm|慢|柔和)/.test(text);
    const dense = /(dense|many|massive|thousand|多|密集)/.test(text);
    const warm = /(red|orange|fire|sun|warm|红|橙|火)/.test(text);
    const cool = /(blue|cyan|ice|ocean|cold|蓝|青|冷)/.test(text);
    const violet = /(purple|violet|dream|spirit|紫|梦)/.test(text);

    let palette = ['#20d6b5', '#6aa9ff', '#f5f7fb'];
    if (warm) palette = ['#ff6b4a', '#ffb454', '#ffe3a3'];
    if (cool) palette = ['#45d7ff', '#6aa9ff', '#d7f3ff'];
    if (violet) palette = ['#b48cff', '#20d6b5', '#f2e7ff'];
    if (kind === 'black_hole_3d' && !warm && !cool && !violet) {
        palette = ['#ffb454', '#ff6b4a', '#78a6ff', '#f5f7fb'];
    }

    if (wantsImpact) {
        const impactPalette = warm ? palette : ['#2e7cff', '#22d6b8', '#ffb454', '#ff5b45'];
        return validateSceneSpec({
            renderer: '3d',
            kind: 'scene_graph',
            title: 'Comet Impact',
            palette: impactPalette,
            particleCount: dense ? 4200 : 2800,
            speed: slow ? 0.55 : 1,
            intensity: bright ? 0.96 : 0.84,
            labels: ['planet', 'projectile', 'collision event'],
            seed,
            controls: {
                trail: true,
                glow: true,
                autoRotate: false
            },
            sceneGraph: createImpactSceneGraph(seed, impactPalette)
        });
    }

    if (wantsBinary) {
        const binaryPalette = warm ? palette : ['#ffcf6b', '#78a6ff', '#f5f7fb', '#ff6b4a'];
        return validateSceneSpec({
            renderer: '3d',
            kind: 'scene_graph',
            title: 'Binary Star System',
            palette: binaryPalette,
            particleCount: dense ? 5200 : 3600,
            speed: slow ? 0.48 : 0.86,
            intensity: bright ? 0.98 : 0.86,
            labels: ['star A', 'star B', 'barycenter'],
            seed,
            controls: {
                trail: true,
                glow: true,
                autoRotate: false
            },
            sceneGraph: createBinaryStarSceneGraph(seed, binaryPalette)
        });
    }

    if (wantsMagnetic) {
        const magneticPalette = cool ? palette : ['#45d7ff', '#ff5b8a', '#f5f7fb', '#20d6b5'];
        return validateSceneSpec({
            renderer: '3d',
            kind: 'scene_graph',
            title: 'Magnetic Field',
            palette: magneticPalette,
            particleCount: dense ? 5200 : 3800,
            speed: slow ? 0.45 : 0.9,
            intensity: bright ? 0.98 : 0.86,
            labels: ['field lines', 'charged particles', 'curved paths'],
            seed,
            controls: {
                trail: true,
                glow: true,
                autoRotate: false
            },
            sceneGraph: createMagneticFieldSceneGraph(seed, magneticPalette)
        });
    }

    if (wantsEarthMoon) {
        const earthMoonPalette = ['#2e7cff', '#d9d7c8', '#62d7ff', '#f5f7fb'];
        return validateSceneSpec({
            renderer: '3d',
            kind: 'scene_graph',
            title: 'Earth Moon System',
            palette: earthMoonPalette,
            particleCount: dense ? 4200 : 3000,
            speed: slow ? 0.46 : 0.82,
            intensity: bright ? 0.96 : 0.84,
            labels: ['earth', 'moon', 'orbital relation'],
            seed,
            controls: {
                trail: true,
                glow: true,
                autoRotate: false
            },
            sceneGraph: createEarthMoonSceneGraph(seed, earthMoonPalette)
        });
    }

    if (wantsSolar) {
        const solarPalette = ['#ffcf6b', '#2e7cff', '#ff8a4a', '#d9d7c8'];
        return validateSceneSpec({
            renderer: '3d',
            kind: 'scene_graph',
            title: 'Particle Solar System',
            palette: solarPalette,
            particleCount: dense ? 5200 : 3800,
            speed: slow ? 0.42 : 0.76,
            intensity: bright ? 0.98 : 0.86,
            labels: ['sun', 'planetary orbits', 'moon path'],
            seed,
            controls: {
                trail: true,
                glow: true,
                autoRotate: false
            },
            sceneGraph: createSolarSystemSceneGraph(seed, solarPalette)
        });
    }

    if (wantsVehicle) {
        const carPalette = cool ? palette : ['#4fd8ff', '#f5f7fb', '#ffcf6b', '#ff4f6d'];
        return validateSceneSpec({
            renderer: '3d',
            kind: 'scene_graph',
            title: 'Speeding Particle Car',
            palette: carPalette,
            particleCount: dense ? 5800 : 4600,
            speed: slow ? 0.42 : 1.08,
            intensity: bright ? 0.98 : 0.9,
            labels: ['fixed car silhouette', 'highway motion', 'speed state colors'],
            seed,
            controls: {
                trail: true,
                glow: true,
                autoRotate: false
            },
            sceneGraph: createSpeedingCarSceneGraph(seed, carPalette, dense)
        });
    }

    if (wantsAttraction) {
        const attractionPalette = violet ? palette : ['#b48cff', '#20d6b5', '#f2e7ff', '#6aa9ff'];
        return validateSceneSpec({
            renderer: '3d',
            kind: 'scene_graph',
            title: 'Mutual Attraction',
            palette: attractionPalette,
            particleCount: dense ? 5200 : 3600,
            speed: slow ? 0.5 : 0.9,
            intensity: bright ? 0.96 : 0.84,
            labels: ['body A', 'body B', 'attraction force'],
            seed,
            controls: {
                trail: true,
                glow: true,
                autoRotate: false
            },
            sceneGraph: createAttractionSceneGraph(seed, attractionPalette)
        });
    }

    if (wantsVortex) {
        const vortexPalette = violet ? palette : ['#b48cff', '#45d7ff', '#20d6b5', '#f2e7ff'];
        return validateSceneSpec({
            renderer: '3d',
            kind: 'scene_graph',
            title: 'Vortex Field',
            palette: vortexPalette,
            particleCount: dense ? 5600 : 4200,
            speed: slow ? 0.48 : 0.94,
            intensity: bright ? 0.98 : 0.86,
            labels: ['vortex core', 'spiral flow'],
            seed,
            controls: {
                trail: true,
                glow: true,
                autoRotate: false
            },
            sceneGraph: createVortexSceneGraph(seed, vortexPalette)
        });
    }

    return validateSceneSpec({
        renderer,
        kind,
        title,
        palette,
        particleCount: dense ? 4200 : 3200,
        speed: slow ? 0.42 : 0.86,
        intensity: bright ? 0.94 : 0.76,
        labels,
        seed,
        controls: {
            trail: !/(clean|no trail|无轨迹)/.test(text),
            glow: bright || /(neon|glow|发光|black hole|黑洞)/.test(text),
            autoRotate: true
        }
    });
}

function validateSceneSpec(spec) {
    const validRenderers = new Set(['3d']);
    const validKinds = new Set([
        'particle_swirl',
        'electric_field',
        'pendulum',
        'orbital_system',
        'wave_interference',
        'particle_nebula',
        'orbital_3d',
        'black_hole_3d',
        'scene_graph',
        'field_cloud'
    ]);

    return {
        renderer: validRenderers.has(spec.renderer) ? spec.renderer : DEFAULT_SCENE.renderer,
        kind: validKinds.has(spec.kind) ? spec.kind : DEFAULT_SCENE.kind,
        title: String(spec.title || DEFAULT_SCENE.title).slice(0, 60),
        palette: Array.isArray(spec.palette) && spec.palette.length >= 2 ? spec.palette.slice(0, 4) : DEFAULT_SCENE.palette,
        particleCount: clamp(Number(spec.particleCount) || DEFAULT_SCENE.particleCount, 400, 6000),
        speed: clamp(Number(spec.speed) || DEFAULT_SCENE.speed, 0.08, 2.4),
        intensity: clamp(Number(spec.intensity) || DEFAULT_SCENE.intensity, 0.1, 1),
        labels: Array.isArray(spec.labels) ? spec.labels.slice(0, 5) : [],
        seed: Number(spec.seed) || 1,
        sceneGraph: spec.kind === 'scene_graph' ? validateSceneGraph(spec.sceneGraph) : null,
        controls: {
            trail: spec.controls?.trail !== false,
            glow: spec.controls?.glow === true,
            autoRotate: spec.controls?.autoRotate !== false
        }
    };
}

function createImpactSceneGraph(seed, palette) {
    return {
        version: 1,
        duration: 10,
        world: {
            environment: 'space',
            timeScale: 1,
            physicsMode: 'plausible'
        },
        objects: [
            {
                id: 'earth',
                type: 'sphere',
                role: 'planet',
                position: [0, 0, 0],
                radius: 12,
                material: {
                    preset: 'earthlike',
                    color: palette[0],
                    atmosphere: true
                }
            },
            {
                id: 'comet',
                type: 'projectile',
                role: 'comet',
                radius: 1.25,
                start: [52, 25, -48],
                end: [8.8, 5.6, -6.4],
                impactAt: 4.2,
                material: {
                    preset: 'ice_glow',
                    color: '#dff7ff'
                },
                trail: {
                    enabled: true,
                    length: 42,
                    color: palette[2] || '#ffb454'
                }
            }
        ],
        events: [
            {
                id: 'impact',
                type: 'collision',
                source: 'comet',
                target: 'earth',
                at: 4.2,
                position: [8.8, 5.6, -6.4],
                effects: ['flash', 'shockwave', 'debris']
            }
        ],
        effects: [
            {
                id: 'flash',
                type: 'flash',
                event: 'impact',
                color: palette[2] || '#ffb454',
                duration: 0.85
            },
            {
                id: 'shockwave',
                type: 'shockwave',
                event: 'impact',
                color: palette[2] || '#ffb454',
                duration: 3.4,
                maxRadius: 24
            },
            {
                id: 'debris',
                type: 'debris',
                event: 'impact',
                color: palette[3] || '#ff5b45',
                count: 480
            }
        ],
        camera: {
            mode: 'cinematic_orbit',
            focus: 'earth',
            distance: 58,
            shakeAt: 4.2
        },
        seed
    };
}

function createAttractionSceneGraph(seed, palette) {
    return {
        version: 1,
        duration: 12,
        world: {
            environment: 'space',
            timeScale: 1,
            physicsMode: 'plausible'
        },
        objects: [
            {
                id: 'orb_a',
                type: 'particle_cloud',
                role: 'attractor',
                position: [-20, 3, 0],
                radius: 6,
                particleCount: 1400,
                material: { color: palette[0] || '#b48cff' }
            },
            {
                id: 'orb_b',
                type: 'particle_cloud',
                role: 'attractor',
                position: [20, -3, 0],
                radius: 6,
                particleCount: 1400,
                material: { color: palette[1] || '#20d6b5' }
            }
        ],
        motions: [
            {
                type: 'orbit',
                targets: ['orb_a', 'orb_b'],
                radius: 20,
                speed: 0.55
            }
        ],
        forces: [
            {
                type: 'attraction',
                targets: ['orb_a', 'orb_b'],
                strength: 0.72,
                spiral: 0.58
            }
        ],
        effects: [
            {
                id: 'bridge',
                type: 'particle_bridge',
                targets: ['orb_a', 'orb_b'],
                color: palette[2] || '#f2e7ff',
                count: 900
            }
        ],
        events: [],
        camera: {
            mode: 'free_orbit',
            distance: 64
        },
        seed
    };
}

function createVortexSceneGraph(seed, palette) {
    return {
        version: 1,
        duration: 12,
        world: {
            environment: 'space',
            timeScale: 1,
            physicsMode: 'plausible'
        },
        objects: [
            {
                id: 'vortex_cloud',
                type: 'particle_cloud',
                role: 'flow',
                position: [0, 0, 0],
                radius: 28,
                particleCount: 4200,
                material: { color: palette[0] || '#b48cff' }
            }
        ],
        motions: [
            {
                type: 'spiral',
                target: 'vortex_cloud',
                speed: 0.95,
                inward: 0.32
            }
        ],
        forces: [
            {
                type: 'vortex',
                target: 'vortex_cloud',
                strength: 1,
                center: [0, 0, 0]
            }
        ],
        effects: [
            {
                id: 'core',
                type: 'glow_core',
                color: palette[1] || '#45d7ff',
                radius: 3.5
            }
        ],
        events: [],
        camera: {
            mode: 'free_orbit',
            distance: 72
        },
        seed
    };
}

function createBinaryStarSceneGraph(seed, palette) {
    return {
        version: 1,
        duration: 14,
        world: { environment: 'space', timeScale: 1, physicsMode: 'plausible' },
        objects: [
            {
                id: 'star_a',
                type: 'particle_cloud',
                role: 'star',
                position: [-14, 0, 0],
                radius: 5.2,
                particleCount: 1200,
                material: { color: palette[0] || '#ffcf6b' }
            },
            {
                id: 'star_b',
                type: 'particle_cloud',
                role: 'star',
                position: [14, 0, 0],
                radius: 4.2,
                particleCount: 1000,
                material: { color: palette[1] || '#78a6ff' }
            }
        ],
        motions: [
            { type: 'orbit', targets: ['star_a', 'star_b'], radius: 15, speed: 0.58 }
        ],
        forces: [
            { type: 'attraction', targets: ['star_a', 'star_b'], strength: 0.35, spiral: 0.28 }
        ],
        effects: [
            { id: 'barycenter', type: 'glow_core', color: palette[2] || '#f5f7fb', radius: 1.6 },
            { id: 'stellar_bridge', type: 'particle_bridge', targets: ['star_a', 'star_b'], color: palette[3] || '#ff6b4a', count: 520 }
        ],
        events: [],
        camera: { mode: 'free_orbit', distance: 62 },
        seed
    };
}

function createMagneticFieldSceneGraph(seed, palette) {
    return {
        version: 1,
        duration: 12,
        world: { environment: 'field', timeScale: 1, physicsMode: 'plausible' },
        objects: [
            {
                id: 'field_lines',
                type: 'field_lines',
                role: 'magnetic_field',
                position: [0, 0, 0],
                lineCount: 18,
                pointsPerLine: 90,
                radius: 26,
                material: { color: palette[0] || '#45d7ff' }
            },
            {
                id: 'charge_flow',
                type: 'particle_cloud',
                role: 'charged_flow',
                position: [0, 0, 0],
                radius: 20,
                particleCount: 1600,
                material: { color: palette[1] || '#ff5b8a' }
            }
        ],
        motions: [
            { type: 'helix_flow', target: 'charge_flow', speed: 0.9, radius: 18 }
        ],
        forces: [
            { type: 'magnetic', target: 'charge_flow', strength: 1.1, axis: [0, 1, 0] }
        ],
        effects: [
            { id: 'axis_core', type: 'glow_core', color: palette[3] || '#20d6b5', radius: 1.8 }
        ],
        events: [],
        camera: { mode: 'free_orbit', distance: 70 },
        seed
    };
}

function createSolarSystemSceneGraph(seed, palette) {
    return {
        version: 1,
        duration: 18,
        world: { environment: 'space', timeScale: 1, physicsMode: 'plausible' },
        objects: [
            { id: 'sun', type: 'particle_cloud', role: 'sun', position: [0, 0, 0], radius: 5.6, particleCount: 1400, material: { color: palette[0] || '#ffcf6b' } },
            { id: 'planet_inner', type: 'particle_cloud', role: 'planet', position: [14, 0, 0], radius: 1.5, particleCount: 320, material: { color: palette[2] || '#ff8a4a' } },
            { id: 'earth', type: 'sphere', role: 'planet', position: [25, 0, 0], radius: 2.2, material: { preset: 'earthlike', color: palette[1] || '#2e7cff', atmosphere: true } },
            { id: 'planet_outer', type: 'particle_cloud', role: 'planet', position: [38, 0, 0], radius: 2.8, particleCount: 520, material: { color: palette[3] || '#d9d7c8' } },
            { id: 'moon', type: 'particle_cloud', role: 'moon', position: [29, 0, 0], radius: 0.7, particleCount: 180, material: { color: '#d9d7c8' } }
        ],
        motions: [
            { type: 'orbit_body', target: 'planet_inner', center: 'sun', radius: 14, speed: 1.1, tilt: 0.04 },
            { type: 'orbit_body', target: 'earth', center: 'sun', radius: 25, speed: 0.72, tilt: 0.08 },
            { type: 'orbit_body', target: 'planet_outer', center: 'sun', radius: 38, speed: 0.42, tilt: 0.12 },
            { type: 'orbit_body', target: 'moon', center: 'earth', radius: 4.4, speed: 2.4, tilt: 0.25 }
        ],
        forces: [
            { type: 'gravity_well', target: 'sun', strength: 0.5 }
        ],
        effects: [
            { id: 'solar_core', type: 'glow_core', color: palette[0] || '#ffcf6b', radius: 3.4 },
            { id: 'orbit_rings', type: 'orbit_rings', targets: ['planet_inner', 'earth', 'planet_outer'], color: '#f5f7fb' }
        ],
        events: [],
        camera: { mode: 'free_orbit', distance: 82 },
        seed
    };
}

function createEarthMoonSceneGraph(seed, palette) {
    return {
        version: 1,
        duration: 14,
        world: { environment: 'space', timeScale: 1, physicsMode: 'plausible' },
        objects: [
            {
                id: 'earth',
                type: 'sphere',
                role: 'planet',
                position: [0, 0, 0],
                radius: 8,
                material: { preset: 'earthlike', color: palette[0] || '#2e7cff', atmosphere: true }
            },
            {
                id: 'moon',
                type: 'particle_cloud',
                role: 'moon',
                position: [18, 0, 0],
                radius: 1.8,
                particleCount: 520,
                material: { color: palette[1] || '#d9d7c8' }
            }
        ],
        motions: [
            { type: 'orbit_body', target: 'moon', center: 'earth', radius: 19, speed: 0.92, tilt: 0.22 },
            { type: 'wobble', target: 'earth', radius: 1.2, speed: 0.92 }
        ],
        forces: [
            { type: 'gravity_well', target: 'earth', strength: 0.32 }
        ],
        effects: [
            { id: 'moon_orbit', type: 'orbit_rings', targets: ['moon'], color: palette[2] || '#62d7ff' }
        ],
        events: [],
        camera: { mode: 'free_orbit', distance: 52 },
        seed
    };
}

function createSpeedingCarSceneGraph(seed, palette, dense = false) {
    return {
        version: 1,
        duration: 12,
        world: { environment: 'highway', timeScale: 1, physicsMode: 'plausible' },
        objects: [
            {
                id: 'car_body',
                type: 'particle_shape',
                preset: 'car',
                role: 'vehicle',
                position: [0, -1.5, 0],
                particleCount: dense ? 4300 : 3200,
                material: {
                    body: palette[0] || '#4fd8ff',
                    glass: '#d9f6ff',
                    frontLight: palette[2] || '#ffcf6b',
                    tailLight: palette[3] || '#ff4f6d',
                    wheel: '#94a3b8'
                }
            },
            {
                id: 'highway',
                type: 'particle_shape',
                preset: 'highway',
                role: 'road',
                position: [0, -7, 0],
                particleCount: dense ? 1700 : 1200,
                material: {
                    asphalt: '#384150',
                    lane: '#f5f7fb',
                    edge: '#45d7ff'
                }
            }
        ],
        motions: [
            { type: 'speed_pulse', target: 'car_body', amplitude: 0.16, speed: 5.2 },
            { type: 'road_scroll', target: 'highway', speed: 1.15, length: 86 }
        ],
        forces: [],
        effects: [
            {
                id: 'speed_wake',
                type: 'speed_trail',
                target: 'car_body',
                color: palette[1] || '#f5f7fb',
                count: dense ? 900 : 620,
                length: 38
            }
        ],
        events: [],
        camera: { mode: 'free_orbit', distance: 44 },
        seed
    };
}

function validateSceneGraph(graph) {
    if (!graph || typeof graph !== 'object') {
        return createImpactSceneGraph(1, ['#2e7cff', '#22d6b8', '#ffb454', '#ff5b45']);
    }

    return {
        version: 1,
        duration: clamp(Number(graph.duration) || 10, 4, 30),
        world: graph.world || {},
        objects: Array.isArray(graph.objects) ? graph.objects.slice(0, 24) : [],
        motions: Array.isArray(graph.motions) ? graph.motions.slice(0, 24) : [],
        forces: Array.isArray(graph.forces) ? graph.forces.slice(0, 24) : [],
        events: Array.isArray(graph.events) ? graph.events.slice(0, 16) : [],
        effects: Array.isArray(graph.effects) ? graph.effects.slice(0, 24) : [],
        camera: graph.camera || {},
        seed: Number(graph.seed) || 1
    };
}

class Canvas2DRenderer {
    constructor(targetCanvas) {
        this.canvas = targetCanvas;
        this.ctx = targetCanvas.getContext('2d');
        this.scene = null;
        this.particles = [];
        this.size = { width: 0, height: 0, dpr: 1 };
    }

    setScene(scene) {
        this.scene = scene;
        this.buildParticles(scene);
        this.resize();
    }

    resize() {
        const rect = this.canvas.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        this.size = { width: rect.width, height: rect.height, dpr };
        this.canvas.width = Math.floor(rect.width * dpr);
        this.canvas.height = Math.floor(rect.height * dpr);
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    buildParticles(scene) {
        const random = seededRandom(scene.seed);
        this.particles = Array.from({ length: scene.particleCount }, (_, i) => ({
            index: i,
            seed: random(),
            angle: random() * Math.PI * 2,
            radius: 20 + random() * 280,
            phase: random() * Math.PI * 2,
            color: scene.palette[i % scene.palette.length],
            charge: i % 2 === 0 ? 1 : -1
        }));
    }

    render(time) {
        if (!this.scene) return;

        this.clearFrame(this.scene);
        if (this.scene.kind === 'electric_field') this.drawElectricField(this.scene, time);
        else if (this.scene.kind === 'pendulum') this.drawPendulum(this.scene, time);
        else if (this.scene.kind === 'orbital_system') this.drawOrbitalSystem(this.scene, time);
        else if (this.scene.kind === 'wave_interference') this.drawWaveInterference(this.scene, time);
        else this.drawParticleSwirl(this.scene, time);
    }

    clearFrame(scene) {
        const { width, height } = this.size;
        if (scene.controls.trail) {
            this.ctx.fillStyle = 'rgba(7, 9, 12, 0.18)';
            this.ctx.fillRect(0, 0, width, height);
            return;
        }

        this.ctx.clearRect(0, 0, width, height);
        this.ctx.fillStyle = '#07090c';
        this.ctx.fillRect(0, 0, width, height);
    }

    drawParticleSwirl(scene, time) {
        const { width, height } = this.size;
        const cx = width / 2;
        const cy = height / 2;
        const scale = Math.min(width, height) / 680;

        if (scene.controls.glow) {
            const gradient = this.ctx.createRadialGradient(cx, cy, 0, cx, cy, 300 * scale);
            gradient.addColorStop(0, `${scene.palette[0]}44`);
            gradient.addColorStop(1, 'transparent');
            this.ctx.fillStyle = gradient;
            this.ctx.fillRect(0, 0, width, height);
        }

        for (const p of this.particles) {
            const swirl = p.angle + time * scene.speed * (0.25 + p.seed);
            const breathing = Math.sin(time * 0.9 + p.phase) * 24 * scene.intensity;
            const r = (p.radius + breathing) * scale;
            const x = cx + Math.cos(swirl) * r + Math.sin(time + p.phase) * 14 * scale;
            const y = cy + Math.sin(swirl * 0.82) * r * 0.62;
            const size = 1.1 + p.seed * 2.2 * scene.intensity;
            this.drawDot(x, y, size, p.color);
        }

        this.drawLabel(cx, cy, scene.labels[0] || 'center');
    }

    drawElectricField(scene, time) {
        const { width, height } = this.size;
        const cx = width / 2;
        const cy = height / 2;
        const distance = Math.min(width, height) * 0.22;
        const a = { x: cx - distance, y: cy, charge: 1 };
        const b = { x: cx + distance, y: cy, charge: -1 };

        this.ctx.lineWidth = 1;
        for (let i = 0; i < 34; i += 1) {
            const angle = (i / 34) * Math.PI * 2 + time * 0.08 * scene.speed;
            this.drawFieldLine(a, b, angle, scene.palette[i % scene.palette.length]);
        }

        this.drawCharge(a.x, a.y, '+', scene.palette[0]);
        this.drawCharge(b.x, b.y, '-', scene.palette[1]);
        this.drawLabel(a.x, a.y + 44, scene.labels[0] || 'positive');
        this.drawLabel(b.x, b.y + 44, scene.labels[1] || 'negative');
    }

    drawFieldLine(a, b, angle, color) {
        this.ctx.beginPath();
        this.ctx.strokeStyle = `${color}88`;
        const startX = a.x + Math.cos(angle) * 22;
        const startY = a.y + Math.sin(angle) * 22;
        this.ctx.moveTo(startX, startY);
        for (let step = 0; step < 88; step += 1) {
            const t = step / 87;
            const bow = Math.sin(t * Math.PI) * 95 * Math.sin(angle);
            const x = startX * (1 - t) + b.x * t;
            const y = startY * (1 - t) + b.y * t + bow;
            this.ctx.lineTo(x, y);
        }
        this.ctx.stroke();
    }

    drawPendulum(scene, time) {
        const { width, height } = this.size;
        const cx = width / 2;
        const pivotY = height * 0.2;
        const length = Math.min(width, height) * 0.36;
        const theta = Math.sin(time * scene.speed * 1.7) * 0.78 * scene.intensity;
        const bobX = cx + Math.sin(theta) * length;
        const bobY = pivotY + Math.cos(theta) * length;

        this.ctx.strokeStyle = `${scene.palette[1]}55`;
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.arc(cx, pivotY, length, Math.PI * 0.5 - 0.8, Math.PI * 0.5 + 0.8);
        this.ctx.stroke();

        this.ctx.strokeStyle = '#dce7f2';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(cx, pivotY);
        this.ctx.lineTo(bobX, bobY);
        this.ctx.stroke();

        this.drawDot(cx, pivotY, 5, scene.palette[0]);
        this.drawDot(bobX, bobY, 18, scene.palette[1]);
        this.drawLabel(cx, pivotY - 18, scene.labels[0] || 'pivot');
        this.drawLabel(bobX, bobY + 32, scene.labels[1] || 'motion');
    }

    drawOrbitalSystem(scene, time) {
        const { width, height } = this.size;
        const cx = width / 2;
        const cy = height / 2;
        const orbitR = Math.min(width, height) * 0.24;

        this.ctx.strokeStyle = `${scene.palette[1]}44`;
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.ellipse(cx, cy, orbitR * 1.35, orbitR * 0.62, -0.25, 0, Math.PI * 2);
        this.ctx.stroke();

        const angle = time * scene.speed * 0.75;
        const x = cx + Math.cos(angle) * orbitR * 1.35;
        const y = cy + Math.sin(angle) * orbitR * 0.62;

        this.drawDot(cx, cy, 28, scene.palette[0]);
        this.drawDot(x, y, 12, scene.palette[1]);
        this.drawLabel(cx, cy + 46, scene.labels[0] || 'gravity');
        this.drawLabel(x, y - 24, scene.labels[1] || 'orbit');
    }

    drawWaveInterference(scene, time) {
        const { width, height } = this.size;
        const sourceA = { x: width * 0.36, y: height * 0.52 };
        const sourceB = { x: width * 0.64, y: height * 0.52 };
        const step = 16;

        for (let y = 0; y < height; y += step) {
            for (let x = 0; x < width; x += step) {
                const da = Math.hypot(x - sourceA.x, y - sourceA.y);
                const db = Math.hypot(x - sourceB.x, y - sourceB.y);
                const wave = Math.sin(da * 0.045 - time * 3 * scene.speed) + Math.sin(db * 0.045 - time * 3 * scene.speed);
                const alpha = Math.abs(wave) * 0.24 * scene.intensity;
                this.ctx.fillStyle = wave > 0 ? hexWithAlpha(scene.palette[0], alpha) : hexWithAlpha(scene.palette[1], alpha);
                this.ctx.fillRect(x, y, step + 1, step + 1);
            }
        }

        this.drawDot(sourceA.x, sourceA.y, 10, scene.palette[0]);
        this.drawDot(sourceB.x, sourceB.y, 10, scene.palette[1]);
        this.drawLabel(sourceA.x, sourceA.y + 28, scene.labels[0] || 'source A');
        this.drawLabel(sourceB.x, sourceB.y + 28, scene.labels[1] || 'source B');
    }

    drawDot(x, y, radius, color) {
        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.arc(x, y, radius, 0, Math.PI * 2);
        this.ctx.fill();
    }

    drawCharge(x, y, label, color) {
        this.drawDot(x, y, 24, color);
        this.ctx.fillStyle = '#071014';
        this.ctx.font = '700 24px system-ui';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(label, x, y - 1);
    }

    drawLabel(x, y, label) {
        this.ctx.font = '12px SFMono-Regular, Consolas, monospace';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        const textWidth = this.ctx.measureText(label).width + 18;
        this.ctx.fillStyle = 'rgba(5, 8, 12, 0.68)';
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
        this.roundRect(x - textWidth / 2, y - 13, textWidth, 26, 6);
        this.ctx.fill();
        this.ctx.stroke();
        this.ctx.fillStyle = '#dce7f2';
        this.ctx.fillText(label, x, y);
    }

    roundRect(x, y, width, height, radius) {
        this.ctx.beginPath();
        this.ctx.moveTo(x + radius, y);
        this.ctx.arcTo(x + width, y, x + width, y + height, radius);
        this.ctx.arcTo(x + width, y + height, x, y + height, radius);
        this.ctx.arcTo(x, y + height, x, y, radius);
        this.ctx.arcTo(x, y, x + width, y, radius);
        this.ctx.closePath();
    }
}

class ThreeRenderer {
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
        this.pointer = {
            x: 0,
            y: 0,
            targetX: 0,
            targetY: 0,
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

        this.loading = import('https://unpkg.com/three@0.160.0/build/three.module.js').then((module) => {
            this.THREE = module;
            this.scene = new this.THREE.Scene();
            this.scene.fog = new this.THREE.FogExp2(0x06080d, 0.018);

            this.camera = new this.THREE.PerspectiveCamera(62, 1, 0.1, 1200);
            this.camera.position.set(0, 22, 88);

            this.renderer = new this.THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
            this.renderer.setClearColor(0x07090c, 1);
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

        if (sceneSpec.kind === 'scene_graph') {
            this.buildSceneGraphScene(sceneSpec);
        } else if (sceneSpec.kind === 'black_hole_3d') {
            this.buildBlackHoleScene(sceneSpec);
        } else if (sceneSpec.kind === 'orbital_3d') {
            this.buildOrbitalScene(sceneSpec);
        } else {
            this.buildParticleScene(sceneSpec);
        }
    }

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

        const core = this.createParticleBall({
            radius: 2.1 + sceneSpec.intensity * 2.4,
            count: 420,
            color: sceneSpec.palette[0],
            size: 0.1,
            opacity: 0.72,
            seed: sceneSpec.seed + 42
        });
        this.world.add(core);
    }

    buildOrbitalScene(sceneSpec) {
        const THREE = this.THREE;
        this.setCameraDistance(78);
        const primary = this.createParticleBall({
            radius: 5.4,
            count: 900,
            color: sceneSpec.palette[0],
            size: 0.18,
            opacity: 0.92,
            seed: sceneSpec.seed + 5
        });
        this.world.add(primary);

        for (let i = 0; i < 3; i += 1) {
            const ring = this.createParticleRing({
                radius: 18 + i * 10,
                count: 260,
                color: sceneSpec.palette[(i + 1) % sceneSpec.palette.length],
                size: 0.11,
                opacity: 0.42,
                seed: sceneSpec.seed + 100 + i
            });
            ring.rotation.x = Math.PI / 2 + i * 0.28;
            ring.rotation.y = i * 0.22;
            ring.userData.spin = 0.04 + i * 0.018;
            this.world.add(ring);
        }

        for (let i = 0; i < 3; i += 1) {
            const body = this.createParticleBall({
                radius: 1.5 + i * 0.45,
                count: 220,
                color: sceneSpec.palette[(i + 1) % sceneSpec.palette.length],
                size: 0.13,
                opacity: 0.9,
                seed: sceneSpec.seed + 20 + i
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
        const diskSpec = {
            ...sceneSpec,
            particleCount: Math.min(sceneSpec.particleCount + 1200, 5200)
        };
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
                angle,
                radius,
                phase: random() * Math.PI * 2,
                diskHeight,
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

        const horizon = this.createParticleBall({
            radius: 5.4,
            count: 700,
            color: '#020204',
            size: 0.22,
            opacity: 0.96,
            seed: diskSpec.seed + 60
        });
        this.world.add(horizon);

        const photonRing = this.createParticleRing({
            radius: 6.2,
            count: 360,
            color: diskSpec.palette[0],
            size: 0.18,
            opacity: 0.78,
            seed: diskSpec.seed + 150
        });
        photonRing.rotation.x = Math.PI / 2;
        photonRing.userData.spin = 0.018;
        this.world.add(photonRing);

        const outerDisk = this.createParticleRing({
            radius: 26,
            count: 520,
            color: diskSpec.palette[1],
            size: 0.12,
            opacity: 0.28,
            seed: diskSpec.seed + 180
        });
        outerDisk.rotation.x = Math.PI / 2 - 0.34;
        outerDisk.scale.z = 0.68;
        outerDisk.userData.spin = 0.004;
        this.world.add(outerDisk);

        const jetTop = this.createParticleJet({
            direction: 1,
            color: diskSpec.palette[2] || '#78a6ff',
            seed: diskSpec.seed + 90
        });
        const jetBottom = this.createParticleJet({
            direction: -1,
            color: diskSpec.palette[2] || '#78a6ff',
            seed: diskSpec.seed + 120
        });
        this.world.add(jetTop, jetBottom);

        this.applyCameraOrbit();
    }

    buildSceneGraphScene(sceneSpec) {
        const THREE = this.THREE;
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

        const random = seededRandom(graph.seed || sceneSpec.seed);

        (graph.objects || []).forEach((objectSpec) => {
            if (objectSpec.type === 'sphere') {
                const mesh = this.createGraphSphere(objectSpec);
                runtime.objects.set(objectSpec.id, { spec: objectSpec, mesh, basePosition: mesh.position.clone() });
                this.world.add(mesh);

                if (objectSpec.material?.atmosphere) {
                    const atmosphere = this.createParticleBall({
                        radius: (objectSpec.radius || 10) * 1.07,
                        count: 900,
                        color: '#62d7ff',
                        size: 0.08,
                        opacity: 0.2,
                        seed: sceneSpec.seed + 300
                    });
                    atmosphere.position.copy(mesh.position);
                    this.world.add(atmosphere);
                    runtime.objects.set(`${objectSpec.id}:atmosphere`, { spec: { type: 'atmosphere', role: 'particle_shell' }, mesh: atmosphere });
                }
            }

            if (objectSpec.type === 'particle_cloud') {
                const cloud = this.createGraphParticleCloud(objectSpec, sceneSpec.seed);
                this.world.add(cloud.points);
                runtime.objects.set(objectSpec.id, {
                    spec: objectSpec,
                    mesh: cloud.points,
                    basePosition: cloud.points.position.clone(),
                    particles: cloud.particles,
                    kind: 'particle_cloud'
                });
            }

            if (objectSpec.type === 'field_lines') {
                const field = this.createMagneticFieldLines(objectSpec, sceneSpec.seed);
                this.world.add(field.points);
                runtime.objects.set(objectSpec.id, {
                    spec: objectSpec,
                    mesh: field.points,
                    particles: field.particles,
                    kind: 'field_lines'
                });
            }

            if (objectSpec.type === 'particle_shape') {
                const shape = this.createGraphParticleShape(objectSpec, sceneSpec.seed);
                this.world.add(shape.points);
                runtime.objects.set(objectSpec.id, {
                    spec: objectSpec,
                    mesh: shape.points,
                    basePosition: shape.points.position.clone(),
                    particles: shape.particles,
                    kind: 'particle_shape'
                });
            }

            if (objectSpec.type === 'projectile') {
                const color = objectSpec.material?.color || sceneSpec.palette[2] || '#ffb454';
                const mesh = this.createParticleBall({
                    radius: objectSpec.radius || 1,
                    count: 320,
                    color,
                    size: 0.13,
                    opacity: 0.95,
                    seed: sceneSpec.seed + 420
                });
                this.world.add(mesh);

                const projectile = {
                    spec: objectSpec,
                    mesh,
                    start: new THREE.Vector3(...objectSpec.start),
                    end: new THREE.Vector3(...objectSpec.end),
                    impactAt: objectSpec.impactAt || 4,
                    trail: null
                };

                if (objectSpec.trail?.enabled) {
                    const trailGeometry = new THREE.BufferGeometry();
                    const trailCount = objectSpec.trail.length || 36;
                    trailGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(trailCount * 3), 3));
                    const trail = new THREE.Points(
                        trailGeometry,
                        new THREE.PointsMaterial({
                            color: objectSpec.trail.color || color,
                            size: 0.34,
                            transparent: true,
                            opacity: 0.72,
                            blending: THREE.AdditiveBlending,
                            depthWrite: false
                        })
                    );
                    this.world.add(trail);
                    projectile.trail = { line: trail, count: trailCount };
                    runtime.trails.push(projectile.trail);
                }

                runtime.objects.set(objectSpec.id, projectile);
            }
        });

        (graph.effects || []).forEach((effectSpec) => {
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
                        size: 0.12,
                        vertexColors: true,
                        transparent: true,
                        opacity: 0.48,
                        depthWrite: false,
                        blending: THREE.AdditiveBlending
                    })
                );
                points.userData.isInteractiveParticleObject = true;
                this.world.add(points);
                runtime.effects[effectSpec.id] = { spec: effectSpec, points, randomSeed: sceneSpec.seed + 760 };
                return;
            }

            if (effectSpec.type === 'glow_core') {
                const core = this.createParticleBall({
                    radius: effectSpec.radius || 3,
                    count: 600,
                    color: effectSpec.color || '#45d7ff',
                    size: 0.14,
                    opacity: 0.66,
                    seed: sceneSpec.seed + 880
                });
                this.world.add(core);
                runtime.effects[effectSpec.id] = { spec: effectSpec, mesh: core };
                return;
            }

            if (effectSpec.type === 'orbit_rings') {
                const group = new THREE.Group();
                (effectSpec.targets || []).forEach((targetId, index) => {
                    const motion = runtime.motions.find((candidate) => candidate.target === targetId && candidate.type === 'orbit_body');
                    const target = runtime.objects.get(targetId);
                    const radius = motion?.radius || Math.hypot(target?.mesh.position.x || 20, target?.mesh.position.z || 0);
                    const ring = this.createParticleRing({
                        radius,
                        count: 220,
                        color: effectSpec.color || '#f5f7fb',
                        size: 0.07,
                        opacity: 0.2,
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
                        size: 0.11,
                        vertexColors: true,
                        transparent: true,
                        opacity: 0.44,
                        depthWrite: false,
                        blending: THREE.AdditiveBlending
                    })
                );
                points.userData.isInteractiveParticleObject = true;
                this.world.add(points);
                runtime.effects[effectSpec.id] = { spec: effectSpec, points, randomSeed: sceneSpec.seed + 1060 };
                return;
            }

            const event = runtime.events.find((candidate) => candidate.id === effectSpec.event);
            const eventPosition = event?.position || [0, 0, 0];
            const position = new THREE.Vector3(...eventPosition);
            const normal = position.clone().normalize();

            if (effectSpec.type === 'flash') {
                const flash = this.createParticleBall({
                    radius: 1,
                    count: 700,
                    color: effectSpec.color || '#ffb454',
                    size: 0.16,
                    opacity: 0,
                    seed: sceneSpec.seed + 520
                });
                flash.position.copy(position);
                flash.visible = false;
                this.world.add(flash);
                runtime.effects[effectSpec.id] = { spec: effectSpec, mesh: flash, event };
            }

            if (effectSpec.type === 'shockwave') {
                const shockwave = this.createParticleRing({
                    radius: 1,
                    count: 260,
                    color: effectSpec.color || '#ffb454',
                    size: 0.18,
                    opacity: 0,
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
                        .cross(normal)
                        .normalize()
                        .multiplyScalar(2 + random() * 8);
                    const velocity = normal.clone().multiplyScalar(3 + random() * 12).add(tangent);
                    particles.push({ velocity, drag: 0.72 + random() * 0.2 });
                }

                geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
                geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
                const points = new THREE.Points(
                    geometry,
                    new THREE.PointsMaterial({
                        size: 0.26,
                        vertexColors: true,
                        transparent: true,
                        opacity: 0,
                        depthWrite: false,
                        blending: THREE.AdditiveBlending
                    })
                );
                this.world.add(points);
                runtime.effects[effectSpec.id] = { spec: effectSpec, points, event, origin: position, particles };
                runtime.debris = runtime.effects[effectSpec.id];
            }
        });

        this.graphRuntime = runtime;
        this.setCameraDistance(runtime.camera.distance || 58);
        this.applyCameraOrbit();
    }

    createGraphSphere(objectSpec) {
        const THREE = this.THREE;
        const radius = objectSpec.radius || 8;
        const count = objectSpec.material?.preset === 'earthlike' ? 2400 : 1000;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);
        const random = seededRandom(hashText(objectSpec.id || 'sphere'));
        const ocean = new THREE.Color(objectSpec.material?.color || '#2e7cff');
        const land = new THREE.Color('#1f9d74');
        const ice = new THREE.Color('#dff7ff');

        for (let i = 0; i < count; i += 1) {
            const u = random();
            const v = random();
            const theta = 2 * Math.PI * u;
            const phi = Math.acos(2 * v - 1);
            const x = Math.sin(phi) * Math.cos(theta);
            const y = Math.cos(phi);
            const z = Math.sin(phi) * Math.sin(theta);
            const surfaceJitter = 1 + (random() - 0.5) * 0.018;

            positions[i * 3] = x * radius * surfaceJitter;
            positions[i * 3 + 1] = y * radius * surfaceJitter;
            positions[i * 3 + 2] = z * radius * surfaceJitter;

            let color = new THREE.Color(objectSpec.material?.color || '#8fc7ff');
            if (objectSpec.material?.preset === 'earthlike') {
                const continentNoise = Math.sin(theta * 2.7 + y * 5.2) + Math.cos(theta * 4.3 - y * 3.4);
                color = Math.abs(y) > 0.82 ? ice : continentNoise > 0.56 ? land : ocean;
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
                vertexColors: true,
                transparent: true,
                opacity: 0.94,
                depthWrite: false,
                blending: THREE.AdditiveBlending
            })
        );
        points.position.set(...(objectSpec.position || [0, 0, 0]));
        points.userData.isInteractiveParticleObject = true;
        return points;
    }

    createGraphParticleCloud(objectSpec, seed) {
        const THREE = this.THREE;
        const count = clamp(Number(objectSpec.particleCount) || 1000, 200, 5000);
        const radius = objectSpec.radius || 8;
        const random = seededRandom(seed + hashText(objectSpec.id || 'cloud'));
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);
        const color = new THREE.Color(objectSpec.material?.color || '#b48cff');
        const particles = [];

        for (let i = 0; i < count; i += 1) {
            const angle = random() * Math.PI * 2;
            const zAngle = Math.acos(2 * random() - 1);
            const r = radius * (random() ** 0.55);
            const x = Math.sin(zAngle) * Math.cos(angle) * r;
            const y = Math.cos(zAngle) * r;
            const z = Math.sin(zAngle) * Math.sin(angle) * r;
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
                angle,
                zAngle
            });
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('basePosition', new THREE.BufferAttribute(positions.slice(), 3));

        const points = new THREE.Points(
            geometry,
            new THREE.PointsMaterial({
                size: 0.13,
                vertexColors: true,
                transparent: true,
                opacity: 0.88,
                depthWrite: false,
                blending: THREE.AdditiveBlending
            })
        );
        points.position.set(...(objectSpec.position || [0, 0, 0]));
        points.userData.isInteractiveParticleObject = true;
        points.userData.preserveParticleShape = true;

        return { points, particles };
    }

    createGraphParticleShape(objectSpec, seed) {
        const THREE = this.THREE;
        const preset = objectSpec.preset || 'car';
        const count = clamp(Number(objectSpec.particleCount) || 2400, 400, 5200);
        const random = seededRandom(seed + hashText(objectSpec.id || preset));
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);
        const particles = [];
        let cursor = 0;

        const writePoint = (x, y, z, color, region) => {
            if (cursor >= count) return;
            positions[cursor * 3] = x;
            positions[cursor * 3 + 1] = y;
            positions[cursor * 3 + 2] = z;
            colors[cursor * 3] = color.r;
            colors[cursor * 3 + 1] = color.g;
            colors[cursor * 3 + 2] = color.b;
            particles.push({
                base: new THREE.Vector3(x, y, z),
                phase: random() * Math.PI * 2,
                region
            });
            cursor += 1;
        };

        const sampleCuboid = (center, size, amount, colorValue, region) => {
            const color = new THREE.Color(colorValue);
            for (let i = 0; i < amount; i += 1) {
                const face = Math.floor(random() * 6);
                const j = 0.08;
                let x = (random() - 0.5) * size[0];
                let y = (random() - 0.5) * size[1];
                let z = (random() - 0.5) * size[2];
                if (face === 0) x = size[0] / 2;
                if (face === 1) x = -size[0] / 2;
                if (face === 2) y = size[1] / 2;
                if (face === 3) y = -size[1] / 2;
                if (face === 4) z = size[2] / 2;
                if (face === 5) z = -size[2] / 2;
                writePoint(
                    center[0] + x + (random() - 0.5) * j,
                    center[1] + y + (random() - 0.5) * j,
                    center[2] + z + (random() - 0.5) * j,
                    color,
                    region
                );
            }
        };

        const sampleWheel = (center, amount, colorValue, region) => {
            const color = new THREE.Color(colorValue);
            for (let i = 0; i < amount; i += 1) {
                const angle = random() * Math.PI * 2;
                const radius = 1.55 + (random() - 0.5) * 0.34;
                const sideJitter = (random() - 0.5) * 0.46;
                writePoint(
                    center[0] + Math.cos(angle) * radius,
                    center[1] + Math.sin(angle) * radius,
                    center[2] + sideJitter,
                    color,
                    region
                );
            }
        };

        if (preset === 'highway') {
            const asphalt = objectSpec.material?.asphalt || '#384150';
            const lane = objectSpec.material?.lane || '#f5f7fb';
            const edge = objectSpec.material?.edge || '#45d7ff';
            const asphaltColor = new THREE.Color(asphalt);
            const laneColor = new THREE.Color(lane);
            const edgeColor = new THREE.Color(edge);
            for (let i = 0; i < count; i += 1) {
                const laneMark = i % 9 === 0;
                const edgeMark = i % 13 === 0;
                const x = (random() - 0.5) * 110;
                const z = laneMark
                    ? (random() > 0.5 ? 3.6 : -3.6) + (random() - 0.5) * 0.16
                    : edgeMark
                        ? (random() > 0.5 ? 13.2 : -13.2) + (random() - 0.5) * 0.2
                        : (random() - 0.5) * 28;
                const color = laneMark ? laneColor : edgeMark ? edgeColor : asphaltColor;
                writePoint(x, (random() - 0.5) * 0.04, z, color, laneMark ? 'lane' : edgeMark ? 'edge' : 'asphalt');
            }
        } else {
            const body = objectSpec.material?.body || '#4fd8ff';
            const glass = objectSpec.material?.glass || '#d9f6ff';
            const frontLight = objectSpec.material?.frontLight || '#ffcf6b';
            const tailLight = objectSpec.material?.tailLight || '#ff4f6d';
            const wheel = objectSpec.material?.wheel || '#94a3b8';
            sampleCuboid([0, 1.6, 0], [26, 4.4, 8.6], Math.floor(count * 0.48), body, 'body');
            sampleCuboid([-2.4, 5.1, 0], [10.8, 4.4, 6.4], Math.floor(count * 0.17), glass, 'cabin');
            sampleCuboid([12.2, 2.2, -2.8], [0.48, 1.15, 1.35], Math.floor(count * 0.025), frontLight, 'front_light');
            sampleCuboid([12.2, 2.2, 2.8], [0.48, 1.15, 1.35], Math.floor(count * 0.025), frontLight, 'front_light');
            sampleCuboid([-13.2, 2, -2.8], [0.48, 1.05, 1.2], Math.floor(count * 0.025), tailLight, 'tail_light');
            sampleCuboid([-13.2, 2, 2.8], [0.48, 1.05, 1.2], Math.floor(count * 0.025), tailLight, 'tail_light');
            const wheelCount = Math.floor(count * 0.048);
            sampleWheel([-8, -0.85, -4.45], wheelCount, wheel, 'wheel');
            sampleWheel([8, -0.85, -4.45], wheelCount, wheel, 'wheel');
            sampleWheel([-8, -0.85, 4.45], wheelCount, wheel, 'wheel');
            sampleWheel([8, -0.85, 4.45], wheelCount, wheel, 'wheel');
            while (cursor < count) {
                sampleCuboid([0, 1.6, 0], [26, 4.4, 8.6], 1, body, 'body');
            }
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('basePosition', new THREE.BufferAttribute(positions.slice(), 3));

        const points = new THREE.Points(
            geometry,
            new THREE.PointsMaterial({
                size: preset === 'highway' ? 0.08 : 0.16,
                vertexColors: true,
                transparent: true,
                opacity: preset === 'highway' ? 0.56 : 0.98,
                depthWrite: false,
                blending: THREE.AdditiveBlending
            })
        );
        points.position.set(...(objectSpec.position || [0, 0, 0]));
        points.userData.isInteractiveParticleObject = true;

        return { points, particles };
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
                size: 0.11,
                vertexColors: true,
                transparent: true,
                opacity: 0.62,
                depthWrite: false,
                blending: THREE.AdditiveBlending
            })
        );
        points.position.set(...(objectSpec.position || [0, 0, 0]));
        points.userData.isInteractiveParticleObject = true;

        return { points, particles };
    }

    createParticleBall({ radius = 1, count = 300, color = '#ffffff', size = 0.12, opacity = 0.9, seed = 1 }) {
        const THREE = this.THREE;
        const random = seededRandom(seed);
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);
        const particleColor = new THREE.Color(color);

        for (let i = 0; i < count; i += 1) {
            const u = random();
            const v = random();
            const theta = 2 * Math.PI * u;
            const phi = Math.acos(2 * v - 1);
            const r = radius * (0.72 + random() * 0.28);
            positions[i * 3] = Math.sin(phi) * Math.cos(theta) * r;
            positions[i * 3 + 1] = Math.cos(phi) * r;
            positions[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * r;
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
                size,
                vertexColors: true,
                transparent: true,
                opacity,
                depthWrite: false,
                blending: THREE.AdditiveBlending
            })
        );
        points.userData.isInteractiveParticleObject = true;
        return points;
    }

    createParticleRing({ radius = 1, count = 180, color = '#ffffff', size = 0.14, opacity = 0.8, seed = 1 }) {
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
                size,
                vertexColors: true,
                transparent: true,
                opacity,
                depthWrite: false,
                blending: THREE.AdditiveBlending
            })
        );
        ring.userData.isInteractiveParticleObject = true;
        return ring;
    }

    createParticleJet({ direction = 1, color = '#78a6ff', seed = 1 }) {
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
                size: 0.18,
                vertexColors: true,
                transparent: true,
                opacity: 0.26,
                depthWrite: false,
                blending: THREE.AdditiveBlending
            })
        );
        jet.userData.isInteractiveParticleObject = true;
        return jet;
    }

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

    renderSceneGraph(time, paused) {
        const THREE = this.THREE;
        const runtime = this.graphRuntime;
        const localTime = time % runtime.duration;

        const smoothstep = (value) => {
            const x = clamp(value, 0, 1);
            return x * x * (3 - 2 * x);
        };

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
                        const trailProgress = clamp(progress - i * 0.018, 0, 1);
                        const point = entry.start.clone().lerp(entry.end, trailProgress);
                        const tailLift = Math.sin(i * 0.55 + time) * 0.22 * (1 - i / entry.trail.count);
                        positions.setXYZ(i, point.x, point.y + tailLift, point.z);
                    }
                    positions.needsUpdate = true;
                    entry.trail.line.visible = visible;
                }
            }

            if (entry.spec?.role === 'planet' && !paused) {
                entry.mesh.rotation.y += 0.0025;
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
                return;
            }

            if (effect.spec.type === 'speed_trail') {
                this.updateSpeedTrail(effect, runtime, time, paused);
                return;
            }

            const start = effect.event?.at || 0;
            const elapsed = localTime - start;
            const duration = effect.spec.duration || 2;
            const active = elapsed >= 0 && elapsed <= duration;

            if (effect.mesh) {
                effect.mesh.visible = active;
            }

            if (effect.spec.type === 'flash') {
                const p = clamp(elapsed / duration, 0, 1);
                const opacity = active ? (1 - p) ** 1.8 : 0;
                effect.mesh.scale.setScalar(1 + p * 9);
                effect.mesh.material.opacity = opacity * 0.82;
            }

            if (effect.spec.type === 'shockwave') {
                const p = clamp(elapsed / duration, 0, 1);
                const radius = 0.4 + p * (effect.spec.maxRadius || 18);
                effect.mesh.scale.set(radius, radius, radius);
                effect.mesh.material.opacity = active ? (1 - p) * 0.62 : 0;
            }

            if (effect.spec.type === 'debris') {
                effect.points.visible = elapsed >= 0;
                const p = Math.max(elapsed, 0);
                effect.points.material.opacity = elapsed >= 0 ? clamp(1 - p / 5, 0, 0.86) : 0;
                const positions = effect.points.geometry.attributes.position;
                const gravity = new THREE.Vector3(0, -0.45 * p * p, 0);
                effect.particles.forEach((particle, i) => {
                    const drift = particle.velocity.clone().multiplyScalar(p * particle.drag).add(gravity);
                    const position = effect.origin.clone().add(drift);
                    positions.setXYZ(i, position.x, position.y, position.z);
                });
                positions.needsUpdate = true;
            }
        });

        this.applyPointerToInteractiveObjects(0.9);

        const impact = runtime.events.find((event) => event.type === 'collision');
        const shakeStart = runtime.camera.shakeAt || impact?.at || 0;
        const shakeElapsed = localTime - shakeStart;
        const shake = shakeElapsed > 0 && shakeElapsed < 0.7 ? (1 - shakeElapsed / 0.7) * 1.4 : 0;
        this.applyCameraOrbit({ shake, time });
    }

    updateGraphMotions(runtime, localTime, time, paused) {
        if (paused) return;

        runtime.motions.forEach((motion) => {
            if (motion.type === 'orbit' && Array.isArray(motion.targets)) {
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
            }

            if (motion.type === 'orbit_body') {
                const entry = runtime.objects.get(motion.target);
                if (!entry) return;
                const center = runtime.objects.get(motion.center);
                const centerPosition = center?.mesh.position || new this.THREE.Vector3(0, 0, 0);
                const angle = time * (motion.speed || 0.6) + (motion.phase || 0);
                const radius = motion.radius || 20;
                const tilt = motion.tilt || 0;
                entry.mesh.position.set(
                    centerPosition.x + Math.cos(angle) * radius,
                    centerPosition.y + Math.sin(angle) * radius * Math.sin(tilt),
                    centerPosition.z + Math.sin(angle) * radius * Math.cos(tilt)
                );
            }

            if (motion.type === 'wobble') {
                const entry = runtime.objects.get(motion.target);
                if (!entry) return;
                const angle = time * (motion.speed || 0.8);
                const radius = motion.radius || 1;
                entry.mesh.position.x = Math.cos(angle) * radius;
                entry.mesh.position.z = Math.sin(angle) * radius * 0.5;
            }

            if (motion.type === 'helix_flow') {
                const entry = runtime.objects.get(motion.target);
                if (!entry) return;
                this.updateHelixFlow(entry, time, motion);
            }

            if (motion.type === 'speed_pulse') {
                const entry = runtime.objects.get(motion.target);
                if (!entry) return;
                const basePosition = entry.basePosition || entry.mesh.position;
                const pulse = Math.sin(time * (motion.speed || 5));
                entry.mesh.position.set(basePosition.x, basePosition.y + pulse * (motion.amplitude || 0.12), basePosition.z);
                entry.mesh.rotation.z = pulse * 0.012;
            }

            if (motion.type === 'road_scroll') {
                const entry = runtime.objects.get(motion.target);
                if (!entry) return;
                this.updateRoadScroll(entry, time, motion);
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

            if (force.type === 'magnetic') {
                const entry = runtime.objects.get(force.target);
                if (!entry) return;
                this.updateMagneticFlow(entry, time, force);
            }
        });
    }

    updateAttractionCloud(entry, targetPosition, time, spiral, direction) {
        const positions = entry.mesh.geometry.attributes.position;
        const base = entry.mesh.geometry.attributes.basePosition;
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
        const positions = entry.mesh.geometry.attributes.position;
        const base = entry.mesh.geometry.attributes.basePosition;
        const strength = force.strength || 1;

        for (let i = 0; i < positions.count; i += 1) {
            const bx = base.getX(i);
            const by = base.getY(i);
            const bz = base.getZ(i);
            const radius = Math.hypot(bx, bz);
            const baseAngle = Math.atan2(bz, bx);
            const depth = radius / 30;
            const angle = baseAngle + time * strength * (1.4 - depth * 0.65);
            const inward = 1 - 0.22 * Math.sin(time * 0.8 + depth * 4);
            const yWave = by + Math.sin(time * 1.5 + radius * 0.18) * 2.2;
            positions.setXYZ(
                i,
                Math.cos(angle) * radius * inward,
                yWave,
                Math.sin(angle) * radius * inward
            );
        }

        positions.needsUpdate = true;
    }

    updateHelixFlow(entry, time, motion) {
        const positions = entry.mesh.geometry.attributes.position;
        const base = entry.mesh.geometry.attributes.basePosition;
        const speed = motion.speed || 0.9;
        const radius = motion.radius || 18;

        for (let i = 0; i < positions.count; i += 1) {
            const phase = entry.particles?.[i]?.phase || 0;
            const t = ((i / positions.count) + time * speed * 0.08 + phase * 0.01) % 1;
            const angle = t * Math.PI * 10 + phase;
            const streamRadius = radius * (0.25 + 0.55 * ((i % 23) / 23));
            positions.setXYZ(
                i,
                Math.cos(angle) * streamRadius,
                (t - 0.5) * 48,
                Math.sin(angle) * streamRadius
            );
        }

        positions.needsUpdate = true;
    }

    updateMagneticFlow(entry, time, force) {
        const positions = entry.mesh.geometry.attributes.position;
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
        const positions = entry.mesh.geometry.attributes.position;
        const base = entry.mesh.geometry.attributes.basePosition;
        const length = motion.length || 86;
        const offset = (time * (motion.speed || 1) * 22) % length;

        for (let i = 0; i < positions.count; i += 1) {
            let x = base.getX(i) - offset;
            while (x < -length * 0.62) x += length;
            positions.setXYZ(i, x, base.getY(i), base.getZ(i));
        }

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
            positions.setXYZ(
                i,
                point.x,
                point.y + wave,
                point.z + Math.cos(t * Math.PI * 6 + time * 2) * 1.4
            );
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
                    // Kepler-like angular velocity: inner disk rotates much faster than the outer disk.
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
            if (child.userData?.spin && !paused) {
                child.rotation.z += child.userData.spin || 0;
            }
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

function hexWithAlpha(hex, alpha) {
    const clean = hex.replace('#', '');
    const value = clean.length === 3 ? clean.split('').map((part) => part + part).join('') : clean;
    const r = parseInt(value.slice(0, 2), 16);
    const g = parseInt(value.slice(2, 4), 16);
    const b = parseInt(value.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${clamp(alpha, 0, 1)})`;
}

const renderers = {
    '3d': new ThreeRenderer(threeStage)
};

async function setScene(scene) {
    appState.scene = scene;
    sceneTitle.textContent = scene.title;
    sceneKind.textContent = `${scene.renderer} / ${scene.kind}`;
    sceneSpec.textContent = JSON.stringify(scene, null, 2);
    stage.dataset.renderer = '3d';

    appState.activeRenderer = renderers['3d'];

    try {
        await appState.activeRenderer.setScene(scene);
    } catch (error) {
        console.warn('3D renderer failed, falling back to particle nebula.', error);
        const fallback = validateSceneSpec({ ...scene, renderer: '3d', kind: 'particle_nebula', title: `${scene.title} Fallback` });
        await setScene(fallback);
    }
}

function renderFrame(now) {
    const delta = Math.min((now - appState.lastFrame) / 1000, 0.05);
    appState.lastFrame = now;
    if (!appState.paused) appState.time += delta;

    if (appState.activeRenderer) {
        appState.activeRenderer.render(appState.time, appState.paused);
    }

    requestAnimationFrame(renderFrame);
}

promptForm.addEventListener('submit', (event) => {
    event.preventDefault();
    setScene(parseScenePrompt(promptInput.value));
});

document.querySelectorAll('[data-prompt]').forEach((button) => {
    button.addEventListener('click', () => {
        promptInput.value = button.dataset.prompt;
        setScene(parseScenePrompt(promptInput.value));
    });
});

pauseBtn.addEventListener('click', () => {
    appState.paused = !appState.paused;
    pauseBtn.setAttribute('aria-label', appState.paused ? 'Resume animation' : 'Pause animation');
    pauseIcon.textContent = appState.paused ? '>' : '||';
});

window.addEventListener('resize', () => {
    renderers['3d'].resize();
});

setScene(validateSceneSpec(DEFAULT_SCENE));
requestAnimationFrame(renderFrame);
