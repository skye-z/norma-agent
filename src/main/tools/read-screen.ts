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

async function captureScreen(): Promise<string> {
  await ensureScreenshotDir();

  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: 1920, height: 1080 },
  });

  const primary = sources[0];
  if (!primary) {
    throw new Error('No screen source available');
  }

  const pngBuffer = primary.thumbnail.toPNG();
  const filename = `screen_${Date.now()}.png`;
  const filepath = path.join(SCREENSHOT_DIR, filename);
  fs.writeFileSync(filepath, pngBuffer);

  const base64 = pngBuffer.toString('base64');

  return base64;
}

export const readScreenTool = createTool({
  id: 'read_screen',
  description:
    'Capture a screenshot of the current screen. Returns the screenshot as an image. Use this tool when you need to see what is currently displayed on the user\'s screen.',
  inputSchema: z.object({
    reason: z
      .string()
      .optional()
      .describe('Why you are capturing the screen (for logging)'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    timestamp: z.string(),
    message: z.string(),
  }),
  execute: async () => {
    const base64 = await captureScreen();
    return {
      success: true,
      image_base64: base64,
      timestamp: new Date().toISOString(),
      message: 'Screen captured successfully',
    };
  },
  toModelOutput: (output: any) => {
    if (!output.success || !output.image_base64) {
      return { type: 'text' as const, text: output.message || 'Failed to capture screen' };
    }
    return {
      type: 'content' as const,
      value: [
        { type: 'text' as const, text: `Screenshot captured at ${output.timestamp}. Analyze this image to understand what is on the user's screen.` },
        { type: 'image-data' as const, data: output.image_base64, mimeType: 'image/png' },
      ],
    };
  },
});
