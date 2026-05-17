export interface ModelCapabilities {
  vision: boolean;
  contextLength: number;
}

type CapabilityMap = Record<string, ModelCapabilities>;

const OPENAI: CapabilityMap = {
  'gpt-4o': { vision: true, contextLength: 128000 },
  'gpt-4o-mini': { vision: true, contextLength: 128000 },
  'gpt-4-turbo': { vision: true, contextLength: 128000 },
  'gpt-4-vision-preview': { vision: true, contextLength: 128000 },
  'gpt-4': { vision: false, contextLength: 8192 },
  'gpt-4-32k': { vision: false, contextLength: 32768 },
  'gpt-3.5-turbo': { vision: false, contextLength: 16385 },
  'o1-preview': { vision: true, contextLength: 128000 },
  'o1-mini': { vision: false, contextLength: 128000 },
  'o1-pro': { vision: true, contextLength: 200000 },
  'o3': { vision: true, contextLength: 200000 },
  'o3-mini': { vision: false, contextLength: 200000 },
  'o4-mini': { vision: true, contextLength: 200000 },
  'gpt-5.4': { vision: true, contextLength: 1050000 },
  'gpt-5.4-mini': { vision: true, contextLength: 272000 },
  'gpt-5.5': { vision: true, contextLength: 1050000 },
};

const ANTHROPIC: CapabilityMap = {
  'claude-3-opus': { vision: true, contextLength: 200000 },
  'claude-3-sonnet': { vision: true, contextLength: 200000 },
  'claude-3-haiku': { vision: true, contextLength: 200000 },
  'claude-3.5-sonnet': { vision: true, contextLength: 200000 },
  'claude-3.5-haiku': { vision: true, contextLength: 200000 },
  'claude-3.7-sonnet': { vision: true, contextLength: 200000 },
  'claude-4-sonnet': { vision: true, contextLength: 200000 },
  'claude-4-opus': { vision: true, contextLength: 200000 },
  'claude-opus-4-5': { vision: true, contextLength: 200000 },
  'claude-opus-4-6': { vision: true, contextLength: 1000000 },
  'claude-opus-4-7': { vision: true, contextLength: 1000000 },
  'claude-sonnet-4-6': { vision: true, contextLength: 1000000 },
  'claude-haiku-4-5': { vision: true, contextLength: 200000 },
};

const GOOGLE: CapabilityMap = {
  'gemini-1.5-pro': { vision: true, contextLength: 2097152 },
  'gemini-1.5-flash': { vision: true, contextLength: 1048576 },
  'gemini-2.0-flash': { vision: true, contextLength: 1048576 },
  'gemini-2.0-flash-lite': { vision: true, contextLength: 1048576 },
  'gemini-2.5-pro': { vision: true, contextLength: 1048576 },
  'gemini-2.5-flash': { vision: true, contextLength: 1048576 },
};

const DEEPSEEK: CapabilityMap = {
  'deepseek-chat': { vision: false, contextLength: 1048576 },
  'deepseek-reasoner': { vision: false, contextLength: 1048576 },
  'deepseek-coder': { vision: false, contextLength: 131072 },
  'deepseek-v2': { vision: false, contextLength: 131072 },
  'deepseek-v2.5': { vision: false, contextLength: 131072 },
  'deepseek-v3': { vision: false, contextLength: 131072 },
  'deepseek-v4-flash': { vision: false, contextLength: 1048576 },
  'deepseek-v4-pro': { vision: false, contextLength: 1048576 },
  'deepseek-vl': { vision: true, contextLength: 4096 },
  'deepseek-vl2': { vision: true, contextLength: 8192 },
};

const QWEN: CapabilityMap = {
  'qwen-vl': { vision: true, contextLength: 8192 },
  'qwen-vl-plus': { vision: true, contextLength: 32768 },
  'qwen-vl-max': { vision: true, contextLength: 32768 },
  'qwen2-vl': { vision: true, contextLength: 32768 },
  'qwen2.5-vl': { vision: true, contextLength: 32768 },
  'qwen2.5-omni': { vision: true, contextLength: 32768 },
  'qwen-turbo': { vision: false, contextLength: 131072 },
  'qwen-plus': { vision: false, contextLength: 131072 },
  'qwen-max': { vision: false, contextLength: 32768 },
  'qwen-long': { vision: false, contextLength: 1048576 },
  'qwen-coder': { vision: false, contextLength: 131072 },
};

