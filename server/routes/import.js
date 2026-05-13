'use strict';

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { parse } = require('csv-parse/sync');
const { getDb } = require('../db');
const { requireAuth } = require('../middleware/auth');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

function parseCards(rawCards) {
  return rawCards
    .filter(r => r.term && r.definition)
    .map((r, i) => ({ term: String(r.term).trim(), definition: String(r.definition).trim(), position: i }));
}

// POST /api/import/:deckId  — import CSV or JSON
router.post('/:deckId', requireAuth, upload.single('file'), (req, res) => {
  const db = getDb();
  const deck = db.prepare('SELECT * FROM decks WHERE id = ? AND user_id = ?')
    .get(req.params.deckId, req.user.id);
  if (!deck) return res.status(404).json({ error: 'Deck not found' });

  let rawCards = [];

  try {
    if (req.file) {
      const content = req.file.buffer.toString('utf8');
      const mime = req.file.mimetype;

      if (mime === 'application/json' || req.file.originalname.endsWith('.json')) {
        rawCards = JSON.parse(content);
      } else {
        // CSV — first row may be a header
        const rows = parse(content, { columns: true, skip_empty_lines: true, trim: true });
        rawCards = rows;
      }
    } else if (req.body.data) {
      // Paste as JSON string
      rawCards = JSON.parse(req.body.data);
    } else {
      return res.status(400).json({ error: 'Provide a file or data field' });
    }
  } catch (err) {
    return res.status(400).json({ error: 'Could not parse input: ' + err.message });
  }

  const cards = parseCards(rawCards);
  if (cards.length === 0) {
    return res.status(400).json({ error: 'No valid cards found (need term + definition)' });
  }

  const insert = db.prepare('INSERT INTO cards (deck_id, term, definition, position) VALUES (?, ?, ?, ?)');
  db.exec('BEGIN');
  try {
    for (const card of cards) {
      insert.run(req.params.deckId, card.term, card.definition, card.position);
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    return res.status(500).json({ error: 'Insert failed: ' + err.message });
  }

  db.prepare('UPDATE decks SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(req.params.deckId);
  res.status(201).json({ imported: cards.length });
});

module.exports = router;
