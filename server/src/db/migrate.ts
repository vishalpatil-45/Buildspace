import { readFileSync } from 'fs';
import { join } from 'path';
import { pool } from './pool';
import { logger } from '../utils/logger';

async function migrate() {
  logger.info('Running database migrations...');
  const schemaPath = join(__dirname, '../../schema.sql');
  const schema = readFileSync(schemaPath, 'utf-8');

  const client = await pool.connect();
  try {
    await client.query(schema);
    logger.info('Migrations completed successfully');
  } catch (err) {
    logger.error('Migration failed', { error: err });
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
