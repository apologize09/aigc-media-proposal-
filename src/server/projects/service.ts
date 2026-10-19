import type { Client, Project, ProjectMember, User } from "@prisma/client";

import {
  AuthConflictError,
  AuthNotFoundError,
  AuthValidationError,
} from "@/server/auth/http";
import {
  AuthDeniedError,
  canAccessProject,
  canEditProjects,
  canMutateProject,
  isAdmin,
} from "@/server/auth/permissions";
import type { AuthUser } from "@/server/auth/types";
import { prisma } from "@/server/db";
import type {
  PublicClient,
  PublicProject,
  PublicProjectMember,
} from "@/server/projects/types";

type MemberWithUser = ProjectMember & {
  user: Pick<User, "id" | "email" | "name">;
};

type ProjectWithRelations = Project & {
  client: Pick<Client, "id" | "name">;
  owner: Pick<User, "id" | "name">;
  members: MemberWithUser[];
};

function toPublicClient(client: Client, actor: AuthUser): PublicClient {
  return {
    id: client.id,
    name: client.name,
    contactName: client.contactName,
    contactEmail: client.contactEmail,
    contactPhone: client.contactPhone,
    // 内部备注仅方案编辑与管理员可见，避免审核人侧泄漏。
    internalNotes: canEditProjects(actor) ? client.internalNotes : null,
    createdById: client.createdById,
    createdAt: client.createdAt.toISOString(),
    updatedAt: client.updatedAt.toISOString(),
  };
}

function toPublicMember(member: MemberWithUser): PublicProjectMember {
  return {
    userId: member.userId,
    email: member.user.email,
    name: member.user.name,
    createdAt: member.createdAt.toISOString(),
  };
}

function toPublicProject(project: ProjectWithRelations): PublicProject {
  return {
    id: project.id,
    clientId: project.clientId,
    clientName: project.client.name,
    title: project.title,
    brief: project.brief,
    ownerUserId: project.ownerUserId,
    ownerName: project.owner.name,
    archivedAt: project.archivedAt ? project.archivedAt.toISOString() : null,
    createdById: project.createdById,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    members: project.members.map(toPublicMember),
  };
}

function nullableText(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== "string") {
    throw new AuthValidationError("字段类型无效");
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function requiredText(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new AuthValidationError(`请填写${label}`);
  }
  return value.trim();
}

