// src/components/app/ConfigurationPanel.tsx
"use client";

import React from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { UsersRoundIcon, CalendarIcon as CalendarSelectorIcon, DownloadIcon, RocketIcon, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface ConfigurationPanelProps {
  selectedDate: Date | undefined;
  onDateChange: (date: Date | undefined) => void;
  maxCalendarDate: Date | undefined;
  fetchOnlyFrontPage: boolean;
  onFetchOnlyFrontPageChange: (checked: boolean) => void;
  onFetchContent: () => void;
  onOneClickPublish: () => void;
  isFetching: boolean;
  isAnalyzing: boolean;
  isOneClickPublishing: boolean;
  isGeneratingSnapshot: boolean;
  isPostingViaApi: boolean;
}

export function ConfigurationPanel({
  selectedDate,
  onDateChange,
  maxCalendarDate,
  fetchOnlyFrontPage,
  onFetchOnlyFrontPageChange,
  onFetchContent,
  onOneClickPublish,
  isFetching,
  isAnalyzing,
  isOneClickPublishing,
  isGeneratingSnapshot,
  isPostingViaApi,
}: ConfigurationPanelProps) {
  const isAnyActionInProgress = isFetching || isAnalyzing || isOneClickPublishing || isGeneratingSnapshot || isPostingViaApi;

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="font-headline text-2xl flex items-center">
          <UsersRoundIcon className="mr-2 h-6 w-6 text-primary" />
          Configuration
        </CardTitle>
        <CardDescription className="font-body">
          Select a date and fetch content from People's Daily. Analysis can be performed on selected articles.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="analysis-date" className="font-headline text-lg">Analysis Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                id="analysis-date"
                className={cn(
                  "w-full justify-start text-left font-normal mt-1 font-body",
                  !selectedDate && "text-muted-foreground"
                )}
                disabled={isAnyActionInProgress}
              >
                <CalendarSelectorIcon className="mr-2 h-4 w-4" />
                {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={onDateChange}
                initialFocus
                disabled={(date) =>
                  (maxCalendarDate && date > maxCalendarDate) ||
                  date < new Date("1946-05-15") ||
                  isAnyActionInProgress
                }
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-2">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="fetch-only-front-page"
              checked={fetchOnlyFrontPage}
              onCheckedChange={(checked) => onFetchOnlyFrontPageChange(checked as boolean)}
              disabled={isAnyActionInProgress}
            />
            <Label htmlFor="fetch-only-front-page" className="font-body text-sm cursor-pointer whitespace-nowrap">
              Fetch only front page
            </Label>
          </div>
          <div className="flex gap-2 flex-col sm:flex-row">
            <Button
              onClick={onFetchContent}
              disabled={isAnyActionInProgress || !selectedDate}
              className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {isFetching ? (
                <> <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Fetching... </>
              ) : (
                <> <DownloadIcon className="mr-2 h-4 w-4" /> Fetch Content </>
              )}
            </Button>
            <Button
              onClick={onOneClickPublish}
              disabled={isAnyActionInProgress || !selectedDate}
              className="w-full sm:w-auto bg-accent hover:bg-accent/90 text-accent-foreground"
            >
              {isOneClickPublishing ? (
                <> <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Publishing... </>
              ) : (
                <> <RocketIcon className="mr-2 h-4 w-4" /> Quick Publish </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
