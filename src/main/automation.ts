import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';

const triggerStep = createStep({
  id: 'evaluate-trigger',
  inputSchema: z.object({
    name: z.string(),
    desc: z.string(),
    trigger: z.string(),
  }),
  outputSchema: z.object({
    name: z.string(),
    desc: z.string(),
    shouldRun: z.boolean(),
    reason: z.string(),
  }),
  execute: async ({ inputData }) => {
    return {
      name: inputData.name,
      desc: inputData.desc,
      shouldRun: true,
      reason: `触发条件 "${inputData.trigger}" 已满足`,
    };
  },
});

const executeStep = createStep({
  id: 'execute-automation',
  inputSchema: z.object({
    name: z.string(),
    desc: z.string(),
    shouldRun: z.boolean(),
    reason: z.string(),
  }),
  outputSchema: z.object({
    name: z.string(),
    status: z.string(),
    result: z.string(),
    timestamp: z.string(),
  }),
  execute: async ({ inputData }) => {
    if (!inputData.shouldRun) {
      return {
        name: inputData.name,
        status: 'skipped',
        result: inputData.reason,
        timestamp: new Date().toISOString(),
      };
    }

    return {
      name: inputData.name,
      status: 'completed',
      result: `自动化 "${inputData.name}" 执行完成: ${inputData.desc}`,
      timestamp: new Date().toISOString(),
    };
  },
});

export const automationWorkflow = createWorkflow({
  id: 'norma-automation',
  inputSchema: z.object({
    name: z.string(),
    desc: z.string(),
    trigger: z.string(),
  }),
  outputSchema: z.object({
    name: z.string(),
    status: z.string(),
    result: z.string(),
    timestamp: z.string(),
  }),
})
  .then(triggerStep)
  .then(executeStep)
  .commit();
