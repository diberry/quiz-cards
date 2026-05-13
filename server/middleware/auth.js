'use strict';

const jwksClient = require('jwks-rsa');
const jwt = require('jsonwebtoken');

function getJwksClient(tenantId) {
  return jwksClient({
    jwksUri: `https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`,
    cache: true,
    rateLimit: true,
  });
}

function getSigningKey(client, kid) {
  return new Promise((resolve, reject) => {
    client.getSigningKey(kid, (err, key) => {
      if (err) return reject(err);
      resolve(key.getPublicKey());
    });
  });
}

async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }

  const token = authHeader.slice(7);
  const tenantId = process.env.ENTRA_TENANT_ID;
  const clientId = process.env.ENTRA_CLIENT_ID;

  if (!tenantId || !clientId) {
    return res.status(500).json({ error: 'Server auth not configured' });
  }

  try {
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded || !decoded.header || !decoded.header.kid) {
      return res.status(401).json({ error: 'Invalid token structure' });
    }

    const client = getJwksClient(tenantId);
    const signingKey = await getSigningKey(client, decoded.header.kid);

    const payload = jwt.verify(token, signingKey, {
      audience: clientId,
      issuer: [
        `https://login.microsoftonline.com/${tenantId}/v2.0`,
        `https://sts.windows.net/${tenantId}/`,
      ],
    });

    req.user = {
      id: payload.oid || payload.sub,
      displayName: payload.name || payload.preferred_username || 'User',
      email: payload.email || payload.preferred_username || null,
    };

    next();
  } catch (err) {
    console.error('Auth error:', err.message);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = { requireAuth };
