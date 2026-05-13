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
import historyRouter from '../../routes/history.js';

describe('History API', () => {
  let db: DatabaseSync;
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    db = createTestDb();
    (dbModule as unknown as { __setMockDb: (d: DatabaseSync) => void }).__setMockDb(db);
    app = createTestApp(historyRouter, '/api/history');
    seedUser(db);
    db.prepare('INSERT INTO decks (user_id, title) VALUES (?, ?)').run(
      'test-user-1',
      'History Deck',
    );
  });

  describe('GET /api/history', () => {
    it('returns empty arrays when no history', async () => {
      const res = await request(app).get('/api/history');
      expect(res.status).toBe(200);
      expect(res.body.quizSessions).toEqual([]);
      expect(res.body.studySessions).toEqual([]);
    });

    it('returns quiz and study sessions', async () => {
      db.prepare(
        'INSERT INTO quiz_sessions (user_id, deck_id, score, total) VALUES (?, ?, ?, ?)',
      ).run('test-user-1', 1, 8, 10);
      db.prepare(
        'INSERT INTO study_sessions (user_id, deck_id, cards_reviewed, duration_seconds) VALUES (?, ?, ?, ?)',
      ).run('test-user-1', 1, 5, 120);

      const res = await request(app).get('/api/history');
      expect(res.status).toBe(200);
      expect(res.body.quizSessions).toHaveLength(1);
      expect(res.body.studySessions).toHaveLength(1);
      expect(res.body.quizSessions[0].score).toBe(8);
    });
  });

  describe('GET /api/history/deck/:deckId', () => {
    it('returns 404 for non-existent deck', async () => {
      const res = await request(app).get('/api/history/deck/999');
      expect(res.status).toBe(404);
    });

    it('returns history for specific deck', async () => {
      db.prepare(
        'INSERT INTO quiz_sessions (user_id, deck_id, score, total) VALUES (?, ?, ?, ?)',
      ).run('test-user-1', 1, 5, 5);

      const res = await request(app).get('/api/history/deck/1');
      expect(res.status).toBe(200);
      expect(res.body.deck.title).toBe('History Deck');
      expect(res.body.quizSessions).toHaveLength(1);
    });
  });
});
