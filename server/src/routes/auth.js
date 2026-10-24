const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { getDb } = require('../db/database');
const { generateToken, authMiddleware } = require('../middleware/auth');

// POST /api/auth/login - Đăng nhập tài khoản
router.post('/login', (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Vui lòng nhập tên đăng nhập và mật khẩu' });
    }

    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE').get(username.trim());

    if (!user) {
      return res.status(401).json({ success: false, error: 'Tên đăng nhập hoặc mật khẩu không chính xác' });
    }

    if (!user.is_active) {
      return res.status(403).json({ success: false, error: 'Tài khoản đã bị tạm khóa, vui lòng liên hệ Admin' });
    }

    const isMatch = bcrypt.compareSync(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Tên đăng nhập hoặc mật khẩu không chính xác' });
    }

    const token = generateToken(user);

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        role: user.role
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/auth/me - Lấy thông tin user hiện tại
router.get('/me', authMiddleware, (req, res) => {
  res.json({
    success: true,
    user: req.user
  });
});

// POST /api/auth/change-password - Đổi mật khẩu của user đang đăng nhập
router.post('/change-password', authMiddleware, (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) {
      return res.status(400).json({ success: false, error: 'Vui lòng cung cấp mật khẩu cũ và mới' });
    }
    if (new_password.length < 6) {
      return res.status(400).json({ success: false, error: 'Mật khẩu mới phải có tối thiểu 6 ký tự' });
    }

    const db = getDb();
    const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
    const isMatch = bcrypt.compareSync(current_password, user.password_hash);

    if (!isMatch) {
      return res.status(400).json({ success: false, error: 'Mật khẩu hiện tại không đúng' });
    }

    const salt = bcrypt.genSaltSync(10);
    const newHash = bcrypt.hashSync(new_password, salt);
    db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newHash, req.user.id);

    res.json({ success: true, message: 'Đổi mật khẩu thành công' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
