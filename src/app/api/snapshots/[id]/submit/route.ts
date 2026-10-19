import { toErrorResponse } from "@/server/auth/http";
import { requireAuthUser } from "@/server/auth/service";
import { submitSnapshot } from "@/server/review/service";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const actor = await requireAuthUser(request.headers.get("cookie"));
    const { id } = await context.params;
    const result = await submitSnapshot(actor, id);
    return Response.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}
