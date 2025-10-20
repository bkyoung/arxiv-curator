# Phase 3: Briefings & Core UI - Technical Design

**Phase**: 3
**Name**: Briefings & Core UI
**Timeline**: Week 4 (Serial Development)
**Status**: Not Started
**Dependencies**: Phase 2 (Personalization & Scoring) ✅

---

## 1. Overview

### 1.1 Purpose

Phase 3 delivers the core user experience of the ArXiv Curator platform. This phase transforms the scored paper feed into a curated daily digest presented in a polished, keyboard-navigable interface. This is the **MVP milestone** - the first phase where users can experience the complete value proposition.

**Key Value**: Users receive a daily briefing of 10-20 highly relevant papers, delivered in a professional UI optimized for rapid scanning and decision-making.

### 1.2 Goals

1. **Implement Recommender Agent**: Generate daily digests with noise control and exploration
2. **Build Three-Pane Layout**: Professional UI with navigation, list, and detail views
3. **Enable Keyboard Navigation**: Hotkeys for efficient paper triage (j/k/s/h/c)
4. **Schedule Automated Digests**: Daily generation via pg-boss cron jobs
5. **Complete Settings Experience**: Unified settings UI for all configuration

### 1.3 Non-Goals (Deferred to Later Phases)

- AI-generated summaries (Phase 4)
- PDF analysis and critiques (Phase 5-6)
- Collections and notebooks (Phase 7)
- Trends and analytics (Phase 8)
- Production deployment (Phase 10-11)

---

## 2. Architecture

### 2.1 System Overview

```
┌──────────────────────────────────────────────────────────────┐
│              Phase 3: Briefings & Core UI                     │
└──────────────────────────────────────────────────────────────┘

┌─────────────┐       ┌──────────────┐       ┌─────────────┐
│   Ranked    │       │ Recommender  │       │    Daily    │
│   Papers    │──────▶│    Agent     │──────▶│  Briefing   │
│  (Phase 2)  │       │              │       │   (Digest)  │
└─────────────┘       └──────────────┘       └─────────────┘
                             │                       │
                             │ Uses                  │ Displayed in
                             ▼                       ▼
                  ┌──────────────────────┐  ┌──────────────────┐
                  │  User Profile Data   │  │  Three-Pane UI   │
                  │  - Exploration Rate  │  │  - Navigation    │
                  │  - Category Prefs    │  │  - Briefing List │
                  │  - Topic Rules       │  │  - Paper Detail  │
                  └──────────────────────┘  └──────────────────┘
                                                      │
                                                      │ Keyboard Nav
                                                      ▼
                                            ┌──────────────────┐
                                            │  Hotkeys Engine  │
                                            │  j/k - Navigate  │
                                            │  s   - Save      │
                                            │  h   - Hide      │
                                            │  c   - Critique  │
                                            └──────────────────┘
```

### 2.2 Component Interaction Flow

**Daily Digest Generation Flow**:
1. pg-boss cron job triggers at 6:30 AM daily
2. Recommender Agent loads user profiles
3. For each user:
   - Fetch ranked papers from last 24 hours
   - Apply noise cap (10-20 papers max)
   - Apply exploration strategy (15% diverse papers)
   - Filter for material improvement (score > threshold)
   - Create Briefing record in database
4. Users access briefing via `/briefings/latest` route

**User Interface Flow**:
1. User navigates to briefings page
2. Three-pane layout loads:
   - Left pane: Navigation (Today, Saved, Settings)
   - Middle pane: Briefing list (paper cards)
   - Right pane: Paper detail view
3. User presses `j`/`k` to navigate between papers
4. User presses `s` to save interesting paper
5. Feedback triggers profile update (Phase 2)

---

## 3. Recommender Agent

### 3.1 Daily Digest Generation Algorithm

**Purpose**: Select the optimal subset of papers for a user's daily briefing.

**Algorithm**:

```typescript
async function generateDailyDigest(userId: string): Promise<Briefing> {
  // 1. Load user profile
  const profile = await prisma.userProfile.findUnique({
    where: { userId }
  });

  // 2. Fetch ranked papers from last 24 hours
  const papers = await prisma.paper.findMany({
    where: {
      pubDate: { gte: yesterday },
      scores: {
        some: {
          userId,
          finalScore: { gte: profile.scoreThreshold || 0.5 } // Material improvement filter
        }
      }
    },
    include: {
      enriched: true,
      scores: { where: { userId }, orderBy: { scoredAt: 'desc' }, take: 1 }
    },
    orderBy: { scores: { finalScore: 'desc' } },
    take: 100 // Initial candidate pool
  });

  // 3. Apply noise cap (10-20 papers max)
  const noiseCap = profile.noiseCap || 15;

  // 4. Apply exploration strategy
  const explorationRate = profile.explorationRate || 0.15;
  const exploitCount = Math.floor(noiseCap * (1 - explorationRate));
  const exploreCount = noiseCap - exploitCount;

  // 5. Select papers
  const exploitPapers = papers.slice(0, exploitCount); // Top scored

  // For exploration: select from lower-scored papers with diversity
  const exploreCandidates = papers.slice(exploitCount);
  const explorePapers = selectDiversePapers(
    exploreCandidates,
    exploreCount,
    profile.interestVector
  );

  const selectedPapers = [...exploitPapers, ...explorePapers];

  // 6. Create briefing record
  const briefing = await prisma.briefing.create({
    data: {
      userId,
      date: new Date(),
      paperIds: selectedPapers.map(p => p.id),
      paperCount: selectedPapers.length,
      avgScore: average(selectedPapers.map(p => p.scores[0].finalScore)),
      status: 'ready'
    }
  });

  return briefing;
}
```

