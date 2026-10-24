const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');
const { dispatch, stopDispatch, getDispatchStatus, reloadScheduler } = require('../services/scheduler');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// GET /api/scheduler/config - Lấy cấu hình lịch theo user
router.get('/config', (req, res) => {
  try {
    const db = getDb();
    let targetUserId = req.user.id;
    if (req.user.role === 'admin' && req.query.user_id) {
      targetUserId = parseInt(req.query.user_id);
    }

    // Lấy slots của targetUserId
    let slots = db.prepare(`
      SELECT * FROM schedule_config 
      WHERE user_id = ?
      ORDER BY time_slot
    `).all(targetUserId);

    // Nếu user chưa có slot nào trong schedule_config, nhưng tài khoản Telegram có time_slots:
    if (slots.length === 0) {
      const userAcc = db.prepare('SELECT time_slots FROM accounts WHERE user_id = ? AND time_slots != "[]" LIMIT 1').get(targetUserId);
      if (userAcc && userAcc.time_slots) {
        try {
          const defaultSlots = JSON.parse(userAcc.time_slots);
          if (Array.isArray(defaultSlots) && defaultSlots.length > 0) {
            const insertStmt = db.prepare('INSERT INTO schedule_config (user_id, time_slot, is_active) VALUES (?, ?, 1)');
            for (const s of defaultSlots) {
              insertStmt.run(targetUserId, s);
            }
            slots = db.prepare('SELECT * FROM schedule_config WHERE user_id = ? ORDER BY time_slot').all(targetUserId);
          }
        } catch (_) {}
      }
    }

    // Danh sách users cho Admin chuyển đổi
    let usersList = [];
    if (req.user.role === 'admin') {
      usersList = db.prepare('SELECT id, username, display_name, role FROM users ORDER BY id ASC').all();
    }

    const settings = db.prepare('SELECT key, value FROM settings').all();
    const settingsMap = Object.fromEntries(settings.map(s => [s.key, s.value]));

    res.json({
      success: true,
      data: {
        slots,
        target_user_id: targetUserId,
        users: usersList,
        settings: settingsMap
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/scheduler/config/slots - Thêm khung giờ theo user
router.post('/config/slots', async (req, res) => {
  try {
    const { time_slot, user_id } = req.body;
    if (!time_slot || !/^\d{2}:\d{2}$/.test(time_slot)) {
      return res.status(400).json({ success: false, error: 'time_slot không hợp lệ (định dạng HH:MM)' });
    }

    let targetUserId = req.user.id;
    if (req.user.role === 'admin' && user_id) {
      targetUserId = parseInt(user_id);
    }

    const db = getDb();
    const existing = db.prepare('SELECT id FROM schedule_config WHERE time_slot = ? AND user_id = ?').get(time_slot, targetUserId);
    if (existing) {
      return res.status(409).json({ success: false, error: 'Khung giờ này đã có trong lịch' });
    }

    const result = db.prepare('INSERT INTO schedule_config (user_id, time_slot, is_active) VALUES (?, ?, 1)').run(targetUserId, time_slot);

    // Đồng bộ vào accounts.time_slots của user này để các tài khoản Telegram chạy đồng bộ
    const activeSlots = db.prepare('SELECT time_slot FROM schedule_config WHERE user_id = ? AND is_active = 1 ORDER BY time_slot').all(targetUserId).map(s => s.time_slot);
    db.prepare('UPDATE accounts SET time_slots = ? WHERE user_id = ?').run(JSON.stringify(activeSlots), targetUserId);

    await reloadScheduler();

    const slot = db.prepare('SELECT * FROM schedule_config WHERE id = ?').get(result.lastInsertRowid);
    res.json({ success: true, data: slot });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/scheduler/config/slots/:id - Bật/Tắt khung giờ
router.patch('/config/slots/:id/toggle', async (req, res) => {
  try {
    const db = getDb();
    const slot = db.prepare('SELECT * FROM schedule_config WHERE id = ?').get(req.params.id);
    if (!slot) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy khung giờ' });
    }

    if (req.user.role !== 'admin' && slot.user_id && slot.user_id !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Bạn không có quyền sửa khung giờ này' });
    }

    const newStatus = slot.is_active ? 0 : 1;
    db.prepare('UPDATE schedule_config SET is_active = ? WHERE id = ?').run(newStatus, req.params.id);

    const targetUserId = slot.user_id || req.user.id;
    const activeSlots = db.prepare('SELECT time_slot FROM schedule_config WHERE user_id = ? AND is_active = 1 ORDER BY time_slot').all(targetUserId).map(s => s.time_slot);
    db.prepare('UPDATE accounts SET time_slots = ? WHERE user_id = ?').run(JSON.stringify(activeSlots), targetUserId);

    await reloadScheduler();

    res.json({ success: true, data: { ...slot, is_active: newStatus } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/scheduler/config/slots/:id - Xóa khung giờ
router.delete('/config/slots/:id', async (req, res) => {
  try {
    const db = getDb();
    const slot = db.prepare('SELECT * FROM schedule_config WHERE id = ?').get(req.params.id);
    if (!slot) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy khung giờ' });
    }

    if (req.user.role !== 'admin' && slot.user_id && slot.user_id !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Bạn không có quyền xóa khung giờ này' });
    }

    db.prepare('DELETE FROM schedule_config WHERE id = ?').run(req.params.id);

    const targetUserId = slot.user_id || req.user.id;
    const activeSlots = db.prepare('SELECT time_slot FROM schedule_config WHERE user_id = ? AND is_active = 1 ORDER BY time_slot').all(targetUserId).map(s => s.time_slot);
    db.prepare('UPDATE accounts SET time_slots = ? WHERE user_id = ?').run(JSON.stringify(activeSlots), targetUserId);

    await reloadScheduler();
    res.json({ success: true, message: 'Đã xóa khung giờ' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/scheduler/config/settings - Cập nhật settings
router.put('/config/settings', async (req, res) => {
  try {
    const { delay_min, delay_max, shuffle_groups, proxy_api } = req.body;
    const db = getDb();

    const upsert = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    const update = db.transaction(() => {
      if (delay_min !== undefined) upsert.run('delay_min', String(delay_min));
      if (delay_max !== undefined) upsert.run('delay_max', String(delay_max));
      if (shuffle_groups !== undefined) upsert.run('shuffle_groups', shuffle_groups ? '1' : '0');
      if (proxy_api !== undefined) upsert.run('proxy_api', String(proxy_api));
    });
    update();

    res.json({ success: true, message: 'Đã cập nhật cài đặt' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/scheduler/run-now - Chạy thủ công ngay
router.post('/run-now', async (req, res) => {
  try {
    const status = getDispatchStatus();
    if (status.isRunning) {
      return res.status(409).json({ success: false, error: 'Dispatcher đang chạy. Vui lòng đợi.' });
    }

    // Chạy bất đồng bộ và trả về ngay
    dispatch().then(result => {
      console.log('Manual dispatch kết thúc:', result);
    }).catch(err => {
      console.error('Manual dispatch lỗi:', err);
    });

    res.json({ success: true, message: 'Bắt đầu gửi tin. Xem nhật ký để theo dõi tiến trình.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/scheduler/run-group/:id - Gửi tin ngay cho 1 nhóm cụ thể
router.post('/run-group/:id', async (req, res) => {
  try {
    const status = getDispatchStatus();
    if (status.isRunning) {
      return res.status(409).json({ success: false, error: 'Dispatcher đang chạy. Vui lòng đợi.' });
    }

    dispatch(req.params.id).then(result => {
      console.log(`Manual group ${req.params.id} dispatch kết thúc:`, result);
    }).catch(err => {
      console.error(`Manual group ${req.params.id} dispatch lỗi:`, err);
    });

    res.json({ success: true, message: 'Bắt đầu gửi tin đến nhóm. Xem nhật ký để theo dõi tiến trình.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});


// POST /api/scheduler/stop - Dừng dispatcher
router.post('/stop', (req, res) => {
  try {
    stopDispatch();
    res.json({ success: true, message: 'Đã gửi lệnh dừng dispatcher' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/scheduler/status - Trạng thái dispatcher
router.get('/status', (req, res) => {
  try {
    const status = getDispatchStatus();
    res.json({ success: true, data: status });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/scheduler/rotate-proxy - Gọi API bên thứ 3 để xoay proxy và cập nhật .env / DB
router.post('/rotate-proxy', async (req, res) => {
  try {
    const db = getDb();
    const proxyApiSetting = db.prepare('SELECT value FROM settings WHERE key = ?').get('proxy_api');
    if (!proxyApiSetting || !proxyApiSetting.value) {
      return res.status(400).json({ error: 'Chưa cấu hình Link API Proxy Xoay trong cài đặt' });
    }

    const apiUrl = proxyApiSetting.value;
    
    // Call rotate API using native fetch
    const response = await fetch(apiUrl);
    const data = await response.json();
    
    if (data && data.proxy) {
      const proxyStr = data.proxy; // format: IP:PORT:USER:PASS
      const parts = proxyStr.split(':');
      if (parts.length === 4) {
        const proxyUrl = `socks5://${parts[2]}:${parts[3]}@${parts[0]}:${parts[1]}`;
        
        const upsert = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
        upsert.run('proxy_url', proxyUrl);
        
        res.json({ success: true, message: `Đã xoay sang IP: ${data.ip || parts[0]}` });
      } else {
        res.status(400).json({ error: 'Định dạng proxy trả về không đúng: ' + proxyStr });
      }
    } else {
      res.status(400).json({ error: data.message || 'Không xoay được proxy' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Lỗi khi gọi API Xoay Proxy: ' + err.message });
  }
});

module.exports = router;
