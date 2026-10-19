import { toErrorResponse } from "@/server/auth/http";
import { requireAuthUser } from "@/server/auth/service";
import { listSnapshots } from "@/server/proposal/publish";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const actor = await requireAuthUser(request.headers.get("cookie"));
    const { id } = await context.params;
    const snapshots = await listSnapshots(actor, id);
    return Response.json(
      { snapshots },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
