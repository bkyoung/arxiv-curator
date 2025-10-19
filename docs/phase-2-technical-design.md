# Phase 2: Personalization & Scoring - Technical Design

**Phase**: 2
**Name**: Personalization & Scoring
**Timeline**: Week 3 (Serial Development)
**Status**: Not Started
**Dependencies**: Phase 1 (Ingestion & Enrichment) ✅

---

## 1. Overview

### 1.1 Purpose

Phase 2 transforms the unranked paper feed from Phase 1 into a personalized, relevance-ranked system. Papers are scored using a multi-signal algorithm that combines novelty detection, evidence quality assessment, personal fit analysis, lab reputation, and math depth penalties.

**Key Value**: Users receive papers ranked by personal relevance rather than chronological order.

### 1.2 Goals

1. **Implement Multi-Signal Scoring**: 6-signal ranking algorithm (N, E, V, P, L, M)
2. **Enable Personalization**: User-configurable rules for topics, keywords, labs, math sensitivity
3. **Continuous Learning**: Feedback-driven vector profile updates
4. **Transparent Recommendations**: "Why Shown" explanations for every paper

### 1.3 Non-Goals (Deferred to Later Phases)

- Daily digest generation (Phase 3)
- Noise cap enforcement (Phase 3)
- Scheduled briefings (Phase 3)
- Exploration strategy implementation (Phase 3)
- Velocity tracking infrastructure (Phase 7 - can use placeholder in Phase 2)

---

## 2. Architecture

### 2.1 System Overview

```
┌──────────────────────────────────────────────────────────────┐
│                    Phase 2: Personalization & Scoring         │
└──────────────────────────────────────────────────────────────┘

┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│   Enriched  │       │   Ranker    │       │   Ranked    │
│   Papers    │──────▶│   Agent     │──────▶│   Papers    │
│  (Phase 1)  │       │             │       │ (with scores)│
└─────────────┘       └─────────────┘       └─────────────┘
                             │
                             │ Uses
                             ▼
                  ┌──────────────────────┐
                  │  User Profile Data   │
                  │  - Profile Vector    │
                  │  - Topic Rules       │
                  │  - Keyword Rules     │
                  │  - Lab Preferences   │
                  │  - Math Sensitivity  │
                  └──────────────────────┘
                             ▲
                             │ Updates
                  ┌──────────────────────┐
                  │  Feedback System     │
                  │  - Save/Hide/Vote    │
                  │  - Vector Learning   │
                  └──────────────────────┘
                             ▲
                             │
                  ┌──────────────────────┐
                  │   User Actions (UI)  │
                  └──────────────────────┘
```

### 2.2 Component Interaction Flow

**Ranking Flow**:
1. Enriched papers from Phase 1 have embeddings and metadata
2. Ranker Agent loads user profile (vector, rules, preferences)
3. For each paper:
   - Compute 6 component signals (N, E, V, P, L, M)
   - Combine with weighted sum
   - Store `Score` record with breakdown
4. Papers sorted by `final_score DESC`

**Feedback Flow**:
1. User performs action (save/hide/upvote/downvote)
2. `Feedback` record created in database
3. User profile vector updated via EMA
4. Future rankings automatically use updated profile

**Personalization Flow**:
1. User configures rules in Settings UI
2. Rules saved to `UserProfile` table
3. Ranker Agent applies rules on next scoring run
4. Exclusion rules hard filter, inclusion rules boost scores

---

## 3. Multi-Signal Scoring Algorithm

### 3.1 Final Score Formula

```
final_score = w_N × N + w_E × E + w_V × V + w_P × P + w_L × L + w_M × M

Where:
  w_N = 0.20  (Novelty)
  w_E = 0.25  (Evidence)
  w_V = 0.10  (Velocity)
  w_P = 0.30  (Personal Fit)
  w_L = 0.10  (Lab Prior)
  w_M = 0.05  (Math Penalty, negative)

All component signals normalized to [0, 1] range
Final score clamped to [0, 1] range
```

### 3.2 Signal 1: Novelty (N) - 20% Weight

**Purpose**: Identify papers that explore new directions relative to user's existing knowledge.

**Components**:
1. **Centroid Distance** (50% of N):
   - Compute user vector centroid from profile embedding
   - Calculate cosine distance from paper embedding to centroid
   - Larger distance = more novel

2. **Novel Keywords** (50% of N):
   - Extract keywords from title + abstract (TF-IDF top 10)
   - Compare against user's historical keywords (from saved papers)
   - Ratio of new keywords = novelty score

3. **Local Outlier Factor** (OPTIONAL - Phase 2):
   - Compute LOF score in embedding space
   - Identifies papers that are outliers in local neighborhood
   - Defer if too complex for Phase 2

**Formula**:
```typescript
function computeNovelty(
  paperEmbedding: number[],
  userCentroid: number[],
  paperKeywords: string[],
  userKeywords: string[]
): number {
  // 1. Centroid distance
  const centroidDist = cosineDist(paperEmbedding, userCentroid);
  const centroidScore = centroidDist; // Already 0-1 range
  
  // 2. Novel keywords
  const newKeywords = paperKeywords.filter(k => !userKeywords.includes(k));
  const novelKeywordScore = newKeywords.length / paperKeywords.length;
  
  // Combine
  const N = 0.5 * centroidScore + 0.5 * novelKeywordScore;
  return clamp(N, 0, 1);
}
```

**Edge Cases**:
- New user (no historical papers): Use default centroid from category averages
- Zero keywords extracted: Use centroid distance only
- All keywords novel: Cap at 1.0

---

