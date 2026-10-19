import { AuthValidationError, toErrorResponse } from "@/server/auth/http";
import { requireAuthUser } from "@/server/auth/service";
import { createClient, listClients } from "@/server/projects/service";

export async function GET(request: Request) {
  try {
    const actor = await requireAuthUser(request.headers.get("cookie"));
    const clients = await listClients(actor);
    return Response.json(
      { clients },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireAuthUser(request.headers.get("cookie"));
    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      throw new AuthValidationError("请求体无效");
    }

    const client = await createClient({
      actor,
      name: body.name,
      contactName: body.contactName,
      contactEmail: body.contactEmail,
      contactPhone: body.contactPhone,
      internalNotes: body.internalNotes,
    });
    return Response.json({ client }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
