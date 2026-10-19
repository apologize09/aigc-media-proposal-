import { AuthValidationError, toErrorResponse } from "@/server/auth/http";
import { requireAuthUser } from "@/server/auth/service";
import { createProject, listProjects } from "@/server/projects/service";

export async function GET(request: Request) {
  try {
    const actor = await requireAuthUser(request.headers.get("cookie"));
    const includeArchived =
      new URL(request.url).searchParams.get("includeArchived") === "true";
    const projects = await listProjects(actor, { includeArchived });
    return Response.json(
      { projects },
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

    const project = await createProject({
      actor,
      clientId: body.clientId,
      title: body.title,
      brief: body.brief,
      ownerUserId: body.ownerUserId,
    });
    return Response.json({ project }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
