"use client";

import { useCallback, useEffect, useState } from "react";
import { Leva } from "leva";
import { LEVA_THEME } from "@/components/shared/theme";
import HologramScene from "./HologramScene";
import AIChatPanel from "@/components/overlay/components/AIChatPanel/AIChatPanel";
import OverlayButtons from "@/components/overlay/components/OverlayButtons/OverlayButtons";
import ModelSelector, { ModelOption } from "@/components/overlay/components/ModelSelector/ModelSelector";
import OverlayHeader from "@/components/overlay/components/OverlayHeader/OverlayHeader";
import { assetPath } from "@/components/shared/assetPath";
import { useHologramControls } from "./utils/useHologramControls";
import { PRESETS, type PresetId } from "./utils/presets";
import { routeAIRequest } from "@/lib/ai/router";
import { resolveVisualCommand } from "@/lib/ai/visualCommandEngine";
import { useBrowserSpeechRecognition } from "@/lib/voice/useBrowserSpeechRecognition";
import { useBrowserSpeechSynthesis } from "@/lib/voice/useBrowserSpeechSynthesis";
import type { AIMessage, AIMode, AIResponse } from "@/lib/ai/types";
import type { ParticlesHologramProps } from "./types";

const MODELS: ModelOption[] = [
  { id: "sphere", label: "SPHERE", url: "procedural:sphere" },
  { id: "logo", label: "LOGO", url: "procedural:spirit-logo" },
  { id: "terrain", label: "TERRAIN", url: "procedural:terrain" },
  { id: "pyramid", label: "PYRAMID", url: "procedural:pyramid" },
  { id: "boat", label: "BOAT", url: "procedural:boat" },
  { id: "crystal", label: "CRYSTAL", url: "procedural:crystal" },
  { id: "bd1", label: "BD-1", url: assetPath("/glb/bd1.glb") },
  { id: "bb8", label: "BB-8", url: assetPath("/glb/bb8.glb") },
];

