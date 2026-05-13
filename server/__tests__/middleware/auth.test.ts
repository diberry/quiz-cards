import { describe, it, expect } from 'vitest';
import express from 'express';
import type { Request, Response } from 'express';
import request from 'supertest';
import { requireAuth } from '../../middleware/auth.js';

describe('Auth Middleware', () => {
  function createApp(authenticated: boolean) {
    const app = express();
    app.use((req: Request, _res: Response, next) => {
      if (authenticated) {
        req.user = { id: 'u1', displayName: 'User', email: 'u@x.com' };
        req.isAuthenticated = () => true;
      } else {
        req.isAuthenticated = () => false;
      }
      next();
    });
    app.get('/protected', requireAuth, (_req: Request, res: Response) => {
      res.json({ ok: true });
    });
    return app;
  }

  it('allows authenticated requests', async () => {
    const app = createApp(true);
    const res = await request(app).get('/protected');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('rejects unauthenticated requests with 401', async () => {
    const app = createApp(false);
    const res = await request(app).get('/protected');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Authentication required');
  });
});
