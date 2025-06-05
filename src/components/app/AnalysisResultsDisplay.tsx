// src/components/app/AnalysisResultsDisplay.tsx
"use client";

import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BriefcaseIcon, FileTextIcon } from "lucide-react";
import type {
  ComprehensiveAnalysisResult,
  FetchedArticle,
} from "@/app/actions/types";

interface AnalysisResultsDisplayProps {
  pageState: ComprehensiveAnalysisResult | null;
  isAnalyzing: boolean;
  selectedArticleCount: number;
}

export function AnalysisResultsDisplay({
  pageState,
  isAnalyzing,
  selectedArticleCount,
}: AnalysisResultsDisplayProps) {
  const renderSkeletons = (count: number = 3) =>
    Array.from({ length: count }).map((_, i) => (
      <Skeleton key={i} className="h-4 w-full mb-2 last:mb-0" />
    ));

  const renderCategorizedArticlesList = (
    articles: FetchedArticle[],
    categoryName: string
  ) => {
    if (!articles || articles.length === 0) {
      return null;
    }
    return (
      <div className="mb-3 last:mb-0">
        <h4 className="font-semibold text-md mb-2">
          {categoryName} ({articles.length})
        </h4>
        <ul className="space-y-1.5 pl-1">
          {articles.map((article, index) => (
            <li
              key={`cat-article-key-${categoryName.replace(
                /\s/g,
                ""
              )}-${index}-${article.url}`}
              className="py-1 group text-sm"
            >
              {article.url ? (
                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-body mr-1 text-foreground hover:text-primary hover:underline"
                  title={article.title || `Article ${index + 1}`}
                >
                  {article.englishTitle &&
                  article.englishTitle !== article.title
                    ? `${article.title} / ${article.englishTitle}`
                    : article.title || `Article ${index + 1}`}
                </a>
              ) : (
                <span
                  className="font-body mr-1 text-foreground"
                  title={article.title}
                >
                  {article.englishTitle &&
                  article.englishTitle !== article.title
                    ? `${article.title} / ${article.englishTitle}`
                    : article.title || `Article ${index + 1}`}
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
    );
  };

  const analysisHasRunOrIsRunning =
    isAnalyzing || (pageState && pageState.articleCategories);
  const shouldShowCategorization =
    isAnalyzing ||
    (pageState?.articleCategories &&
      pageState?.articles &&
      pageState.articles.length > 0 &&
      selectedArticleCount > 0);

  if (
    !analysisHasRunOrIsRunning &&
    selectedArticleCount === 0 &&
    !pageState?.error
  ) {
    return null;
  }

  return (
    <>
      <div className="space-y-6 mt-6">
        {" "}
        {/* Changed from grid to space-y for full-width stacking */}
        {shouldShowCategorization && ( // Conditional rendering for the categorization card
          <Card className="shadow-lg">
            <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-6">
              <div>
                <CardTitle className="font-headline text-xl flex items-center">
                  <FileTextIcon className="mr-2 h-5 w-5 text-accent" />
                  Article Categorization & Xi Jinping Mentions
                </CardTitle>
              </div>
            </CardHeader>
            {pageState &&
              (pageState.xiJinpingTitleCount !== undefined ||
                pageState.xiJinpingBodyCount !== undefined) && (
                <div className="pt-0 pb-2 p-6">
                  <CardDescription className="text-lg font-semibold text-primary">
                    含习量：标题: {pageState.xiJinpingUniqueTitleMentions ?? 0}/
                    {selectedArticleCount}. 正文:{" "}
                    {pageState.xiJinpingUniqueBodyMentions ?? 0}/
                    {selectedArticleCount}. 习指数：
                    {(pageState.xiJinpingTitleCount ?? 0) +
                      (pageState.xiJinpingBodyCount ?? 0)}
                  </CardDescription>
                </div>
              )}
            <CardContent className="p-6 pt-0 min-h-[100px]">
              <div className="flex flex-col md:flex-row gap-4">
                <div
                  className="md:w-full space-y-4"
                  style={{ overflow: "hidden" }}
                >
                  {isAnalyzing && !pageState?.articleCategories ? (
                    <>
                      {renderSkeletons(2)}
                      <Skeleton className="h-10 w-full" />
                      {renderSkeletons(2)}
                      <Skeleton className="h-10 w-full" />
                    </>
                  ) : pageState?.articleCategories ? (
                    <>
                      {renderCategorizedArticlesList(
                        pageState.articleCategories.articlesWithXi,
                        "含习近平 / Articles with Xi Jinping"
                      )}
                      {renderCategorizedArticlesList(
                        pageState.articleCategories.articlesWithOnlyXiFaction,
                        "只含习家军 (不含习) / Xi Faction only (no Xi)"
                      )}
                      {renderCategorizedArticlesList(
                        pageState.articleCategories.otherAnalyzedArticles,
                        "其他分析文章 / Other Analyzed Articles"
                      )}
                    </>
                  ) : (
                    <p className="text-muted-foreground">
                      {!isAnalyzing && selectedArticleCount > 0
                        ? "Categorization data not available or analysis did not complete."
                        : "Article categories will appear here after analysis."}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