### 3.3 Signal 2: Evidence (E) - 25% Weight

**Purpose**: Reward papers with strong empirical support.

**Components** (from Phase 1 Enricher):
- `hasBaselines` → +0.30
- `hasAblations` → +0.20
- `hasCode` → +0.20
- `hasData` → +0.15
- `hasMultipleEvals` → +0.15

**Formula**:
```typescript
function computeEvidence(enriched: PaperEnriched): number {
  let E = 0;
  if (enriched.hasBaselines) E += 0.30;
  if (enriched.hasAblations) E += 0.20;
  if (enriched.hasCode) E += 0.20;
  if (enriched.hasData) E += 0.15;
  if (enriched.hasMultipleEvals) E += 0.15;
  
  return clamp(E, 0, 1); // Max 1.0
}
```

**Edge Cases**:
- No enrichment data: E = 0
- All signals true: E = 1.0

---

### 3.4 Signal 3: Velocity (V) - 10% Weight

**Purpose**: Boost papers on trending topics.

**Implementation** (Phase 2):
- **PLACEHOLDER**: Return 0.5 for all papers
- **Full Implementation** (Phase 7):
  - Daily topic count aggregation
  - EMA slope calculation (7-day window)
  - Keyword burst detection

**Formula** (Phase 2):
```typescript
function computeVelocity(topics: string[]): number {
  // Placeholder for Phase 2
  return 0.5;
  
  // TODO Phase 7: Real velocity calculation
  // const topicVelocities = await getTopicVelocities(topics);
  // return average(topicVelocities.map(v => v.velocity));
}
```

**Rationale**: Velocity requires historical tracking infrastructure (Phase 7). Placeholder prevents blocking Phase 2 progress.

---

### 3.5 Signal 4: Personal Fit (P) - 30% Weight

**Purpose**: Match papers to user's interests via vector similarity and explicit rules.

**Components**:
1. **Vector Similarity** (70% of P):
   - Cosine similarity between user profile vector and paper embedding
   - Learned from user feedback over time

2. **Rule Bonuses** (30% of P):
   - Topic inclusion rules: +0.2 per matched topic
   - Keyword inclusion rules: +0.1 per matched keyword
   - Capped at 1.0 total

**Formula**:
```typescript
function computePersonalFit(
  paperEmbedding: number[],
  userVector: number[],
  paperTopics: string[],
  paperText: string,
  profile: UserProfile
): number {
  // 1. Vector similarity
  const cosineSim = cosineSimilarity(paperEmbedding, userVector);
  const vectorScore = (cosineSim + 1) / 2; // Normalize from [-1,1] to [0,1]
  
  // 2. Rule bonuses
  let ruleBonus = 0;
  
  // Topic inclusion bonus
  const matchedTopics = paperTopics.filter(t => 
    profile.includedTopics.includes(t)
  );
  ruleBonus += matchedTopics.length * 0.2;
  
  // Keyword inclusion bonus
  const matchedKeywords = profile.includedKeywords.filter(kw =>
    paperText.toLowerCase().includes(kw.toLowerCase())
  );
  ruleBonus += matchedKeywords.length * 0.1;
  
  // Combine
  const P = 0.7 * vectorScore + 0.3 * Math.min(ruleBonus, 1.0);
  return clamp(P, 0, 1);
}
```

**Exclusion Rules** (Hard Filtering):
```typescript
function shouldExcludePaper(
  paperTopics: string[],
  paperText: string,
  profile: UserProfile
): boolean {
  // Exclude if any excluded topic matches
  if (paperTopics.some(t => profile.excludedTopics.includes(t))) {
    return true;
  }
  
  // Exclude if any excluded keyword matches
  if (profile.excludedKeywords.some(kw =>
    paperText.toLowerCase().includes(kw.toLowerCase())
  )) {
    return true;
  }
  
  return false;
}
```

**Edge Cases**:
- New user (zero vector): Use category average as initial vector
- No rules configured: Use vector similarity only
- Exclusion rules: Paper completely filtered out (not scored)

---

### 3.6 Signal 5: Lab Prior (L) - 10% Weight

**Purpose**: Boost papers from trusted research labs.

**Formula**:
```typescript
function computeLabPrior(
  authors: string[],
  boostedLabs: string[],
  boostMultiplier: number = 1.5
): number {
  // Check if any author matches boosted labs
  const hasMatchingLab = authors.some(author =>
    boostedLabs.some(lab =>
      author.toLowerCase().includes(lab.toLowerCase())
    )
  );
  
  if (hasMatchingLab) {
    return 1.0 * boostMultiplier;
  }
  
  return 0.5; // Neutral score for unknown labs
}
```

**Edge Cases**:
- No boosted labs configured: Return 0.5 (neutral)
- Multiple matching labs: Still return 1.0 (no double-boost)
- Score clamped to [0, 1] in final formula

---

### 3.7 Signal 6: Math Penalty (M) - 5% Weight

**Purpose**: Penalize math-heavy papers for users who prefer practical work.

**Formula**:
```typescript
function computeMathPenalty(
  mathDepth: number, // From Phase 1 Enricher, range [0,1]
  sensitivity: number // User preference, range [0,1]
): number {
  // Penalty is negative
  const M = -1 * mathDepth * sensitivity;
  return clamp(M, -1, 0); // Range [-1, 0]
}
```

**Sensitivity Interpretation**:
- `sensitivity = 0`: No penalty, user is math-tolerant
- `sensitivity = 0.5`: Moderate penalty for math-heavy papers
- `sensitivity = 1.0`: Maximum penalty, user strongly prefers practical papers

