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
  read_screen: { name: '屏幕感知', description: '截屏 + 原生OCR识别屏幕文本坐标', category: '感知' },
  execute_action: { name: '系统操控', description: '模拟鼠标键盘操作', category: '控制' },
  list_windows: { name: '窗口列表', description: '列出所有可见窗口（含位置和大小）', category: '感知' },
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

export async function initAgent(dbDir?: string, defaultModel?: string) {
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
    instructions: `你是 Norma，一个高度智能的桌面助手。

## 可用工具
- **system_info**: 获取系统信息（桌面路径、OS版本、屏幕分辨率）
- **list_directory**: 列出目录下的文件
- **list_windows**: 列出所有可见窗口（含位置和大小）
- **window_control**: 聚焦/最大化/最小化/还原/关闭窗口
- **open_file**: 用默认应用打开文件或URL
- **read_screen**: 截屏 + 原生 OCR，提取屏幕文本和坐标（支持 targetWindow 参数截取特定窗口）
- **execute_action**: 鼠标和键盘操作
- **system_tray**: 与系统托盘交互

## 核心原则: 按需感知，精准操作

1. **必须先 list_windows** — 任何截屏操作前，先调用 list_windows 获取窗口列表和布局
2. **必须指定 targetWindow** — read_screen 的 targetWindow 参数是必需的，全屏 OCR 产生大量噪声基本不可用
3. **OCR 返回文本坐标** — (x, y) 坐标可直接传给 execute_action 的 click 操作
4. **小步快跑** — 每执行1-2个动作后重新 read_screen(targetWindow="...") 确认结果

## 禁止行为（严格遵守）

- **禁止**不指定 targetWindow 就调用 read_screen（除非用户明确要求"看看我整个屏幕"）
- **禁止**连续多次 read_screen（每次截屏前先想清楚要看哪个窗口）
- **禁止**在已知目标窗口的情况下仍然全屏 OCR

## 感知优先级（从低成本到高成本）

1. **list_windows** — 最快，仅返回窗口列表和位置。先调用它了解屏幕布局
2. **read_screen(targetWindow="...")** — 中等成本，OCR 单个窗口，结果精确
3. **read_screen()** — 最昂贵，全屏 OCR，结果包含大量噪声，仅在需要了解整个桌面布局时使用

## 标准工作流

### 场景1: 用户闲聊或通用问答
直接回答，不需要调用任何工具。

### 场景2: 用户提到屏幕上的内容
1. \`list_windows\` → 了解当前有哪些窗口
2. 根据用户描述判断目标窗口
3. \`read_screen(targetWindow="窗口名")\` → OCR 该窗口
4. 回答用户问题

### 场景3: 桌面自动化任务
1. \`system_info\` → 获取桌面路径和屏幕分辨率
2. \`list_windows\` → 查看当前窗口布局
3. 如需打开文件: \`list_directory\` → \`open_file\`
4. \`read_screen(targetWindow="目标窗口")\` → OCR 目标窗口内容
5. 找到目标元素的坐标 → \`execute_action\` 操作
6. 操作后 \`read_screen(targetWindow="...")\` 确认结果
7. 如需切换应用: \`list_windows\` → \`window_control(focus)\` → \`read_screen(targetWindow="...")\`

## read_screen 使用规则

**必须指定 targetWindow 的情况:**
- 你知道要操作哪个窗口时
- 用户提到了特定应用或窗口
- 需要精确的 OCR 结果来定位 UI 元素

**可以省略 targetWindow 的情况（极少）:**
- 用户明确说"看看我整个屏幕上有什么"
- 你完全不知道屏幕布局且 list_windows 无法提供足够信息

**正确示例:**
- list_windows → 看到 "Calculator" → read_screen(targetWindow="Calculator")
- list_windows → 看到 "Edge" → read_screen(targetWindow="Edge")

## OCR 结果格式
\`\`\`
## OCR Results for window "Calculator" (15 text elements)
Timestamp: 2026-05-18T10:30:00Z

### Detected Text (coordinates are screen points, use directly with execute_action click):
- "File" at (45, 12) bounds: {x:20, y:4, w:50, h:16}
- "Submit" at (450, 500) bounds: {x:400, y:480, w:100, h:40}
\`\`\`

使用: execute_action(click, x:450, y:500)

## 键盘操作
- shortcut: selectAll(Ctrl+A), copy(Ctrl+C), paste(Ctrl+V), cut(Ctrl+X)
- type: 输入文本
- key_tap: 单键 (enter, tab, escape, backspace)

## 错误处理
1. 不要立即放弃
2. 分析错误原因
3. 调整策略（换坐标、重新 OCR 确认）
4. 最多重试3次

## 输出格式
用 <plan>...</plan> 标签包裹步骤推理。
直接回复用户时用中文，简洁友好。`,
    model: defaultModel || 'openai/gpt-4o-mini',
    tools: { ...baseTools, ...mcpTools },
    memory: _memory,
  });

  _mastra = new Mastra({
    agents: { normaRouter: _agent },
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

export function getEnabledTools(allTools: Record<string, any>, disabledIds: string[]): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [id, tool] of Object.entries(allTools)) {
    if (!disabledIds.includes(id)) result[id] = tool;
  }
  return result;
}

