import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { query } from '../db/pool';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { detectLanguage } from '../utils/language';
import { logger } from '../utils/logger';

const router = Router({ mergeParams: true });
router.use(authMiddleware);

async function checkAccess(
  projectId: string,
  userId: string,
  minRole: 'viewer' | 'editor' | 'owner' = 'viewer'
): Promise<string | null> {
  const result = await query<{ role: string }>(
    'SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2',
    [projectId, userId]
  );
  if (result.rowCount === 0) return null;
  const role = result.rows[0].role;
  const roles = ['viewer', 'editor', 'owner'];
  if (roles.indexOf(role) >= roles.indexOf(minRole)) return role;
  return null;
}

// GET /api/projects/:projectId/files
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const { projectId } = req.params;
  const role = await checkAccess(projectId, req.userId!, 'viewer');
  if (!role) { res.status(403).json({ error: 'Access denied' }); return; }

  try {
    const result = await query<{
      id: string; name: string; language: string; position: number;
      content: string; created_at: string; updated_at: string;
    }>(
      'SELECT id, name, language, position, content, created_at, updated_at FROM files WHERE project_id = $1 ORDER BY position ASC',
      [projectId]
    );
    res.json({ files: result.rows });
  } catch (err) {
    logger.error('Get files error', { error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/projects/:projectId/files
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const { projectId } = req.params;
  const role = await checkAccess(projectId, req.userId!, 'editor');
  if (!role) { res.status(403).json({ error: 'Access denied' }); return; }

  const CreateFileSchema = z.object({
    name: z.string().min(1).max(255),
    content: z.string().optional(),
    position: z.number().int().optional(),
  });
  const parse = CreateFileSchema.safeParse(req.body);
  if (!parse.success) { res.status(400).json({ error: 'Validation failed', details: parse.error.flatten() }); return; }

  try {
    // Get max position
    const posResult = await query<{ max_pos: number }>(
      'SELECT COALESCE(MAX(position), -1) as max_pos FROM files WHERE project_id = $1',
      [projectId]
    );
    const position = parse.data.position ?? posResult.rows[0].max_pos + 1;
    const language = detectLanguage(parse.data.name);
    const fileId = uuidv4();

    await query(
      'INSERT INTO files (id, project_id, name, content, language, position) VALUES ($1, $2, $3, $4, $5, $6)',
      [fileId, projectId, parse.data.name, parse.data.content || '', language, position]
    );

    const result = await query<{ id: string; name: string; language: string; position: number; content: string; created_at: string; updated_at: string }>(
      'SELECT id, name, language, position, content, created_at, updated_at FROM files WHERE id = $1',
      [fileId]
    );
    res.status(201).json({ file: result.rows[0] });
  } catch (err: any) {
    if (err.code === '23505') { res.status(409).json({ error: 'File with this name already exists' }); return; }
    logger.error('Create file error', { error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/projects/:projectId/files/:fileId
router.get('/:fileId', async (req: AuthRequest, res: Response): Promise<void> => {
  const { projectId, fileId } = req.params;
  const role = await checkAccess(projectId, req.userId!, 'viewer');
  if (!role) { res.status(403).json({ error: 'Access denied' }); return; }

  try {
    const result = await query<{ id: string; name: string; language: string; position: number; content: string; created_at: string; updated_at: string }>(
      'SELECT id, name, language, position, content, created_at, updated_at FROM files WHERE id = $1 AND project_id = $2',
      [fileId, projectId]
    );
    if (result.rowCount === 0) { res.status(404).json({ error: 'File not found' }); return; }
    res.json({ file: result.rows[0] });
  } catch (err) {
    logger.error('Get file error', { error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/projects/:projectId/files/:fileId
router.patch('/:fileId', async (req: AuthRequest, res: Response): Promise<void> => {
  const { projectId, fileId } = req.params;
  const role = await checkAccess(projectId, req.userId!, 'editor');
  if (!role) { res.status(403).json({ error: 'Access denied' }); return; }

  const PatchFileSchema = z.object({
    name: z.string().min(1).max(255).optional(),
    content: z.string().optional(),
    position: z.number().int().min(0).optional(),
  });
  const parse = PatchFileSchema.safeParse(req.body);
  if (!parse.success) { res.status(400).json({ error: 'Validation failed' }); return; }

  try {
    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (parse.data.name !== undefined) {
      updates.push(`name = $${idx++}`);
      values.push(parse.data.name);
      updates.push(`language = $${idx++}`);
      values.push(detectLanguage(parse.data.name));
    }
    if (parse.data.content !== undefined) {
      updates.push(`content = $${idx++}`);
      values.push(parse.data.content);
    }
    if (parse.data.position !== undefined) {
      updates.push(`position = $${idx++}`);
      values.push(parse.data.position);
    }

    if (updates.length === 0) { res.json({ ok: true }); return; }

    values.push(fileId, projectId);
    await query(
      `UPDATE files SET ${updates.join(', ')} WHERE id = $${idx++} AND project_id = $${idx++}`,
      values
    );
    res.json({ ok: true });
  } catch (err) {
    logger.error('Update file error', { error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/projects/:projectId/files/:fileId
router.delete('/:fileId', async (req: AuthRequest, res: Response): Promise<void> => {
  const { projectId, fileId } = req.params;
  const role = await checkAccess(projectId, req.userId!, 'editor');
  if (!role) { res.status(403).json({ error: 'Access denied' }); return; }

  try {
    await query('DELETE FROM files WHERE id = $1 AND project_id = $2', [fileId, projectId]);
    res.json({ ok: true });
  } catch (err) {
    logger.error('Delete file error', { error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/projects/:projectId/files/reorder — bulk reorder
router.patch('/bulk/reorder', async (req: AuthRequest, res: Response): Promise<void> => {
  const { projectId } = req.params;
  const role = await checkAccess(projectId, req.userId!, 'editor');
  if (!role) { res.status(403).json({ error: 'Access denied' }); return; }

  const ReorderSchema = z.object({
    order: z.array(z.object({ id: z.string().uuid(), position: z.number().int().min(0) })),
  });
  const parse = ReorderSchema.safeParse(req.body);
  if (!parse.success) { res.status(400).json({ error: 'Validation failed' }); return; }

  try {
    const client = await (await import('../db/pool')).getClient();
    try {
      await client.query('BEGIN');
      for (const { id, position } of parse.data.order) {
        await client.query('UPDATE files SET position = $1 WHERE id = $2 AND project_id = $3', [position, id, projectId]);
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
    res.json({ ok: true });
  } catch (err) {
    logger.error('Reorder files error', { error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
