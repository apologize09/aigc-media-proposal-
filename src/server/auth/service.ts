import type { Prisma, RoleName, User, UserRole } from "@prisma/client";

import {
  buildClearSessionCookie,
  buildSessionCookie,
  readSessionTokenFromCookieHeader,
  shouldUseSecureCookies,
} from "@/server/auth/cookies";
import {
  AuthConfigError,
  AuthConflictError,
  AuthValidationError,
  LOGIN_FAILED_MESSAGE,
} from "@/server/auth/http";
import {
  AuthDeniedError,
  AuthUnauthorizedError,
  canManageUsers,
  isAdmin,
} from "@/server/auth/permissions";
import {
  hashPassword,
  isPasswordStrongEnough,
  verifyPassword,
} from "@/server/auth/password";
import {
  computeSessionExpiry,
  isLoginLocked,
  isSessionExpired,
  sessionCookieMaxAgeSeconds,
} from "@/server/auth/session-policy";
import { createSessionToken, hashSessionToken } from "@/server/auth/token";
import type { AuthUser, PublicUser } from "@/server/auth/types";
import { readSessionPolicy } from "@/server/config";
import { prisma } from "@/server/db";

type UserWithRoles = User & { roles: UserRole[] };

function requireAuthSecret(
  env: Record<string, string | undefined> = process.env,
): string {
  const secret = env.AUTH_SECRET?.trim() ?? "";
  if (secret.length < 16) {
    throw new AuthConfigError("认证未配置");
  }
  return secret;
}

function toAuthUser(user: UserWithRoles): AuthUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    status: user.status,
    financeAccess: user.financeAccess,
    roles: user.roles.map((item) => item.role),
  };
}

function toPublicUser(user: UserWithRoles): PublicUser {
  return {
    ...toAuthUser(user),
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function parseRoles(roles: unknown): RoleName[] {
  if (!Array.isArray(roles) || roles.length === 0) {
    throw new AuthValidationError("至少指定一种职责");
  }

  const allowed = new Set<RoleName>(["admin", "editor", "reviewer"]);
  const unique = [...new Set(roles)];
  for (const role of unique) {
    if (typeof role !== "string" || !allowed.has(role as RoleName)) {
      throw new AuthValidationError("职责无效");
    }
  }

  return unique as RoleName[];
}

export async function loginWithPassword(input: {
  email: string;
  password: string;
  cookieHeader: string | null;
  env?: Record<string, string | undefined>;
}): Promise<{ user: PublicUser; setCookie: string }> {
  requireAuthSecret(input.env);
  const email = normalizeEmail(input.email);
  const password = input.password;

  if (!email || !password) {
    throw new AuthValidationError("请填写邮箱和口令");
  }

  const policy = readSessionPolicy(input.env);
  const user = await prisma.user.findUnique({
    where: { email },
    include: { roles: true },
  });

  // 统一失败文案，避免探测邮箱是否存在。
  if (!user || user.status !== "active") {
    throw new AuthUnauthorizedError(LOGIN_FAILED_MESSAGE);
  }

  if (
    isLoginLocked({
      failedLoginCount: user.failedLoginCount,
      lockoutThreshold: policy.lockoutThreshold,
    })
  ) {
    throw new AuthUnauthorizedError(LOGIN_FAILED_MESSAGE);
  }

  const passwordOk = await verifyPassword(user.passwordHash, password);
  if (!passwordOk) {
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: { increment: 1 } },
    });
    throw new AuthUnauthorizedError(LOGIN_FAILED_MESSAGE);
  }

  const now = new Date();
  const token = createSessionToken();
  const tokenHash = hashSessionToken(token);
  const expiresAt = computeSessionExpiry(now, policy);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0 },
    }),
    prisma.session.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    }),
  ]);

  const setCookie = buildSessionCookie(token, {
    secure: shouldUseSecureCookies(input.env),
    maxAgeSeconds: sessionCookieMaxAgeSeconds(policy),
  });

  return { user: toPublicUser(user), setCookie };
}

export async function logoutCurrentSession(input: {
  cookieHeader: string | null;
  env?: Record<string, string | undefined>;
}): Promise<{ setCookie: string }> {
  const token = readSessionTokenFromCookieHeader(input.cookieHeader);
  if (token) {
    await prisma.session.deleteMany({
      where: { tokenHash: hashSessionToken(token) },
    });
  }

  return {
    setCookie: buildClearSessionCookie(shouldUseSecureCookies(input.env)),
  };
}

export async function resolveAuthUserFromCookie(input: {
  cookieHeader: string | null;
  env?: Record<string, string | undefined>;
}): Promise<AuthUser | null> {
  const token = readSessionTokenFromCookieHeader(input.cookieHeader);
  if (!token) {
    return null;
  }

  try {
    requireAuthSecret(input.env);
  } catch {
    return null;
  }

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    include: {
      user: { include: { roles: true } },
    },
  });

  if (!session) {
    return null;
  }

  if (isSessionExpired(session.expiresAt)) {
    await prisma.session.delete({ where: { id: session.id } });
    return null;
  }

  if (session.user.status !== "active") {
    await prisma.session.deleteMany({ where: { userId: session.userId } });
    return null;
  }

  return toAuthUser(session.user);
}

