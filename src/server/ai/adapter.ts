import { readModelConfig } from "@/server/config";
import {
  ArkHttpError,
  callArkResponses,
  extractJsonObject,
  extractOutputText,
  extractWebSearchHits,
  type ExtractedSearchHit,
} from "@/server/ai/ark-client";

export type ProposalModelId = "doubao-seed-evolving";

export type AnalysisPayload = {
  summary: string;
  objectives: string[];
  audience: string | null;
  deliverableNotes: string | null;
  styleNotes: string | null;
  constraints: string[];
  openQuestions: string[];
  searchQueries: string[];
};

export type DraftBlock = {
  type: string;
  title: string;
  body: string;
  assetIds: string[];
  searchRefs: Array<{ title: string; url: string; snippet?: string }>;
};

export type GenerateDraftResult = {
  blocks: DraftBlock[];
  searchQueries: string[];
  searchHits: Array<{
    query: string;
    title: string;
    url: string;
    snippet?: string;
    mediaType: "image" | "video" | "link";
  }>;
};

export interface ProposalModelAdapter {
  readonly provider: "volcengine-ark";
  readonly model: ProposalModelId;
  analyze(input: {
    brief: string;
    assetFilenames: string[];
  }): Promise<AnalysisPayload>;
  generateDraft(input: {
    analysis: AnalysisPayload;
    brief: string;
  }): Promise<GenerateDraftResult>;
  regenerateBlock(input: {
    analysis: AnalysisPayload;
    blockType: string;
    currentBody: string;
  }): Promise<DraftBlock>;
}

export class ModelNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ModelNotConfiguredError";
  }
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string");
}

function parseAnalysisPayload(raw: unknown): AnalysisPayload {
  if (!raw || typeof raw !== "object") {
    throw new Error("分析结构无效");
  }
  const value = raw as Record<string, unknown>;
  const summary =
    typeof value.summary === "string"
      ? value.summary
      : typeof value.摘要 === "string"
        ? value.摘要
        : null;
  if (!summary) {
    throw new Error("分析缺少 summary，未写入半截结果");
  }
  return {
    summary,
    objectives: asStringArray(value.objectives ?? value.目标),
    audience:
      typeof value.audience === "string"
        ? value.audience
        : typeof value.受众 === "string"
          ? value.受众
          : null,
    deliverableNotes:
      typeof value.deliverableNotes === "string"
        ? value.deliverableNotes
        : typeof value.deliverable_notes === "string"
          ? value.deliverable_notes
          : null,
    styleNotes:
      typeof value.styleNotes === "string"
        ? value.styleNotes
        : typeof value.style_notes === "string"
          ? value.style_notes
          : null,
    constraints: asStringArray(value.constraints ?? value.约束),
    openQuestions: asStringArray(
      value.openQuestions ?? value.open_questions ?? value.待澄清问题,
    ),
    searchQueries: asStringArray(
      value.searchQueries ?? value.search_queries ?? value.检索提示,
    ),
  };
}

function parseDraftBlocks(raw: unknown): DraftBlock[] {
  if (!raw || typeof raw !== "object") {
    throw new Error("草稿结构无效");
  }
  const value = raw as Record<string, unknown>;
  const blocksRaw = value.blocks;
  if (!Array.isArray(blocksRaw) || blocksRaw.length === 0) {
    throw new Error("草稿缺少 blocks，未写入半截结果");
  }
  const blocks: DraftBlock[] = [];
  for (const item of blocksRaw) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const block = item as Record<string, unknown>;
    if (typeof block.type !== "string" || typeof block.title !== "string") {
      continue;
    }
    const searchRefsRaw = Array.isArray(block.searchRefs)
      ? block.searchRefs
      : Array.isArray(block.search_refs)
        ? block.search_refs
        : [];
    const searchRefs: DraftBlock["searchRefs"] = [];
    for (const ref of searchRefsRaw) {
      if (!ref || typeof ref !== "object") {
        continue;
      }
      const row = ref as Record<string, unknown>;
      if (typeof row.title === "string" && typeof row.url === "string") {
        searchRefs.push({
          title: row.title,
          url: row.url,
          snippet: typeof row.snippet === "string" ? row.snippet : undefined,
        });
      }
    }
    blocks.push({
      type: block.type,
      title: block.title,
      body: typeof block.body === "string" ? block.body : "",
      assetIds: asStringArray(block.assetIds ?? block.asset_ids),
      searchRefs,
    });
  }
  if (blocks.length === 0) {
    throw new Error("草稿 blocks 无法解析");
  }
  return blocks;
}

