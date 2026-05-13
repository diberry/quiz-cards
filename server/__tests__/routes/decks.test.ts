import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createTestDb, seedUser, createTestApp } from '../helpers.js';
import type { DatabaseSync } from 'node:sqlite';

// Mock the db module
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

// We need to dynamically import the router after mocking
import decksRouter from '../../routes/decks.js';

describe('Decks API', () => {
  let db: DatabaseSync;
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    db = createTestDb();
    (dbModule as unknown as { __setMockDb: (d: DatabaseSync) => void }).__setMockDb(db);
    app = createTestApp(decksRouter, '/api/decks');
    seedUser(db);
  });

  describe('GET /api/decks', () => {
    it('returns empty array when no decks', async () => {
      const res = await request(app).get('/api/decks');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('returns decks for authenticated user', async () => {
      db.prepare('INSERT INTO decks (user_id, title, description) VALUES (?, ?, ?)').run(
        'test-user-1',
        'JS Basics',
        'JavaScript fundamentals',
      );
      const res = await request(app).get('/api/decks');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].title).toBe('JS Basics');
    });
  });

  describe('GET /api/decks/:id', () => {
    it('returns 404 for non-existent deck', async () => {
      const res = await request(app).get('/api/decks/999');
      expect(res.status).toBe(404);
    });

    it('returns deck by id', async () => {
      db.prepare('INSERT INTO decks (user_id, title) VALUES (?, ?)').run('test-user-1', 'My Deck');
      const res = await request(app).get('/api/decks/1');
      expect(res.status).toBe(200);
      expect(res.body.title).toBe('My Deck');
    });
  });

  describe('POST /api/decks', () => {
    it('returns 400 if title missing', async () => {
      const res = await request(app).post('/api/decks').send({});
      expect(res.status).toBe(400);
    });

    it('creates a deck', async () => {
      const res = await request(app)
        .post('/api/decks')
        .send({ title: 'New Deck', description: 'A test deck' });
      expect(res.status).toBe(201);
      expect(res.body.title).toBe('New Deck');
      expect(res.body.id).toBeDefined();
    });
  });

  describe('PUT /api/decks/:id', () => {
    it('returns 404 for non-existent deck', async () => {
      const res = await request(app).put('/api/decks/999').send({ title: 'Updated' });
      expect(res.status).toBe(404);
    });

    it('updates a deck', async () => {
      db.prepare('INSERT INTO decks (user_id, title) VALUES (?, ?)').run('test-user-1', 'Old');
      const res = await request(app).put('/api/decks/1').send({ title: 'Updated' });
      expect(res.status).toBe(200);
      expect(res.body.title).toBe('Updated');
    });
  });

  describe('DELETE /api/decks/:id', () => {
    it('returns 404 for non-existent deck', async () => {
      const res = await request(app).delete('/api/decks/999');
      expect(res.status).toBe(404);
    });

    it('deletes a deck', async () => {
      db.prepare('INSERT INTO decks (user_id, title) VALUES (?, ?)').run('test-user-1', 'ToDelete');
      const res = await request(app).delete('/api/decks/1');
      expect(res.status).toBe(204);
    });
  });
});
