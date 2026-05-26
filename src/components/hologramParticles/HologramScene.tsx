"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import type { ParticlesHologramProps } from "./types";

const ParticlesHologram = dynamic(
  () => import("./ParticlesHologram"),
  { ssr: false }
);

export default function HologramScene(props: ParticlesHologramProps) {
  const [supportState, setSupportState] = useState<"checking" | "ready" | "unsupported">("checking");
  const { onUnavailable } = props;
  const notifyUnavailable = useCallback(() => {
    setSupportState("unsupported");
    onUnavailable?.();
  }, [onUnavailable]);

  useEffect(() => {
    let cancelled = false;

    async function checkWebGPU() {
      const gpu = (navigator as Navigator & {
        gpu?: {
          requestAdapter?: () => Promise<unknown>;
        };
      }).gpu;

      if (!gpu?.requestAdapter) {
        if (!cancelled) {
          notifyUnavailable();
        }
        return;
      }

      try {
        const adapter = await gpu.requestAdapter();
        if (cancelled) return;
        if (adapter) {
          setSupportState("ready");
        } else {
          notifyUnavailable();
        }
      } catch {
        if (!cancelled) {
          notifyUnavailable();
        }
      }
    }

    checkWebGPU();

    return () => {
      cancelled = true;
    };
  }, [notifyUnavailable]);

  if (supportState !== "ready") {
    return <WebGPUFallback checking={supportState === "checking"} />;
  }

  return <ParticlesHologram {...props} onUnavailable={notifyUnavailable} />;
}

function WebGPUFallback({ checking }: { checking: boolean }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "grid",
        placeItems: "center",
        padding: 28,
        background:
          "radial-gradient(circle at 50% 42%, #d2dde8 0%, #9eb3c7 42%, #718da3 100%)",
      }}
    >
      <section
        style={{
          width: "min(440px, 100%)",
          border: "1px solid rgba(240, 248, 255, 0.42)",
          background: "rgba(10, 15, 20, 0.28)",
          padding: "24px 22px",
          color: "rgba(244, 250, 255, 0.92)",
          backdropFilter: "blur(14px)",
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-ibm-mono), monospace",
            fontSize: 10,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            marginBottom: 10,
          }}
        >
          SPIRIT CONNECT · 灵接科技
        </div>
        <h2
          style={{
            fontFamily: "var(--font-bebas), sans-serif",
            fontSize: 38,
            lineHeight: 1,
            letterSpacing: "0.04em",
            margin: 0,
          }}
        >
          {checking ? "INITIALIZING" : "WEBGPU REQUIRED"}
        </h2>
        <p
          style={{
            fontFamily: "var(--font-barlow), sans-serif",
            fontSize: 15,
            fontWeight: 300,
            lineHeight: 1.5,
            letterSpacing: "0.03em",
            margin: "14px 0 0",
          }}
        >
          {checking
            ? "Preparing the holographic particle renderer."
            : "This device or browser cannot start the holographic particle renderer. Open the site in a current Chrome, Edge, Firefox, or Safari browser with WebGPU and hardware acceleration enabled."}
        </p>
      </section>
    </div>
  );
}
