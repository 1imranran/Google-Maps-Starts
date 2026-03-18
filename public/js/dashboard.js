// ============================================
// ReviewCoin — Dashboard Page
// ============================================

const Dashboard = {
  async load() {
    const container = document.getElementById('page-dashboard');
    container.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
    
    try {
      const data = await App.api('/api/dashboard');
      this.render(container, data);
    } catch (e) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">😕</div><div class="empty-state-title">Veriler yüklenemedi</div></div>';
    }
  },

  render(container, data) {
    const { stats, recentTransactions, topEarners } = data;
    
    container.innerHTML = `
      <!-- Stats Cards -->
      <div class="stats-grid">
        <div class="stat-card coins-card glass animate-in">
          <div class="stat-icon">🪙</div>
          <div class="stat-value" id="dash-coins">${App.formatNumber(stats.coins)}</div>
          <div class="stat-label">Mevcut Coin</div>
        </div>
        <div class="stat-card reviews-card glass animate-in animate-delay-1">
          <div class="stat-icon">⭐</div>
          <div class="stat-value">${stats.reviewsApproved}/${stats.reviewsDone}</div>
          <div class="stat-label">Onaylı / Toplam Yorum</div>
        </div>
        <div class="stat-card business-card glass animate-in animate-delay-2">
          <div class="stat-icon">🏪</div>
          <div class="stat-value">${stats.businessCount}</div>
          <div class="stat-label">İşletmelerim</div>
        </div>
        <div class="stat-card pending-card glass animate-in animate-delay-3">
          <div class="stat-icon">⏳</div>
          <div class="stat-value">${stats.pendingApprovals}</div>
          <div class="stat-label">Onay Bekleyen</div>
        </div>
      </div>

      <!-- Quick Actions -->
      <div class="stats-grid" style="margin-bottom:24px;">
        <button class="btn-primary" onclick="App.navigate('tasks')" style="padding:16px;border-radius:var(--radius-md);font-size:0.9rem;">
          ⭐ Yorum Yap & Coin Kazan
        </button>
        <button class="btn-secondary" onclick="App.navigate('business')" style="padding:16px;border-radius:var(--radius-md);font-size:0.9rem;">
          🏪 İşletme Ekle & Yorum İste
        </button>
      </div>

      <!-- Grid -->
      <div class="dashboard-grid">
        <!-- Recent Transactions -->
        <div class="card animate-in animate-delay-2">
          <div class="card-header">
            <div class="card-title">💰 Son İşlemler</div>
            <span class="card-badge">${recentTransactions.length} işlem</span>
          </div>
          <div class="transaction-list">
            ${recentTransactions.length > 0 ? recentTransactions.map(t => `
              <div class="transaction-item">
                <div class="transaction-info">
                  <div class="transaction-type ${t.type}">
                    ${t.type === 'earn' ? '📈' : t.type === 'spend' ? '📉' : t.type === 'bonus' ? '🎁' : '↩️'}
                  </div>
                  <div>
                    <div class="transaction-desc">${t.description}</div>
                    <div class="transaction-date">${App.formatDate(t.created_at)}</div>
                  </div>
                </div>
                <div class="transaction-amount ${t.amount > 0 ? 'positive' : 'negative'}">
                  ${t.amount > 0 ? '+' : ''}${t.amount} 🪙
                </div>
              </div>
            `).join('') : '<div class="empty-state"><div class="empty-state-icon">📋</div><p>Henüz işlem yok</p></div>'}
          </div>
        </div>

        <!-- Leaderboard -->
        <div class="card animate-in animate-delay-3">
          <div class="card-header">
            <div class="card-title">🏆 Liderlik Tablosu</div>
            <span class="card-badge">Top 5</span>
          </div>
          <div class="leaderboard-list">
            ${topEarners.map((u, i) => `
              <div class="leaderboard-item">
                <div class="leaderboard-rank">${i + 1}</div>
                <img src="${u.avatar}" alt="${u.name}" class="leaderboard-avatar">
                <div class="leaderboard-name">${u.name} ${u.id === App.user?.id ? '<span style="color:var(--accent-primary);font-size:0.7rem;">(Sen)</span>' : ''}</div>
                <div class="leaderboard-coins">🪙 ${App.formatNumber(u.coins)}</div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }
};
