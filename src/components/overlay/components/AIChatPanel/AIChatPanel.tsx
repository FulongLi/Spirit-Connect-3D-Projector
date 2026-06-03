"use client";

import { FormEvent, useState } from "react";
import type { AIMode, AIResponse } from "@/lib/ai/types";
import styles from "./AIChatPanel.module.css";

interface AIChatPanelProps {
  mode: AIMode;
  busy: boolean;
  lastResponse?: AIResponse | null;
  ttsEnabled: boolean;
  ttsSpeaking: boolean;
  ttsSupported: boolean;
  voiceError?: string | null;
  voiceInterimTranscript?: string;
  voiceListening: boolean;
  voiceSupported: boolean;
  onModeChange: (mode: AIMode) => void;
  onStartVoice: () => void;
  onStopVoice: () => void;
  onSubmit: (input: string) => void;
  onToggleTTS: () => void;
}

const EXAMPLES = ["变成金字塔", "变成一艘船", "开心一点", "冷静下来"];

export default function AIChatPanel({
  mode,
  busy,
  lastResponse,
  ttsEnabled,
  ttsSpeaking,
  ttsSupported,
  voiceError,
  voiceInterimTranscript,
  voiceListening,
  voiceSupported,
  onModeChange,
  onStartVoice,
  onStopVoice,
  onSubmit,
  onToggleTTS,
}: AIChatPanelProps) {
  const [input, setInput] = useState("");

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || busy) return;
    onSubmit(trimmed);
    setInput("");
  };

  return (
    <section className={styles.panel} aria-label="AI command panel">
      <div className={styles.modeRow} role="tablist" aria-label="AI routing mode">
        {(["auto", "local", "cloud"] as AIMode[]).map((item) => (
          <button
            key={item}
            type="button"
            className={`${styles.modeButton} ${mode === item ? styles.active : ""}`}
            onClick={() => onModeChange(item)}
            aria-pressed={mode === item}
          >
            {item}
          </button>
        ))}
        <button
          type="button"
          className={`${styles.modeButton} ${ttsEnabled ? styles.active : ""}`}
          onClick={onToggleTTS}
          disabled={!ttsSupported}
          aria-pressed={ttsEnabled}
          title={ttsSupported ? "Toggle spoken replies" : "Speech synthesis unavailable"}
        >
          {ttsSpeaking ? "voice" : "tts"}
        </button>
      </div>

      <form className={styles.form} onSubmit={submit}>
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          className={styles.input}
          placeholder="输入一句话控制这个生命体"
          disabled={busy}
        />
        <button
          className={`${styles.voiceButton} ${voiceListening ? styles.listening : ""}`}
          type="button"
          onClick={voiceListening ? onStopVoice : onStartVoice}
          disabled={busy || !voiceSupported}
          aria-pressed={voiceListening}
          title={voiceSupported ? "Speak a command" : "Speech recognition unavailable"}
        >
          {voiceListening ? "■" : "●"}
        </button>
        <button className={styles.sendButton} type="submit" disabled={busy || !input.trim()}>
          {busy ? "..." : "SEND"}
        </button>
      </form>

      {(voiceInterimTranscript || voiceError) && (
        <div className={styles.voiceStatus} aria-live="polite">
          {voiceError ? `VOICE: ${voiceError}` : voiceInterimTranscript}
        </div>
      )}

      <div className={styles.examples} aria-label="Examples">
        {EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => onSubmit(example)}
            disabled={busy}
          >
            {example}
          </button>
        ))}
      </div>

      {lastResponse && (
        <div className={styles.response} aria-live="polite">
          <span>{lastResponse.provider}</span>
          <p>{lastResponse.reply}</p>
        </div>
      )}
    </section>
  );
}
