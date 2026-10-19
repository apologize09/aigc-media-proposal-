import { toErrorResponse } from "@/server/auth/http";
import { requireAuthUser } from "@/server/auth/service";
import { revokeDelivery } from "@/server/review/service";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const actor = await requireAuthUser(request.headers.get("cookie"));
    const { id } = await context.params;
    const delivery = await revokeDelivery(actor, id);
    return Response.json({ delivery });
  } catch (error) {
    return toErrorResponse(error);
  }
}
