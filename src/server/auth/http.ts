import {
  AuthDeniedError,
  AuthUnauthorizedError,
} from "@/server/auth/permissions";

export function jsonError(
  status: number,
  message: string,
  extra?: Record<string, unknown>,
): Response {
  return Response.json({ error: message, ...extra }, { status });
}

export function toErrorResponse(error: unknown): Response {
  if (error instanceof AuthUnauthorizedError) {
    return jsonError(401, error.message);
  }
  if (error instanceof AuthDeniedError) {
    return jsonError(403, error.message);
  }
  if (error instanceof AuthValidationError) {
    return jsonError(400, error.message);
  }
  if (error instanceof AuthNotFoundError) {
    return jsonError(404, error.message);
  }
  if (error instanceof AuthConflictError) {
    return jsonError(409, error.message);
  }
  if (error instanceof AuthConfigError) {
    return jsonError(503, error.message);
  }

  console.error("unhandled_api_error");
  return jsonError(500, "服务器错误");
}

export class AuthValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthValidationError";
  }
}

export class AuthNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthNotFoundError";
  }
}

export class AuthConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthConflictError";
  }
}

export class AuthConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthConfigError";
  }
}

export const LOGIN_FAILED_MESSAGE = "邮箱或口令不正确";
