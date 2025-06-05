// src/app/actions/post.ts
"use server";

import type { SendTweetV2Params } from 'twitter-api-v2';
import { TwitterApi, EUploadMimeType } from 'twitter-api-v2';
import type { XApiConfig, XApiConfigResult, PostToXViaApiResult } from './types'; // Import types

async function getXApiConfigInternal(): Promise<XApiConfigResult> { // Renamed to avoid export clash
  const config: Partial<XApiConfig> = {
    appKey: process.env.X_APP_KEY,
    appSecret: process.env.X_APP_SECRET,
    accessToken: process.env.X_ACCESS_TOKEN,
    accessSecret: process.env.X_ACCESS_SECRET,
  };

  const requiredFields: (keyof XApiConfig)[] = ['appKey', 'appSecret', 'accessToken', 'accessSecret'];
  const missingOrInvalidFields: string[] = [];

  for (const field of requiredFields) {
    if (!config[field] || typeof config[field] !== 'string' || (config[field] as string).trim() === '') {
      missingOrInvalidFields.push(field);
    }
  }

  if (missingOrInvalidFields.length > 0) {
    const message = `Missing or invalid (empty/non-string) X API environment variables: ${missingOrInvalidFields.map(f => `X_${f.toUpperCase()}`).join(', ')}. Please ensure they are set in your .env file.`;
    console.error(message);
    return { config: null, error: message };
  }

  return { config: config as XApiConfig, error: null };
}

export async function getXApiConfig(): Promise<XApiConfigResult> {
    return getXApiConfigInternal();
}


