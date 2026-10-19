import type { AiJob, AiJobType, Prisma } from "@prisma/client";

import {
  getModelAdapter,
  ModelNotConfiguredError,
  setModelAdapterForTests,
  type AnalysisPayload,
  type FixtureAdapter,
} from "@/server/ai/adapter";
import { writeAudit } from "@/server/audit/service";
import type { AuthUser } from "@/server/auth/types";
import { prisma } from "@/server/db";
import { assertCanMutateProject } from "@/server/projects/access";
import { ensureDraftFromBlocks } from "@/server/proposal/draft";
import { recordSearchFromGeneration } from "@/server/search/service";

export async function createAndRunJob(input: {
  actor: AuthUser;
  projectId: string;
  type: AiJobType;
  payload?: Prisma.InputJsonValue;
}): Promise<AiJob> {
  await assertCanMutateProject(input.actor, input.projectId);
  const job = await prisma.aiJob.create({
    data: {
      projectId: input.projectId,
      type: input.type,
      status: "queued",
      input: input.payload,
      createdById: input.actor.id,
      provider: "volcengine-ark",
      model: "doubao-seed-evolving",
    },
  });

  // 无 Redis 时进程内执行，便于本地与测试。
  await processJob(job.id);
  return prisma.aiJob.findUniqueOrThrow({ where: { id: job.id } });
}

export async function getJob(jobId: string): Promise<AiJob | null> {
  return prisma.aiJob.findUnique({ where: { id: jobId } });
}

export async function processJob(jobId: string): Promise<void> {
  const job = await prisma.aiJob.findUnique({ where: { id: jobId } });
  if (!job || job.status === "succeeded" || job.status === "cancelled") {
    return;
  }

  await prisma.aiJob.update({
    where: { id: jobId },
    data: { status: "running", error: null },
  });

  try {
    if (job.type === "analyze") {
      await runAnalyze(job);
    } else if (job.type === "draft_proposal") {
      await runDraft(job);
    } else if (job.type === "regenerate_block") {
      await runRegenerate(job);
    } else if (job.type === "transfer_asset") {
      const { transferFromUrl } = await import("@/server/search/service");
      const input = (job.input ?? {}) as {
        url?: string;
        title?: string;
        hitId?: string;
      };
      if (!input.url) {
        throw new Error("缺少转存地址");
      }
      const asset = await transferFromUrl({
        projectId: job.projectId,
        actorId: job.createdById,
        url: input.url,
        title: input.title,
        allowedToolUrls: [input.url],
      });
      if (input.hitId) {
        await prisma.searchHit.update({
          where: { id: input.hitId },
          data: { assetId: asset.id, selection: "selected" },
        });
      }
      await prisma.aiJob.update({
        where: { id: job.id },
        data: { status: "succeeded", output: { assetId: asset.id } },
      });
    } else {
      throw new Error(`未实现的任务类型：${job.type}`);
    }
  } catch (error) {
    const message =
      error instanceof ModelNotConfiguredError
        ? error.message
        : error instanceof Error
          ? error.message
          : "任务失败";
    await prisma.aiJob.update({
      where: { id: jobId },
      data: { status: "failed", error: message },
    });
  }
}

async function runAnalyze(job: AiJob) {
  const project = await prisma.project.findUniqueOrThrow({
    where: { id: job.projectId },
  });
  const assets = await prisma.asset.findMany({
    where: { projectId: job.projectId },
    select: { filename: true },
  });
  const adapter = getModelAdapter();
  const payload = await adapter.analyze({
    brief: project.brief,
    assetFilenames: assets.map((item) => item.filename ?? "unnamed"),
  });

  const latest = await prisma.analysis.findFirst({
    where: { projectId: job.projectId },
    orderBy: { versionNo: "desc" },
  });
  const versionNo = (latest?.versionNo ?? 0) + 1;

  await prisma.$transaction([
    prisma.analysis.updateMany({
      where: { projectId: job.projectId, isCurrent: true },
      data: { isCurrent: false },
    }),
    prisma.analysis.create({
      data: {
        projectId: job.projectId,
        aiJobId: job.id,
        versionNo,
        isCurrent: true,
        payload,
      },
    }),
    prisma.aiJob.update({
      where: { id: job.id },
      data: { status: "succeeded", output: payload as object },
    }),
  ]);

  await writeAudit({
    actorUserId: job.createdById,
    action: "analysis.generated",
    entityType: "analysis",
    entityId: job.projectId,
    projectId: job.projectId,
    metadata: { versionNo },
  });
}

async function runDraft(job: AiJob) {
  const analysis = await prisma.analysis.findFirst({
    where: {
      projectId: job.projectId,
      isCurrent: true,
      confirmedAt: { not: null },
    },
  });
  if (!analysis) {
    throw new Error("需要已确认的分析才能生成草稿");
  }

  const existing = await prisma.proposalDraft.findUnique({
    where: { projectId: job.projectId },
  });
  const input = (job.input ?? {}) as { mode?: string };
  if (existing && input.mode !== "replace") {
    throw new Error("已有草稿，需明确 mode=replace 才会覆盖");
  }

  const project = await prisma.project.findUniqueOrThrow({
    where: { id: job.projectId },
  });
  const adapter = getModelAdapter();
  const result = await adapter.generateDraft({
    analysis: analysis.payload as AnalysisPayload,
    brief: project.brief,
  });

  await recordSearchFromGeneration({
    projectId: job.projectId,
    actorId: job.createdById,
    result,
  });
  await ensureDraftFromBlocks({
    projectId: job.projectId,
    actorId: job.createdById,
    result,
    replace: Boolean(existing),
  });

  await prisma.aiJob.update({
    where: { id: job.id },
    data: {
      status: "succeeded",
      output: result as object,
    },
  });
}

async function runRegenerate(job: AiJob) {
  const input = (job.input ?? {}) as {
    blockType?: string;
    currentBody?: string;
  };
  if (!input.blockType) {
    throw new Error("缺少 blockType");
  }
  const analysis = await prisma.analysis.findFirst({
    where: { projectId: job.projectId, isCurrent: true },
  });
  if (!analysis) {
    throw new Error("缺少分析");
  }
  const adapter = getModelAdapter();
  const block = await adapter.regenerateBlock({
    analysis: analysis.payload as AnalysisPayload,
    blockType: input.blockType,
    currentBody: input.currentBody ?? "",
  });
  await prisma.aiJob.update({
    where: { id: job.id },
    data: { status: "succeeded", output: block as object },
  });
}

export function useFixtureAdapterInTests(adapter: FixtureAdapter) {
  setModelAdapterForTests(adapter);
}
