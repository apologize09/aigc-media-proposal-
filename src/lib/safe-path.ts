/**
 * 仅允许站内相对路径，拒绝协议相对地址和带 scheme 的外链。
 */
export function safeInternalPath(
  candidate: string | null | undefined,
  fallback = "/",
): string {
  if (!candidate) {
    return fallback;
  }

  const value = candidate.trim();
  if (!value.startsWith("/")) {
    return fallback;
  }
  if (value.startsWith("//") || value.includes("://")) {
    return fallback;
  }
  if (value.includes("\\")) {
    return fallback;
  }

  return value;
}