export async function postToXWithImageViaAPI(
  tweetText: string,
  imageDataUri: string | null
): Promise<PostToXViaApiResult> {
  const configResult = await getXApiConfigInternal();
  if (configResult.error || !configResult.config) {
    return {
      success: false,
      message: configResult.error ?? "X API config is missing or invalid.",
    };
  }
  const config = configResult.config;

  if (!tweetText || !tweetText.trim()) {
    console.warn("[X API Post] Tweet text is empty. Aborting post.");
    return { success: false, message: "Tweet text cannot be empty." };
  }

  let mediaUploadAttempted = false;
  let mediaId: string | undefined = undefined;

  const twitterClient = new TwitterApi({
    appKey: config.appKey,
    appSecret: config.appSecret,
    accessToken: config.accessToken,
    accessSecret: config.accessSecret,
  });
  console.log("[X API Post] Twitter client initialized.");

  if (imageDataUri && typeof imageDataUri === 'string') {
    mediaUploadAttempted = true;
    console.log("[X API Post] imageDataUri received (string), first 100 chars:", imageDataUri.substring(0, 100));

    const parts = imageDataUri.split(',');
    if (parts.length < 2 || typeof parts[0] !== 'string' || !parts[0] || typeof parts[1] !== 'string' || !parts[1].trim()) {
      console.error("[X API Post] Invalid image data URI format. URI (first 100):", imageDataUri.substring(0, 100), "Parts:", parts);
      return { success: false, message: "Invalid image data URI format. Ensure it's a valid base64 data URI with content." };
    }
    const metadata = parts[0];
    const base64Data = parts[1];

    if (metadata === undefined) {
        console.error("[X API Post] CRITICAL: metadata became undefined after split. imageDataUri (first 100):", imageDataUri.substring(0,100), "Parts:", parts);
        return { success: false, message: "Internal error processing image data: metadata became undefined."};
    }

    let imageBuffer;
    try {
      imageBuffer = Buffer.from(base64Data, 'base64');
      console.log("[X API Post] Image buffer created, length:", imageBuffer.length);
      if (imageBuffer.length === 0) {
        console.error("[X API Post] Base64 data resulted in an empty image buffer.");
        return { success: false, message: "Image data is empty after base64 decoding." };
      }
    } catch (bufferError: any) {
      console.error("[X API Post] Error creating buffer from base64 data:", bufferError.message);
      return { success: false, message: `Error processing image data: ${bufferError.message}` };
    }

    let selectedMimeType = EUploadMimeType.Png;
    if (typeof metadata === 'string' && metadata) {
      try {
        if (metadata.includes('image/jpeg') || metadata.includes('image/jpg')) {
          selectedMimeType = EUploadMimeType.Jpeg;
        } else if (metadata.includes('image/gif')) {
          selectedMimeType = EUploadMimeType.Gif;
        } else if (metadata.includes('image/webp')) {
          selectedMimeType = EUploadMimeType.Webp;
        }
      } catch (e: any) {
        console.error(`[X API Post] Error during MIME type detection from metadata string "${metadata}": ${e.message}. Defaulting to PNG.`);
      }
    } else {
      console.warn(`[X API Post] imageDataUri metadata part ('${metadata}') was not a non-empty string. Defaulting to PNG for MIME type.`);
    }
    console.log(`[X API Post] Using MIME type: ${selectedMimeType} for upload.`);


    try {
      console.log(`[X API Post] Attempting to upload media via v2 with MIME type: ${selectedMimeType}`);
      const uploadResult = await twitterClient.v2.uploadMedia(imageBuffer, {media_type: selectedMimeType });
      mediaId = typeof uploadResult === 'string' ? uploadResult : (uploadResult as any)?.media_id_string;


      if (!mediaId || mediaId.trim() === '') {
        console.error("[X API Post] twitterClient.v2.uploadMedia completed but returned an invalid (empty or null) mediaId. Upload result:", uploadResult);
        return { success: false, message: "Media upload to X failed: Invalid media ID received from API." };
      }
      console.log("[X API Post] Media uploaded successfully via v2. Media ID:", mediaId);

    } catch (uploadError: any) {
      console.error("[X API Post] Error during twitterClient.v2.uploadMedia:", uploadError.data || uploadError.message || uploadError);
      let detail = "Unknown upload error";
      if (uploadError.data?.errors?.[0]?.message) {
        detail = uploadError.data.errors[0].message;
      } else if (uploadError.data?.detail) {
        detail = uploadError.data.detail;
      } else if (uploadError.message) {
        detail = uploadError.message;
      }
      return { success: false, message: `Media upload to X failed: ${detail}` };
    }
  } else if (imageDataUri) {
    mediaUploadAttempted = true;
    console.error(`[X API Post] imageDataUri was provided but is not a string type. Type: ${typeof imageDataUri}, Value (partial): ${String(imageDataUri).substring(0, 100)}`);
    return { success: false, message: "Image data is not in the expected string format." };
  }


  const tweetOptions: SendTweetV2Params = { text: tweetText };
  if (mediaId && mediaId.trim() !== "") {
    tweetOptions.media = { media_ids: [mediaId] };
    console.log("[X API Post] Attempting to tweet WITH media. Media ID:", mediaId);
  } else {
    if (mediaUploadAttempted) {
      console.error("[X API Post] Media upload was ATTEMPTED but no valid mediaId was obtained. Aborting tweet as per policy (image intended but failed).");
      return { success: false, message: "Media upload was attempted but failed; tweet aborted as an image was intended." };
    }
    console.log("[X API Post] Attempting to tweet TEXT-ONLY (no image was provided, or non-string image data was given and handled).");
  }

  try {
    const { data: tweetData } = await twitterClient.v2.tweet(tweetOptions);
    console.log("[X API Post] Tweet attempt response data:", tweetData);

    if (tweetData && tweetData.id) {
      const tweetFullUrl = `https://x.com/anyuser/status/${tweetData.id}`;
      const successMessage = `Tweet posted successfully! ID: ${tweetData.id}${tweetOptions.media ? ' (with media)' : ' (text-only)'}.`;
      console.log(`[X API Post] ${successMessage} URL: ${tweetFullUrl}`);
      return {
        success: true,
        message: successMessage,
        tweetUrl: tweetFullUrl,
      };
    } else {
      console.error("[X API Post] Tweet posted but no ID was returned in tweetData, or tweetData is missing/falsy. Response:", tweetData);
      return { success: false, message: "Tweet posted but no ID was returned from X, or tweet data was invalid." };
    }
  } catch (error: any) {
    console.error("[X API Post] Error during twitterClient.v2.tweet call:", error);
    let errorMessage = "Failed to post tweet to X (v2.tweet error).";
    if (error.response && error.response.data && error.response.data.detail) {
      errorMessage = `X API Error (tweet response.data.detail): ${error.response.data.detail}`;
    } else if (error.data && error.data.detail) {
      errorMessage = `X API Error (tweet data.detail): ${error.data.detail}`;
    } else if (error.message) {
      errorMessage = error.message;
    }
    console.error(`[X API Post] Final tweet error message being returned: ${errorMessage}`);
    return { success: false, message: errorMessage };
  }
}
