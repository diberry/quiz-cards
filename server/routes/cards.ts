import express from 'express';
import type { Request, Response } from 'express';
import { getDb } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import type { AppUser } from '../middleware/auth.js';

const router = express.Router();

function ownsDeck(deckId: string, userId: string): unknown {
  const db = getDb();
  return db.prepare('SELECT id FROM decks WHERE id = ? AND user_id = ?').get(deckId, userId);
}

// GET /api/cards/:deckId
router.get('/:deckId', requireAuth, (req: Request, res: Response) => {
  const deckId = req.params.deckId as string;
  if (!ownsDeck(deckId, (req.user as AppUser).id)) {
    res.status(404).json({ error: 'Deck not found' });
    return;
  }
  const db = getDb();
  const cards = db
    .prepare('SELECT * FROM cards WHERE deck_id = ? ORDER BY position, id')
    .all(deckId);
  res.json(cards);
});

// POST /api/cards/:deckId
router.post('/:deckId', requireAuth, (req: Request, res: Response) => {
  const { term, definition, position } = req.body;
  if (!term || !definition) {
    res.status(400).json({ error: 'term and definition are required' });
    return;
  }

  const deckId = req.params.deckId as string;
  if (!ownsDeck(deckId, (req.user as AppUser).id)) {
    res.status(404).json({ error: 'Deck not found' });
    return;
  }

  const db = getDb();
  const result = db
    .prepare('INSERT INTO cards (deck_id, term, definition, position) VALUES (?, ?, ?, ?)')
    .run(deckId, term, definition, position || 0);
  db.prepare('UPDATE decks SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(deckId);

  const card = db.prepare('SELECT * FROM cards WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(card);
});

// PUT /api/cards/:deckId/:cardId
router.put('/:deckId/:cardId', requireAuth, (req: Request, res: Response) => {
  const { term, definition, position } = req.body;
  if (!term || !definition) {
    res.status(400).json({ error: 'term and definition are required' });
    return;
  }

  const deckId = req.params.deckId as string;
  const cardId = req.params.cardId as string;
  if (!ownsDeck(deckId, (req.user as AppUser).id)) {
    res.status(404).json({ error: 'Deck not found' });
    return;
  }

  const db = getDb();
  const existing = db
    .prepare('SELECT * FROM cards WHERE id = ? AND deck_id = ?')
    .get(cardId, deckId) as { position: number } | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Card not found' });
    return;
  }

  db.prepare('UPDATE cards SET term = ?, definition = ?, position = ? WHERE id = ?').run(
    term,
    definition,
    position ?? existing.position,
    cardId,
  );
  const card = db.prepare('SELECT * FROM cards WHERE id = ?').get(cardId);
  res.json(card);
});

// DELETE /api/cards/:deckId/:cardId
router.delete('/:deckId/:cardId', requireAuth, (req: Request, res: Response) => {
  const deckId = req.params.deckId as string;
  const cardId = req.params.cardId as string;
  if (!ownsDeck(deckId, (req.user as AppUser).id)) {
    res.status(404).json({ error: 'Deck not found' });
    return;
  }
  const db = getDb();
  const existing = db
    .prepare('SELECT * FROM cards WHERE id = ? AND deck_id = ?')
    .get(cardId, deckId);
  if (!existing) {
    res.status(404).json({ error: 'Card not found' });
    return;
  }

  db.prepare('DELETE FROM cards WHERE id = ?').run(cardId);
  res.status(204).end();
});

export default router;
