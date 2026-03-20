const express = require('express');
const router = express.Router();
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { db } = require('../db/database');

// Passport serialization
passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser((id, done) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  done(null, user || false);
});

// Admin email listesi env'den okunur
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map(e => e.trim().toLowerCase())
  .filter(Boolean);

// Google OAuth Strategy (only if not in demo mode and keys are present)
if (process.env.DEMO_MODE !== 'true' && process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `${process.env.BASE_URL}/auth/google/callback`
  }, (accessToken, refreshToken, profile, done) => {
    try {
      const email = profile.emails[0].value;
      const isAdmin = ADMIN_EMAILS.includes(email.toLowerCase());
      const role = isAdmin ? 'admin' : 'user';

      let user = db.prepare('SELECT * FROM users WHERE google_id = ?').get(profile.id);
      
      if (!user) {
        // Yeni kullanıcı: oluştur
        const result = db.prepare(`
          INSERT INTO users (google_id, email, name, avatar, coins, role)
          VALUES (?, ?, ?, ?, 50, ?)
        `).run(
          profile.id,
          email,
          profile.displayName,
          profile.photos[0]?.value || '',
          role
        );
        
        // Hoş geldin bonusu kaydı
        db.prepare(`
          INSERT INTO transactions (user_id, amount, type, description)
          VALUES (?, 50, 'bonus', 'Hoş geldin bonusu')
        `).run(result.lastInsertRowid);
        
        user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
      } else {
        // Mevcut kullanıcı: admin email'se rolünü güncelle
        if (isAdmin && user.role !== 'admin') {
          db.prepare('UPDATE users SET role = ? WHERE id = ?').run('admin', user.id);
        }
        // En güncel kullanıcı verisini çek
        user = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
      }
      
      done(null, user);
    } catch (err) {
      done(err, null);
    }
  }));
}

// Google OAuth login
router.get('/google', (req, res, next) => {
  if (process.env.DEMO_MODE === 'true') {
    return res.redirect('/auth/demo-login');
  }
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(500).send('Google OAuth credentials are not properly configured in environment variables.');
  }
  passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
});

// Google OAuth callback
router.get('/google/callback',
  (req, res, next) => {
    if (process.env.DEMO_MODE === 'true') {
      return res.redirect('/');
    }
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      return res.redirect('/?error=auth_not_configured');
    }
    passport.authenticate('google', (err, user, info) => {
      if (err) {
        console.error(' [!] Google Auth Error:', err);
        return res.redirect(`/?error=auth_failed&msg=${encodeURIComponent(err.message)}`);
      }
      if (!user) {
        console.error(' [!] Google Auth Failed: No user found', info);
        return res.redirect('/?error=no_user');
      }
      req.logIn(user, (loginErr) => {
        if (loginErr) {
          console.error(' [!] Login Error:', loginErr);
          return next(loginErr);
        }
        return res.redirect('/#dashboard');
      });
    })(req, res, next);
  }
);

// Demo login page
router.get('/demo-login', (req, res) => {
  const users = db.prepare('SELECT id, name, email, avatar, role FROM users').all();
  res.json({ demoMode: true, users });
});

// Demo login as a specific user
router.post('/demo-login', express.json(), (req, res) => {
  const { userId } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId || 1);
  if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
  
  req.session.demoUser = user;
  req.session.save((err) => {
    if (err) console.error('Session save error:', err);
    res.json({ success: true, user: { id: user.id, name: user.name, email: user.email, avatar: user.avatar, coins: user.coins, role: user.role } });
  });
});

// Current user
router.get('/me', (req, res) => {
  const user = req.user || (req.session && req.session.demoUser);
  if (!user) return res.status(401).json({ error: 'Giriş yapılmamış' });
  
  // Refresh user data
  const freshUser = db.prepare('SELECT id, name, email, avatar, coins, role, created_at FROM users WHERE id = ?').get(user.id);
  if (req.session && req.session.demoUser) {
    req.session.demoUser = freshUser;
  }
  res.json(freshUser);
});

// Logout
router.get('/logout', (req, res) => {
  if (req.session) {
    req.session.demoUser = null;
  }
  if (req.logout) {
    req.logout(() => {});
  }
  res.redirect('/');
});

module.exports = router;
