const SDP_ENDPOINT = '/api/realtime-sdp';

export class VoiceAgent {
    constructor({
        talkBtn,
        talkLabel,
        voiceHint,
        voiceStatus,
        voiceMeterFill,
        onVoiceState,
        onCommand
    }) {
        this.talkBtn = talkBtn;
        this.talkLabel = talkLabel;
        this.voiceHint = voiceHint;
        this.voiceStatus = voiceStatus;
        this.voiceMeterFill = voiceMeterFill;
        this.onVoiceState = onVoiceState;
        this.onCommand = onCommand;
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

    bind() {
        if (!this.talkBtn) return;
        this.talkBtn.addEventListener('click', () => {
            if (this.connected) this.stop();
            else this.start();
        });
    }

    async start() {
        try {
            this.setUi('CONNECTING', 'Connecting...', 'Requesting microphone and realtime session.');
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
                this.talkBtn.classList.add('is-live');
                this.setUi('LISTENING', 'Stop', 'Listening. Speak normally.');
                this.sendSessionUpdate();
                this.onVoiceState?.({ mode: 'listening' });
            });
            this.channel.addEventListener('message', (event) => this.handleRealtimeEvent(event));

            const offer = await this.peer.createOffer();
            await this.peer.setLocalDescription(offer);

            const sdpResponse = await fetch(SDP_ENDPOINT, {
                method: 'POST',
                body: offer.sdp,
                headers: {
                    'Content-Type': 'application/sdp'
                }
            });
            if (!sdpResponse.ok) {
                throw new Error(`Realtime SDP failed: ${sdpResponse.status}`);
            }
            await this.peer.setRemoteDescription({
                type: 'answer',
                sdp: await sdpResponse.text()
            });
            this.startMeters();
        } catch (error) {
            console.warn('Voice agent failed.', error);
            this.stop();
            this.setUi('OFFLINE', 'Talk', readableError(error));
        }
    }

    stop() {
        this.connected = false;
        window.cancelAnimationFrame(this.meterFrame);
        this.meterFrame = null;
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
        this.talkBtn?.classList.remove('is-live');
        this.updateMeter(0);
        this.onVoiceState?.({ mode: 'idle', inputLevel: 0, outputLevel: 0, energy: 0 });
        this.setUi('OFFLINE', 'Talk', 'Voice agent is stopped.');
    }

    sendSessionUpdate() {
        this.send({
            type: 'session.update',
            session: {
                instructions: [
                    'You are the voice of a holographic digital companion inside a Three.js particle model.',
                    'Speak in concise, natural Chinese unless the user asks otherwise.',
                    'You can react to simple commands such as switching to BD-1, BB-8, Spirit Core, changing colors, or changing particle density.',
                    'When the user asks to control the hologram, say briefly what you are doing.'
                ].join(' '),
                audio: {
                    input: {
                        transcription: { model: 'gpt-4o-mini-transcribe' },
                        turn_detection: { type: 'server_vad' }
                    },
                    output: {
                        voice: 'alloy'
                    }
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
            this.setUi('LISTENING', 'Stop', 'I can hear you.');
            this.onVoiceState?.({ mode: 'listening' });
        }
        if (payload.type === 'input_audio_buffer.speech_stopped') {
            this.setUi('THINKING', 'Stop', 'Thinking...');
            this.onVoiceState?.({ mode: 'thinking' });
        }
        if (payload.type === 'response.audio.delta') {
            this.setUi('SPEAKING', 'Stop', 'Speaking.');
            this.onVoiceState?.({ mode: 'speaking' });
        }
        if (payload.type === 'response.done') {
            this.setUi('LISTENING', 'Stop', 'Listening. Speak normally.');
            this.onVoiceState?.({ mode: 'listening' });
        }
        if (payload.type === 'conversation.item.input_audio_transcription.completed' && payload.transcript) {
            this.onCommand?.(payload.transcript);
        }
        if (payload.type === 'error') {
            this.setUi('ERROR', 'Stop', payload.error?.message || 'Realtime error.');
        }
    }

    send(payload) {
        if (this.channel?.readyState === 'open') {
            this.channel.send(JSON.stringify(payload));
        }
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
            const energy = Math.max(inputLevel, outputLevel);
            this.updateMeter(energy);
            this.onVoiceState?.({ inputLevel, outputLevel, energy });
            this.meterFrame = window.requestAnimationFrame(tick);
        };
        tick();
    }

    updateMeter(value) {
        if (this.voiceMeterFill) {
            this.voiceMeterFill.style.width = `${Math.round(Math.min(value, 1) * 100)}%`;
        }
    }

    setUi(status, label, hint) {
        if (this.voiceStatus) this.voiceStatus.textContent = status;
        if (this.talkLabel) this.talkLabel.textContent = label;
        if (this.voiceHint) this.voiceHint.textContent = hint;
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

function readableError(error) {
    const message = String(error?.message || error || '');
    if (message.includes('OPENAI_API_KEY')) return 'Set OPENAI_API_KEY, then run node server.mjs.';
    if (message.includes('microphone') || message.includes('Permission')) return 'Microphone permission was blocked.';
    if (message.includes('404')) return 'Run node server.mjs instead of python http.server.';
    return message || 'Voice agent could not start.';
}
