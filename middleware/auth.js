function ensureAuth(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }
  // Demo mode bypass
  if (process.env.DEMO_MODE === 'true' && req.session && req.session.demoUser) {
    req.user = req.session.demoUser;
    return next();
  }
  return res.status(401).json({ error: 'Giriş yapmanız gerekiyor' });
}

function ensureAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Giriş yapmanız gerekiyor' });
  }
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Bu işlem için yetkiniz yok' });
  }
  next();
}

module.exports = { ensureAuth, ensureAdmin };
