const express = require('express');
const router = express.Router();
const { db } = require('../db/database');
const { ensureAuth, ensureAdmin } = require('../middleware/auth');

// Admin stats
router.get('/stats', ensureAuth, ensureAdmin, (req, res) => {
  const stats = {
    totalUsers: db.prepare('SELECT COUNT(*) as count FROM users').get().count,
    totalBusinesses: db.prepare('SELECT COUNT(*) as count FROM businesses').get().count,
    totalTasks: db.prepare('SELECT COUNT(*) as count FROM review_tasks').get().count,
    activeTasks: db.prepare("SELECT COUNT(*) as count FROM review_tasks WHERE status = 'active'").get().count,
    totalReviews: db.prepare('SELECT COUNT(*) as count FROM completed_reviews').get().count,
    pendingReviews: db.prepare("SELECT COUNT(*) as count FROM completed_reviews WHERE status = 'pending'").get().count,
    totalCoinsCirculating: db.prepare('SELECT SUM(coins) as total FROM users').get().total || 0
  };
  res.json(stats);
});

// All users
router.get('/users', ensureAuth, ensureAdmin, (req, res) => {
  const users = db.prepare(`
    SELECT u.*, 
      (SELECT COUNT(*) FROM businesses WHERE user_id = u.id) as business_count,
      (SELECT COUNT(*) FROM completed_reviews WHERE reviewer_id = u.id) as review_count
    FROM users u ORDER BY u.created_at DESC
  `).all();
  res.json(users);
});

// Update user coins (admin)
router.put('/users/:id/coins', ensureAuth, ensureAdmin, express.json(), (req, res) => {
  const { amount, reason } = req.body;
  const userId = req.params.id;
  
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
  
  db.prepare('UPDATE users SET coins = coins + ? WHERE id = ?').run(amount, userId);
  db.prepare(`
    INSERT INTO transactions (user_id, amount, type, description)
    VALUES (?, ?, ?, ?)
  `).run(userId, amount, amount > 0 ? 'bonus' : 'spend', reason || 'Admin tarafından düzenlendi');
  
  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  res.json(updated);
});

// All tasks (admin)
router.get('/tasks', ensureAuth, ensureAdmin, (req, res) => {
  const tasks = db.prepare(`
    SELECT rt.*, b.name as business_name, u.name as owner_name
    FROM review_tasks rt
    JOIN businesses b ON rt.business_id = b.id
    JOIN users u ON rt.owner_id = u.id
    ORDER BY rt.created_at DESC
  `).all();
  res.json(tasks);
});

// All businesses (admin)
router.get('/businesses', ensureAuth, ensureAdmin, (req, res) => {
  const businesses = db.prepare(`
    SELECT b.*, u.name as owner_name, u.email as owner_email,
      (SELECT COUNT(*) FROM review_tasks WHERE business_id = b.id AND status = 'active') as active_tasks,
      (SELECT SUM(reviews_completed) FROM review_tasks WHERE business_id = b.id) as total_reviews
    FROM businesses b
    JOIN users u ON b.user_id = u.id
    ORDER BY b.created_at DESC
  `).all();
  res.json(businesses);
});

// Delete any business (admin)
router.delete('/businesses/:id', ensureAuth, ensureAdmin, (req, res) => {
  const business = db.prepare('SELECT * FROM businesses WHERE id = ?').get(req.params.id);
  if (!business) return res.status(404).json({ error: 'İşletme bulunamadı' });
  
  // Check for active tasks
  const activeTasks = db.prepare("SELECT COUNT(*) as count FROM review_tasks WHERE business_id = ? AND status = 'active'").get(business.id);
  // While admins could force delete, let's keep it safe. If they need to, they can delete tasks first (or we can cascade).
  // For now, let's just delete the business and cascade manually or just block if active tasks exist.
  if (activeTasks.count > 0) {
    return res.status(400).json({ error: 'Aktif görevleri olan işletme silinemez. Önce görevleri sonlandırın.' });
  }
  
  db.prepare('DELETE FROM businesses WHERE id = ?').run(business.id);
  res.json({ success: true, message: 'İşletme silindi' });
});

// Admin: işletme ekle (coin harcamadan)
router.post('/businesses', ensureAuth, ensureAdmin, express.json(), (req, res) => {
  const { name, google_maps_url, description, category, image_url,
          coin_reward, min_rating, min_words, total_reviews_needed } = req.body;

  if (!name || !google_maps_url) {
    return res.status(400).json({ error: 'İşletme adı ve Google Maps URL gereklidir' });
  }

  const addBusiness = db.transaction(() => {
    const bizResult = db.prepare(`
      INSERT INTO businesses (user_id, name, google_maps_url, description, category, image_url)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(req.user.id, name, google_maps_url, description || '', category || 'Diğer', image_url || '');

    const businessId = bizResult.lastInsertRowid;

    // Eğer ödül bilgisi gönderildiyse görevi de ücretsiz oluştur (admin ayrıcalığı)
    if (coin_reward && total_reviews_needed) {
      db.prepare(`
        INSERT INTO review_tasks (business_id, owner_id, coin_reward, min_rating, min_words, total_reviews_needed)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(businessId, req.user.id, coin_reward, min_rating || 4, min_words || 20, total_reviews_needed);
    }

    return db.prepare('SELECT * FROM businesses WHERE id = ?').get(businessId);
  });

  const business = addBusiness();
  res.json({ success: true, business });
});

