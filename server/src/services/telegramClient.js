const { TelegramClient, Api } = require('telegram');
const { StringSession } = require('telegram/sessions');
const { getDb } = require('../db/database');

// Lưu trữ các client đang hoạt động theo số điện thoại
const activeClients = new Map();
// Lưu trữ các phone code hash tạm thời
const pendingAuth = new Map();

/**
 * Tạo TelegramClient mới
 */
function createClient(apiId, apiHash, sessionString = '') {
  let proxyConfig = undefined;
  try {
    const db = getDb();
    const proxySetting = db.prepare('SELECT value FROM settings WHERE key = ?').get('proxy_url');
    if (proxySetting && proxySetting.value) {
      const url = new URL(proxySetting.value);
      proxyConfig = {
        socksType: 5,
        ip: url.hostname,
        port: parseInt(url.port),
        username: decodeURIComponent(url.username),
        password: decodeURIComponent(url.password)
      };
      console.log(`[Proxy] Sử dụng Proxy: ${proxyConfig.ip}:${proxyConfig.port}`);
    }
  } catch (e) {
    console.error('[Proxy] Lỗi cấu hình Proxy:', e);
  }

  const session = new StringSession(sessionString || '');
  const client = new TelegramClient(session, parseInt(apiId), apiHash, {
    connectionRetries: 5,
    retryDelay: 1000,
    autoReconnect: true,
    useWSS: true,
    proxy: proxyConfig
  });
  return client;
}

function isAuthError(err) {
  if (!err) return false;
  const msg = ((err.message || '') + ' ' + (err.errorMessage || '')).toUpperCase();
  return msg.includes('AUTH_KEY_DUPLICATED') ||
         msg.includes('AUTH_KEY_UNREGISTERED') ||
         msg.includes('SESSION_REVOKED') ||
         msg.includes('SESSION_EXPIRED') ||
         msg.includes('USER_DEACTIVATED') ||
         err.code === 406 ||
         err.code === 401;
}

function handleAuthError(phone) {
  if (activeClients.has(phone)) {
    const client = activeClients.get(phone);
    try { client.disconnect(); } catch (_) {}
    activeClients.delete(phone);
  }
  updateAccountStatus(phone, 'disconnected');
}

/**
 * Lấy client đang hoạt động hoặc tạo mới từ session lưu trong DB
 */
async function getOrCreateClient(phone) {
  if (activeClients.has(phone)) {
    const client = activeClients.get(phone);
    if (client.connected) return client;
  }

  const db = getDb();
  const account = db.prepare('SELECT * FROM accounts WHERE phone = ?').get(phone);
  if (!account || !account.session_string) {
    throw new Error('Tài khoản chưa được xác thực hoặc không tồn tại');
  }

  const client = createClient(account.api_id, account.api_hash, account.session_string);
  try {
    await client.connect();
    
    if (!await client.checkAuthorization()) {
      handleAuthError(phone);
      throw new Error(`Session của ${phone} đã hết hạn, cần đăng nhập lại`);
    }
  } catch (err) {
    if (isAuthError(err)) {
      handleAuthError(phone);
      throw new Error(`Tài khoản Telegram (${phone}) đã hết hạn phiên hoặc bị đăng xuất trên thiết bị khác (AUTH_KEY_DUPLICATED). Vui lòng vào trang "Tài khoản" để đăng nhập lại OTP.`);
    }
    throw err;
  }

  activeClients.set(phone, client);
  updateAccountStatus(phone, 'connected');
  return client;
}

/**
 * Bắt đầu luồng xác thực - Bước 1: Gửi OTP
 */
async function sendOtp(phone, apiId, apiHash) {
  const client = createClient(apiId, apiHash);
  await client.connect();

  const result = await client.sendCode(
    { apiId: parseInt(apiId), apiHash },
    phone
  );

  // Lưu client tạm thời để dùng tiếp ở bước nhập OTP
  pendingAuth.set(phone, { client, phoneCodeHash: result.phoneCodeHash, apiId, apiHash });

  return result;
}

