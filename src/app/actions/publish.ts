
// src/app/actions/publish.ts
"use server";

import { performInitialFetch } from './fetch';
import { performAiAnalysisOnContent } from './analysis';
import { postToXWithImageViaAPI } from './post';
import { generateAiCommentaryImageAction, generateInfoImageAction } from '../actions';
import { serverFormatCommentaryForPosting, formatDateForCommentary } from '@/lib/server-formatting';
import { format as formatDateFns, parse } from 'date-fns';

import type { InitialFetchResult, AiAnalysisData, PostToXViaApiResult, GenerateAiImageResult, ScheduledQuickPublishResult, InfoImageData } from './types';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const MAX_TITLES_FOR_INFO_IMAGE_QUICK_PUBLISH = 15;
const POST_DELAY_MS = 2000; // 2 seconds

export async function triggerScheduledQuickPublish(targetDate: Date): Promise<ScheduledQuickPublishResult> {
  console.log(`[Quick Publish] Starting for date: ${targetDate.toISOString().split('T')[0]}`);
  const dateParam = formatDateFns(targetDate, "yyyy-MM-dd");
  let resultMessage = "";
  let overallSuccess = true;
  let fetchedArticlesCount: number | undefined;
  let analysisPerformed = false;
  let englishCommentaryGenerated = false;
  let chineseCommentaryGenerated = false;
  let masterAiImageGenerated = false;
  let chineseInfoImageGenerated = false;
  let englishInfoImageGenerated = false;

  let masterAiImageUrlForQuickPublish: string | null = null;
  let chineseInfoImageUrlForQuickPublish: string | null = null;
  let englishInfoImageUrlForQuickPublish: string | null = null;

  let chineseBundleTweetUrl: string | undefined;
  let englishBundleTweetUrl: string | undefined;
  let masterAiImageTweetUrl: string | undefined;

  let errorDetails = "";
  let fetchedDateForCommentary: string | undefined;
  let englishCommentaryContentForState: string | undefined;
  let chineseCommentaryContentForState: string | undefined;


  try {
    // Step 1: Fetch Content
    console.log(`[Quick Publish] Step 1/5: Fetching front-page content for ${dateParam}...`);
    const fetchResult: InitialFetchResult = await performInitialFetch(dateParam, true); // Fetch ONLY front page
    fetchedArticlesCount = fetchResult.articles?.length;
    fetchedDateForCommentary = fetchResult.fetchedDate; // YYYYMMDD

    if (fetchResult.error || !fetchResult.articles || fetchResult.articles.length === 0) {
      const errorMsg = fetchResult.error || "Failed to fetch articles or no articles found.";
      console.error(`[Quick Publish] Fetch failed: ${errorMsg}`);
      return { success: false, message: `Fetch failed: ${errorMsg}`, fetchedArticlesCount };
    }
    console.log(`[Quick Publish] Fetch complete. Found ${fetchResult.articles.length} articles from front page.`);

    // Step 2: AI Analysis
    console.log(`[Quick Publish] Step 2/5: Performing AI analysis...`);
    const analysisResult: AiAnalysisData = await performAiAnalysisOnContent(fetchResult.articles, undefined);
    analysisPerformed = true;

    if (analysisResult.englishCommentary && analysisResult.englishCommentary.trim()) {
      englishCommentaryGenerated = true;
      englishCommentaryContentForState = analysisResult.englishCommentary;
    }
    if (analysisResult.commentary && analysisResult.commentary.trim()) {
      chineseCommentaryGenerated = true;
      chineseCommentaryContentForState = analysisResult.commentary;
    }

    if (analysisResult.error && (!englishCommentaryGenerated && !chineseCommentaryGenerated)) {
      const errorMsg = analysisResult.error || "AI Analysis failed to produce any commentary.";
      console.error(`[Quick Publish] Comprehensive analysis failed: ${errorMsg}`);
      errorDetails += `Analysis Error: ${errorMsg}\n`;
      // Don't return yet, might still be able to generate info images if scores exist
    } else if (analysisResult.error) {
      console.warn(`[Quick Publish] Partial analysis error (commentaries might be affected): ${analysisResult.error}`);
      errorDetails += `Partial Analysis Error: ${analysisResult.error}\n`;
    }
    console.log(`[Quick Publish] AI analysis complete. English Commentary: ${englishCommentaryGenerated}, Chinese Commentary: ${chineseCommentaryGenerated}.`);

    // Step 3: Generate Images (AI Master, Chinese Info, English Info)
    console.log(`[Quick Publish] Step 3/5: Generating all images...`);
    const formattedFetchDateForInfoImage = fetchedDateForCommentary ? formatDateForCommentary(fetchedDateForCommentary) : 'N/A'; // YYYY-MM-DD

    // Collect titles for Info Images
    let allRelevantChineseTitles: string[] = [];
    let allRelevantEnglishTitles: string[] = [];
    if (analysisResult.articleCategories) {
      const xiArticles = analysisResult.articleCategories.articlesWithXi || [];
      const otherArticles = analysisResult.articleCategories.otherAnalyzedArticles || [];
      const combined = [...xiArticles, ...otherArticles];

      allRelevantChineseTitles = combined.map(article => article.title).filter(title => title && title.trim() !== "").slice(0, MAX_TITLES_FOR_INFO_IMAGE_QUICK_PUBLISH);
      allRelevantEnglishTitles = combined.map(article => analysisResult.articleEnglishTitlesMap?.[article.title] || article.title).filter(title => title && title.trim() !== "").slice(0, MAX_TITLES_FOR_INFO_IMAGE_QUICK_PUBLISH);
    } else if (fetchResult.articles) { // Fallback if categories are missing but articles exist
      allRelevantChineseTitles = fetchResult.articles.map(a => a.title).filter(Boolean).slice(0, MAX_TITLES_FOR_INFO_IMAGE_QUICK_PUBLISH);
      allRelevantEnglishTitles = fetchResult.articles.map(a => analysisResult.articleEnglishTitlesMap?.[a.title] || a.title).filter(Boolean).slice(0, MAX_TITLES_FOR_INFO_IMAGE_QUICK_PUBLISH);
    }

    const commonInfoImageData: Omit<InfoImageData, 'articleTitles'> = {
      fetchedDate: formattedFetchDateForInfoImage,
      xiJinpingUniqueTitleMentions: analysisResult.xiJinpingUniqueTitleMentions,
      xiJinpingUniqueBodyMentions: analysisResult.xiJinpingUniqueBodyMentions,
      xiIndex: (analysisResult.xiJinpingTitleCount ?? 0) + (analysisResult.xiJinpingBodyCount ?? 0)
    };

    const imageGenPromises = [];
    // Master AI Image (from English commentary)
    if (englishCommentaryGenerated && analysisResult.englishCommentary) {
      const englishTitlesString = allRelevantEnglishTitles.join('; ');
      imageGenPromises.push(
        generateAiCommentaryImageAction(analysisResult.englishCommentary, 'en', englishTitlesString)
          .then(res => { masterAiImageUrlForQuickPublish = res.imageDataUri; masterAiImageGenerated = !!res.imageDataUri; if (res.error) errorDetails += `Master AI Img: ${res.error}. `; })
          .catch(e => { errorDetails += `Master AI Img Call: ${e.message}. `; })
      );
    }
    // Chinese Info Image
    if (analysisResult.xiJinpingUniqueTitleMentions) { // Check if analysis ran enough to produce scores
      imageGenPromises.push(
        generateInfoImageAction({ ...commonInfoImageData, articleTitles: allRelevantChineseTitles }, 'zh')
          .then(res => { chineseInfoImageUrlForQuickPublish = res.imageDataUri; chineseInfoImageGenerated = !!res.imageDataUri; if (res.error) errorDetails += `CH Info Img: ${res.error}. `; })
          .catch(e => { errorDetails += `CH Info Img Call: ${e.message}. `; })
      );
    }
    // English Info Image
    if (analysisResult.xiJinpingUniqueBodyMentions) { // Check if analysis ran enough to produce scores
      imageGenPromises.push(
        generateInfoImageAction({ ...commonInfoImageData, articleTitles: allRelevantEnglishTitles }, 'en')
          .then(res => { englishInfoImageUrlForQuickPublish = res.imageDataUri; englishInfoImageGenerated = !!res.imageDataUri; if (res.error) errorDetails += `EN Info Img: ${res.error}. `; })
          .catch(e => { errorDetails += `EN Info Img Call: ${e.message}. `; })
      );
    }

    await Promise.allSettled(imageGenPromises);
    console.log(`[Quick Publish] Image generation step complete. Master AI: ${masterAiImageGenerated}, CH Info: ${chineseInfoImageGenerated}, EN Info: ${englishInfoImageGenerated}.`);


    // Step 4 & 5: Post to X
    console.log(`[Quick Publish] Step 4/5: Posting Chinese bundle...`);
    if (chineseCommentaryGenerated && analysisResult.commentary && chineseInfoImageUrlForQuickPublish) {
      const formattedChineseCommentary = serverFormatCommentaryForPosting(analysisResult.commentary, fetchedDateForCommentary, 'zh');
      const postResult = await postToXWithImageViaAPI(formattedChineseCommentary, chineseInfoImageUrlForQuickPublish);
      if (postResult.success) {
        resultMessage += `CH Bundle: ${postResult.message} `;
        chineseBundleTweetUrl = postResult.tweetUrl;
      } else {
        resultMessage += `CH Bundle Fail: ${postResult.message}. `;
        errorDetails += `CH Post: ${postResult.message}. `;
        overallSuccess = false;
      }
    } else {
      resultMessage += "Skipped Chinese bundle (missing commentary or info image). ";
      if (chineseCommentaryGenerated && !chineseInfoImageUrlForQuickPublish) errorDetails += "CH Post: Missing Info Image. ";
      else if (!chineseCommentaryGenerated) errorDetails += "CH Post: Missing Commentary. ";
    }

    if (overallSuccess) {
      console.log(`[Quick Publish] Step 4.5/5: Posting English bundle (delaying ${POST_DELAY_MS / 1000}s)...`);
      await delay(POST_DELAY_MS);
      if (englishCommentaryGenerated && analysisResult.englishCommentary && englishInfoImageUrlForQuickPublish) {
        const formattedEnglishCommentary = serverFormatCommentaryForPosting(analysisResult.englishCommentary, fetchedDateForCommentary, 'en');
        const postResult = await postToXWithImageViaAPI(formattedEnglishCommentary, englishInfoImageUrlForQuickPublish);
        if (postResult.success) {
          resultMessage += `EN Bundle: ${postResult.message} `;
          englishBundleTweetUrl = postResult.tweetUrl;
        } else {
          resultMessage += `EN Bundle Fail: ${postResult.message}. `;
          errorDetails += `EN Post: ${postResult.message}. `;
          overallSuccess = false;
        }
      } else {
        resultMessage += "Skipped English bundle (missing commentary or info image). ";
        if (englishCommentaryGenerated && !englishInfoImageUrlForQuickPublish) errorDetails += "EN Post: Missing Info Image. ";
        else if (!englishCommentaryGenerated) errorDetails += "EN Post: Missing Commentary. ";
      }
    } else {
      resultMessage += "Skipped English bundle due to previous error. ";
    }

    if (overallSuccess) {
      console.log(`[Quick Publish] Step 5/5: Posting Master AI Image (delaying ${POST_DELAY_MS / 1000}s)...`);
      await delay(POST_DELAY_MS);
      if (masterAiImageGenerated && masterAiImageUrlForQuickPublish) {
        let caption = "人民日报总结";
        if (fetchedDateForCommentary) {
          const zhDate = formatDateForCommentary(fetchedDateForCommentary);
          let enDate = zhDate;
          try {
            const parsed = parse(zhDate, 'yyyy-MM-dd', new Date());
            enDate = formatDateFns(parsed, 'dd-MM-yyyy');
          } catch { }
          caption = `北京时间 ${zhDate} 人民日报总结\nBeijing Time ${enDate} People's Daily Summary`;
        }
        const postResult = await postToXWithImageViaAPI(caption, masterAiImageUrlForQuickPublish);
        if (postResult.success) {
          resultMessage += `AI Img: ${postResult.message} `;
          masterAiImageTweetUrl = postResult.tweetUrl;
        } else {
          resultMessage += `AI Img Fail: ${postResult.message}. `;
          errorDetails += `AI Img Post: ${postResult.message}. `;
          overallSuccess = false;
        }
      } else {
        resultMessage += "Skipped AI Master Image post (image not generated). ";
        if (!masterAiImageGenerated) errorDetails += "AI Img Post: Image not generated. ";
      }
    } else {
      resultMessage += "Skipped AI Master Image post due to previous error. ";
    }

    if (resultMessage.trim() === "") {
      resultMessage = "Quick Publish: No content was eligible for posting.";
    }
    if (!overallSuccess && !resultMessage.toLowerCase().includes("fail")) {
      resultMessage = "Quick Publish completed with issues. " + resultMessage;
    }

    return {
      success: overallSuccess,
      message: resultMessage.trim() || (overallSuccess ? "Quick Publish completed." : "Quick Publish completed with issues."),
      fetchedArticlesCount,
      analysisPerformed,
      englishCommentaryGenerated,
      chineseCommentaryGenerated,
      masterAiImageGenerated,
      chineseInfoImageGenerated,
      englishInfoImageGenerated,
      chineseBundleTweetUrl,
      englishBundleTweetUrl,
      masterAiImageTweetUrl,
      errorDetails: errorDetails.trim() || undefined,
      masterAiImageUrlForQuickPublish,
      chineseInfoImageUrlForQuickPublish,
      englishInfoImageUrlForQuickPublish,
      fetchedDateForCommentary,
      englishCommentaryContent: englishCommentaryContentForState,
      chineseCommentaryContent: chineseCommentaryContentForState,
    };

  } catch (error: any) {
    console.error("[Quick Publish] Critical error in workflow:", error);
    return {
      success: false,
      message: `Critical error: ${error.message || "Unknown error"}`,
      fetchedArticlesCount,
      analysisPerformed,
      errorDetails: `Critical: ${error.message || "Unknown error"}`
    };
  }
}

