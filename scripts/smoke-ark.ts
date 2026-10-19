import { VolcengineArkAdapter } from "../src/server/ai/adapter";
import { readModelConfig } from "../src/server/config";

async function main() {
  const config = readModelConfig();
  console.log("model_config", {
    configured: config.configured,
    reason: config.configured ? undefined : config.reason,
    baseUrl: config.configured ? config.baseUrl : undefined,
    model: config.configured ? config.model : undefined,
    hasKey: Boolean(process.env.AI_API_KEY?.trim()),
    fixture: process.env.AI_USE_FIXTURE === "1",
  });

  if (!config.configured) {
    throw new Error("模型未配置");
  }

  const adapter = new VolcengineArkAdapter();

  console.log("=== analyze ===");
  const t0 = Date.now();
  const analysis = await adapter.analyze({
    brief: "需要一支面向年轻用户的品牌短片提案，风格干净专业。",
    assetFilenames: ["brief.pdf"],
  });
  console.log("analyze_ok", {
    ms: Date.now() - t0,
    summary: analysis.summary.slice(0, 120),
    objectives: analysis.objectives.slice(0, 3),
    searchQueries: analysis.searchQueries.slice(0, 3),
  });

  console.log("=== generateDraft ===");
  const t1 = Date.now();
  try {
    const draft = await adapter.generateDraft({
      brief: "需要一支品牌短片",
      analysis,
    });
    console.log("generate_ok", {
      ms: Date.now() - t1,
      blockTypes: draft.blocks.map((block) => block.type),
      hitCount: draft.searchHits.length,
      queries: draft.searchQueries.slice(0, 5),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log("generate_expected_or_fail", {
      ms: Date.now() - t1,
      message,
      webSearchClosed: /web_search|内容插件/.test(message),
    });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
