
// src/services/canvas-image-generator.ts
'use server';

import { createCanvas, GlobalFonts, type CanvasRenderingContext2D } from '@napi-rs/canvas';
import type { InfoImageData } from '@/app/actions/types';
import { format as formatDateFns, parse } from 'date-fns';

const INFO_IMAGE_WIDTH = 600;
const FONT_FAMILY = 'NotoSansSC';
const FONT_URL: string = 'https://3txson2ylrdeyl56.public.blob.vercel-storage.com/NotoSansSC-SemiBold-BD5SqGB395rJvOTkRU9gcnGXToKdCZ.ttf';

async function registerFont(): Promise<void> {
  try {
    const response: Response = await fetch(FONT_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch font from ${FONT_URL}: ${response.statusText}`);
    }
    const fontBuffer: ArrayBuffer = await response.arrayBuffer();
    GlobalFonts.register(Buffer.from(fontBuffer), FONT_FAMILY);
    console.log(`[Canvas Service] Font '${FONT_FAMILY}' registered from ${FONT_URL}`);
  } catch (error: unknown) {
    console.error(`[Canvas Service] CRITICAL: Failed to register font '${FONT_FAMILY}' from ${FONT_URL}. Info images may not render CJK text correctly. Error:`, error);
  }
}

// Register font on module load
registerFont();

function drawTextWithBoldParts(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  baseFont: string,
  boldFont: string,
  partsToBold: string[]
) {
  let currentX = x;
  const segments: { text: string; isBold: boolean }[] = [];
  let remainingText = text;

  if (partsToBold.length === 0) {
    segments.push({ text: remainingText, isBold: false });
  } else {
    let workText = remainingText;
    // Create a regex to find all parts to bold
    const regex = new RegExp(`(${partsToBold.map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g');
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(workText)) !== null) {
      if (match.index > lastIndex) {
        segments.push({ text: workText.substring(lastIndex, match.index), isBold: false });
      }
      segments.push({ text: match[0], isBold: true });
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < workText.length) {
      segments.push({ text: workText.substring(lastIndex), isBold: false });
    }
    if (segments.length === 0 && workText.length > 0) { // Case where no bold parts found, but text exists
      segments.push({ text: workText, isBold: false });
    }
  }

  segments.forEach(segment => {
    ctx.font = segment.isBold ? boldFont : baseFont;
    ctx.fillText(segment.text, currentX, y);
    currentX += ctx.measureText(segment.text).width;
  });
}

function wrapText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
  baseFont: string,
  boldFont: string,
  partsToBold: string[]
) {
  const words = text.split('');
  let line = '';
  let linesRendered = 0;
  let currentY = y;

  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n];
    context.font = baseFont;
    const metrics = context.measureText(testLine);
    const testWidth = metrics.width;

    if (testWidth > maxWidth && n > 0) {
      if (linesRendered < maxLines - 1) {
        drawTextWithBoldParts(context, line, x, currentY, baseFont, boldFont, partsToBold);
        line = words[n];
        currentY += lineHeight;
        linesRendered++;
      } else {
        let lastLineContent = line;
        context.font = baseFont;
        while (context.measureText(lastLineContent + '…').width > maxWidth && lastLineContent.length > 0) {
          lastLineContent = lastLineContent.substring(0, lastLineContent.length - 1);
        }
        if (lastLineContent.length === 0 && line.length > 0) {
          drawTextWithBoldParts(context, '…', x, currentY, baseFont, boldFont, []);
        } else {
          drawTextWithBoldParts(context, lastLineContent + '…', x, currentY, baseFont, boldFont, partsToBold);
        }
        return linesRendered + 1;
      }
    } else {
      line = testLine;
    }
  }
  if (linesRendered < maxLines) {
    drawTextWithBoldParts(context, line, x, currentY, baseFont, boldFont, partsToBold);
    linesRendered++;
  }
  return linesRendered;
}

