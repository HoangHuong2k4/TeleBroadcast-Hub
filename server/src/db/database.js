const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DB_PATH || './data/telebroadcast.db';

let db;

function getDb() {
  if (!db) {
    db = new Database(path.resolve(DB_PATH));
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

function ensureColumn(db, table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
  if (!columns.includes(column)) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
    console.log(`[DB Migration] Added column ${column} to table ${table}`);
  }
}

function initDatabase() {
  const db = getDb();
  const bcrypt = require('bcryptjs');

  // Bảng người dùng hệ thống (Users)
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT,
      role TEXT DEFAULT 'user',
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Bảng tài khoản Telegram
  db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      phone TEXT NOT NULL UNIQUE,
      api_id TEXT NOT NULL,
      api_hash TEXT NOT NULL,
      session_string TEXT,
      status TEXT DEFAULT 'disconnected',
      flood_wait_until INTEGER DEFAULT 0,
      username TEXT,
      first_name TEXT,
      time_slots TEXT DEFAULT '[]',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  // Bảng nhóm mục tiêu
  db.exec(`
    CREATE TABLE IF NOT EXISTS groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      identifier TEXT NOT NULL,
      title TEXT,
      member_count INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      last_sent_at DATETIME,
      account_phone TEXT,
      rule_prefix TEXT,
      rule_hashtags TEXT,
      rule_suffix TEXT,
      custom_rules TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(identifier, user_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  // Bảng mẫu tin nhắn (templates)
  db.exec(`
    CREATE TABLE IF NOT EXISTS templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      name TEXT NOT NULL,
      content TEXT NOT NULL,
      image_path TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  // Bảng cấu hình lịch gửi
  db.exec(`
    CREATE TABLE IF NOT EXISTS schedule_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      time_slot TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Bảng nhật ký gửi tin
  db.exec(`
    CREATE TABLE IF NOT EXISTS send_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      group_identifier TEXT NOT NULL,
      group_title TEXT,
      template_id INTEGER,
      template_name TEXT,
      status TEXT NOT NULL,
      error_message TEXT,
      sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE SET NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  // Bảng quan hệ nhóm ↔ kịch bản (nhiều-nhiều)
  db.exec(`
    CREATE TABLE IF NOT EXISTS group_templates (
      group_id INTEGER NOT NULL,
      template_id INTEGER NOT NULL,
      PRIMARY KEY (group_id, template_id),
      FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
      FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE
    )
  `);

  // Bảng cài đặt chung
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  // Bảng Cụm Chợ (Market Clusters)
  db.exec(`
    CREATE TABLE IF NOT EXISTS clusters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      name TEXT NOT NULL,
      description TEXT,
      color TEXT DEFAULT 'blue',
      default_template_id INTEGER,
      rule_prefix TEXT,
      rule_hashtags TEXT,
      rule_suffix TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Chạy migration bảo đảm các cột cần thiết tồn tại trên DB hiện hữu
  ensureColumn(db, 'accounts', 'user_id', 'INTEGER');
  ensureColumn(db, 'accounts', 'time_slots', "TEXT DEFAULT '[]'");
  ensureColumn(db, 'groups', 'user_id', 'INTEGER');
  ensureColumn(db, 'groups', 'cluster_id', 'INTEGER');
  ensureColumn(db, 'groups', 'account_phone', 'TEXT');
  ensureColumn(db, 'groups', 'rule_prefix', 'TEXT');
  ensureColumn(db, 'groups', 'rule_hashtags', 'TEXT');
  ensureColumn(db, 'groups', 'rule_suffix', 'TEXT');
  ensureColumn(db, 'groups', 'custom_rules', 'TEXT');
  ensureColumn(db, 'groups', 'template_mode', "TEXT DEFAULT 'global'");
  ensureColumn(db, 'groups', 'custom_content', 'TEXT');
  ensureColumn(db, 'groups', 'custom_image_path', 'TEXT');
  ensureColumn(db, 'groups', 'schedule_mode', "TEXT DEFAULT 'global'");
  ensureColumn(db, 'groups', 'custom_time_slots', 'TEXT');
  ensureColumn(db, 'groups', 'max_repeats_per_day', 'INTEGER DEFAULT 0');
  ensureColumn(db, 'groups', 'sent_today_count', 'INTEGER DEFAULT 0');
  ensureColumn(db, 'groups', 'last_sent_date', 'TEXT');
  ensureColumn(db, 'groups', 'avatar_url', 'TEXT');
  ensureColumn(db, 'schedule_config', 'user_id', 'INTEGER');
  ensureColumn(db, 'templates', 'user_id', 'INTEGER');
  ensureColumn(db, 'send_logs', 'user_id', 'INTEGER');

  // Khởi tạo tài khoản Admin mặc định nếu chưa có người dùng nào
  const adminUser = process.env.ADMIN_USER || 'admin';
  const adminPass = process.env.ADMIN_PASS || '123456';
  const existingUserCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;

  if (existingUserCount === 0) {
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(adminPass, salt);
    const result = db.prepare(`
      INSERT INTO users (username, password_hash, display_name, role, is_active)
      VALUES (?, ?, ?, 'admin', 1)
    `).run(adminUser, hash, 'Quản trị viên');
    const adminId = result.lastInsertRowid;
    console.log(`👑 Đã khởi tạo tài khoản Admin mặc định: [${adminUser}] (ID: ${adminId})`);

    // Gán các bản ghi cũ chưa có user_id sang cho admin
    db.prepare('UPDATE accounts SET user_id = ? WHERE user_id IS NULL').run(adminId);
    db.prepare('UPDATE groups SET user_id = ? WHERE user_id IS NULL').run(adminId);
    db.prepare('UPDATE templates SET user_id = ? WHERE user_id IS NULL').run(adminId);
  }

  // Thêm giờ mặc định nếu chưa có
  const existingSlots = db.prepare('SELECT COUNT(*) as count FROM schedule_config').get();
  if (existingSlots.count === 0) {
    const insertSlot = db.prepare('INSERT INTO schedule_config (time_slot, is_active) VALUES (?, 1)');
    insertSlot.run('09:00');
    insertSlot.run('14:00');
    insertSlot.run('20:00');
  }

  // Cài đặt mặc định
  const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  insertSetting.run('delay_min', '35');
  insertSetting.run('delay_max', '65');
  insertSetting.run('shuffle_groups', '1');

  console.log('📦 Database schema & migrations đã sẵn sàng');
  return db;
}

module.exports = { getDb, initDatabase };

