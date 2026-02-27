import dotenv from 'dotenv';
dotenv.config();

function required(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required env var: ${name}`);
  return val;
}

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: required('DATABASE_URL'),
  redisUrl: required('REDIS_URL'),
  jwtSecret: required('JWT_SECRET'),
  jwtRefreshSecret: required('JWT_REFRESH_SECRET'),
  corsOrigin: (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',').map(s => s.trim()),
  jwtExpiresIn: '15m',
  refreshExpiresIn: 7 * 24 * 60 * 60, // 7 days in seconds
  snapshotIntervalMs: 30_000,
  executionTimeoutMs: 10_000,
  executionMemoryBytes: 64 * 1024 * 1024, // 64 MB
};
