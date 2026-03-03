import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { query } from '../db/pool';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { config } from '../config';
import { logger } from '../utils/logger';

const router = Router();

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(100),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post('/register', async (req: Request, res: Response): Promise<void> => {
  const parse = RegisterSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: 'Validation failed', details: parse.error.flatten() });
    return;
  }

  const { email, password, name } = parse.data;

  try {
    const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rowCount > 0) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const userId = uuidv4();

    await query(
      'INSERT INTO users (id, email, name, password) VALUES ($1, $2, $3, $4)',
      [userId, email, name, hashedPassword]
    );

    const accessToken = signAccessToken({ userId, email });
    const refreshToken = signRefreshToken({ userId, email });
    const refreshTokenId = uuidv4();
    const expiresAt = new Date(Date.now() + config.refreshExpiresIn * 1000);

    await query(
      'INSERT INTO refresh_tokens (id, user_id, token, expires_at) VALUES ($1, $2, $3, $4)',
      [refreshTokenId, userId, refreshToken, expiresAt]
    );

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: config.nodeEnv === 'production',
      sameSite: 'strict',
      maxAge: config.refreshExpiresIn * 1000,
    });

    res.status(201).json({
      accessToken,
      user: { id: userId, email, name },
    });
  } catch (err) {
    logger.error('Register error', { error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const parse = LoginSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: 'Validation failed', details: parse.error.flatten() });
    return;
  }

  const { email, password } = parse.data;

  try {
    const result = await query<{
      id: string;
      email: string;
      name: string;
      password: string;
    }>('SELECT id, email, name, password FROM users WHERE email = $1', [email]);

    if (result.rowCount === 0) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const accessToken = signAccessToken({ userId: user.id, email: user.email });
    const refreshToken = signRefreshToken({ userId: user.id, email: user.email });
    const refreshTokenId = uuidv4();
    const expiresAt = new Date(Date.now() + config.refreshExpiresIn * 1000);

    await query(
      'INSERT INTO refresh_tokens (id, user_id, token, expires_at) VALUES ($1, $2, $3, $4)',
      [refreshTokenId, user.id, refreshToken, expiresAt]
    );

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: config.nodeEnv === 'production',
      sameSite: 'strict',
      maxAge: config.refreshExpiresIn * 1000,
    });

    res.json({
      accessToken,
      user: { id: user.id, email: user.email, name: user.name },
    });
  } catch (err) {
    logger.error('Login error', { error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  const token = req.cookies?.refreshToken;
  if (!token) {
    res.status(401).json({ error: 'No refresh token' });
    return;
  }

  try {
    const payload = verifyRefreshToken(token);

    const stored = await query(
      'SELECT id FROM refresh_tokens WHERE token = $1 AND expires_at > NOW()',
      [token]
    );

    if (stored.rowCount === 0) {
      res.status(401).json({ error: 'Refresh token expired or revoked' });
      return;
    }

    await query('DELETE FROM refresh_tokens WHERE token = $1', [token]);

    const newAccessToken = signAccessToken({ userId: payload.userId, email: payload.email });
    const newRefreshToken = signRefreshToken({ userId: payload.userId, email: payload.email });
    const expiresAt = new Date(Date.now() + config.refreshExpiresIn * 1000);

    await query(
      'INSERT INTO refresh_tokens (id, user_id, token, expires_at) VALUES ($1, $2, $3, $4)',
      [uuidv4(), payload.userId, newRefreshToken, expiresAt]
    );

    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: config.nodeEnv === 'production',
      sameSite: 'strict',
      maxAge: config.refreshExpiresIn * 1000,
    });

    res.json({ accessToken: newAccessToken });
  } catch (err) {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

router.post('/logout', async (req: Request, res: Response): Promise<void> => {
  const token = req.cookies?.refreshToken;
  if (token) {
    await query('DELETE FROM refresh_tokens WHERE token = $1', [token]).catch(() => {});
  }
  res.clearCookie('refreshToken');
  res.json({ ok: true });
});

router.get('/me', async (req: Request, res: Response): Promise<void> => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) { res.status(401).json({ error: 'Unauthorized' }); return; }

  try {
    const { verifyAccessToken } = await import('../utils/jwt');
    const payload = verifyAccessToken(token);
    const result = await query<{ id: string; email: string; name: string }>(
      'SELECT id, email, name FROM users WHERE id = $1',
      [payload.userId]
    );
    if (result.rowCount === 0) { res.status(404).json({ error: 'User not found' }); return; }
    res.json({ user: result.rows[0] });
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
});

export default router;
