import express from 'express';
import type { Request, Response } from 'express';
import { getDb } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import type { AppUser } from '../middleware/auth.js';

const router = express.Router();

function upsertUser(user: AppUser): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO users (id, display_name, email)
     VALUES (?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET display_name = excluded.display_name, email = excluded.email`,
  ).run(user.id, user.displayName, user.email);
}

// GET /api/decks
router.get('/', requireAuth, (req: Request, res: Response) => {
  upsertUser(req.user as AppUser);
  const db = getDb();
  const decks = db
    .prepare(
      `SELECT d.*, COUNT(c.id) AS card_count
     FROM decks d
     LEFT JOIN cards c ON c.deck_id = d.id
     WHERE d.user_id = ?
     GROUP BY d.id
     ORDER BY d.updated_at DESC`,
    )
    .all((req.user as AppUser).id);
  res.json(decks);
});

// GET /api/decks/:id
router.get('/:id', requireAuth, (req: Request, res: Response) => {
  const db = getDb();
  const id = req.params.id as string;
  const deck = db
    .prepare('SELECT * FROM decks WHERE id = ? AND user_id = ?')
    .get(id, (req.user as AppUser).id);
  if (!deck) {
    res.status(404).json({ error: 'Deck not found' });
    return;
  }
  res.json(deck);
});

// POST /api/decks
router.post('/', requireAuth, (req: Request, res: Response) => {
  upsertUser(req.user as AppUser);
  const { title, description } = req.body;
  if (!title) {
    res.status(400).json({ error: 'Title is required' });
    return;
  }

  const db = getDb();
  const result = db
    .prepare('INSERT INTO decks (user_id, title, description) VALUES (?, ?, ?)')
    .run((req.user as AppUser).id, title, description || null);
  const deck = db.prepare('SELECT * FROM decks WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(deck);
});

// PUT /api/decks/:id
router.put('/:id', requireAuth, (req: Request, res: Response) => {
  const { title, description } = req.body;
  if (!title) {
    res.status(400).json({ error: 'Title is required' });
    return;
  }

  const db = getDb();
  const id = req.params.id as string;
  const existing = db
    .prepare('SELECT * FROM decks WHERE id = ? AND user_id = ?')
    .get(id, (req.user as AppUser).id);
  if (!existing) {
    res.status(404).json({ error: 'Deck not found' });
    return;
  }

  db.prepare(
    'UPDATE decks SET title = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
  ).run(title, description || null, id);
  const deck = db.prepare('SELECT * FROM decks WHERE id = ?').get(id);
  res.json(deck);
});

// DELETE /api/decks/:id
router.delete('/:id', requireAuth, (req: Request, res: Response) => {
  const db = getDb();
  const id = req.params.id as string;
  const existing = db
    .prepare('SELECT * FROM decks WHERE id = ? AND user_id = ?')
    .get(id, (req.user as AppUser).id);
  if (!existing) {
    res.status(404).json({ error: 'Deck not found' });
    return;
  }

  db.prepare('DELETE FROM decks WHERE id = ?').run(id);
  res.status(204).end();
});

export default router;
