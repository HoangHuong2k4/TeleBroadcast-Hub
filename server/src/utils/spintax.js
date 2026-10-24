/**
 * Spintax utility — xử lý cú pháp {A|B|C} chọn ngẫu nhiên 1 biến thể
 * Hỗ trợ lồng nhau: {Chào {bạn|anh}|Hello}
 */

/**
 * Unspin một chuỗi spintax → trả về 1 biến thể ngẫu nhiên
 * @param {string} text
 * @returns {string}
 */
function unspin(text) {
  if (!text || typeof text !== 'string') return text;

  // Xử lý đệ quy: tìm cặp {} trong cùng nhất trước
  let result = text;
  let maxIterations = 100; // tránh vòng lặp vô hạn

  while (result.includes('{') && maxIterations-- > 0) {
    // Tìm cặp {} không lồng nhau (innermost)
    result = result.replace(/\{([^{}]+)\}/g, (match, inner) => {
      const options = inner.split('|');
      return options[Math.floor(Math.random() * options.length)];
    });
  }

  return result;
}

/**
 * Tạo nhiều biến thể từ spintax
 * @param {string} text
 * @param {number} count
 * @returns {string[]}
 */
function generateVariants(text, count = 5) {
  const variants = [];
  for (let i = 0; i < count; i++) {
    variants.push(unspin(text));
  }
  return variants;
}

module.exports = { unspin, generateVariants };
