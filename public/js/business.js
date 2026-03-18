// ============================================
// ReviewCoin — Business Page (İşletmelerim)
// ============================================

const Business = {
  async load() {
    const container = document.getElementById('page-business');
    container.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
    
    try {
      const [businesses, reviews] = await Promise.all([
        App.api('/api/businesses'),
        App.api('/api/my-reviews')
      ]);
      this.render(container, businesses, reviews);
    } catch (e) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">😕</div><div class="empty-state-title">Veriler yüklenemedi</div></div>';
    }
  },

  render(container, businesses, reviews) {
    const pendingReviews = reviews.filter(r => r.status === 'pending');
    
    container.innerHTML = `
      <div class="business-header">
        <div>
          <h2 class="tasks-title">🏪 İşletmelerim</h2>
          <p style="color:var(--text-secondary);font-size:0.85rem;margin-top:4px;">İşletmelerini ekle, yorum görevi oluştur</p>
        </div>
        <button class="btn-primary" onclick="Business.openAddModal()">+ İşletme Ekle</button>
      </div>

      ${businesses.length > 0 ? `
        <div class="business-grid">
          ${businesses.map((b, i) => `
            <div class="business-card animate-in" style="animation-delay:${i * 0.05}s">
              <div class="business-card-header">
                <h3 class="business-card-title">${b.name}</h3>
                <span class="task-card-category">${b.category || 'Genel'}</span>
              </div>
              <p class="business-card-desc">${b.description || 'Açıklama eklenmemiş.'}</p>
              
              <div class="business-card-stats">
                <div class="business-stat">
                  <div class="business-stat-value">${b.active_tasks || 0}</div>
                  <div class="business-stat-label">Aktif Görev</div>
                </div>
                <div class="business-stat">
                  <div class="business-stat-value">${b.total_reviews || 0}</div>
                  <div class="business-stat-label">Toplam Yorum</div>
                </div>
              </div>

              <div class="business-card-actions">
                <button class="btn-primary btn-sm" onclick="Business.openTaskModal(${b.id}, '${b.name.replace(/'/g, "\\'")}')">📋 Yorum Görevi</button>
                <a href="${b.google_maps_url}" target="_blank" class="btn-secondary btn-sm">📍 Haritada Gör</a>
                <button class="btn-danger btn-sm" onclick="Business.deleteBusiness(${b.id})">🗑️</button>
              </div>
            </div>
          `).join('')}
        </div>
      ` : `
        <div class="empty-state" style="margin-bottom:32px;">
          <div class="empty-state-icon">🏪</div>
          <div class="empty-state-title">Henüz işletme eklenmemiş</div>
          <div class="empty-state-desc">İlk işletmenizi ekleyin ve yorum görevi oluşturun!</div>
          <button class="btn-primary" onclick="Business.openAddModal()">+ İşletme Ekle</button>
        </div>
      `}

      <!-- Pending Reviews Section -->
      ${pendingReviews.length > 0 ? `
        <div class="reviews-section animate-in animate-delay-2">
          <h3>⏳ Onay Bekleyen Yorumlar <span class="card-badge">${pendingReviews.length}</span></h3>
          ${pendingReviews.map(r => `
            <div class="review-item">
              <img src="${r.reviewer_avatar}" alt="${r.reviewer_name}" class="review-avatar">
              <div class="review-content">
                <div class="review-header">
                  <div>
                    <div class="review-author">${r.reviewer_name}</div>
                    <div class="review-business">${r.business_name} · ${App.formatDate(r.created_at)}</div>
                  </div>
                  <div class="review-stars">${App.renderStars(r.rating)}</div>
                </div>
                <p class="review-text">"${r.review_text}"</p>
                <div style="display:flex;align-items:center;justify-content:space-between;">
                  <div class="reward-badge" style="font-size:0.75rem;padding:4px 12px;">
                    🪙 ${r.coin_reward} Coin
                  </div>
                  <div class="review-actions">
                    <button class="btn-success btn-sm" onclick="Business.approveReview(${r.id})">✅ Onayla</button>
                    <button class="btn-danger btn-sm" onclick="Business.rejectReview(${r.id})">❌ Reddet</button>
                  </div>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      ` : ''}

      <!-- All Reviews -->
      ${reviews.filter(r => r.status !== 'pending').length > 0 ? `
        <div class="reviews-section animate-in animate-delay-3" style="margin-top:24px;">
          <h3>📋 Geçmiş Yorumlar</h3>
          ${reviews.filter(r => r.status !== 'pending').map(r => `
            <div class="review-item" style="opacity:0.8;">
              <img src="${r.reviewer_avatar}" alt="${r.reviewer_name}" class="review-avatar">
              <div class="review-content">
                <div class="review-header">
                  <div>
                    <div class="review-author">${r.reviewer_name}</div>
                    <div class="review-business">${r.business_name} · ${App.formatDate(r.created_at)}</div>
                  </div>
                  <span class="review-status ${r.status}">${r.status === 'approved' ? '✅ Onaylandı' : '❌ Reddedildi'}</span>
                </div>
                <p class="review-text">"${r.review_text || '-'}"</p>
              </div>
            </div>
          `).join('')}
        </div>
      ` : ''}
    `;
  },

  openAddModal() {
    App.showModal(`
      <div class="modal-header">
        <h3 class="modal-title">🏪 Yeni İşletme Ekle</h3>
        <button class="modal-close" onclick="App.closeModal()">✕</button>
      </div>
      
      <form id="add-business-form" onsubmit="Business.addBusiness(event)">
        <div class="form-group">
          <label class="form-label">İşletme Adı *</label>
          <input class="form-input" id="biz-name" type="text" placeholder="Örn: Cafe Istanbul" required>
        </div>

        <div class="form-group">
          <label class="form-label">Google Maps URL *</label>
          <input class="form-input" id="biz-url" type="url" placeholder="https://maps.google.com/..." required>
          <div class="form-hint">Google Maps'te işletmenizi bulup URL'sini yapıştırın</div>
        </div>

        <div class="form-group">
          <label class="form-label">Açıklama</label>
          <textarea class="form-textarea" id="biz-desc" placeholder="İşletmeniz hakkında kısa bilgi..." rows="3"></textarea>
        </div>

        <div class="form-group">
          <label class="form-label">Kategori</label>
          <select class="form-select-input" id="biz-category">
            <option value="Kafe">Kafe</option>
            <option value="Restoran">Restoran</option>
            <option value="Otel">Otel</option>
            <option value="Güzellik">Güzellik</option>
            <option value="Sağlık">Sağlık</option>
            <option value="Oto Hizmetleri">Oto Hizmetleri</option>
            <option value="Hukuk">Hukuk</option>
            <option value="Eğitim">Eğitim</option>
            <option value="Moda">Moda</option>
            <option value="Teknoloji">Teknoloji</option>
            <option value="Spor">Spor</option>
            <option value="Diğer">Diğer</option>
          </select>
        </div>

        <div class="form-actions">
          <button type="button" class="btn-secondary" onclick="App.closeModal()">İptal</button>
          <button type="submit" class="btn-primary" id="add-biz-btn">🏪 Ekle</button>
        </div>
      </form>
    `);
  },

  async addBusiness(e) {
    e.preventDefault();
    const btn = document.getElementById('add-biz-btn');
    btn.disabled = true;
    btn.textContent = 'Ekleniyor...';

    try {
      await App.api('/api/businesses', {
        method: 'POST',
        body: JSON.stringify({
          name: document.getElementById('biz-name').value,
          google_maps_url: document.getElementById('biz-url').value,
          description: document.getElementById('biz-desc').value,
          category: document.getElementById('biz-category').value
        })
      });

      App.closeModal();
      App.toast('İşletme başarıyla eklendi! 🎉', 'success');
      this.load();
    } catch (e) {
      App.toast(e.message, 'error');
      btn.disabled = false;
      btn.textContent = '🏪 Ekle';
    }
  },

  openTaskModal(businessId, businessName) {
    App.showModal(`
      <div class="modal-header">
        <h3 class="modal-title">📋 Yorum Görevi Oluştur</h3>
        <button class="modal-close" onclick="App.closeModal()">✕</button>
      </div>

      <div style="padding:12px 16px;border-radius:var(--radius-md);background:var(--bg-glass);margin-bottom:20px;">
        <strong>${businessName}</strong>
      </div>

      <form id="create-task-form" onsubmit="Business.createTask(event, ${businessId})">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Coin Ödülü (yorum başına)</label>
            <input class="form-input" id="task-reward" type="number" min="5" max="100" value="10" required>
          </div>
          <div class="form-group">
            <label class="form-label">Toplam Yorum Sayısı</label>
            <input class="form-input" id="task-total" type="number" min="1" max="100" value="10" required>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Min. Yıldız</label>
            <input class="form-input" id="task-rating" type="number" min="1" max="5" value="4" required>
          </div>
          <div class="form-group">
            <label class="form-label">Min. Kelime Sayısı</label>
            <input class="form-input" id="task-words" type="number" min="5" max="200" value="20" required>
          </div>
        </div>

        <div id="task-cost-preview" style="padding:16px;border-radius:var(--radius-md);background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.2);margin-bottom:20px;text-align:center;">
          <div style="font-size:0.8rem;color:var(--text-secondary);margin-bottom:4px;">Toplam Maliyet</div>
          <div style="font-size:1.5rem;font-weight:800;color:var(--accent-gold);">🪙 <span id="task-cost">100</span> Coin</div>
          <div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px;">Mevcut: 🪙 ${App.formatNumber(App.user?.coins || 0)}</div>
        </div>

        <div class="form-actions">
          <button type="button" class="btn-secondary" onclick="App.closeModal()">İptal</button>
          <button type="submit" class="btn-primary" id="create-task-btn">📋 Oluştur</button>
        </div>
      </form>
    `);

    // Cost calculator
    const updateCost = () => {
      const reward = parseInt(document.getElementById('task-reward').value) || 0;
      const total = parseInt(document.getElementById('task-total').value) || 0;
      document.getElementById('task-cost').textContent = App.formatNumber(reward * total);
    };

    document.getElementById('task-reward').addEventListener('input', updateCost);
    document.getElementById('task-total').addEventListener('input', updateCost);
  },

  async createTask(e, businessId) {
    e.preventDefault();
    const btn = document.getElementById('create-task-btn');
    btn.disabled = true;
    btn.textContent = 'Oluşturuluyor...';

    try {
      await App.api(`/api/businesses/${businessId}/task`, {
        method: 'POST',
        body: JSON.stringify({
          coin_reward: parseInt(document.getElementById('task-reward').value),
          total_reviews_needed: parseInt(document.getElementById('task-total').value),
          min_rating: parseInt(document.getElementById('task-rating').value),
          min_words: parseInt(document.getElementById('task-words').value)
        })
      });

      App.closeModal();
      await App.refreshUser();
      App.toast('Yorum görevi oluşturuldu! 🚀', 'success');
      this.load();
    } catch (e) {
      App.toast(e.message, 'error');
      btn.disabled = false;
      btn.textContent = '📋 Oluştur';
    }
  },

  async approveReview(reviewId) {
    try {
      await App.api(`/api/reviews/${reviewId}/approve`, { method: 'PUT' });
      App.toast('Yorum onaylandı! Coin gönderildi ✅', 'success');
      this.load();
    } catch (e) {
      App.toast(e.message, 'error');
    }
  },

  async rejectReview(reviewId) {
    if (!confirm('Bu yorumu reddetmek istediğinize emin misiniz?')) return;
    try {
      await App.api(`/api/reviews/${reviewId}/reject`, { method: 'PUT' });
      App.toast('Yorum reddedildi', 'warning');
      this.load();
    } catch (e) {
      App.toast(e.message, 'error');
    }
  },

  async deleteBusiness(businessId) {
    if (!confirm('Bu işletmeyi silmek istediğinize emin misiniz?')) return;
    try {
      await App.api(`/api/businesses/${businessId}`, { method: 'DELETE' });
      App.toast('İşletme silindi', 'info');
      this.load();
    } catch (e) {
      App.toast(e.message, 'error');
    }
  }
};
