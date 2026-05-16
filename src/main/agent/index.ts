import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { LibSQLStore, LibSQLVector } from '@mastra/libsql';
import { ModelRouterEmbeddingModel } from '@mastra/core/llm';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { readScreenTool } from '../tools/read-screen';
import { executeActionTool } from '../tools/execute-action';
import { initMcpClient } from '../mcp';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const baseTools = {
  read_screen: readScreenTool,
  execute_action: executeActionTool,
};

let _agent: Agent | null = null;
let _mastra: Mastra | null = null;
let _memory: Memory | null = null;

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
      : ({ embed: async () => [] } as any),
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

  _agent = new Agent({
    id: 'norma-router',
    name: 'Norma Router',
    instructions: `You are Norma, a highly intelligent desktop assistant. 
Be concise and helpful. Remember to maintain a professional and empathetic tone.

## Built-in Tools
- read_screen: Capture a screenshot of the user's current screen.
- execute_action: Execute mouse and keyboard actions (move, click, type, scroll, etc).

## MCP Browser Tools (via Playwright)
${mcpToolNames || '  (no MCP tools loaded)'}

## Workflow for UI automation tasks
1. read_screen → analyze what's on screen
2. Plan the actions needed
3. execute_action with precise coordinates
4. read_screen again to verify the result

## Workflow for web tasks
Use the Playwright MCP browser tools to navigate web pages, fill forms, extract data, etc.

Be careful with coordinates. Screen origin (0,0) is top-left. Only execute actions the user has explicitly requested.`,
    model: 'openai/gpt-4o',
    tools: allTools,
    memory: _memory,
  });

  _mastra = new Mastra({
    agents: { normaRouter: _agent },
  });

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