**Edge Cases**:
- `mathDepth = 0`: No penalty regardless of sensitivity
- `sensitivity = 0`: No penalty regardless of math depth

---

### 3.8 Score Storage

**Data Model**:
```prisma
model Score {
  id           String   @id @default(cuid())
  paperId      String
  userId       String
  
  // Component scores
  novelty      Float    // N
  evidence     Float    // E
  velocity     Float    // V
  personalFit  Float    // P
  labPrior     Float    // L
  mathPenalty  Float    // M
  
  // Final score
  finalScore   Float
  
  // Metadata
  scoredAt     DateTime @default(now())
  version      Int      @default(1) // For re-scoring tracking
  
  paper Paper @relation(fields: [paperId], references: [id])
  user  User  @relation(fields: [userId], references: [id])
  
  @@unique([paperId, userId])
  @@index([userId, finalScore])
}
```

**Rationale**:
- Store component scores for "Why Shown" explanations
- `version` field allows tracking re-scores over time
- Unique constraint prevents duplicate scores for same user/paper
- Index on `(userId, finalScore)` for efficient ranking queries

---

## 4. Personalization Rules Engine

### 4.1 Rule Types

**1. Topic Rules**:
- **Included Topics**: Boost papers with these topics (+0.2 per topic in P signal)
- **Excluded Topics**: Hard filter, paper not shown

**2. Keyword Rules**:
- **Included Keywords**: Boost papers mentioning these (+0.1 per keyword in P signal)
- **Excluded Keywords**: Hard filter, paper not shown

**3. Lab Preferences**:
- **Boosted Labs**: Increase L signal to 1.0 for matching labs

**4. Math Sensitivity**:
- **Slider [0, 1]**: Controls M signal penalty strength

**5. Exploration Rate** (used in Phase 3):
- **Slider [0, 0.3]**: Percentage of low-scoring papers to include for diversity

### 4.2 Rule Application Order

```
1. Hard Filtering (Exclusion Rules)
   - Check excluded topics → filter out
   - Check excluded keywords → filter out
   
2. Scoring (Inclusion Rules & Preferences)
   - Compute all 6 signals
   - Apply topic/keyword bonuses in P signal
   - Apply lab boost in L signal
   - Apply math penalty in M signal
   
3. Final Score Combination
   - Weighted sum of all signals
   - Normalize to [0, 1]
   - Store in Score table
```

**Precedence**: Exclusions always win over inclusions.

### 4.3 Default Configuration

```typescript
const DEFAULT_PROFILE = {
  includedTopics: ['agents', 'rag', 'applications'],
  excludedTopics: [],
  includedKeywords: [],
  excludedKeywords: [],
  boostedLabs: [],
  mathSensitivity: 0.5,
  explorationRate: 0.15,
  profileVector: null, // Initialized on first feedback
};
```

---

## 5. Feedback System & Vector Learning

### 5.1 Feedback Actions

**4 Action Types**:
1. **Save**: Bookmark for later reading (strong positive signal)
2. **Hide**: Dismiss paper (strong negative signal)
3. **Upvote**: Thumbs up (moderate positive signal)
4. **Downvote**: Thumbs down (moderate negative signal)

**Data Model**:
```prisma
model Feedback {
  id        String   @id @default(cuid())
  userId    String
  paperId   String
  action    String   // 'save' | 'hide' | 'upvote' | 'downvote'
  createdAt DateTime @default(now())
  
  user  User  @relation(fields: [userId], references: [id])
  paper Paper @relation(fields: [paperId], references: [id])
  
  @@unique([userId, paperId, action])
  @@index([userId, action, createdAt])
}
```

### 5.2 Vector Profile Learning

**Exponential Moving Average (EMA) Updates**:

```typescript
async function updateProfileVector(
  userId: string,
  paperEmbedding: number[],
  action: 'save' | 'hide' | 'upvote' | 'downvote'
) {
  const profile = await prisma.userProfile.findUnique({
    where: { userId }
  });
  
  let currentVector = profile.profileVector || initializeZeroVector();
  
  // EMA weight (conservative to prevent drift)
  const alpha = 0.1;
  
  // Determine direction
  let direction: number;
  switch (action) {
    case 'save':
    case 'upvote':
      direction = 1; // Move toward
      break;
    case 'hide':
    case 'downvote':
      direction = -1; // Move away
      break;
  }
  
  // Update vector
  const newVector = currentVector.map((val, idx) =>
    (1 - alpha) * val + alpha * direction * paperEmbedding[idx]
  );
  
  // Normalize
  const normalizedVector = normalize(newVector);
  
  // Store
  await prisma.userProfile.update({
    where: { userId },
    data: { profileVector: normalizedVector }
  });
}
```

**Properties**:
- **Conservative learning**: 90% old vector + 10% new signal
- **Bidirectional**: Positive signals move toward, negative move away
- **Normalized**: Maintains unit length
- **Persistent**: Survives across sessions

**Initialization**:
- New users start with zero vector or category average
- First feedback initializes the profile vector

### 5.3 Re-Ranking Strategy

**Options**:
1. **No Re-Ranking** (Phase 2 default): Wait until next scheduled scoring
2. **Partial Re-Ranking** (Optional): Re-score last 7 days of papers
3. **Full Re-Ranking** (Phase 3+): Re-score all papers, triggered by significant feedback

**Phase 2 Recommendation**: Don't re-rank immediately, wait for next batch scoring run (simpler, more efficient).

---

## 6. API Specifications

### 6.1 Papers Router Extensions

