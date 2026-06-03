"use client";

import { useEffect, useRef, useState } from "react";

interface UseBrowserSpeechRecognitionOptions {
  lang?: string;
  onFinalTranscript: (transcript: string) => void;
}

interface BrowserSpeechRecognitionEvent {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      [index: number]: {
        transcript: string;
      };
    };
  };
}

interface BrowserSpeechRecognitionErrorEvent {
  error?: string;
}

interface BrowserSpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  onerror: ((event: BrowserSpeechRecognitionErrorEvent) => void) | null;
  abort: () => void;
  start: () => void;
  stop: () => void;
}

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

export function useBrowserSpeechRecognition({
  lang = "zh-CN",
  onFinalTranscript,
}: UseBrowserSpeechRecognitionOptions) {
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const finalTranscriptRef = useRef(onFinalTranscript);
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    finalTranscriptRef.current = onFinalTranscript;
  }, [onFinalTranscript]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setSupported(
        Boolean(getSpeechRecognitionConstructor(window as SpeechRecognitionWindow)),
      );
    });

    return () => {
      window.cancelAnimationFrame(frame);
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, []);

  const startListening = () => {
    const SpeechRecognition =
      getSpeechRecognitionConstructor(window as SpeechRecognitionWindow);
    if (!SpeechRecognition || listening) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = lang;
    recognition.onstart = () => {
      setError(null);
      setInterimTranscript("");
      setListening(true);
    };
    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };
    recognition.onerror = (event) => {
      setError(event.error ?? "speech-recognition-error");
      setListening(false);
    };
    recognition.onresult = (event) => {
      let interim = "";
      let final = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0]?.transcript?.trim() ?? "";
        if (!transcript) continue;
        if (result.isFinal) final += transcript;
        else interim += transcript;
      }

      setInterimTranscript(interim);
      if (final) finalTranscriptRef.current(final);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setListening(false);
  };

  return {
    error,
    interimTranscript,
    listening,
    startListening,
    stopListening,
    supported,
  };
}

interface SpeechRecognitionWindow extends Window {
  SpeechRecognition?: BrowserSpeechRecognitionConstructor;
  webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
}

function getSpeechRecognitionConstructor(windowRef: SpeechRecognitionWindow) {
  return windowRef.SpeechRecognition ?? windowRef.webkitSpeechRecognition;
}
