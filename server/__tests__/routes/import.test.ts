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
import importRouter from '../../routes/import.js';

describe('Import API', () => {
  let db: DatabaseSync;
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    db = createTestDb();
    (dbModule as unknown as { __setMockDb: (d: DatabaseSync) => void }).__setMockDb(db);
    app = createTestApp(importRouter, '/api/import');
    seedUser(db);
    db.prepare('INSERT INTO decks (user_id, title) VALUES (?, ?)').run(
      'test-user-1',
      'Import Deck',
    );
  });

  describe('POST /api/import/:deckId', () => {
    it('returns 404 for non-existent deck', async () => {
      const res = await request(app)
        .post('/api/import/999')
        .send({ data: JSON.stringify([{ term: 'a', definition: 'b' }]) });
      expect(res.status).toBe(404);
    });

    it('imports JSON data from body', async () => {
      const cards = [
        { term: 'React', definition: 'UI library' },
        { term: 'Vue', definition: 'Progressive framework' },
      ];
      const res = await request(app)
        .post('/api/import/1')
        .send({ data: JSON.stringify(cards) });
      expect(res.status).toBe(201);
      expect(res.body.imported).toBe(2);
    });

    it('returns 400 for invalid JSON', async () => {
      const res = await request(app).post('/api/import/1').send({ data: 'not-json{' });
      expect(res.status).toBe(400);
    });

    it('returns 400 for no valid cards', async () => {
      const res = await request(app)
        .post('/api/import/1')
        .send({ data: JSON.stringify([{ foo: 'bar' }]) });
      expect(res.status).toBe(400);
    });

    it('imports CSV file', async () => {
      const csv = 'term,definition\nHTML,Markup Language\nCSS,Stylesheets';
      const res = await request(app)
        .post('/api/import/1')
        .attach('file', Buffer.from(csv), { filename: 'cards.csv', contentType: 'text/csv' });
      expect(res.status).toBe(201);
      expect(res.body.imported).toBe(2);
    });

    it('imports JSON file', async () => {
      const json = JSON.stringify([{ term: 'Node', definition: 'Runtime' }]);
      const res = await request(app).post('/api/import/1').attach('file', Buffer.from(json), {
        filename: 'cards.json',
        contentType: 'application/json',
      });
      expect(res.status).toBe(201);
      expect(res.body.imported).toBe(1);
    });

    it('returns 400 when no file or data provided', async () => {
      const res = await request(app).post('/api/import/1').send({});
      expect(res.status).toBe(400);
    });
  });
});
