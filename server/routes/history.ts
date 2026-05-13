import express from 'express';
import type { Request, Response } from 'express';
import { getDb } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import type { AppUser } from '../middleware/auth.js';

const router = express.Router();

// GET /api/history
router.get('/', requireAuth, (req: Request, res: Response) => {
  const db = getDb();

  const quizSessions = db
    .prepare(
      `SELECT qs.*, d.title AS deck_title, 'quiz' AS type
     FROM quiz_sessions qs
     JOIN decks d ON d.id = qs.deck_id
     WHERE qs.user_id = ?
     ORDER BY qs.completed_at DESC
     LIMIT 50`,
    )
    .all((req.user as AppUser).id);

  const studySessions = db
    .prepare(
      `SELECT ss.*, d.title AS deck_title, 'study' AS type
     FROM study_sessions ss
     JOIN decks d ON d.id = ss.deck_id
     WHERE ss.user_id = ?
     ORDER BY ss.studied_at DESC
     LIMIT 50`,
    )
    .all((req.user as AppUser).id);

  res.json({ quizSessions, studySessions });
});

// GET /api/history/deck/:deckId
router.get('/deck/:deckId', requireAuth, (req: Request, res: Response) => {
  const db = getDb();
  const deckId = req.params.deckId as string;

  const deck = db
    .prepare('SELECT * FROM decks WHERE id = ? AND user_id = ?')
    .get(deckId, (req.user as AppUser).id);
  if (!deck) {
    res.status(404).json({ error: 'Deck not found' });
    return;
  }

  const quizSessions = db
    .prepare(
      'SELECT * FROM quiz_sessions WHERE user_id = ? AND deck_id = ? ORDER BY completed_at DESC',
    )
    .all((req.user as AppUser).id, deckId);

  const studySessions = db
    .prepare(
      'SELECT * FROM study_sessions WHERE user_id = ? AND deck_id = ? ORDER BY studied_at DESC',
    )
    .all((req.user as AppUser).id, deckId);

  res.json({ deck, quizSessions, studySessions });
});

export default router;
