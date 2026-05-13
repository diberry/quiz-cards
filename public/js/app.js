// app.js — main entry point, routing, navigation

import { initAuth, login, logout, getAccount, getAvailableProviders } from './auth.js';
import { renderDecks } from './decks.js';
import { renderHistory } from './history.js';

// ---------- Global helpers ----------

export async function apiFetch(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const res = await fetch(path, { ...options, headers, credentials: 'same-origin' });
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
  setTimeout(() => {
    toast.hidden = true;
  }, duration);
}

export function showView(viewId) {
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
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
  return new Promise((resolve) => {
    modalResolve = resolve;
  });
}

export function closeModal(result = null) {
  document.getElementById('modal-overlay').hidden = true;
  if (modalResolve) {
    modalResolve(result);
    modalResolve = null;
  }
}

// ---------- Auth UI ----------

function updateAuthUI(account) {
  const authArea = document.getElementById('auth-area');
  const appNav = document.getElementById('app-nav');

  if (account) {
    const initials = (account.displayName || 'U').slice(0, 2).toUpperCase();
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
  const providers = await getAvailableProviders();
  const available = Object.entries(providers).filter(([, v]) => v);
  if (available.length === 1) {
    login(available[0][0]);
  } else if (available.length > 1) {
    // Show provider picker
    const buttons = available
      .map(
        ([name]) =>
          `<button class="btn btn-secondary provider-btn" data-provider="${name}">${name.charAt(0).toUpperCase() + name.slice(1)}</button>`,
      )
      .join('');
    document.getElementById('view-landing').innerHTML = `
      <div class="landing-hero">
        <h1>Sign in</h1>
        <p>Choose a provider:</p>
        <div class="provider-list">${buttons}</div>
      </div>`;
    document.querySelectorAll('.provider-btn').forEach((btn) => {
      btn.addEventListener('click', () => login(btn.dataset.provider));
    });
  } else {
    login('entra');
  }
}

// ---------- Boot ----------

async function boot() {
  const account = await initAuth();

  if (account) {
    updateAuthUI(account);
    showView('decks');
    renderDecks();
  } else {
    updateAuthUI(null);
    showView('landing');
  }

  // Nav links
  document.querySelectorAll('.nav-btn[data-view]').forEach((btn) => {
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
  document.getElementById('modal-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal(null);
  });
}

boot();
