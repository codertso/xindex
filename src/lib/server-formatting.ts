
// src/lib/server-formatting.ts

const MAX_WEIGHTED_COMMENTARY_LENGTH = 280;

// Helper to get weighted character count (Chinese chars = 2, others = 1)
function getWeightedCharacterCount(text: string): number {
    if (typeof text !== 'string') return 0;
    let count = 0;
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        // Basic check for CJK characters (Unicode range)
        if (char.match(/[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uffef\u4e00-\u9faf\u3400-\u4dbf]/)) {
            count += 2;
        } else {
            count += 1;
        }
    }
    return count;
}

export function formatDateForCommentary(yyyymmdd?: string): string {
    if (!yyyymmdd || yyyymmdd.length !== 8) return yyyymmdd || 'N/A';
    const year = yyyymmdd.substring(0, 4);
    const month = yyyymmdd.substring(4, 6);
    const day = yyyymmdd.substring(6, 8);
    return `${year}-${month}-${day}`;
}

export function serverFormatCommentaryForPosting(
  rawAiCommentary: string | undefined, // This is AI's output e.g. "含习量：..." or "Xi Content:..."
  fetchedDate: string | undefined, // YYYYMMDD format
  language: 'zh' | 'en'
): string {
  if (!rawAiCommentary || !rawAiCommentary.trim()) return '';

  const formattedDisplayDate = formatDateForCommentary(fetchedDate);
  let uiDatePrefix = '';

  if (language === 'zh') {
    uiDatePrefix = fetchedDate
      ? `【人民日报头版总结 ${formattedDisplayDate}】\n`
      : '';
  } else { // 'en'
    uiDatePrefix = fetchedDate
      ? `【People's Daily Front Page Summary ${formattedDisplayDate}】\n`
      : '';
  }

  let combinedCommentary = `${uiDatePrefix}${rawAiCommentary}`;
  
  const currentWeightedLength = getWeightedCharacterCount(combinedCommentary);
  let finalCommentary = combinedCommentary;

  if (currentWeightedLength > MAX_WEIGHTED_COMMENTARY_LENGTH) {
    const parts = combinedCommentary.split('\n');
    // First part is UI Date Prefix, Second part is AI's score prefix + start of analytical text
    // We assume rawAiCommentary starts with its own score prefix line.
    const uiPrefixAndAiScoreHeader = `${parts[0] || ''}\n${parts[1] || ''}`; 
    let analyticalTextFromCombined = parts.slice(2).join('\n');
      
    const uiPrefixAndAiScoreHeaderWeight = getWeightedCharacterCount(uiPrefixAndAiScoreHeader);
    const newlineWeight = analyticalTextFromCombined ? getWeightedCharacterCount('\n') : 0;
    let remainingWeightForAnalytical = MAX_WEIGHTED_COMMENTARY_LENGTH - uiPrefixAndAiScoreHeaderWeight - newlineWeight;

    if (remainingWeightForAnalytical < 0) { // Renamed from <= 0 to < 0 to allow full header if it fits exactly
      // The UI Prefix + AI Score Header part itself is too long or leaves no space. Truncate this combined header.
      let truncatedCombinedHeader = '';
      let currentHeaderWeight = 0;
      for (const char of uiPrefixAndAiScoreHeader) {
        const charWeight = getWeightedCharacterCount(char);
        if (currentHeaderWeight + charWeight > MAX_WEIGHTED_COMMENTARY_LENGTH) break;
        truncatedCombinedHeader += char;
        currentHeaderWeight += charWeight;
      }
      finalCommentary = truncatedCombinedHeader;
    } else {
      // Truncate analytical text
      let truncatedAiAnalyticalText = '';
      let tempAnalyticalFit = '';
      let currentAnalyticalWeight = 0;

      for (const char of analyticalTextFromCombined) {
        const charWeight = getWeightedCharacterCount(char);
        if (currentAnalyticalWeight + charWeight > remainingWeightForAnalytical) break;
        tempAnalyticalFit += char;
        currentAnalyticalWeight += charWeight;
      }
      
      // Try to end on a sentence boundary if possible
      const lastPeriodZh = tempAnalyticalFit.lastIndexOf('。');
      const lastPeriodEn = tempAnalyticalFit.lastIndexOf('.');
      const lastPeriodIndex = Math.max(lastPeriodZh, lastPeriodEn);

      if (lastPeriodIndex !== -1) {
        const textUpToPeriod = tempAnalyticalFit.substring(0, lastPeriodIndex + 1);
        if (getWeightedCharacterCount(textUpToPeriod) <= remainingWeightForAnalytical) {
            truncatedAiAnalyticalText = textUpToPeriod;
        } else { 
             truncatedAiAnalyticalText = tempAnalyticalFit; // Fallback to char-by-char if sentence cut is too long
        }
      } else { 
        truncatedAiAnalyticalText = tempAnalyticalFit;
      }
      
      finalCommentary = `${uiPrefixAndAiScoreHeader}${truncatedAiAnalyticalText ? '\n' + truncatedAiAnalyticalText : ''}`;
    }

    // Final hard trim if somehow still over (should be rare)
    if (getWeightedCharacterCount(finalCommentary) > MAX_WEIGHTED_COMMENTARY_LENGTH) {
      let hardTrimmed = '';
      let weight = 0;
      for (const char of finalCommentary) {
        const charW = getWeightedCharacterCount(char);
        if (weight + charW > MAX_WEIGHTED_COMMENTARY_LENGTH) break;
        hardTrimmed += char;
        weight += charW;
      }
      finalCommentary = hardTrimmed;
    }
  }
  
  // Ensure it's not returning only the prefix if rawAiCommentary was valid but short
  if (finalCommentary.trim() === uiDatePrefix.trim() && rawAiCommentary.trim()) {
    // This case means truncation wiped out the AI content. This shouldn't happen with positive remainingWeight.
    // But as a safeguard, if prefix is all that's left and AI content existed, something is wrong.
    // Return the raw AI content prefixed, truncated to MAX_WEIGHTED_COMMENTARY_LENGTH without fancy sentence logic.
    let safeTruncated = '';
    let safeWeight = 0;
    for (const char of combinedCommentary) {
        const charW = getWeightedCharacterCount(char);
        if (safeWeight + charW > MAX_WEIGHTED_COMMENTARY_LENGTH) break;
        safeTruncated += char;
        safeWeight += charW;
    }
    return safeTruncated;
  }

  return finalCommentary;
}
