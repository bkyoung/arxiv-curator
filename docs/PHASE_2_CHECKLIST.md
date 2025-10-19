# Phase 2: Personalization & Scoring - Implementation Checklist

**Status**: In Progress - Day 4 Complete ✅ (Next: Day 5 - UI Components)
**Start Date**: October 19, 2025
**Timeline**: Week 3 (Serial Development Roadmap)
**Dependencies**: Phase 1 (Ingestion & Enrichment) ✅ Complete

---

## Overview

Phase 2 implements the personalization and ranking engine that makes papers personally relevant. Papers are scored using a multi-signal algorithm combining novelty, evidence quality, personal fit, lab reputation, and math depth. User feedback continuously refines the system.

**Key Goal**: Transform unranked paper lists into personalized, relevance-ranked briefings.

---

## Deliverables

### 1. Ranker Agent: Multi-Signal Scoring

- [x] **Core Scoring Infrastructure** ✅ Day 1 Complete
  - [x] Define `Score` model schema (already in Prisma, added unique constraint)
  - [x] Implement `server/agents/ranker.ts` - Main Ranker Agent
  - [x] Implement `server/lib/scoring.ts` - Core scoring functions
  - [x] Define scoring weights and configuration
  - [x] Test basic scoring pipeline (15 tests passing)

- [x] **Signal 1: Novelty (N)** - 20% weight ✅ Day 3 Complete
  - [x] Implement centroid distance calculation
    - [x] Compute user vector centroid from profile (using interestVector as centroid)
    - [x] Calculate cosine distance from centroid
    - [x] Normalize to 0-1 range
  - [x] Implement novel keywords detection
    - [x] Extract keywords from title/abstract (simple whitespace split)
    - [x] Compare against user's historical keywords
    - [x] Score based on novelty ratio
  - [ ] Implement LOF (Local Outlier Factor) - optional for Phase 2 (DEFERRED)
    - [ ] Calculate local density vs neighbors
    - [ ] Identify outliers in embedding space
  - [x] Combine sub-signals: `N = 0.5 × centroid_distance + 0.5 × novel_keywords`
  - [x] Test novelty scoring with sample papers (7 tests passing)

- [x] **Signal 2: Evidence (E)** - 25% weight ✅ Day 1 Complete
  - [x] Use existing evidence signals from Enricher Agent:
    - [x] `hasBaselines` → +0.3
    - [x] `hasAblations` → +0.2
    - [x] `hasCode` → +0.2
    - [x] `hasData` → +0.15
    - [x] `hasMultipleEvals` → +0.15
  - [x] Implement evidence scoring function
  - [x] Test evidence scoring with sample papers (10 tests passing)

- [ ] **Signal 3: Velocity (V)** - 10% weight (OPTIONAL - can defer)
  - [ ] Daily topic count aggregation (background job)
  - [ ] EMA slope calculation (7-day window)
  - [ ] Keyword burst detection
  - [ ] Cache velocity scores in `TopicVelocity` table
  - [ ] **Note**: Can defer to Phase 7 if complex, use placeholder 0.5 for now

- [x] **Signal 4: Personal Fit (P)** - 30% weight ✅ Day 2 Complete
  - [x] Implement vector similarity scoring:
    - [x] Load user profile embedding vector
    - [x] Calculate cosine similarity with paper embedding (6 tests)
    - [x] Normalize to 0-1 range
  - [x] Implement rule-based bonuses:
    - [x] Topic inclusion rules (+0.2 per matched topic)
    - [x] Keyword inclusion rules (+0.1 per matched keyword)
    - [x] Topic exclusion rules (hard filter, remove from results - 11 tests)
    - [x] Keyword exclusion rules (hard filter, remove from results)
  - [x] Combine: `P = 0.7 × cosine_similarity + 0.3 × rule_bonuses`
  - [x] Test personal fit scoring (9 tests)

- [x] **Signal 5: Lab Prior (L)** - 10% weight ✅ Day 3 Complete (Placeholder)
  - [x] Implement lab boost configuration in `UserProfile` (using existing labBoosts field)
  - [x] Match paper authors against boosted labs (implementation ready, awaiting affiliation data)
  - [x] Apply boost multiplier (binary 0/1 for now)
  - [x] Test lab prior scoring (7 tests passing)
  - [ ] **TODO**: Add author affiliation data to enable full lab matching

