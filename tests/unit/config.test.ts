import { describe, expect, it } from "vitest";

import {
  readModelConfig,
  readSessionPolicy,
  readUploadPolicy,
} from "@/server/config";

describe("运行配置", () => {
  it("不给上传限制填默认值", () => {
    expect(readUploadPolicy({})).toEqual({
      enabled: false,
      reason: "上传限制未配置",
    });
  });

  it("上传大小和类型都存在时才允许上传", () => {
    expect(
      readUploadPolicy({
        UPLOAD_MAX_BYTES: "1024",
        UPLOAD_ALLOWED_MIME: "image/png, image/jpeg",
      }),
    ).toEqual({
      enabled: true,
      maxBytes: 1024,
      allowedMimeTypes: ["image/png", "image/jpeg"],
    });
  });

  it("不写死会话小时数和锁定次数", () => {
    expect(readSessionPolicy({})).toEqual({
      ttlHours: null,
      lockoutThreshold: null,
    });
  });

  it("缺少密钥或地址时不把模型视为已配置", () => {
    expect(readModelConfig({ AI_MODEL: "doubao-seed-evolving" })).toEqual({
      configured: false,
      reason: "模型未配置",
    });
  });

  it("拒绝改派到其他模型", () => {
    expect(
      readModelConfig({
        AI_MODEL: "other-model",
        AI_BASE_URL: "https://example.test",
        AI_API_KEY: "local-test-key",
      }),
    ).toEqual({
      configured: false,
      reason: "模型 ID 必须为 doubao-seed-evolving",
    });
  });
});
