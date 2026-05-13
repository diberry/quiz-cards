import type { Request, Response, NextFunction } from 'express';

export interface AppUser {
  id: string;
  displayName: string;
  email: string | null;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (req.isAuthenticated && req.isAuthenticated()) {
    next();
    return;
  }
  res.status(401).json({ error: 'Authentication required' });
}
