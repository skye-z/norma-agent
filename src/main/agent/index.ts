import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
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

export async function initAgent() {
  const mcpTools = await initMcpClient();

  const allTools = { ...baseTools, ...mcpTools };
  const mcpToolNames = Object.keys(mcpTools).map((n) => `  - ${n}`).join('\n');

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
