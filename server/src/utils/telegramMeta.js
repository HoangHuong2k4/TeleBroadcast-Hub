/**
 * Utility to fetch Telegram group/channel public metadata (Title, Avatar URL, Member count)
 */
async function fetchTelegramGroupMeta(identifier) {
  try {
    if (!identifier) return null;
    let clean = identifier.trim();

    clean = clean.replace(/^https?:\/\/t\.me\//, '').replace(/^@/, '');
    if (clean.startsWith('c/')) {
      clean = clean.substring(2);
    }
    clean = clean.split('/')[0].split('?')[0];

    if (!clean || clean.startsWith('+') || clean === 'joinchat') {
      return null;
    }

    const url = `https://t.me/${clean}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
      },
      signal: AbortSignal.timeout(6000)
    });

    if (!response.ok) return null;
    const html = await response.text();

    const ogTitleMatch = html.match(/<meta property="og:title" content="([^"]+)"/i);
    const ogImgMatch = html.match(/<meta property="og:image" content="([^"]+)"/i);
    const extraMatch = html.match(/<div class="tgme_page_extra">([^<]+)<\/div>/i);

    let title = ogTitleMatch ? ogTitleMatch[1].trim() : null;
    if (title && (title === 'Telegram: Contact' || title.startsWith('Telegram: Contact @'))) {
      title = null;
    }

    let avatarUrl = ogImgMatch ? ogImgMatch[1].trim() : null;
    if (avatarUrl && avatarUrl.includes('telegram.org/img/t_logo')) {
      avatarUrl = null;
    }

    let memberCount = 0;
    if (extraMatch) {
      const m = extraMatch[1].replace(/\s+/g, ' ').match(/([\d\s]+)\s+members/i);
      if (m) {
        memberCount = parseInt(m[1].replace(/\s/g, '')) || 0;
      }
    }

    return {
      username: clean,
      title,
      avatarUrl,
      memberCount
    };
  } catch (err) {
    return null;
  }
}

module.exports = { fetchTelegramGroupMeta };
