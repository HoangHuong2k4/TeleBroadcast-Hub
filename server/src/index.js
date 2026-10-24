const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const fileUpload = require('express-fileupload');
const path = require('path');
const fs = require('fs');

const { initDatabase } = require('./db/database');
const { initScheduler } = require('./services/scheduler');

// Routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const accountRoutes = require('./routes/accounts');
const groupRoutes = require('./routes/groups');
const templateRoutes = require('./routes/templates');
const schedulerRoutes = require('./routes/scheduler');
const logRoutes = require('./routes/logs');
const statsRoutes = require('./routes/stats');
const importRoutes = require('./routes/import');
const clusterRoutes = require('./routes/clusters');

// Bắt các ngoại lệ chưa được xử lý để tránh sập process (ví dụ khi Telegram client mất kết nối TCP)
process.on('uncaughtException', (err) => {
  console.error('⚠️ [Uncaught Exception]:', err?.message || err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ [Unhandled Rejection]:', reason?.message || reason);
});

const app = express();
const PORT = process.env.PORT || 3001;

// Tạo thư mục uploads nếu chưa có
const uploadsDir = process.env.UPLOADS_DIR || './uploads';
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Tạo thư mục data nếu chưa có
const dataDir = './data';
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'],
  credentials: true
}));

app.use(morgan('dev'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(fileUpload({
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  useTempFiles: false
}));

// Phục vụ file uploads tĩnh
app.use('/uploads', express.static(path.resolve(uploadsDir)));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/scheduler', schedulerRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/import', importRoutes);
app.use('/api/clusters', clusterRoutes);


// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Phục vụ React build trong production
if (process.env.NODE_ENV === 'production') {
  const clientBuild = path.join(__dirname, '../public');
  app.use(express.static(clientBuild));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientBuild, 'index.html'));
  });
}

// Khởi động server
async function start() {
  try {
    // Khởi tạo database
    initDatabase();
    console.log('✅ Database khởi tạo thành công');

    // Khởi động scheduler (không block để server lên luôn)
    initScheduler().catch(err => console.error('Lỗi khi khởi động scheduler:', err));
    console.log('✅ Tiến trình kết nối Telegram đang chạy ngầm...');

    app.listen(PORT, () => {
      console.log(`🚀 TeleBroadcast Hub Server đang chạy tại http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('❌ Lỗi khởi động server:', error);
    process.exit(1);
  }
}

start();

module.exports = app;
