'use strict';

require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const passport = require('passport');
const { OIDCStrategy } = require('passport-azure-ad');

const { initDb, getDb } = require('./db');
const decksRouter = require('./routes/decks');
const cardsRouter = require('./routes/cards');
const quizRouter = require('./routes/quiz');
const importRouter = require('./routes/import');
const historyRouter = require('./routes/history');

const app = express();
const PORT = process.env.PORT || 3000;

initDb();

// --- Passport serialization (upsert into users table) ---

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  try {
    const db = getDb();
    const row = db.prepare('SELECT id, display_name, email FROM users WHERE id = ?').get(id);
    if (row) {
      done(null, { id: row.id, displayName: row.display_name, email: row.email });
    } else {
      done(null, false);
    }
  } catch (err) {
    done(err);
  }
});

function upsertPassportUser(profile) {
  const db = getDb();
  const id = profile.oid || profile.id || profile.sub;
  const displayName = profile.displayName || profile._json?.name || 'User';
  const email = profile._json?.email || profile.emails?.[0]?.value || profile._json?.preferred_username || null;
  db.prepare(
    'INSERT INTO users (id, display_name, email) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET display_name = excluded.display_name, email = excluded.email'
  ).run(id, displayName, email);
  return { id, displayName, email };
}

// --- Configure Entra ID (OIDC) strategy ---

const entraConfigured = process.env.ENTRA_CLIENT_ID && process.env.ENTRA_TENANT_ID && process.env.ENTRA_CLIENT_SECRET;

if (entraConfigured) {
  passport.use('entra', new OIDCStrategy({
    identityMetadata: `https://login.microsoftonline.com/${process.env.ENTRA_TENANT_ID}/v2.0/.well-known/openid-configuration`,
    clientID: process.env.ENTRA_CLIENT_ID,
    clientSecret: process.env.ENTRA_CLIENT_SECRET,
    responseType: 'code',
    responseMode: 'form_post',
    redirectUrl: process.env.ENTRA_REDIRECT_URI || `http://localhost:${PORT}/auth/entra/callback`,
    allowHttpForRedirectUrl: true,
    scope: ['openid', 'profile', 'email'],
    passReqToCallback: false,
  }, (_iss, _sub, profile, _accessToken, _refreshToken, done) => {
    try {
      const user = upsertPassportUser(profile);
      done(null, user);
    } catch (err) {
      done(err);
    }
  }));
}

// --- Configure Google strategy (optional) ---

const googleConfigured = process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET;

if (googleConfigured) {
  const GoogleStrategy = require('passport-google-oauth20').Strategy;
  passport.use('google', new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || `http://localhost:${PORT}/auth/google/callback`,
    scope: ['openid', 'profile', 'email'],
  }, (_accessToken, _refreshToken, profile, done) => {
    try {
      const user = upsertPassportUser(profile);
      done(null, user);
    } catch (err) {
      done(err);
    }
  }));
}

// --- Configure GitHub strategy (optional) ---

const githubConfigured = process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET;

if (githubConfigured) {
  const GitHubStrategy = require('passport-github2').Strategy;
  passport.use('github', new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackURL: process.env.GITHUB_CALLBACK_URL || `http://localhost:${PORT}/auth/github/callback`,
    scope: ['user:email'],
  }, (_accessToken, _refreshToken, profile, done) => {
    try {
      const user = upsertPassportUser(profile);
      done(null, user);
    } catch (err) {
      done(err);
    }
  }));
}

// --- Middleware ---

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  store: new SQLiteStore({ db: 'sessions.db', dir: path.join(__dirname, '..', 'data') }),
  secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  },
}));

app.use(passport.initialize());
app.use(passport.session());

// --- Auth config endpoint (tells client which providers are available) ---

app.get('/api/config', (_req, res) => {
  res.json({
    providers: {
      entra: !!entraConfigured,
      google: !!googleConfigured,
      github: !!githubConfigured,
    },
  });
});

// --- Auth routes ---

// Entra ID
if (entraConfigured) {
  app.get('/auth/entra', passport.authenticate('entra'));
  app.post('/auth/entra/callback',
    passport.authenticate('entra', { failureRedirect: '/?error=auth_failed' }),
    (_req, res) => res.redirect('/'));
}

// Google
if (googleConfigured) {
  app.get('/auth/google', passport.authenticate('google'));
  app.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/?error=auth_failed' }),
    (_req, res) => res.redirect('/'));
}

// GitHub
if (githubConfigured) {
  app.get('/auth/github', passport.authenticate('github'));
  app.get('/auth/github/callback',
    passport.authenticate('github', { failureRedirect: '/?error=auth_failed' }),
    (_req, res) => res.redirect('/'));
}

// Logout
app.post('/auth/logout', (req, res) => {
  req.logout(() => {
    req.session.destroy(() => {
      res.clearCookie('connect.sid');
      res.json({ ok: true });
    });
  });
});

// Current user info
app.get('/auth/me', (req, res) => {
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

app.get('/{*splat}', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Study Cards running at http://localhost:${PORT}`);
});
