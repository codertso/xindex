
// src/components/app/CommentaryDisplay.tsx
"use client";

import React from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from '@/lib/utils';
import { CopyIcon, SendIcon, MessageCircleMoreIcon } from 'lucide-react';

interface CommentaryDisplayProps {
  title: string;
  icon?: React.ElementType;
  rawAiCommentary: string | undefined;
  editableCommentary: string;
  onEditableCommentaryChange: (text: string) => void;
  isLoading: boolean;
  maxWeightedLength: number;
  getWeightedCharCount: (text: string) => number;
  onCopyToClipboard: () => void;
  onPostToXWebIntent: () => void;
  placeholderText: string;
  isAnyOverallLoading?: boolean;
}

export function CommentaryDisplay({
  title,
  icon: IconComponent = MessageCircleMoreIcon,
  rawAiCommentary,
  editableCommentary,
  onEditableCommentaryChange,
  isLoading,
  maxWeightedLength,
  getWeightedCharCount,
  onCopyToClipboard,
  onPostToXWebIntent,
  placeholderText,
  isAnyOverallLoading,
}: CommentaryDisplayProps) {

  const currentWeightedLength = getWeightedCharCount(editableCommentary);
  const isOverLimit = currentWeightedLength > maxWeightedLength;

  const commonButtonDisabledState = isLoading || isAnyOverallLoading;

  const webPostDisabled = !editableCommentary.trim() || isOverLimit || commonButtonDisabledState;
  let webPostTooltipReason: string | null = null;
  if (!editableCommentary.trim()) webPostTooltipReason = "Commentary is empty.";
  else if (isOverLimit) webPostTooltipReason = `Commentary too long (current: ${currentWeightedLength}, max: ${maxWeightedLength}). Please shorten it.`;
  else if (isLoading) webPostTooltipReason = "Commentary generation in progress...";
  else if (isAnyOverallLoading) webPostTooltipReason = "An operation is in progress...";
  
  const copyButtonDisabled = !editableCommentary.trim() || commonButtonDisabledState;

  return (
    <Card className="shadow-lg">
      <CardHeader className="flex flex-row justify-between items-start sm:items-center p-6">
        <div className="flex-1">
          <CardTitle className="font-headline text-xl flex items-center">
            <IconComponent className="mr-2 h-5 w-5 text-accent" />
            {title}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="min-h-[120px] font-body">
        {isLoading && !rawAiCommentary ? (
          <>
            <Skeleton className="h-4 w-3/4 mb-2" />
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-2/3 mb-2" />
          </>
        ) : (
          <div className="relative">
            <Textarea
              value={editableCommentary}
              onChange={(e) => onEditableCommentaryChange(e.target.value)}
              placeholder={placeholderText}
              rows={8}
              className="w-full p-2 border rounded-md font-body pr-12" // Added pr-12 for char count space
              disabled={commonButtonDisabledState && !isOverLimit}
            />
            <div className={cn(
              "absolute bottom-2 right-3 text-xs text-muted-foreground",
              isOverLimit && "text-destructive font-semibold"
            )}>
              {currentWeightedLength}/{maxWeightedLength}
            </div>
          </div>
        )}
      </CardContent>
      {(rawAiCommentary || editableCommentary) && !isLoading && (
        <CardFooter className="flex justify-between items-center flex-wrap gap-2 pt-4">
          <div className="flex gap-2 flex-wrap">
            <Button onClick={onCopyToClipboard} variant="outline" className="w-full sm:w-auto" disabled={copyButtonDisabled}>
              <CopyIcon className="mr-2 h-4 w-4" />
              Copy Commentary
            </Button>
          </div>
          <div className="flex gap-2 flex-wrap">
            <TooltipProvider>
              <Tooltip open={webPostDisabled && webPostTooltipReason ? undefined : false}>
                <TooltipTrigger asChild>
                  <span tabIndex={webPostDisabled ? 0 : undefined}>
                    <Button
                      onClick={onPostToXWebIntent}
                      variant="default"
                      className="w-full sm:w-auto bg-accent hover:bg-accent/90 text-accent-foreground"
                      disabled={webPostDisabled}
                    >
                      <SendIcon className="mr-2 h-4 w-4" />
                      Post to X (Web)
                    </Button>
                  </span>
                </TooltipTrigger>
                {webPostDisabled && webPostTooltipReason && (
                  <TooltipContent>
                    <p>{webPostTooltipReason}</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          </div>
        </CardFooter>
      )}
    </Card>
  );
}

