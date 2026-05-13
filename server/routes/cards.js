'use strict';

const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const { requireAuth } = require('../middleware/auth');

function ownsDeck(db, deckId, userId) {
  return db.prepare('SELECT id FROM decks WHERE id = ? AND user_id = ?').get(deckId, userId);
}

// GET /api/cards/:deckId
router.get('/:deckId', requireAuth, (req, res) => {
  const db = getDb();
  if (!ownsDeck(db, req.params.deckId, req.user.id)) {
    return res.status(404).json({ error: 'Deck not found' });
  }
  const cards = db.prepare('SELECT * FROM cards WHERE deck_id = ? ORDER BY position, id')
    .all(req.params.deckId);
  res.json(cards);
});

// POST /api/cards/:deckId
router.post('/:deckId', requireAuth, (req, res) => {
  const { term, definition, position } = req.body;
  if (!term || !definition) return res.status(400).json({ error: 'term and definition are required' });

  const db = getDb();
  if (!ownsDeck(db, req.params.deckId, req.user.id)) {
    return res.status(404).json({ error: 'Deck not found' });
  }

  const result = db.prepare('INSERT INTO cards (deck_id, term, definition, position) VALUES (?, ?, ?, ?)')
    .run(req.params.deckId, term, definition, position || 0);
  // Touch deck updated_at
  db.prepare('UPDATE decks SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(req.params.deckId);

  const card = db.prepare('SELECT * FROM cards WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(card);
});

// PUT /api/cards/:deckId/:cardId
router.put('/:deckId/:cardId', requireAuth, (req, res) => {
  const { term, definition, position } = req.body;
  if (!term || !definition) return res.status(400).json({ error: 'term and definition are required' });

  const db = getDb();
  if (!ownsDeck(db, req.params.deckId, req.user.id)) {
    return res.status(404).json({ error: 'Deck not found' });
  }

  const existing = db.prepare('SELECT * FROM cards WHERE id = ? AND deck_id = ?')
    .get(req.params.cardId, req.params.deckId);
  if (!existing) return res.status(404).json({ error: 'Card not found' });

  db.prepare('UPDATE cards SET term = ?, definition = ?, position = ? WHERE id = ?')
    .run(term, definition, position ?? existing.position, req.params.cardId);
  const card = db.prepare('SELECT * FROM cards WHERE id = ?').get(req.params.cardId);
  res.json(card);
});

// DELETE /api/cards/:deckId/:cardId
router.delete('/:deckId/:cardId', requireAuth, (req, res) => {
  const db = getDb();
  if (!ownsDeck(db, req.params.deckId, req.user.id)) {
    return res.status(404).json({ error: 'Deck not found' });
  }
  const existing = db.prepare('SELECT * FROM cards WHERE id = ? AND deck_id = ?')
    .get(req.params.cardId, req.params.deckId);
  if (!existing) return res.status(404).json({ error: 'Card not found' });

  db.prepare('DELETE FROM cards WHERE id = ?').run(req.params.cardId);
  res.status(204).end();
});

module.exports = router;
