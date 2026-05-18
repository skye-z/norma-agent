import { execSync } from 'child_process';
import { existsSync, mkdirSync, copyFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const resourcesDir = join(root, 'resources');

if (!existsSync(resourcesDir)) mkdirSync(resourcesDir, { recursive: true });

if (process.platform === 'darwin') {
  const swiftSource = join(root, 'src', 'main', 'ocr', 'macos-bridge.swift');
  const binaryOutput = join(resourcesDir, 'norma-ocr-macos');

  if (!existsSync(swiftSource)) {
    console.log('[build:ocr] Swift source not found, skipping macOS OCR bridge build');
    process.exit(0);
  }

  console.log('[build:ocr] Compiling macOS OCR bridge (Swift → Vision.framework)...');
  try {
    execSync(
      `swiftc -O -o "${binaryOutput}" "${swiftSource}" -framework Vision -framework ImageIO -framework CoreFoundation -framework Foundation`,
      { stdio: 'inherit' }
    );
    console.log(`[build:ocr] macOS OCR bridge compiled: ${binaryOutput}`);
  } catch (err) {
    console.warn('[build:ocr] Failed to compile Swift bridge. OCR will not be available on macOS.');
    console.warn('[build:ocr] Error:', err.message);
    process.exit(0);
  }
} else if (process.platform === 'win32') {
  console.log('[build:ocr] Windows OCR uses PowerShell script (no compilation needed)');
} else {
  console.log(`[build:ocr] OCR not supported on platform: ${process.platform}`);
}
