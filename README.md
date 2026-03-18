# 🪙 ReviewCoin — Google Maps Yorum Değişim Platformu

AddMeFast tarzı bir yorum değişim platformu. Kullanıcılar Google Maps'te yorum yaparak coin kazanır, kendi işletmelerine yorum çekmek için coin harcar.

## 🚀 Kurulum

### Gereksinimler
- Node.js 18+ 
- npm

### Adımlar

```bash
# 1. Bağımlılıkları yükle
npm install

# 2. .env dosyasını oluştur
cp .env.example .env

# 3. Sunucuyu başlat (Demo modda)
npm run dev
```

Tarayıcıda `http://localhost:3000` adresine gidin.

## 🔑 Google OAuth Kurulumu (Opsiyonel)

Demo moddan gerçek Google OAuth'a geçmek için:

1. [Google Cloud Console](https://console.cloud.google.com/) → API & Services → Credentials
2. "Create Credentials" → "OAuth 2.0 Client ID"
3. Authorized redirect URI: `http://localhost:3000/auth/google/callback`
4. `.env` dosyasında:
   ```
   DEMO_MODE=false
   GOOGLE_CLIENT_ID=your_client_id
   GOOGLE_CLIENT_SECRET=your_client_secret
   ```

## 📋 Özellikler

- ✅ Google ile giriş (OAuth 2.0) + Demo modu
- ✅ İşletme ekleme ve yönetimi
- ✅ Yorum görevi oluşturma (coin harcama)
- ✅ Yorum yaparak coin kazanma
- ✅ Yorum onaylama/reddetme sistemi
- ✅ Coin işlem geçmişi
- ✅ Liderlik tablosu
- ✅ Admin paneli
- ✅ Premium dark theme UI
- ✅ Responsive (mobil uyumlu)

## 🐳 Docker

```bash
docker build -t reviewcoin .
docker run -p 3000:3000 reviewcoin
```

## 💰 Coin Ekonomisi

| Aksiyon | Coin |
|---------|------|
| Kayıt bonusu | +50 |
| Yorum yapma (onaylanınca) | +5 ~ +20 |
| Yorum görevi oluşturma | -(ödül × adet) |
