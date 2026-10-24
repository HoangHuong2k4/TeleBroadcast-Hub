const jwt = require('jsonwebtoken');
const { getDb } = require('../db/database');

const JWT_SECRET = process.env.JWT_SECRET || 'telebroadcast_hub_jwt_secret_key_2026';

function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      display_name: user.display_name,
      role: user.role
    },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ success: false, error: 'Vui lòng đăng nhập để tiếp tục' });
  }

  let token = null;
  if (authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  } else if (authHeader.startsWith('Basic ')) {
    // Hỗ trợ token Basic dạng base64 nếu có
    const b64 = authHeader.slice(6).trim();
    try {
      // Thử decode xem có phải JWT hay basic string cũ
      const decoded = Buffer.from(b64, 'base64').toString('utf-8');
      if (decoded.includes('.')) {
        token = decoded;
      }
    } catch (_) {}
  }

  if (!token) {
    token = authHeader; // fallback
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const db = getDb();
    const user = db.prepare('SELECT id, username, display_name, role, is_active FROM users WHERE id = ?').get(payload.id);

    if (!user) {
      return res.status(401).json({ success: false, error: 'Tài khoản người dùng không tồn tại' });
    }
    if (!user.is_active) {
      return res.status(403).json({ success: false, error: 'Tài khoản của bạn đã bị vô hiệu hóa' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn' });
  }
}

function adminOnly(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Chỉ Quản trị viên (Admin) mới có quyền truy cập' });
  }
  next();
}

module.exports = {
  JWT_SECRET,
  generateToken,
  authMiddleware,
  adminOnly
};
