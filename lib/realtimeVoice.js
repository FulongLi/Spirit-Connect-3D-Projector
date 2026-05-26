const SDP_ENDPOINT = '/api/realtime-sdp';

export class RealtimeVoice {
  constructor({ onVoiceState, onCommand, onStatus }) {
    this.onVoiceState = onVoiceState;
    this.onCommand = onCommand;
    this.onStatus = onStatus;
    this.peer = null;
    this.channel = null;
    this.localStream = null;
    this.remoteAudio = null;
    this.audioContext = null;
    this.inputAnalyser = null;
    this.outputAnalyser = null;
    this.meterFrame = null;
    this.connected = false;
  }

  async start() {
    this.onStatus?.('CONNECTING');
    this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.peer = new RTCPeerConnection();
    this.localStream.getTracks().forEach((track) => this.peer.addTrack(track, this.localStream));

    this.remoteAudio = new Audio();
    this.remoteAudio.autoplay = true;
    this.peer.ontrack = (event) => {
      this.remoteAudio.srcObject = event.streams[0];
      this.setupMeters(event.streams[0]);
    };

    this.channel = this.peer.createDataChannel('oai-events');
    this.channel.addEventListener('open', () => {
      this.connected = true;
      this.onStatus?.('LISTENING');
      this.onVoiceState?.({ mode: 'listening' });
      this.sendSessionUpdate();
    });
    this.channel.addEventListener('message', (event) => this.handleRealtimeEvent(event));

    const offer = await this.peer.createOffer();
    await this.peer.setLocalDescription(offer);

    const response = await fetch(SDP_ENDPOINT, {
      method: 'POST',
      body: offer.sdp,
      headers: { 'Content-Type': 'application/sdp' }
    });
    if (!response.ok) throw new Error(`Realtime SDP failed: ${response.status}`);
    await this.peer.setRemoteDescription({ type: 'answer', sdp: await response.text() });
    this.startMeters();
  }

  stop() {
    this.connected = false;
    window.cancelAnimationFrame(this.meterFrame);
    this.channel?.close();
    this.peer?.close();
    this.localStream?.getTracks().forEach((track) => track.stop());
    this.remoteAudio?.pause();
    this.channel = null;
    this.peer = null;
    this.localStream = null;
    this.remoteAudio = null;
    this.inputAnalyser = null;
    this.outputAnalyser = null;
    this.meterFrame = null;
    this.onStatus?.('OFFLINE');
    this.onVoiceState?.({ mode: 'idle', inputLevel: 0, outputLevel: 0, energy: 0 });
  }

  sendSessionUpdate() {
    this.send({
      type: 'session.update',
      session: {
        instructions: [
          'You are the voice of a holographic digital companion inside a particle avatar.',
          'Speak concise natural Chinese unless the user asks otherwise.',
          'When the user asks for a visual form, describe it briefly and let the interface switch forms.'
        ].join(' '),
        audio: {
          input: {
            transcription: { model: 'gpt-4o-mini-transcribe' },
            turn_detection: { type: 'server_vad' }
          },
          output: { voice: 'marin' }
        }
      }
    });
  }

  handleRealtimeEvent(event) {
    let payload;
    try {
      payload = JSON.parse(event.data);
    } catch {
      return;
    }

    if (payload.type === 'input_audio_buffer.speech_started') {
      this.onStatus?.('LISTENING');
      this.onVoiceState?.({ mode: 'listening' });
    }
    if (payload.type === 'input_audio_buffer.speech_stopped') {
      this.onStatus?.('THINKING');
      this.onVoiceState?.({ mode: 'thinking' });
    }
    if (payload.type === 'response.audio.delta') {
      this.onStatus?.('SPEAKING');
      this.onVoiceState?.({ mode: 'speaking' });
    }
    if (payload.type === 'response.done') {
      this.onStatus?.('LISTENING');
      this.onVoiceState?.({ mode: 'listening' });
    }
    if (payload.type === 'conversation.item.input_audio_transcription.completed' && payload.transcript) {
      this.onCommand?.(payload.transcript);
    }
    if (payload.type === 'error') this.onStatus?.('ERROR');
  }

  send(payload) {
    if (this.channel?.readyState === 'open') this.channel.send(JSON.stringify(payload));
  }

  setupMeters(remoteStream) {
    this.audioContext ||= new AudioContext();
    if (this.localStream && !this.inputAnalyser) {
      const inputSource = this.audioContext.createMediaStreamSource(this.localStream);
      this.inputAnalyser = this.audioContext.createAnalyser();
      this.inputAnalyser.fftSize = 512;
      inputSource.connect(this.inputAnalyser);
    }
    if (remoteStream && !this.outputAnalyser) {
      const outputSource = this.audioContext.createMediaStreamSource(remoteStream);
      this.outputAnalyser = this.audioContext.createAnalyser();
      this.outputAnalyser.fftSize = 512;
      outputSource.connect(this.outputAnalyser);
    }
  }

  startMeters() {
    this.setupMeters(null);
    const inputBuffer = new Uint8Array(256);
    const outputBuffer = new Uint8Array(256);
    const tick = () => {
      const inputLevel = analyserLevel(this.inputAnalyser, inputBuffer);
      const outputLevel = analyserLevel(this.outputAnalyser, outputBuffer);
      this.onVoiceState?.({ inputLevel, outputLevel, energy: Math.max(inputLevel, outputLevel) });
      this.meterFrame = window.requestAnimationFrame(tick);
    };
    tick();
  }
}

function analyserLevel(analyser, buffer) {
  if (!analyser) return 0;
  analyser.getByteTimeDomainData(buffer);
  let sum = 0;
  for (let i = 0; i < buffer.length; i += 1) {
    const centered = (buffer[i] - 128) / 128;
    sum += centered * centered;
  }
  return Math.min(Math.sqrt(sum / buffer.length) * 4, 1);
}
