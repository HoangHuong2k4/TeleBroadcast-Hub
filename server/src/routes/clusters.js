const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');
const { authMiddleware } = require('../middleware/auth');
const { dispatch, getDispatchStatus } = require('../services/scheduler');

router.use(authMiddleware);

// GET /api/clusters - Danh sách Cụm Chợ
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const isAdmin = req.user.role === 'admin';
    const userId = req.user.id;

    let query = `
      SELECT 
        c.*, 
        COUNT(g.id) as member_groups_count,
        u.username as owner_username,
        u.display_name as owner_name
      FROM clusters c
      LEFT JOIN "groups" g ON g.cluster_id = c.id
      LEFT JOIN users u ON u.id = c.user_id
    `;
    const params = [];

    if (!isAdmin) {
      query += ' WHERE c.user_id = ?';
      params.push(userId);
    }

    query += ' GROUP BY c.id ORDER BY c.created_at DESC';

    const clusters = db.prepare(query).all(...params);

    // Lấy kèm danh sách ID các chợ thành viên cho từng cụm
    const getGroupIdsStmt = db.prepare('SELECT id, title, identifier, is_active, avatar_url, member_count FROM "groups" WHERE cluster_id = ?');
    const enriched = clusters.map(c => ({
      ...c,
      member_groups: getGroupIdsStmt.all(c.id)
    }));

    res.json({ success: true, data: enriched });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/clusters/:id - Chi tiết 1 Cụm Chợ