export async function generateInfoImageService(
  data: InfoImageData,
  language: 'zh' | 'en'
): Promise<string> {
  let estimatedCanvasHeight = 800; // Start with a reasonable initial height for estimation

  const colorBackground = '#F2E8E7'; // Off-white (var --background)
  const colorPrimary = '#B8312F';    // Deep red (var --primary)
  const colorForeground = '#3D3635';  // Dark brown-gray (var --foreground)
  const colorMutedForeground = '#6A5E5A'; // Darker grayish brown (custom, for labels)
  const colorAccent = '#B8860B';       // Gold (var --accent)
  const colorBorder = '#D1C7C4';       // Light grayish brown (var --border)

  const padding = 60;
  let currentY = padding; // Start Y pos, reduced to padding only

  // Main Title (Date)
  const dateTitleFontSize = 38;
  const dateTitleFont = `${dateTitleFontSize}px ${FONT_FAMILY}`;

  // We need a temporary canvas context to measure text before creating the final canvas
  const tempCanvas = createCanvas(1, 1);
  const ctx = tempCanvas.getContext('2d');

  ctx.font = dateTitleFont;
  ctx.fillStyle = colorPrimary;
  ctx.textAlign = 'center';

  let displayDate = data.fetchedDate || 'N/A'; // Expects YYYY-MM-DD
  if (language === 'en' && data.fetchedDate && data.fetchedDate !== 'N/A') {
    try {
      const parsedDate = parse(data.fetchedDate, 'yyyy-MM-dd', new Date());
      displayDate = formatDateFns(parsedDate, 'dd-MM-yyyy');
    } catch (e) {
      console.warn(`[Canvas Service] Could not parse date ${data.fetchedDate} for English DD-MM-YYYY format. Using original.`);
    }
  }

  const dateTitle = language === 'zh'
    ? `人民日报 ${displayDate}`
    : `People's Daily ${displayDate}`;

  // Estimate height for date
  let totalHeightNeeded = currentY + dateTitleFontSize + 30;
  currentY = totalHeightNeeded;
  // Scores Section
  const scoreLabelFontSize = 22;
  const scoreValueFontSize = 22;
  const scoreLabelFont = `${scoreLabelFontSize}px ${FONT_FAMILY}`;
  const scoreValueFont = `${scoreValueFontSize}px ${FONT_FAMILY}`;
  const scoreLineHeight = scoreLabelFontSize; // Reduced gap to 0

  // Combine Xi Index, Title Score, and Body Score on one line
  const xiIndexValue = data.xiIndex !== undefined ? data.xiIndex.toString() : '😀';

  const titleScoreValue = (data.xiJinpingUniqueTitleMentions || '😀').toString();
  const bodyScoreValue = (data.xiJinpingUniqueBodyMentions || '😀').toString();
  const articleTitlesCount = (data.articleTitles.length || '😀').toString();

  let currentCombinedScoreFontSize = scoreValueFontSize;

  // Article Headlines Section
  const articleTitleFontSize = 20;
  const articleTitleBaseFont = `${articleTitleFontSize}px ${FONT_FAMILY}`;
  const articleTitleBoldFont = `${articleTitleFontSize}px ${FONT_FAMILY}`;
  const articleTitleLineHeight = articleTitleFontSize + 8; // Added back some line height for wrapped text
  const maxLinesPerTitle = 2;
  const partsToBoldInTitle = language === 'zh' ? ["习近平"] : ["Xi Jinping"]; // Adapt bolding for language

  const titlesToDisplay = data.articleTitles || [];

  for (const title of titlesToDisplay) {
    const estimatedLines = Math.ceil(ctx.measureText(`• ${title}`).width / (INFO_IMAGE_WIDTH - (2 * padding) - ctx.measureText("• ").width));
    totalHeightNeeded += articleTitleLineHeight; // Add space needed for the title
  }

  totalHeightNeeded += 4

  // Now create the canvas with the calculated height
  estimatedCanvasHeight = Math.max(800, totalHeightNeeded); // Use calculated height directly, remove minimum height constraint
  const canvas = createCanvas(INFO_IMAGE_WIDTH, estimatedCanvasHeight);
  const finalCtx = canvas.getContext('2d');

  ctx.fillStyle = colorForeground;

  // Redraw background on the final canvas
  finalCtx.fillStyle = colorBackground;
  finalCtx.fillRect(0, 0, INFO_IMAGE_WIDTH, estimatedCanvasHeight);

  // Reset Y position for drawing on the final canvas
  currentY = padding; // Reset to padding, then add specific offsets

  // Draw Main Title (Date)
  finalCtx.font = dateTitleFont;
  finalCtx.fillStyle = colorPrimary;
  finalCtx.textAlign = 'center';
  finalCtx.fillText(dateTitle, INFO_IMAGE_WIDTH / 2, currentY);
  finalCtx.textAlign = 'left';
  currentY += dateTitleFontSize + 10; // Keep this spacing for now

  let scoreCurrentX = padding;

  finalCtx.font = `${currentCombinedScoreFontSize}px ${FONT_FAMILY}`;
  finalCtx.fillStyle = colorAccent;
  
  let currentDrawX = scoreCurrentX + 10; // Starting X position for the combined score line

  if (language === 'zh') {
    // 习指数: ${xiIndexValue}
    finalCtx.fillText('习指数: ', currentDrawX, currentY);
    currentDrawX += finalCtx.measureText('习指数: ').width;
    finalCtx.fillText(xiIndexValue, currentDrawX, currentY);
    currentDrawX += finalCtx.measureText(xiIndexValue).width + 15; // Add some spacing

    // 含习量：标题：${titleScoreValue} / ${articleTitlesCount}
    finalCtx.fillText('含习量：标题：', currentDrawX, currentY);
    currentDrawX += finalCtx.measureText('含习量：标题：').width;
    finalCtx.fillText(titleScoreValue, currentDrawX, currentY);
    currentDrawX += finalCtx.measureText(titleScoreValue).width;
    finalCtx.fillText(' / ', currentDrawX, currentY);
    currentDrawX += finalCtx.measureText(' / ').width;
    finalCtx.fillText(articleTitlesCount, currentDrawX, currentY);
    currentDrawX += finalCtx.measureText(articleTitlesCount).width + 15; // Add some spacing

    // 正文：${bodyScoreValue} / ${articleTitlesCount}
    finalCtx.fillText('正文：', currentDrawX, currentY);
    currentDrawX += finalCtx.measureText('正文：').width;
    finalCtx.fillText(bodyScoreValue, currentDrawX, currentY);
    currentDrawX += finalCtx.measureText(bodyScoreValue).width;
    finalCtx.fillText(' / ', currentDrawX, currentY);
    currentDrawX += finalCtx.measureText(' / ').width;
    finalCtx.fillText(articleTitlesCount, currentDrawX, currentY);
  } else {
    // Xi Index: ${xiIndexValue}
    finalCtx.fillText('Xi Index: ', currentDrawX, currentY);
    currentDrawX += finalCtx.measureText('Xi Index: ').width;
    finalCtx.fillText(xiIndexValue, currentDrawX, currentY);
    currentDrawX += finalCtx.measureText(xiIndexValue).width + 15; // Add some spacing

    // Xi Score: Title: ${titleScoreValue} / ${articleTitlesCount}
    finalCtx.fillText('Xi Score: Title:', currentDrawX, currentY);
    currentDrawX += finalCtx.measureText('Xi Score: Title:').width;
    finalCtx.fillText(titleScoreValue, currentDrawX, currentY);
    currentDrawX += finalCtx.measureText(titleScoreValue).width;
    finalCtx.fillText(' / ', currentDrawX, currentY);
    currentDrawX += finalCtx.measureText(' / ').width;
    finalCtx.fillText(articleTitlesCount, currentDrawX, currentY);
    currentDrawX += finalCtx.measureText(articleTitlesCount).width + 15; // Add some spacing

    // Body: ${bodyScoreValue} / ${articleTitlesCount}
    finalCtx.fillText('Body:', currentDrawX, currentY);
    currentDrawX += finalCtx.measureText('Body:').width;
    finalCtx.fillText(bodyScoreValue, currentDrawX, currentY);
    currentDrawX += finalCtx.measureText(bodyScoreValue).width;
    finalCtx.fillText(' / ', currentDrawX, currentY);
    currentDrawX += finalCtx.measureText(' / ').width;
    finalCtx.fillText(articleTitlesCount, currentDrawX, currentY);
  }
  currentY += scoreLineHeight + 5;

  // Draw Separator Line
  finalCtx.fillStyle = colorForeground
  finalCtx.lineTo(INFO_IMAGE_WIDTH - padding, currentY);
  currentY += scoreLineHeight; // Move down after the separator

  // Draw Article Headlines Section
  for (const title of titlesToDisplay) {
    finalCtx.fillStyle = colorForeground;
    const linesUsed = wrapText(
      finalCtx,
      `• ${title}`,
      padding,
      currentY,
      INFO_IMAGE_WIDTH - (2 * padding) - finalCtx.measureText("• ").width,
      articleTitleLineHeight,
      maxLinesPerTitle,
      articleTitleBaseFont,
      articleTitleBoldFont,
      partsToBoldInTitle
    );
    currentY += (linesUsed * articleTitleLineHeight) + 4; // Space between titles, reduced to 4px
  }

  // Footer text
  const footerFontSize = 16; // Slightly smaller footer
  const footerFont = `${footerFontSize}px ${FONT_FAMILY}`;
  ctx.font = footerFont;
  finalCtx.font = footerFont;
  finalCtx.fillStyle = colorMutedForeground;
  finalCtx.textAlign = 'center';
  const footerText = 'X @rmrbzongjie by @codertso'; // Keep this text
  finalCtx.fillText(footerText, INFO_IMAGE_WIDTH / 2, estimatedCanvasHeight - padding + 2); // Reduced bottom padding to 4px
  finalCtx.textAlign = 'left';

  console.log(`[Canvas Service] Generated ${language} info image (${INFO_IMAGE_WIDTH}x${estimatedCanvasHeight}) with specified styling.`);
  return canvas.toDataURL('image/png');
}