export function getBaseTools(): Record<string, any> {
  return baseTools;
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
        description: meta?.description || tool.description?.slice(0, 30) || '',
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

const TOOL_TEST_DEFAULTS: Record<string, Record<string, any>> = {
  read_screen: { targetWindow: '', includeImage: false },
  execute_action: { actions: [{ type: 'get_mouse_pos' }] },
  list_windows: {},
  window_control: { windowTitle: 'norma', action: 'focus' },
  open_file: { path: process.cwd() },
  list_directory: { directoryPath: process.cwd() },
  system_tray: { action: 'list' },
  system_info: {},
};

interface ToolInputField {
  name: string;
  type: 'string' | 'boolean' | 'number' | 'enum';
  required: boolean;
  description: string;
  defaultVal: any;
  enumOptions?: string[];
}

function extractFields(schema: any): ToolInputField[] {
  if (!schema || !schema.shape) return [];
  const entries = Object.entries(schema.shape) as [string, any][];
  return entries.map(([name, field]) => {
    const isOptional = field instanceof (field.constructor as any).Optional || field._def?.typeName === 'ZodOptional';
    const inner = isOptional ? field._def?.innerType || field.unwrap?.() : field;
    const typeName = inner?._def?.typeName || inner?.constructor?.name || '';
    let type: ToolInputField['type'] = 'string';
    let enumOptions: string[] | undefined;
    if (typeName === 'ZodString') type = 'string';
    else if (typeName === 'ZodBoolean') type = 'boolean';
    else if (typeName === 'ZodNumber') type = 'number';
    else if (typeName === 'ZodEnum' || typeName === 'ZodNativeEnum') {
      type = 'enum';
      enumOptions = inner._def?.values || (inner._def?.entries ? Object.values(inner._def.entries) : undefined);
      if (!enumOptions && typeName === 'ZodNativeEnum') {
        try { enumOptions = Object.values(inner._def.values); } catch {}
      }
    }
    return {
      name,
      type,
      required: !isOptional,
      description: inner?.description || field?.description || '',
      defaultVal: TOOL_TEST_DEFAULTS[name] ?? (type === 'boolean' ? false : type === 'number' ? 0 : ''),
      enumOptions,
    };
  });
}

export function getToolInputFields(toolId: string): ToolInputField[] {
  const tool = baseTools[toolId as keyof typeof baseTools] as any;
  if (!tool?.inputSchema) return [];
  return extractFields(tool.inputSchema);
}

export async function testTool(toolId: string, userArgs?: Record<string, any>): Promise<{ success: boolean; output: any; duration: number; error?: string }> {
  const tool = baseTools[toolId as keyof typeof baseTools];
  if (!tool) {
    const mcp = await initMcpClient();
    const mcpTool = mcp[toolId];
    if (!mcpTool) return { success: false, output: null, duration: 0, error: `Tool "${toolId}" not found` };
    try {
      const start = Date.now();
      const result = await (mcpTool as any).execute({});
      return { success: true, output: result, duration: Date.now() - start };
    } catch (e: any) {
      return { success: false, output: null, duration: 0, error: e.message };
    }
  }

  const defaultArgs = TOOL_TEST_DEFAULTS[toolId] ?? {};
  const mergedArgs = { ...defaultArgs, ...userArgs };
  const start = Date.now();
  try {
    const result = await (tool as any).execute(defaultArgs);
    return { success: true, output: result, duration: Date.now() - start };
  } catch (e: any) {
    return { success: false, output: null, duration: Date.now() - start, error: e.message };
  }
}
