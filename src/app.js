import { ThreeRenderer } from './renderer.js';
import { DEFAULT_SCENE, parseScenePrompt, validateSceneSpec } from './parser.js';
import { createTextSceneGraph, createVortexSceneGraph, createMagneticFieldSceneGraph, createSolarSystemSceneGraph } from './scenes.js';
import { isSupportedModelFile, loadModelVertices, parseObjVertices } from './model-loader.js';
import { hashText } from './util.js';

const stage = document.querySelector('.stage');
const threeStage = document.getElementById('threeStage');
const promptForm = document.getElementById('promptForm');
const promptInput = document.getElementById('promptInput');
const sceneSpec = document.getElementById('sceneSpec');
const sceneKind = document.getElementById('sceneKind');
const sceneTitle = document.getElementById('sceneTitle');
const sceneSubtitle = document.getElementById('sceneSubtitle');
const pauseBtn = document.getElementById('pauseBtn');
const pauseIcon = document.getElementById('pauseIcon');
const resetViewBtn = document.getElementById('resetViewBtn');
const particleCount = document.getElementById('particleCount');
const particleCountValue = document.getElementById('particleCountValue');
const particleReadout = document.getElementById('particleReadout');
const simSpeed = document.getElementById('simSpeed');
const simSpeedValue = document.getElementById('simSpeedValue');
const glowIntensity = document.getElementById('glowIntensity');
const glowIntensityValue = document.getElementById('glowIntensityValue');
const modelUpload = document.getElementById('modelUpload');
const systemStatus = document.getElementById('systemStatus');
const specStatus = document.getElementById('specStatus');

const FLOW_PALETTE = ['#27f5d3', '#6aa9ff', '#f5f7fb', '#b48cff'];

const appState = {
    scene: null,
    activeRenderer: new ThreeRenderer(threeStage),
    time: 0,
    lastFrame: performance.now(),
    paused: false,
    activeFormation: 'nebula',
    uploadedModel: null
};

function currentSettings() {
    return {
        particleCount: Number(particleCount.value),
        speed: Number(simSpeed.value),
        intensity: Number(glowIntensity.value)
    };
}

function updateControlLabels() {
    const settings = currentSettings();
    particleCountValue.textContent = settings.particleCount.toLocaleString();
    particleReadout.textContent = `${settings.particleCount.toLocaleString()} particles`;
    simSpeedValue.textContent = settings.speed.toFixed(2);
    glowIntensityValue.textContent = settings.intensity.toFixed(2);
}

function applySettings(spec) {
    const settings = currentSettings();
    const requestedParticleCount = Number(spec.particleCount) || settings.particleCount;
    const finalParticleCount = Math.max(settings.particleCount, requestedParticleCount);
    return validateSceneSpec({
        ...spec,
        particleCount: finalParticleCount,
        speed: settings.speed,
        intensity: settings.intensity,
        controls: {
            trail: spec.controls?.trail !== false,
            glow: true,
            autoRotate: spec.controls?.autoRotate !== false
        },
        sceneGraph: spec.sceneGraph ? tuneSceneGraphDensity(spec.sceneGraph, finalParticleCount) : spec.sceneGraph
    });
}

function tuneSceneGraphDensity(graph, targetCount) {
    const particleObjects = (graph.objects || []).filter((object) => (
        ['particle_cloud', 'text_particles', 'model_points', 'car_part', 'particle_shape'].includes(object.type)
    ));
    if (particleObjects.length === 0) return graph;

    const perObject = Math.max(400, Math.floor(targetCount / particleObjects.length));
    return {
        ...graph,
        objects: graph.objects.map((object) => {
            if (!particleObjects.includes(object)) return object;
            const current = Number(object.particleCount) || perObject;
            return {
                ...object,
                particleCount: clampNumber(Math.max(current, perObject), 400, 30000)
            };
        })
    };
}

