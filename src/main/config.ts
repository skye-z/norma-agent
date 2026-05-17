import { createClient, type Client } from '@libsql/client';
import * as path from 'path';

let _client: Client | null = null;

export function initConfig(dbDir?: string) {
  const dbPath = dbDir
    ? path.join(dbDir, 'norma-config.db')
    : 'norma-config.db';

  _client = createClient({ url: `file:${dbPath}` });

  _client.execute(`
    CREATE TABLE IF NOT EXISTS app_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `).catch(() => {});
}

function getClient(): Client {
  if (!_client) initConfig();
  return _client!;
}

export async function getConfig<T = any>(key: string): Promise<T | null> {
  const client = getClient();
  const rs = await client.execute({
    sql: 'SELECT value FROM app_config WHERE key = ?',
    args: [key],
  });
  if (rs.rows.length === 0) return null;
  try {
    return JSON.parse(rs.rows[0].value as string) as T;
  } catch {
    return rs.rows[0].value as unknown as T;
  }
}

export async function setConfig(key: string, value: any): Promise<void> {
  const client = getClient();
  const serialized = typeof value === 'string' ? JSON.stringify(value) : JSON.stringify(value);
  await client.execute({
    sql: `INSERT INTO app_config (key, value, updated_at) VALUES (?, ?, unixepoch())
          ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = unixepoch()`,
    args: [key, serialized],
  });
}

export async function deleteConfig(key: string): Promise<void> {
  const client = getClient();
  await client.execute({
    sql: 'DELETE FROM app_config WHERE key = ?',
    args: [key],
  });
}

export async function getAllConfig(): Promise<Record<string, any>> {
  const client = getClient();
  const rs = await client.execute('SELECT key, value FROM app_config');
  const result: Record<string, any> = {};
  for (const row of rs.rows) {
    try {
      result[row.key as string] = JSON.parse(row.value as string);
    } catch {
      result[row.key as string] = row.value;
    }
  }
  return result;
}
