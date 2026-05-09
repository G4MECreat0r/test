// ============================================
// Discord → GitHub Pages リアルタイムアナウンス
// サーバー (Node.js + WebSocket)
// ============================================

const { Client, GatewayIntentBits } = require('discord.js');
const { WebSocketServer } = require('ws');
const http = require('http');

// ---- 設定 ----
const DISCORD_TOKEN   = process.env.DISCORD_TOKEN;   // Renderの環境変数で設定
const ANNOUNCE_CHANNEL = process.env.CHANNEL_NAME || 'announce'; // 監視するチャンネル名
const PORT = process.env.PORT || 3000;

// ---- HTTP サーバー (Renderのヘルスチェック用) ----
const httpServer = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Discord Announce Server Running');
});

// ---- WebSocket サーバー ----
const wss = new WebSocketServer({ server: httpServer });
const clients = new Set();

wss.on('connection', (ws, req) => {
  clients.add(ws);
  console.log(`クライアント接続: 現在${clients.size}人`);

  // 接続確認メッセージ
  ws.send(JSON.stringify({
    type: 'connected',
    message: 'サーバーに接続しました',
    timestamp: new Date().toISOString()
  }));

  ws.on('close', () => {
    clients.delete(ws);
    console.log(`クライアント切断: 残り${clients.size}人`);
  });

  ws.on('error', (err) => {
    console.error('WebSocketエラー:', err.message);
    clients.delete(ws);
  });
});

// 全クライアントにブロードキャスト
function broadcast(data) {
  const json = JSON.stringify(data);
  for (const client of clients) {
    if (client.readyState === 1) { // OPEN
      client.send(json);
    }
  }
}

// ---- Discord Bot ----
const bot = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ]
});

bot.once('ready', () => {
  console.log(`✅ Bot起動: ${bot.user.tag}`);
  console.log(`📡 監視チャンネル: #${ANNOUNCE_CHANNEL}`);
});

bot.on('messageCreate', (message) => {
  // Bot自身のメッセージは無視
  if (message.author.bot) return;

  // 指定チャンネルのみ
  if (message.channel.name !== ANNOUNCE_CHANNEL) return;

  const data = {
    type: 'announce',
    content: message.content,
    author: message.author.displayName || message.author.username,
    avatar: `https://cdn.discordapp.com/avatars/${message.author.id}/${message.author.avatar}.png`,
    timestamp: message.createdAt.toISOString(),
    id: message.id,
  };

  console.log(`📢 アナウンス: [${data.author}] ${data.content}`);
  broadcast(data);
});

bot.on('error', (err) => {
  console.error('Discord Botエラー:', err.message);
});

// ---- 起動 ----
httpServer.listen(PORT, () => {
  console.log(`🚀 サーバー起動: ポート ${PORT}`);
  bot.login(DISCORD_TOKEN);
});
