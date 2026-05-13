import express from 'express';
import type { Request, Response } from 'express';
import multer from 'multer';
import { parse } from 'csv-parse/sync';
import { getDb } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import type { AppUser } from '../middleware/auth.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

interface RawCard {
  term?: string;
  definition?: string;
}

interface ParsedCard {
  term: string;
  definition: string;
  position: number;
}

function parseCards(rawCards: RawCard[]): ParsedCard[] {
  return rawCards
    .filter((r) => r.term && r.definition)
    .map((r, i) => ({
      term: String(r.term).trim(),
      definition: String(r.definition).trim(),
      position: i,
    }));
}

// POST /api/import/:deckId
router.post('/:deckId', requireAuth, upload.single('file'), (req: Request, res: Response) => {
  const db = getDb();
  const deckId = req.params.deckId as string;
  const deck = db
    .prepare('SELECT * FROM decks WHERE id = ? AND user_id = ?')
    .get(deckId, (req.user as AppUser).id);
  if (!deck) {
    res.status(404).json({ error: 'Deck not found' });
    return;
  }

  let rawCards: RawCard[];

  try {
    if (req.file) {
      const content = req.file.buffer.toString('utf8');
      const mime = req.file.mimetype;

      if (mime === 'application/json' || req.file.originalname.endsWith('.json')) {
        rawCards = JSON.parse(content);
      } else {
        rawCards = parse(content, {
          columns: true,
          skip_empty_lines: true,
          trim: true,
        }) as RawCard[];
      }
    } else if (req.body.data) {
      rawCards = JSON.parse(req.body.data);
    } else {
      res.status(400).json({ error: 'Provide a file or data field' });
      return;
    }
  } catch (err) {
    res.status(400).json({ error: 'Could not parse input: ' + (err as Error).message });
    return;
  }

  const cards = parseCards(rawCards);
  if (cards.length === 0) {
    res.status(400).json({ error: 'No valid cards found (need term + definition)' });
    return;
  }

  const insert = db.prepare(
    'INSERT INTO cards (deck_id, term, definition, position) VALUES (?, ?, ?, ?)',
  );
  db.exec('BEGIN');
  try {
    for (const card of cards) {
      insert.run(deckId, card.term, card.definition, card.position);
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    res.status(500).json({ error: 'Insert failed: ' + (err as Error).message });
    return;
  }

  db.prepare('UPDATE decks SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(deckId);
  res.status(201).json({ imported: cards.length });
});

export default router;