/**
 * Bước 2: Xác thực với OTP (và 2FA nếu cần)
 */
async function verifyOtp(phone, code, password = null, userId = null) {
  const pending = pendingAuth.get(phone);
  if (!pending) {
    throw new Error('Không tìm thấy phiên xác thực. Vui lòng gửi OTP lại.');
  }

  const { client, phoneCodeHash, apiId, apiHash } = pending;

  try {
    await client.invoke(
      new (require('telegram/tl').Api.auth.SignIn)({
        phoneNumber: phone,
        phoneCodeHash: phoneCodeHash,
        phoneCode: code,
      })
    );
  } catch (err) {
    if (err.errorMessage === 'SESSION_PASSWORD_NEEDED') {
      if (!password) {
        throw new Error('NEED_2FA_PASSWORD');
      }
      // Xác thực 2FA
      const { computeCheck } = require('telegram/Password');
      const r = await client.invoke(new (require('telegram/tl').Api.account.GetPassword)());
      const check = await computeCheck(r, password);
      await client.invoke(new (require('telegram/tl').Api.auth.CheckPassword)({ password: check }));
    } else {
      throw err;
    }
  }

  // Lấy thông tin người dùng
  const me = await client.getMe();
  const sessionString = client.session.save();

  // Lưu vào database
  const db = getDb();
  db.prepare(`
    INSERT INTO accounts (phone, api_id, api_hash, session_string, status, username, first_name, user_id)
    VALUES (?, ?, ?, ?, 'connected', ?, ?, ?)
    ON CONFLICT(phone) DO UPDATE SET
      session_string = excluded.session_string,
      status = 'connected',
      username = excluded.username,
      first_name = excluded.first_name,
      user_id = COALESCE(excluded.user_id, accounts.user_id),
      updated_at = CURRENT_TIMESTAMP
  `).run(phone, apiId, apiHash, sessionString, me.username || '', me.firstName || '', userId || null);

  // Chuyển sang active clients
  activeClients.set(phone, client);
  pendingAuth.delete(phone);

  return { username: me.username, firstName: me.firstName, phone };
}

/**
 * Ngắt kết nối và xóa client
 */
async function disconnectClient(phone) {
  if (activeClients.has(phone)) {
    const client = activeClients.get(phone);
    try {
      await client.disconnect();
    } catch (_) {}
    activeClients.delete(phone);
  }
  updateAccountStatus(phone, 'disconnected');
}

/**
 * Cập nhật trạng thái tài khoản trong DB
 */
function updateAccountStatus(phone, status, floodWaitUntil = null) {
  const db = getDb();
  if (floodWaitUntil !== null) {
    db.prepare('UPDATE accounts SET status = ?, flood_wait_until = ?, updated_at = CURRENT_TIMESTAMP WHERE phone = ?')
      .run(status, floodWaitUntil, phone);
  } else {
    db.prepare('UPDATE accounts SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE phone = ?')
      .run(status, phone);
  }
}

/**
 * Gửi tin nhắn đến một nhóm
 */
