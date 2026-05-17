import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { LibSQLStore, LibSQLVector } from '@mastra/libsql';
import { ModelRouterEmbeddingModel } from '@mastra/core/llm';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { readScreenTool } from '../tools/read-screen';
import { executeActionTool } from '../tools/execute-action';
import {
  listWindowsTool,
  windowControlTool,
  openFileTool,
  listDirectoryTool,
  systemTrayTool,
  systemInfoTool,
} from '../tools/system-management';
import { initMcpClient } from '../mcp';
import { initKnowledge } from '../knowledge';
import { automationWorkflow } from '../automation';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const TOOL_DISPLAY_META: Record<string, { name: string; description: string; category: string }> = {
  read_screen: { name: '屏幕感知', description: '截取全屏或指定窗口截图', category: '感知' },
  execute_action: { name: '系统操控', description: '模拟鼠标键盘操作', category: '控制' },
  list_windows: { name: '窗口列表', description: '列出所有窗口标题', category: '控制' },
  window_control: { name: '窗口管理', description: '聚焦/最大化/最小化/关闭窗口', category: '控制' },
  open_file: { name: '打开文件', description: '用默认应用打开文件或URL', category: '工具' },
  list_directory: { name: '目录浏览', description: '列出目录文件', category: '工具' },
  system_tray: { name: '系统托盘', description: '与系统托盘交互', category: '控制' },
  system_info: { name: '系统信息', description: '获取系统信息', category: '感知' },
};

const baseTools = {
  read_screen: readScreenTool,
  execute_action: executeActionTool,
  list_windows: listWindowsTool,
  window_control: windowControlTool,
  open_file: openFileTool,
  list_directory: listDirectoryTool,
  system_tray: systemTrayTool,
  system_info: systemInfoTool,
};

let _agent: Agent | null = null;
let _mastra: Mastra | null = null;
let _memory: Memory | null = null;
let _activeModel: string | null = null;

export async function initAgent(dbDir?: string) {
  const mcpTools = await initMcpClient();

  const allTools = { ...baseTools, ...mcpTools };
  const mcpToolNames = Object.keys(mcpTools).map((n) => `  - ${n}`).join('\n');

  const dbPath = dbDir
    ? `file:${path.join(dbDir, 'norma-memory.db')}`
    : 'file:norma-memory.db';

  _memory = new Memory({
    storage: new LibSQLStore({
      id: 'norma-storage',
      url: dbPath,
    }),
    vector: new LibSQLVector({
      id: 'norma-vector',
      url: dbPath,
    }),
    embedder: process.env.OPENAI_API_KEY 
      ? new ModelRouterEmbeddingModel('openai/text-embedding-3-small') 
      : ({ embed: async () => { console.warn('[Memory] No OPENAI_API_KEY — semantic recall disabled, returning empty embeddings'); return []; } } as any),
    options: {
      lastMessages: 20,
      semanticRecall: {
        topK: 3,
        messageRange: 2,
        scope: 'resource',
      },
      workingMemory: {
        enabled: true,
        scope: 'resource',
        template: `# User Profile
- **Name**:
- **Preferences**:
- **Goals**:
`,
      },
      generateTitle: true,
    },
  });

  const systemAgent = new Agent({
    id: 'system-agent',
    name: 'System Agent',
    description: 'Uses native system tools to read the screen and execute mouse/keyboard actions.',
    model: 'openai/gpt-4o-mini',
    tools: baseTools,
  });

  const researchAgent = new Agent({
    id: 'research-agent',
    name: 'Research Agent',
    description: 'Gathers factual information and uses external MCP tools (like web browsers).',
    model: 'openai/gpt-4o-mini',
    tools: mcpTools,
  });

  _agent = new Agent({
    id: 'norma-router',
    name: 'Norma Router',
    instructions: `你是 Norma，一个高度智能的桌面助手。你通过协调专业 Agent 来完成用户的任务。

## 可用 Agent
- systemAgent: 与用户本地系统交互（屏幕截图、鼠标键盘、窗口管理、文件操作）
- researchAgent: 处理网页浏览、信息检索、外部 MCP 工具调用

## 核心原则: 截图驱动，逐步确认
1. **永远不要盲操作** — 每一步鼠标/键盘操作前必须先 read_screen 截图确认当前界面
2. **只保留最新截图** — 历史截图会自动被丢弃以节省 token，这是正常的
3. **小步快跑** — 每执行1-2个动作后重新截图确认结果，而不是一口气执行所有步骤

## 可用工具 (通过 systemAgent 调用)
- **system_info**: 获取系统信息（桌面路径、OS版本、当前活跃窗口）
- **list_directory**: 列出目录下的文件（用于查找桌面文件）
- **list_windows**: 列出所有打开的窗口标题
- **window_control**: 聚焦/最大化/最小化/还原/关闭窗口
- **open_file**: 用默认应用打开文件或URL
- **read_screen**: 截图（可截全屏或指定窗口）
- **execute_action**: 鼠标和键盘操作
- **system_tray**: 与系统托盘交互（列出/点击托盘图标）

## 桌面自动化标准流程（重要！）

当用户要求执行涉及其他应用的自动化任务时，遵循以下流程:

### 阶段1: 定位目标
1. 调用 system_info 获取桌面路径和当前状态
2. 如需打开文件: list_directory 找到文件 → open_file 打开
3. 等待应用启动（open_file 会等待1秒）→ read_screen 确认

### 阶段2: 窗口管理
4. 调用 list_windows 确认目标窗口已出现
5. 调用 window_control(focus) 将目标窗口调到前台
6. 调用 window_control(maximize) 最大化窗口（确保内容完整显示）
7. 调用 read_screen 截图确认窗口内容

### 阶段3: 内容操作
8. 分析截图，定位要操作的UI元素坐标
9. 执行 execute_action 操作（点击、输入等）
10. **立即 read_screen 截图确认操作结果**
11. 如操作未达预期，分析原因并调整（自愈重试）

### 阶段4: 切换目标应用
12. 如需操作另一个应用（如QQ）→ list_windows 查找
13. 如果目标窗口不在列表中:
    - 调用 system_tray(list) 检查系统托盘
    - 调用 system_tray(click, trayName) 从托盘唤出
    - read_screen 截图确认
14. window_control(focus) + window_control(maximize)
15. read_screen 截图确认目标应用界面

### 阶段5: 完成交互
16. 在目标应用中定位输入区域
17. execute_action 执行输入/粘贴/发送
18. read_screen 最终确认结果

## 示例: "请打开桌面上的招聘要求复制里面的内容在QQ中发给Modred"

<plan>
1. system_info → 获取桌面路径
2. list_directory(桌面路径) → 找到"招聘要求.xlsx"
3. open_file(招聘要求.xlsx) → 用Excel打开
4. list_windows → 确认Excel窗口已出现
5. window_control("招聘要求", focus) → 将Excel调到前台
6. window_control("招聘要求", maximize) → 最大化窗口
7. read_screen → 截图查看Excel内容
8. execute_action(shortcut: selectAll) → 全选内容
9. execute_action(shortcut: copy) → 复制到剪贴板
10. list_windows → 查找QQ窗口
11. [如果QQ不在窗口列表] system_tray(click, "QQ") → 从托盘唤出QQ
12. read_screen → 截图查看QQ界面
13. 定位搜索框 → execute_action(click) → 输入"Modred"
14. read_screen → 截图确认搜索结果
15. 点击Modred → read_screen 确认会话窗口
16. execute_action(click 输入框) → execute_action(shortcut: paste) → 发送
17. read_screen → 最终确认
</plan>

## 键盘操作提示
- 使用 shortcut 动作来执行常用快捷键: selectAll(Ctrl+A), copy(Ctrl+C), paste(Ctrl+V), cut(Ctrl+X)
- 使用 type 动作输入中文或英文文本
- 使用 key_tap 动作按单个键如 enter, tab, escape, backspace

## 输出格式
在委派子Agent之前，用 <plan>...</plan> 标签包裹你的步骤推理。
直接回复用户时用中文，简洁友好。

## 错误处理与自愈
如果工具返回错误或任务未完成:
1. 不要立即放弃
2. 分析错误原因
3. 调整策略（换坐标、换工具、重新截图确认）
4. 最多重试3次
5. 只有多次尝试失败后才向用户报告

保持专业和共情的语气。`,
    model: 'openai/gpt-4o',
    agents: { systemAgent, researchAgent },
    memory: _memory,
  });

  _mastra = new Mastra({
    agents: { normaRouter: _agent, systemAgent, researchAgent },
    workflows: { automationWorkflow },
  });

  initKnowledge(dbDir);

  return { agent: _agent, mastra: _mastra };
}

