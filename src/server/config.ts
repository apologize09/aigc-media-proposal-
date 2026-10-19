export type UploadPolicy =
  | { enabled: false; reason: "上传限制未配置" }
  | { enabled: true; maxBytes: number; allowedMimeTypes: string[] };

export type SessionPolicy = {
  ttlHours: number | null;
  lockoutThreshold: number | null;
};

export type ModelConfig =
  | { configured: false; reason: string }
  | {
      configured: true;
      provider: "volcengine-ark";
      model: "doubao-seed-evolving";
      baseUrl: string;
    };

const FIXED_MODEL = "doubao-seed-evolving";

export function readOptionalPositiveInteger(
  raw: string | undefined,
  name: string,
): number | null {
  if (raw === undefined || raw.trim() === "") {
    return null;
  }

  if (!/^[1-9]\d*$/.test(raw.trim())) {
    throw new Error(`${name} 必须为空或正整数`);
  }

  const value = Number(raw);
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${name} 必须为空或正整数`);
  }

  return value;
}

export function readUploadPolicy(
  env: Record<string, string | undefined> = process.env,
): UploadPolicy {
  const maxBytes = readOptionalPositiveInteger(
    env.UPLOAD_MAX_BYTES,
    "UPLOAD_MAX_BYTES",
  );
  const allowedMimeTypes = (env.UPLOAD_ALLOWED_MIME ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  if (maxBytes === null || allowedMimeTypes.length === 0) {
    return { enabled: false, reason: "上传限制未配置" };
  }

  return { enabled: true, maxBytes, allowedMimeTypes };
}

export function readSessionPolicy(
  env: Record<string, string | undefined> = process.env,
): SessionPolicy {
  return {
    ttlHours: readOptionalPositiveInteger(
      env.AUTH_SESSION_TTL_HOURS,
      "AUTH_SESSION_TTL_HOURS",
    ),
    lockoutThreshold: readOptionalPositiveInteger(
      env.AUTH_LOCKOUT_THRESHOLD,
      "AUTH_LOCKOUT_THRESHOLD",
    ),
  };
}

export function readModelConfig(
  env: Record<string, string | undefined> = process.env,
): ModelConfig {
  const model = env.AI_MODEL?.trim() || FIXED_MODEL;
  if (model !== FIXED_MODEL) {
    return { configured: false, reason: "模型 ID 必须为 doubao-seed-evolving" };
  }

  const baseUrl = env.AI_BASE_URL?.trim() ?? "";
  const apiKey = env.AI_API_KEY?.trim() ?? "";
  if (baseUrl === "" || apiKey === "") {
    return { configured: false, reason: "模型未配置" };
  }

  return {
    configured: true,
    provider: "volcengine-ark",
    model: FIXED_MODEL,
    baseUrl,
  };
}