async function sendMessage(phone, groupIdentifier, messageText, imagePath = null) {
  const client = await getOrCreateClient(phone);

  try {
    let entity;
    let replyToMsgId = undefined;

    try {
      if (groupIdentifier.includes('t.me/+') || groupIdentifier.includes('t.me/joinchat/')) {
        let hash = groupIdentifier.includes('t.me/+') 
          ? groupIdentifier.split('t.me/+').pop()
          : groupIdentifier.split('t.me/joinchat/').pop();
        hash = hash.replace(/\//g, '').trim();

        const invite = await client.invoke(new Api.messages.CheckChatInvite({ hash }));
        if (invite.className === 'ChatInviteAlready') {
          entity = invite.chat;
        } else {
          const updates = await client.invoke(new Api.messages.ImportChatInvite({ hash }));
          if (updates.chats && updates.chats.length > 0) {
            entity = updates.chats[0];
          } else {
            throw new Error("Không thể tham gia nhóm này tự động. Vui lòng tham gia bằng app Telegram trước.");
          }
        }
      } else if (groupIdentifier.includes('t.me/')) {
        const urlParts = groupIdentifier.replace(/^https?:\/\/t\.me\//, '').split('/');
        if (urlParts[0] === 'c' && urlParts.length >= 3) {
          // Private chat link: t.me/c/1234567890/123
          if (isNaN(urlParts[1])) {
            entity = await client.getEntity('@' + urlParts[1]);
          } else {
            const chatId = '-100' + urlParts[1];
            entity = await client.getEntity(chatId);
          }
          replyToMsgId = parseInt(urlParts[2]);
        } else if (urlParts.length >= 2) {
          // Public chat link (topic): t.me/username/123
          const username = '@' + urlParts[0];
          entity = await client.getEntity(username);
          replyToMsgId = parseInt(urlParts[1]);
        } else {
          entity = await client.getEntity('@' + urlParts[0]);
        }
      } else {
        entity = await client.getEntity(groupIdentifier);
      }
    } catch (err) {
      if (isAuthError(err)) {
        handleAuthError(phone);
        throw new Error(`Phiên đăng nhập Telegram của ${phone} đã hết hạn hoặc bị hủy (AUTH_KEY_DUPLICATED). Vui lòng vào trang "Tài khoản" để đăng nhập lại OTP.`);
      }
      throw new Error(`Không tìm thấy nhóm "${groupIdentifier}": ${err.message}`);
    }


    // Tự động parse [123456789012345678] thành <tg-emoji emoji-id="123456789012345678">⭐</tg-emoji>
    let processedMessage = messageText;
    if (processedMessage && typeof processedMessage === 'string') {
      processedMessage = processedMessage.replace(/\[(\d{15,22})\]/g, '<tg-emoji emoji-id="$1">⭐</tg-emoji>');
    }

    if (imagePath && require('fs').existsSync(imagePath)) {
      await client.sendFile(entity, {
        file: imagePath,
        caption: processedMessage,
        parseMode: 'html',
        replyTo: replyToMsgId,
      });
    } else {
      await client.sendMessage(entity, {
        message: processedMessage,
        parseMode: 'html',
        replyTo: replyToMsgId,
      });
    }


    return { success: true };
  } catch (err) {
    if (isAuthError(err)) {
      handleAuthError(phone);
      throw new Error(`Phiên đăng nhập Telegram của ${phone} đã hết hạn hoặc bị hủy (AUTH_KEY_DUPLICATED). Vui lòng vào trang "Tài khoản" để đăng nhập lại OTP.`);
    }
    if (err.errorMessage && err.errorMessage.includes('FLOOD_WAIT')) {
      const seconds = parseInt(err.errorMessage.split('_').pop()) || 60;
      const until = Date.now() + seconds * 1000;
      updateAccountStatus(phone, 'flood_wait', until);
      throw new Error(`FLOOD_WAIT:${seconds}`);
    }
    throw err;
  }
}

/**
 * Lấy danh sách tất cả active clients
 */
function getActiveClients() {
  return activeClients;
}

/**
 * Khởi kết nối lại tất cả tài khoản có session
 */
async function reconnectAllAccounts() {
  const db = getDb();
  const accounts = db.prepare("SELECT * FROM accounts WHERE session_string IS NOT NULL AND session_string != ''").all();

  for (const account of accounts) {
    try {
      await getOrCreateClient(account.phone);
      console.log(`✅ Kết nối lại tài khoản: ${account.phone}`);
    } catch (err) {
      console.warn(`⚠️ Không thể kết nối lại ${account.phone}: ${err.message}`);
      updateAccountStatus(account.phone, 'disconnected');
    }
  }
}

module.exports = {
  sendOtp,
  verifyOtp,
  sendMessage,
  disconnectClient,
  getOrCreateClient,
  getActiveClients,
  reconnectAllAccounts,
  updateAccountStatus,
};
