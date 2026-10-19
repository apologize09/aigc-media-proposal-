import type { AuthRole, AuthUser } from "@/server/auth/types";

export function hasRole(
  user: Pick<AuthUser, "roles">,
  role: AuthRole,
): boolean {
  return user.roles.includes(role);
}

export function isAdmin(user: Pick<AuthUser, "roles">): boolean {
  return hasRole(user, "admin");
}

export function canAccessFinance(
  user: Pick<AuthUser, "financeAccess">,
): boolean {
  return user.financeAccess === true;
}

/**
 * 项目隔离：管理员可见全部；其他人仅当是项目成员。
 * 成员关系由调用方查询后传入，本模块不拥有项目表。
 */
export function canAccessProject(
  user: Pick<AuthUser, "roles">,
  isProjectMember: boolean,
): boolean {
  return isAdmin(user) || isProjectMember;
}

export function canManageUsers(user: Pick<AuthUser, "roles">): boolean {
  return isAdmin(user);
}

/** 建客户、建项目、改需求：管理员或方案编辑。 */
export function canEditProjects(user: Pick<AuthUser, "roles">): boolean {
  return isAdmin(user) || hasRole(user, "editor");
}

/** 改已有项目内容：管理员，或身为成员的方案编辑。 */
export function canMutateProject(
  user: Pick<AuthUser, "roles">,
  isProjectMember: boolean,
): boolean {
  if (isAdmin(user)) {
    return true;
  }
  return hasRole(user, "editor") && isProjectMember;
}

export function assertActive(user: Pick<AuthUser, "status">): void {
  if (user.status !== "active") {
    throw new AuthDeniedError("账号已停用");
  }
}

export class AuthDeniedError extends Error {
  readonly status = 403;

  constructor(message: string) {
    super(message);
    this.name = "AuthDeniedError";
  }
}

export class AuthUnauthorizedError extends Error {
  readonly status = 401;

  constructor(message = "未登录") {
    super(message);
    this.name = "AuthUnauthorizedError";
  }
}
