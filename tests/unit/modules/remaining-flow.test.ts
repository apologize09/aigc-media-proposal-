import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { setModelAdapterForTests, FixtureAdapter } from "@/server/ai/adapter";
import {
  confirmCurrentAnalysis,
  enqueueAnalysis,
  getCurrentAnalysis,
} from "@/server/analysis/service";
import { writeAudit, listProjectAudit } from "@/server/audit/service";
import { hashPassword } from "@/server/auth/password";
import { AuthDeniedError } from "@/server/auth/permissions";
import type { AuthUser } from "@/server/auth/types";
import { prisma } from "@/server/db";
import {
  getProfit,
  getVisibleQuoteProjection,
  saveCostSheet,
  saveQuoteLines,
} from "@/server/pricing/service";
import {
  getDraft,
  publishProposal,
  previewProposal,
} from "@/server/proposal/publish";
import { createProject, createClient } from "@/server/projects/service";
import {
  createDelivery,
  readPublicDelivery,
  reviewSnapshot,
  revokeDelivery,
  submitSnapshot,
} from "@/server/review/service";
import { createTask, listTasks, updateTask } from "@/server/tasks/service";
import { createAndRunJob } from "@/server/ai/jobs";

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
  name: string;
  roles: Array<"admin" | "editor" | "reviewer">;
  financeAccess?: boolean;
}): Promise<AuthUser> {
  const user = await prisma.user.create({
    data: {
      email: uniqueEmail(input.name),
      name: input.name,
      passwordHash: await hashPassword("password-strong"),
      financeAccess: Boolean(input.financeAccess),
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

describe.skipIf(!hasDatabase)("剩余模块主路径（需要 DATABASE_URL）", () => {
  beforeAll(async () => {
    await prisma.$connect();
    setModelAdapterForTests(new FixtureAdapter());
    process.env.AI_USE_FIXTURE = "1";
  });

  beforeEach(async () => {
    await resetTables();
    setModelAdapterForTests(new FixtureAdapter());
  });

  afterAll(async () => {
    setModelAdapterForTests(null);
    await resetTables();
    await prisma.$disconnect();
  });

  it("分析→确认→生成草稿→报价→发布→审核→交付→公开页；利润未配置；审计可查", async () => {
    const admin = await createActor({
      name: "管理员",
      roles: ["admin"],
      financeAccess: true,
    });
    const editor = await createActor({
      name: "编辑",
      roles: ["editor"],
      financeAccess: true,
    });
    const outsider = await createActor({
      name: "外人",
      roles: ["editor"],
      financeAccess: true,
    });

    const client = await createClient({ actor: admin, name: "品牌甲" });
    const project = await createProject({
      actor: editor,
      clientId: client.id,
      title: "秋季提案",
      brief: "需要一支品牌短片提案",
    });

    const analyzeJob = await enqueueAnalysis(editor, project.id);
    expect(analyzeJob.status).toBe("succeeded");

    let analysis = await getCurrentAnalysis(editor, project.id);
    expect(analysis?.payload.summary).toContain("品牌短片");
    expect(analysis?.confirmedAt).toBeNull();

    analysis = await confirmCurrentAnalysis(editor, project.id);
    expect(analysis.confirmedAt).not.toBeNull();

    const draftJob = await createAndRunJob({
      actor: editor,
      projectId: project.id,
      type: "draft_proposal",
      payload: { mode: "create" },
    });
    expect(draftJob.status).toBe("succeeded");

    const draft = await getDraft(editor, project.id);
    expect(draft?.projectJson).toBeTruthy();

    await saveCostSheet({
      actor: editor,
      projectId: project.id,
      lines: [
        {
          label: "拍摄",
          quantity: 1,
          unitAmount: 1000,
          note: "内部成本备注不应进客户页",
        },
      ],
    });
    await saveQuoteLines({
      actor: editor,
      projectId: project.id,
      lines: [
        {
          label: "提案制作",
          quantity: 1,
          unitAmount: 5000,
          visibleInProposal: true,
        },
      ],
    });

    const profit = await getProfit(editor, project.id);
    expect(profit.status).toBe("未配置");

    await expect(getProfit(outsider, project.id)).rejects.toBeInstanceOf(
      AuthDeniedError,
    );

    const preview = await previewProposal(editor, project.id);
    expect(preview.html).toContain("提案制作");
    expect(preview.html).toContain("5000");
    expect(preview.html).not.toContain("内部成本备注");
    expect(preview.html).not.toContain("<script");

    const snapshot = await publishProposal(editor, project.id);
    expect(snapshot.versionNo).toBe(1);

    await submitSnapshot(editor, snapshot.id);
    await reviewSnapshot({
      actor: admin,
      snapshotId: snapshot.id,
      decision: "approved",
    });

    const delivery = await createDelivery(editor, snapshot.id);
    expect(delivery.token.length).toBeGreaterThan(16);

    const publicPage = await readPublicDelivery(delivery.token);
    expect(publicPage?.html).toContain("提案制作");
    expect(publicPage?.html).not.toContain("内部成本备注");
    expect(publicPage?.html).not.toContain("任务清单");

    const bad = await readPublicDelivery("not-a-real-token-value-xxxxx");
    expect(bad).toBeNull();

    await revokeDelivery(editor, delivery.id);
    const revoked = await readPublicDelivery(delivery.token);
    expect(revoked).toBeNull();

    const task = await createTask({
      actor: editor,
      projectId: project.id,
      title: "准备分镜",
      snapshotId: snapshot.id,
    });
    expect(task.status).toBe("draft");
    const confirmed = await updateTask({
      actor: editor,
      taskId: task.id,
      status: "confirmed",
    });
    expect(confirmed.status).toBe("confirmed");
    const tasks = await listTasks(editor, project.id);
    expect(tasks).toHaveLength(1);

    await writeAudit({
      actorUserId: admin.id,
      action: "test.marker",
      entityType: "project",
      entityId: project.id,
      projectId: project.id,
    });
    const logs = await listProjectAudit(project.id);
    expect(logs.some((item) => item.action === "proposal.published")).toBe(
      true,
    );
    expect(logs.some((item) => item.action === "review.approved")).toBe(true);

    const quote = await getVisibleQuoteProjection(project.id);
    expect(quote.empty).toBe(false);
  });

  it("无财务权限不能读写成本报价；未确认分析不能生成草稿", async () => {
    const editor = await createActor({
      name: "无财务编辑",
      roles: ["editor"],
      financeAccess: false,
    });
    const client = await createClient({ actor: editor, name: "客户乙" });
    const project = await createProject({
      actor: editor,
      clientId: client.id,
      title: "无财务项目",
      brief: "简要需求",
    });

    await expect(
      saveQuoteLines({
        actor: editor,
        projectId: project.id,
        lines: [{ label: "A", quantity: 1, lineAmount: 100 }],
      }),
    ).rejects.toBeInstanceOf(AuthDeniedError);

    await enqueueAnalysis(editor, project.id);
    const job = await createAndRunJob({
      actor: editor,
      projectId: project.id,
      type: "draft_proposal",
    });
    expect(job.status).toBe("failed");
    expect(job.error).toContain("已确认");
  });

  it("上传限制未配置时拒绝上传", async () => {
    const { uploadAsset } = await import("@/server/assets/service");
    const editor = await createActor({
      name: "上传编辑",
      roles: ["editor"],
    });
    const client = await createClient({ actor: editor, name: "客户丙" });
    const project = await createProject({
      actor: editor,
      clientId: client.id,
      title: "上传项目",
    });

    const prevMax = process.env.UPLOAD_MAX_BYTES;
    const prevMime = process.env.UPLOAD_ALLOWED_MIME;
    delete process.env.UPLOAD_MAX_BYTES;
    delete process.env.UPLOAD_ALLOWED_MIME;

    await expect(
      uploadAsset({
        actor: editor,
        projectId: project.id,
        filename: "a.png",
        mime: "image/png",
        bytes: Buffer.from("x"),
      }),
    ).rejects.toThrow(/上传限制未配置/);

    process.env.UPLOAD_MAX_BYTES = prevMax;
    process.env.UPLOAD_ALLOWED_MIME = prevMime;
  });
});
