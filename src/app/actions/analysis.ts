// src/app/actions/analysis.ts
"use server";

import type { GenerateCommentaryOutput as AiGenerateCommentaryOutput, GenerateCommentaryInput as AiGenerateCommentaryInput } from '@/ai/types'; // Corrected type import
import { generateCommentary } from '@/ai/flows/generate-commentary';
import type { GenerateEnglishCommentaryOutput as AiGenerateEnglishCommentaryOutput, GenerateEnglishCommentaryInput as AiGenerateEnglishCommentaryInput } from '@/ai/types'; // Corrected type import
import { generateEnglishCommentary } from '@/ai/flows/generate-english-commentary';
import type { TranslateTitlesToEnglishOutput as AiTranslateTitlesToEnglishOutput } from '@/ai/types'; // Corrected type import
import { translateTitlesToEnglish } from '@/ai/flows/translate-titles-flow';

import type { FetchedArticle, AiAnalysisData, ArticleCategorization } from './types'; // Import types from new types file

export async function performAiAnalysisOnContent(
  articlesToAnalyzeInput: FetchedArticle[],
  customAnalysisContext?: string,
  fetchedDateForSnapshot?: string, // This param is no longer used for snapshot, kept for signature consistency if other logic relies on it
): Promise<AiAnalysisData> {
  if (!articlesToAnalyzeInput || articlesToAnalyzeInput.length === 0) {
    return { error: "Cannot perform AI analysis on empty or no selected articles." };
  }

  const originalTitles = articlesToAnalyzeInput.map(article => article.title);
  let translatedTitles: string[] = [];
  const articleEnglishTitlesMap: Record<string, string> = {};


  if (originalTitles.length > 0) {
    try {
      console.log(`[AI Analysis] Attempting to translate ${originalTitles.length} titles in batch.`);
      const translationResult: AiTranslateTitlesToEnglishOutput = await translateTitlesToEnglish({ titles: originalTitles });
      translatedTitles = translationResult.translatedTitles;
      console.log(`[AI Analysis] Batch title translation successful. Received ${translatedTitles.length} translations.`);
      if (translatedTitles.length !== originalTitles.length) {
        console.warn(`[AI Analysis] Batch title translation count mismatch: Expected ${originalTitles.length}, got ${translatedTitles.length}. Filling missing translations with original titles or empty strings.`);
        const newTranslatedTitles = new Array(originalTitles.length);
        for (let i = 0; i < originalTitles.length; i++) {
          newTranslatedTitles[i] = translatedTitles[i] !== undefined ? translatedTitles[i] : (originalTitles[i] || "");
        }
        translatedTitles = newTranslatedTitles;
      }
      articlesToAnalyzeInput.forEach((article, index) => {
        if (translatedTitles[index] && translatedTitles[index] !== article.title) {
          articleEnglishTitlesMap[article.title] = translatedTitles[index];
        }
      });

    } catch (e: any) {
      console.warn(`[AI Analysis] Batch title translation failed: ${e.message}. Using original titles for all or empty strings if original was empty.`);
      translatedTitles = originalTitles.map(title => title || "");
    }
  }

  const articlesToAnalyze: FetchedArticle[] = articlesToAnalyzeInput.map((article, index) => ({
    ...article,
    englishTitle: translatedTitles[index] || article.title,
  }));


  const combinedContent = articlesToAnalyze.map(article =>
    `## ${article.title}\n\n${article.content}`
  ).join('\n\n-----\n\n');

  if (!combinedContent.trim()) {
    return { error: "Combined article content is empty. Cannot perform AI analysis." };
  }
  console.log(`[AI Analysis] Combined content prepared for AI flows. Length: ${combinedContent.length}`);

  try {
    console.log("[AI Analysis] Starting core AI analysis flows (commentaries)...");
    
    const countOccurrences = (text: string, keyword: string): number => {
      if (!keyword || keyword.trim() === "") return 0;
      try {
        const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escapedKeyword, 'gi');
        const matches = text.match(regex);
        return matches ? matches.length : 0;
      } catch (e) {
        console.error(`Error creating regex for keyword: ${keyword}`, e);
        return 0;
      }
    };

    let xiJinpingTitleCount = 0;
    let xiJinpingBodyCount = 0;
    let xiJinpingUniqueTitleMentions = 0;
    let xiJinpingUniqueBodyMentions = 0;
    const xiJinpingKeyword = "习近平";

    articlesToAnalyze.forEach(article => {
      const titleOccurrences = countOccurrences(article.title, xiJinpingKeyword);
      const bodyOccurrences = countOccurrences(article.content, xiJinpingKeyword);

      xiJinpingTitleCount += titleOccurrences;
      xiJinpingBodyCount += bodyOccurrences;

      if (titleOccurrences > 0) {
        xiJinpingUniqueTitleMentions++;
      }
      if (bodyOccurrences > 0) {
        xiJinpingUniqueBodyMentions++;
      }
    });

    console.log(`[AI Analysis] "习近平" count in titles: ${xiJinpingTitleCount}, unique: ${xiJinpingUniqueTitleMentions}`);
    console.log(`[AI Analysis] "习近平" count in bodies: ${xiJinpingBodyCount}, unique: ${xiJinpingUniqueBodyMentions}`);

    const articlesWithXi: FetchedArticle[] = [];
    const articlesWithOnlyXiFaction: FetchedArticle[] = []; // This will now be unused but kept for type consistency for now
    const otherAnalyzedArticlesBuffer: FetchedArticle[] = [];

    articlesToAnalyze.forEach(article => {
      const mentionsXiInBody = countOccurrences(article.content, xiJinpingKeyword) > 0;
      const mentionsXiInTitle = countOccurrences(article.title, xiJinpingKeyword) > 0;

      if (mentionsXiInBody || mentionsXiInTitle) {
        articlesWithXi.push(article);
      } else {
        otherAnalyzedArticlesBuffer.push(article);
      }
    });

    const articleCategories: ArticleCategorization = {
      articlesWithXi,
      articlesWithOnlyXiFaction: [], // No longer categorizing by faction
      otherAnalyzedArticles: otherAnalyzedArticlesBuffer,
    };
    console.log(`[AI Analysis] Articles categorized. With Xi: ${articlesWithXi.length}, Other: ${otherAnalyzedArticlesBuffer.length}`);

    const parseScore = (scoreString: string): number => {
      const parts = scoreString.split('/').map(Number);
      return parts.length === 2 ? parts[0] : 0;
    };

    const titleScore = parseScore(`${xiJinpingTitleCount}/${articlesToAnalyze.length > 0 ? articlesToAnalyze.length : 1}`);
    const bodyScore = parseScore(`${xiJinpingBodyCount}/${articlesToAnalyze.length > 0 ? articlesToAnalyze.length : 1}`);
    const xiIndexScore = titleScore + bodyScore;

    const commonCommentaryInput: AiGenerateCommentaryInput & AiGenerateEnglishCommentaryInput = {
      title: articlesToAnalyzeInput.map(article => article.title).join('; '),
      customContext: customAnalysisContext || undefined,
      titleXiJinpingContentScore: `${xiJinpingTitleCount}/${articlesToAnalyze.length > 0 ? articlesToAnalyze.length : 1}`,
      bodyXiJinpingContentScore: `${xiJinpingBodyCount}/${articlesToAnalyze.length > 0 ? articlesToAnalyze.length : 1}`,
      titleXiJinpingUniqueMentions: `${xiJinpingUniqueTitleMentions}/${articlesToAnalyze.length > 0 ? articlesToAnalyze.length : 1}`,
      bodyXiJinpingUniqueMentions: `${xiJinpingUniqueBodyMentions}/${articlesToAnalyze.length > 0 ? articlesToAnalyze.length : 1}`,
      xiIndexScore: xiIndexScore,
    };
    console.log("[AI Analysis] Input prepared for commentary generation flows.");


    const [chineseCommentaryResult, englishCommentaryResult] = await Promise.allSettled([
      generateCommentary(commonCommentaryInput),
      generateEnglishCommentary(commonCommentaryInput)
    ]);
    console.log("[AI Analysis] Commentary generation flows (Chinese and English) attempted.");


    let finalChineseCommentary: string | undefined = undefined;
    let finalEnglishCommentary: string | undefined = undefined;
    let combinedError: string | undefined = undefined;

    if (chineseCommentaryResult.status === 'fulfilled' && chineseCommentaryResult.value?.commentary) {
      finalChineseCommentary = chineseCommentaryResult.value.commentary;
      console.log("[AI Analysis] Chinese commentary generated successfully.");
    } else {
      const errorMsg = chineseCommentaryResult.status === 'rejected' ? (chineseCommentaryResult.reason as Error)?.message : "Chinese commentary generation failed or returned no content.";
      console.warn(`[AI Analysis] Chinese Commentary Error: ${errorMsg}`);
      combinedError = (combinedError ? combinedError + "\n" : "") + `Chinese: ${errorMsg}`;
    }

    if (englishCommentaryResult.status === 'fulfilled' && englishCommentaryResult.value?.englishCommentary) {
      finalEnglishCommentary = englishCommentaryResult.value.englishCommentary;
      console.log("[AI Analysis] English commentary generated successfully.");
    } else {
      const errorMsg = englishCommentaryResult.status === 'rejected' ? (englishCommentaryResult.reason as Error)?.message : "English commentary generation failed or returned no content.";
      console.warn(`[AI Analysis] English Commentary Error: ${errorMsg}`);
      combinedError = (combinedError ? combinedError + "\n" : "") + `English: ${errorMsg}`;
    }

    if (!finalChineseCommentary && !finalEnglishCommentary && combinedError) {
      console.error("[AI Analysis] All commentary generation failed. Returning error and partial data.");
      return {
        error: `All commentary generation failed.\n${combinedError}`,
        articleCategories: articleCategories,
        xiJinpingTitleCount: xiJinpingTitleCount,
        xiJinpingBodyCount: xiJinpingBodyCount,
        xiJinpingUniqueTitleMentions: xiJinpingUniqueTitleMentions,
        xiJinpingUniqueBodyMentions: xiJinpingUniqueBodyMentions,
        articleEnglishTitlesMap: articleEnglishTitlesMap,
      };
    }
    console.log("[AI Analysis] AI Analysis pipeline complete.");


    return {
      commentary: finalChineseCommentary,
      englishCommentary: finalEnglishCommentary,
      articleCategories: articleCategories,
      xiJinpingTitleCount: xiJinpingTitleCount,
      xiJinpingBodyCount: xiJinpingBodyCount,
      xiJinpingUniqueTitleMentions: xiJinpingUniqueTitleMentions,
      xiJinpingUniqueBodyMentions: xiJinpingUniqueBodyMentions,
      articleEnglishTitlesMap: articleEnglishTitlesMap,
      error: combinedError,
    };
  } catch (err) {
    console.error("[AI Analysis] Critical error during AI analysis pipeline:", err);
    const errorMessage = err instanceof Error ? err.message : "An unknown critical error occurred during AI analysis.";
    return { error: errorMessage };
  }
}
