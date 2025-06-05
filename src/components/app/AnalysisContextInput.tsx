// src/components/app/AnalysisContextInput.tsx
"use client";

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquarePlusIcon } from 'lucide-react';

interface AnalysisContextInputProps {
  customAnalysisContext: string;
  onCustomAnalysisContextChange: (value: string) => void;
  isAnyActionInProgress: boolean;
}

export function AnalysisContextInput({
  customAnalysisContext,
  onCustomAnalysisContextChange,
  isAnyActionInProgress,
}: AnalysisContextInputProps) {
  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="font-headline text-xl flex items-center">
          <MessageSquarePlusIcon className="mr-2 h-5 w-5 text-primary" />
          Custom Analysis Context
        </CardTitle>
        <CardDescription className="font-body">
          Provide additional context or specific instructions for the AI analysis, especially for commentary generation.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Textarea
          value={customAnalysisContext}
          onChange={(e) => onCustomAnalysisContextChange(e.target.value)}
          placeholder="e.g., Focus on the impact on regional trade. Mention specific geopolitical events if relevant."
          rows={3}
          className="w-full p-2 border rounded-md font-body"
          disabled={isAnyActionInProgress}
        />
      </CardContent>
    </Card>
  );
}