**`papers.list` - Enhanced**:
```typescript
export const papersRouter = router({
  list: publicProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0),
      categories: z.array(z.string()).optional(),
      status: z.enum(['new', 'enriched', 'ranked']).optional(),
      sortBy: z.enum(['date', 'score']).default('score'), // NEW
      feedbackFilter: z.enum(['all', 'saved', 'hidden']).default('all'), // NEW
    }))
    .query(async ({ input, ctx }) => {
      // Build where clause
      const where = {
        ...(input.categories && { categories: { hasSome: input.categories } }),
        ...(input.status && { status: input.status }),
      };
      
      // Apply feedback filter
      if (ctx.user && input.feedbackFilter !== 'all') {
        const feedbackPaperIds = await prisma.feedback.findMany({
          where: {
            userId: ctx.user.id,
            action: input.feedbackFilter === 'saved' ? 'save' : 'hide',
          },
          select: { paperId: true },
        });
        where.id = { in: feedbackPaperIds.map(f => f.paperId) };
      }
      
      // Fetch papers with scores
      const papers = await prisma.paper.findMany({
        where,
        include: {
          enriched: true,
          scores: ctx.user ? {
            where: { userId: ctx.user.id },
            orderBy: { scoredAt: 'desc' },
            take: 1,
          } : false,
        },
        orderBy: input.sortBy === 'score'
          ? [{ scores: { finalScore: 'desc' } }]
          : [{ pubDate: 'desc' }],
        take: input.limit,
        skip: input.offset,
      });
      
      const total = await prisma.paper.count({ where });
      
      return {
        papers,
        total,
        hasMore: total > input.offset + input.limit,
      };
    }),
  
  getScoreBreakdown: protectedProcedure
    .input(z.object({ paperId: z.string() }))
    .query(async ({ input, ctx }) => {
      const score = await prisma.score.findUnique({
        where: {
          paperId_userId: {
            paperId: input.paperId,
            userId: ctx.user.id,
          },
        },
      });
      
      if (!score) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Score not found for this paper',
        });
      }
      
      return score;
    }),
});
```

### 6.2 Feedback Router (New)

**Create `server/routers/feedback.ts`**:
```typescript
import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { prisma } from '../db';
import { updateProfileVector } from '../lib/vector-learning';

export const feedbackRouter = router({
  save: protectedProcedure
    .input(z.object({ paperId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      // Create feedback record
      const feedback = await prisma.feedback.upsert({
        where: {
          userId_paperId_action: {
            userId: ctx.user.id,
            paperId: input.paperId,
            action: 'save',
          },
        },
        update: {}, // No-op if already exists
        create: {
          userId: ctx.user.id,
          paperId: input.paperId,
          action: 'save',
        },
      });
      
      // Update profile vector
      const paper = await prisma.paper.findUnique({
        where: { id: input.paperId },
        include: { enriched: true },
      });
      
      if (paper?.enriched?.embedding) {
        await updateProfileVector(
          ctx.user.id,
          paper.enriched.embedding,
          'save'
        );
      }
      
      return feedback;
    }),
  
  hide: protectedProcedure
    .input(z.object({ paperId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const feedback = await prisma.feedback.upsert({
        where: {
          userId_paperId_action: {
            userId: ctx.user.id,
            paperId: input.paperId,
            action: 'hide',
          },
        },
        update: {},
        create: {
          userId: ctx.user.id,
          paperId: input.paperId,
          action: 'hide',
        },
      });
      
      const paper = await prisma.paper.findUnique({
        where: { id: input.paperId },
        include: { enriched: true },
      });
      
      if (paper?.enriched?.embedding) {
        await updateProfileVector(
          ctx.user.id,
          paper.enriched.embedding,
          'hide'
        );
      }
      
      return feedback;
    }),
  
  upvote: protectedProcedure
    .input(z.object({ paperId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const feedback = await prisma.feedback.upsert({
        where: {
          userId_paperId_action: {
            userId: ctx.user.id,
            paperId: input.paperId,
            action: 'upvote',
          },
        },
        update: {},
        create: {
          userId: ctx.user.id,
          paperId: input.paperId,
          action: 'upvote',
        },
      });
      
      const paper = await prisma.paper.findUnique({
        where: { id: input.paperId },
        include: { enriched: true },
      });
      
      if (paper?.enriched?.embedding) {
        await updateProfileVector(
          ctx.user.id,
          paper.enriched.embedding,
          'upvote'
        );
      }
      
      return feedback;
    }),
  
  downvote: protectedProcedure
    .input(z.object({ paperId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const feedback = await prisma.feedback.upsert({
        where: {
          userId_paperId_action: {
            userId: ctx.user.id,
            paperId: input.paperId,
            action: 'downvote',
          },
        },
        update: {},
        create: {
          userId: ctx.user.id,
          paperId: input.paperId,
          action: 'downvote',
        },
      });
      
      const paper = await prisma.paper.findUnique({
        where: { id: input.paperId },
        include: { enriched: true },
      });
      
      if (paper?.enriched?.embedding) {
        await updateProfileVector(
          ctx.user.id,
          paper.enriched.embedding,
          'downvote'
        );
      }
      
      return feedback;
    }),
  
  getHistory: protectedProcedure
    .input(z.object({
      action: z.enum(['save', 'hide', 'upvote', 'downvote']).optional(),
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ input, ctx }) => {
      const where = {
        userId: ctx.user.id,
        ...(input.action && { action: input.action }),
      };
      
      const feedbacks = await prisma.feedback.findMany({
        where,
        include: {
          paper: {
            include: { enriched: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: input.limit,
        skip: input.offset,
      });
      
      const total = await prisma.feedback.count({ where });
      
      return {
        feedbacks,
        total,
        hasMore: total > input.offset + input.limit,
      };
    }),
  
  removeFeedback: protectedProcedure
    .input(z.object({
      paperId: z.string(),
      action: z.enum(['save', 'hide', 'upvote', 'downvote']),
    }))
    .mutation(async ({ input, ctx }) => {
      await prisma.feedback.delete({
        where: {
          userId_paperId_action: {
            userId: ctx.user.id,
            paperId: input.paperId,
            action: input.action,
          },
        },
      });
      
      return { success: true };
    }),
});
```

