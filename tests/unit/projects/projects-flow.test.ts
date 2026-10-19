import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { hashPassword } from "@/server/auth/password";
import { AuthDeniedError } from "@/server/auth/permissions";
import type { AuthUser } from "@/server/auth/types";
import { prisma } from "@/server/db";
import {
  addProjectMember,
  createClient,
  createProject,
  getClient,
  getProject,
  listClients,
  listProjects,
  removeProjectMember,
  updateProject,
} from "@/server/projects/service";

const hasDatabase = Boolean(process.env.DATABASE_URL?.trim());

async function resetTables() {
  await prisma.auditLog.deleteMany();
  await prisma.delivery.deleteMany();
  await prisma.review.deleteMany();
  await prisma.workTask.deleteMany();
  await prisma.quoteLine.deleteMany();
  await prisma.costLine.deleteMany();
  await prisma.costSheet.deleteMany();
  await prisma.proposalDraft.deleteMany();
  await prisma.proposalSnapshot.deleteMany();
  await prisma.searchHit.deleteMany();
  await prisma.searchRun.deleteMany();
  await prisma.analysis.deleteMany();
  await prisma.aiJob.deleteMany();
  await prisma.asset.deleteMany();
  await prisma.projectMember.deleteMany();
  await prisma.project.deleteMany();
  await prisma.client.deleteMany();
  await prisma.session.deleteMany();
  await prisma.userRole.deleteMany();
  await prisma.user.deleteMany();
}

function uniqueEmail(prefix: string): string {
  return `${prefix}.${Date.now()}.${Math.random().toString(16).slice(2)}@example.com`;
}

async function createActor(input: {
  email?: string;
  name: string;
  roles: Array<"admin" | "editor" | "reviewer">;
}): Promise<AuthUser> {
  const email = input.email ?? uniqueEmail(input.name);
  const user = await prisma.user.create({
    data: {
      email,
      name: input.name,
      passwordHash: await hashPassword("password-strong"),
      financeAccess: false,
      roles: {
        create: input.roles.map((role) => ({ role })),
      },
    },
    include: { roles: true },
  });

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    status: user.status,
    financeAccess: user.financeAccess,
    roles: user.roles.map((item) => item.role),
  };
}

describe.skipIf(!hasDatabase)("客户与项目（需要 DATABASE_URL）", () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  beforeEach(async () => {
    await resetTables();
  });

  afterAll(async () => {
    await resetTables();
    await prisma.$disconnect();
  });

  it("非成员看不见他人项目；管理员可见全部", async () => {
    const admin = await createActor({
      name: "管理员",
      roles: ["admin"],
    });
    const editor = await createActor({
      name: "编辑",
      roles: ["editor"],
    });
    const outsider = await createActor({
      name: "局外人",
      roles: ["editor"],
    });

    const client = await createClient({
      actor: admin,
      name: "示例品牌",
    });
    const project = await createProject({
      actor: editor,
      clientId: client.id,
      title: "春季提案",
      brief: "需求正文",
    });

    const visibleToEditor = await listProjects(editor);
    expect(visibleToEditor.map((item) => item.id)).toContain(project.id);

    const visibleToOutsider = await listProjects(outsider);
    expect(visibleToOutsider.map((item) => item.id)).not.toContain(project.id);

    await expect(getProject(outsider, project.id)).rejects.toBeInstanceOf(
      AuthDeniedError,
    );

    const visibleToAdmin = await listProjects(admin);
    expect(visibleToAdmin.map((item) => item.id)).toContain(project.id);
  });

  it("审核人不能创建项目；成员可被添加与移除，负责人不可移除", async () => {
    const admin = await createActor({
      name: "老板",
      roles: ["admin"],
    });
    const reviewer = await createActor({
      name: "审核",
      roles: ["reviewer"],
    });
    const editor = await createActor({
      name: "写手",
      roles: ["editor"],
    });

    const client = await createClient({
      actor: admin,
      name: "客户甲",
    });

    await expect(
      createProject({
        actor: reviewer,
        clientId: client.id,
        title: "不应创建",
      }),
    ).rejects.toBeInstanceOf(AuthDeniedError);

    const project = await createProject({
      actor: editor,
      clientId: client.id,
      title: "可编辑项目",
      brief: "",
    });

    const withReviewer = await addProjectMember({
      actor: editor,
      projectId: project.id,
      email: reviewer.email,
    });
    expect(withReviewer.members.map((item) => item.email)).toContain(
      reviewer.email,
    );

    await expect(
      removeProjectMember({
        actor: editor,
        projectId: project.id,
        userId: editor.id,
      }),
    ).rejects.toThrow("不能移除项目负责人");

    const afterRemove = await removeProjectMember({
      actor: editor,
      projectId: project.id,
      userId: reviewer.id,
    });
    expect(afterRemove.members.map((item) => item.email)).not.toContain(
      reviewer.email,
    );
  });

  it("审核人可见参与项目的客户名，但看不到内部备注", async () => {
    const editor = await createActor({
      name: "备注编辑",
      roles: ["editor"],
    });
    const reviewer = await createActor({
      name: "备注审核",
      roles: ["reviewer"],
    });

    const client = await createClient({
      actor: editor,
      name: "保密客户",
      internalNotes: "仅内部可见的备注",
    });
    expect(client.internalNotes).toBe("仅内部可见的备注");

    const project = await createProject({
      actor: editor,
      clientId: client.id,
      title: "含备注项目",
    });
    await addProjectMember({
      actor: editor,
      projectId: project.id,
      email: reviewer.email,
    });

    const listed = await listClients(reviewer);
    const row = listed.find((item) => item.id === client.id);
    expect(row?.name).toBe("保密客户");
    expect(row?.internalNotes).toBeNull();

    const fetched = await getClient(reviewer, client.id);
    expect(fetched.internalNotes).toBeNull();
  });

  it("归档只写 archivedAt，不删除项目，且默认列表可隐藏归档项", async () => {
    const editor = await createActor({
      name: "归档人",
      roles: ["editor"],
    });
    const client = await createClient({
      actor: editor,
      name: "客户乙",
    });
    const project = await createProject({
      actor: editor,
      clientId: client.id,
      title: "待归档",
    });

    const archived = await updateProject({
      actor: editor,
      projectId: project.id,
      archived: true,
    });
    expect(archived.archivedAt).not.toBeNull();

    const activeOnly = await listProjects(editor);
    expect(activeOnly.map((item) => item.id)).not.toContain(project.id);

    const withArchived = await listProjects(editor, { includeArchived: true });
    expect(withArchived.map((item) => item.id)).toContain(project.id);
  });
});
