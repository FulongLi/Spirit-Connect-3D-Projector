import { ThreeRenderer } from './renderer.js';
import { DEFAULT_SCENE, parseScenePrompt, validateSceneSpec } from './parser.js';
import { createTextSceneGraph, createVortexSceneGraph, createMagneticFieldSceneGraph, createSolarSystemSceneGraph } from './scenes.js';
import { createSpiritCoreSamples, isSupportedModelFile, loadModelFromUrl, loadModelVertices, parseObjVertices } from './model-loader.js';
import { hashText } from './util.js';

const stage = document.querySelector('.stage');
const threeStage = document.getElementById('threeStage');
const promptForm = document.getElementById('promptForm');
const promptInput = document.getElementById('promptInput');
const sceneSpec = document.getElementById('sceneSpec');
const sceneKind = document.getElementById('sceneKind');
const sceneTitle = document.getElementById('sceneTitle');
const sceneSubtitle = document.getElementById('sceneSubtitle');
const prevModelBtn = document.getElementById('prevModelBtn');
const nextModelBtn = document.getElementById('nextModelBtn');
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
const particleSize = document.getElementById('particleSize');
const particleSizeValue = document.getElementById('particleSizeValue');
const surfaceFlow = document.getElementById('surfaceFlow');
const surfaceFlowValue = document.getElementById('surfaceFlowValue');
const mousePush = document.getElementById('mousePush');
const mousePushValue = document.getElementById('mousePushValue');
const hologramBrightness = document.getElementById('hologramBrightness');
const hologramBrightnessValue = document.getElementById('hologramBrightnessValue');
const modelRotate = document.getElementById('modelRotate');
const showRings = document.getElementById('showRings');
const showGrid = document.getElementById('showGrid');
const modelUpload = document.getElementById('modelUpload');
const systemStatus = document.getElementById('systemStatus');
const specStatus = document.getElementById('specStatus');

const FLOW_PALETTE = ['#27f5d3', '#6aa9ff', '#f5f7fb', '#b48cff'];
const HOLOGRAM_THEMES = {
    cyan: ['#27f5d3', '#6aa9ff', '#f5f7fb', '#9dfbf0'],
    light: ['#f5f7fb', '#8fe7ff', '#b7c7da', '#ffffff'],
    amber: ['#ffcf6b', '#f47f45', '#f5f7fb', '#ffe3a3'],
    violet: ['#b48cff', '#27f5d3', '#f2e7ff', '#6aa9ff']
};
const MODEL_PARTICLE_TARGET = 60000;
const MAX_PARTICLE_COUNT = 200000;
const BUILT_IN_MODELS = {
    bd1: {
        name: 'BD-1 Droid',
        fileName: 'bd1.glb',
        url: 'public/models/bd1.glb',
        format: 'GLB',
        credit: 'Cortiz hologram-particles demo model'
    },
    bb8: {
        name: 'BB-8 Droid',
        fileName: 'bb8.glb',
        url: 'public/models/bb8.glb',
        format: 'GLB',
        credit: 'Cortiz hologram-particles demo model'
    },
    spirit: {
        name: 'Spirit Core',
        fileName: 'spirit-core.procedural',
        format: 'PROCEDURAL',
        credit: 'Spirit Connect procedural demo model'
    }
};
const BUILT_IN_MODEL_IDS = Object.keys(BUILT_IN_MODELS);

const appState = {
    scene: null,
    activeRenderer: new ThreeRenderer(threeStage),
    time: 0,
    lastFrame: performance.now(),
    paused: false,
    activeFormation: 'nebula',
    uploadedModel: null,
    builtInModelCache: new Map(),
    hologramTheme: 'cyan',
    pendingProjection: null
};

function currentSettings() {
    return {
        particleCount: Number(particleCount.value),
        speed: Number(simSpeed.value),
        intensity: Number(glowIntensity.value),
        particleSize: Number(particleSize.value),
        surfaceFlow: Number(surfaceFlow.value),
        mousePush: Number(mousePush.value),
        brightness: Number(hologramBrightness.value),
        modelRotate: modelRotate.checked,
        showRings: showRings.checked,
        showGrid: showGrid.checked,
        palette: currentPalette()
    };
}

function updateControlLabels() {
    const settings = currentSettings();
    particleCountValue.textContent = settings.particleCount.toLocaleString();
    particleReadout.textContent = `${settings.particleCount.toLocaleString()} particles`;
    simSpeedValue.textContent = settings.speed.toFixed(2);
    glowIntensityValue.textContent = settings.intensity.toFixed(2);
    particleSizeValue.textContent = settings.particleSize.toFixed(3);
    surfaceFlowValue.textContent = settings.surfaceFlow.toFixed(2);
    mousePushValue.textContent = settings.mousePush.toFixed(2);
    hologramBrightnessValue.textContent = settings.brightness.toFixed(2);
}