function clampNumber(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function createFormationScene(formation) {
    const settings = currentSettings();
    const seed = hashText(`${formation}:${settings.particleCount}:${settings.speed}`);

    if (formation === 'black-hole') {
        return applySettings({
            renderer: '3d',
            kind: 'black_hole_3d',
            title: 'Black Hole Flow',
            palette: ['#ffb454', '#ff6b4a', '#78a6ff', '#f5f7fb'],
            labels: ['event horizon', 'accretion disk', 'particle jets'],
            seed,
            controls: { trail: true, glow: true, autoRotate: true }
        });
    }

    if (formation === 'vortex') {
        return applySettings({
            renderer: '3d',
            kind: 'scene_graph',
            title: 'Vortex Flow',
            palette: FLOW_PALETTE,
            labels: ['vortex core', 'spiral flow'],
            seed,
            controls: { trail: true, glow: true, autoRotate: false },
            sceneGraph: createVortexSceneGraph(seed, FLOW_PALETTE)
        });
    }

    if (formation === 'magnetic') {
        const palette = ['#45d7ff', '#ff5b8a', '#f5f7fb', '#20d6b5'];
        return applySettings({
            renderer: '3d',
            kind: 'scene_graph',
            title: 'Magnetic Field Flow',
            palette,
            labels: ['field lines', 'charged particles', 'curved paths'],
            seed,
            controls: { trail: true, glow: true, autoRotate: false },
            sceneGraph: createMagneticFieldSceneGraph(seed, palette)
        });
    }

    if (formation === 'solar') {
        const palette = ['#ffcf6b', '#2e7cff', '#ff8a4a', '#d9d7c8'];
        return applySettings({
            renderer: '3d',
            kind: 'scene_graph',
            title: 'Particle Solar System',
            palette,
            labels: ['sun', 'planetary orbits', 'moon path'],
            seed,
            controls: { trail: true, glow: true, autoRotate: false },
            sceneGraph: createSolarSystemSceneGraph(seed, palette)
        });
    }

    if (formation === 'text') {
        return applySettings({
            renderer: '3d',
            kind: 'scene_graph',
            title: 'Text Particle Field',
            palette: FLOW_PALETTE,
            labels: ['text glyphs', 'depth field'],
            seed,
            controls: { trail: true, glow: true, autoRotate: false },
            sceneGraph: createTextSceneGraph(seed, FLOW_PALETTE, 'SPIRIT', { dense: settings.particleCount > 10000, bright: true })
        });
    }

    return applySettings({
        ...DEFAULT_SCENE,
        title: 'Particle Nebula',
        palette: FLOW_PALETTE,
        particleCount: settings.particleCount,
        seed,
        controls: { trail: true, glow: true, autoRotate: true }
    });
}

function createModelScene(fileName, vertices, format = 'MODEL') {
    const settings = currentSettings();
    const modelParticleCount = Math.max(settings.particleCount, 22000);
    const seed = hashText(`${fileName}:${format}:${vertices.length}`);
    return applySettings({
        renderer: '3d',
        kind: 'scene_graph',
        title: `Model Cloud · ${fileName.replace(/\.[^.]+$/, '').slice(0, 28)}`,
        palette: FLOW_PALETTE,
        particleCount: modelParticleCount,
        labels: [`${format} model`, 'particle shell', 'model flow'],
        seed,
        controls: { trail: true, glow: true, autoRotate: false },
        sceneGraph: {
            version: 1,
            duration: 14,
            world: { environment: 'studio', timeScale: 1, physicsMode: 'visual' },
            objects: [
                {
                    id: 'uploaded_model',
                    type: 'model_points',
                    role: 'model',
                    vertices,
                    particleCount: modelParticleCount,
                    material: {
                        color: FLOW_PALETTE[0],
                        accent: FLOW_PALETTE[1]
                    }
                }
            ],
            motions: [
                { type: 'model_flow', target: 'uploaded_model', speed: settings.speed, amplitude: 0.9 }
            ],
            forces: [],
            events: [],
            effects: [],
            camera: { mode: 'free_orbit', distance: 58 },
            seed
        }
    });
}

function sceneForDisplay(spec) {
    if (spec.sceneGraph?.objects) {
        return {
            ...spec,
            sceneGraph: {
                ...spec.sceneGraph,
                objects: spec.sceneGraph.objects.map((object) => {
                    if (object.type !== 'model_points') return object;
                    return {
                        ...object,
                        vertices: `[${object.vertices.length.toLocaleString()} source vertices normalized at render time]`
                    };
                })
            }
        };
    }
    return spec;
}

async function setScene(scene, subtitle = '') {
    appState.scene = scene;
    sceneTitle.textContent = scene.title;
    sceneSubtitle.textContent = subtitle || scene.labels?.join(' / ') || 'Interactive 3D particle field';
    sceneKind.textContent = `${scene.renderer} / ${scene.kind}`;
    sceneSpec.textContent = JSON.stringify(sceneForDisplay(scene), null, 2);
    stage.dataset.renderer = '3d';
    specStatus.textContent = 'VALID';

    try {
        systemStatus.textContent = 'CALIBRATING';
        await appState.activeRenderer.setScene(scene);
        systemStatus.textContent = 'SYSTEM READY';
    } catch (error) {
        console.warn('3D renderer failed, falling back to particle nebula.', error);
        specStatus.textContent = 'FALLBACK';
        const fallback = applySettings({ ...DEFAULT_SCENE, title: `${scene.title} Fallback` });
        await setScene(fallback, 'Fallback particle nebula');
    }
}

function projectActiveFormation() {
    if (appState.activeFormation === 'model' && appState.uploadedModel) {
        setScene(
            createModelScene(appState.uploadedModel.name, appState.uploadedModel.vertices, appState.uploadedModel.format),
            `Uploaded ${appState.uploadedModel.format} rendered as particles`
        );
        return;
    }
    setScene(createFormationScene(appState.activeFormation), 'Live particle formation preset');
}

function renderFrame(now) {
    const delta = Math.min((now - appState.lastFrame) / 1000, 0.05);
    appState.lastFrame = now;
    if (!appState.paused) appState.time += delta;

    appState.activeRenderer.render(appState.time, appState.paused);
    requestAnimationFrame(renderFrame);
}

async function handleModelUpload(file) {
    if (!file) return;
    if (!isSupportedModelFile(file.name)) {
        systemStatus.textContent = 'FORMAT';
        return;
    }

    try {
        systemStatus.textContent = 'IMPORTING';
        const model = await loadModelVertices(file);
        await loadModelData(file.name, model.vertices, model.format);
    } catch (error) {
        console.warn('Model import failed.', error);
        systemStatus.textContent = 'IMPORT FAIL';
    }
}

async function loadObjText(name, source) {
    await loadModelData(name, parseObjVertices(source), 'OBJ');
}

async function loadModelData(name, vertices, format = 'MODEL') {
    if (vertices.length < 3) {
        systemStatus.textContent = 'NO VERTICES';
        return;
    }

    if (Number(particleCount.value) < 22000) {
        particleCount.value = 22000;
        updateControlLabels();
    }

    appState.uploadedModel = { name, vertices, format };
    appState.activeFormation = 'model';
    document.querySelectorAll('[data-formation]').forEach((button) => button.classList.remove('is-active'));
    await setScene(
        createModelScene(name, vertices, format),
        `${vertices.length.toLocaleString()} ${format} vertices converted into a particle cloud`
    );
}

function bindEvents() {
    promptForm.addEventListener('submit', (event) => {
        event.preventDefault();
        appState.activeFormation = 'prompt';
        document.querySelectorAll('[data-formation]').forEach((button) => button.classList.remove('is-active'));
        setScene(applySettings(parseScenePrompt(promptInput.value)), 'Prompt parsed into a validated scene graph');
    });

    document.querySelectorAll('[data-formation]').forEach((button) => {
        button.addEventListener('click', () => {
            appState.activeFormation = button.dataset.formation;
            document.querySelectorAll('[data-formation]').forEach((item) => item.classList.toggle('is-active', item === button));
            setScene(createFormationScene(appState.activeFormation), 'Live particle formation preset');
        });
    });

    [particleCount, simSpeed, glowIntensity].forEach((input) => {
        input.addEventListener('input', () => {
            updateControlLabels();
            projectActiveFormation();
        });
    });

    modelUpload.addEventListener('change', () => {
        handleModelUpload(modelUpload.files?.[0]);
    });

    pauseBtn.addEventListener('click', () => {
        appState.paused = !appState.paused;
        pauseBtn.setAttribute('aria-label', appState.paused ? 'Resume animation' : 'Pause animation');
        pauseIcon.textContent = appState.paused ? '>' : '||';
    });

    resetViewBtn.addEventListener('click', () => {
        appState.activeRenderer.setCameraDistance(appState.scene?.sceneGraph?.camera?.distance || 72);
    });

    window.addEventListener('resize', () => {
        appState.activeRenderer.resize();
    });
}

updateControlLabels();
bindEvents();
document.querySelector('[data-formation="nebula"]')?.classList.add('is-active');
setScene(createFormationScene('nebula'), 'Live particle formation preset');
requestAnimationFrame(renderFrame);

window.__spiritParticleLab = {
    loadObjText,
    loadModelData,
    parseObjVertices,
    createFormationScene
};