export function getAgent(): Agent {
  if (!_agent) throw new Error('Agent not initialized. Call initAgent() first.');
  return _agent;
}

export function getMastra(): Mastra {
  if (!_mastra) throw new Error('Mastra not initialized. Call initAgent() first.');
  return _mastra;
}

export function getMemory(): Memory | null {
  return _memory;
}

export function getActiveModel(): string | null {
  return _activeModel;
}

export function setActiveModel(modelString: string): void {
  _activeModel = modelString;
}

export async function getCapabilities(): Promise<Array<{ id: string; name: string; description: string; category: string }>> {
  const staticFallback = () => Object.entries(TOOL_DISPLAY_META).map(([id, meta]) => ({
    id,
    name: meta.name,
    description: meta.description,
    category: meta.category,
  }));

  if (!_agent) return staticFallback();
  try {
    const tools = await _agent.listTools();
    if (!tools || Object.keys(tools).length === 0) return staticFallback();
    return Object.entries(tools).map(([id, tool]: [string, any]) => {
      const meta = TOOL_DISPLAY_META[id as keyof typeof TOOL_DISPLAY_META];
      return {
        id,
        name: meta?.name || id,
        description: tool.description || meta?.description || '',
        category: meta?.category || '工具',
      };
    });
  } catch {
    return staticFallback();
  }
}

export async function getAgentsList(): Promise<Array<{ id: string; name: string; description: string }>> {
  if (!_mastra) return [];
  try {
    const agents = _mastra.listAgents();
    return Object.entries(agents).map(([id, agent]: [string, any]) => ({
      id,
      name: agent.name || id,
      description: agent.description || '',
    }));
  } catch {
    return [];
  }
}

export async function getModelList(): Promise<Array<{ id: string; modelId: string; provider: string; }>> {
  if (!_agent) return [];
  try {
    const modelList = await _agent.getModelList();
    if (modelList && modelList.length > 0) {
      return modelList.map((m: any) => ({
        id: m.id,
        modelId: m.model?.modelId || m.id,
        provider: m.model?.provider || 'unknown',
      }));
    }
    const model = await _agent.getModel();
    return [{
      id: 'default',
      modelId: (model as any)?.modelId || 'gpt-4o',
      provider: (model as any)?.provider || 'openai',
    }];
  } catch {
    return [{ id: 'default', modelId: 'gpt-4o', provider: 'openai' }];
  }
}
