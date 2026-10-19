import { describe, expect, it } from "vitest";

import { AuthValidationError } from "@/server/auth/http";
import { assertSafeHttpUrl } from "@/server/search/ssrf";

describe("SSRF 防护", () => {
  it("允许公网 https", () => {
    const url = assertSafeHttpUrl("https://example.com/path");
    expect(url.hostname).toBe("example.com");
  });

  it("拒绝 localhost 与内网", () => {
    expect(() => assertSafeHttpUrl("http://127.0.0.1/x")).toThrow(
      AuthValidationError,
    );
    expect(() => assertSafeHttpUrl("http://10.0.0.2/x")).toThrow(
      AuthValidationError,
    );
    expect(() => assertSafeHttpUrl("http://192.168.1.1/x")).toThrow(
      AuthValidationError,
    );
    expect(() => assertSafeHttpUrl("http://localhost/x")).toThrow(
      AuthValidationError,
    );
  });

  it("拒绝非 http(s)", () => {
    expect(() => assertSafeHttpUrl("file:///etc/passwd")).toThrow(
      AuthValidationError,
    );
  });
});