### 6.3 Settings Router Extensions

**Extend `server/routers/settings.ts`**:
```typescript
export const settingsRouter = router({
  // ... existing endpoints (getCategories, getProfile, etc.) ...
  
  updatePersonalization: protectedProcedure
    .input(z.object({
      includedTopics: z.array(z.string()).optional(),
      excludedTopics: z.array(z.string()).optional(),
      includedKeywords: z.array(z.string()).optional(),
      excludedKeywords: z.array(z.string()).optional(),
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
  
  updateLabPreferences: protectedProcedure
    .input(z.object({
      boostedLabs: z.array(z.string()),
    }))
    .mutation(async ({ input, ctx }) => {
      const profile = await prisma.userProfile.upsert({
        where: { userId: ctx.user.id },
        update: { boostedLabs: input.boostedLabs },
        create: {
          userId: ctx.user.id,
          boostedLabs: input.boostedLabs,
        },
      });
      
      return profile;
    }),
  
  updateMathSensitivity: protectedProcedure
    .input(z.object({
      mathSensitivity: z.number().min(0).max(1),
    }))
    .mutation(async ({ input, ctx }) => {
      const profile = await prisma.userProfile.upsert({
        where: { userId: ctx.user.id },
        update: { mathSensitivity: input.mathSensitivity },
        create: {
          userId: ctx.user.id,
          mathSensitivity: input.mathSensitivity,
        },
      });
      
      return profile;
    }),
  
  updateExplorationRate: protectedProcedure
    .input(z.object({
      explorationRate: z.number().min(0).max(0.3),
    }))
    .mutation(async ({ input, ctx }) => {
      const profile = await prisma.userProfile.upsert({
        where: { userId: ctx.user.id },
        update: { explorationRate: input.explorationRate },
        create: {
          userId: ctx.user.id,
          explorationRate: input.explorationRate,
        },
      });
      
      return profile;
    }),
  
  resetPersonalization: protectedProcedure
    .mutation(async ({ ctx }) => {
      const profile = await prisma.userProfile.update({
        where: { userId: ctx.user.id },
        data: {
          includedTopics: ['agents', 'rag', 'applications'],
          excludedTopics: [],
          includedKeywords: [],
          excludedKeywords: [],
          boostedLabs: [],
          mathSensitivity: 0.5,
          explorationRate: 0.15,
          profileVector: null,
        },
      });
      
      return profile;
    }),
});
```

---

## 7. UI Components

### 7.1 Personalization Settings Page

**File**: `app/settings/personalization/page.tsx`

