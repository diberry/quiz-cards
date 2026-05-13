// cards.js — card list, add/edit/delete, study (flip) mode

import { apiFetch, showView, showToast, openModal } from './app.js';

// ---------- Card list ----------

export async function renderCards(deckId) {
  const container = document.getElementById('card-list');
  container.innerHTML = '<p style="color:var(--color-text-muted)">Loading…</p>';

  let cards;
  try {
    cards = await apiFetch(`/api/cards/${deckId}`);
  } catch (err) {
    container.innerHTML = `<p style="color:var(--color-danger)">${err.message}</p>`;
    return;
  }

  if (cards.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>No cards in this deck yet.</p>
        <p>Click <strong>+ Card</strong> to add one, or use <strong>Import</strong> to bulk-add.</p>
      </div>`;
    return;
  }

  container.innerHTML = cards.map((card, i) => `
    <div class="card-item">
      <div class="card-item-content">
        <div class="card-term">${esc(card.term)}</div>
        <div class="card-definition">${esc(card.definition)}</div>
      </div>
      <div class="card-item-actions">
        <button class="btn btn-ghost btn-edit-card" data-id="${card.id}" data-deck="${deckId}"
          data-term="${esc(card.term)}" data-def="${esc(card.definition)}" data-pos="${i}">Edit</button>
        <button class="btn btn-ghost btn-delete-card" data-id="${card.id}" data-deck="${deckId}">✕</button>
      </div>
    </div>
  `).join('');

  container.querySelectorAll('.btn-edit-card').forEach(btn =>
    btn.addEventListener('click', () => editCard(btn.dataset.deck, btn.dataset.id, btn.dataset.term, btn.dataset.def, btn.dataset.pos)));
  container.querySelectorAll('.btn-delete-card').forEach(btn =>
    btn.addEventListener('click', () => deleteCard(btn.dataset.deck, btn.dataset.id)));
}

// ---------- Add / Edit / Delete ----------

export async function addCard(deckId) {
  const result = await openModal({
    title: 'Add Card',
    bodyHtml: cardFormHtml('', ''),
    confirmLabel: 'Add',
  });
  if (result !== 'confirm') return;

  const term = document.getElementById('modal-card-term').value.trim();
  const definition = document.getElementById('modal-card-def').value.trim();
  if (!term || !definition) return showToast('Term and definition are required');

  try {
    await apiFetch(`/api/cards/${deckId}`, { method: 'POST', body: JSON.stringify({ term, definition }) });
    showToast('Card added');
    renderCards(deckId);
  } catch (err) { showToast(err.message); }
}

async function editCard(deckId, cardId, term, definition, position) {
  const result = await openModal({
    title: 'Edit Card',
    bodyHtml: cardFormHtml(term, definition),
    confirmLabel: 'Save',
  });
  if (result !== 'confirm') return;

  const newTerm = document.getElementById('modal-card-term').value.trim();
  const newDef = document.getElementById('modal-card-def').value.trim();
  if (!newTerm || !newDef) return showToast('Term and definition are required');

  try {
    await apiFetch(`/api/cards/${deckId}/${cardId}`, {
      method: 'PUT',
      body: JSON.stringify({ term: newTerm, definition: newDef, position: Number(position) }),
    });
    showToast('Card saved');
    renderCards(deckId);
  } catch (err) { showToast(err.message); }
}

async function deleteCard(deckId, cardId) {
  const result = await openModal({
    title: 'Delete Card',
    bodyHtml: '<p>Remove this card from the deck?</p>',
    confirmLabel: 'Delete',
  });
  if (result !== 'confirm') return;

  try {
    await apiFetch(`/api/cards/${deckId}/${cardId}`, { method: 'DELETE' });
    showToast('Card deleted');
    renderCards(deckId);
  } catch (err) { showToast(err.message); }
}

function cardFormHtml(term, definition) {
  return `
    <div class="form-group">
      <label class="form-label">Term</label>
      <input class="form-input" id="modal-card-term" value="${esc(term)}" maxlength="300" />
    </div>
    <div class="form-group">
      <label class="form-label">Definition</label>
      <textarea class="form-textarea" id="modal-card-def">${esc(definition)}</textarea>
    </div>`;
}

// ---------- Study (flip) mode ----------

let studyCards = [];
let studyIndex = 0;
let studyDeckId = null;
let studyStart = null;

export async function startStudy(deckId) {
  studyDeckId = deckId;
  studyStart = Date.now();

  let cards;
  try {
    cards = await apiFetch(`/api/cards/${deckId}`);
  } catch (err) { showToast(err.message); return; }

  if (cards.length === 0) return showToast('No cards in this deck');

  studyCards = cards;
  studyIndex = 0;

  const deckTitle = document.getElementById('deck-detail-title').textContent;
  document.getElementById('study-deck-title').textContent = deckTitle;

  showView('study');
  renderStudyCard();

  document.getElementById('btn-prev-card').onclick = prevCard;
  document.getElementById('btn-next-card').onclick = nextCard;
  document.getElementById('flashcard').onclick = flipCard;
  document.getElementById('btn-back-from-study').onclick = async () => {
    await saveStudySession();
    showView('deck-detail');
  };
}

function renderStudyCard() {
  const card = studyCards[studyIndex];
  document.getElementById('card-front').textContent = card.term;
  document.getElementById('card-back').textContent = card.definition;
  document.getElementById('study-progress').textContent = `${studyIndex + 1} / ${studyCards.length}`;
  // Reset flip
  document.getElementById('flashcard').classList.remove('flipped');
}

function flipCard() {
  document.getElementById('flashcard').classList.toggle('flipped');
}

function nextCard() {
  if (studyIndex < studyCards.length - 1) {
    studyIndex++;
    renderStudyCard();
  }
}

function prevCard() {
  if (studyIndex > 0) {
    studyIndex--;
    renderStudyCard();
  }
}

async function saveStudySession() {
  const durationSeconds = Math.round((Date.now() - studyStart) / 1000);
  try {
    await apiFetch(`/api/quiz/study/${studyDeckId}`, {
      method: 'POST',
      body: JSON.stringify({ cardsReviewed: studyIndex + 1, durationSeconds }),
    });
  } catch { /* non-critical */ }
}

function esc(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
