/**
 * Halal Data - Ingredients list based on JHF/JHA standards
 * Leveling system inspired by Halal Japan:
 * LV1: Certified Halal
 * LV2: No doubtful/haram ingredients, no shared lines
 * LV3: Ingredients OK but generic shared production line
 * D: Contains doubtful (syubhat) ingredients
 * HR1: Ingredients OK but production line contaminated with animal fats/pork
 * HR2: Contains direct haram ingredients (pork, alcohol, etc.)
 */

export const HARAM_LIST = [
  // Pork related
  "豚", "豚肉", "ポーク", "pork",
  "豚脂", "ラード", "lard",
  "豚エキス", "ポークエキス", "pork extract",
  "ポークパウダー", "pork powder",

  // Alcohol related
  "酒", "清酒", "sake",
  "みりん", "味醂", "mirin",
  "ワイン", "wine",
  "ブランディ", "brandy",
  "ラム酒", "rum",
  "洋酒", "liquor",
  "アルコール", "alcohol",
  "酒精", "ethyl alcohol",
  "ビール", "beer",
  "ワインビネガー", "wine vinegar", // often contains residual alcohol

  // Meat (non-halal certified meat is HR2 in Japan context)
  "牛肉", "beef", "牛エキス", "beef extract",
  "鶏肉", "chicken", "チキンエキス", "chicken extract",
  "肉エキス", "meat extract",
  "動物油脂", "animal fat",

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
  "アミノ酸等", "amino acids etc",
  "グリセリン", "glycerin",
  "香料", "flavoring", // can contain alcohol as carrier
  "増粘多糖類", "thickener", // rarely animal but sometimes
  "イーストフード", "yeast food"
];

// Special warnings for cross-contamination
export const CONTAMINATION_WARNINGS = [
  { keywords: ["豚", "ポーク"], level: "HR1", label: "Contaminated with Pork/Lard" },
  { keywords: ["肉", "動物"], level: "HR1", label: "Contaminated with Animal Meat/Fat" },
  { keywords: ["本品製造工場では"], level: "LV3", label: "Shared Production Line" }
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
  "ゼラチン": "Gelatin (Haram/Animal)",
  "マーガリン": "Margarine (Doubtful)",
  "牛肉": "Beef",
  "鶏肉": "Chicken",
  "アミノ酸等": "Amino Acids (Doubtful)"
};

export function detectHalalStatus(ingredientsString, isCertified = false) {
  if (!ingredientsString) return { status: 'UNKNOWN', level: '?', matches: [] };

  const lowerIngredients = ingredientsString.toLowerCase();

  // 1. Check for Certification (LV1)
  if (isCertified || lowerIngredients.includes("ハラール認証") || lowerIngredients.includes("halal certified")) {
    return { status: 'HALAL', level: 'LV1', label: 'Halal Certified', matches: [] };
  }

  const foundHaram = [];
  const foundSyubhat = [];

  // 2. Scan for Direct Haram (HR2)
  HARAM_LIST.forEach(item => {
    if (lowerIngredients.includes(item)) {
      foundHaram.push({
        name: item,
        translation: TRANSLATIONS[item] || item,
        type: 'HARAM'
      });
    }
  });

  if (foundHaram.length > 0) {
    return { status: 'HARAM', level: 'HR2', label: 'Haram Content', matches: foundHaram };
  }

  // 3. Scan for Syubhat (D)
  SYUBHAT_LIST.forEach(item => {
    if (lowerIngredients.includes(item)) {
      foundSyubhat.push({
        name: item,
        translation: TRANSLATIONS[item] || item,
        type: 'SYUBHAT'
      });
    }
  });

  if (foundSyubhat.length > 0) {
    return { status: 'SYUBHAT', level: 'D', label: 'Doubtful Ingredients', matches: foundSyubhat };
  }

  // 4. Scan for Contamination/Shared Lines (HR1, LV3)
  for (const warning of CONTAMINATION_WARNINGS) {
    // Check if the overall context contains the warning pattern
    if (lowerIngredients.includes("本品製造工場では") || lowerIngredients.includes("製造ラインでは")) {
      // More specific check for pork/meat in shared line
      if (warning.keywords.some(k => lowerIngredients.includes(k))) {
        return { status: warning.level === 'HR1' ? 'HARAM' : 'HALAL', level: warning.level, label: warning.label, matches: [] };
      }
      // Generic shared line if no specific animal keywords found yet
      return { status: 'HALAL', level: 'LV3', label: 'Shared Production Line', matches: [] };
    }
  }

  // 5. Likely Halal (LV2)
  return { status: 'HALAL', level: 'LV2', label: 'No Restricted Ingredients', matches: [] };
}
