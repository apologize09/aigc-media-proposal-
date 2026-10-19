import type { Prisma } from "@prisma/client";

import { prisma } from "@/server/db";

export async function writeAudit(input: {
  actorUserId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  projectId?: string | null;
  metadata?: Prisma.InputJsonValue;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actorUserId: input.actorUserId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      projectId: input.projectId ?? null,
      metadata: input.metadata,
    },
  });
}

export async function listProjectAudit(
  projectId: string,
  limit = 50,
): Promise<
  Array<{
    id: string;
    action: string;
    entityType: string;
    entityId: string;
    actorUserId: string | null;
    createdAt: string;
    metadata: unknown;
  }>
> {
  const rows = await prisma.auditLog.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    take: Math.min(limit, 100),
  });
  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    actorUserId: row.actorUserId,
    createdAt: row.createdAt.toISOString(),
    metadata: row.metadata,
  }));
}
