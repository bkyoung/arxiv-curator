# Manual Testing Guide

Complete guide to manually test the arXiv Curator application from scratch.

## Prerequisites

### 1. Database Setup
```bash
# Make sure PostgreSQL is running
# Database should be created and migrated
npx prisma db push
```

### 2. LLM Setup (Optional but Recommended)

**For Local LLM (Privacy + Free)**:
```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Start Ollama server
ollama serve

# Pull the model (in another terminal)
ollama pull gemma3:27b
```

**For Cloud LLM (Faster + Better Quality)**:
```bash
# Add to .env.local
GOOGLE_AI_API_KEY=your_api_key_here
```

### 3. Authentication
Make sure you have NextAuth configured with at least one provider (GitHub, Google, etc.)

---

## Step-by-Step Testing Process

### Phase 1: Start Services

#### Terminal 1 - Next.js Dev Server
```bash
npm run dev
```
Server should start on `http://localhost:3000`

#### Terminal 2 - Worker Process
```bash
npm run worker
```
You should see:
```
[Worker] Starting worker process...
[Worker] Queue started
[Worker] Daily digest job scheduled for 6:30 AM ET
[Worker] Ready. Waiting for jobs...
```

### Phase 2: Seed Initial Data

#### Step 1: Ingest Papers from arXiv
```bash
# Terminal 3
npm run seed:papers
```

Expected output:
```
🌱 Seeding papers from arXiv...
✓ Queue started
✓ Enqueued scout-papers job: <job-id>
⏳ Processing will happen in the worker...
```

**Watch Terminal 2 (worker)** - You should see:
```
[Worker] Processing scout-papers job <id>
[Worker] Categories: cs.AI, cs.LG, cs.CL, cs.CV
[Worker] Max results: 50
[Worker] Job <id> completed
[Worker] Scouted 50 papers
[Worker] Enriched 50 papers
```

⏱️ **Expected time**: 2-5 minutes (parallel processing)

#### Step 2: Generate Digest
```bash
# Terminal 3
npm run seed:digest
```

Expected output:
```
📰 Generating daily digest...
✓ Queue started
✓ Enqueued generate-daily-digests job: <job-id>
```

**Watch Terminal 2 (worker)** - You should see:
```
[Worker] Processing generate-daily-digests job <id>
[Worker] Job <id> completed
[Worker] Generated digests: 1 succeeded, 0 failed (total: 1)
```

⏱️ **Expected time**: 10-30 seconds

---

## Phase 3: UI Testing

### 1. Sign In
- Navigate to `http://localhost:3000`
- Sign in with your configured auth provider
- You should be redirected to `/briefings/latest`

### 2. Test: Latest Briefing (`/briefings/latest`)

**✅ Expected Behavior**:

**Left Pane (Navigation)**:
- "Today" button (active)
- "7 Days" button
- "Saved" button
- "Settings" button
- Help icon (shortcut reference)

**Middle Pane (Paper List)**:
- 10-15 paper cards displayed
- Each card shows:
  - Score badge (percentage)
  - Paper title
  - Authors (first 3 + count)
  - Topics (badges)
  - Evidence badges (Code, Baselines, etc.)
  - "Why Shown" (top 2 signals)

**Right Pane (Detail View)**:
- Initially shows "Select a paper to view details"
- After clicking a card:
  - Full title
  - All authors
  - Publication date
  - PDF link
  - Feedback actions (Save, Dismiss, Thumbs, Hide)
  - Score breakdown (progress bars)
  - Why Shown (detailed)
  - **✨ AI Summary Panel** (NEW!)
    - "What's New" section (2-3 sentences)
    - "Key Points" section (3-5 bullets)
    - Loading skeleton if generating
  - Abstract
  - Topics (all tags)
  - Evidence badges
  - Math depth indicator

### 3. Test: Summary Generation

**Click a paper card** → Summary should:

**First Time (Cache Miss)**:
1. Show loading skeleton for 1-8 seconds
2. Then display summary
3. Summary should be relevant to the paper

**Second Time (Cache Hit)**:
1. Show summary instantly (<100ms)
2. Same content as before

**Test Both LLM Providers**:
- Local (Ollama): Slower (3-8s) but private
- Cloud (Gemini): Faster (1-3s) but needs API key

To switch providers:
```sql
-- In your database
UPDATE "UserProfile"
SET "useLocalLLM" = false  -- Use cloud (Gemini)
WHERE "userId" = 'your-user-id';

UPDATE "UserProfile"
SET "useLocalLLM" = true  -- Use local (Ollama)
WHERE "userId" = 'your-user-id';
```

### 4. Test: Keyboard Shortcuts

Press `?` → Help modal should open showing:
- `j/k` - Navigate papers
- `Enter` - Select paper
- `s` - Save paper
- `d` - Dismiss paper
- `↑/↓` - Navigate papers
- `?` - Toggle help