### 3.2 Diversity Selection for Exploration

**Purpose**: Ensure exploration papers are diverse, not just low-scoring duplicates.

```typescript
function selectDiversePapers(
  candidates: Paper[],
  count: number,
  userVector: number[]
): Paper[] {
  const selected: Paper[] = [];
  const remaining = [...candidates];

  while (selected.length < count && remaining.length > 0) {
    // Find paper most orthogonal to user vector (maximum diversity)
    const diversityScores = remaining.map(paper => ({
      paper,
      diversity: 1 - cosineSimilarity(paper.enriched.embedding, userVector)
    }));

    diversityScores.sort((a, b) => b.diversity - a.diversity);

    const chosen = diversityScores[0].paper;
    selected.push(chosen);

    // Remove from candidates
    const idx = remaining.findIndex(p => p.id === chosen.id);
    remaining.splice(idx, 1);
  }

  return selected;
}
```

### 3.3 Material Improvement Filter

**Purpose**: Only show papers that score above a minimum threshold.

**Configuration**:
```typescript
const DEFAULT_SCORE_THRESHOLD = 0.5; // Papers must score >= 50%
```

**User-Configurable**: Can be adjusted in settings (0.3 - 0.7 range)

### 3.4 Noise Cap Enforcement

**Purpose**: Limit cognitive overload by capping daily papers.

**Configuration**:
- Default: 15 papers
- User-configurable: 10-20 papers
- Enforced at selection time, not filtering

**Rationale**: Better to show 15 great papers than 100 mediocre ones.

---

## 4. Data Model

### 4.1 Briefing Model

```prisma
model Briefing {
  id          String   @id @default(cuid())
  userId      String
  date        DateTime @db.Date

  // Paper selection
  paperIds    String[] // References to Paper.id
  paperCount  Int
  avgScore    Float

  // Metadata
  status      String   // 'generating' | 'ready' | 'viewed'
  generatedAt DateTime @default(now())
  viewedAt    DateTime?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, date])
  @@index([userId, date])
}
```

**Notes**:
- `paperIds` is an array of IDs rather than a join table (simpler for daily digests)
- `date` is a Date type (not DateTime) for daily uniqueness
- `status` tracks generation and viewing state
- Unique constraint on `(userId, date)` ensures one briefing per user per day

### 4.2 BriefingView Model (Optional - for analytics)

```prisma
model BriefingView {
  id         String   @id @default(cuid())
  briefingId String
  paperId    String
  viewedAt   DateTime @default(now())

  briefing Briefing @relation(fields: [briefingId], references: [id], onDelete: Cascade)
  paper    Paper    @relation(fields: [paperId], references: [id], onDelete: Cascade)

  @@index([briefingId, viewedAt])
}
```

**Purpose**: Track which papers users actually viewed (analytics for Phase 9+)

---

## 5. Three-Pane Layout UI

### 5.1 Layout Structure

```
┌─────────────────────────────────────────────────────────────┐
│                        Header Bar                            │
│  ArXiv Curator    [Today] [Saved] [Settings]   [User Menu]  │
├──────────┬──────────────────────────────┬───────────────────┤
│          │                              │                   │
│  Nav     │     Briefing List            │   Paper Detail    │
│  Pane    │     (Paper Cards)            │   View            │
│          │                              │                   │
│  ├─Today │  ┌────────────────────────┐  │  Title            │
│  ├─Saved │  │ Paper 1                │  │  Authors          │
│  ├─Arch. │  │ Score: 87%  [badges]   │◀─┼─ Abstract         │
│  │       │  │ Why Shown: High P, E   │  │  [Score chart]    │
│  ├─Sets  │  └────────────────────────┘  │  [Why Shown]      │
│  │  ├─AI │  ┌────────────────────────┐  │  [Actions]        │
│  │  ├─ML │  │ Paper 2     ◀── active │  │  [PDF link]       │
│  │  └─NLP│  │ Score: 82%  [badges]   │  │                   │
│  │       │  │ Why Shown: Novelty     │  │                   │
│  └─Help  │  └────────────────────────┘  │                   │
│          │  ...                         │                   │
│  [j/k]   │  [10 more papers]            │  [s/h/c]          │
│          │                              │                   │
└──────────┴──────────────────────────────┴───────────────────┘
```

