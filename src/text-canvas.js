// Text-to-particles helper.
// Rasterises a string into a hidden canvas, then samples bright pixels and
// turns them into evenly-spaced points so a Three.js Points object can show
// glowing particle text.

import { clamp } from './util.js';

/**
 * Sample `text` and return an array of [x, y, z] triplets centered at origin.
 *
 * @param {object} opts
 * @param {string} opts.text                  - the string to display
 * @param {string} [opts.font]                - CSS font shorthand
 * @param {number} [opts.targetCount=4000]    - rough number of particles desired
 * @param {number} [opts.height=220]          - rasterization height in px
 * @param {number} [opts.scale=0.05]          - world units per pixel
 * @param {number} [opts.depthJitter=0.6]     - random ±z spread to give some thickness
 */
export function sampleTextToPoints({
    text,
    font = 'bold 200px Inter, "Segoe UI", system-ui, sans-serif',
    targetCount = 4000,
    height = 220,
    scale = 0.05,
    depthJitter = 0.6
}) {
    const safeText = String(text || '').slice(0, 32) || '·';
    const canvas = document.createElement('canvas');
    const measure = canvas.getContext('2d');
    measure.font = font;
    const metrics = measure.measureText(safeText);
    const padding = Math.round(height * 0.2);
    const width = Math.ceil(metrics.width + padding * 2);
    const fullHeight = Math.ceil(height + padding * 2);
    canvas.width = width;
    canvas.height = fullHeight;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, fullHeight);
    ctx.font = font;
    ctx.fillStyle = '#fff';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillText(safeText, width / 2, fullHeight / 2);

    const pixels = ctx.getImageData(0, 0, width, fullHeight).data;
    const sampleCount = clamp(targetCount, 400, 12000);
    const step = Math.max(1, Math.floor(Math.sqrt((width * fullHeight) / sampleCount)));
    const points = [];

    for (let y = 0; y < fullHeight; y += step) {
        for (let x = 0; x < width; x += step) {
            const idx = (y * width + x) * 4;
            // Threshold on red channel (background is black, text is white).
            if (pixels[idx] > 96) {
                const cx = (x - width / 2) * scale;
                const cy = -(y - fullHeight / 2) * scale;
                const cz = (Math.random() - 0.5) * depthJitter;
                points.push([cx, cy, cz]);
            }
        }
    }

    return points;
}