export default function PlaygroundCanvas() {
  const [hideLeva, setHideLeva] = useState(true);
  const [activeModelIndex, setActiveModelIndex] = useState(0);
  const [headerVisible, setHeaderVisible] = useState(false);
  const [replayTrigger, setReplayTrigger] = useState(0);
  const [activePreset, setActivePreset] = useState<PresetId>("light");
  const [rendererUnavailable, setRendererUnavailable] = useState(false);
  const [isCompact, setIsCompact] = useState(false);
  const [aiMode, setAiMode] = useState<AIMode>("auto");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMessages, setAiMessages] = useState<AIMessage[]>([]);
  const [lastAIResponse, setLastAIResponse] = useState<AIResponse | null>(null);
  const [aiVisualProps, setAiVisualProps] = useState<Partial<ParticlesHologramProps>>({});
  const speechOutput = useBrowserSpeechSynthesis();
  const activeModel = MODELS[activeModelIndex];
  const isSphereModel = activeModel.id === "sphere";
  const isLogoModel = activeModel.id === "logo";
  const isTerrainModel = activeModel.id === "terrain";

  const leva = useHologramControls(() => {
    setReplayTrigger((t) => t + 1);
    setHeaderVisible(false);
  });

  useEffect(() => {
    const media = window.matchMedia("(max-width: 720px), (pointer: coarse)");
    const update = () => setIsCompact(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const submitAICommand = useCallback(async (input: string) => {
    if (aiBusy) return;
    setAiBusy(true);

    try {
      const response = await routeAIRequest({
        input,
        mode: aiMode,
        context: aiMessages,
      });
      const visual = resolveVisualCommand(response);

      setLastAIResponse(response);
      setAiVisualProps(visual.props);
      setAiMessages((messages) => [
        ...messages.slice(-10),
        { role: "user", content: input },
        { role: "assistant", content: response.reply },
      ]);
      speechOutput.speak(response.reply);

      if (visual.modelId) {
        const nextIndex = MODELS.findIndex((model) => model.id === visual.modelId);
        if (nextIndex >= 0) setActiveModelIndex(nextIndex);
      }
    } finally {
      setAiBusy(false);
    }
  }, [aiBusy, aiMessages, aiMode, speechOutput]);

  const speechInput = useBrowserSpeechRecognition({
    onFinalTranscript: submitAICommand,
  });

  const voiceVisualProps: Partial<ParticlesHologramProps> = speechInput.listening
    ? {
        bloomStrength: 0.72,
        breathAmp: 0.06,
        mouseGlowColor: "#9efcff",
        mouseGlowPassive: 0.22,
        ringBrightness: 4.7,
      }
    : speechOutput.speaking
      ? {
          bloomStrength: 0.64,
          breathAmp: 0.075,
          mouseGlowColor: "#ffe3a3",
          mouseGlowPassive: 0.16,
          ringBrightness: 4.2,
        }
      : {};

  return (
    <>
      <Leva
        theme={LEVA_THEME}
        titleBar={{ title: "CONTROLS" }}
        collapsed={false}
        flat={false}
        oneLineLabels={false}
        hidden={hideLeva}
      />
      <OverlayHeader visible={headerVisible || rendererUnavailable} />
      <div style={{ position: "fixed", inset: 0 }}>
        <HologramScene
          url={activeModel.url}
          preloadUrls={MODELS.map((m) => m.url)}
          onTransitionComplete={() => {
            setRendererUnavailable(false);
            setHeaderVisible(true);
          }}
          onUnavailable={() => {
            setRendererUnavailable(true);
            setHeaderVisible(true);
          }}
          replayTrigger={replayTrigger}
          {...leva}
          {...PRESETS[activePreset]}
          color={isLogoModel ? "#32b8f2" : PRESETS[activePreset].color}
          breathAmp={isSphereModel ? 0.065 : 0}
          floatAmp={
            isSphereModel
              ? 0.025
              : isTerrainModel
                ? 0.006
                : isLogoModel
                  ? 0.008
                  : leva.floatAmp
          }
          maskContrast={
            isSphereModel
              ? 2.2
              : isTerrainModel
                ? 1.8
                : isLogoModel
                  ? 2.3
                  : leva.maskContrast
          }
          noiseAmp={
            isSphereModel
              ? 0.12
              : isTerrainModel
                ? 0.035
                : isLogoModel
                  ? 0.018
                  : leva.noiseAmp
          }
          noiseScale={
            isSphereModel
              ? 1.15
              : isTerrainModel
                ? 0.85
                : isLogoModel
                  ? 0.95
                  : leva.noiseScale
          }
          particleCount={isCompact ? Math.min(leva.particleCount, 36000) : leva.particleCount}
          modelY={
            isTerrainModel
              ? isCompact
                ? -0.92
                : -1.05
              : isLogoModel
                ? isCompact
                  ? -0.78
                  : -0.9
                : isCompact
                  ? -0.72
                  : leva.modelY
          }
          mouseRadius={isCompact ? Math.max(leva.mouseRadius, 2.35) : leva.mouseRadius}
          mouseStrength={isCompact ? Math.max(leva.mouseStrength, 4.4) : leva.mouseStrength}
          pushStrength={isCompact ? Math.max(leva.pushStrength, 2.8) : leva.pushStrength}
          {...aiVisualProps}
          {...voiceVisualProps}
        />
      </div>

      {!rendererUnavailable && (
        <>
          <OverlayButtons
            hideLeva={hideLeva}
            onToggleLeva={() => setHideLeva((v) => !v)}
            activePreset={activePreset}
            onTogglePreset={() =>
              setActivePreset((p) => (p === "light" ? "dark" : "light"))
            }
          />
          <ModelSelector
            models={MODELS}
            activeIndex={activeModelIndex}
            onChange={setActiveModelIndex}
          />
          <AIChatPanel
            mode={aiMode}
            busy={aiBusy}
            lastResponse={lastAIResponse}
            ttsEnabled={speechOutput.enabled}
            ttsSpeaking={speechOutput.speaking}
            ttsSupported={speechOutput.supported}
            voiceError={speechInput.error}
            voiceInterimTranscript={speechInput.interimTranscript}
            voiceListening={speechInput.listening}
            voiceSupported={speechInput.supported}
            onModeChange={setAiMode}
            onStartVoice={speechInput.startListening}
            onStopVoice={speechInput.stopListening}
            onSubmit={submitAICommand}
            onToggleTTS={() => {
              if (speechOutput.enabled) speechOutput.stop();
              speechOutput.setEnabled(!speechOutput.enabled);
            }}
          />
        </>
      )}
    </>
  );
}