function currentPalette() {
    return HOLOGRAM_THEMES[appState.hologramTheme] || HOLOGRAM_THEMES.cyan;
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
                particleCount: clampNumber(Math.max(current, perObject), 400, MAX_PARTICLE_COUNT)
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
    const palette = settings.palette;

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
            palette,
            labels: ['vortex core', 'spiral flow'],
            seed,
            controls: { trail: true, glow: true, autoRotate: false },
            sceneGraph: createVortexSceneGraph(seed, palette)
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
            palette,
            labels: ['text glyphs', 'depth field'],
            seed,
            controls: { trail: true, glow: true, autoRotate: false },
            sceneGraph: createTextSceneGraph(seed, palette, 'SPIRIT', { dense: settings.particleCount > 10000, bright: true })
        });
    }

    return applySettings({
        ...DEFAULT_SCENE,
        title: 'Particle Nebula',
        palette,
        particleCount: settings.particleCount,
        seed,
        controls: { trail: true, glow: true, autoRotate: true }
    });
}

function createModelScene(fileName, vertices, format = 'MODEL', normals = [], metadata = {}) {
    const settings = currentSettings();
    const palette = settings.palette;
    const modelParticleCount = Math.max(settings.particleCount, MODEL_PARTICLE_TARGET);
    const seed = hashText(`${fileName}:${format}:${vertices.length}`);
    const cleanName = fileName.replace(/\.[^.]+$/, '').slice(0, 28);
    return applySettings({
        renderer: '3d',
        kind: 'scene_graph',
        title: cleanName,
        palette,
        particleCount: modelParticleCount,
        labels: [`${format} surface`, `${modelParticleCount.toLocaleString()} particles`, 'hologram flow'],
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
                    normals,
                    morphFromVertices: metadata.morphFrom?.vertices,
                    morphFromNormals: metadata.morphFrom?.normals,
                    morphDuration: metadata.morphFrom ? 1.75 : 0,
                    particleCount: modelParticleCount,
                    sourceVertices: metadata.sourceVertices,
                    sampled: metadata.sampled === true,
                    material: {
                        color: palette[0],
                        accent: palette[1],
                        highlight: palette[2],
                        pointSize: settings.particleSize,
                        opacity: 0.96,
                        brightness: settings.brightness,
                        glow: settings.intensity
                    }
                }
            ],
            motions: [
                {
                    type: 'model_flow',
                    target: 'uploaded_model',
                    speed: settings.speed,
                    amplitude: settings.surfaceFlow,
                    pointerStrength: settings.mousePush,
                    rotationSpeed: settings.modelRotate ? 0.16 : 0
                }
            ],
            forces: [],
            events: [],
            effects: [
                {
                    id: 'hologram_stage',
                    type: 'hologram_stage',
                    color: palette[0],
                    accent: palette[1],
                    showRings: settings.showRings,
                    showGrid: settings.showGrid,
                    brightness: settings.brightness
                }
            ],
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
                        vertices: `[${object.vertices.length.toLocaleString()} sampled surface points normalized at render time]`,
                        normals: Array.isArray(object.normals)
                            ? `[${object.normals.length.toLocaleString()} surface normals]`
                            : object.normals,
                        morphFromVertices: Array.isArray(object.morphFromVertices)
                            ? `[${object.morphFromVertices.length.toLocaleString()} previous model samples]`
                            : object.morphFromVertices,
                        morphFromNormals: Array.isArray(object.morphFromNormals)
                            ? `[${object.morphFromNormals.length.toLocaleString()} previous surface normals]`
                            : object.morphFromNormals
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
        const targetCount = Math.max(currentSettings().particleCount, MODEL_PARTICLE_TARGET);
        if (appState.uploadedModel.builtIn && appState.uploadedModel.vertices.length !== targetCount) {
            loadBuiltInModel(appState.uploadedModel.builtIn);
            return;
        }
        setScene(
            createModelScene(
                appState.uploadedModel.name,
                appState.uploadedModel.vertices,
                appState.uploadedModel.format,
                appState.uploadedModel.normals,
                appState.uploadedModel
            ),
            `Uploaded ${appState.uploadedModel.format} rendered as particles`
        );
        return;
    }
    setScene(createFormationScene(appState.activeFormation), 'Live particle formation preset');
}

function scheduleProjectActiveFormation() {
    window.clearTimeout(appState.pendingProjection);
    appState.pendingProjection = window.setTimeout(() => {
        projectActiveFormation();
    }, 160);
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
        const model = await loadModelVertices(file, Math.max(currentSettings().particleCount, MODEL_PARTICLE_TARGET));
        await loadModelData(file.name, model.vertices, model.format, {
            ...model,
            morphFrom: captureCurrentModelForMorph()
        });
    } catch (error) {
        console.warn('Model import failed.', error);
        systemStatus.textContent = 'IMPORT FAIL';
    }
}

