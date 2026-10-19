import type { Asset } from "@prisma/client";

import { AuthValidationError } from "@/server/auth/http";
import type { GenerateDraftResult } from "@/server/ai/adapter";
import { readUploadPolicy } from "@/server/config";
import { prisma } from "@/server/db";
import { assertSafeHttpUrl } from "@/server/search/ssrf";
import { buildStorageKey, putObject } from "@/server/storage/local";
import { AuthDeniedError } from "@/server/auth/permissions";

export async function recordSearchFromGeneration(input: {
  projectId: string;
  actorId: string;
  result: GenerateDraftResult;
}): Promise<void> {
  for (const query of input.result.searchQueries) {
    const run = await prisma.searchRun.create({
      data: {
        projectId: input.projectId,
        query,
        provider: "volcengine-ark-web_search",
        status: "succeeded",
        createdById: input.actorId,
      },
    });
    const hits = input.result.searchHits.filter((hit) => hit.query === query);
    for (const [index, hit] of hits.entries()) {
      await prisma.searchHit.create({
        data: {
          searchRunId: run.id,
          mediaType: hit.mediaType === "image" || hit.mediaType === "video" ? hit.mediaType : "link",
          title: hit.title,
          url: hit.url,
          snippet: hit.snippet,
          rank: index,
          selection: "selected",
        },
      });
    }
  }
}

export async function listProjectSearches(projectId: string) {
  return prisma.searchRun.findMany({
    where: { projectId },
    include: { hits: { orderBy: { rank: "asc" } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function dismissSearchHit(hitId: string) {
  const hit = await prisma.searchHit.update({
    where: { id: hitId },
    data: { selection: "dismissed" },
  });
  return hit;
}

/** 手工补链：记录为候选命中并允许该 URL 转存。 */
export async function addManualReference(input: {
  projectId: string;
  actorId: string;
  url: string;
  title?: string;
}) {
  assertSafeHttpUrl(input.url);
  const run = await prisma.searchRun.create({
    data: {
      projectId: input.projectId,
      query: input.title?.trim() || "手工补链",
      provider: "manual",
      status: "succeeded",
      createdById: input.actorId,
    },
  });
  const hit = await prisma.searchHit.create({
    data: {
      searchRunId: run.id,
      mediaType: "link",
      title: input.title?.trim() || null,
      url: input.url,
      rank: 0,
      selection: "selected",
    },
  });
  return { run, hit };
}

export async function transferFromUrl(input: {
  projectId: string;
  actorId: string;
  url: string;
  title?: string;
  allowedToolUrls: string[];
}): Promise<Asset> {
  if (!input.allowedToolUrls.includes(input.url)) {
    throw new AuthValidationError("只能转存工具返回或手工补链的地址");
  }
  const policy = readUploadPolicy();
  if (!policy.enabled) {
    throw new AuthDeniedError(policy.reason);
  }

  const safeUrl = assertSafeHttpUrl(input.url);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(safeUrl, {
      method: "GET",
      redirect: "manual",
      signal: controller.signal,
    });
    if (response.status >= 300 && response.status < 400) {
      throw new AuthValidationError("转存不允许跟随跳转");
    }
    if (!response.ok) {
      throw new AuthValidationError(`转存失败：HTTP ${response.status}`);
    }
    const mime = response.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
    if (mime && !policy.allowedMimeTypes.includes(mime) && !mime.startsWith("text/")) {
      // 文字参考可以不落二进制
      return prisma.asset.create({
        data: {
          projectId: input.projectId,
          origin: "web_reference",
          mediaType: "link",
          sourceUrl: input.url,
          filename: input.title ?? safeUrl.hostname,
          licenseStatus: "unknown",
          attribution: input.url,
          createdById: input.actorId,
        },
      });
    }
    const buf = Buffer.from(await response.arrayBuffer());
    if (buf.byteLength > policy.maxBytes) {
      throw new AuthValidationError("转存文件超过已配置大小上限");
    }
    if (mime && !policy.allowedMimeTypes.includes(mime)) {
      throw new AuthValidationError("转存类型不在允许列表");
    }
    const key = buildStorageKey(
      input.projectId,
      "rehost",
      input.title ?? "remote.bin",
    );
    await putObject(key, buf);
    return prisma.asset.create({
      data: {
        projectId: input.projectId,
        origin: "web_reference",
        mediaType: mime.startsWith("image/")
          ? "image"
          : mime.startsWith("video/")
            ? "video"
            : "document",
        storageKey: key,
        sourceUrl: input.url,
        filename: input.title ?? key.split("/").pop() ?? "remote",
        mime: mime || null,
        sizeBytes: buf.byteLength,
        licenseStatus: "unknown",
        attribution: input.url,
        createdById: input.actorId,
      },
    });
  } finally {
    clearTimeout(timer);
  }
}
