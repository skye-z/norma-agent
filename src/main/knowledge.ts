import { LibSQLVector } from '@mastra/libsql';
import { MDocument } from '@mastra/rag';
import { embedMany, embed } from 'ai';
import { openai } from '@ai-sdk/openai';
import { createClient } from '@libsql/client';
import { BrowserWindow } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

const REMOTE_INDEX_NAME = 'norma_knowledge';
const LOCAL_INDEX_NAME = 'norma_knowledge_local';
const REMOTE_DIMENSION = 1536;
const LOCAL_DIMENSION = 384;

const LOCAL_MODEL_ID = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2';

type EmbedderMode = 'remote' | 'local';

let _vector: LibSQLVector | null = null;
let _dbUrl: string = '';
let _dataDir: string = '';

let _mode: EmbedderMode = 'remote';
let _remoteEmbedder: any = null;
let _remoteBaseUrl: string | undefined;
let _localPipeline: any = null;
let _localModelReady = false;
let _localModelDownloading = false;
let _localDownloadProgress = 0;

export function initKnowledge(dbDir?: string) {
  _dbUrl = dbDir
    ? `file:${path.join(dbDir, 'norma-memory.db')}`
    : 'file:norma-memory.db';
  _dataDir = dbDir || '';

  _vector = new LibSQLVector({
    id: 'norma-knowledge-vector',
    url: _dbUrl,
  });

  if (process.env.OPENAI_API_KEY && !_remoteEmbedder) {
    reconfigureRemoteEmbedder();
  }

  checkAndLoadLocalModel();
}

async function checkAndLoadLocalModel() {
  const modelsDir = _dataDir ? path.join(_dataDir, '.models') : '';
  if (!modelsDir) return;

  const modelDir = path.join(modelsDir, LOCAL_MODEL_ID);
  try {
    await fs.promises.access(modelDir);
    console.log(`[Knowledge] Found cached local model at ${modelDir}, auto-loading...`);
    loadLocalModel().catch(err => {
      console.warn(`[Knowledge] Auto-load local model failed: ${err.message}`);
    });
  } catch {
    // model not cached, skip
  }
}

export function setEmbedderMode(mode: EmbedderMode) {
  _mode = mode;
}

export function getEmbedderMode(): EmbedderMode {
  return _mode;
}

export function getLocalModelStatus(): {
  ready: boolean;
  downloading: boolean;
  progress: number;
  modelPath: string;
} {
  const modelsDir = _dataDir ? path.join(_dataDir, '.models') : '';
  const modelDir = modelsDir ? path.join(modelsDir, LOCAL_MODEL_ID) : '';
  return {
    ready: _localModelReady,
    downloading: _localModelDownloading,
    progress: _localDownloadProgress,
    modelPath: modelDir,
  };
}

function sendProgress(progress: number, status: string) {
  _localDownloadProgress = progress;
  try {
    const wins = BrowserWindow.getAllWindows();
    for (const w of wins) {
      if (!w.isDestroyed()) w.webContents.send('knowledge:downloadProgress', { progress, status });
    }
  } catch {}
}

export async function loadLocalModel(): Promise<void> {
  if (_localModelReady) {
    sendProgress(100, 'ready');
    return;
  }
  if (_localModelDownloading) return;

  const modelsDir = path.join(_dataDir, '.models');

  await fs.promises.mkdir(modelsDir, { recursive: true });

  let createPipeline: any;
  let transformersEnv: any;

  try {
    const brokenSharp = path.join(
      path.dirname(path.dirname(path.dirname(path.dirname(path.dirname(require.resolve('sharp')))))),
      'sharp@0.32.6', 'node_modules', 'sharp', 'lib', 'index.js'
    );
    const exists = await fs.promises.access(brokenSharp).then(() => true).catch(() => false);
    if (exists) {
      const content = await fs.promises.readFile(brokenSharp, 'utf-8');
      if (!content.startsWith('module.exports')) {
        await fs.promises.writeFile(brokenSharp, 'module.exports = { default: () => ({}), __esModule: true };');
        console.log(`[Knowledge] Stubbed broken sharp@0.32.6`);
      }
    }
  } catch {}

  try {
    const transformers = await import('@xenova/transformers');
    transformersEnv = transformers.env;
    createPipeline = transformers.pipeline;
    console.log('[Knowledge] @xenova/transformers imported successfully');
  } catch (err: any) {
    console.error(`[Knowledge] Failed to import @xenova/transformers: ${err.message}`);
    throw new Error(`加载 @xenova/transformers 失败: ${err.message}`);
  }

  transformersEnv.allowLocalModels = true;
  transformersEnv.useBrowserCache = false;
  transformersEnv.remoteHost = 'https://hf-mirror.com';
  transformersEnv.remotePathTemplate = '{model}/resolve/{revision}/';
  if (_dataDir) {
    transformersEnv.cacheDir = modelsDir;
    transformersEnv.localModelPath = modelsDir;
  }

  _localModelDownloading = true;
  _localDownloadProgress = 0;
  sendProgress(0, 'connecting');
  console.log(`[Knowledge] Loading local model: ${LOCAL_MODEL_ID} (mirror: hf-mirror.com, cache: ${modelsDir})`);

  const timeout = setTimeout(() => {
    if (_localModelDownloading && _localDownloadProgress < 1) {
      console.error('[Knowledge] Download timeout — no progress after 30s');
      sendProgress(0, 'timeout');
    }
  }, 30000);

  try {
    _localPipeline = await createPipeline('feature-extraction', LOCAL_MODEL_ID, {
      progress_callback: (progress: any) => {
        if (progress.status === 'progress' && progress.progress) {
          sendProgress(Math.round(progress.progress), progress.file || 'downloading');
        }
        if (progress.status === 'done') {
          sendProgress(_localDownloadProgress, progress.file || 'done');
        }
        if (progress.status === 'initiate') {
          sendProgress(_localDownloadProgress, progress.file || 'starting');
        }
        if (progress.status === 'ready') {
          sendProgress(100, 'loading');
        }
      },
    });

    clearTimeout(timeout);
    _localModelReady = true;
    _localModelDownloading = false;
    sendProgress(100, 'ready');
    console.log(`[Knowledge] Local model ready: ${LOCAL_MODEL_ID}`);
  } catch (err: any) {
    clearTimeout(timeout);
    _localModelDownloading = false;
    sendProgress(0, 'error');
    throw new Error(`本地模型加载失败: ${err.message}`);
  }
}

