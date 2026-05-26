"use client";

import { useEffect, useState } from "react";
import { Leva } from "leva";
import { LEVA_THEME } from "@/components/shared/theme";
import HologramScene from "./HologramScene";
import OverlayButtons from "@/components/overlay/components/OverlayButtons/OverlayButtons";
import ModelSelector, { ModelOption } from "@/components/overlay/components/ModelSelector/ModelSelector";
import OverlayHeader from "@/components/overlay/components/OverlayHeader/OverlayHeader";
import { assetPath } from "@/components/shared/assetPath";
import { useHologramControls } from "./utils/useHologramControls";
import { PRESETS, type PresetId } from "./utils/presets";

const MODELS: ModelOption[] = [
  { id: "sphere", label: "SPHERE", url: "procedural:sphere" },
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
  const activeModel = MODELS[activeModelIndex];
  const isSphereModel = activeModel.id === "sphere";

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
          breathAmp={isSphereModel ? 0.065 : 0}
          floatAmp={isSphereModel ? 0.025 : leva.floatAmp}
          maskContrast={isSphereModel ? 2.2 : leva.maskContrast}
          noiseAmp={isSphereModel ? 0.12 : leva.noiseAmp}
          noiseScale={isSphereModel ? 1.15 : leva.noiseScale}
          particleCount={isCompact ? Math.min(leva.particleCount, 36000) : leva.particleCount}
          modelY={isCompact ? -0.72 : leva.modelY}
          mouseRadius={isCompact ? Math.max(leva.mouseRadius, 3.2) : leva.mouseRadius}
          mouseStrength={isCompact ? Math.max(leva.mouseStrength, 5.6) : leva.mouseStrength}
          pushStrength={isCompact ? Math.max(leva.pushStrength, 4.8) : leva.pushStrength}
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
        </>
      )}
    </>
  );
}
