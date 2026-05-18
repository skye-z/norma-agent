import { ipcMain, BrowserWindow, app, dialog, shell } from 'electron';
import { setupProviderIpc } from './provider';
import { setupMemoryIpc } from './memory';
import { setupKnowledgeIpc } from './knowledge';
import { setupAutomationIpc } from './automation';
import { setupDiagIpc, appendLog } from './diag';
import { setupConfigIpc } from './config';
import { getConfig, setConfig } from '../config';
import { isSpeechAvailable, startDictation, stopDictation, recognizeOnce } from '../speech';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';

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
      speechAvailable: isSpeechAvailable(),
    };
  });

  ipcMain.handle('speech:available', () => isSpeechAvailable());

  ipcMain.handle('speech:start', async (_event, timeoutSec?: number) => {
    if (!isSpeechAvailable()) return { started: false, error: 'Speech not available' };
    try {
      const emitter = startDictation(timeoutSec || 60);
      const sender = _activeChatSender || BrowserWindow.getFocusedWindow()?.webContents;
      emitter.on('partial', (data: { confidence: number; text: string }) => {
        sender?.send('speech:partial', data);
      });
      emitter.on('result', (data: { success: boolean; confidence: number; text: string }) => {
        sender?.send('speech:result', data);
      });
      emitter.on('done', () => {
        sender?.send('speech:done');
      });
      emitter.on('error', (err: Error) => {
        sender?.send('speech:error', err.message);
      });
      return { started: true };
    } catch (e: any) {
      return { started: false, error: e.message };
    }
  });

  ipcMain.handle('speech:stop', () => {
    stopDictation();
    return { stopped: true };
  });

  ipcMain.handle('speech:recognize', async (_event, timeoutSec?: number) => {
    return await recognizeOnce(timeoutSec || 30);
  });

  ipcMain.handle('system:selectDirectory', async (event) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender);
      const result = await dialog.showOpenDialog(win!, {
        properties: ['openDirectory', 'createDirectory'],
      });
      if (result.canceled || result.filePaths.length === 0) return null;
      return result.filePaths[0];
    } catch {
      return null;
    }
  });

  ipcMain.handle('system:moveDataDir', async (_event, newDir: string) => {
    try {
      const oldDir = app.getPath('userData');
      if (!fsSync.existsSync(newDir)) {
        fsSync.mkdirSync(newDir, { recursive: true });
      }
      const filesToMove = ['norma-memory.db', 'norma-config.db'];
      for (const file of filesToMove) {
        const extensions = ['', '-wal', '-shm'];
        for (const ext of extensions) {
          const src = path.join(oldDir, file + ext);
          const dst = path.join(newDir, file + ext);
          try {
            await fs.access(src);
            await fs.rename(src, dst);
          } catch {}
        }
      }
      await setConfig('norma:data-dir', newDir);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('system:openExternal', async (_event, url: string) => {
    await shell.openExternal(url);
    return true;
  });

  const DEFAULT_MEMORY_CONFIG = {
    lastMessages: 20,
    semanticRecall: true,
    semanticTopK: 3,
    semanticMessageRange: 2,
    workingMemory: true,
    generateTitle: true,
  };

  ipcMain.handle('config:getMemoryConfig', async () => {
    const saved = await getConfig('norma:memory-config');
    if (saved && typeof saved === 'object') return { ...DEFAULT_MEMORY_CONFIG, ...saved };
    return { ...DEFAULT_MEMORY_CONFIG };
  });

  ipcMain.handle('config:setMemoryConfig', async (_event, config: any) => {
    const merged = { ...DEFAULT_MEMORY_CONFIG, ...config };
    await setConfig('norma:memory-config', merged);
    try {
      const { reconfigureMemory } = await import('../agent');
      await reconfigureMemory(merged);
    } catch {}
    return { success: true };
  });

  ipcMain.handle('capabilities:list', async () => {
    try {
      const { getCapabilities } = await import('../agent');
      return await getCapabilities();
    } catch {
      return [];
    }
  });

  ipcMain.handle('tool:test', async (_event, toolId: string, userArgs?: Record<string, any>) => {
    try {
      const { testTool } = await import('../agent');
      return await testTool(toolId, userArgs);
    } catch (e: any) {
      return { success: false, output: null, duration: 0, error: e.message };
    }
  });

  ipcMain.handle('tool:inputFields', async (_event, toolId: string) => {
    try {
      const { getToolInputFields } = await import('../agent');
      return getToolInputFields(toolId);
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

      let disabledTools: string[] = [];
      try {
        const { configStore } = await import('../config');
        disabledTools = (await configStore.get('tools:disabled')) || [];
      } catch {}
      if (Array.isArray(disabledTools) && disabledTools.length > 0) {
        const allToolIds = Object.keys((agent as any).tools || {});
        streamOptions.activeTools = allToolIds.filter((id: string) => !disabledTools.includes(id));
        appendLog('info', 'chat', `已禁用工具: ${disabledTools.join(', ')}, 可用: ${streamOptions.activeTools.length}`);
      }

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
        if (_providerConfig?.baseUrl) {
          streamOptions.model = {
            id: _activeModel,
            url: _providerConfig.baseUrl,
            apiKey: _providerConfig.apiKey,
          };
        } else {
          streamOptions.model = _activeModel;
        }
      }

      appendLog('info', 'chat', `开始流式请求 model=${_activeModel || 'default'} threadId=${threadId || 'none'} provider=${_providerConfig?.providerType || 'none'} hasKey=${!!(_providerConfig?.apiKey || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY)}`);

      const streamStartAt = Date.now();
      let firstTokenAt = 0;
      const activeModelName = _activeModel || 'openai/gpt-4o-mini';

      const originalFetch = globalThis.fetch;
      const needsResponsesFallback = providerType !== 'openai' || !!_providerConfig?.baseUrl;
      function extractResponsesContent(content: any): string {
        if (!content) return '';
        if (typeof content === 'string') return content;
        if (Array.isArray(content)) {
          return content
            .filter((p: any) => p.type === 'output_text' || p.type === 'input_text' || p.type === 'text')
            .map((p: any) => p.text || '')
            .join('');
        }
        return JSON.stringify(content);
      }
      function sanitizeChatMessages(messages: any[]): any[] {
        return messages.map((msg: any) => {
          if (!msg || typeof msg !== 'object') return msg;
          if (msg.role === 'assistant') {
            const fixed: any = { ...msg };
            if (fixed.content === undefined || fixed.content === null) {
              fixed.content = '';
            }
            return fixed;
          }
          if (msg.role === 'tool') {
            const fixed: any = { ...msg };
            if (fixed.content === undefined || fixed.content === null) {
              fixed.content = '';
            }
            return fixed;
          }
          if (msg.role === 'user') {
            const fixed: any = { ...msg };
            if (fixed.content === undefined || fixed.content === null) {
              fixed.content = '';
            } else if (Array.isArray(fixed.content)) {
              fixed.content = fixed.content.map((p: any) => {
                if (typeof p === 'string') return p;
                if (p && p.type === 'text') return p;
                if (p && p.text) return { type: 'text', text: p.text };
                return null;
              }).filter(Boolean);
              if (fixed.content.length === 0) fixed.content = '';
            }
            return fixed;
          }
          if (msg.role === 'system') {
            const fixed: any = { ...msg };
            if (fixed.content === undefined || fixed.content === null) {
              fixed.content = '';
            }
            return fixed;
          }
          if (!msg.role) return null;
          if (msg.content === undefined || msg.content === null) {
            msg.content = '';
          }
          return msg;
        }).filter(Boolean);
      }
      globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString();
        const isChatCompletions = url.includes('/chat/completions');
        const isResponses = url.includes('/responses');
        if ((!isChatCompletions && !isResponses) || !init?.body) {
          return originalFetch(input, init);
        }
        if (isChatCompletions) {
          try {
            const bodyText = typeof init.body === 'string' ? init.body : await new Response(init.body).text();
            const body = JSON.parse(bodyText);
            if (body.messages && Array.isArray(body.messages)) {
              let fixed = 0;
              for (let i = 0; i < body.messages.length; i++) {
                const m = body.messages[i];
                if (!m || typeof m !== 'object' || !m.role) {
                  appendLog('warn', 'chat', `messages[${i}] no role, removing`);
                  body.messages.splice(i, 1);
                  i--; fixed++;
                  continue;
                }
                if (m.content === undefined || m.content === null) {
                  appendLog('warn', 'chat', `messages[${i}] role=${m.role} content=${m.content === undefined ? 'undefined' : 'null'}, fixing to ''`);
                  m.content = '';
                  fixed++;
                }
              }
              if (fixed > 0) appendLog('info', 'chat', `ChatCompletions 消息修补: 修复 ${fixed} 条`);
              return originalFetch(url, { ...init, body: JSON.stringify(body) });
            }
          } catch (e: any) {
            appendLog('error', 'chat', `ChatCompletions 拦截失败: ${e.message}`);
          }
          return originalFetch(input, init);
        }
        if (!needsResponsesFallback) {
          return originalFetch(input, init);
        }
        try {
          const bodyText = typeof init.body === 'string' ? init.body : await new Response(init.body).text();
          const body = JSON.parse(bodyText);
          const messages: any[] = [];
          if (body.instructions) {
            messages.push({ role: 'system', content: body.instructions });
          }
          if (body.input && Array.isArray(body.input)) {
            for (const msg of body.input) {
              if (!msg || typeof msg !== 'object') continue;
              if (msg.type === 'function_call') {
                messages.push({
                  role: 'assistant',
                  content: null,
                  tool_calls: [{ id: msg.call_id, type: 'function', function: { name: msg.name, arguments: typeof msg.arguments === 'string' ? msg.arguments : JSON.stringify(msg.arguments) } }],
                });
                continue;
              }
              if (msg.type === 'function_call_output') {
                messages.push({
                  role: 'tool',
                  tool_call_id: msg.call_id,
                  content: typeof msg.output === 'string' ? msg.output : JSON.stringify(msg.output ?? ''),
                });
                continue;
              }
              if (msg.type === 'item_reference' || msg.type === 'reasoning' || msg.type === 'reasoning_summary_part' || msg.type === 'tool_search_call' || msg.type === 'tool_search_output' || msg.type === 'shell_call' || msg.type === 'shell_call_output' || msg.type === 'local_shell_call' || msg.type === 'custom_tool_call') {
                continue;
              }
              if (!msg.role) continue;
              if (msg.role === 'developer') {
                const textContent = extractResponsesContent(msg.content);
                messages.push({ role: 'system', content: textContent });
                continue;
              }
              if (msg.role === 'assistant') {
                let text = extractResponsesContent(msg.content);
                const prevAssistant = messages.length > 0 && messages[messages.length - 1].role === 'assistant'
                  ? messages[messages.length - 1] : null;
                if (prevAssistant) {
                  if (text) {
                    prevAssistant.content = prevAssistant.content ? prevAssistant.content + text : text;
                  }
                  continue;
                }
                messages.push({ role: 'assistant', content: text || null });
                continue;
              }
              if (msg.role === 'user') {
                const textContent = extractResponsesContent(msg.content);
                messages.push({ role: 'user', content: textContent || '' });
                continue;
              }
              if (msg.role === 'system') {
                const textContent = extractResponsesContent(msg.content);
                messages.push({ role: 'system', content: textContent || '' });
                continue;
              }
            }
          }
          const chatBody: any = {
            model: body.model,
            messages,
            stream: body.stream ?? true,
          };
          if (body.tools && Array.isArray(body.tools)) {
            chatBody.tools = body.tools.map((t: any) => {
              if (t.type === 'function' && t.function) return t;
              if (t.name && t.parameters) {
                return { type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } };
              }
              return t;
            });
          }
          if (body.tool_choice) {
            chatBody.tool_choice = body.tool_choice === 'auto' || body.tool_choice === 'required' || body.tool_choice === 'none'
              ? body.tool_choice
              : { type: 'function', function: { name: body.tool_choice } };
          }
          if (body.temperature !== undefined) chatBody.temperature = body.temperature;
          if (body.max_output_tokens !== undefined) chatBody.max_tokens = body.max_output_tokens;
          const chatUrl = url.replace('/responses', '/chat/completions');
          appendLog('info', 'chat', `Responses→ChatCompletions 转换: ${url} → ${chatUrl}`);
          return originalFetch(chatUrl, { ...init, body: JSON.stringify(chatBody) });
        } catch (e) {
          appendLog('error', 'chat', `Responses 转换失败: ${e}`);
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
          const errObj = c.payload ?? c.error ?? c;
          const errMsg = typeof errObj === 'string' ? errObj
            : (errObj?.message ?? errObj?.error?.message ?? (typeof errObj?.text === 'string' ? errObj.text : JSON.stringify(errObj)));
          appendLog('error', 'chat', `Stream 错误: ${errMsg}`);
          event.sender.send('chat:error', errMsg.slice(0, 500));
          break;
        } else if (chunk.type === 'start' || chunk.type === 'step-start' || chunk.type === 'step-finish' || chunk.type === 'finish' || chunk.type === 'text-start' || chunk.type === 'text-end' || chunk.type === 'reasoning-start' || chunk.type === 'reasoning-end' || chunk.type === 'reasoning-delta' || chunk.type === 'source-start' || chunk.type === 'source-end' || chunk.type === 'tool-call-delta' || chunk.type === 'tool-call-input-streaming-start' || chunk.type === 'tool-call-input-streaming-end') {
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
          cachedTokens: usage?.cachedInputTokens ?? 0,
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