export async function deleteLocalModel(): Promise<void> {
  _localPipeline = null;
  _localModelReady = false;
  _localDownloadProgress = 0;

  const modelsDir = path.join(_dataDir, '.models');
  try {
    await fs.promises.rm(modelsDir, { recursive: true, force: true });
    console.log('[Knowledge] Local model deleted');
  } catch {}
}

async function localEmbed(texts: string[]): Promise<number[][]> {
  if (!_localModelReady) {
    await loadLocalModel();
  }
  
  const BATCH_SIZE = 8;
  const allResults: number[][] = [];
  
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const output = await _localPipeline(batch, { pooling: 'mean', normalize: true });
    
    const tensorData = output.tolist ? output.tolist() : output.data;
    if (Array.isArray(tensorData) && Array.isArray(tensorData[0])) {
      allResults.push(...tensorData);
    } else {
      const dim = LOCAL_DIMENSION;
      const flat = Array.isArray(tensorData) ? tensorData.flat() : Array.from(tensorData as Iterable<number>);
      for (let j = 0; j < batch.length; j++) {
        allResults.push(flat.slice(j * dim, (j + 1) * dim));
      }
    }
    
    // 让出主线程，防止 Electron 卡死
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  
  return allResults;
}

export function reconfigureRemoteEmbedder() {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseUrl = process.env.OPENAI_BASE_URL;

  if (apiKey) {
    _remoteBaseUrl = baseUrl || 'https://api.openai.com/v1';
    _remoteEmbedder = openai.embedding('text-embedding-3-small', {
      ...(baseUrl ? { baseURL: baseUrl } : {}),
    });
    console.log(`[Knowledge] Remote embedder configured: ${_remoteBaseUrl}`);
  } else {
    _remoteEmbedder = null;
    _remoteBaseUrl = undefined;
  }
}

export function reconfigureEmbedderWithProvider(config: {
  apiKey: string;
  baseUrl?: string;
  providerType: string;
}) {
  if (!config.apiKey) {
    _remoteEmbedder = null;
    _remoteBaseUrl = undefined;
    return;
  }

  let baseUrl = config.baseUrl || undefined;
  if (config.providerType === 'openrouter') {
    baseUrl = 'https://openrouter.ai/api/v1';
  }

  _remoteBaseUrl = baseUrl || 'https://api.openai.com/v1';
  _remoteEmbedder = openai.embedding('text-embedding-3-small', {
    ...(baseUrl ? { baseURL: baseUrl } : {}),
  });

  process.env.OPENAI_API_KEY = config.apiKey;
  if (baseUrl) process.env.OPENAI_BASE_URL = baseUrl;
  else delete process.env.OPENAI_BASE_URL;

  console.log(`[Knowledge] Remote embedder reconfigured: ${_remoteBaseUrl}`);
}

export function getEmbedderStatus(): {
  configured: boolean;
  mode: EmbedderMode;
  baseUrl?: string;
  localReady?: boolean;
} {
  if (_mode === 'local') {
    return {
      configured: _localModelReady,
      mode: 'local',
      localReady: _localModelReady,
    };
  }
  return {
    configured: !!_remoteEmbedder,
    mode: 'remote',
    baseUrl: _remoteBaseUrl,
    localReady: _localModelReady,
  };
}

function getIndexName(): string {
  return _mode === 'local' ? LOCAL_INDEX_NAME : REMOTE_INDEX_NAME;
}

function getDimension(): number {
  return _mode === 'local' ? LOCAL_DIMENSION : REMOTE_DIMENSION;
}

