export interface AIModel {
  value: string;
  label: string;
  badge: "new" | "maintenance" | null;
  disabled?: boolean;
}

export const DEFAULT_AI_MODEL = "google/gemini-3-flash-preview";

export const TEAM_AI_MODELS = [
  "google/gemini-3-flash-preview",
  "google/gemini-2.5-pro",
  "google/gemini-2.5-flash",
  "openai/gpt-5-mini",
  "openai/gpt-5",
] as const;

export const AI_MODELS: AIModel[] = [
  { value: "google/gemini-3-flash-preview", label: "Gemini 3 Flash", badge: null },
  { value: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro", badge: null },
  { value: "google/gemini-3.1-pro-preview", label: "Gemini 3.1 Pro", badge: "new" },
  { value: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash", badge: null },
  { value: "google/gemini-2.5-flash-lite", label: "Gemini Flash Lite", badge: null },
  { value: "openai/gpt-5", label: "GPT-5", badge: null },
  { value: "openai/gpt-5-mini", label: "GPT-5 Mini", badge: null },
  { value: "openai/gpt-5-nano", label: "GPT-5 Nano", badge: null },
  { value: "openai/gpt-5.2", label: "GPT-5.2", badge: "new" },
  { value: "minimax", label: "MiniMax M2.5", badge: "maintenance" },
  { value: "anthropic/claude-sonnet-4", label: "Claude Sonnet 4", badge: "maintenance", disabled: true },
  { value: "anthropic/claude-haiku", label: "Claude Haiku", badge: "maintenance", disabled: true },
  { value: "meta/llama-4-maverick", label: "Llama 4 Maverick", badge: "maintenance", disabled: true },
  { value: "mistral/mistral-large", label: "Mistral Large", badge: "maintenance", disabled: true },
  { value: "google-phi", label: "Phi-4 Mini", badge: "maintenance", disabled: true },
];

export function isSelectableModel(model: string) {
  return AI_MODELS.some((candidate) => candidate.value === model && !candidate.disabled);
}
