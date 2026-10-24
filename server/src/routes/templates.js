const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');
const { unspin } = require('../utils/spintax');
const path = require('path');
const fs = require('fs');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

const UPLOADS_DIR = process.env.UPLOADS_DIR || './uploads';

// GET /api/templates
router.get('/', (req, res) => {
  try {
    const db = getDb();
    let query = `
      SELECT t.*, u.username as owner_username, u.display_name as owner_name
      FROM templates t
      LEFT JOIN users u ON u.id = t.user_id
    `;
    const params = [];

    if (req.user.role !== 'admin') {
      query += ' WHERE (t.user_id = ? OR t.user_id IS NULL)';
      params.push(req.user.id);
    } else if (req.query.user_id) {
      query += ' WHERE t.user_id = ?';
      params.push(req.query.user_id);
    }

    query += ' ORDER BY t.created_at DESC';

    const templates = db.prepare(query).all(...params);
    res.json({ success: true, data: templates });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/templates - Tạo template mới
router.post('/', (req, res) => {
  try {
    const db = getDb();
    const { name, content, is_active } = req.body;

    if (!name || !content) {
      return res.status(400).json({ success: false, error: 'Thiếu name hoặc content' });
    }

    let image_path = null;

    // Xử lý upload ảnh
    if (req.files && req.files.image) {
      const file = req.files.image;
      const ext = path.extname(file.name) || '.jpg';
      const filename = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}${ext}`;
      const savePath = path.join(path.resolve(UPLOADS_DIR), filename);
      file.mv(savePath);
      image_path = filename;
    }

    const targetUserId = (req.user.role === 'admin' && req.body.user_id) ? parseInt(req.body.user_id) : req.user.id;

    const result = db.prepare(`
      INSERT INTO templates (name, content, image_path, is_active, user_id)
      VALUES (?, ?, ?, ?, ?)
    `).run(name, content, image_path, is_active !== undefined ? (is_active ? 1 : 0) : 1, targetUserId);

    const template = db.prepare(`
      SELECT t.*, u.username as owner_username, u.display_name as owner_name
      FROM templates t
      LEFT JOIN users u ON u.id = t.user_id
      WHERE t.id = ?
    `).get(result.lastInsertRowid);
    res.json({ success: true, data: template });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/templates/:id/duplicate - Nhân bản kịch bản
router.post('/:id/duplicate', (req, res) => {
  try {
    const db = getDb();
    const template = db.prepare('SELECT * FROM templates WHERE id = ?').get(req.params.id);
    if (!template) {
      return res.status(404).json({ success: false, error: 'Kịch bản không tồn tại' });
    }

    let newImagePath = null;
    if (template.image_path) {
      const srcPath = path.join(path.resolve(UPLOADS_DIR), template.image_path);
      if (fs.existsSync(srcPath)) {
        const ext = path.extname(template.image_path) || '.jpg';
        const newFilename = `${Date.now()}_copy_${Math.random().toString(36).substr(2, 6)}${ext}`;
        const destPath = path.join(path.resolve(UPLOADS_DIR), newFilename);
        fs.copyFileSync(srcPath, destPath);
        newImagePath = newFilename;
      }
    }

    const targetUserId = (req.user.role === 'admin' && req.body.user_id) ? parseInt(req.body.user_id) : (template.user_id || req.user.id);

    const result = db.prepare(`
      INSERT INTO templates (name, content, image_path, is_active, user_id)
      VALUES (?, ?, ?, ?, ?)
    `).run(`${template.name} (Bản sao)`, template.content, newImagePath, template.is_active, targetUserId);

    const newTemplate = db.prepare(`
      SELECT t.*, u.username as owner_username, u.display_name as owner_name
      FROM templates t
      LEFT JOIN users u ON u.id = t.user_id
      WHERE t.id = ?
    `).get(result.lastInsertRowid);
    res.json({ success: true, data: newTemplate });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/templates/bulk-toggle - Bật / tắt nhiều kịch bản
router.patch('/bulk-toggle', (req, res) => {
  try {
    const db = getDb();
    const { ids, is_active } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: 'Thiếu danh sách id kịch bản' });
    }
    const activeVal = is_active ? 1 : 0;
    const placeholders = ids.map(() => '?').join(',');
    
    let query = `UPDATE templates SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id IN (${placeholders})`;
    const params = [activeVal, ...ids];

    if (req.user.role !== 'admin') {
      query += ' AND user_id = ?';
      params.push(req.user.id);
    }

    const result = db.prepare(query).run(...params);
    res.json({ success: true, updated: result.changes });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/templates/bulk-delete - Xóa nhiều kịch bản
router.post('/bulk-delete', (req, res) => {
  try {
    const db = getDb();
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: 'Thiếu danh sách id kịch bản' });
    }
    const placeholders = ids.map(() => '?').join(',');
    let query = `SELECT id, image_path FROM templates WHERE id IN (${placeholders})`;
    const params = [...ids];

    if (req.user.role !== 'admin') {
      query += ' AND user_id = ?';
      params.push(req.user.id);
    }

    const templates = db.prepare(query).all(...params);
    for (const t of templates) {
      if (t.image_path) {
        const imgPath = path.join(path.resolve(UPLOADS_DIR), t.image_path);
        if (fs.existsSync(imgPath)) {
          try { fs.unlinkSync(imgPath); } catch (_) {}
        }
      }
    }

    const validIds = templates.map(t => t.id);
    if (validIds.length > 0) {
      const delPlaceholders = validIds.map(() => '?').join(',');
      db.prepare(`DELETE FROM templates WHERE id IN (${delPlaceholders})`).run(...validIds);
    }

    res.json({ success: true, deleted: validIds.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/templates/:id - Cập nhật template
router.put('/:id', (req, res) => {
  try {
    const db = getDb();
    const { name, content, is_active } = req.body;
    const template = db.prepare('SELECT * FROM templates WHERE id = ?').get(req.params.id);
    if (!template) {
      return res.status(404).json({ success: false, error: 'Template không tồn tại' });
    }

    if (req.user.role !== 'admin' && template.user_id && template.user_id !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Bạn không có quyền chỉnh sửa kịch bản này' });
    }

    let image_path = template.image_path;

    // Xử lý ảnh mới nếu có
    if (req.files && req.files.image) {
      // Xóa ảnh cũ
      if (template.image_path) {
        const oldPath = path.join(path.resolve(UPLOADS_DIR), template.image_path);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      const file = req.files.image;
      const ext = path.extname(file.name) || '.jpg';
      const filename = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}${ext}`;
      const savePath = path.join(path.resolve(UPLOADS_DIR), filename);
      file.mv(savePath);
      image_path = filename;
    }

    // Xóa ảnh nếu client yêu cầu
    if (req.body.remove_image === '1' || req.body.remove_image === 'true') {
      if (template.image_path) {
        const oldPath = path.join(path.resolve(UPLOADS_DIR), template.image_path);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      image_path = null;
    }

    const targetUserId = (req.user.role === 'admin' && req.body.user_id !== undefined)
      ? (req.body.user_id ? parseInt(req.body.user_id) : null)
      : template.user_id;

    db.prepare(`
      UPDATE templates SET name = ?, content = ?, image_path = ?, is_active = ?, user_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      name ?? template.name,
      content ?? template.content,
      image_path,
      is_active !== undefined ? (is_active ? 1 : 0) : template.is_active,
      targetUserId,
      req.params.id
    );

    const updated = db.prepare(`
      SELECT t.*, u.username as owner_username, u.display_name as owner_name
      FROM templates t
      LEFT JOIN users u ON u.id = t.user_id
      WHERE t.id = ?
    `).get(req.params.id);
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/templates/:id
router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    const template = db.prepare('SELECT * FROM templates WHERE id = ?').get(req.params.id);
    if (!template) {
      return res.status(404).json({ success: false, error: 'Template không tồn tại' });
    }

    if (req.user.role !== 'admin' && template.user_id && template.user_id !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Bạn không có quyền xóa kịch bản này' });
    }

    // Xóa file ảnh
    if (template.image_path) {
      const imgPath = path.join(path.resolve(UPLOADS_DIR), template.image_path);
      if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
    }

    db.prepare('DELETE FROM templates WHERE id = ?').run(req.params.id);

    res.json({ success: true, message: 'Đã xóa template' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/templates/preview-spintax - Xem trước spintax
router.post('/preview-spintax', (req, res) => {
  try {
    const { content } = req.body;
    if (!content) {
      return res.status(400).json({ success: false, error: 'Thiếu content' });
    }

    const hasSpintax = /\{[^{}]*\|[^{}]*\}/.test(content);
    const uniquePreviews = new Set();

    if (hasSpintax) {
      // Chỉ lấy các biến thể DUY NHẤT (tối đa 2-3 biến thể, không sinh tràn lan 5 bản giống nhau)
      for (let i = 0; i < 15 && uniquePreviews.size < 3; i++) {
        try {
          uniquePreviews.add(unspin(content));
        } catch (_) {
          uniquePreviews.add(content);
        }
      }
    } else {
      uniquePreviews.add(content);
    }

    res.json({ 
      success: true, 
      data: { 
        previews: Array.from(uniquePreviews),
        hasSpintax 
      } 
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/templates/export - Xuất toàn bộ kịch bản ra JSON
router.get('/export', (req, res) => {
  try {
    const db = getDb();
    let query = 'SELECT name, content, is_active FROM templates';
    const params = [];

    if (req.user.role !== 'admin') {
      query += ' WHERE (user_id = ? OR user_id IS NULL)';
      params.push(req.user.id);
    }

    query += ' ORDER BY id ASC';
    const templates = db.prepare(query).all(...params);

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=templates_${Date.now()}.json`);
    res.json({
      version: '1.0',
      exported_at: new Date().toISOString(),
      total: templates.length,
      templates
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/templates/import - Nhập kịch bản từ file JSON hoặc mảng JSON
router.post('/import', (req, res) => {
  try {
    const db = getDb();
    let items = [];

    if (req.files && req.files.file) {
      const fileContent = req.files.file.data.toString('utf-8');
      const parsed = JSON.parse(fileContent);
      items = Array.isArray(parsed) ? parsed : (parsed.templates || []);
    } else if (req.body.templates && Array.isArray(req.body.templates)) {
      items = req.body.templates;
    } else if (req.body.json_data) {
      const parsed = JSON.parse(req.body.json_data);
      items = Array.isArray(parsed) ? parsed : (parsed.templates || []);
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'Dữ liệu kịch bản trống hoặc không đúng định dạng' });
    }

    const insert = db.prepare(`
      INSERT INTO templates (name, content, is_active, user_id)
      VALUES (?, ?, ?, ?)
    `);

    let imported = 0;
    const insertMany = db.transaction(() => {
      for (const item of items) {
        if (!item.content) continue;
        const name = item.name ? String(item.name).trim() : `Kịch bản ${Date.now()}`;
        const content = String(item.content).trim();
        const isActive = item.is_active !== undefined ? (item.is_active ? 1 : 0) : 1;

        insert.run(name, content, isActive, req.user.id);
        imported++;
      }
    });

    insertMany();
    res.json({ success: true, message: `Đã nhập thành công ${imported} kịch bản`, imported });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Lỗi xử lý file import: ' + err.message });
  }
});

module.exports = router;
