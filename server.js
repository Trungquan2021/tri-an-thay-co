const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

// ─── App Setup ───────────────────────────────────────────────
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── JSON File Database ──────────────────────────────────────
const DB_PATH = path.join(__dirname, 'data', 'wishes.json');

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Load or initialize database
function loadDB() {
  try {
    if (fs.existsSync(DB_PATH)) {
      const raw = fs.readFileSync(DB_PATH, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Error loading DB, starting fresh:', err.message);
  }
  return { wishes: [], nextId: 1 };
}

function saveDB(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf-8');
}

let db = loadDB();

// ─── Normalization ───────────────────────────────────────────
function normalizeContent(text) {
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.,!?;:…"'""''❤️💖💕🌸🌻🌺💐✨💝🌷🎓📚🖊️🎀]+$/gu, '')
    .replace(/^[.,!?;:…"'""'']+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── Bad Word Filter ─────────────────────────────────────────
const BAD_WORDS = [
  'đụ', 'địt', 'lồn', 'cặc', 'đéo', 'đ.m', 'vcl', 'vkl',
  'dm', 'đm', 'clgt', 'dcm', 'đcm', 'wtf', 'fuck', 'shit',
  'damn', 'dick', 'bitch', 'asshole',
  'con mẹ', 'mẹ mày', 'thằng ngu', 'con ngu', 'óc chó',
  'đồ ngu', 'thằng khùng', 'con khùng'
];

function containsBadWords(text) {
  const lower = text.toLowerCase();
  return BAD_WORDS.some(word => lower.includes(word));
}

// ─── Rate Limiting ───────────────────────────────────────────
const submitLimiter = rateLimit({
  windowMs: 8 * 1000,
  max: 1,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Bạn gửi quá nhanh rồi! Hãy đợi vài giây nhé 💛'
  },
  keyGenerator: (req) => {
    return req.headers['x-forwarded-for'] || req.ip || req.connection.remoteAddress;
  }
});

// ─── Helper: Get Stats ───────────────────────────────────────
function getStats() {
  const wishes = db.wishes;
  const uniqueCount = wishes.length;
  const totalSends = wishes.reduce((sum, w) => sum + w.count, 0);
  const maxCount = wishes.length > 0 ? Math.max(...wishes.map(w => w.count)) : 0;
  return { uniqueCount, totalSends, maxCount };
}

// ─── API Routes ──────────────────────────────────────────────

// Get all wishes + stats
app.get('/api/wishes', (req, res) => {
  try {
    const sortedWishes = [...db.wishes].sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return new Date(b.updated_at) - new Date(a.updated_at);
    });
    const stats = getStats();
    res.json({ success: true, wishes: sortedWishes, stats });
  } catch (err) {
    console.error('Error fetching wishes:', err);
    res.status(500).json({ success: false, error: 'Lỗi hệ thống, vui lòng thử lại.' });
  }
});

// Submit a wish
app.post('/api/wishes', submitLimiter, (req, res) => {
  try {
    const { content } = req.body;

    // Validate
    if (!content || typeof content !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Vui lòng nhập lời chúc của bạn.'
      });
    }

    const trimmed = content.trim();

    if (trimmed.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Lời chúc cần ít nhất 2 ký tự nhé!'
      });
    }

    if (trimmed.length > 500) {
      return res.status(400).json({
        success: false,
        error: 'Lời chúc tối đa 500 ký tự thôi nhé!'
      });
    }

    // Bad word check
    if (containsBadWords(trimmed)) {
      return res.status(400).json({
        success: false,
        error: 'Nội dung không phù hợp. Hãy gửi những lời chúc tốt đẹp đến thầy cô nhé! 🌸'
      });
    }

    const normalized = normalizeContent(trimmed);

    if (normalized.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Lời chúc cần có nội dung ý nghĩa hơn nhé!'
      });
    }

    // Check for duplicate
    const existingIndex = db.wishes.findIndex(w => w.normalized === normalized);

    if (existingIndex >= 0) {
      // Increment count
      db.wishes[existingIndex].count += 1;
      db.wishes[existingIndex].updated_at = new Date().toISOString();
      saveDB(db);

      const updated = db.wishes[existingIndex];
      const stats = getStats();

      // Broadcast update to all clients
      io.emit('wish:updated', { wish: updated, stats });

      return res.json({
        success: true,
        wish: updated,
        isNew: false,
        message: 'Lời yêu thương của bạn đã được gửi đi! Cảm ơn bạn đã góp thêm một bông hoa vào ngày 20/11 ❤️'
      });
    } else {
      // Insert new wish
      const newWish = {
        id: db.nextId++,
        content: trimmed,
        normalized: normalized,
        count: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      db.wishes.push(newWish);
      saveDB(db);

      const stats = getStats();

      // Broadcast new wish to all clients
      io.emit('wish:new', { wish: newWish, stats });

      return res.json({
        success: true,
        wish: newWish,
        isNew: true,
        message: 'Lời yêu thương của bạn đã được gửi đi! Cảm ơn bạn đã góp thêm một bông hoa vào ngày 20/11 ❤️'
      });
    }
  } catch (err) {
    console.error('Error submitting wish:', err);
    res.status(500).json({
      success: false,
      error: 'Có lỗi xảy ra, vui lòng thử lại nhé!'
    });
  }
});

// Get stats only
app.get('/api/stats', (req, res) => {
  try {
    const stats = getStats();
    res.json({ success: true, stats });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Lỗi hệ thống.' });
  }
});

// ─── Socket.IO ───────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`🌸 New visitor connected (${socket.id})`);

  socket.on('disconnect', () => {
    console.log(`👋 Visitor disconnected (${socket.id})`);
  });
});

// ─── SPA Fallback ────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── Start Server ────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🌻 ═══════════════════════════════════════════════`);
  console.log(`🎓 Bức Tường Lời Tri Ân – 20/11`);
  console.log(`🌻 Server đang chạy tại: http://localhost:${PORT}`);
  console.log(`🌻 ═══════════════════════════════════════════════\n`);
});

// ─── Graceful Shutdown ───────────────────────────────────────
process.on('SIGINT', () => {
  console.log('\n🛑 Đang tắt server...');
  saveDB(db);
  server.close(() => {
    console.log('✅ Server đã tắt. Dữ liệu đã được lưu.');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  saveDB(db);
  server.close(() => process.exit(0));
});