```typescript
'use client';

import { trpc } from '@/lib/trpc';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { useState, useEffect } from 'react';

const AVAILABLE_TOPICS = [
  'agents', 'rag', 'multimodal', 'architectures', 
  'surveys', 'applications', 'theory'
];

export default function PersonalizationPage() {
  const { data: profile } = trpc.settings.getProfile.useQuery();
  const updatePersonalization = trpc.settings.updatePersonalization.useMutation();
  const updateMathSensitivity = trpc.settings.updateMathSensitivity.useMutation();
  const updateExplorationRate = trpc.settings.updateExplorationRate.useMutation();
  const resetPersonalization = trpc.settings.resetPersonalization.useMutation();
  
  const [includedTopics, setIncludedTopics] = useState<string[]>([]);
  const [excludedTopics, setExcludedTopics] = useState<string[]>([]);
  const [includedKeywords, setIncludedKeywords] = useState('');
  const [excludedKeywords, setExcludedKeywords] = useState('');
  const [mathSensitivity, setMathSensitivity] = useState(0.5);
  const [explorationRate, setExplorationRate] = useState(0.15);
  
  // Load from profile
  useEffect(() => {
    if (profile) {
      setIncludedTopics(profile.includedTopics || []);
      setExcludedTopics(profile.excludedTopics || []);
      setIncludedKeywords((profile.includedKeywords || []).join(', '));
      setExcludedKeywords((profile.excludedKeywords || []).join(', '));
      setMathSensitivity(profile.mathSensitivity || 0.5);
      setExplorationRate(profile.explorationRate || 0.15);
    }
  }, [profile]);
  
  const handleSave = async () => {
    await updatePersonalization.mutateAsync({
      includedTopics,
      excludedTopics,
      includedKeywords: includedKeywords.split(',').map(s => s.trim()).filter(Boolean),
      excludedKeywords: excludedKeywords.split(',').map(s => s.trim()).filter(Boolean),
    });
    
    await updateMathSensitivity.mutateAsync({ mathSensitivity });
    await updateExplorationRate.mutateAsync({ explorationRate });
  };
  
  const handleReset = async () => {
    await resetPersonalization.mutateAsync();
    // Reload profile
  };
  
  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <h1 className="text-3xl font-bold mb-8">Personalization Settings</h1>
      
      {/* Topic Preferences */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Topic Preferences</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label>Included Topics (Boost scores)</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {AVAILABLE_TOPICS.map(topic => (
                  <div key={topic} className="flex items-center gap-2">
                    <Checkbox
                      checked={includedTopics.includes(topic)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setIncludedTopics([...includedTopics, topic]);
                        } else {
                          setIncludedTopics(includedTopics.filter(t => t !== topic));
                        }
                      }}
                    />
                    <Label>{topic}</Label>
                  </div>
                ))}
              </div>
            </div>
            
            <div>
              <Label>Excluded Topics (Filter out completely)</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {AVAILABLE_TOPICS.map(topic => (
                  <div key={topic} className="flex items-center gap-2">
                    <Checkbox
                      checked={excludedTopics.includes(topic)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setExcludedTopics([...excludedTopics, topic]);
                        } else {
                          setExcludedTopics(excludedTopics.filter(t => t !== topic));
                        }
                      }}
                    />
                    <Label>{topic}</Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Keyword Rules */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Keyword Rules</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Included Keywords (comma-separated)</Label>
            <Input
              value={includedKeywords}
              onChange={(e) => setIncludedKeywords(e.target.value)}
              placeholder="e.g., retrieval, attention, transformer"
            />
          </div>
          
          <div>
            <Label>Excluded Keywords (comma-separated)</Label>
            <Input
              value={excludedKeywords}
              onChange={(e) => setExcludedKeywords(e.target.value)}
              placeholder="e.g., quantum, biology"
            />
          </div>
        </CardContent>
      </Card>
      
      {/* Math Sensitivity */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Math Sensitivity</CardTitle>
        </CardHeader>
        <CardContent>
          <Label>Penalty for math-heavy papers</Label>
          <div className="flex items-center gap-4 mt-2">
            <span className="text-sm text-muted-foreground">Tolerant</span>
            <Slider
              value={[mathSensitivity]}
              onValueChange={([value]) => setMathSensitivity(value)}
              min={0}
              max={1}
              step={0.1}
              className="flex-1"
            />
            <span className="text-sm text-muted-foreground">Strict</span>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Current: {(mathSensitivity * 100).toFixed(0)}%
          </p>
        </CardContent>
      </Card>
      
      {/* Exploration Rate */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Exploration Rate</CardTitle>
        </CardHeader>
        <CardContent>
          <Label>Mix in diverse/unexpected papers</Label>
          <div className="flex items-center gap-4 mt-2">
            <span className="text-sm text-muted-foreground">Focused</span>
            <Slider
              value={[explorationRate]}
              onValueChange={([value]) => setExplorationRate(value)}
              min={0}
              max={0.3}
              step={0.05}
              className="flex-1"
            />
            <span className="text-sm text-muted-foreground">Exploratory</span>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Current: {(explorationRate * 100).toFixed(0)}% of briefing
          </p>
        </CardContent>
      </Card>
      
      {/* Action Buttons */}
      <div className="flex gap-4">
        <Button onClick={handleSave}>Save Settings</Button>
        <Button variant="outline" onClick={handleReset}>Reset to Defaults</Button>
      </div>
    </div>
  );
}
```

### 7.2 Score Breakdown Component

**File**: `components/ScoreBreakdown.tsx`

```typescript
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

interface ScoreBreakdownProps {
  score: {
    novelty: number;
    evidence: number;
    velocity: number;
    personalFit: number;
    labPrior: number;
    mathPenalty: number;
    finalScore: number;
  };
}

export function ScoreBreakdown({ score }: ScoreBreakdownProps) {
  const signals = [
    { name: 'Novelty', value: score.novelty, weight: 0.20, color: 'blue' },
    { name: 'Evidence', value: score.evidence, weight: 0.25, color: 'green' },
    { name: 'Velocity', value: score.velocity, weight: 0.10, color: 'purple' },
    { name: 'Personal Fit', value: score.personalFit, weight: 0.30, color: 'yellow' },
    { name: 'Lab Prior', value: score.labPrior, weight: 0.10, color: 'orange' },
    { name: 'Math Penalty', value: score.mathPenalty, weight: 0.05, color: 'red' },
  ];
  
  return (
    <Card className="p-4">
      <div className="mb-2">
        <span className="text-sm text-muted-foreground">Final Score:</span>
        <span className="text-2xl font-bold ml-2">
          {(score.finalScore * 100).toFixed(0)}%
        </span>
      </div>
      
      <div className="space-y-2">
        {signals.map(signal => (
          <div key={signal.name} className="flex items-center gap-2">
            <span className="text-sm w-24">{signal.name}</span>
            <div className="flex-1 bg-muted rounded-full h-2">
              <div
                className={`h-2 rounded-full bg-${signal.color}-500`}
                style={{ width: `${Math.max(0, signal.value * 100)}%` }}
              />
            </div>
            <span className="text-sm text-muted-foreground w-16 text-right">
              {(signal.value * signal.weight * 100).toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
```

### 7.3 Feedback Actions Component

**File**: `components/FeedbackActions.tsx`

