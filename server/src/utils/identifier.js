/**
 * Chuẩn hóa định danh nhóm Telegram thành định dạng duy nhất (Canonical Identifier)
 * Giúp chống trùng lặp nhóm 100% giữa các định dạng link khác nhau
 */
function canonicalizeIdentifier(raw) {
  if (!raw || typeof raw !== 'string') return '';
  let s = raw.trim();

  // Bỏ giao thức http://, https://, www.
  s = s.replace(/^https?:\/\//i, '').replace(/^www\./i, '');

  // Chuẩn hóa liên kết Telegram
  if (/^(t\.me|telegram\.me)\//i.test(s)) {
    s = s.replace(/^(t\.me|telegram\.me)\//i, '');

    // 1. Link mời private: joinchat/hash hoặc +hash
    if (s.startsWith('joinchat/')) {
      const hash = s.replace(/^joinchat\//, '').replace(/\/+$/, '').trim();
      return `https://t.me/+${hash}`;
    }
    if (s.startsWith('+')) {
      const hash = s.replace(/^\++/, '').replace(/\/+$/, '').trim();
      return `https://t.me/+${hash}`;
    }

    // 2. Link topic hoặc chat: c/12345/678 hoặc c/username/678 hoặc username/678 hoặc username
    const parts = s.split('/').filter(Boolean);
    if (parts[0] === 'c') {
      if (parts.length >= 3) {
        if (isNaN(parts[1])) {
          // c/mmothaoluann/365355 -> https://t.me/mmothaoluann/365355
          return `https://t.me/${parts[1].toLowerCase()}/${parts[2]}`;
        } else {
          // c/123456789/365355 -> https://t.me/c/${parts[1]}/${parts[2]}
          return `https://t.me/c/${parts[1]}/${parts[2]}`;
        }
      } else if (parts.length === 2) {
        if (isNaN(parts[1])) {
          return `@${parts[1].toLowerCase()}`;
        } else {
          return `https://t.me/c/${parts[1]}`;
        }
      }
    } else if (parts.length >= 2) {
      // mmothaoluann/365355 -> https://t.me/mmothaoluann/365355
      return `https://t.me/${parts[0].toLowerCase()}/${parts[1]}`;
    } else if (parts.length === 1) {
      if (parts[0].startsWith('+')) return `https://t.me/${parts[0]}`;
      return `@${parts[0].toLowerCase()}`;
    }
  }

  // Nếu là username bắt đầu bằng @
  if (s.startsWith('@')) {
    return `@${s.slice(1).toLowerCase().replace(/\/+$/, '')}`;
  }

  // Nếu là ID số nguyên âm (kênh/siêu nhóm Telegram)
  if (s.startsWith('-')) {
    return s.replace(/\/+$/, '');
  }

  // Nếu người dùng nhập username không có @ và không có dấu gạch chéo
  if (!s.includes('/') && !s.startsWith('+')) {
    return `@${s.toLowerCase()}`;
  }

  return s.toLowerCase().replace(/\/+$/, '');
}

module.exports = {
  canonicalizeIdentifier
};
