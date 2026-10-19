import { AuthValidationError, toErrorResponse } from "@/server/auth/http";
import { requireAuthUser } from "@/server/auth/service";
import {
  enqueueAnalysis,
  getCurrentAnalysis,
  updateCurrentAnalysis,
} from "@/server/analysis/service";
import type { AnalysisPayload } from "@/server/ai/adapter";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const actor = await requireAuthUser(request.headers.get("cookie"));
    const { id } = await context.params;
    const analysis = await getCurrentAnalysis(actor, id);
    return Response.json(
      { analysis },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const actor = await requireAuthUser(request.headers.get("cookie"));
    const { id } = await context.params;
    const job = await enqueueAnalysis(actor, id);
    return Response.json({ job }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const actor = await requireAuthUser(request.headers.get("cookie"));
    const { id } = await context.params;
    let body: { payload?: AnalysisPayload };
    try {
      body = (await request.json()) as { payload?: AnalysisPayload };
    } catch {
      throw new AuthValidationError("请求体无效");
    }
    if (!body.payload) {
      throw new AuthValidationError("缺少 payload");
    }
    const analysis = await updateCurrentAnalysis(actor, id, body.payload);
    return Response.json({ analysis });
  } catch (error) {
    return toErrorResponse(error);
  }
}