/**
 * 草稿里的 searchRefs 只保留工具命中集合中的 URL。
 * 模型正文里编造的地址全部丢弃。
 */
function filterRefsToToolUrls(
  blocks: DraftBlock[],
  toolHits: ExtractedSearchHit[],
): DraftBlock[] {
  const allowed = new Set(toolHits.map((hit) => hit.url));
  return blocks.map((block) => ({
    ...block,
    searchRefs: block.searchRefs.filter((ref) => allowed.has(ref.url)),
  }));
}

/** 无密钥时失败；有密钥时调用方舟。测试可注入 FixtureAdapter。 */
export class VolcengineArkAdapter implements ProposalModelAdapter {
  readonly provider = "volcengine-ark" as const;
  readonly model = "doubao-seed-evolving" as const;

  constructor(
    private readonly env: Record<string, string | undefined> = process.env,
  ) {}

  private requireConfigured() {
    const config = readModelConfig(this.env);
    if (!config.configured) {
      throw new ModelNotConfiguredError(config.reason);
    }
    return {
      ...config,
      apiKey: this.env.AI_API_KEY!.trim(),
    };
  }

  private async request(input: {
    messages: Array<{ role: string; content: string }>;
    withWebSearch: boolean;
  }) {
    const config = this.requireConfigured();
    try {
      return await callArkResponses({
        baseUrl: config.baseUrl,
        apiKey: config.apiKey,
        model: this.model,
        messages: input.messages,
        tools: input.withWebSearch ? [{ type: "web_search" }] : undefined,
        // 联网搜索往返更慢，给足余量。
        timeoutMs: input.withWebSearch ? 300_000 : 180_000,
      });
    } catch (error) {
      if (error instanceof ArkHttpError) {
        throw new Error(error.message);
      }
      throw error;
    }
  }

  async analyze(input: {
    brief: string;
    assetFilenames: string[];
  }): Promise<AnalysisPayload> {
    const prompt = [
      "你是传媒提案需求分析助手。只输出一个 JSON 对象，不要 Markdown，不要解释。",
      "字段：summary(string), objectives(string[]), audience(string|null), deliverable_notes(string|null), style_notes(string|null), constraints(string[]), open_questions(string[]), search_queries(string[])。",
      "禁止填写任何对外金额、报价、成本或利润数字。",
      `需求正文：${input.brief}`,
      `客户素材文件名：${input.assetFilenames.join(", ") || "无"}`,
    ].join("\n");

    const payload = await this.request({
      messages: [{ role: "user", content: prompt }],
      withWebSearch: false,
    });
    const text = extractOutputText(payload);
    if (!text) {
      throw new Error("方舟分析无文本输出");
    }
    return parseAnalysisPayload(extractJsonObject(text));
  }

  async generateDraft(input: {
    analysis: AnalysisPayload;
    brief: string;
  }): Promise<GenerateDraftResult> {
    const prompt = [
      "根据已确认分析生成传媒提案初稿。只输出一个 JSON 对象，不要 Markdown。",
      '结构：{"blocks":[{"type":"cover|understanding|creative|style|cases|storyboard|process|quote|schedule","title":"...","body":"...","assetIds":[],"searchRefs":[{"title":"...","url":"https://...","snippet":"..."}]}],"searchQueries":["..."]}',
      "quote 块的 body 留空字符串，不要写金额。金额由系统从报价表投影。",
      "searchRefs.url 只能来自本次联网搜索工具返回的真实地址；没有地址就省略该条。",
      "禁止编造成本、利润、任务和内部备注。",
      `分析 JSON：${JSON.stringify(input.analysis)}`,
      `原始需求：${input.brief}`,
    ].join("\n");

    const payload = await this.request({
      messages: [{ role: "user", content: prompt }],
      withWebSearch: true,
    });

    const { queries: toolQueries, hits: toolHits } =
      extractWebSearchHits(payload);
    const text = extractOutputText(payload);
    if (!text) {
      throw new Error("方舟生成无文本输出");
    }
    const parsed = extractJsonObject(text) as Record<string, unknown>;
    const blocks = filterRefsToToolUrls(parseDraftBlocks(parsed), toolHits);
    const modelQueries = asStringArray(
      parsed.searchQueries ?? parsed.search_queries,
    );

    return {
      blocks,
      searchQueries: [...new Set([...toolQueries, ...modelQueries])],
      searchHits: toolHits,
    };
  }

