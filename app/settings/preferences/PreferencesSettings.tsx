/**
 * PreferencesSettings Component
 *
 * UI for configuring briefing preferences
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';

interface PreferencesSettingsProps {
  profile: {
    digestEnabled: boolean;
    noiseCap: number;
    scoreThreshold: number;
    explorationRate: number;
  };
  onSave: (preferences: {
    digestEnabled: boolean;
    noiseCap: number;
    scoreThreshold: number;
  }) => void;
}

export function PreferencesSettings({ profile, onSave }: PreferencesSettingsProps) {
  const [digestEnabled, setDigestEnabled] = useState(profile.digestEnabled);
  // Clamp noiseCap to valid range (10-20) to handle legacy data
  const [noiseCap, setNoiseCap] = useState(
    Math.min(Math.max(profile.noiseCap, 10), 20)
  );
  // Clamp scoreThreshold to valid range (0.3-0.7) to handle legacy data
  const [scoreThreshold, setScoreThreshold] = useState(
    Math.min(Math.max(profile.scoreThreshold, 0.3), 0.7)
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSuccess(false);

    try {
      await onSave({
        digestEnabled,
        noiseCap,
        scoreThreshold,
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save preferences');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Briefing Preferences</CardTitle>
          <CardDescription>
            Configure your daily paper digest settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Digest Enabled Toggle */}
          <div className="flex items-center justify-between space-x-4">
            <div className="flex-1 space-y-1">
              <Label htmlFor="digest-enabled">Enable Daily Digests</Label>
              <p className="text-sm text-muted-foreground">
                Receive daily paper recommendations via email or in-app
              </p>
            </div>
            <Switch
              id="digest-enabled"
              checked={digestEnabled}
              onCheckedChange={setDigestEnabled}
            />
          </div>

          {/* Noise Cap Slider */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="noise-cap">Maximum Papers per Day</Label>
              <span className="text-sm font-medium">{noiseCap}</span>
            </div>
            <Slider
              id="noise-cap"
              min={10}
              max={20}
              step={1}
              value={[noiseCap]}
              onValueChange={(value) => setNoiseCap(value[0])}
            />
            <p className="text-sm text-muted-foreground">
              Maximum number of papers to include in your daily digest (10-20)
            </p>
          </div>

          {/* Score Threshold Slider */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="score-threshold">Minimum Score Threshold</Label>
              <span className="text-sm font-medium">{Math.round(scoreThreshold * 100)}%</span>
            </div>
            <Slider
              id="score-threshold"
              min={0.3}
              max={0.7}
              step={0.05}
              value={[scoreThreshold]}
              onValueChange={(value) => setScoreThreshold(value[0])}
            />
            <p className="text-sm text-muted-foreground">
              Papers below this score will be filtered out (30%-70%)
            </p>
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
          Preferences saved successfully!
        </div>
      )}

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save Preferences'}
        </Button>
      </div>
    </div>
  );
}
