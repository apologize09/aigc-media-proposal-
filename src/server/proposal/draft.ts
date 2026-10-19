import type { GenerateDraftResult } from "@/server/ai/adapter";
import { prisma } from "@/server/db";

export function blocksToGrapesProject(result: GenerateDraftResult) {
  const components = result.blocks.map((block) => ({
    type: "text",
    tagName: "section",
    attributes: {
      "data-block-type": block.type,
      "data-asset-ids": block.assetIds.join(","),
      "data-quote-line-ids": block.type === "quote" ? "" : undefined,
    },
    components: [
      {
        type: "text",
        tagName: "h2",
        content: block.title,
      },
      {
        type: "text",
        tagName: "p",
        content: block.body || (block.type === "quote" ? "尚未填写对客报价" : ""),
      },
      ...block.searchRefs.map((ref) => ({
        type: "text",
        tagName: "p",
        content: `<a href="${ref.url}">${ref.title}</a>${ref.snippet ? ` — ${ref.snippet}` : ""}`,
      })),
    ],
  }));

  return {
    pages: [
      {
        frames: [
          {
            component: {
              type: "wrapper",
              components,
            },
          },
        ],
      },
    ],
    styles: [],
  };
}

export async function ensureDraftFromBlocks(input: {
  projectId: string;
  actorId: string;
  result: GenerateDraftResult;
  replace: boolean;
}) {
  const projectJson = blocksToGrapesProject(input.result);
  if (input.replace) {
    return prisma.proposalDraft.upsert({
      where: { projectId: input.projectId },
      create: {
        projectId: input.projectId,
        projectJson,
        updatedById: input.actorId,
      },
      update: {
        projectJson,
        updatedById: input.actorId,
      },
    });
  }
  return prisma.proposalDraft.create({
    data: {
      projectId: input.projectId,
      projectJson,
      updatedById: input.actorId,
    },
  });
}

export async function saveDraftJson(input: {
  projectId: string;
  actorId: string;
  projectJson: unknown;
  expectedUpdatedAt?: string;
}) {
  const existing = await prisma.proposalDraft.findUnique({
    where: { projectId: input.projectId },
  });
  if (!existing) {
    return prisma.proposalDraft.create({
      data: {
        projectId: input.projectId,
        projectJson: input.projectJson as object,
        updatedById: input.actorId,
      },
    });
  }
  if (
    input.expectedUpdatedAt &&
    existing.updatedAt.toISOString() !== input.expectedUpdatedAt
  ) {
    const { AuthConflictError } = await import("@/server/auth/http");
    throw new AuthConflictError("草稿已被他人更新，请刷新后重试");
  }
  return prisma.proposalDraft.update({
    where: { projectId: input.projectId },
    data: {
      projectJson: input.projectJson as object,
      updatedById: input.actorId,
    },
  });
}
