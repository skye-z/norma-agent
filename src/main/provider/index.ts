export interface ProviderPreset {
  id: string;
  name: string;
  type: "openai" | "anthropic" | "google" | "ollama";
  baseUrl: string;
  keyPrefix: string;
  keyHint: string;
  description: string;
}

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: "openai",
    name: "OpenAI",
    type: "openai",
    baseUrl: "https://api.openai.com/v1",
    keyPrefix: "sk-",
    keyHint: "sk-...",
    description: "GPT-4o, GPT-4o-mini, o3 等",
  },
  {
    id: "anthropic",
    name: "Anthropic",
    type: "anthropic",
    baseUrl: "https://api.anthropic.com",
    keyPrefix: "sk-ant-",
    keyHint: "sk-ant-...",
    description: "Claude Sonnet 4, Claude 3.5 等",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    type: "openai",
    baseUrl: "https://api.deepseek.com",
    keyPrefix: "sk-",
    keyHint: "sk-...",
    description: "DeepSeek-V3, DeepSeek-R1 等",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    type: "openai",
    baseUrl: "https://openrouter.ai/api/v1",
    keyPrefix: "sk-or-",
    keyHint: "sk-or-...",
    description: "聚合多供应商模型网关",
  },
  {
    id: "google",
    name: "Google AI",
    type: "google",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    keyPrefix: "AI",
    keyHint: "AIza...",
    description: "Gemini 2.5 Pro, Gemini Flash 等",
  },
  {
    id: "ollama",
    name: "Ollama (本地)",
    type: "ollama",
    baseUrl: "http://localhost:11434",
    keyPrefix: "",
    keyHint: "无需密钥",
    description: "本地模型运行时",
  },
  {
    id: "custom",
    name: "自定义 (OpenAI 兼容)",
    type: "openai",
    baseUrl: "",
    keyPrefix: "",
    keyHint: "输入 API Key",
    description: "任何 OpenAI API 兼容服务",
  },
];

export interface ProviderConfig {
  id: string;
  presetId: string;
  name: string;
  type: string;
  baseUrl: string;
  apiKey: string;
}

export interface ModelInfo {
  id: string;
  name: string;
  owned_by?: string;
  created?: number;
  root?: string;
  parent?: string;
  object?: string;
}

