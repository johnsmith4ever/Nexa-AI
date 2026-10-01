export type Provider = "openai" | "deepseek" | "gemini" | "anthropic";
export type Tier = "basic" | "pro";

export type ModelDefinition = {
  id: string;
  label: string;
  provider: Provider;
  apiModel: string;
  vision: boolean;
  reasoning?: boolean;
  subtitle?: string;
};

// This is the single source of truth for every model ID used by the app.
export const models: Record<string, ModelDefinition> = {
  "gpt-5.4-nano": {
    id: "gpt-5.4-nano",
    label: "GPT-5.4 Nano",
    provider: "openai",
    apiModel: "gpt-5.4-nano",
    vision: true,
    reasoning: true,
  },
  "gpt-6-luna": {
    id: "gpt-6-luna",
    label: "GPT-6 Luna",
    provider: "openai",
    apiModel: "gpt-6-luna",
    vision: true,
    reasoning: true,
  },
  "deepseek-v4.1-flash": {
    id: "deepseek-v4.1-flash",
    label: "DeepSeek V4.1 Flash",
    provider: "deepseek",
    apiModel: "deepseek-flash",
    vision: false,
  },
  "gemini-3.1-flash-lite": {
    id: "gemini-3.1-flash-lite",
    label: "Gemini 3.1 Flash-Lite",
    provider: "gemini",
    apiModel: "gemini-3.1-flash-lite",
    vision: true,
  },
  "gemini-3.6-flash": {
    id: "gemini-3.6-flash",
    label: "Gemini 3.6 Flash",
    provider: "gemini",
    apiModel: "gemini-3.6-flash",
    vision: true,
    subtitle: "Fast and lightweight",
  },
  "claude-haiku-4-5": {
    id: "claude-haiku-4-5",
    label: "Claude Haiku 4.5",
    provider: "anthropic",
    apiModel: "claude-haiku-4-5-20251001",
    vision: true,
    subtitle: "Quick and light",
  },
  "claude-sonnet-5": {
    id: "claude-sonnet-5",
    label: "Claude Sonnet 5",
    provider: "anthropic",
    apiModel: "claude-sonnet-5-5",
    vision: true,
    subtitle: "Deep and precise",
  },
  "gpt-5.6-terra": {
    id: "gpt-5.6-terra",
    label: "GPT-5.6 Terra",
    provider: "openai",
    apiModel: "gpt-5.6-terra",
    vision: true,
    reasoning: true,
    subtitle: "Balanced",
  },
  "gpt-6-sol": {
    id: "gpt-6-sol",
    label: "GPT-6 Sol",
    provider: "openai",
    apiModel: "gpt-6-sol",
    vision: true,
    reasoning: true,
    subtitle: "Flagship reasoning",
  },
};

export const tiers: Record<Tier, string[]> = {
  basic: [
    "gpt-5.4-nano",
    "gpt-6-luna",
    "deepseek-v4.1-flash",
    "gemini-3.1-flash-lite",
  ],
  pro: [
    "gemini-3.6-flash",
    "claude-haiku-4-5",
    "claude-sonnet-5",
    "gpt-5.6-terra",
    "gpt-6-sol",
  ],
};

export function getModelForTier(tier: Tier, modelId: string) {
  if (!tiers[tier].includes(modelId)) return null;
  return models[modelId] ?? null;
}

export function getModelsForTier(tier: Tier) {
  return tiers[tier].map((id) => models[id]);
}
