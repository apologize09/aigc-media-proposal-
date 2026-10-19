import { describe, expect, it } from "vitest";

import { sanitizeProposalHtml } from "@/server/proposal/sanitize";
import { grapesProjectToHtml } from "@/server/proposal/render";
import { CUSTOMER_FORBIDDEN_MARKERS } from "@/proposal/templates/blocks";

describe("提案 HTML 消毒与渲染", () => {
  it("去掉脚本并保留链接", () => {
    const html = sanitizeProposalHtml(
      `<p>正文</p><script>alert(1)</script><a href="https://example.com">链</a><a href="javascript:alert(1)">坏</a>`,
    );
    expect(html).toContain("正文");
    expect(html).toContain("https://example.com");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("javascript:");
  });

  it("Grapes 工程转 HTML 含模块标记", () => {
    const html = grapesProjectToHtml({
      pages: [
        {
          frames: [
            {
              component: {
                type: "wrapper",
                components: [
                  {
                    tagName: "section",
                    attributes: { "data-block-type": "creative" },
                    components: [
                      { tagName: "h2", content: "创意" },
                      { tagName: "p", content: "方向说明" },
                    ],
                  },
                ],
              },
            },
          ],
        },
      ],
    });
    expect(html).toContain('data-block-type="creative"');
    expect(html).toContain("方向说明");
  });

  it("客户禁止标记列表覆盖成本利润任务", () => {
    expect(CUSTOMER_FORBIDDEN_MARKERS).toEqual(
      expect.arrayContaining(["成本", "利润", "任务清单", "内部备注"]),
    );
  });
});
