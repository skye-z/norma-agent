import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { desktopCapturer, screen } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { runOCR, inferWindowTitle, formatOCRForLLM } from '../ocr';
import type { TextMatch } from '../ocr';
import { appendLog } from '../ipc/diag';

const SCREENSHOT_DIR = path.join(os.tmpdir(), 'norma-screenshots');

async function ensureScreenshotDir() {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }
}

function getNativeResolution() {
  try {
    const display = screen.getPrimaryDisplay();
    return { width: Math.max(display.size.width, 1920), height: Math.max(display.size.height, 1080) };
  } catch {
    return { width: 2560, height: 1440 };
  }
}

async function captureScreen(targetWindow?: string): Promise<{ pngBuffer: Buffer; sourceName: string }> {
  await ensureScreenshotDir();

  const res = getNativeResolution();
  const types = targetWindow ? ['window', 'screen'] : ['screen'];
  const sources = await desktopCapturer.getSources({
    types: types as any,
    thumbnailSize: { width: res.width, height: res.height },
  });

  let targetSource = sources[0];
  if (targetWindow) {
    const target = targetWindow.toLowerCase();
    const match = sources.find(s => s.name.toLowerCase().includes(target));
    if (match) {
      targetSource = match;
    } else {
      const words = target.split(/\s+/).filter(w => w.length > 2);
      const fuzzyMatch = sources.find(s => {
        const n = s.name.toLowerCase();
        return words.some(w => n.includes(w));
      });
      if (fuzzyMatch) targetSource = fuzzyMatch;
    }
  }

  if (!targetSource) {
    throw new Error('No screen or window source available');
  }

  const pngBuffer = targetSource.thumbnail.toPNG();
  return { pngBuffer, sourceName: targetSource.name };
}

function filterOcrResults(matches: TextMatch[]): TextMatch[] {
  return matches.filter(m => {
    if (m.text.trim().length < 2) return false;
    const area = m.bounds.width * m.bounds.height;
    if (area < 20) return false;
    if (m.bounds.width < 8 || m.bounds.height < 5) return false;
    return true;
  });
}

export const readScreenTool = createTool({
  id: 'read_screen',
  description:
    '截取屏幕或指定窗口的截图并使用原生 OCR 提取可见文本及其坐标。' +
    '【重要】必须指定 targetWindow 参数！全屏 OCR 会产生大量噪声和碎片文本，几乎不可用。' +
    '先用 list_windows 获取窗口名称，再传给 targetWindow（支持部分匹配）。' +
    '仅在极少数需要了解整个桌面布局的场景下才可省略 targetWindow。',
  inputSchema: z.object({
    reason: z
      .string()
      .optional()
      .describe('Why you are capturing the screen (for logging)'),
    targetWindow: z
      .string()
      .describe('要截取的窗口名称（来自 list_windows 的返回值，支持部分匹配）。必填。全屏 OCR 会产生大量噪声碎片，几乎不可用。先用 list_windows 获取窗口名称，再填入此参数。'),
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
    appendLog('info', 'ocr', `read_screen called: targetWindow="${targetWindow || '(none)'}" includeImage=${includeImage}`);

    try {
      const { pngBuffer, sourceName } = await captureScreen(targetWindow);
      appendLog('info', 'ocr', `Captured: source="${sourceName}" size=${pngBuffer.length} bytes`);

      const ocrResult = await runOCR(pngBuffer);
      appendLog('info', 'ocr', `OCR result: success=${ocrResult.success} rawMatches=${ocrResult.matches?.length || 0}`);

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
      const filtered = filterOcrResults(ocrResult.matches);
      appendLog('info', 'ocr', `Filtered: ${ocrResult.matches.length} -> ${filtered.length} matches, source="${sourceName}"`);

      let imageBase64: string | undefined;
      if (includeImage) {
        imageBase64 = pngBuffer.toString('base64');
      }

      const isFullScreen = !targetWindow;

      return {
        success: true,
        timestamp,
        mode: 'ocr',
        ocr_results: filtered,
        summary: {
          window_title: windowTitle,
          source_name: isFullScreen ? '整个屏幕' : sourceName,
          text_count: filtered.length,
          text_lines: filtered.map(m => m.text),
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
    const outSuccess = output?.success;
    const outCount = output?.summary?.text_count;
    appendLog('info', 'ocr', `toModelOutput: success=${outSuccess} text_count=${outCount}`);

    if (!output?.success) {
      return { type: 'text' as const, text: `Screen capture failed: ${output.error || 'Unknown error'}` };
    }

    const sourceInfo = output.summary?.source_name || '整个屏幕';
    const isTargeted = sourceInfo !== '整个屏幕' && sourceInfo !== 'Entire Screen';
    const title = isTargeted ? `OCR: "${sourceInfo}"` : 'OCR: 全屏';

    const ocrText = formatOCRForLLM(
      output.ocr_results || [],
      output.summary?.window_title || null,
      output.timestamp,
    );

    const header = `${title} (${output.summary?.text_count || 0} text elements)`;
    const text = header + '\n' + ocrText;
    return { type: 'text' as const, text };
  },
});
