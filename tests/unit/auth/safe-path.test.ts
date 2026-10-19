import { describe, expect, it } from "vitest";

import { safeInternalPath } from "@/lib/safe-path";

describe("safeInternalPath", () => {
  it("只接受站内相对路径", () => {
    expect(safeInternalPath("/users")).toBe("/users");
    expect(safeInternalPath("/projects/1?tab=cost")).toBe(
      "/projects/1?tab=cost",
    );
  });

  it("拒绝外链与协议相对地址", () => {
    expect(safeInternalPath("//evil.example")).toBe("/");
    expect(safeInternalPath("https://evil.example")).toBe("/");
    expect(safeInternalPath("http://evil.example")).toBe("/");
    expect(safeInternalPath("users")).toBe("/");
    expect(safeInternalPath("/\\evil")).toBe("/");
    expect(safeInternalPath(null)).toBe("/");
  });
});
