import { ipcMain, BrowserWindow, app } from 'electron';
import { setupProviderIpc } from './provider';
import { setupMemoryIpc } from './memory';
import { setupKnowledgeIpc } from './knowledge';
import { setupAutomationIpc } from './automation';
import { setupDiagIpc, appendLog } from './diag';
import { setupConfigIpc } from './config';

let _activeModel: string | null = null;
let _providerConfig: { providerType: string; baseUrl: string; apiKey: string } | null = null;

export type StreamChunk =
  | { type: 'text-delta'; text: string }
  | { type: 'tool-call'; toolCallId: string; toolName: string; args: Record<string, unknown> }
  | { type: 'tool-result'; toolCallId: string; toolName: string; result: unknown; isError?: boolean }
  | { type: 'step-start' }
  | { type: 'step-finish' }
  | { type: 'finish' };

export function setupIpc() {
  setupProviderIpc();
  setupMemoryIpc();
  setupKnowledgeIpc();
  setupAutomationIpc();
  setupConfigIpc();
  setupDiagIpc();

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

  ipcMain.handle('model:getActive', () => {
    return _activeModel;
  });

  ipcMain.handle('model:setActive', (_event, modelString: string, providerConfig?: { providerType: string; baseUrl: string; apiKey: string }) => {
    _activeModel = modelString;
    if (providerConfig) _providerConfig = providerConfig;
    return { success: true };
  });

  ipcMain.on('window:hide', () => {
    const win = BrowserWindow.getFocusedWindow();
    if (win) win.hide();
  });

  ipcMain.on('window:minimize', () => {
    BrowserWindow.getFocusedWindow()?.minimize();
  });

  ipcMain.on('window:quit', () => {
    app.quit();
  });

  ipcMain.on('window:resize', (_event, { width, height }: { width: number; height: number }) => {
    const win = BrowserWindow.getFocusedWindow();
    if (win) win.setSize(width, height);
  });

  ipcMain.on('chat:send', async (event, payload: string | { message: string; threadId?: string }) => {
    try {
      const { message, threadId } = typeof payload === 'string'
        ? { message: payload, threadId: undefined }
        : payload;

      appendLog('info', 'chat', `收到消息: ${message.slice(0, 100)}${message.length > 100 ? '...' : ''}`);

      const apiKey = _providerConfig?.apiKey || '';
      const baseUrl = _providerConfig?.baseUrl || '';
      const providerType = _providerConfig?.providerType || 'openai';
      const needsApiKey = providerType !== 'ollama';

      if (needsApiKey && !apiKey && !process.env.OPENAI_API_KEY) {
        appendLog('warn', 'chat', '未配置 API Key，返回 fallback 响应');
        event.sender.send('chat:chunk', JSON.stringify({ type: 'text-delta', text: "OPENAI_API_KEY is not configured.\n\n" }));
        event.sender.send('chat:chunk', JSON.stringify({ type: 'text-delta', text: "I received your message: \"" + message + "\"\n\n" }));
        event.sender.send('chat:chunk', JSON.stringify({ type: 'text-delta', text: "Please set your API key in a .env file to enable real intelligence." }));
        event.sender.send('chat:done');
        return;
      }

      const { getAgent } = await import('../agent');
      const agent = getAgent();

      if (_providerConfig?.apiKey) {
        const pt = _providerConfig.providerType;
        if (pt === 'openai' || pt === 'deepseek' || pt === 'openrouter' || pt === 'custom') {
          process.env.OPENAI_API_KEY = _providerConfig.apiKey;
          if (_providerConfig.baseUrl) process.env.OPENAI_BASE_URL = _providerConfig.baseUrl;
          else delete process.env.OPENAI_BASE_URL;
        }
        if (pt === 'anthropic') {
          process.env.ANTHROPIC_API_KEY = _providerConfig.apiKey;
        }
        if (pt === 'google') {
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

      appendLog('info', 'chat', `开始流式请求 model=${_activeModel || 'default'} threadId=${threadId || 'none'}`);

      const response = await agent.stream(message, streamOptions);

      for await (const chunk of response.fullStream) {
        if (chunk.type === 'text-delta') {
          const c = chunk as any;
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
          event.sender.send('chat:chunk', JSON.stringify({
            type: 'tool-result',
            toolCallId: payload.toolCallId,
            toolName: payload.toolName,
            result: payload.result,
            isError: payload.isError,
          }));
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

      appendLog('info', 'chat', `流式完成 input=${usage?.inputTokens ?? '?'} output=${usage?.outputTokens ?? '?'}`);
      event.sender.send('chat:done');
    } catch (error) {
      console.error('Agent error:', error);
      event.sender.send('chat:error', String(error));
      appendLog('error', 'chat', `Agent 错误: ${String(error)}`);
    }
  });
}
