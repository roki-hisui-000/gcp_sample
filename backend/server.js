const express = require('express');
const path = require('path');
const session = require('express-session');
const RedisStore = require('connect-redis').default;
const { Redis } = require('ioredis');
const geoip = require('geoip-lite'); 

const app = express();
const PORT = process.env.PORT || 8080;

// リバースプロキシ（Cloud Run のロードバランサ）の信頼設定 (Cookieの維持に必須)
app.set('trust proxy', 1);

// JSONボディの解析
app.use(express.json());

// 国外からのアクセスを遮断する
app.use((req, res, next) => {
  let country;

  // ローカル開発環境（localhostなど）の場合の処理
  const isLocal = !process.env.K_SERVICE && process.env.NODE_ENV !== 'production';

  if (isLocal) {
    // ローカルテスト用として強制的に日本（'JP'）を割り当てる
    // ※あえて海外からのアクセスをテストしたい場合は 'US' などに書き換えられます
    country = process.env.LOCAL_TEST_COUNTRY || 'JP';
    console.log(`[Local Development] Simulating country: ${country}`);
  } else {
      // 本番環境: プロキシ（Cloud Run / Frontend）から元のクライアントIPを抽出
    const forwarded = req.headers['x-forwarded-for'];
    const clientIp = forwarded ? forwarded.split(',')[0].trim() : req.ip;

    // IPアドレスから国コードを取得 (例: 'JP', 'US')
    const geo = geoip.lookup(clientIp);
    country = geo ? geo.country : null;
    console.log(`[Production] Client IP: ${clientIp}, Country: ${country}`);
  }

  // 日本(JP)以外からのアクセスの場合は403
  const upperCountry = country ? country.toUpperCase() : null;
  if (upperCountry !== 'JP') {
    return res.status(403).send('Access Denied: This service is only available in Japan.');
  }

  next();
});

// Valkeyクライアントの初期化
const valkey = new Redis({
  host: process.env.VALKEY_HOST || 'localhost',
  port: process.env.VALKEY_PORT || 6379,
});

valkey.on('connect', () => {
  console.log('✅ Connected to Valkey successfully!');
});

valkey.on('error', (err) => {
  console.error('❌ Valkey connection error:', err);
});

// Valkeyをセッションストアとするセッションミドルウェアの設定
app.use(
  session({
    store: new RedisStore({ client: valkey }),
    secret: process.env.SESSION_SECRET || 'gcp-sample-default-session-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      // Cloud Run環境（K_SERVICE環境変数が存在）の場合は secure: true (HTTPS必須) にし、
      // ローカルのDocker環境の場合は secure: false (HTTP通信) に自動的に切り替えます。
      secure: process.env.K_SERVICE ? true : false,
      httpOnly: true, // セキュリティ保護
      maxAge: 1000 * 60 * 60 * 24, // セッションの寿命（1日間）
      sameSite: 'lax', // 標準的な同一オリジンクッキー制限
    },
  })
);

// JSTのタイムスタンプを取得する関数
function getJSTTimestamp() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  const parts = formatter.formatToParts(now);
  const partMap = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return `${partMap.year}/${partMap.month}/${partMap.day} ${partMap.hour}:${partMap.minute}:${partMap.second}`;
}

// 1. ログイン状態の確認API
app.get('/api/user', (req, res) => {
  if (req.session && req.session.username) {
    return res.json({ loggedIn: true, username: req.session.username });
  }
  res.json({ loggedIn: false });
});

// 2. ユーザー登録API (新規作成)
app.post('/api/register', async (req, res) => {
  const { username } = req.body;
  if (!username || !username.trim()) {
    return res.status(400).json({ error: '名前を入力してください。' });
  }

  const trimmedName = username.trim();

  try {
    // ValkeyのSet型で登録済みユーザーを確認
    const exists = await valkey.sismember('registered_users', trimmedName);
    if (exists) {
      return res.status(400).json({ error: 'この名前はすでに登録されています。' });
    }

    // 新規登録
    await valkey.sadd('registered_users', trimmedName);
    res.json({ success: true, username: trimmedName });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: '登録処理中にエラーが発生しました。' });
  }
});

// 3. 名前ログインAPI (変更)
app.post('/api/login', async (req, res) => {
  const { username } = req.body;
  if (!username || !username.trim()) {
    return res.status(400).json({ error: '名前を入力してください。' });
  }

  const trimmedName = username.trim();

  try {
    // ValkeyのSet型で登録済みユーザーを確認
    const exists = await valkey.sismember('registered_users', trimmedName);
    if (!exists) {
      return res.status(401).json({ error: 'この名前は登録されていません。新規登録してください。' });
    }

    // セッション（Valkey）にユーザー名を保存
    req.session.username = trimmedName;
    res.json({ success: true, username: req.session.username });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'ログイン処理中にエラーが発生しました。' });
  }
});

// 3. メッセージ受信用API
app.post('/api/message', async (req, res) => {
  // セッションから名前を取得。もし未登録ならエラー
  if (!req.session || !req.session.username) {
    return res.status(401).json({ error: 'Unauthorized. Please set your name first.' });
  }

  const { message } = req.body;
  if (message === undefined || message === null) {
    return res.status(400).json({ error: 'Message is required' });
  }
  
  const timestamp = getJSTTimestamp();
  const username = req.session.username;

  // フォーマット: 2026/09/20 09:41:36 [名前] メッセージ
  const reply = `${timestamp} [${username}] ${message}`;
  res.json({ reply });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});



