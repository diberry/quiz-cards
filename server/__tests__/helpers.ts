import { DatabaseSync } from 'node:sqlite';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';

/**
 * Create an in-memory SQLite database with the app schema.
 */
export function createTestDb(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      email TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS decks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL REFERENCES users(id),
      title TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      deck_id INTEGER NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
      term TEXT NOT NULL,
      definition TEXT NOT NULL,
      position INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS quiz_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL REFERENCES users(id),
      deck_id INTEGER NOT NULL REFERENCES decks(id),
      score INTEGER DEFAULT 0,
      total INTEGER DEFAULT 0,
      completed_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS study_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL REFERENCES users(id),
      deck_id INTEGER NOT NULL REFERENCES decks(id),
      cards_reviewed INTEGER DEFAULT 0,
      duration_seconds INTEGER DEFAULT 0,
      studied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  return db;
}

/**
 * Seed a test user into the database.
 */
export function seedUser(db: DatabaseSync, id = 'test-user-1'): void {
  db.prepare('INSERT OR IGNORE INTO users (id, display_name, email) VALUES (?, ?, ?)').run(
    id,
    'Test User',
    'test@example.com',
  );
}

/**
 * Mock auth middleware that sets req.user and marks the request as authenticated.
 */
export function mockAuth(userId = 'test-user-1') {
  return (req: Request, _res: Response, next: NextFunction) => {
    req.user = { id: userId, displayName: 'Test User', email: 'test@example.com' };
    req.isAuthenticated = () => true;
    next();
  };
}

/**
 * Create a minimal Express app with JSON parsing and mock auth for testing.
 */
export function createTestApp(router: express.Router, basePath: string, userId = 'test-user-1') {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(mockAuth(userId));
  app.use(basePath, router);
  return app;
}
