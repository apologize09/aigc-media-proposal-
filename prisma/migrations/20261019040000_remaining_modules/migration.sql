-- CreateEnum
CREATE TYPE "AssetOrigin" AS ENUM ('client_upload', 'web_reference', 'manual_link');

-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('image', 'video', 'document', 'link');

-- CreateEnum
CREATE TYPE "LicenseStatus" AS ENUM ('unknown', 'licensed', 'restricted');

-- CreateEnum
CREATE TYPE "AiJobType" AS ENUM ('analyze', 'draft_proposal', 'regenerate_block', 'transfer_asset', 'publish_render');

-- CreateEnum
CREATE TYPE "AiJobStatus" AS ENUM ('queued', 'running', 'succeeded', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "SearchHitSelection" AS ENUM ('candidate', 'selected', 'dismissed');

-- CreateEnum
CREATE TYPE "WorkTaskStatus" AS ENUM ('draft', 'confirmed', 'cancelled');

-- CreateEnum
CREATE TYPE "ReviewDecision" AS ENUM ('approved', 'changes_requested');

-- CreateTable
CREATE TABLE "assets" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "origin" "AssetOrigin" NOT NULL,
    "media_type" "MediaType" NOT NULL,
    "storage_key" TEXT,
    "source_url" TEXT,
    "filename" TEXT,
    "mime" TEXT,
    "size_bytes" INTEGER,
    "license_status" "LicenseStatus" NOT NULL DEFAULT 'unknown',
    "attribution" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_jobs" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "type" "AiJobType" NOT NULL,
    "status" "AiJobStatus" NOT NULL DEFAULT 'queued',
    "input" JSONB,
    "output" JSONB,
    "error" TEXT,
    "provider" TEXT,
    "model" TEXT,
    "usage" JSONB,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analyses" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "ai_job_id" TEXT,
    "version_no" INTEGER NOT NULL,
    "is_current" BOOLEAN NOT NULL DEFAULT false,
    "payload" JSONB NOT NULL,
    "confirmed_by" TEXT,
    "confirmed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_runs" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_hits" (
    "id" TEXT NOT NULL,
    "search_run_id" TEXT NOT NULL,
    "media_type" "MediaType" NOT NULL,
    "title" TEXT,
    "url" TEXT NOT NULL,
    "thumbnail_url" TEXT,
    "snippet" TEXT,
    "rank" INTEGER NOT NULL DEFAULT 0,
    "selection" "SearchHitSelection" NOT NULL DEFAULT 'candidate',
    "asset_id" TEXT,

    CONSTRAINT "search_hits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposal_drafts" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "project_json" JSONB NOT NULL,
    "based_on_snapshot_id" TEXT,
    "updated_by" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proposal_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposal_snapshots" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "version_no" INTEGER NOT NULL,
    "document" JSONB NOT NULL,
    "quote_snapshot" JSONB NOT NULL,
    "html_storage_key" TEXT NOT NULL,
    "css_storage_key" TEXT,
    "pdf_storage_key" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proposal_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_sheets" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "currency" TEXT,
    "updated_by" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cost_sheets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_lines" (
    "id" TEXT NOT NULL,
    "cost_sheet_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "quantity" DECIMAL(14,2) NOT NULL,
    "unit" TEXT,
    "unit_amount" DECIMAL(14,2),
    "line_amount" DECIMAL(14,2) NOT NULL,
    "note" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "cost_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_lines" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "quantity" DECIMAL(14,2) NOT NULL,
    "unit" TEXT,
    "unit_amount" DECIMAL(14,2),
    "line_amount" DECIMAL(14,2) NOT NULL,
    "visible_in_proposal" BOOLEAN NOT NULL DEFAULT false,
    "cost_line_id" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quote_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_tasks" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "snapshot_id" TEXT,
    "title" TEXT NOT NULL,
    "detail" TEXT,
    "status" "WorkTaskStatus" NOT NULL DEFAULT 'draft',
    "assignee_user_id" TEXT,
    "start_on" DATE,
    "end_on" DATE,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL,
    "snapshot_id" TEXT NOT NULL,
    "reviewer_id" TEXT NOT NULL,
    "decision" "ReviewDecision" NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deliveries" (
    "id" TEXT NOT NULL,
    "snapshot_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actor_user_id" TEXT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "project_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "assets_project_id_idx" ON "assets"("project_id");

-- CreateIndex
CREATE INDEX "ai_jobs_project_id_status_idx" ON "ai_jobs"("project_id", "status");

-- CreateIndex
CREATE INDEX "analyses_project_id_is_current_idx" ON "analyses"("project_id", "is_current");

-- CreateIndex
CREATE INDEX "search_runs_project_id_idx" ON "search_runs"("project_id");

-- CreateIndex
CREATE INDEX "search_hits_search_run_id_idx" ON "search_hits"("search_run_id");

-- CreateIndex
CREATE UNIQUE INDEX "proposal_drafts_project_id_key" ON "proposal_drafts"("project_id");

-- CreateIndex
CREATE INDEX "proposal_snapshots_project_id_idx" ON "proposal_snapshots"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "proposal_snapshots_project_id_version_no_key" ON "proposal_snapshots"("project_id", "version_no");

-- CreateIndex
CREATE UNIQUE INDEX "cost_sheets_project_id_key" ON "cost_sheets"("project_id");

-- CreateIndex
CREATE INDEX "cost_lines_cost_sheet_id_idx" ON "cost_lines"("cost_sheet_id");

-- CreateIndex
CREATE INDEX "quote_lines_project_id_idx" ON "quote_lines"("project_id");

-- CreateIndex
CREATE INDEX "work_tasks_project_id_idx" ON "work_tasks"("project_id");

-- CreateIndex
CREATE INDEX "reviews_snapshot_id_idx" ON "reviews"("snapshot_id");

-- CreateIndex
CREATE UNIQUE INDEX "deliveries_token_hash_key" ON "deliveries"("token_hash");

-- CreateIndex
CREATE INDEX "deliveries_snapshot_id_idx" ON "deliveries"("snapshot_id");

-- CreateIndex
CREATE INDEX "audit_logs_project_id_idx" ON "audit_logs"("project_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_jobs" ADD CONSTRAINT "ai_jobs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_jobs" ADD CONSTRAINT "ai_jobs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_ai_job_id_fkey" FOREIGN KEY ("ai_job_id") REFERENCES "ai_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_confirmed_by_fkey" FOREIGN KEY ("confirmed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "search_runs" ADD CONSTRAINT "search_runs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "search_runs" ADD CONSTRAINT "search_runs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "search_hits" ADD CONSTRAINT "search_hits_search_run_id_fkey" FOREIGN KEY ("search_run_id") REFERENCES "search_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "search_hits" ADD CONSTRAINT "search_hits_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_drafts" ADD CONSTRAINT "proposal_drafts_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_drafts" ADD CONSTRAINT "proposal_drafts_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_drafts" ADD CONSTRAINT "proposal_drafts_based_on_snapshot_id_fkey" FOREIGN KEY ("based_on_snapshot_id") REFERENCES "proposal_snapshots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_snapshots" ADD CONSTRAINT "proposal_snapshots_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_snapshots" ADD CONSTRAINT "proposal_snapshots_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_sheets" ADD CONSTRAINT "cost_sheets_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_sheets" ADD CONSTRAINT "cost_sheets_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_lines" ADD CONSTRAINT "cost_lines_cost_sheet_id_fkey" FOREIGN KEY ("cost_sheet_id") REFERENCES "cost_sheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_lines" ADD CONSTRAINT "quote_lines_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_lines" ADD CONSTRAINT "quote_lines_cost_line_id_fkey" FOREIGN KEY ("cost_line_id") REFERENCES "cost_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_tasks" ADD CONSTRAINT "work_tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_tasks" ADD CONSTRAINT "work_tasks_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "proposal_snapshots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_tasks" ADD CONSTRAINT "work_tasks_assignee_user_id_fkey" FOREIGN KEY ("assignee_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "proposal_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "proposal_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

