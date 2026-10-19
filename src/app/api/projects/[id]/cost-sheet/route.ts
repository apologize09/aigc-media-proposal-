import { AuthValidationError, toErrorResponse } from "@/server/auth/http";
import { requireAuthUser } from "@/server/auth/service";
import { getCostSheet, saveCostSheet } from "@/server/pricing/service";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const actor = await requireAuthUser(request.headers.get("cookie"));
    const { id } = await context.params;
    const costSheet = await getCostSheet(actor, id);
    return Response.json(
      { costSheet },
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
    let body: { currency?: string | null; lines?: unknown };
    try {
      body = (await request.json()) as {
        currency?: string | null;
        lines?: unknown;
      };
    } catch {
      throw new AuthValidationError("请求体无效");
    }
    if (!Array.isArray(body.lines)) {
      throw new AuthValidationError("缺少 lines");
    }
    const costSheet = await saveCostSheet({
      actor,
      projectId: id,
      currency: body.currency,
      lines: body.lines as Array<{
        label: string;
        quantity: string | number;
        unit?: string | null;
        unitAmount?: string | number | null;
        lineAmount?: string | number | null;
        note?: string | null;
      }>,
    });
    return Response.json({ costSheet });
  } catch (error) {
    return toErrorResponse(error);
  }
}
