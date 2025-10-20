'use client';

/**
 * Settings Page
 *
 * Unified settings page with tabs for different configuration sections
 */

import { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings2, Database, Cpu, CheckCircle2, Loader2 } from 'lucide-react';
import { ModelsSettings } from '@/app/settings/models/ModelsSettings';
import { PreferencesSettings } from '@/app/settings/preferences/PreferencesSettings';

export default function SettingsPage() {
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [useLocalEmbeddings, setUseLocalEmbeddings] = useState(true);
  const [useLocalLLM, setUseLocalLLM] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Fetch categories and current settings
  const { data: categories } = trpc.settings.getCategories.useQuery();
  const { data: profile } = trpc.settings.getProfile.useQuery();

  // Mutations
  const updateCategories = trpc.settings.updateCategories.useMutation();
  const updateProcessing = trpc.settings.updateProcessing.useMutation();
  const updatePreferences = trpc.settings.updatePreferences.useMutation();

  // Initialize from profile
  useEffect(() => {
    if (profile) {
      setSelectedCategories(profile.arxivCategories);
      setUseLocalEmbeddings(profile.useLocalEmbeddings);
      setUseLocalLLM(profile.useLocalLLM);
    }
  }, [profile]);

  const handleCategoryToggle = (categoryId: string) => {
    setSelectedCategories((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      await Promise.all([
        updateCategories.mutateAsync({ categories: selectedCategories }),
        updateProcessing.mutateAsync({ useLocalEmbeddings, useLocalLLM }),
      ]);

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleModelsSave = async (models: {
    embeddingModel: 'local' | 'cloud';
    languageModel: 'local' | 'cloud';
  }) => {
    try {
      await updateProcessing.mutateAsync({
        useLocalEmbeddings: models.embeddingModel === 'local',
        useLocalLLM: models.languageModel === 'local',
      });
    } catch (error) {
      console.error('Failed to save models:', error);
    }
  };

  const handlePreferencesSave = async (preferences: {
    digestEnabled: boolean;
    noiseCap: number;
    scoreThreshold: number;
  }) => {
    try {
      await updatePreferences.mutateAsync(preferences);
    } catch (error) {
      console.error('Failed to save preferences:', error);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Settings2 className="h-8 w-8" />
          <h1 className="text-3xl font-bold">Settings</h1>
        </div>
        <p className="text-muted-foreground">
          Configure your research preferences and system settings
        </p>
      </div>

      <Tabs defaultValue="sources" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="sources">Sources</TabsTrigger>
          <TabsTrigger value="models">Models</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
        </TabsList>

        <TabsContent value="sources" className="space-y-6 mt-6">
        {/* arXiv Categories */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              arXiv Categories
            </CardTitle>
            <CardDescription>
              Select the computer science categories you want to track
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!categories && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading categories...
              </div>
            )}

            {categories && categories.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No categories available. Run the Scout agent to fetch categories.
              </p>
            )}

            {categories && categories.length > 0 && (
              <div className="grid gap-4 sm:grid-cols-2">
                {categories.map((category) => (
                  <div key={category.id} className="flex items-start space-x-2">
                    <Checkbox
                      id={category.id}
                      checked={selectedCategories.includes(category.id)}
                      onCheckedChange={() => handleCategoryToggle(category.id)}
                    />
                    <div className="grid gap-1.5 leading-none">
                      <Label
                        htmlFor={category.id}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {category.id}
                      </Label>
                      <p className="text-sm text-muted-foreground">{category.name}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Separator className="my-4" />

            <div className="text-sm text-muted-foreground">
              <p className="font-medium mb-1">Selected: {selectedCategories.length}</p>
              {selectedCategories.length > 0 && (
                <p className="text-xs">{selectedCategories.join(', ')}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Processing Preferences */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cpu className="h-5 w-5" />
              Processing Preferences
            </CardTitle>
            <CardDescription>
              Choose between local (ollama) or cloud processing
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start space-x-2">
              <Checkbox
                id="local-embeddings"
                checked={useLocalEmbeddings}
                onCheckedChange={(checked) => setUseLocalEmbeddings(checked as boolean)}
              />
              <div className="grid gap-1.5 leading-none">
                <Label
                  htmlFor="local-embeddings"
                  className="text-sm font-medium leading-none cursor-pointer"
                >
                  Use local embeddings
                </Label>
                <p className="text-sm text-muted-foreground">
                  Generate embeddings using ollama (faster, free, requires local setup)
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-2">
              <Checkbox
                id="local-llm"
                checked={useLocalLLM}
                onCheckedChange={(checked) => setUseLocalLLM(checked as boolean)}
              />
              <div className="grid gap-1.5 leading-none">
                <Label
                  htmlFor="local-llm"
                  className="text-sm font-medium leading-none cursor-pointer"
                >
                  Use local LLM
                </Label>
                <p className="text-sm text-muted-foreground">
                  Classify papers using ollama (faster, free, requires local setup)
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

          {/* Save Button */}
          <div className="flex items-center gap-3">
            <Button onClick={handleSave} disabled={isSaving || selectedCategories.length === 0}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Settings'
              )}
            </Button>

            {saveSuccess && (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                Settings saved successfully
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="models" className="mt-6">
          {profile && (
            <ModelsSettings
              profile={{
                embeddingModel: profile.useLocalEmbeddings ? 'local' : 'cloud',
                languageModel: profile.useLocalLLM ? 'local' : 'cloud',
              }}
              onSave={handleModelsSave}
            />
          )}
        </TabsContent>

        <TabsContent value="preferences" className="mt-6">
          {profile && (
            <PreferencesSettings
              profile={{
                digestEnabled: profile.digestEnabled ?? true,
                noiseCap: profile.noiseCap ?? 15,
                scoreThreshold: profile.scoreThreshold ?? 0.5,
                explorationRate: profile.explorationRate ?? 0.15,
              }}
              onSave={handlePreferencesSave}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
