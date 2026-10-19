import { describe, expect, it } from "vitest";

import {
  computeSessionExpiry,
  isLoginLocked,
  isSessionExpired,
  sessionCookieMaxAgeSeconds,
} from "@/server/auth/session-policy";

describe("会话策略", () => {
  it("未配置时长时不过期、不写 Max-Age", () => {
    const now = new Date("2026-10-16T00:00:00.000Z");
    expect(
      computeSessionExpiry(now, { ttlHours: null, lockoutThreshold: null }),
    ).toBeNull();
    expect(
      sessionCookieMaxAgeSeconds({ ttlHours: null, lockoutThreshold: null }),
    ).toBeNull();
    expect(isSessionExpired(null, now)).toBe(false);
  });

  it("配置时长后按小时计算过期", () => {
    const now = new Date("2026-10-16T00:00:00.000Z");
    const expires = computeSessionExpiry(now, {
      ttlHours: 2,
      lockoutThreshold: null,
    });
    expect(expires?.toISOString()).toBe("2026-10-16T02:00:00.000Z");
    expect(
      sessionCookieMaxAgeSeconds({ ttlHours: 2, lockoutThreshold: null }),
    ).toBe(7200);
    expect(
      isSessionExpired(expires!, new Date("2026-10-16T03:00:00.000Z")),
    ).toBe(true);
  });

  it("未配置锁定次数时不锁定", () => {
    expect(
      isLoginLocked({ failedLoginCount: 100, lockoutThreshold: null }),
    ).toBe(false);
  });

  it("达到配置的锁定次数后锁定", () => {
    expect(isLoginLocked({ failedLoginCount: 2, lockoutThreshold: 3 })).toBe(
      false,
    );
    expect(isLoginLocked({ failedLoginCount: 3, lockoutThreshold: 3 })).toBe(
      true,
    );
  });
});
