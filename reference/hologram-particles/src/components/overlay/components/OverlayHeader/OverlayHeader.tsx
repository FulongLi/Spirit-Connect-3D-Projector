"use client";

interface OverlayHeaderProps {
  visible?: boolean;
}

export default function OverlayHeader({ visible = true }: OverlayHeaderProps) {
  return (
    <div
      style={{
        position: "absolute",
        top: 24,
        left: 28,
        maxWidth: 310,
        pointerEvents: "none",
        zIndex: 999999999,
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(8px)",
        transition: "opacity 0.6s ease, transform 0.6s ease",
      }}
    >
      {/* Classification label */}
      <div
        style={{
          fontFamily: "var(--font-ibm-mono), monospace",
          fontSize: 10,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: "rgba(220, 240, 255, 0.9)",
          marginBottom: 6,
        }}
      >
        VOICE · PARTICLE FORM · WEBGPU
      </div>

      {/* Horizontal rule */}
      <div
        style={{
          height: 1,
          background: "rgba(220, 240, 255, 0.9)",
          marginBottom: 10,
        }}
      />

      {/* Title */}
      <h1
        style={{
          fontFamily: "var(--font-bebas), sans-serif",
          fontSize: 42,
          lineHeight: 1,
          letterSpacing: "0.05em",
          color: "rgba(220, 240, 255, 0.9)",
          margin: 0,
        }}
      >
        SPIRIT CONNECT
      </h1>

      {/* Subtitle */}
      <div
        style={{
          fontFamily: "var(--font-barlow), sans-serif",
          fontSize: 12,
          fontWeight: 300,
          letterSpacing: "0.15em",
          textTransform: "uppercase",
          color: "rgba(220, 240, 255, 0.9)",
          marginTop: 4,
        }}
      >
        灵接科技
      </div>

      {/* Attribution */}
      <div
        style={{
          fontFamily: "var(--font-ibm-mono), monospace",
          fontSize: 9,
          letterSpacing: "0.12em",
          color: "rgba(220, 240, 255, 0.9)",
          marginTop: 12,
          lineHeight: 1.7,
        }}
      >
        HOLOGRAPHIC INTERFACE SYSTEM
        <br />
        INITIAL PARTICLE COMPANION
      </div>

      <p
        style={{
          maxWidth: 300,
          fontFamily: "var(--font-barlow), sans-serif",
          fontSize: 13,
          fontWeight: 300,
          lineHeight: 1.45,
          letterSpacing: "0.04em",
          color: "rgba(220, 240, 255, 0.72)",
          margin: "14px 0 0",
        }}
      >
        Experience your digitized consciousness in stunning 3D detail. Our
        state-of-the-art projection system visualizes and interacts with
        digitized consciousness in immersive holographic environments, bringing
        your digital self to life.
      </p>
    </div>
  );
}
