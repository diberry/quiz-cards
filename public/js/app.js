// app.js — main entry point, routing, navigation

import { initAuth, login, logout, getAccount, getToken } from './auth.js';
import { renderDecks } from './decks.js';
import { renderHistory } from './history.js';

// ---------- Global helpers ----------

export async function apiFetch(path, options = {}) {
  const token = await getToken();
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(path, { ...options, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.status === 204 ? null : res.json();
}

export function showToast(message, duration = 3000) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.hidden = false;
  setTimeout(() => { toast.hidden = true; }, duration);
}

export function showView(viewId) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const el = document.getElementById(`view-${viewId}`);
  if (el) {
    el.classList.add('active');
    window.scrollTo(0, 0);
  }
}

// ---------- Modal ----------

let modalResolve = null;

export function openModal({ title, bodyHtml, confirmLabel = 'Save' }) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = bodyHtml;
  document.getElementById('modal-confirm').textContent = confirmLabel;
  document.getElementById('modal-overlay').hidden = false;
  return new Promise(resolve => { modalResolve = resolve; });
}

export function closeModal(result = null) {
  document.getElementById('modal-overlay').hidden = true;
  if (modalResolve) { modalResolve(result); modalResolve = null; }
}

// ---------- Auth UI ----------

function updateAuthUI(account) {
  const authArea = document.getElementById('auth-area');
  const appNav = document.getElementById('app-nav');

  if (account) {
    const initials = (account.name || account.username || 'U').slice(0, 2).toUpperCase();
    authArea.innerHTML = `
      <div class="user-chip">
        <div class="user-avatar">${initials}</div>
        <button class="btn btn-ghost" id="btn-logout">Sign out</button>
      </div>`;
    document.getElementById('btn-logout').addEventListener('click', async () => {
      await logout();
      updateAuthUI(null);
      showView('landing');
    });
    appNav.style.display = '';
  } else {
    authArea.innerHTML = `<button class="btn btn-primary" id="btn-login">Sign in</button>`;
    document.getElementById('btn-login').addEventListener('click', handleLogin);
    appNav.style.display = 'none';
  }
}

async function handleLogin() {
  const account = await login();
  if (account) {
    updateAuthUI(account);
    showView('decks');
    renderDecks();
  }
}

// ---------- Boot ----------

async function boot() {
  // Load Entra config from server
  const config = await fetch('/api/config').then(r => r.json()).catch(() => ({}));

  if (config.clientId) {
    const account = await initAuth(config);
    updateAuthUI(account);
    if (account) {
      showView('decks');
      renderDecks();
    } else {
      showView('landing');
    }
  } else {
    // No MSAL config — show banner
    document.getElementById('view-landing').innerHTML = `
      <div class="landing-hero">
        <h1>⚠️ Not configured</h1>
        <p>Copy <code>.env.example</code> to <code>.env</code> and add your Entra app credentials, then restart the server.</p>
      </div>`;
    showView('landing');
  }

  // Nav links
  document.querySelectorAll('.nav-btn[data-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      showView(view);
      if (view === 'decks') renderDecks();
      if (view === 'history') renderHistory();
    });
  });

  // Landing login button
  document.getElementById('btn-login-hero')?.addEventListener('click', handleLogin);

  // Modal buttons
  document.getElementById('modal-cancel').addEventListener('click', () => closeModal(null));
  document.getElementById('modal-confirm').addEventListener('click', () => {
    closeModal('confirm');
  });
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal(null);
  });
}

boot();
