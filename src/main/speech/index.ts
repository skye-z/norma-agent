import { spawn, execFile } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { app } from 'electron';
import { EventEmitter } from 'events';

let _speechExe: string | null = null;
let _activeProcess: ReturnType<typeof spawn> | null = null;
let _activeEmitter: EventEmitter | null = null;

function getSpeechExe(): string | null {
  if (_speechExe !== undefined) return _speechExe;
  const candidates = [
    join(process.resourcesPath || '', 'norma-speech-win.exe'),
    join(process.cwd(), 'resources', 'norma-speech-win.exe'),
  ];
  for (const p of candidates) {
    if (existsSync(p)) {
      _speechExe = p;
      return p;
    }
  }
  _speechExe = null;
  return null;
}

export function isSpeechAvailable(): boolean {
  return process.platform === 'win32' && !!getSpeechExe();
}

export interface SpeechResult {
  success: boolean;
  confidence: number;
  text: string;
}

export function startDictation(timeoutSec = 60): EventEmitter & { stop: () => void } {
  const exe = getSpeechExe();
  if (!exe) {
    const e = new EventEmitter() as any;
    e.stop = () => {};
    process.nextTick(() => e.emit('error', new Error('Speech bridge not available')));
    return e;
  }

  if (_activeProcess) {
    stopDictation();
  }

  const emitter = new EventEmitter() as any;
  emitter.stop = () => {
    if (_activeProcess && !_activeProcess.killed) {
      try { _activeProcess.stdin.write('STOP\n'); } catch {}
      setTimeout(() => {
        if (_activeProcess && !_activeProcess.killed) {
          _activeProcess.kill();
        }
      }, 2000);
    }
  };

  _activeEmitter = emitter;
  const proc = spawn(exe, ['--continuous', `--timeout=${timeoutSec}`], {
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  });
  _activeProcess = proc;

  let finalResult = '';

  proc.stdout.on('data', (data: Buffer) => {
    const lines = data.toString().split('\n').filter(Boolean);
    for (const line of lines) {
      if (line.startsWith('PARTIAL|')) {
        const parts = line.split('|');
        if (parts.length >= 3) {
          const confidence = parseFloat(parts[1]);
          const text = parts.slice(2).join('|');
          finalResult = text;
          emitter.emit('partial', { confidence, text });
        }
      } else if (line.startsWith('{')) {
        try {
          const result: SpeechResult = JSON.parse(line);
          if (result.success && result.text) {
            finalResult = result.text;
          }
          emitter.emit('result', result);
        } catch {}
      }
    }
  });

  proc.stderr.on('data', (data: Buffer) => {
    emitter.emit('error', new Error(data.toString().trim()));
  });

  proc.on('close', (code) => {
    _activeProcess = null;
    _activeEmitter = null;
    if (!finalResult) {
      emitter.emit('result', { success: false, confidence: 0, text: '' });
    }
    emitter.emit('done');
  });

  proc.on('error', (err) => {
    _activeProcess = null;
    _activeEmitter = null;
    emitter.emit('error', err);
  });

  return emitter;
}

export function stopDictation(): void {
  if (_activeProcess && !_activeProcess.killed) {
    try { _activeProcess.stdin.write('STOP\n'); } catch {}
    setTimeout(() => {
      if (_activeProcess && !_activeProcess.killed) {
        _activeProcess.kill();
      }
    }, 1000);
  }
}

export function recognizeOnce(timeoutSec = 30): Promise<SpeechResult> {
  const exe = getSpeechExe();
  if (!exe) return Promise.resolve({ success: false, confidence: 0, text: 'Speech bridge not available' });

  return new Promise((resolve) => {
    execFile(exe, [`--timeout=${timeoutSec}`], { timeout: (timeoutSec + 5) * 1000, windowsHide: true }, (err, stdout, stderr) => {
      if (err) {
        resolve({ success: false, confidence: 0, text: stderr?.trim() || err.message });
        return;
      }
      const lines = (stdout || '').split('\n').filter(Boolean);
      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i].trim();
        if (line.startsWith('{')) {
          try {
            resolve(JSON.parse(line));
            return;
          } catch {}
        }
      }
      resolve({ success: false, confidence: 0, text: 'No result' });
    });
  });
}
