'use strict';

// Passport session-based auth middleware.
// req.user is populated by passport.deserializeUser — same shape as before.

function requireAuth(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }
  return res.status(401).json({ error: 'Authentication required' });
}

module.exports = { requireAuth };