async function isMemberOfProject(
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

async function assertCanViewProject(
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

async function assertCanMutateProject(
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

async function assertCanViewClient(
  actor: AuthUser,
  clientId: string,
): Promise<void> {
  if (isAdmin(actor) || canEditProjects(actor)) {
    return;
  }

  const linked = await prisma.project.findFirst({
    where: {
      clientId,
      members: { some: { userId: actor.id } },
    },
    select: { id: true },
  });
  if (!linked) {
    throw new AuthDeniedError("无权访问该客户");
  }
}

const projectInclude = {
  client: { select: { id: true, name: true } },
  owner: { select: { id: true, name: true } },
  members: {
    include: {
      user: { select: { id: true, email: true, name: true } },
    },
    orderBy: { createdAt: "asc" as const },
  },
};

export async function listClients(actor: AuthUser): Promise<PublicClient[]> {
  if (isAdmin(actor) || canEditProjects(actor)) {
    const clients = await prisma.client.findMany({
      orderBy: { createdAt: "desc" },
    });
    return clients.map((client) => toPublicClient(client, actor));
  }

  const clients = await prisma.client.findMany({
    where: {
      projects: {
        some: {
          members: { some: { userId: actor.id } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  return clients.map((client) => toPublicClient(client, actor));
}

export async function getClient(
  actor: AuthUser,
  clientId: string,
): Promise<PublicClient> {
  await assertCanViewClient(actor, clientId);
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) {
    throw new AuthNotFoundError("客户不存在");
  }
  return toPublicClient(client, actor);
}

export async function createClient(input: {
  actor: AuthUser;
  name: unknown;
  contactName?: unknown;
  contactEmail?: unknown;
  contactPhone?: unknown;
  internalNotes?: unknown;
}): Promise<PublicClient> {
  if (!canEditProjects(input.actor)) {
    throw new AuthDeniedError("需要方案编辑或管理员权限");
  }

  const name = requiredText(input.name, "客户名称");
  const client = await prisma.client.create({
    data: {
      name,
      contactName: nullableText(input.contactName),
      contactEmail: nullableText(input.contactEmail),
      contactPhone: nullableText(input.contactPhone),
      internalNotes: nullableText(input.internalNotes),
      createdById: input.actor.id,
    },
  });
  return toPublicClient(client, input.actor);
}

export async function updateClient(input: {
  actor: AuthUser;
  clientId: string;
  name?: unknown;
  contactName?: unknown;
  contactEmail?: unknown;
  contactPhone?: unknown;
  internalNotes?: unknown;
}): Promise<PublicClient> {
  if (!canEditProjects(input.actor)) {
    throw new AuthDeniedError("需要方案编辑或管理员权限");
  }

  const existing = await prisma.client.findUnique({
    where: { id: input.clientId },
  });
  if (!existing) {
    throw new AuthNotFoundError("客户不存在");
  }

  const data: {
    name?: string;
    contactName?: string | null;
    contactEmail?: string | null;
    contactPhone?: string | null;
    internalNotes?: string | null;
  } = {};

  if (input.name !== undefined) {
    data.name = requiredText(input.name, "客户名称");
  }
  if (input.contactName !== undefined) {
    data.contactName = nullableText(input.contactName);
  }
  if (input.contactEmail !== undefined) {
    data.contactEmail = nullableText(input.contactEmail);
  }
  if (input.contactPhone !== undefined) {
    data.contactPhone = nullableText(input.contactPhone);
  }
  if (input.internalNotes !== undefined) {
    data.internalNotes = nullableText(input.internalNotes);
  }

  const client = await prisma.client.update({
    where: { id: existing.id },
    data,
  });
  return toPublicClient(client, input.actor);
}

export async function listProjects(
  actor: AuthUser,
  options: { includeArchived?: boolean } = {},
): Promise<PublicProject[]> {
  const includeArchived = options.includeArchived === true;
  const where = {
    ...(includeArchived ? {} : { archivedAt: null }),
    ...(isAdmin(actor) ? {} : { members: { some: { userId: actor.id } } }),
  };

  const projects = await prisma.project.findMany({
    where,
    include: projectInclude,
    orderBy: { updatedAt: "desc" },
  });
  return projects.map(toPublicProject);
}

export async function getProject(
  actor: AuthUser,
  projectId: string,
): Promise<PublicProject> {
  await assertCanViewProject(actor, projectId);
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: projectInclude,
  });
  if (!project) {
    throw new AuthNotFoundError("项目不存在");
  }
  return toPublicProject(project);
}

export async function createProject(input: {
  actor: AuthUser;
  clientId: unknown;
  title: unknown;
  brief?: unknown;
  ownerUserId?: unknown;
}): Promise<PublicProject> {
  if (!canEditProjects(input.actor)) {
    throw new AuthDeniedError("需要方案编辑或管理员权限");
  }

  const clientId = requiredText(input.clientId, "客户");
  const title = requiredText(input.title, "项目标题");
  const brief =
    input.brief === undefined || input.brief === null
      ? ""
      : typeof input.brief === "string"
        ? input.brief
        : (() => {
            throw new AuthValidationError("需求正文无效");
          })();

  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) {
    throw new AuthValidationError("客户不存在");
  }

  let ownerUserId = input.actor.id;
  if (input.ownerUserId !== undefined && input.ownerUserId !== null) {
    if (
      typeof input.ownerUserId !== "string" ||
      input.ownerUserId.trim() === ""
    ) {
      throw new AuthValidationError("负责人无效");
    }
    ownerUserId = input.ownerUserId.trim();
  }

  const owner = await prisma.user.findUnique({ where: { id: ownerUserId } });
  if (!owner || owner.status !== "active") {
    throw new AuthValidationError("负责人不存在或已停用");
  }

  const memberIds = new Set<string>([input.actor.id, ownerUserId]);

  const project = await prisma.$transaction(async (tx) => {
    const created = await tx.project.create({
      data: {
        clientId,
        title,
        brief,
        ownerUserId,
        createdById: input.actor.id,
        members: {
          create: [...memberIds].map((userId) => ({ userId })),
        },
      },
      include: projectInclude,
    });
    return created;
  });

  return toPublicProject(project);
}

export async function updateProject(input: {
  actor: AuthUser;
  projectId: string;
  title?: unknown;
  brief?: unknown;
  archived?: unknown;
}): Promise<PublicProject> {
  await assertCanMutateProject(input.actor, input.projectId);

  const existing = await prisma.project.findUnique({
    where: { id: input.projectId },
  });
  if (!existing) {
    throw new AuthNotFoundError("项目不存在");
  }

  const data: {
    title?: string;
    brief?: string;
    archivedAt?: Date | null;
  } = {};

  if (input.title !== undefined) {
    data.title = requiredText(input.title, "项目标题");
  }
  if (input.brief !== undefined) {
    if (typeof input.brief !== "string") {
      throw new AuthValidationError("需求正文无效");
    }
    data.brief = input.brief;
  }
  if (input.archived !== undefined) {
    if (typeof input.archived !== "boolean") {
      throw new AuthValidationError("归档标记无效");
    }
    data.archivedAt = input.archived ? new Date() : null;
  }

  const project = await prisma.project.update({
    where: { id: existing.id },
    data,
    include: projectInclude,
  });
  return toPublicProject(project);
}

export async function addProjectMember(input: {
  actor: AuthUser;
  projectId: string;
  userId?: unknown;
  email?: unknown;
}): Promise<PublicProject> {
  await assertCanMutateProject(input.actor, input.projectId);

  let targetUserId: string | null = null;
  if (typeof input.userId === "string" && input.userId.trim()) {
    targetUserId = input.userId.trim();
  } else if (typeof input.email === "string" && input.email.trim()) {
    const email = input.email.trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.status !== "active") {
      throw new AuthValidationError("用户不存在或已停用");
    }
    targetUserId = user.id;
  } else {
    throw new AuthValidationError("请提供 userId 或 email");
  }

  const user = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!user || user.status !== "active") {
    throw new AuthValidationError("用户不存在或已停用");
  }

  try {
    await prisma.projectMember.create({
      data: {
        projectId: input.projectId,
        userId: targetUserId,
      },
    });
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      throw new AuthConflictError("该用户已是项目成员");
    }
    throw error;
  }

  return getProject(input.actor, input.projectId);
}

export async function removeProjectMember(input: {
  actor: AuthUser;
  projectId: string;
  userId: string;
}): Promise<PublicProject> {
  await assertCanMutateProject(input.actor, input.projectId);

  const project = await prisma.project.findUnique({
    where: { id: input.projectId },
  });
  if (!project) {
    throw new AuthNotFoundError("项目不存在");
  }

  if (project.ownerUserId === input.userId) {
    throw new AuthValidationError("不能移除项目负责人");
  }

  const deleted = await prisma.projectMember.deleteMany({
    where: {
      projectId: input.projectId,
      userId: input.userId,
    },
  });
  if (deleted.count === 0) {
    throw new AuthValidationError("成员不存在");
  }

  return getProject(input.actor, input.projectId);
}
