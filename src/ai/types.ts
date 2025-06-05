
import { z } from "genkit";

// For generate-english-commentary.ts
export const GenerateEnglishCommentaryInputSchema = z.object({
  title: z.string().describe("Article title from the People's Daily front page."),
  titleXiJinpingContentScore: z.string().describe("The \"标题含习量\" score, represented as a fraction string (e.g., \"3/10\")."),
  bodyXiJinpingContentScore: z.string().describe("The \"正文含习量\" score, represented as a fraction string (e.g., \"3/10\")."),
  titleXiJinpingUniqueMentions: z.string().optional().describe("The \"标题含习量\" score, represented as a fraction string (e.g., \"3/10\"), counting unique articles."),
  bodyXiJinpingUniqueMentions: z.string().optional().describe("The \"正文含习量\" score, represented as a fraction string (e.g., \"3/10\"), counting unique articles."),
  xiIndexScore: z.number().describe("The calculated 'Xi Index' score (titleXiJinpingContentScore + bodyXiJinpingContentScore)."),
  customContext: z.string().optional().describe("Optional custom context provided by the user for analysis and commentary generation (can be in English or Chinese)."),
});
export type GenerateEnglishCommentaryInput = z.infer<typeof GenerateEnglishCommentaryInputSchema>;

export const GenerateEnglishCommentaryOutputSchema = z.object({
    englishCommentary: z.string().describe('Concise English commentary based on the input data, suitable for a tweet.')
});
export type GenerateEnglishCommentaryOutput = z.infer<typeof GenerateEnglishCommentaryOutputSchema>;

// For generate-commentary-image-flow.ts
export const GenerateCommentaryImageInputSchema = z.object({
  commentaryText: z.string().describe('The commentary text to generate an image for.'),
  language: z.enum(['zh', 'en']).describe('The language of the commentary text (zh or en).')
});
export type GenerateCommentaryImageInput = z.infer<typeof GenerateCommentaryImageInputSchema>;

export const GenerateCommentaryImageOutputSchema = z.object({
  imageDataUri: z.string().describe('The generated image as a Base64 Data URI.'),
});
export type GenerateCommentaryImageOutput = z.infer<typeof GenerateCommentaryImageOutputSchema>;

// For translate-titles-flow.ts
export const TranslateTitlesToEnglishInputSchema = z.object({
  titles: z.array(z.string()).describe('A list of titles to translate to English.'),
});
export type TranslateTitlesToEnglishInput = z.infer<typeof TranslateTitlesToEnglishInputSchema>;

export const TranslateTitlesToEnglishOutputSchema = z.object({
  translatedTitles: z.array(z.string()).describe('A list of English translations, in the same order as the input titles. If a specific title cannot be translated, it should be returned as an empty string or the original title in this list.'),
});
export type TranslateTitlesToEnglishOutput = z.infer<typeof TranslateTitlesToEnglishOutputSchema>;

// For generate-commentary.ts
export const GenerateCommentaryInputSchema = z.object({
 title: z.string().describe("The combined titles from the People's Daily front page."),
  titleXiJinpingContentScore: z
    .string()
    .describe('The "标题含习数" score, represented as a fraction string (e.g., "3/10").'),
  bodyXiJinpingContentScore: z
    .string()
    .describe('The "正文含习数" score, represented as a fraction string (e.g., "3/10").'),
  titleXiJinpingUniqueMentions: z.string().optional().describe("The \"标题含习量\" score, represented as a fraction string (e.g., \"3/10\"), counting unique articles."),
  bodyXiJinpingUniqueMentions: z.string().optional().describe("The \"正文含习量\" score, represented as a fraction string (e.g., \"3/10\"), counting unique articles."),
  customContext: z
    .string()
    .optional()
    .describe('Optional custom context provided by the user for analysis and commentary generation.'),
});
export type GenerateCommentaryInput = z.infer<typeof GenerateCommentaryInputSchema>;
 
export const GenerateCommentaryOutputSchema = z.object({
  commentary: z
    .string()
    .describe('A concise commentary suitable for a Twitter post, in Chinese. The first line is "含习量：标题: [titleXiJinpingUniqueMentions]. 正文: [bodyXiJinpingUniqueMentions]. 习指数：[titleXiJinpingContentScore + bodyXiJinpingContentScore]", followed by a newline, then the analytical text which concludes with a short, sharp, sarcastic remark. The analytical text (including the remark) should be under 280 characters and adopt a sharp perspective.'),
});
export type GenerateCommentaryOutput = z.infer<typeof GenerateCommentaryOutputSchema>;
