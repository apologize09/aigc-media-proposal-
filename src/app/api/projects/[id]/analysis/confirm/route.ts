import { toErrorResponse } from "@/server/auth/http";
import { requireAuthUser } from "@/server/auth/service";
import { confirmCurrentAnalysis } from "@/server/analysis/service";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const actor = await requireAuthUser(request.headers.get("cookie"));
    const { id } = await context.params;
    const analysis = await confirmCurrentAnalysis(actor, id);
    return Response.json({ analysis });
  } catch (error) {
    return toErrorResponse(error);
  }
}
