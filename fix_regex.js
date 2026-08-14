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
  
  // 1. Dọn dẹp văn bản: loại bỏ các con số tiền bạc, độ dài
  const cleanedText = textStr
    .replace(/[\d.,]+\s*(?:tỷ|triệu|ngàn|tỉ)\s*đồng/gi, '')
    .replace(/[\d.,]+\s*km/gi, '')
    .toLowerCase();
    
  console.log("cleanedText:", cleanedText);

  // Pattern A: Match "Tổng diện tích cần GPMB: 2,8 ha" 
  // Rất cụ thể để tránh bị nhầm
  const exactTotalMatch = cleanedText.match(/tổng diện tích cần gpmb[^\d]*([\d.,]+)\s*(?:ha)/i);
  if (exactTotalMatch) {
    total = normalizeNumber(exactTotalMatch[1]);
  }
  const exactClearedMatch = cleanedText.match(/diện tích đã hoàn thành[^\d]*([\d.,]+)\s*(?:ha)/i);
  if (exactClearedMatch) {
    cleared = normalizeNumber(exactClearedMatch[1]);
  }
  
  if (total > 0 || cleared > 0) return { total, cleared };
  
  return { total, cleared };
}
console.log(extractAreaFromText("1. Về công tác GPMB Tổng diện tích cần GPMB: 2,8 ha. Diện tích đã hoàn thành (bàn giao): 1,2 ha."));
