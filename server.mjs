import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const port = Number(process.env.PORT || 5173);
const realtimeModel = process.env.OPENAI_REALTIME_MODEL || 'gpt-realtime';

const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.glb': 'model/gltf-binary',
    '.gltf': 'model/gltf+json',
    '.png': 'image/png',
    '.svg': 'image/svg+xml'
};

createServer(async (request, response) => {
    try {
        const url = new URL(request.url, `http://${request.headers.host}`);
        if (url.pathname === '/api/realtime-sdp') {
            await createRealtimeCall(request, response);
            return;
        }
        serveStatic(url.pathname, response);
    } catch (error) {
        console.error(error);
        response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        response.end('Internal server error');
    }
}).listen(port, () => {
    console.log(`Spirit Connect server running at http://localhost:${port}`);
});

async function createRealtimeCall(request, response) {
    if (request.method !== 'POST') {
        response.writeHead(405, { Allow: 'POST' });
        response.end();
        return;
    }
    if (!process.env.OPENAI_API_KEY) {
        response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        response.end('Missing OPENAI_API_KEY. Run: OPENAI_API_KEY=your_key node server.mjs');
        return;
    }

    const sessionConfig = {
        type: 'realtime',
        model: realtimeModel,
        instructions: 'You are a concise Chinese-speaking voice companion inside a holographic particle avatar.',
        audio: {
            input: {
                transcription: { model: 'gpt-4o-mini-transcribe' },
                turn_detection: { type: 'server_vad' }
            },
            output: {
                voice: 'marin'
            }
        }
    };
    const formData = new FormData();
    formData.set('sdp', await readRequestBody(request));
    formData.set('session', JSON.stringify(sessionConfig));

    const upstream = await fetch('https://api.openai.com/v1/realtime/calls', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: formData
    });

    const body = await upstream.text();
    response.writeHead(upstream.status, {
        'Content-Type': upstream.headers.get('content-type') || 'application/sdp'
    });
    response.end(body);
}

function readRequestBody(request) {
    return new Promise((resolve, reject) => {
        let body = '';
        request.setEncoding('utf8');
        request.on('data', (chunk) => {
            body += chunk;
        });
        request.on('end', () => resolve(body));
        request.on('error', reject);
    });
}

function serveStatic(pathname, response) {
    const cleanPath = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '');
    let filePath = join(root, cleanPath === '/' ? 'index.html' : cleanPath);
    if (!filePath.startsWith(root)) {
        response.writeHead(403);
        response.end('Forbidden');
        return;
    }
    if (existsSync(filePath) && statSync(filePath).isDirectory()) {
        filePath = join(filePath, 'index.html');
    }
    if (!existsSync(filePath)) {
        response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        response.end('Not found');
        return;
    }

    const extension = extname(filePath);
    response.writeHead(200, {
        'Content-Type': mimeTypes[extension] || 'application/octet-stream'
    });
    createReadStream(filePath).pipe(response);
}
