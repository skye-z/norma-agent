import { ipcMain, BrowserWindow, app } from 'electron';

export function setupIpc() {
  ipcMain.on('window:hide', () => {
    BrowserWindow.getFocusedWindow()?.close();
  });

  ipcMain.on('window:minimize', () => {
    BrowserWindow.getFocusedWindow()?.minimize();
  });

  ipcMain.on('window:quit', () => {
    app.quit();
  });

  ipcMain.on('chat:send', async (event, message: string) => {
    try {
      if (!process.env.OPENAI_API_KEY) {
        event.sender.send('chat:chunk', "OPENAI_API_KEY is not configured.\n\n");
        event.sender.send('chat:chunk', "I received your message: \"" + message + "\"\n\n");
        event.sender.send('chat:chunk', "Please set your API key in a .env file to enable real intelligence.");
        event.sender.send('chat:done');
        return;
      }

      const { mastra } = await import('../agent');
      const agent = mastra.getAgent('normaRouter');
      const response = await agent.stream(message);

      for await (const chunk of response.textStream) {
        event.sender.send('chat:chunk', chunk);
      }

      event.sender.send('chat:done');
    } catch (error) {
      console.error('Agent error:', error);
      event.sender.send('chat:error', String(error));
    }
  });
}
