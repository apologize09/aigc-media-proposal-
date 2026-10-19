import {
  AuthDeniedError,
  canAccessProject,
  canEditProjects,
  canMutateProject,
  canAccessFinance,
  isAdmin,
} from "@/server/auth/permissions";
import type { AuthUser } from "@/server/auth/types";
import { prisma } from "@/server/db";

export async function isMemberOfProject(
  projectId: string,
  userId: string,
): Promise<boolean> {
  const row = await prisma.projectMember.findUnique({
    where: {
      projectId_userId: { projectId, userId },
    },
    select: { id: true },
  });
  return Boolean(row);
}

export async function assertCanViewProject(
  actor: AuthUser,
  projectId: string,
): Promise<void> {
  if (isAdmin(actor)) {
    return;
  }
  const member = await isMemberOfProject(projectId, actor.id);
  if (!canAccessProject(actor, member)) {
    throw new AuthDeniedError("无权访问该项目");
  }
}

export async function assertCanMutateProject(
  actor: AuthUser,
  projectId: string,
): Promise<void> {
  if (isAdmin(actor)) {
    return;
  }
  const member = await isMemberOfProject(projectId, actor.id);
  if (!canMutateProject(actor, member)) {
    throw new AuthDeniedError("无权修改该项目");
  }
}

export async function assertCanEditProjectContent(
  actor: AuthUser,
  projectId: string,
): Promise<void> {
  if (!canEditProjects(actor) && !isAdmin(actor)) {
    throw new AuthDeniedError("需要方案编辑或管理员权限");
  }
  await assertCanMutateProject(actor, projectId);
}

export async function assertFinanceOnProject(
  actor: AuthUser,
  projectId: string,
): Promise<void> {
  await assertCanViewProject(actor, projectId);
  if (!canAccessFinance(actor)) {
    throw new AuthDeniedError("无财务可见权限");
  }
}