// Admin: işletme için görev oluştur (coin harcamadan)
router.post('/businesses/:id/task', ensureAuth, ensureAdmin, express.json(), (req, res) => {
  const businessId = req.params.id;
  const { coin_reward, min_rating, min_words, total_reviews_needed } = req.body;

  const business = db.prepare('SELECT * FROM businesses WHERE id = ?').get(businessId);
  if (!business) return res.status(404).json({ error: 'İşletme bulunamadı' });

  const result = db.prepare(`
    INSERT INTO review_tasks (business_id, owner_id, coin_reward, min_rating, min_words, total_reviews_needed)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(businessId, req.user.id, coin_reward || 10, min_rating || 4, min_words || 20, total_reviews_needed || 10);

  const task = db.prepare('SELECT * FROM review_tasks WHERE id = ?').get(result.lastInsertRowid);
  res.json({ success: true, task });
});

// Admin: görevi durdur/aktive et
router.put('/tasks/:id/status', ensureAuth, ensureAdmin, express.json(), (req, res) => {
  const { status } = req.body; // 'active' | 'paused' | 'completed'
  if (!['active', 'paused', 'completed'].includes(status)) {
    return res.status(400).json({ error: 'Geçersiz durum' });
  }
  db.prepare('UPDATE review_tasks SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ success: true });
});

// All pending reviews (admin)
router.get('/reviews', ensureAuth, ensureAdmin, (req, res) => {
  const reviews = db.prepare(`
    SELECT cr.*, rt.coin_reward, 
           b.name as business_name, b.google_maps_url,
           u.name as reviewer_name, u.email as reviewer_email, u.avatar as reviewer_avatar
    FROM completed_reviews cr
    JOIN review_tasks rt ON cr.task_id = rt.id
    JOIN businesses b ON rt.business_id = b.id
    JOIN users u ON cr.reviewer_id = u.id
    WHERE cr.status = 'pending'
    ORDER BY cr.created_at ASC
  `).all();
  res.json(reviews);
});

// Approve review (admin)
router.put('/reviews/:id/approve', ensureAuth, ensureAdmin, (req, res) => {
  const review = db.prepare(`
    SELECT cr.*, rt.coin_reward, rt.id as task_id
    FROM completed_reviews cr
    JOIN review_tasks rt ON cr.task_id = rt.id
    WHERE cr.id = ?
  `).get(req.params.id);
  
  if (!review) return res.status(404).json({ error: 'Yorum bulunamadı' });
  if (review.status !== 'pending') return res.status(400).json({ error: 'Bu yorum zaten işlenmiş' });
  
  const approve = db.transaction(() => {
    // Update review status
    db.prepare("UPDATE completed_reviews SET status = 'approved', reviewed_at = CURRENT_TIMESTAMP WHERE id = ?").run(review.id);
    
    // Award coins to reviewer
    db.prepare('UPDATE users SET coins = coins + ? WHERE id = ?').run(review.coin_reward, review.reviewer_id);
    
    // Record transaction
    db.prepare(`
      INSERT INTO transactions (user_id, amount, type, description, reference_id)
      VALUES (?, ?, 'earn', ?, ?)
    `).run(review.reviewer_id, review.coin_reward, 'Yorum Admin tarafından onaylandı - coin kazanıldı', review.id);
    
    // Update task completion count
    db.prepare('UPDATE review_tasks SET reviews_completed = reviews_completed + 1 WHERE id = ?').run(review.task_id);
    
    // Check if task is completed
    const task = db.prepare('SELECT * FROM review_tasks WHERE id = ?').get(review.task_id);
    if (task.reviews_completed >= task.total_reviews_needed) {
      db.prepare("UPDATE review_tasks SET status = 'completed' WHERE id = ?").run(task.id);
    }
  });
  
  approve();
  res.json({ success: true, message: 'Yorum başarıyla onaylandı' });
});

// Reject review (admin)
router.put('/reviews/:id/reject', ensureAuth, ensureAdmin, (req, res) => {
  const review = db.prepare(`SELECT * FROM completed_reviews WHERE id = ?`).get(req.params.id);
  
  if (!review) return res.status(404).json({ error: 'Yorum bulunamadı' });
  if (review.status !== 'pending') return res.status(400).json({ error: 'Bu yorum zaten işlenmiş' });
  
  db.prepare("UPDATE completed_reviews SET status = 'rejected', reviewed_at = CURRENT_TIMESTAMP WHERE id = ?").run(review.id);
  res.json({ success: true, message: 'Yorum reddedildi' });
});

module.exports = router;
