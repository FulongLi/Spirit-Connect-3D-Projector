'use client';

import { useMemo, useState } from 'react';
import HologramExperience from '../components/HologramExperience.jsx';
import Overlay from '../components/Overlay.jsx';
import VoiceControls from '../components/VoiceControls.jsx';

const MODEL_OPTIONS = [
  { id: 'sphere', label: 'Origin', type: 'sphere' },
  { id: 'bd1', label: 'BD-1', type: 'glb', url: '/models/bd1.glb' },
  { id: 'bb8', label: 'BB-8', type: 'glb', url: '/models/bb8.glb' },
  { id: 'spirit', label: 'Spirit', type: 'spirit' }
];

export default function Page() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [voiceState, setVoiceState] = useState({
    mode: 'idle',
    inputLevel: 0,
    outputLevel: 0,
    energy: 0
  });
  const [uploadedModel, setUploadedModel] = useState(null);
  const activeModel = useMemo(() => uploadedModel || MODEL_OPTIONS[activeIndex], [activeIndex, uploadedModel]);

  function selectModel(index) {
    setUploadedModel(null);
    setActiveIndex((index + MODEL_OPTIONS.length) % MODEL_OPTIONS.length);
  }

  function handleCommand(transcript) {
    const text = transcript.toLowerCase();
    if (text.includes('bb') || text.includes('八') || text.includes('8')) selectModel(2);
    else if (text.includes('bd') || text.includes('机器人')) selectModel(1);
    else if (text.includes('spirit') || text.includes('核心')) selectModel(3);
    else if (text.includes('sphere') || text.includes('球') || text.includes('混沌')) selectModel(0);
  }

  return (
    <main className="hologram-shell">
      <HologramExperience activeModel={activeModel} voiceState={voiceState} />
      <Overlay
        models={MODEL_OPTIONS}
        activeIndex={activeIndex}
        activeModel={activeModel}
        voiceState={voiceState}
        onSelectModel={selectModel}
        onUploadedModel={setUploadedModel}
      />
      <VoiceControls onVoiceState={setVoiceState} onCommand={handleCommand} />
    </main>
  );
}