async function ensureIndex() {
  if (!_vector) throw new Error('Knowledge not initialized');
  const indexName = getIndexName();
  const dimension = getDimension();
  const indexes = await _vector.listIndexes();
  if (!indexes.includes(indexName)) {
    await _vector.createIndex({ indexName, dimension });
  }
}

export async function ingestDocument(
  docId: string,
  text: string,
  metadata: Record<string, any>,
  onProgress?: (progress: number) => void
): Promise<{ chunks: number }> {
  if (!_vector) throw new Error('Knowledge not initialized');

  if (_mode === 'remote' && !_remoteEmbedder) {
    throw new Error(
      '知识库未初始化 — 当前未配置远程 Embedding 提供商。\n' +
      '请在设置中配置提供商，或切换为"离线 Embedding"。'
    );
  }
  if (_mode === 'local' && !_localModelReady) {
    throw new Error(
      '本地 Embedding 模型尚未就绪。\n' +
      '请在设置 > 知识库中下载离线模型。'
    );
  }

  await ensureIndex();

  const doc = MDocument.fromText(text);
  const chunks = await doc.chunk({
    strategy: 'recursive',
    maxSize: 512,
    overlap: 50,
  });

  if (chunks.length === 0) return { chunks: 0 };

  const indexName = getIndexName();

  try {
    const BATCH_SIZE = 50;
    const totalChunks = chunks.length;
    
    for (let i = 0; i < totalChunks; i += BATCH_SIZE) {
      const batchChunks = chunks.slice(i, i + BATCH_SIZE);
      const batchTexts = batchChunks.map(c => c.text);
      let embeddings: number[][];

      if (_mode === 'local') {
        embeddings = await localEmbed(batchTexts);
      } else {
        const res = await embedMany({
          model: _remoteEmbedder,
          values: batchTexts,
        });
        embeddings = res.embeddings;
      }

      const ids = batchChunks.map((_, idx) => `${docId}_${i + idx}`);

      await _vector.upsert({
        indexName,
        vectors: embeddings,
        metadata: batchChunks.map((c, idx) => ({
          ...metadata,
          text: c.text,
          docId,
          chunkIndex: i + idx,
        })),
        ids,
      });

      if (onProgress) {
        onProgress(Math.min(99, Math.round(((i + batchChunks.length) / totalChunks) * 100)));
      }

      // 让出事件循环，防止卡死
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    if (onProgress) onProgress(100);
    return { chunks: chunks.length };
  } catch (err: any) {
    if (_mode === 'remote') {
      throw new Error(
        `远程 Embedding 失败 (目标: ${_remoteBaseUrl})\n` +
        `原始错误: ${err.message}\n\n` +
        `建议: 切换为"离线 Embedding"可避免网络问题`
      );
    }
    throw new Error(`本地 Embedding 失败: ${err.message}`);
  }
}

export async function queryKnowledge(
  queryText: string,
  topK: number = 5,
): Promise<Array<{ id: string; score: number; metadata: Record<string, any> }>> {
  if (!_vector) throw new Error('Knowledge not initialized');
  if (_mode === 'remote' && !_remoteEmbedder) throw new Error('Remote embedder not configured');
  if (_mode === 'local' && !_localModelReady) throw new Error('Local model not ready');

  await ensureIndex();

  const indexName = getIndexName();
  let queryVector: number[];

  if (_mode === 'local') {
    const [vec] = await localEmbed([queryText]);
    queryVector = vec;
  } else {
    const res = await embed({ model: _remoteEmbedder, value: queryText });
    queryVector = res.embedding;
  }

  return _vector.query({
    indexName,
    queryVector,
    topK,
  });
}

export async function listDocuments(): Promise<Array<{ docId: string; chunkCount: number; name: string; date: string }>> {
  if (!_vector) throw new Error('Knowledge not initialized');

  await ensureIndex();

  const indexName = getIndexName();
  const client = createClient({ url: _dbUrl });
  try {
    const rs = await client.execute({
      sql: `SELECT id, metadata FROM "${indexName}"`,
    });
    const docMap = new Map<string, { name: string; date: string; count: number }>();
    for (const row of rs.rows) {
      let meta: Record<string, any> = {};
      try {
        meta = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : (row.metadata as any);
      } catch {}
      const docId = meta.docId || 'unknown';
      if (!docMap.has(docId)) {
        docMap.set(docId, { name: meta.name || docId, date: meta.date || '', count: 0 });
      }
      docMap.get(docId)!.count++;
    }
    return Array.from(docMap.entries()).map(([docId, info]) => ({
      docId,
      name: info.name,
      date: info.date,
      chunkCount: info.count,
    }));
  } finally {
    await client.close();
  }
}

export async function deleteDocument(docId: string): Promise<boolean> {
  if (!_vector) throw new Error('Knowledge not initialized');

  const indexName = getIndexName();
  const client = createClient({ url: _dbUrl });
  try {
    await client.execute({
      sql: `DELETE FROM "${indexName}" WHERE vector_id IN (SELECT vector_id FROM "${indexName}" WHERE metadata LIKE ?)`,
      args: [`%"docId":"${docId}"%`],
    });
    return true;
  } finally {
    await client.close();
  }
}
