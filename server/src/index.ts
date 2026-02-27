import 'dotenv/config';
import express from 'express';
import http from 'http';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { readFileSync } from 'fs';
import { join } from 'path';
import { config } from './config';
import { logger } from './utils/logger';
import { connectRedis } from './db/redis';
import { pool } from './db/pool';
import authRouter from './routes/auth';
import projectsRouter from './routes/projects';
import filesRouter from './routes/files';
import { setupSyncWs } from './ws/sync';
import { setupRunWs } from './ws/run';

async function runMigrations() {
  const schemaPath = join(__dirname, '../schema.sql');
  const schema = readFileSync(schemaPath, 'utf-8');
  const client = await pool.connect();
  try {
    await client.query(schema);
    logger.info('Database schema ready');
  } catch (err) {
    logger.error('Migration failed', { error: err });
    throw err;
  } finally {
    client.release();
  }
}

async function main() {
  await runMigrations();
  await connectRedis();

  const app = express();
  const server = http.createServer(app);

  app.use(cors({
    origin: config.corsOrigin,
    credentials: true,
  }));
  app.use(express.json({ limit: '10mb' }));
  app.use(cookieParser());

  app.get('/', (_req, res) => {
    res.json({ name: 'CollabIDE API', version: '1.0.0', status: 'ok' });
  });

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/projects', projectsRouter);
  app.use('/api/projects/:projectId/files', filesRouter);

  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error('Unhandled error', { error: err.message, stack: err.stack });
    res.status(500).json({ error: 'Internal server error' });
  });

  setupSyncWs(server);
  setupRunWs(server);

  server.listen(config.port, () => {
    logger.info(`CollabIDE server running on port ${config.port}`, {
      env: config.nodeEnv,
      port: config.port,
    });
  });

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      logger.error(`Port ${config.port} is already in use. Run: netstat -ano | findstr :${config.port} then: taskkill /PID <PID> /F`);
      process.exit(1);
    } else {
      throw err;
    }
  });
}

main().catch((err) => {
  logger.error('Failed to start server', { error: err.message });
  process.exit(1);
});
