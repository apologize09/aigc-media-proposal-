import { AuthValidationError, toErrorResponse } from "@/server/auth/http";
import { requireAuthUser } from "@/server/auth/service";
import { addProjectMember } from "@/server/projects/service";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const actor = await requireAuthUser(request.headers.get("cookie"));
    const { id } = await context.params;
    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      throw new AuthValidationError("请求体无效");
    }

    const project = await addProjectMember({
      actor,
      projectId: id,
      userId: body.userId,
      email: body.email,
    });
    return Response.json({ project }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
