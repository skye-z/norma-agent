import { LibSQLVector } from '@mastra/libsql';
import { ModelRouterEmbeddingModel } from '@mastra/core/llm';
import { MDocument } from '@mastra/rag';
import { embedMany, embed } from 'ai';
import * as path from 'path';

const INDEX_NAME = 'norma_knowledge';
const EMBEDDING_DIMENSION = 1536;

let _vector: LibSQLVector | null = null;
let _embedder: ModelRouterEmbeddingModel | null = null;

export function initKnowledge(dbDir?: string) {
  const dbPath = dbDir
    ? `file:${path.join(dbDir, 'norma-memory.db')}`
    : 'file:norma-memory.db';

  _vector = new LibSQLVector({
    id: 'norma-knowledge-vector',
    url: dbPath,
  });

  if (process.env.OPENAI_API_KEY) {
    _embedder = new ModelRouterEmbeddingModel('openai/text-embedding-3-small');
  }
}

async function ensureIndex() {
  if (!_vector) throw new Error('Knowledge not initialized');
  try {
    const indexes = await _vector.listIndexes();
    if (!indexes.includes(INDEX_NAME)) {
      await _vector.createIndex({ indexName: INDEX_NAME, dimension: EMBEDDING_DIMENSION });
    }
  } catch {}
}

export async function ingestDocument(
  docId: string,
  text: string,
  metadata: Record<string, any>,
): Promise<{ chunks: number }> {
  if (!_vector || !_embedder) throw new Error('Knowledge not initialized (need OPENAI_API_KEY)');

  await ensureIndex();

  const doc = MDocument.fromText(text);
  const chunks = await doc.chunk({
    strategy: 'recursive',
    maxSize: 512,
    overlap: 50,
  });

  if (chunks.length === 0) return { chunks: 0 };

  const { embeddings } = await embedMany({
    model: _embedder,
    values: chunks.map((c) => c.text),
  });

  const ids = chunks.map((_, i) => `${docId}_${i}`);

  await _vector.upsert({
    indexName: INDEX_NAME,
    vectors: embeddings,
    metadata: chunks.map((c, i) => ({
      ...metadata,
      text: c.text,
      docId,
      chunkIndex: i,
    })),
    ids,
  });

  return { chunks: chunks.length };
}

export async function queryKnowledge(
  queryText: string,
  topK: number = 5,
): Promise<Array<{ id: string; score: number; metadata: Record<string, any> }>> {
  if (!_vector || !_embedder) throw new Error('Knowledge not initialized (need OPENAI_API_KEY)');

  await ensureIndex();

  const { embedding } = await embed({
    model: _embedder,
    value: queryText,
  });

  const results = await _vector.query({
    indexName: INDEX_NAME,
    queryVector: embedding,
    topK,
  });

  return results;
}

export async function listDocuments(): Promise<Array<{ docId: string; chunkCount: number; name: string; date: string }>> {
  if (!_vector) throw new Error('Knowledge not initialized');

  await ensureIndex();

  const results = await _vector.query({
    indexName: INDEX_NAME,
    queryVector: new Array(EMBEDDING_DIMENSION).fill(0),
    topK: 1000,
  });

  const docMap = new Map<string, { name: string; date: string; count: number }>();
  for (const r of results) {
    const m = r.metadata || {};
    const docId = m.docId || 'unknown';
    if (!docMap.has(docId)) {
      docMap.set(docId, { name: m.name || docId, date: m.date || '', count: 0 });
    }
    docMap.get(docId)!.count++;
  }

  return Array.from(docMap.entries()).map(([docId, info]) => ({
    docId,
    name: info.name,
    date: info.date,
    chunkCount: info.count,
  }));
}

export async function deleteDocument(docId: string): Promise<boolean> {
  if (!_vector) throw new Error('Knowledge not initialized');

  await _vector.deleteVectors(INDEX_NAME, { docId } as any);
  return true;
}
