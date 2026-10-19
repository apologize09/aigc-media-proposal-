import type { Asset } from "@prisma/client";

import {
  AuthNotFoundError,
  AuthValidationError,
} from "@/server/auth/http";
import { AuthDeniedError } from "@/server/auth/permissions";
import type { AuthUser } from "@/server/auth/types";
import { writeAudit } from "@/server/audit/service";
import { readUploadPolicy } from "@/server/config";
import { prisma } from "@/server/db";
import {
  assertCanMutateProject,
  assertCanViewProject,
} from "@/server/projects/access";
import { buildStorageKey, deleteObject, putObject } from "@/server/storage/local";

export type PublicAsset = {
  id: string;
  projectId: string;
  origin: string;
  mediaType: string;
  storageKey: string | null;
  sourceUrl: string | null;
  filename: string | null;
  mime: string | null;
  sizeBytes: number | null;
  licenseStatus: string;
  attribution: string | null;
  createdAt: string;
};

function toPublic(asset: Asset): PublicAsset {
  return {
    id: asset.id,
    projectId: asset.projectId,
    origin: asset.origin,
    mediaType: asset.mediaType,
    storageKey: asset.storageKey,
    sourceUrl: asset.sourceUrl,
    filename: asset.filename,
    mime: asset.mime,
    sizeBytes: asset.sizeBytes,
    licenseStatus: asset.licenseStatus,
    attribution: asset.attribution,
    createdAt: asset.createdAt.toISOString(),
  };
}

function mediaTypeFromMime(mime: string): "image" | "video" | "document" {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  return "document";
}

export async function listAssets(
  actor: AuthUser,
  projectId: string,
): Promise<PublicAsset[]> {
  await assertCanViewProject(actor, projectId);
  const rows = await prisma.asset.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toPublic);
}

export async function uploadAsset(input: {
  actor: AuthUser;
  projectId: string;
  filename: string;
  mime: string;
  bytes: Buffer;
}): Promise<PublicAsset> {
  await assertCanMutateProject(input.actor, input.projectId);
  const policy = readUploadPolicy();
  if (!policy.enabled) {
    throw new AuthDeniedError(policy.reason);
  }
  if (input.bytes.byteLength > policy.maxBytes) {
    throw new AuthValidationError("文件超过已配置大小上限");
  }
  if (!policy.allowedMimeTypes.includes(input.mime)) {
    throw new AuthValidationError("文件类型不在允许列表");
  }

  const key = buildStorageKey(input.projectId, "uploads", input.filename);
  await putObject(key, input.bytes);

  const asset = await prisma.asset.create({
    data: {
      projectId: input.projectId,
      origin: "client_upload",
      mediaType: mediaTypeFromMime(input.mime),
      storageKey: key,
      filename: input.filename,
      mime: input.mime,
      sizeBytes: input.bytes.byteLength,
      licenseStatus: "unknown",
      createdById: input.actor.id,
    },
  });

  await writeAudit({
    actorUserId: input.actor.id,
    action: "asset.upload",
    entityType: "asset",
    entityId: asset.id,
    projectId: input.projectId,
    metadata: { mime: input.mime, sizeBytes: input.bytes.byteLength },
  });

  return toPublic(asset);
}

export async function deleteAsset(
  actor: AuthUser,
  assetId: string,
): Promise<void> {
  const asset = await prisma.asset.findUnique({ where: { id: assetId } });
  if (!asset) {
    throw new AuthNotFoundError("素材不存在");
  }
  await assertCanMutateProject(actor, asset.projectId);

  const draft = await prisma.proposalDraft.findUnique({
    where: { projectId: asset.projectId },
  });
  if (draft) {
    const raw = JSON.stringify(draft.projectJson);
    if (raw.includes(asset.id)) {
      throw new AuthValidationError("素材仍被提案草稿引用，不能删除");
    }
  }

  if (asset.storageKey) {
    await deleteObject(asset.storageKey);
  }
  await prisma.asset.delete({ where: { id: asset.id } });
  await writeAudit({
    actorUserId: actor.id,
    action: "asset.delete",
    entityType: "asset",
    entityId: asset.id,
    projectId: asset.projectId,
  });
}

export async function getAssetForDownload(
  actor: AuthUser,
  assetId: string,
): Promise<{ asset: PublicAsset; body: Buffer }> {
  const asset = await prisma.asset.findUnique({ where: { id: assetId } });
  if (!asset || !asset.storageKey) {
    throw new AuthNotFoundError("素材不存在或无可下载副本");
  }
  await assertCanViewProject(actor, asset.projectId);
  const { getObject } = await import("@/server/storage/local");
  const body = await getObject(asset.storageKey);
  return { asset: toPublic(asset), body };
}
