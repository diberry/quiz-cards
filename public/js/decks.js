// decks.js — deck list UI + create/edit/delete

import { apiFetch, showView, showToast, openModal, closeModal } from './app.js';
import { renderCards } from './cards.js';

let currentDeckId = null;
export function getCurrentDeckId() {
  return currentDeckId;
}

export async function renderDecks() {
  const container = document.getElementById('deck-list');
  container.innerHTML = '<p style="color:var(--color-text-muted)">Loading…</p>';

  let decks;
  try {
    decks = await apiFetch('/api/decks');
  } catch (err) {
    container.innerHTML = `<p style="color:var(--color-danger)">${err.message}</p>`;
    return;
  }

  if (decks.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>No decks yet.</p>
        <p>Click <strong>+ New Deck</strong> to create one.</p>
      </div>`;
    return;
  }

  container.innerHTML = decks
    .map(
      (deck) => `
    <div class="deck-card" data-id="${deck.id}">
      <div class="deck-card-title">${esc(deck.title)}</div>
      ${deck.description ? `<div class="deck-card-meta">${esc(deck.description)}</div>` : ''}
      <div class="deck-card-meta">${deck.card_count ?? 0} card${deck.card_count !== 1 ? 's' : ''}</div>
      <div class="deck-card-actions">
        <button class="btn btn-secondary btn-open" data-id="${deck.id}">Open</button>
        <button class="btn btn-ghost btn-edit" data-id="${deck.id}" data-title="${esc(deck.title)}" data-desc="${esc(deck.description || '')}">Edit</button>
        <button class="btn btn-ghost btn-delete" data-id="${deck.id}" data-title="${esc(deck.title)}">Delete</button>
      </div>
    </div>
  `,
    )
    .join('');

  container.querySelectorAll('.btn-open').forEach((btn) =>
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openDeck(btn.dataset.id);
    }),
  );
  container
    .querySelectorAll('.deck-card')
    .forEach((card) => card.addEventListener('click', () => openDeck(card.dataset.id)));
  container.querySelectorAll('.btn-edit').forEach((btn) =>
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      editDeck(btn.dataset.id, btn.dataset.title, btn.dataset.desc);
    }),
  );
  container.querySelectorAll('.btn-delete').forEach((btn) =>
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteDeck(btn.dataset.id, btn.dataset.title);
    }),
  );
}

async function openDeck(deckId) {
  currentDeckId = deckId;
  let deck;
  try {
    deck = await apiFetch(`/api/decks/${deckId}`);
  } catch {
    return;
  }

  document.getElementById('deck-detail-title').textContent = deck.title;
  showView('deck-detail');
  renderCards(deckId);
  wireDetailButtons(deckId);
}

function wireDetailButtons(deckId) {
  document.getElementById('btn-study-mode').onclick = () => {
    import('./cards.js').then((m) => m.startStudy(deckId));
  };
  document.getElementById('btn-quiz-mode').onclick = () => {
    import('./quiz.js').then((m) => m.startQuiz(deckId));
  };
  document.getElementById('btn-import-deck').onclick = () => {
    import('./import.js').then((m) => m.showImport(deckId));
  };
  document.getElementById('btn-add-card').onclick = () => {
    import('./cards.js').then((m) => m.addCard(deckId));
  };
}

async function editDeck(id, title, description) {
  const result = await openModal({
    title: 'Edit Deck',
    bodyHtml: `
      <div class="form-group">
        <label class="form-label">Title</label>
        <input class="form-input" id="modal-deck-title" value="${esc(title)}" maxlength="120" />
      </div>
      <div class="form-group">
        <label class="form-label">Description</label>
        <textarea class="form-textarea" id="modal-deck-desc">${esc(description)}</textarea>
      </div>`,
  });
  if (result !== 'confirm') return;

  const newTitle = document.getElementById('modal-deck-title').value.trim();
  const newDesc = document.getElementById('modal-deck-desc').value.trim();
  if (!newTitle) return showToast('Title is required');

  try {
    await apiFetch(`/api/decks/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ title: newTitle, description: newDesc }),
    });
    showToast('Deck updated');
    renderDecks();
  } catch (err) {
    showToast(err.message);
  }
}

async function deleteDeck(id, title) {
  const result = await openModal({
    title: 'Delete Deck',
    bodyHtml: `<p>Delete <strong>${esc(title)}</strong> and all its cards? This cannot be undone.</p>`,
    confirmLabel: 'Delete',
  });
  if (result !== 'confirm') return;

  try {
    await apiFetch(`/api/decks/${id}`, { method: 'DELETE' });
    showToast('Deck deleted');
    renderDecks();
  } catch (err) {
    showToast(err.message);
  }
}

// New deck button
document.getElementById('btn-new-deck').addEventListener('click', async () => {
  const result = await openModal({
    title: 'New Deck',
    bodyHtml: `
      <div class="form-group">
        <label class="form-label">Title</label>
        <input class="form-input" id="modal-deck-title" placeholder="e.g. Biology Chapter 5" maxlength="120" autofocus />
      </div>
      <div class="form-group">
        <label class="form-label">Description (optional)</label>
        <textarea class="form-textarea" id="modal-deck-desc" placeholder="What's this deck about?"></textarea>
      </div>`,
    confirmLabel: 'Create',
  });
  if (result !== 'confirm') return;

  const title = document.getElementById('modal-deck-title').value.trim();
  const description = document.getElementById('modal-deck-desc').value.trim();
  if (!title) return showToast('Title is required');

  try {
    await apiFetch('/api/decks', {
      method: 'POST',
      body: JSON.stringify({ title, description }),
    });
    showToast('Deck created!');
    renderDecks();
  } catch (err) {
    showToast(err.message);
  }
});

function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
