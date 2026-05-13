import express from 'express';
import type { Request, Response } from 'express';
import { getDb } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import type { AppUser } from '../middleware/auth.js';

const router = express.Router();

// POST /api/quiz/start/:deckId
router.post('/start/:deckId', requireAuth, (req: Request, res: Response) => {
  const db = getDb();
  const deckId = req.params.deckId as string;
  const deck = db
    .prepare('SELECT * FROM decks WHERE id = ? AND user_id = ?')
    .get(deckId, (req.user as AppUser).id) as { id: number; title: string } | undefined;
  if (!deck) {
    res.status(404).json({ error: 'Deck not found' });
    return;
  }

  const cards = db
    .prepare('SELECT id, term, definition FROM cards WHERE deck_id = ? ORDER BY RANDOM()')
    .all(deckId);
  if (cards.length === 0) {
    res.status(400).json({ error: 'Deck has no cards' });
    return;
  }

  res.json({ deckId: deck.id, deckTitle: deck.title, cards });
});

// POST /api/quiz/submit/:deckId
router.post('/submit/:deckId', requireAuth, (req: Request, res: Response) => {
  const { score, total } = req.body;
  if (score == null || total == null) {
    res.status(400).json({ error: 'score and total are required' });
    return;
  }

  const db = getDb();
  const deckId = req.params.deckId as string;
  const deck = db
    .prepare('SELECT id FROM decks WHERE id = ? AND user_id = ?')
    .get(deckId, (req.user as AppUser).id);
  if (!deck) {
    res.status(404).json({ error: 'Deck not found' });
    return;
  }

  const result = db
    .prepare('INSERT INTO quiz_sessions (user_id, deck_id, score, total) VALUES (?, ?, ?, ?)')
    .run((req.user as AppUser).id, deckId, score, total);
  const session = db
    .prepare('SELECT * FROM quiz_sessions WHERE id = ?')
    .get(result.lastInsertRowid);
  res.status(201).json(session);
});

// POST /api/quiz/study/:deckId
router.post('/study/:deckId', requireAuth, (req: Request, res: Response) => {
  const { cardsReviewed, durationSeconds } = req.body;

  const db = getDb();
  const deckId = req.params.deckId as string;
  const deck = db
    .prepare('SELECT id FROM decks WHERE id = ? AND user_id = ?')
    .get(deckId, (req.user as AppUser).id);
  if (!deck) {
    res.status(404).json({ error: 'Deck not found' });
    return;
  }

  const result = db
    .prepare(
      'INSERT INTO study_sessions (user_id, deck_id, cards_reviewed, duration_seconds) VALUES (?, ?, ?, ?)',
    )
    .run((req.user as AppUser).id, deckId, cardsReviewed || 0, durationSeconds || 0);

  const session = db
    .prepare('SELECT * FROM study_sessions WHERE id = ?')
    .get(result.lastInsertRowid);
  res.status(201).json(session);
});

export default router;