### 5.2 Responsive Behavior

**Desktop (≥1024px)**:
- Three-pane layout visible
- Navigation pane: 200px fixed width
- Briefing list: 400px fixed width
- Detail pane: Flexible remaining width

**Tablet (768px - 1023px)**:
- Two-pane layout: List + Detail
- Navigation collapses to hamburger menu
- List: 350px, Detail: remaining

**Mobile (< 768px)**:
- Single-pane layout
- Stack: List view by default
- Detail view slides in on paper selection
- Swipe gestures for navigation

### 5.3 Navigation Pane

**Components**:
```typescript
// app/briefings/components/NavigationPane.tsx

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: number; // For counts (e.g., saved papers)
}

const navItems: NavItem[] = [
  { label: 'Today', href: '/briefings/latest', icon: <Inbox /> },
  { label: 'Saved', href: '/saved', icon: <Bookmark />, badge: savedCount },
  { label: 'Archives', href: '/briefings', icon: <Archive /> },
];
```

**Keyboard Navigation**:
- `Ctrl+1`: Today's briefing
- `Ctrl+2`: Saved papers
- `Ctrl+3`: Archives

### 5.4 Briefing List Pane

**Paper Card Component**:
```typescript
// components/PaperCard.tsx

interface PaperCardProps {
  paper: Paper & { enriched: PaperEnriched; scores: Score[] };
  isActive: boolean;
  onSelect: () => void;
}

export function PaperCard({ paper, isActive, onSelect }: PaperCardProps) {
  const score = paper.scores[0];

  return (
    <Card
      className={cn(
        'cursor-pointer transition-colors',
        isActive && 'border-primary bg-accent'
      )}
      onClick={onSelect}
    >
      <CardContent className="p-4">
        {/* Score badge */}
        <div className="flex items-center justify-between mb-2">
          <Badge variant="secondary">
            {(score.finalScore * 100).toFixed(0)}% match
          </Badge>
          <div className="flex gap-1">
            {paper.enriched.hasCode && <Badge>Code</Badge>}
            {paper.enriched.hasBaselines && <Badge>Baselines</Badge>}
          </div>
        </div>

        {/* Title */}
        <h3 className="font-semibold text-sm mb-1 line-clamp-2">
          {paper.title}
        </h3>

        {/* Authors */}
        <p className="text-xs text-muted-foreground mb-2 line-clamp-1">
          {paper.authors.slice(0, 3).join(', ')}
          {paper.authors.length > 3 && ` +${paper.authors.length - 3}`}
        </p>

        {/* Topics */}
        <div className="flex flex-wrap gap-1 mb-2">
          {paper.enriched.topics.slice(0, 3).map(topic => (
            <Badge key={topic} variant="outline" className="text-xs">
              {topic}
            </Badge>
          ))}
        </div>

        {/* Why shown preview */}
        <p className="text-xs text-muted-foreground italic">
          Why shown: {getTopSignals(score).join(', ')}
        </p>
      </CardContent>
    </Card>
  );
}
```

**Features**:
- Compact card design (fits ~5-6 cards on screen)
- Visual highlighting for active card
- Score badge with percentage
- Evidence badges (Code, Baselines, etc.)
- Topic badges (limited to 3 for space)
- "Why shown" preview (top 2 signals)
- Truncated text with `line-clamp`

### 5.5 Detail Pane

**Full Paper View**:
```typescript
// app/briefings/components/PaperDetailView.tsx

interface PaperDetailViewProps {
  paper: Paper & { enriched: PaperEnriched; scores: Score[] };
}

export function PaperDetailView({ paper }: PaperDetailViewProps) {
  const score = paper.scores[0];

  return (
    <div className="h-full overflow-y-auto p-6">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold mb-2">{paper.title}</h1>
        <p className="text-sm text-muted-foreground">
          {paper.authors.join(', ')}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {formatDate(paper.pubDate)} · {paper.primaryCategory}
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-2 mb-4">
        <FeedbackActions paperId={paper.id} />
        <Button variant="outline" size="sm" asChild>
          <a href={paper.pdfUrl} target="_blank" rel="noopener">
            View PDF
          </a>
        </Button>
      </div>

      {/* Score Breakdown */}
      <ScoreBreakdown score={score} className="mb-4" />

      {/* Why Shown */}
      <WhyShown whyShown={score.whyShown} className="mb-4" />

      {/* Abstract */}
      <div className="mb-4">
        <h2 className="text-lg font-semibold mb-2">Abstract</h2>
        <p className="text-sm leading-relaxed">{paper.abstract}</p>
      </div>

      {/* Metadata */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <h3 className="text-sm font-semibold mb-1">Topics</h3>
          <div className="flex flex-wrap gap-1">
            {paper.enriched.topics.map(topic => (
              <Badge key={topic} variant="secondary">{topic}</Badge>
            ))}
          </div>
        </div>
        <div>
          <h3 className="text-sm font-semibold mb-1">Evidence</h3>
          <div className="flex flex-wrap gap-1">
            {paper.enriched.hasCode && <Badge>Code Available</Badge>}
            {paper.enriched.hasBaselines && <Badge>Baselines</Badge>}
            {paper.enriched.hasAblations && <Badge>Ablations</Badge>}
            {paper.enriched.hasData && <Badge>Data Available</Badge>}
          </div>
        </div>
      </div>

      {/* Math Depth */}
      <div className="mb-4">
        <h3 className="text-sm font-semibold mb-1">Math Depth</h3>
        <Progress value={paper.enriched.mathDepth * 100} className="h-2" />
        <p className="text-xs text-muted-foreground mt-1">
          {paper.enriched.mathDepth < 0.3 ? 'Practical' :
           paper.enriched.mathDepth < 0.6 ? 'Moderate' : 'Theoretical'}
        </p>
      </div>
    </div>
  );
}
```

