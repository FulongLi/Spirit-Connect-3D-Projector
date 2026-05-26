'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  ShaderMaterial
} from 'three';
import { createSphereSamples, sampleModel } from '../lib/geometry.js';

const PARTICLE_COUNT = 120000;

export default function HologramExperience({ activeModel, voiceState }) {
  return (
    <div className="canvas-wrap">
      <Canvas
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        camera={{ position: [0, 0, 6.2], fov: 48, near: 0.1, far: 120 }}
        dpr={[1, 2]}
      >
        <color attach="background" args={['#010407']} />
        <Suspense fallback={null}>
          <ParticleSystem activeModel={activeModel} voiceState={voiceState} />
          <HologramStage voiceState={voiceState} />
        </Suspense>
      </Canvas>
    </div>
  );
}

function ParticleSystem({ activeModel, voiceState }) {
  const { viewport, gl } = useThree();
  const pointsRef = useRef(null);
  const geometryRef = useRef(null);
  const materialRef = useRef(null);
  const morphRef = useRef({ progress: 1, target: 1 });
  const lastTargetRef = useRef(createSphereSamples(PARTICLE_COUNT, 1.52, 4));
  const [buffers, setBuffers] = useState(() => {
    const sphere = createSphereSamples(PARTICLE_COUNT, 1.52, 4);
    const seeds = createSeeds(PARTICLE_COUNT);
    return {
      source: sphere.positions,
      via: sphere.positions,
      target: sphere.positions,
      targetNormal: sphere.normals,
      seed: seeds,
      label: 'Origin'
    };
  });

  const material = useMemo(() => new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uProgress: { value: 1 },
      uInput: { value: 0 },
      uOutput: { value: 0 },
      uEnergy: { value: 0 },
      uPixelRatio: { value: gl.getPixelRatio() },
      uColor: { value: new Color('#d1e3ff') },
      uAccent: { value: new Color('#99c4f0') }
    },
    vertexShader,
    fragmentShader
  }), [gl]);

  useEffect(() => {
    let cancelled = false;
    const source = lastTargetRef.current.positions || lastTargetRef.current;
    const via = createSphereSamples(PARTICLE_COUNT, 1.42, Date.now() % 97);

    sampleModel(activeModel, PARTICLE_COUNT).then((target) => {
      if (cancelled) return;
      setBuffers((current) => ({
        source: source.slice ? source.slice() : new Float32Array(source),
        via: via.positions,
        target: target.positions,
        targetNormal: target.normals,
        seed: current.seed,
        label: activeModel.label
      }));
      lastTargetRef.current = target;
      morphRef.current.progress = 0;
      morphRef.current.target = 1;
    }).catch((error) => {
      console.warn('Model sampling failed.', error);
    });

    return () => {
      cancelled = true;
    };
  }, [activeModel]);

  useEffect(() => {
    if (!geometryRef.current) return;
    geometryRef.current.setAttribute('position', new BufferAttribute(buffers.source, 3));
    geometryRef.current.setAttribute('viaPosition', new BufferAttribute(buffers.via, 3));
    geometryRef.current.setAttribute('targetPosition', new BufferAttribute(buffers.target, 3));
    geometryRef.current.setAttribute('targetNormal', new BufferAttribute(buffers.targetNormal, 3));
    geometryRef.current.setAttribute('particleSeed', new BufferAttribute(buffers.seed, 1));
    geometryRef.current.computeBoundingSphere();
  }, [buffers]);

  useFrame((state, delta) => {
    const materialInstance = materialRef.current;
    if (!materialInstance) return;
    morphRef.current.progress += (morphRef.current.target - morphRef.current.progress) * Math.min(1, delta * 1.45);
    materialInstance.uniforms.uTime.value = state.clock.elapsedTime;
    materialInstance.uniforms.uProgress.value = morphRef.current.progress;
    materialInstance.uniforms.uInput.value += ((voiceState.inputLevel || 0) - materialInstance.uniforms.uInput.value) * 0.12;
    materialInstance.uniforms.uOutput.value += ((voiceState.outputLevel || 0) - materialInstance.uniforms.uOutput.value) * 0.16;
    materialInstance.uniforms.uEnergy.value += ((voiceState.energy || 0) - materialInstance.uniforms.uEnergy.value) * 0.1;
    materialInstance.uniforms.uPixelRatio.value = gl.getPixelRatio();

    if (pointsRef.current) {
      pointsRef.current.rotation.y += delta * (0.11 + materialInstance.uniforms.uEnergy.value * 0.06);
      pointsRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.19) * 0.05;
      pointsRef.current.scale.setScalar(Math.min(viewport.width, viewport.height) < 5 ? 0.82 : 1);
    }
  });

  return (
    <points ref={pointsRef} renderOrder={2}>
      <bufferGeometry ref={geometryRef} />
      <primitive ref={materialRef} object={material} attach="material" />
    </points>
  );
}

