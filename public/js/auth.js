// auth.js — Server-side session auth (replaces MSAL client-side auth)

let currentUser = null;

export async function initAuth() {
  const res = await fetch('/auth/me');
  const data = await res.json();
  currentUser = data.user;
  return currentUser;
}

export function getAccount() {
  return currentUser;
}

export function login(provider = 'entra') {
  window.location.href = `/auth/${provider}`;
}

export async function logout() {
  await fetch('/auth/logout', { method: 'POST' });
  currentUser = null;
}

export async function getAvailableProviders() {
  const res = await fetch('/api/config');
  const data = await res.json();
  return data.providers || {};
}
