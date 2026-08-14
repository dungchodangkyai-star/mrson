function normalizeNumber(val) {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  let str = String(val).trim();
  if (!str) return 0;
  str = str.replace(/[^\d.,-]/g, '');
  if (str.includes(',') && str.includes('.')) {
    str = str.replace(/\./g, '').replace(',', '.');
  } else if (str.includes(',')) {
    str = str.replace(',', '.');
  }
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}
function extractAreaFromText(textStr) {
  if (!textStr) return { total: 0, cleared: 0 };
  let total = 0;
  let cleared = 0;
  const cleanedText = textStr
    .replace(/[\d.,]+\s*(?:tỷ|triệu|ngàn|tỉ)\s*đồng/gi, '')
    .replace(/[\d.,]+\s*km/gi, '');
  
  const slashMatch = cleanedText.match(/([\d.,]+)\s*(?:ha|m2|m²)?\s*[\/|trên]\s*([\d.,]+)\s*(ha|m2|m²)/i);
  if (slashMatch) {
    let cVal = normalizeNumber(slashMatch[1]);
    let tVal = normalizeNumber(slashMatch[2]);
    const unit = (slashMatch[3] || '').toLowerCase();
    if (unit.includes('m2') || unit.includes('m²')) {
      cVal = parseFloat((cVal / 10000).toFixed(4));
      tVal = parseFloat((tVal / 10000).toFixed(4));
    }
    if (tVal > 0 || cVal > 0) return { total: tVal, cleared: cVal };
  }

  const totalMatch = cleanedText.match(/(?:tổng|quy mô|diện tích cần gpmb|tổng diện tích)[^\d]*([\d.,]+)\s*(?:ha)/i);
  if (totalMatch) {
    total = normalizeNumber(totalMatch[1]);
  }

  const clearedMatch = cleanedText.match(/(?:đã gpmb|bàn giao|đã bàn giao|hoàn thành|đã hoàn thành)[^\d]*([\d.,]+)\s*(?:ha)/i);
  if (clearedMatch) {
    cleared = normalizeNumber(clearedMatch[1]);
  }

  if (total > 0 || cleared > 0) {
      return { total, cleared };
  }

  const sentenceMatch = cleanedText.match(/đã(?: chi trả| phê duyệt| hoàn thành| bàn giao)[^\d]*([\d.,]+)\s*(?:ha|m2|m²)[^\d]+([\d.,]+)\s*(?:ha|m2|m²)/i);
  if (sentenceMatch) {
    let tVal = normalizeNumber(sentenceMatch[2]);
    let cVal = normalizeNumber(sentenceMatch[1]);
    if (tVal > 0 || cVal > 0) {
      if (cleanedText.match(/m2|m²/i)) {
        tVal = parseFloat((tVal / 10000).toFixed(4));
        cVal = parseFloat((cVal / 10000).toFixed(4));
      }
      return { total: tVal, cleared: cVal };
    }
  }

  return { total, cleared };
}

const input = '1. Về công tác GPMB \n Tổng diện tích cần GPMB: 2,8 ha. \n Diện tích đã hoàn thành (bàn giao): 1,2 ha. \n Diện tích chưa giải phóng (còn lại): 1,6 ha.';
console.log(extractAreaFromText(input));
