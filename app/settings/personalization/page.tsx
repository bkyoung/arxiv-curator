'use client';

/**
 * Personalization Settings Page
 *
 * Configure scoring preferences, topic/keyword filters, and exploration settings
 */

import { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Settings2, Loader2, X } from 'lucide-react';

export default function PersonalizationPage() {
  const { data: profile, isLoading, refetch } = trpc.settings.getProfile.useQuery();

  const [includeTopicsInput, setIncludeTopicsInput] = useState('');
  const [excludeTopicsInput, setExcludeTopicsInput] = useState('');
  const [includeKeywordsInput, setIncludeKeywordsInput] = useState('');
  const [excludeKeywordsInput, setExcludeKeywordsInput] = useState('');
  const [mathDepthMax, setMathDepthMax] = useState(0.5);
  const [explorationRate, setExplorationRate] = useState(0.15);

  // Initialize state from profile
  useEffect(() => {
    if (profile) {
      setMathDepthMax(profile.mathDepthMax || 0.5);
      setExplorationRate(profile.explorationRate || 0.15);
    }
  }, [profile]);

  const updatePersonalizationMutation = trpc.settings.updatePersonalization.useMutation({
    onSuccess: () => refetch(),
  });

  const updateMathSensitivityMutation = trpc.settings.updateMathSensitivity.useMutation({
    onSuccess: () => refetch(),
  });

  const updateExplorationRateMutation = trpc.settings.updateExplorationRate.useMutation({
    onSuccess: () => refetch(),
  });

  const handleAddIncludeTopic = () => {
    if (!includeTopicsInput.trim() || !profile) return;

    const topics = [...(profile.includeTopics || []), includeTopicsInput.trim()];
    updatePersonalizationMutation.mutate({ includeTopics: topics });
    setIncludeTopicsInput('');
  };

  const handleRemoveIncludeTopic = (topic: string) => {
    if (!profile) return;
    const topics = (profile.includeTopics || []).filter((t) => t !== topic);
    updatePersonalizationMutation.mutate({ includeTopics: topics });
  };

  const handleAddExcludeTopic = () => {
    if (!excludeTopicsInput.trim() || !profile) return;

    const topics = [...(profile.excludeTopics || []), excludeTopicsInput.trim()];
    updatePersonalizationMutation.mutate({ excludeTopics: topics });
    setExcludeTopicsInput('');
  };

  const handleRemoveExcludeTopic = (topic: string) => {
    if (!profile) return;
    const topics = (profile.excludeTopics || []).filter((t) => t !== topic);
    updatePersonalizationMutation.mutate({ excludeTopics: topics });
  };

  const handleAddIncludeKeyword = () => {
    if (!includeKeywordsInput.trim() || !profile) return;

    const keywords = [...(profile.includeKeywords || []), includeKeywordsInput.trim()];
    updatePersonalizationMutation.mutate({ includeKeywords: keywords });
    setIncludeKeywordsInput('');
  };

  const handleRemoveIncludeKeyword = (keyword: string) => {
    if (!profile) return;
    const keywords = (profile.includeKeywords || []).filter((k) => k !== keyword);
    updatePersonalizationMutation.mutate({ includeKeywords: keywords });
  };

  const handleAddExcludeKeyword = () => {
    if (!excludeKeywordsInput.trim() || !profile) return;

    const keywords = [...(profile.excludeKeywords || []), excludeKeywordsInput.trim()];
    updatePersonalizationMutation.mutate({ excludeKeywords: keywords });
    setExcludeKeywordsInput('');
  };

  const handleRemoveExcludeKeyword = (keyword: string) => {
    if (!profile) return;
    const keywords = (profile.excludeKeywords || []).filter((k) => k !== keyword);
    updatePersonalizationMutation.mutate({ excludeKeywords: keywords });
  };

  const handleMathSensitivityChange = (value: number[]) => {
    const newValue = value[0];
    setMathDepthMax(newValue);
    updateMathSensitivityMutation.mutate({ mathDepthMax: newValue });
  };

  const handleExplorationRateChange = (value: number[]) => {
    const newValue = value[0];
    setExplorationRate(newValue);
    updateExplorationRateMutation.mutate({ explorationRate: newValue });
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Settings2 className="h-8 w-8" />
          <h1 className="text-3xl font-bold">Personalization</h1>
        </div>
        <p className="text-muted-foreground">
          Configure your preferences for paper scoring and recommendations
        </p>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Settings */}
      {!isLoading && profile && (
        <div className="space-y-6">
          {/* Topics */}
          <Card>
            <CardHeader>
              <CardTitle>Topic Preferences</CardTitle>
              <CardDescription>
                Boost or filter papers based on research topics
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Include Topics */}
              <div className="space-y-2">
                <Label htmlFor="include-topics">Include Topics (Boost +0.2)</Label>
                <div className="flex gap-2">
                  <Input
                    id="include-topics"
                    value={includeTopicsInput}
                    onChange={(e) => setIncludeTopicsInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddIncludeTopic()}
                    placeholder="e.g., agents, rag, multimodal"
                  />
                  <Button onClick={handleAddIncludeTopic}>Add</Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {(profile.includeTopics || []).map((topic) => (
                    <Badge key={topic} variant="secondary" className="gap-1">
                      {topic}
                      <button
                        onClick={() => handleRemoveIncludeTopic(topic)}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Exclude Topics */}
              <div className="space-y-2">
                <Label htmlFor="exclude-topics">Exclude Topics (Hard Filter)</Label>
                <div className="flex gap-2">
                  <Input
                    id="exclude-topics"
                    value={excludeTopicsInput}
                    onChange={(e) => setExcludeTopicsInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddExcludeTopic()}
                    placeholder="e.g., theory, math"
                  />
                  <Button onClick={handleAddExcludeTopic}>Add</Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {(profile.excludeTopics || []).map((topic) => (
                    <Badge key={topic} variant="destructive" className="gap-1">
                      {topic}
                      <button
                        onClick={() => handleRemoveExcludeTopic(topic)}
                        className="ml-1 hover:text-destructive-foreground"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Keywords */}
          <Card>
            <CardHeader>
              <CardTitle>Keyword Preferences</CardTitle>
              <CardDescription>
                Boost or filter papers based on specific keywords
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Include Keywords */}
              <div className="space-y-2">
                <Label htmlFor="include-keywords">Include Keywords (Boost +0.1)</Label>
                <div className="flex gap-2">
                  <Input
                    id="include-keywords"
                    value={includeKeywordsInput}
                    onChange={(e) => setIncludeKeywordsInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddIncludeKeyword()}
                    placeholder="e.g., llm, gpt, transformer"
                  />
                  <Button onClick={handleAddIncludeKeyword}>Add</Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {(profile.includeKeywords || []).map((keyword) => (
                    <Badge key={keyword} variant="secondary" className="gap-1">
                      {keyword}
                      <button
                        onClick={() => handleRemoveIncludeKeyword(keyword)}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Exclude Keywords */}
              <div className="space-y-2">
                <Label htmlFor="exclude-keywords">Exclude Keywords (Hard Filter)</Label>
                <div className="flex gap-2">
                  <Input
                    id="exclude-keywords"
                    value={excludeKeywordsInput}
                    onChange={(e) => setExcludeKeywordsInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddExcludeKeyword()}
                    placeholder="e.g., proof, theorem"
                  />
                  <Button onClick={handleAddExcludeKeyword}>Add</Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {(profile.excludeKeywords || []).map((keyword) => (
                    <Badge key={keyword} variant="destructive" className="gap-1">
                      {keyword}
                      <button
                        onClick={() => handleRemoveExcludeKeyword(keyword)}
                        className="ml-1 hover:text-destructive-foreground"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Math Sensitivity */}
          <Card>
            <CardHeader>
              <CardTitle>Math Sensitivity</CardTitle>
              <CardDescription>
                Adjust tolerance for mathematical complexity (0 = avoid math, 1 = embrace math)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="math-sensitivity">Current: {mathDepthMax.toFixed(2)}</Label>
                  <span className="text-sm text-muted-foreground">
                    {mathDepthMax < 0.3 ? 'Avoid Math' : mathDepthMax < 0.7 ? 'Moderate' : 'Embrace Math'}
                  </span>
                </div>
                <Slider
                  id="math-sensitivity"
                  aria-label="Math sensitivity"
                  value={[mathDepthMax]}
                  onValueChange={handleMathSensitivityChange}
                  min={0}
                  max={1}
                  step={0.1}
                  className="w-full"
                />
              </div>
            </CardContent>
          </Card>

          {/* Exploration Rate */}
          <Card>
            <CardHeader>
              <CardTitle>Exploration Rate</CardTitle>
              <CardDescription>
                Balance between showing familiar papers (0%) and discovering new topics (30%)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="exploration-rate">Current: {(explorationRate * 100).toFixed(0)}%</Label>
                  <span className="text-sm text-muted-foreground">
                    {explorationRate < 0.1 ? 'Exploit' : explorationRate < 0.2 ? 'Balanced' : 'Explore'}
                  </span>
                </div>
                <Slider
                  id="exploration-rate"
                  aria-label="Exploration rate"
                  value={[explorationRate]}
                  onValueChange={handleExplorationRateChange}
                  min={0}
                  max={0.3}
                  step={0.05}
                  className="w-full"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
