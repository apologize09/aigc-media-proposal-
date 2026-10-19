import { AuthValidationError } from "@/server/auth/http";

const BLOCKED_HOSTS = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata",
]);

export function assertSafeHttpUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new AuthValidationError("链接无效");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new AuthValidationError("只允许 http 或 https");
  }

  const host = url.hostname.toLowerCase();
  if (
    BLOCKED_HOSTS.has(host) ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) {
    throw new AuthValidationError("不允许访问内网地址");
  }

  if (
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host) ||
    host === "::1" ||
    host === "0.0.0.0" ||
    host.startsWith("169.254.")
  ) {
    throw new AuthValidationError("不允许访问内网地址");
  }

  return url;
}
