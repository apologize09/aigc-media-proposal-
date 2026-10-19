import { VolcengineArkAdapter } from "../src/server/ai/adapter";
import { readModelConfig } from "../src/server/config";

async function main() {
  const config = readModelConfig();
  if (!config.configured) {
    throw new Error(config.reason);
  }
  const adapter = new VolcengineArkAdapter();
  const analysis = {
    summary: "面向年轻用户的品牌短片提案，风格干净专业",
    objectives: ["完成提案初稿"],
    audience: "品牌主",
    deliverableNotes: "HTML 提案",
    styleNotes: "干净专业",
    constraints: [] as string[],
    openQuestions: [] as string[],
    searchQueries: ["面向年轻用户的品牌短片案例", "AIGC 广告案例"],
  };

  console.log("generate_start", new Date().toISOString());
  const t0 = Date.now();
  const draft = await adapter.generateDraft({
    brief: "需要一支干净专业的品牌短片提案",
    analysis,
  });
  console.log("generate_ok", {
    ms: Date.now() - t0,
    blockTypes: draft.blocks.map((block) => block.type),
    queries: draft.searchQueries.slice(0, 8),
    hitCount: draft.searchHits.length,
    hitUrls: draft.searchHits.slice(0, 5).map((hit) => hit.url),
    casesRefs: draft.blocks
      .filter((block) => block.type === "cases")
      .flatMap((block) => block.searchRefs.map((ref) => ref.url)),
  });
}

main().catch((error) => {
  console.error(
    "generate_fail",
    error instanceof Error ? error.message : error,
  );
  process.exitCode = 1;
});
