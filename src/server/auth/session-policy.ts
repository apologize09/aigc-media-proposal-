import type { SessionPolicy } from "@/server/config";

export function computeSessionExpiry(
  now: Date,
  policy: SessionPolicy,
): Date | null {
  if (policy.ttlHours === null) {
    return null;
  }

  return new Date(now.getTime() + policy.ttlHours * 60 * 60 * 1000);
}

export function isSessionExpired(
  expiresAt: Date | null,
  now: Date = new Date(),
): boolean {
  if (expiresAt === null) {
    return false;
  }

  return expiresAt.getTime() <= now.getTime();
}

export function sessionCookieMaxAgeSeconds(
  policy: SessionPolicy,
): number | null {
  if (policy.ttlHours === null) {
    return null;
  }

  return policy.ttlHours * 60 * 60;
}

export function isLoginLocked(options: {
  failedLoginCount: number;
  lockoutThreshold: number | null;
}): boolean {
  if (options.lockoutThreshold === null) {
    return false;
  }

  return options.failedLoginCount >= options.lockoutThreshold;
}
