'use strict';

const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const { requireAuth } = require('../middleware/auth');

// Upsert user record from token claims
function upsertUser(user) {
  const db = getDb();
  db.prepare(`
    INSERT INTO users (id, display_name, email)
    VALUES (?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET display_name = excluded.display_name, email = excluded.email
  `).run(user.id, user.displayName, user.email);
}

// GET /api/decks — list decks for current user
router.get('/', requireAuth, (req, res) => {
  upsertUser(req.user);
  const db = getDb();
  const decks = db.prepare(`
    SELECT d.*, COUNT(c.id) AS card_count
    FROM decks d
    LEFT JOIN cards c ON c.deck_id = d.id
    WHERE d.user_id = ?
    GROUP BY d.id
    ORDER BY d.updated_at DESC
  `).all(req.user.id);
  res.json(decks);
});

// GET /api/decks/:id
router.get('/:id', requireAuth, (req, res) => {
  const db = getDb();
  const deck = db.prepare('SELECT * FROM decks WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.id);
  if (!deck) return res.status(404).json({ error: 'Deck not found' });
  res.json(deck);
});

// POST /api/decks
router.post('/', requireAuth, (req, res) => {
  upsertUser(req.user);
  const { title, description } = req.body;
  if (!title) return res.status(400).json({ error: 'Title is required' });

  const db = getDb();
  const result = db.prepare('INSERT INTO decks (user_id, title, description) VALUES (?, ?, ?)')
    .run(req.user.id, title, description || null);
  const deck = db.prepare('SELECT * FROM decks WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(deck);
});

// PUT /api/decks/:id
router.put('/:id', requireAuth, (req, res) => {
  const { title, description } = req.body;
  if (!title) return res.status(400).json({ error: 'Title is required' });

  const db = getDb();
  const existing = db.prepare('SELECT * FROM decks WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: 'Deck not found' });

  db.prepare('UPDATE decks SET title = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(title, description || null, req.params.id);
  const deck = db.prepare('SELECT * FROM decks WHERE id = ?').get(req.params.id);
  res.json(deck);
});

// DELETE /api/decks/:id
router.delete('/:id', requireAuth, (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM decks WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: 'Deck not found' });

  db.prepare('DELETE FROM decks WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

module.exports = router;
