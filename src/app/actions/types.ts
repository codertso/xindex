
// src/app/actions/types.ts
// This file does NOT have "use server"; it's for type definitions only.

// Types previously in src/services/news-fetcher.ts, now defined here:
export interface FetchedArticle {
  title: string;
  englishTitle?: string;
  content: string;
  url: string;
  sourcePageLayoutUrl: string;
}

export interface PageLayoutInfo {
  url: string;
  title: string;
}

export interface FetchedNewsData {
  articles: FetchedArticle[];
  url: string; // URL of the main front page layout (node_01.html)
  date: string; // YYYYMMDD format
  allPageLayouts?: PageLayoutInfo[];
  error?: string;
}

// Types previously in src/app/actions/fetch.ts
export interface InitialFetchResult {
  fetchedUrl?: string;
  fetchedDate?: string; // YYYYMMDD format
  articles?: FetchedArticle[];
  allPageLayouts?: PageLayoutInfo[];
  error?: string;
  fetchOnlyFrontPageUsed?: boolean;
}

// Types previously in src/app/actions/analysis.ts
import type { GenerateCommentaryOutput as AiGenerateCommentaryOutput, GenerateEnglishCommentaryOutput as AiGenerateEnglishCommentaryOutput } from '@/ai/types';

export interface ArticleCategorization {
  articlesWithXi: FetchedArticle[];
  articlesWithOnlyXiFaction: FetchedArticle[];
  otherAnalyzedArticles: FetchedArticle[];
}

export interface AiAnalysisData {
  commentary?: AiGenerateCommentaryOutput['commentary'];
  englishCommentary?: AiGenerateEnglishCommentaryOutput['englishCommentary'];
  articleCategories?: ArticleCategorization;
  xiJinpingTitleCount?: number;
  xiJinpingBodyCount?: number;
  xiJinpingUniqueTitleMentions?: number; // New field for unique mentions in titles
  xiJinpingUniqueBodyMentions?: number; // New field for unique mentions in body
  error?: string;
  articleEnglishTitlesMap?: Record<string, string>; // Maps original title to English title
}

export interface ComprehensiveAnalysisResult extends InitialFetchResult, AiAnalysisData { }


// Types previously in src/app/actions/post.ts
export interface XApiConfig {
  appKey: string;
  appSecret: string;
  accessToken: string;
  accessSecret: string;
}

export interface XApiConfigResult {
  config: XApiConfig | null;
  error: string | null;
}

export interface PostToXViaApiResult {
  success: boolean;
  message: string;
  tweetUrl?: string;
}

// Types previously in src/app/actions/publish.ts
export interface ScheduledQuickPublishResult {
  success: boolean;
  message: string;
  fetchedArticlesCount?: number;
  analysisPerformed?: boolean;
  englishCommentaryGenerated?: boolean;
  chineseCommentaryGenerated?: boolean;
  masterAiImageGenerated?: boolean;
  chineseInfoImageGenerated?: boolean;
  englishInfoImageGenerated?: boolean;

  chineseBundleTweetUrl?: string;
  englishBundleTweetUrl?: string;
  masterAiImageTweetUrl?: string;

  errorDetails?: string;
  masterAiImageUrlForQuickPublish?: string | null;
  chineseInfoImageUrlForQuickPublish?: string | null;
  englishInfoImageUrlForQuickPublish?: string | null;

  fetchedDateForCommentary?: string;
  englishCommentaryContent?: string;
  chineseCommentaryContent?: string;
}

// Type previously in src/app/actions.ts (for AI image generation)
export interface GenerateAiImageResult {
  imageDataUri: string | null;
  error?: string;
}

// Types for server-side canvas Info Image generation
export interface InfoImageData {
  fetchedDate: string; // YYYY-MM-DD format
  xiJinpingUniqueTitleMentions?: number; // New field for unique mentions in titles for info image
  xiJinpingUniqueBodyMentions?: number; // New field for unique mentions in body for info image
  xiIndex: number;
  articleTitles: string[]; // List of relevant article titles (original or English)
}

export interface GenerateInfoImageResult {
  imageDataUri: string | null;
  error?: string;
}

