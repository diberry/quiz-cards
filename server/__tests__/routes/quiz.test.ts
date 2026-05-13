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
import quizRouter from '../../routes/quiz.js';

describe('Quiz API', () => {
  let db: DatabaseSync;
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    db = createTestDb();
    (dbModule as unknown as { __setMockDb: (d: DatabaseSync) => void }).__setMockDb(db);
    app = createTestApp(quizRouter, '/api/quiz');
    seedUser(db);
    db.prepare('INSERT INTO decks (user_id, title) VALUES (?, ?)').run('test-user-1', 'Quiz Deck');
    db.prepare('INSERT INTO cards (deck_id, term, definition) VALUES (?, ?, ?)').run(1, 'Q1', 'A1');
    db.prepare('INSERT INTO cards (deck_id, term, definition) VALUES (?, ?, ?)').run(1, 'Q2', 'A2');
  });

  describe('POST /api/quiz/start/:deckId', () => {
    it('returns 404 for non-existent deck', async () => {
      const res = await request(app).post('/api/quiz/start/999');
      expect(res.status).toBe(404);
    });

    it('returns 400 for deck with no cards', async () => {
      db.prepare('INSERT INTO decks (user_id, title) VALUES (?, ?)').run(
        'test-user-1',
        'Empty Deck',
      );
      const res = await request(app).post('/api/quiz/start/2');
      expect(res.status).toBe(400);
    });

    it('returns shuffled cards for quiz', async () => {
      const res = await request(app).post('/api/quiz/start/1');
      expect(res.status).toBe(200);
      expect(res.body.deckTitle).toBe('Quiz Deck');
      expect(res.body.cards).toHaveLength(2);
    });
  });

  describe('POST /api/quiz/submit/:deckId', () => {
    it('returns 400 if score/total missing', async () => {
      const res = await request(app).post('/api/quiz/submit/1').send({});
      expect(res.status).toBe(400);
    });

    it('saves quiz results', async () => {
      const res = await request(app).post('/api/quiz/submit/1').send({ score: 2, total: 2 });
      expect(res.status).toBe(201);
      expect(res.body.score).toBe(2);
      expect(res.body.total).toBe(2);
    });

    it('returns 404 for non-existent deck', async () => {
      const res = await request(app).post('/api/quiz/submit/999').send({ score: 1, total: 1 });
      expect(res.status).toBe(404);
    });
  });
});
