import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { desktopCapturer, shell } from 'electron';
import { exec } from 'child_process';
import * as util from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = util.promisify(exec);

export const listWindowsTool = createTool({
  id: 'list_windows',
  description: '列出当前所有打开的窗口标题。在聚焦窗口或截图之前使用此工具来确认窗口是否存在。',
  inputSchema: z.object({}),
  outputSchema: z.object({
    windows: z.array(z.object({
      name: z.string(),
      id: z.string(),
    })),
  }),
  execute: async () => {
    try {
      const sources = await desktopCapturer.getSources({ types: ['window'] as any });
      const windows = sources
        .filter(s => s.name.trim().length > 0)
        .map(s => ({ name: s.name, id: s.id }));
      return { windows };
    } catch (e) {
      throw new Error(`Failed to list windows: ${e}`);
    }
  },
});

export const windowControlTool = createTool({
  id: 'window_control',
  description: '控制窗口: 聚焦、最大化、最小化、还原窗口。使用 windowTitle 部分匹配窗口标题。',
  inputSchema: z.object({
    windowTitle: z.string().describe('窗口标题(支持部分匹配, 可从 list_windows 获取)'),
    action: z.enum(['focus', 'maximize', 'minimize', 'restore', 'close']).describe('要执行的操作'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
  execute: async ({ windowTitle, action }) => {
    const safeTitle = windowTitle.replace(/"/g, '`"');

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
        let script: string;
        switch (action) {
          case 'focus':
            script = `tell application "System Events" to set frontmost of the first process whose name contains "${safeTitle}" to true`;
            break;
          case 'maximize':
            script = `tell application "${safeTitle}" to activate`;
            break;
          case 'minimize':
            script = `tell application "System Events" to set miniaturized of every window of process "${safeTitle}" to true`;
            break;
          case 'restore':
            script = `tell application "${safeTitle}" to activate`;
            break;
          case 'close':
            script = `tell application "${safeTitle}" to quit`;
            break;
        }
        await execAsync(`osascript -e '${script}'`, { timeout: 5000 });
        await new Promise(r => setTimeout(r, 500));
        return { success: true, message: `窗口 "${windowTitle}" 执行 ${action} 成功` };
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
      const result = await shell.openPath(filePath);
      if (result) {
        return { success: false, message: `打开失败: ${result}` };
      }
      await new Promise(r => setTimeout(r, 1000));
      return { success: true, message: `已打开: ${filePath}` };
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
      const expandedPath = dirPath.replace(/^~/, process.env.HOME || process.env.USERPROFILE || '~');
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
  description: '与系统托盘(任务栏右下角)交互: 列出托盘图标或点击指定图标唤出窗口。在找不到目标窗口时使用此工具检查托盘。',
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
    if (process.platform !== 'win32') {
      return { success: false, message: `系统托盘工具目前仅支持 Windows` };
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
      screenResolution: `${os.hostname()}`,
      desktopPath: getDesktopPath(),
      homePath: os.homedir(),
      activeWindow: activeWindow || '未知',
    };
  },
});

async function getActiveWindowTitle(): Promise<string> {
  try {
    if (process.platform === 'win32') {
      const ps = `Add-Type @"\nusing System;\nusing System.Runtime.InteropServices;\npublic class Win32 {\n  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();\n  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr hWnd, System.Text.StringBuilder text, int count);\n}\n"@ -PassThru; $h = [Win32]::GetForegroundWindow(); $t = New-Object System.Text.StringBuilder 256; [Win32]::GetWindowText($h, $t, 256) | Out-Null; $t.ToString()`;
      const { stdout } = await execAsync(`powershell -Command "${ps.replace(/\n/g, ' ')}"`, { timeout: 5000 });
      return stdout.trim();
    }
  } catch {}
  return '';
}

function getDesktopPath(): string {
  const home = process.env.HOME || process.env.USERPROFILE || '';
  if (process.platform === 'win32') {
    return process.env.USERPROFILE ? path.join(process.env.USERPROFILE, 'Desktop') : path.join(home, 'Desktop');
  }
  return path.join(home, 'Desktop');
}
