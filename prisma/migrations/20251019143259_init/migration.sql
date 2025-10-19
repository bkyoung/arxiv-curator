-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "UserProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "interestVector" JSONB NOT NULL DEFAULT '[]',
    "includeTopics" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "excludeTopics" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "includeKeywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "excludeKeywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "labBoosts" JSONB NOT NULL DEFAULT '{}',
    "mathDepthMax" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "explorationRate" DOUBLE PRECISION NOT NULL DEFAULT 0.15,
    "noiseCap" INTEGER NOT NULL DEFAULT 50,
    "targetToday" INTEGER NOT NULL DEFAULT 15,
    "target7d" INTEGER NOT NULL DEFAULT 100,
    "arxivCategories" TEXT[] DEFAULT ARRAY['cs.AI', 'cs.LG', 'cs.CV', 'cs.CL']::TEXT[],
    "sourcesEnabled" JSONB NOT NULL DEFAULT '{"arxiv": true, "openAlex": false, "semanticScholar": false}',
    "useLocalEmbeddings" BOOLEAN NOT NULL DEFAULT true,
    "useLocalLLM" BOOLEAN NOT NULL DEFAULT true,
    "preferredLLM" TEXT NOT NULL DEFAULT 'gemini-2.0-flash',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Paper" (
    "id" TEXT NOT NULL,
    "arxivId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "title" TEXT NOT NULL,
    "authors" TEXT[],
    "abstract" TEXT NOT NULL,
    "categories" TEXT[],
    "primaryCategory" TEXT NOT NULL,
    "pdfUrl" TEXT,
    "codeUrl" TEXT,
    "pubDate" TIMESTAMP(3) NOT NULL,
    "updatedDate" TIMESTAMP(3) NOT NULL,
    "rawMetadata" JSONB,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Paper_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaperEnriched" (
    "id" TEXT NOT NULL,
    "paperId" TEXT NOT NULL,
    "topics" TEXT[],
    "facets" TEXT[],
    "embedding" JSONB NOT NULL DEFAULT '[]',
    "mathDepth" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "hasCode" BOOLEAN NOT NULL DEFAULT false,
    "hasData" BOOLEAN NOT NULL DEFAULT false,
    "hasBaselines" BOOLEAN NOT NULL DEFAULT false,
    "hasAblations" BOOLEAN NOT NULL DEFAULT false,
    "hasMultipleEvals" BOOLEAN NOT NULL DEFAULT false,
    "enrichedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaperEnriched_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Score" (
    "id" TEXT NOT NULL,
    "paperId" TEXT NOT NULL,
    "novelty" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "evidence" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "velocity" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "personalFit" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "labPrior" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "mathPenalty" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "finalScore" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "whyShown" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Score_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "paperId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "context" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Summary" (
    "id" TEXT NOT NULL,
    "paperId" TEXT NOT NULL,
    "summaryType" TEXT NOT NULL,
    "whatsNew" TEXT NOT NULL,
    "keyPoints" TEXT[],
    "markdownContent" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Summary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Analysis" (
    "id" TEXT NOT NULL,
    "paperId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "depth" TEXT NOT NULL,
    "claimsEvidence" TEXT NOT NULL,
    "limitations" TEXT[],
    "neighborComparison" JSONB,
    "verdict" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "markdownContent" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Analysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notebook" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "purpose" TEXT,
    "isContinuous" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notebook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotebookItem" (
    "id" TEXT NOT NULL,
    "notebookId" TEXT NOT NULL,
    "paperId" TEXT NOT NULL,
    "userNotes" TEXT,
    "tags" TEXT[],
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotebookItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotebookSynthesis" (
    "id" TEXT NOT NULL,
    "notebookId" TEXT NOT NULL,
    "markdownContent" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotebookSynthesis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TopicVelocity" (
    "id" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL,
    "velocity" DOUBLE PRECISION NOT NULL,
    "growthRate" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "TopicVelocity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TechniqueCooccurrence" (
    "id" TEXT NOT NULL,
    "technique1" TEXT NOT NULL,
    "technique2" TEXT NOT NULL,
    "cooccurrenceCount" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TechniqueCooccurrence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Briefing" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "window" TEXT NOT NULL,
    "briefingDate" TIMESTAMP(3) NOT NULL,
    "topPaperIds" TEXT[],
    "trendSummary" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Briefing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArxivCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArxivCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_userId_key" ON "UserProfile"("userId");

-- CreateIndex
CREATE INDEX "UserProfile_userId_idx" ON "UserProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Paper_arxivId_key" ON "Paper"("arxivId");

-- CreateIndex
CREATE INDEX "Paper_arxivId_version_idx" ON "Paper"("arxivId", "version");

-- CreateIndex
CREATE INDEX "Paper_pubDate_idx" ON "Paper"("pubDate");

-- CreateIndex
CREATE INDEX "Paper_status_idx" ON "Paper"("status");

-- CreateIndex
CREATE INDEX "Paper_primaryCategory_idx" ON "Paper"("primaryCategory");

-- CreateIndex
CREATE UNIQUE INDEX "PaperEnriched_paperId_key" ON "PaperEnriched"("paperId");

-- CreateIndex
CREATE INDEX "PaperEnriched_paperId_idx" ON "PaperEnriched"("paperId");

-- CreateIndex
CREATE INDEX "Score_paperId_idx" ON "Score"("paperId");

-- CreateIndex
CREATE INDEX "Score_finalScore_idx" ON "Score"("finalScore");

-- CreateIndex
CREATE INDEX "Feedback_userId_idx" ON "Feedback"("userId");

-- CreateIndex
CREATE INDEX "Feedback_paperId_idx" ON "Feedback"("paperId");

-- CreateIndex
CREATE INDEX "Feedback_createdAt_idx" ON "Feedback"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Feedback_userId_paperId_action_key" ON "Feedback"("userId", "paperId", "action");

-- CreateIndex
CREATE INDEX "Summary_paperId_summaryType_idx" ON "Summary"("paperId", "summaryType");

-- CreateIndex
CREATE INDEX "Analysis_paperId_userId_depth_idx" ON "Analysis"("paperId", "userId", "depth");

-- CreateIndex
CREATE INDEX "Notebook_userId_idx" ON "Notebook"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "NotebookItem_notebookId_paperId_key" ON "NotebookItem"("notebookId", "paperId");

-- CreateIndex
CREATE UNIQUE INDEX "NotebookSynthesis_notebookId_key" ON "NotebookSynthesis"("notebookId");

-- CreateIndex
CREATE INDEX "TopicVelocity_topic_date_idx" ON "TopicVelocity"("topic", "date");

-- CreateIndex
CREATE UNIQUE INDEX "TopicVelocity_topic_date_key" ON "TopicVelocity"("topic", "date");

-- CreateIndex
CREATE UNIQUE INDEX "TechniqueCooccurrence_technique1_technique2_key" ON "TechniqueCooccurrence"("technique1", "technique2");

-- CreateIndex
CREATE INDEX "Briefing_userId_briefingDate_idx" ON "Briefing"("userId", "briefingDate");

-- CreateIndex
CREATE INDEX "ArxivCategory_id_idx" ON "ArxivCategory"("id");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaperEnriched" ADD CONSTRAINT "PaperEnriched_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "Paper"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Score" ADD CONSTRAINT "Score_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "Paper"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "Paper"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Summary" ADD CONSTRAINT "Summary_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "Paper"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Analysis" ADD CONSTRAINT "Analysis_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "Paper"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Analysis" ADD CONSTRAINT "Analysis_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notebook" ADD CONSTRAINT "Notebook_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotebookItem" ADD CONSTRAINT "NotebookItem_notebookId_fkey" FOREIGN KEY ("notebookId") REFERENCES "Notebook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotebookItem" ADD CONSTRAINT "NotebookItem_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "Paper"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotebookSynthesis" ADD CONSTRAINT "NotebookSynthesis_notebookId_fkey" FOREIGN KEY ("notebookId") REFERENCES "Notebook"("id") ON DELETE CASCADE ON UPDATE CASCADE;
