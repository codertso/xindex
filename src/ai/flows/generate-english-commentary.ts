
// src/ai/flows/generate-english-commentary.ts
'use server';
/**
 * @fileOverview English commentary generation flow for summarizing news themes and political presence.
 *
 * - generateEnglishCommentary - A function that generates a concise English commentary.
 * - GenerateEnglishCommentaryInput - The input type for the generateEnglishCommentary function.
 * - GenerateEnglishCommentaryOutput - The return type for the generateEnglishCommentary function.
 */

import {ai} from '@/ai/genkit';
import {GenerateEnglishCommentaryInput, GenerateEnglishCommentaryInputSchema, GenerateEnglishCommentaryOutputSchema, GenerateEnglishCommentaryOutput} from '@/ai/types';


export async function generateEnglishCommentary(input: GenerateEnglishCommentaryInput): Promise<GenerateEnglishCommentaryOutput> {
  return generateEnglishCommentaryFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateEnglishCommentaryPrompt',
  input: {schema: GenerateEnglishCommentaryInputSchema},
  output: {schema: GenerateEnglishCommentaryOutputSchema},
  prompt: `You are a highly astute political analyst specializing in Chinese state media (specifically content from People's Daily) and its geopolitical implications. Your task is to generate a concise commentary IN ENGLISH.

The commentary's first line MUST be formatted as:
"Xi Content: Title: {{{titleXiJinpingUniqueMentions}}}. Body: {{{bodyXiJinpingUniqueMentions}}}. Xi Index: {{{xiIndexScore}}}"
Follow this first line immediately with a newline character (\\n).

Then, begin the analytical text. This analytical text itself (the part after the newline and the generated prefix) MUST NOT exceed 280 characters.

Analyze the provided data:
- Combined Titles (in Chinese, interpret them for your English analysis): {{{title}}}
- 'Xi Index' = {{{xiIndexScore}}}
{{#if customContext}}
- User Provided Custom Context: {{{customContext}}}
{{/if}}

Based on this data (prioritizing user context if provided), your English analytical text (after the prefix and newline, and within the 280-character limit) should:
1.  Offer a sharp, insightful interpretation (akin to a '锐评视角' or "critical review" style, but in sophisticated English) of the propaganda intentions or key messages likely reflected in the source content.
2.  Translate or summarize the core Chinese themes into insightful English points.
3.  Connect these intentions/messages derived from titles to the current international landscape, with a specific focus on US-China relations if relevant.
4.  Be insightful, concise, and written in sophisticated English.
5.  Reflect the balance of power or focus indicated by the faction counts and themes when discussing internal politics or leadership mentions, but DO NOT explicitly state these counts or raw scores directly in the analytical text part (the prefix covers this).
6.  ensure to generate a sharp comment, start with "president Xi balabala". make sure englishCommentary content this part with a allen's show or snl or any other sharp talk show comment, you can reduce summary part to ensure the character limited in 280.

Example output format (JSON):
{
  "englishCommentary": "Xi Content: Title: 1/10. Body: 4/7. Xi Index: 5
  \\nToday's People's Daily front page emphasizes economic self-reliance, signaling strategic resolve.
  \\n Comments: President Xi is trying to play hard ball"
}

Ensure your output is a JSON object with an "englishCommentary" field, and the commentary string follows the specified format, analytical depth, and character limits for the analytical text part. The "englishCommentary" field MUST NOT be an empty string or only whitespace.
`,
});

const generateEnglishCommentaryFlow = ai.defineFlow(
  {
    name: 'generateEnglishCommentaryFlow',
    inputSchema: GenerateEnglishCommentaryInputSchema,
    outputSchema: GenerateEnglishCommentaryOutputSchema,
  },
  async ({ title, titleXiJinpingContentScore, bodyXiJinpingContentScore, titleXiJinpingUniqueMentions, bodyXiJinpingUniqueMentions, customContext }) => {
    const fallbackModel = 'googleai/gemini-2.5-flash-preview-04-17';
    let response;

    // Calculate xiIndexScore
    const parseScore = (score: string): number => {
      const parts = score.split('/').map(Number);
      return parts.length === 2 ? parts[0] : 0;
    };

    const titleScore = parseScore(titleXiJinpingContentScore);
    const bodyScore = parseScore(bodyXiJinpingContentScore);
    const xiIndexScore = titleScore + bodyScore;

    const inputWithXiIndex = {
      title,
      titleXiJinpingContentScore,
      bodyXiJinpingContentScore,
      titleXiJinpingUniqueMentions,
      bodyXiJinpingUniqueMentions,
      xiIndexScore,
      customContext,
    };

    try {
      console.log(`Attempting prompt '${prompt.name}' with default primary model.`);
      response = await prompt(inputWithXiIndex);
      if (!response.output || !response.output.englishCommentary || !response.output.englishCommentary.trim()) {
        console.warn(`Prompt '${prompt.name}' with primary model returned no output or empty/whitespace englishCommentary. Retrying with fallback.`);
        throw new Error("Primary model returned no output or empty/whitespace englishCommentary.");
      }
      console.log(`Prompt '${prompt.name}' with primary model succeeded.`);
      return response.output;
    } catch (e: any) {
      console.warn(`Primary model attempt for prompt '${prompt.name}' failed or returned no/empty output: ${e.message}. Attempting fallback.`);
      try {
        console.log(`Attempting prompt '${prompt.name}' with fallback model: ${fallbackModel}`);
        response = await prompt(inputWithXiIndex, { model: fallbackModel });
        if (!response.output || !response.output.englishCommentary || !response.output.englishCommentary.trim()) {
          console.error(`Fallback model for prompt '${prompt.name}' also returned no output or empty/whitespace englishCommentary.`);
          throw new Error('English commentary generation failed: No output or empty/whitespace englishCommentary from LLM (primary and fallback).');
        }
        console.log(`Prompt '${prompt.name}' with fallback model succeeded.`);
        return response.output;
      } catch (fallbackError: any) {
        console.error(`Fallback model attempt for prompt '${prompt.name}' also failed: ${fallbackError.message}.`);
        throw new Error(`Both primary and fallback models failed for ${prompt.name}. Primary error: ${e.message}. Fallback error: ${fallbackError.message}`);
      }
    }
  }
);
