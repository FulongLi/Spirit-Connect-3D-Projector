import type {
  AIModelAdapter,
  AIRequest,
  AIResponse,
  EmotionState,
  VisualCommand,
  VisualShape,
} from "../types";

const SHAPE_KEYWORDS: Array<[VisualShape, string[]]> = [
  ["pyramid", ["pyramid", "金字塔", "三角锥"]],
  ["boat", ["boat", "ship", "船", "小船", "帆船"]],
  ["crystal", ["crystal", "水晶", "晶体"]],
  ["terrain", ["terrain", "mountain", "山", "地形"]],
  ["logo", ["logo", "标志", "灵接"]],
  ["bd1", ["bd-1", "bd1", "机器人"]],
  ["bb8", ["bb-8", "bb8", "球形机器人"]],
  ["sphere", ["sphere", "球", "圆球"]],
];

const EMOTION_KEYWORDS: Array<[EmotionState, string[]]> = [
  ["excited", ["开心", "兴奋", "激动", "亮一点", "活跃", "excited", "happy"]],
  ["calm", ["冷静", "安静", "平静", "calm", "quiet"]],
  ["thinking", ["思考", "想一想", "thinking", "think"]],
  ["focused", ["专注", "聚焦", "focused", "focus"]],
  ["curious", ["好奇", "curious"]],
];

export const localMockAdapter: AIModelAdapter = {
  id: "local-mock",
  async respond(request: AIRequest): Promise<AIResponse> {
    const input = request.input.trim();
    const normalized = input.toLowerCase();
    const shape = matchShape(normalized);
    const emotion = matchEmotion(normalized) ?? (shape ? "curious" : "calm");
    const intensity = getIntensity(normalized, emotion);
    const visualCommand: VisualCommand = shape
      ? { type: "generate_shape", shape, intensity }
      : { type: "mood", emotion, intensity };

    return {
      provider: "local-mock",
      emotion,
      visualCommand,
      reply: createReply(input, shape, emotion),
    };
  },
};

function matchShape(input: string) {
  return SHAPE_KEYWORDS.find(([, keywords]) =>
    keywords.some((keyword) => input.includes(keyword)),
  )?.[0];
}

function matchEmotion(input: string) {
  return EMOTION_KEYWORDS.find(([, keywords]) =>
    keywords.some((keyword) => input.includes(keyword)),
  )?.[0];
}

function getIntensity(input: string, emotion: EmotionState) {
  if (input.includes("强") || input.includes("更") || input.includes("very")) return 0.88;
  if (emotion === "calm") return 0.32;
  if (emotion === "thinking") return 0.58;
  if (emotion === "excited") return 0.82;
  return 0.66;
}

function createReply(
  input: string,
  shape: VisualShape | undefined,
  emotion: EmotionState,
) {
  if (shape) {
    return `收到。我先用本地智能体把自己变成 ${shape.toUpperCase()}，之后这里可以替换成 Gemma 的真实输出。`;
  }

  if (emotion === "excited") return "好，我会让粒子更亮、更活跃一点。";
  if (emotion === "calm") return "我会降下来，保持更平静的呼吸和光。";
  if (emotion === "thinking") return "我进入思考状态，先把视觉节奏放慢一点。";
  if (emotion === "focused") return "我会收束成更专注的状态。";

  return input
    ? "我听到了。现在先用 mock 本地模型回应，并把情绪传给粒子系统。"
    : "你可以试着输入：变成金字塔、变成一艘船、开心一点、冷静下来。";
}
