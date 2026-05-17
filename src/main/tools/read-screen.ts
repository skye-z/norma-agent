import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { desktopCapturer } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { modelSupportsVision, getCapabilitiesWithOverride } from './model-capabilities';

const SCREENSHOT_DIR = path.join(os.tmpdir(), 'norma-screenshots');

let _lastModelId: string | null = null;
let _cachedVision: boolean | null = null;
let _overrides: Record<string, any> | null = null;

export function setVisionCheckModel(modelId: string | null): void {
  if (modelId !== _lastModelId) {
    _lastModelId = modelId;
    _cachedVision = null;
  }
}

export function setModelOverrides(overrides: Record<string, any> | null): void {
  _overrides = overrides;
  _cachedVision = null;
}

function checkVision(): boolean {
  if (_cachedVision !== null) return _cachedVision;
  const caps = getCapabilitiesWithOverride(_lastModelId, _overrides);
  _cachedVision = caps.vision;
  return _cachedVision;
}

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
    'Capture a screenshot of the current screen or a specific window. For vision-capable models, returns the actual image. For text-only models, returns a text placeholder. Use this tool when you need to check what is currently displayed on the user\'s screen.',
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
    image_base64: z.string().optional(),
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
      return { type: 'text' as const, text: `[Old screenshot captured at ${output.timestamp} removed from context to save tokens]` };
    }

    if (!checkVision()) {
      return {
        type: 'text' as const,
        text: `Screenshot captured at ${output.timestamp}. [当前模型不支持图像输入，截图已保存但无法进行视觉分析。请切换到支持视觉的模型（如 GPT-4o、Claude 3.5、Gemini）以启用屏幕分析功能。]`,
      };
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