function HologramStage({ voiceState }) {
  const groupRef = useRef(null);
  const ringARef = useRef(null);
  const ringBRef = useRef(null);
  const ringCRef = useRef(null);
  const dots = useMemo(() => createGridDots(58, 36, 42, 27), []);

  useFrame((state, delta) => {
    const energy = voiceState.energy || 0;
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.025;
    if (ringARef.current) ringARef.current.rotation.z += delta * (0.12 + energy * 0.35);
    if (ringBRef.current) ringBRef.current.rotation.z -= delta * (0.09 + energy * 0.25);
    if (ringCRef.current) ringCRef.current.rotation.x = Math.PI / 2 + Math.sin(state.clock.elapsedTime * 0.6) * 0.08;
  });

  return (
    <group ref={groupRef} renderOrder={1}>
      <points position={[0, -2.12, -0.4]} rotation={[-Math.PI / 2.4, 0, 0]}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[dots, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.018} transparent opacity={0.23} color="#c8d4de" depthWrite={false} blending={AdditiveBlending} />
      </points>

      <mesh>
        <cylinderGeometry args={[1.98, 1.98, 3.95, 96, 1, true]} />
        <meshBasicMaterial color="#99c4f0" transparent opacity={0.08} wireframe side={DoubleSide} depthWrite={false} blending={AdditiveBlending} />
      </mesh>

      <mesh ref={ringARef} position={[0, 1.98, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.98, 0.008, 8, 160]} />
        <meshBasicMaterial color="#d1e3ff" transparent opacity={0.55} depthWrite={false} blending={AdditiveBlending} />
      </mesh>
      <mesh ref={ringBRef} position={[0, -1.98, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.98, 0.008, 8, 160]} />
        <meshBasicMaterial color="#809fde" transparent opacity={0.42} depthWrite={false} blending={AdditiveBlending} />
      </mesh>
      <mesh ref={ringCRef} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2.42, 0.006, 8, 180]} />
        <meshBasicMaterial color="#99c4f0" transparent opacity={0.18} depthWrite={false} blending={AdditiveBlending} />
      </mesh>
    </group>
  );
}

function createSeeds(count) {
  const values = new Float32Array(count);
  for (let i = 0; i < count; i += 1) values[i] = fract(Math.sin(i * 12.9898) * 43758.5453);
  return values;
}

function createGridDots(width, depth, cols, rows) {
  const values = new Float32Array(cols * rows * 3);
  let index = 0;
  for (let z = 0; z < rows; z += 1) {
    for (let x = 0; x < cols; x += 1) {
      values[index++] = (x / (cols - 1) - 0.5) * width;
      values[index++] = (z / (rows - 1) - 0.5) * depth;
      values[index++] = 0;
    }
  }
  return values;
}

function fract(value) {
  return value - Math.floor(value);
}

const vertexShader = `
attribute vec3 targetPosition;
attribute vec3 viaPosition;
attribute vec3 targetNormal;
attribute float particleSeed;

uniform float uTime;
uniform float uProgress;
uniform float uInput;
uniform float uOutput;
uniform float uEnergy;
uniform float uPixelRatio;

varying float vAlpha;
varying float vGlow;

float easeInOut(float x) {
  return x * x * (3.0 - 2.0 * x);
}

float hash(float n) {
  return fract(sin(n) * 43758.5453123);
}

void main() {
  float delay = particleSeed * 0.18;
  float p = clamp((uProgress - delay) / max(0.001, 1.0 - delay), 0.0, 1.0);
  p = easeInOut(p);

  float split = 0.48;
  vec3 morphed;
  if (p < split) {
    morphed = mix(position, viaPosition, easeInOut(p / split));
  } else {
    morphed = mix(viaPosition, targetPosition, easeInOut((p - split) / (1.0 - split)));
  }

  float burst = sin(p * 3.14159265);
  float n1 = sin(dot(morphed, vec3(12.9, 78.2, 37.7)) + particleSeed * 33.0 + uTime * 0.45);
  float n2 = cos(dot(morphed, vec3(41.4, 11.5, 91.1)) + particleSeed * 19.0 + uTime * 0.32);
  float n3 = sin(dot(morphed, vec3(16.8, 58.3, 22.2)) + particleSeed * 27.0 + uTime * 0.26);
  vec3 scatter = normalize(vec3(n1, n2, n3) + 0.001);

  float voiceWave = sin(length(morphed.xz) * 8.0 - uTime * 8.0 + particleSeed * 6.28318);
  float breath = sin(uTime * 1.15 + particleSeed * 6.28318) * 0.025;
  vec3 normalish = normalize(mix(normalize(morphed + 0.001), targetNormal, 0.55));
  vec3 finalPos = morphed;
  finalPos += scatter * burst * (0.42 + uEnergy * 0.9);
  finalPos += normalish * (breath + uInput * 0.055 + uOutput * voiceWave * 0.11);

  vec4 mvPosition = modelViewMatrix * vec4(finalPos, 1.0);
  float baseSize = 2.6 + burst * 1.7 + uOutput * 4.0 + uInput * 1.4;
  gl_PointSize = baseSize * uPixelRatio * (3.7 / max(1.0, -mvPosition.z));
  gl_Position = projectionMatrix * mvPosition;

  vGlow = clamp(0.36 + burst * 0.45 + uOutput * 0.55 + hash(particleSeed * 81.7) * 0.25, 0.0, 1.35);
  vAlpha = clamp(0.45 + p * 0.28 + burst * 0.2 + uEnergy * 0.18, 0.0, 1.0);
}
`;

const fragmentShader = `
uniform vec3 uColor;
uniform vec3 uAccent;

varying float vAlpha;
varying float vGlow;

void main() {
  vec2 c = gl_PointCoord - vec2(0.5);
  float d = length(c);
  float core = smoothstep(0.5, 0.04, d);
  float halo = smoothstep(0.5, 0.0, d) * 0.42;
  vec3 color = mix(uAccent, uColor, core);
  gl_FragColor = vec4(color * (core + halo + vGlow), (core + halo) * vAlpha);
}
`;
