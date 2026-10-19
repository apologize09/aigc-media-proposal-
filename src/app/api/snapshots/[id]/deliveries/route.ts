import { toErrorResponse } from "@/server/auth/http";
import { requireAuthUser } from "@/server/auth/service";
import {
  createDelivery,
  listDeliveries,
} from "@/server/review/service";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const actor = await requireAuthUser(request.headers.get("cookie"));
    const { id } = await context.params;
    const deliveries = await listDeliveries(actor, id);
    return Response.json(
      { deliveries },
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
    const delivery = await createDelivery(actor, id);
    return Response.json({ delivery }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