const ZHIPU: CapabilityMap = {
  'glm-4v': { vision: true, contextLength: 8192 },
  'glm-4v-plus': { vision: true, contextLength: 8192 },
  'glm-4v-flash': { vision: true, contextLength: 8192 },
  'glm-4': { vision: false, contextLength: 128000 },
  'glm-4-plus': { vision: false, contextLength: 128000 },
  'glm-4-flash': { vision: false, contextLength: 128000 },
  'glm-4-long': { vision: false, contextLength: 1048576 },
  'glm-z1': { vision: false, contextLength: 128000 },
};

const MISTRAL: CapabilityMap = {
  'pixtral-12b': { vision: true, contextLength: 128000 },
  'pixtral-large': { vision: true, contextLength: 128000 },
  'mistral-small': { vision: false, contextLength: 32768 },
  'mistral-medium': { vision: false, contextLength: 32768 },
  'mistral-large': { vision: true, contextLength: 128000 },
  'codestral': { vision: false, contextLength: 32768 },
  'ministral-3b': { vision: false, contextLength: 128000 },
  'ministral-8b': { vision: false, contextLength: 128000 },
};

const META: CapabilityMap = {
  'llama-3': { vision: false, contextLength: 8192 },
  'llama-3.1': { vision: false, contextLength: 131072 },
  'llama-3.2-11b-vision': { vision: true, contextLength: 131072 },
  'llama-3.2-90b-vision': { vision: true, contextLength: 131072 },
  'llama-3.3': { vision: false, contextLength: 131072 },
  'llama-4-scout': { vision: true, contextLength: 10485760 },
  'llama-4-maverick': { vision: true, contextLength: 1048576 },
};

const OTHER: CapabilityMap = {
  'internvl2': { vision: true, contextLength: 8192 },
  'internvl2.5': { vision: true, contextLength: 8192 },
  'internvl3': { vision: true, contextLength: 8192 },
  'cogvlm': { vision: true, contextLength: 4096 },
  'cogvlm2': { vision: true, contextLength: 8192 },
  'minicpm-v': { vision: true, contextLength: 4096 },
  'minicpm-v2': { vision: true, contextLength: 8192 },
  'moondream': { vision: true, contextLength: 4096 },
  'moondream2': { vision: true, contextLength: 8192 },
  'yi-vl': { vision: true, contextLength: 4096 },
  'yi-lightning': { vision: false, contextLength: 16384 },
  'step-1v': { vision: true, contextLength: 8192 },
  'step-2': { vision: false, contextLength: 32768 },
  'hunyuan-vision': { vision: true, contextLength: 8192 },
  'hunyuan-turbo': { vision: false, contextLength: 32768 },
};

const LONGCAT: CapabilityMap = {
  'longcat-flash-chat': { vision: false, contextLength: 262144 },
  'longcat-flash-thinking': { vision: false, contextLength: 262144 },
  'longcat-flash-thinking-2601': { vision: false, contextLength: 262144 },
  'longcat-flash-lite': { vision: false, contextLength: 262144 },
  'longcat-flash-omni-2603': { vision: true, contextLength: 131072 },
  'longcat-flash-chat-2602-exp': { vision: false, contextLength: 262144 },
  'longcat-2.0-preview': { vision: false, contextLength: 1048576 },
};

const MIMO: CapabilityMap = {
  'mimo-v2.5-pro': { vision: false, contextLength: 1048576 },
  'mimo-v2.5': { vision: true, contextLength: 1048576 },
  'mimo-v2-pro': { vision: false, contextLength: 1048576 },
  'mimo-v2-omni': { vision: true, contextLength: 262144 },
  'mimo-v2-flash': { vision: false, contextLength: 131072 },
};

const ALL_MODELS: CapabilityMap = {
  ...OPENAI,
  ...ANTHROPIC,
  ...GOOGLE,
  ...DEEPSEEK,
  ...QWEN,
  ...ZHIPU,
  ...MISTRAL,
  ...META,
  ...LONGCAT,
  ...MIMO,
  ...OTHER,
};