```typescript
import { Button } from '@/components/ui/button';
import { Bookmark, X, ThumbsUp, ThumbsDown } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useState } from 'react';

interface FeedbackActionsProps {
  paperId: string;
  initialFeedback?: {
    saved?: boolean;
    hidden?: boolean;
    upvoted?: boolean;
    downvoted?: boolean;
  };
}

export function FeedbackActions({ paperId, initialFeedback }: FeedbackActionsProps) {
  const [saved, setSaved] = useState(initialFeedback?.saved || false);
  const [hidden, setHidden] = useState(initialFeedback?.hidden || false);
  const [upvoted, setUpvoted] = useState(initialFeedback?.upvoted || false);
  const [downvoted, setDownvoted] = useState(initialFeedback?.downvoted || false);
  
  const saveMutation = trpc.feedback.save.useMutation();
  const hideMutation = trpc.feedback.hide.useMutation();
  const upvoteMutation = trpc.feedback.upvote.useMutation();
  const downvoteMutation = trpc.feedback.downvote.useMutation();
  
  const handleSave = async () => {
    await saveMutation.mutateAsync({ paperId });
    setSaved(true);
  };
  
  const handleHide = async () => {
    await hideMutation.mutateAsync({ paperId });
    setHidden(true);
  };
  
  const handleUpvote = async () => {
    await upvoteMutation.mutateAsync({ paperId });
    setUpvoted(true);
    setDownvoted(false);
  };
  
  const handleDownvote = async () => {
    await downvoteMutation.mutateAsync({ paperId });
    setDownvoted(true);
    setUpvoted(false);
  };
  
  return (
    <div className="flex gap-2">
      <Button
        variant={saved ? "default" : "outline"}
        size="sm"
        onClick={handleSave}
      >
        <Bookmark className="h-4 w-4" />
      </Button>
      
      <Button
        variant={hidden ? "default" : "outline"}
        size="sm"
        onClick={handleHide}
      >
        <X className="h-4 w-4" />
      </Button>
      
      <Button
        variant={upvoted ? "default" : "outline"}
        size="sm"
        onClick={handleUpvote}
      >
        <ThumbsUp className="h-4 w-4" />
      </Button>
      
      <Button
        variant={downvoted ? "default" : "outline"}
        size="sm"
        onClick={handleDownvote}
      >
        <ThumbsDown className="h-4 w-4" />
      </Button>
    </div>
  );
}
```

---

## 8. Testing Strategy

### 8.1 Unit Tests (Mocked External Services)

**Ranker Agent Tests** (`__tests__/server/agents/ranker.test.ts`):
```typescript
describe('Ranker Agent', () => {
  describe('computeNovelty', () => {
    it('should compute centroid distance correctly', () => {
      const paperEmbedding = [0.5, 0.5, 0.5];
      const userCentroid = [0.1, 0.1, 0.1];
      const score = computeNovelty(paperEmbedding, userCentroid, [], []);
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(1);
    });
    
    it('should detect novel keywords', () => {
      const paperKeywords = ['transformer', 'attention', 'bert'];
      const userKeywords = ['transformer'];
      const score = computeNovelty([0,0,0], [0,0,0], paperKeywords, userKeywords);
      expect(score).toBeCloseTo(0.67, 1); // 2/3 keywords are novel
    });
  });
  
  describe('computeEvidence', () => {
    it('should score evidence signals correctly', () => {
      const enriched = {
        hasBaselines: true,
        hasCode: true,
        hasData: false,
        hasAblations: false,
        hasMultipleEvals: false,
      };
      const score = computeEvidence(enriched);
      expect(score).toBe(0.5); // 0.3 + 0.2
    });
  });
  
  describe('computePersonalFit', () => {
    it('should combine vector similarity and rule bonuses', () => {
      const profile = {
        includedTopics: ['agents'],
        includedKeywords: ['retrieval'],
      };
      const score = computePersonalFit(
        [0.5, 0.5],
        [0.5, 0.5],
        ['agents'],
        'retrieval augmented generation',
        profile
      );
      expect(score).toBeGreaterThan(0.7); // High similarity + bonuses
    });
  });
  
  describe('shouldExcludePaper', () => {
    it('should exclude papers with excluded topics', () => {
      const profile = {
        excludedTopics: ['theory'],
      };
      const excluded = shouldExcludePaper(['theory'], '', profile);
      expect(excluded).toBe(true);
    });
    
    it('should exclude papers with excluded keywords', () => {
      const profile = {
        excludedKeywords: ['quantum'],
      };
      const excluded = shouldExcludePaper([], 'quantum computing', profile);
      expect(excluded).toBe(true);
    });
  });
});
```

**Scoring Library Tests** (`__tests__/server/lib/scoring.test.ts`):
- Test each signal function independently
- Test normalization edge cases
- Test final score combination
- Test score clamping

**Feedback System Tests** (`__tests__/server/lib/vector-learning.test.ts`):
- Test EMA updates (positive and negative)
- Test vector normalization
- Test initialization for new users
- Test feedback persistence

### 8.2 Integration Tests

**End-to-End Scoring** (`__tests__/integration/ranking.test.ts`):
```typescript
describe('Ranking Integration', () => {
  it('should score papers end-to-end', async () => {
    // 1. Create enriched paper
    const paper = await createEnrichedPaper({
      title: 'Test Paper',
      embedding: [0.5, 0.5, 0.5],
      topics: ['agents'],
      hasBaselines: true,
      hasCode: true,
    });
    
    // 2. Create user profile
    const user = await createUserWithProfile({
      profileVector: [0.4, 0.4, 0.4],
      includedTopics: ['agents'],
    });
    
    // 3. Score paper
    const score = await scorePaper(paper.id, user.id);
    
    // 4. Verify score components
    expect(score.novelty).toBeGreaterThan(0);
    expect(score.evidence).toBe(0.5); // hasBaselines + hasCode
    expect(score.personalFit).toBeGreaterThan(0.7); // High similarity + topic match
    expect(score.finalScore).toBeGreaterThan(0);
  });
});
```

### 8.3 UI Component Tests

- Test personalization settings form
- Test score visualization rendering
- Test feedback action buttons
- Test saved papers view
- Mock tRPC hooks for all tests

