'use strict';

const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const { requireAuth } = require('../middleware/auth');

// GET /api/history  — combined quiz + study history for current user
router.get('/', requireAuth, (req, res) => {
  const db = getDb();

  const quizSessions = db.prepare(`
    SELECT qs.*, d.title AS deck_title, 'quiz' AS type
    FROM quiz_sessions qs
    JOIN decks d ON d.id = qs.deck_id
    WHERE qs.user_id = ?
    ORDER BY qs.completed_at DESC
    LIMIT 50
  `).all(req.user.id);

  const studySessions = db.prepare(`
    SELECT ss.*, d.title AS deck_title, 'study' AS type
    FROM study_sessions ss
    JOIN decks d ON d.id = ss.deck_id
    WHERE ss.user_id = ?
    ORDER BY ss.studied_at DESC
    LIMIT 50
  `).all(req.user.id);

  res.json({ quizSessions, studySessions });
});

// GET /api/history/deck/:deckId  — history for one deck
router.get('/deck/:deckId', requireAuth, (req, res) => {
  const db = getDb();

  const deck = db.prepare('SELECT * FROM decks WHERE id = ? AND user_id = ?')
    .get(req.params.deckId, req.user.id);
  if (!deck) return res.status(404).json({ error: 'Deck not found' });

  const quizSessions = db.prepare(
    'SELECT * FROM quiz_sessions WHERE user_id = ? AND deck_id = ? ORDER BY completed_at DESC'
  ).all(req.user.id, req.params.deckId);

  const studySessions = db.prepare(
    'SELECT * FROM study_sessions WHERE user_id = ? AND deck_id = ? ORDER BY studied_at DESC'
  ).all(req.user.id, req.params.deckId);

  res.json({ deck, quizSessions, studySessions });
});

module.exports = router;