async function loadObjText(name, source) {
    await loadModelData(name, parseObjVertices(source), 'OBJ', { sampled: false });
}

async function loadBuiltInModel(modelId) {
    const preset = BUILT_IN_MODELS[modelId];
    if (!preset) return;
    const targetCount = Math.max(currentSettings().particleCount, MODEL_PARTICLE_TARGET);
    const cacheKey = `${modelId}:${targetCount}`;

    try {
        systemStatus.textContent = 'LOADING MODEL';
        let model = appState.builtInModelCache.get(cacheKey);
        if (!model) {
            model = preset.url
                ? await loadModelFromUrl(preset.url, preset.fileName, targetCount)
                : createSpiritCoreSamples(targetCount);
            appState.builtInModelCache.set(cacheKey, model);
        }
        await loadModelData(preset.name, model.vertices, model.format || preset.format, {
            ...model,
            credit: preset.credit,
            builtIn: modelId,
            morphFrom: captureCurrentModelForMorph(modelId)
        });
        document.querySelectorAll('[data-model]').forEach((button) => button.classList.toggle('is-active', button.dataset.model === modelId));
    } catch (error) {
        console.warn('Built-in model failed.', error);
        systemStatus.textContent = 'MODEL FAIL';
    }
}

function captureCurrentModelForMorph(nextBuiltInId = null) {
    if (appState.activeFormation !== 'model' || !appState.uploadedModel?.vertices?.length) return null;
    if (nextBuiltInId && appState.uploadedModel.builtIn === nextBuiltInId) return null;
    return {
        vertices: appState.uploadedModel.vertices,
        normals: appState.uploadedModel.normals || [],
        name: appState.uploadedModel.name
    };
}

function switchBuiltInModel(direction) {
    const activeId = appState.uploadedModel?.builtIn || BUILT_IN_MODEL_IDS[0];
    const currentIndex = Math.max(BUILT_IN_MODEL_IDS.indexOf(activeId), 0);
    const nextIndex = (currentIndex + direction + BUILT_IN_MODEL_IDS.length) % BUILT_IN_MODEL_IDS.length;
    loadBuiltInModel(BUILT_IN_MODEL_IDS[nextIndex]);
}

async function loadModelData(name, vertices, format = 'MODEL', metadata = {}) {
    if (vertices.length < 3) {
        systemStatus.textContent = 'NO VERTICES';
        return;
    }

    if (Number(particleCount.value) < MODEL_PARTICLE_TARGET) {
        particleCount.value = MODEL_PARTICLE_TARGET;
        updateControlLabels();
    }

    appState.uploadedModel = {
        name,
        vertices,
        format,
        normals: metadata.normals || [],
        sampled: metadata.sampled === true,
        sourceVertices: metadata.sourceVertices,
        credit: metadata.credit,
        builtIn: metadata.builtIn
    };
    appState.activeFormation = 'model';
    document.querySelectorAll('[data-formation]').forEach((button) => button.classList.remove('is-active'));
    await setScene(
        createModelScene(name, vertices, format, metadata.normals || [], metadata),
        `${vertices.length.toLocaleString()} ${format} surface samples rendered as a hologram`
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
            document.querySelectorAll('[data-model]').forEach((item) => item.classList.remove('is-active'));
            setScene(createFormationScene(appState.activeFormation), 'Live particle formation preset');
        });
    });

    document.querySelectorAll('[data-model]').forEach((button) => {
        button.addEventListener('click', () => {
            loadBuiltInModel(button.dataset.model);
        });
    });

    prevModelBtn.addEventListener('click', () => switchBuiltInModel(-1));
    nextModelBtn.addEventListener('click', () => switchBuiltInModel(1));

    document.querySelectorAll('[data-theme]').forEach((button) => {
        button.addEventListener('click', () => {
            appState.hologramTheme = button.dataset.theme;
            document.querySelectorAll('[data-theme]').forEach((item) => item.classList.toggle('is-active', item === button));
            updateControlLabels();
            scheduleProjectActiveFormation();
        });
    });

    [particleCount, simSpeed, glowIntensity, particleSize, surfaceFlow, mousePush, hologramBrightness].forEach((input) => {
        input.addEventListener('input', () => {
            updateControlLabels();
            scheduleProjectActiveFormation();
        });
    });

    [modelRotate, showRings, showGrid].forEach((input) => {
        input.addEventListener('change', () => {
            scheduleProjectActiveFormation();
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
document.querySelector('[data-model="bd1"]')?.classList.add('is-active');
loadBuiltInModel('bd1');
requestAnimationFrame(renderFrame);

window.__spiritParticleLab = {
    loadObjText,
    loadModelData,
    loadBuiltInModel,
    parseObjVertices,
    createFormationScene
};
