const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');
const { sendOtp, verifyOtp, disconnectClient, getActiveClients } = require('../services/telegramClient');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// GET /api/accounts - Lấy danh sách tài khoản theo quyền
router.get('/', (req, res) => {
  try {
    const db = getDb();
    let query = `
      SELECT 
        a.id, a.user_id, a.phone, a.api_id, a.username, a.first_name, a.status, 
        a.flood_wait_until, a.time_slots, a.created_at, a.updated_at,
        u.username as owner_username, u.display_name as owner_name
      FROM accounts a
      LEFT JOIN users u ON u.id = a.user_id
    `;
    const params = [];

    if (req.user.role !== 'admin') {
      query += ' WHERE a.user_id = ?';
      params.push(req.user.id);
    } else if (req.query.user_id) {
      query += ' WHERE a.user_id = ?';
      params.push(req.query.user_id);
    }

    query += ' ORDER BY a.created_at DESC';

    const accounts = db.prepare(query).all(...params);

    // Gắn trạng thái realtime từ active clients
    const activeClients = getActiveClients();
    const enriched = accounts.map(acc => ({
      ...acc,
      is_online: activeClients.has(acc.phone) && activeClients.get(acc.phone).connected,
      flood_wait_remaining: acc.flood_wait_until > Date.now()
        ? Math.ceil((acc.flood_wait_until - Date.now()) / 1000)
        : 0
    }));

    res.json({ success: true, data: enriched });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/accounts/send-otp - Bước 1: Gửi OTP
router.post('/send-otp', async (req, res) => {
  let { phone, api_id, api_hash } = req.body;

  if (phone && (!api_id || !api_hash)) {
    const db = getDb();
    const existing = db.prepare('SELECT api_id, api_hash FROM accounts WHERE phone = ?').get(phone);
    if (existing && existing.api_id && existing.api_hash) {
      api_id = existing.api_id;
      api_hash = existing.api_hash;
    }
  }

  if (!phone || !api_id || !api_hash) {
    return res.status(400).json({ success: false, error: 'Thiếu thông tin: phone, api_id, api_hash' });
  }

  try {
    await sendOtp(phone, api_id, api_hash);
    res.json({ success: true, message: 'OTP đã được gửi về Telegram của bạn' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/accounts/verify-otp - Bước 2: Xác thực OTP và liên kết với tài khoản hiện tại
router.post('/verify-otp', async (req, res) => {
  const { phone, code, password } = req.body;

  if (!phone || !code) {
    return res.status(400).json({ success: false, error: 'Thiếu phone hoặc code' });
  }

  try {
    const result = await verifyOtp(phone, code, password, req.user.id);
    res.json({ success: true, data: result, message: 'Đăng nhập Telegram thành công!' });
  } catch (err) {
    if (err.message === 'NEED_2FA_PASSWORD') {
      return res.status(428).json({ success: false, error: 'NEED_2FA_PASSWORD', need2fa: true });
    }
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/accounts/:id - Xóa tài khoản
router.delete('/:id', async (req, res) => {
  try {
    const db = getDb();
    const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(req.params.id);
    if (!account) {
      return res.status(404).json({ success: false, error: 'Tài khoản không tồn tại' });
    }

    if (req.user.role !== 'admin' && account.user_id !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Bạn không có quyền xóa tài khoản này' });
    }

    await disconnectClient(account.phone);
    db.prepare('DELETE FROM accounts WHERE id = ?').run(req.params.id);

    res.json({ success: true, message: 'Đã xóa tài khoản' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/accounts/:id/disconnect - Ngắt kết nối
router.post('/:id/disconnect', async (req, res) => {
  try {
    const db = getDb();
    const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(req.params.id);
    if (!account) {
      return res.status(404).json({ success: false, error: 'Tài khoản không tồn tại' });
    }

    if (req.user.role !== 'admin' && account.user_id !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Bạn không có quyền ngắt kết nối tài khoản này' });
    }

    await disconnectClient(account.phone);
    res.json({ success: true, message: 'Đã ngắt kết nối' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/accounts/:id/time-slots - Cập nhật khung giờ chạy của tài khoản
router.put('/:id/time-slots', (req, res) => {
  try {
    const { time_slots } = req.body;
    const db = getDb();
    const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(req.params.id);
    if (!account) {
      return res.status(404).json({ success: false, error: 'Tài khoản không tồn tại' });
    }
    if (req.user.role !== 'admin' && account.user_id !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Bạn không có quyền cập nhật tài khoản này' });
    }

    const slotsJson = Array.isArray(time_slots) ? JSON.stringify(time_slots) : (time_slots || '[]');
    db.prepare('UPDATE accounts SET time_slots = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(slotsJson, req.params.id);

    // Đồng bộ sang các nhóm gán tài khoản này hoặc thuộc user này
    db.prepare(`
      UPDATE "groups" 
      SET custom_time_slots = ?, schedule_mode = 'custom' 
      WHERE account_phone = ? OR (user_id = ? AND (account_phone IS NULL OR account_phone = ''))
    `).run(slotsJson, account.phone, account.user_id);

    res.json({ success: true, message: 'Đã cập nhật khung giờ thành công', time_slots: slotsJson });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

