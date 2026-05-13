// auth.js — MSAL initialisation and login/logout

let msalInstance = null;
let currentAccount = null;

export async function initAuth(config) {
  const msalConfig = {
    auth: {
      clientId: config.clientId,
      authority: `https://login.microsoftonline.com/${config.tenantId}`,
      redirectUri: config.redirectUri,
    },
    cache: {
      cacheLocation: 'sessionStorage',
    },
  };

  msalInstance = new msal.PublicClientApplication(msalConfig);
  await msalInstance.initialize();

  // Handle redirect response if we came back from a redirect login
  const response = await msalInstance.handleRedirectPromise().catch(() => null);
  if (response) {
    currentAccount = response.account;
  }

  const accounts = msalInstance.getAllAccounts();
  if (accounts.length > 0) {
    currentAccount = accounts[0];
  }

  return currentAccount;
}

export function getAccount() {
  return currentAccount;
}

export async function login() {
  try {
    const response = await msalInstance.loginPopup({
      scopes: ['openid', 'profile', 'email', 'User.Read'],
    });
    currentAccount = response.account;
    return currentAccount;
  } catch (err) {
    if (err.errorCode !== 'user_cancelled') {
      console.error('Login error:', err);
    }
    return null;
  }
}

export async function logout() {
  if (!currentAccount) return;
  await msalInstance.logoutPopup({ account: currentAccount }).catch(() => {});
  currentAccount = null;
}

export async function getToken() {
  if (!currentAccount || !msalInstance) return null;
  try {
    const result = await msalInstance.acquireTokenSilent({
      scopes: ['openid', 'profile', 'email', 'User.Read'],
      account: currentAccount,
    });
    return result.idToken;
  } catch {
    try {
      const result = await msalInstance.acquireTokenPopup({
        scopes: ['openid', 'profile', 'email', 'User.Read'],
      });
      return result.idToken;
    } catch (err) {
      console.error('Token error:', err);
      return null;
    }
  }
}
