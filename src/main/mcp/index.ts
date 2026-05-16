import { MCPClient } from '@mastra/mcp';
import * as path from 'path';

let mcpClient: MCPClient | null = null;
let mcpTools: Record<string, any> = {};

export async function initMcpClient(): Promise<Record<string, any>> {
  const mcpServerPath = path.join(
    process.cwd(),
    'node_modules',
    '@playwright',
    'mcp',
    'cli.js',
  );

  mcpClient = new MCPClient({
    id: 'norma-playwright',
    servers: {
      playwright: {
        command: 'node',
        args: [mcpServerPath],
        env: {
          ...process.env as Record<string, string>,
        },
      },
    },
    timeout: 30000,
  });

  try {
    mcpTools = await mcpClient.listTools();
    const toolNames = Object.keys(mcpTools);
    console.log(`[MCP] Connected to Playwright MCP, loaded ${toolNames.length} tools: ${toolNames.join(', ')}`);
  } catch (error) {
    console.error('[MCP] Failed to connect to Playwright MCP:', error);
    mcpTools = {};
  }

  return mcpTools;
}

export function getMcpTools(): Record<string, any> {
  return mcpTools;
}

export async function disconnectMcp(): Promise<void> {
  if (mcpClient) {
    await mcpClient.disconnect();
    mcpClient = null;
    mcpTools = {};
  }
}
