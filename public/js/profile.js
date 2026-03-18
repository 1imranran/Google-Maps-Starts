// ============================================
// ReviewCoin — Profile Page
// ============================================

const Profile = {
  async load() {
    const container = document.getElementById('page-profile');
    container.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
    
    try {
      const [transactions, leaderboard] = await Promise.all([
        App.api('/api/transactions'),
        App.api('/api/leaderboard')
      ]);
      
      await App.refreshUser();
      this.render(container, transactions, leaderboard);
    } catch (e) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">😕</div><div class="empty-state-title">Veriler yüklenemedi</div></div>';
    }
  },

  render(container, transactions, leaderboard) {
    const user = App.user;
    const myRank = leaderboard.findIndex(u => u.id === user.id) + 1;
    
    const totalEarned = transactions.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
    const totalSpent = transactions.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
    
    container.innerHTML = `
      <!-- Profile Card -->
      <div class="profile-header-card animate-in">
        <img src="${user.avatar}" alt="${user.name}" class="profile-avatar-large">
        <div class="profile-info">
          <h2>${user.name}</h2>
          <p class="profile-email">${user.email}</p>
          <div class="profile-stats-row">
            <div class="profile-stat">🪙 <strong>${App.formatNumber(user.coins)}</strong> Coin</div>
            <div class="profile-stat">🏆 <strong>#${myRank || '-'}</strong> Sıralama</div>
            <div class="profile-stat">📅 ${App.formatDate(user.created_at)}</div>
          </div>
        </div>
      </div>

      <!-- Coin Summary -->
      <div class="stats-grid" style="margin-bottom:24px;">
        <div class="stat-card coins-card glass animate-in animate-delay-1">
          <div class="stat-icon">💰</div>
          <div class="stat-value">${App.formatNumber(user.coins)}</div>
          <div class="stat-label">Mevcut Bakiye</div>
        </div>
        <div class="stat-card reviews-card glass animate-in animate-delay-2">
          <div class="stat-icon">📈</div>
          <div class="stat-value">${App.formatNumber(totalEarned)}</div>
          <div class="stat-label">Toplam Kazanılan</div>
        </div>
        <div class="stat-card pending-card glass animate-in animate-delay-3">
          <div class="stat-icon">📉</div>
          <div class="stat-value">${App.formatNumber(totalSpent)}</div>
          <div class="stat-label">Toplam Harcanan</div>
        </div>
      </div>

      <!-- Transaction History -->
      <div class="card animate-in animate-delay-3">
        <div class="card-header">
          <div class="card-title">📜 İşlem Geçmişi</div>
          <span class="card-badge">${transactions.length} işlem</span>
        </div>
        <div class="transaction-list">
          ${transactions.length > 0 ? transactions.map(t => `
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
    `;
  }
};
