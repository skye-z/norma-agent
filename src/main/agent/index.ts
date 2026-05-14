import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables (useful in dev mode)
dotenv.config({ path: path.join(process.cwd(), '.env') });

// Create a basic Router Agent
export const normaRouter = new Agent({
  id: 'norma-router',
  name: 'Norma Router',
  instructions: `You are Norma, a highly intelligent desktop assistant. 
Be concise and helpful. Remember to maintain a professional and empathetic tone.`,
  model: 'openai/gpt-4o',
});

// Initialize Mastra framework
export const mastra = new Mastra({
  agents: { normaRouter },
});
