export const SESSION_COOKIE_NAME = "proposal_session";

export const AUTH_ROLES = ["admin", "editor", "reviewer"] as const;

export type AuthRoleName = (typeof AUTH_ROLES)[number];
