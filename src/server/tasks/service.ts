import type { WorkTask, WorkTaskStatus } from "@prisma/client";

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

const ALLOWED_STATUS = new Set<WorkTaskStatus>([
  "draft",
  "confirmed",
  "cancelled",
]);

export type PublicTask = {
  id: string;
  projectId: string;
  snapshotId: string | null;
  title: string;
  detail: string | null;
  status: WorkTaskStatus;
  assigneeUserId: string | null;
  startOn: string | null;
  endOn: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
};

function toPublic(task: WorkTask): PublicTask {
  return {
    id: task.id,
    projectId: task.projectId,
    snapshotId: task.snapshotId,
    title: task.title,
    detail: task.detail,
    status: task.status,
    assigneeUserId: task.assigneeUserId,
    startOn: task.startOn?.toISOString().slice(0, 10) ?? null,
    endOn: task.endOn?.toISOString().slice(0, 10) ?? null,
    position: task.position,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}

function parseDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  if (typeof value !== "string") {
    throw new AuthValidationError("日期格式无效");
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new AuthValidationError("日期格式无效");
  }
  return date;
}

export async function listTasks(actor: AuthUser, projectId: string) {
  await assertCanViewProject(actor, projectId);
  const rows = await prisma.workTask.findMany({
    where: { projectId },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });
  return rows.map(toPublic);
}

export async function createTask(input: {
  actor: AuthUser;
  projectId: string;
  title: string;
  detail?: string | null;
  assigneeUserId?: string | null;
  snapshotId?: string | null;
  startOn?: string | null;
  endOn?: string | null;
}) {
  await assertCanMutateProject(input.actor, input.projectId);
  if (!input.title?.trim()) {
    throw new AuthValidationError("任务标题不能为空");
  }
  if (input.snapshotId) {
    const snapshot = await prisma.proposalSnapshot.findFirst({
      where: { id: input.snapshotId, projectId: input.projectId },
    });
    if (!snapshot) {
      throw new AuthNotFoundError("快照不存在");
    }
  }
  const count = await prisma.workTask.count({
    where: { projectId: input.projectId },
  });
  const task = await prisma.workTask.create({
    data: {
      projectId: input.projectId,
      title: input.title.trim(),
      detail: input.detail?.trim() || null,
      assigneeUserId: input.assigneeUserId || null,
      snapshotId: input.snapshotId || null,
      startOn: parseDate(input.startOn),
      endOn: parseDate(input.endOn),
      status: "draft",
      position: count,
    },
  });
  await writeAudit({
    actorUserId: input.actor.id,
    action: "task.created",
    entityType: "work_task",
    entityId: task.id,
    projectId: input.projectId,
  });
  return toPublic(task);
}

export async function updateTask(input: {
  actor: AuthUser;
  taskId: string;
  title?: unknown;
  detail?: unknown;
  status?: unknown;
  assigneeUserId?: unknown;
  snapshotId?: unknown;
  startOn?: unknown;
  endOn?: unknown;
  position?: unknown;
}) {
  const existing = await prisma.workTask.findUnique({
    where: { id: input.taskId },
  });
  if (!existing) {
    throw new AuthNotFoundError("任务不存在");
  }
  await assertCanMutateProject(input.actor, existing.projectId);

  const data: {
    title?: string;
    detail?: string | null;
    status?: WorkTaskStatus;
    assigneeUserId?: string | null;
    snapshotId?: string | null;
    startOn?: Date | null;
    endOn?: Date | null;
    position?: number;
  } = {};

  if (input.title !== undefined) {
    if (typeof input.title !== "string" || !input.title.trim()) {
      throw new AuthValidationError("任务标题不能为空");
    }
    data.title = input.title.trim();
  }
  if (input.detail !== undefined) {
    data.detail =
      typeof input.detail === "string" ? input.detail.trim() || null : null;
  }
  if (input.status !== undefined) {
    if (typeof input.status !== "string" || !ALLOWED_STATUS.has(input.status as WorkTaskStatus)) {
      throw new AuthValidationError("任务状态无效");
    }
    data.status = input.status as WorkTaskStatus;
  }
  if (input.assigneeUserId !== undefined) {
    data.assigneeUserId =
      typeof input.assigneeUserId === "string" && input.assigneeUserId
        ? input.assigneeUserId
        : null;
  }
  if (input.snapshotId !== undefined) {
    if (input.snapshotId === null || input.snapshotId === "") {
      data.snapshotId = null;
    } else if (typeof input.snapshotId === "string") {
      const snapshot = await prisma.proposalSnapshot.findFirst({
        where: { id: input.snapshotId, projectId: existing.projectId },
      });
      if (!snapshot) {
        throw new AuthNotFoundError("快照不存在");
      }
      data.snapshotId = input.snapshotId;
    } else {
      throw new AuthValidationError("快照无效");
    }
  }
  if (input.startOn !== undefined) {
    data.startOn = parseDate(input.startOn);
  }
  if (input.endOn !== undefined) {
    data.endOn = parseDate(input.endOn);
  }
  if (input.position !== undefined) {
    if (typeof input.position !== "number" || !Number.isInteger(input.position)) {
      throw new AuthValidationError("排序无效");
    }
    data.position = input.position;
  }

  const updated = await prisma.workTask.update({
    where: { id: existing.id },
    data,
  });
  await writeAudit({
    actorUserId: input.actor.id,
    action: "task.updated",
    entityType: "work_task",
    entityId: updated.id,
    projectId: updated.projectId,
    metadata: { status: updated.status },
  });
  return toPublic(updated);
}
