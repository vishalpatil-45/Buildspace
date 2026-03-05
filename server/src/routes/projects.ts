import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { query } from '../db/pool';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();
router.use(authMiddleware);

const CreateProjectSchema = z.object({ name: z.string().min(1).max(200) });
const UpdateProjectSchema = z.object({ name: z.string().min(1).max(200) });

// GET /api/projects
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await query<{
      id: string; name: string; owner_id: string;
      created_at: string; updated_at: string; role: string;
    }>(
      `SELECT p.id, p.name, p.owner_id, p.created_at, p.updated_at, pm.role
       FROM projects p
       JOIN project_members pm ON pm.project_id = p.id
       WHERE pm.user_id = $1
       ORDER BY p.updated_at DESC`,
      [req.userId]
    );
    res.json({ projects: result.rows });
  } catch (err) {
    logger.error('Get projects error', { error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/projects
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const parse = CreateProjectSchema.safeParse(req.body);
  if (!parse.success) { res.status(400).json({ error: 'Validation failed', details: parse.error.flatten() }); return; }

  try {
    const projectId = uuidv4();
    await query(
      'INSERT INTO projects (id, name, owner_id) VALUES ($1, $2, $3)',
      [projectId, parse.data.name, req.userId]
    );
    await query(
      'INSERT INTO project_members (id, project_id, user_id, role) VALUES ($1, $2, $3, $4)',
      [uuidv4(), projectId, req.userId, 'owner']
    );

    const result = await query<{ id: string; name: string; owner_id: string; created_at: string; updated_at: string }>(
      'SELECT id, name, owner_id, created_at, updated_at FROM projects WHERE id = $1',
      [projectId]
    );
    res.status(201).json({ project: { ...result.rows[0], role: 'owner' } });
  } catch (err) {
    logger.error('Create project error', { error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/projects/:projectId
router.get('/:projectId', async (req: AuthRequest, res: Response): Promise<void> => {
  const { projectId } = req.params;
  try {
    const memberCheck = await query(
      'SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2',
      [projectId, req.userId]
    );
    if (memberCheck.rowCount === 0) { res.status(403).json({ error: 'Access denied' }); return; }

    const result = await query<{ id: string; name: string; owner_id: string; created_at: string; updated_at: string }>(
      'SELECT id, name, owner_id, created_at, updated_at FROM projects WHERE id = $1',
      [projectId]
    );
    if (result.rowCount === 0) { res.status(404).json({ error: 'Project not found' }); return; }

    res.json({ project: { ...result.rows[0], role: memberCheck.rows[0].role } });
  } catch (err) {
    logger.error('Get project error', { error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/projects/:projectId
router.patch('/:projectId', async (req: AuthRequest, res: Response): Promise<void> => {
  const { projectId } = req.params;
  const parse = UpdateProjectSchema.safeParse(req.body);
  if (!parse.success) { res.status(400).json({ error: 'Validation failed' }); return; }

  try {
    const memberCheck = await query(
      "SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2",
      [projectId, req.userId]
    );
    if (memberCheck.rowCount === 0 || memberCheck.rows[0].role !== 'owner') {
      res.status(403).json({ error: 'Only owner can rename project' }); return;
    }
    await query('UPDATE projects SET name = $1 WHERE id = $2', [parse.data.name, projectId]);
    res.json({ ok: true });
  } catch (err) {
    logger.error('Update project error', { error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/projects/:projectId
router.delete('/:projectId', async (req: AuthRequest, res: Response): Promise<void> => {
  const { projectId } = req.params;
  try {
    const memberCheck = await query(
      "SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2",
      [projectId, req.userId]
    );
    if (memberCheck.rowCount === 0 || memberCheck.rows[0].role !== 'owner') {
      res.status(403).json({ error: 'Only owner can delete project' }); return;
    }
    await query('DELETE FROM projects WHERE id = $1', [projectId]);
    res.json({ ok: true });
  } catch (err) {
    logger.error('Delete project error', { error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/projects/:projectId/members
router.get('/:projectId/members', async (req: AuthRequest, res: Response): Promise<void> => {
  const { projectId } = req.params;
  try {
    const memberCheck = await query(
      'SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2',
      [projectId, req.userId]
    );
    if (memberCheck.rowCount === 0) { res.status(403).json({ error: 'Access denied' }); return; }

    const result = await query<{ id: string; user_id: string; email: string; name: string; role: string }>(
      `SELECT pm.id, pm.user_id, u.email, u.name, pm.role
       FROM project_members pm
       JOIN users u ON u.id = pm.user_id
       WHERE pm.project_id = $1
       ORDER BY pm.created_at ASC`,
      [projectId]
    );
    res.json({ members: result.rows });
  } catch (err) {
    logger.error('Get members error', { error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/projects/:projectId/members — invite by email
router.post('/:projectId/members', async (req: AuthRequest, res: Response): Promise<void> => {
  const { projectId } = req.params;
  const InviteSchema = z.object({
    email: z.string().email(),
    role: z.enum(['editor', 'viewer']),
  });
  const parse = InviteSchema.safeParse(req.body);
  if (!parse.success) { res.status(400).json({ error: 'Validation failed' }); return; }

  try {
    const memberCheck = await query(
      "SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2",
      [projectId, req.userId]
    );
    if (memberCheck.rowCount === 0 || memberCheck.rows[0].role !== 'owner') {
      res.status(403).json({ error: 'Only owner can invite members' }); return;
    }

    const userResult = await query<{ id: string }>('SELECT id FROM users WHERE email = $1', [parse.data.email]);
    if (userResult.rowCount === 0) { res.status(404).json({ error: 'User not found' }); return; }

    const inviteeId = userResult.rows[0].id;
    const existing = await query(
      'SELECT id FROM project_members WHERE project_id = $1 AND user_id = $2',
      [projectId, inviteeId]
    );
    if (existing.rowCount > 0) {
      await query(
        'UPDATE project_members SET role = $1 WHERE project_id = $2 AND user_id = $3',
        [parse.data.role, projectId, inviteeId]
      );
    } else {
      await query(
        'INSERT INTO project_members (id, project_id, user_id, role) VALUES ($1, $2, $3, $4)',
        [uuidv4(), projectId, inviteeId, parse.data.role]
      );
    }
    res.json({ ok: true });
  } catch (err) {
    logger.error('Invite member error', { error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/projects/:projectId/members/:userId
router.delete('/:projectId/members/:memberId', async (req: AuthRequest, res: Response): Promise<void> => {
  const { projectId, memberId } = req.params;
  try {
    const memberCheck = await query(
      "SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2",
      [projectId, req.userId]
    );
    if (memberCheck.rowCount === 0 || memberCheck.rows[0].role !== 'owner') {
      res.status(403).json({ error: 'Only owner can remove members' }); return;
    }
    await query('DELETE FROM project_members WHERE project_id = $1 AND user_id = $2', [projectId, memberId]);
    res.json({ ok: true });
  } catch (err) {
    logger.error('Remove member error', { error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
