import { cloudMockAdapter } from "./cloudMockAdapter";
import type { AIModelAdapter, AIRequest, AIResponse } from "../types";

export const cloudHttpAdapter: AIModelAdapter = {
  id: "cloud",
  async respond(request: AIRequest): Promise<AIResponse> {
    try {
      const result = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });

      if (!result.ok) throw new Error(`Cloud AI returned ${result.status}`);
      return (await result.json()) as AIResponse;
    } catch (error) {
      console.warn("Cloud AI request failed; using mock fallback.", error);
      return cloudMockAdapter.respond(request);
    }
  },
};
