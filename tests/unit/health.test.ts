import { describe, expect, it } from "vitest";

import { createHealthReport } from "@/server/health";

describe("健康检查", () => {
  it("只返回进程状态", () => {
    expect(createHealthReport()).toEqual({ status: "ok" });
    expect(JSON.stringify(createHealthReport())).not.toMatch(
      /key|secret|token/i,
    );
  });
});
