import { writeAudit } from "@/server/audit/service";
import { hasRole, isAdmin } from "@/server/auth/permissions";
import {
  AuthDeniedError,
} from "@/server/auth/permissions";
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
import {
  createShareToken,
  getObject,
  hashToken,
} from "@/server/storage/local";

export async function submitSnapshot(actor: AuthUser, snapshotId: string) {
  const snapshot = await prisma.proposalSnapshot.findUnique({
    where: { id: snapshotId },
  });
  if (!snapshot) {
    throw new AuthNotFoundError("快照不存在");
  }
  await assertCanMutateProject(actor, snapshot.projectId);
  await writeAudit({
    actorUserId: actor.id,
    action: "review.submitted",
    entityType: "proposal_snapshot",
    entityId: snapshot.id,
    projectId: snapshot.projectId,
    metadata: { versionNo: snapshot.versionNo },
  });
  return { snapshotId: snapshot.id, status: "submitted" as const };
}

export async function reviewSnapshot(input: {
  actor: AuthUser;
  snapshotId: string;
  decision: "approved" | "changes_requested";
  comment?: string | null;
}) {
  if (!isAdmin(input.actor) && !hasRole(input.actor, "reviewer")) {
    throw new AuthDeniedError("需要审核人或管理员权限");
  }
  const snapshot = await prisma.proposalSnapshot.findUnique({
    where: { id: input.snapshotId },
  });
  if (!snapshot) {
    throw new AuthNotFoundError("快照不存在");
  }
  await assertCanViewProject(input.actor, snapshot.projectId);

  const review = await prisma.review.create({
    data: {
      snapshotId: snapshot.id,
      reviewerId: input.actor.id,
      decision: input.decision,
      comment: input.comment?.trim() || null,
    },
  });

  await writeAudit({
    actorUserId: input.actor.id,
    action:
      input.decision === "approved" ? "review.approved" : "review.changes_requested",
    entityType: "review",
    entityId: review.id,
    projectId: snapshot.projectId,
    metadata: { snapshotId: snapshot.id },
  });

  return {
    id: review.id,
    snapshotId: review.snapshotId,
    decision: review.decision,
    comment: review.comment,
    createdAt: review.createdAt.toISOString(),
  };
}

async function assertLatestApproved(snapshotId: string) {
  const latest = await prisma.review.findFirst({
    where: { snapshotId },
    orderBy: { createdAt: "desc" },
  });
  if (!latest || latest.decision !== "approved") {
    throw new AuthValidationError("快照尚未审核通过，不能交付");
  }
}

export async function createDelivery(actor: AuthUser, snapshotId: string) {
  const snapshot = await prisma.proposalSnapshot.findUnique({
    where: { id: snapshotId },
  });
  if (!snapshot) {
    throw new AuthNotFoundError("快照不存在");
  }
  await assertCanMutateProject(actor, snapshot.projectId);
  await assertLatestApproved(snapshotId);

  const token = createShareToken();
  const delivery = await prisma.delivery.create({
    data: {
      snapshotId: snapshot.id,
      tokenHash: hashToken(token),
      createdById: actor.id,
    },
  });

  await writeAudit({
    actorUserId: actor.id,
    action: "delivery.created",
    entityType: "delivery",
    entityId: delivery.id,
    projectId: snapshot.projectId,
    metadata: { snapshotId: snapshot.id },
  });

  return {
    id: delivery.id,
    snapshotId: delivery.snapshotId,
    token,
    createdAt: delivery.createdAt.toISOString(),
  };
}

export async function revokeDelivery(actor: AuthUser, deliveryId: string) {
  const delivery = await prisma.delivery.findUnique({
    where: { id: deliveryId },
    include: { snapshot: true },
  });
  if (!delivery) {
    throw new AuthNotFoundError("交付链接不存在");
  }
  await assertCanMutateProject(actor, delivery.snapshot.projectId);
  if (delivery.revokedAt) {
    return {
      id: delivery.id,
      revokedAt: delivery.revokedAt.toISOString(),
    };
  }
  const updated = await prisma.delivery.update({
    where: { id: delivery.id },
    data: { revokedAt: new Date() },
  });
  await writeAudit({
    actorUserId: actor.id,
    action: "delivery.revoked",
    entityType: "delivery",
    entityId: delivery.id,
    projectId: delivery.snapshot.projectId,
  });
  return {
    id: updated.id,
    revokedAt: updated.revokedAt!.toISOString(),
  };
}

export async function readPublicDelivery(token: string): Promise<{
  html: string;
  versionNo: number;
} | null> {
  if (!token || token.length < 16) {
    return null;
  }
  const delivery = await prisma.delivery.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { snapshot: true },
  });
  if (!delivery || delivery.revokedAt) {
    return null;
  }
  if (delivery.expiresAt && delivery.expiresAt.getTime() < Date.now()) {
    return null;
  }
  try {
    const html = (await getObject(delivery.snapshot.htmlStorageKey)).toString(
      "utf8",
    );
    return { html, versionNo: delivery.snapshot.versionNo };
  } catch {
    return null;
  }
}

export async function listDeliveries(actor: AuthUser, snapshotId: string) {
  const snapshot = await prisma.proposalSnapshot.findUnique({
    where: { id: snapshotId },
  });
  if (!snapshot) {
    throw new AuthNotFoundError("快照不存在");
  }
  await assertCanViewProject(actor, snapshot.projectId);
  const rows = await prisma.delivery.findMany({
    where: { snapshotId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((row) => ({
    id: row.id,
    snapshotId: row.snapshotId,
    revokedAt: row.revokedAt?.toISOString() ?? null,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  }));
}