router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const cluster = db.prepare('SELECT * FROM clusters WHERE id = ?').get(req.params.id);
    if (!cluster) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy Cụm Chợ' });
    }

    if (req.user.role !== 'admin' && cluster.user_id !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Bạn không có quyền xem cụm chợ này' });
    }

    const memberGroups = db.prepare('SELECT * FROM "groups" WHERE cluster_id = ?').all(cluster.id);

    res.json({
      success: true,
      data: {
        ...cluster,
        member_groups: memberGroups
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/clusters - Tạo Cụm Chợ mới
router.post('/', (req, res) => {
  try {
    const {
      name,
      description,
      color,
      default_template_id,
      rule_prefix,
      rule_hashtags,
      rule_suffix,
      group_ids
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Vui lòng nhập tên Cụm Chợ' });
    }

    const db = getDb();
    const userId = (req.user.role === 'admin' && req.body.user_id) ? parseInt(req.body.user_id) : req.user.id;

    const insertStmt = db.prepare(`
      INSERT INTO clusters (
        user_id, name, description, color, default_template_id,
        rule_prefix, rule_hashtags, rule_suffix
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = insertStmt.run(
      userId,
      name.trim(),
      description ? description.trim() : null,
      color || 'blue',
      default_template_id || null,
      rule_prefix || null,
      rule_hashtags || null,
      rule_suffix || null
    );

    const clusterId = result.lastInsertRowid;

    // Gán các chợ vào Cụm nếu có
    if (Array.isArray(group_ids) && group_ids.length > 0) {
      const placeholders = group_ids.map(() => '?').join(',');
      db.prepare(`
        UPDATE "groups" 
        SET cluster_id = ? 
        WHERE id IN (${placeholders}) AND (user_id = ? OR ? = 'admin')
      `).run(clusterId, ...group_ids, userId, req.user.role);
    }

    const created = db.prepare('SELECT * FROM clusters WHERE id = ?').get(clusterId);
    res.json({ success: true, data: created, message: 'Đã tạo Cụm Chợ thành công' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/clusters/:id - Cập nhật Cụm Chợ
router.put('/:id', (req, res) => {
  try {
    const db = getDb();
    const cluster = db.prepare('SELECT * FROM clusters WHERE id = ?').get(req.params.id);
    if (!cluster) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy Cụm Chợ' });
    }

    if (req.user.role !== 'admin' && cluster.user_id !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Không có quyền chỉnh sửa cụm chợ này' });
    }

    const {
      name,
      description,
      color,
      default_template_id,
      rule_prefix,
      rule_hashtags,
      rule_suffix,
      group_ids
    } = req.body;

    db.prepare(`
      UPDATE clusters 
      SET 
        name = ?,
        description = ?,
        color = ?,
        default_template_id = ?,
        rule_prefix = ?,
        rule_hashtags = ?,
        rule_suffix = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      name ? name.trim() : cluster.name,
      description !== undefined ? description : cluster.description,
      color || cluster.color,
      default_template_id !== undefined ? default_template_id : cluster.default_template_id,
      rule_prefix !== undefined ? rule_prefix : cluster.rule_prefix,
      rule_hashtags !== undefined ? rule_hashtags : cluster.rule_hashtags,
      rule_suffix !== undefined ? rule_suffix : cluster.rule_suffix,
      cluster.id
    );

    // Đồng bộ danh sách chợ thành viên
    if (Array.isArray(group_ids)) {
      // Gỡ toàn bộ chợ thuộc cụm này ra trước
      db.prepare('UPDATE "groups" SET cluster_id = NULL WHERE cluster_id = ?').run(cluster.id);

      // Gán các chợ mới chọn vào cụm
      if (group_ids.length > 0) {
        const placeholders = group_ids.map(() => '?').join(',');
        db.prepare(`
          UPDATE "groups" 
          SET cluster_id = ? 
          WHERE id IN (${placeholders})
        `).run(cluster.id, ...group_ids);
      }
    }

    const updated = db.prepare('SELECT * FROM clusters WHERE id = ?').get(cluster.id);
    res.json({ success: true, data: updated, message: 'Đã cập nhật Cụm Chợ thành công' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/clusters/:id - Xóa Cụm Chợ
router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    const cluster = db.prepare('SELECT * FROM clusters WHERE id = ?').get(req.params.id);
    if (!cluster) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy Cụm Chợ' });
    }

    if (req.user.role !== 'admin' && cluster.user_id !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Không có quyền xóa cụm chợ này' });
    }

    // Gỡ liên kết các chợ thuộc cụm về NULL (không xóa chợ)
    db.prepare('UPDATE "groups" SET cluster_id = NULL WHERE cluster_id = ?').run(cluster.id);

    // Xóa cụm
    db.prepare('DELETE FROM clusters WHERE id = ?').run(cluster.id);

    res.json({ success: true, message: 'Đã xóa Cụm Chợ (các chợ thành viên vẫn được giữ nguyên)' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/clusters/:id/run-now - Phát tin ngay cho toàn bộ các chợ trong Cụm
router.post('/:id/run-now', async (req, res) => {
  try {
    const status = getDispatchStatus();
    if (status.isRunning) {
      return res.status(409).json({ success: false, error: 'Dispatcher đang bận gửi tin đợt trước. Vui lòng đợi!' });
    }

    const db = getDb();
    const cluster = db.prepare('SELECT * FROM clusters WHERE id = ?').get(req.params.id);
    if (!cluster) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy Cụm Chợ' });
    }

    if (req.user.role !== 'admin' && cluster.user_id !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Không có quyền gửi tin cụm chợ này' });
    }

    const clusterGroups = db.prepare('SELECT * FROM "groups" WHERE cluster_id = ? AND is_active = 1').all(cluster.id);
    if (clusterGroups.length === 0) {
      return res.status(400).json({ success: false, error: 'Cụm Chợ này chưa có chợ nào đang kích hoạt (active)' });
    }

    // Chạy ngầm phát tin cho tập hợp chợ này
    dispatch(null, true, clusterGroups).then(result => {
      console.log(`🚀 Hoàn thành phát tin cho Cụm [${cluster.name}]:`, result);
    }).catch(err => {
      console.error(`❌ Lỗi phát tin Cụm [${cluster.name}]:`, err);
    });

    res.json({
      success: true,
      message: `Đang phát tin cho ${clusterGroups.length} chợ trong cụm "${cluster.name}". Xem trang Nhật Ký để theo dõi!`
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
