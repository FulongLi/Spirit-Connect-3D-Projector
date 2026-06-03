import type {
  AIProvider,
  AIResponse,
  EmotionState,
  VisualCommand,
  VisualShape,
} from "./types";

const EMOTIONS = new Set<EmotionState>([
  "calm",
  "curious",
  "excited",
  "thinking",
  "focused",
]);

const SHAPES = new Set<VisualShape>([
  "sphere",
  "logo",
  "terrain",
  "pyramid",
  "boat",
  "crystal",
  "bd1",
  "bb8",
]);

const COMMAND_TYPES = new Set(["idle", "pulse", "morph", "generate_shape", "mood"]);
type CommandType = "idle" | "pulse" | "morph" | "generate_shape" | "mood";

export function normalizeAIResponse(
  value: unknown,
  provider: AIProvider,
): AIResponse {
  const source = isRecord(value) ? value : {};
  const emotion = parseEmotion(source.emotion);
  const visualCommand = parseVisualCommand(source.visualCommand, emotion);

  return {
    provider,
    emotion,
    visualCommand,
    reply:
      typeof source.reply === "string" && source.reply.trim()
        ? source.reply.trim()
        : "我收到了。现在把这句话转成一个安全的视觉指令。",
  };
}

export function parseAIResponseText(text: string, provider: AIProvider) {
  try {
    return normalizeAIResponse(JSON.parse(text), provider);
  } catch {
    return normalizeAIResponse({ reply: text }, provider);
  }
}

function parseEmotion(value: unknown): EmotionState {
  return typeof value === "string" && EMOTIONS.has(value as EmotionState)
    ? (value as EmotionState)
    : "curious";
}

function parseVisualCommand(value: unknown, fallbackEmotion: EmotionState): VisualCommand {
  if (!isRecord(value)) return { type: "mood", emotion: fallbackEmotion, intensity: 0.6 };

  const type =
    typeof value.type === "string" && COMMAND_TYPES.has(value.type)
      ? (value.type as CommandType)
      : "mood";
  const intensity =
    typeof value.intensity === "number"
      ? Math.min(Math.max(value.intensity, 0), 1)
      : 0.6;

  if (type === "morph" || type === "generate_shape") {
    const shape =
      typeof value.shape === "string" && SHAPES.has(value.shape as VisualShape)
        ? (value.shape as VisualShape)
        : "sphere";
    return { type, shape, intensity };
  }

  if (type === "mood") {
    const emotion = parseEmotion(value.emotion);
    return { type, emotion, intensity };
  }

  return { type, intensity };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
