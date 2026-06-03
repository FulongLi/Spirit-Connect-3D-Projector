import type { ParticlesHologramProps } from "@/components/hologramParticles/types";
import type { AIResponse, EmotionState, VisualCommand, VisualShape } from "./types";

export interface VisualCommandResult {
  modelId?: VisualShape;
  props: Partial<ParticlesHologramProps>;
}

const EMOTION_PROPS: Record<EmotionState, Partial<ParticlesHologramProps>> = {
  calm: {
    color: "#b9d3e5",
    mouseGlowColor: "#d9f3ff",
    floatAmp: 0.008,
    breathAmp: 0.018,
    noiseAmp: 0.035,
    noiseSpeed: 0.08,
    bloomStrength: 0.32,
    ringBrightness: 2.4,
  },
  curious: {
    color: "#9ed8ff",
    mouseGlowColor: "#ffe3a3",
    floatAmp: 0.018,
    breathAmp: 0.035,
    noiseAmp: 0.065,
    noiseSpeed: 0.16,
    bloomStrength: 0.48,
    ringBrightness: 3.5,
  },
  excited: {
    color: "#ffd5a8",
    mouseGlowColor: "#ff8fbe",
    floatAmp: 0.035,
    breathAmp: 0.065,
    noiseAmp: 0.12,
    noiseSpeed: 0.34,
    bloomStrength: 0.78,
    ringBrightness: 5.2,
  },
  thinking: {
    color: "#c6bbff",
    mouseGlowColor: "#86f2ff",
    floatAmp: 0.012,
    breathAmp: 0.025,
    noiseAmp: 0.09,
    noiseSpeed: 0.12,
    bloomStrength: 0.58,
    ringBrightness: 4.0,
  },
  focused: {
    color: "#d8f8ff",
    mouseGlowColor: "#ffffff",
    floatAmp: 0.006,
    breathAmp: 0.018,
    noiseAmp: 0.03,
    noiseSpeed: 0.06,
    bloomStrength: 0.42,
    ringBrightness: 3.2,
  },
};

export function resolveVisualCommand(response: AIResponse): VisualCommandResult {
  const command = response.visualCommand;
  const moodProps = EMOTION_PROPS[response.emotion];
  const intensity = command.intensity ?? 0.6;

  return {
    modelId: getModelId(command),
    props: scaleMoodProps(moodProps, intensity),
  };
}

function getModelId(command: VisualCommand) {
  if (command.type === "morph" || command.type === "generate_shape") {
    return command.shape;
  }
}

function scaleMoodProps(
  props: Partial<ParticlesHologramProps>,
  intensity: number,
) {
  const clamped = Math.min(Math.max(intensity, 0), 1);

  return {
    ...props,
    floatAmp: props.floatAmp ? props.floatAmp * (0.75 + clamped * 0.55) : undefined,
    breathAmp: props.breathAmp ? props.breathAmp * (0.7 + clamped * 0.7) : undefined,
    noiseAmp: props.noiseAmp ? props.noiseAmp * (0.8 + clamped * 0.65) : undefined,
    bloomStrength: props.bloomStrength
      ? props.bloomStrength * (0.75 + clamped * 0.55)
      : undefined,
    ringBrightness: props.ringBrightness
      ? props.ringBrightness * (0.75 + clamped * 0.5)
      : undefined,
  } satisfies Partial<ParticlesHologramProps>;
}
