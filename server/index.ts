import 'dotenv/config';
import express from 'express';
import type { Request, Response } from 'express';
import path from 'node:path';
import cors from 'cors';
import session from 'express-session';
import connectSqlite3 from 'connect-sqlite3';
import passport from 'passport';
import { OIDCStrategy } from 'passport-azure-ad';

import { initDb, getDb } from './db.js';
import type { AppUser } from './middleware/auth.js';
import decksRouter from './routes/decks.js';
import cardsRouter from './routes/cards.js';
import quizRouter from './routes/quiz.js';
import importRouter from './routes/import.js';
import historyRouter from './routes/history.js';

// Augment Express to know about our user shape
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface User {
      id: string;
      displayName: string;
      email: string | null;
    }
  }
}

const SQLiteStore = connectSqlite3(session);

export const app = express();
const PORT = process.env.PORT || 3000;

initDb();

// --- Passport serialization ---

passport.serializeUser((user, done) => {
  done(null, (user as AppUser).id);
});

passport.deserializeUser((id: string, done) => {
  try {
    const db = getDb();
    const row = db.prepare('SELECT id, display_name, email FROM users WHERE id = ?').get(id) as
      | { id: string; display_name: string; email: string | null }
      | undefined;
    if (row) {
      done(null, { id: row.id, displayName: row.display_name, email: row.email });
    } else {
      done(null, false);
    }
  } catch (err) {
    done(err);
  }
});

interface PassportProfile {
  oid?: string;
  id?: string;
  sub?: string;
  displayName?: string;
  _json?: { name?: string; email?: string; preferred_username?: string };
  emails?: { value: string }[];
}

function upsertPassportUser(profile: PassportProfile): AppUser {
  const db = getDb();
  const id = profile.oid || profile.id || profile.sub || 'unknown';
  const displayName = profile.displayName || profile._json?.name || 'User';
  const email =
    profile._json?.email || profile.emails?.[0]?.value || profile._json?.preferred_username || null;
  db.prepare(
    'INSERT INTO users (id, display_name, email) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET display_name = excluded.display_name, email = excluded.email',
  ).run(id, displayName, email);
  return { id, displayName, email };
}

// --- Entra ID (OIDC) ---

const entraConfigured =
  process.env.ENTRA_CLIENT_ID && process.env.ENTRA_TENANT_ID && process.env.ENTRA_CLIENT_SECRET;

if (entraConfigured) {
  passport.use(
    'entra',
    new OIDCStrategy(
      {
        identityMetadata: `https://login.microsoftonline.com/${process.env.ENTRA_TENANT_ID}/v2.0/.well-known/openid-configuration`,
        clientID: process.env.ENTRA_CLIENT_ID!,
        clientSecret: process.env.ENTRA_CLIENT_SECRET!,
        responseType: 'code',
        responseMode: 'form_post',
        redirectUrl:
          process.env.ENTRA_REDIRECT_URI || `http://localhost:${PORT}/auth/entra/callback`,
        allowHttpForRedirectUrl: true,
        scope: ['openid', 'profile', 'email'],
        passReqToCallback: false,
      },
      (
        _iss: string,
        _sub: string,
        profile: PassportProfile,
        _accessToken: string,
        _refreshToken: string,
        done: (err: Error | null, user?: AppUser) => void,
      ) => {
        try {
          const user = upsertPassportUser(profile);
          done(null, user);
        } catch (err) {
          done(err as Error);
        }
      },
    ),
  );
}

// --- Google (optional) ---

const googleConfigured = process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET;

if (googleConfigured) {
  const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
  passport.use(
    'google',
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL:
          process.env.GOOGLE_CALLBACK_URL || `http://localhost:${PORT}/auth/google/callback`,
        scope: ['openid', 'profile', 'email'],
      },
      (
        _accessToken: string,
        _refreshToken: string,
        profile: PassportProfile,
        done: (err: Error | null, user?: AppUser) => void,
      ) => {
        try {
          const user = upsertPassportUser(profile);
          done(null, user);
        } catch (err) {
          done(err as Error);
        }
      },
    ),
  );
}

// --- GitHub (optional) ---

const githubConfigured = process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET;

if (githubConfigured) {
  const { Strategy: GitHubStrategy } = require('passport-github2');
  passport.use(
    'github',
    new GitHubStrategy(
      {
        clientID: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        callbackURL:
          process.env.GITHUB_CALLBACK_URL || `http://localhost:${PORT}/auth/github/callback`,
        scope: ['user:email'],
      },
      (
        _accessToken: string,
        _refreshToken: string,
        profile: PassportProfile,
        done: (err: Error | null, user?: AppUser) => void,
      ) => {
        try {
          const user = upsertPassportUser(profile);
          done(null, user);
        } catch (err) {
          done(err as Error);
        }
      },
    ),
  );
}

// --- Middleware ---

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    store: new SQLiteStore({ db: 'sessions.db', dir: path.join(__dirname, '..', 'data') }),
    secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
    },
  }),
);

app.use(passport.initialize());
app.use(passport.session());

// --- Auth config endpoint ---

app.get('/api/config', (_req: Request, res: Response) => {
  res.json({
    providers: {
      entra: !!entraConfigured,
      google: !!googleConfigured,
      github: !!githubConfigured,
    },
  });
});

// --- Auth routes ---

if (entraConfigured) {
  app.get('/auth/entra', passport.authenticate('entra'));
  app.post(
    '/auth/entra/callback',
    passport.authenticate('entra', { failureRedirect: '/?error=auth_failed' }),
    (_req: Request, res: Response) => res.redirect('/'),
  );
}

if (googleConfigured) {
  app.get('/auth/google', passport.authenticate('google'));
  app.get(
    '/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/?error=auth_failed' }),
    (_req: Request, res: Response) => res.redirect('/'),
  );
}

if (githubConfigured) {
  app.get('/auth/github', passport.authenticate('github'));
  app.get(
    '/auth/github/callback',
    passport.authenticate('github', { failureRedirect: '/?error=auth_failed' }),
    (_req: Request, res: Response) => res.redirect('/'),
  );
}

app.post('/auth/logout', (req: Request, res: Response) => {
  req.logout(() => {
    req.session.destroy(() => {
      res.clearCookie('connect.sid');
      res.json({ ok: true });
    });
  });
});

app.get('/auth/me', (req: Request, res: Response) => {
  if (req.isAuthenticated()) {
    res.json({ user: req.user });
  } else {
    res.json({ user: null });
  }
});

// --- API routes ---

app.use('/api/decks', decksRouter);
app.use('/api/cards', cardsRouter);
app.use('/api/quiz', quizRouter);
app.use('/api/import', importRouter);
app.use('/api/history', historyRouter);

// --- Static files ---

app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/{*splat}', (_req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Only start listener if this is the main module
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Study Cards running at http://localhost:${PORT}`);
  });
}
