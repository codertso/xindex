// src/components/app/ArticleSelector.tsx
"use client";

import React from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { Accordion, AccordionContent, AccordionItem } from "@/components/ui/accordion";
import { ListTreeIcon, ListChecksIcon, ListXIcon, ChevronDown } from 'lucide-react';
import type { FetchedArticle, ComprehensiveAnalysisResult } from '@/app/actions';
import { cn } from '@/lib/utils';

interface ArticleSelectorProps {
  pageState: ComprehensiveAnalysisResult | null;
  selectedArticleUrls: Set<string>;
  onArticleSelection: (articleUrl: string, isSelected: boolean) => void;
  onLayoutSelection: (layoutUrl: string, articlesInLayout: FetchedArticle[], isSelected: boolean) => void;
  getLayoutCheckboxState: (layoutUrl: string) => boolean | "indeterminate";
  onToggleSelectAllArticles: () => void;
  isFetching: boolean;
  isAnalyzing: boolean;
  isOneClickPublishing: boolean;
  allArticlesCount: number;
  isAllArticlesSelected: boolean;
  getTabFallbackLabel: (url: string, index: number) => string;
}

export function ArticleSelector({
  pageState,
  selectedArticleUrls,
  onArticleSelection,
  onLayoutSelection,
  getLayoutCheckboxState,
  onToggleSelectAllArticles,
  isFetching,
  isAnalyzing,
  isOneClickPublishing,
  allArticlesCount,
  isAllArticlesSelected,
  getTabFallbackLabel,
}: ArticleSelectorProps) {
  if (!pageState || !pageState.articles || pageState.articles.length === 0) {
    return null;
  }

  const isAnyActionInProgress = isFetching || isAnalyzing || isOneClickPublishing;

  return (
    <Card className="shadow-lg">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="font-headline text-xl flex items-center">
            <ListTreeIcon className="mr-2 h-5 w-5 text-primary" />
            Select Articles for AI Analysis
          </CardTitle>
          <CardDescription className="font-body mt-1">
            Currently {selectedArticleUrls.size} of {pageState.articles.length} articles selected.
          </CardDescription>
        </div>
        <Button
          onClick={onToggleSelectAllArticles}
          variant="outline"
          size="sm"
          disabled={isAnyActionInProgress}
        >
          {isAllArticlesSelected ? <ListXIcon className="mr-2 h-4 w-4" /> : <ListChecksIcon className="mr-2 h-4 w-4" />}
          {isAllArticlesSelected ? `Deselect All (${allArticlesCount})` : `Select All (${allArticlesCount})`}
        </Button>
      </CardHeader>
      <CardContent className="space-y-2 max-h-[400px] overflow-y-auto p-4 pr-2">
        {pageState.allPageLayouts?.map((layout, layoutIdx) => {
          const articlesInLayout = pageState.articles?.filter(article => article.sourcePageLayoutUrl === layout.url) || [];
          if (pageState.fetchOnlyFrontPageUsed && layoutIdx !== 0 && !articlesInLayout.length) return null;
          if (articlesInLayout.length === 0 && !pageState.fetchOnlyFrontPageUsed) return null;

          const layoutCheckboxId = `layout-select-${layout.url}`;
          const layoutCheckedState = getLayoutCheckboxState(layout.url);

          return (
            <Accordion type="single" collapsible defaultValue={layoutIdx === 0 ? `item-${layoutIdx}` : undefined} key={layout.url} className="w-full border rounded-md p-2 mb-2 last:mb-0">
              <AccordionItem value={`item-${layoutIdx}`} className="border-b-0">
                <AccordionPrimitive.Header className="flex items-center justify-between py-2">
                  <div className="px-1" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      id={layoutCheckboxId}
                      checked={layoutCheckedState}
                      onCheckedChange={(checked) => {
                        const shouldSelectAll = checked === 'indeterminate' ? true : (checked as boolean);
                        onLayoutSelection(layout.url, articlesInLayout, shouldSelectAll);
                      }}
                      aria-label={`Select all articles in ${layout.title || getTabFallbackLabel(layout.url, layoutIdx)}`}
                      disabled={articlesInLayout.length === 0 || isAnyActionInProgress}
                    />
                  </div>
                  <AccordionPrimitive.Trigger
                    className={cn(
                      "flex flex-1 items-center justify-between pl-1 pr-1 font-medium transition-all hover:underline [&[data-state=open]>svg]:rotate-180",
                      articlesInLayout.length === 0 && "cursor-default hover:no-underline"
                    )}
                    disabled={articlesInLayout.length === 0 || isAnyActionInProgress}
                  >
                    <Label htmlFor={layoutCheckboxId} className={cn("font-headline text-md", articlesInLayout.length > 0 && "cursor-pointer")}>
                      {layout.title || getTabFallbackLabel(layout.url, layoutIdx)} ({articlesInLayout.filter(a => selectedArticleUrls.has(a.url)).length}/{articlesInLayout.length})
                    </Label>
                    {articlesInLayout.length > 0 && <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" />}
                  </AccordionPrimitive.Trigger>
                </AccordionPrimitive.Header>
                {articlesInLayout.length > 0 && (
                  <AccordionContent className="pt-1 pb-0 pl-9 pr-2">
                    {articlesInLayout.map(article => {
                      const articleCheckboxId = `article-select-${article.url}`;
                      return (
                        <div key={article.url} className="flex items-center space-x-2 py-1 hover:bg-muted/50 rounded-md px-1 -ml-1">
                          <Checkbox
                            id={articleCheckboxId}
                            checked={selectedArticleUrls.has(article.url)}
                            onCheckedChange={(checked) => onArticleSelection(article.url, checked as boolean)}
                            aria-label={`Select article: ${article.title}`}
                            disabled={isAnyActionInProgress}
                          />
                          <Label htmlFor={articleCheckboxId} className="font-body text-sm font-normal flex-1 cursor-pointer line-clamp-2" title={article.title}>
                            {article.title || "Untitled Article"}
                          </Label>
                        </div>
                      );
                    })}
                  </AccordionContent>
                )}
              </AccordionItem>
            </Accordion>
          );
        })}
      </CardContent>
    </Card>
  );
}
