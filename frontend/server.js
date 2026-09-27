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

// APIリクエストをバックエンドへプロキシ
// Cookieを維持したまま転送するため、express-http-proxy は自動的にヘッダーをフォワードします。
app.use('/api', proxy(BACKEND_URL, {
  proxyReqPathResolver: function (req) {
    return '/api' + req.url;
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

