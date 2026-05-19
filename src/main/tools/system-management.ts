import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { desktopCapturer, shell, screen } from 'electron';
import { exec } from 'child_process';
import * as util from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = util.promisify(exec);

export const listWindowsTool = createTool({
  id: 'list_windows',
  description: '列出当前所有可见窗口的详细信息。返回窗口标题、进程名、PID、位置、大小、是否活跃、是否最小化等。在 read_screen 之前使用此工具来确定要截取哪个窗口。',
  inputSchema: z.object({}),
  outputSchema: z.object({
    windows: z.array(z.object({
      name: z.string(),
      id: z.string(),
      processName: z.string().optional(),
      pid: z.number().optional(),
      bounds: z.object({
        x: z.number(),
        y: z.number(),
        width: z.number(),
        height: z.number(),
      }).optional(),
      isActive: z.boolean().optional(),
      isMinimized: z.boolean().optional(),
      isFullScreen: z.boolean().optional(),
      ownerProcessId: z.number().optional(),
    })),
  }),
  execute: async () => {
    try {
      const sources = await desktopCapturer.getSources({ types: ['window'] as any });
      const filtered = sources.filter(s => s.name.trim().length > 0);

      const { boundsMap, processMap } = await getWindowInfoNative();

      const activeWindowTitle = await getActiveWindowTitle();

      const windows = filtered.map(s => {
        const entry: any = { name: s.name, id: s.id };
        const matchKey = findPartialMatch(s.name, Object.keys(boundsMap));
        const bounds = boundsMap[s.name] || boundsMap[matchKey];
        if (bounds) {
          entry.bounds = { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
        }
        const pInfo = processMap[s.name] || processMap[matchKey];
        if (pInfo) {
          entry.processName = pInfo.processName;
          entry.pid = pInfo.pid;
          entry.isMinimized = pInfo.isMinimized;
          entry.isFullScreen = pInfo.isFullScreen;
        }
        entry.isActive = !!(activeWindowTitle && (s.name === activeWindowTitle || s.name.includes(activeWindowTitle)));
        return entry;
      });

      return { windows };
    } catch (e) {
      throw new Error(`Failed to list windows: ${e}`);
    }
  },
});

export const windowControlTool = createTool({
  id: 'window_control',
  description: '控制窗口: 聚焦、最大化、最小化、还原、关闭窗口。使用 windowTitle 部分匹配窗口标题。',
  inputSchema: z.object({
    windowTitle: z.string().describe('窗口标题(支持部分匹配, 可从 list_windows 获取)'),
    action: z.enum(['focus', 'maximize', 'minimize', 'restore', 'close']).describe('要执行的操作'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
  execute: async ({ windowTitle, action }) => {
    const safeTitle = windowTitle.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

    if (process.platform === 'win32') {
      try {
        let ps: string;
        switch (action) {
          case 'focus':
            ps = `Add-Type -AssemblyName Microsoft.VisualBasic; (New-Object -ComObject wscript.shell).AppActivate("${safeTitle}")`;
            break;
          case 'maximize':
            ps = `Add-Type -AssemblyName Microsoft.VisualBasic; (New-Object -ComObject wscript.shell).AppActivate("${safeTitle}"); Start-Sleep -Milliseconds 200; $wshell = New-Object -ComObject wscript.shell; $wshell.SendKeys("% x")`;
            break;
          case 'minimize':
            ps = `Add-Type -AssemblyName Microsoft.VisualBasic; (New-Object -ComObject wscript.shell).AppActivate("${safeTitle}"); Start-Sleep -Milliseconds 200; $wshell = New-Object -ComObject wscript.shell; $wshell.SendKeys("% n")`;
            break;
          case 'restore':
            ps = `Add-Type -AssemblyName Microsoft.VisualBasic; (New-Object -ComObject wscript.shell).AppActivate("${safeTitle}")`;
            break;
          case 'close':
            ps = `Add-Type -AssemblyName Microsoft.VisualBasic; (New-Object -ComObject wscript.shell).AppActivate("${safeTitle}"); Start-Sleep -Milliseconds 200; $wshell = New-Object -ComObject wscript.shell; $wshell.SendKeys("%{F4}")`;
            break;
        }
        await execAsync(`powershell -Command "${ps}"`, { timeout: 5000 });
        await new Promise(r => setTimeout(r, 500));
        return { success: true, message: `窗口 "${windowTitle}" 执行 ${action} 成功` };
      } catch (e) {
        return { success: false, message: `窗口控制失败: ${e}` };
      }
    }

    if (process.platform === 'darwin') {
      try {
        const processName = await findProcessByWindowIdOrTitle(windowTitle);
        if (!processName) {
          return { success: false, message: `找不到包含 "${windowTitle}" 的窗口。请先用 list_windows 查看可用窗口。` };
        }

        const safeProcess = processName.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

        let script: string;
        switch (action) {
          case 'focus':
            script = `tell application "${safeProcess}" to activate`;
            break;
          case 'maximize':
            script = `
tell application "${safeProcess}" to activate
delay 0.3
tell application "System Events"
  tell process "${safeProcess}"
    try
      set (position of every window) to {{0, 0}}
      set (size of every window) to {{${screen.getPrimaryDisplay().size.width}, ${screen.getPrimaryDisplay().size.height - 28}}}
    end try
  end tell
end tell`;
            break;
          case 'minimize':
            script = `
tell application "System Events"
  tell process "${safeProcess}"
    set miniaturized of every window to true
  end tell
end tell`;
            break;
          case 'restore':
            script = `
tell application "System Events"
  tell process "${safeProcess}"
    set miniaturized of every window to false
  end tell
end tell
tell application "${safeProcess}" to activate`;
            break;
          case 'close':
            script = `
tell application "System Events"
  tell process "${safeProcess}"
    set frontmost to true
    delay 0.2
    keystroke "w" using command down
  end tell
end tell`;
            break;
        }
        await execAsync(`osascript -e '${script.replace(/\n/g, ' ')}'`, { timeout: 5000 });
        await new Promise(r => setTimeout(r, 500));
        return { success: true, message: `窗口 "${windowTitle}" (进程: ${processName}) 执行 ${action} 成功` };
      } catch (e) {
        return { success: false, message: `窗口控制失败: ${e}` };
      }
    }

    return { success: false, message: `不支持的平台: ${process.platform}` };
  },
});

export const openFileTool = createTool({
  id: 'open_file',
  description: '使用系统默认应用打开文件或URL。例如: open_file("C:\\Users\\Desktop\\招聘要求.xlsx") 会用Excel打开。',
  inputSchema: z.object({
    filePath: z.string().describe('文件的绝对路径或URL'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
  execute: async ({ filePath }) => {
    try {
      const cleanPath = filePath.replace(/\\ /g, ' ').replace(/\\\(/g, '(').replace(/\\\)/g, ')');
      const result = await shell.openPath(cleanPath);
      if (result) {
        return { success: false, message: `打开失败: ${result}` };
      }
      await new Promise(r => setTimeout(r, 1000));
      return { success: true, message: `已打开: ${cleanPath}` };
    } catch (e) {
      return { success: false, message: `打开失败: ${e}` };
    }
  },
});

export const listDirectoryTool = createTool({
  id: 'list_directory',
  description: '列出指定目录下的文件和文件夹。用于查找桌面上的文件、文档等。',
  inputSchema: z.object({
    dirPath: z.string().describe('目录的绝对路径, 例如 "C:\\Users\\用户名\\Desktop"'),
    pattern: z.string().optional().describe('可选的文件名过滤模式, 例如 "*.xlsx"'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    items: z.array(z.object({
      name: z.string(),
      isDirectory: z.boolean(),
      size: z.number().optional(),
    })),
    message: z.string().optional(),
  }),
  execute: async ({ dirPath, pattern }) => {
    try {
      const expandedPath = dirPath
        .replace(/^~/, process.env.HOME || process.env.USERPROFILE || '~')
        .replace(/\\ /g, ' ')
        .replace(/\\\(/g, '(')
        .replace(/\\\)/g, ')');
      if (!fs.existsSync(expandedPath)) {
        return { success: false, items: [], message: `目录不存在: ${expandedPath}` };
      }

      let entries = fs.readdirSync(expandedPath, { withFileTypes: true });

      if (pattern) {
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'i');
        entries = entries.filter(e => regex.test(e.name));
      }

      const items = entries.slice(0, 100).map(e => {
        const item: any = { name: e.name, isDirectory: e.isDirectory() };
        if (!e.isDirectory()) {
          try {
            const stat = fs.statSync(path.join(expandedPath, e.name));
            item.size = stat.size;
          } catch {}
        }
        return item;
      });

      return { success: true, items };
    } catch (e) {
      return { success: false, items: [], message: `列出目录失败: ${e}` };
    }
  },
});

export const systemTrayTool = createTool({
  id: 'system_tray',
  description: '与系统托盘/菜单栏交互: 列出托盘图标或点击指定图标唤出窗口。Windows 支持任务栏托盘, macOS 支持菜单栏图标。',
  inputSchema: z.object({
    action: z.enum(['list', 'click']).describe('list=列出托盘图标, click=点击指定托盘图标'),
    trayName: z.string().optional().describe('要点击的托盘图标名称(部分匹配), 如 "QQ", "WeChat"'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
    trayItems: z.array(z.string()).optional(),
  }),
  execute: async ({ action, trayName }) => {
    if (process.platform === 'darwin') {
      return handleMacOSTray(action, trayName);
    }

    if (process.platform !== 'win32') {
      return { success: false, message: `系统托盘工具目前仅支持 Windows 和 macOS` };
    }

    try {
      if (action === 'list') {
        const ps = `
Add-Type -AssemblyName System.Windows.Forms
$trayItems = @()
$trayArea = [System.Windows.Forms.SystemInformation]::PrimaryMonitorSize
$taskbarHeight = 40
$trayY = $trayArea.Height - $taskbarHeight + 10
$trayX = $trayArea.Width - 20
"[System Tray Area] x=$trayX, y=$trayY"
`;
        const { stdout } = await execAsync(`powershell -Command "${ps.replace(/\n/g, ' ')}"`, { timeout: 5000 });
        return {
          success: true,
          message: '系统托盘区域已定位。使用 click 操作配合 trayName 来点击特定图标, 或使用 read_screen 截图来查看托盘区域。',
          trayItems: stdout.trim().split('\n').filter(l => l.trim()),
        };
      }

      if (action === 'click') {
        if (!trayName) {
          return { success: false, message: 'click 操作需要提供 trayName 参数' };
        }
        const ps = `
Add-Type -AssemblyName Microsoft.VisualBasic
Add-Type -AssemblyName System.Windows.Forms
$screen = [System.Windows.Forms.SystemInformation]::PrimaryMonitorSize
$taskbarH = 40
$trayX = $screen.Width - 20
$trayY = $screen.Height - $taskbarH/2
$wshell = New-Object -ComObject wscript.shell
$wshell.SendKeys("% b")
Start-Sleep -Milliseconds 500
`;
        await execAsync(`powershell -Command "${ps.replace(/\n/g, ' ')}"`, { timeout: 8000 });
        await new Promise(r => setTimeout(r, 1000));

        return {
          success: true,
          message: `已尝试打开托盘区域。请使用 read_screen 截图查看并定位 "${trayName}" 图标, 然后使用 execute_action 点击对应坐标。`,
        };
      }

      return { success: false, message: `未知操作: ${action}` };
    } catch (e) {
      return { success: false, message: `系统托盘操作失败: ${e}` };
    }
  },
});

async function handleMacOSTray(action: string, trayName?: string): Promise<{ success: boolean; message: string; trayItems?: string[] }> {
  try {
    if (action === 'list') {
      const script = `
tell application "System Events"
  set output to ""
  repeat with p in (every process whose visible is true)
    set pName to name of p
    try
      set menuBars to every menu bar of p
      if (count of menuBars) > 0 then
        set output to output & pName & linefeed
      end if
    end try
  end repeat
  return output
end tell
`;
      const { stdout } = await execAsync(`osascript -e '${script}'`, { timeout: 8000 });
      const items = stdout.trim().split('\n').filter(l => l.trim());
      return {
        success: true,
        message: `找到 ${items.length} 个菜单栏进程。使用 click 操作配合 trayName 来激活特定应用, 或使用 read_screen 截图查看菜单栏区域。`,
        trayItems: items,
      };
    }

    if (action === 'click') {
      if (!trayName) {
        return { success: false, message: 'click 操作需要提供 trayName 参数' };
      }

      const processName = await findProcessByWindowIdOrTitle(trayName);
      const targetProcess = processName || trayName;

      const safeProcess = targetProcess.replace(/"/g, '\\"');
      const script = `
tell application "System Events"
  tell process "${safeProcess}"
    set frontmost to true
  end tell
end tell
`;
      await execAsync(`osascript -e '${script}'`, { timeout: 5000 });
      await new Promise(r => setTimeout(r, 500));

      return {
        success: true,
        message: `已激活 "${targetProcess}"。请使用 read_screen 截图查看菜单栏状态，然后使用 execute_action 操作对应元素。`,
      };
    }

    return { success: false, message: `未知操作: ${action}` };
  } catch (e) {
    return { success: false, message: `macOS 菜单栏操作失败: ${e}` };
  }
}

export const systemInfoTool = createTool({
  id: 'system_info',
  description: '获取系统信息: 操作系统版本、屏幕分辨率、桌面路径、当前活跃窗口等。在开始自动化任务前使用。',
  inputSchema: z.object({}),
  outputSchema: z.object({
    platform: z.string(),
    osVersion: z.string(),
    screenResolution: z.string(),
    desktopPath: z.string(),
    homePath: z.string(),
    activeWindow: z.string(),
  }),
  execute: async () => {
    const os = await import('os');
    const activeWindow = await getActiveWindowTitle();
    return {
      platform: process.platform,
      osVersion: os.version(),
      screenResolution: (() => { try { const d = screen.getPrimaryDisplay(); return `${d.size.width}x${d.size.height}`; } catch { return 'unknown'; } })(),
      desktopPath: getDesktopPath(),
      homePath: os.homedir(),
      activeWindow: activeWindow || '未知',
    };
  },
});

interface WindowProcessInfo {
  processName: string;
  pid: number;
  isMinimized: boolean;
  isFullScreen: boolean;
}

async function getWindowInfoNative(): Promise<{
  boundsMap: Record<string, { x: number; y: number; width: number; height: number }>;
  processMap: Record<string, WindowProcessInfo>;
}> {
  const boundsMap: Record<string, { x: number; y: number; width: number; height: number }> = {};
  const processMap: Record<string, WindowProcessInfo> = {};

  try {
    if (process.platform === 'win32') {
      const ps = `$src = @'
using System;
using System.Runtime.InteropServices;
using System.Text;
using System.Collections.Generic;
public class WL {
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
  public static string Get() {
    var r = new List<string>();
    EnumWindows((hWnd, _) => {
      if (!IsWindowVisible(hWnd)) return true;
      var t = new StringBuilder(512); GetWindowText(hWnd, t, 512);
      var s = t.ToString().Trim(); if (string.IsNullOrEmpty(s)) return true;
      RECT rc; GetWindowRect(hWnd, out rc);
      if (rc.Right - rc.Left < 10 || rc.Bottom - rc.Top < 10) return true;
      uint pid; GetWindowThreadProcessId(hWnd, out pid);
      bool minimized = IsIconic(hWnd);
      r.Add(s + "|" + rc.Left + "," + rc.Top + "," + (rc.Right - rc.Left) + "," + (rc.Bottom - rc.Top) + "|" + pid + "|" + minimized);
      return true;
    }, IntPtr.Zero);
    return string.Join("\\n", r);
  }
}
'@; Add-Type -TypeDefinition $src -Language CSharp; [WL]::Get()`;
      const { stdout } = await execAsync(`powershell -NoProfile -Command "${ps.replace(/\n/g, ' ')}"`, { timeout: 8000 });
      for (const line of stdout.trim().split('\n')) {
        const sep = line.lastIndexOf('|');
        if (sep < 0) continue;
        const title = line.substring(0, line.indexOf('|'));
        const rest = line.substring(line.indexOf('|') + 1);
        const metaParts = rest.split('|');
        const parts = metaParts[0].split(',').map(Number);
        const pid = parseInt(metaParts[1]) || 0;
        const isMinimized = metaParts[2] === 'True';
        if (parts.length === 4 && parts.every(n => !isNaN(n))) {
          boundsMap[title] = { x: parts[0], y: parts[1], width: parts[2], height: parts[3] };
        }
        if (pid) {
          processMap[title] = { processName: '', pid, isMinimized, isFullScreen: false };
        }
      }
      return { boundsMap, processMap };
    }

    if (process.platform === 'darwin') {
      const script = `
tell application "System Events"
  set output to ""
  set procList to (every process whose visible is true)
  repeat with p in procList
    set pName to name of p
    set pId to unix id of p
    set winList to (every window of p)
    repeat with w in winList
      try
        set wName to name of w
        set wPos to position of w
        set wSize to size of w
        set isMini to (miniaturized of w) as text
        set isFull to (value of attribute "AXFullScreen" of w) as text
        set output to output & wName & "|" & (item 1 of wPos) & "," & (item 2 of wPos) & "," & (item 1 of wSize) & "," & (item 2 of wSize) & "|" & pName & "|" & pId & "|" & isMini & "|" & isFull & linefeed
      end try
    end repeat
  end repeat
  return output
end tell
`;
      const { stdout } = await execAsync(`osascript -e '${script.replace(/\n/g, ' ')}'`, { timeout: 8000 });
      for (const line of stdout.trim().split('\n')) {
        const parts = line.split('|');
        if (parts.length < 4) continue;
        const title = parts[0];
        const coords = parts[1].split(', ').map(Number);
        const processName = parts[2];
        const pid = parseInt(parts[3]) || 0;
        const isMinimized = parts[4] === 'true';
        const isFullScreen = parts[5] === 'true';
        if (coords.length === 4 && coords.every(n => !isNaN(n))) {
          boundsMap[title] = { x: coords[0], y: coords[1], width: coords[2], height: coords[3] };
        }
        processMap[title] = { processName, pid, isMinimized, isFullScreen };
      }
      return { boundsMap, processMap };
    }
  } catch {}
  return { boundsMap, processMap };
}

function extractCGWindowId(sourceId: string): number | null {
  const match = sourceId.match(/^window:(\d+)/i);
  return match ? parseInt(match[1]) : null;
}

async function findProcessByWindowIdOrTitle(windowIdOrTitle: string): Promise<string | null> {
  if (process.platform !== 'darwin') return windowIdOrTitle;
  try {
    const cgId = extractCGWindowId(windowIdOrTitle);
    if (cgId !== null) {
      const script = `
tell application "System Events"
  set procList to (every process whose visible is true)
  repeat with p in procList
    repeat with w in (every window of p)
      try
        set wId to id of w
        if wId is ${cgId} then
          return name of p
        end if
      end try
    end repeat
  end repeat
  return ""
end tell
`;
      const { stdout } = await execAsync(`osascript -e '${script.replace(/\n/g, ' ')}'`, { timeout: 5000 });
      if (stdout.trim()) return stdout.trim();
    }
    const safeTitle = windowIdOrTitle.replace(/"/g, '\\"');
    const script = `
tell application "System Events"
  set targetTitle to "${safeTitle}"
  repeat with p in (every process whose visible is true)
    repeat with w in (every window of p)
      try
        if name of w contains targetTitle then return name of p
      end try
    end repeat
  end repeat
  return ""
end tell
`;
    const { stdout } = await execAsync(`osascript -e '${script.replace(/\n/g, ' ')}'`, { timeout: 5000 });
    return stdout.trim() || null;
  } catch {}
  return null;
}

async function getActiveWindowTitle(): Promise<string> {
  try {
    if (process.platform === 'win32') {
      const ps = `Add-Type @"\nusing System;\nusing System.Runtime.InteropServices;\npublic class Win32 {\n  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();\n  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr hWnd, System.Text.StringBuilder text, int count);\n}\n"@ -PassThru; $h = [Win32]::GetForegroundWindow(); $t = New-Object System.Text.StringBuilder 256; [Win32]::GetWindowText($h, $t, 256) | Out-Null; $t.ToString()`;
      const { stdout } = await execAsync(`powershell -Command "${ps.replace(/\n/g, ' ')}"`, { timeout: 5000 });
      return stdout.trim();
    }
    if (process.platform === 'darwin') {
      const script = `
tell application "System Events"
  set frontApp to name of first process whose frontmost is true
  set frontWin to ""
  try
    set frontWin to name of front window of process frontApp
  end try
  return frontApp & "|" & frontWin
end tell
`;
      const { stdout } = await execAsync(`osascript -e '${script}'`, { timeout: 3000 });
      const parts = stdout.trim().split('|');
      return parts[1] || parts[0] || '';
    }
  } catch {}
  return '';
}

function findPartialMatch(name: string, candidates: string[]): string | null {
  for (const c of candidates) {
    if (c.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(c.toLowerCase())) {
      return c;
    }
  }
  return null;
}

function getDesktopPath(): string {
  const home = process.env.HOME || process.env.USERPROFILE || '';
  if (process.platform === 'win32') {
    return process.env.USERPROFILE ? path.join(process.env.USERPROFILE, 'Desktop') : path.join(home, 'Desktop');
  }
  return path.join(home, 'Desktop');
}
