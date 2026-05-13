// import.js — import cards from CSV or JSON file or paste

import { apiFetch, showView, showToast } from './app.js';

let importDeckId = null;
let parsedCards = [];

export function showImport(deckId) {
  importDeckId = deckId;
  parsedCards = [];

  showView('import');

  document.getElementById('import-body').innerHTML = `
    <div class="import-tabs">
      <button class="import-tab active" data-tab="file">Upload File</button>
      <button class="import-tab" data-tab="paste">Paste JSON</button>
    </div>

    <div id="import-file-panel">
      <div class="import-zone" id="import-zone">
        <p>📂 Drop a CSV or JSON file here, or click to browse</p>
        <input type="file" id="import-file-input" accept=".csv,.json,text/csv,application/json" />
      </div>
    </div>

    <div id="import-paste-panel" style="display:none">
      <p style="margin-bottom:8px;font-size:.9rem;color:var(--color-text-muted)">
        Paste a JSON array: <code>[{"term":"…","definition":"…"}]</code>
      </p>
      <textarea class="import-textarea" id="import-paste-input" placeholder='[{"term":"…","definition":"…"}]'></textarea>
      <button class="btn btn-secondary" id="btn-parse-paste">Preview</button>
    </div>

    <div id="import-preview" style="display:none" class="import-preview"></div>

    <div id="import-actions" style="display:none;margin-top:12px">
      <button class="btn btn-primary" id="btn-confirm-import">Import Cards</button>
      <span id="import-count" style="margin-left:12px;font-size:.9rem;color:var(--color-text-muted)"></span>
    </div>`;

  // Tab switching
  document.querySelectorAll('.import-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.import-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('import-file-panel').style.display =
        tab.dataset.tab === 'file' ? '' : 'none';
      document.getElementById('import-paste-panel').style.display =
        tab.dataset.tab === 'paste' ? '' : 'none';
      resetPreview();
    });
  });

  // File upload
  const zone = document.getElementById('import-zone');
  const fileInput = document.getElementById('import-file-input');

  zone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => handleFile(fileInput.files[0]));

  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('drag-over');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    handleFile(e.dataTransfer.files[0]);
  });

  // Paste parse
  document.getElementById('btn-parse-paste').addEventListener('click', () => {
    const raw = document.getElementById('import-paste-input').value.trim();
    try {
      const data = JSON.parse(raw);
      previewCards(data);
    } catch {
      showToast('Invalid JSON — could not parse');
    }
  });

  // Confirm import button
  document.getElementById('btn-confirm-import').addEventListener('click', doImport);

  document.getElementById('btn-back-from-import').onclick = () => showView('deck-detail');
}

async function handleFile(file) {
  if (!file) return;
  const text = await file.text();
  try {
    if (file.name.endsWith('.json') || file.type === 'application/json') {
      previewCards(JSON.parse(text));
    } else {
      // Simple CSV parse (handles quoted fields)
      const lines = text.trim().split('\n');
      const rows = lines.map((line) => parseCsvLine(line));
      // Skip header if first row is term/definition
      const start = rows[0][0]?.toLowerCase() === 'term' ? 1 : 0;
      const cards = rows
        .slice(start)
        .filter((r) => r.length >= 2)
        .map((r) => ({ term: r[0], definition: r[1] }));
      previewCards(cards);
    }
  } catch (err) {
    showToast('Could not parse file: ' + err.message);
  }
}

function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function previewCards(data) {
  if (!Array.isArray(data) || data.length === 0) {
    showToast('No valid cards found');
    return;
  }
  parsedCards = data.filter((r) => r.term && r.definition);
  if (parsedCards.length === 0) {
    showToast('No cards with both term and definition found');
    return;
  }

  const previewEl = document.getElementById('import-preview');
  const preview = parsedCards.slice(0, 5);
  previewEl.innerHTML = `
    <table>
      <thead><tr><th>Term</th><th>Definition</th></tr></thead>
      <tbody>${preview.map((c) => `<tr><td>${esc(c.term)}</td><td>${esc(c.definition)}</td></tr>`).join('')}</tbody>
    </table>
    ${parsedCards.length > 5 ? `<p style="margin-top:8px;font-size:.85rem;color:var(--color-text-muted)">…and ${parsedCards.length - 5} more</p>` : ''}`;
  previewEl.style.display = '';

  document.getElementById('import-count').textContent =
    `${parsedCards.length} card${parsedCards.length !== 1 ? 's' : ''} ready to import`;
  document.getElementById('import-actions').style.display = '';
}

function resetPreview() {
  parsedCards = [];
  document.getElementById('import-preview').style.display = 'none';
  document.getElementById('import-actions').style.display = 'none';
}

async function doImport() {
  if (parsedCards.length === 0) return;
  try {
    const result = await apiFetch(`/api/import/${importDeckId}`, {
      method: 'POST',
      body: JSON.stringify({ data: JSON.stringify(parsedCards) }),
    });
    showToast(`✓ Imported ${result.imported} cards`);
    showView('deck-detail');
    const { renderCards } = await import('./cards.js');
    renderCards(importDeckId);
  } catch (err) {
    showToast(err.message);
  }
}

function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
