import { toErrorResponse } from "@/server/auth/http";
import { requireAuthUser } from "@/server/auth/service";
import { removeProjectMember } from "@/server/projects/service";

type RouteContext = {
  params: Promise<{ id: string; userId: string }>;
};

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const actor = await requireAuthUser(request.headers.get("cookie"));
    const { id, userId } = await context.params;
    const project = await removeProjectMember({
      actor,
      projectId: id,
      userId,
    });
    return Response.json({ project });
  } catch (error) {
    return toErrorResponse(error);
  }
}