---

## 9. Performance Considerations

### 9.1 Scoring Performance

**Target**: Score 1000 papers in < 10 seconds

**Optimizations**:
1. **Batch Processing**: Score papers in batches of 100
2. **Parallel Computation**: Use Promise.all() for independent signals
3. **Vector Operations**: Pre-normalize vectors once
4. **Database Queries**: Use `findMany` with includes instead of N+1 queries

```typescript
async function scorePapersBatch(paperIds: string[], userId: string) {
  // Load all papers with enrichment data in one query
  const papers = await prisma.paper.findMany({
    where: { id: { in: paperIds } },
    include: { enriched: true },
  });
  
  // Load user profile once
  const profile = await prisma.userProfile.findUnique({
    where: { userId },
  });
  
  // Score in parallel
  const scores = await Promise.all(
    papers.map(paper => scoreSinglePaper(paper, profile))
  );
  
  // Bulk insert scores
  await prisma.score.createMany({
    data: scores,
  });
}
```

### 9.2 Database Indexes

**Required Indexes**:
```sql
-- Score table
CREATE INDEX idx_scores_user_final ON Score(userId, finalScore DESC);
CREATE UNIQUE INDEX idx_scores_paper_user ON Score(paperId, userId);

-- Feedback table
CREATE INDEX idx_feedback_user_action_date ON Feedback(userId, action, createdAt DESC);
CREATE UNIQUE INDEX idx_feedback_user_paper_action ON Feedback(userId, paperId, action);

-- UserProfile table
CREATE UNIQUE INDEX idx_profile_user ON UserProfile(userId);
```

### 9.3 Caching Strategy

- **Score Caching**: Scores valid until next feedback or re-ranking event
- **Profile Caching**: Cache user profile in memory for request duration
- **Rule Evaluation**: Cache rule evaluation results per paper

---

## 10. Migration Plan

### 10.1 Prisma Schema Changes

**Add to `UserProfile` model**:
```prisma
model UserProfile {
  // ... existing fields ...
  
  // Personalization fields (Phase 2)
  includedTopics    String[]  @default([])
  excludedTopics    String[]  @default([])
  includedKeywords  String[]  @default([])
  excludedKeywords  String[]  @default([])
  boostedLabs       String[]  @default([])
  mathSensitivity   Float     @default(0.5)
  explorationRate   Float     @default(0.15)
  profileVector     Float[]?  // Learned from feedback
}
```

**Add `Score` model** (if not exists):
```prisma
model Score {
  id           String   @id @default(cuid())
  paperId      String
  userId       String
  
  novelty      Float
  evidence     Float
  velocity     Float
  personalFit  Float
  labPrior     Float
  mathPenalty  Float
  finalScore   Float
  
  scoredAt     DateTime @default(now())
  version      Int      @default(1)
  
  paper Paper @relation(fields: [paperId], references: [id], onDelete: Cascade)
  user  User  @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@unique([paperId, userId])
  @@index([userId, finalScore])
}
```

**Add `Feedback` model** (if not exists):
```prisma
model Feedback {
  id        String   @id @default(cuid())
  userId    String
  paperId   String
  action    String   // 'save' | 'hide' | 'upvote' | 'downvote'
  createdAt DateTime @default(now())
  
  user  User  @relation(fields: [userId], references: [id], onDelete: Cascade)
  paper Paper @relation(fields: [paperId], references: [id], onDelete: Cascade)
  
  @@unique([userId, paperId, action])
  @@index([userId, action, createdAt])
}
```

**Run Migration**:
```bash
npx prisma migrate dev --name phase_2_personalization_scoring
```

---

## 11. Open Questions & Decisions

### 11.1 Velocity Signal (V)

**Decision**: Use placeholder `0.5` for Phase 2

**Rationale**:
- Velocity requires daily aggregation infrastructure (Phase 7)
- Placeholder prevents blocking progress
- 10% weight means low impact on final scores
- Can be fully implemented in Phase 7 (Trends & Analytics)

### 11.2 Re-Ranking Frequency

**Options**:
1. **No re-ranking**: Wait for next batch scoring (Phase 2 default)
2. **Immediate re-ranking**: Re-score on every feedback (expensive)
3. **Periodic re-ranking**: Re-score last 7 days weekly (balanced)

**Decision**: Option 1 for Phase 2 (simplest, most efficient)

### 11.3 Exploration Implementation

**Decision**: Defer to Phase 3

**Rationale**:
- Exploration requires digest generation (Phase 3 Recommender Agent)
- Can store `explorationRate` in Phase 2 but not use until Phase 3

### 11.4 LOF (Local Outlier Factor) for Novelty

**Decision**: Optional for Phase 2, use centroid + keywords first

**Rationale**:
- LOF requires neighbor queries (potentially expensive)
- Centroid distance + novel keywords sufficient for MVP
- Can add LOF later if needed

---

## 12. Success Metrics

### 12.1 Quantitative Metrics

- **Scoring Performance**: < 10 seconds for 1000 papers
- **Score Distribution**: Not all 0 or 1, reasonable variance
- **Feedback Rate**: >20% of viewed papers receive feedback
- **Vector Convergence**: Profile vector stabilizes after 20-30 feedbacks

### 12.2 Qualitative Validation

- **Top Papers Match Interests**: Manual review of top 10 papers
- **"Why Shown" Accurate**: Explanations match actual reasons
- **Exclusion Rules Work**: Excluded topics/keywords not shown
- **Inclusion Boosts Work**: Included topics appear higher in ranking

---

**End of Phase 2 Technical Design**
