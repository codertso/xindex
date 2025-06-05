// src/app/actions/fetch.ts
"use server";

import { fetchRMRBFrontPage as serviceFetchRMRBFrontPage } from '@/services/news-fetcher';
import type { InitialFetchResult } from './types'; // Import type from new types file

export async function performInitialFetch(
  dateString?: string,
  fetchOnlyFrontPage?: boolean
): Promise<InitialFetchResult> {
  let targetDate: Date | undefined = undefined;
  if (dateString) {
    const parts = dateString.split('-');
    if (parts.length === 3) {
      targetDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      if (isNaN(targetDate.getTime())) {
        targetDate = undefined;
        console.warn("Invalid date string provided for fetch:", dateString);
      }
    } else {
      console.warn("Date string not in YYYY-MM-DD format for fetch:", dateString);
    }
  }

  try {
    const newsData = await serviceFetchRMRBFrontPage(targetDate, fetchOnlyFrontPage);

    if (newsData.error || !newsData.articles || newsData.articles.length === 0) {
      return {
        error: newsData.error || "Failed to fetch articles from People's Daily, or no articles were found.",
        fetchedUrl: newsData.url,
        fetchedDate: newsData.date,
        allPageLayouts: newsData.allPageLayouts || [],
        fetchOnlyFrontPageUsed: fetchOnlyFrontPage,
      };
    }

    return {
      fetchedUrl: newsData.url,
      fetchedDate: newsData.date,
      articles: newsData.articles,
      allPageLayouts: newsData.allPageLayouts,
      fetchOnlyFrontPageUsed: fetchOnlyFrontPage,
    };
  } catch (err) {
    console.error("Critical error during initial fetch:", err);
    const errorMessage = err instanceof Error ? err.message : "An unknown critical error occurred during content fetching.";
    return { error: errorMessage, fetchOnlyFrontPageUsed: fetchOnlyFrontPage };
  }
}
