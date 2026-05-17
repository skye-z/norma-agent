import { ipcMain, BrowserWindow, app } from 'electron';
import { setupProviderIpc } from './provider';
import { setupMemoryIpc } from './memory';
import { setupKnowledgeIpc } from './knowledge';
import { setupAutomationIpc } from './automation';
import { setupDiagIpc, appendLog } from './diag';
import { setupConfigIpc } from './config';
import { getConfig, setConfig } from '../config';

let _activeModel: string | null = null;
let _providerConfig: { providerType: string; baseUrl: string; apiKey: string } | null = null;
let _activeChatSender: Electron.WebContents | null = null;

const MAX_RESULT_STR = 2000;

function sanitizeToolResult(result: unknown): unknown {
  if (result === null || result === undefined) return result;
  if (typeof result === 'string') {
    return result.length > MAX_RESULT_STR ? result.slice(0, MAX_RESULT_STR) + '...[truncated]' : result;
  }
  if (typeof result !== 'object') return result;
  const obj = result as Record<string, unknown>;
  if ('image_base64' in obj && typeof obj.image_base64 === 'string') {
    const sizeKb = Math.round(obj.image_base64.length / 1024);
    return { ...obj, image_base64: `[截图数据已省略 ~${sizeKb}KB]` };
  }
  const cleaned: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'string' && v.length > MAX_RESULT_STR) {
      cleaned[k] = v.slice(0, 200) + '...[truncated]';
    } else {
      cleaned[k] = v;
    }
  }
  return cleaned;
}

export type StreamChunk =
  | { type: 'text-delta'; text: string }
  | { type: 'tool-call'; toolCallId: string; toolName: string; args: Record<string, unknown> }
  | { type: 'tool-result'; toolCallId: string; toolName: string; result: unknown; isError?: boolean }
  | { type: 'step-start' }
  | { type: 'step-finish' }
  | { type: 'finish' };

