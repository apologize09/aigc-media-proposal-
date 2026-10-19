import { toErrorResponse } from "@/server/auth/http";
import { requireAuthUser } from "@/server/auth/service";
import { getProfit } from "@/server/pricing/service";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const actor = await requireAuthUser(request.headers.get("cookie"));
    const { id } = await context.params;
    const profit = await getProfit(actor, id);
    return Response.json(
      { profit },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
