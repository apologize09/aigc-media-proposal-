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
import { renderProposalHtml } from "@/server/proposal/render";
import { saveDraftJson } from "@/server/proposal/draft";
import { buildStorageKey, putObject } from "@/server/storage/local";

export async function getDraft(actor: AuthUser, projectId: string) {
  await assertCanViewProject(actor, projectId);
  const draft = await prisma.proposalDraft.findUnique({
    where: { projectId },
  });
  if (!draft) {
    return null;
  }
  return {
    id: draft.id,
    projectId: draft.projectId,
    projectJson: draft.projectJson,
    updatedAt: draft.updatedAt.toISOString(),
    updatedById: draft.updatedById,
    basedOnSnapshotId: draft.basedOnSnapshotId,
  };
}

export async function saveDraft(input: {
  actor: AuthUser;
  projectId: string;
  projectJson: unknown;
  expectedUpdatedAt?: string;
}) {
  await assertCanMutateProject(input.actor, input.projectId);
  const draft = await saveDraftJson({
    projectId: input.projectId,
    actorId: input.actor.id,
    projectJson: input.projectJson,
    expectedUpdatedAt: input.expectedUpdatedAt,
  });
  await writeAudit({
    actorUserId: input.actor.id,
    action: "proposal.draft_saved",
    entityType: "proposal_draft",
    entityId: draft.id,
    projectId: input.projectId,
  });
  return {
    id: draft.id,
    projectId: draft.projectId,
    projectJson: draft.projectJson,
    updatedAt: draft.updatedAt.toISOString(),
    updatedById: draft.updatedById,
  };
}

export async function previewProposal(actor: AuthUser, projectId: string) {
  await assertCanViewProject(actor, projectId);
  const draft = await prisma.proposalDraft.findUnique({
    where: { projectId },
  });
  if (!draft) {
    throw new AuthNotFoundError("尚无草稿");
  }
  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
  });
  return renderProposalHtml({
    projectId,
    projectJson: draft.projectJson,
    projectTitle: project.title,
  });
}

export async function publishProposal(actor: AuthUser, projectId: string) {
  await assertCanMutateProject(actor, projectId);
  const draft = await prisma.proposalDraft.findUnique({
    where: { projectId },
  });
  if (!draft) {
    throw new AuthNotFoundError("尚无草稿，无法发布");
  }

  // 转存未成功的媒体（无 storageKey 且为 web_reference 图片/视频）不能进快照：
  // 渲染只写入已有 storageKey 的素材路径；此处额外校验草稿引用。
  const raw = JSON.stringify(draft.projectJson);
  const assets = await prisma.asset.findMany({ where: { projectId } });
  for (const asset of assets) {
    if (!raw.includes(asset.id)) {
      continue;
    }
    if (
      (asset.mediaType === "image" || asset.mediaType === "video") &&
      !asset.storageKey
    ) {
      throw new AuthValidationError(
        `素材「${asset.filename ?? asset.id}」尚未转存成功，不能发布`,
      );
    }
  }

  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
  });
  const rendered = await renderProposalHtml({
    projectId,
    projectJson: draft.projectJson,
    projectTitle: project.title,
  });

  const latest = await prisma.proposalSnapshot.findFirst({
    where: { projectId },
    orderBy: { versionNo: "desc" },
  });
  const versionNo = (latest?.versionNo ?? 0) + 1;
  const htmlKey = buildStorageKey(projectId, "snapshots", `v${versionNo}.html`);
  const cssKey = buildStorageKey(projectId, "snapshots", `v${versionNo}.css`);
  await putObject(htmlKey, Buffer.from(rendered.html, "utf8"));
  await putObject(cssKey, Buffer.from(rendered.css, "utf8"));

  const snapshot = await prisma.proposalSnapshot.create({
    data: {
      projectId,
      versionNo,
      document: draft.projectJson as object,
      quoteSnapshot: rendered.quoteSnapshot as object,
      htmlStorageKey: htmlKey,
      cssStorageKey: cssKey,
      createdById: actor.id,
    },
  });

  await writeAudit({
    actorUserId: actor.id,
    action: "proposal.published",
    entityType: "proposal_snapshot",
    entityId: snapshot.id,
    projectId,
    metadata: { versionNo },
  });

  return {
    id: snapshot.id,
    projectId: snapshot.projectId,
    versionNo: snapshot.versionNo,
    createdAt: snapshot.createdAt.toISOString(),
  };
}

export async function listSnapshots(actor: AuthUser, projectId: string) {
  await assertCanViewProject(actor, projectId);
  const rows = await prisma.proposalSnapshot.findMany({
    where: { projectId },
    orderBy: { versionNo: "desc" },
    include: {
      reviews: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    projectId: row.projectId,
    versionNo: row.versionNo,
    createdAt: row.createdAt.toISOString(),
    createdById: row.createdById,
    latestReview: row.reviews[0]
      ? {
          decision: row.reviews[0].decision,
          createdAt: row.reviews[0].createdAt.toISOString(),
        }
      : null,
  }));
}

export async function getSnapshot(actor: AuthUser, snapshotId: string) {
  const snapshot = await prisma.proposalSnapshot.findUnique({
    where: { id: snapshotId },
    include: {
      reviews: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!snapshot) {
    throw new AuthNotFoundError("快照不存在");
  }
  await assertCanViewProject(actor, snapshot.projectId);
  return {
    id: snapshot.id,
    projectId: snapshot.projectId,
    versionNo: snapshot.versionNo,
    document: snapshot.document,
    quoteSnapshot: snapshot.quoteSnapshot,
    createdAt: snapshot.createdAt.toISOString(),
    createdById: snapshot.createdById,
    reviews: snapshot.reviews.map((review) => ({
      id: review.id,
      decision: review.decision,
      comment: review.comment,
      reviewerId: review.reviewerId,
      createdAt: review.createdAt.toISOString(),
    })),
  };
}
