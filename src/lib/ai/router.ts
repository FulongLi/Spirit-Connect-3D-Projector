import { cloudHttpAdapter } from "./adapters/cloudHttpAdapter";
import { localMockAdapter } from "./adapters/localMockAdapter";
import type { AIRequest, AIResponse } from "./types";

const CLOUD_HINTS = [
  "联网",
  "搜索",
  "最新",
  "复杂",
  "详细",
  "openai",
  "gemini",
  "grok",
  "cloud",
];

export async function routeAIRequest(request: AIRequest): Promise<AIResponse> {
  if (request.mode === "cloud") return cloudHttpAdapter.respond(request);
  if (request.mode === "local") return localMockAdapter.respond(request);

  return shouldUseCloud(request.input)
    ? cloudHttpAdapter.respond(request)
    : localMockAdapter.respond(request);
}

function shouldUseCloud(input: string) {
  const normalized = input.toLowerCase();
  return CLOUD_HINTS.some((hint) => normalized.includes(hint));
}
