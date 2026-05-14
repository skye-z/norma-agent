import { ipcMain } from 'electron';
import { mastra } from '../agent';

export function setupIpc() {
  ipcMain.on('chat:send', async (event, message: string) => {
    try {
      const agent = mastra.getAgent('normaRouter');
      
      // If OPENAI_API_KEY is not configured, we provide a graceful fallback for the MVP
      if (!process.env.OPENAI_API_KEY) {
        event.sender.send('chat:chunk', "⚠️ OPENAI_API_KEY is not configured in your environment.\n\n");
        event.sender.send('chat:chunk', "I received your message: `" + message + "`\n\n");
        event.sender.send('chat:chunk', "Please set your API key in a `.env` file to enable real intelligence.");
        event.sender.send('chat:done');
        return;
      }

      // Start streaming from the agent
      const response = await agent.stream(message);

      // Iterate through the text chunks and send them to the renderer
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
