import { AuthValidationError, toErrorResponse } from "@/server/auth/http";
import { requireAuthUser } from "@/server/auth/service";
import { getClient, updateClient } from "@/server/projects/service";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const actor = await requireAuthUser(request.headers.get("cookie"));
    const { id } = await context.params;
    const client = await getClient(actor, id);
    return Response.json(
      { client },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const actor = await requireAuthUser(request.headers.get("cookie"));
    const { id } = await context.params;
    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      throw new AuthValidationError("请求体无效");
    }

    const client = await updateClient({
      actor,
      clientId: id,
      name: body.name,
      contactName: body.contactName,
      contactEmail: body.contactEmail,
      contactPhone: body.contactPhone,
      internalNotes: body.internalNotes,
    });
    return Response.json({ client });
  } catch (error) {
    return toErrorResponse(error);
  }
}
