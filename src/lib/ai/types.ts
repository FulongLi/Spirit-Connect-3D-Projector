export type AIMode = "auto" | "local" | "cloud";

export type AIProvider = "local-mock" | "cloud-mock" | "local-gemma" | "cloud";

export type EmotionState =
  | "calm"
  | "curious"
  | "excited"
  | "thinking"
  | "focused";

export type VisualShape =
  | "sphere"
  | "logo"
  | "terrain"
  | "pyramid"
  | "boat"
  | "crystal"
  | "bd1"
  | "bb8";

export type VisualCommand =
  | {
      type: "idle" | "pulse";
      intensity?: number;
    }
  | {
      type: "morph" | "generate_shape";
      shape: VisualShape;
      intensity?: number;
    }
  | {
      type: "mood";
      emotion: EmotionState;
      intensity?: number;
    };

export interface AIMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface AIRequest {
  input: string;
  mode: AIMode;
  context?: AIMessage[];
}

export interface AIResponse {
  reply: string;
  emotion: EmotionState;
  provider: AIProvider;
  visualCommand: VisualCommand;
}

export interface AIModelAdapter {
  id: AIProvider;
  respond: (request: AIRequest) => Promise<AIResponse>;
}
