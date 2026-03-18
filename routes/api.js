const express = require('express');
const router = express.Router();
const { db } = require('../db/database');
const { ensureAuth } = require('../middleware/auth');

// ============ DASHBOARD ============
router.get('/dashboard', ensureAuth, (req, res) => {
  const user = req.user;
  
  const stats = {
    coins: user.coins,
    reviewsDone: db.prepare('SELECT COUNT(*) as count FROM completed_reviews WHERE reviewer_id = ?').get(user.id).count,
    reviewsApproved: db.prepare("SELECT COUNT(*) as count FROM completed_reviews WHERE reviewer_id = ? AND status = 'approved'").get(user.id).count,
    businessCount: db.prepare('SELECT COUNT(*) as count FROM businesses WHERE user_id = ?').get(user.id).count,
    activeTasks: db.prepare("SELECT COUNT(*) as count FROM review_tasks WHERE owner_id = ? AND status = 'active'").get(user.id).count,
    pendingApprovals: db.prepare(`
      SELECT COUNT(*) as count FROM completed_reviews cr
      JOIN review_tasks rt ON cr.task_id = rt.id
      WHERE rt.owner_id = ? AND cr.status = 'pending'
    `).get(user.id).count
  };
  
  const recentTransactions = db.prepare(`
    SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 10
  `).all(user.id);
  
  const topEarners = db.prepare(`
    SELECT id, name, avatar, coins FROM users ORDER BY coins DESC LIMIT 5
  `).all();
  
  res.json({ stats, recentTransactions, topEarners });
});

// ============ TASKS (Yorum Görevleri) ============
router.get('/tasks', ensureAuth, (req, res) => {
  const userId = req.user.id;
  const { category, sort } = req.query;
  
  let query = `
    SELECT rt.*, b.name as business_name, b.google_maps_url, b.description as business_desc, 
           b.category, b.image_url, u.name as owner_name, u.avatar as owner_avatar
    FROM review_tasks rt
    JOIN businesses b ON rt.business_id = b.id
    JOIN users u ON rt.owner_id = u.id
    WHERE rt.status = 'active' AND rt.owner_id != ?
    AND rt.id NOT IN (SELECT task_id FROM completed_reviews WHERE reviewer_id = ?)
  `;
  
  const params = [userId, userId];
  
  if (category && category !== 'all') {
    query += ' AND b.category = ?';
    params.push(category);
  }
  
  if (sort === 'reward_high') {
    query += ' ORDER BY rt.coin_reward DESC';
  } else if (sort === 'reward_low') {
    query += ' ORDER BY rt.coin_reward ASC';
  } else if (sort === 'newest') {
    query += ' ORDER BY rt.created_at DESC';
  } else {
    query += ' ORDER BY rt.coin_reward DESC';
  }
  
  const tasks = db.prepare(query).all(...params);
  
  const categories = db.prepare(`
    SELECT DISTINCT category FROM businesses WHERE category IS NOT NULL ORDER BY category
  `).all().map(r => r.category);
  
  res.json({ tasks, categories });
});

// Submit review proof
router.post('/tasks/:id/submit', ensureAuth, express.json(), (req, res) => {
  const taskId = req.params.id;
  const reviewerId = req.user.id;
  const { review_text, rating, proof_screenshot } = req.body;
  
  const task = db.prepare('SELECT * FROM review_tasks WHERE id = ?').get(taskId);
  if (!task) return res.status(404).json({ error: 'Görev bulunamadı' });
  if (task.status !== 'active') return res.status(400).json({ error: 'Bu görev artık aktif değil' });
  if (task.owner_id === reviewerId) return res.status(400).json({ error: 'Kendi görevinize yorum yapamazsınız' });
  
  // Check if already submitted
  const existing = db.prepare('SELECT * FROM completed_reviews WHERE task_id = ? AND reviewer_id = ?').get(taskId, reviewerId);
  if (existing) return res.status(400).json({ error: 'Bu görev için zaten yorum gönderdiniz' });
  
  // Validate
  if (!review_text || review_text.split(/\s+/).length < task.min_words) {
    return res.status(400).json({ error: `Yorum en az ${task.min_words} kelime olmalıdır` });
  }
  if (!rating || rating < task.min_rating) {
    return res.status(400).json({ error: `Minimum ${task.min_rating} yıldız gerekiyor` });
  }
  
  db.prepare(`
    INSERT INTO completed_reviews (task_id, reviewer_id, review_text, rating, proof_screenshot, status)
    VALUES (?, ?, ?, ?, ?, 'pending')
  `).run(taskId, reviewerId, review_text, rating, proof_screenshot || null);
  
  res.json({ success: true, message: 'Yorumunuz gönderildi, onay bekleniyor' });
});

