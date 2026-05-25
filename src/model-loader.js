const SUPPORTED_FORMATS = new Set(['obj', 'fbx', 'glb', 'gltf', 'stl']);
const MAX_SOURCE_VERTICES = 120000;
const DEFAULT_SAMPLE_COUNT = 60000;
const MAX_SAMPLE_COUNT = 200000;

export function isSupportedModelFile(fileName) {
    return SUPPORTED_FORMATS.has(getExtension(fileName));
}

export async function loadModelVertices(file, targetCount = DEFAULT_SAMPLE_COUNT) {
    const extension = getExtension(file.name);
    if (!SUPPORTED_FORMATS.has(extension)) {
        throw new Error(`Unsupported 3D format: .${extension || 'unknown'}`);
    }

    const payload = extension === 'obj' || extension === 'gltf'
        ? await file.text()
        : await file.arrayBuffer();

    return loadModelPayload(payload, extension, file.name, targetCount);
}

export async function loadModelFromUrl(url, name = url.split('/').pop() || 'model.glb', targetCount = DEFAULT_SAMPLE_COUNT) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Could not load model: ${response.status}`);
    }
    const extension = getExtension(name) || getExtension(url);
    const payload = extension === 'obj' || extension === 'gltf'
        ? await response.text()
        : await response.arrayBuffer();
    return loadModelPayload(payload, extension, name, targetCount);
}

export function createSpiritCoreSamples(targetCount = DEFAULT_SAMPLE_COUNT) {
    const count = clampSampleCount(targetCount);
    const vertices = [];
    const normals = [];
    const golden = Math.PI * (3 - Math.sqrt(5));

    for (let i = 0; i < count; i += 1) {
        const t = i / Math.max(count - 1, 1);
        const band = i % 3;
        const angle = t * Math.PI * 6 + band * 2.1;
        const height = (t - 0.5) * 34;
        const shell = 8.4 + Math.sin(t * Math.PI * 4) * 2.2;
        const swirl = angle + Math.sin(t * Math.PI * 8) * 0.42;
        const jitter = ((i * golden) % (Math.PI * 2));
        const tube = 1.7 + Math.sin(i * 0.017) * 0.55;
        const cross = Math.sin(jitter) * tube;
        const x = Math.cos(swirl) * shell + Math.cos(swirl + Math.PI / 2) * cross;
        const y = height + Math.cos(jitter) * tube * 0.72;
        const z = Math.sin(swirl) * shell + Math.sin(swirl + Math.PI / 2) * cross;
        const normalLength = Math.hypot(x, y * 0.28, z) || 1;
        vertices.push([x, y, z]);
        normals.push([x / normalLength, (y * 0.28) / normalLength, z / normalLength]);
    }

    return {
        format: 'PROCEDURAL',
        vertices,
        normals,
        sampled: true,
        sourceVertices: vertices.length
    };
}

async function loadModelPayload(payload, extension, name, targetCount) {
    const format = extension.toUpperCase();

    if (extension === 'obj') {
        const { OBJLoader } = await import('three/addons/loaders/OBJLoader.js');
        const loader = new OBJLoader();
        return finalizeLoadedObject(loader.parse(payload), format, targetCount);
    }

    if (extension === 'fbx') {
        const { FBXLoader } = await import('three/addons/loaders/FBXLoader.js');
        const loader = new FBXLoader();
        return finalizeLoadedObject(loader.parse(payload, ''), format, targetCount);
    }

    if (extension === 'stl') {
        const THREE = await import('three');
        const { STLLoader } = await import('three/addons/loaders/STLLoader.js');
        const loader = new STLLoader();
        const mesh = new THREE.Mesh(loader.parse(payload));
        return finalizeLoadedObject(mesh, format, targetCount);
    }

    const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
    const loader = new GLTFLoader();
    const gltf = await new Promise((resolve, reject) => {
        loader.parse(payload, '', resolve, reject);
    });
    return finalizeLoadedObject(gltf.scene, extension === 'glb' ? 'GLB' : 'GLTF', targetCount, name);
}

async function finalizeLoadedObject(root, format, targetCount) {
    const samples = await sampleObjectSurface(root, targetCount);
    if (samples.vertices.length >= 3) {
        return {
            format,
            vertices: samples.vertices,
            normals: samples.normals,
            sampled: true,
            sourceVertices: extractVerticesFromObject(root).length
        };
    }

    return {
        format,
        vertices: extractVerticesFromObject(root),
        normals: [],
        sampled: false
    };
}

export function parseObjVertices(source) {
    const vertices = [];
    const lines = source.split(/\r?\n/);
    for (const line of lines) {
        if (!line.startsWith('v ')) continue;
        const parts = line.trim().split(/\s+/);
        if (parts.length < 4) continue;
        const x = Number(parts[1]);
        const y = Number(parts[2]);
        const z = Number(parts[3]);
        if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) {
            vertices.push([x, y, z]);
        }
        if (vertices.length >= MAX_SOURCE_VERTICES) break;
    }
    return vertices;
}

function extractVerticesFromObject(root) {
    const vertices = [];
    root.updateMatrixWorld?.(true);

    const visit = (child) => {
        if (!child.geometry?.attributes?.position) return;
        extractVerticesFromGeometry(child.geometry, child.matrixWorld, vertices);
    };

    if (root.traverse) root.traverse(visit);
    else visit(root);

    return vertices;
}

async function sampleObjectSurface(root, targetCount = DEFAULT_SAMPLE_COUNT) {
    const THREE = await import('three');
    const { MeshSurfaceSampler } = await import('three/addons/math/MeshSurfaceSampler.js');
    const count = clampSampleCount(targetCount);
    const meshes = collectMeshes(root, THREE);
    if (meshes.length === 0) return { vertices: [], normals: [] };

    const totalArea = meshes.reduce((sum, item) => sum + item.area, 0) || meshes.length;
    const meshCounts = meshes.map((item) => Math.max(1, Math.floor(count * (item.area / totalArea))));
    let assigned = meshCounts.reduce((sum, value) => sum + value, 0);
    while (assigned < count) {
        meshCounts[assigned % meshCounts.length] += 1;
        assigned += 1;
    }
    while (assigned > count) {
        const index = assigned % meshCounts.length;
        if (meshCounts[index] > 1) {
            meshCounts[index] -= 1;
            assigned -= 1;
        } else {
            assigned -= 1;
        }
    }
    const vertices = [];
    const normals = [];

    meshes.forEach((item, meshIndex) => {
        const meshCount = meshCounts[meshIndex];

        const sampler = new MeshSurfaceSampler(item.mesh).build();
        const point = new THREE.Vector3();
        const normal = new THREE.Vector3();
        const normalMatrix = new THREE.Matrix3().getNormalMatrix(item.mesh.matrixWorld);

        for (let i = 0; i < meshCount; i += 1) {
            sampler.sample(point, normal);
            point.applyMatrix4(item.mesh.matrixWorld);
            normal.applyMatrix3(normalMatrix).normalize();
            vertices.push([point.x, point.y, point.z]);
            normals.push([normal.x || 0, normal.y || 1, normal.z || 0]);
        }
    });

    return { vertices, normals };
}

function collectMeshes(root, THREE) {
    const meshes = [];
    root.updateMatrixWorld?.(true);
    const visit = (child) => {
        if (child.geometry?.attributes?.position) {
            if (!child.geometry.attributes.normal) child.geometry.computeVertexNormals?.();
            const area = computeGeometryArea(child.geometry, child.matrixWorld, THREE);
            if (area > 0) meshes.push({ mesh: child, area });
        }
    };
    if (root.traverse) root.traverse(visit);
    else visit(root);
    return meshes;
}

function computeGeometryArea(geometry, matrixWorld, THREE) {
    const position = geometry.attributes?.position;
    if (!position) return 0;
    const index = geometry.index;
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const c = new THREE.Vector3();
    const ab = new THREE.Vector3();
    const ac = new THREE.Vector3();
    let area = 0;
    const triangleCount = index ? Math.floor(index.count / 3) : Math.floor(position.count / 3);

    for (let tri = 0; tri < triangleCount; tri += 1) {
        const ia = index ? index.getX(tri * 3) : tri * 3;
        const ib = index ? index.getX(tri * 3 + 1) : tri * 3 + 1;
        const ic = index ? index.getX(tri * 3 + 2) : tri * 3 + 2;
        a.fromBufferAttribute(position, ia).applyMatrix4(matrixWorld);
        b.fromBufferAttribute(position, ib).applyMatrix4(matrixWorld);
        c.fromBufferAttribute(position, ic).applyMatrix4(matrixWorld);
        ab.subVectors(b, a);
        ac.subVectors(c, a);
        area += ab.cross(ac).length() * 0.5;
    }
    return area;
}

function extractVerticesFromGeometry(geometry, matrixWorld = null, target = []) {
    const position = geometry.attributes?.position;
    if (!position) return target;

    const vector = createMutableVector();
    const index = geometry.index;
    if (index) {
        for (let i = 0; i < index.count && target.length < MAX_SOURCE_VERTICES; i += 1) {
            pushVertex(target, position, index.getX(i), matrixWorld, vector);
        }
        return target;
    }

    for (let i = 0; i < position.count && target.length < MAX_SOURCE_VERTICES; i += 1) {
        pushVertex(target, position, i, matrixWorld, vector);
    }
    return target;
}

function pushVertex(vertices, position, index, matrixWorld, reusableVector) {
    const vector = reusableVector || createMutableVector();
    vector.set(position.getX(index), position.getY(index), position.getZ(index));
    vector.applyMatrix4(matrixWorld);
    vertices.push([vector.x, vector.y, vector.z]);
}

function createMutableVector() {
    return {
        x: 0,
        y: 0,
        z: 0,
        set(x, y, z) {
            this.x = x;
            this.y = y;
            this.z = z;
            return this;
        },
        applyMatrix4(matrix) {
            if (!matrix?.elements) return this;
            const e = matrix.elements;
            const x = this.x, y = this.y, z = this.z;
            const w = 1 / (e[3] * x + e[7] * y + e[11] * z + e[15]);
            this.x = (e[0] * x + e[4] * y + e[8] * z + e[12]) * w;
            this.y = (e[1] * x + e[5] * y + e[9] * z + e[13]) * w;
            this.z = (e[2] * x + e[6] * y + e[10] * z + e[14]) * w;
            return this;
        }
    };
}

function getExtension(fileName) {
    return String(fileName || '').split('.').pop().toLowerCase();
}

function clampSampleCount(value) {
    return Math.max(400, Math.min(MAX_SAMPLE_COUNT, Number(value) || DEFAULT_SAMPLE_COUNT));
}
