/**
 * ModelsSettings Component
 *
 * UI for configuring AI model preferences
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

interface ModelsSettingsProps {
  profile: {
    embeddingModel: 'local' | 'cloud';
    languageModel: 'local' | 'cloud';
  };
  onSave: (models: {
    embeddingModel: 'local' | 'cloud';
    languageModel: 'local' | 'cloud';
  }) => void;
}

export function ModelsSettings({ profile, onSave }: ModelsSettingsProps) {
  const [embeddingModel, setEmbeddingModel] = useState(profile.embeddingModel);
  const [languageModel, setLanguageModel] = useState(profile.languageModel);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSuccess(false);

    try {
      await onSave({
        embeddingModel,
        languageModel,
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save model settings');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>AI Models Configuration</CardTitle>
          <CardDescription>
            Choose between local (Ollama) and cloud (Google) models
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Embedding Model */}
          <div className="space-y-3">
            <Label>Embedding Model</Label>
            <p className="text-sm text-muted-foreground">
              Used for semantic search and paper similarity
            </p>
            <RadioGroup
              value={embeddingModel}
              onValueChange={(value) => setEmbeddingModel(value as 'local' | 'cloud')}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="local" id="embedding-local" />
                <Label htmlFor="embedding-local" className="font-normal cursor-pointer">
                  Local (Ollama - mxbai-embed-large)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="cloud" id="embedding-cloud" />
                <Label htmlFor="embedding-cloud" className="font-normal cursor-pointer">
                  Cloud (Google - text-embedding-004)
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Language Model */}
          <div className="space-y-3">
            <Label>Language Model</Label>
            <p className="text-sm text-muted-foreground">
              Used for classification, summarization, and analysis
            </p>
            <RadioGroup
              value={languageModel}
              onValueChange={(value) => setLanguageModel(value as 'local' | 'cloud')}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="local" id="language-local" />
                <Label htmlFor="language-local" className="font-normal cursor-pointer">
                  Local (Ollama - llama3.2)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="cloud" id="language-cloud" />
                <Label htmlFor="language-cloud" className="font-normal cursor-pointer">
                  Cloud (Google - gemini-2.0-flash-exp)
                </Label>
              </div>
            </RadioGroup>
          </div>
        </CardContent>
      </Card>

      {/* Error/Success Messages */}
      {error && (
        <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-md bg-green-50 dark:bg-green-950 p-4 text-sm text-green-800 dark:text-green-200">
          Model settings saved successfully!
        </div>
      )}

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save Models'}
        </Button>
      </div>
    </div>
  );
}
