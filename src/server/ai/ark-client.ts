/**
 * 火山方舟 Responses API 客户端与响应解析。
 * 不把密钥写入日志；不把整份响应写入业务表。
 */

export type ArkResponsePayload = {
  id?: string;
  status?: string;
  model?: string;
  output?: ArkOutputItem[];
  usage?: unknown;
  error?: { code?: string; message?: string; type?: string };
};

export type ArkUrlCitation = {
  type?: string;
  title?: string;
  url?: string;
  snippet?: string;
  summary?: string;
  site_name?: string;
};

export type ArkOutputItem = {
  type?: string;
  role?: string;
  status?: string;
  content?: Array<{
    type?: string;
    text?: string;
    annotations?: ArkUrlCitation[];
  }>;
  action?: { type?: string; query?: string };
  queries?: string[];
  results?: Array<{
    title?: string;
    url?: string;
    link?: string;
    snippet?: string;
    summary?: string;
  }>;
  [key: string]: unknown;
};

export class ArkHttpError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(status: number, message: string, code: string | null = null) {
    super(message);
    this.name = "ArkHttpError";
    this.status = status;
    this.code = code;
  }
}

export async function callArkResponses(input: {
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: Array<{ role: string; content: string }>;
  tools?: Array<{ type: string }>;
  timeoutMs?: number;
}): Promise<ArkResponsePayload> {
  const url = `${input.baseUrl.replace(/\/$/, "")}/responses`;
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    input.timeoutMs ?? 180_000,
  );
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: input.model,
        input: input.messages,
        ...(input.tools && input.tools.length > 0
          ? { tools: input.tools }
          : {}),
      }),
      signal: controller.signal,
    });

    const raw = await response.text();
    let payload: ArkResponsePayload = {};
    try {
      payload = raw ? (JSON.parse(raw) as ArkResponsePayload) : {};
    } catch {
      throw new ArkHttpError(
        response.status,
        `方舟返回非 JSON（HTTP ${response.status}）`,
      );
    }

    if (!response.ok) {
      const code = payload.error?.code ?? null;
      const message =
        payload.error?.message ??
        `方舟调用失败：HTTP ${response.status}`;
      if (code === "ToolNotOpen" || /web search/i.test(message)) {
        throw new ArkHttpError(
          response.status,
          "账号尚未开通方舟 web_search，请在控制台开通内容插件后再生成提案",
          code,
        );
      }
      if (/request burst|rate limit|slow down/i.test(message)) {
        throw new ArkHttpError(
          response.status,
          "方舟触发请求频率保护，请稍后重试",
          code,
        );
      }
      throw new ArkHttpError(response.status, message, code);
    }

    return payload;
  } catch (error) {
    if (error instanceof ArkHttpError) {
      throw error;
    }
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("方舟调用超时");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export function extractOutputText(payload: ArkResponsePayload): string {
  const parts: string[] = [];
  for (const item of payload.output ?? []) {
    if (item.type !== "message") {
      continue;
    }
    for (const block of item.content ?? []) {
      if (block.type === "output_text" && typeof block.text === "string") {
        parts.push(block.text);
      }
    }
  }
  return parts.join("\n").trim();
}

/** 从模型正文中取出第一个 JSON 对象；拒绝半截。 */
export function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(candidate.slice(start, end + 1));
    }
    throw new Error("模型未返回可解析的 JSON");
  }
}

export type ExtractedSearchHit = {
  query: string;
  title: string;
  url: string;
  snippet?: string;
  mediaType: "image" | "video" | "link";
};

function splitSearchQueries(raw: string): string[] {
  return raw
    .split(/[;；|]/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function pushHit(
  hits: ExtractedSearchHit[],
  seen: Set<string>,
  input: {
    query: string;
    title?: string;
    url: string;
    snippet?: string;
  },
) {
  if (!input.url.startsWith("http://") && !input.url.startsWith("https://")) {
    return;
  }
  if (seen.has(input.url)) {
    return;
  }
  seen.add(input.url);
  hits.push({
    query: input.query || "web_search",
    title: input.title?.trim() || input.url,
    url: input.url,
    snippet: input.snippet,
    mediaType: guessMediaType(input.url),
  });
}

/**
 * 只收录工具链路中的真实 URL：
 * 1) web_search_call.results（若有）
 * 2) message.output_text.annotations 里 type=url_citation 的引用
 * 模型正文里写出、但不在上述集合中的地址丢弃（由调用方 filter）。
 */
export function extractWebSearchHits(
  payload: ArkResponsePayload,
): { queries: string[]; hits: ExtractedSearchHit[] } {
  const queries: string[] = [];
  const hits: ExtractedSearchHit[] = [];
  const seen = new Set<string>();
  let lastQuery = "web_search";

  for (const item of payload.output ?? []) {
    const type = item.type ?? "";

    if (
      type === "web_search_call" ||
      type === "web_search" ||
      type.includes("web_search")
    ) {
      const query =
        (typeof item.action?.query === "string" && item.action.query) ||
        (Array.isArray(item.queries) && typeof item.queries[0] === "string"
          ? item.queries[0]
          : "") ||
        "";
      if (query) {
        for (const part of splitSearchQueries(query)) {
          queries.push(part);
        }
        lastQuery = splitSearchQueries(query)[0] ?? query;
      }

      const results = Array.isArray(item.results) ? item.results : [];
      for (const row of results) {
        const url =
          (typeof row.url === "string" && row.url) ||
          (typeof row.link === "string" && row.link) ||
          "";
        pushHit(hits, seen, {
          query: lastQuery,
          title: typeof row.title === "string" ? row.title : undefined,
          url,
          snippet:
            (typeof row.snippet === "string" && row.snippet) ||
            (typeof row.summary === "string" && row.summary) ||
            undefined,
        });
      }
      continue;
    }

    if (type !== "message") {
      continue;
    }

    for (const block of item.content ?? []) {
      for (const annotation of block.annotations ?? []) {
        if (annotation.type && annotation.type !== "url_citation") {
          continue;
        }
        if (typeof annotation.url !== "string") {
          continue;
        }
        pushHit(hits, seen, {
          query: lastQuery,
          title:
            typeof annotation.title === "string"
              ? annotation.title
              : undefined,
          url: annotation.url,
          snippet:
            (typeof annotation.snippet === "string" && annotation.snippet) ||
            (typeof annotation.summary === "string" && annotation.summary) ||
            undefined,
        });
      }
    }
  }

  return { queries: [...new Set(queries)], hits };
}

function guessMediaType(url: string): "image" | "video" | "link" {
  const lower = url.toLowerCase();
  if (/\.(png|jpe?g|gif|webp|svg)(\?|$)/.test(lower)) {
    return "image";
  }
  if (/\.(mp4|webm|mov|m3u8)(\?|$)/.test(lower)) {
    return "video";
  }
  return "link";
}
