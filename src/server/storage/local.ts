import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(process.cwd(), ".data", "storage");

export async function putObject(
  key: string,
  body: Buffer,
): Promise<{ key: string; size: number }> {
  const full = path.join(ROOT, key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, body);
  return { key, size: body.byteLength };
}

export async function getObject(key: string): Promise<Buffer> {
  return readFile(path.join(ROOT, key));
}

export async function deleteObject(key: string): Promise<void> {
  try {
    await unlink(path.join(ROOT, key));
  } catch {
    // ignore missing
  }
}

export function buildStorageKey(
  projectId: string,
  kind: string,
  filename: string,
): string {
  const safe = filename.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80);
  const stamp = randomBytes(8).toString("hex");
  return `projects/${projectId}/${kind}/${stamp}-${safe}`;
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function createShareToken(): string {
  return randomBytes(32).toString("base64url");
}
