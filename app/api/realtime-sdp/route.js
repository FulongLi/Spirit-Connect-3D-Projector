export const runtime = 'nodejs';

const realtimeModel = process.env.OPENAI_REALTIME_MODEL || 'gpt-realtime';

export async function POST(request) {
  if (!process.env.OPENAI_API_KEY) {
    return new Response('Missing OPENAI_API_KEY. Run: OPENAI_API_KEY=your_key_here npm run dev', {
      status: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }

  const sessionConfig = {
    type: 'realtime',
    model: realtimeModel,
    instructions: 'You are a concise Chinese-speaking voice companion inside a holographic particle avatar. React naturally and keep responses short.',
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
  formData.set('sdp', await request.text());
  formData.set('session', JSON.stringify(sessionConfig));

  const upstream = await fetch('https://api.openai.com/v1/realtime/calls', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: formData
  });

  return new Response(await upstream.text(), {
    status: upstream.status,
    headers: {
      'Content-Type': upstream.headers.get('content-type') || 'application/sdp'
    }
  });
}
