import type { AuthRoleName } from "@/server/auth/constants";

export type AuthRole = AuthRoleName;

export type UserStatusValue = "active" | "disabled";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  status: UserStatusValue;
  financeAccess: boolean;
  roles: AuthRole[];
};

export type PublicUser = {
  id: string;
  email: string;
  name: string;
  status: UserStatusValue;
  financeAccess: boolean;
  roles: AuthRole[];
  createdAt: string;
  updatedAt: string;
};

export { SESSION_COOKIE_NAME } from "@/server/auth/constants";
