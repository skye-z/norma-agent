import { execSync } from 'child_process';
import { existsSync, mkdirSync, copyFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const root = join(__dirname, '..');
const resourcesDir = join(root, 'resources');
if (!existsSync(resourcesDir)) mkdirSync(resourcesDir, { recursive: true });

if (process.platform === 'darwin') {
  const swiftSource = join(root, 'src', 'main', 'ocr', 'macos-bridge.swift');
  const exeOutput = join(resourcesDir, 'norma-ocr-macos');

  if (!existsSync(swiftSource)) {
    console.log('[build:ocr] Swift source not found, skipping macOS OCR bridge build');
    process.exit(0);
  }

  console.log('[build:ocr] Compiling macOS OCR bridge (Swift → Vision)...');
  try {
    execSync(`swiftc -o "${exeOutput}" "${swiftSource}" -framework Vision -framework Foundation`, { stdio: 'inherit' });
    console.log(`[build:ocr] macOS OCR bridge compiled: ${exeOutput}`);
  } catch (err) {
    console.warn('[build:ocr] Failed to compile Swift bridge. OCR will not be available on macOS.');
    console.warn('[build:ocr] Error:', err.message);
    process.exit(0);
  }

} else if (process.platform === 'win32') {
  const csharpSource = join(root, 'src', 'main', 'ocr', 'win-ocr.cs');

  if (!existsSync(csharpSource)) {
    console.log('[build:ocr] C# source not found, skipping Windows OCR bridge build');
    process.exit(0);
  }

  console.log('[build:ocr] Compiling Windows OCR bridge (C# → WinRT)...');

  let csc = join(process.env.SYSTEMROOT || 'C:\\Windows', 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe');

  const roslynCsc = join(root, '.roslyn', 'Microsoft.Net.Compilers.Toolset.4.8.0', 'tasks', 'net472', 'csc.exe');
  if (existsSync(roslynCsc)) {
    csc = roslynCsc;
    console.log(`[build:ocr] Using Roslyn compiler: ${csc}`);
  } else {
    console.log('[build:ocr] Downloading Roslyn compiler...');
    mkdirSync(join(root, '.roslyn'), { recursive: true });

    const nugetUrl = 'https://dist.nuget.org/win-x86-commandline/latest/nuget.exe';
    const nugetExe = join(root, '.roslyn', 'nuget.exe');

    try {
      execSync(`curl -sL -o "${nugetExe}" "${nugetUrl}"`, { stdio: 'inherit' });
      execSync(`"${nugetExe}" install Microsoft.Net.Compilers.Toolset -OutputDirectory "${join(root, '.roslyn')}" -Version 4.8.0 -NonInteractive`, { stdio: 'inherit' });
      if (existsSync(roslynCsc)) {
        csc = roslynCsc;
        console.log(`[build:ocr] Using Roslyn compiler: ${csc}`);
      } else {
        console.warn('[build:ocr] Roslyn csc.exe not found after install, falling back to .NET Framework csc');
      }
    } catch (err) {
      console.warn('[build:ocr] Failed to download Roslyn. Will fall back to .NET Framework csc.');
    }
  }

  if (!existsSync(csc)) {
    console.warn('[build:ocr] No C# compiler found. OCR will not be available on Windows.');
    process.exit(0);
  }

  console.log(`[build:ocr] Using compiler: ${csc}`);

  const exeOutput = join(resourcesDir, 'norma-ocr-win.exe');
  const winmdDir = join(process.env.SYSTEMROOT || 'C:\\Windows', 'system32', 'WinMetadata');
  const winrtDll = 'C:\\Windows\\Microsoft.NET\\assembly\\GAC_MSIL\\System.Runtime.WindowsRuntime\\v4.0_4.0.0.0__b77a5c561934e089\\System.Runtime.WindowsRuntime.dll';

  const refs = [
    '/reference:"System.Runtime.dll"',
    '/reference:"System.Threading.Tasks.dll"',
    `/reference:"${winrtDll}"`,
  ].join(' ');

  try {
    const cmd = `"${csc}" /nologo /out:"${exeOutput}" /platform:anycpu ${refs} "${csharpSource}"`;
    console.log(`[build:ocr] Running: ${cmd}`);
    execSync(cmd, { stdio: 'inherit' });
    console.log(`[build:ocr] Windows OCR bridge compiled: ${exeOutput}`);
  } catch (err) {
    console.warn('[build:ocr] Failed to compile C# bridge. OCR will not be available on Windows.');
    console.warn('[build:ocr] Error:', err.message);
    process.exit(0);
  }

  const speechSource = join(root, 'src', 'main', 'speech', 'win-speech.cs');
  if (existsSync(speechSource)) {
    console.log('[build:speech] Compiling Windows Speech bridge (C# → System.Speech)...');
    const speechOutput = join(resourcesDir, 'norma-speech-win.exe');
    const speechRefs = `/reference:"C:\\Windows\\Microsoft.NET\\assembly\\GAC_MSIL\\System.Speech\\v4.0_4.0.0.0__31bf3856ad364e35\\System.Speech.dll"`;
    try {
      const cmd = `"${csc}" /nologo /out:"${speechOutput}" /platform:anycpu ${speechRefs} "${speechSource}"`;
      console.log(`[build:speech] Running: ${cmd}`);
      execSync(cmd, { stdio: 'inherit' });
      console.log(`[build:speech] Windows Speech bridge compiled: ${speechOutput}`);
    } catch (err) {
      console.warn('[build:speech] Failed to compile Speech bridge. STT will not be available.');
      console.warn('[build:speech] Error:', err.message);
    }
  }

} else {
  console.log(`[build:ocr] Unsupported platform: ${process.platform}`);
  process.exit(0);
}
