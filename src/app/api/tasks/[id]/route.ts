import { toErrorResponse } from "@/server/auth/http";
import { requireAuthUser } from "@/server/auth/service";
import { updateTask } from "@/server/tasks/service";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const actor = await requireAuthUser(request.headers.get("cookie"));
    const { id } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;
    const task = await updateTask({
      actor,
      taskId: id,
      title: body.title,
      detail: body.detail,
      status: body.status,
      assigneeUserId: body.assigneeUserId,
      snapshotId: body.snapshotId,
      startOn: body.startOn,
      endOn: body.endOn,
      position: body.position,
    });
    return Response.json({ task });
  } catch (error) {
    return toErrorResponse(error);
  }
}