export async function requireAuthUser(
  cookieHeader: string | null,
): Promise<AuthUser> {
  const user = await resolveAuthUserFromCookie({ cookieHeader });
  if (!user) {
    throw new AuthUnauthorizedError();
  }
  return user;
}

export async function requireAdminUser(
  cookieHeader: string | null,
): Promise<AuthUser> {
  const user = await requireAuthUser(cookieHeader);
  if (!canManageUsers(user)) {
    throw new AuthDeniedError("需要管理员权限");
  }
  return user;
}

export async function listUsers(actor: AuthUser): Promise<PublicUser[]> {
  if (!canManageUsers(actor)) {
    throw new AuthDeniedError("需要管理员权限");
  }

  const users = await prisma.user.findMany({
    include: { roles: true },
    orderBy: { createdAt: "asc" },
  });

  return users.map(toPublicUser);
}

export async function createUser(input: {
  actor: AuthUser;
  email: string;
  name: string;
  password: string;
  roles: unknown;
  financeAccess: boolean;
}): Promise<PublicUser> {
  if (!canManageUsers(input.actor)) {
    throw new AuthDeniedError("需要管理员权限");
  }

  const email = normalizeEmail(input.email);
  const name = input.name.trim();
  const roles = parseRoles(input.roles);

  if (!email || !email.includes("@")) {
    throw new AuthValidationError("邮箱无效");
  }
  if (!name) {
    throw new AuthValidationError("请填写显示名");
  }
  if (!isPasswordStrongEnough(input.password)) {
    throw new AuthValidationError("口令至少 10 个字符");
  }

  const passwordHash = await hashPassword(input.password);

  try {
    const user = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
        financeAccess: input.financeAccess === true,
        roles: {
          create: roles.map((role) => ({ role })),
        },
      },
      include: { roles: true },
    });
    return toPublicUser(user);
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as Prisma.PrismaClientKnownRequestError).code === "P2002"
    ) {
      throw new AuthConflictError("邮箱已存在");
    }
    throw error;
  }
}

export async function updateUser(input: {
  actor: AuthUser;
  userId: string;
  name?: string;
  roles?: unknown;
  financeAccess?: boolean;
  status?: "active" | "disabled";
  password?: string;
}): Promise<PublicUser> {
  if (!canManageUsers(input.actor)) {
    throw new AuthDeniedError("需要管理员权限");
  }

  const existing = await prisma.user.findUnique({
    where: { id: input.userId },
    include: { roles: true },
  });
  if (!existing) {
    throw new AuthValidationError("用户不存在");
  }

  const data: Prisma.UserUpdateInput = {};

  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) {
      throw new AuthValidationError("请填写显示名");
    }
    data.name = name;
  }

  if (input.financeAccess !== undefined) {
    data.financeAccess = input.financeAccess === true;
  }

  if (input.status !== undefined) {
    if (input.status !== "active" && input.status !== "disabled") {
      throw new AuthValidationError("状态无效");
    }
    if (input.status === "disabled" && input.userId === input.actor.id) {
      throw new AuthValidationError("不能停用当前登录账号");
    }
    data.status = input.status;
    if (input.status === "active") {
      data.failedLoginCount = 0;
    }
  }

  if (input.password !== undefined) {
    if (!isPasswordStrongEnough(input.password)) {
      throw new AuthValidationError("口令至少 10 个字符");
    }
    data.passwordHash = await hashPassword(input.password);
  }

  const nextRoles =
    input.roles !== undefined ? parseRoles(input.roles) : undefined;

  if (
    nextRoles !== undefined &&
    existing.roles.some((item) => item.role === "admin") &&
    !nextRoles.includes("admin")
  ) {
    const otherAdmins = await prisma.userRole.count({
      where: {
        role: "admin",
        userId: { not: existing.id },
        user: { status: "active" },
      },
    });
    if (otherAdmins === 0) {
      throw new AuthValidationError("至少保留一名管理员");
    }
  }

  const user = await prisma.$transaction(async (tx) => {
    if (nextRoles) {
      await tx.userRole.deleteMany({ where: { userId: existing.id } });
      await tx.userRole.createMany({
        data: nextRoles.map((role) => ({ userId: existing.id, role })),
      });
    }

    const updated = await tx.user.update({
      where: { id: existing.id },
      data,
      include: { roles: true },
    });

    if (input.status === "disabled") {
      await tx.session.deleteMany({ where: { userId: existing.id } });
    }

    return updated;
  });

  return toPublicUser(user);
}

export function requireFinanceAccess(user: AuthUser): void {
  if (!user.financeAccess) {
    throw new AuthDeniedError("无财务可见权限");
  }
}

export { isAdmin, canManageUsers };
