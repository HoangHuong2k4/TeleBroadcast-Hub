const express = require('express');
const router = express.Router();
const { getOrCreateClient } = require('../services/telegramClient');
const { getDb } = require('../db/database');
const { Api } = require('telegram');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

/**
 * Converts Telegram message text + entities → HTML
 */
function entitiesToHtml(text, entities) {
  if (!text) return '';
  if (!entities || entities.length === 0) return text;

  // Sort DESC by offset to avoid index shift
  const sorted = [...entities].sort((a, b) => b.offset - a.offset);
  // Split by Unicode codepoint for correct emoji handling
  const chars = [...text];

  for (const entity of sorted) {
    const start = entity.offset;
    const end = entity.offset + entity.length;
    const segment = chars.slice(start, end).join('');

    let openTag = '';
    let closeTag = '';

    if (entity instanceof Api.MessageEntityBold) {
      openTag = '<b>'; closeTag = '</b>';
    } else if (entity instanceof Api.MessageEntityItalic) {
      openTag = '<i>'; closeTag = '</i>';
    } else if (entity instanceof Api.MessageEntityUnderline) {
      openTag = '<u>'; closeTag = '</u>';
    } else if (entity instanceof Api.MessageEntityStrike) {
      openTag = '<s>'; closeTag = '</s>';
    } else if (entity instanceof Api.MessageEntitySpoiler) {
      openTag = '<tg-spoiler>'; closeTag = '</tg-spoiler>';
    } else if (entity instanceof Api.MessageEntityCode) {
      openTag = '<code>'; closeTag = '</code>';
    } else if (entity instanceof Api.MessageEntityPre) {
      openTag = '<pre>'; closeTag = '</pre>';
    } else if (entity instanceof Api.MessageEntityBlockquote) {
      openTag = '<blockquote>'; closeTag = '</blockquote>';
    } else if (entity instanceof Api.MessageEntityCustomEmoji) {
      const docId = entity.documentId.toString();
      openTag = `<tg-emoji emoji-id="${docId}">`;
      closeTag = '</tg-emoji>';
    }

    if (openTag) {
      chars.splice(start, entity.length, openTag + segment + closeTag);
    }
  }

  return chars.join('');
}

/**
 * Parse Telegram message link
 * Supports: https://t.me/username/123, https://t.me/c/1234567890/123
 */
function parseMessageLink(link) {
  const cleaned = link.trim().replace(/^https?:\/\//, '');
  const privateMatch = cleaned.match(/^t\.me\/c\/(\d+)\/(\d+)/);
  if (privateMatch) {
    return { chatId: `-100${privateMatch[1]}`, messageId: parseInt(privateMatch[2]) };
  }
  const publicMatch = cleaned.match(/^t\.me\/([^/]+)\/(\d+)/);
  if (publicMatch) {
    return { chatId: `@${publicMatch[1]}`, messageId: parseInt(publicMatch[2]) };
  }
  return null;
}

// POST /api/import/from-link
router.post('/from-link', async (req, res) => {
  try {
    const db = getDb();
    const account = db.prepare("SELECT * FROM accounts WHERE status = 'connected' LIMIT 1").get();
    if (!account) {
      return res.status(400).json({ success: false, error: 'Cần có tài khoản Telegram đang kết nối' });
    }

    let chatId, messageId;

    if (req.body.link) {
      const parsed = parseMessageLink(req.body.link);
      if (!parsed) {
        return res.status(400).json({ success: false, error: 'Link không hợp lệ. Dùng dạng: https://t.me/channel/123' });
      }
      chatId = parsed.chatId;
      messageId = parsed.messageId;
    } else if (req.body.chat_id && req.body.message_id) {
      chatId = req.body.chat_id;
      messageId = parseInt(req.body.message_id);
    } else {
      return res.status(400).json({ success: false, error: 'Cần truyền link hoặc chat_id + message_id' });
    }

    const client = await getOrCreateClient(account.phone);

    let peer;
    try {
      peer = await client.getEntity(chatId);
    } catch (err) {
      return res.status(400).json({ success: false, error: `Không truy cập được chat "${chatId}": ${err.message}` });
    }

    const messages = await client.getMessages(peer, { ids: [messageId] });
    if (!messages || messages.length === 0 || !messages[0]) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy tin nhắn' });
    }

    const msg = messages[0];
    const rawText = msg.text || msg.message || '';
    const entities = msg.entities || [];

    const html = entitiesToHtml(rawText, entities);

    const stats = {
      custom_emoji: entities.filter(e => e instanceof Api.MessageEntityCustomEmoji).length,
      bold: entities.filter(e => e instanceof Api.MessageEntityBold).length,
      italic: entities.filter(e => e instanceof Api.MessageEntityItalic).length,
      spoiler: entities.filter(e => e instanceof Api.MessageEntitySpoiler).length,
      total_entities: entities.length,
    };

    res.json({
      success: true,
      data: { html, raw_text: rawText, stats, has_image: !!(msg.media && msg.photo) },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
