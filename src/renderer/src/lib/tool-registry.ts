const DEFAULT_META: Record<string, { name: string; description: string; category: string }> = {
  read_screen: { name: '屏幕感知', description: '截屏 + 原生OCR识别屏幕文本坐标', category: '感知' },
  execute_action: { name: '系统操控', description: '模拟鼠标键盘操作', category: '控制' },
  list_windows: { name: '窗口列表', description: '列出所有可见窗口', category: '感知' },
  window_control: { name: '窗口管理', description: '聚焦/最大化/最小化/关闭窗口', category: '控制' },
  open_file: { name: '打开文件', description: '用默认应用打开文件或URL', category: '工具' },
  list_directory: { name: '目录浏览', description: '列出目录文件', category: '工具' },
  system_tray: { name: '系统托盘', description: '与系统托盘交互', category: '控制' },
  system_info: { name: '系统信息', description: '获取系统信息', category: '感知' },
};

let toolMeta: Record<string, { name: string; description: string; category: string }> = { ...DEFAULT_META };

export function setToolMeta(meta: Record<string, any>) { toolMeta = { ...DEFAULT_META, ...meta }; }
export function getToolLabel(id: string): string { return toolMeta[id]?.name || id; }
export function getToolMeta(id: string) { return toolMeta[id]; }
