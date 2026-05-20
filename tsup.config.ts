import { defineConfig } from 'tsup';

export default [
  {
    entry: ['src/main/index.ts'],
    outDir: 'dist/main',
    format: ['esm'],
    target: 'node22',
    clean: false,
    external: [
      'electron',
      '@mastra/core',
      '@mastra/core/agent',
      '@mastra/core/tools',
      '@mastra/core/llm',
      '@mastra/memory',
      '@mastra/libsql',
      '@mastra/mcp',
      '@ai-sdk/openai',
      '@jitsi/robotjs',
      '@xenova/transformers',
      'sharp',
      'onnxruntime-node',
    ],
    splitting: false,
  },
  {
    entry: ['src/main/preload.ts'],
    outDir: 'dist/main',
    format: ['cjs'],
    target: 'node22',
    clean: false,
    external: ['electron'],
  },
];
