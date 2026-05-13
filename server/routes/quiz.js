'use strict';

const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const { requireAuth } = require('../middleware/auth');

// POST /api/quiz/start/:deckId  — returns shuffled cards for quiz
router.post('/start/:deckId', requireAuth, (req, res) => {
  const db = getDb();
  const deck = db.prepare('SELECT * FROM decks WHERE id = ? AND user_id = ?')
    .get(req.params.deckId, req.user.id);
  if (!deck) return res.status(404).json({ error: 'Deck not found' });

  const cards = db.prepare('SELECT id, term, definition FROM cards WHERE deck_id = ? ORDER BY RANDOM()')
    .all(req.params.deckId);
  if (cards.length === 0) return res.status(400).json({ error: 'Deck has no cards' });

  res.json({ deckId: deck.id, deckTitle: deck.title, cards });
});

// POST /api/quiz/submit/:deckId  — save quiz score
router.post('/submit/:deckId', requireAuth, (req, res) => {
  const { score, total } = req.body;
  if (score == null || total == null) {
    return res.status(400).json({ error: 'score and total are required' });
  }

  const db = getDb();
  const deck = db.prepare('SELECT id FROM decks WHERE id = ? AND user_id = ?')
    .get(req.params.deckId, req.user.id);
  if (!deck) return res.status(404).json({ error: 'Deck not found' });

  const result = db.prepare('INSERT INTO quiz_sessions (user_id, deck_id, score, total) VALUES (?, ?, ?, ?)')
    .run(req.user.id, req.params.deckId, score, total);
  const session = db.prepare('SELECT * FROM quiz_sessions WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(session);
});

// POST /api/quiz/study/:deckId  — save study session
router.post('/study/:deckId', requireAuth, (req, res) => {
  const { cardsReviewed, durationSeconds } = req.body;

  const db = getDb();
  const deck = db.prepare('SELECT id FROM decks WHERE id = ? AND user_id = ?')
    .get(req.params.deckId, req.user.id);
  if (!deck) return res.status(404).json({ error: 'Deck not found' });

  const result = db.prepare(
    'INSERT INTO study_sessions (user_id, deck_id, cards_reviewed, duration_seconds) VALUES (?, ?, ?, ?)'
  ).run(req.user.id, req.params.deckId, cardsReviewed || 0, durationSeconds || 0);

  const session = db.prepare('SELECT * FROM study_sessions WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(session);
});

module.exports = router;
