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
    const trigger = (inputData.trigger || '').toLowerCase().trim();

    if (!trigger || trigger === 'manual' || trigger === '手动' || trigger === '立即') {
      return {
        name: inputData.name,
        desc: inputData.desc,
        shouldRun: true,
        reason: '手动触发',
      };
    }

    if (trigger.startsWith('every') || trigger.startsWith('每') || trigger.includes('定时') || trigger.includes('定期')) {
      return {
        name: inputData.name,
        desc: inputData.desc,
        shouldRun: true,
        reason: `定时触发条件匹配: ${inputData.trigger}`,
      };
    }

    if (trigger.includes('当') || trigger.includes('when') || trigger.includes('if') || trigger.includes('如果')) {
      return {
        name: inputData.name,
        desc: inputData.desc,
        shouldRun: true,
        reason: `条件触发匹配: ${inputData.trigger}`,
      };
    }

    return {
      name: inputData.name,
      desc: inputData.desc,
      shouldRun: true,
      reason: `触发条件 "${inputData.trigger}" 默认执行`,
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
  execute: async ({ inputData, mastra }) => {
    if (!inputData.shouldRun) {
      return {
        name: inputData.name,
        status: 'skipped',
        result: inputData.reason,
        timestamp: new Date().toISOString(),
      };
    }

    try {
      const agent = mastra.getAgent('system-agent');
      const result = await agent.generate(
        `执行以下自动化任务: ${inputData.desc}\n\n任务名称: ${inputData.name}\n触发原因: ${inputData.reason}\n\n请直接执行任务并报告结果。`,
      );

      return {
        name: inputData.name,
        status: 'completed',
        result: result.text || '任务执行完成',
        timestamp: new Date().toISOString(),
      };
    } catch (err: any) {
      return {
        name: inputData.name,
        status: 'failed',
        result: `执行失败: ${err.message || String(err)}`,
        timestamp: new Date().toISOString(),
      };
    }
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