- [x] **Signal 6: Math Penalty (M)** - 5% weight (negative signal) ✅ Day 3 Complete
  - [x] Use `mathDepth` from Enricher Agent
  - [x] Load user's math sensitivity preference (using mathDepthMax as tolerance)
  - [x] Calculate penalty: `M = mathDepth × (1 - mathDepthMax)`
  - [x] Apply penalty to final score (subtracted in weighted formula)
  - [x] Test math penalty scoring (7 tests passing)

- [x] **Final Score Computation** ✅ Day 3 Complete
  - [x] Implement weighted combination:
    - [x] `final_score = 0.20×N + 0.25×E + 0.10×V + 0.30×P + 0.10×L - 0.05×M`
  - [x] Clamp to [0, 1] range
  - [x] Store in `Score` table with component breakdown
  - [x] Test final scoring with diverse papers (all ranker tests passing)
  - [ ] **Note**: V (Velocity) uses placeholder 0.5 until Phase 7

- [ ] **Batch Scoring**
  - [ ] Implement `scorePapers()` function to score multiple papers
  - [ ] Queue integration: trigger scoring after enrichment
  - [ ] Update paper status to "ranked" after scoring
  - [ ] Test batch scoring performance

### 2. Personalization Rules Engine

- [ ] **Data Model**
  - [ ] Extend `UserProfile` schema with personalization fields:
    - [ ] `includedTopics: String[]` - Topics to boost
    - [ ] `excludedTopics: String[]` - Topics to filter out
    - [ ] `includedKeywords: String[]` - Keywords to boost
    - [ ] `excludedKeywords: String[]` - Keywords to filter out
    - [ ] `boostedLabs: String[]` - Preferred research labs
    - [ ] `mathSensitivity: Float` - Math penalty sensitivity (0-1)
    - [ ] `explorationRate: Float` - Exploration vs exploitation (default 0.15)
  - [ ] Run Prisma migration
  - [ ] Test schema updates

- [ ] **Rule Application Logic**
  - [ ] Implement `applyInclusionRules()` - Boost scores for included topics/keywords
  - [ ] Implement `applyExclusionRules()` - Hard filter excluded topics/keywords
  - [ ] Implement `applyLabBoost()` - Boost papers from preferred labs
  - [ ] Implement `applyMathPenalty()` - Penalize math-heavy papers
  - [ ] Test rule application with sample data

- [ ] **Configuration Defaults**
  - [ ] Default included topics: `['agents', 'rag', 'applications']`
  - [ ] Default excluded topics: `[]`
  - [ ] Default math sensitivity: `0.5`
  - [ ] Default exploration rate: `0.15`
  - [ ] Test default configuration

### 3. Feedback System ✅ Day 4 Complete

- [x] **Data Model**
  - [x] Verify `Feedback` model exists in Prisma schema ✅
  - [x] Fields: `userId`, `paperId`, `action` (save/dismiss/thumbs_up/thumbs_down/hide), `timestamp`
  - [x] Indexes already exist for efficient queries
  - [x] Test feedback persistence (6 tests)

- [x] **Feedback Actions**
  - [x] Implement `recordFeedback()` - Record all feedback types
  - [x] Save action - positive feedback
  - [x] Dismiss action - negative feedback
  - [x] Thumbs up action - positive feedback
  - [x] Thumbs down action - negative feedback
  - [x] Hide action - negative feedback
  - [x] Store feedback in database
  - [x] Test feedback actions (6 tests)

- [x] **Vector Profile Learning**
  - [x] Implement exponential moving average (EMA) update:
    - [x] On save/thumbs_up: `user_vector = 0.9 × user_vector + 0.1 × paper_embedding`
    - [x] On dismiss/thumbs_down/hide: `user_vector = 0.9 × user_vector - 0.1 × paper_embedding`
  - [x] Update `UserProfile.interestVector` in database
  - [x] Normalize user vector after updates
  - [x] Test vector learning with sample feedback (7 tests)

- [x] **Feedback History**
  - [x] Implement `getFeedbackHistory()` - Retrieve user's feedback
  - [x] Filter papers by feedback type (saved, hidden, etc.)
  - [x] Support limiting results
  - [x] Test feedback history retrieval (4 tests)

- [x] **tRPC Feedback Router** ✅ Day 4 Complete
  - [x] Create `server/routers/feedback.ts`
  - [x] `feedback.save` - Save paper mutation
  - [x] `feedback.dismiss` - Dismiss paper mutation
  - [x] `feedback.thumbsUp` - Thumbs up mutation
  - [x] `feedback.thumbsDown` - Thumbs down mutation
  - [x] `feedback.hide` - Hide paper mutation
  - [x] `feedback.getHistory` - Get feedback history query
  - [x] Add to `_app.ts` router
  - [x] Each mutation automatically updates user vector

