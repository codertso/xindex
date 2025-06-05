
'use server';
/**
 * @fileOverview A flow to translate a list of titles to English.
 *
 * - translateTitlesToEnglish - A function that translates a list of input titles to English.
 * - TranslateTitlesToEnglishInput - The input type for the function (imported from @/ai/types).
 * - TranslateTitlesToEnglishOutput - The return type for the function (imported from @/ai/types).
 */

import {ai} from '@/ai/genkit';
import {
  TranslateTitlesToEnglishInputSchema,
  type TranslateTitlesToEnglishInput,
  TranslateTitlesToEnglishOutputSchema,
  type TranslateTitlesToEnglishOutput,
} from '@/ai/types';


export async function translateTitlesToEnglish(input: TranslateTitlesToEnglishInput): Promise<TranslateTitlesToEnglishOutput> {
  return translateTitlesFlow(input);
}

const prompt = ai.definePrompt({
  name: 'translateTitlesPrompt',
  input: {schema: TranslateTitlesToEnglishInputSchema},
  output: {schema: TranslateTitlesToEnglishOutputSchema},
  prompt: `Translate each of the following titles to English.
Return a JSON object with a "translatedTitles" field. This field MUST be an array of strings.
The array of translated titles MUST be in the exact same order as the input titles provided below.
If a title cannot be meaningfully translated, return the original title for that position in the array.
Ensure the number of items in the "translatedTitles" array is identical to the number of input titles.

Input Titles:
{{#each titles}}
- {{{this}}}
{{/each}}

Example input: { "titles": ["经济发展新思路", "科技创新未来"] }
Example output: { "translatedTitles": ["New Ideas for Economic Development", "The Future of Technological Innovation"] }
`,
});

const translateTitlesFlow = ai.defineFlow(
  {
    name: 'translateTitlesFlow',
    inputSchema: TranslateTitlesToEnglishInputSchema,
    outputSchema: TranslateTitlesToEnglishOutputSchema,
  },
  async (input) => {
    if (!input.titles || input.titles.length === 0) {
      return { translatedTitles: [] };
    }
    const fallbackModel = 'googleai/gemini-2.5-flash-preview-04-17';
    let response;

    try {
      console.log(`Attempting prompt '${prompt.name}' with default primary model for ${input.titles.length} titles.`);
      response = await prompt(input);
      if (!response.output || !response.output.translatedTitles) {
        console.warn(`Prompt '${prompt.name}' with primary model returned no output or malformed translatedTitles. Retrying with fallback.`);
        throw new Error("Primary model returned no or malformed output for title translation.");
      }
      console.log(`Prompt '${prompt.name}' with primary model succeeded for title translation.`);
      return response.output;
    } catch (e: any) {
      console.warn(`Primary model attempt for prompt '${prompt.name}' (title translation) failed or returned no/malformed output: ${e.message}. Attempting fallback.`);
      try {
        console.log(`Attempting prompt '${prompt.name}' (title translation) with fallback model: ${fallbackModel}`);
        response = await prompt(input, { model: fallbackModel });
        if (!response.output || !response.output.translatedTitles) {
          console.error(`Fallback model for prompt '${prompt.name}' (title translation) also returned no or malformed output. Returning original titles.`);
          return { translatedTitles: input.titles }; // Fallback to original titles if translation fails completely
        }
        console.log(`Prompt '${prompt.name}' with fallback model (title translation) succeeded.`);
        return response.output;
      } catch (fallbackError: any) {
        console.error(`Fallback model attempt for prompt '${prompt.name}' (title translation) also failed: ${fallbackError.message}. Returning original titles.`);
        return { translatedTitles: input.titles }; // Fallback to original titles
      }
    }
  }
);
