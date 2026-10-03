import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import proxy from 'express-http-proxy';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8081';

// リバースプロキシ（Cloud Runなどのロードバランサ）の信頼設定 (Cookieの維持に必須)
app.set('trust proxy', 1);

// --- IAMトークン管理の実装 ---
let cachedToken = null;
let tokenExpiresAt = 0;

/**
 * Cloud RunのメタデータサーバーからIDトークンを取得
 */
async function getIdentityToken(audience) {
  // 1. ローカル環境（K_SERVICE環境変数が存在しない）の場合は、認証なしとしてnullを返す
  if (!process.env.K_SERVICE) {
    return null;
  }

  // 2. キャッシュの期限内であれば再利用（トークンは通常1時間有効。ここでは55分で更新）
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt) {
    return cachedToken;
  }

  try {
    // メタデータサーバーから「BackendのURL（audience）」に対応するIDトークンを取得
    const metadataUrl = `http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity?audience=${encodeURIComponent(audience)}`;
    const response = await fetch(metadataUrl, {
      headers: { 'Metadata-Flavor': 'Google' }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch metadata token: ${response.statusText}`);
    }
    
    const token = await response.text();
    cachedToken = token;
    tokenExpiresAt = Date.now() + 55 * 60 * 1000; // 55分キャッシュ
    return token;
  } catch (error) {
    console.error('⚠️ Identity Tokenの取得に失敗しました:', error);
    return null;
  }
}

// APIリクエストをバックエンドへプロキシ
// Cookieを維持したまま転送するため、express-http-proxy は自動的にヘッダーをフォワードします。
app.use('/api', proxy(BACKEND_URL, {
  proxyReqPathResolver: function (req) {
    return '/api' + req.url;
  },
  proxyReqOptDecorator: async function (proxyReqOpts, srcReq) {
    // メタデータサーバーからトークンを取得し、Authorizationヘッダーに追加する
    const token = await getIdentityToken(BACKEND_URL);
    if (token) {
      proxyReqOpts.headers['Authorization'] = `Bearer ${token}`;
    }
    return proxyReqOpts;
  }
}));

// ビルドされた静的ファイルを配信
app.use(express.static(path.join(__dirname, 'dist')));

// SPAフォールバック
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Frontend Gateway is running on port ${PORT}`);
  console.log(`Proxying /api to ${BACKEND_URL}`);
});


