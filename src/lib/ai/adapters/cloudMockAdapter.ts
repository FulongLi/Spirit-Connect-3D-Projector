import type { AIModelAdapter, AIRequest, AIResponse } from "../types";
import { localMockAdapter } from "./localMockAdapter";

export const cloudMockAdapter: AIModelAdapter = {
  id: "cloud-mock",
  async respond(request: AIRequest): Promise<AIResponse> {
    const response = await localMockAdapter.respond(request);

    return {
      ...response,
      provider: "cloud-mock",
      reply: `云端 mock 已接管：${response.reply}`,
    };
  },
};
