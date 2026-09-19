const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 8080;

// JSONボディの解析
app.use(express.json());

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

// メッセージ受信用API
app.post('/api/message', (req, res) => {
  const { message } = req.body;
  if (message === undefined || message === null) {
    return res.status(400).json({ error: 'Message is required' });
  }
  
  const timestamp = getJSTTimestamp();
  const reply = `${timestamp} ${message}`;
  
  res.json({ reply });
});

// 静的ファイルの配信
app.use(express.static(path.join(__dirname, 'public')));

// Reactのルーティング対応（SPA用フォールバック）
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
