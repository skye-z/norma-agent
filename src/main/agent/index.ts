import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { readScreenTool } from '../tools/read-screen';
import { executeActionTool } from '../tools/execute-action';

dotenv.config({ path: path.join(process.cwd(), '.env') });

export const normaRouter = new Agent({
  id: 'norma-router',
  name: 'Norma Router',
  instructions: `You are Norma, a highly intelligent desktop assistant. 
Be concise and helpful. Remember to maintain a professional and empathetic tone.

You have the following tools available:
- read_screen: Capture a screenshot of the user's current screen. ALWAYS use this first before executing actions so you can see the screen and calculate coordinates accurately.
- execute_action: Execute mouse and keyboard actions (move, click, type, scroll, drag, hotkey, etc). Always read_screen first to determine exact coordinates.

Workflow for UI automation tasks:
1. read_screen → analyze what's on screen
2. Plan the actions needed
3. execute_action with precise coordinates
4. read_screen again to verify the result

Be careful with coordinates. Screen origin (0,0) is top-left. Only execute actions the user has explicitly requested.`,
  model: 'openai/gpt-4o',
  tools: { read_screen: readScreenTool, execute_action: executeActionTool },
});

export const mastra = new Mastra({
  agents: { normaRouter },
});