Test navigation:
- `j` should move down the paper list
- `k` should move up
- Selected paper should highlight
- Detail view should update

### 5. Test: Feedback Actions

**In paper detail view**, test each action:

**Save** (`s` or click):
- ✅ Paper should move to "Saved" view
- ✅ Check `/saved` - paper should appear

**Dismiss** (`d` or click):
- ✅ Paper should disappear from briefing
- ✅ Should not appear in future briefings

**Thumbs Up/Down**:
- ✅ Should record feedback (check UserProfile learning)
- ✅ Future briefings should reflect preference

**Hide**:
- ✅ Paper disappears from all views
- ✅ Should never appear again

### 6. Test: Settings Pages

#### **Preferences** (`/settings`)
Should show:
- Model preferences section
- Display preferences
- System preferences

#### **Personalization** (`/settings/personalization`)
Should show:
- Exploration Rate slider (0-100%)
- Noise Cap slider (5-30 papers)
- Score Threshold slider (0-100%)
- Math Depth Tolerance slider (0-100%)

**Test**: Change a slider → Save → Check briefing regeneration

### 7. Test: Papers Page (`/papers`)

Should show:
- All papers in database (50+ from seed)
- Pagination controls
- Search/filter (if implemented)

### 8. Test: Saved Papers (`/saved`)

Should show:
- All papers you clicked "Save" on
- Same card layout as briefings
- Detail view on click

---

## Phase 4: Summary Quality Testing

### Test Summary Quality

For 3-5 different papers, evaluate:

**"What's New" Section**:
- ✅ 2-3 concise sentences
- ✅ Explains the key contribution
- ✅ Technically accurate
- ✅ Avoids fluff/marketing language

**"Key Points" Section**:
- ✅ 3-5 specific bullet points
- ✅ Highlights claims or findings
- ✅ Concrete (not vague)
- ✅ Captures important details

**Overall**:
- ✅ Helps decide if paper is worth reading
- ✅ Faster than reading full abstract
- ✅ No hallucinations or made-up facts

### Performance Testing

**Cache Performance**:
1. Click paper → Note generation time
2. Navigate away
3. Click same paper → Should be instant (<100ms)

**Bulk Generation** (if implemented):
- Check if all papers in briefing get summaries generated
- Should happen in background (< 30s for 10 papers)

---

## Troubleshooting

### No Papers Showing
**Problem**: "Browse Papers" is empty
**Solution**:
1. Check worker is running: `npm run worker`
2. Trigger paper fetch: `npm run seed:papers`
3. Wait 2-5 minutes for enrichment
4. Generate digest: `npm run seed:digest`

### Summary Not Generating
**Problem**: Infinite loading or error

**For Ollama**:
```bash
# Check Ollama is running
curl http://localhost:11434/api/tags

# Should return JSON with models
# If not, start Ollama: ollama serve

# Check model is pulled
ollama list | grep gemma3
```

**For Gemini**:
```bash
# Check API key is set
grep GOOGLE_AI_API_KEY .env.local

# Test API key
curl -H "Content-Type: application/json" \
  -d '{"contents":[{"parts":[{"text":"Hello"}]}]}' \
  "https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=$GOOGLE_AI_API_KEY"
```

### Settings Not Working
**Problem**: Changes don't save or take effect

**Check**:
1. User is logged in
2. UserProfile exists in database
3. Check browser console for errors
4. Check Network tab for failed requests

### Worker Not Processing Jobs
**Problem**: Jobs queued but not running

**Check**:
```bash
# Terminal with worker
# Should show: [Worker] Ready. Waiting for jobs...

# If not, restart:
# Ctrl+C then npm run worker
```

---

## Success Criteria

### ✅ Phase 4 (Summaries) Complete When:

1. **Summary Generation**
   - ✅ Summaries generate successfully with local LLM
   - ✅ Summaries generate successfully with cloud LLM
   - ✅ "What's New" is 2-3 concise sentences
   - ✅ "Key Points" contains 3-5 specific bullets
   - ✅ Generation completes in < 8 seconds per paper

2. **Caching**
   - ✅ Identical papers return cached summaries
   - ✅ Cached summaries returned in < 100ms
   - ✅ Cache persists across sessions

3. **UI Integration**
   - ✅ Summary panel displays correctly in detail view
   - ✅ Loading states show skeleton
   - ✅ Errors display user-friendly messages

4. **Performance**
   - ✅ Local LLM: < 8 seconds per summary
   - ✅ Cloud LLM: < 3 seconds per summary
   - ✅ UI remains responsive during generation

---

## Next Steps

After Phase 4 testing is complete, the next phase is:

**Phase 5: Critical Analysis**
- PDF parsing and text extraction
- Deep analysis (3 depth levels)
- Claims & evidence extraction
- Critique UI components
