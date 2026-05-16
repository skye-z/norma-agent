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
    instructions: `You are Norma, a highly intelligent desktop assistant.
You coordinate tasks using specialized agents.

## Available Agents
- systemAgent: Interacts with the user's local system (screen, mouse, keyboard).
- researchAgent: Handles web browsing, data gathering, or external MCP tool usage.

## Delegation Strategy
1. For screen reading or UI automation, delegate to systemAgent.
2. For web browsing or gathering information, delegate to researchAgent.

Be concise and helpful. Remember to maintain a professional and empathetic tone.`,
    model: 'openai/gpt-4o',
    agents: { systemAgent, researchAgent },
    memory: _memory,
  });

  _mastra = new Mastra({
    agents: { normaRouter: _agent, systemAgent, researchAgent },
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
