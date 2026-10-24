const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { getDb } = require('../db/database');
const { authMiddleware } = require('../middleware/auth');
const { unspin } = require('../utils/spintax');
const { dispatch, composeGroupMessage } = require('../services/scheduler');
const { fetchTelegramGroupMeta } = require('../utils/telegramMeta');

router.use(authMiddleware);

const UPLOADS_DIR = process.env.UPLOADS_DIR || './uploads';

// GET /api/groups - Lấy tất cả nhóm theo phân quyền
router.get('/', (req, res) => {
  try {
    const db = getDb();
    let query = `
      SELECT 
        g.*, 
        u.username as owner_username, 
        u.display_name as owner_name,
        c.name as cluster_name,
        c.color as cluster_color,
        (SELECT COUNT(*) FROM group_templates gt WHERE gt.group_id = g.id) as assigned_templates_count,
        (SELECT GROUP_CONCAT(t.name, ', ') FROM group_templates gt JOIN templates t ON t.id = gt.template_id WHERE gt.group_id = g.id) as assigned_templates_names
      FROM groups g
      LEFT JOIN users u ON u.id = g.user_id
      LEFT JOIN clusters c ON c.id = g.cluster_id
    `;
    const conditions = [];
    const params = [];

    if (req.user.role !== 'admin') {
      conditions.push('(g.user_id = ? OR g.user_id IS NULL)');
      params.push(req.user.id);
    } else if (req.query.user_id) {
      conditions.push('g.user_id = ?');
      params.push(req.query.user_id);
    }

    if (req.query.cluster_id === 'unassigned') {
      conditions.push('g.cluster_id IS NULL');
    } else if (req.query.cluster_id) {
      conditions.push('g.cluster_id = ?');
      params.push(req.query.cluster_id);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY g.created_at DESC';

    const groups = db.prepare(query).all(...params);
    res.json({ success: true, data: groups });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/groups - Thêm nhóm (1 hoặc nhiều)
router.post('/', async (req, res) => {
  try {
    const db = getDb();
    const { 
      identifier, 
      bulk, 
      account_phone, 
      rule_prefix, 
      rule_hashtags, 
      rule_suffix, 
      custom_rules,
      template_mode,
      custom_content,
      schedule_mode,
      custom_time_slots,
      max_repeats_per_day
    } = req.body;
    const userId = (req.user.role === 'admin' && req.body.user_id) ? parseInt(req.body.user_id) : req.user.id;

    // Tự động tìm tài khoản Telegram của user để gán mặc định thông minh
    const userAcc = db.prepare("SELECT * FROM accounts WHERE user_id = ? AND status = 'connected' LIMIT 1").get(userId)
                 || db.prepare("SELECT * FROM accounts WHERE user_id = ? LIMIT 1").get(userId);

    const defaultPhone = account_phone || (userAcc ? userAcc.phone : null);
    
    // Nếu tài khoản phụ trách có lịch riêng, tự động gán luôn cho nhóm mới tạo
    let defaultScheduleMode = schedule_mode || 'custom';
    let defaultSlots = custom_time_slots;
    if (userAcc && userAcc.time_slots && userAcc.time_slots !== '[]') {
      defaultScheduleMode = schedule_mode || 'custom';
      defaultSlots = custom_time_slots && custom_time_slots !== '[]' ? custom_time_slots : userAcc.time_slots;
    } else {
      defaultScheduleMode = schedule_mode || 'global';
      defaultSlots = custom_time_slots || '[]';
    }

    if (bulk) {
      const lines = bulk.split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 0);

      const insertGroup = db.prepare(`
        INSERT INTO groups (
          identifier, title, user_id, account_phone, 
          rule_prefix, rule_hashtags, rule_suffix, custom_rules,
          template_mode, custom_content, schedule_mode, custom_time_slots, max_repeats_per_day
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(identifier, user_id) DO UPDATE SET
          user_id = COALESCE(groups.user_id, excluded.user_id),
          account_phone = COALESCE(excluded.account_phone, groups.account_phone),
          rule_hashtags = COALESCE(excluded.rule_hashtags, groups.rule_hashtags),
          custom_time_slots = COALESCE(excluded.custom_time_slots, groups.custom_time_slots)
      `);

      let added = 0;
      const parsedIdents = [];
      const insertMany = db.transaction(() => {
        for (const line of lines) {
          let ident = line.trim();
          if (ident.includes('t.me/')) {
            if (!ident.startsWith('http')) ident = 'https://' + ident;
            const parts = ident.split('t.me/')[1].split('/');
            if (parts.length === 1 && !parts[0].startsWith('+')) {
              ident = '@' + parts[0];
            }
          } else if (!ident.startsWith('@') && !ident.startsWith('-') && !ident.startsWith('+') && !ident.startsWith('http')) {
            ident = '@' + ident;
          }

          parsedIdents.push(ident);

          const result = insertGroup.run(
            ident, ident, userId, 
            defaultPhone, 
            rule_prefix || null, 
            rule_hashtags || null, 
            rule_suffix || null, 
            custom_rules || null,
            template_mode || 'global',
            custom_content || null,
            defaultScheduleMode,
            defaultSlots,
            parseInt(max_repeats_per_day) || 0
          );
          if (result.changes > 0) added++;
        }
      });

      insertMany();

      // Tự động đồng bộ Avatar & Tên nhóm Telegram trong background
      (async () => {
        try {
          const fetchDb = getDb();
          const updateStmt = fetchDb.prepare(`
            UPDATE groups 
            SET 
              title = CASE WHEN (title = identifier OR title IS NULL OR title = '') AND ? IS NOT NULL THEN ? ELSE title END,
              avatar_url = COALESCE(?, avatar_url),
              member_count = CASE WHEN ? > 0 THEN ? ELSE member_count END
            WHERE identifier = ?
          `);
          for (const ident of parsedIdents) {
            const meta = await fetchTelegramGroupMeta(ident);
            if (meta && (meta.avatarUrl || meta.title || meta.memberCount)) {
              updateStmt.run(meta.title, meta.title, meta.avatarUrl, meta.memberCount, meta.memberCount, ident);
            }
          }
        } catch (bgErr) {
          console.error('[Bulk Telegram Meta Fetch Error]', bgErr.message);
        }
      })();

      return res.json({ success: true, message: `Đã thêm/cập nhật ${added} nhóm. Đang tự động nạp avatar và tên nhóm...`, added });
    }

    if (!identifier) {
      return res.status(400).json({ success: false, error: 'Thiếu identifier' });
    }

    let ident = identifier.trim();
    if (ident.includes('t.me/')) {
      if (!ident.startsWith('http')) ident = 'https://' + ident;
      const parts = ident.split('t.me/')[1].split('/');
      if (parts.length === 1 && !parts[0].startsWith('+')) {
        ident = '@' + parts[0];
      }
    } else if (!ident.startsWith('@') && !ident.startsWith('-') && !ident.startsWith('+') && !ident.startsWith('http')) {
      ident = '@' + ident;
    }

    // Tự động lấy Avatar & Tên nhóm thực tế từ Telegram
    const meta = await fetchTelegramGroupMeta(ident);
    const initialTitle = (meta && meta.title) ? meta.title : ident;
    const initialAvatar = (meta && meta.avatarUrl) ? meta.avatarUrl : null;
    const initialMembers = (meta && meta.memberCount) ? meta.memberCount : 0;

    db.prepare(`
      INSERT INTO groups (
        identifier, title, user_id, account_phone, 
        rule_prefix, rule_hashtags, rule_suffix, custom_rules,
        template_mode, custom_content, schedule_mode, custom_time_slots, max_repeats_per_day,
        avatar_url, member_count
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(identifier, user_id) DO UPDATE SET
        user_id = COALESCE(groups.user_id, excluded.user_id),
        account_phone = COALESCE(excluded.account_phone, groups.account_phone),
        custom_time_slots = COALESCE(excluded.custom_time_slots, groups.custom_time_slots),
        avatar_url = COALESCE(excluded.avatar_url, groups.avatar_url),
        title = CASE WHEN groups.title = groups.identifier AND excluded.title != excluded.identifier THEN excluded.title ELSE groups.title END,
        member_count = CASE WHEN excluded.member_count > 0 THEN excluded.member_count ELSE groups.member_count END
    `).run(
      ident, initialTitle, userId,
      defaultPhone,
      rule_prefix || null,
      rule_hashtags || null,
      rule_suffix || null,
      custom_rules || null,
      template_mode || 'global',
      custom_content || null,
      defaultScheduleMode,
      defaultSlots,
      parseInt(max_repeats_per_day) || 0,
      initialAvatar,
      initialMembers
    );

    const group = db.prepare('SELECT * FROM groups WHERE identifier = ?').get(ident);
    res.json({ success: true, data: group });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/groups/sync-metadata - Quét đồng bộ tự động Avatar, Tên nhóm và Thành viên từ Telegram cho tất cả nhóm
router.post('/sync-metadata', async (req, res) => {
  try {
    const db = getDb();
    const { group_ids, force_all } = req.body || {};
    let query = 'SELECT id, identifier, title, avatar_url FROM groups';
    const params = [];

    if (Array.isArray(group_ids) && group_ids.length > 0) {
      query += ` WHERE id IN (${group_ids.map(() => '?').join(',')})`;
      params.push(...group_ids);
    } else if (!force_all) {
      // Mặc định đồng bộ những nhóm chưa có avatar hoặc tên còn là identifier
      query += ` WHERE avatar_url IS NULL OR title IS NULL OR title = identifier OR title = ''`;
    }

    if (req.user.role !== 'admin') {
      query += params.length > 0 ? ' AND (user_id = ? OR user_id IS NULL)' : ' WHERE (user_id = ? OR user_id IS NULL)';
      params.push(req.user.id);
    }

    const groupsToSync = db.prepare(query).all(...params);
    let updatedCount = 0;

    const updateStmt = db.prepare(`
      UPDATE groups 
      SET 
        title = CASE WHEN (title IS NULL OR title = identifier OR title = '') AND ? IS NOT NULL THEN ? ELSE title END,
        avatar_url = COALESCE(?, avatar_url),
        member_count = CASE WHEN ? > 0 THEN ? ELSE member_count END
      WHERE id = ?
    `);

    for (const g of groupsToSync) {
      const meta = await fetchTelegramGroupMeta(g.identifier);
      if (meta && (meta.avatarUrl || meta.title || meta.memberCount)) {
        updateStmt.run(
          meta.title, meta.title,
          meta.avatarUrl,
          meta.memberCount, meta.memberCount,
          g.id
        );
        updatedCount++;
      }
    }

    res.json({
      success: true,
      message: `Đã cập nhật Avatar & Tên Telegram cho ${updatedCount}/${groupsToSync.length} nhóm!`,
      updatedCount,
      totalChecked: groupsToSync.length
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/groups/:id/sync-metadata - Đồng bộ Avatar & Tên Telegram cho 1 nhóm cụ thể
router.post('/:id/sync-metadata', async (req, res) => {
  try {
    const db = getDb();
    const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(req.params.id);
    if (!group) {
      return res.status(404).json({ success: false, error: 'Nhóm không tồn tại' });
    }

    const meta = await fetchTelegramGroupMeta(group.identifier);
    if (!meta) {
      return res.status(400).json({ success: false, error: 'Không thể lấy thông tin Telegram công khai cho liên kết này' });
    }

    const newTitle = (group.title && group.title !== group.identifier) ? group.title : (meta.title || group.title);
    db.prepare(`
      UPDATE groups
      SET 
        title = ?,
        avatar_url = COALESCE(?, avatar_url),
        member_count = CASE WHEN ? > 0 THEN ? ELSE member_count END
      WHERE id = ?
    `).run(
      newTitle,
      meta.avatarUrl,
      meta.memberCount, meta.memberCount,
      group.id
    );

    const updated = db.prepare('SELECT * FROM groups WHERE id = ?').get(group.id);
    res.json({
      success: true,
      message: `Đã đồng bộ avatar và tên nhóm: "${meta.title || group.identifier}"!`,
      data: updated
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/groups/preview-rule - Xem trước nội dung tin nhắn hoàn chỉnh
router.post('/preview-rule', (req, res) => {
  try {
    const { 
      group_id,
      base_content, 
      rule_prefix, 
      rule_hashtags, 
      rule_suffix, 
      group_title, 
      group_identifier,
      template_mode,
      custom_content,
      template_id,
      template_ids
    } = req.body;

    const db = getDb();
    let contentToUse = base_content || '';
    let imagePath = null;
    let templateName = null;

    // 1. Nếu là chế độ kịch bản riêng
    if (template_mode === 'custom' && custom_content && custom_content.trim()) {
      contentToUse = custom_content;
      templateName = 'Kịch bản riêng của nhóm';
      if (req.body.custom_image_path) {
        imagePath = req.body.custom_image_path;
      } else if (group_id) {
        const grp = db.prepare('SELECT custom_image_path FROM groups WHERE id = ?').get(group_id);
        if (grp?.custom_image_path) imagePath = grp.custom_image_path;
      }
    } 
    // 2. Nếu truyền trực tiếp 1 template_id cụ thể
    else if (template_id) {
      const tpl = db.prepare('SELECT * FROM templates WHERE id = ?').get(template_id);
      if (tpl) {
        contentToUse = tpl.content;
        imagePath = tpl.image_path;
        templateName = tpl.name;
      }
    }
    // 3. Nếu truyền mảng template_ids (ví dụ người dùng đang tích chọn trong modal)
    else if (Array.isArray(template_ids) && template_ids.length > 0) {
      const placeholders = template_ids.map(() => '?').join(',');
      const tpls = db.prepare(`SELECT * FROM templates WHERE id IN (${placeholders}) AND is_active = 1`).all(...template_ids);
      if (tpls.length > 0) {
        const picked = tpls[Math.floor(Math.random() * tpls.length)];
        contentToUse = picked.content;
        imagePath = picked.image_path;
        templateName = picked.name;
      }
    }
    // 4. Nếu có group_id, lấy từ các kịch bản đã gán cho nhóm trong group_templates
    else if (group_id) {
      const assigned = db.prepare(`
        SELECT t.* FROM templates t
        INNER JOIN group_templates gt ON gt.template_id = t.id
        WHERE gt.group_id = ? AND t.is_active = 1
      `).all(group_id);
      if (assigned.length > 0) {
        const picked = assigned[Math.floor(Math.random() * assigned.length)];
        contentToUse = picked.content;
        imagePath = picked.image_path;
        templateName = picked.name;
      }
    }

    // 5. Nếu vẫn chưa có nội dung (chế độ kịch bản chung nhưng chưa gán bài cụ thể)
    if (!contentToUse && template_mode !== 'custom') {
      let userTpl = null;
      // Ưu tiên lấy kịch bản của chính người dùng hiện tại (tránh lấy nhầm kịch bản của admin)
      if (req.user.role !== 'admin') {
        userTpl = db.prepare('SELECT * FROM templates WHERE user_id = ? AND is_active = 1 ORDER BY id DESC LIMIT 1').get(req.user.id);
        if (!userTpl) {
          userTpl = db.prepare('SELECT * FROM templates WHERE (user_id = ? OR user_id IS NULL) AND is_active = 1 ORDER BY id DESC LIMIT 1').get(req.user.id);
        }
      } else {
        userTpl = db.prepare('SELECT * FROM templates WHERE is_active = 1 ORDER BY id DESC LIMIT 1').get();
      }

      if (userTpl) {
        contentToUse = userTpl.content;
        imagePath = userTpl.image_path;
        templateName = userTpl.name;
      } else {
        contentToUse = 'Chưa có kịch bản chung nào khả dụng. Vui lòng vào trang Kịch Bản để thêm bài viết!';
        templateName = 'Chưa có kịch bản';
      }
    }

    const dummyGroup = {
      title: group_title,
      identifier: group_identifier,
      rule_prefix,
      rule_hashtags,
      rule_suffix
    };

    const preview = composeGroupMessage(contentToUse, dummyGroup);
    res.json({ 
      success: true, 
      preview, 
      template_name: templateName, 
      image_path: imagePath 
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/groups/bulk-config - Cập nhật cấu hình hàng loạt cho nhiều nhóm
router.put('/bulk-config', (req, res) => {
  try {
    const { 
      ids, 
      rule_prefix, 
      rule_hashtags, 
      rule_suffix, 
      account_phone,
      template_mode,
      template_ids,
      assign_all_templates,
      schedule_mode,
      custom_time_slots,
      max_repeats_per_day,
      cluster_id
    } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: 'Vui lòng chọn ít nhất 1 nhóm' });
    }

    const db = getDb();
    const updateMany = db.transaction(() => {
      const deleteGT = db.prepare('DELETE FROM group_templates WHERE group_id = ?');
      const insertGT = db.prepare('INSERT INTO group_templates (group_id, template_id) VALUES (?, ?)');

      for (const id of ids) {
        const grp = db.prepare('SELECT user_id FROM groups WHERE id = ?').get(id);
        if (!grp) continue;
        if (req.user.role !== 'admin' && grp.user_id && grp.user_id !== req.user.id) continue;

        db.prepare(`
          UPDATE groups 
          SET 
            rule_prefix = CASE WHEN ? IS NOT NULL THEN ? ELSE rule_prefix END,
            rule_hashtags = CASE WHEN ? IS NOT NULL THEN ? ELSE rule_hashtags END,
            rule_suffix = CASE WHEN ? IS NOT NULL THEN ? ELSE rule_suffix END,
            account_phone = CASE WHEN ? IS NOT NULL THEN ? ELSE account_phone END,
            template_mode = CASE WHEN ? IS NOT NULL THEN ? ELSE template_mode END,
            schedule_mode = CASE WHEN ? IS NOT NULL THEN ? ELSE schedule_mode END,
            custom_time_slots = CASE WHEN ? IS NOT NULL THEN ? ELSE custom_time_slots END,
            max_repeats_per_day = CASE WHEN ? IS NOT NULL THEN ? ELSE max_repeats_per_day END,
            cluster_id = CASE WHEN ? IS NOT NULL THEN ? ELSE cluster_id END
          WHERE id = ?
        `).run(
          rule_prefix !== undefined ? rule_prefix : null, rule_prefix ?? null,
          rule_hashtags !== undefined ? rule_hashtags : null, rule_hashtags ?? null,
          rule_suffix !== undefined ? rule_suffix : null, rule_suffix ?? null,
          account_phone !== undefined ? account_phone : null, account_phone ?? null,
          template_mode !== undefined ? template_mode : null, template_mode ?? null,
          schedule_mode !== undefined ? schedule_mode : null, schedule_mode ?? null,
          custom_time_slots !== undefined ? custom_time_slots : null, custom_time_slots ?? null,
          max_repeats_per_day !== undefined ? max_repeats_per_day : null, max_repeats_per_day ?? null,
          cluster_id !== undefined ? (cluster_id === 'none' ? null : cluster_id) : null,
          cluster_id !== undefined ? (cluster_id === 'none' ? null : cluster_id) : null,
          id
        );

        // Xử lý gán kịch bản chung cho nhóm
        if (Array.isArray(template_ids)) {
          deleteGT.run(id);
          for (const tid of template_ids) {
            insertGT.run(id, tid);
          }
        } else if (assign_all_templates === true) {
          deleteGT.run(id);
        }
      }
    });

    updateMany();
    res.json({ success: true, message: `Đã cập nhật cấu hình cho ${ids.length} nhóm thành công` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/groups/:id/send-now - Phát tin thử nghiệm ngay lập tức cho 1 nhóm
router.post('/:id/send-now', async (req, res) => {
  try {
    const db = getDb();
    const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(req.params.id);
    if (!group) {
      return res.status(404).json({ success: false, error: 'Nhóm không tồn tại' });
    }

    // Chạy bất đồng bộ dispatch cho nhóm cụ thể này với cờ isManual = true
    dispatch(group.id, true).then(result => {
      console.log(`Đã phát tin ngay đến nhóm ${group.identifier}:`, result);
    }).catch(err => {
      console.error(`Lỗi khi phát tin ngay đến nhóm ${group.identifier}:`, err);
    });

    res.json({ success: true, message: `Đã bắt đầu gửi tin đến ${group.title || group.identifier}. Vui lòng kiểm tra trang Logs.` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/groups/:id/image - Upload ảnh riêng cho nhóm
router.post('/:id/image', (req, res) => {
  try {
    const db = getDb();
    const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(req.params.id);
    if (!group) {
      return res.status(404).json({ success: false, error: 'Nhóm không tồn tại' });
    }

    if (!req.files || !req.files.image) {
      return res.status(400).json({ success: false, error: 'Chưa đính kèm file ảnh' });
    }

    const file = req.files.image;
    const ext = path.extname(file.name) || '.jpg';
    const filename = `group_${group.id}_${Date.now()}${ext}`;
    const savePath = path.join(path.resolve(UPLOADS_DIR), filename);

    file.mv(savePath, (err) => {
      if (err) return res.status(500).json({ success: false, error: err.message });

      db.prepare('UPDATE groups SET custom_image_path = ? WHERE id = ?').run(filename, group.id);
      res.json({ success: true, custom_image_path: filename });
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/groups/:id/image - Xóa ảnh riêng của nhóm
router.delete('/:id/image', (req, res) => {
  try {
    const db = getDb();
    const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(req.params.id);
    if (!group) {
      return res.status(404).json({ success: false, error: 'Nhóm không tồn tại' });
    }

    if (group.custom_image_path) {
      const fullPath = path.resolve(UPLOADS_DIR, group.custom_image_path);
      if (fs.existsSync(fullPath)) {
        try { fs.unlinkSync(fullPath); } catch (_) {}
      }
      db.prepare('UPDATE groups SET custom_image_path = NULL WHERE id = ?').run(group.id);
    }

    res.json({ success: true, message: 'Đã xóa ảnh riêng của nhóm' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/groups/:id - Cập nhật toàn diện nhóm
router.put('/:id', (req, res) => {
  try {
    const db = getDb();
    const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(req.params.id);
    if (!group) {
      return res.status(404).json({ success: false, error: 'Nhóm không tồn tại' });
    }

    if (req.user.role !== 'admin' && group.user_id && group.user_id !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Bạn không có quyền chỉnh sửa nhóm này' });
    }

    const { 
      title, 
      is_active, 
      account_phone, 
      rule_prefix, 
      rule_hashtags, 
      rule_suffix, 
      custom_rules,
      template_mode,
      custom_content,
      custom_image_path,
      schedule_mode,
      custom_time_slots,
      max_repeats_per_day,
      sent_today_count,
      cluster_id
    } = req.body;

    let finalSlots = group.custom_time_slots;
    if (custom_time_slots !== undefined) {
      finalSlots = typeof custom_time_slots === 'string' ? custom_time_slots : JSON.stringify(custom_time_slots);
    }

    db.prepare(`
      UPDATE groups 
      SET 
        title = ?, 
        is_active = ?, 
        account_phone = ?,
        rule_prefix = ?,
        rule_hashtags = ?,
        rule_suffix = ?,
        custom_rules = ?,
        template_mode = ?,
        custom_content = ?,
        custom_image_path = ?,
        schedule_mode = ?,
        custom_time_slots = ?,
        max_repeats_per_day = ?,
        sent_today_count = ?,
        cluster_id = ?,
        avatar_url = ?
      WHERE id = ?
    `).run(
      title !== undefined ? title : group.title,
      is_active !== undefined ? is_active : group.is_active,
      account_phone !== undefined ? account_phone : group.account_phone,
      rule_prefix !== undefined ? rule_prefix : group.rule_prefix,
      rule_hashtags !== undefined ? rule_hashtags : group.rule_hashtags,
      rule_suffix !== undefined ? rule_suffix : group.rule_suffix,
      custom_rules !== undefined ? custom_rules : group.custom_rules,
      template_mode !== undefined ? template_mode : group.template_mode,
      custom_content !== undefined ? custom_content : group.custom_content,
      custom_image_path !== undefined ? custom_image_path : group.custom_image_path,
      schedule_mode !== undefined ? schedule_mode : group.schedule_mode,
      finalSlots,
      max_repeats_per_day !== undefined ? parseInt(max_repeats_per_day) : group.max_repeats_per_day,
      sent_today_count !== undefined ? parseInt(sent_today_count) : group.sent_today_count,
      cluster_id !== undefined ? (cluster_id ? parseInt(cluster_id) : null) : group.cluster_id,
      req.body.avatar_url !== undefined ? req.body.avatar_url : group.avatar_url,
      req.params.id
    );

    // Cập nhật group_templates nếu được gửi kèm
    if (Array.isArray(req.body.template_ids)) {
      db.prepare('DELETE FROM group_templates WHERE group_id = ?').run(req.params.id);
      const insert = db.prepare('INSERT INTO group_templates (group_id, template_id) VALUES (?, ?)');
      for (const tid of req.body.template_ids) {
        insert.run(req.params.id, tid);
      }
    }

    const updated = db.prepare('SELECT * FROM groups WHERE id = ?').get(req.params.id);
    res.json({ success: true, data: updated, message: 'Cập nhật nhóm thành công' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/groups/bulk-toggle - Bật hoặc Tắt hàng loạt nhóm đã chọn
router.patch('/bulk-toggle', (req, res) => {
  try {
    const { ids, is_active } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: 'Cần truyền danh sách ID các nhóm cần thay đổi trạng thái' });
    }

    const targetStatus = is_active ? 1 : 0;
    const db = getDb();
    const isAdmin = req.user.role === 'admin';
    const userId = req.user.id;

    const placeholders = ids.map(() => '?').join(',');
    let stmt;
    if (isAdmin) {
      stmt = db.prepare(`UPDATE groups SET is_active = ? WHERE id IN (${placeholders})`);
      stmt.run(targetStatus, ...ids);
    } else {
      stmt = db.prepare(`UPDATE groups SET is_active = ? WHERE id IN (${placeholders}) AND (user_id = ? OR user_id IS NULL)`);
      stmt.run(targetStatus, ...ids, userId);
    }

    res.json({
      success: true,
      message: `Đã ${targetStatus === 1 ? 'BẬT' : 'TẮT'} thành công ${ids.length} nhóm!`,
      updatedCount: ids.length,
      is_active: targetStatus
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/groups/:id/toggle - Bật/Tắt nhóm
router.patch('/:id/toggle', (req, res) => {
  try {
    const db = getDb();
    const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(req.params.id);
    if (!group) {
      return res.status(404).json({ success: false, error: 'Nhóm không tồn tại' });
    }

    if (req.user.role !== 'admin' && group.user_id && group.user_id !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Bạn không có quyền thay đổi trạng thái nhóm này' });
    }

    const newStatus = group.is_active ? 0 : 1;
    db.prepare('UPDATE groups SET is_active = ? WHERE id = ?').run(newStatus, req.params.id);

    res.json({ success: true, data: { ...group, is_active: newStatus } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/groups/:id - Xóa nhóm
router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(req.params.id);
    if (!group) {
      return res.status(404).json({ success: false, error: 'Nhóm không tồn tại' });
    }

    if (req.user.role !== 'admin' && group.user_id && group.user_id !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Bạn không có quyền xóa nhóm này' });
    }

    db.prepare('DELETE FROM groups WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: 'Đã xóa nhóm' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/groups - Xóa nhiều nhóm
router.delete('/', (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({ success: false, error: 'Cần truyền mảng ids' });
    }
    const db = getDb();
    const deleteMany = db.transaction(() => {
      for (const id of ids) {
        const group = db.prepare('SELECT user_id FROM groups WHERE id = ?').get(id);
        if (group && (req.user.role === 'admin' || !group.user_id || group.user_id === req.user.id)) {
          db.prepare('DELETE FROM groups WHERE id = ?').run(id);
        }
      }
    });
    deleteMany();
    res.json({ success: true, message: `Đã xóa ${ids.length} nhóm` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/groups/:id/templates - Lấy danh sách template được gán cho nhóm
router.get('/:id/templates', (req, res) => {
  try {
    const db = getDb();
    const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(req.params.id);
    if (!group) {
      return res.status(404).json({ success: false, error: 'Nhóm không tồn tại' });
    }
    const assigned = db.prepare(`
      SELECT t.* FROM templates t
      INNER JOIN group_templates gt ON gt.template_id = t.id
      WHERE gt.group_id = ?
      ORDER BY t.name
    `).all(req.params.id);
    res.json({ success: true, data: assigned });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/groups/:id/templates - Cập nhật danh sách template chung được gán cho nhóm
router.put('/:id/templates', (req, res) => {
  try {
    const db = getDb();
    const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(req.params.id);
    if (!group) {
      return res.status(404).json({ success: false, error: 'Nhóm không tồn tại' });
    }
    const { template_ids } = req.body;
    if (!Array.isArray(template_ids)) {
      return res.status(400).json({ success: false, error: 'template_ids phải là mảng' });
    }
    const update = db.transaction(() => {
      db.prepare('DELETE FROM group_templates WHERE group_id = ?').run(req.params.id);
      const insert = db.prepare('INSERT INTO group_templates (group_id, template_id) VALUES (?, ?)');
      for (const tid of template_ids) {
        insert.run(req.params.id, tid);
      }
    });
    update();
    res.json({ success: true, message: `Đã gán ${template_ids.length} kịch bản chung cho nhóm` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/groups/export - Xuất toàn bộ danh sách nhóm & cấu hình ra JSON
router.get('/export', (req, res) => {
  try {
    const db = getDb();
    let query = `
      SELECT 
        identifier, title, rule_prefix, rule_hashtags, rule_suffix,
        template_mode, custom_content, custom_image_path,
        schedule_mode, custom_time_slots, max_repeats_per_day,
        account_phone, is_active
      FROM groups
    `;
    const params = [];

    if (req.user.role !== 'admin') {
      query += ' WHERE (user_id = ? OR user_id IS NULL)';
      params.push(req.user.id);
    }

    query += ' ORDER BY id ASC';
    const groups = db.prepare(query).all(...params);

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=groups_${Date.now()}.json`);
    res.json({
      version: '1.0',
      exported_at: new Date().toISOString(),
      total: groups.length,
      groups
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/groups/import-json - Nhập nhóm & cấu hình từ file JSON hoặc mảng JSON
router.post('/import-json', (req, res) => {
  try {
    const db = getDb();
    let items = [];

    if (req.files && req.files.file) {
      const fileContent = req.files.file.data.toString('utf-8');
      const parsed = JSON.parse(fileContent);
      items = Array.isArray(parsed) ? parsed : (parsed.groups || []);
    } else if (req.body.groups && Array.isArray(req.body.groups)) {
      items = req.body.groups;
    } else if (req.body.json_data) {
      const parsed = JSON.parse(req.body.json_data);
      items = Array.isArray(parsed) ? parsed : (parsed.groups || []);
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'Dữ liệu nhóm trống hoặc không đúng định dạng JSON' });
    }

    const insertGroup = db.prepare(`
      INSERT INTO groups (
        identifier, title, user_id, account_phone,
        rule_prefix, rule_hashtags, rule_suffix,
        template_mode, custom_content, custom_image_path,
        schedule_mode, custom_time_slots, max_repeats_per_day, is_active
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(identifier, user_id) DO UPDATE SET
        title = COALESCE(excluded.title, groups.title),
        rule_prefix = COALESCE(excluded.rule_prefix, groups.rule_prefix),
        rule_hashtags = COALESCE(excluded.rule_hashtags, groups.rule_hashtags),
        rule_suffix = COALESCE(excluded.rule_suffix, groups.rule_suffix),
        template_mode = COALESCE(excluded.template_mode, groups.template_mode),
        custom_content = COALESCE(excluded.custom_content, groups.custom_content),
        custom_image_path = COALESCE(excluded.custom_image_path, groups.custom_image_path),
        schedule_mode = COALESCE(excluded.schedule_mode, groups.schedule_mode),
        custom_time_slots = COALESCE(excluded.custom_time_slots, groups.custom_time_slots),
        max_repeats_per_day = COALESCE(excluded.max_repeats_per_day, groups.max_repeats_per_day),
        account_phone = COALESCE(excluded.account_phone, groups.account_phone),
        is_active = COALESCE(excluded.is_active, groups.is_active)
    `);

    let imported = 0;
    const insertMany = db.transaction(() => {
      for (const item of items) {
        if (!item.identifier) continue;
        let ident = String(item.identifier).trim();
        if (ident.includes('t.me/')) {
          if (!ident.startsWith('http')) ident = 'https://' + ident;
          const parts = ident.split('t.me/')[1].split('/');
          if (parts.length === 1 && !parts[0].startsWith('+')) {
            ident = '@' + parts[0];
          }
        } else if (!ident.startsWith('@') && !ident.startsWith('-') && !ident.startsWith('+') && !ident.startsWith('http')) {
          ident = '@' + ident;
        }

        const title = item.title ? String(item.title).trim() : ident;
        const slots = typeof item.custom_time_slots === 'string'
          ? item.custom_time_slots
          : JSON.stringify(item.custom_time_slots || ['09:00', '14:00', '20:00']);

        insertGroup.run(
          ident,
          title,
          req.user.id,
          item.account_phone || null,
          item.rule_prefix || null,
          item.rule_hashtags || null,
          item.rule_suffix || null,
          item.template_mode || 'global',
          item.custom_content || null,
          item.custom_image_path || null,
          item.schedule_mode || 'global',
          slots,
          parseInt(item.max_repeats_per_day) || 0,
          item.is_active !== undefined ? (item.is_active ? 1 : 0) : 1
        );
        imported++;
      }
    });

    insertMany();
    res.json({ success: true, message: `Đã nhập và đồng bộ thành công ${imported} nhóm`, imported });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Lỗi xử lý file import nhóm: ' + err.message });
  }
});

module.exports = router;