### 4. User Profile Management UI

- [ ] **Personalization Settings Page**
  - [ ] Create `app/settings/personalization/page.tsx`
  - [ ] Section 1: Topic Preferences
    - [ ] Multi-select for included topics
    - [ ] Multi-select for excluded topics
    - [ ] Preview of topic impact on scores
  - [ ] Section 2: Keyword Rules
    - [ ] Input field for included keywords (comma-separated)
    - [ ] Input field for excluded keywords (comma-separated)
    - [ ] Validation and sanitization
  - [ ] Section 3: Lab Preferences
    - [ ] Input field for boosted labs (autocomplete from author data)
    - [ ] Display current boosted labs
    - [ ] Remove lab button
  - [ ] Section 4: Math Sensitivity
    - [ ] Slider for math penalty sensitivity (0-1)
    - [ ] Preview of math penalty impact
  - [ ] Section 5: Exploration Rate
    - [ ] Slider for exploration vs exploitation (0-0.3)
    - [ ] Explanation of exploration strategy
  - [ ] Save button with tRPC mutation
  - [ ] Reset to defaults button
  - [ ] Test personalization UI

- [ ] **Score Visualization in Papers Page**
  - [ ] Add score breakdown display to paper cards
  - [ ] Show component scores (N, E, V, P, L, M) as badges or bars
  - [ ] "Why Shown" explanation tooltip/accordion
    - [ ] Highlight which signals contributed most
    - [ ] Show matched topics/keywords
    - [ ] Display matched labs if applicable
  - [ ] Test score visualization

- [ ] **Feedback Actions in Papers Page**
  - [ ] Add action buttons to paper cards:
    - [ ] Save button (bookmark icon)
    - [ ] Hide button (x icon)
    - [ ] Upvote button (thumbs up icon)
    - [ ] Downvote button (thumbs down icon)
  - [ ] Visual feedback on action (button state change)
  - [ ] Optimistic UI updates
  - [ ] Test feedback actions in UI

- [ ] **Saved Papers View**
  - [ ] Create `app/saved/page.tsx`
  - [ ] Display papers with feedback.action = 'save'
  - [ ] Sort by save date (newest first)
  - [ ] Allow unsaving papers
  - [ ] Test saved papers view

### 5. tRPC Router Updates

- [ ] **Papers Router Extensions**
  - [ ] `papers.list` - Add score-based sorting option
  - [ ] `papers.list` - Add feedback filter (saved, hidden, etc.)
  - [ ] `papers.getScoreBreakdown` - Get component scores for a paper
  - [ ] Test papers router updates

- [ ] **Feedback Router** (New)
  - [ ] Create `server/routers/feedback.ts`
  - [ ] `feedback.save` - Save paper
  - [ ] `feedback.hide` - Hide paper
  - [ ] `feedback.upvote` - Upvote paper
  - [ ] `feedback.downvote` - Downvote paper
  - [ ] `feedback.getHistory` - Get user's feedback history
  - [ ] Add to `_app.ts` router
  - [ ] Test feedback router

- [ ] **Settings Router Extensions**
  - [ ] `settings.updatePersonalization` - Update topic/keyword rules
  - [ ] `settings.updateLabPreferences` - Update boosted labs
  - [ ] `settings.updateMathSensitivity` - Update math penalty
  - [ ] `settings.updateExplorationRate` - Update exploration rate
  - [ ] Test settings router updates

### 6. Database Schema Updates

- [ ] **Prisma Schema Changes**
  - [ ] Extend `UserProfile` model with personalization fields
  - [ ] Verify `Score` model exists with component breakdown
  - [ ] Verify `Feedback` model exists
  - [ ] Add indexes for performance:
    - [ ] `Score` - `(paperId, userId, finalScore DESC)`
    - [ ] `Feedback` - `(userId, action, createdAt DESC)`
  - [ ] Run migration: `npx prisma migrate dev --name phase_2_personalization`
  - [ ] Test schema changes

### 7. Ranking Integration

- [ ] **Trigger Scoring After Enrichment**
  - [ ] Update scout-enrich workflow to include ranking
  - [ ] Or create separate `rank-papers` job queue
  - [ ] Schedule ranking for newly enriched papers
  - [ ] Test automated ranking