export async function testConnectivity(
  config: ProviderConfig,
): Promise<{ success: boolean; error?: string; latency?: number }> {
  const start = Date.now();
  try {
    switch (config.type) {
      case "openai": {
        const res = await fetch(`${config.baseUrl}/models`, {
          headers: { Authorization: `Bearer ${config.apiKey}` },
          signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          return {
            success: false,
            error: `HTTP ${res.status}: ${body.slice(0, 200)}`,
          };
        }
        return { success: true, latency: Date.now() - start };
      }
      case "anthropic": {
        const res = await fetch(`${config.baseUrl}/v1/messages`, {
          method: "POST",
          headers: {
            "x-api-key": config.apiKey,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: "claude-3-5-haiku-latest",
            max_tokens: 1,
            messages: [{ role: "user", content: "hi" }],
          }),
          signal: AbortSignal.timeout(15000),
        });
        if (res.status === 401 || res.status === 403) {
          return { success: false, error: `认证失败: HTTP ${res.status}` };
        }
        return { success: true, latency: Date.now() - start };
      }
      case "google": {
        const res = await fetch(
          `${config.baseUrl}/models?key=${config.apiKey}`,
          { signal: AbortSignal.timeout(10000) },
        );
        if (!res.ok) {
          return { success: false, error: `HTTP ${res.status}` };
        }
        return { success: true, latency: Date.now() - start };
      }
      case "ollama": {
        const res = await fetch(`${config.baseUrl}/api/tags`, {
          signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) {
          return { success: false, error: `HTTP ${res.status}` };
        }
        return { success: true, latency: Date.now() - start };
      }
      default:
        return { success: false, error: "未知供应商类型" };
    }
  } catch (err: any) {
    return { success: false, error: err.message || "连接失败" };
  }
}

export async function fetchModels(
  config: ProviderConfig,
): Promise<ModelInfo[]> {
  try {
    switch (config.type) {
      case "openai": {
        const res = await fetch(`${config.baseUrl}/models`, {
          headers: { Authorization: `Bearer ${config.apiKey}` },
          signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        return (data.data || []).map((m: any) => ({
          id: m.id,
          name: m.id,
          owned_by: m.owned_by || m.owner,
          created: m.created,
          root: m.root,
          parent: m.parent ?? null,
          object: m.object,
        }));
      }
      case "anthropic": {
        return [
          {
            id: "claude-sonnet-4-20250514",
            name: "Claude Sonnet 4",
            owned_by: "anthropic",
          },
          {
            id: "claude-3-7-sonnet-20250219",
            name: "Claude 3.7 Sonnet",
            owned_by: "anthropic",
          },
          {
            id: "claude-3-5-sonnet-20241022",
            name: "Claude 3.5 Sonnet",
            owned_by: "anthropic",
          },
          {
            id: "claude-3-5-haiku-20241022",
            name: "Claude 3.5 Haiku",
            owned_by: "anthropic",
          },
          {
            id: "claude-3-opus-20240229",
            name: "Claude 3 Opus",
            owned_by: "anthropic",
          },
        ];
      }
      case "google": {
        const res = await fetch(
          `${config.baseUrl}/models?key=${config.apiKey}`,
          { signal: AbortSignal.timeout(15000) },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        return (data.models || []).map((m: any) => ({
          id: m.name.replace("models/", ""),
          name: m.displayName || m.name,
          owned_by: "google",
          created: m.createTime ? Math.floor(new Date(m.createTime).getTime() / 1000) : undefined,
          object: "model",
        }));
      }
      case "ollama": {
        const res = await fetch(`${config.baseUrl}/api/tags`, {
          signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        return (data.models || []).map((m: any) => ({
          id: m.name,
          name: m.name,
          owned_by: "local",
        }));
      }
      default:
        return [];
    }
  } catch (err: any) {
    throw new Error(err.message || "获取模型列表失败");
  }
}

export async function testModel(
  config: ProviderConfig,
  modelId: string,
): Promise<{
  success: boolean;
  error?: string;
  response?: string;
  latency?: number;
}> {
  const start = Date.now();
  const prompt = 'Say "OK" and nothing else.';
  try {
    switch (config.type) {
      case "openai": {
        const res = await fetch(`${config.baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: modelId,
            messages: [{ role: "user", content: prompt }],
            max_tokens: 10,
          }),
          signal: AbortSignal.timeout(30000),
        });
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          return {
            success: false,
            error: `HTTP ${res.status}: ${body.slice(0, 200)}`,
          };
        }
        const data = await res.json();
        return {
          success: true,
          response: data.choices?.[0]?.message?.content || "",
          latency: Date.now() - start,
        };
      }
      case "anthropic": {
        const res = await fetch(`${config.baseUrl}/v1/messages`, {
          method: "POST",
          headers: {
            "x-api-key": config.apiKey,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: modelId,
            max_tokens: 10,
            messages: [{ role: "user", content: prompt }],
          }),
          signal: AbortSignal.timeout(30000),
        });
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          return {
            success: false,
            error: `HTTP ${res.status}: ${body.slice(0, 200)}`,
          };
        }
        const data = await res.json();
        return {
          success: true,
          response: data.content?.[0]?.text || "",
          latency: Date.now() - start,
        };
      }
      case "google": {
        const res = await fetch(
          `${config.baseUrl}/models/${modelId}:generateContent?key=${config.apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { maxOutputTokens: 10 },
            }),
            signal: AbortSignal.timeout(30000),
          },
        );
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          return {
            success: false,
            error: `HTTP ${res.status}: ${body.slice(0, 200)}`,
          };
        }
        const data = await res.json();
        return {
          success: true,
          response:
            data.candidates?.[0]?.content?.parts?.[0]?.text || "",
          latency: Date.now() - start,
        };
      }
      case "ollama": {
        const res = await fetch(`${config.baseUrl}/api/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: modelId,
            prompt,
            stream: false,
          }),
          signal: AbortSignal.timeout(30000),
        });
        if (!res.ok) {
          return { success: false, error: `HTTP ${res.status}` };
        }
        const data = await res.json();
        return {
          success: true,
          response: data.response || "",
          latency: Date.now() - start,
        };
      }
      default:
        return { success: false, error: "未知供应商类型" };
    }
  } catch (err: any) {
    return { success: false, error: err.message || "测试失败" };
  }
}
