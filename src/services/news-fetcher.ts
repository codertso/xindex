
'use server';

import axios from 'axios';
import * as cheerio from 'cheerio';
import type { FetchedArticle, PageLayoutInfo, FetchedNewsData } from '@/app/actions/types'; // Import types from the centralized location

// Helper to get Beijing's current date parts and a Date object representing UTC midnight of Beijing's "today"
function getTodayInBeijingParts(): { yearStr: string; monthStr: string; dayStr: string; dateUTCMidnight: Date } {
  const now = new Date(); // Current server time (likely UTC)
  // Get YYYY, MM, DD parts for Beijing's current date
  const year = now.toLocaleString('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric' });
  const month = now.toLocaleString('en-CA', { timeZone: 'Asia/Shanghai', month: '2-digit' });
  const day = now.toLocaleString('en-CA', { timeZone: 'Asia/Shanghai', day: '2-digit' });
  // Create a Date object representing UTC midnight of Beijing's current day.
  // This allows for direct comparison with other UTC midnight dates.
  const dateUTCMidnight = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day)));
  return { yearStr: year, monthStr: month, dayStr: day, dateUTCMidnight };
}


async function fetchHtml(url: string): Promise<string | null> {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8,en-US;q=0.7',
      },
      timeout: 15000
    });
    if (response.status === 200) {
        return response.data;
    }
    console.error(`Error fetching URL ${url}: Status ${response.status}`);
    return null;
  } catch (error: any) {
    console.error(`Error fetching URL ${url}:`, error.message);
    return null;
  }
}

async function fetchBackupSource(dateStr: string, originalError?: string): Promise<FetchedNewsData> {
  const userFriendlyMessage = `No content could be retrieved for ${dateStr.substring(0,4)}-${dateStr.substring(4,6)}-${dateStr.substring(6,8)}. This might be because no articles were published on this day or there was an issue accessing the source. Please try a different date. ${originalError ? `Details: ${originalError}` : ''}`;
  console.warn(`Backup source logic triggered for ${dateStr}. Reason: ${originalError || 'Unknown fetch error'}.`);
  const layoutUrl = `http://paper.people.com.cn/rmrb/pc/layout/${dateStr.substring(0,6)}/${dateStr.substring(6,8)}/node_01.html`;

  return {
    articles: [],
    url: layoutUrl,
    date: dateStr,
    allPageLayouts: [],
    error: userFriendlyMessage,
  };
}

