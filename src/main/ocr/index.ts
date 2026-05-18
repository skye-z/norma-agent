import { execFile } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { promisify } from 'util';
import type { TextMatch, OCRResult } from './types';

const execFileAsync = promisify(execFile);

const IS_MAC = process.platform === 'darwin';
const IS_WIN = process.platform === 'win32';

function getBridgePath(): string {
  if (IS_MAC) {
    const projectResources = path.join(process.cwd(), 'resources');
    const bundled = process.resourcesPath
      ? path.join(process.resourcesPath, 'norma-ocr-macos')
      : null;
    if (bundled && fs.existsSync(bundled)) return bundled;
    return path.join(projectResources, 'norma-ocr-macos');
  }
  if (IS_WIN) {
    return path.join(process.cwd(), 'src', 'main', 'ocr', 'win-ocr.ps1');
  }
  throw new Error(`OCR not supported on platform: ${process.platform}`);
}

async function runMacOSOCR(pngBuffer: Buffer, scale: number): Promise<OCRResult> {
  const bridgePath = getBridgePath();

  if (!fs.existsSync(bridgePath)) {
    return { success: false, matches: [], error: `OCR bridge not found at ${bridgePath}. Run 'npm run build:ocr' first.` };
  }

  try {
    const result = await execFileAsync(bridgePath, [String(scale)], {
      input: pngBuffer,
      maxBuffer: 50 * 1024 * 1024,
      timeout: 15000,
    });

    return JSON.parse(result.stdout) as OCRResult;
  } catch (err: any) {
    const stderr = err.stderr || err.message || '';
    if (stderr.includes('Vision framework not available')) {
      return { success: false, matches: [], error: 'macOS Vision framework not available (requires macOS 10.15+)' };
    }
    return { success: false, matches: [], error: `macOS OCR bridge failed: ${stderr}` };
  }
}

async function runWindowsOCR(pngBuffer: Buffer, scale: number): Promise<OCRResult> {
  const scriptPath = getBridgePath();
  const tmpDir = path.join(os.tmpdir(), 'norma-ocr');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  const tmpFile = path.join(tmpDir, `ocr_input_${Date.now()}.png`);
  fs.writeFileSync(tmpFile, pngBuffer);

  try {
    const result = await execFileAsync('powershell.exe', [
      '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
      '-File', scriptPath, tmpFile, String(scale),
    ], {
      maxBuffer: 50 * 1024 * 1024,
      timeout: 30000,
    });

    return JSON.parse(result.stdout) as OCRResult;
  } catch (err: any) {
    const stderr = err.stderr || err.message || '';
    return { success: false, matches: [], error: `Windows OCR bridge failed: ${stderr}` };
  } finally {
    try { fs.unlinkSync(tmpFile); } catch {}
  }
}

export async function runOCR(pngBuffer: Buffer, scale?: number): Promise<OCRResult> {
  const resolvedScale = scale ?? (IS_MAC ? 2.0 : 1.0);

  if (IS_MAC) return runMacOSOCR(pngBuffer, resolvedScale);
  if (IS_WIN) return runWindowsOCR(pngBuffer, resolvedScale);

  return { success: false, matches: [], error: `Unsupported platform: ${process.platform}` };
}

export function inferWindowTitle(matches: TextMatch[]): string | null {
  if (matches.length === 0) return null;

  const sortedByY = [...matches].sort((a, b) => a.bounds.y - b.bounds.y);
  const topThreshold = 40;
  const topTexts = sortedByY.filter(m => m.bounds.y < topThreshold && m.confidence > 0.5);

  if (topTexts.length > 0) {
    const largest = topTexts.reduce((a, b) =>
      (a.bounds.width * a.bounds.height) > (b.bounds.width * b.bounds.height) ? a : b
    );
    return largest.text.trim();
  }

  return null;
}

export function formatOCRForLLM(matches: TextMatch[], windowTitle: string | null, timestamp: string): string {
  const filtered = matches.filter(m => m.confidence > 0.5);

  const lines = filtered.map(m => {
    const x = Math.round(m.x);
    const y = Math.round(m.y);
    const bx = Math.round(m.bounds.x);
    const by = Math.round(m.bounds.y);
    const bw = Math.round(m.bounds.width);
    const bh = Math.round(m.bounds.height);
    return `- "${m.text}" at (${x}, ${y}) bounds: {x:${bx}, y:${by}, w:${bw}, h:${bh}}`;
  });

  return [
    `## Screen OCR Results (${filtered.length} text elements detected)`,
    `Window: ${windowTitle || 'Unknown'}`,
    `Timestamp: ${timestamp}`,
    '',
    '### Detected Text (coordinates are screen points, use directly with execute_action click):',
    ...lines,
  ].join('\n');
}

export type { TextMatch, TextBounds, OCRResult } from './types';
