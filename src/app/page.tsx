"use client";

import React, { useState, useTransition, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { ConfigurationPanel } from "@/components/app/ConfigurationPanel";
import { FetchedContentDisplay } from "@/components/app/FetchedContentDisplay";
import { ArticleSelector } from "@/components/app/ArticleSelector";
import { AnalysisContextInput } from "@/components/app/AnalysisContextInput";
import { AnalysisResultsDisplay } from "@/components/app/AnalysisResultsDisplay";
import { CommentaryDisplay } from "@/components/app/CommentaryDisplay";
import { useToast } from "@/hooks/use-toast";

import {
  performInitialFetch,
  performAiAnalysisOnContent,
  postToXWithImageViaAPI,
  triggerScheduledQuickPublish,
  generateAiCommentaryImageAction,
  generateInfoImageAction,
} from "./actions";
import type {
  FetchedArticle,
  ComprehensiveAnalysisResult,
  AiAnalysisData,
  GenerateAiImageResult,
  InfoImageData,
  GenerateInfoImageResult,
  PageLayoutInfo,
  PostToXViaApiResult,
} from "./actions/types";

import { verifyPassword } from "@/services/auth-service";
import {
  serverFormatCommentaryForPosting,
  formatDateForCommentary as clientFormatDisplayDate,
} from "@/lib/server-formatting";
import {
  NewspaperIcon,
  AlertTriangleIcon,
  Loader2,
  BrainIcon,
  BookOpenCheckIcon,
  LanguagesIcon,
  LockIcon,
  LogInIcon,
  ImageOffIcon,
  ImageIcon as AiImageIcon,
  DownloadIcon,
  Image as CanvasImageIcon,
  XIcon as TwitterIcon,
  SendIcon,
  Share2Icon,
} from "lucide-react";
import { format, parse } from "date-fns";
import { Textarea } from "@/components/ui/textarea";

const getCharacterWeight = (char: string): number => {
  if (
    char.match(
      /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uffef\u4e00-\u9faf\u3400-\u4dbf]/
    )
  ) {
    return 2;
  }
  return 1;
};

const calculateWeightedLength = (text: string): number => {
  let totalWeight = 0;
  if (typeof text !== "string") return 0;
  for (const char of text) {
    totalWeight += getCharacterWeight(char);
  }
  return totalWeight;
};

const truncateCommentaryMaintainSentence = (
  fullText: string | undefined,
  maxLength: number
): string => {
  if (typeof fullText !== "string" || !fullText) return "";
  const currentTotalWeight = calculateWeightedLength(fullText);
  if (currentTotalWeight <= maxLength) return fullText;

  for (let i = fullText.length - 1; i >= 0; i--) {
    const char = fullText[i];
    if (char === "。" || char === ".") {
      const candidateText = fullText.substring(0, i + 1);
      if (calculateWeightedLength(candidateText) <= maxLength)
        return candidateText;
    }
  }
  let truncatedText = "";
  let currentWeight = 0;
  for (const char of fullText) {
    const charWeightLocal = getCharacterWeight(char);
    if (currentWeight + charWeightLocal > maxLength) break;
    truncatedText += char;
    currentWeight += charWeightLocal;
  }
  return truncatedText;
};

const MAX_CHINESE_COMMENTARY_LENGTH = 280;
const MAX_ENGLISH_COMMENTARY_LENGTH = 280;
const MAX_TITLES_FOR_INFO_IMAGE = 12;

const getBeijingCurrentDateForCalendar = (): Date => {
  const now = new Date();
  const year = now.toLocaleDateString("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
  });
  const month = now.toLocaleDateString("en-CA", {
    timeZone: "Asia/Shanghai",
    month: "2-digit",
  });
  const day = now.toLocaleDateString("en-CA", {
    timeZone: "Asia/Shanghai",
    day: "2-digit",
  });
  return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
};

const AUTH_SESSION_KEY = "chinaNewsWatcherAuthenticated";

const initialComprehensiveState: ComprehensiveAnalysisResult = {
  articles: [],
  allPageLayouts: [],
  fetchOnlyFrontPageUsed: false,
  error: undefined,
  fetchedUrl: undefined,
  fetchedDate: undefined,
  commentary: undefined,
  englishCommentary: undefined,
  articleCategories: undefined,
  xiJinpingTitleCount: undefined,
  xiJinpingBodyCount: undefined,
  xiJinpingUniqueTitleMentions: undefined,
  xiJinpingUniqueBodyMentions: undefined,
  articleEnglishTitlesMap: undefined,
};

