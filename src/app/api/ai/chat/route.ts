import { NextResponse } from "next/server";
import { cloudMockAdapter } from "@/lib/ai/adapters/cloudMockAdapter";
import { normalizeAIResponse, parseAIResponseText } from "@/lib/ai/normalize";
import type { AIRequest, AIResponse } from "@/lib/ai/types";

export const runtime = "nodejs";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";

const responseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["reply", "emotion", "visualCommand"],
  properties: {
    reply: { type: "string" },
    emotion: {
      type: "string",
      enum: ["calm", "curious", "excited", "thinking", "focused"],
    },
    visualCommand: {
      type: "object",
      additionalProperties: false,
      required: ["type", "shape", "emotion", "intensity"],
      properties: {
        type: {
          type: "string",
          enum: ["idle", "pulse", "mood", "morph", "generate_shape"],
        },
        shape: {
          type: "string",
          enum: [
            "sphere",
            "logo",
            "terrain",
            "pyramid",
            "boat",
            "crystal",
            "bd1",
            "bb8",
          ],
        },
        emotion: {
          type: "string",
          enum: ["calm", "curious", "excited", "thinking", "focused"],
        },
        intensity: {
          type: "number",
          minimum: 0,
          maximum: 1,
        },
      },
    },
  },
};

export async function POST(request: Request) {
  const aiRequest = (await request.json()) as AIRequest;
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL;

  if (!apiKey || !model) {
    return NextResponse.json(await cloudMockAdapter.respond(aiRequest));
  }

  try {
    return NextResponse.json(await requestOpenAI(aiRequest, apiKey, model));
  } catch (error) {
    console.error("OpenAI cloud adapter failed", error);
    return NextResponse.json(await cloudMockAdapter.respond(aiRequest), {
      headers: { "x-ai-fallback": "cloud-mock" },
    });
  }
}

async function requestOpenAI(
  request: AIRequest,
  apiKey: string,
  model: string,
): Promise<AIResponse> {
  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      instructions: createInstructions(),
      input: createInput(request),
      max_output_tokens: 420,
      text: {
        format: {
          type: "json_schema",
          name: "spirit_connect_ai_response",
          strict: true,
          schema: responseSchema,
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI request failed: ${response.status}`);
  }

  const data = await response.json();
  const outputText = extractOutputText(data);

  return outputText
    ? parseAIResponseText(outputText, "cloud")
    : normalizeAIResponse(data, "cloud");
}

function createInstructions() {
  return [
    "You are the dialogue brain for Spirit Connect, a holographic particle companion.",
    "Always answer in the user's language.",
    "Return only structured data matching the schema.",
    "visualCommand must be safe and limited to the provided enum values.",
    "Use generate_shape when the user asks for a visible form such as a pyramid, boat, crystal, terrain, logo, sphere, BD-1, or BB-8.",
    "Use mood or pulse when the user asks for an emotion, intensity, or conversational response.",
  ].join("\n");
}

function createInput(request: AIRequest) {
  const history = request.context
    ?.slice(-8)
    .map((message) => `${message.role}: ${message.content}`)
    .join("\n");

  return [history ? `Recent context:\n${history}` : "", `User: ${request.input}`]
    .filter(Boolean)
    .join("\n\n");
}

function extractOutputText(data: unknown): string | undefined {
  if (!isRecord(data)) return undefined;
  if (typeof data.output_text === "string") return data.output_text;

  const output = Array.isArray(data.output) ? data.output : [];
  for (const item of output) {
    if (!isRecord(item) || !Array.isArray(item.content)) continue;
    for (const content of item.content) {
      if (isRecord(content) && typeof content.text === "string") {
        return content.text;
      }
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
