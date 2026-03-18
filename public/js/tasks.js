// ============================================
// ReviewCoin — Tasks Page (Yorum Yap & Kazan)
// ============================================

const Tasks = {
  currentFilter: 'all',
  currentSort: 'reward_high',

  async load() {
    const container = document.getElementById('page-tasks');
    container.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
    
    try {
      const data = await App.api(`/api/tasks?category=${this.currentFilter}&sort=${this.currentSort}`);
      this.render(container, data);
    } catch (e) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">😕</div><div class="empty-state-title">Görevler yüklenemedi</div></div>';
    }
  },

  render(container, data) {
    const { tasks, categories } = data;
    
    container.innerHTML = `
      <div class="tasks-header">
        <div>
          <h2 class="tasks-title">⭐ Yorum Yap & Coin Kazan</h2>
          <p style="color:var(--text-secondary);font-size:0.85rem;margin-top:4px;">Google Maps'te yorum yap, coin kazan!</p>
        </div>
        <div class="filter-bar">
          <select class="filter-select" id="filter-category" onchange="Tasks.filterByCategory(this.value)">
            <option value="all">Tüm Kategoriler</option>
            ${categories.map(c => `<option value="${c}" ${this.currentFilter === c ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
          <select class="filter-select" id="filter-sort" onchange="Tasks.filterBySort(this.value)">
            <option value="reward_high" ${this.currentSort === 'reward_high' ? 'selected' : ''}>En Yüksek Coin</option>
            <option value="reward_low" ${this.currentSort === 'reward_low' ? 'selected' : ''}>En Düşük Coin</option>
            <option value="newest" ${this.currentSort === 'newest' ? 'selected' : ''}>En Yeni</option>
          </select>
        </div>
      </div>

      ${tasks.length > 0 ? `
        <div class="tasks-grid">
          ${tasks.map((task, i) => `
            <div class="task-card animate-in" style="animation-delay:${i * 0.05}s">
              ${task.image_url ? `<img src="${task.image_url}" alt="${task.business_name}" class="task-card-image" onerror="this.style.display='none'">` : ''}
              <div class="task-card-body">
                <span class="task-card-category">${task.category || 'Genel'}</span>
                <h3 class="task-card-title">${task.business_name}</h3>
                <p class="task-card-desc">${task.business_desc || 'Bu işletme için Google Maps\'te yorum yapın ve coin kazanın.'}</p>
                
                <div class="task-card-meta">
                  <div class="task-meta-item">
                    <span>⭐</span> Min <strong>${task.min_rating}</strong> yıldız
                  </div>
                  <div class="task-meta-item">
                    <span>📝</span> Min <strong>${task.min_words}</strong> kelime
                  </div>
                  <div class="task-meta-item">
                    <span>📊</span> <strong>${task.reviews_completed}</strong>/${task.total_reviews_needed}
                  </div>
                </div>

                <div class="progress-bar">
                  <div class="progress-fill" style="width:${(task.reviews_completed / task.total_reviews_needed) * 100}%"></div>
                </div>

                <div class="task-card-reward" style="margin-top:16px;">
                  <div class="reward-badge">
                    🪙 <span>${task.coin_reward}</span> Coin
                  </div>
                  <button class="btn-primary" onclick="Tasks.openSubmitModal(${task.id}, '${task.business_name.replace(/'/g, "\\'")}', '${task.google_maps_url}', ${task.min_rating}, ${task.min_words})">
                    Yorum Yap
                  </button>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      ` : `
        <div class="empty-state">
          <div class="empty-state-icon">🔍</div>
          <div class="empty-state-title">Aktif görev bulunamadı</div>
          <div class="empty-state-desc">Şu anda yapabileceğiniz bir yorum görevi yok. Daha sonra tekrar kontrol edin!</div>
        </div>
      `}
    `;
  },

  filterByCategory(value) {
    this.currentFilter = value;
    this.load();
  },

  filterBySort(value) {
    this.currentSort = value;
    this.load();
  },

  openSubmitModal(taskId, businessName, mapsUrl, minRating, minWords) {
    let selectedRating = 5;
    
    App.showModal(`
      <div class="modal-header">
        <h3 class="modal-title">📝 Yorum Gönder</h3>
        <button class="modal-close" onclick="App.closeModal()">✕</button>
      </div>
      
      <div style="padding:12px 16px;border-radius:var(--radius-md);background:var(--bg-glass);margin-bottom:20px;">
        <strong style="display:block;margin-bottom:4px;">${businessName}</strong>
        <a href="${mapsUrl}" target="_blank" style="font-size:0.8rem;color:var(--accent-secondary);">📍 Google Maps'te Aç →</a>
      </div>

      <div style="padding:12px 16px;border-radius:var(--radius-md);background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.2);margin-bottom:20px;font-size:0.8rem;color:var(--accent-gold);">
        ⚠️ Önce yukarıdaki linkten Google Maps'te yorumunuzu yapın, ardından buraya kanıt olarak yorumunuzu yazın.
      </div>

      <form id="submit-review-form" onsubmit="Tasks.submitReview(event, ${taskId})">
        <div class="form-group">
          <label class="form-label">Yıldız Puanı (Min: ${minRating})</label>
          <div class="star-rating-input" id="star-input">
            ${[1,2,3,4,5].map(s => `<span class="star ${s <= 5 ? 'active' : ''}" data-rating="${s}" onclick="Tasks.setRating(${s})">${s <= 5 ? '★' : '☆'}</span>`).join('')}
          </div>
          <input type="hidden" id="review-rating" value="5">
        </div>

        <div class="form-group">
          <label class="form-label">Yorumunuz (Min: ${minWords} kelime)</label>
          <textarea class="form-textarea" id="review-text" placeholder="Google Maps'te yaptığınız yorumun aynısını buraya yazın..." rows="4" required></textarea>
          <div class="form-hint" id="word-count">0 / ${minWords} kelime</div>
        </div>

        <div class="form-group">
          <label class="form-label">Ekran Görüntüsü URL (Opsiyonel)</label>
          <input class="form-input" id="review-screenshot" type="url" placeholder="https://i.imgur.com/...">
          <div class="form-hint">Yorumunuzun ekran görüntüsünü yükleyin (opsiyonel)</div>
        </div>

        <div class="form-actions">
          <button type="button" class="btn-secondary" onclick="App.closeModal()">İptal</button>
          <button type="submit" class="btn-primary" id="submit-btn">🚀 Gönder</button>
        </div>
      </form>
    `);

    // Word counter
    document.getElementById('review-text').addEventListener('input', function() {
      const words = this.value.trim().split(/\s+/).filter(w => w).length;
      document.getElementById('word-count').textContent = `${words} / ${minWords} kelime`;
      document.getElementById('word-count').style.color = words >= minWords ? 'var(--accent-green)' : 'var(--text-muted)';
    });
  },

  setRating(rating) {
    document.getElementById('review-rating').value = rating;
    document.querySelectorAll('#star-input .star').forEach(star => {
      const r = parseInt(star.dataset.rating);
      star.classList.toggle('active', r <= rating);
      star.textContent = r <= rating ? '★' : '☆';
    });
  },

  async submitReview(e, taskId) {
    e.preventDefault();
    
    const btn = document.getElementById('submit-btn');
    btn.disabled = true;
    btn.textContent = 'Gönderiliyor...';

    try {
      const data = {
        review_text: document.getElementById('review-text').value,
        rating: parseInt(document.getElementById('review-rating').value),
        proof_screenshot: document.getElementById('review-screenshot').value || null
      };

      await App.api(`/api/tasks/${taskId}/submit`, {
        method: 'POST',
        body: JSON.stringify(data)
      });

      App.closeModal();
      App.toast('Yorumunuz gönderildi! Onay bekleniyor... ⏳', 'success');
      this.load();
    } catch (e) {
      App.toast(e.message, 'error');
      btn.disabled = false;
      btn.textContent = '🚀 Gönder';
    }
  }
};
