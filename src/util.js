// Shared utilities for Spirit Connect Projector.
// Pure functions only — no DOM, no Three.js, no side effects.

export function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

export function hashText(text) {
    let hash = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return Math.abs(hash);
}

export function seededRandom(seed) {
    let value = seed || 1;
    return () => {
        value = Math.imul(48271, value) % 2147483647;
        return (value & 2147483647) / 2147483647;
    };
}

export function hexWithAlpha(hex, alpha) {
    const clean = hex.replace('#', '');
    const value = clean.length === 3 ? clean.split('').map((part) => part + part).join('') : clean;
    const r = parseInt(value.slice(0, 2), 16);
    const g = parseInt(value.slice(2, 4), 16);
    const b = parseInt(value.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${clamp(alpha, 0, 1)})`;
}

// --- structured samplers ------------------------------------------------
// These exist to reduce the "random scatter" feel — particles land on a
// deterministic lattice instead of a noisy cloud, which makes shapes read.

/** Fibonacci sphere: low-discrepancy points evenly covering a unit sphere. */
export function fibonacciSphere(count, radius = 1, offset = 0.5) {
    const points = new Array(count);
    const phi = Math.PI * (Math.sqrt(5) - 1); // golden angle
    for (let i = 0; i < count; i += 1) {
        const y = 1 - ((i + offset) / count) * 2; // y in [-1, 1]
        const r = Math.sqrt(1 - y * y);
        const theta = phi * i;
        points[i] = [
            Math.cos(theta) * r * radius,
            y * radius,
            Math.sin(theta) * r * radius
        ];
    }
    return points;
}

/** Fibonacci disk: low-discrepancy points evenly on a unit disk. */
export function fibonacciDisk(count, radius = 1, offset = 0.5) {
    const points = new Array(count);
    const phi = Math.PI * (Math.sqrt(5) - 1);
    for (let i = 0; i < count; i += 1) {
        const r = Math.sqrt((i + offset) / count) * radius;
        const theta = phi * i;
        points[i] = [Math.cos(theta) * r, Math.sin(theta) * r];
    }
    return points;
}

/** Uniform points inside a sphere by inverse CDF on radius. */
export function structuredSphereVolume(count, radius, jitter = 0) {
    const surface = fibonacciSphere(count, 1);
    const points = new Array(count);
    for (let i = 0; i < count; i += 1) {
        // Spread points along radial shells while keeping angular distribution.
        const shell = Math.cbrt((i + 0.5) / count);
        const j = jitter ? (Math.sin(i * 12.9898) * 43758.5453) % 1 : 0;
        const r = radius * (shell + j * jitter * 0.05);
        const [x, y, z] = surface[i];
        points[i] = [x * r, y * r, z * r];
    }
    return points;
}
