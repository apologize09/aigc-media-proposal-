import { AuthValidationError, toErrorResponse } from "@/server/auth/http";
import { requireAuthUser } from "@/server/auth/service";
import { getQuoteLines, saveQuoteLines } from "@/server/pricing/service";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const actor = await requireAuthUser(request.headers.get("cookie"));
    const { id } = await context.params;
    const quoteLines = await getQuoteLines(actor, id);
    return Response.json(
      { quoteLines },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const actor = await requireAuthUser(request.headers.get("cookie"));
    const { id } = await context.params;
    let body: { lines?: unknown };
    try {
      body = (await request.json()) as { lines?: unknown };
    } catch {
      throw new AuthValidationError("请求体无效");
    }
    if (!Array.isArray(body.lines)) {
      throw new AuthValidationError("缺少 lines");
    }
    const quoteLines = await saveQuoteLines({
      actor,
      projectId: id,
      lines: body.lines as Array<{
        label: string;
        quantity: string | number;
        unit?: string | null;
        unitAmount?: string | number | null;
        lineAmount?: string | number | null;
        visibleInProposal?: boolean;
        costLineId?: string | null;
      }>,
    });
    return Response.json({ quoteLines });
  } catch (error) {
    return toErrorResponse(error);
  }
}
