const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// GET /api/stats - Thống kê tổng quan chuẩn theo User và Múi giờ Việt Nam (UTC+7)
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const isAdmin = req.user.role === 'admin';
    const userId = req.user.id;

    // Thời gian chuẩn múi giờ Việt Nam
    const now = new Date();
    const todayVN = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(now);
    const currentTimeVN = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour12: false,
      hour: '2-digit',
      minute: '2-digit'
    }).format(now);

    // Xác định User mục tiêu để thống kê:
    // - Nếu là User thường (như Hiệp): CHỈ thống kê dữ liệu của chính user đó!
    // - Nếu là Admin: mặc định thống kê toàn hệ thống, hoặc theo user_id nếu có query ?user_id=
    let targetUserId = null;
    if (!isAdmin) {
      targetUserId = userId;
    } else if (req.query.user_id) {
      targetUserId = parseInt(req.query.user_id);
    }

    // 1. Tổng số tài khoản Telegram
    const totalAccounts = targetUserId
      ? db.prepare('SELECT COUNT(*) as c FROM accounts WHERE user_id = ?').get(targetUserId).c
      : db.prepare('SELECT COUNT(*) as c FROM accounts').get().c;

    // 2. Tổng số nhóm mục tiêu
    const totalGroups = targetUserId
      ? db.prepare('SELECT COUNT(*) as c FROM groups WHERE (user_id = ? OR user_id IS NULL)').get(targetUserId).c
      : db.prepare('SELECT COUNT(*) as c FROM groups').get().c;

    // 3. Số nhóm đang hoạt động (active)
    const activeGroups = targetUserId
      ? db.prepare('SELECT COUNT(*) as c FROM groups WHERE is_active = 1 AND (user_id = ? OR user_id IS NULL)').get(targetUserId).c
      : db.prepare('SELECT COUNT(*) as c FROM groups WHERE is_active = 1').get().c;

    // 4. Tổng số kịch bản
    const totalTemplates = targetUserId
      ? db.prepare('SELECT COUNT(*) as c FROM templates WHERE (user_id = ? OR user_id IS NULL)').get(targetUserId).c
      : db.prepare('SELECT COUNT(*) as c FROM templates').get().c;

    // 5. Số tin gửi hôm nay (theo ngày VN)
    const todaySent = targetUserId
      ? db.prepare(`
          SELECT COUNT(*) as count 
          FROM send_logs 
          WHERE DATE(sent_at, '+7 hours') = ? 
            AND status = 'success' 
            AND (user_id = ? OR user_id IS NULL)
        `).get(todayVN, targetUserId).count
      : db.prepare(`
          SELECT COUNT(*) as count 
          FROM send_logs 
          WHERE DATE(sent_at, '+7 hours') = ? 
            AND status = 'success'
        `).get(todayVN).count;

    // 6. Tổng số tin gửi thành công
    const totalSuccess = targetUserId
      ? db.prepare(`SELECT COUNT(*) as count FROM send_logs WHERE status = 'success' AND (user_id = ? OR user_id IS NULL)`).get(targetUserId).count
      : db.prepare(`SELECT COUNT(*) as count FROM send_logs WHERE status = 'success'`).get().count;

    // 7. Tổng số tin gửi thất bại
    const totalFail = targetUserId
      ? db.prepare(`SELECT COUNT(*) as count FROM send_logs WHERE status = 'failed' AND (user_id = ? OR user_id IS NULL)`).get(targetUserId).count
      : db.prepare(`SELECT COUNT(*) as count FROM send_logs WHERE status = 'failed'`).get().count;

    // 8. Tỷ lệ thành công
    const totalLogs = totalSuccess + totalFail;
    const successRate = totalLogs > 0
      ? ((totalSuccess / totalLogs) * 100).toFixed(1)
      : 0;

    // 9. Khung giờ gửi của User (Lấy đúng theo user_id)
    let activeSlots = [];
    if (targetUserId) {
      activeSlots = db.prepare(`
        SELECT time_slot 
        FROM schedule_config 
        WHERE is_active = 1 AND user_id = ? 
        ORDER BY time_slot ASC
      `).all(targetUserId).map(s => s.time_slot);

      // Nếu chưa có trong schedule_config, fallback từ accounts.time_slots của user
      if (activeSlots.length === 0) {
        const userAcc = db.prepare('SELECT time_slots FROM accounts WHERE user_id = ? AND time_slots != "[]" LIMIT 1').get(targetUserId);
        if (userAcc && userAcc.time_slots) {
          try {
            const parsed = JSON.parse(userAcc.time_slots);
            if (Array.isArray(parsed)) activeSlots = parsed.sort();
          } catch (_) {}
        }
      }
    } else {
      activeSlots = db.prepare(`
        SELECT DISTINCT time_slot 
        FROM schedule_config 
        WHERE is_active = 1 
        ORDER BY time_slot ASC
      `).all().map(s => s.time_slot);
    }

    // 10. Nhật ký 5 mục gần nhất (kèm avatar của chợ)
    const recentLogs = targetUserId
      ? db.prepare(`
          SELECT l.*, COALESCE(g.title, l.group_title) as group_title, g.avatar_url
          FROM send_logs l
          LEFT JOIN groups g ON g.identifier = l.group_identifier AND (g.user_id = l.user_id OR l.user_id IS NULL)
          WHERE (l.user_id = ? OR l.user_id IS NULL)
          ORDER BY l.sent_at DESC LIMIT 5
        `).all(targetUserId)
      : db.prepare(`
          SELECT l.*, COALESCE(g.title, l.group_title) as group_title, g.avatar_url
          FROM send_logs l
          LEFT JOIN groups g ON g.identifier = l.group_identifier AND (g.user_id = l.user_id OR l.user_id IS NULL)
          ORDER BY l.sent_at DESC LIMIT 5
        `).all();

    // 11. Biểu đồ 7 ngày gần nhất chuẩn theo giờ VN (đầy đủ 7 ngày kể cả ngày chưa gửi tin)
    const rawLast7Days = targetUserId
      ? db.prepare(`
          SELECT DATE(sent_at, '+7 hours') as date,
            SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success,
            SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
          FROM send_logs
          WHERE DATE(sent_at, '+7 hours') >= DATE('now', '+7 hours', '-6 days')
            AND (user_id = ? OR user_id IS NULL)
          GROUP BY DATE(sent_at, '+7 hours')
          ORDER BY date ASC
        `).all(targetUserId)
      : db.prepare(`
          SELECT DATE(sent_at, '+7 hours') as date,
            SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success,
            SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
          FROM send_logs
          WHERE DATE(sent_at, '+7 hours') >= DATE('now', '+7 hours', '-6 days')
          GROUP BY DATE(sent_at, '+7 hours')
          ORDER BY date ASC
        `).all();

    // Điền đủ 7 ngày liên tiếp từ (hôm nay - 6 ngày) tới hôm nay
    const daysMap = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000);
      const dStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(d);
      daysMap[dStr] = { date: dStr, success: 0, failed: 0 };
    }
    rawLast7Days.forEach(r => {
      if (daysMap[r.date]) {
        daysMap[r.date].success = Number(r.success) || 0;
        daysMap[r.date].failed = Number(r.failed) || 0;
      }
    });
    const last7Days = Object.values(daysMap);

    // Danh sách users (phục vụ bộ lọc nếu là admin)
    const users = isAdmin
      ? db.prepare('SELECT id, username, display_name, role FROM users ORDER BY id ASC').all()
      : [];

    res.json({
      success: true,
      data: {
        totalAccounts,
        totalGroups,
        activeGroups,
        totalTemplates,
        todaySent,
        totalSuccess,
        totalFail,
        successRate: parseFloat(successRate),
        activeSlots,
        currentTimeVN,
        todayVN,
        recentLogs,
        last7Days,
        users,
        targetUserId,
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