async function getPageLayoutLinks(year: string, month: string, day: string, paperPcBaseUrl: string): Promise<PageLayoutInfo[]> {
  const initialLayoutUrlForPageList = `${paperPcBaseUrl}layout/${year}${month}/${day}/node_01.html`;
  console.log(`Fetching page list from: ${initialLayoutUrlForPageList}`);
  const html = await fetchHtml(initialLayoutUrlForPageList);
  if (!html) return [];

  const $ = cheerio.load(html);
  const layouts: { relativeUrl: string, title: string }[] = [];

  const pageListDiv = $('div#pageList');
  if (pageListDiv.length > 0 && pageListDiv.find('ul div.right_title-name a').length > 0) {
    console.log(`Found page layouts in div#pageList for ${initialLayoutUrlForPageList}`);
    pageListDiv.find('ul div.right_title-name a').each((i, elem) => {
      const href = $(elem).attr('href');
      const title = $(elem).text().trim();
      if (href && !href.startsWith('http') && !href.startsWith('javascript:')) {
        layouts.push({ relativeUrl: href, title: title || `版面 ${i + 1}` });
      }
    });
  } else {
    console.log("Primary page list selector (div#pageList) found no links or was not present, trying fallback (div.swiper-container).");
    const swiperContainer = $('div.swiper-container');
    if (swiperContainer.length > 0 && swiperContainer.find('div.swiper-slide a').length > 0) {
      console.log(`Found page layouts in div.swiper-container for ${initialLayoutUrlForPageList}`);
      swiperContainer.find('div.swiper-slide a').each((i, elem) => {
          const href = $(elem).attr('href');
          const title = $(elem).text().trim();
          if (href && !href.startsWith('http') && !href.startsWith('javascript:')) {
            layouts.push({ relativeUrl: href, title: title || `版面 ${i + 1}` });
          }
      });
    } else {
        console.log("Fallback page list selector (div.swiper-container) also found no links or was not present for " + initialLayoutUrlForPageList);
    }
  }

  const resolvedLayouts: PageLayoutInfo[] = [];
  const seenUrls = new Set<string>();

  let node01Title = "01版：要闻";
  const node01LayoutFromList = layouts.find(l => l.relativeUrl.includes('node_01.html') || l.relativeUrl.includes('node_01.htm'));
  if (node01LayoutFromList && node01LayoutFromList.title) {
    node01Title = node01LayoutFromList.title;
  } else if (html) {
    const $node01Page = cheerio.load(html);
    const titleFromSwiper = $node01Page('div.swiper-container div.swiper-slide a[href*="node_01.htm"]').first().text().trim();
    const titleFromPageListDiv = $node01Page('div#pageList ul div.right_title-name a[href*="node_01.htm"]').first().text().trim();
    if (titleFromSwiper) node01Title = titleFromSwiper;
    else if (titleFromPageListDiv) node01Title = titleFromPageListDiv;
  }

  try {
    const node01FullUrl = new URL('node_01.html', initialLayoutUrlForPageList.substring(0, initialLayoutUrlForPageList.lastIndexOf('/') + 1)).toString();
    if(!seenUrls.has(node01FullUrl)){
        resolvedLayouts.push({ url: node01FullUrl, title: node01Title });
        seenUrls.add(node01FullUrl);
    }
  } catch (e) {
    console.warn(`Could not construct URL for node_01.html from base: "${initialLayoutUrlForPageList}"`, e);
  }

  for (const layout of layouts) {
    try {
      const baseForResolution = initialLayoutUrlForPageList.substring(0, initialLayoutUrlForPageList.lastIndexOf('/') + 1);
      const fullUrl = new URL(layout.relativeUrl, baseForResolution).toString();
      if (!seenUrls.has(fullUrl)) {
        resolvedLayouts.push({ url: fullUrl, title: layout.title });
        seenUrls.add(fullUrl);
      }
    } catch (e) {
      console.warn(`Could not construct URL from page layout href: "${layout.relativeUrl}" and base: "${initialLayoutUrlForPageList}"`, e);
    }
  }

  resolvedLayouts.sort((a,b) => {
    const getNodeNumber = (url: string) => {
        const match = url.match(/node_(\d+)\.html?/);
        return match ? parseInt(match[1]) : Infinity;
    };
    return getNodeNumber(a.url) - getNodeNumber(b.url);
  });

  console.log(`Resolved ${resolvedLayouts.length} unique page layouts to process.`);
  if (resolvedLayouts.length > 0) {
      console.log("Page layouts (first 5 with titles):", resolvedLayouts.slice(0, 5).map(l => `${l.title} (${l.url})`).join('; ') + (resolvedLayouts.length > 5 ? '...' : ''));
  }
  return resolvedLayouts;
}

async function getArticleContentLinks(pageLayoutUrl: string): Promise<string[]> {
  console.log(`Fetching article links from page: ${pageLayoutUrl}`);
  const html = await fetchHtml(pageLayoutUrl);
  if (!html) return [];

  const $ = cheerio.load(html);
  let liElements: cheerio.Cheerio | undefined = undefined;

  const titleListDiv = $('div#titleList');
  if (titleListDiv.length > 0) {
    liElements = titleListDiv.find('ul > li');
    console.log(`Primary selector (div#titleList ul > li) found ${liElements.length} LIs on ${pageLayoutUrl}.`);
  } else {
    console.log(`Primary container (div#titleList) not found or empty on ${pageLayoutUrl}, trying fallback (ul.news-list).`);
    const newsListUl = $('ul.news-list');
    if (newsListUl.length > 0) {
      liElements = newsListUl.find('li');
      console.log(`Fallback selector (ul.news-list > li) found ${liElements.length} LIs on ${pageLayoutUrl}.`);
    } else {
      console.log(`Fallback container (ul.news-list) also not found or empty on ${pageLayoutUrl}. No LIs to process for article links.`);
      return [];
    }
  }

  const articleHrefs: string[] = [];
  if (liElements && liElements.length > 0) {
    liElements.each((i, liElem) => {
      $(liElem).find('a').each((j, aElem) => {
        const href = $(aElem).attr('href');
        if (href && href.includes('content') && (href.endsWith('.htm') || href.endsWith('.html'))) {
          articleHrefs.push(href);
        }
      });
    });
  }

  const fullArticleUrls = articleHrefs.map(href => {
    try {
      let baseUrlForArticle = pageLayoutUrl;
      if (pageLayoutUrl.includes('.html') || pageLayoutUrl.includes('.htm')) {
        baseUrlForArticle = pageLayoutUrl.substring(0, pageLayoutUrl.lastIndexOf('/') + 1);
      } else if (!pageLayoutUrl.endsWith('/')) {
        baseUrlForArticle += '/';
      }
      return new URL(href, baseUrlForArticle).toString();
    } catch (e) {
      console.warn(`Could not construct URL from article href: "${href}" and base: "${pageLayoutUrl}"`, e);
      return '';
    }
  }).filter(url => url !== '').map(url => url.replace(/([^:]\/)\/+/g, "$1"));

  const uniqueArticleLinks = [...new Set(fullArticleUrls)];
  console.log(`Found ${uniqueArticleLinks.length} unique article content links on ${pageLayoutUrl}.`);
   if (uniqueArticleLinks.length > 0) {
      console.log("Article content links on this page (first 5):", uniqueArticleLinks.slice(0, 5).join(', ') + (uniqueArticleLinks.length > 5 ? '...' : ''));
  }
  return uniqueArticleLinks;
}