---

## 6. Keyboard Navigation (Hotkeys)

### 6.1 Hotkey Specification

| Key | Action | Description |
|-----|--------|-------------|
| `j` | Next paper | Move selection down in list |
| `k` | Previous paper | Move selection up in list |
| `s` | Save paper | Bookmark current paper |
| `h` | Hide paper | Dismiss current paper |
| `c` | Critique | Request analysis (Phase 5) |
| `Enter` | Open PDF | Open paper PDF in new tab |
| `/` | Search | Focus search input |
| `?` | Help | Show keyboard shortcuts |
| `Esc` | Clear | Clear selection or close modal |

### 6.2 Implementation

**Hook for Hotkey Management**:
```typescript
// hooks/useHotkeys.ts

interface HotkeyConfig {
  key: string;
  action: () => void;
  preventDefault?: boolean;
}

export function useHotkeys(config: HotkeyConfig[]) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const hotkey = config.find(hk => hk.key === e.key);

      if (hotkey) {
        // Don't trigger if user is typing in input/textarea
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
          return;
        }

        if (hotkey.preventDefault) {
          e.preventDefault();
        }
        hotkey.action();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [config]);
}
```

**Usage in Briefing Page**:
```typescript
// app/briefings/latest/page.tsx

export default function BriefingPage() {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { data: briefing } = trpc.briefings.getLatest.useQuery();

  const saveMutation = trpc.feedback.save.useMutation();
  const hideMutation = trpc.feedback.hide.useMutation();

  useHotkeys([
    {
      key: 'j',
      action: () => setSelectedIndex(i => Math.min(i + 1, briefing.papers.length - 1))
    },
    {
      key: 'k',
      action: () => setSelectedIndex(i => Math.max(i - 1, 0))
    },
    {
      key: 's',
      action: () => saveMutation.mutate({ paperId: selectedPaper.id })
    },
    {
      key: 'h',
      action: () => hideMutation.mutate({ paperId: selectedPaper.id })
    },
  ]);

  // ... render three-pane layout
}
```

### 6.3 Help Modal

**Keyboard Shortcuts Guide**:
```typescript
// components/HelpModal.tsx

export function HelpModal({ isOpen, onClose }: HelpModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">Navigation</h3>
            <div className="space-y-1">
              <ShortcutRow keys={['j']} description="Next paper" />
              <ShortcutRow keys={['k']} description="Previous paper" />
              <ShortcutRow keys={['Enter']} description="Open PDF" />
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Actions</h3>
            <div className="space-y-1">
              <ShortcutRow keys={['s']} description="Save paper" />
              <ShortcutRow keys={['h']} description="Hide paper" />
              <ShortcutRow keys={['c']} description="Critique (coming soon)" />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

---

## 7. Scheduled Digest Generation

### 7.1 pg-boss Cron Job

**Schedule**: Daily at 6:30 AM (after arXiv's 6:00 AM update)

**Job Definition**:
```typescript
// worker/jobs/generate-daily-digests.ts

import { prisma } from '../../server/db';
import { generateDailyDigest } from '../../server/agents/recommender';

export async function generateDailyDigestsJob() {
  console.log('[Digest Job] Starting daily digest generation');

  // Get all active users
  const users = await prisma.user.findMany({
    where: {
      profile: {
        digestEnabled: true // User opt-in for daily digests
      }
    },
    select: { id: true, email: true }
  });

  console.log(`[Digest Job] Generating digests for ${users.length} users`);

  // Generate digests in parallel (with concurrency limit)
  const results = await Promise.allSettled(
    users.map(user => generateDailyDigest(user.id))
  );

  const succeeded = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;

  console.log(`[Digest Job] Complete: ${succeeded} succeeded, ${failed} failed`);

  return { succeeded, failed, total: users.length };
}
```

**Worker Setup**:
```typescript
// worker/index.ts

import PgBoss from 'pg-boss';
import { generateDailyDigestsJob } from './jobs/generate-daily-digests';

const boss = new PgBoss(process.env.DATABASE_URL);

