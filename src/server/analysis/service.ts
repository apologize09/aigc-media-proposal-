import type { Analysis } from "@prisma/client";

import type { AnalysisPayload } from "@/server/ai/adapter";
import { createAndRunJob } from "@/server/ai/jobs";
import { writeAudit } from "@/server/audit/service";
import {
  AuthNotFoundError,
  AuthValidationError,
} from "@/server/auth/http";
import type { AuthUser } from "@/server/auth/types";
import { prisma } from "@/server/db";
import {
  assertCanMutateProject,
  assertCanViewProject,
} from "@/server/projects/access";

export type PublicAnalysis = {
  id: string;
  projectId: string;
  versionNo: number;
  isCurrent: boolean;
  payload: AnalysisPayload;
  confirmedAt: string | null;
  confirmedById: string | null;
  createdAt: string;
};

function asPayload(raw: unknown): AnalysisPayload {
  const value = raw as AnalysisPayload;
  if (!value || typeof value.summary !== "string") {
    throw new AuthValidationError("分析结构无效");
  }
  return {
    summary: value.summary,
    objectives: Array.isArray(value.objectives) ? value.objectives : [],
    audience: value.audience ?? null,
    deliverableNotes: value.deliverableNotes ?? null,
    styleNotes: value.styleNotes ?? null,
    constraints: Array.isArray(value.constraints) ? value.constraints : [],
    openQuestions: Array.isArray(value.openQuestions) ? value.openQuestions : [],
    searchQueries: Array.isArray(value.searchQueries) ? value.searchQueries : [],
  };
}

function toPublic(row: Analysis): PublicAnalysis {
  return {
    id: row.id,
    projectId: row.projectId,
    versionNo: row.versionNo,
    isCurrent: row.isCurrent,
    payload: asPayload(row.payload),
    confirmedAt: row.confirmedAt?.toISOString() ?? null,
    confirmedById: row.confirmedById,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function getCurrentAnalysis(
  actor: AuthUser,
  projectId: string,
): Promise<PublicAnalysis | null> {
  await assertCanViewProject(actor, projectId);
  const row = await prisma.analysis.findFirst({
    where: { projectId, isCurrent: true },
  });
  return row ? toPublic(row) : null;
}

export async function enqueueAnalysis(actor: AuthUser, projectId: string) {
  return createAndRunJob({
    actor,
    projectId,
    type: "analyze",
  });
}

export async function updateCurrentAnalysis(
  actor: AuthUser,
  projectId: string,
  payload: AnalysisPayload,
): Promise<PublicAnalysis> {
  await assertCanMutateProject(actor, projectId);
  const current = await prisma.analysis.findFirst({
    where: { projectId, isCurrent: true },
  });
  if (!current) {
    throw new AuthNotFoundError("尚无分析稿");
  }
  if (current.confirmedAt) {
    throw new AuthValidationError("已确认的分析不能直接改正，请重新入队分析");
  }
  const validated = asPayload(payload);
  const updated = await prisma.analysis.update({
    where: { id: current.id },
    data: { payload: validated },
  });
  await writeAudit({
    actorUserId: actor.id,
    action: "analysis.updated",
    entityType: "analysis",
    entityId: updated.id,
    projectId,
  });
  return toPublic(updated);
}

export async function confirmCurrentAnalysis(
  actor: AuthUser,
  projectId: string,
): Promise<PublicAnalysis> {
  await assertCanMutateProject(actor, projectId);
  const current = await prisma.analysis.findFirst({
    where: { projectId, isCurrent: true },
  });
  if (!current) {
    throw new AuthNotFoundError("尚无分析稿");
  }
  if (current.confirmedAt) {
    return toPublic(current);
  }
  const updated = await prisma.analysis.update({
    where: { id: current.id },
    data: {
      confirmedAt: new Date(),
      confirmedById: actor.id,
    },
  });
  await writeAudit({
    actorUserId: actor.id,
    action: "analysis.confirmed",
    entityType: "analysis",
    entityId: updated.id,
    projectId,
    metadata: { versionNo: updated.versionNo },
  });
  return toPublic(updated);
}
