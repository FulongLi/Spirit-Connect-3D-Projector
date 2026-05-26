import {
  Box3,
  Matrix3,
  Mesh,
  Object3D,
  Vector3
} from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js';

const cache = new Map();
const supportedFormats = new Set(['glb', 'gltf', 'obj', 'fbx', 'stl']);

export function createSphereSamples(count, radius = 1.55, seed = 0) {
  const positions = new Float32Array(count * 3);
  const normals = new Float32Array(count * 3);
  const golden = Math.PI * (3 - Math.sqrt(5));
  const phase = seed * 0.071;

  for (let i = 0; i < count; i += 1) {
    const y = 1 - (i / Math.max(count - 1, 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * i + phase;
    const x = Math.cos(theta) * r;
    const z = Math.sin(theta) * r;
    const base = i * 3;
    const breathing = 1 + Math.sin(theta * 2.7) * 0.018;
    positions[base] = x * radius * breathing;
    positions[base + 1] = y * radius * breathing;
    positions[base + 2] = z * radius * breathing;
    normals[base] = x;
    normals[base + 1] = y;
    normals[base + 2] = z;
  }

  return { positions, normals };
}

export function createSpiritSamples(count) {
  const positions = new Float32Array(count * 3);
  const normals = new Float32Array(count * 3);
  const golden = Math.PI * (3 - Math.sqrt(5));

  for (let i = 0; i < count; i += 1) {
    const t = i / Math.max(count - 1, 1);
    const band = i % 3;
    const angle = t * Math.PI * 7 + band * 2.1;
    const height = (t - 0.5) * 3.2;
    const shell = 0.78 + Math.sin(t * Math.PI * 4) * 0.22;
    const jitter = (i * golden) % (Math.PI * 2);
    const tube = 0.22 + Math.sin(i * 0.017) * 0.07;
    const swirl = angle + Math.sin(t * Math.PI * 8) * 0.42;
    const cross = Math.sin(jitter) * tube;
    const x = Math.cos(swirl) * shell + Math.cos(swirl + Math.PI / 2) * cross;
    const y = height + Math.cos(jitter) * tube * 0.72;
    const z = Math.sin(swirl) * shell + Math.sin(swirl + Math.PI / 2) * cross;
    const length = Math.hypot(x, y * 0.28, z) || 1;
    const base = i * 3;
    positions[base] = x;
    positions[base + 1] = y;
    positions[base + 2] = z;
    normals[base] = x / length;
    normals[base + 1] = (y * 0.28) / length;
    normals[base + 2] = z / length;
  }

  return { positions, normals };
}

export async function sampleModel(model, count) {
  if (model.type === 'sphere') return createSphereSamples(count, 1.52, 2);
  if (model.type === 'spirit') return createSpiritSamples(count);
  if (model.file) return sampleFile(model.file, count);
  if (!model.url) return createSphereSamples(count, 1.52, 2);

  const key = `${model.url}:${count}`;
  if (cache.has(key)) return cache.get(key);
  const data = await loadUrl(model.url, count);
  cache.set(key, data);
  return data;
}

export async function sampleFile(file, count) {
  const extension = getExtension(file.name);
  if (!supportedFormats.has(extension)) throw new Error(`Unsupported 3D format: .${extension}`);
  const payload = extension === 'obj' || extension === 'gltf'
    ? await file.text()
    : await file.arrayBuffer();
  return samplePayload(payload, extension, count);
}

async function loadUrl(url, count) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load model: ${response.status}`);
  const extension = getExtension(url);
  const payload = extension === 'obj' || extension === 'gltf'
    ? await response.text()
    : await response.arrayBuffer();
  return samplePayload(payload, extension, count);
}

async function samplePayload(payload, extension, count) {
  if (extension === 'obj') return sampleObject(new OBJLoader().parse(payload), count);
  if (extension === 'fbx') return sampleObject(new FBXLoader().parse(payload, ''), count);
  if (extension === 'stl') return sampleObject(new Mesh(new STLLoader().parse(payload)), count);

  const gltf = await new Promise((resolve, reject) => {
    new GLTFLoader().parse(payload, '', resolve, reject);
  });
  return sampleObject(gltf.scene, count);
}

function sampleObject(root, count) {
  normalizeObject(root);
  const meshes = [];
  root.updateMatrixWorld(true);
  root.traverse?.((child) => {
    if (child.geometry?.attributes?.position) {
      if (!child.geometry.attributes.normal) child.geometry.computeVertexNormals?.();
      meshes.push(child);
    }
  });

  if (meshes.length === 0 && root.geometry?.attributes?.position) meshes.push(root);
  if (meshes.length === 0) return createSphereSamples(count, 1.52, 3);

  const positions = new Float32Array(count * 3);
  const normals = new Float32Array(count * 3);
  const point = new Vector3();
  const normal = new Vector3();
  let filled = 0;
  const perMesh = Math.floor(count / meshes.length);

  meshes.forEach((mesh, meshIndex) => {
    const meshCount = meshIndex === meshes.length - 1 ? count - filled : perMesh;
    const sampler = new MeshSurfaceSampler(mesh).build();
    const normalMatrix = new Matrix3().getNormalMatrix(mesh.matrixWorld);

    for (let i = 0; i < meshCount; i += 1) {
      sampler.sample(point, normal);
      point.applyMatrix4(mesh.matrixWorld);
      normal.applyMatrix3(normalMatrix).normalize();
      const base = (filled + i) * 3;
      positions[base] = point.x;
      positions[base + 1] = point.y;
      positions[base + 2] = point.z;
      normals[base] = normal.x || 0;
      normals[base + 1] = normal.y || 1;
      normals[base + 2] = normal.z || 0;
    }
    filled += meshCount;
  });

  return { positions, normals };
}

function normalizeObject(root) {
  if (!(root instanceof Object3D)) return;
  root.updateMatrixWorld(true);
  const box = new Box3().setFromObject(root);
  const center = new Vector3();
  const size = new Vector3();
  box.getCenter(center);
  box.getSize(size);
  root.position.sub(center);
  root.updateMatrixWorld(true);

  const maxDim = Math.max(size.x, size.y, size.z);
  root.scale.setScalar(maxDim > 0 ? 3.2 / maxDim : 1);
  root.updateMatrixWorld(true);

  const normalizedBox = new Box3().setFromObject(root);
  root.position.y -= (normalizedBox.min.y + normalizedBox.max.y) / 2;
  root.updateMatrixWorld(true);
}

function getExtension(name) {
  return String(name || '').split('?')[0].split('.').pop().toLowerCase();
}
