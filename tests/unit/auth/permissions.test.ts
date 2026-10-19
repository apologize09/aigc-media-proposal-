import { describe, expect, it } from "vitest";

import {
  canAccessFinance,
  canAccessProject,
  canEditProjects,
  canManageUsers,
  canMutateProject,
  isAdmin,
} from "@/server/auth/permissions";

const editor = {
  roles: ["editor" as const],
  financeAccess: false,
};

const admin = {
  roles: ["admin" as const],
  financeAccess: false,
};

const financeEditor = {
  roles: ["editor" as const],
  financeAccess: true,
};

const reviewer = {
  roles: ["reviewer" as const],
  financeAccess: false,
};

describe("权限检查", () => {
  it("只有管理员能管理账号", () => {
    expect(canManageUsers(admin)).toBe(true);
    expect(canManageUsers(editor)).toBe(false);
    expect(isAdmin(admin)).toBe(true);
  });

  it("财务可见是独立开关", () => {
    expect(canAccessFinance(editor)).toBe(false);
    expect(canAccessFinance(admin)).toBe(false);
    expect(canAccessFinance(financeEditor)).toBe(true);
  });

  it("非管理员只能访问自己参与的项目", () => {
    expect(canAccessProject(admin, false)).toBe(true);
    expect(canAccessProject(editor, true)).toBe(true);
    expect(canAccessProject(editor, false)).toBe(false);
  });

  it("方案编辑可建项目；审核人不能改非成员项目", () => {
    expect(canEditProjects(admin)).toBe(true);
    expect(canEditProjects(editor)).toBe(true);
    expect(canEditProjects(reviewer)).toBe(false);
    expect(canMutateProject(editor, true)).toBe(true);
    expect(canMutateProject(editor, false)).toBe(false);
    expect(canMutateProject(reviewer, true)).toBe(false);
  });
});
