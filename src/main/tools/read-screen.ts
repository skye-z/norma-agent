import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { desktopCapturer, BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const SCREENSHOT_DIR = path.join(os.tmpdir(), 'norma-screenshots');

async function ensureScreenshotDir() {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }
}

let lastCaptureTimestamp: string = '';

async function captureScreen(targetWindow?: string): Promise<string> {
  await ensureScreenshotDir();

  const types = targetWindow ? ['window', 'screen'] : ['screen'];
  const sources = await desktopCapturer.getSources({
    types: types as any,
    thumbnailSize: { width: 1920, height: 1080 },
  });

  let targetSource = sources[0];
  if (targetWindow) {
    targetSource = sources.find(s => s.name.toLowerCase().includes(targetWindow.toLowerCase())) || sources[0];
  }

  if (!targetSource) {
    throw new Error('No screen or window source available');
  }

  const pngBuffer = targetSource.thumbnail.toPNG();
  const filename = `screen_${Date.now()}.png`;
  const filepath = path.join(SCREENSHOT_DIR, filename);
  fs.writeFileSync(filepath, pngBuffer);

  const base64 = pngBuffer.toString('base64');
  return base64;
}

export const readScreenTool = createTool({
  id: 'read_screen',
  description:
    'Capture a screenshot of the current screen or a specific window. Returns the screenshot as an image. Use this tool when you need to see what is currently displayed on the user\'s screen.',
  inputSchema: z.object({
    reason: z
      .string()
      .optional()
      .describe('Why you are capturing the screen (for logging)'),
    targetWindow: z
      .string()
      .optional()
      .describe('Optional title of a specific window to capture. If omitted, captures the entire primary screen.'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    timestamp: z.string(),
    message: z.string(),
  }),
  execute: async ({ targetWindow }) => {
    const base64 = await captureScreen(targetWindow);
    const timestamp = new Date().toISOString();
    lastCaptureTimestamp = timestamp;

    return {
      success: true,
      image_base64: base64,
      timestamp,
      message: targetWindow ? `Captured window matching "${targetWindow}"` : 'Screen captured successfully',
    };
  },
  toModelOutput: (output: any) => {
    if (!output.success || !output.image_base64) {
      return { type: 'text' as const, text: output.message || 'Failed to capture screen' };
    }

    if (output.timestamp !== lastCaptureTimestamp) {
      // This is an old screenshot from history. We drop the image to save context tokens.
      return { type: 'text' as const, text: `[Old screenshot captured at ${output.timestamp} removed from context to save tokens]` };
    }

    // This is the latest screenshot
    return {
      type: 'content' as const,
      value: [
        { type: 'text' as const, text: `Screenshot captured at ${output.timestamp}. Analyze this image to understand what is on the user's screen.` },
        { type: 'image-data' as const, data: output.image_base64, mimeType: 'image/png' },
      ],
    };
  },
});