- [ ] **Re-Ranking on Feedback**
  - [ ] Update user profile vector when feedback received
  - [ ] Optionally re-score recent papers (last 7 days)
  - [ ] Or defer re-scoring until next scheduled run
  - [ ] Test re-ranking logic

### 8. Testing

- [ ] **Unit Tests (All External Services Mocked)**
  - [ ] Ranker Agent: signal computation, final scoring (15-20 tests)
    - [ ] Mock Prisma for database operations
    - [ ] Mock user profile and paper data
    - [ ] Test each signal independently
    - [ ] Test final score combination
  - [ ] Scoring library: novelty, evidence, personal fit, etc. (10-15 tests)
    - [ ] Test edge cases (zero vectors, missing data)
    - [ ] Test normalization
  - [ ] Feedback system: actions, vector learning (8-10 tests)
    - [ ] Mock Prisma for feedback persistence
    - [ ] Test EMA updates
  - [ ] Rules engine: inclusion, exclusion, boosts (8-10 tests)
    - [ ] Test hard filtering
    - [ ] Test score boosts
  - [ ] Test coverage >= 80%

- [ ] **Integration Tests (Real Services)**
  - [ ] End-to-end: Enrich → Rank → Score storage (5 tests)
  - [ ] Feedback → Vector update → Re-rank (3 tests)
  - [ ] Personalization settings → Rule application (3 tests)
  - [ ] Real database integration

- [ ] **UI Component Tests**
  - [ ] Personalization settings page (8-10 tests)
    - [ ] Mock tRPC hooks
    - [ ] Test form validation
    - [ ] Test save/reset actions
  - [ ] Score visualization components (5 tests)
  - [ ] Feedback action buttons (5 tests)
  - [ ] Saved papers view (5 tests)

- [ ] **Manual Testing**
  - [ ] Score 10-20 real papers and verify scores make sense
  - [ ] Test personalization rules with different configurations
  - [ ] Provide feedback and verify vector updates
  - [ ] Check "Why Shown" explanations are accurate

**Testing Philosophy**: Continue TDD approach from Phase 1 - write tests first, mock external services for unit tests, validate end-to-end with integration tests.

---

## Acceptance Criteria

**Must Pass All:**

1. **Multi-Signal Scoring** ✅
   - [ ] Papers scored with final_score (0-1 range)
   - [ ] Scores decomposed into N, E, V, P, L, M components
   - [ ] Component scores stored in database
   - [ ] Scores computed efficiently (< 1 second for 100 papers)

2. **Personalization Rules** ✅
   - [ ] User can configure included/excluded topics
   - [ ] User can configure included/excluded keywords
   - [ ] User can boost preferred labs
   - [ ] User can adjust math sensitivity
   - [ ] Rules correctly applied to scoring
   - [ ] Exclusion rules hard filter papers (not shown in results)

3. **Feedback System** ✅
   - [ ] User can save/hide/upvote/downvote papers
   - [ ] Feedback persists correctly
   - [ ] User profile vector updates on feedback
   - [ ] Feedback history retrievable

4. **UI Enhancements** ✅
   - [ ] Personalization settings page functional
   - [ ] Score breakdown displayed on paper cards
   - [ ] "Why Shown" explanations accurate
   - [ ] Feedback actions work with visual feedback
   - [ ] Saved papers view functional

5. **Papers Ranked by Relevance** ✅
   - [ ] Paper list sorted by final_score DESC
   - [ ] Top papers match user preferences
   - [ ] Score distribution makes sense (not all 0 or 1)

6. **Testing** ✅
   - [ ] All unit tests pass (40-50 new tests)
   - [ ] All integration tests pass (10-15 new tests)
   - [ ] All UI tests pass (20-25 new tests)
   - [ ] Manual testing complete

7. **Code Quality** ✅
   - [ ] Linting passes
   - [ ] TypeScript strict mode passes
   - [ ] Build succeeds
   - [ ] Formatter applied

---

## Dependencies

**No New External Services Required** - Uses existing infrastructure:
- PostgreSQL with pgvector (Phase 0)
- Embeddings from Phase 1 (Enricher Agent)
- ollama or cloud LLMs (Phase 1)

**No New npm Packages Required** - All dependencies already installed

---

## Key Files to Create/Modify