// ============ BUSINESSES ============
router.get('/businesses', ensureAuth, (req, res) => {
  const businesses = db.prepare(`
    SELECT b.*, 
      (SELECT COUNT(*) FROM review_tasks WHERE business_id = b.id AND status = 'active') as active_tasks,
      (SELECT SUM(reviews_completed) FROM review_tasks WHERE business_id = b.id) as total_reviews
    FROM businesses b 
    WHERE b.user_id = ?
    ORDER BY b.created_at DESC
  `).all(req.user.id);
  
  res.json(businesses);
});

router.post('/businesses', ensureAuth, express.json(), (req, res) => {
  const { name, google_maps_url, description, category } = req.body;
  
  if (!name || !google_maps_url) {
    return res.status(400).json({ error: 'İşletme adı ve Google Maps URL gereklidir' });
  }
  
  const result = db.prepare(`
    INSERT INTO businesses (user_id, name, google_maps_url, description, category)
    VALUES (?, ?, ?, ?, ?)
  `).run(req.user.id, name, google_maps_url, description || '', category || 'Diğer');
  
  const business = db.prepare('SELECT * FROM businesses WHERE id = ?').get(result.lastInsertRowid);
  res.json(business);
});

router.delete('/businesses/:id', ensureAuth, (req, res) => {
  const business = db.prepare('SELECT * FROM businesses WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!business) return res.status(404).json({ error: 'İşletme bulunamadı' });
  
  // Check for active tasks
  const activeTasks = db.prepare("SELECT COUNT(*) as count FROM review_tasks WHERE business_id = ? AND status = 'active'").get(business.id);
  if (activeTasks.count > 0) {
    return res.status(400).json({ error: 'Aktif görevleri olan işletme silinemez' });
  }
  
  db.prepare('DELETE FROM businesses WHERE id = ?').run(business.id);
  res.json({ success: true });
});

// ============ CREATE REVIEW TASK ============
router.post('/businesses/:id/task', ensureAuth, express.json(), (req, res) => {
  const businessId = req.params.id;
  const userId = req.user.id;
  const { coin_reward, min_rating, min_words, total_reviews_needed } = req.body;
  
  const business = db.prepare('SELECT * FROM businesses WHERE id = ? AND user_id = ?').get(businessId, userId);
  if (!business) return res.status(404).json({ error: 'İşletme bulunamadı' });
  
  const reward = coin_reward || 10;
  const totalNeeded = total_reviews_needed || 10;
  const totalCost = reward * totalNeeded;
  
  // Check coins
  const user = db.prepare('SELECT coins FROM users WHERE id = ?').get(userId);
  if (user.coins < totalCost) {
    return res.status(400).json({ error: `Yetersiz coin. Gerekli: ${totalCost}, Mevcut: ${user.coins}` });
  }
  
  const createTask = db.transaction(() => {
    // Deduct coins
    db.prepare('UPDATE users SET coins = coins - ? WHERE id = ?').run(totalCost, userId);
    
    // Record transaction
    db.prepare(`
      INSERT INTO transactions (user_id, amount, type, description)
      VALUES (?, ?, 'spend', ?)
    `).run(userId, -totalCost, `${business.name} için yorum görevi (${totalNeeded} yorum × ${reward} coin)`);
    
    // Create task
    const result = db.prepare(`
      INSERT INTO review_tasks (business_id, owner_id, coin_reward, min_rating, min_words, total_reviews_needed)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(businessId, userId, reward, min_rating || 4, min_words || 20, totalNeeded);
    
    return result.lastInsertRowid;
  });
  
  const taskId = createTask();
  const task = db.prepare('SELECT * FROM review_tasks WHERE id = ?').get(taskId);
  
  res.json({ success: true, task });
});

// ============ REVIEW APPROVALS ============
router.get('/my-reviews', ensureAuth, (req, res) => {
  const reviews = db.prepare(`
    SELECT cr.*, rt.coin_reward, b.name as business_name, u.name as reviewer_name, u.avatar as reviewer_avatar
    FROM completed_reviews cr
    JOIN review_tasks rt ON cr.task_id = rt.id
    JOIN businesses b ON rt.business_id = b.id
    JOIN users u ON cr.reviewer_id = u.id
    WHERE rt.owner_id = ?
    ORDER BY cr.created_at DESC
  `).all(req.user.id);
  
  res.json(reviews);
});

router.put('/reviews/:id/approve', ensureAuth, (req, res) => {
  const review = db.prepare(`
    SELECT cr.*, rt.owner_id, rt.coin_reward, rt.id as task_id
    FROM completed_reviews cr
    JOIN review_tasks rt ON cr.task_id = rt.id
    WHERE cr.id = ?
  `).get(req.params.id);
  
  if (!review) return res.status(404).json({ error: 'Yorum bulunamadı' });
  if (review.owner_id !== req.user.id) return res.status(403).json({ error: 'Bu yorumu onaylama yetkiniz yok' });
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
    `).run(review.reviewer_id, review.coin_reward, 'Yorum onaylandı - coin kazanıldı', review.id);
    
    // Update task completion count
    db.prepare('UPDATE review_tasks SET reviews_completed = reviews_completed + 1 WHERE id = ?').run(review.task_id);
    
    // Check if task is completed
    const task = db.prepare('SELECT * FROM review_tasks WHERE id = ?').get(review.task_id);
    if (task.reviews_completed >= task.total_reviews_needed) {
      db.prepare("UPDATE review_tasks SET status = 'completed' WHERE id = ?").run(task.id);
    }
  });
  
  approve();
  res.json({ success: true, message: 'Yorum onaylandı' });
});

router.put('/reviews/:id/reject', ensureAuth, (req, res) => {
  const review = db.prepare(`
    SELECT cr.*, rt.owner_id
    FROM completed_reviews cr
    JOIN review_tasks rt ON cr.task_id = rt.id
    WHERE cr.id = ?
  `).get(req.params.id);
  
  if (!review) return res.status(404).json({ error: 'Yorum bulunamadı' });
  if (review.owner_id !== req.user.id) return res.status(403).json({ error: 'Yetkiniz yok' });
  if (review.status !== 'pending') return res.status(400).json({ error: 'Bu yorum zaten işlenmiş' });
  
  db.prepare("UPDATE completed_reviews SET status = 'rejected', reviewed_at = CURRENT_TIMESTAMP WHERE id = ?").run(review.id);
  res.json({ success: true, message: 'Yorum reddedildi' });
});

// ============ TRANSACTIONS ============
router.get('/transactions', ensureAuth, (req, res) => {
  const transactions = db.prepare(`
    SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50
  `).all(req.user.id);
  
  res.json(transactions);
});

// ============ LEADERBOARD ============
router.get('/leaderboard', ensureAuth, (req, res) => {
  const leaderboard = db.prepare(`
    SELECT u.id, u.name, u.avatar, u.coins,
      (SELECT COUNT(*) FROM completed_reviews WHERE reviewer_id = u.id AND status = 'approved') as approved_reviews
    FROM users u
    ORDER BY u.coins DESC
    LIMIT 20
  `).all();
  
  res.json(leaderboard);
});

module.exports = router;
