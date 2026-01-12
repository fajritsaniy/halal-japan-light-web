/**
 * Halal Data - Ingredients list based on JHF/JHA standards
 */

export const HARAM_LIST = [
  // Pork related
  "豚", "豚肉", "ポーク", "pork", 
  "豚脂", "ラード", "lard",
  "豚エキス", "ポークエキス", "pork extract",
  
  // Alcohol related
  "酒", "清酒", "sake",
  "みりん", "味醂", "mirin",
  "ワイン", "wine",
  "ブランディ", "brandy", 
  "ラム酒", "rum",
  "洋酒", "liquor",
  "アルコール", "alcohol",
  "酒精", "ethyl alcohol",
  
  // Gelatin (unless specified)
  "ゼラチン", "gelatin"
];

export const SYUBHAT_LIST = [
  "ショートニング", "shortening",
  "乳化剤", "emulsifier",
  "マーガリン", "margarine",
  "油脂", "fat",
  "ファットスプレッド", "fat spread",
  "コラーゲンペプチド", "collagen peptide",
  "加工油脂", "processed fat",
  "アミノ酸", "amino acid", // often animal derived in Japan if MSG not specified
  "グリセリン", "glycerin",
  "香料", "flavoring" // can contain alcohol as carrier
];

export const TRANSLATIONS = {
  "豚肉": "Pork",
  "豚脂": "Pork Fat",
  "ラード": "Lard",
  "ポークエキス": "Pork Extract",
  "酒": "Sake (Alcohol)",
  "みりん": "Mirin (Alcohol)",
  "アルコール": "Alcohol",
  "酒精": "Ethyl Alcohol",
  "ショートニング": "Shortening (Doubtful)",
  "乳化剤": "Emulsifier (Doubtful)",
  "ゼラチン": "Gelatin (Doubtful)",
  "マーガリン": "Margarine (Doubtful)"
};

export function detectHalalStatus(ingredientsString) {
  if (!ingredientsString) return { status: 'UNKNOWN', matches: [] };
  
  const foundHaram = [];
  const foundSyubhat = [];
  
  const lowerIngredients = ingredientsString.toLowerCase();
  
  HARAM_LIST.forEach(item => {
    if (lowerIngredients.includes(item)) {
      foundHaram.push({
        name: item,
        translation: TRANSLATIONS[item] || item,
        type: 'HARAM'
      });
    }
  });
  
  SYUBHAT_LIST.forEach(item => {
    if (lowerIngredients.includes(item)) {
      foundSyubhat.push({
        name: item,
        translation: TRANSLATIONS[item] || item,
        type: 'SYUBHAT'
      });
    }
  });
  
  if (foundHaram.length > 0) {
    return { status: 'HARAM', matches: foundHaram };
  }
  
  if (foundSyubhat.length > 0) {
    return { status: 'SYUBHAT', matches: foundSyubhat };
  }
  
  return { status: 'LIKELY_HALAL', matches: [] };
}
