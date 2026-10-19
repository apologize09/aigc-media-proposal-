import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const REQUIRED_KEYS = [
  "DATABASE_URL",
  "REDIS_URL",
  "AUTH_SECRET",
  "APP_BASE_URL",
  "SEED_ADMIN_EMAIL",
  "SEED_ADMIN_NAME",
  "SEED_ADMIN_PASSWORD",
  "S3_ENDPOINT",
  "S3_REGION",
  "S3_BUCKET",
  "S3_ACCESS_KEY",
  "S3_SECRET_KEY",
  "AI_PROVIDER",
  "AI_BASE_URL",
  "AI_API_KEY",
  "AI_MODEL",
  "AI_ALLOW_ASSET_UPLOAD",
  "AI_USE_FIXTURE",
  "UPLOAD_MAX_BYTES",
  "UPLOAD_ALLOWED_MIME",
  "SHARE_DEFAULT_TTL_HOURS",
  "AUTH_SESSION_TTL_HOURS",
  "AUTH_LOCKOUT_THRESHOLD",
  "LOG_LEVEL",
  "TRUST_PROXY",
];

const SECRET_KEYS = [
  "DATABASE_URL",
  "REDIS_URL",
  "AUTH_SECRET",
  "SEED_ADMIN_PASSWORD",
  "S3_ACCESS_KEY",
  "S3_SECRET_KEY",
  "AI_API_KEY",
  "AI_BASE_URL",
];

function readExample() {
  const file = readFileSync(
    path.resolve(process.cwd(), ".env.example"),
    "utf8",
  );
  const values = new Map<string, string>();

  for (const line of file.split("\n")) {
    if (line.trim() === "" || line.trim().startsWith("#")) {
      continue;
    }
    const separator = line.indexOf("=");
    values.set(line.slice(0, separator), line.slice(separator + 1));
  }

  return { file, values };
}

describe(".env.example", () => {
  it("包含规划中的键，且密钥为空", () => {
    const { file, values } = readExample();

    expect([...values.keys()]).toEqual(REQUIRED_KEYS);
    for (const key of SECRET_KEYS) {
      expect(values.get(key)).toBe("");
    }
    expect(values.get("AI_MODEL")).toBe("doubao-seed-evolving");
    expect(values.get("UPLOAD_MAX_BYTES")).toBe("");
    expect(values.get("AUTH_SESSION_TTL_HOURS")).toBe("");
    expect(values.get("SEED_ADMIN_EMAIL")).toBe("");
    expect(file).not.toMatch(/sk-[A-Za-z0-9]/);
    expect(file).not.toMatch(/AKIA[0-9A-Z]{16}/);
  });
});
