const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// GET /api/logs - Lấy nhật ký gửi tin
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const { page = 1, limit = 50, status, group, date, user_id } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let where = [];
    let params = [];

    // Phân quyền theo User:
    // User thường chỉ được xem log của chính mình
    if (req.user.role !== 'admin') {
      where.push('l.user_id = ?');
      params.push(req.user.id);
    } else if (user_id && user_id !== 'all') {
      where.push('l.user_id = ?');
      params.push(parseInt(user_id));
    }

    if (status) {
      where.push('l.status = ?');
      params.push(status);
    }
    if (group) {
      where.push('(l.group_identifier LIKE ? OR l.group_title LIKE ? OR g.title LIKE ?)');
      params.push(`%${group}%`, `%${group}%`, `%${group}%`);
    }
    if (date) {
      where.push("DATE(l.sent_at, '+7 hours') = ?");
      params.push(date);
    }

    const whereClause = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';

    // Join với groups theo cả identifier và user_id để tránh nhân đôi dòng khi nhiều user cùng có 1 nhóm
    const total = db.prepare(`
      SELECT COUNT(*) as count 
      FROM send_logs l
      LEFT JOIN groups g ON g.identifier = l.group_identifier AND (g.user_id = l.user_id OR l.user_id IS NULL)
      ${whereClause}
    `).get(...params);

    const logs = db.prepare(`
      SELECT 
        l.*, 
        COALESCE(g.title, l.group_title) as group_title, 
        g.avatar_url,
        u.username as owner_username,
        u.display_name as owner_name,
        u.role as owner_role
      FROM send_logs l
      LEFT JOIN groups g ON g.identifier = l.group_identifier AND (g.user_id = l.user_id OR l.user_id IS NULL)
      LEFT JOIN users u ON u.id = l.user_id
      ${whereClause}
      ORDER BY l.sent_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, parseInt(limit), offset);

    // Thống kê số lượng log theo user cho admin
    let userStats = [];
    if (req.user.role === 'admin') {
      userStats = db.prepare(`
        SELECT user_id, COUNT(*) as count 
        FROM send_logs 
        GROUP BY user_id
      `).all();
    }

    const totalCount = total?.count || 0;
    const totalPages = Math.max(1, Math.ceil(totalCount / parseInt(limit)));

    res.json({
      success: true,
      data: logs,
      user_stats: userStats,
      pagination: {
        total: totalCount,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: totalPages
      }
    });
  } catch (err) {
    console.error('Lỗi lấy nhật ký:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/logs - Xóa nhật ký (hỗ trợ xóa theo user)
router.delete('/', (req, res) => {
  try {
    const db = getDb();
    const { user_id } = req.query;
    let result;
    if (req.user.role === 'admin') {
      if (user_id && user_id !== 'all') {
        result = db.prepare('DELETE FROM send_logs WHERE user_id = ?').run(parseInt(user_id));
      } else {
        result = db.prepare('DELETE FROM send_logs').run();
      }
    } else {
      result = db.prepare('DELETE FROM send_logs WHERE user_id = ?').run(req.user.id);
    }
    res.json({ success: true, message: 'Đã xóa nhật ký', deleted: result.changes });
  } catch (err) {
    console.error('Lỗi xóa nhật ký:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
