import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { LOGIN_FAILED_MESSAGE } from "@/server/auth/http";
import {
  createUser,
  listUsers,
  loginWithPassword,
  logoutCurrentSession,
  requireAuthUser,
  requireFinanceAccess,
  resolveAuthUserFromCookie,
  updateUser,
} from "@/server/auth/service";
import { SESSION_COOKIE_NAME } from "@/server/auth/constants";
import {
  AuthDeniedError,
  AuthUnauthorizedError,
} from "@/server/auth/permissions";
import { prisma } from "@/server/db";

const hasDatabase = Boolean(process.env.DATABASE_URL?.trim());
const env = {
  AUTH_SECRET: "test-auth-secret-32chars-minimum",
  AUTH_SESSION_TTL_HOURS: "",
  AUTH_LOCKOUT_THRESHOLD: "3",
  NODE_ENV: "test",
};

async function resetAuthTables() {
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

describe.skipIf(!hasDatabase)("认证流程（需要 DATABASE_URL）", () => {
  beforeAll(async () => {
    process.env.AUTH_SECRET = env.AUTH_SECRET;
    process.env.AUTH_LOCKOUT_THRESHOLD = env.AUTH_LOCKOUT_THRESHOLD;
    process.env.AUTH_SESSION_TTL_HOURS = "";
    await prisma.$connect();
  });

  beforeEach(async () => {
    await resetAuthTables();
  });

  afterAll(async () => {
    await resetAuthTables();
    await prisma.$disconnect();
  });

  it("错误口令不进入系统，成功登录后可读取 me", async () => {
    const admin = await prisma.user.create({
      data: {
        email: "admin@example.com",
        name: "管理员",
        passwordHash: await (
          await import("@/server/auth/password")
        ).hashPassword("admin-password"),
        financeAccess: true,
        roles: { create: [{ role: "admin" }] },
      },
      include: { roles: true },
    });

    await expect(
      loginWithPassword({
        email: "admin@example.com",
        password: "wrong-password",
        cookieHeader: null,
        env,
      }),
    ).rejects.toMatchObject({
      message: LOGIN_FAILED_MESSAGE,
    });

    const login = await loginWithPassword({
      email: "admin@example.com",
      password: "admin-password",
      cookieHeader: null,
      env,
    });

    expect(login.user.id).toBe(admin.id);
    expect(login.setCookie).toContain(SESSION_COOKIE_NAME);
    expect(login.setCookie).toContain("HttpOnly");

    const me = await requireAuthUser(login.setCookie.split(";")[0] ?? null);
    expect(me.email).toBe("admin@example.com");
    expect(me.roles).toContain("admin");
  });

  it("停用后旧会话失效", async () => {
    const { hashPassword } = await import("@/server/auth/password");
    const admin = await prisma.user.create({
      data: {
        email: "boss@example.com",
        name: "老板",
        passwordHash: await hashPassword("boss-password"),
        financeAccess: true,
        roles: { create: [{ role: "admin" }] },
      },
      include: { roles: true },
    });

    const editor = await createUser({
      actor: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        status: "active",
        financeAccess: true,
        roles: ["admin"],
      },
      email: "editor@example.com",
      name: "编辑",
      password: "editor-password",
      roles: ["editor"],
      financeAccess: false,
    });

    const login = await loginWithPassword({
      email: "editor@example.com",
      password: "editor-password",
      cookieHeader: null,
      env,
    });
    const cookiePair = login.setCookie.split(";")[0] ?? "";

    await updateUser({
      actor: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        status: "active",
        financeAccess: true,
        roles: ["admin"],
      },
      userId: editor.id,
      status: "disabled",
    });

    const resolved = await resolveAuthUserFromCookie({
      cookieHeader: cookiePair,
      env,
    });
    expect(resolved).toBeNull();
  });

  it("无财务可见时拒绝财务区访问；非管理员不能列用户", async () => {
    const { hashPassword } = await import("@/server/auth/password");
    const editorRecord = await prisma.user.create({
      data: {
        email: "plain@example.com",
        name: "普通编辑",
        passwordHash: await hashPassword("plain-password"),
        financeAccess: false,
        roles: { create: [{ role: "editor" }] },
      },
      include: { roles: true },
    });

    const actor = {
      id: editorRecord.id,
      email: editorRecord.email,
      name: editorRecord.name,
      status: "active" as const,
      financeAccess: false,
      roles: ["editor" as const],
    };

    expect(() => requireFinanceAccess(actor)).toThrow(AuthDeniedError);
    await expect(listUsers(actor)).rejects.toBeInstanceOf(AuthDeniedError);
  });

  it("达到锁定次数后即使口令正确也拒绝，直到管理员启用清空计数", async () => {
    const { hashPassword } = await import("@/server/auth/password");
    const admin = await prisma.user.create({
      data: {
        email: "lock@example.com",
        name: "锁定测试",
        passwordHash: await hashPassword("lock-password"),
        financeAccess: true,
        roles: { create: [{ role: "admin" }] },
      },
      include: { roles: true },
    });

    for (let i = 0; i < 3; i += 1) {
      await expect(
        loginWithPassword({
          email: "lock@example.com",
          password: "bad",
          cookieHeader: null,
          env,
        }),
      ).rejects.toBeInstanceOf(AuthUnauthorizedError);
    }

    await expect(
      loginWithPassword({
        email: "lock@example.com",
        password: "lock-password",
        cookieHeader: null,
        env,
      }),
    ).rejects.toBeInstanceOf(AuthUnauthorizedError);

    await updateUser({
      actor: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        status: "active",
        financeAccess: true,
        roles: ["admin"],
      },
      userId: admin.id,
      status: "active",
    });

    const login = await loginWithPassword({
      email: "lock@example.com",
      password: "lock-password",
      cookieHeader: null,
      env,
    });
    expect(login.user.email).toBe("lock@example.com");

    await logoutCurrentSession({
      cookieHeader: login.setCookie.split(";")[0] ?? null,
      env,
    });
  });
});
