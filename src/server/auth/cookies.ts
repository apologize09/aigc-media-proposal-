import { SESSION_COOKIE_NAME } from "@/server/auth/constants";

export function buildSessionCookie(
  token: string,
  options: { secure: boolean; maxAgeSeconds: number | null },
): string {
  const parts = [
    `${SESSION_COOKIE_NAME}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
  ];

  if (options.secure) {
    parts.push("Secure");
  }

  if (options.maxAgeSeconds !== null) {
    parts.push(`Max-Age=${options.maxAgeSeconds}`);
  }

  return parts.join("; ");
}

export function buildClearSessionCookie(secure: boolean): string {
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
  ];
  if (secure) {
    parts.push("Secure");
  }
  return parts.join("; ");
}

export function readSessionTokenFromCookieHeader(
  cookieHeader: string | null,
): string | null {
  if (!cookieHeader) {
    return null;
  }

  for (const part of cookieHeader.split(";")) {
    const [rawName, ...rest] = part.trim().split("=");
    if (rawName === SESSION_COOKIE_NAME) {
      const value = rest.join("=").trim();
      return value.length > 0 ? value : null;
    }
  }

  return null;
}

export function shouldUseSecureCookies(
  env: Record<string, string | undefined> = process.env,
): boolean {
  const baseUrl = env.APP_BASE_URL?.trim() ?? "";
  if (baseUrl.startsWith("https://")) {
    return true;
  }
  if (baseUrl.startsWith("http://")) {
    return false;
  }
  return env.NODE_ENV === "production";
}
