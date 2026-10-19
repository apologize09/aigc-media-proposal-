import { describe, expect, it } from "vitest";

import {
  hashPassword,
  isPasswordStrongEnough,
  verifyPassword,
} from "@/server/auth/password";

describe("口令", () => {
  it("拒绝过短口令", () => {
    expect(isPasswordStrongEnough("short")).toBe(false);
    expect(isPasswordStrongEnough("long-enough")).toBe(true);
  });

  it("哈希后可校验，明文不同则失败", async () => {
    const hashed = await hashPassword("correct-horse");
    expect(hashed).not.toContain("correct-horse");
    expect(await verifyPassword(hashed, "correct-horse")).toBe(true);
    expect(await verifyPassword(hashed, "wrong-password")).toBe(false);
  });
});
