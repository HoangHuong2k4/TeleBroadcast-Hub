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
        (SELECT COUNT(*) FROM groups g WHERE g.user_id = u.id) as groups_count,
        (SELECT COUNT(*) FROM clusters c WHERE c.user_id = u.id) as clusters_count,
        (SELECT COUNT(*) FROM templates t WHERE t.user_id = u.id) as templates_count
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

// POST /api/users/sync - Đồng bộ dữ liệu giữa các tài khoản người dùng
router.post('/sync', (req, res) => {
  try {
    const db = getDb();
    const {
      source_user_id,
      target_user_id,
      sync_templates = true,
      sync_clusters = true,
      sync_groups = true,
      mode = 'merge' // 'merge' hoặc 'overwrite'
    } = req.body;

    const sourceId = parseInt(source_user_id);
    const targetId = parseInt(target_user_id);

    if (!sourceId || !targetId) {
      return res.status(400).json({ success: false, error: 'Vui lòng chọn tài khoản nguồn và tài khoản đích' });
    }

    if (sourceId === targetId) {
      return res.status(400).json({ success: false, error: 'Tài khoản nguồn và tài khoản đích không được trùng nhau' });
    }

    const sourceUser = db.prepare('SELECT id, username, display_name FROM users WHERE id = ?').get(sourceId);
    const targetUser = db.prepare('SELECT id, username, display_name FROM users WHERE id = ?').get(targetId);

    if (!sourceUser || !targetUser) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy tài khoản nguồn hoặc tài khoản đích' });
    }

    // Lấy thông tin tài khoản Telegram của target user
    const targetAcc = db.prepare(`
      SELECT phone, time_slots FROM accounts 
      WHERE user_id = ? 
      ORDER BY CASE WHEN status = 'connected' THEN 0 ELSE 1 END, id ASC 
      LIMIT 1
    `).get(targetId);

    const targetPhone = targetAcc ? targetAcc.phone : null;

    // Khung giờ mặc định của target user (TUYỆT ĐỐI KHÔNG lấy khung giờ của source user theo yêu cầu)
    let targetDefaultScheduleMode = 'global';
    let targetDefaultTimeSlots = '[]';
    if (targetAcc && targetAcc.time_slots && targetAcc.time_slots !== '[]') {
      try {
        const parsed = JSON.parse(targetAcc.time_slots);
        if (Array.isArray(parsed) && parsed.length > 0) {
          targetDefaultScheduleMode = 'custom';
          targetDefaultTimeSlots = targetAcc.time_slots;
        }
      } catch (_) {}
    }

    let templatesAdded = 0;
    let templatesUpdated = 0;
    let clustersAdded = 0;
    let clustersUpdated = 0;
    let groupsAdded = 0;
    let groupsUpdated = 0;
    let groupTemplatesAssigned = 0;

    const runSyncTransaction = db.transaction(() => {
      // 1. Chế độ Ghi đè toàn bộ (overwrite): Xóa sạch các mục cũ tương ứng của target (nhưng giữ nguyên lịch gửi và accounts)
      if (mode === 'overwrite') {
        const oldTargetGroupIds = db.prepare('SELECT id FROM groups WHERE user_id = ?').all(targetId).map(g => g.id);
        if (oldTargetGroupIds.length > 0) {
          const deleteGtStmt = db.prepare('DELETE FROM group_templates WHERE group_id = ?');
          for (const gid of oldTargetGroupIds) {
            deleteGtStmt.run(gid);
          }
        }
        if (sync_groups) {
          db.prepare('DELETE FROM groups WHERE user_id = ?').run(targetId);
        }
        if (sync_clusters) {
          db.prepare('DELETE FROM clusters WHERE user_id = ?').run(targetId);
        }
        if (sync_templates) {
          db.prepare('DELETE FROM templates WHERE user_id = ?').run(targetId);
        }
      }

      const templateMap = {}; // source_tpl_id -> target_tpl_id
      const clusterMap = {};  // source_cls_id -> target_cls_id
      const groupMap = {};    // source_grp_id -> target_grp_id

      // 2. Đồng bộ Templates (Kịch bản / Nội dung)
      if (sync_templates) {
        const sourceTemplates = db.prepare('SELECT * FROM templates WHERE user_id = ?').all(sourceId);
        const insertTplStmt = db.prepare(`
          INSERT INTO templates (user_id, name, content, image_path, is_active)
          VALUES (?, ?, ?, ?, ?)
        `);
        const updateTplStmt = db.prepare(`
          UPDATE templates 
          SET content = ?, image_path = COALESCE(?, image_path), is_active = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `);
        const findTplStmt = db.prepare('SELECT id FROM templates WHERE user_id = ? AND name = ?');

        for (const st of sourceTemplates) {
          if (mode === 'merge') {
            const existing = findTplStmt.get(targetId, st.name);
            if (existing) {
              updateTplStmt.run(st.content, st.image_path, st.is_active, existing.id);
              templateMap[st.id] = existing.id;
              templatesUpdated++;
            } else {
              const res = insertTplStmt.run(targetId, st.name, st.content, st.image_path, st.is_active);
              templateMap[st.id] = res.lastInsertRowid;
              templatesAdded++;
            }
          } else {
            const res = insertTplStmt.run(targetId, st.name, st.content, st.image_path, st.is_active);
            templateMap[st.id] = res.lastInsertRowid;
            templatesAdded++;
          }
        }
      } else {
        // Map các template sẵn có giữa 2 bên theo tên để liên kết cụm/nhóm
        const sourceTemplates = db.prepare('SELECT id, name FROM templates WHERE user_id = ?').all(sourceId);
        const findTplStmt = db.prepare('SELECT id FROM templates WHERE user_id = ? AND name = ?');
        for (const st of sourceTemplates) {
          const existing = findTplStmt.get(targetId, st.name);
          if (existing) templateMap[st.id] = existing.id;
        }
      }

      // 3. Đồng bộ Clusters (Cụm Chợ)
      if (sync_clusters) {
        const sourceClusters = db.prepare('SELECT * FROM clusters WHERE user_id = ?').all(sourceId);
        const insertClusterStmt = db.prepare(`
          INSERT INTO clusters (user_id, name, description, color, default_template_id, rule_prefix, rule_hashtags, rule_suffix)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const updateClusterStmt = db.prepare(`
          UPDATE clusters
          SET description = ?, color = ?, default_template_id = COALESCE(?, default_template_id),
              rule_prefix = ?, rule_hashtags = ?, rule_suffix = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `);
        const findClusterStmt = db.prepare('SELECT id, default_template_id FROM clusters WHERE user_id = ? AND name = ?');

        for (const sc of sourceClusters) {
          const mappedTplId = sc.default_template_id ? (templateMap[sc.default_template_id] || null) : null;
          if (mode === 'merge') {
            const existing = findClusterStmt.get(targetId, sc.name);
            if (existing) {
              updateClusterStmt.run(
                sc.description,
                sc.color,
                mappedTplId || existing.default_template_id,
                sc.rule_prefix,
                sc.rule_hashtags,
                sc.rule_suffix,
                existing.id
              );
              clusterMap[sc.id] = existing.id;
              clustersUpdated++;
            } else {
              const res = insertClusterStmt.run(
                targetId,
                sc.name,
                sc.description,
                sc.color,
                mappedTplId,
                sc.rule_prefix,
                sc.rule_hashtags,
                sc.rule_suffix
              );
              clusterMap[sc.id] = res.lastInsertRowid;
              clustersAdded++;
            }
          } else {
            const res = insertClusterStmt.run(
              targetId,
              sc.name,
              sc.description,
              sc.color,
              mappedTplId,
              sc.rule_prefix,
              sc.rule_hashtags,
              sc.rule_suffix
            );
            clusterMap[sc.id] = res.lastInsertRowid;
            clustersAdded++;
          }
        }
      } else {
        const sourceClusters = db.prepare('SELECT id, name FROM clusters WHERE user_id = ?').all(sourceId);
        const findClusterStmt = db.prepare('SELECT id FROM clusters WHERE user_id = ? AND name = ?');
        for (const sc of sourceClusters) {
          const existing = findClusterStmt.get(targetId, sc.name);
          if (existing) clusterMap[sc.id] = existing.id;
        }
      }

      // 4. Đồng bộ Groups (Danh sách nhóm/chợ)
      if (sync_groups) {
        const sourceGroups = db.prepare('SELECT * FROM groups WHERE user_id = ?').all(sourceId);
        const insertGroupStmt = db.prepare(`
          INSERT INTO groups (
            identifier, title, user_id, account_phone, cluster_id,
            rule_prefix, rule_hashtags, rule_suffix, custom_rules,
            template_mode, custom_content, custom_image_path,
            schedule_mode, custom_time_slots,
            max_repeats_per_day, avatar_url, member_count, is_active
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const updateGroupStmt = db.prepare(`
          UPDATE groups SET
            title = ?,
            cluster_id = ?,
            rule_prefix = ?,
            rule_hashtags = ?,
            rule_suffix = ?,
            custom_rules = ?,
            template_mode = ?,
            custom_content = ?,
            custom_image_path = ?,
            max_repeats_per_day = ?,
            member_count = CASE WHEN ? > 0 THEN ? ELSE member_count END,
            avatar_url = COALESCE(?, avatar_url),
            is_active = ?,
            account_phone = COALESCE(groups.account_phone, ?)
          WHERE id = ?
        `);
        const findGroupStmt = db.prepare('SELECT id, schedule_mode, custom_time_slots, account_phone FROM groups WHERE user_id = ? AND identifier = ?');

        for (const sg of sourceGroups) {
          const mappedClusterId = sg.cluster_id ? (clusterMap[sg.cluster_id] || null) : null;

          if (mode === 'merge') {
            const existing = findGroupStmt.get(targetId, sg.identifier);
            if (existing) {
              // Cập nhật thông tin nội dung, rules, cụm chợ.
              // TUYỆT ĐỐI KHÔNG cập nhật schedule_mode và custom_time_slots
              updateGroupStmt.run(
                sg.title,
                mappedClusterId,
                sg.rule_prefix,
                sg.rule_hashtags,
                sg.rule_suffix,
                sg.custom_rules,
                sg.template_mode,
                sg.custom_content,
                sg.custom_image_path,
                sg.max_repeats_per_day || 0,
                sg.member_count || 0,
                sg.member_count || 0,
                sg.avatar_url || null,
                sg.is_active,
                targetPhone,
                existing.id
              );
              groupMap[sg.id] = existing.id;
              groupsUpdated++;
            } else {
              // Tạo mới cho target user với khung giờ riêng của target
              const res = insertGroupStmt.run(
                sg.identifier,
                sg.title,
                targetId,
                targetPhone,
                mappedClusterId,
                sg.rule_prefix,
                sg.rule_hashtags,
                sg.rule_suffix,
                sg.custom_rules,
                sg.template_mode,
                sg.custom_content,
                sg.custom_image_path,
                targetDefaultScheduleMode,
                targetDefaultTimeSlots,
                sg.max_repeats_per_day || 0,
                sg.avatar_url || null,
                sg.member_count || 0,
                sg.is_active
              );
              groupMap[sg.id] = res.lastInsertRowid;
              groupsAdded++;
            }
          } else {
            // mode === 'overwrite'
            const res = insertGroupStmt.run(
              sg.identifier,
              sg.title,
              targetId,
              targetPhone,
              mappedClusterId,
              sg.rule_prefix,
              sg.rule_hashtags,
              sg.rule_suffix,
              sg.custom_rules,
              sg.template_mode,
              sg.custom_content,
              sg.custom_image_path,
              targetDefaultScheduleMode,
              targetDefaultTimeSlots,
              sg.max_repeats_per_day || 0,
              sg.avatar_url || null,
              sg.member_count || 0,
              sg.is_active
            );
            groupMap[sg.id] = res.lastInsertRowid;
            groupsAdded++;
          }
        }
      }

      // 5. Đồng bộ quan hệ Group - Template (group_templates)
      if (sync_groups && Object.keys(templateMap).length > 0) {
        const getSourceGtStmt = db.prepare('SELECT template_id FROM group_templates WHERE group_id = ?');
        const insertGtStmt = db.prepare('INSERT OR IGNORE INTO group_templates (group_id, template_id) VALUES (?, ?)');
        const deleteGtForGroupStmt = db.prepare('DELETE FROM group_templates WHERE group_id = ?');

        for (const [sourceGid, targetGid] of Object.entries(groupMap)) {
          const sourceTemplates = getSourceGtStmt.all(sourceGid);
          if (sourceTemplates.length > 0) {
            if (mode === 'overwrite') {
              deleteGtForGroupStmt.run(targetGid);
            }
            for (const item of sourceTemplates) {
              const mappedTplId = templateMap[item.template_id];
              if (mappedTplId) {
                insertGtStmt.run(targetGid, mappedTplId);
                groupTemplatesAssigned++;
              }
            }
          }
        }
      }
    });

    runSyncTransaction();

    res.json({
      success: true,
      message: `Đồng bộ dữ liệu từ [${sourceUser.display_name || sourceUser.username}] sang [${targetUser.display_name || targetUser.username}] thành công!`,
      data: {
        source_user: sourceUser.display_name || sourceUser.username,
        target_user: targetUser.display_name || targetUser.username,
        mode,
        templates: { added: templatesAdded, updated: templatesUpdated },
        clusters: { added: clustersAdded, updated: clustersUpdated },
        groups: { added: groupsAdded, updated: groupsUpdated },
        group_templates_assigned: groupTemplatesAssigned
      }
    });
  } catch (err) {
    console.error('Lỗi khi đồng bộ tài khoản:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
