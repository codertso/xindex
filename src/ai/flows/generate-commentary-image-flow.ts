
'use server';
/**
 * @fileOverview A Genkit flow to generate an image based on commentary text.
 *
 * - generateCommentaryImage - A function that generates an image for the given commentary.
 * - GenerateCommentaryImageInput - The input type for the function.
 * - GenerateCommentaryImageOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import type { GenerateCommentaryImageInput, GenerateCommentaryImageOutput } from '@/ai/types';
import { GenerateCommentaryImageInputSchema, GenerateCommentaryImageOutputSchema } from '@/ai/types';


export async function generateCommentaryImage(input: GenerateCommentaryImageInput): Promise<GenerateCommentaryImageOutput> {
  return generateCommentaryImageFlow(input);
}

const imageGenerationModel = 'googleai/gemini-2.0-flash-exp';

const generateCommentaryImageFlow = ai.defineFlow(
  {
    name: 'generateCommentaryImageFlow',
    inputSchema: GenerateCommentaryImageInputSchema,
    outputSchema: GenerateCommentaryImageOutputSchema,
  },
  async (input) => {
    console.log(`[AI Image Flow] Received request for ${input.language} commentary (first 50 chars): "${input.commentaryText.substring(0, 50)}..."`);

    const promptText = `Generate a 300x400 pixel image that visually represents the key themes or sentiment of the following content. This is a critical instruction: THE IMAGE MUST BE PURELY VISUAL AND CONTAIN ABSOLUTELY NO TEXT, WORDS, LETTERS, NUMBERS, OR CHARACTERS OF ANY LANGUAGE. Any form of text is strictly forbidden. Focus on abstract, symbolic, or metaphorical imagery. Content hint: ${input.commentaryText}`;

    try {
      const { media } = await ai.generate({
        model: imageGenerationModel,
        prompt: promptText,
        config: {
          responseModalities: ['TEXT', 'IMAGE'], 
        },
      });

      if (!media || !media.url) {
        console.error('[AI Image Flow] Image generation failed or returned no media URL.');
        throw new Error('Image generation failed: No media URL returned from AI model.');
      }
      console.log('[AI Image Flow] Image generated successfully. Media URL (first 100 chars):', media.url.substring(0,100));
      return { imageDataUri: media.url };
    } catch (error: any) {
      console.error('[AI Image Flow] Error during image generation:', error);
      const errorMessage = error.message || 'Unknown error during AI image generation.';
      if (error.details && error.details.message) {
         throw new Error(`AI image generation failed: ${error.details.message}`);
      }
      throw new Error(`AI image generation failed: ${errorMessage}`);
    }
  }
);
