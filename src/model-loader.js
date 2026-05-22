const SUPPORTED_FORMATS = new Set(['obj', 'fbx', 'glb', 'gltf', 'stl']);
const MAX_SOURCE_VERTICES = 120000;

export function isSupportedModelFile(fileName) {
    return SUPPORTED_FORMATS.has(getExtension(fileName));
}

export async function loadModelVertices(file) {
    const extension = getExtension(file.name);
    if (!SUPPORTED_FORMATS.has(extension)) {
        throw new Error(`Unsupported 3D format: .${extension || 'unknown'}`);
    }

    if (extension === 'obj') {
        return {
            format: 'OBJ',
            vertices: parseObjVertices(await file.text())
        };
    }

    if (extension === 'fbx') {
        const { FBXLoader } = await import('three/addons/loaders/FBXLoader.js');
        const loader = new FBXLoader();
        const object = loader.parse(await file.arrayBuffer(), '');
        return {
            format: 'FBX',
            vertices: extractVerticesFromObject(object)
        };
    }

    if (extension === 'stl') {
        const { STLLoader } = await import('three/addons/loaders/STLLoader.js');
        const loader = new STLLoader();
        return {
            format: 'STL',
            vertices: extractVerticesFromGeometry(loader.parse(await file.arrayBuffer()))
        };
    }

    const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
    const loader = new GLTFLoader();
    const payload = extension === 'gltf' ? await file.text() : await file.arrayBuffer();
    const gltf = await new Promise((resolve, reject) => {
        loader.parse(payload, '', resolve, reject);
    });

    return {
        format: extension === 'glb' ? 'GLB' : 'GLTF',
        vertices: extractVerticesFromObject(gltf.scene)
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

    root.traverse?.((child) => {
        if (!child.geometry?.attributes?.position) return;
        extractVerticesFromGeometry(child.geometry, child.matrixWorld, vertices);
    });

    return vertices;
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
