import { describe, expect, it } from "vitest";

import {
  buildClearSessionCookie,
  buildSessionCookie,
  readSessionTokenFromCookieHeader,
  shouldUseSecureCookies,
} from "@/server/auth/cookies";
import { SESSION_COOKIE_NAME } from "@/server/auth/constants";

describe("会话 Cookie", () => {
  it("写入 HttpOnly 与 SameSite，可选 Secure 与 Max-Age", () => {
    const cookie = buildSessionCookie("token-value", {
      secure: true,
      maxAgeSeconds: 3600,
    });
    expect(cookie).toContain(`${SESSION_COOKIE_NAME}=token-value`);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("Max-Age=3600");
  });

  it("未配置时长时不写 Max-Age", () => {
    const cookie = buildSessionCookie("token-value", {
      secure: false,
      maxAgeSeconds: null,
    });
    expect(cookie).not.toContain("Max-Age");
    expect(cookie).not.toContain("Secure");
  });

  it("可从 Cookie 头读出令牌", () => {
    expect(
      readSessionTokenFromCookieHeader(
        `other=1; ${SESSION_COOKIE_NAME}=abc123; x=y`,
      ),
    ).toBe("abc123");
    expect(readSessionTokenFromCookieHeader(null)).toBeNull();
  });

  it("清除 Cookie 时 Max-Age 为 0", () => {
    expect(buildClearSessionCookie(false)).toContain("Max-Age=0");
  });

  it("按 APP_BASE_URL 决定 Secure，避免本机 HTTP 生产构建无法登录", () => {
    expect(
      shouldUseSecureCookies({
        NODE_ENV: "production",
        APP_BASE_URL: "http://127.0.0.1:3000",
      }),
    ).toBe(false);
    expect(
      shouldUseSecureCookies({
        NODE_ENV: "production",
        APP_BASE_URL: "https://proposal.example",
      }),
    ).toBe(true);
    expect(shouldUseSecureCookies({ NODE_ENV: "production" })).toBe(true);
    expect(shouldUseSecureCookies({ NODE_ENV: "development" })).toBe(false);
  });
});
