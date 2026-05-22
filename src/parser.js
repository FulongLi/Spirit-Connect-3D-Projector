// Prompt parser + scene-spec validator.
// Inputs a natural-language prompt, outputs a strict scene spec object.
// The intent here is deliberately deterministic — the same prompt always
// yields the same scene graph, so the result feels structured rather than
// random.

import { clamp, hashText } from './util.js';
import {
    createImpactSceneGraph,
    createBinaryStarSceneGraph,
    createMagneticFieldSceneGraph,
    createEarthMoonSceneGraph,
    createSolarSystemSceneGraph,
    createSpeedingCarSceneGraph,
    createAttractionSceneGraph,
    createVortexSceneGraph,
    createTextSceneGraph
} from './scenes.js';

export const DEFAULT_SCENE = {
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

const VALID_RENDERERS = new Set(['3d']);
const VALID_KINDS = new Set([
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

export function parseScenePrompt(prompt) {
    const text = String(prompt || '').trim().toLowerCase();
    const original = String(prompt || '').trim();
    const seed = hashText(text);

    // --- intent detection ---------------------------------------------------
    const quotedText = extractQuotedText(original);
    const wantsText = quotedText
        || /(text|word|letters|caption|文字|写着|文字粒子)/.test(text);
    const wantsImpact = /(comet|meteor|asteroid|impact|crash|collide|彗星|陨石|小行星|撞击|碰撞)/.test(text);
    const wantsAttraction = /(attract|pull together|converge|spiral inward|soul|energy clouds|互相吸引|吸引|靠近|灵魂|能量球|汇聚)/.test(text);
    const wantsVortex = /(vortex|spiral|whirlpool|tornado|swirl|漩涡|旋涡|螺旋|龙卷|旋转场)/.test(text);
    const wantsBinary = /(binary star|double star|two stars|双星|双恒星|双星系统)/.test(text);
    const wantsMagnetic = /(magnetic|magnet|electromagnetic|lorentz|charged particles|磁场|电磁|洛伦兹|带电粒子)/.test(text);
    const wantsSolar = /(solar system|planets orbiting|sun and planets|太阳系|行星|绕太阳)/.test(text);
    const wantsEarthMoon = /(earth and moon|earth moon|moon orbit|地月|月球|地球和月球)/.test(text);
    const wantsVehicle = /(car|automobile|vehicle|sports car|highway|freeway|road|speeding|racing|汽车|轿车|跑车|车辆|高速|公路|疾驰|飞驰)/.test(text);

    // --- palette + intensity hints ------------------------------------------
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

    // Non scene-graph fallbacks (legacy kinds) — only used when no scene graph
    // builder matches. These stay around for the simple nebula / black-hole /
    // orbital cases.
    let renderer = '3d';
    let kind = 'particle_nebula';
    let title = 'Particle Nebula';
    let labels = ['depth field', 'orbital drift'];

    if (/(electric|charge|charged|field|电场|电荷)/.test(text)) {
        kind = 'field_cloud';
        title = 'Spatial Field Cloud';
        labels = ['positive charge', 'negative charge', 'field lines'];
    } else if (/(pendulum|swing|oscillat|摆|单摆)/.test(text)) {
        kind = 'particle_nebula';
        title = 'Pendulum Particle Trace';
        labels = ['pivot', 'restoring force', 'energy trail'];
    } else if (/(orbit|planet|solar|gravity|black hole|引力|轨道|黑洞)/.test(text) && !wantsSolar && !wantsEarthMoon && !wantsBinary) {
        kind = /(black hole|黑洞)/.test(text) ? 'black_hole_3d' : 'orbital_3d';
        title = /(black hole|黑洞)/.test(text) ? 'Black Hole Field' : 'Orbital System';
        labels = /(black hole|黑洞)/.test(text)
            ? ['event horizon', 'accretion disk', 'relativistic flow']
            : ['primary body', 'orbital path', 'gravity well'];
    } else if (/(wave|interference|ripple|standing|波|干涉)/.test(text)) {
        kind = 'field_cloud';
        title = 'Wave Particle Field';
        labels = ['source A', 'source B', 'interference bands'];
    }

    if (kind === 'black_hole_3d' && !warm && !cool && !violet) {
        palette = ['#ffb454', '#ff6b4a', '#78a6ff', '#f5f7fb'];
    }

    // --- scene-graph dispatchers (preferred path) ---------------------------
    if (wantsText) {
        const phrase = quotedText || extractFirstWord(original) || 'SPIRIT';
        const textPalette = violet ? palette
            : warm ? palette
                : cool ? palette
                    : ['#20d6b5', '#6aa9ff', '#f5f7fb', '#b48cff'];
        return validateSceneSpec({
            renderer: '3d',
            kind: 'scene_graph',
            title: `Text · ${phrase}`,
            palette: textPalette,
            particleCount: dense ? 6000 : 4400,
            speed: slow ? 0.4 : 0.7,
            intensity: bright ? 0.96 : 0.82,
            labels: ['text glyphs', 'depth field'],
            seed,
            controls: { trail: true, glow: true, autoRotate: false },
            sceneGraph: createTextSceneGraph(seed, textPalette, phrase, { dense, bright })
        });
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
            controls: { trail: true, glow: true, autoRotate: false },
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
            controls: { trail: true, glow: true, autoRotate: false },
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
            controls: { trail: true, glow: true, autoRotate: false },
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
            controls: { trail: true, glow: true, autoRotate: false },
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
            controls: { trail: true, glow: true, autoRotate: false },
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
            labels: ['car silhouette', 'rolling wheels', 'highway motion'],
            seed,
            controls: { trail: true, glow: true, autoRotate: false },
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
            controls: { trail: true, glow: true, autoRotate: false },
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
            controls: { trail: true, glow: true, autoRotate: false },
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

export function validateSceneSpec(spec) {
    return {
        renderer: VALID_RENDERERS.has(spec.renderer) ? spec.renderer : DEFAULT_SCENE.renderer,
        kind: VALID_KINDS.has(spec.kind) ? spec.kind : DEFAULT_SCENE.kind,
        title: String(spec.title || DEFAULT_SCENE.title).slice(0, 60),
        palette: Array.isArray(spec.palette) && spec.palette.length >= 2 ? spec.palette.slice(0, 4) : DEFAULT_SCENE.palette,
        particleCount: clamp(Number(spec.particleCount) || DEFAULT_SCENE.particleCount, 400, 8000),
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

export function validateSceneGraph(graph) {
    if (!graph || typeof graph !== 'object') {
        return createImpactSceneGraph(1, ['#2e7cff', '#22d6b8', '#ffb454', '#ff5b45']);
    }

    return {
        version: 1,
        duration: clamp(Number(graph.duration) || 10, 4, 30),
        world: graph.world || {},
        objects: Array.isArray(graph.objects) ? graph.objects.slice(0, 32) : [],
        motions: Array.isArray(graph.motions) ? graph.motions.slice(0, 32) : [],
        forces: Array.isArray(graph.forces) ? graph.forces.slice(0, 24) : [],
        events: Array.isArray(graph.events) ? graph.events.slice(0, 16) : [],
        effects: Array.isArray(graph.effects) ? graph.effects.slice(0, 24) : [],
        camera: graph.camera || {},
        seed: Number(graph.seed) || 1
    };
}

// --- helpers ----------------------------------------------------------------

function extractQuotedText(input) {
    if (!input) return null;
    const match = input.match(/[“"”']([^“"”']{1,32})[“"”']/);
    if (match) return match[1].trim();
    const cnMatch = input.match(/「([^」]{1,32})」/) || input.match(/【([^】]{1,32})】/);
    if (cnMatch) return cnMatch[1].trim();
    return null;
}

function extractFirstWord(input) {
    if (!input) return null;
    // Match the first run of letters/digits/CJK after "text"/"word"/"文字".
    const after = input.match(/(?:text|word|caption|文字|写着)[\s::]+([\p{L}\p{N}]+)/iu);
    if (after) return after[1];
    return null;
}
