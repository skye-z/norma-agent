import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const knowledgeSearchTool = createTool({
  id: 'knowledge_search',
  description: '从用户的知识库中检索与查询相关的文档片段。当用户的问题可能与他们之前导入的文档、知识库内容相关时使用此工具。返回最相关的文本片段及其来源信息。',
  inputSchema: z.object({
    query: z.string().describe('搜索查询文本'),
    topK: z.number().optional().default(5).describe('返回结果数量'),
  }),
  outputSchema: z.object({
    results: z.array(z.object({
      text: z.string(),
      score: z.number(),
      source: z.string(),
      docId: z.string(),
    })),
    total: z.number(),
  }),
  execute: async (inputData: { query?: string; topK?: number }) => {
    const { queryKnowledge } = await import('../knowledge');
    const { getConfig } = await import('../config');

    if (!inputData?.query) {
      return { results: [], total: 0 };
    }

    let settings: any = {
      enabled: true,
      retrievalTopK: 5,
      scoreThreshold: 0.5,
    };

    try {
      const saved = await getConfig('norma-knowledge-settings');
      if (saved && typeof saved === 'object') {
        settings = { ...settings, ...saved };
      }
    } catch {}

    if (!settings.enabled) {
      return { results: [], total: 0 };
    }

    const topK = inputData.topK || settings.retrievalTopK || 5;
    const threshold = settings.scoreThreshold ?? 0.5;

    try {
      const raw = await queryKnowledge(inputData.query, topK);
      console.log(`[KnowledgeSearch] query="${inputData.query}" mode=${require('../knowledge').getEmbedderMode()} raw=${raw.length} filtered(threshold>=${threshold})=${raw.filter(r => r.score >= threshold).length}`);
      const filtered = raw.filter((r) => r.score >= threshold);
      const results = filtered.map((r) => ({
        text: (r.metadata?.text || '').slice(0, 500),
        score: Math.round(r.score * 1000) / 1000,
        source: r.metadata?.name || r.metadata?.docId || 'unknown',
        docId: r.metadata?.docId || 'unknown',
      }));

      return { results, total: results.length };
    } catch (err: any) {
      console.error(`[KnowledgeSearch] query failed: ${err?.message}`);
      return { results: [], total: 0 };
    }
  },
});
