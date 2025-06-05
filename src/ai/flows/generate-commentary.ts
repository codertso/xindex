
// src/ai/flows/generate-commentary.ts
'use server';
/**
 * @fileOverview Commentary generation flow for summarizing news themes and political presence into a tweet-like format.
 *
 * - generateCommentary - A function that generates a concise commentary.
 * - GenerateCommentaryInput - The input type for the generateCommentary function (imported from @/ai/types).
 * - GenerateCommentaryOutput - The return type for the generateCommentary function (imported from @/ai/types).
 */

import {ai} from '@/ai/genkit';
import {
  GenerateCommentaryInputSchema,
  type GenerateCommentaryInput,
  GenerateCommentaryOutputSchema,
  type GenerateCommentaryOutput,
} from '@/ai/types';

export async function generateCommentary(input: GenerateCommentaryInput): Promise<GenerateCommentaryOutput> {
  return generateCommentaryFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateCommentaryPrompt',
  input: {schema: GenerateCommentaryInputSchema},
  output: {schema: GenerateCommentaryOutputSchema},
  prompt: `You are a highly astute political analyst specializing in Chinese state media (specifically content from People's Daily) and its geopolitical implications. Your task is to generate a concise commentary in CHINESE.

The commentary's first line MUST be formatted as:
"含习量：标题: {{{titleXiJinpingUniqueMentions}}}. 正文: {{{bodyXiJinpingUniqueMentions}}}. 习指数：{{{xiIndexScore}}}"
Follow this first line immediately with a newline character (\\n).
Then, begin the analytical text. This analytical text itself (the part after the newline and the generated prefix) MUST NOT exceed 280 characters (aim for conciseness suitable for Twitter).

Analyze the provided data:
- Combined Titles: {{{title}}}
- Xi-Related Officials Mentioned (Total Count, for '习指数'): {{{xiIndexScore}}}
{{#if customContext}}
- User Provided Custom Context: {{{customContext}}}
{{/if}}

Based on this data (prioritizing user context if provided), your analytical text (after the prefix and newline, and within the 280-character limit) should:
1.  Offer a sharp interpretation ("锐评视角") of the propaganda intentions likely reflected in *this issue's content*.
2.  Connect these intentions to the current international landscape, with a specific focus on US-China relations.
3.  Be insightful, concise, and written in sophisticated Chinese.
4.  xiIndex = titleXiJinpingContentScore + bodyXiJinpingContentScore
5.  When referring to the source material or its content, AVOID using terms like '党报' (Party newspaper). Instead, use more neutral phrasing such as '本期' (this issue/edition), 'the publication', 'this edition's titles', or focus on the themes and messages directly inferred from the titles.
6.  The analytical text should NOT start with "今日党报" or similar phrases. Instead, it should directly address the key themes, for example: "主题聚焦经济自强..."
7.  Conclude this analytical text with a very short, sharp, and somewhat sarcastic/teasing (调侃式) remark in Chinese. This concluding remark is part of the 280-character limit for the analytical text. Start with "习主席xxxx". Examples of the tone for this concluding remark: "习主席还是很喜欢足球" or "看来习主席对雄安还是念念不忘啊。" 可以为了限制字数在280字符内，减少前面总结的内容，其中中文算两个字符，数字和英文字符算一个字符。


Example output:
{
  "commentary": "含习量：标题: 1/10. 正文: 4/7. 习指数：5
  \\n本期主题聚焦经济自强，对外展现战略定力。来应对愈加激烈的国际局势。
  \\n锐评：习主席还是打算玩硬的。"
}

Ensure your output is a JSON object with a "commentary" field, and the commentary string follows the specified format and analytical depth, keeping the analytical text part (including the final sarcastic remark) under 280 characters. The "commentary" field MUST NOT be an empty string or only whitespace.
`,
});

const generateCommentaryFlow = ai.defineFlow(
  {
    name: 'generateCommentaryFlow',
    inputSchema: GenerateCommentaryInputSchema,
    outputSchema: GenerateCommentaryOutputSchema,
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
      if (!response.output || !response.output.commentary || !response.output.commentary.trim()) {
        console.warn(`Prompt '${prompt.name}' with primary model returned no output or empty/whitespace commentary. Retrying with fallback.`);
        throw new Error("Primary model returned no output or empty/whitespace commentary.");
      }
      console.log(`Prompt '${prompt.name}' with primary model succeeded.`);
      return response.output;
    } catch (e: any) {
      console.warn(`Primary model attempt for prompt '${prompt.name}' failed or returned no/empty output: ${e.message}. Attempting fallback.`);
      try {
        console.log(`Attempting prompt '${prompt.name}' with fallback model: ${fallbackModel}`);
        response = await prompt(inputWithXiIndex, { model: fallbackModel });
        if (!response.output || !response.output.commentary || !response.output.commentary.trim()) {
          console.error(`Fallback model for prompt '${prompt.name}' also returned no output or empty/whitespace commentary.`);
          throw new Error('Commentary generation failed: No output or empty/whitespace commentary from LLM (primary and fallback).');
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