export async function setupIpc() {
  setupProviderIpc();
  setupMemoryIpc();
  setupKnowledgeIpc();
  setupAutomationIpc();
  setupConfigIpc();
  setupDiagIpc();

  try {
    const savedModel = await getConfig('norma-active-model');
    if (savedModel && typeof savedModel === 'string') {
      _activeModel = savedModel;
    }
    const savedConfig = await getConfig('norma-active-provider-config');
    if (savedConfig && typeof savedConfig === 'object') {
      _providerConfig = savedConfig;
    }
  } catch {}

  ipcMain.handle('system:version', () => {
    return {
      version: app.getVersion(),
      electron: process.versions.electron,
      node: process.versions.node,
      chrome: process.versions.chrome,
    };
  });

  ipcMain.handle('capabilities:list', async () => {
    try {
      const { getCapabilities } = await import('../agent');
      return await getCapabilities();
    } catch {
      return [];
    }
  });

  ipcMain.handle('agents:list', async () => {
    try {
      const { getAgentsList } = await import('../agent');
      return await getAgentsList();
    } catch {
      return [];
    }
  });

  ipcMain.handle('models:list', async () => {
    try {
      const { getModelList } = await import('../agent');
      return await getModelList();
    } catch {
      return [];
    }
  });

  ipcMain.handle('model:capabilities', async (_event, modelId: string) => {
    const { getModelCapabilities } = await import('../tools/model-capabilities');
    return getModelCapabilities(modelId);
  });

  ipcMain.handle('model:displayName', async (_event, modelId: string) => {
    const { getDisplayModelName } = await import('../tools/model-capabilities');
    return getDisplayModelName(modelId);
  });

  ipcMain.handle('model:capabilitiesWithOverride', async (_event, modelId: string) => {
    const { getCapabilitiesWithOverride } = await import('../tools/model-capabilities');
    const raw = await getConfig('norma-model-overrides');
    let overrides: Record<string, any> | null = null;
    if (raw) {
      try { overrides = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { overrides = null; }
    }
    return getCapabilitiesWithOverride(modelId, overrides);
  });

  ipcMain.handle('model:getActive', () => {
    return _activeModel;
  });

  ipcMain.handle('model:setActive', async (_event, modelString: string, providerConfig?: { providerType: string; baseUrl: string; apiKey: string }) => {
    _activeModel = modelString;
    if (providerConfig) _providerConfig = providerConfig;
    try {
      await setConfig('norma-active-model', modelString);
      if (providerConfig) {
        await setConfig('norma-active-provider-config', providerConfig);
      }
    } catch {}
    return { success: true };
  });

  ipcMain.on('window:hide', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.hide();
  });

  ipcMain.on('window:minimize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.minimize();
  });

  ipcMain.on('window:quit', () => {
    app.quit();
  });

  ipcMain.on('window:resize', (event, { width, height }: { width: number; height: number }) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      if (width <= 0 || height <= 0 || isNaN(width) || isNaN(height)) return;
      win.setSize(width, height);
    }
  });

  let _activeChatAbort: AbortController | null = null;

  ipcMain.handle('chat:cancel', () => {
    if (_activeChatAbort) {
      _activeChatAbort.abort();
      _activeChatAbort = null;
    }
    return { success: true };
  });

  ipcMain.on('chat:send', async (event, payload: string | { message: string; threadId?: string }) => {
    if (_activeChatAbort) {
      _activeChatAbort.abort();
      _activeChatAbort = null;
      if (_activeChatSender && !_activeChatSender.isDestroyed()) {
        _activeChatSender.send('chat:done');
      }
    }
    _activeChatSender = event.sender;
    const abort = new AbortController();
    _activeChatAbort = abort;

    const savedEnv: Record<string, string | undefined> = {};
    try {
      const { message, threadId } = typeof payload === 'string'
        ? { message: payload, threadId: undefined }
        : payload;

      appendLog('info', 'chat', `收到消息 (${message.length} chars)`);

      const apiKey = _providerConfig?.apiKey || '';
      const providerType = _providerConfig?.providerType || 'openai';
      const needsApiKey = providerType !== 'ollama';

      if (needsApiKey && !apiKey && !process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
        appendLog('warn', 'chat', '未配置 API Key，返回 fallback 响应');
        event.sender.send('chat:chunk', JSON.stringify({ type: 'text-delta', text: "请先在设置中配置 API Key。" }));
        event.sender.send('chat:done');
        return;
      }

      const { getAgent } = await import('../agent');
      const agent = getAgent();

      if (_providerConfig?.apiKey) {
        const pt = _providerConfig.providerType;
        if (pt === 'openai' || pt === 'openrouter' || pt === 'custom' || pt === 'longcat' || pt === 'mimo') {
          savedEnv.OPENAI_API_KEY = process.env.OPENAI_API_KEY;
          savedEnv.OPENAI_BASE_URL = process.env.OPENAI_BASE_URL;
          process.env.OPENAI_API_KEY = _providerConfig.apiKey;
          if (_providerConfig.baseUrl) process.env.OPENAI_BASE_URL = _providerConfig.baseUrl;
          else delete process.env.OPENAI_BASE_URL;
        }
        if (pt === 'deepseek') {
          savedEnv.DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
          savedEnv.OPENAI_API_KEY = process.env.OPENAI_API_KEY;
          savedEnv.OPENAI_BASE_URL = process.env.OPENAI_BASE_URL;
          process.env.DEEPSEEK_API_KEY = _providerConfig.apiKey;
          process.env.OPENAI_API_KEY = _providerConfig.apiKey;
          process.env.OPENAI_BASE_URL = _providerConfig.baseUrl || 'https://api.deepseek.com';
        }
        if (pt === 'anthropic') {
          savedEnv.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
          process.env.ANTHROPIC_API_KEY = _providerConfig.apiKey;
        }
        if (pt === 'google') {
          savedEnv.GOOGLE_GENERATIVE_AI_API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
          process.env.GOOGLE_GENERATIVE_AI_API_KEY = _providerConfig.apiKey;
        }
      }

      const streamOptions: any = {};
      if (threadId) {
        streamOptions.memory = {
          thread: threadId,
          resource: 'norma-user',
        };
      }
      if (_activeModel) {
        streamOptions.model = _activeModel;
      }

      appendLog('info', 'chat', `开始流式请求 model=${_activeModel || 'default'} threadId=${threadId || 'none'} provider=${_providerConfig?.providerType || 'none'} hasKey=${!!(_providerConfig?.apiKey || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY)}`);

      const { setVisionCheckModel } = await import('../tools/read-screen');
      setVisionCheckModel(_activeModel);

      const { setModelOverrides } = await import('../tools/read-screen');
      try {
        const rawOvr = await getConfig('norma-model-overrides');
        if (rawOvr) {
          try { setModelOverrides(typeof rawOvr === 'string' ? JSON.parse(rawOvr) : rawOvr); } catch { setModelOverrides(null); }
        } else { setModelOverrides(null); }
      } catch { setModelOverrides(null); }

      const streamStartAt = Date.now();
      let firstTokenAt = 0;
      const activeModelName = _activeModel || 'openai/gpt-4o-mini';

      const originalFetch = globalThis.fetch;
      globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (!url.includes('/responses') || !init?.body) {
          return originalFetch(input, init);
        }
        try {
          const bodyText = typeof init.body === 'string' ? init.body : await new Response(init.body).text();
          const body = JSON.parse(bodyText);
          if (body.input && Array.isArray(body.input)) {
            for (const msg of body.input) {
              if (msg.content === undefined || msg.content === null) {
                msg.content = '';
              }
            }
            const devIdx = body.input.findIndex((m: any) => m.role === 'developer');
            if (devIdx >= 0) {
              const devMsg = body.input[devIdx];
              body.instructions = typeof devMsg.content === 'string' ? devMsg.content : JSON.stringify(devMsg.content);
              body.input.splice(devIdx, 1);
            }
          }
          return originalFetch(input, { ...init, body: JSON.stringify(body) });
        } catch {
          return originalFetch(input, init);
        }
      };

      const response = await agent.stream(message, streamOptions);
      let chunkCount = 0;
      let textLen = 0;

      for await (const chunk of response.fullStream) {
        chunkCount++;
        if (abort.signal.aborted) break;
        if (chunk.type === 'text-delta') {
          const c = chunk as any;
          const text = c.payload?.text ?? c.text ?? '';
          textLen += text.length;
          if (firstTokenAt === 0 && text.length > 0) firstTokenAt = Date.now();
          event.sender.send('chat:chunk', JSON.stringify({
            type: 'text-delta',
            text: c.payload?.text ?? c.text ?? '',
          }));
        } else if (chunk.type === 'tool-call') {
          const c = chunk as any;
          const payload = c.payload ?? c;
          event.sender.send('chat:chunk', JSON.stringify({
            type: 'tool-call',
            toolCallId: payload.toolCallId,
            toolName: payload.toolName,
            args: payload.args ?? {},
          }));
          appendLog('info', 'tool', `调用工具: ${payload.toolName}`);
        } else if (chunk.type === 'tool-result') {
          const c = chunk as any;
          const payload = c.payload ?? c;
          const cleanResult = sanitizeToolResult(payload.result);
          event.sender.send('chat:chunk', JSON.stringify({
            type: 'tool-result',
            toolCallId: payload.toolCallId,
            toolName: payload.toolName,
            result: cleanResult,
            isError: payload.isError,
          }));
          appendLog('info', 'tool', `工具结果: ${payload.toolName} ${payload.isError ? '(错误)' : '(成功)'}`);
        } else if (chunk.type === 'tool-error') {
          const c = chunk as any;
          const payload = c.payload ?? c;
          event.sender.send('chat:chunk', JSON.stringify({
            type: 'tool-result',
            toolCallId: payload.toolCallId,
            toolName: payload.toolName,
            result: { error: String(payload.error) },
            isError: true,
          }));
        } else if (chunk.type === 'error') {
          const c = chunk as any;
          const errObj = c.payload ?? c;
          const errMsg = typeof errObj === 'string' ? errObj
            : (errObj?.message ?? (typeof errObj?.text === 'string' ? errObj.text : JSON.stringify(errObj)));
          appendLog('error', 'chat', `Stream 错误: ${errMsg}`);
          event.sender.send('chat:error', errMsg.slice(0, 500));
          break;
        } else if (chunk.type === 'start' || chunk.type === 'step-start' || chunk.type === 'step-finish' || chunk.type === 'finish' || chunk.type === 'text-start' || chunk.type === 'text-end' || chunk.type === 'reasoning-start' || chunk.type === 'reasoning-end' || chunk.type === 'source-start' || chunk.type === 'source-end' || chunk.type === 'tool-call-delta' || chunk.type === 'tool-call-input-streaming-end') {
        } else {
          appendLog('warn', 'chat', `未知 chunk 类型: ${chunk.type} data=${JSON.stringify(chunk).slice(0, 200)}`);
        }
      }

      let usage: any = null;
      try {
        usage = await response.usage;
      } catch {}
      if (usage) {
        event.sender.send('chat:chunk', JSON.stringify({
          type: 'usage',
          usage: {
            promptTokens: usage.inputTokens ?? 0,
            completionTokens: usage.outputTokens ?? 0,
            totalTokens: usage.totalTokens ?? 0,
            cachedTokens: usage.cachedInputTokens ?? 0,
          },
        }));
      }

      const totalStreamMs = Date.now() - streamStartAt;
      const firstTokenMs = firstTokenAt > 0 ? firstTokenAt - streamStartAt : 0;
      const { getDisplayModelName } = await import('../tools/model-capabilities');
      const displayName = getDisplayModelName(activeModelName);
      event.sender.send('chat:chunk', JSON.stringify({
        type: 'metadata',
        metadata: {
          model: activeModelName,
          displayName: displayName || activeModelName.split('/').pop() || activeModelName,
          totalStreamMs,
          firstTokenMs,
          promptTokens: usage?.inputTokens ?? 0,
          completionTokens: usage?.outputTokens ?? 0,
          totalTokens: usage?.totalTokens ?? 0,
          toolCallCount: chunkCount > 0 ? undefined : 0,
        },
      }));

      appendLog('info', 'chat', `流式完成 ${chunkCount} chunks, textLen=${textLen}, input=${usage?.inputTokens ?? '?'} output=${usage?.outputTokens ?? '?'}`);
      if (chunkCount === 0) {
        appendLog('warn', 'chat', '流式响应为空，无任何 chunk');
      }
      event.sender.send('chat:done');
    } catch (error) {
      console.error('Agent error:', error);
      const errDetail = (error as any)?.message || String(error);
      const errBody = (error as any)?.responseBody || (error as any)?.cause?.message || '';
      const cleanErr = errBody ? `${errDetail}: ${errBody}` : errDetail;
      event.sender.send('chat:error', cleanErr.slice(0, 300));
      appendLog('error', 'chat', `Agent 错误: ${cleanErr}`.slice(0, 300));
    } finally {
      globalThis.fetch = originalFetch;
      if (_activeChatAbort === abort) _activeChatAbort = null;
      for (const [k, v] of Object.entries(savedEnv)) {
        if (v === undefined) delete (process.env as any)[k];
        else (process.env as any)[k] = v;
      }
    }
  });
}
