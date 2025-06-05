// src/components/app/FetchedContentDisplay.tsx
"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { Accordion, AccordionContent, AccordionItem } from "@/components/ui/accordion"; // Assuming this is your styled Accordion
import { BookOpenCheckIcon, CalendarDaysIcon, ChevronDown, LinkIcon, ListChecksIcon } from 'lucide-react';
import type { ComprehensiveAnalysisResult } from '@/app/actions/types'; // Ensure ComprehensiveAnalysisResult is imported if pageState is of this type

interface FetchedContentDisplayProps {
  pageState: ComprehensiveAnalysisResult | null; // Adjust based on actual pageState type
  activeTab: string | undefined;
  onTabChange: (tab: string) => void;
  formatDisplayDate: (dateStr?: string) => string;
  getTabFallbackLabel: (url: string, index: number) => string;
}

export function FetchedContentDisplay({
  pageState,
  activeTab,
  onTabChange,
  formatDisplayDate,
  getTabFallbackLabel,
}: FetchedContentDisplayProps) {
  if (!pageState || (!pageState.fetchedUrl && (!pageState.articles || pageState.articles.length === 0))) {
    return null;
  }

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="font-headline text-xl flex items-center text-primary">
          <BookOpenCheckIcon className="mr-2 h-5 w-5" />Fetched Content Details
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {pageState.fetchedUrl && (
          <p className="text-sm font-body flex items-center">
            Main Source URL: <a href={pageState.fetchedUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline ml-1 break-all">{pageState.fetchedUrl}</a>
          </p>
        )}
        {pageState.fetchedDate && (
          <p className="text-sm font-body flex items-center">
            <CalendarDaysIcon className="mr-2 h-4 w-4 text-muted-foreground" /> Date: {formatDisplayDate(pageState.fetchedDate)}
          </p>
        )}
        {pageState.articles && pageState.articles.length > 0 && (
          <p className="text-sm font-body flex items-center">
            <ListChecksIcon className="mr-2 h-4 w-4 text-muted-foreground" /> Total Articles Fetched: {pageState.articles.length}
          </p>
        )}

        {pageState.allPageLayouts && pageState.allPageLayouts.length > 0 && pageState.articles && (
          <div className="mt-4">
            <h5 className="text-md font-headline mb-2">Articles by Page Layout:</h5>
            <Tabs value={activeTab} onValueChange={onTabChange} className="w-full">
              <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1 h-auto">
                {pageState.allPageLayouts.map((layout, index) => (
                  <TabsTrigger key={layout.url} value={layout.url} className="text-xs px-2 py-1.5 h-auto whitespace-normal">
                    {layout.title || getTabFallbackLabel(layout.url, index)}
                  </TabsTrigger>
                ))}
              </TabsList>
              {pageState.allPageLayouts.map((layout, layoutIndex) => {
                const articlesForLayout = pageState.articles?.filter(article => article.sourcePageLayoutUrl === layout.url) || [];
                return (
                  <TabsContent key={layout.url} value={layout.url} className="mt-2">
                    {articlesForLayout.length > 0 ? (
                      <Accordion type="multiple" className="w-full">
                        {articlesForLayout.map((article, index) => (
                          <AccordionItem value={`article-${layoutIndex}-${index}`} key={`article-item-${layoutIndex}-${index}-${article.url}`}>
                            <AccordionPrimitive.Trigger className="font-body text-left hover:no-underline text-base w-full flex items-center justify-between py-4">
                              {article.title || `Article ${index + 1}`}
                              <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" />
                            </AccordionPrimitive.Trigger>
                            <AccordionContent className="font-body text-sm whitespace-pre-wrap p-3 bg-white/70 dark:bg-black/20 rounded-md border">
                              {article.url &&
                                <p className="mb-2 text-xs flex items-center">
                                  <LinkIcon className="inline mr-1 h-3 w-3 text-muted-foreground" />
                                  <a href={article.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all">{article.url}</a>
                                </p>
                              }
                              {article.content || "No content extracted for this article."}
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    ) : (
                      <p className="text-muted-foreground text-sm p-4 text-center">
                        {pageState.fetchOnlyFrontPageUsed && layoutIndex !== 0 ? "This page was not fetched as 'Fetch only front page' was selected." : "No articles found for this page layout."}
                      </p>
                    )}
                  </TabsContent>
                );
              })}
            </Tabs>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