export async function fetchRMRBFrontPage(targetDateInput?: Date, fetchOnlyFrontPage?: boolean): Promise<FetchedNewsData> {
  // If targetDateInput is undefined, default to today (Beijing time for consistency)
  const effectiveTargetDateInput = targetDateInput || getTodayInBeijingParts().dateUTCMidnight;

  // Extract Y/M/D from effectiveTargetDateInput (which is UTC midnight of the target day)
  // These are used for display and constructing fetch URLs
  const year = effectiveTargetDateInput.getUTCFullYear().toString();
  const month = (effectiveTargetDateInput.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = effectiveTargetDateInput.getUTCDate().toString().padStart(2, '0');
  const dateForDisplay = `${year}${month}${day}`;

  const PAPER_PC_BASE_URL = 'http://paper.people.com.cn/rmrb/pc/';
  const frontPageLayoutUrl = `${PAPER_PC_BASE_URL}layout/${year}${month}/${day}/node_01.html`;

  // Validation against Beijing's current "today"
  const beijingToday = getTodayInBeijingParts();

  // effectiveTargetDateInput is already UTC midnight of the selected day.
  // beijingToday.dateUTCMidnight is UTC midnight of Beijing's current day.
  if (effectiveTargetDateInput > beijingToday.dateUTCMidnight) {
    return {
      articles: [],
      url: frontPageLayoutUrl,
      date: dateForDisplay,
      allPageLayouts: [],
      error: `Cannot fetch news for future dates. Please select a date on or before ${beijingToday.yearStr}-${beijingToday.monthStr}-${beijingToday.dayStr}.`,
    };
  }

  const fetchedArticles: FetchedArticle[] = [];
  const pageLayouts = await getPageLayoutLinks(year, month, day, PAPER_PC_BASE_URL);
  const frontPageHtmlForInitialCheck = await fetchHtml(frontPageLayoutUrl);

  if (pageLayouts.length === 0 && !frontPageHtmlForInitialCheck) {
    console.warn("No page layout links found and front page was inaccessible. Calling backup source.");
    return fetchBackupSource(dateForDisplay, "Front page and page list were inaccessible.");
  }

  let effectivePageLayouts = pageLayouts;
  if (pageLayouts.length === 0 && frontPageHtmlForInitialCheck) {
    console.warn("No page layout links found from getPageLayoutLinks. Will attempt to parse front page directly for articles.");
    let frontPageTitle = "01版：要闻";
    const $fp = cheerio.load(frontPageHtmlForInitialCheck);
    const titleFromSwiper = $fp('div.swiper-container div.swiper-slide a[href*="node_01.htm"]').first().text().trim();
    const titleFromPageListDiv = $fp('div#pageList ul div.right_title-name a[href*="node_01.htm"]').first().text().trim();

    if (titleFromSwiper) frontPageTitle = titleFromSwiper;
    else if (titleFromPageListDiv) frontPageTitle = titleFromPageListDiv;
    effectivePageLayouts = [{ url: frontPageLayoutUrl, title: frontPageTitle }];
  }

  if (fetchOnlyFrontPage && effectivePageLayouts.length > 0) {
    console.log(`"Fetch only front page" is active. Reducing ${effectivePageLayouts.length} layouts to 1.`);
    effectivePageLayouts = [effectivePageLayouts[0]];
  }

  for (const pageLayout of effectivePageLayouts) {
    const articleContentUrls = await getArticleContentLinks(pageLayout.url);

    for (const articleUrl of articleContentUrls) {
      console.log(`Fetching article content from: ${articleUrl} (sourced from ${pageLayout.url})`);
      const articleHtml = await fetchHtml(articleUrl);
      if (articleHtml) {
        const $articlePage = cheerio.load(articleHtml);

        let extractedArticleTitle = '';
        const headTitleTag = $articlePage('head > title').text()?.trim();

        if (headTitleTag) {
            const siteIdentifiers = ["人民网", "人民日报", "people.com.cn", "--", "People's Daily Online"];
            let cleanedTitle = headTitleTag;
            const partsBySeparator = cleanedTitle.split(/ - |——|--/);
            if (partsBySeparator.length > 1) {
                const lastPart = partsBySeparator[partsBySeparator.length - 1].trim();
                 if (siteIdentifiers.some(id => lastPart.includes(id) || id.includes(lastPart) || lastPart.toLowerCase() === "people's daily online")) {
                    cleanedTitle = partsBySeparator.slice(0, -1).join(cleanedTitle.includes(' - ') ? ' - ' : (cleanedTitle.includes('——') ? '——' : '--')).trim();
                }
            }
            siteIdentifiers.forEach(id => {
                cleanedTitle = cleanedTitle.replace(new RegExp(`\\s*(${id.replace(/\./g, '\\.')}|${id})\\s*$`, 'gi'), '').trim();
                cleanedTitle = cleanedTitle.replace(new RegExp(`^\\s*(${id.replace(/\./g, '\\.')}|${id})\\s*[-—]+\\s*`, 'gi'), '').trim();
            });

            if (cleanedTitle && cleanedTitle.length >= 5 && !siteIdentifiers.some(id => cleanedTitle.toLowerCase() === id.toLowerCase() || id.includes(cleanedTitle))) {
                extractedArticleTitle = cleanedTitle;
            } else {
                 console.log(`Head title "${headTitleTag}" was not suitable or too generic after cleaning for ${articleUrl}. Will try body selectors.`);
            }
        }

        if (!extractedArticleTitle) {
            const titleSelectors = [
                'div.title_container h1.title', 'div.title_area h1', 'div.article_title h1',
                'div.text_c > h1', 'h1.title', '.paper_font_title', '.headline-title', '.news_title', 'h1'
            ];
            for (const selector of titleSelectors) {
                extractedArticleTitle = $articlePage(selector).first().text()?.trim();
                if (extractedArticleTitle) break;
            }

            if (!extractedArticleTitle) {
                const h2Text = $articlePage('h2').first().text()?.trim();
                const h3Text = $articlePage('h3').first().text()?.trim();
                if (h3Text && h2Text && (h2Text.length > h3Text.length) && h2Text.length > 5) {
                     extractedArticleTitle = h2Text;
                } else if (h3Text && h3Text.length > 5) {
                     extractedArticleTitle = h3Text;
                } else if (h2Text && h2Text.length > 5) {
                    extractedArticleTitle = h2Text;
                }
            }
        }

        if (!extractedArticleTitle) {
            extractedArticleTitle = `Article from ${articleUrl.split('/').pop()?.split('.')[0] || 'source'}`;
             console.warn(`Could not extract a specific title for ${articleUrl}, using generic title: "${extractedArticleTitle}"`);
        }

        let extractedArticleContent = '';
        const ozoomParagraphs = $articlePage('div#ozoom p');
        if (ozoomParagraphs.length > 0) {
          ozoomParagraphs.each((idx, pElem) => {
            extractedArticleContent += $articlePage(pElem).text().trim() + '\n\n';
          });
        } else {
            console.log(`No content in div#ozoom for ${articleUrl}, trying fallback selectors.`);
            const contentSelectors = [
                'div.article_content p', 'div.rmrb_content p', 'div.text_show p',
                'div.content p', 'p.p1', 'section.article p', 'div.article-content p',
                'div.box_con p', '.TRS_Editor p', '.articleCont p'
            ];
            for(const selector of contentSelectors) {
                const paragraphs = $articlePage(selector);
                if (paragraphs.length > 0) {
                    paragraphs.each((idx, pElem) => {
                      extractedArticleContent += $articlePage(pElem).text().trim() + '\n\n';
                    });
                    if (extractedArticleContent.trim()) break;
                }
            }
        }

        extractedArticleContent = extractedArticleContent.trim();
        if (extractedArticleContent) {
          fetchedArticles.push({
            title: extractedArticleTitle,
            content: extractedArticleContent,
            url: articleUrl,
            sourcePageLayoutUrl: pageLayout.url
          });
        } else {
            console.warn(`No content paragraphs found for article ${articleUrl} after trying all selectors.`);
        }
      } else {
        console.warn(`Failed to fetch HTML for article content: ${articleUrl}`);
      }
    }
  }

  if (fetchedArticles.length === 0 ) {
    console.warn(`No articles could be fetched after processing for ${dateForDisplay}. Falling back to backup source.`);
    return fetchBackupSource(dateForDisplay, `No articles found after all processing for ${dateForDisplay}.`);
  }

  return {
    articles: fetchedArticles,
    url: frontPageLayoutUrl,
    date: dateForDisplay,
    allPageLayouts: pageLayouts, // Return all discovered layouts, even if only front page articles were fetched.
  };
}
