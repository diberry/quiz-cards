// history.js — study and quiz history UI

import { apiFetch } from './app.js';

export async function renderHistory() {
  const body = document.getElementById('history-body');
  body.innerHTML = '<p style="color:var(--color-text-muted)">Loading…</p>';

  let data;
  try {
    data = await apiFetch('/api/history');
  } catch (err) {
    body.innerHTML = `<p style="color:var(--color-danger)">${err.message}</p>`;
    return;
  }

  const { quizSessions, studySessions } = data;

  if (quizSessions.length === 0 && studySessions.length === 0) {
    body.innerHTML = `
      <div class="empty-state">
        <p>No history yet.</p>
        <p>Complete a quiz or study session to see results here.</p>
      </div>`;
    return;
  }

  body.innerHTML = '';

  if (quizSessions.length > 0) {
    const section = document.createElement('div');
    section.className = 'history-section';
    section.innerHTML = `
      <h3>Quiz Results</h3>
      ${quizSessions
        .map((s) => {
          const pct = s.total > 0 ? Math.round((s.score / s.total) * 100) : 0;
          return `
          <div class="history-item">
            <div>
              <div class="history-deck">${esc(s.deck_title)}</div>
              <div class="history-meta">${formatDate(s.completed_at)}</div>
            </div>
            <div class="history-score">${pct}% &nbsp; (${s.score}/${s.total})</div>
          </div>`;
        })
        .join('')}`;
    body.appendChild(section);
  }

  if (studySessions.length > 0) {
    const section = document.createElement('div');
    section.className = 'history-section';
    section.innerHTML = `
      <h3>Study Sessions</h3>
      ${studySessions
        .map(
          (s) => `
        <div class="history-item">
          <div>
            <div class="history-deck">${esc(s.deck_title)}</div>
            <div class="history-meta">${formatDate(s.studied_at)}</div>
          </div>
          <div class="history-score">${s.cards_reviewed} card${s.cards_reviewed !== 1 ? 's' : ''} · ${formatDuration(s.duration_seconds)}</div>
        </div>`,
        )
        .join('')}`;
    body.appendChild(section);
  }
}

function formatDate(dt) {
  if (!dt) return '';
  return new Date(dt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function formatDuration(seconds) {
  if (!seconds || seconds < 60) return `${seconds || 0}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