function normalizeModelId(modelId: string): string {
  return modelId
    .replace(/^(openai|anthropic|google|deepseek|openrouter|ollama)\//, '')
    .replace(/^openrouter\/[^/]+\//, '')
    .replace(/:/g, '-')
    .replace(/_/g, '-')
    .replace(/\.\d{4}-\d{2}-\d{2}$/, '')
    .replace(/-\d{8}$/, '')
    .toLowerCase();
}

function findModel(modelId: string): ModelCapabilities | null {
  const normalized = normalizeModelId(modelId);

  if (ALL_MODELS[normalized]) return ALL_MODELS[normalized];

  for (const [key, caps] of Object.entries(ALL_MODELS)) {
    if (normalized.startsWith(key)) return caps;
  }

  for (const [key, caps] of Object.entries(ALL_MODELS)) {
    if (normalized.includes(key)) return caps;
  }

  return null;
}

export function modelSupportsVision(modelId: string | null): boolean {
  if (!modelId) return true;
  const caps = findModel(modelId);
  if (caps) return caps.vision;
  return true;
}

export function getModelCapabilities(modelId: string): ModelCapabilities & { known: boolean } {
  const caps = findModel(modelId);
  if (caps) return { ...caps, known: true };
  return { vision: true, contextLength: 0, known: false };
}

export function getDisplayModelName(modelId: string): string | null {
  if (!modelId) return null;
  const normalized = normalizeModelId(modelId);
  if (DISPLAY_NAMES[normalized]) return DISPLAY_NAMES[normalized];
  for (const [key, name] of Object.entries(DISPLAY_NAMES)) {
    if (normalized.startsWith(key)) return name;
  }
  return null;
}

const DISPLAY_NAMES: Record<string, string> = {
  'gpt-5.5': 'GPT-5.5',
  'gpt-5.4-mini': 'GPT-5.4 Mini',
  'gpt-5.4': 'GPT-5.4',
  'gpt-4o-mini': 'GPT-4o Mini',
  'gpt-4o': 'GPT-4o',
  'gpt-4-turbo': 'GPT-4 Turbo',
  'gpt-4-vision-preview': 'GPT-4 Vision',
  'gpt-4-32k': 'GPT-4 32K',
  'gpt-4': 'GPT-4',
  'gpt-3.5-turbo': 'GPT-3.5 Turbo',
  'o1-preview': 'o1 Preview',
  'o1-mini': 'o1 Mini',
  'o1-pro': 'o1 Pro',
  'o3-mini': 'o3 Mini',
  'o3': 'o3',
  'o4-mini': 'o4 Mini',
  'claude-opus-4-7': 'Claude Opus 4.7',
  'claude-opus-4-6': 'Claude Opus 4.6',
  'claude-opus-4-5': 'Claude Opus 4.5',
  'claude-sonnet-4-6': 'Claude Sonnet 4.6',
  'claude-haiku-4-5': 'Claude Haiku 4.5',
  'claude-4-opus': 'Claude 4 Opus',
  'claude-4-sonnet': 'Claude 4 Sonnet',
  'claude-3.7-sonnet': 'Claude 3.7 Sonnet',
  'claude-3.5-sonnet': 'Claude 3.5 Sonnet',
  'claude-3.5-haiku': 'Claude 3.5 Haiku',
  'claude-3-opus': 'Claude 3 Opus',
  'claude-3-sonnet': 'Claude 3 Sonnet',
  'claude-3-haiku': 'Claude 3 Haiku',
  'gemini-2.5-pro': 'Gemini 2.5 Pro',
  'gemini-2.5-flash': 'Gemini 2.5 Flash',
  'gemini-2.0-flash-lite': 'Gemini 2.0 Flash Lite',
  'gemini-2.0-flash': 'Gemini 2.0 Flash',
  'gemini-1.5-pro': 'Gemini 1.5 Pro',
  'gemini-1.5-flash': 'Gemini 1.5 Flash',
  'deepseek-v4-pro': 'DeepSeek V4 Pro',
  'deepseek-v4-flash': 'DeepSeek V4 Flash',
  'deepseek-chat': 'DeepSeek Chat',
  'deepseek-reasoner': 'DeepSeek Reasoner',
  'deepseek-coder': 'DeepSeek Coder',
  'deepseek-v3': 'DeepSeek V3',
  'deepseek-v2.5': 'DeepSeek V2.5',
  'deepseek-v2': 'DeepSeek V2',
  'deepseek-vl2': 'DeepSeek VL2',
  'deepseek-vl': 'DeepSeek VL',
  'qwen2.5-omni': 'Qwen 2.5 Omni',
  'qwen2.5-vl': 'Qwen 2.5 VL',
  'qwen2-vl': 'Qwen 2 VL',
  'qwen-vl-plus': 'Qwen VL Plus',
  'qwen-vl-max': 'Qwen VL Max',
  'qwen-vl': 'Qwen VL',
  'qwen-coder': 'Qwen Coder',
  'qwen-long': 'Qwen Long',
  'qwen-turbo': 'Qwen Turbo',
  'qwen-plus': 'Qwen Plus',
  'qwen-max': 'Qwen Max',
  'glm-4v-plus': 'GLM-4V Plus',
  'glm-4v-flash': 'GLM-4V Flash',
  'glm-4v': 'GLM-4V',
  'glm-4-plus': 'GLM-4 Plus',
  'glm-4-flash': 'GLM-4 Flash',
  'glm-4-long': 'GLM-4 Long',
  'glm-4': 'GLM-4',
  'glm-z1': 'GLM-Z1',
  'pixtral-large': 'Pixtral Large',
  'pixtral-12b': 'Pixtral 12B',
  'mistral-large': 'Mistral Large',
  'mistral-medium': 'Mistral Medium',
  'mistral-small': 'Mistral Small',
  'codestral': 'Codestral',
  'ministral-8b': 'Ministral 8B',
  'ministral-3b': 'Ministral 3B',
  'llama-4-scout': 'Llama 4 Scout',
  'llama-4-maverick': 'Llama 4 Maverick',
  'llama-3.2-90b-vision': 'Llama 3.2 90B Vision',
  'llama-3.2-11b-vision': 'Llama 3.2 11B Vision',
  'llama-3.3': 'Llama 3.3',
  'llama-3.1': 'Llama 3.1',
  'llama-3': 'Llama 3',
  'longcat-2.0-preview': 'LongCat 2.0 Preview',
  'longcat-flash-omni-2603': 'LongCat Flash Omni',
  'longcat-flash-thinking-2601': 'LongCat Flash Thinking',
  'longcat-flash-chat-2602-exp': 'LongCat Flash Chat Exp',
  'longcat-flash-thinking': 'LongCat Flash Thinking',
  'longcat-flash-chat': 'LongCat Flash Chat',
  'longcat-flash-lite': 'LongCat Flash Lite',
  'mimo-v2.5-pro': 'MIMO V2.5 Pro',
  'mimo-v2.5': 'MIMO V2.5',
  'mimo-v2-pro': 'MIMO V2 Pro',
  'mimo-v2-omni': 'MIMO V2 Omni',
  'mimo-v2-flash': 'MIMO V2 Flash',
  'internvl3': 'InternVL3',
  'internvl2.5': 'InternVL 2.5',
  'internvl2': 'InternVL 2',
  'cogvlm2': 'CogVLM2',
  'cogvlm': 'CogVLM',
  'minicpm-v2': 'MiniCPM-V2',
  'minicpm-v': 'MiniCPM-V',
  'moondream2': 'Moondream2',
  'moondream': 'Moondream',
  'yi-vl': 'Yi-VL',
  'yi-lightning': 'Yi Lightning',
  'step-1v': 'Step-1V',
  'step-2': 'Step-2',
  'hunyuan-vision': 'Hunyuan Vision',
  'hunyuan-turbo': 'Hunyuan Turbo',
};

export function getCapabilitiesWithOverride(
  modelId: string,
  overrides: Record<string, Partial<ModelCapabilities>> | null,
): ModelCapabilities & { known: boolean } {
  const registry = findModel(modelId);
  if (registry) return { ...registry, known: true };

  const override = overrides?.[modelId];
  if (override) {
    return {
      vision: override.vision ?? true,
      contextLength: override.contextLength ?? 0,
      known: false,
    };
  }

  return { vision: true, contextLength: 0, known: false };
}
