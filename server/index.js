'use strict';

require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');

const { initDb } = require('./db');
const decksRouter = require('./routes/decks');
const cardsRouter = require('./routes/cards');
const quizRouter = require('./routes/quiz');
const importRouter = require('./routes/import');
const historyRouter = require('./routes/history');

const app = express();
const PORT = process.env.PORT || 3000;

initDb();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Expose Entra config to the browser (no secrets here)
app.get('/api/config', (_req, res) => {
  res.json({
    clientId: process.env.ENTRA_CLIENT_ID || '',
    tenantId: process.env.ENTRA_TENANT_ID || '',
    redirectUri: process.env.ENTRA_REDIRECT_URI || `http://localhost:${PORT}`,
  });
});

app.use('/api/decks', decksRouter);
app.use('/api/cards', cardsRouter);
app.use('/api/quiz', quizRouter);
app.use('/api/import', importRouter);
app.use('/api/history', historyRouter);

app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Study Cards running at http://localhost:${PORT}`);
});
