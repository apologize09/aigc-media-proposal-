import { toErrorResponse } from "@/server/auth/http";
import { requireAuthUser } from "@/server/auth/service";
import { deleteAsset } from "@/server/assets/service";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const actor = await requireAuthUser(request.headers.get("cookie"));
    const { id } = await context.params;
    await deleteAsset(actor, id);
    return Response.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
