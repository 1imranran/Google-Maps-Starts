// ============================================
// ReviewCoin — SPA Core (Router, API, Auth, Utils)
// ============================================

const App = {
  currentPage: 'dashboard',
  user: null,
  isDemo: false,

  // ============ INIT ============
  async init() {
    await this.checkAuth();
    this.setupRouter();
    this.setupSidebar();
    window.addEventListener('hashchange', () => this.handleRoute());
  },

  // ============ AUTH ============
  async checkAuth() {
    try {
      const res = await this.api('/auth/me');
      if (res && res.id) {
        this.user = res;
        this.showApp();
        this.handleRoute();
        return;
      }
    } catch (e) {
      // Not authenticated
    }
    this.showLogin();
  },

  showLogin() {
    document.getElementById('login-page').style.display = '';
    document.getElementById('login-page').classList.add('active');
    document.getElementById('app-shell').style.display = 'none';
    this.loadDemoUsers();
  },

  showApp() {
    document.getElementById('login-page').style.display = 'none';
    document.getElementById('app-shell').style.display = 'flex';
    this.updateUserUI();
    if (this.user.role === 'admin') {
      document.getElementById('admin-nav').style.display = '';
    }
  },

  async loadDemoUsers() {
    try {
      const res = await fetch('/auth/demo-login');
      const data = await res.json();
      if (data.demoMode) {
        this.isDemo = true;
        const section = document.getElementById('demo-login-section');
        const grid = document.getElementById('demo-users');
        section.style.display = '';
        
        grid.innerHTML = data.users.map(u => `
          <button class="demo-user-btn" onclick="App.demoLogin(${u.id})">
            <img src="${u.avatar}" alt="${u.name}">
            <span>${u.name}</span>
            ${u.role === 'admin' ? '<span class="user-role-badge">ADMIN</span>' : ''}
          </button>
        `).join('');
      }
    } catch (e) {
      console.log('Demo mode not available');
    }
  },

  async demoLogin(userId) {
    try {
      const res = await fetch('/auth/demo-login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      const data = await res.json();
      if (data.success) {
        this.user = data.user;
        this.showApp();
        this.navigate('dashboard');
        this.toast('Giriş başarılı! Hoş geldiniz 🎉', 'success');
      }
    } catch (e) {
      this.toast('Giriş başarısız', 'error');
    }
  },

  updateUserUI() {
    if (!this.user) return;
    const setImg = (id) => { const el = document.getElementById(id); if (el) el.src = this.user.avatar || ''; };
    const setText = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
    
    setImg('user-avatar-sidebar');
    setImg('user-avatar-top');
    setText('user-name-sidebar', this.user.name);
    setText('coin-count-sidebar', this.formatNumber(this.user.coins));
    setText('coin-count-top', this.formatNumber(this.user.coins));
  },

  async refreshUser() {
    try {
      const res = await this.api('/auth/me');
      if (res && res.id) {
        this.user = res;
        this.updateUserUI();
      }
    } catch (e) {}
  },

  // ============ ROUTER ============
  setupRouter() {
    this.handleRoute();
  },

  handleRoute() {
    const hash = window.location.hash.replace('#', '') || 'dashboard';
    this.navigate(hash, false);
  },

  navigate(page, pushHash = true) {
    this.currentPage = page;
    
    // Update hash
    if (pushHash) window.location.hash = page;
    
    // Update nav
    document.querySelectorAll('.nav-item[data-page]').forEach(el => {
      el.classList.toggle('active', el.dataset.page === page);
    });
    
    // Update page sections
    document.querySelectorAll('.page-section').forEach(el => {
      el.classList.toggle('active', el.id === `page-${page}`);
    });
    
    // Update title
    const titles = {
      dashboard: '📊 Dashboard',
      tasks: '⭐ Yorum Yap & Kazan',
      business: '🏪 İşletmelerim',
      profile: '👤 Profil & Geçmiş',
      admin: '⚙️ Admin Panel'
    };
    document.getElementById('topbar-title').textContent = titles[page] || 'Dashboard';
    
    // Load page content
    this.loadPage(page);
    
    // Close sidebar on mobile
    document.getElementById('sidebar').classList.remove('open');
  },

  loadPage(page) {
    switch (page) {
      case 'dashboard': Dashboard.load(); break;
      case 'tasks': Tasks.load(); break;
      case 'business': Business.load(); break;
      case 'profile': Profile.load(); break;
      case 'admin': this.loadAdmin(); break;
    }
  },

  // ============ SIDEBAR ============
  setupSidebar() {
    const hamburger = document.getElementById('hamburger-btn');
    const toggle = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('sidebar');
    
    hamburger.addEventListener('click', () => sidebar.classList.add('open'));
    toggle.addEventListener('click', () => sidebar.classList.remove('open'));
    
    // Nav click handlers
    document.querySelectorAll('.nav-item[data-page]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        this.navigate(el.dataset.page);
      });
    });
  },

  // ============ API HELPER ============
  async api(url, options = {}) {
    try {
      const res = await fetch(url, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...options.headers },
        ...options
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Bir hata oluştu');
      }
      return data;
    } catch (err) {
      if (err.message !== 'Giriş yapılmamış') {
        console.error('API Error:', err);
      }
      throw err;
    }
  },

  // ============ MODAL ============
  showModal(html) {
    const overlay = document.getElementById('modal-overlay');
    const content = document.getElementById('modal-content');
    content.innerHTML = html;
    overlay.style.display = 'flex';
    
    overlay.onclick = (e) => {
      if (e.target === overlay) this.closeModal();
    };
  },

  closeModal() {
    document.getElementById('modal-overlay').style.display = 'none';
  },

  // ============ TOAST ============
  toast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${icons[type]}</span>
      <span class="toast-message">${message}</span>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
      toast.classList.add('removing');
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  },

  // ============ UTILS ============
  formatNumber(n) {
    if (n === null || n === undefined) return '0';
    return n.toLocaleString('tr-TR');
  },

  formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  },

  renderStars(count) {
    return '★'.repeat(count) + '☆'.repeat(5 - count);
  },

  // ============ ADMIN PAGE ============
  async loadAdmin() {
    if (!this.user || this.user.role !== 'admin') {
      this.navigate('dashboard');
      return;
    }
    
    const container = document.getElementById('page-admin');
    container.innerHTML = `
      <h2 style="font-size:1.5rem;font-weight:800;margin-bottom:24px;">⚙️ Admin Panel</h2>
      
      <div class="filter-bar" style="margin-bottom: 24px;">
        <button class="btn-primary" id="tab-btn-stats" onclick="App.switchAdminTab('stats')">📊 İstatistikler & Kullanıcılar</button>
        <button class="btn-secondary" id="tab-btn-businesses" onclick="App.switchAdminTab('businesses')">🏪 Tüm İşletmeler</button>
        <button class="btn-secondary" id="tab-btn-reviews" onclick="App.switchAdminTab('reviews')">✅ Yorum Doğrulamaları</button>
      </div>

      <div id="admin-tab-content">
        <div class="loading-spinner"><div class="spinner"></div></div>
      </div>
    `;
    
    this.switchAdminTab('stats');
  },

  async switchAdminTab(tab) {
    // Update active button classes
    ['stats', 'businesses', 'reviews'].forEach(t => {
      const btn = document.getElementById(`tab-btn-${t}`);
      if (btn) {
        btn.className = (t === tab) ? 'btn-primary' : 'btn-secondary';
      }
    });

    const content = document.getElementById('admin-tab-content');
    content.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';

    try {
      if (tab === 'stats') {
        const [stats, users] = await Promise.all([
          this.api('/api/admin/stats'),
          this.api('/api/admin/users')
        ]);
        
        content.innerHTML = `
          <div class="admin-stats-grid animate-in">
            <div class="admin-stat">
              <div class="admin-stat-value">${stats.totalUsers}</div>
              <div class="admin-stat-label">Toplam Kullanıcı</div>
            </div>
            <div class="admin-stat">
              <div class="admin-stat-value">${stats.totalBusinesses}</div>
              <div class="admin-stat-label">İşletme</div>
            </div>
            <div class="admin-stat">
              <div class="admin-stat-value">${stats.activeTasks}</div>
              <div class="admin-stat-label">Aktif Görev</div>
            </div>
            <div class="admin-stat">
              <div class="admin-stat-value">${stats.totalReviews}</div>
              <div class="admin-stat-label">Toplam Yorum</div>
            </div>
            <div class="admin-stat">
              <div class="admin-stat-value">${stats.pendingReviews}</div>
              <div class="admin-stat-label">Onay Bekleyen</div>
            </div>
            <div class="admin-stat">
              <div class="admin-stat-value" style="color:var(--accent-gold);">${this.formatNumber(stats.totalCoinsCirculating)}</div>
              <div class="admin-stat-label">Toplam Coin</div>
            </div>
          </div>
          
          <div class="card animate-in animate-delay-1">
            <div class="card-header">
              <div class="card-title">👥 Kullanıcılar</div>
              <span class="card-badge">${users.length} kayıtlı</span>
            </div>
            <div style="overflow-x:auto;">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Kullanıcı</th>
                    <th>E-posta</th>
                    <th>Coin</th>
                    <th>İşletme</th>
                    <th>Yorum</th>
                    <th>Rol</th>
                  </tr>
                </thead>
                <tbody>
                  ${users.map(u => `
                    <tr>
                      <td style="display:flex;align-items:center;gap:8px;">
                        <img src="${u.avatar}" style="width:28px;height:28px;border-radius:50%;" alt="">
                        ${u.name}
                      </td>
                      <td>${u.email}</td>
                      <td style="font-weight:700;color:var(--accent-gold);">🪙 ${this.formatNumber(u.coins)}</td>
                      <td>${u.business_count}</td>
                      <td>${u.review_count}</td>
                      <td><span class="review-status ${u.role === 'admin' ? 'pending' : 'approved'}">${u.role}</span></td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        `;
      } 
      else if (tab === 'businesses') {
        const businesses = await this.api('/api/admin/businesses');
        
        content.innerHTML = `
          <div class="card animate-in">
            <div class="card-header">
              <div class="card-title">🏪 Tüm İşletmeler</div>
              <div style="display:flex;gap:8px;align-items:center;">
                <span class="card-badge">${businesses.length} işletme</span>
                <button class="btn-primary btn-sm" onclick="App.showAddBusinessModal()" style="padding:6px 14px;font-size:0.85rem;">
                  ➕ İşletme Ekle
                </button>
              </div>
            </div>
            ${businesses.length === 0 ? `
              <div class="empty-state">
                <div class="empty-state-icon">🏪</div>
                <div class="empty-state-title">Sistemde henüz işletme yok</div>
                <div class="empty-state-desc">İlk işletmeyi eklemek için yukarıdaki butona tıklayın.</div>
              </div>
            ` : `
            <div style="overflow-x:auto;">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>İşletme Adı</th>
                    <th>Kategori</th>
                    <th>Sahibi</th>
                    <th>Google Maps</th>
                    <th>Aktif Görevler</th>
                    <th>Aksiyonlar</th>
                  </tr>
                </thead>
                <tbody>
                  ${businesses.map(b => `
                    <tr>
                      <td style="font-weight:600;">${b.name}</td>
                      <td>${b.category}</td>
                      <td>
                        <div style="font-size:0.9rem;">${b.owner_name}</div>
                        <div style="font-size:0.75rem;color:var(--text-muted);">${b.owner_email}</div>
                      </td>
                      <td><a href="${b.google_maps_url}" target="_blank" style="color:var(--accent-secondary);">📍 Harita</a></td>
                      <td>${b.active_tasks}</td>
                      <td>
                        <button class="btn-danger btn-sm" onclick="App.deleteAnyBusiness(${b.id})">Sil</button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
            `}
          </div>
        `;
      }

      else if (tab === 'reviews') {
        const reviews = await this.api('/api/admin/reviews');
        
        if (reviews.length === 0) {
          content.innerHTML = '<div class="empty-state"><div class="empty-state-icon">✅</div><div class="empty-state-title">Bekleyen yorum yok</div><div class="empty-state-desc">Tüm yorumlar değerlendirilmiş.</div></div>';
          return;
        }

        content.innerHTML = `
          <div class="card animate-in">
            <div class="card-header">
              <div class="card-title">✅ Yorum Doğrulamaları</div>
              <span class="card-badge">${reviews.length} bekleyen</span>
            </div>
            
            <div class="reviews-section" style="padding: 16px;">
              ${reviews.map(r => `
                <div class="review-item" style="border:1px solid rgba(255,255,255,0.05);margin-bottom:16px;">
                  <img src="${r.reviewer_avatar}" alt="${r.reviewer_name}" class="review-avatar">
                  <div class="review-content">
                    <div class="review-header">
                      <div>
                        <div class="review-author">${r.reviewer_name} <span style="font-size:0.7rem;color:var(--text-muted);">(${r.reviewer_email})</span></div>
                        <div class="review-business">Hedef İşletme: <a href="${r.google_maps_url}" target="_blank" style="color:var(--accent-secondary);text-decoration:none;">${r.business_name}</a> · ${App.formatDate(r.created_at)}</div>
                      </div>
                      <div class="review-stars">${App.renderStars(r.rating)}</div>
                    </div>
                    
                    <div style="background:var(--bg-glass);padding:12px;border-radius:var(--radius-md);margin:12px 0;">
                      <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:4px;">Yazılan Yorum:</div>
                      <p class="review-text" style="margin:0;">"${r.review_text}"</p>
                    </div>

                    ${r.proof_screenshot ? `
                      <div style="margin-bottom:16px;">
                        <span style="font-size:0.8rem;color:var(--text-secondary);">Kanıt Ekran Görüntüsü: </span>
                        <a href="${r.proof_screenshot}" target="_blank" style="color:var(--accent-primary);text-decoration:none;font-size:0.9rem;">🖼 Görüntüle</a>
                      </div>
                    ` : `
                      <div style="margin-bottom:16px;font-size:0.8rem;color:var(--accent-red);">⚠️ Kanıt yüklenmemiş!</div>
                    `}

                    <div style="display:flex;align-items:center;justify-content:space-between;padding-top:12px;border-top:1px solid rgba(255,255,255,0.05);">
                      <div class="reward-badge">
                        🪙 ${r.coin_reward} Coin
                      </div>
                      <div class="review-actions">
                        <button class="btn-success btn-sm" onclick="App.approveAnyReview(${r.id})">✅ Doğrula ve Onayla</button>
                        <button class="btn-danger btn-sm" onclick="App.rejectAnyReview(${r.id})">❌ Reddet</button>
                      </div>
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }
    } catch (e) {
      content.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🔒</div><div class="empty-state-title">Beklenmeyen bir hata oluştu.</div></div>';
    }
  },

  async deleteAnyBusiness(id) {
    if (!confirm('Bu işletmeyi sistemden tamamen silmek istediğinize emin misiniz?')) return;
    try {
      await this.api(`/api/admin/businesses/${id}`, { method: 'DELETE' });
      this.toast('İşletme sistemden silindi.', 'success');
      this.switchAdminTab('businesses');
    } catch (e) {
      this.toast(e.message, 'error');
    }
  },

  async approveAnyReview(id) {
    try {
      await this.api(`/api/admin/reviews/${id}/approve`, { method: 'PUT' });
      this.toast('Yorum onaylandı ve coin aktarıldı.', 'success');
      this.switchAdminTab('reviews');
    } catch (e) {
      this.toast(e.message, 'error');
    }
  },

  async rejectAnyReview(id) {
    if (!confirm('Bu yorumu sistemden reddetmek istediğinize emin misiniz?')) return;
    try {
      await this.api(`/api/admin/reviews/${id}/reject`, { method: 'PUT' });
      this.toast('Yorum reddedildi.', 'warning');
      this.switchAdminTab('reviews');
    } catch (e) {
      this.toast(e.message, 'error');
    }
  },

  showAddBusinessModal() {
    const categories = ['Kafe', 'Restoran', 'Güzellik', 'Oto Hizmetleri', 'Sağlık', 'Hukuk', 'Eğitim', 'Teknoloji', 'Alışveriş', 'Otel', 'Spor', 'Eğlence', 'Diğer'];
    this.showModal(`
      <div style="padding:24px;max-width:520px;width:100%;">
        <h3 style="font-size:1.3rem;font-weight:800;margin-bottom:20px;">➕ Yeni İşletme Ekle</h3>
        <p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:20px;">
          🔑 Admin ayrıcalığı: Coin harcamadan işletme ve görev oluşturabilirsiniz.
        </p>

        <div class="form-group">
          <label class="form-label">İşletme Adı *</label>
          <input type="text" id="admin-biz-name" class="form-input" placeholder="Örn: Yılmaz Cafe & Bistro" required>
        </div>

        <div class="form-group">
          <label class="form-label">Google Maps URL *</label>
          <input type="url" id="admin-biz-url" class="form-input" placeholder="https://maps.google.com/...">
          <div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px;">
            💡 Google Maps'te işletmeyi bulun → Paylaş → Linki kopyalayın
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Kategori</label>
          <select id="admin-biz-category" class="form-input">
            ${categories.map(c => `<option value="${c}">${c}</option>`).join('')}
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Açıklama</label>
          <textarea id="admin-biz-desc" class="form-input" rows="2" placeholder="İşletme hakkında kısa bilgi..."></textarea>
        </div>

        <div style="border-top:1px solid rgba(255,255,255,0.1);margin:16px 0;padding-top:16px;">
          <div style="font-size:0.9rem;font-weight:700;margin-bottom:12px;">📋 Yorum Görevi Oluştur (Opsiyonel)</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div class="form-group">
              <label class="form-label">Coin Ödülü</label>
              <input type="number" id="admin-biz-reward" class="form-input" value="10" min="1" max="100">
            </div>
            <div class="form-group">
              <label class="form-label">Kaç Yorum İsteniyor</label>
              <input type="number" id="admin-biz-total" class="form-input" value="20" min="1" max="500">
            </div>
            <div class="form-group">
              <label class="form-label">Min. Yıldız</label>
              <select id="admin-biz-rating" class="form-input">
                <option value="3">3 ⭐+</option>
                <option value="4" selected>4 ⭐+</option>
                <option value="5">5 ⭐</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Min. Kelime</label>
              <input type="number" id="admin-biz-words" class="form-input" value="20" min="5" max="200">
            </div>
          </div>
          <div style="font-size:0.75rem;color:var(--text-muted);">
            ✅ Bu alanları doldurunca görev otomatik oluşturulur. Boş bırakılırsa sadece işletme eklenir.
          </div>
        </div>

        <div style="display:flex;gap:12px;margin-top:20px;">
          <button class="btn-primary" onclick="App.submitAddBusiness()" style="flex:1;">
            ✅ İşletmeyi Ekle
          </button>
          <button class="btn-secondary" onclick="App.closeModal()" style="flex:0 0 auto;padding:8px 20px;">
            İptal
          </button>
        </div>
      </div>
    `);
  },

  async submitAddBusiness() {
    const name = document.getElementById('admin-biz-name')?.value?.trim();
    const google_maps_url = document.getElementById('admin-biz-url')?.value?.trim();
    const category = document.getElementById('admin-biz-category')?.value;
    const description = document.getElementById('admin-biz-desc')?.value?.trim();
    const coin_reward = parseInt(document.getElementById('admin-biz-reward')?.value) || 0;
    const total_reviews_needed = parseInt(document.getElementById('admin-biz-total')?.value) || 0;
    const min_rating = parseInt(document.getElementById('admin-biz-rating')?.value) || 4;
    const min_words = parseInt(document.getElementById('admin-biz-words')?.value) || 20;

    if (!name || !google_maps_url) {
      this.toast('İşletme adı ve Google Maps URL zorunludur!', 'error');
      return;
    }

    try {
      const payload = { name, google_maps_url, description, category };
      if (coin_reward > 0 && total_reviews_needed > 0) {
        payload.coin_reward = coin_reward;
        payload.total_reviews_needed = total_reviews_needed;
        payload.min_rating = min_rating;
        payload.min_words = min_words;
      }

      await this.api('/api/admin/businesses', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      this.closeModal();
      this.toast(`"${name}" işletmesi başarıyla eklendi! 🎉`, 'success');
      this.switchAdminTab('businesses');
    } catch (e) {
      this.toast(e.message, 'error');
    }
  }
};

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => App.init());