  async regenerateBlock(input: {
    analysis: AnalysisPayload;
    blockType: string;
    currentBody: string;
  }): Promise<DraftBlock> {
    if (input.blockType === "quote") {
      throw new Error("报价模块不可由模型重生成");
    }
    const prompt = [
      "重新生成提案中的一个模块。只输出一个 JSON 对象：",
      '{"type":"...","title":"...","body":"...","assetIds":[],"searchRefs":[{"title":"...","url":"https://...","snippet":"..."}]}',
      "searchRefs.url 只能来自本次联网搜索工具返回的真实地址。",
      "禁止填写对外金额。",
      `模块类型：${input.blockType}`,
      `当前正文：${input.currentBody}`,
      `分析：${JSON.stringify(input.analysis)}`,
    ].join("\n");

    const payload = await this.request({
      messages: [{ role: "user", content: prompt }],
      withWebSearch: true,
    });
    const { hits: toolHits } = extractWebSearchHits(payload);
    const text = extractOutputText(payload);
    if (!text) {
      throw new Error("方舟重生成无文本输出");
    }
    const parsed = extractJsonObject(text);
    const blocks = filterRefsToToolUrls(
      parseDraftBlocks({ blocks: [parsed] }),
      toolHits,
    );
    return blocks[0]!;
  }
}

export class FixtureAdapter implements ProposalModelAdapter {
  readonly provider = "volcengine-ark" as const;
  readonly model = "doubao-seed-evolving" as const;

  async analyze(input: {
    brief: string;
    assetFilenames: string[];
  }): Promise<AnalysisPayload> {
    return {
      summary: `基于需求的分析摘要：${input.brief.slice(0, 80)}`,
      objectives: ["完成提案初稿"],
      audience: "客户决策人",
      deliverableNotes: "HTML 提案",
      styleNotes: "专业中性",
      constraints: input.assetFilenames.length
        ? [`已提供 ${input.assetFilenames.length} 个素材`]
        : [],
      openQuestions: [],
      searchQueries: ["AIGC 传媒案例"],
    };
  }

  async generateDraft(input: {
    analysis: AnalysisPayload;
  }): Promise<GenerateDraftResult> {
    const url = "https://example.com/case-study";
    return {
      blocks: [
        {
          type: "cover",
          title: "封面",
          body: input.analysis.summary,
          assetIds: [],
          searchRefs: [],
        },
        {
          type: "creative",
          title: "创意",
          body: "创意方向说明",
          assetIds: [],
          searchRefs: [],
        },
        {
          type: "cases",
          title: "案例",
          body: "参考案例",
          assetIds: [],
          searchRefs: [{ title: "示例案例", url, snippet: "公开网页" }],
        },
        {
          type: "quote",
          title: "报价",
          body: "",
          assetIds: [],
          searchRefs: [],
        },
      ],
      searchQueries: input.analysis.searchQueries,
      searchHits: [
        {
          query: "AIGC 传媒案例",
          title: "示例案例",
          url,
          snippet: "工具返回的真实地址示例",
          mediaType: "link",
        },
      ],
    };
  }

  async regenerateBlock(input: {
    blockType: string;
    currentBody: string;
  }): Promise<DraftBlock> {
    return {
      type: input.blockType,
      title: input.blockType,
      body: `${input.currentBody}\n（已重生成）`,
      assetIds: [],
      searchRefs: [],
    };
  }
}

let injected: ProposalModelAdapter | null = null;

export function setModelAdapterForTests(adapter: ProposalModelAdapter | null) {
  injected = adapter;
}

export function getModelAdapter(): ProposalModelAdapter {
  if (injected) {
    return injected;
  }
  if (process.env.AI_USE_FIXTURE === "1") {
    return new FixtureAdapter();
  }
  return new VolcengineArkAdapter();
}
