const cron = require('node-cron');
const { getDb } = require('../db/database');
const { sendMessage, reconnectAllAccounts, updateAccountStatus } = require('./telegramClient');
const { unspin } = require('../utils/spintax');
const path = require('path');
const fs = require('fs');

// Lưu trữ các cron jobs đang chạy
const activeJobs = new Map();
let minuteTickerJob = null;

// Trạng thái của dispatcher
let isRunning = false;
let currentRun = null;
let lastDispatchedMinute = null;

/**
 * Trộn ngẫu nhiên mảng (Fisher-Yates shuffle)
 */
function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Ngủ trong khoảng thời gian ngẫu nhiên
 */
function randomDelay(minSec, maxSec) {
  const ms = (Math.floor(Math.random() * (maxSec - minSec + 1)) + minSec) * 1000;
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Ghi nhật ký vào database
 */
function writeLog(groupIdentifier, groupTitle, templateId, templateName, status, errorMessage = null, userId = null) {
  const db = getDb();
  db.prepare(`
    INSERT INTO send_logs (group_identifier, group_title, template_id, template_name, status, error_message, user_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(groupIdentifier, groupTitle, templateId, templateName, status, errorMessage, userId);
}

/**
 * Ghép nội dung (kịch bản chung hoặc riêng) với Quy tắc & Hashtag chân trang của nhóm
 */
function composeGroupMessage(baseContent, group) {
  let message;
  try {
    message = unspin(baseContent || '');
  } catch (_) {
    message = baseContent || '';
  }

  const groupName = group.title || group.identifier || '';
  const hashtags = (group.rule_hashtags || '').trim();

  // Thay thế biến định danh
  message = message.replace(/\{group_name\}/gi, groupName);
  message = message.replace(/\{group_identifier\}/gi, group.identifier || '');

  // Xử lý Hashtag chân trang riêng của nhóm
  if (message.includes('{group_hashtags}')) {
    message = message.replace(/\{group_hashtags\}/gi, hashtags);
  } else if (hashtags) {
    message = message + '\n\n' + hashtags;
  }

  // Chèn Prefix / Lời chào riêng của nhóm vào đầu
  if (group.rule_prefix && group.rule_prefix.trim()) {
    message = group.rule_prefix.trim() + '\n\n' + message;
  }

  // Chèn Suffix / Chữ ký riêng của nhóm vào cuối
  if (group.rule_suffix && group.rule_suffix.trim()) {
    message = message + '\n\n' + group.rule_suffix.trim();
  }

  return message;
}

/**
 * Chọn template ngẫu nhiên trong danh sách active
 */
function pickRandomTemplate(templates) {
  if (!templates || templates.length === 0) return null;
  return templates[Math.floor(Math.random() * templates.length)];
}

/**
 * Lấy ngày hôm nay theo giờ VN dạng 'YYYY-MM-DD'
 */
function getTodayVN() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
}

/**
 * Dispatch: Gửi tin nhắn đến nhóm
 * @param {number|null} targetGroupId - Nếu chỉ định gửi 1 nhóm
 * @param {boolean} isManual - Nếu gửi thủ công (bỏ qua giới hạn lặp trong ngày)
 * @param {Array|null} specificGroups - Danh sách nhóm cụ thể cần gửi
 */
async function dispatch(targetGroupId = null, isManual = false, specificGroups = null) {
  if (isRunning) {
    console.log('⏳ Dispatcher đang chạy, bỏ qua lần này');
    return { skipped: true, reason: 'Dispatcher đang chạy' };
  }

  const db = getDb();
  const today = getTodayVN();

  // Lấy danh sách nhóm
  let groups;
  if (specificGroups && Array.isArray(specificGroups)) {
    groups = specificGroups;
  } else if (targetGroupId) {
    groups = db.prepare('SELECT * FROM groups WHERE id = ?').all(targetGroupId);
  } else {
    groups = db.prepare('SELECT * FROM groups WHERE is_active = 1').all();
  }

  if (groups.length === 0) {
    console.warn('⚠️ Không có nhóm nào cần gửi');
    return { skipped: true, reason: 'Không có nhóm' };
  }

  // Lấy kho kịch bản chung (Master Templates active)
  const allMasterTemplates = db.prepare('SELECT * FROM templates WHERE is_active = 1').all();

  // Lấy cài đặt trễ và trộn nhóm
  const settings = db.prepare('SELECT key, value FROM settings').all();
  const settingsMap = Object.fromEntries(settings.map(s => [s.key, s.value]));
  const delayMin = parseInt(settingsMap.delay_min) || 35;
  const delayMax = parseInt(settingsMap.delay_max) || 65;
  const shuffle = settingsMap.shuffle_groups !== '0';

  if (shuffle && !targetGroupId) {
    groups = shuffleArray(groups);
  }

  isRunning = true;
  let successCount = 0;
  let failCount = 0;

  currentRun = {
    startedAt: new Date().toISOString(),
    total: groups.length,
    done: 0,
    success: 0,
    fail: 0,
  };

  console.log(`🚀 Bắt đầu phát tin: ${groups.length} nhóm (Manual: ${isManual})`);

  for (let i = 0; i < groups.length; i++) {
    if (!isRunning) break;

    const group = groups[i];

    // Reset bộ đếm số lần gửi hôm nay nếu qua ngày mới
    let sentToday = group.sent_today_count || 0;
    if (group.last_sent_date !== today) {
      sentToday = 0;
      db.prepare('UPDATE groups SET sent_today_count = 0, last_sent_date = ? WHERE id = ?').run(today, group.id);
    }

    // Kiểm tra giới hạn số lần gửi trong ngày (nếu chạy tự động)
    if (!isManual && group.max_repeats_per_day > 0 && sentToday >= group.max_repeats_per_day) {
      console.log(`⏭️ [${i + 1}/${groups.length}] Nhóm ${group.identifier} đã đạt tối đa ${sentToday}/${group.max_repeats_per_day} lần/ngày → Bỏ qua.`);
      currentRun.done = i + 1;
      continue;
    }

    // ─────────────────────────────────────────────────────────────
    // 1. Xác định Kịch bản (Kịch bản Riêng vs Kịch bản Chung)
    // ─────────────────────────────────────────────────────────────
    let baseContent = '';
    let imagePath = null;
    let templateId = null;
    let templateName = 'Kịch bản chung';

    const isCustomTemplate = group.template_mode === 'custom' && group.custom_content && group.custom_content.trim();

    if (isCustomTemplate) {
      // 🎯 Dùng KỊCH BẢN RIÊNG của nhóm này
      baseContent = group.custom_content;
      templateId = null;
      templateName = 'Kịch bản riêng của nhóm';

      if (group.custom_image_path) {
        const resolvedPath = path.resolve(process.env.UPLOADS_DIR || './uploads', group.custom_image_path);
        if (fs.existsSync(resolvedPath)) {
          imagePath = resolvedPath;
        }
      }
    } else {
      // 🌐 Dùng KHO KỊCH BẢN CHUNG (Master Templates)
      // Lấy danh sách template được gán riêng cho nhóm này (nếu có)
      const groupAssigned = db.prepare(`
        SELECT t.* FROM templates t
        INNER JOIN group_templates gt ON gt.template_id = t.id
        WHERE gt.group_id = ? AND t.is_active = 1
      `).all(group.id);

      let templatePool = groupAssigned;
      if (templatePool.length === 0) {
        if (group.user_id) {
          templatePool = db.prepare('SELECT * FROM templates WHERE user_id = ? AND is_active = 1').all(group.user_id);
          if (templatePool.length === 0) {
            templatePool = db.prepare('SELECT * FROM templates WHERE user_id IS NULL AND is_active = 1').all();
          }
        } else {
          templatePool = allMasterTemplates;
        }
      }
      const pickedTemplate = pickRandomTemplate(templatePool);

      if (!pickedTemplate) {
        console.warn(`⚠️ Bỏ qua nhóm ${group.identifier}: Không có kịch bản chung nào khả dụng`);
        failCount++;
        currentRun.fail++;
        currentRun.done = i + 1;
        writeLog(group.identifier, group.title, null, 'Chưa có kịch bản', 'failed', 'Không có kịch bản nào đang bật', group.user_id);
        continue;
      }

      baseContent = pickedTemplate.content;
      templateId = pickedTemplate.id;
      templateName = pickedTemplate.name;

      if (pickedTemplate.image_path) {
        const resolvedPath = path.resolve(process.env.UPLOADS_DIR || './uploads', pickedTemplate.image_path);
        if (fs.existsSync(resolvedPath)) {
          imagePath = resolvedPath;
        }
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 2. Lấy tài khoản Telegram phụ trách nhóm
    // ─────────────────────────────────────────────────────────────
    let account = null;
    if (group.account_phone) {
      account = db.prepare('SELECT * FROM accounts WHERE phone = ?').get(group.account_phone);
    }
    if (!account || account.status !== 'connected') {
      if (group.user_id) {
        account = db.prepare("SELECT * FROM accounts WHERE user_id = ? AND status = 'connected' LIMIT 1").get(group.user_id);
      } else {
        account = db.prepare("SELECT * FROM accounts WHERE status = 'connected' LIMIT 1").get();
      }
    }

    if (!account) {
      console.warn(`⚠️ Bỏ qua nhóm ${group.identifier}: Không có tài khoản Telegram nào kết nối`);
      failCount++;
      currentRun.fail++;
      currentRun.done = i + 1;
      writeLog(group.identifier, group.title, templateId, templateName, 'failed', 'Không có tài khoản Telegram kết nối', group.user_id);
      continue;
    }

    // Kiểm tra flood wait
    if (account.flood_wait_until && account.flood_wait_until > Date.now()) {
      const remaining = Math.ceil((account.flood_wait_until - Date.now()) / 1000);
      console.warn(`⏰ Tài khoản ${account.phone} đang FloodWait, còn ${remaining}s.`);
      failCount++;
      currentRun.fail++;
      currentRun.done = i + 1;
      writeLog(group.identifier, group.title, templateId, templateName, 'failed', `FloodWait ${remaining}s`, group.user_id);
      continue;
    }

    // ─────────────────────────────────────────────────────────────
    // 3. Ghép nội dung & Hashtag chân trang
    // ─────────────────────────────────────────────────────────────
    const messageText = composeGroupMessage(baseContent, group);

    // ─────────────────────────────────────────────────────────────
    // 4. Gửi tin qua Telegram
    // ─────────────────────────────────────────────────────────────
    try {
      await sendMessage(account.phone, group.identifier, messageText, imagePath);

      // Cập nhật số lần gửi hôm nay & thời gian gửi
      db.prepare(`
        UPDATE groups 
        SET 
          last_sent_at = CURRENT_TIMESTAMP,
          sent_today_count = sent_today_count + 1,
          last_sent_date = ?
        WHERE id = ?
      `).run(today, group.id);

      writeLog(group.identifier, group.title, templateId, templateName, 'success', null, group.user_id);
      successCount++;
      currentRun.success++;
      console.log(`✅ [${i + 1}/${groups.length}] Đã gửi thành công → ${group.identifier} (${templateName}) [Hôm nay: ${sentToday + 1}]`);
    } catch (err) {
      const errMsg = err.message || String(err);

      if (errMsg.startsWith('FLOOD_WAIT:')) {
        const seconds = parseInt(errMsg.split(':')[1]) || 60;
        console.warn(`🚨 FLOOD_WAIT ${seconds}s - Tạm dừng dispatcher`);
        writeLog(group.identifier, group.title, templateId, templateName, 'failed', `FloodWait ${seconds}s`, group.user_id);
        updateAccountStatus(account.phone, 'flood_wait', Date.now() + seconds * 1000);

        isRunning = false;
        failCount++;
        currentRun.fail++;

        setTimeout(() => {
          updateAccountStatus(account.phone, 'connected');
        }, seconds * 1000);
        break;
      }

      if (errMsg.includes('AUTH_KEY_DUPLICATED') || errMsg.includes('hết hạn') || errMsg.includes('bị hủy')) {
        console.warn(`🛑 Dừng các nhóm còn lại do tài khoản ${account.phone} bị lỗi phiên (AUTH_KEY_DUPLICATED).`);
        writeLog(group.identifier, group.title, templateId, templateName, 'failed', errMsg, group.user_id);
        failCount++;
        currentRun.fail++;
        currentRun.done = i + 1;
        break;
      }

      console.warn(`❌ [${i + 1}/${groups.length}] Lỗi → ${group.identifier}: ${errMsg}`);
      writeLog(group.identifier, group.title, templateId, templateName, 'failed', errMsg, group.user_id);
      failCount++;
      currentRun.fail++;
    }

    currentRun.done = i + 1;

    // Nghỉ ngẫu nhiên giữa các nhóm
    if (i < groups.length - 1 && isRunning) {
      console.log(`⏳ Nghỉ ${delayMin}s-${delayMax}s trước nhóm tiếp theo...`);
      await randomDelay(delayMin, delayMax);
    }
  }

  isRunning = false;
  console.log(`🏁 Hoàn thành đợt phát tin: ${successCount} thành công, ${failCount} thất bại`);

  const result = { ...currentRun, success: successCount, fail: failCount };
  currentRun = null;
  return result;
}

/**
 * Kiểm tra mỗi phút theo múi giờ Việt Nam:
 * - Nhóm dùng lịch riêng: chạy nếu khung giờ hiện tại trùng với custom_time_slots
 * - Nhóm dùng lịch chung: chạy nếu khung giờ hiện tại trùng với schedule_config
 */
async function checkAndDispatchMinute() {
  if (isRunning) return;

  const now = new Date();
  const options = { timeZone: 'Asia/Ho_Chi_Minh', hour12: false, hour: '2-digit', minute: '2-digit' };
  const parts = new Intl.DateTimeFormat('en-GB', options).formatToParts(now);
  const hour = parts.find(p => p.type === 'hour').value;
  const minute = parts.find(p => p.type === 'minute').value;
  const currentSlot = `${hour}:${minute}`;

  const db = getDb();
  const today = getTodayVN();
  const minuteKey = `${today}_${currentSlot}`;

  if (lastDispatchedMinute === minuteKey) {
    return;
  }

  // Khung giờ chung hệ thống không gán user (nếu có)
  const globalSlot = db.prepare('SELECT id FROM schedule_config WHERE time_slot = ? AND is_active = 1 AND user_id IS NULL').get(currentSlot);

  // Lấy toàn bộ nhóm active
  const activeGroups = db.prepare('SELECT * FROM groups WHERE is_active = 1').all();
  if (activeGroups.length === 0) return;

  const eligibleGroups = activeGroups.filter(grp => {
    let sentCount = grp.sent_today_count || 0;
    if (grp.last_sent_date !== today) {
      sentCount = 0;
    }

    // Bỏ qua nếu đạt tối đa lần gửi hôm nay
    if (grp.max_repeats_per_day > 0 && sentCount >= grp.max_repeats_per_day) {
      return false;
    }

    // Lấy khung giờ của tài khoản Telegram phụ trách (nếu có)
    let accountSlots = null;
    let grpOwnerId = grp.user_id;
    if (grp.account_phone || grpOwnerId) {
      try {
        const acc = grp.account_phone
          ? db.prepare('SELECT user_id, time_slots FROM accounts WHERE phone = ?').get(grp.account_phone)
          : db.prepare('SELECT user_id, time_slots FROM accounts WHERE user_id = ? LIMIT 1').get(grpOwnerId);
        if (acc) {
          if (!grpOwnerId && acc.user_id) grpOwnerId = acc.user_id;
          if (acc.time_slots) {
            const parsed = JSON.parse(acc.time_slots);
            if (Array.isArray(parsed) && parsed.length > 0) {
              accountSlots = parsed;
            }
          }
        }
      } catch (_) {}
    }
    if (!grpOwnerId) grpOwnerId = 1;

    if (grp.schedule_mode === 'custom') {
      // ⏰ Nhóm có LỊCH RIÊNG
      try {
        const slots = JSON.parse(grp.custom_time_slots || '[]');
        if (Array.isArray(slots) && slots.length > 0) {
          return slots.includes(currentSlot);
        }
      } catch (_) {}
      // Fallback theo lịch của tài khoản phụ trách
      if (accountSlots) {
        return accountSlots.includes(currentSlot);
      }
      return false;
    } else {
      // 🌐 Nhóm dùng LỊCH CHUNG: Chạy chuẩn theo cấu hình khung giờ của CHÍNH USER sở hữu nhóm
      const userSlots = db.prepare('SELECT time_slot FROM schedule_config WHERE user_id = ? AND is_active = 1').all(grpOwnerId).map(s => s.time_slot);
      if (userSlots.length > 0) {
        return userSlots.includes(currentSlot);
      }

      // Fallback theo lịch của tài khoản phụ trách nếu user chưa có cấu hình
      if (accountSlots && accountSlots.length > 0) {
        return accountSlots.includes(currentSlot);
      }
      return Boolean(globalSlot);
    }
  });

  if (eligibleGroups.length > 0) {
    lastDispatchedMinute = minuteKey;
    console.log(`⏰ [Trigger ${currentSlot} VN] Tìm thấy ${eligibleGroups.length} nhóm đủ điều kiện phát tin.`);
    await dispatch(null, false, eligibleGroups);
  }
}

/**
 * Dừng dispatcher đang chạy
 */
function stopDispatch() {
  isRunning = false;
}

/**
 * Lấy trạng thái hiện tại của dispatcher
 */
function getDispatchStatus() {
  return {
    isRunning,
    currentRun,
  };
}

/**
 * Đăng ký cron job theo time slot
 */
function registerCronJob(timeSlot, id) {
  if (activeJobs.has(id)) {
    activeJobs.get(id).stop();
    activeJobs.delete(id);
  }

  const [hour, minute] = timeSlot.split(':');
  const cronExpression = `${minute} ${hour} * * *`;

  const job = cron.schedule(cronExpression, async () => {
    console.log(`⏰ Cron trigger khung giờ chung: ${timeSlot}`);
    // Trigger checkAndDispatchMinute sẽ tự gom các nhóm tương ứng
    await checkAndDispatchMinute();
  }, {
    timezone: 'Asia/Ho_Chi_Minh'
  });

  activeJobs.set(id, job);
  console.log(`📅 Đăng ký cron: ${timeSlot} (${cronExpression})`);
}

/**
 * Tải và khởi động tất cả cron jobs từ DB
 */
async function initScheduler() {
  await reconnectAllAccounts();

  const db = getDb();
  const slots = db.prepare('SELECT * FROM schedule_config WHERE is_active = 1').all();
  
  slots.forEach(slot => {
    registerCronJob(slot.time_slot, slot.id);
  });

  // Ticker mỗi phút để phục vụ các nhóm có khung giờ riêng
  if (minuteTickerJob) {
    minuteTickerJob.stop();
  }
  minuteTickerJob = cron.schedule('* * * * *', async () => {
    try {
      await checkAndDispatchMinute();
    } catch (e) {
      console.error('Lỗi ticker phút:', e);
    }
  }, {
    timezone: 'Asia/Ho_Chi_Minh'
  });

  console.log(`📅 Đã load ${slots.length} khung giờ chung & bật ticker kiểm tra lịch riêng mỗi phút`);
}

/**
 * Cập nhật lại toàn bộ cron jobs
 */
async function reloadScheduler() {
  activeJobs.forEach(job => job.stop());
  activeJobs.clear();

  const db = getDb();
  const slots = db.prepare('SELECT * FROM schedule_config WHERE is_active = 1').all();
  slots.forEach(slot => {
    registerCronJob(slot.time_slot, slot.id);
  });

  return slots;
}

module.exports = {
  dispatch,
  stopDispatch,
  getDispatchStatus,
  initScheduler,
  reloadScheduler,
  registerCronJob,
  checkAndDispatchMinute,
  composeGroupMessage,
};
