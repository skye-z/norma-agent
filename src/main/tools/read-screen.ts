import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { desktopCapturer } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { runOCR, inferWindowTitle, formatOCRForLLM } from '../ocr';
import type { TextMatch } from '../ocr';

const SCREENSHOT_DIR = path.join(os.tmpdir(), 'norma-screenshots');

async function ensureScreenshotDir() {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }
}

async function captureScreen(targetWindow?: string): Promise<{ pngBuffer: Buffer; sourceName: string }> {
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
  return { pngBuffer, sourceName: targetSource.name };
}

export const readScreenTool = createTool({
  id: 'read_screen',
  description:
    'Capture a screenshot of the current screen or a specific window and run native OCR to extract all visible text with clickable coordinates. Returns structured text data instead of images to save tokens. Use this tool when you need to check what is currently displayed on the user\'s screen.',
  inputSchema: z.object({
    reason: z
      .string()
      .optional()
      .describe('Why you are capturing the screen (for logging)'),
    targetWindow: z
      .string()
      .optional()
      .describe('Optional title of a specific window to capture. If omitted, captures the entire primary screen.'),
    includeImage: z
      .boolean()
      .optional()
      .describe('If true, also include the screenshot image for vision-capable models. Default is false (OCR only).'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    timestamp: z.string(),
    mode: z.string(),
    ocr_results: z.array(z.object({
      text: z.string(),
      x: z.number(),
      y: z.number(),
      confidence: z.number(),
      bounds: z.object({
        x: z.number(),
        y: z.number(),
        width: z.number(),
        height: z.number(),
      }),
    })),
    summary: z.object({
      window_title: z.string().nullable(),
      source_name: z.string(),
      text_count: z.number(),
      text_lines: z.array(z.string()),
    }),
    image_base64: z.string().optional(),
    error: z.string().optional(),
  }),
  execute: async ({ targetWindow, includeImage }) => {
    const timestamp = new Date().toISOString();

    try {
      const { pngBuffer, sourceName } = await captureScreen(targetWindow);

      const ocrResult = await runOCR(pngBuffer);

      if (!ocrResult.success) {
        return {
          success: false,
          timestamp,
          mode: 'ocr',
          ocr_results: [],
          summary: {
            window_title: null,
            source_name: sourceName,
            text_count: 0,
            text_lines: [],
          },
          error: ocrResult.error || 'OCR failed',
        };
      }

      const windowTitle = inferWindowTitle(ocrResult.matches);

      let imageBase64: string | undefined;
      if (includeImage) {
        imageBase64 = pngBuffer.toString('base64');
      }

      return {
        success: true,
        timestamp,
        mode: 'ocr',
        ocr_results: ocrResult.matches,
        summary: {
          window_title: windowTitle,
          source_name: sourceName,
          text_count: ocrResult.matches.length,
          text_lines: ocrResult.matches.map(m => m.text),
        },
        image_base64: imageBase64,
      };
    } catch (err: any) {
      return {
        success: false,
        timestamp,
        mode: 'ocr',
        ocr_results: [],
        summary: {
          window_title: null,
          source_name: '',
          text_count: 0,
          text_lines: [],
        },
        error: err.message || 'Unknown error',
      };
    }
  },
  toModelOutput: (output: any) => {
    if (!output.success) {
      return { type: 'text' as const, text: `Screen capture failed: ${output.error || 'Unknown error'}` };
    }

    const parts: string[] = [];

    const ocrText = formatOCRForLLM(
      output.ocr_results || [],
      output.summary?.window_title || null,
      output.timestamp,
    );
    parts.push(ocrText);

    if (output.summary?.text_lines?.length) {
      parts.push('');
      parts.push('### Full Text Content (reading order):');
      parts.push(output.summary.text_lines.join(' | '));
    }

    const text = parts.join('\n');
    return { type: 'text' as const, text };
  },
});
