// src/app/actions.ts
"use server";

// Explicitly import and re-export from submodules
import { performInitialFetch as _performInitialFetch } from './actions/fetch';
import { performAiAnalysisOnContent as _performAiAnalysisOnContent } from './actions/analysis';
import { postToXWithImageViaAPI as _postToXWithImageViaAPI, getXApiConfig as _getXApiConfig } from './actions/post';
import { triggerScheduledQuickPublish as _triggerScheduledQuickPublish } from './actions/publish';

// Import the AI image generation flow and its types
import { generateCommentaryImage } from '@/ai/flows/generate-commentary-image-flow';
import type { GenerateCommentaryImageInput, GenerateCommentaryImageOutput } from '@/ai/types'; // Types from ai/types
import type { GenerateAiImageResult, InfoImageData, GenerateInfoImageResult } from './actions/types'; // Result type from actions/types

// Import server-side canvas image generator service
import { generateInfoImageService } from '@/services/canvas-image-generator';


// Server Action functions re-export
export const performInitialFetch = _performInitialFetch;
export const performAiAnalysisOnContent = _performAiAnalysisOnContent;
export const postToXWithImageViaAPI = _postToXWithImageViaAPI;
export const getXApiConfig = _getXApiConfig;
export const triggerScheduledQuickPublish = _triggerScheduledQuickPublish;

// Server Action for AI Image Generation (based on commentary)
export async function generateAiCommentaryImageAction(
  commentaryText: string,
  language: 'zh' | 'en',
  englishArticleTitles?: string,
): Promise<GenerateAiImageResult> {
  console.log(`[Server Action - generateAiCommentaryImageAction] Initiating AI image generation for ${language} commentary. Titles hint: ${englishArticleTitles ? 'Yes' : 'No'}`);
  if (!commentaryText || !commentaryText.trim()) {
    return { imageDataUri: null, error: "Commentary text cannot be empty." };
  }
  try {
    const input: GenerateCommentaryImageInput = { commentaryText, language, englishArticleTitles };
    const result: GenerateCommentaryImageOutput = await generateCommentaryImage(input);
    if (result && result.imageDataUri) {
      console.log('[Server Action - generateAiCommentaryImageAction] AI image generated successfully.');
      return { imageDataUri: result.imageDataUri };
    } else {
      console.error('[Server Action - generateAiCommentaryImageAction] AI image generation flow returned no data URI.');
      const flowError = (result as any)?.error || "AI image generation returned no data.";
      return { imageDataUri: null, error: flowError };
    }
  } catch (error: any) {
    console.error('[Server Action - generateAiCommentaryImageAction] Error during AI image generation:', error);
    const errorMessage = error.message || "An unknown error occurred during AI image generation.";
    return { imageDataUri: null, error: errorMessage };
  }
}

// New Server Action for Canvas-based Info Image Generation
export async function generateInfoImageAction(
  data: InfoImageData,
  language: 'zh' | 'en'
): Promise<GenerateInfoImageResult> {
  console.log(`[Server Action - generateInfoImageAction] Initiating Canvas info image generation for ${language}. Date: ${data.fetchedDate}`);
  if (!data.fetchedDate) {
    return { imageDataUri: null, error: "Fetched date is required for info image." };
  }
  try {
    const imageDataUri = await generateInfoImageService(data, language);
    if (imageDataUri) {
      console.log(`[Server Action - generateInfoImageAction] Canvas info image for ${language} generated successfully.`);
      return { imageDataUri };
    } else {
      console.error(`[Server Action - generateInfoImageAction] Canvas info image generation for ${language} returned no data URI.`);
      return { imageDataUri: null, error: "Canvas info image generation returned no data." };
    }
  } catch (error: any) {
    console.error(`[Server Action - generateInfoImageAction] Error during canvas info image generation for ${language}:`, error);
    const errorMessage = error.message || "An unknown error occurred during canvas info image generation.";
    return { imageDataUri: null, error: errorMessage };
  }
}
