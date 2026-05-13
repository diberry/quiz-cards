import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createTestDb, seedUser, createTestApp } from '../helpers.js';
import type { DatabaseSync } from 'node:sqlite';

vi.mock('../../db.js', () => {
  let mockDb: DatabaseSync;
  return {
    getDb: () => mockDb,
    initDb: () => {},
    setDb: (db: DatabaseSync) => {
      mockDb = db;
    },
    __setMockDb: (db: DatabaseSync) => {
      mockDb = db;
    },
  };
});

import * as dbModule from '../../db.js';
import cardsRouter from '../../routes/cards.js';

describe('Cards API', () => {
  let db: DatabaseSync;
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    db = createTestDb();
    (dbModule as unknown as { __setMockDb: (d: DatabaseSync) => void }).__setMockDb(db);
    app = createTestApp(cardsRouter, '/api/cards');
    seedUser(db);
    db.prepare('INSERT INTO decks (user_id, title) VALUES (?, ?)').run('test-user-1', 'Test Deck');
  });

  describe('GET /api/cards/:deckId', () => {
    it('returns 404 for non-existent deck', async () => {
      const res = await request(app).get('/api/cards/999');
      expect(res.status).toBe(404);
    });

    it('returns cards for a deck', async () => {
      db.prepare('INSERT INTO cards (deck_id, term, definition) VALUES (?, ?, ?)').run(
        1,
        'hello',
        'world',
      );
      const res = await request(app).get('/api/cards/1');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].term).toBe('hello');
    });
  });

  describe('POST /api/cards/:deckId', () => {
    it('returns 400 if term or definition missing', async () => {
      const res = await request(app).post('/api/cards/1').send({ term: 'only term' });
      expect(res.status).toBe(400);
    });

    it('creates a card', async () => {
      const res = await request(app)
        .post('/api/cards/1')
        .send({ term: 'TypeScript', definition: 'Typed JavaScript' });
      expect(res.status).toBe(201);
      expect(res.body.term).toBe('TypeScript');
    });
  });

  describe('PUT /api/cards/:deckId/:cardId', () => {
    it('returns 404 for non-existent card', async () => {
      const res = await request(app).put('/api/cards/1/999').send({ term: 'a', definition: 'b' });
      expect(res.status).toBe(404);
    });

    it('updates a card', async () => {
      db.prepare('INSERT INTO cards (deck_id, term, definition) VALUES (?, ?, ?)').run(
        1,
        'old',
        'value',
      );
      const res = await request(app)
        .put('/api/cards/1/1')
        .send({ term: 'new', definition: 'updated' });
      expect(res.status).toBe(200);
      expect(res.body.term).toBe('new');
    });
  });

  describe('DELETE /api/cards/:deckId/:cardId', () => {
    it('returns 404 for non-existent card', async () => {
      const res = await request(app).delete('/api/cards/1/999');
      expect(res.status).toBe(404);
    });

    it('deletes a card', async () => {
      db.prepare('INSERT INTO cards (deck_id, term, definition) VALUES (?, ?, ?)').run(
        1,
        'del',
        'me',
      );
      const res = await request(app).delete('/api/cards/1/1');
      expect(res.status).toBe(204);
    });
  });
});
