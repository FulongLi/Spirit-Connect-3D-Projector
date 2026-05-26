'use client';

import { useEffect, useRef, useState } from 'react';
import { RealtimeVoice } from '../lib/realtimeVoice.js';

export default function VoiceControls({ onVoiceState, onCommand }) {
  const agentRef = useRef(null);
  const [status, setStatus] = useState('OFFLINE');
  const [error, setError] = useState('');
  const connected = status !== 'OFFLINE' && status !== 'ERROR';

  useEffect(() => () => agentRef.current?.stop(), []);

  async function toggleVoice() {
    setError('');
    if (agentRef.current?.connected) {
      agentRef.current.stop();
      return;
    }

    const agent = new RealtimeVoice({
      onVoiceState,
      onCommand,
      onStatus: setStatus
    });
    agentRef.current = agent;
    try {
      await agent.start();
    } catch (eventError) {
      console.warn('Voice start failed.', eventError);
      agent.stop();
      setStatus('ERROR');
      setError(readableError(eventError));
    }
  }

  return (
    <section className={`voice-dock ${connected ? 'is-live' : ''}`}>
      <button type="button" onClick={toggleVoice}>
        <span>{connected ? 'Stop' : 'Talk'}</span>
        <small>{error || status}</small>
      </button>
      <div className="voice-bars" aria-hidden="true">
        <span /><span /><span /><span /><span />
      </div>
    </section>
  );
}

function readableError(error) {
  const message = String(error?.message || error || '');
  if (message.includes('500')) return 'Set OPENAI_API_KEY, then run npm run dev.';
  if (message.includes('Permission') || message.includes('microphone')) return 'Microphone permission was blocked.';
  return message || 'Voice agent could not start.';
}
