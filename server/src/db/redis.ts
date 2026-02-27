import { createClient } from 'redis';
import { config } from '../config';
import { logger } from '../utils/logger';

export const redis = createClient({ url: config.redisUrl });

redis.on('error', (err) => logger.error('Redis error', { error: err.message }));
redis.on('connect', () => logger.info('Redis connected'));

export async function connectRedis() {
  await redis.connect();
}

// Y.Doc state helpers
export async function getYDocState(fileId: string): Promise<Buffer | null> {
  const data = await redis.get(`ydoc:${fileId}`);
  if (!data) return null;
  return Buffer.from(data, 'base64');
}

export async function setYDocState(fileId: string, state: Uint8Array): Promise<void> {
  await redis.set(`ydoc:${fileId}`, Buffer.from(state).toString('base64'), { EX: 3600 });
}

export async function deleteYDocState(fileId: string): Promise<void> {
  await redis.del(`ydoc:${fileId}`);
}
