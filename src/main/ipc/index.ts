import { ipcMain, BrowserWindow, app } from 'electron';
import { setupProviderIpc } from './provider';

export type StreamChunk =
  | { type: 'text-delta'; text: string }
  | { type: 'tool-call'; toolCallId: string; toolName: string; args: Record<string, unknown> }
  | { type: 'tool-result'; toolCallId: string; toolName: string; result: unknown; isError?: boolean }
  | { type: 'step-start' }
  | { type: 'step-finish' }
  | { type: 'finish' };

export function setupIpc() {
  setupProviderIpc();
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

  ipcMain.on('chat:send', async (event, message: string) => {
    try {
      if (!process.env.OPENAI_API_KEY) {
        event.sender.send('chat:chunk', JSON.stringify({ type: 'text-delta', text: "OPENAI_API_KEY is not configured.\n\n" }));
        event.sender.send('chat:chunk', JSON.stringify({ type: 'text-delta', text: "I received your message: \"" + message + "\"\n\n" }));
        event.sender.send('chat:chunk', JSON.stringify({ type: 'text-delta', text: "Please set your API key in a .env file to enable real intelligence." }));
        event.sender.send('chat:done');
        return;
      }

      const { getAgent } = await import('../agent');
      const agent = getAgent();
      const response = await agent.stream(message);

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

      event.sender.send('chat:done');
    } catch (error) {
      console.error('Agent error:', error);
      event.sender.send('chat:error', String(error));
    }
  });
}