export default function HomePage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [passwordInput, setPasswordInput] = useState("");
  const [authError, setAuthError] = useState("");
  const [isVerifyingPassword, setIsVerifyingPassword] = useState(false);

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [maxCalendarDate, setMaxCalendarDate] = useState<Date | undefined>(
    undefined
  );
  const [pageState, setPageState] =
    useState<ComprehensiveAnalysisResult | null>(initialComprehensiveState);
  const [activeTab, setActiveTab] = useState<string | undefined>(undefined);
  const [selectedArticleUrlsForAnalysis, setSelectedArticleUrlsForAnalysis] =
    useState<Set<string>>(new Set());
  const [fetchOnlyFrontPage, setFetchOnlyFrontPage] = useState(true);

  const [customAnalysisContext, setCustomAnalysisContext] = useState("");
  const [editableChineseCommentary, setEditableChineseCommentary] =
    useState("");
  const [editableEnglishCommentary, setEditableEnglishCommentary] =
    useState("");

  const [masterAiImageUrl, setMasterAiImageUrl] = useState<string | null>(null);
  const [isGeneratingMasterAiImage, setIsGeneratingMasterAiImage] =
    useState(false);
  const [masterAiImageError, setMasterAiImageError] = useState<string | null>(
    null
  );

  const [chineseInfoImageUrl, setChineseInfoImageUrl] = useState<string | null>(
    null
  );
  const [isGeneratingChineseInfoImage, setIsGeneratingChineseInfoImage] =
    useState(false);
  const [chineseInfoImageError, setChineseInfoImageError] = useState<
    string | null
  >(null);

  const [englishInfoImageUrl, setEnglishInfoImageUrl] = useState<string | null>(
    null
  );
  const [isGeneratingEnglishInfoImage, setIsGeneratingEnglishInfoImage] =
    useState(false);
  const [englishInfoImageError, setEnglishInfoImageError] = useState<
    string | null
  >(null);

  const [isPostingChineseBundle, setIsPostingChineseBundle] = useState(false);
  const [isPostingEnglishBundle, setIsPostingEnglishBundle] = useState(false);
  const [isPostingMasterAiImage, setIsPostingMasterAiImage] = useState(false);

  const [isOneClickPublishing, setIsOneClickPublishing] = useState(false);

  const { toast } = useToast();
  const [isFetching, startFetchingTransition] = useTransition();
  const [isAnalyzing, startAnalyzingTransition] = useTransition();

  useEffect(() => {
    const authStatus = sessionStorage.getItem(AUTH_SESSION_KEY);
    if (authStatus === "true") {
      setIsAuthenticated(true);
    } else {
      setIsAuthenticated(false);
    }
    setSelectedDate(new Date());
    setMaxCalendarDate(getBeijingCurrentDateForCalendar());
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (pageState?.commentary) {
      const datePrefix = pageState.fetchedDate
        ? `【人民日报头版总结 ${clientFormatDisplayDate(
            pageState.fetchedDate
          )}】\n`
        : "";
      const fullInitialText = `${datePrefix}${pageState.commentary}`;
      setEditableChineseCommentary(
        truncateCommentaryMaintainSentence(
          fullInitialText,
          MAX_CHINESE_COMMENTARY_LENGTH
        )
      );
    } else if (!isAnalyzing && !isOneClickPublishing) {
      setEditableChineseCommentary("");
    }
  }, [
    pageState?.commentary,
    pageState?.fetchedDate,
    isAnalyzing,
    isOneClickPublishing,
    isAuthenticated,
  ]);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (pageState?.englishCommentary) {
      const datePrefix = pageState.fetchedDate
        ? `【People's Daily Summary ${clientFormatDisplayDate(
            pageState.fetchedDate
          )}】\n`
        : "";
      const fullInitialText = `${datePrefix}${pageState.englishCommentary}`;
      setEditableEnglishCommentary(
        truncateCommentaryMaintainSentence(
          fullInitialText,
          MAX_ENGLISH_COMMENTARY_LENGTH
        )
      );
    } else if (!isAnalyzing && !isOneClickPublishing) {
      setEditableEnglishCommentary("");
    }
  }, [
    pageState?.englishCommentary,
    pageState?.fetchedDate,
    isAnalyzing,
    isOneClickPublishing,
    isAuthenticated,
  ]);

  const resetUiForNewFetchOrPublish = (
    keepCommentariesAndImages: boolean = false
  ) => {
    setPageState((prev) => ({
      ...(prev || initialComprehensiveState),
      articles: keepCommentariesAndImages ? prev?.articles : [],
      allPageLayouts: keepCommentariesAndImages ? prev?.allPageLayouts : [],
      fetchOnlyFrontPageUsed: keepCommentariesAndImages
        ? prev?.fetchOnlyFrontPageUsed ?? false
        : false,
      error: undefined,
      fetchedUrl: keepCommentariesAndImages ? prev?.fetchedUrl : undefined,
      fetchedDate: keepCommentariesAndImages ? prev?.fetchedDate : undefined,
      commentary: keepCommentariesAndImages ? prev?.commentary : undefined,
      englishCommentary: keepCommentariesAndImages
        ? prev?.englishCommentary
        : undefined,
      articleCategories: keepCommentariesAndImages
        ? prev?.articleCategories
        : undefined,
      titleXiJinpingContentScore: keepCommentariesAndImages
        ? prev?.xiJinpingUniqueTitleMentions
        : undefined,
      bodyXiJinpingContentScore: keepCommentariesAndImages
        ? prev?.xiJinpingUniqueBodyMentions
        : undefined,
      articleEnglishTitlesMap: keepCommentariesAndImages
        ? prev?.articleEnglishTitlesMap
        : undefined,
    }));

    setActiveTab(keepCommentariesAndImages ? activeTab : undefined);
    setSelectedArticleUrlsForAnalysis(
      keepCommentariesAndImages ? selectedArticleUrlsForAnalysis : new Set()
    );

    if (!keepCommentariesAndImages) {
      setEditableChineseCommentary("");
      setEditableEnglishCommentary("");
      setMasterAiImageUrl(null);
      setChineseInfoImageUrl(null);
      setEnglishInfoImageUrl(null);
    }
    setMasterAiImageError(null);
    setChineseInfoImageError(null);
    setEnglishInfoImageError(null);
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordInput) {
      setAuthError("Password cannot be empty.");
      return;
    }
    setIsVerifyingPassword(true);
    setAuthError("");
    try {
      const verificationResult = await verifyPassword(passwordInput);

      if (verificationResult.success && verificationResult.isValid) {
        setIsAuthenticated(true);
        sessionStorage.setItem(AUTH_SESSION_KEY, "true");
        toast({
          title: "Authentication Successful",
          description: "Welcome to China News Watcher.",
        });
      } else if (verificationResult.success && !verificationResult.isValid) {
        setAuthError("Invalid password. Please try again.");
        setIsAuthenticated(false);
        sessionStorage.removeItem(AUTH_SESSION_KEY);
      } else {
        // Handles verificationResult.success === false (e.g. config error from server)
        setAuthError(
          verificationResult.message ||
            "An error occurred during verification. Please try again."
        );
        setIsAuthenticated(false);
        sessionStorage.removeItem(AUTH_SESSION_KEY);
      }
    } catch (error: any) {
      // Catch client-side/network errors or truly unexpected server action failures
      console.error("Password verification client-side/network error:", error);
      let clientErrorMsg =
        "An error occurred during verification. Please try again later.";
      if (error && typeof error.message === "string") {
        if (
          error.message.includes(
            "An unexpected response was received from the server."
          )
        ) {
          clientErrorMsg =
            "A server communication error occurred. Please try again later.";
        } else {
          clientErrorMsg = error.message;
        }
      }
      setAuthError(clientErrorMsg);
      setIsAuthenticated(false);
      sessionStorage.removeItem(AUTH_SESSION_KEY);
    } finally {
      setIsVerifyingPassword(false);
      setPasswordInput("");
    }
  };

  const handleFetchContent = async () => {
    if (!isAuthenticated) {
      toast({
        variant: "destructive",
        title: "Not Authenticated",
        description: "Please enter the password to use this feature.",
      });
      return;
    }
    if (!selectedDate) {
      toast({
        variant: "destructive",
        title: "Cannot Fetch",
        description: "Please select a date first.",
      });
      return;
    }
    resetUiForNewFetchOrPublish();

    startFetchingTransition(async () => {
      try {
        const dateParam = format(selectedDate, "yyyy-MM-dd");
        const fetchResult = await performInitialFetch(
          dateParam,
          fetchOnlyFrontPage
        );

        if (fetchResult.error) {
          setPageState({
            ...initialComprehensiveState,
            error: fetchResult.error,
            articles: [],
            allPageLayouts: fetchResult.allPageLayouts || [],
            fetchOnlyFrontPageUsed: fetchOnlyFrontPage,
          });
          toast({
            variant: "destructive",
            title: "Fetch Failed",
            description: fetchResult.error,
          });
        } else {
          setPageState((prev) => ({ ...prev!, ...fetchResult }));
          let defaultToastMessage = `Content fetched for ${
            fetchResult.fetchedDate || "selected date"
          }. Found ${fetchResult.articles?.length || 0} articles.`;
          if (
            fetchResult.allPageLayouts &&
            fetchResult.allPageLayouts.length > 0 &&
            fetchResult.articles &&
            fetchResult.articles.length > 0
          ) {
            const firstLayoutUrl = fetchResult.allPageLayouts[0].url;
            setActiveTab(firstLayoutUrl);
            const articlesInFirstLayout = fetchResult.articles.filter(
              (a) => a.sourcePageLayoutUrl === firstLayoutUrl
            );
            setSelectedArticleUrlsForAnalysis(
              new Set(articlesInFirstLayout.map((a) => a.url))
            );
            if (fetchResult.fetchOnlyFrontPageUsed) {
              defaultToastMessage = `Fetched ${
                articlesInFirstLayout.length
              } articles from the front page for ${
                fetchResult.fetchedDate || "selected date"
              }. Selected these for analysis.`;
            } else {
              defaultToastMessage = `Fetched ${fetchResult.articles.length} articles from ${fetchResult.allPageLayouts.length} layouts. Defaulted selection to articles from the first page.`;
            }
          }
          toast({ title: "Fetch Complete", description: defaultToastMessage });
        }
      } catch (error: any) {
        let description =
          "An unexpected client-side error occurred during fetch.";
        if (
          error &&
          typeof error.message === "string" &&
          error.message ===
            "An unexpected response was received from the server."
        ) {
          description =
            "A server error occurred while fetching content. Please check server logs or try again later.";
        } else if (error && typeof error.message === "string") {
          description = error.message;
        }
        toast({
          variant: "destructive",
          title: "Fetch Operation Failed",
          description,
          duration: 7000,
        });
        setPageState(
          (prev) =>
            ({
              ...(prev || initialComprehensiveState),
              error: description,
            } as ComprehensiveAnalysisResult)
        );
      }
    });
  };

  const handleArticleSelection = useCallback(
    (articleUrl: string, isSelected: boolean) => {
      setSelectedArticleUrlsForAnalysis((prev) => {
        const newSelected = new Set(prev);
        isSelected
          ? newSelected.add(articleUrl)
          : newSelected.delete(articleUrl);
        return newSelected;
      });
    },
    []
  );

  const handleLayoutSelection = useCallback(
    (
      layoutUrl: string,
      articlesInLayout: FetchedArticle[],
      isSelected: boolean
    ) => {
      setSelectedArticleUrlsForAnalysis((prev) => {
        const newSelected = new Set(prev);
        articlesInLayout.forEach((article) =>
          isSelected
            ? newSelected.add(article.url)
            : newSelected.delete(article.url)
        );
        return newSelected;
      });
    },
    []
  );

  const getLayoutCheckboxState = useCallback(
    (layoutUrl: string): boolean | "indeterminate" => {
      if (!pageState?.articles) return false;
      const articlesInLayout = pageState.articles.filter(
        (a) => a.sourcePageLayoutUrl === layoutUrl
      );
      if (articlesInLayout.length === 0) return false;
      const selectedCount = articlesInLayout.filter((a) =>
        selectedArticleUrlsForAnalysis.has(a.url)
      ).length;
      if (selectedCount === 0) return false;
      if (selectedCount === articlesInLayout.length) return true;
      return "indeterminate";
    },
    [pageState?.articles, selectedArticleUrlsForAnalysis]
  );

  const allArticlesCount = pageState?.articles?.length || 0;
  const isAllArticlesSelected =
    selectedArticleUrlsForAnalysis.size === allArticlesCount &&
    allArticlesCount > 0;

  const handleToggleSelectAllArticles = () => {
    if (!isAuthenticated) {
      toast({
        variant: "destructive",
        title: "Not Authenticated",
        description: "Please enter the password to use this feature.",
      });
      return;
    }
    if (!pageState?.articles || pageState.articles.length === 0) return;
    const allUrls = pageState.articles.map((a) => a.url);
    setSelectedArticleUrlsForAnalysis(
      isAllArticlesSelected ? new Set() : new Set(allUrls)
    );
  };

  const handleAnalyzeContent = async () => {
    if (!isAuthenticated) {
      toast({
        variant: "destructive",
        title: "Not Authenticated",
        description: "Please enter the password to use this feature.",
      });
      return;
    }
    if (!pageState?.articles || pageState.articles.length === 0) {
      toast({
        variant: "destructive",
        title: "Cannot Analyze",
        description: "No articles fetched.",
      });
      return;
    }
    const articlesToAnalyze = pageState.articles.filter((article) =>
      selectedArticleUrlsForAnalysis.has(article.url)
    );
    if (articlesToAnalyze.length === 0) {
      toast({
        variant: "destructive",
        title: "Cannot Analyze",
        description: "Please select articles.",
      });
      return;
    }

    startAnalyzingTransition(async () => {
      try {
        setPageState((prev) => ({
          ...(prev || initialComprehensiveState),
          identifiedOfficials: undefined,
          commentary: undefined,
          englishCommentary: undefined,
          articleCategories: undefined,
          titleXiJinpingContentScore: undefined,
          bodyXiJinpingContentScore: undefined,
          articleEnglishTitlesMap: undefined,
          error: prev?.error?.startsWith("Fetch Failed")
            ? prev.error
            : undefined,
        }));
        setEditableChineseCommentary("");
        setEditableEnglishCommentary("");
        setMasterAiImageUrl(null);
        setMasterAiImageError(null);
        setChineseInfoImageUrl(null);
        setChineseInfoImageError(null);
        setEnglishInfoImageUrl(null);
        setEnglishInfoImageError(null);

        const analysisResult: AiAnalysisData = await performAiAnalysisOnContent(
          articlesToAnalyze,
          customAnalysisContext,
          pageState?.fetchedDate
        );
        if (
          analysisResult.error &&
          !analysisResult.commentary &&
          !analysisResult.englishCommentary
        ) {
          setPageState((prev) => ({
            ...(prev || initialComprehensiveState),
            error: `Analysis Failed: ${analysisResult.error}`,
          }));
          toast({
            variant: "destructive",
            title: "Analysis Failed",
            description: analysisResult.error,
            duration: 7000,
          });
        } else {
          setPageState((prev) => ({
            ...(prev || initialComprehensiveState),
            ...analysisResult,
          }));
          let toastMessage = `AI analysis finished for ${articlesToAnalyze.length} articles.`;
          if (analysisResult.error) {
            toastMessage += ` Partial analysis error. Details: ${analysisResult.error}`;
            toast({
              variant: "default",
              title: "Analysis Partially Complete",
              description: toastMessage,
              duration: 10000,
            });
          } else {
            toast({ title: "Analysis Complete", description: toastMessage });
          }
        }
      } catch (error: any) {
        let description =
          "An unexpected client-side error occurred during analysis.";
        if (
          error &&
          typeof error.message === "string" &&
          error.message ===
            "An unexpected response was received from the server."
        ) {
          description =
            "A server error occurred while performing AI analysis. Please check server logs or try again later.";
        } else if (error && typeof error.message === "string") {
          description = error.message;
        }
        toast({
          variant: "destructive",
          title: "Analysis Operation Failed",
          description,
          duration: 7000,
        });
        setPageState(
          (prev) =>
            ({
              ...(prev || initialComprehensiveState),
              error: description,
            } as ComprehensiveAnalysisResult)
        );
      }
    });
  };

  const handleChineseCommentaryChange = (newText: string) => {
    setEditableChineseCommentary(
      truncateCommentaryMaintainSentence(newText, MAX_CHINESE_COMMENTARY_LENGTH)
    );
  };

  const handleEnglishCommentaryChange = (newText: string) => {
    setEditableEnglishCommentary(
      truncateCommentaryMaintainSentence(newText, MAX_ENGLISH_COMMENTARY_LENGTH)
    );
  };

  const handlePostToXWebIntent = (isChinese: boolean) => {
    if (!isAuthenticated) {
      toast({
        variant: "destructive",
        title: "Not Authenticated",
        description: "Please enter the password to use this feature.",
      });
      return;
    }
    const textToPost = isChinese
      ? editableChineseCommentary
      : editableEnglishCommentary;
    if (!textToPost.trim()) {
      toast({
        variant: "destructive",
        title: "Cannot Post",
        description: "No commentary to post.",
      });
      return;
    }
    const tweetText = encodeURIComponent(textToPost);
    window.open(`https://x.com/intent/tweet?text=${tweetText}`, "_blank");
    toast({
      title: "Opened X Compose Window",
      description: "Commentary pre-filled. Manually attach images if desired.",
    });
  };

  const handlePostChineseBundleToXViaApi = async () => {
    if (!isAuthenticated) {
      toast({ variant: "destructive", title: "Not Authenticated" });
      return;
    }
    setIsPostingChineseBundle(true);
    try {
      const commentaryForPosting = serverFormatCommentaryForPosting(
        pageState?.commentary,
        pageState?.fetchedDate,
        "zh"
      );
      if (!commentaryForPosting.trim()) {
        toast({
          variant: "destructive",
          title: "API Post Failed",
          description: "Formatted Chinese commentary is empty.",
        });
        return;
      }
      if (!chineseInfoImageUrl) {
        toast({
          variant: "destructive",
          title: "API Post Failed",
          description: "Chinese Info Image not generated.",
        });
        return;
      }
      const result = await postToXWithImageViaAPI(
        commentaryForPosting,
        chineseInfoImageUrl
      );
      if (result.success)
        toast({
          title: "Posted Chinese Bundle to X!",
          description:
            result.message +
            (result.tweetUrl ? ` View: ${result.tweetUrl}` : ""),
        });
      else
        toast({
          variant: "destructive",
          title: "Chinese Bundle Post Failed",
          description: result.message,
          duration: 10000,
        });
    } catch (error: any) {
      const desc =
        error.message === "An unexpected response was received from the server."
          ? "Server error during X post."
          : error.message;
      toast({
        variant: "destructive",
        title: "Chinese Bundle Post Error",
        description: desc,
        duration: 10000,
      });
    } finally {
      setIsPostingChineseBundle(false);
    }
  };

  const handlePostEnglishBundleToXViaApi = async () => {
    if (!isAuthenticated) {
      toast({ variant: "destructive", title: "Not Authenticated" });
      return;
    }
    setIsPostingEnglishBundle(true);
    try {
      const commentaryForPosting = serverFormatCommentaryForPosting(
        pageState?.englishCommentary,
        pageState?.fetchedDate,
        "en"
      );
      if (!commentaryForPosting.trim()) {
        toast({
          variant: "destructive",
          title: "API Post Failed",
          description: "Formatted English commentary is empty.",
        });
        return;
      }
      if (!englishInfoImageUrl) {
        toast({
          variant: "destructive",
          title: "API Post Failed",
          description: "English Info Image not generated.",
        });
        return;
      }
      const result = await postToXWithImageViaAPI(
        commentaryForPosting,
        englishInfoImageUrl
      );
      if (result.success)
        toast({
          title: "Posted English Bundle to X!",
          description:
            result.message +
            (result.tweetUrl ? ` View: ${result.tweetUrl}` : ""),
        });
      else
        toast({
          variant: "destructive",
          title: "English Bundle Post Failed",
          description: result.message,
          duration: 10000,
        });
    } catch (error: any) {
      const desc =
        error.message === "An unexpected response was received from the server."
          ? "Server error during X post."
          : error.message;
      toast({
        variant: "destructive",
        title: "English Bundle Post Error",
        description: desc,
        duration: 10000,
      });
    } finally {
      setIsPostingEnglishBundle(false);
    }
  };

  const handlePostMasterAiImageToXViaApi = async () => {
    if (!isAuthenticated) {
      toast({ variant: "destructive", title: "Not Authenticated" });
      return;
    }
    if (!masterAiImageUrl) {
      toast({
        variant: "destructive",
        title: "API Post Failed",
        description: "Master AI Image not generated.",
      });
      return;
    }
    setIsPostingMasterAiImage(true);
    try {
      let caption = "人民日报总结";
      if (pageState?.fetchedDate) {
        const zhDate = clientFormatDisplayDate(pageState.fetchedDate);
        let enDate = zhDate;
        try {
          const parsedDate = parse(
            pageState.fetchedDate,
            "yyyyMMdd",
            new Date()
          );
          enDate = format(parsedDate, "dd-MM-yyyy");
        } catch (e) {
          console.warn(
            "Could not parse fetchedDate for English AI image caption."
          );
        }
        caption = `北京时间 ${zhDate} 人民日报总结\nBeijing Time ${enDate} People's Daily Summary`;
      }

      const result = await postToXWithImageViaAPI(caption, masterAiImageUrl);
      if (result.success)
        toast({
          title: "Posted AI Image to X!",
          description:
            result.message +
            (result.tweetUrl ? ` View: ${result.tweetUrl}` : ""),
        });
      else
        toast({
          variant: "destructive",
          title: "AI Image Post Failed",
          description: result.message,
          duration: 10000,
        });
    } catch (error: any) {
      const desc =
        error.message === "An unexpected response was received from the server."
          ? "Server error during X post."
          : error.message;
      toast({
        variant: "destructive",
        title: "AI Image Post Error",
        description: desc,
        duration: 10000,
      });
    } finally {
      setIsPostingMasterAiImage(false);
    }
  };

  const handleGenerateMasterAiImage = async () => {
    if (!isAuthenticated) {
      toast({ variant: "destructive", title: "Not Authenticated" });
      return;
    }

    const englishCommentaryText = pageState?.englishCommentary;
    if (!englishCommentaryText || !englishCommentaryText.trim()) {
      toast({
        variant: "destructive",
        title: "Cannot Generate Image",
        description: "English commentary is not available or is empty.",
      });
      return;
    }

    setIsGeneratingMasterAiImage(true);
    setMasterAiImageError(null);
    setMasterAiImageUrl(null);

    let englishTitlesString: string | undefined = undefined;
    if (
      pageState?.articleEnglishTitlesMap &&
      Object.keys(pageState.articleEnglishTitlesMap).length > 0
    ) {
      englishTitlesString = Object.values(pageState.articleEnglishTitlesMap)
        .filter((title) => title && title.trim() !== "")
        .join("; ");
    }

    try {
      const result: GenerateAiImageResult =
        await generateAiCommentaryImageAction(
          englishCommentaryText,
          "en",
          englishTitlesString
        );
      if (result.imageDataUri) {
        setMasterAiImageUrl(result.imageDataUri);
        toast({
          title: "Master AI Image Generated!",
          description: "Image preview updated below.",
        });
      } else {
        setMasterAiImageError(
          result.error || "Unknown error generating master AI image."
        );
        toast({
          variant: "destructive",
          title: "Master AI Image Generation Failed",
          description:
            result.error ||
            "The AI could not generate an image for this commentary.",
          duration: 7000,
        });
      }
    } catch (error: any) {
      const desc =
        error.message === "An unexpected response was received from the server."
          ? "Server error during AI image generation."
          : error.message;
      setMasterAiImageError(desc);
      toast({
        variant: "destructive",
        title: "Master AI Image Generation Error",
        description: desc,
        duration: 7000,
      });
    } finally {
      setIsGeneratingMasterAiImage(false);
    }
  };

  const handleGenerateInfoImage = async (language: "zh" | "en") => {
    if (
      !isAuthenticated ||
      !pageState ||
      !pageState.fetchedDate ||
      !pageState.articles ||
      pageState.articles.length === 0
    ) {
      toast({
        variant: "destructive",
        title: "Cannot Generate Info Image",
        description:
          "Required data (date, articles) is missing or analysis not run.",
      });
      return;
    }
    if (
      !pageState.articleCategories ||
      (!pageState.articleCategories.articlesWithXi.length &&
        !pageState.articleCategories.otherAnalyzedArticles.length)
    ) {
      toast({
        variant: "destructive",
        title: "Cannot Generate Info Image",
        description:
          "Article categorization data is missing. Please run analysis first.",
      });
      return;
    }

    const setLoading =
      language === "zh"
        ? setIsGeneratingChineseInfoImage
        : setIsGeneratingEnglishInfoImage;
    const setImageUrl =
      language === "zh" ? setChineseInfoImageUrl : setEnglishInfoImageUrl;
    const setError =
      language === "zh" ? setChineseInfoImageError : setEnglishInfoImageError;

    setLoading(true);
    setImageUrl(null);
    setError(null);

    let allRelevantTitles: string[] = [];
    if (pageState.articleCategories) {
      const xiArticles = pageState.articleCategories.articlesWithXi || [];
      const otherArticles =
        pageState.articleCategories.otherAnalyzedArticles || [];

      const combined = [...xiArticles, ...otherArticles];

      allRelevantTitles = combined
        .map((article) => {
          if (language === "en") {
            return (
              pageState.articleEnglishTitlesMap?.[article.title] ||
              article.title
            );
          }
          return article.title;
        })
        .filter((title) => title && title.trim() !== "")
        .slice(0, MAX_TITLES_FOR_INFO_IMAGE);
    }

    if (allRelevantTitles.length === 0 && pageState.articles.length > 0) {
      console.warn(
        "No categorized articles for info image, falling back to all selected analyzed articles for titles."
      );
      const selectedAnalyzedArticles = pageState.articles.filter((a) =>
        selectedArticleUrlsForAnalysis.has(a.url)
      );
      allRelevantTitles = selectedAnalyzedArticles
        .map((article) => {
          if (language === "en") {
            return (
              pageState.articleEnglishTitlesMap?.[article.title] ||
              article.title
            );
          }
          return article.title;
        })
        .filter((title) => title && title.trim() !== "")
        .slice(0, MAX_TITLES_FOR_INFO_IMAGE);
    }

    const infoImageData: InfoImageData = {
      fetchedDate: clientFormatDisplayDate(pageState.fetchedDate),
      xiJinpingUniqueTitleMentions: pageState.xiJinpingUniqueTitleMentions,
      xiJinpingUniqueBodyMentions: pageState.xiJinpingUniqueBodyMentions,
      xiIndex:
        (pageState.xiJinpingBodyCount ?? 0) +
        (pageState.xiJinpingTitleCount ?? 0),
      articleTitles: allRelevantTitles,
    };

    try {
      const result: GenerateInfoImageResult = await generateInfoImageAction(
        infoImageData,
        language
      );
      if (result.imageDataUri) {
        setImageUrl(result.imageDataUri);
        toast({
          title: `${
            language === "zh" ? "Chinese" : "English"
          } Info Image Generated!`,
          description: "Preview updated.",
        });
      } else {
        setError(
          result.error || `Unknown error generating ${language} info image.`
        );
        toast({
          variant: "destructive",
          title: `${
            language === "zh" ? "Chinese" : "English"
          } Info Image Failed`,
          description:
            result.error || "The server could not generate the image.",
          duration: 7000,
        });
      }
    } catch (error: any) {
      const desc =
        error.message === "An unexpected response was received from the server."
          ? `Server error during ${language} info image generation.`
          : error.message;
      setError(desc);
      toast({
        variant: "destructive",
        title: `${language === "zh" ? "Chinese" : "English"} Info Image Error`,
        description: desc,
        duration: 7000,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOneClickPublish = async () => {
    if (!isAuthenticated) {
      toast({
        variant: "destructive",
        title: "Not Authenticated",
        description: "Please enter the password to use this feature.",
      });
      return;
    }
    if (!selectedDate) {
      toast({
        variant: "destructive",
        title: "Cannot Publish",
        description: "Please select a date.",
      });
      return;
    }
    setIsOneClickPublishing(true);
    resetUiForNewFetchOrPublish(true);

    try {
      toast({
        title: "Quick Publish Initiated",
        description: "Processing on the server...",
        duration: 5000,
      });
      const result = await triggerScheduledQuickPublish(selectedDate);

      setPageState((prev) => ({
        ...(prev || initialComprehensiveState),
        fetchedDate: result.fetchedDateForCommentary || prev?.fetchedDate,
        englishCommentary:
          result.englishCommentaryContent || prev?.englishCommentary,
        commentary: result.chineseCommentaryContent || prev?.commentary,
        error: result.errorDetails
          ? prev?.error
            ? `${prev.error}\nQuickPublish: ${result.errorDetails}`
            : `QuickPublish: ${result.errorDetails}`
          : prev?.error,
      }));
      if (result.masterAiImageUrlForQuickPublish)
        setMasterAiImageUrl(result.masterAiImageUrlForQuickPublish);
      if (result.chineseInfoImageUrlForQuickPublish)
        setChineseInfoImageUrl(result.chineseInfoImageUrlForQuickPublish);
      if (result.englishInfoImageUrlForQuickPublish)
        setEnglishInfoImageUrl(result.englishInfoImageUrlForQuickPublish);

      if (result.success) {
        toast({
          title: "Quick Publish Successful!",
          description: result.message,
          duration: 10000,
        });
      } else {
        toast({
          variant: "destructive",
          title: "Quick Publish Failed",
          description:
            result.message +
            (result.errorDetails ? ` Details: ${result.errorDetails}` : ""),
          duration: 10000,
        });
      }
    } catch (error: any) {
      console.error("One-click publish client-side error:", error);
      let description = "Unexpected error during Quick Publish.";
      if (
        error &&
        typeof error.message === "string" &&
        error.message === "An unexpected response was received from the server."
      ) {
        description =
          "A server error occurred while Quick Publishing. Please check server logs or try again later.";
      } else if (error && typeof error.message === "string") {
        description = error.message;
      }
      toast({
        variant: "destructive",
        title: "Quick Publish Error",
        description,
        duration: 7000,
      });
      setPageState(
        (prev) =>
          ({
            ...(prev || initialComprehensiveState),
            error: description,
          } as ComprehensiveAnalysisResult)
      );
    } finally {
      setIsOneClickPublishing(false);
    }
  };

  const getTabFallbackLabel = (url: string, index: number) => {
    try {
      const path = new URL(url).pathname;
      return `版面 ${index + 1} (${
        path.substring(path.lastIndexOf("/") + 1) || `page-${index + 1}`
      })`;
    } catch {
      return `版面 ${index + 1}`;
    }
  };

  const isAnyActionInProgress =
    isFetching ||
    isAnalyzing ||
    isOneClickPublishing ||
    isGeneratingMasterAiImage ||
    isGeneratingChineseInfoImage ||
    isGeneratingEnglishInfoImage ||
    isPostingChineseBundle ||
    isPostingEnglishBundle ||
    isPostingMasterAiImage;

  const showAnalysisRelatedSections =
    (isAnalyzing ||
      (pageState &&
        (pageState.articleCategories ||
          pageState.commentary ||
          pageState.englishCommentary ||
          (pageState.articles && pageState.articles.length > 0)))) &&
    selectedArticleUrlsForAnalysis.size > 0 &&
    !isFetching &&
    !isOneClickPublishing;

  if (isAuthenticated === null) {
    return (
      <div className="flex flex-col items-center justify-center w-full min-h-screen p-4 bg-background">
        <Loader2 className="h-12 w-12 text-primary animate-spin" />
        <p className="mt-4 text-muted-foreground">Loading Application...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center w-full min-h-screen p-4 bg-background">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader>
            <CardTitle className="font-headline text-2xl flex items-center justify-center text-primary">
              <LockIcon className="mr-2 h-6 w-6" />
              China News Watcher
            </CardTitle>
            <CardDescription className="text-center font-body">
              Please enter the password to access the application.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <Label htmlFor="password-input" className="font-body">
                  Password
                </Label>
                <Input
                  id="password-input"
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className="mt-1 font-body"
                  disabled={isVerifyingPassword}
                  autoFocus
                />
              </div>
              {authError && (
                <p className="text-sm text-destructive font-body flex items-center">
                  <AlertTriangleIcon className="mr-1 h-4 w-4" /> {authError}
                </p>
              )}
              <Button
                type="submit"
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                disabled={isVerifyingPassword}
              >
                {isVerifyingPassword ? (
                  <>
                    {" "}
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />{" "}
                    Verifying...{" "}
                  </>
                ) : (
                  <>
                    {" "}
                    <LogInIcon className="mr-2 h-4 w-4" /> Access Application{" "}
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  const commonInfoImageCardProps = (
    isLoading: boolean,
    imageUrl: string | null,
    error: string | null,
    language: "zh" | "en",
    title: string
  ) => ({
    isLoading,
    imageUrl,
    error,
    onGenerate: () => handleGenerateInfoImage(language),
    onDownload: () => {
      if (imageUrl) {
        const link = document.createElement("a");
        link.href = imageUrl;
        link.download = `${language}_info_image_${
          pageState?.fetchedDate || "current"
        }_600x800.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    },
    title,
    isDisabled:
      isAnyActionInProgress ||
      !pageState?.fetchedDate ||
      !pageState?.articles ||
      pageState.articles.length === 0 ||
      !pageState?.articleCategories,
  });

  return (
    <div className="flex flex-col items-center w-full min-h-screen p-4 sm:p-6 md:p-8 bg-background">
      <header className="mb-8 text-center">
        <div className="flex items-center justify-center mb-2">
          <NewspaperIcon className="h-12 w-12 text-primary mr-3" />
          <h1 className="text-4xl font-headline font-bold text-primary">
            China News Watcher
          </h1>
        </div>
        <p className="text-muted-foreground font-body">
          Fetches and analyzes People's Daily content, generating multilingual
          commentary & AI images.
        </p>
      </header>

      <main className="w-full max-w-4xl space-y-6">
        <ConfigurationPanel
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
          maxCalendarDate={maxCalendarDate}
          fetchOnlyFrontPage={fetchOnlyFrontPage}
          onFetchOnlyFrontPageChange={setFetchOnlyFrontPage}
          onFetchContent={handleFetchContent}
          onOneClickPublish={handleOneClickPublish}
          isFetching={isFetching}
          isAnalyzing={isAnalyzing}
          isOneClickPublishing={isOneClickPublishing}
          isGeneratingSnapshot={
            isGeneratingMasterAiImage ||
            isGeneratingChineseInfoImage ||
            isGeneratingEnglishInfoImage
          }
          isPostingViaApi={
            isPostingChineseBundle ||
            isPostingEnglishBundle ||
            isPostingMasterAiImage
          }
        />

        {isFetching &&
          !pageState?.articles?.length &&
          !isOneClickPublishing && (
            <Card>
              <CardContent className="pt-6 space-y-2 rounded-md border p-3 bg-muted/30">
                <h4 className="font-headline text-lg flex items-center">
                  <BookOpenCheckIcon className="mr-2 h-5 w-5 text-primary animate-pulse" />
                  Fetching Content...
                </h4>
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full mt-2" />
              </CardContent>
            </Card>
          )}
        {isOneClickPublishing && (
          <Card>
            <CardContent className="pt-6 space-y-3 rounded-md border p-4 bg-muted/50 text-center">
              <Loader2 className="h-8 w-8 text-primary animate-spin mx-auto mb-3" />
              <h4 className="font-headline text-xl text-primary">
                Quick Publish in Progress...
              </h4>
              <p className="text-muted-foreground text-sm">
                Fetching, analyzing, generating commentaries & images, then
                posting to X.
              </p>
              <Progress
                value={undefined}
                className="w-full h-2 mt-3 animate-pulse"
              />
            </CardContent>
          </Card>
        )}
        {pageState?.error &&
          !isFetching &&
          !isAnalyzing &&
          !isOneClickPublishing && (
            <Card className="border-destructive bg-destructive/10 shadow-lg">
              <CardHeader>
                <CardTitle className="font-headline text-xl flex items-center text-destructive">
                  <AlertTriangleIcon className="mr-2 h-5 w-5" />
                  Operation Failed
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-destructive-foreground font-body whitespace-pre-wrap">
                  {pageState.error}
                </p>
              </CardContent>
            </Card>
          )}

        {!isFetching &&
          !isOneClickPublishing &&
          pageState &&
          (pageState.fetchedUrl ||
            (pageState.articles && pageState.articles.length > 0)) && (
            <FetchedContentDisplay
              pageState={pageState}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              formatDisplayDate={clientFormatDisplayDate}
              getTabFallbackLabel={getTabFallbackLabel}
            />
          )}

        {!isFetching &&
          !isOneClickPublishing &&
          pageState &&
          pageState.articles &&
          pageState.articles.length > 0 && (
            <ArticleSelector
              pageState={pageState}
              selectedArticleUrls={selectedArticleUrlsForAnalysis}
              onArticleSelection={handleArticleSelection}
              onLayoutSelection={handleLayoutSelection}
              getLayoutCheckboxState={getLayoutCheckboxState}
              onToggleSelectAllArticles={handleToggleSelectAllArticles}
              isFetching={isFetching}
              isAnalyzing={isAnalyzing}
              isOneClickPublishing={isOneClickPublishing}
              allArticlesCount={allArticlesCount}
              isAllArticlesSelected={isAllArticlesSelected}
              getTabFallbackLabel={getTabFallbackLabel}
            />
          )}

        {!isFetching &&
          !isOneClickPublishing &&
          pageState &&
          pageState.articles &&
          pageState.articles.length > 0 && (
            <>
              <AnalysisContextInput
                customAnalysisContext={customAnalysisContext}
                onCustomAnalysisContextChange={setCustomAnalysisContext}
                isAnyActionInProgress={isAnyActionInProgress}
              />
              <div className="mt-6 flex justify-center">
                <Button
                  onClick={handleAnalyzeContent}
                  disabled={
                    isAnyActionInProgress ||
                    selectedArticleUrlsForAnalysis.size === 0
                  }
                  className="w-full max-w-xs bg-accent hover:bg-accent/90 text-accent-foreground py-6 text-lg"
                >
                  {isAnalyzing ? (
                    <>
                      {" "}
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />{" "}
                      Analyzing...{" "}
                    </>
                  ) : (
                    <>
                      {" "}
                      <BrainIcon className="mr-2 h-5 w-5" /> Analyze (
                      {selectedArticleUrlsForAnalysis.size}) Selected Articles
                    </>
                  )}
                </Button>
              </div>
            </>
          )}

        {isAuthenticated && showAnalysisRelatedSections && (
          <>
            <AnalysisResultsDisplay
              pageState={pageState}
              isAnalyzing={isAnalyzing}
              selectedArticleCount={selectedArticleUrlsForAnalysis.size}
            />
            <div className="space-y-6 mt-6">
              <CommentaryDisplay
                title="Chinese Commentary"
                rawAiCommentary={pageState?.commentary}
                editableCommentary={editableChineseCommentary}
                onEditableCommentaryChange={handleChineseCommentaryChange}
                isLoading={isAnalyzing && !pageState?.commentary}
                maxWeightedLength={MAX_CHINESE_COMMENTARY_LENGTH}
                getWeightedCharCount={calculateWeightedLength}
                onCopyToClipboard={() => {
                  if (editableChineseCommentary.trim()) {
                    navigator.clipboard.writeText(editableChineseCommentary);
                    toast({ title: "Chinese commentary copied!" });
                  } else {
                    toast({
                      variant: "destructive",
                      title: "Cannot Copy",
                      description: "Chinese commentary is empty.",
                    });
                  }
                }}
                onPostToXWebIntent={() => handlePostToXWebIntent(true)}
                placeholderText={
                  isAnalyzing
                    ? "Generating commentary..."
                    : selectedArticleUrlsForAnalysis.size > 0 &&
                      pageState?.articles &&
                      pageState.articles.length > 0
                    ? "Chinese commentary will appear here after analysis."
                    : "Select articles and click analyze."
                }
                isAnyOverallLoading={isAnyActionInProgress}
              />

              <CommentaryDisplay
                title="English Commentary"
                icon={LanguagesIcon}
                rawAiCommentary={pageState?.englishCommentary}
                editableCommentary={editableEnglishCommentary}
                onEditableCommentaryChange={handleEnglishCommentaryChange}
                isLoading={isAnalyzing && !pageState?.englishCommentary}
                maxWeightedLength={MAX_ENGLISH_COMMENTARY_LENGTH}
                getWeightedCharCount={calculateWeightedLength}
                onCopyToClipboard={() => {
                  if (editableEnglishCommentary.trim()) {
                    navigator.clipboard.writeText(editableEnglishCommentary);
                    toast({ title: "English commentary copied!" });
                  } else {
                    toast({
                      variant: "destructive",
                      title: "Cannot Copy",
                      description: "English commentary is empty.",
                    });
                  }
                }}
                onPostToXWebIntent={() => handlePostToXWebIntent(false)}
                placeholderText={
                  isAnalyzing
                    ? "Generating commentary..."
                    : selectedArticleUrlsForAnalysis.size > 0 &&
                      pageState?.articles &&
                      pageState.articles.length > 0
                    ? "English commentary will appear here after analysis."
                    : "Select articles and click analyze."
                }
                isAnyOverallLoading={isAnyActionInProgress}
              />
            </div>

            <div className="grid md:grid-cols-2 gap-6 mt-6">
              <InfoImageCard
                {...commonInfoImageCardProps(
                  isGeneratingChineseInfoImage,
                  chineseInfoImageUrl,
                  chineseInfoImageError,
                  "zh",
                  "Chinese Info Image (600x800)"
                )}
              />
              <InfoImageCard
                {...commonInfoImageCardProps(
                  isGeneratingEnglishInfoImage,
                  englishInfoImageUrl,
                  englishInfoImageError,
                  "en",
                  "English Info Image (600x800)"
                )}
              />
            </div>

            <Card className="shadow-lg mt-6">
              <CardHeader>
                <CardTitle className="font-headline text-xl flex items-center">
                  <AiImageIcon className="mr-2 h-5 w-5 text-accent" />
                  AI Generated Image
                </CardTitle>
                <CardDescription className="font-body">
                  Generates a 300x400 text-free image based on the English
                  commentary and article titles.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  onClick={handleGenerateMasterAiImage}
                  disabled={
                    isAnyActionInProgress || !pageState?.englishCommentary
                  }
                  className="w-full sm:w-auto bg-accent hover:bg-accent/90 text-accent-foreground"
                >
                  {isGeneratingMasterAiImage ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />{" "}
                      Generating Image...
                    </>
                  ) : (
                    <>
                      <AiImageIcon className="mr-2 h-4 w-4" /> Generate AI Image
                    </>
                  )}
                </Button>
                {isGeneratingMasterAiImage && !masterAiImageUrl && (
                  <div className="mt-4 p-3 bg-muted/50 border border-border rounded-md text-center">
                    <Loader2 className="mx-auto h-8 w-8 text-primary animate-spin mb-2" />
                    <p className="text-sm text-primary">
                      Generating AI Image (300x400, no text)...
                    </p>
                  </div>
                )}
                {masterAiImageError &&
                  !masterAiImageUrl &&
                  !isGeneratingMasterAiImage && (
                    <div className="mt-4 p-3 bg-destructive/10 border border-destructive rounded-md text-center">
                      <ImageOffIcon className="mx-auto h-8 w-8 text-destructive mb-2" />
                      <p className="text-sm text-destructive-foreground">
                        AI Image generation failed.
                        {masterAiImageError && (
                          <span className="block text-xs mt-1">
                            Details: {masterAiImageError}
                          </span>
                        )}
                      </p>
                    </div>
                  )}
                {masterAiImageUrl && !isGeneratingMasterAiImage && (
                  <div className="mt-4 flex flex-col items-center">
                    <img
                      src={masterAiImageUrl}
                      alt="Master AI Generated Image"
                      className="rounded-md border shadow-sm bg-muted"
                      style={{
                        display: "block",
                        width: "300px",
                        height: "400px",
                        maxWidth: "100%",
                        objectFit: "contain",
                        margin: "0 auto",
                      }}
                    />
                    <Button
                      onClick={() => {
                        const link = document.createElement("a");
                        link.href = masterAiImageUrl!;
                        link.download = `master_ai_image_${
                          pageState?.fetchedDate || "current"
                        }.png`;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                      }}
                      variant="outline"
                      className="mt-3 w-full sm:w-auto"
                      disabled={isAnyActionInProgress || !masterAiImageUrl}
                    >
                      <DownloadIcon className="mr-2 h-4 w-4" />
                      Download AI Image
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-lg mt-6">
              <CardHeader>
                <CardTitle className="font-headline text-xl flex items-center">
                  <TwitterIcon className="mr-2 h-5 w-5 text-blue-500" /> Post to
                  X (via API)
                </CardTitle>
                <CardDescription className="font-body">
                  Post generated content and images directly to X using the API,
                  following the new bundled strategy.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  onClick={handlePostChineseBundleToXViaApi}
                  disabled={
                    isAnyActionInProgress ||
                    !editableChineseCommentary.trim() ||
                    !chineseInfoImageUrl ||
                    calculateWeightedLength(
                      serverFormatCommentaryForPosting(
                        pageState?.commentary,
                        pageState?.fetchedDate,
                        "zh"
                      )
                    ) > MAX_CHINESE_COMMENTARY_LENGTH
                  }
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                  title={
                    !editableChineseCommentary.trim()
                      ? "Chinese commentary is empty."
                      : !chineseInfoImageUrl
                      ? "Chinese Info Image not generated."
                      : calculateWeightedLength(
                          serverFormatCommentaryForPosting(
                            pageState?.commentary,
                            pageState?.fetchedDate,
                            "zh"
                          )
                        ) > MAX_CHINESE_COMMENTARY_LENGTH
                      ? "Chinese commentary too long for X."
                      : "Post Chinese Commentary + Info Image"
                  }
                >
                  {isPostingChineseBundle ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Share2Icon className="mr-2 h-4 w-4" />
                  )}
                  Post Chinese (Text + Info Image)
                </Button>
                <Button
                  onClick={handlePostEnglishBundleToXViaApi}
                  disabled={
                    isAnyActionInProgress ||
                    !editableEnglishCommentary.trim() ||
                    !englishInfoImageUrl ||
                    calculateWeightedLength(
                      serverFormatCommentaryForPosting(
                        pageState?.englishCommentary,
                        pageState?.fetchedDate,
                        "en"
                      )
                    ) > MAX_ENGLISH_COMMENTARY_LENGTH
                  }
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                  title={
                    !editableEnglishCommentary.trim()
                      ? "English commentary is empty."
                      : !englishInfoImageUrl
                      ? "English Info Image not generated."
                      : calculateWeightedLength(
                          serverFormatCommentaryForPosting(
                            pageState?.englishCommentary,
                            pageState?.fetchedDate,
                            "en"
                          )
                        ) > MAX_ENGLISH_COMMENTARY_LENGTH
                      ? "English commentary too long for X."
                      : "Post English Commentary + Info Image"
                  }
                >
                  {isPostingEnglishBundle ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Share2Icon className="mr-2 h-4 w-4" />
                  )}
                  Post English (Text + Info Image)
                </Button>
                <Button
                  onClick={handlePostMasterAiImageToXViaApi}
                  disabled={isAnyActionInProgress || !masterAiImageUrl}
                  className="w-full bg-accent hover:bg-accent/90 text-accent-foreground"
                  title={
                    !masterAiImageUrl
                      ? "Master AI Image not generated."
                      : "Post AI Image with standard caption"
                  }
                >
                  {isPostingMasterAiImage ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <AiImageIcon className="mr-2 h-4 w-4" />
                  )}
                  Post AI Image (Standard Caption)
                </Button>
              </CardContent>
            </Card>
          </>
        )}
      </main>
      <footer className="mt-12 text-center text-sm text-muted-foreground font-body">
        <p>
          &copy; {new Date().getFullYear()} China News Watcher. All rights
          reserved.
        </p>
      </footer>
    </div>
  );
}

interface InfoImageCardProps {
  isLoading: boolean;
  imageUrl: string | null;
  error: string | null;
  onGenerate: () => void;
  onDownload: () => void;
  title: string;
  isDisabled: boolean;
}

function InfoImageCard({
  isLoading,
  imageUrl,
  error,
  onGenerate,
  onDownload,
  title,
  isDisabled,
}: InfoImageCardProps) {
  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="font-headline text-xl flex items-center">
          <CanvasImageIcon className="mr-2 h-5 w-5 text-primary" />
          {title}
        </CardTitle>
        <CardDescription className="font-body">
          Server-generated canvas image. Generated at 600x800, displayed at
          300x400.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          onClick={onGenerate}
          disabled={isDisabled || isLoading}
          className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...
            </>
          ) : (
            <>
              <CanvasImageIcon className="mr-2 h-4 w-4" /> Generate Info Image
            </>
          )}
        </Button>
        {isLoading && !imageUrl && (
          <div className="mt-4 p-3 bg-muted/50 border border-border rounded-md text-center">
            <Loader2 className="mx-auto h-8 w-8 text-primary animate-spin mb-2" />
            <p className="text-sm text-primary">
              Generating Server Canvas Image...
            </p>
          </div>
        )}
        {error && !imageUrl && !isLoading && (
          <div className="mt-4 p-3 bg-destructive/10 border border-destructive rounded-md text-center">
            <ImageOffIcon className="mx-auto h-8 w-8 text-destructive mb-2" />
            <p className="text-sm text-destructive-foreground">
              Info Image generation failed.
              {error && (
                <span className="block text-xs mt-1">Details: {error}</span>
              )}
            </p>
          </div>
        )}
        {imageUrl && !isLoading && (
          <div className="mt-4 flex flex-col items-center">
            <img
              src={imageUrl}
              alt={title}
              className="rounded-md border shadow-sm bg-muted"
              style={{
                display: "block",
                width: "300px",
                height: "400px",
                maxWidth: "100%",
                objectFit: "contain",
                margin: "0 auto",
              }}
            />
            <Button
              onClick={onDownload}
              variant="outline"
              className="mt-3 w-full sm:w-auto"
              disabled={isDisabled || isLoading || !imageUrl}
            >
              <DownloadIcon className="mr-2 h-4 w-4" />
              Download Info Image (600x800)
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
