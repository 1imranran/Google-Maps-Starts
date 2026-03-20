const Database = require('better-sqlite3');
const path = require('path');
// Vercel read-only filesystem fix: Use /tmp for SQLite in production
const isVercel = process.env.VERCEL || process.env.NODE_ENV === 'production';
const dbPath = isVercel 
  ? path.join('/tmp', 'reviewcoin.db') 
  : path.join(__dirname, '..', 'reviewcoin.db');

const db = new Database(dbPath);
// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    google_id TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    avatar TEXT,
    coins INTEGER DEFAULT 50,
    role TEXT DEFAULT 'user',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS businesses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    google_maps_url TEXT NOT NULL,
    place_id TEXT,
    description TEXT,
    category TEXT,
    image_url TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS review_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL,
    owner_id INTEGER NOT NULL,
    coin_reward INTEGER NOT NULL DEFAULT 10,
    min_rating INTEGER DEFAULT 4,
    min_words INTEGER DEFAULT 20,
    total_reviews_needed INTEGER DEFAULT 10,
    reviews_completed INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (business_id) REFERENCES businesses(id),
    FOREIGN KEY (owner_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS completed_reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    reviewer_id INTEGER NOT NULL,
    proof_screenshot TEXT,
    review_text TEXT,
    rating INTEGER,
    status TEXT DEFAULT 'pending',
    reviewed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES review_tasks(id),
    FOREIGN KEY (reviewer_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    amount INTEGER NOT NULL,
    type TEXT NOT NULL,
    description TEXT,
    reference_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE INDEX IF NOT EXISTS idx_businesses_user ON businesses(user_id);
  CREATE INDEX IF NOT EXISTS idx_tasks_owner ON review_tasks(owner_id);
  CREATE INDEX IF NOT EXISTS idx_tasks_status ON review_tasks(status);
  CREATE INDEX IF NOT EXISTS idx_reviews_task ON completed_reviews(task_id);
  CREATE INDEX IF NOT EXISTS idx_reviews_reviewer ON completed_reviews(reviewer_id);
  CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
`);

// Seed demo data if in demo mode
function seedDemoData() {
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
  if (userCount.count > 0) return;

  // Demo users
  const insertUser = db.prepare(`
    INSERT INTO users (google_id, email, name, avatar, coins, role) 
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const insertBusiness = db.prepare(`
    INSERT INTO businesses (user_id, name, google_maps_url, description, category, image_url)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const insertTask = db.prepare(`
    INSERT INTO review_tasks (business_id, owner_id, coin_reward, min_rating, min_words, total_reviews_needed, reviews_completed, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertTransaction = db.prepare(`
    INSERT INTO transactions (user_id, amount, type, description)
    VALUES (?, ?, ?, ?)
  `);

  const seed = db.transaction(() => {
    // Users
    insertUser.run('demo_1', 'ahmet@demo.com', 'Ahmet Yılmaz', 'https://ui-avatars.com/api/?name=Ahmet+Yilmaz&background=6366f1&color=fff', 150, 'admin');
    insertUser.run('demo_2', 'ayse@demo.com', 'Ayşe Demir', 'https://ui-avatars.com/api/?name=Ayse+Demir&background=ec4899&color=fff', 80, 'user');
    insertUser.run('demo_3', 'mehmet@demo.com', 'Mehmet Kaya', 'https://ui-avatars.com/api/?name=Mehmet+Kaya&background=10b981&color=fff', 200, 'user');
    insertUser.run('demo_4', 'fatma@demo.com', 'Fatma Çelik', 'https://ui-avatars.com/api/?name=Fatma+Celik&background=f59e0b&color=fff', 45, 'user');
    insertUser.run('demo_5', 'ali@demo.com', 'Ali Öztürk', 'https://ui-avatars.com/api/?name=Ali+Ozturk&background=ef4444&color=fff', 320, 'user');

    // Businesses
    insertBusiness.run(1, 'Yılmaz Cafe & Bistro', 'https://maps.google.com/?cid=1234567890', 'Kadıköy\'de organik kahve ve ev yapımı pastalar sunan butik kafe', 'Kafe', 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=400');
    insertBusiness.run(2, 'Demir Kuaför Salonu', 'https://maps.google.com/?cid=2345678901', 'Profesyonel saç bakımı ve güzellik hizmetleri', 'Güzellik', 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=400');
    insertBusiness.run(3, 'Kaya Oto Yıkama', 'https://maps.google.com/?cid=3456789012', 'Detaylı oto yıkama ve bakım hizmetleri', 'Oto Hizmetleri', 'https://images.unsplash.com/photo-1520340356584-f9166066d280?w=400');
    insertBusiness.run(4, 'Çelik Döner & Kebap', 'https://maps.google.com/?cid=4567890123', 'Geleneksel lezzetler, ev yapımı döner', 'Restoran', 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=400');
    insertBusiness.run(5, 'Öztürk Hukuk Bürosu', 'https://maps.google.com/?cid=5678901234', 'Ticaret ve gayrimenkul hukuku', 'Hukuk', 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=400');
    insertBusiness.run(1, 'Yılmaz Eczanesi', 'https://maps.google.com/?cid=6789012345', '7/24 açık eczane, ücretsiz teslimat', 'Sağlık', 'https://images.unsplash.com/photo-1585435557343-3b092031a831?w=400');

    // Review Tasks
    insertTask.run(1, 1, 10, 4, 20, 15, 3, 'active');
    insertTask.run(2, 2, 8, 4, 15, 10, 1, 'active');
    insertTask.run(3, 3, 15, 5, 30, 20, 7, 'active');
    insertTask.run(4, 4, 5, 3, 10, 8, 0, 'active');
    insertTask.run(5, 5, 12, 4, 25, 12, 5, 'active');
    insertTask.run(6, 1, 20, 5, 40, 5, 0, 'active');

    // Transactions
    insertTransaction.run(1, 50, 'bonus', 'Hoş geldin bonusu');
    insertTransaction.run(1, -150, 'spend', 'Yılmaz Cafe & Bistro için yorum görevi');
    insertTransaction.run(1, 30, 'earn', 'Yorum yaparak kazanıldı');
    insertTransaction.run(2, 50, 'bonus', 'Hoş geldin bonusu');
    insertTransaction.run(2, -80, 'spend', 'Demir Kuaför için yorum görevi');
    insertTransaction.run(3, 50, 'bonus', 'Hoş geldin bonusu');
    insertTransaction.run(3, 150, 'earn', 'Yorumlar ile kazanıldı');
  });

  seed();
  console.log('✅ Demo verileri oluşturuldu');
}

module.exports = { db, seedDemoData };