### New Files:
```
server/
  agents/
    ranker.ts                # Ranker Agent implementation
  lib/
    scoring.ts               # Multi-signal scoring functions
    novelty.ts               # Novelty detection (centroid, keywords, LOF)
    rules.ts                 # Rules engine (inclusion, exclusion, boosts)
  routers/
    feedback.ts              # Feedback tRPC router
app/
  settings/
    personalization/
      page.tsx               # Personalization settings UI
  saved/
    page.tsx                 # Saved papers view
components/
  ScoreBreakdown.tsx         # Score visualization component
  FeedbackActions.tsx        # Feedback action buttons
  WhyShown.tsx               # "Why Shown" explanation component
__tests__/
  server/
    agents/
      ranker.test.ts         # Ranker unit tests
      ranker-integration.test.ts # Ranker integration tests
    lib/
      scoring.test.ts        # Scoring library tests
      novelty.test.ts        # Novelty detection tests
      rules.test.ts          # Rules engine tests
    routers/
      feedback.test.ts       # Feedback router tests
  app/
    settings/
      personalization/
        page.test.tsx        # Personalization UI tests
    saved/
      page.test.tsx          # Saved papers UI tests
  components/
    ScoreBreakdown.test.tsx  # Score visualization tests
    FeedbackActions.test.tsx # Feedback actions tests
```

### Modified Files:
```
prisma/schema.prisma         # Extend UserProfile, verify Score/Feedback models
server/routers/_app.ts       # Add feedback router
server/routers/papers.ts     # Add score sorting, feedback filtering
server/routers/settings.ts   # Add personalization endpoints
app/papers/page.tsx          # Add score display, feedback actions
worker/workflows/scout-enrich.ts # Optionally add ranking step
```

---

## Risk Mitigation

**Scoring Complexity**
- Risk: Multi-signal algorithm too complex, hard to tune
- Mitigation: Start with simple signals (E, P), add incrementally, defer V if needed

**Vector Profile Drift**
- Risk: User profile vector drifts away from true preferences
- Mitigation: Use conservative EMA (0.9 weight on existing), allow manual reset

**Performance**
- Risk: Scoring 1000s of papers takes too long
- Mitigation: Batch scoring, cache scores, only re-score on feedback if needed

**Rule Conflicts**
- Risk: Inclusion/exclusion rules conflict or produce unexpected results
- Mitigation: Clear precedence (exclusions win), UI preview of rule impact

---

## Implementation Strategy

### Week 3 Timeline (5 days)

**Day 1: Core Scoring Infrastructure + Evidence Signal**
- Implement `ranker.ts` skeleton
- Implement `scoring.ts` with Evidence (E) signal
- Write tests for Evidence scoring
- Integrate with existing enrichment data

**Day 2: Personal Fit (P) + Basic Ranking**
- Implement Personal Fit signal (vector similarity + rules)
- Implement basic rules engine (inclusion/exclusion)
- Write tests for Personal Fit
- End-to-end test: Enrich → Rank → Store scores

**Day 3: Novelty (N) + Lab Prior (L) + Math Penalty (M)**
- Implement Novelty signal (centroid distance + novel keywords)
- Implement Lab Prior signal
- Implement Math Penalty
- Write tests for all three signals
- **Defer Velocity (V)** - use placeholder 0.5

**Day 4: Feedback System + Vector Learning**
- Implement feedback actions (save/hide/upvote/downvote)
- Implement vector profile learning (EMA)
- Create feedback tRPC router
- Write tests for feedback system

**Day 5: UI + Integration Testing**
- Create personalization settings page
- Add score breakdown to papers page
- Add feedback action buttons
- Implement "Why Shown" explanations
- Create saved papers view
- Write UI component tests
- Manual testing and polish

---

## Notes

- **Velocity Signal (V)** is optional for Phase 2. Can use placeholder score of 0.5 and implement fully in Phase 7 (Trends & Analytics)
- **LOF (Local Outlier Factor)** for novelty is optional. Can use simpler centroid distance + keyword novelty
- **Exploration Rate** determines how many low-scoring but potentially interesting papers to show (default 15%)
- **Score normalization** ensures all component signals are 0-1 range before weighted combination
- **Hard filtering** (exclusion rules) removes papers entirely, soft filtering (penalties) reduces score

---

## Next Phase Preview

**Phase 3 (Briefings & Core UI)** will add:
- Recommender Agent for daily digest generation
- Noise cap enforcement (10-20 papers max)
- Exploration strategy implementation
- Three-pane layout UI
- Hotkeys support (j/k navigation, s save, h hide, c critique)
- Scheduled digest generation (pg-boss cron)

---

**Phase 2 Start Date**: [To be filled]
**Phase 2 Completion Date**: [To be filled]
**Status**: 🔜 Not Started
