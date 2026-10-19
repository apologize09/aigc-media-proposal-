import { CUSTOMER_FORBIDDEN_MARKERS } from "@/proposal/templates/blocks";
import { getVisibleQuoteProjection } from "@/server/pricing/service";
import { sanitizeProposalHtml } from "@/server/proposal/sanitize";
import { prisma } from "@/server/db";

type GrapesNode = {
  type?: string;
  tagName?: string;
  content?: string;
  attributes?: Record<string, string | undefined>;
  components?: GrapesNode[];
  style?: Record<string, string>;
};

function escapeText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function walkNode(node: GrapesNode): string {
  if (typeof node.content === "string" && (!node.components || node.components.length === 0)) {
    const tag = node.tagName || "div";
    if (tag === "a" && node.attributes?.href) {
      return `<a href="${escapeText(node.attributes.href)}">${node.content}</a>`;
    }
    // content 可能已含简单标签，最终仍会 sanitize。
    return `<${tag}>${node.content}</${tag}>`;
  }

  const children = (node.components ?? []).map(walkNode).join("");
  const tag = node.tagName || (node.type === "wrapper" ? "div" : "div");
  const blockType = node.attributes?.["data-block-type"];
  const attrs = blockType ? ` data-block-type="${escapeText(blockType)}"` : "";

  if (blockType === "quote") {
    return `<section${attrs} class="proposal-quote">${children}</section>`;
  }
  return `<${tag}${attrs}>${children}</${tag}>`;
}

export function grapesProjectToHtml(projectJson: unknown): string {
  const root = projectJson as {
    pages?: Array<{ frames?: Array<{ component?: GrapesNode }> }>;
  };
  const component = root?.pages?.[0]?.frames?.[0]?.component;
  if (!component) {
    return "<main></main>";
  }
  return `<main class="proposal">${walkNode(component)}</main>`;
}

export async function renderProposalHtml(input: {
  projectId: string;
  projectJson: unknown;
  projectTitle?: string;
}): Promise<{ html: string; css: string; quoteSnapshot: unknown }> {
  const quote = await getVisibleQuoteProjection(input.projectId);
  let html = grapesProjectToHtml(input.projectJson);

  const quoteHtml = quote.empty
    ? `<p>${escapeText(quote.message)}</p>`
    : `<ul>${quote.lines
        .map(
          (line) =>
            `<li><strong>${escapeText(line.label)}</strong>：${escapeText(line.lineAmount)}${line.unit ? ` / ${escapeText(line.unit)}` : ""}</li>`,
        )
        .join("")}</ul>`;

  if (html.includes('data-block-type="quote"')) {
    html = html.replace(
      /<section[^>]*data-block-type="quote"[^>]*>[\s\S]*?<\/section>/,
      `<section data-block-type="quote" class="proposal-quote"><h2>报价</h2>${quoteHtml}</section>`,
    );
  } else {
    html += `<section data-block-type="quote" class="proposal-quote"><h2>报价</h2>${quoteHtml}</section>`;
  }

  // 素材 ID 仅保留在草稿 traits；导出时用已转存副本的公开内容路径占位说明。
  const assets = await prisma.asset.findMany({
    where: { projectId: input.projectId },
    select: { id: true, storageKey: true, filename: true, sourceUrl: true },
  });
  for (const asset of assets) {
    if (!asset.storageKey) {
      continue;
    }
    const marker = `data-asset-id="${asset.id}"`;
    if (html.includes(marker) || html.includes(asset.id)) {
      html = html.replaceAll(
        asset.id,
        `/api/assets/${asset.id}/content`,
      );
    }
  }

  for (const marker of CUSTOMER_FORBIDDEN_MARKERS) {
    if (html.includes(marker)) {
      html = html.replaceAll(marker, "");
    }
  }

  const css = `
.proposal { font-family: Georgia, "Noto Serif SC", serif; color: #1a1a1a; line-height: 1.6; max-width: 48rem; margin: 0 auto; padding: 2rem 1.25rem; }
.proposal h1, .proposal h2, .proposal h3 { font-weight: 600; margin: 1.5rem 0 0.75rem; }
.proposal section { margin-bottom: 2rem; }
.proposal-quote ul { padding-left: 1.25rem; }
@media print { .proposal { max-width: none; } }
`.trim();

  const title = input.projectTitle
    ? `<title>${escapeText(input.projectTitle)}</title>`
    : "<title>提案</title>";
  const safeBody = sanitizeProposalHtml(html);
  const document = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"/>${title}<style>${css}</style></head><body>${safeBody}</body></html>`;
  return {
    html: document,
    css,
    quoteSnapshot: quote,
  };
}
