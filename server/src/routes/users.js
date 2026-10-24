const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { getDb } = require('../db/database');
const { authMiddleware, adminOnly } = require('../middleware/auth');

// Toàn bộ routes người dùng bắt buộc phải là Admin
router.use(authMiddleware);
router.use(adminOnly);

// GET /api/users - Lấy danh sách tất cả người dùng kèm số lượng acc Telegram & nhóm
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const users = db.prepare(`
      SELECT 
        u.id, 
        u.username, 
        u.display_name, 
        u.role, 
        u.is_active, 
        u.created_at,
        (SELECT COUNT(*) FROM accounts a WHERE a.user_id = u.id) as accounts_count,
        (SELECT COUNT(*) FROM groups g WHERE g.user_id = u.id) as groups_count
      FROM users u
      ORDER BY u.created_at DESC
    `).all();

    res.json({ success: true, data: users });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/users - Admin tạo người dùng mới
router.post('/', (req, res) => {
  try {
    const { username, password, display_name, role } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Tên đăng nhập và mật khẩu là bắt buộc' });
    }

    const cleanUsername = username.trim().toLowerCase();
    if (cleanUsername.length < 3) {
      return res.status(400).json({ success: false, error: 'Tên đăng nhập phải có ít nhất 3 ký tự' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, error: 'Mật khẩu phải có ít nhất 6 ký tự' });
    }

    const db = getDb();
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(cleanUsername);
    if (existing) {
      return res.status(400).json({ success: false, error: 'Tên đăng nhập này đã tồn tại' });
    }

    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(password, salt);
    const userRole = role === 'admin' ? 'admin' : 'user';

    const result = db.prepare(`
      INSERT INTO users (username, password_hash, display_name, role, is_active)
      VALUES (?, ?, ?, ?, 1)
    `).run(cleanUsername, passwordHash, display_name ? display_name.trim() : cleanUsername, userRole);

    const newUser = db.prepare('SELECT id, username, display_name, role, is_active, created_at FROM users WHERE id = ?').get(result.lastInsertRowid);
    res.json({ success: true, data: newUser, message: 'Tạo tài khoản thành công' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/users/:id - Admin cập nhật thông tin user hoặc đổi mật khẩu
router.put('/:id', (req, res) => {
  try {
    const db = getDb();
    const targetId = parseInt(req.params.id);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(targetId);

    if (!user) {
      return res.status(404).json({ success: false, error: 'Người dùng không tồn tại' });
    }

    const { display_name, role, is_active, password } = req.body;

    // Không cho phép tự hạ quyền hoặc tự khóa chính mình
    if (targetId === req.user.id) {
      if (role && role !== 'admin') {
        return res.status(400).json({ success: false, error: 'Bạn không thể tự hạ quyền Admin của chính mình' });
      }
      if (is_active !== undefined && Number(is_active) === 0) {
        return res.status(400).json({ success: false, error: 'Bạn không thể tự khóa tài khoản của chính mình' });
      }
    }

    const newDisplayName = display_name !== undefined ? display_name.trim() : user.display_name;
    const newRole = role !== undefined ? (role === 'admin' ? 'admin' : 'user') : user.role;
    const newIsActive = is_active !== undefined ? (Number(is_active) ? 1 : 0) : user.is_active;

    if (password && password.trim().length > 0) {
      if (password.trim().length < 6) {
        return res.status(400).json({ success: false, error: 'Mật khẩu mới phải có ít nhất 6 ký tự' });
      }
      const salt = bcrypt.genSaltSync(10);
      const hash = bcrypt.hashSync(password.trim(), salt);
      db.prepare(`
        UPDATE users 
        SET display_name = ?, role = ?, is_active = ?, password_hash = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(newDisplayName, newRole, newIsActive, hash, targetId);
    } else {
      db.prepare(`
        UPDATE users 
        SET display_name = ?, role = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(newDisplayName, newRole, newIsActive, targetId);
    }

    const updated = db.prepare('SELECT id, username, display_name, role, is_active, updated_at FROM users WHERE id = ?').get(targetId);
    res.json({ success: true, data: updated, message: 'Cập nhật tài khoản thành công' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/users/:id - Admin xóa người dùng
router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    const targetId = parseInt(req.params.id);

    if (targetId === req.user.id) {
      return res.status(400).json({ success: false, error: 'Không thể xóa tài khoản của chính bạn' });
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(targetId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'Người dùng không tồn tại' });
    }

    // Xóa user (foreign key ON DELETE SET NULL đã được thiết lập)
    db.prepare('DELETE FROM users WHERE id = ?').run(targetId);
    res.json({ success: true, message: `Đã xóa người dùng ${user.username}` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