async function start() {
  await boss.start();

  // Schedule daily digest generation at 6:30 AM
  await boss.schedule(
    'generate-daily-digests',
    '30 6 * * *', // Cron: 6:30 AM every day
    {},
    { tz: 'America/New_York' } // arXiv's timezone
  );

  // Register worker
  await boss.work('generate-daily-digests', async (job) => {
    return await generateDailyDigestsJob();
  });

  console.log('[Worker] Daily digest job scheduled for 6:30 AM ET');
}

start();
```

### 7.2 Manual Digest Trigger (Development)

**tRPC Endpoint**:
```typescript
// server/routers/briefings.ts

export const briefingsRouter = router({
  generateNow: protectedProcedure
    .mutation(async ({ ctx }) => {
      const briefing = await generateDailyDigest(ctx.user.id);
      return briefing;
    }),
});
```

**UI Button** (Settings page):
```typescript
<Button
  onClick={() => generateNowMutation.mutate()}
  disabled={generateNowMutation.isLoading}
>
  {generateNowMutation.isLoading ? 'Generating...' : 'Generate Now'}
</Button>
```

---

## 8. Settings UI Consolidation

### 8.1 Settings Page Layout

**Tabbed Interface**:
```typescript
// app/settings/page.tsx

const tabs = [
  { id: 'sources', label: 'Sources', icon: <Database /> },
  { id: 'categories', label: 'Categories', icon: <Tag /> },
  { id: 'personalization', label: 'Personalization', icon: <Sliders /> },
  { id: 'preferences', label: 'Preferences', icon: <Settings /> },
  { id: 'models', label: 'AI Models', icon: <Cpu /> },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('sources');

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <h1 className="text-3xl font-bold mb-8">Settings</h1>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          {tabs.map(tab => (
            <TabsTrigger key={tab.id} value={tab.id}>
              {tab.icon}
              <span className="ml-2">{tab.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="sources">
          <SourcesSettings />
        </TabsContent>

        <TabsContent value="categories">
          <CategoriesSettings />
        </TabsContent>

        <TabsContent value="personalization">
          <PersonalizationSettings />
        </TabsContent>

        <TabsContent value="preferences">
          <PreferencesSettings />
        </TabsContent>

        <TabsContent value="models">
          <ModelsSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

### 8.2 Preferences Tab (New)

**Digest Settings**:
```typescript
// app/settings/components/PreferencesSettings.tsx

export function PreferencesSettings() {
  const { data: profile } = trpc.settings.getProfile.useQuery();
  const updatePreferences = trpc.settings.updatePreferences.useMutation();

  const [digestEnabled, setDigestEnabled] = useState(true);
  const [noiseCap, setNoiseCap] = useState(15);
  const [scoreThreshold, setScoreThreshold] = useState(0.5);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Briefing Preferences</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Daily Digest Toggle */}
        <div className="flex items-center justify-between">
          <div>
            <Label>Enable Daily Digests</Label>
            <p className="text-sm text-muted-foreground">
              Receive automated briefings every morning
            </p>
          </div>
          <Switch
            checked={digestEnabled}
            onCheckedChange={setDigestEnabled}
          />
        </div>

        {/* Noise Cap Slider */}
        <div>
          <Label>Maximum Papers per Day</Label>
          <p className="text-sm text-muted-foreground mb-2">
            Limit the number of papers in your daily briefing
          </p>
          <div className="flex items-center gap-4">
            <Slider
              value={[noiseCap]}
              onValueChange={([value]) => setNoiseCap(value)}
              min={10}
              max={20}
              step={1}
              className="flex-1"
            />
            <span className="text-sm font-medium w-12 text-right">
              {noiseCap}
            </span>
          </div>
        </div>

        {/* Score Threshold */}
        <div>
          <Label>Minimum Score Threshold</Label>
          <p className="text-sm text-muted-foreground mb-2">
            Only show papers scoring above this level
          </p>
          <div className="flex items-center gap-4">
            <Slider
              value={[scoreThreshold]}
              onValueChange={([value]) => setScoreThreshold(value)}
              min={0.3}
              max={0.7}
              step={0.05}
              className="flex-1"
            />
            <span className="text-sm font-medium w-12 text-right">
              {(scoreThreshold * 100).toFixed(0)}%
            </span>
          </div>
        </div>

        {/* Save Button */}
        <Button onClick={() => updatePreferences.mutate({
          digestEnabled,
          noiseCap,
          scoreThreshold
        })}>
          Save Preferences
        </Button>
      </CardContent>
    </Card>
  );
}
```

### 8.3 AI Models Tab (New)

**Model Configuration**:
```typescript
// app/settings/components/ModelsSettings.tsx

export function ModelsSettings() {
  const { data: profile } = trpc.settings.getProfile.useQuery();
  const updateModels = trpc.settings.updateProcessing.useMutation();

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Model Configuration</CardTitle>
        <CardDescription>
          Choose between local (free, private) and cloud (faster, more capable) AI models
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Embeddings */}
        <div>
          <Label>Embedding Model</Label>
          <RadioGroup
            value={profile?.useLocalEmbeddings ? 'local' : 'cloud'}
            onValueChange={(value) => updateModels.mutate({
              useLocalEmbeddings: value === 'local'
            })}
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="local" id="embed-local" />
              <Label htmlFor="embed-local">
                Local (ollama: mxbai-embed-large)
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="cloud" id="embed-cloud" />
              <Label htmlFor="embed-cloud">
                Cloud (Google: text-embedding-004)
              </Label>
            </div>
          </RadioGroup>
        </div>

        {/* LLM */}
        <div>
          <Label>Language Model (for classification)</Label>
          <RadioGroup
            value={profile?.useLocalLLM ? 'local' : 'cloud'}
            onValueChange={(value) => updateModels.mutate({
              useLocalLLM: value === 'local'
            })}
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="local" id="llm-local" />
              <Label htmlFor="llm-local">
                Local (ollama: llama3.2)
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="cloud" id="llm-cloud" />
              <Label htmlFor="llm-cloud">
                Cloud (Google: gemini-2.0-flash-exp)
              </Label>
            </div>
          </RadioGroup>
        </div>
      </CardContent>
    </Card>
  );
}
```

---

## 9. API Specifications

### 9.1 Briefings Router (New)

**File**: `server/routers/briefings.ts`

```typescript
import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { prisma } from '../db';
import { generateDailyDigest } from '../agents/recommender';

export const briefingsRouter = router({
  /**
   * Get today's briefing for the current user
   */
  getLatest: protectedProcedure
    .query(async ({ ctx }) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      let briefing = await prisma.briefing.findUnique({
        where: {
          userId_date: {
            userId: ctx.user.id,
            date: today,
          },
        },
      });

      // Generate if not exists
      if (!briefing) {
        briefing = await generateDailyDigest(ctx.user.id);
      }

      // Load papers
      const papers = await prisma.paper.findMany({
        where: { id: { in: briefing.paperIds } },
        include: {
          enriched: true,
          scores: {
            where: { userId: ctx.user.id },
            orderBy: { scoredAt: 'desc' },
            take: 1,
          },
        },
      });

      // Mark as viewed
      if (!briefing.viewedAt) {
        await prisma.briefing.update({
          where: { id: briefing.id },
          data: { viewedAt: new Date(), status: 'viewed' },
        });
      }

      return {
        ...briefing,
        papers,
      };
    }),

  /**
   * Get briefing for a specific date
   */
  getByDate: protectedProcedure
    .input(z.object({ date: z.date() }))
    .query(async ({ input, ctx }) => {
      const briefing = await prisma.briefing.findUnique({
        where: {
          userId_date: {
            userId: ctx.user.id,
            date: input.date,
          },
        },
      });

      if (!briefing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'No briefing found for this date',
        });
      }

      const papers = await prisma.paper.findMany({
        where: { id: { in: briefing.paperIds } },
        include: {
          enriched: true,
          scores: {
            where: { userId: ctx.user.id },
            orderBy: { scoredAt: 'desc' },
            take: 1,
          },
        },
      });

      return {
        ...briefing,
        papers,
      };
    }),

  /**
   * List all briefings for the current user
   */
  list: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(30).default(7),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ input, ctx }) => {
      const briefings = await prisma.briefing.findMany({
        where: { userId: ctx.user.id },
        orderBy: { date: 'desc' },
        take: input.limit,
        skip: input.offset,
      });

      const total = await prisma.briefing.count({
        where: { userId: ctx.user.id },
      });

      return {
        briefings,
        total,
        hasMore: total > input.offset + input.limit,
      };
    }),

  /**
   * Manually generate a new briefing (for testing/development)
   */
  generateNow: protectedProcedure
    .mutation(async ({ ctx }) => {
      const briefing = await generateDailyDigest(ctx.user.id);
      return briefing;
    }),
});
```

### 9.2 Settings Router Extensions

**Add to `server/routers/settings.ts`**:

```typescript
export const settingsRouter = router({
  // ... existing endpoints ...

  /**
   * Update digest preferences
   */
  updatePreferences: protectedProcedure
    .input(z.object({
      digestEnabled: z.boolean().optional(),
      noiseCap: z.number().min(10).max(20).optional(),
      scoreThreshold: z.number().min(0.3).max(0.7).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const profile = await prisma.userProfile.upsert({
        where: { userId: ctx.user.id },
        update: input,
        create: {
          userId: ctx.user.id,
          ...input,
        },
      });

      return profile;
    }),
});
```

---

## 10. Testing Strategy

### 10.1 Unit Tests (Mocked External Services)

**Recommender Agent Tests** (`__tests__/server/agents/recommender.test.ts`):
```typescript
describe('Recommender Agent', () => {
  describe('generateDailyDigest', () => {
    it('should generate briefing with correct paper count', async () => {
      // Mock 50 scored papers
      const papers = createMockPapers(50, { avgScore: 0.7 });
      mockPrisma.paper.findMany.mockResolvedValue(papers);

      const briefing = await generateDailyDigest('user-123');

      expect(briefing.paperCount).toBe(15); // Default noise cap
      expect(briefing.paperIds).toHaveLength(15);
    });

    it('should apply material improvement filter', async () => {
      const papers = [
        ...createMockPapers(10, { avgScore: 0.8 }), // Above threshold
        ...createMockPapers(10, { avgScore: 0.3 }), // Below threshold
      ];
      mockPrisma.paper.findMany.mockResolvedValue(papers);

      const briefing = await generateDailyDigest('user-123');

      // Should only include high-scoring papers
      expect(briefing.avgScore).toBeGreaterThan(0.5);
    });

    it('should apply exploration strategy', async () => {
      const papers = createMockPapers(50, { avgScore: 0.7 });
      mockPrisma.paper.findMany.mockResolvedValue(papers);

      const profile = { explorationRate: 0.2, noiseCap: 10 };
      mockPrisma.userProfile.findUnique.mockResolvedValue(profile);

      const briefing = await generateDailyDigest('user-123');

      // 10 papers × 20% = 2 explore, 8 exploit
      // Verify diversity in selection (hard to test precisely)
      expect(briefing.paperCount).toBe(10);
    });
  });

  describe('selectDiversePapers', () => {
    it('should select papers orthogonal to user vector', () => {
      const userVector = [1, 0, 0]; // User interested in topic A
      const candidates = [
        { embedding: [0.9, 0.1, 0], topics: ['A'] }, // Similar
        { embedding: [0, 1, 0], topics: ['B'] },     // Orthogonal
        { embedding: [0, 0, 1], topics: ['C'] },     // Orthogonal
      ];

      const selected = selectDiversePapers(candidates, 2, userVector);

      // Should pick the two orthogonal papers
      expect(selected).toHaveLength(2);
      expect(selected.map(p => p.topics[0])).toContain('B');
      expect(selected.map(p => p.topics[0])).toContain('C');
    });
  });
});
```

**Hotkeys Tests** (`__tests__/hooks/useHotkeys.test.ts`):
```typescript
describe('useHotkeys', () => {
  it('should trigger action on key press', () => {
    const action = jest.fn();
    const { result } = renderHook(() =>
      useHotkeys([{ key: 'j', action }])
    );

    fireEvent.keyDown(window, { key: 'j' });

    expect(action).toHaveBeenCalledTimes(1);
  });

  it('should not trigger when typing in input', () => {
    const action = jest.fn();
    const { result } = renderHook(() =>
      useHotkeys([{ key: 'j', action }])
    );

    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    fireEvent.keyDown(input, { key: 'j' });

    expect(action).not.toHaveBeenCalled();
  });
});
```

### 10.2 Integration Tests

**End-to-End Briefing Flow** (`__tests__/integration/briefing-flow.test.ts`):
```typescript
describe('Briefing Flow Integration', () => {
  it('should generate and retrieve briefing', async () => {
    // 1. Create user and profile
    const user = await createUser();
    await createUserProfile(user.id, { noiseCap: 10 });

    // 2. Create scored papers
    const papers = await createScoredPapers(user.id, 20, { avgScore: 0.7 });

    // 3. Generate briefing
    const briefing = await generateDailyDigest(user.id);

    // 4. Verify briefing created
    expect(briefing).toBeDefined();
    expect(briefing.paperCount).toBe(10);
    expect(briefing.userId).toBe(user.id);

    // 5. Retrieve briefing via API
    const caller = createCaller({ user });
    const retrieved = await caller.briefings.getLatest();

    // 6. Verify papers loaded
    expect(retrieved.papers).toHaveLength(10);
    expect(retrieved.papers[0].scores).toBeDefined();
  });
});
```

### 10.3 UI Component Tests

**Three-Pane Layout** (`__tests__/app/briefings/latest/page.test.tsx`):
```typescript
describe('Briefing Page', () => {
  it('should render three panes', () => {
    const briefing = createMockBriefing(10);
    mockTRPC.briefings.getLatest.useQuery.mockReturnValue({
      data: briefing
    });

    render(<BriefingPage />);

    expect(screen.getByRole('navigation')).toBeInTheDocument();
    expect(screen.getByRole('list')).toBeInTheDocument();
    expect(screen.getByRole('article')).toBeInTheDocument();
  });

  it('should navigate with j/k keys', () => {
    const briefing = createMockBriefing(5);
    mockTRPC.briefings.getLatest.useQuery.mockReturnValue({
      data: briefing
    });

    render(<BriefingPage />);

    // First paper selected by default
    expect(screen.getByText(briefing.papers[0].title)).toHaveClass('active');

    // Press 'j' to move down
    fireEvent.keyDown(window, { key: 'j' });

    // Second paper now selected
    expect(screen.getByText(briefing.papers[1].title)).toHaveClass('active');
  });
});
```

**Paper Card** (`__tests__/components/PaperCard.test.tsx`):
```typescript
describe('PaperCard', () => {
  it('should display score badge', () => {
    const paper = createMockPaper({ score: 0.85 });

    render(<PaperCard paper={paper} />);

    expect(screen.getByText('85% match')).toBeInTheDocument();
  });

  it('should highlight when active', () => {
    const paper = createMockPaper();

    const { rerender } = render(
      <PaperCard paper={paper} isActive={false} />
    );
    expect(screen.getByRole('article')).not.toHaveClass('border-primary');

    rerender(<PaperCard paper={paper} isActive={true} />);
    expect(screen.getByRole('article')).toHaveClass('border-primary');
  });
});
```

---

## 11. Performance Considerations

### 11.1 Digest Generation Performance

**Target**: Generate 100 user digests in < 60 seconds

**Optimizations**:
1. **Parallel Processing**: Use `Promise.allSettled()` with concurrency limit
2. **Batch Queries**: Load papers in single query per user
3. **Caching**: Cache user profiles in memory during batch run
4. **Incremental Updates**: Only generate for users with new papers

```typescript
import pLimit from 'p-limit';

async function generateDailyDigestsJob() {
  const limit = pLimit(10); // Max 10 concurrent generations

  const users = await prisma.user.findMany({
    where: { profile: { digestEnabled: true } }
  });

  const tasks = users.map(user =>
    limit(() => generateDailyDigest(user.id))
  );

  const results = await Promise.allSettled(tasks);
  return results;
}
```

### 11.2 UI Rendering Performance

**Target**: < 2s initial page load, < 100ms keyboard navigation

**Optimizations**:
1. **Virtual Scrolling**: Use `react-window` for large paper lists
2. **Memoization**: Memo PaperCard components
3. **Lazy Loading**: Load detail view on demand
4. **Debouncing**: Debounce hotkey actions (prevent double-trigger)

```typescript
const PaperCard = memo(({ paper, isActive }: PaperCardProps) => {
  // ... component implementation
}, (prev, next) => {
  // Custom comparison
  return prev.paper.id === next.paper.id &&
         prev.isActive === next.isActive;
});
```

---

## 12. Migration Plan

### 12.1 Prisma Schema Changes

**Add `Briefing` model**:
```prisma
model Briefing {
  id          String   @id @default(cuid())
  userId      String
  date        DateTime @db.Date

  paperIds    String[]
  paperCount  Int
  avgScore    Float

  status      String   @default("ready")
  generatedAt DateTime @default(now())
  viewedAt    DateTime?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, date])
  @@index([userId, date])
}
```

**Extend `UserProfile` model**:
```prisma
model UserProfile {
  // ... existing fields ...

  // Digest preferences (Phase 3)
  digestEnabled   Boolean @default(true)
  noiseCap        Int     @default(15)
  scoreThreshold  Float   @default(0.5)
}
```

**Run Migration**:
```bash
npx prisma migrate dev --name phase_3_briefings
```

---

## 13. Open Questions & Decisions

### 13.1 Digest Timing

**Question**: Should digest generation be blocking or async?

**Decision**: Async via pg-boss cron job

**Rationale**:
- Doesn't block user experience
- Can retry on failures
- Scalable to many users
- Allows background processing

### 13.2 Exploration Strategy

**Question**: How to balance exploit vs explore?

**Decision**: Default 15% exploration, user-configurable 0-30%

**Rationale**:
- 15% = 2-3 papers per digest (reasonable diversity)
- User control for those who want more/less serendipity
- Diversity selection ensures exploration is meaningful

### 13.3 Empty Briefings

**Question**: What if no papers meet the threshold?

**Options**:
1. Show empty briefing with message
2. Lower threshold temporarily
3. Show top N papers regardless of score

**Decision**: Option 1 (empty briefing with helpful message)

**Rationale**:
- Honest communication with user
- Opportunity to adjust preferences
- Better than showing irrelevant papers

---

## 14. Success Metrics

### 14.1 Quantitative Metrics

- **Digest Generation**: < 60 seconds for 100 users
- **Page Load Time**: < 2 seconds initial load
- **Keyboard Navigation**: < 100ms response time
- **Briefing Size**: Average 12-15 papers per digest
- **Score Distribution**: Average briefing score > 0.65

### 14.2 Qualitative Validation

- **User Workflow**: Can navigate 15 papers in < 5 minutes
- **Relevance**: > 70% of papers meet user interests (via feedback)
- **Hotkeys**: Keyboard navigation feels natural and fast
- **Visual Hierarchy**: Important information stands out

---

## 15. MVP Milestone

**🎯 PHASE 3 DELIVERS THE MVP**

After Phase 3, users can:
1. ✅ Receive daily briefings of personalized papers
2. ✅ Navigate efficiently with keyboard shortcuts
3. ✅ See why each paper was recommended
4. ✅ Provide feedback to improve future briefings
5. ✅ Configure all preferences in unified settings

**Core Value Proposition Proven**: ArXiv Curator reduces paper triage time from 2+ hours to 10-15 minutes.

---

**End of Phase 3 Technical Design**
