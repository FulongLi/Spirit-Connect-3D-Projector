"use client";

import { useEffect, useState } from "react";

export function useBrowserSpeechSynthesis() {
  const [enabled, setEnabled] = useState(true);
  const [speaking, setSpeaking] = useState(false);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setSupported("speechSynthesis" in window && "SpeechSynthesisUtterance" in window);
    });

    return () => {
      window.cancelAnimationFrame(frame);
      window.speechSynthesis?.cancel();
    };
  }, []);

  const speak = (text: string) => {
    if (!enabled || !supported || !text.trim()) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = hasChineseText(text) ? "zh-CN" : "en-US";
    utterance.rate = 0.96;
    utterance.pitch = 1.02;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  const stop = () => {
    window.speechSynthesis.cancel();
    setSpeaking(false);
  };

  return {
    enabled,
    setEnabled,
    speak,
    speaking,
    stop,
    supported,
  };
}

function hasChineseText(text: string) {
  return /[\u3400-\u9fff]/.test(text);
}
